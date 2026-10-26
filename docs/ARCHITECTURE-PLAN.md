# 博客架构重构方案（待确认）

> 状态：**规划草案，未执行任何改动**
> 日期：2026-07-29（基于本次实测）
> 仓库：`sitxiaochen/sitxiaochen.github.io`

---

## 一、现状诊断（实测结论）

| 维度 | 现状 | 判定 |
|---|---|---|
| 架构 | Hexo 渲染产物**直接提交**到 main，无源码 | ❌ 不可维护，改样式只能手工改 HTML |
| 源码 | 仓库内无 `package.json` / `_config.yml` / `source/` | ❌ 源码在本地某处未纳入版本控制 |
| 内容 | 12 个文章页 = 2 篇真实文章 + 10 篇空壳"占位" | ❌ 占位页污染 SEO 与归档 |
| 重复 | Geek/Ventoy 各有 2 套 URL（旧扁平路径 + 新分类路径） | ❌ 重复内容，收录冲突 |
| 前端 | 纯静态 HTML，35 个 html 手工拼装 | ❌ 无法组件化 |
| 依赖 | bootstrap / nprogress 走 `lib.baomitu.com`，图标走 `at.alicdn.com` | ⚠️ 第三方 CDN，非自控 |
| 数据 | 无数据库，文章列表由 Hexo 烘焙进 HTML | ⚠️ 无检索、无标签关联、无统计 |
| 部署 | GitHub Pages，`https://sitxiaochen.github.io/` 全站 200，404 正常，主页 297ms | ✅ 在线健康 |
| 工作区 | 56 个文件"已修改"，`git diff --ignore-all-space` 为空 | ⚠️ 纯 CRLF 行尾抖动，无实质变更 |
| 网络 | github.com 直连 `Connection was reset`，代理 `192.168.0.2:7893` 处于关闭 | ❌ 当前无法 push |

**结论**：内容层可用性良好（线上正常），但**工程层已不可维护**，符合"开大刀"的判断。

---

## 二、目标（重构后应达到）

1. **源码入库**：`main` 存源码，构建产物走 `gh-pages` 分支或 Actions 产物，产物永不进主干。
2. **前端可长期维护**：组件化、类型安全、依赖锁版本、CI 自动检查。
3. **全链路自主可控**：不依赖第三方 CDN，不依赖会关停的托管型 ORM。
4. **数据可查询**：文章元数据进真数据库，支持标签/分类/全文检索/阅读统计。
5. **写作体验**：不打开 IDE 也能发文（浏览器内 CMS）。
6. **内容可迁移**：Markdown 源文件为唯一真相，可随时迁出任何平台。

---

## 三、技术选型（推荐方案 A：Astro 静态优先 + 浏览器内 CMS）

### 3.1 前端框架 → **Astro 7.4.2**

| 评估项 | 依据 |
|---|---|
| 定位 | 内容优先站点官方首选，Islands 架构，默认零 JS |
| 构建性能 | 5000 页约 260s；本博客规模（<100 页）秒级 |
| 内容层 | Content Layer API（Astro 5+）= loader + Zod schema + 类型安全 |
| 生态 | Content Collections、RSS、Sitemap、图片优化均**官方内置**，第三方插件需求极低 |
| 维护性 | 官方核心团队维护，语义化版本，当前 7.x 活跃 |
| GitHub Pages | 纯静态输出，天然适配 |
| 学习成本 | `.astro` 语法接近 HTML，运维背景可直接上手 |

**为什么不是 Next.js**：RSC/App Router 迭代频繁，对纯内容站是过度工程，构建产物更重。
**为什么不是 Hugo**：构建最快但模板语言 Go template 学习曲线陡，且无类型安全与组件生态，JS 交互需手工写。
**为什么不是 SvelteKit**：优秀，但博客不需要 SPA 路由与客户端状态，Astro 的零 JS 更贴合。

### 3.2 交互层（按需） → **原生 JS / Alpine.js**

博客的交互只有：暗色切换、目录滚动高亮、代码复制、搜索框。
→ 用 **零依赖原生 JS**，必要时引入 Alpine.js（15KB）。**不引入 React/Vue**。

### 3.3 样式 → **Tailwind CSS 4.3.3** + `@tailwindcss/typography`

原子化 + 官方 prose 插件处理 Markdown 排版，避免手写 300 行 CSS。

### 3.4 语言 → **TypeScript 7.0.2**

内容 schema、构建脚本、CI 全部类型化，重构期靠编译器兜底。

### 3.5 检索 → **Pagefind 1.5.2**

构建后对静态 HTML 建立**静态索引**，浏览器内检索，零后端、零费用、支持中文分词。
替代现有 `local-search.xml` / `search.json` 的 Hexo 方案。

### 3.6 数据库 → **SQLite (libSQL) + Drizzle ORM 0.45.4**

> ⚠️ 重要：Astro 官方 `@astrojs/db`（Astro DB）已在 **v6.4 弃用、v7.0 移除**，
> 官方建议迁移到第三方库。**不要选 Astro DB**，否则一年内必然返工。

| 层 | 选型 | 理由 |
|---|---|---|
| 引擎 | SQLite (libSQL) | 单文件、无服务、可用 DB Browser 直接看、可整体备份 |
| ORM | Drizzle 0.45.4 | 类型安全、无运行时开销、原生支持 libSQL |
| 驱动 | `@libsql/client` 0.18.0 | 本地文件 + 远端 Turso 同一套 API |
| 部署位置 | **构建期**检入 SQLite 快照 | 站点静态化后不需要运行时数据库 |
| 未来扩展 | Turso / Cloudflare D1 | 需要动态接口时只换驱动，不改代码 |

**关键设计**：博客是读多写少的静态站，数据库的价值在**构建期**——
文章元数据、标签关系、阅读统计、站内链接图谱，全部在 build 时从 SQLite 查询后烘焙进 HTML。
运行时零数据库依赖，也就零运维、零被关停风险。

可选动态能力（后续）：阅读计数、评论 → 用 **Cloudflare Workers + D1** 或 **Giscus**（基于 GitHub Discussions，零后端）。

### 3.7 内容编写 → **Markdown / MDX + Sveltia CMS**

| 项 | 说明 |
|---|---|
| 存储 | `src/content/posts/*.md`（Markdown 为唯一真相，可随时迁出） |
| 校验 | Astro Content Layer + Zod schema 强制 frontmatter 字段 |
| 在线编辑 | **Sveltia CMS**（MIT，Decap/Netlify CMS 的继任者），装在 `/admin/`，浏览器内直连 GitHub 提交 |
| 登录方式 | **GitHub OAuth PKCE**，无需 OAuth 代理服务器、无需数据库、无需订阅 |
| 备选 | 本地 VS Code 直接写 Markdown（两条路并存） |

### 3.8 部署 → **GitHub Pages + GitHub Actions**

- `main` = 源码；Actions 中 `astro build` → 产物推到 `gh-pages` 分支
- 加 Cloudflare 反代（可选，后续）：解决国内访问质量
- 保留 `sitxiaochen.github.io` 域名，URL 结构做 301 兼容旧链接

### 3.9 依赖自控 → **全部 Vendor 到本地**

移除 `lib.baomitu.com` / `at.alicdn.com` 外部引用，字体图标改为本地 SVG sprite 或 `@fontsource`。
目标：**页面无任何第三方 CDN 依赖**，断网环境也可完整渲染。

---

## 四、目标结构

```
sitxiaochen.github.io/
├── .github/workflows/deploy.yml      # CI: build → 发布 gh-pages
├── astro.config.mjs
├── package.json                      # 锁版本 + npm ci
├── tsconfig.json
├── drizzle.config.ts
├── db/
│   ├── schema.ts                     # 文章/标签/分类/统计 表定义
│   └── site.db                       # SQLite 快照（构建期读取）
├── scripts/
│   ├── sync-content.ts               # MD 解析 → 写 SQLite
│   └── migrate-hexo.ts               # 一次性：旧 HTML → Markdown
├── src/
│   ├── content.config.ts             # Content Layer + Zod schema
│   ├── content/
│   │   ├── posts/                    # 文章 Markdown（唯一真相）
│   │   └── authors/
│   ├── components/                   # Header/Footer/PostCard/TOC/Search
│   ├── layouts/                      # BaseLayout / PostLayout
│   ├── pages/                        # 路由
│   │   ├── index.astro
│   │   ├── posts/[...slug].astro
│   │   ├── tags/[tag].astro
│   │   ├── categories/[cat].astro
│   │   ├── archives.astro
│   │   ├── about.astro
│   │   └── rss.xml.ts
│   ├── styles/                       # Tailwind 入口
│   └── lib/db.ts                     # Drizzle 客户端
├── public/
│   ├── admin/                        # Sveltia CMS 入口
│   ├── fonts/  img/                  # 本地资源，无外链
│   └── CNAME
└── docs/
```

**URL 规范**：`/posts/<slug>/`、`/tags/<tag>/`、`/categories/<cat>/`
旧地址映射：`/2024/06/26/Geek/` → 301 → `/posts/geek/`

---

## 五、数据库 Schema（草案）

```ts
posts        id, slug, title, description, published_at, updated_at,
             category, draft, lang, reading_time, cover
tags         id, slug, name
post_tags    post_id, tag_id            // 多对多
links        from_post_id, to_post_id   // 站内链接图谱
stats        post_id, views, last_viewed // 可选动态
```

---

## 六、分阶段执行计划

| 阶段 | 内容 | 产出 | 风险 |
|---|---|---|---|
| **P0 备份** | 全仓 `git bundle` + 打 tag `legacy-hexo` | 可完整回滚 | 无 |
| **P1 脚手架** | 初始化 Astro + TS + Tailwind + 目录骨架 | 空站可 build | 无 |
| **P2 内容迁移** | 旧 HTML 正文 → Markdown，去重，废弃占位页 | `src/content/posts/*.md` | 低 |
| **P3 模板重建** | 布局/组件/首页/归档/标签/分类 | 视觉可交付 | 中 |
| **P4 数据层** | Drizzle + SQLite + 同步脚本 + 构建期查询 | 标签/关联由 DB 驱动 | 中 |
| **P5 检索** | Pagefind 集成 + 中文分词调优 | 站内搜索可用 | 低 |
| **P6 CMS** | Sveltia CMS + GitHub OAuth App | 浏览器发文 | 中 |
| **P7 自控资源** | 移除外部 CDN，字体图标本地化 | 零外链 | 低 |
| **P8 部署** | Actions + gh-pages + CNAME + 旧 URL 301 | 自动发布 | **高（切域名）** |
| **P9 收尾** | Lighthouse、sitemap、RSS、SEO meta、OG 图 | 验收 | 低 |

**切换策略**：新站先在 `gh-pages-preview` 分支预览，确认后一次性切 main 发布源，旧仓库内容以 tag 形式永久保留。

---

## 七、决策点（需要你拍板）

| # | 问题 | 选项 |
|---|---|---|
| D1 | 前端框架 | **A. Astro（推荐）** / B. Hugo / C. SvelteKit / D. Next.js |
| D2 | 数据库落地方式 | **A. SQLite 构建期快照（推荐）** / B. Turso 云 libSQL / C. Cloudflare D1 / D. 暂不做数据库 |
| D3 | 内容编写方式 | **A. Markdown + Sveltia CMS（推荐）** / B. 纯本地 VS Code / C. 引入 Headless CMS（Strapi 自托管） |
| D4 | 域名 | **A. 保留 `sitxiaochen.github.io`** / B. 换自定义域名 / C. 加 Cloudflare 反代 |
| D5 | 旧 URL | **A. 保留 301 兼容（推荐）** / B. 直接废弃重来 |
| D6 | 视觉风格 | A. 极简技术风（推荐，暗色优先） / B. 杂志风 / C. 卡片仪表盘风 |
| D7 | 是否要后端动态能力 | A. 纯静态（推荐） / B. 加阅读计数+评论（Giscus 或 Workers+D1） |
| D8 | 旧 Hexo 分支处理 | A. 打 tag 归档后删除产物（推荐） / B. 保留为独立分支 |

---

## 八、明确不做（控制范围）

- 不引入 React/Vue/SPA 路由
- 不引入 Docker/K8s（本机无 Docker，博客无此需求）
- 不引入 GraphQL
- 不自建评论服务（用 Giscus 或不做）
- 不迁移内容到需要登录的私有平台
