import { defineConfig } from 'drizzle-kit';

// 本地 SQLite 快照：构建期读取，不参与运行时
export default defineConfig({
  dialect: 'sqlite',
  schema: './db/schema.ts',
  out: './db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./db/site.db',
  },
});
