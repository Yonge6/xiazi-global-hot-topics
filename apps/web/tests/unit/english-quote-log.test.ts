import { describe, expect, it } from "vitest";

import { injectPlutoNavigation } from "@/app/english-quote-log/route";

describe("english quote log", () => {
  it("injects the shared Pluto navigation into the standalone HTML", () => {
    const html = injectPlutoNavigation("<html><body><main>Quote log</main></body></html>");

    expect(html).toContain("pluto-shared-site-header");
    expect(html).toContain("https://pluto.hk/zh/#stories");
    expect(html).toContain("https://pluto.hk/english-quote-log/");
    expect(html).toContain("<main>Quote log</main>");
  });

  it("does not inject duplicate navigation", () => {
    const html = injectPlutoNavigation("<html><body><main>Quote log</main></body></html>");

    expect(injectPlutoNavigation(html)).toBe(html);
  });
});
