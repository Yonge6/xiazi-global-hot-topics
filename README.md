# 虾子曰全球热点海报

`pluto.hk` 的生产级基础项目。每天北京时间 05:00，用 1 张今日总览和 8 件全球热点的双语内容解释正在变化的世界。

## 当前阶段

- Next.js App Router、TypeScript strict、Tailwind CSS 4、next-intl
- `/zh` 与 `/en` 双语首页及同路径语言切换
- 9 张中英文内容卡片：1 张今日总览 + 8 件全球热点和推荐阅读
- 当代艺术目录风格首页、响应式 Masonry 瀑布流
- 海报 Lightbox、键盘切换、原图查看和下载
- 用户提供的虾子曰、豆豆龙品牌参考图
- 完整角色三视图、表情、动作、色板与禁用造型规范
- 每条海报可扫描二维码，指向对应语言和热点
- Issue、Topic、Source、Poster、Job 共享 contract 与 Supabase content schema v2
- JSON Repository 仍是生产默认数据源；Supabase Repository 可用于本地验证和 Phase 4A 生产影子读取
- 基础 SEO、sitemap、robots、Vitest 和 Playwright

Mock 内容只用于产品演示，不代表实时新闻。

## 本地运行

要求 Node.js 20.9 或更高版本。

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
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

## Supabase Content Base

Phase 3 建立 Supabase 内容底座，Phase 4A 只允许生产影子读取；两者都不切换 Pluto.hk 对外主数据源。Phase 4B 引入 Studio 影子双写，但由独立服务端开关控制。生产默认仍为：

```env
CONTENT_REPOSITORY=json
STUDIO_SHADOW_WRITE_ENABLED=false
```

本地 Docker Supabase 承担开发、migration、导入测试和破坏性 staging 验证。`.env.local` 至少需要：

```env
CONTENT_REPOSITORY=json
SUPABASE_ENV=local
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
STUDIO_SHADOW_WRITE_ENABLED=false
```

`SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` are preferred. Legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` still work as server-side fallbacks. Never put secret keys in `NEXT_PUBLIC_*` variables.

本地 Supabase CLI 可用时：

```bash
supabase start
supabase db reset
npm run content:import
npm run content:verify
npm run content:compare
```

导入器读取 `apps/web/data/current-issue.json` 与 `apps/web/data/archive/*.json`，不读取 `public/data` 镜像，不上传或复制海报二进制。`SUPABASE_ENV=production` 默认拒绝导入；Phase 4A 生产导入必须显式使用 `--allow-production`、先跑 `--dry-run`，并输入完整确认短语 `IMPORT TO PLUTO PRODUCTION`。Phase 3/4A 都禁止在生产设置 `CONTENT_REPOSITORY=supabase`。

当前托管 Supabase 环境：

- 本地 Docker Supabase：开发、migration、导入测试和破坏性 staging 验证。
- `cxjftltkdbsxxjgmxvsm`：Pluto Production Supabase，仅供 Vercel Production 影子读取。
- Vercel Preview：默认 `CONTENT_REPOSITORY=json`，不保存 Production Supabase Secret。
- 暂无独立托管 Staging；未来升级套餐后再恢复。

生产影子读取只使用服务器端变量：

```env
SUPABASE_ENV=production
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
SHADOW_COMPARE_ENABLED=true
SHADOW_COMPARE_SECRET=
CONTENT_REPOSITORY=json
```

`SUPABASE_SECRET_KEY` 与 `SHADOW_COMPARE_SECRET` 不得进入 `NEXT_PUBLIC_*`、浏览器 bundle、日志或 Git。

Phase 4B Studio 影子双写必须单独打开：

```env
STUDIO_SHADOW_WRITE_ENABLED=true
CONTENT_REPOSITORY=json
```

开关未设置或为 `false` 时，Studio 仍保持纯 GitHub JSON 主写，不调用 Supabase 影子写入和 Compare。打开后，Studio 在 GitHub 主写成功后再尝试 Supabase 影子写和一致性检查；影子失败不能阻断正式发布。紧急回滚优先把 `STUDIO_SHADOW_WRITE_ENABLED` 改回 `false`，不要切换 `CONTENT_REPOSITORY`。

Phase 4B.1 adds a GitHub Action bridge for the daily automation path. When `data/current-issue.json` changes on `main`, the workflow validates the committed Issue and matching archive JSON, writes the same canonical bundle to Supabase Shadow, runs compare, and records `trigger_type=automation` in `studio_publish_runs`. GitHub Actions Secrets must provide `SUPABASE_URL` and `SUPABASE_SECRET_KEY`; they must not be printed, committed, or exposed through `NEXT_PUBLIC_*`. The bridge never writes GitHub, so it cannot recursively publish.

Phase 4C public reads use Supabase only behind three server-side guards:

```env
CONTENT_REPOSITORY=supabase
SUPABASE_PRIMARY_READS_ENABLED=true
JSON_READ_FALLBACK_ENABLED=true
```

If any guard is missing in Production, the app falls back to JSON and logs a warning. Emergency read rollback is `CONTENT_REPOSITORY=json` plus redeploy. Studio and daily automation still write GitHub first; Phase 4C does not make Supabase the primary write path.

## 模型与海报配置

所有模型通过环境变量配置。正式海报遵循：

1. 每个热点分别生成一张中文完整海报和一张英文完整海报。
2. 两种语言海报独立存储、独立替换、独立 QA，不在前端覆盖或替换海报内部文字。
3. 内容核验完成后生成中文与英文完整海报，通过 QA 后发布。
4. 中文海报显示北京时间，英文海报显示 GMT；两种海报都必须含 `pluto.hk`、虾子曰和豆豆龙。
5. 每张海报包含二维码，最终指向 `/{locale}/topics/{topicSlug}`。
6. 视觉保持欢快、阳光、正向，同时不弱化事实的严肃性。

## 定时任务

生产环境定时任务在北京时间每天 `05:00` 运行，对应前一日 UTC `21:00`：

```cron
0 21 * * *
```

Cron 更新最新 9 张双语内容卡片并发布，其中包含 1 张今日总览和 8 件全球热点。Vercel Cron 同时调用 `/api/cron/default-posters`，使用线上 COS 密钥将默认海报铺到中英文 18 个位置并写入当日归档；正式海报由后台上传后逐张替换。页面在慢网或图片失败时也会立即显示默认海报。

当前仓库包含 9 张中文视觉海报和 9 张独立英文整图海报。两种语言使用各自的原图与缩略图资源。

## 部署

1. 将仓库导入 Vercel。
2. 配置 `apps/web/.env.example` 中全部生产变量。
3. 将 `NEXT_PUBLIC_SITE_URL` 设置为 `https://pluto.hk`。
4. 在本地 Docker Supabase 执行 migration 并跑内容导入验证；Phase 4A 可对 Production Supabase 执行受控影子读取验证，但不切主数据源。
5. 将域名 DNS 指向 Vercel。
6. 部署前运行 `npm run check`、`npm run test:e2e` 和 `npm run build`。

## 文档

- [多端迁移 Roadmap](./docs/MULTI_PLATFORM_ROADMAP.md)
- [Legacy Web Implementation Plan](./IMPLEMENTATION_PLAN.md)
- [产品需求文档 v1.2](./PRODUCT_REQUIREMENTS_V1.2.md)
- [技术决策](./DECISIONS.md)
- [品牌资产清单](./docs/BRAND_ASSETS.md)
