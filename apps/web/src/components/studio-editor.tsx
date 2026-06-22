"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { formatDuration } from "@/lib/analytics/format";
import type { AnalyticsDashboard } from "@/lib/analytics/types";
import { getArchivedPosterAsset, getPosterAsset } from "@/lib/posters/assets";
import type { Issue, LocalizedTopic, Source, Topic } from "@xiazi/contracts";

type IssueEntry = {
  date: string;
  source: "current" | "archive" | "commit";
  value: string;
};

type PublishResult = {
  published?: boolean;
  issueDate?: string;
  publishRequestId?: string;
  primary?: {
    target: "github";
    status: "succeeded" | "failed";
    commitSha?: string;
  };
  shadow?: {
    target: "supabase";
    status: "succeeded" | "skipped" | "failed" | "timeout";
    changed?: boolean;
  };
  compare?: {
    status: "matched" | "mismatched" | "failed" | "not_started";
    differenceCount: number;
    differencePaths?: string[];
  };
};

export function StudioEditor() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [issue, setIssue] = useState<Issue | null>(null);
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState("正在读取今日内容…");
  const [publishing, setPublishing] = useState(false);
  const [posterCacheKey, setPosterCacheKey] = useState<string | number>("initial");
  const [posterPreviews, setPosterPreviews] = useState<Record<string, string>>({});
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [studioView, setStudioView] = useState<"analytics" | "editor">("analytics");
  const [issueEntries, setIssueEntries] = useState<IssueEntry[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<IssueEntry | null>(null);
  const [lastPublishResult, setLastPublishResult] = useState<PublishResult | null>(null);
  const [retryingShadow, setRetryingShadow] = useState(false);

  useEffect(() => {
    if (!unlocked) return;
    loadIssueEntries();
    loadAnalytics();
    // Authentication is the only trigger; the loaders are stable for this mounted editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  async function loadIssueEntries(preferred?: IssueEntry) {
    const response = await fetch("/api/studio/issues", { cache: "no-store" });
    const detail = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(detail?.issues)) {
      setStatus(detail?.message || "读取刊期失败");
      return;
    }
    setIssueEntries(detail.issues);
    const selected = preferred
      ? detail.issues.find((entry: IssueEntry) => entry.source === preferred.source && entry.value === preferred.value)
      : detail.issues.find((entry: IssueEntry) => entry.source === "current");
    if (selected || detail.issues[0]) await loadIssue(selected || detail.issues[0]);
  }

  async function loadIssue(entry: IssueEntry) {
    setStatus(`正在读取 ${entry.date}…`);
    const query = new URLSearchParams({ source: entry.source, value: entry.value });
    const response = await fetch(`/api/studio/issues?${query}`, { cache: "no-store" });
    const detail = await response.json().catch(() => null);
    if (!response.ok || !detail?.issue) {
      setStatus(detail?.message || "读取刊期失败");
      return;
    }
    setSelectedIssue(entry);
    setIssue(detail.issue);
    setActive(0);
    setPosterPreviews({});
    setLastPublishResult(null);
    setPosterCacheKey(detail.issue.assetVersion || detail.issue.beijingTimestamp || detail.issue.issueDate);
    setStatus(entry.source === "current" ? "当前期已载入，修改后点发布" : `往期 ${entry.date} 已载入`);
  }

  async function loadAnalytics() {
    const response = await fetch("/api/studio/analytics", { cache: "no-store" });
    if (response.ok) setAnalytics(await response.json());
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError("");
    const response = await fetch("/api/studio/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      setLoginError(detail?.message || "登录失败");
      setPassword("");
      return;
    }
    setUnlocked(true);
  }

  async function logout() {
    await fetch("/api/studio/logout", { method: "POST" });
    setPassword("");
    setIssue(null);
    setUnlocked(false);
  }

  function updateTopic(next: Topic) {
    if (!issue) return;
    setIssue({ ...issue, topics: issue.topics.map((topic, index) => index === active ? next : topic) });
  }

  function primarySourceFallback(): Source {
    return {
      id: `${topic.id}-source-1`,
      topicId: topic.id,
      title: "",
      publisher: "推荐阅读",
      url: "",
      publishedAt: null,
      sourceType: "publisher",
      sourceTier: 2,
      locale: "zh-CN",
      isPrimary: true,
    };
  }

  function updatePrimarySource(patch: Partial<Source>) {
    const [primarySource, ...otherSources] = topic.sources.length
      ? topic.sources
      : [primarySourceFallback()];
    updateTopic({ ...topic, sources: [{ ...primarySource, ...patch, isPrimary: true }, ...otherSources] });
  }

  function updateLocalized(locale: "zh-CN" | "en-US", patch: Partial<LocalizedTopic>) {
    const current = topic.localizations[locale];
    const next = { ...current, ...patch };
    updateTopic({ ...topic, localizations: { ...topic.localizations, [locale]: next } });
  }

  function updateHeadline(locale: "zh-CN" | "en-US", field: "headlineFact" | "headlineView", value: string) {
    const current = topic.localizations[locale];
    const next = { ...current, [field]: value };
    const separator = locale === "zh-CN" ? "；" : "; ";
    const punctuation = locale === "zh-CN" ? "。" : ".";
    next.headlineFull = `${next.headlineFact}${separator}${next.headlineView}${next.headlineView.endsWith(".") || next.headlineView.endsWith("。") ? "" : punctuation}`;
    updateTopic({ ...topic, localizations: { ...topic.localizations, [locale]: next } });
  }

  function move(direction: -1 | 1) {
    if (!issue) return;
    const target = active + direction;
    if (target < 0 || target >= issue.topics.length) return;
    const topics = [...issue.topics];
    [topics[active], topics[target]] = [topics[target], topics[active]];
    const worldCup = topics.find((topic) => topic.slug.includes("world-cup"));
    const normalized = worldCup ? [worldCup, ...topics.filter((topic) => topic !== worldCup)] : topics;
    normalized.forEach((topic, index) => { topic.rank = index + 1; });
    setIssue({ ...issue, topics: normalized });
    setActive(Math.max(0, normalized.indexOf(topics[target])));
  }

  async function uploadPoster(file: File, locale: "zh" | "en") {
    if (!issue) return;
    const slug = issue.topics[active].slug;
    const previewKey = `${slug}:${locale}`;
    const previewUrl = URL.createObjectURL(file);
    setPosterPreviews((current) => {
      const previous = current[previewKey];
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
      return { ...current, [previewKey]: previewUrl };
    });
    setStatus(`正在上传${locale === "zh" ? "中文" : "英文"}海报…`);
    const form = new FormData();
    form.set("file", file);
    form.set("locale", locale);
    form.set("slug", slug);
    form.set("issueDate", issue.issueDate);
    form.set("isCurrent", String(selectedIssue?.source === "current"));
    try {
      const response = await fetch("/api/studio/poster", { method: "POST", body: form });
      const detail = await response.json().catch(() => null);
      if (!response.ok) throw new Error(detail?.message || "海报上传失败");
      setPosterCacheKey(detail?.version || Date.now());
      setStatus(selectedIssue?.source === "current" ? "海报已替换，刷新首页即可看到新图" : "往期海报已替换");
    } catch (error) {
      const message = error instanceof Error ? error.message : "海报上传失败";
      setStatus(message);
      if (message.includes("登录已过期")) setUnlocked(false);
    }
  }

  async function publish() {
    if (!issue) return;
    setPublishing(true);
    setLastPublishResult(null);
    setStatus("正在发布…");
    try {
      const response = await fetch("/api/studio/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issue, target: selectedIssue }),
      });
      const detail = await response.json().catch(() => null);
      if (!response.ok) throw new Error(detail?.message || "发布失败");
      setLastPublishResult(detail);
      setIssue(detail.issue);
      const nextTarget = detail.target as Pick<IssueEntry, "source" | "value">;
      const nextEntry: IssueEntry = {
        date: detail.issue.issueDate,
        source: nextTarget.source,
        value: nextTarget.value,
      };
      const finalStatus = publishStatusMessage(detail, nextTarget.source);
      setSelectedIssue(nextEntry);
      if (nextTarget.source === "current") {
        setStatus("内容已发布，正在归档本期海报…");
        await fetch("/api/studio/sync-issue-posters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issueDate: detail.issue.issueDate }),
        });
        setStatus(finalStatus);
      } else {
        setStatus(finalStatus);
      }
      await loadIssueEntries(nextEntry);
      setLastPublishResult(detail);
      setStatus(finalStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : "发布失败";
      setStatus(message);
      if (message.includes("登录已过期")) setUnlocked(false);
    } finally {
      setPublishing(false);
    }
  }

  function publishStatusMessage(detail: PublishResult, source: IssueEntry["source"]) {
    if (source === "current") {
      if (detail.shadow?.status === "failed" || detail.shadow?.status === "timeout") {
        return "主发布成功，Supabase 影子同步失败，等待自动修复或人工重试";
      }
      if (detail.compare?.status === "mismatched") {
        return "主发布成功，Supabase 已同步，但内容一致性检查发现差异";
      }
      return "发布成功，内容、海报和影子同步均已完成";
    }
    if (detail.shadow?.status === "failed" || detail.shadow?.status === "timeout") {
      return "往期主发布成功，Supabase 影子同步失败";
    }
    if (detail.compare?.status === "mismatched") {
      return "往期主发布成功，但 Supabase 内容一致性检查发现差异";
    }
    return "往期修改已保存，Supabase 影子同步完成，不影响当前首页";
  }

  async function retryShadowPublish() {
    const publishRequestId = lastPublishResult?.publishRequestId;
    if (!publishRequestId) return;
    setRetryingShadow(true);
    setStatus("正在重试 Supabase 影子同步…");
    try {
      const response = await fetch(`/api/studio/publish-runs/${encodeURIComponent(publishRequestId)}/retry-shadow`, {
        method: "POST",
      });
      const detail = await response.json().catch(() => null);
      if (!response.ok) throw new Error(detail?.message || "影子同步重试失败");
      setLastPublishResult({
        ...lastPublishResult,
        shadow: detail.shadow,
        compare: detail.compare,
      });
      if (detail.shadow?.status === "failed" || detail.shadow?.status === "timeout") {
        setStatus("影子同步仍然失败，已记录，可等待每日 Cron 兜底");
      } else if (detail.compare?.status === "mismatched") {
        setStatus("影子同步已重试，但内容一致性检查仍有差异");
      } else {
        setStatus("影子同步重试成功，内容一致");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "影子同步重试失败");
    } finally {
      setRetryingShadow(false);
    }
  }

  if (!unlocked) {
    return (
      <main className="studio-login-shell">
        <form className="studio-login-card" onSubmit={login}>
          <Image src="/brand/logo/xiazi-global-hot-topics.webp" alt="虾子曰" width={150} height={150} priority />
          <p className="studio-login-kicker">XIAZI EDITORIAL STUDIO</p>
          <h1>手机编辑后台</h1>
          <p>请输入后台密码进入内容编辑与发布页面。</p>
          <label>
            后台密码
            <input
              autoFocus
              inputMode="numeric"
              autoComplete="current-password"
              type="password"
              maxLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入 6 位密码"
            />
          </label>
          {loginError && <p className="studio-login-error" role="alert">{loginError}</p>}
          <button type="submit">进入后台</button>
        </form>
      </main>
    );
  }

  if (!issue) return <main className="studio-shell"><p>{status}</p></main>;
  const topic = issue.topics[active];
  const zh = topic.localizations["zh-CN"];
  const en = topic.localizations["en-US"];
  const primarySource = topic.sources[0] ?? primarySourceFallback();
  const selectedIssueLabel = selectedIssue?.source === "current"
    ? "当前首页"
    : selectedIssue?.source === "archive"
      ? "往期归档"
      : "历史版本";
  const previewUrls = {
    zh: posterPreviews[`${topic.slug}:zh`] || (selectedIssue?.source === "current"
      ? getPosterAsset(topic.slug, "zh", "original", posterCacheKey)
      : getArchivedPosterAsset(issue.issueDate, topic.slug, "zh", "original", posterCacheKey)),
    en: posterPreviews[`${topic.slug}:en`] || (selectedIssue?.source === "current"
      ? getPosterAsset(topic.slug, "en", "original", posterCacheKey)
      : getArchivedPosterAsset(issue.issueDate, topic.slug, "en", "original", posterCacheKey)),
  };
  const today = analytics?.today;
  const total = analytics?.total;
  const sevenDayViews = analytics?.sevenDay.pageViews ?? 0;
  const sevenDayVisitors = analytics?.sevenDay.uniqueVisitors ?? 0;
  const averageDuration = total?.engagementSessions
    ? total.engagedSeconds / total.engagementSessions
    : 0;
  const topicStats = issue.topics
    .map((item) => {
      const stats = today?.topics[item.slug] ?? { posterViews: 0, shares: 0, downloads: 0, sourceClicks: 0 };
      return {
        item,
        stats,
        total: stats.posterViews + stats.shares + stats.downloads + stats.sourceClicks,
      };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <Image src="/brand/logo/xiazi-global-hot-topics.webp" alt="虾子曰" width={100} height={100} />
        <div><strong>手机编辑后台</strong><small>{status}</small></div>
        <button type="button" className="studio-logout" onClick={logout}>退出</button>
      </header>
      <nav className="studio-view-tabs" aria-label="后台功能">
        <button className={studioView === "analytics" ? "active" : ""} onClick={() => setStudioView("analytics")}>数据看板</button>
        <button className={studioView === "editor" ? "active" : ""} onClick={() => setStudioView("editor")}>内容编辑</button>
      </nav>

      {studioView === "analytics" ? (
        <section className="studio-analytics">
          <div className="studio-analytics-title">
            <div><small>今日实时数据</small><h2>{today?.date || "正在载入"}</h2></div>
            <button type="button" onClick={loadAnalytics}>刷新</button>
          </div>
          <div className="studio-metric-grid">
            <article><span>今日访问人数</span><strong>{today?.uniqueVisitors ?? 0}</strong><small>近 7 日去重 {sevenDayVisitors} 人</small></article>
            <article><span>今日访问人次</span><strong>{today?.pageViews ?? 0}</strong><small>近 7 日 {sevenDayViews} 次</small></article>
            <article><span>海报查看</span><strong>{today?.posterViews ?? 0}</strong><small>点击查看原图</small></article>
            <article><span>分享</span><strong>{today?.shares ?? 0}</strong><small>打开分享面板</small></article>
          </div>
          <div className="studio-total-card">
            <header><span>累计数据</span><small>上线以来</small></header>
            <div className="studio-total-highlights">
              <section>
                <span>访问人数</span>
                <strong>{total?.uniqueVisitors ?? 0}</strong>
                <small>匿名设备去重</small>
              </section>
              <section className="duration">
                <span>平均使用时长</span>
                <strong>{formatDuration(averageDuration)}</strong>
                <small>本次更新后开始统计</small>
              </section>
            </div>
            <div className="studio-total-details">
              <span>访问人次<b>{total?.pageViews ?? 0}</b></span>
              <span>海报查看<b>{total?.posterViews ?? 0}</b></span>
              <span>分享<b>{total?.shares ?? 0}</b></span>
              <span>下载<b>{total?.downloads ?? 0}</b></span>
            </div>
          </div>
          <div className="studio-language-card">
            <span>中文访问 <b>{today?.zhViews ?? 0}</b></span>
            <span>英文访问 <b>{today?.enViews ?? 0}</b></span>
            <span>阅读跳转 <b>{today?.sourceClicks ?? 0}</b></span>
          </div>
          <div className="studio-trend-card">
            <header><b>近 7 日访问人次</b><small>访问人数按匿名设备去重</small></header>
            <div className="studio-bars">
              {[...(analytics?.recent ?? [])].reverse().map((day) => {
                const max = Math.max(1, ...(analytics?.recent ?? []).map((item) => item.pageViews));
                return (
                  <div key={day.date}>
                    <i style={{ height: `${Math.max(6, day.pageViews / max * 100)}%` }} />
                    <small>{day.date.slice(5)}</small>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="studio-ranking">
            <header><b>今日热点表现</b><small>查看 + 分享 + 下载 + 阅读</small></header>
            {topicStats.map(({ item, stats, total }, index) => (
              <button key={item.id} type="button" onClick={() => { setActive(issue.topics.indexOf(item)); setStudioView("editor"); }}>
                <em>{index + 1}</em>
                <span><b>{item.localizations["zh-CN"].headlineFact}</b><small>查看 {stats.posterViews} · 分享 {stats.shares} · 下载 {stats.downloads} · 阅读 {stats.sourceClicks}</small></span>
                <strong>{total}</strong>
              </button>
            ))}
          </div>
        </section>
      ) : (
      <>
      <section className="studio-issue-picker">
        <div className={`studio-issue-state ${selectedIssue?.source === "current" ? "current" : "archive"}`}>
          <span>{selectedIssueLabel}</span>
          <strong>{issue.issueDate}</strong>
        </div>
        <label>
          选择要编辑的刊期
          <select
            value={selectedIssue ? `${selectedIssue.source}:${selectedIssue.value}` : ""}
            onChange={(event) => {
              const entry = issueEntries.find((item) => `${item.source}:${item.value}` === event.target.value);
              if (entry) void loadIssue(entry);
            }}
          >
            {issueEntries.map((entry) => (
              <option key={`${entry.source}:${entry.value}`} value={`${entry.source}:${entry.value}`}>
                {entry.date}{entry.source === "current" ? "（当前首页）" : entry.source === "archive" ? "（往期归档）" : "（历史版本，可保存为归档）"}
              </option>
            ))}
          </select>
        </label>
        <p>{selectedIssue?.source === "current" ? "修改后会更新当前首页，并同步保存到往期。" : "修改只保存到该期归档，不影响当前首页；适合修错字、替换链接或补洞察。"}</p>
      </section>
      <nav className="studio-topic-tabs">{issue.topics.map((item, index) => <button className={index === active ? "active" : ""} onClick={() => setActive(index)} key={item.id}>{index + 1}</button>)}</nav>
      <section className="studio-card">
        <div className="studio-order"><b>#{topic.rank} {zh.categoryLabel}</b><span><button onClick={() => move(-1)}>上移</button><button onClick={() => move(1)}>下移</button></span></div>
        {topic.slug.includes("world-cup") && <p className="studio-lock">世界杯硬规则：始终保持第一条</p>}
        <label>中文分类<input value={zh.categoryLabel} onChange={(e) => updateLocalized("zh-CN", { categoryLabel: e.target.value })} /></label>
        <label>中文事实<input value={zh.headlineFact} onChange={(e) => updateHeadline("zh-CN", "headlineFact", e.target.value)} /></label>
        <label>中文观点<input value={zh.headlineView} onChange={(e) => updateHeadline("zh-CN", "headlineView", e.target.value)} /></label>
        <label>约 100 字介绍<textarea value={zh.intro} onChange={(e) => updateLocalized("zh-CN", { intro: e.target.value })} /></label>
        <label>虾子曰洞察<textarea value={zh.xiaziQuote} onChange={(e) => updateLocalized("zh-CN", { xiaziQuote: e.target.value })} /></label>
        <label>豆豆龙吐槽<textarea value={zh.doudouQuote} onChange={(e) => updateLocalized("zh-CN", { doudouQuote: e.target.value })} /></label>
        <label>中文页脚 takeaway<textarea value={zh.footerTakeaway} onChange={(e) => updateLocalized("zh-CN", { footerTakeaway: e.target.value })} /></label>
        <details open><summary>推荐阅读</summary>
          <label>来源名称<input value={primarySource.publisher} onChange={(e) => updatePrimarySource({ publisher: e.target.value })} /></label>
          <label>来源标题<input value={primarySource.title} onChange={(e) => updatePrimarySource({ title: e.target.value })} /></label>
          <label>推荐阅读链接<input value={primarySource.url} onChange={(e) => updatePrimarySource({ url: e.target.value })} /></label>
        </details>
        <details><summary>English</summary>
          <label>Category<input value={en.categoryLabel} onChange={(e) => updateLocalized("en-US", { categoryLabel: e.target.value })} /></label>
          <label>Fact<input value={en.headlineFact} onChange={(e) => updateHeadline("en-US", "headlineFact", e.target.value)} /></label>
          <label>View<input value={en.headlineView} onChange={(e) => updateHeadline("en-US", "headlineView", e.target.value)} /></label>
          <label>Introduction<textarea value={en.intro} onChange={(e) => updateLocalized("en-US", { intro: e.target.value })} /></label>
          <label>Xiazi insight<textarea value={en.xiaziQuote} onChange={(e) => updateLocalized("en-US", { xiaziQuote: e.target.value })} /></label>
          <label>Doudoulong line<textarea value={en.doudouQuote} onChange={(e) => updateLocalized("en-US", { doudouQuote: e.target.value })} /></label>
          <label>Footer takeaway<textarea value={en.footerTakeaway} onChange={(e) => updateLocalized("en-US", { footerTakeaway: e.target.value })} /></label>
        </details>
        <div className="studio-poster-previews">
          <figure>
            <Image src={previewUrls.zh} alt="中文海报预览" width={512} height={1024} unoptimized />
            <figcaption>中文海报预览</figcaption>
          </figure>
          <figure>
            <Image src={previewUrls.en} alt="英文海报预览" width={512} height={1024} unoptimized />
            <figcaption>英文海报预览</figcaption>
          </figure>
        </div>
        <div className="studio-upload"><label>替换中文海报<input aria-label="替换中文海报" type="file" accept="image/png,image/jpeg" onChange={(e) => e.target.files?.[0] && uploadPoster(e.target.files[0], "zh")} /></label><label>替换英文海报<input aria-label="替换英文海报" type="file" accept="image/png,image/jpeg" onChange={(e) => e.target.files?.[0] && uploadPoster(e.target.files[0], "en")} /></label></div>
      </section>
      </>
      )}
      {studioView === "editor" ? <div className="studio-publish-bar">
        <p role="status" aria-live="polite">{status}</p>
        {lastPublishResult?.published ? (
          <div className={`studio-shadow-status ${lastPublishResult.compare?.status === "matched" ? "ok" : "warn"}`}>
            <strong>
              {lastPublishResult.compare?.status === "matched"
                ? "主发布与影子同步一致"
                : "主发布成功，影子链路需要处理"}
            </strong>
            <span>刊期 {lastPublishResult.issueDate || issue.issueDate}</span>
            <span>请求 {lastPublishResult.publishRequestId}</span>
            <span>GitHub {lastPublishResult.primary?.status || "succeeded"}</span>
            <span>Supabase {lastPublishResult.shadow?.status || "not_started"}</span>
            <span>差异 {lastPublishResult.compare?.differenceCount ?? 0}</span>
            {lastPublishResult.compare?.differencePaths?.length ? (
              <small>{lastPublishResult.compare.differencePaths.slice(0, 3).join("、")}</small>
            ) : null}
            {(lastPublishResult.shadow?.status === "failed" ||
              lastPublishResult.shadow?.status === "timeout" ||
              lastPublishResult.compare?.status === "mismatched") ? (
              <button type="button" onClick={retryShadowPublish} disabled={publishing || retryingShadow}>
                {retryingShadow ? "正在重试…" : "重试影子同步"}
              </button>
            ) : null}
          </div>
        ) : null}
        <button type="button" className="studio-publish" onClick={publish} disabled={publishing}>
          {publishing ? "正在发布…" : selectedIssue?.source === "current" ? "发布当前期修改" : "保存往期归档修改"}
        </button>
      </div> : null}
    </main>
  );
}
