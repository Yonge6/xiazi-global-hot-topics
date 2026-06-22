# Legacy Web Implementation Plan

> This document preserves the original single-web-app implementation plan. Its Phase numbering is legacy and must not be used for the current multi-platform migration. Use `docs/MULTI_PLATFORM_ROADMAP.md` and `DECISIONS.md` for current Phase 0+ planning.

## Goal

在 `pluto.hk` 建立高品质双语全球热点网站。每天北京时间 05:00 发布一期，对应 GMT 前一日 21:00，固定展示最新且最值得关注的 9 条热点，标题遵循“事实；观点”；自动发布先使用默认海报，正式海报由后台逐张替换。

## Architecture

- Next.js App Router + React Server Components，交互组件最小化。
- `/zh`、`/en` 为独立可索引 URL，`next-intl` 管理界面消息。
- TypeScript strict + Zod 管理内容和 AI 输出边界。
- Supabase Postgres 使用版本化 SQL migration；长任务通过 `jobs` 状态机跟踪。
- 海报遵循 DECISIONS.md D-005：中文和英文是两张独立生成、独立存储、独立 QA 的完整整图海报，前端不使用 HTML、CSS 或 SVG 替换海报内部文字。

## Phase 1: Foundation and Editorial Homepage

1. 初始化 Next.js、Tailwind CSS、ESLint、Vitest、Playwright。
2. 建立 locale 路由、语言切换、SEO metadata、sitemap 和 robots。
3. 定义 Issue、Topic、Source、Poster、Job 类型与 Zod schema。
4. 创建 9 条完整中英文 Mock 热点与来源。
5. 实现紧凑刊头、9 条目录式 Masonry 卡片、完整海报预览、Lightbox、下载和页脚。
6. 添加 Supabase 初始 migration、`.env.example` 与 README。
7. 运行 lint、typecheck、unit、Playwright 和 production build。

## Phase 2: Content System

1. 接入 Supabase 服务端数据读取。
2. 实现 Issue、Topic、Source CRUD、详情、档案、搜索和分类页。
3. 实现管理员认证、候选池和 Issue 编辑器。
4. 增加修订历史、事实核验、审计日志和发布流程。

## Phase 3: AI Research Workflow

1. 先实现 Mock Provider，再实现 OpenAI Responses Provider。
2. 建立候选发现、去重、评分、选 9 条和双语内容生成。
3. 使用定时任务在北京时间每天 `05:00` 创建并执行一期任务，Cron 为 `0 21 * * *`。
4. 增加幂等锁、断点续跑、重试和成本记录。

## Phase 4: Poster System

1. 建立品牌资产库和角色参考图管理。
2. 用环境变量配置的正式图像模型分别生成中文和英文完整海报。
3. 将 `src/lib/brand/characters.ts` 的不可变特征、允许变化项和禁用造型注入视觉 Prompt。
4. 按 Master PRD v3.0 生成相互独立的中文、英文完整整图海报。
5. 为每条海报生成指向 Topic URL 的二维码。
6. 增加尺寸、文本溢出、角色、时间、域名和二维码 QA。

## Phase 5: Release

1. 补齐后台发布主流程和 Playwright 覆盖。
2. 完成性能、可访问性和图片交付优化。
3. 配置 Vercel、Supabase、Storage、RLS、监控和告警。
4. 完成品牌素材替换、内容校对和生产发布。
