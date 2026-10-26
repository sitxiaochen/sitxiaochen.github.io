/**
 * 构建期同步：Markdown frontmatter -> SQLite 快照
 * 每次 npm run build 前自动执行，保证数据库与内容始终一致。
 *
 * 用 .mjs 而非 .ts：避免依赖 --experimental-strip-types，
 * 该 flag 在 Node 22/24 上行为不一致，会导致 CI 构建失败。
 */
import { readFileSync, readdirSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createClient } from '@libsql/client';

const ROOT = process.cwd();
const POSTS_DIR = join(ROOT, 'src', 'content', 'posts');
const DB_PATH = join(ROOT, 'db', 'site.db');

/** 极简 YAML frontmatter 解析（只覆盖本项目用到的子集） */
function parseFrontmatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return { data: {}, body: raw };

  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1];
    const rawVal = kv[2].trim();

    if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
      data[key] = rawVal
        .slice(1, -1)
        .split(',')
        .map((x) => x.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else if (/^(true|false)$/.test(rawVal)) {
      data[key] = rawVal === 'true';
    } else {
      data[key] = rawVal.replace(/^["']|["']$/g, '');
    }
  }
  return { data, body: m[2] };
}

/** 中文按字符数 / 英文按词数估算阅读时长（约 350 字/分钟） */
function countReading(text) {
  const plain = text.replace(/```[\s\S]*?```/g, '').replace(/[#>*`\-|[\]()]/g, '');
  const cjk = (plain.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const words = (plain.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+/g) ?? []).length;
  return { wordCount: cjk + words, readingTime: Math.max(1, Math.round(cjk / 350 + words / 200)) };
}

mkdirSync(join(ROOT, 'db'), { recursive: true });
if (existsSync(DB_PATH)) rmSync(DB_PATH);

const client = createClient({ url: `file:${DB_PATH}` });

await client.batch(
  [
    `CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      published_at TEXT NOT NULL,
      updated_at TEXT,
      category TEXT NOT NULL DEFAULT '杂谈',
      draft INTEGER NOT NULL DEFAULT 0,
      lang TEXT NOT NULL DEFAULT 'zh-CN',
      reading_time INTEGER NOT NULL DEFAULT 0,
      word_count INTEGER NOT NULL DEFAULT 0,
      cover TEXT,
      source TEXT NOT NULL
    )`,
    `CREATE TABLE tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    )`,
    `CREATE TABLE post_tags (
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, tag_id)
    )`,
    `CREATE TABLE post_links (
      from_post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      to_slug TEXT NOT NULL,
      PRIMARY KEY (from_post_id, to_slug)
    )`,
    `CREATE TABLE redirects (
      from_path TEXT PRIMARY KEY,
      to_path TEXT NOT NULL
    )`,
    `CREATE INDEX idx_posts_published ON posts(published_at)`,
    `CREATE INDEX idx_posts_category ON posts(category)`,
  ],
  'write',
);

const files = existsSync(POSTS_DIR)
  ? readdirSync(POSTS_DIR).filter((f) => extname(f) === '.md')
  : [];

let count = 0;
for (const file of files) {
  const raw = readFileSync(join(POSTS_DIR, file), 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const slug = file.replace(/\.md$/, '');
  const { wordCount, readingTime } = countReading(body);
  const publishedAt = String(data.publishedAt ?? '').slice(0, 10);

  if (!data.title || !publishedAt) {
    console.warn(`[skip] ${file} 缺少 title 或 publishedAt`);
    continue;
  }

  await client.execute({
    sql: `INSERT INTO posts
      (slug, title, description, published_at, updated_at, category, draft, lang, reading_time, word_count, cover, source)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      slug,
      data.title,
      data.description ?? '',
      publishedAt,
      data.updatedAt ? String(data.updatedAt).slice(0, 10) : null,
      data.category ?? '杂谈',
      data.draft ? 1 : 0,
      data.lang ?? 'zh-CN',
      readingTime,
      wordCount,
      data.cover ?? null,
      `src/content/posts/${file}`,
    ],
  });

  const postRow = await client.execute({ sql: 'SELECT id FROM posts WHERE slug = ?', args: [slug] });
  const postId = Number(postRow.rows[0].id);

  for (const tagName of data.tags ?? []) {
    const tagSlug = tagName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u4e00-\u9fa5-]/g, '');
    await client.execute({
      sql: 'INSERT INTO tags (slug, name) VALUES (?,?) ON CONFLICT(slug) DO NOTHING',
      args: [tagSlug, tagName],
    });
    const tagRow = await client.execute({ sql: 'SELECT id FROM tags WHERE slug = ?', args: [tagSlug] });
    await client.execute({
      sql: 'INSERT INTO post_tags (post_id, tag_id) VALUES (?,?) ON CONFLICT DO NOTHING',
      args: [postId, Number(tagRow.rows[0].id)],
    });
  }

  // 收集站内链接（/posts/xxx/ 或 ./xxx.md）
  const links = new Set();
  for (const m of body.matchAll(/\]\(\/posts\/([^/)#]+)\/?/g)) links.add(m[1]);
  for (const m of body.matchAll(/\]\(\.\/([\w-]+)\.md\)/g)) links.add(m[1]);
  for (const to of links) {
    await client.execute({
      sql: 'INSERT INTO post_links (from_post_id, to_slug) VALUES (?,?) ON CONFLICT DO NOTHING',
      args: [postId, to],
    });
  }
  count++;
}

// 旧 URL 兼容映射（Hexo 时代的扁平路径 -> 新结构）
const REDIRECTS = [
  ['/2024/06/26/Geek/', '/posts/geek/'],
  ['/2024/06/26/Ventoy/', '/posts/ventoy/'],
  ['/2024/06/26/卸载软件工具/Geek/', '/posts/geek/'],
  ['/2024/06/26/镜像引导工具/Ventoy/', '/posts/ventoy/'],
  ['/2026/07/28/AI/AI模块上线/', '/categories/'],
];

for (const [from, to] of REDIRECTS) {
  await client.execute({
    sql: 'INSERT INTO redirects (from_path, to_path) VALUES (?,?) ON CONFLICT(from_path) DO NOTHING',
    args: [from, to],
  });
}
const tagCount = (await client.execute('SELECT COUNT(*) AS c FROM tags')).rows[0].c;
console.log(`[db] 已同步 ${count} 篇文章 / ${tagCount} 个标签 -> db/site.db`);
client.close();
