import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * 文章集合：Content Layer + Zod 校验
 * Markdown 文件是唯一真相；frontmatter 字段不合法会在构建期直接报错。
 */
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string().max(120),
    description: z.string().max(300),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    category: z.string().default('杂谈'),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    lang: z.string().default('zh-CN'),
    cover: z.string().optional(),
  }),
});

export const collections = { posts };
