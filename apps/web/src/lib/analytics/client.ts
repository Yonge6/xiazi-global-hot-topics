import type { AnalyticsEvent } from "@/lib/analytics/types";

export function trackAnalytics(
  event: AnalyticsEvent,
  locale: "zh" | "en",
  slug?: string,
  durationSeconds?: number,
) {
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
