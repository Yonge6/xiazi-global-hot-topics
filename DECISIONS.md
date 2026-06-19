# Technical and Product Decisions

## D-001: Locale URLs

首发只开放 `zh` 和 `en`，分别映射内容 locale `zh-CN`、`en-US`。根路径重定向到 `/zh`。语言切换保留当前路径结构。

## D-002: Rendering Strategy

公开内容默认使用 Server Components。语言切换等需要浏览器状态的区域才使用 Client Components，以减少 JavaScript 和提升首屏性能。

## D-003: Database Layer

第一阶段使用 Supabase 原生 SQL migration，而不是提前引入 ORM。这样可直接利用 Postgres enum、jsonb、数组、RLS 和 Supabase Cron，同时保持迁移可审查。

## D-004: Mock Content

9 条演示热点是用于界面和数据验证的编辑样稿，不表示 2026 年 6 月 14 日的实时新闻。真实发布前必须由研究流程替换并核验。

## D-005: Poster Separation

Master PRD v3.0 要求 `poster_zh` 与 `poster_en` 是两张独立生成、独立存储和独立 QA 的完整整图海报。前端不得用 HTML、CSS 或 SVG 替换海报内部文字。

## D-006: Model Configuration

模型名、质量、尺寸和格式只从环境变量读取。默认值只写入 `.env.example`，业务代码不散落模型名称。

## D-007: Character Assets

已将用户提供的虾子曰和豆豆龙 PNG 纳入 `public/brand`。两位角色均已有透明前视图及三视图、表情动作和造型参考，正式生产仍需补齐最终 Logo 与授权字体文件。

## D-008: Scheduling and Automatic Publishing

每天北京时间 `05:00` 更新并发布一期，对应 GMT 前一日 `21:00`，Cron 为 `0 21 * * *`。内容完成来源核验后直接发布双语文字，18 个海报位置先使用统一默认图；正式中英文海报由手机后台逐张替换。任务保留幂等、重试、质量检查和失败中止。

## D-009: Fonts

CSS 优先使用设备已有的 Noto/Source Han 字体并提供可靠回退。生产部署前应提供并自托管品牌确认后的 WOFF2 字体。

## D-010: Poster Tone and QR

海报视觉整体保持欢快、阳光、正向，不以阴郁或恐慌制造注意力。每张中英文海报固定显示 `pluto.hk` 和真实二维码；二维码优先指向对应热点的独立 URL，详情页完成前使用当前语言首页的热点锚点。

## D-011: Brand Reference Assets

角色三视图、表情动作板、毛绒四视图和品牌规范图统一放入 `public/brand/references`，仅供管理员和图像生成流程参考。可直接交付到网页或海报的素材放在 `public/brand` 根目录。图像生成必须读取 `src/lib/brand/characters.ts` 中的不可变特征和禁用规则。

## D-012: Poster Time Zones

中文海报固定显示北京时间（Asia/Shanghai）；英文海报固定显示格林威治时间（GMT/UTC+0）。两者必须由同一发布时间转换生成，禁止分别手填。

## D-013: Monorepo Shared Contracts

Issue、Topic、Source 等跨端数据结构统一放在 `packages/contracts`，业务排序、发布时间和分享规则放在 `packages/domain`。Web、Mini、Mobile 后续不得复制这些 contract。

## D-014: Supabase Will Become the Content Source of Truth

Supabase content schema v2 是后续内容主库的目标形态，包含幂等导入、修订快照和审计日志。Phase 3 只验证等价数据底座。

## D-015: Phase 3 Keeps JSON as Production Source

`CONTENT_REPOSITORY` 默认值必须保持 `json`。Pluto.hk 生产在 Phase 3 不切到 Supabase；Supabase Repository 只用于 local/staging 验证和双源一致性检查。

## D-016: COS Remains Binary Asset Storage

Phase 3 不把 PNG、JPG、WebP 等二进制海报搬进数据库。Supabase 只保存可验证的内容结构和可选海报元数据，COS/GitHub 仍承载现有图片路径。

## D-017: GitHub Binary Asset Publishing Is Legacy

GitHub Contents API 的 JSON 和海报写入链路在 Phase 3 保留，不修改现有 Studio 生产写入流程。Phase 4 才评估双写、影子写入和逐步移除运行时 GitHub 写入。

## D-018: Phase 4A Uses Production Supabase for Shadow Reads Only

Phase 4A 可以创建并导入独立的 `pluto-production` Supabase，但 Pluto.hk 对外主数据源必须继续为 JSON。影子比较只能通过受保护的内部接口或 Cron 后台执行，记录日期、字段路径、差异数量、读取耗时和错误码；Supabase 失败不得影响公开页面、API 或 Studio 现有 GitHub 写入链路。进入 Phase 4B 前必须完成 24 小时观察窗口并覆盖一次北京时间 05:00 刊期。
