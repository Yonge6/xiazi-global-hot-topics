"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ThemeToggle } from "@/components/theme-toggle";
import type { AppLocale } from "@/i18n/config";
import { STYLE_ATLAS_URL } from "@/lib/site/publication-display";

const WENDAO_URL = "https://wendao.wonderelian.com/";

type MobileMenuProps = {
  locale: AppLocale;
  issueDate: string;
};

export function MobileMenu({ locale, issueDate }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const isZh = locale === "zh";
  const dateLabel = issueDate.replaceAll("-", ".");

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!open) return;

    document.body.classList.add("navigation-drawer-open");
    window.setTimeout(() => drawerRef.current?.querySelector<HTMLElement>("button")?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu(true);
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("navigation-drawer-open");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const drawer = open ? (
    <div className={`navigation-drawer-layer locale-${locale}`}>
      <button
        type="button"
        className="navigation-drawer-backdrop"
        aria-label={isZh ? "关闭菜单" : "Close menu"}
        onClick={() => closeMenu(true)}
      />
      <aside
        id="navigation-drawer"
        className="navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="navigation-drawer-title"
        ref={drawerRef}
      >
        <header className="navigation-drawer-header">
          <div>
            <p>{isZh ? "虾子曰 · XIAZI SAYS" : "XIAZI SAYS · GLOBAL HOT TOPICS"}</p>
            <h2 id="navigation-drawer-title">{isZh ? "你的世界" : "Your World"}</h2>
          </div>
          <button
            type="button"
            className="navigation-drawer-close"
            aria-label={isZh ? "关闭菜单" : "Close menu"}
            onClick={() => closeMenu(true)}
          >
            <span aria-hidden="true" />
          </button>
        </header>

        <div className="navigation-drawer-scroll">
          <section className="drawer-edition-card" aria-labelledby="drawer-edition-title">
            <p>{isZh ? "今日刊物" : "TODAY'S EDITION"}</p>
            <h3 id="drawer-edition-title">
              {isZh ? `${dateLabel} 已更新` : `${dateLabel} · Now available`}
            </h3>
            <span>
              {isZh
                ? "1 张今日总览 · 8 件全球热点 · 18 张双语海报"
                : "1 daily overview · 8 global stories · 18 bilingual posters"}
            </span>
            <a href="#stories" onClick={() => closeMenu()}>
              {isZh ? "查看今日热点" : "Read today's stories"}
              <b aria-hidden="true">↓</b>
            </a>
          </section>

          <nav className="drawer-nav" aria-label={isZh ? "菜单导航" : "Menu navigation"}>
            <ThemeToggle
              locale={locale}
              variant="row"
              title={isZh ? "夜读模式" : "Night reading"}
              description={isZh ? "调低光线，让眼睛和心一起慢下来" : "Lower the light and read at an easier pace"}
            />

            <div className="drawer-nav-row drawer-language-row">
              <span className="drawer-nav-icon" aria-hidden="true">译</span>
              <span className="drawer-nav-copy">
                <strong>{isZh ? "阅读语言" : "Reading language"}</strong>
                <small>{isZh ? "在中文与英文之间切换" : "Switch between Chinese and English"}</small>
              </span>
              <span className="drawer-language-switcher">
                <Link href="/zh/" className={isZh ? "active" : ""} aria-label="切换到中文">中</Link>
                <Link href="/en/" className={!isZh ? "active" : ""} aria-label="Switch to English">EN</Link>
              </span>
            </div>

            <a className="drawer-nav-row" href="#archive" onClick={() => closeMenu()}>
              <span className="drawer-nav-icon" aria-hidden="true">期</span>
              <span className="drawer-nav-copy">
                <strong>{isZh ? "往期刊物" : "Past editions"}</strong>
                <small>{isZh ? "按日期重看过去的世界" : "Revisit the world, one date at a time"}</small>
              </span>
              <b aria-hidden="true">›</b>
            </a>

            <a className="drawer-nav-row" href="#about" onClick={() => closeMenu()}>
              <span className="drawer-nav-icon" aria-hidden="true">曰</span>
              <span className="drawer-nav-copy">
                <strong>{isZh ? "关于虾子曰" : "About Xiazi Says"}</strong>
                <small>{isZh ? "我们怎样筛选新闻，也怎样看门道" : "How we select stories and look beneath them"}</small>
              </span>
              <b aria-hidden="true">›</b>
            </a>

            <a className="drawer-nav-row" href="#drawer-contact">
              <span className="drawer-nav-icon" aria-hidden="true">信</span>
              <span className="drawer-nav-copy">
                <strong>{isZh ? "联系与回响" : "Contact & feedback"}</strong>
                <small>{isZh ? "合作、交流，或告诉我们哪里还能更好" : "Collaborate, exchange ideas, or help us improve"}</small>
              </span>
              <b aria-hidden="true">↓</b>
            </a>
          </nav>

          <section className="drawer-projects" aria-labelledby="drawer-projects-title">
            <p>{isZh ? "沿途所作" : "ALONG THE WAY"}</p>
            <h3 id="drawer-projects-title">
              {isZh ? "观世界，识自己，也学习看见美。" : "See the world, know yourself, and learn to notice beauty."}
            </h3>

            <a href={STYLE_ATLAS_URL} target="_blank" rel="noreferrer">
              <span className="drawer-project-mark" aria-hidden="true">风</span>
              <span>
                <strong>{isZh ? "风格图鉴" : "Style Atlas"}</strong>
                <small>{isZh ? "每天一种视觉风格，为今日海报寻找灵感" : "A daily visual language for today's posters"}</small>
              </span>
              <b aria-hidden="true">↗</b>
            </a>

            <a href={WENDAO_URL} target="_blank" rel="noreferrer">
              <span className="drawer-project-mark" aria-hidden="true">道</span>
              <span>
                <strong>{isZh ? "三慢问道" : "Wendao"}</strong>
                <small>{isZh ? "从经典里，慢慢读懂自己" : "Read the classics and slowly understand yourself"}</small>
              </span>
              <b aria-hidden="true">↗</b>
            </a>
          </section>

          <section className="drawer-contact" id="drawer-contact" aria-labelledby="drawer-contact-title">
            <div>
              <p>{isZh ? "有话相告" : "STAY IN TOUCH"}</p>
              <h3 id="drawer-contact-title">{isZh ? "联系与交流" : "Connect with us"}</h3>
              <span>{isZh ? "合作、交流、学习，或留下一点建议。" : "For collaboration, conversation, learning, or a thoughtful note."}</span>
            </div>
            <Image src="/brand/contact-qr.webp" alt={isZh ? "扫码添加微信" : "Scan to connect on WeChat"} width={118} height={118} />
          </section>

          <footer className="navigation-drawer-footer">
            <span>{isZh ? "虾说，不瞎说。" : "Bold talk, never blind talk."}</span>
            <b>xiazishuo.com</b>
          </footer>
        </div>
      </aside>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className="mobile-menu-trigger"
        aria-label={isZh ? "打开菜单" : "Open menu"}
        aria-expanded={open}
        aria-controls="navigation-drawer"
        onClick={() => setOpen(true)}
        ref={triggerRef}
      >
        <span>{isZh ? "菜单" : "Menu"}</span>
        <i aria-hidden="true"><b /><b /><b /></i>
      </button>
      {typeof document === "undefined" ? null : createPortal(drawer, document.body)}
    </>
  );
}
