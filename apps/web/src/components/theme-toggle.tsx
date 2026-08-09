"use client";

import { useEffect, useState } from "react";

import type { AppLocale } from "@/i18n/config";

const STORAGE_KEY = "xiazishuo-theme";
const THEME_EVENT = "xiazishuo-theme-change";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new CustomEvent<Theme>(THEME_EVENT, { detail: theme }));
}

type ThemeToggleProps = {
  locale: AppLocale;
  variant?: "icon" | "row";
  title?: string;
  description?: string;
};

export function ThemeToggle({ locale, variant = "icon", title, description }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncCurrentTheme = () => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    };
    const syncSystemTheme = () => {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        applyTheme(media.matches ? "dark" : "light");
      }
    };
    const handleThemeChange = (event: Event) => {
      setTheme((event as CustomEvent<Theme>).detail);
    };

    syncCurrentTheme();
    syncSystemTheme();
    media.addEventListener("change", syncSystemTheme);
    window.addEventListener(THEME_EVENT, handleThemeChange);
    return () => {
      media.removeEventListener("change", syncSystemTheme);
      window.removeEventListener(THEME_EVENT, handleThemeChange);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme: Theme = document.documentElement.dataset.theme === "dark"
      ? "light"
      : "dark";
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  };

  return (
    <button
      type="button"
      className={`theme-toggle${variant === "row" ? " theme-toggle-row" : ""}`}
      onClick={toggleTheme}
      aria-label={locale === "zh" ? "切换日间或夜间模式" : "Toggle light or dark mode"}
      title={locale === "zh" ? "日间 / 夜间" : "Light / Dark"}
      role={variant === "row" ? "switch" : undefined}
      aria-checked={variant === "row" ? theme === "dark" : undefined}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        <svg className="theme-icon theme-icon-moon" viewBox="0 0 24 24">
          <path d="M20.2 15.1A8.4 8.4 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15Z" />
        </svg>
        <svg className="theme-icon theme-icon-sun" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3.6" />
          <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
        </svg>
      </span>
      {variant === "row" ? (
        <>
          <span className="drawer-nav-copy">
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
          <span className="theme-toggle-switch" aria-hidden="true"><i /></span>
        </>
      ) : null}
    </button>
  );
}
