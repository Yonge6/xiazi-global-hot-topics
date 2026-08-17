import { afterEach, describe, expect, it, vi } from "vitest";

import { isNativeIOSSurface, trackAnalytics } from "@/lib/analytics/client";

describe("iOS analytics boundary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("detects the native iOS query surface", () => {
    vi.stubGlobal("window", {
      location: { search: "?surface=ios" },
    });

    expect(isNativeIOSSurface()).toBe(true);
  });

  it("does not emit analytics from the iOS app", () => {
    const sendBeacon = vi.fn();
    vi.stubGlobal("window", {
      location: { search: "?surface=ios" },
    });
    vi.stubGlobal("navigator", { sendBeacon });

    trackAnalytics("page_view", "en");

    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("forwards website poster interactions to the shared GA4 event", () => {
    const gtag = vi.fn();
    const sendBeacon = vi.fn();
    vi.stubGlobal("window", {
      location: { search: "" },
      gtag,
    });
    vi.stubGlobal("navigator", { sendBeacon });

    trackAnalytics("poster_view", "en", "verified-topic");

    expect(gtag).toHaveBeenCalledWith("event", "poster_engagement", {
      site_id: "site-xiazi",
      interaction: "poster_view",
      locale: "en",
      content_slug: "verified-topic",
    });
  });
});
