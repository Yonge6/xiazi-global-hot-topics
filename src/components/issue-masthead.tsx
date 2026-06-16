import Image from "next/image";

import type { AppLocale } from "@/i18n/config";
import { getCosAsset } from "@/lib/posters/assets";

export function IssueMasthead({ locale, issueDate }: { locale: AppLocale; issueDate: string }) {
  const isZh = locale === "zh";
  const date = new Date(`${issueDate}T00:05:00+08:00`);
  const formattedDate = new Intl.DateTimeFormat(isZh ? "zh-CN" : "en-US", {
    year: "numeric",
    month: isZh ? "2-digit" : "long",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(date);
  const compactDate = issueDate.replaceAll("-", ".");

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
          {isZh ? "一画一世界 一虾一菩提" : "Nine stories shaping the world"}
        </p>
        <p className="issue-manifesto">
          {isZh ? (
            <>
              <span>信息纷涌，世界喧哗。</span>
              <span>每天看懂 9 件重要的事，就够了。</span>
              <span>剩下的时间，好好生活，享受当下。</span>
            </>
          ) : (
            <>
              <span>The world is loud and information never stops.</span>
              <span>Nine important stories a day may be enough.</span>
              <span>Leave the rest of your time for life—and for the present moment.</span>
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
