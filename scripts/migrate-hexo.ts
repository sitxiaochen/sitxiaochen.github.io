/**
 * 一次性迁移：把 legacy/ 下 Hexo 渲染出的 HTML 正文提取为 Markdown
 * 用法：node --experimental-strip-types scripts/migrate-hexo.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'src', 'content', 'posts');

interface Source {
  html: string;
  slug: string;
  category: string;
  tags: string[];
  publishedAt: string;
  title: string;
}

const SOURCES: Source[] = [
  {
    html: 'legacy/2024/06/26/卸载软件工具/Geek/index.html',
    slug: 'geek',
    category: '卸载软件工具',
    tags: ['工具', 'Windows'],
    publishedAt: '2024-06-26',
    title: 'Geek Uninstaller 使用体验',
  },
  {
    html: 'legacy/2024/06/26/镜像引导工具/Ventoy/index.html',
    slug: 'ventoy',
    category: '镜像引导工具',
    tags: ['工具', '启动盘'],
    publishedAt: '2024-06-26',
    title: 'Ventoy：一个 U 盘装多个系统镜像',
  },
];

/** HTML 片段 -> 近似 Markdown */
function htmlToMarkdown(fragment: string): string {
  let s = fragment;

  // 移除 headerlink 锚点
  s = s.replace(/<a href="#[^"]*" class="headerlink"[^>]*><\/a>/g, '');
  s = s.replace(/<a[^>]*class="headerlink"[^>]*><\/a>/g, '');

  // 标题
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g, (_m, lvl, txt) => {
    return `\n\n${'#'.repeat(Number(lvl))} ${strip(txt)}\n\n`;
  });

  // 代码块
  s = s.replace(/<figure[^>]*class="highlight[^"]*"[^>]*>([\s\S]*?)<\/figure>/g, (_m, inner) => {
    const code = strip(inner).replace(/^\s*\n/, '');
    return `\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
  });
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/g, (_m, inner) => `\n\n\`\`\`\n${strip(inner)}\n\`\`\`\n\n`);
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/g, (_m, inner) => `\`${strip(inner)}\``);

  // 图片
  s = s.replace(/<img([^>]*)\/?>/g, (_m, attrs) => {
    const src = /src="([^"]*)"/.exec(attrs)?.[1] ?? '';
    const alt = /alt="([^"]*)"/.exec(attrs)?.[1] ?? '';
    return `![${alt}](${src})`;
  });

  // 链接
  s = s.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (_m, href, txt) => {
    const text = strip(txt).trim();
    // 裸链接不重复包裹
    if (!text || text === href) return href;
    return `[${text}](${href})`;
  });

  // 强调
  s = s.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/g, (_m, t) => `**${strip(t)}**`);
  s = s.replace(/<b[^>]*>([\s\S]*?)<\/b>/g, (_m, t) => `**${strip(t)}**`);
  s = s.replace(/<em[^>]*>([\s\S]*?)<\/em>/g, (_m, t) => `*${strip(t)}*`);

  // 列表
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, (_m, t) => `- ${strip(t).trim()}\n`);
  s = s.replace(/<\/?(ul|ol)[^>]*>/g, '\n');

  // 引用
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g, (_m, t) => {
    return '\n\n' + strip(t).trim().split('\n').map((l) => `> ${l}`).join('\n') + '\n\n';
  });

  // 段落 / 换行
  s = s.replace(/<br\s*\/?>/g, '\n');
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/g, (_m, t) => `\n\n${strip(t).trim()}\n\n`);
  s = s.replace(/<hr\s*\/?>/g, '\n\n---\n\n');

  // 移除剩余标签
  s = strip(s);

  // 收尾清理
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/[ \t]+\n/g, '\n');
  return s.trim();
}

function strip(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

/** 抽出 <div class="markdown-body"> 内的正文 */
function extractBody(html: string): string | null {
  const start = html.indexOf('class="markdown-body"');
  if (start === -1) return null;
  const open = html.indexOf('>', start);
  if (open === -1) return null;
  // 从 open 之后开始，按 div 嵌套深度配平
  let depth = 1;
  let i = open + 1;
  const re = /<\/?div\b[^>]*>/gi;
  re.lastIndex = i;
  let m: RegExpExecArray | null;
  let end = -1;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('</')) {
      depth--;
      if (depth === 0) {
        end = m.index;
        break;
      }
    } else {
      depth++;
    }
  }
  if (end === -1) return null;
  return html.slice(open + 1, end);
}

let migrated = 0;
for (const src of SOURCES) {
  const path = join(ROOT, src.html);
  if (!existsSync(path)) {
    console.warn(`[skip] 源文件不存在: ${src.html}`);
    continue;
  }
  const html = readFileSync(path, 'utf8');
  const body = extractBody(html);
  if (!body) {
    console.warn(`[skip] 未找到 markdown-body: ${src.html}`);
    continue;
  }

  const md = htmlToMarkdown(body);
  const frontmatter = [
    '---',
    `title: ${JSON.stringify(src.title)}`,
    `description: ${JSON.stringify(md.replace(/\s+/g, ' ').slice(0, 80) + '…')}`,
    `publishedAt: ${src.publishedAt}`,
    `category: ${JSON.stringify(src.category)}`,
    `tags: [${src.tags.map((t) => JSON.stringify(t)).join(', ')}]`,
    'draft: false',
    'lang: zh-CN',
    '---',
    '',
  ].join('\n');

  mkdirSync(OUT_DIR, { recursive: true });
  const out = join(OUT_DIR, `${src.slug}.md`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, frontmatter + md + '\n', 'utf8');
  console.log(`[ok] ${src.slug}.md  (${md.length} chars)`);
  migrated++;
}

console.log(`\n迁移完成：${migrated}/${SOURCES.length}`);
