import { expect, type Page, test } from "@playwright/test";

test.skip(!process.env.PLAYWRIGHT_BASE_URL, "staging checks require PLAYWRIGHT_BASE_URL");

async function enableProtectionBypassCookie(page: Page) {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!secret) return;
  await page.goto(`/?x-vercel-protection-bypass=${encodeURIComponent(secret)}&x-vercel-set-bypass-cookie=true`);
}

test("staging preview serves Supabase-backed issue APIs", async ({ request }) => {
  const list = await request.get("/api/v1/issues/");
  expect(list.ok()).toBeTruthy();
  const listJson = await list.json();
  expect(listJson.issues).toHaveLength(5);
  expect(listJson.issues[0]).toMatchObject({
    issueDate: "2026-06-19",
    source: "supabase",
  });

  const latest = await request.get("/api/v1/issues/latest/");
  expect(latest.ok()).toBeTruthy();
  const latestText = await latest.text();
  expect(latestText).not.toMatch(/SUPABASE_SECRET|service_role|sb_secret|[a-z]+_[a-z]+":/);

  const latestJson = JSON.parse(latestText);
  expect(latestJson.issue.issueDate).toBe("2026-06-19");
  expect(latestJson.issue.slotHour).toBe(5);
  expect(latestJson.issue.topics).toHaveLength(9);
  expect(latestJson.issue.topics.map((topic: { rank: number }) => topic.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(latestJson.issue.topics[0].localizations["zh-CN"].headlineFull).toContain("哥伦比亚3:1");
  expect(latestJson.issue.topics[0].localizations["en-US"].headlineFull).toContain("Colombia beat Uzbekistan");
  expect(latestJson.issue.topics[0].sources[0].url).toMatch(/^https:\/\//);

  const missing = await request.get("/api/v1/issues/1900-01-01/");
  expect(missing.status()).toBe(404);
});

test("staging preview renders bilingual homepage and poster interactions", async ({ page }) => {
  await enableProtectionBypassCookie(page);
  await page.goto("/zh/");
  await expect(page.getByRole("heading", { name: "昨日世界." })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(9);
  await expect(page.locator("article").first()).toContainText("哥伦比亚3:1击败世界杯新军乌兹别克斯坦");
  await expect(page.getByText("2026.06.19 · 北京时间 05:00 发布")).toBeVisible();
  await expect(page.getByRole("link", { name: "推荐阅读" }).first()).toHaveAttribute("href", /^https:\/\//);
  await expect(page.locator('article img[src*="/posters/thumb/zh/"]').first()).toBeVisible();

  await page.getByRole("button", { name: /查看哥伦比亚3:1击败世界杯新军乌兹别克斯坦海报原图/ }).click();
  const lightbox = page.getByRole("dialog", { name: "海报原图" });
  await expect(lightbox).toBeVisible();
  await expect(lightbox.getByText("01 / 09")).toBeVisible();
  await expect(lightbox.getByRole("link", { name: "下载" })).toHaveAttribute("download", "");
  await page.keyboard.press("Escape");
  await expect(lightbox).toBeHidden();

  await page.getByRole("button", { name: /^分享/ }).first().click();
  const shareDialog = page.getByRole("dialog", { name: "分享海报" });
  await expect(shareDialog).toBeVisible();
  await expect(shareDialog.getByRole("link", { name: "微博" })).toHaveAttribute("href", /service\.weibo\.com/);
  await expect(shareDialog.getByText("标题 + 100字介绍 + 海报图片")).toBeVisible();

  await page.goto("/en/");
  await expect(page.getByRole("heading", { name: "THE WORLD YESTERDAY." })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(9);
  await expect(page.locator("article").first()).toContainText("Colombia beat Uzbekistan 3:1");
  await expect(page.locator('article img[src*="/posters/thumb/en/"]').first()).toBeVisible();
});

test("staging preview exposes archive and keeps unknown pages safe", async ({ page }) => {
  await enableProtectionBypassCookie(page);
  await page.goto("/zh/");
  await expect(page.getByRole("button", { name: /2026\.06\.18/ })).toBeVisible();
  await page.getByRole("button", { name: /2026\.06\.18/ }).click();
  await expect(page.getByRole("status")).toContainText(/2026-06-18/);
  await expect(page.locator("article")).toHaveCount(9);

  const response = await page.goto("/does-not-exist/");
  expect(response?.status()).toBe(404);
});
