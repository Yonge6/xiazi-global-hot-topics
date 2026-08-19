"use client";

/* eslint-disable @next/next/no-img-element */

import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { AboutCopy } from "@/components/about-section";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AppLocale } from "@/i18n/config";
import { STYLE_ATLAS_URL } from "@/lib/site/publication-display";
import { isXiaziIOSApp, subscribeToNativeSurface } from "@/lib/native-app";

const WENDAO_URL = "https://wendao.wonderelian.com/";
const HUMAN_DESIGN_URL = "https://human-design.wonderelian.com/";
const YIXIU_URL = "https://yixiu.wonderelian.com/";
const WONDERELIAN_URL = "https://wonderelian.com/";
const SUPPORT_QR_URL = "/brand/contact/support-appreciation.jpeg";
const VIDEO_CHANNEL_QR_URL = "/brand/contact/video-channel.jpg";

type DrawerView = "home" | "about" | "contact" | "support";

function LineIcon({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <svg className={`drawer-line-icon ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

function MenuIcon() {
  return <LineIcon className="menu-line-icon"><path d="M4 7h16M7 12h13M4 17h16" /></LineIcon>;
}

function CloseIcon() {
  return <LineIcon><path d="m6.5 6.5 11 11m0-11-11 11" /></LineIcon>;
}

function ArrowLeftIcon() {
  return <LineIcon><path d="M19 12H5m5-5-5 5 5 5" /></LineIcon>;
}

function ChevronRightIcon() {
  return <LineIcon><path d="m9 6 6 6-6 6" /></LineIcon>;
}

function ExternalLinkIcon() {
  return <LineIcon><path d="M8 16 16 8m-6 0h6v6" /></LineIcon>;
}

function ArchiveIcon() {
  return <LineIcon><path d="M5 7.5h14v11H5zM7 4.5h10v3M8 11h8m-8 3h5" /></LineIcon>;
}

function InfoIcon() {
  return <LineIcon><circle cx="12" cy="12" r="8" /><path d="M12 10.5v5m0-8.25v.25" /></LineIcon>;
}

function EnvelopeIcon() {
  return <LineIcon><rect x="4.5" y="6.5" width="15" height="11" rx="1.5" /><path d="m5.5 8 6.5 5 6.5-5" /></LineIcon>;
}

function RippleIcon() {
  return <LineIcon><path d="M4.5 9.5c2.3 1.6 4.7 1.6 7 0s4.7-1.6 8 0M4.5 14.5c2.3 1.6 4.7 1.6 7 0s4.7-1.6 8 0" /></LineIcon>;
}

function MeditationIcon() {
  return <LineIcon><path d="M12 5v3m-4.8.2 2.1 2.1m7.5-2.1-2.1 2.1M5 13h14M7 17h10" /><circle cx="12" cy="13" r="2.2" /></LineIcon>;
}

function WonderElianIcon() {
  return <LineIcon><path d="m12 3.8 1.6 4.8 4.8 1.6-4.8 1.6-1.6 4.8-1.6-4.8-4.8-1.6 4.8-1.6L12 3.8Z" /><path d="m18.5 15 .6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9Z" /></LineIcon>;
}

function ArtIcon() {
  return <LineIcon><path d="m12 4 1.5 4.5L18 10l-4.5 1.5L12 16l-1.5-4.5L6 10l4.5-1.5L12 4Z" /><path d="m18.5 15 .6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9Z" /></LineIcon>;
}

function BookIcon() {
  return <LineIcon><path d="M5 5.5h5.2c1 0 1.8.8 1.8 1.8v11.2c0-1-.8-1.8-1.8-1.8H5V5.5Zm14 0h-5.2c-1 0-1.8.8-1.8 1.8v11.2c0-1 .8-1.8 1.8-1.8H19V5.5Z" /></LineIcon>;
}

function ConstellationIcon() {
  return <LineIcon><circle cx="6" cy="7" r="1.5" /><circle cx="17.5" cy="6" r="1.5" /><circle cx="12" cy="17" r="1.5" /><path d="m7.4 7.3 8.6-.9M6.8 8.3l4.4 7.5m5.5-8.5-4 8.4" /></LineIcon>;
}

function VideoChannelModal({ isZh, onClose }: { isZh: boolean; onClose: () => void }) {
  return (
    <div
      className="video-channel-modal"
      role="dialog"
      aria-modal="true"
      aria-label={isZh ? "视频号二维码" : "WeChat Channels QR code"}
    >
      <button
        type="button"
        className="video-channel-backdrop"
        aria-label={isZh ? "关闭视频号二维码" : "Close WeChat Channels QR code"}
        onClick={onClose}
        tabIndex={-1}
      />
      <figure>
        <button
          type="button"
          className="video-channel-close"
          aria-label={isZh ? "关闭" : "Close"}
          onClick={onClose}
          autoFocus
        >
          <CloseIcon />
        </button>
        <img
          src={VIDEO_CHANNEL_QR_URL}
          alt={isZh ? "视频号二维码" : "WeChat Channels QR code"}
          draggable={false}
        />
        <figcaption>{isZh ? "扫码关注视频号" : "Scan to follow on WeChat Channels"}</figcaption>
      </figure>
    </div>
  );
}

function suppressFocusRing(element: HTMLElement | null, moveFocus = false) {
  if (!element) return;
  element.dataset.suppressFocusRing = "true";
  element.addEventListener("blur", () => delete element.dataset.suppressFocusRing, { once: true });
  if (moveFocus) element.focus({ preventScroll: true });
}

export function MobileMenu({ locale }: { locale: AppLocale }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DrawerView>("home");
  const [videoChannelOpen, setVideoChannelOpen] = useState(false);
  const isIOSApp = useSyncExternalStore(subscribeToNativeSurface, isXiaziIOSApp, () => false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoChannelTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isZh = locale === "zh";

  const closeMenu = (restoreFocus = false) => {
    setVideoChannelOpen(false);
    setOpen(false);
    if (restoreFocus) window.setTimeout(() => suppressFocusRing(triggerRef.current, true), 0);
  };

  const closeVideoChannel = () => {
    setVideoChannelOpen(false);
    window.setTimeout(() => suppressFocusRing(videoChannelTriggerRef.current, true), 0);
  };

  useEffect(() => {
    if (!open) return;

    document.body.classList.add("navigation-drawer-open");
    window.setTimeout(() => suppressFocusRing(closeRef.current, true), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (videoChannelOpen) {
          closeVideoChannel();
          return;
        }
        closeMenu(true);
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusRoot = videoChannelOpen
        ? drawerRef.current.querySelector<HTMLElement>(".video-channel-modal")
        : drawerRef.current;
      const focusable = Array.from(
        focusRoot?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
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
  }, [open, videoChannelOpen]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [open, view]);

  const title = view === "home"
    ? (isZh ? "你的世界" : "Your World")
    : view === "about"
      ? (isZh ? "关于虾子曰" : "About Xiazi Says")
      : view === "contact"
        ? (isZh ? "联系与回响" : "Contact & Feedback")
        : (isZh ? "随喜相助" : "Support the Journey");

  const contacts = [
    { label: "Elian", value: "wonderelian.com", href: "https://wonderelian.com" },
    { label: isZh ? "邮箱" : "Email", value: "hustyy986@gmail.com", href: "mailto:hustyy986@gmail.com" },
    { label: isZh ? "小红书" : "RED", value: isZh ? "打开主页" : "Open profile", href: "https://xhslink.cn/m/3OF5qu7Peui" },
    { label: isZh ? "抖音" : "Douyin", value: isZh ? "打开主页" : "Open profile", href: "https://v.douyin.com/d9L1thkye0Y/" },
    { label: "X", value: "@yongyuan1", href: "https://x.com/yongyuan1?s=11" },
    { label: "TikTok", value: "@wonderelian", href: "https://www.tiktok.com/@wonderelian?_r=1&_t=ZP-98Tvaldfrpe" },
  ];

  const drawer = open ? (
    <div className={`navigation-drawer-layer locale-${locale}${isIOSApp ? " native-ios" : ""}`}>
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
        <header className={`navigation-drawer-header${view === "home" ? "" : " has-back"}`}>
          {view === "home" ? null : (
            <button
              type="button"
              className="navigation-drawer-back"
              aria-label={isZh ? "返回菜单" : "Back to menu"}
              onPointerDown={(event) => suppressFocusRing(event.currentTarget)}
              onClick={() => setView("home")}
            >
              <ArrowLeftIcon />
            </button>
          )}
          <div>
            <p>{isZh ? "虾子曰 · XIAZI SAYS" : "XIAZI SAYS · GLOBAL HOT TOPICS"}</p>
            <h2 id="navigation-drawer-title">{title}</h2>
          </div>
          <button
            type="button"
            className="navigation-drawer-close"
            aria-label={isZh ? "关闭菜单" : "Close menu"}
            onPointerDown={(event) => suppressFocusRing(event.currentTarget)}
            onClick={() => closeMenu(true)}
            ref={closeRef}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="navigation-drawer-scroll" ref={scrollRef}>
          {view === "home" ? (
            <>
              <nav className="drawer-nav" aria-label={isZh ? "菜单导航" : "Menu navigation"}>
                <ThemeToggle
                  locale={locale}
                  variant="row"
                  title={isZh ? "夜读模式" : "Night reading"}
                  description={isZh ? "调低光线，让眼睛和心一起慢下来" : "Lower the light and read at an easier pace"}
                />

                <a className="drawer-nav-row" href="#archive" onClick={() => closeMenu()}>
                  <span className="drawer-nav-icon"><ArchiveIcon /></span>
                  <span className="drawer-nav-copy">
                    <strong>{isZh ? "往期刊物" : "Past editions"}</strong>
                    <small>{isZh ? "按日期重看过去的世界" : "Revisit the world, one date at a time"}</small>
                  </span>
                  <ChevronRightIcon />
                </a>

                <button className="drawer-nav-row" type="button" onClick={() => setView("about")}>
                  <span className="drawer-nav-icon"><InfoIcon /></span>
                  <span className="drawer-nav-copy">
                    <strong>{isZh ? "关于虾子曰" : "About Xiazi Says"}</strong>
                    <small>{isZh ? "我们怎样筛选新闻，也怎样看门道" : "How we select stories and look beneath them"}</small>
                  </span>
                  <ChevronRightIcon />
                </button>

                <button className="drawer-nav-row" type="button" onClick={() => setView("contact")}>
                  <span className="drawer-nav-icon"><EnvelopeIcon /></span>
                  <span className="drawer-nav-copy">
                    <strong>{isZh ? "联系与回响" : "Contact & feedback"}</strong>
                    <small>{isZh ? "邮箱、微信与社交媒体" : "Email, WeChat, and social channels"}</small>
                  </span>
                  <ChevronRightIcon />
                </button>
              </nav>

              <section className="drawer-support" aria-labelledby="drawer-support-title">
                <p>{isZh ? "有余相助" : "IF YOU HAVE SOMETHING TO SPARE"}</p>
                <h3 id="drawer-support-title">{isZh ? "随喜相助" : "Support the journey"}</h3>
                <span>
                  {isZh
                    ? "若这份内容于你有用，可以让一份心意继续流动；也可以把它留给自己，照顾此刻真正需要的生活。"
                    : "If this work has helped, you may let a little support keep it flowing—or keep that care for what your life needs now."}
                </span>
                <button
                  type="button"
                  onClick={() => setView("support")}
                >
                  <span className="drawer-support-icon"><RippleIcon /></span>
                  <span>
                    <strong>{isZh ? "随喜相助" : "Offer support"}</strong>
                    <small>{isZh ? "有余则助，无余亦安" : "Give freely, or simply read in peace"}</small>
                  </span>
                  <ChevronRightIcon />
                </button>
              </section>

              <section className="drawer-projects" aria-labelledby="drawer-projects-title">
                <p>{isZh ? "沿途所作" : "ALONG THE WAY"}</p>
                <h3 id="drawer-projects-title">
                  {isZh ? "观世界，识自己，也学习看见美。" : "See the world, know yourself, and learn to notice beauty."}
                </h3>

                <a href={WONDERELIAN_URL} target="_blank" rel="noreferrer">
                  <span className="drawer-project-mark"><WonderElianIcon /></span>
                  <span>
                    <strong>WonderElian</strong>
                    <small>{isZh ? "让复杂的想法变得清晰、好看而有人情味" : "Make complex ideas clear, beautiful, and human"}</small>
                  </span>
                  <ExternalLinkIcon />
                </a>

                <a href={YIXIU_URL} target="_blank" rel="noreferrer">
                  <span className="drawer-project-mark"><MeditationIcon /></span>
                  <span>
                    <strong>{isZh ? "一休冥想" : "Yixiu Meditation"}</strong>
                    <small>{isZh ? "先照顾身体与呼吸，让情绪安顿下来" : "Care for the body and breath, and let emotions settle"}</small>
                  </span>
                  <ExternalLinkIcon />
                </a>

                <a href={STYLE_ATLAS_URL} target="_blank" rel="noreferrer">
                  <span className="drawer-project-mark"><ArtIcon /></span>
                  <span>
                    <strong>{isZh ? "艺术风格图鉴" : "Style Atlas"}</strong>
                    <small>{isZh ? "每天一种视觉风格，为今日海报寻找灵感" : "A daily visual language for today's posters"}</small>
                  </span>
                  <ExternalLinkIcon />
                </a>

                <a href={WENDAO_URL} target="_blank" rel="noreferrer">
                  <span className="drawer-project-mark"><BookIcon /></span>
                  <span>
                    <strong>{isZh ? "三慢问道" : "Wendao"}</strong>
                    <small>{isZh ? "从经典里，慢慢读懂自己" : "Read the classics and slowly understand yourself"}</small>
                  </span>
                  <ExternalLinkIcon />
                </a>

                <a href={HUMAN_DESIGN_URL} target="_blank" rel="noreferrer">
                  <span className="drawer-project-mark"><ConstellationIcon /></span>
                  <span>
                    <strong>{isZh ? "不二 认识自己" : "Bu Er · Know Yourself"}</strong>
                    <small>{isZh ? "人生使用说明书，换一个角度认识自己" : "A different lens on how you move through life"}</small>
                  </span>
                  <ExternalLinkIcon />
                </a>
              </section>
            </>
          ) : null}

          {view === "about" ? (
            <section className="drawer-about" aria-label={title}>
              <AboutCopy locale={locale} includePhilosophy />
            </section>
          ) : null}

          {view === "contact" ? (
            <section className="drawer-contact-detail" aria-label={title}>
              <p className="drawer-detail-intro">
                {isZh
                  ? "合作、交流、学习，或想告诉我们哪里还能做得更好，都可以从这里找到我们。"
                  : "For collaboration, conversation, learning, or a thoughtful suggestion, find us here."}
              </p>
              <div className="drawer-contact-list">
                {contacts.map((contact) => (
                  <a
                    href={contact.href}
                    key={contact.label}
                    target={contact.href.startsWith("mailto:") ? undefined : "_blank"}
                    rel={contact.href.startsWith("mailto:") ? undefined : "noreferrer"}
                  >
                    <span>{contact.label}</span>
                    <strong>{contact.value}</strong>
                    <ExternalLinkIcon />
                  </a>
                ))}
                <button
                  type="button"
                  onClick={() => setVideoChannelOpen(true)}
                  ref={videoChannelTriggerRef}
                >
                  <span>{isZh ? "视频号" : "WeChat Channels"}</span>
                  <strong>{isZh ? "查看二维码" : "View QR code"}</strong>
                  <ChevronRightIcon />
                </button>
              </div>
            </section>
          ) : null}

          {view === "support" ? (
            <section className="drawer-support-detail" aria-label={title}>
              <p>{isZh ? "生而不有 · 为而不恃" : "CREATE WITHOUT POSSESSING · GIVE WITHOUT CLAIMING"}</p>
              <h3>{isZh ? "有余则助，无余亦安。" : "Give when you can; be at ease when you cannot."}</h3>
              <span>
                {isZh
                  ? "若虾子曰对你有一点用，你可以随心支持，让这份内容继续生长；若此刻不便，也请把这份心意留给自己。阅读、停留与分享，本身已经是同行。"
                  : "If Xiazi Says has been useful, you may support its continued growth. If now is not the moment, keep that care for yourself. Reading and sharing are already ways of walking together."}
              </span>
              <a href={SUPPORT_QR_URL} target="_blank" rel="noreferrer">
                <img src={SUPPORT_QR_URL} alt={isZh ? "微信赞赏码" : "WeChat appreciation code"} />
              </a>
              <small>{isZh ? "长按二维码识别，或点击单独打开" : "Press and hold to recognize, or tap to open the QR code"}</small>
            </section>
          ) : null}

          <footer className="navigation-drawer-footer">
            <span>{isZh ? "虾说，不瞎说。" : "Bold talk, never blind talk."}</span>
            <div>
              <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
                粤ICP备2025360599号-2
              </a>
              <b>xiazishuo.com</b>
            </div>
          </footer>
        </div>
        {videoChannelOpen ? <VideoChannelModal isZh={isZh} onClose={closeVideoChannel} /> : null}
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
        onPointerDown={(event) => suppressFocusRing(event.currentTarget)}
        onClick={() => {
          setView("home");
          setVideoChannelOpen(false);
          setOpen(true);
        }}
        ref={triggerRef}
      >
        <MenuIcon />
      </button>
      {typeof document === "undefined" ? null : createPortal(drawer, document.body)}
    </>
  );
}
