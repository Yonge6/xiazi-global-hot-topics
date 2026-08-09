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
});
