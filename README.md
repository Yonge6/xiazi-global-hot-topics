# 虾子曰全球热点海报

`xiazishuo.com` 的生产项目。每天北京时间 05:00，用 9 条全球热点和双语内容解释正在变化的世界。

生产发布只使用 `https://xiazishuo.com`（含 `www` 跳转）；不要为本项目绑定或验收其他域名。海报 API 使用同源相对路径，避免跨域生产地址漂移。

发布边界：只更新 `Yonge6/xiazi-global-hot-topics` 与 Vercel `xiazishuo` 项目。VileSaint 的仓库、Vercel 项目和域名是独立产品，不得从本项目发布链路触碰。

## 当前架构

- Next.js App Router、TypeScript strict、Tailwind CSS 4、next-intl
- `/zh` 与 `/en` 双语首页及同路径语言切换
- 9 条中英文正式热点、真实推荐阅读来源和不可变 Release 迁移链
- 当代艺术目录风格首页、响应式 Masonry 瀑布流
- 海报 Lightbox、键盘切换、原图查看和下载
- 用户提供的虾子曰、豆豆龙品牌参考图
- 完整角色三视图、表情、动作、色板与禁用造型规范
- Issue、Topic、Source、Poster、Job、Publication Release 类型与 Supabase migration
- 基础 SEO、sitemap、robots、Vitest 和 Playwright

2026-07-18 及更早刊物属于历史范围，不由 Release V2 追溯修改。未来刊物先完成来源与海报硬门，再由人工确认原子切换生产指针；未确认的自动生成结果不会上线。

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

迁移位于 `supabase/migrations/`。`20260718230000_future_release_safety.sql` 新增未来刊物的不可变 Release、发布租约、原子指针、人工确认、来源快照、海报验收证据和回滚事件；`20260719010000_release_safety_hardening.sql` 再绑定完整 Release 身份、owner/heartbeat、正文事实声明和感知级海报证据。迁移本身不会更新历史刊物。

## 模型与海报配置

所有模型通过环境变量配置。正式海报遵循：

1. 每个热点分别生成一张中文完整海报和一张英文完整海报。
2. 两种语言海报独立存储、独立替换、独立 QA，不在前端覆盖或替换海报内部文字。
3. 内容核验完成后生成中文与英文完整海报，通过 QA 后发布。
4. 中文海报显示北京时间，英文海报显示 GMT；两种海报都必须含 `xiazishuo.com`、虾子曰和豆豆龙。
5. 发布前必须验证 OCR、语言、编号、标题、日期、网址、主题、固定 IP 和跨图重复。
6. 视觉保持欢快、阳光、正向，同时不弱化事实的严肃性。

## 定时任务

生产候选生成按北京时间 05:00 工作流运行；自动化只允许暂存候选，不允许绕过人工门直接切换生产：

```cron
0 21 * * *
```

生成任务先把 18 张完整 PNG 上传到 `release-assets/{assetBatchId}/...` 不可变路径，再调用 `/api/internal/releases/stage/`。来源快照和海报清单通过硬门后，系统才用两者的哈希、文案哈希和 schema 版本计算最终 `releaseId`。只有完整候选会出现在 Studio 待确认列表。人工确认调用单事务激活 RPC；05:50、06:00 和重复任务由 owner 租约、heartbeat 与幂等键协调。

## 海报归档与本地空间

- Release V2 海报的唯一运行时归档源是不可变 COS；2026-07-18 及以前的旧刊继续使用 GitHub 根目录归档。`apps/web/public/archive` 不再作为线上回退源，也不进入 Vercel 上传包。
- 本地只展开最近 3 期 GitHub 归档；`apps/web/public/posters` 和 `public/posters` 只展开当前刊 18 张。远程验收不要求旧海报存在于本地。
- 预览本地保留窗口：`npm run posters:cleanup:preview`；确认工作区海报路径干净后执行：`npm run posters:cleanup:local`。该命令使用 sparse checkout，不删除 GitHub 历史，也不会制造海报删除提交。
- 验证当天远程归档：`npm run posters:verify:remote`。旧刊检查 GitHub，Release V2 检查同源路由、COS 地址和路由声明的 SHA-256。
- 生产 staging/激活成功后，受保护 workflow 会自动应用同一保留策略；失败运行不会清理候选或改变 active pointer。

## 部署

1. 将仓库导入 Vercel。
2. 配置 `.env.example` 中全部生产变量。
3. 将 `NEXT_PUBLIC_SITE_URL` 设置为 `https://xiazishuo.com`。
4. 在 Supabase 执行 migration，并按 [未来发布整改说明](./docs/release-safety-remediation.md) 完成 staged rollout。
5. 将域名 DNS 指向 Vercel。
6. 部署前运行 `npm run check`、`npm run test:e2e` 和 `npm run build`。

## 文档

- [实施计划](./IMPLEMENTATION_PLAN.md)
- [技术决策](./DECISIONS.md)
- [不可变 Release ADR](./docs/adr/0001-immutable-publication-releases.md)
- [未来发布整改说明](./docs/release-safety-remediation.md)
- [品牌资产清单](./docs/BRAND_ASSETS.md)
