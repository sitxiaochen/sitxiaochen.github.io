import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from '@db/schema';

/**
 * 构建期数据库客户端。
 * 只读打开 db/site.db（由 scripts/sync-content.ts 生成）。
 * 站点运行时不需要此文件——它只在 astro build 阶段执行。
 */
const client = createClient({ url: 'file:./db/site.db' });

export const db = drizzle(client, { schema });
export { schema };
