import { describe, expect, it } from "vitest";

import { injectXiaziNavigation } from "@/app/english-quote-log/route";

describe("english quote log", () => {
  it("injects the shared Xiazi navigation into the standalone HTML", () => {
    const html = injectXiaziNavigation("<html><body><main>Quote log</main></body></html>");

    expect(html).toContain("pluto-shared-site-header");
    expect(html).toContain("https://xiazishuo.com/zh/#stories");
    expect(html).toContain("https://xiazishuo.com/english-quote-log/");
    expect(html).not.toContain("https://pluto.hk");
    expect(html).toContain("<main>Quote log</main>");
  });

  it("does not inject duplicate navigation", () => {
    const html = injectXiaziNavigation("<html><body><main>Quote log</main></body></html>");

    expect(injectXiaziNavigation(html)).toBe(html);
  });
});
