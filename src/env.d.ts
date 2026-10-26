/// <reference types="astro/client" />

/**
 * Pagefind 运行时模块声明。
 * 该文件由 `pagefind --site dist` 在构建后生成到 dist/pagefind/，
 * 源码阶段不存在，因此在此声明类型供 TypeScript 使用。
 */
declare module '/pagefind/pagefind.js' {
  export interface PagefindResultData {
    url: string;
    excerpt: string;
    meta: { title?: string; [key: string]: string | undefined };
    content?: string;
    word_count?: number;
  }

  export interface PagefindSearchResult {
    data: () => Promise<PagefindResultData>;
  }

  export function options(opts: Record<string, unknown>): Promise<void>;
  export function search(query: string): Promise<{ results: PagefindSearchResult[] }>;
}
