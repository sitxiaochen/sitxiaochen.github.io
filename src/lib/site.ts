export const SITE = {
  title: 'Sit',
  author: 'sitxiaochen',
  description: 'sitxiaochen 的个人博客 —— 记录运维、开发工具与 AI 实践',
  url: 'https://sitxiaochen.github.io',
  lang: 'zh-CN',
  nav: [
    { href: '/', label: '首页' },
    { href: '/archives/', label: '归档' },
    { href: '/categories/', label: '分类' },
    { href: '/tags/', label: '标签' },
    { href: '/about/', label: '关于' },
  ],
};

/** 统一的日期格式化：2024-06-26 */
export function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
