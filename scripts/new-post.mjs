/**
 * 新建文章脚手架
 * 用法：npm run new -- "文章标题" [分类]
 * 例：  npm run new -- "Docker 常用命令" Linux
 *
 * 用 .mjs 而非 .ts：避免依赖 --experimental-strip-types（Node 22/24 行为不一致）
 */
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const POSTS_DIR = join(process.cwd(), 'src', 'content', 'posts');

const title = process.argv[2];
const category = process.argv[3] ?? '杂谈';

if (!title) {
  console.error('用法: npm run new -- "文章标题" [分类]');
  process.exit(1);
}

/** 中文标题转 slug：保留中文字符，空格转连字符 */
function slugify(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const slug = slugify(title) || `post-${Date.now()}`;
const file = join(POSTS_DIR, `${slug}.md`);

if (existsSync(file)) {
  console.error(`已存在：src/content/posts/${slug}.md`);
  process.exit(1);
}

mkdirSync(POSTS_DIR, { recursive: true });

const today = new Date().toISOString().slice(0, 10);

const content = `---
title: ${JSON.stringify(title)}
description: ${JSON.stringify(`${title} —— 待补充摘要`)}
publishedAt: ${today}
category: ${JSON.stringify(category)}
tags: []
draft: true
lang: zh-CN
---

## 正文开始

在这里写内容。
`;

writeFileSync(file, content, 'utf8');
console.log(`已创建：src/content/posts/${slug}.md`);
console.log('提示：frontmatter 中 draft: true，写成后改为 false 再发布。');
