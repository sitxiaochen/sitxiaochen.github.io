# sitxiaochen 个人博客

基于 **Astro** 的静态技术博客，内容以 Markdown 维护，数据层用 **SQLite** 在构建期汇总，全站零第三方 CDN 依赖。

线上地址：<https://sitxiaochen.github.io/>

---

## 技术栈

| 层 | 选型 | 作用 |
|---|---|---|
| 站点框架 | Astro 7 | 静态生成，默认零 JS，Islands 按需加载 |
| 语言 | TypeScript | 内容 schema 与构建脚本全类型化 |
| 样式 | Tailwind CSS 4 + typography | 原子化样式，暗色优先的设计语言 |
| 数据层 | SQLite (libSQL) + Drizzle ORM | 构建期文章/标签/链接图谱快照 |
| 检索 | Pagefind | 构建时生成静态索引，纯前端全文检索 |
| 内容编辑 | Sveltia CMS | 浏览器内编辑，直连 GitHub 提交 |
| 部署 | GitHub Actions → GitHub Pages | 推送即构建发布 |

**设计取舍**：博客是读多写少的静态站，数据库只在 **构建期** 使用——
文章元数据、标签关系、站内链接，全部在 `astro build` 时从 SQLite 查出并烘焙进 HTML。
运行时零数据库依赖，因此零运维、零费用、零被第三方服务关停的风险。

---

## 快速开始

```bash
npm install        # 安装依赖
npm run dev        # 本地开发 http://localhost:4321
npm run build      # 完整构建（同步数据库 → 生成站点 → 建搜索索引）
npm run preview    # 预览构建产物（搜索功能需在此模式验证）
```

> 搜索索引由构建后处理生成，`npm run dev` 下搜索页会提示索引未就绪，属正常现象。

---

## 目录结构

```
.
├── .github/workflows/deploy.yml   # CI：构建并发布到 gh-pages
├── astro.config.mjs               # 站点配置（URL、sitemap、Shiki 主题）
├── drizzle.config.ts              # Drizzle Kit 配置
├── tsconfig.json                  # 路径别名 @/* → src/*，@db/* → db/*
├── db/
│   ├── schema.ts                  # 表结构：posts / tags / post_tags / post_links / redirects
│   └── site.db                    # 构建期快照（git 忽略，每次 build 重建）
├── scripts/
│   ├── sync-content.ts            # Markdown frontmatter → SQLite
│   ├── migrate-hexo.ts            # 一次性：旧 Hexo HTML → Markdown
│   └── new-post.ts                # 新建文章脚手架
├── src/
│   ├── content.config.ts          # Content Layer + Zod 校验
│   ├── content/posts/             # 文章 Markdown（唯一真相）
│   ├── components/                # Header / Footer / PostCard / LegacyRedirect
│   ├── layouts/BaseLayout.astro   # 全站骨架 + SEO meta + 主题切换
│   ├── lib/                       # site.ts（站点常量）/ db.ts（构建期 DB 客户端）
│   ├── pages/                     # 路由
│   └── styles/global.css          # 设计系统（语义色、排版、动效）
├── public/
│   ├── admin/                     # Sveltia CMS 入口与配置
│   └── favicon.svg
├── legacy/                        # 旧 Hexo 渲染产物归档（只读，可删）
└── docs/ARCHITECTURE-PLAN.md      # 本次重构的完整方案与决策记录
```

---

## 写文章

### 方式一：命令行脚手架

```bash
npm run new -- "Docker 常用命令" Linux
```

生成 `src/content/posts/docker-常用命令.md`，默认 `draft: true`，写完改 `false` 即发布。

### 方式二：浏览器内 CMS

访问 `/admin/`，用 GitHub 账号登录即可编辑并提交（Git + Editorial Workflow）。

### Frontmatter 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `title` | ✅ | 标题，≤ 120 字 |
| `description` | ✅ | 摘要，≤ 300 字，用于列表与 SEO |
| `publishedAt` | ✅ | 发布日期 `YYYY-MM-DD` |
| `category` | | 分类，默认「杂谈」 |
| `tags` | | 标签数组 |
| `draft` | | `true` 时构建期排除 |
| `updatedAt` | | 更新日期 |
| `cover` | | 封面图 |

字段不合法会在 **构建期直接失败**（Zod 强校验），不会静默产出错误页面。

---

## URL 约定

| 类型 | 路径 |
|---|---|
| 文章 | `/posts/<slug>/` |
| 分类 | `/categories/<分类名>/` |
| 标签 | `/tags/<标签名>/` |
| 归档 | `/archives/` |
| 搜索 | `/search/` |
| RSS | `/rss.xml` |

**旧链接兼容**：Hexo 时代的 `/2024/06/26/Geek/` 等地址，
会以 meta refresh + canonical 跳转到新地址，搜索结果与老读者链接不会失效。

---

## 部署

推送到 `main` 触发 `.github/workflows/deploy.yml`：

```
npm ci → npm run check → npm run build → 发布 dist/ 到 gh-pages 分支
```

需在仓库 **Settings → Pages** 中把发布源设为 `gh-pages` 分支根目录。

---

## 维护约定

- **依赖升级**：`npm outdated` 定期检查，`astro` 主版本升级前先读 migration guide
- **内容备份**：Markdown 即数据源，`git clone` 即完整备份
- **数据库**：`db/site.db` 不入库，随时可由 `npm run db:sync` 重建
- **旧产物**：`legacy/` 目录可随时删除，不影响新站

---

## 许可证

内容版权归作者所有，转载请注明出处。代码部分可自由参考。
