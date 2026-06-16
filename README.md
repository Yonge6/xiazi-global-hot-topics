# 虾子曰全球热点海报

`vilesaint.com` 的生产级基础项目。每天北京时间 00:05，用 9 条全球热点和双语内容解释正在变化的世界。

## 当前阶段

- Next.js App Router、TypeScript strict、Tailwind CSS 4、next-intl
- `/zh` 与 `/en` 双语首页及同路径语言切换
- 9 条中英文 Mock 热点和推荐阅读
- 当代艺术目录风格首页、响应式 Masonry 瀑布流
- 海报 Lightbox、键盘切换、原图查看和下载
- 用户提供的虾子曰、豆豆龙品牌参考图
- 完整角色三视图、表情、动作、色板与禁用造型规范
- 每条海报可扫描二维码，指向对应语言和热点
- Issue、Topic、Source、Poster、Job 类型与 Supabase migration
- 基础 SEO、sitemap、robots、Vitest 和 Playwright

Mock 内容只用于产品演示，不代表实时新闻。

## 本地运行

要求 Node.js 20.9 或更高版本。

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:3000/zh` 或 `http://localhost:3000/en`。

## 质量检查

```bash
npm run lint
npm run typecheck
npm run test
npx playwright install chromium
npm run test:e2e
npm run build
```

## Supabase

创建 Supabase 项目，将 `.env.example` 中的 Supabase 变量写入 `.env.local`，连接 Supabase CLI 后执行：

```bash
supabase db push
```

初始 migration 位于 `supabase/migrations/202606140001_initial_content_schema.sql`，包含基础表、枚举、索引和公开读取 RLS。管理员写入策略、Auth 角色和审计日志将在 Phase 2 加入。

## 模型与海报配置

所有模型通过环境变量配置。正式海报遵循：

1. 每个热点分别生成一张中文完整海报和一张英文完整海报。
2. 两种语言海报独立存储、独立替换、独立 QA，不在前端覆盖或替换海报内部文字。
3. 内容核验完成后生成中文与英文完整海报，通过 QA 后发布。
4. 中文海报显示北京时间，英文海报显示 GMT；两种海报都必须含 `vilesaint.com`、虾子曰和豆豆龙。
5. 每张海报包含二维码，最终指向 `/{locale}/topics/{topicSlug}`。
6. 视觉保持欢快、阳光、正向，同时不弱化事实的严肃性。

## 定时任务

生产环境定时任务在北京时间每天 `00:05` 运行，对应前一日 UTC `16:05`：

```cron
5 16 * * *
```

Cron 更新最新 9 条双语内容并发布。Vercel Cron 同时调用 `/api/cron/default-posters`，使用线上 COS 密钥将默认海报铺到中英文 18 个位置并写入当日归档；正式海报由后台上传后逐张替换。页面在慢网或图片失败时也会立即显示默认海报。

当前仓库包含 9 张中文视觉海报和 9 张独立英文整图海报。两种语言使用各自的原图与缩略图资源。

## 部署

1. 将仓库导入 Vercel。
2. 配置 `.env.example` 中全部生产变量。
3. 将 `NEXT_PUBLIC_SITE_URL` 设置为 `https://vilesaint.com`。
4. 在 Supabase 执行 migration，并创建 Storage buckets。
5. 将域名 DNS 指向 Vercel。
6. 部署前运行 `npm run check`、`npm run test:e2e` 和 `npm run build`。

## 文档

- [实施计划](./IMPLEMENTATION_PLAN.md)
- [技术决策](./DECISIONS.md)
- [品牌资产清单](./docs/BRAND_ASSETS.md)
