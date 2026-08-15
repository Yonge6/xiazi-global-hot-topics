import type { AnalyticsEvent } from "@/lib/analytics/types";

export function isNativeIOSSurface() {
  if (typeof window === "undefined") return false;
  const bridge = (window as typeof window & {
    XiaziNativeBridge?: { platform?: string };
  }).XiaziNativeBridge;
  return bridge?.platform === "ios"
    || new URLSearchParams(window.location.search).get("surface") === "ios";
}

export function trackAnalytics(
  event: AnalyticsEvent,
  locale: "zh" | "en",
  slug?: string,
  durationSeconds?: number,
) {
  // The public website keeps anonymous aggregate analytics. The iOS app
  // intentionally opts out so its App Store privacy declaration remains exact.
  if (isNativeIOSSurface()) return;

  if (["poster_view", "download", "share", "source_click"].includes(event)) {
    const googleTag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
    googleTag?.("event", "poster_engagement", {
      site_id: "site-xiazi",
      interaction: event,
      locale,
      content_slug: slug,
    });
  }

  let visitorId: string | undefined;
  if (event === "page_view") {
    visitorId = localStorage.getItem("xiazi-anonymous-visitor") || undefined;
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      localStorage.setItem("xiazi-anonymous-visitor", visitorId);
    }
  }
  const body = JSON.stringify({ event, locale, slug, visitorId, durationSeconds });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/event/", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/analytics/event/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}

export function trackSessionDuration(locale: "zh" | "en", durationSeconds: number) {
  const normalizedDuration = Math.min(1800, Math.max(1, Math.round(durationSeconds)));
  trackAnalytics("session_duration", locale, undefined, normalizedDuration);
}
