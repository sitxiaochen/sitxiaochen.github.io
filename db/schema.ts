import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

/**
 * 博客数据层 Schema
 * 设计原则：SQLite 只作为「构建期数据快照」，
 * 站点构建时由 scripts/sync-content.ts 从 Markdown 重新生成，
 * 运行时零数据库依赖。
 */

export const posts = sqliteTable(
  'posts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    /** ISO 8601 日期，如 2024-06-26 */
    publishedAt: text('published_at').notNull(),
    updatedAt: text('updated_at'),
    category: text('category').notNull().default('杂谈'),
    draft: integer('draft', { mode: 'boolean' }).notNull().default(false),
    lang: text('lang').notNull().default('zh-CN'),
    /** 预估阅读分钟数 */
    readingTime: integer('reading_time').notNull().default(0),
    /** 正文字符数 */
    wordCount: integer('word_count').notNull().default(0),
    cover: text('cover'),
    /** Markdown 源文件相对路径 */
    source: text('source').notNull(),
  },
  (t) => [index('idx_posts_published').on(t.publishedAt), index('idx_posts_category').on(t.category)],
);

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
});

export const postTags = sqliteTable(
  'post_tags',
  {
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })],
);

/** 站内链接图谱：哪篇文章链向哪篇 */
export const postLinks = sqliteTable(
  'post_links',
  {
    fromPostId: integer('from_post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    toSlug: text('to_slug').notNull(),
  },
  (t) => [primaryKey({ columns: [t.fromPostId, t.toSlug] })],
);

/** 旧 URL 到新 URL 的 301 映射表 */
export const redirects = sqliteTable(
  'redirects',
  {
    fromPath: text('from_path').primaryKey(),
    toPath: text('to_path').notNull(),
  },
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Tag = typeof tags.$inferSelect;
