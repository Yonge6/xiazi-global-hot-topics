"use client";

import { Check, DownloadSimple, LinkSimple, ShareNetwork, X } from "@phosphor-icons/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import type { AppLocale } from "@/i18n/config";
import { trackAnalytics, trackSessionDuration } from "@/lib/analytics/client";
import { DEFAULT_POSTER_ASSET, getArchivedPosterAsset, getPosterAsset } from "@/lib/posters/assets";
import type { Source, Topic } from "@/types/content";

function safeHttpUrl(value: string | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function primarySource(sources: Source[]) {
  return sources.find((source) => source.isPrimary && safeHttpUrl(source.url))
    ?? sources.find((source) => safeHttpUrl(source.url))
    ?? null;
}

function ProgressivePoster({
  src,
  alt,
  sizes,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Cached images may fire `load` before React attaches the handler.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  return (
    <span className="poster-image-shell">
      <Image
        src={DEFAULT_POSTER_ASSET}
        alt=""
        aria-hidden="true"
        width={640}
        height={1280}
        sizes={sizes}
        className={`${className} poster-image-placeholder`}
        priority={priority}
      />
      <Image
        src={src}
        alt={alt}
        width={1024}
        height={2048}
        sizes={sizes}
        className={`${className} poster-image-loaded${loaded ? " is-ready" : ""}`}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        ref={imgRef}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(false)}
      />
    </span>
  );
}

export function TopicGallery({
  topics,
  locale,
  issueDate,
  initialAssetVersion,
}: {
  topics: Topic[];
  locale: AppLocale;
  issueDate: string;
  initialAssetVersion: string;
}) {
  const [displayTopics, setDisplayTopics] = useState(topics);
  const [displayIssueDate, setDisplayIssueDate] = useState(issueDate);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [shareIndex, setShareIndex] = useState<number | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const [posterCacheKey, setPosterCacheKey] = useState<string | number>(initialAssetVersion);
  const [archiveDates, setArchiveDates] = useState<string[]>([]);
  const [archiveDate, setArchiveDate] = useState<string | null>(null);
  const [archiveStatus, setArchiveStatus] = useState("");
  const isZh = locale === "zh";

  useEffect(() => {
    trackAnalytics("page_view", locale);

    let activeStartedAt = document.visibilityState === "visible" ? Date.now() : null;
    let activeMilliseconds = 0;
    let recorded = false;

    const pauseTimer = () => {
      if (activeStartedAt !== null) {
        activeMilliseconds += Date.now() - activeStartedAt;
        activeStartedAt = null;
      }
    };
    const recordDuration = () => {
      if (recorded) return;
      pauseTimer();
      recorded = true;
      if (activeMilliseconds < 1000) return;
      trackSessionDuration(locale, activeMilliseconds / 1000);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        recordDuration();
      } else if (!recorded) {
        activeStartedAt = Date.now();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", recordDuration);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", recordDuration);
      recordDuration();
    };
  }, [locale]);

  useEffect(() => {
    fetch("/api/content/", { cache: "no-store" })
      .then((response) => response.json())
      .then((issue) => {
        if (Array.isArray(issue.topics) && issue.topics.length === 9) {
          const ordered = [...issue.topics].sort((a, b) => {
            if (a.category === "sports" && a.slug.includes("world-cup")) return -1;
            if (b.category === "sports" && b.slug.includes("world-cup")) return 1;
            return a.rank - b.rank;
          });
          setDisplayTopics(ordered);
          if (typeof issue.issueDate === "string") setDisplayIssueDate(issue.issueDate);
          setPosterCacheKey(issue.assetVersion || issue.beijingTimestamp || issue.issueDate);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/archive/", { cache: "no-store" })
      .then((response) => response.json())
      .then((detail) => {
        if (Array.isArray(detail.issues)) setArchiveDates(detail.issues);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (activeIndex === null && shareIndex === null) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveIndex(null);
        setShareIndex(null);
      }
      if (activeIndex !== null && event.key === "ArrowRight") {
        setActiveIndex((activeIndex + 1) % displayTopics.length);
      }
      if (activeIndex !== null && event.key === "ArrowLeft") {
        setActiveIndex((activeIndex - 1 + displayTopics.length) % displayTopics.length);
      }
    };

    document.body.classList.add("lightbox-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("lightbox-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeIndex, displayTopics.length, shareIndex]);

  function openShare(index: number) {
    setShareStatus("");
    setShareIndex(index);
    trackAnalytics("share", locale, displayTopics[index].slug);
  }

  function shareDetails(topic: Topic) {
    const content = topic.localizations[isZh ? "zh-CN" : "en-US"];
    const url = `https://pluto.hk/${locale}/#${topic.slug}`;
    return {
      title: content.headlineFull,
      intro: content.intro,
      url,
      text: `${content.headlineFull}\n\n${content.intro}\n\n${url}`,
      poster: posterAsset(topic.slug, "original"),
    };
  }

  function posterAsset(slug: string, variant: "original" | "thumbnail") {
    return archiveDate
      ? getArchivedPosterAsset(archiveDate, slug, locale, variant, posterCacheKey)
      : getPosterAsset(slug, locale, variant, posterCacheKey);
  }

  async function openArchive(date: string) {
    setArchiveStatus(isZh ? `正在读取 ${date}…` : `Loading ${date}…`);
    const response = await fetch(`/api/archive/?date=${encodeURIComponent(date)}`, { cache: "no-store" });
    const detail = await response.json().catch(() => null);
    if (!response.ok || !detail?.issue) {
      setArchiveStatus(isZh ? "往期读取失败，请稍后再试" : "Could not load this edition");
      return;
    }
    const ordered = [...detail.issue.topics].sort((a, b) => a.rank - b.rank);
    setDisplayTopics(ordered);
    setDisplayIssueDate(detail.issue.issueDate);
    setPosterCacheKey(detail.assetVersion || detail.issue.beijingTimestamp || detail.issue.issueDate);
    setArchiveDate(detail.issue.issueDate);
    setArchiveStatus(isZh ? `正在查看 ${detail.issue.issueDate} 往期` : `Viewing the ${detail.issue.issueDate} edition`);
    setActiveIndex(null);
    setShareIndex(null);
    document.querySelector("#stories")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function returnToCurrent() {
    setArchiveStatus(isZh ? "正在返回当前期…" : "Returning to the current edition…");
    const response = await fetch("/api/content/", { cache: "no-store" });
    const issue = await response.json();
    setDisplayTopics([...issue.topics].sort((a, b) => a.rank - b.rank));
    setDisplayIssueDate(issue.issueDate);
    setPosterCacheKey(issue.assetVersion || issue.beijingTimestamp || issue.issueDate);
    setArchiveDate(null);
    setArchiveStatus("");
    document.querySelector("#stories")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function nativeShare(topic: Topic) {
    const details = shareDetails(topic);
    try {
      if (navigator.share) {
        const posterResponse = await fetch(details.poster);
        const posterBlob = await posterResponse.blob();
        const posterFile = new File([posterBlob], `${topic.slug}-${locale}.png`, { type: "image/png" });
        const files = [posterFile];

        if (navigator.canShare?.({ files })) {
          await navigator.share({
            title: details.title,
            text: details.text,
            files,
          });
        } else {
          await navigator.share({
            title: details.title,
            text: `${details.title}\n\n${details.intro}`,
            url: details.url,
          });
        }
        setShareStatus(isZh ? "已打开系统分享" : "Share sheet opened");
      } else {
        await copyShareLink(topic);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        setShareStatus(isZh ? "未能打开分享，请复制链接" : "Could not share. Copy the link instead.");
      }
    }
  }

  async function copyShareLink(topic: Topic) {
    const details = shareDetails(topic);
    await navigator.clipboard.writeText(details.text);
    setShareStatus(isZh ? "标题、介绍和链接已复制" : "Headline, introduction and link copied");
  }

  function platformUrl(platform: string, topic: Topic) {
    const details = shareDetails(topic);
    const url = encodeURIComponent(details.url);
    const text = encodeURIComponent(details.text);
    const poster = encodeURIComponent(details.poster);
    const links: Record<string, string> = {
      weibo: `https://service.weibo.com/share/share.php?url=${url}&title=${text}&pic=${poster}`,
      x: `https://twitter.com/intent/tweet?text=${text}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      whatsapp: `https://wa.me/?text=${text}`,
      telegram: `https://t.me/share/url?url=${url}&text=${encodeURIComponent(`${details.title}\n\n${details.intro}`)}`,
    };
    return links[platform];
  }

  return (
    <>
      <section id="stories" className="story-columns shell" aria-label={isZh ? "昨日九个热点" : "Nine stories from yesterday"}>
        <div className="edition-banner">
          <span>{archiveDate ? (isZh ? "往期刊物" : "ARCHIVE EDITION") : (isZh ? "当前刊物" : "CURRENT EDITION")}</span>
          <strong>{displayIssueDate}</strong>
          {archiveDate ? <button type="button" onClick={returnToCurrent}>{isZh ? "返回当前期" : "Back to current"}</button> : null}
        </div>
        {displayTopics.map((topic, index) => {
          const content = topic.localizations[isZh ? "zh-CN" : "en-US"];
          const source = primarySource(topic.sources);
          const poster = posterAsset(topic.slug, "original");
          const thumbnail = posterAsset(topic.slug, "thumbnail");

          return (
            <article id={topic.slug} className="catalogue-entry" key={topic.id}>
              <header className="entry-meta">
                <span>{content.categoryLabel}</span>
                <span>NO.{String(topic.rank).padStart(2, "0")}</span>
                <time dateTime={displayIssueDate}>{displayIssueDate.slice(5).replace("-", ".")}</time>
              </header>

              <h2>{content.headlineFull}</h2>
              <p className="entry-intro">{content.intro}</p>

              {source ? (
                <a
                  className="reading-link"
                  href={safeHttpUrl(source.url)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => trackAnalytics("source_click", locale, topic.slug)}
                >
                  <span>{isZh ? "推荐阅读" : "Primary reading"}</span>
                  <strong>{source.publisher || source.title}</strong>
                  <span aria-hidden="true">↗</span>
                </a>
              ) : null}

              <button
                className="poster-button"
                type="button"
                onClick={() => {
                  setActiveIndex(index);
                  trackAnalytics("poster_view", locale, topic.slug);
                }}
                aria-label={isZh ? `查看${content.headlineFact}海报原图` : `View poster for ${content.headlineFact}`}
              >
                <ProgressivePoster
                  key={thumbnail}
                  src={thumbnail}
                  alt={content.headlineFull}
                  sizes="(max-width: 767px) calc(100vw - 36px), (max-width: 1100px) 46vw, 31vw"
                  className="poster-image"
                  priority={index === 0}
                />
              </button>

              <footer className="entry-actions">
                <button type="button" onClick={() => {
                  setActiveIndex(index);
                  trackAnalytics("poster_view", locale, topic.slug);
                }}>
                  {isZh ? "查看原图" : "View original"}
                  <span aria-hidden="true">↗</span>
                </button>
                <a href={poster} download onClick={() => trackAnalytics("download", locale, topic.slug)}>
                  {isZh ? "下载海报" : "Download"}
                  <DownloadSimple size={16} weight="regular" aria-hidden="true" />
                </a>
                <button type="button" onClick={() => openShare(index)} aria-label={isZh ? `分享${content.headlineFact}` : `Share ${content.headlineFact}`}>
                  {isZh ? "分享" : "Share"}
                  <ShareNetwork size={16} weight="regular" aria-hidden="true" />
                </button>
              </footer>
            </article>
          );
        })}
      </section>

      {activeIndex !== null ? (
        <div className="poster-lightbox" role="dialog" aria-modal="true" aria-label={isZh ? "海报原图" : "Poster original"}>
          <button className="lightbox-backdrop" type="button" onClick={() => setActiveIndex(null)} aria-label={isZh ? "关闭海报" : "Close poster"} />
          <div className="lightbox-panel">
            <div className="lightbox-toolbar">
              <span>
                {String(activeIndex + 1).padStart(2, "0")} / {String(displayTopics.length).padStart(2, "0")}
              </span>
              <a
                href={posterAsset(displayTopics[activeIndex].slug, "original")}
                download
                onClick={() => trackAnalytics("download", locale, displayTopics[activeIndex].slug)}
              >
                <DownloadSimple size={18} aria-hidden="true" />
                {isZh ? "下载原图" : "Download"}
              </a>
              <button type="button" onClick={() => setActiveIndex(null)} aria-label={isZh ? "关闭" : "Close"}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="lightbox-image-wrap">
              <ProgressivePoster
                key={posterAsset(displayTopics[activeIndex].slug, "original")}
                src={posterAsset(displayTopics[activeIndex].slug, "original")}
                alt={displayTopics[activeIndex].localizations[isZh ? "zh-CN" : "en-US"].headlineFull}
                sizes="(max-width: 768px) 92vw, 640px"
                className="lightbox-image"
                priority
              />
            </div>
            <div className="lightbox-navigation">
              <button type="button" onClick={() => setActiveIndex((activeIndex - 1 + displayTopics.length) % displayTopics.length)}>
                ← {isZh ? "上一张" : "Previous"}
              </button>
              <button type="button" onClick={() => setActiveIndex((activeIndex + 1) % displayTopics.length)}>
                {isZh ? "下一张" : "Next"} →
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section id="archive" className="archive-browser shell">
        <header>
          <div>
            <span>{isZh ? "完整刊期" : "COMPLETE EDITIONS"}</span>
            <h2>{isZh ? "往期归档" : "Archive"}</h2>
          </div>
          <p>{isZh ? "点击日期，展示当期全部 9 条文字、来源与海报。" : "Choose a date to display all nine stories, sources and posters."}</p>
        </header>
        <div className="archive-dates">
          {archiveDates.map((date) => (
            <button
              type="button"
              className={archiveDate === date ? "active" : ""}
              onClick={() => openArchive(date)}
              key={date}
            >
              <time dateTime={date}>{date.replaceAll("-", ".")}</time>
              <span>{isZh ? "打开本期" : "Open edition"} ↗</span>
            </button>
          ))}
        </div>
        {archiveStatus ? <p className="archive-status" role="status">{archiveStatus}</p> : null}
      </section>

      {shareIndex !== null ? (
        <div className="share-dialog" role="dialog" aria-modal="true" aria-label={isZh ? "分享海报" : "Share poster"}>
          <button className="share-backdrop" type="button" onClick={() => setShareIndex(null)} aria-label={isZh ? "关闭分享" : "Close share"} />
          <section className="share-panel">
            <header>
              <div>
                <span>{isZh ? "传播这一刻" : "PASS IT ON"}</span>
                <h3>{isZh ? "分享这张海报" : "Share this poster"}</h3>
              </div>
              <button type="button" onClick={() => setShareIndex(null)} aria-label={isZh ? "关闭" : "Close"}>
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <button className="native-share" type="button" onClick={() => nativeShare(displayTopics[shareIndex])}>
              <ShareNetwork size={22} weight="duotone" aria-hidden="true" />
              <span>
                <strong>{isZh ? "用手机 App 分享" : "Share with an app"}</strong>
                <small>{isZh ? "标题 + 100字介绍 + 海报图片" : "Headline + introduction + poster image"}</small>
              </span>
              <b>↗</b>
            </button>

            <div className="share-platforms">
              {[
                ["weibo", "微博", "WB"],
                ["x", "X", "X"],
                ["facebook", "Facebook", "f"],
                ["linkedin", "LinkedIn", "in"],
                ["whatsapp", "WhatsApp", "WA"],
                ["telegram", "Telegram", "TG"],
              ].map(([platform, label, mark]) => (
                <a key={platform} href={platformUrl(platform, displayTopics[shareIndex])} target="_blank" rel="noreferrer">
                  <b>{mark}</b>
                  <span>{label}</span>
                </a>
              ))}
            </div>

            <button className="copy-share" type="button" onClick={() => copyShareLink(displayTopics[shareIndex])}>
              {shareStatus ? <Check size={18} aria-hidden="true" /> : <LinkSimple size={18} aria-hidden="true" />}
              {shareStatus || (isZh ? "复制标题、介绍和链接" : "Copy headline, introduction and link")}
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
