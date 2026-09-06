import { readFile } from "node:fs/promises";
import { expect, test, type Route } from "@playwright/test";

test("the last selected archive wins and a failed return preserves that edition", async ({ page }) => {
  const issue = JSON.parse(await readFile("data/archive/2026-07-25.json", "utf8"));
  let pending: Route | undefined;
  await page.route("**/api/v1/issues/2026-07-25/", async (route) => { pending = route; });
  await page.route("**/api/v1/issues/2026-07-24/", (route) => route.fulfill({
    json: { issue: { ...issue, issueDate: "2026-07-24" } },
  }));
  await page.goto("/zh/");
  const july = page.locator("details.archive-month").filter({ hasText: "2026年7月" });
  await july.locator("summary").click();
  await july.getByRole("button", { name: /2026\.07\.25/ }).click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await july.getByRole("button", { name: /2026\.07\.24/ }).click();
  await expect(page.locator(".edition-current")).toContainText("2026-07-24");
  await pending!.fulfill({ json: { issue } });
  await expect(page.locator(".archive-status")).toHaveText("正在查看 2026-07-24 往期");
  await page.route("**/api/content/", (route) => route.fulfill({ status: 503, json: {} }));
  await page.getByRole("button", { name: "返回当前期" }).click();
  await expect(page.locator(".archive-status")).toHaveText("当前期读取失败，请稍后重试");
  await expect(page.locator(".edition-current")).toContainText("2026-07-24");
});

test("copy recovers when embedded-browser clipboard permission is denied", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async () => { throw new DOMException("Denied", "NotAllowedError"); },
    } });
    document.execCommand = (command) => command === "copy";
  });
  await page.goto("/zh/");
  await page.getByRole("button", { name: /^分享/ }).first().click();
  await page.locator(".copy-share").click();
  await expect(page.getByText("标题、介绍和链接已复制")).toBeVisible();
  await expect(page.locator("textarea")).toHaveCount(0);
  await page.evaluate(() => { document.execCommand = () => false; });
  await page.locator(".copy-share").click();
  await expect(page.getByText("复制失败，请使用浏览器分享菜单")).toBeVisible();
});
