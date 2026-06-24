"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import type { AppLocale } from "@/i18n/config";
import { getCosAsset } from "@/lib/posters/assets";

export function IssueMasthead({ locale, issueDate }: { locale: AppLocale; issueDate: string }) {
  const [currentIssueDate, setCurrentIssueDate] = useState(issueDate);
  const isZh = locale === "zh";

  useEffect(() => {
    fetch("/api/content/", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((issue) => {
        if (issue && typeof issue.issueDate === "string") setCurrentIssueDate(issue.issueDate);
      })
      .catch(() => undefined);
  }, []);

  const date = new Date(`${currentIssueDate}T00:05:00+08:00`);
  const formattedDate = new Intl.DateTimeFormat(isZh ? "zh-CN" : "en-US", {
    year: "numeric",
    month: isZh ? "2-digit" : "long",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(date);
  const compactDate = currentIssueDate.replaceAll("-", ".");

  return (
    <section className="issue-masthead shell" aria-labelledby="issue-title">
      <div className="masthead-character masthead-xiazi" aria-hidden="true">
        <Image
          src={getCosAsset("brand/characters/xiazi/xiazi-master-front.webp")}
          alt=""
          fill
          loading="eager"
          sizes="(max-width: 768px) 180px, 380px"
          className="object-contain object-bottom"
        />
      </div>

      <div className="masthead-copy">
        <p className="issue-index">DAILY EDITION · {date.getUTCFullYear()}</p>
        <h1 id="issue-title">{isZh ? "昨日世界" : "THE WORLD YESTERDAY"}<span>.</span></h1>
        <p className="issue-deck">
          {isZh ? "1 张今日总览 · 8 件全球热点" : "1 Daily Overview · 8 Global Stories"}
        </p>
        <p className="issue-manifesto">
          {isZh ? (
            <>
              <span>信息纷涌，世界喧哗。</span>
              <span>每天看懂世界上最重要的 8 件事，就够了。</span>
              <span>剩下的时间，好好生活，享受当下。</span>
            </>
          ) : (
            <>
              <span>The world is noisy.</span>
              <span>Understand the 8 global stories that matter most each day.</span>
              <span>Then get back to living.</span>
            </>
          )}
        </p>
        <p className="issue-date">
          {isZh
            ? `${compactDate} · 北京时间 00:05 发布`
            : `${formattedDate} · Published at 00:05 Beijing Time`}
        </p>
      </div>

      <div className="masthead-character masthead-doudou" aria-hidden="true">
        <Image
          src={getCosAsset("brand/characters/doudou/doudou-master-front.webp")}
          alt=""
          fill
          loading="eager"
          sizes="(max-width: 768px) 150px, 310px"
          className="object-contain object-bottom"
        />
      </div>
    </section>
  );
}
