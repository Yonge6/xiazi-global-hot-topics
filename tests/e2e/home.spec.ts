import { expect, test } from "@playwright/test";

test("renders the Chinese issue and nine stories", async ({ page }) => {
  await page.goto("/zh");
  await expect(page.getByRole("heading", { name: "昨日世界." })).toBeVisible();
  await expect(page.locator("article")).toHaveCount(9);
  await expect(page.locator("article").filter({ hasText: "美国队 4:1 击败巴拉圭" })).toBeVisible();
  await expect(page.getByText("pluto.hk").first()).toBeVisible();
  await expect(page.getByText("2026.06.14 · 北京时间 00:05 发布")).toBeVisible();
});

test("renders the Chinese homepage at the root domain", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "昨日世界." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Switch to English" })).toHaveAttribute(
    "href",
    "/en/",
  );
});

test("switches locale while keeping the page context", async ({ page }) => {
  await page.goto("/zh");
  await page.getByRole("link", { name: "Switch to English" }).click();
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.getByRole("heading", { name: "THE WORLD YESTERDAY." })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: "USA beat Paraguay 4-1" })).toBeVisible();
  await expect(page.getByText("June 14, 2026 · Published at 00:05 Beijing Time")).toBeVisible();
  await expect(page.locator('article img[src*="/posters/thumb/en/"]').first()).toBeVisible();
});

test("opens, navigates and closes the poster lightbox", async ({ page }) => {
  await page.goto("/zh");
  await page.getByRole("button", { name: /查看美国队 4:1 击败巴拉圭海报原图/ }).click();

  const dialog = page.getByRole("dialog", { name: "海报原图" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("01 / 09")).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByText("02 / 09")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("opens sharing options for every poster", async ({ page }) => {
  await page.goto("/zh");
  const shareButtons = page.getByRole("button", { name: /^分享/ });
  await expect(shareButtons).toHaveCount(9);
  await shareButtons.first().click();

  const dialog = page.getByRole("dialog", { name: "分享海报" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "用手机 App 分享" })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "微博" })).toHaveAttribute("href", /service\.weibo\.com/);
  await expect(dialog.getByRole("link", { name: "X" })).toHaveAttribute("href", /twitter\.com\/intent/);
  await expect(dialog.getByRole("link", { name: "Facebook" })).toHaveAttribute("href", /facebook\.com\/sharer/);
  const whatsappHref = await dialog.getByRole("link", { name: "WhatsApp" }).getAttribute("href");
  expect(decodeURIComponent(whatsappHref || "")).toContain("美国队以 4:1 开启世界杯征程");
  await expect(dialog.getByText("标题 + 100字介绍 + 海报图片")).toBeVisible();
});

test("renders the mobile studio editor", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: "手机编辑后台" })).toBeVisible();
  await expect(page.getByText("世界杯硬规则：始终保持第一条")).toBeHidden();
  await page.getByLabel("后台密码").fill("000000");
  await page.getByRole("button", { name: "进入后台" }).click();
  await expect(page.getByText("手机编辑后台")).toBeVisible();
  await expect(page.getByText("世界杯硬规则：始终保持第一条")).toBeVisible();
  await expect(page.getByAltText("中文海报预览")).toBeVisible();
  await expect(page.getByAltText("英文海报预览")).toBeVisible();
  await expect(page.getByRole("button", { name: "发布本期修改" })).toBeVisible();
});

test("rejects an incorrect studio login password", async ({ page }) => {
  await page.goto("/studio");
  await page.getByLabel("后台密码").fill("123456");
  await page.getByRole("button", { name: "进入后台" }).click();
  await expect(page.getByText("密码不正确")).toBeVisible();
  await expect(page.getByRole("button", { name: "发布本期修改" })).toBeHidden();
});

test("publishes the issue through GitHub", async ({ page }) => {
  await page.route("**/api/studio/publish", async (route) => {
    const issue = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ issue }),
    });
  });
  await page.goto("/studio");
  await page.getByLabel("后台密码").fill("000000");
  await page.getByRole("button", { name: "进入后台" }).click();
  await page.getByRole("button", { name: "发布本期修改" }).click();
  await expect(page.getByRole("status")).toHaveText("发布成功，首页通常在 1 分钟内更新");
});

test("previews a replacement poster immediately", async ({ page }) => {
  await page.route("**/api/studio/poster", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, version: "poster-test-version" }),
    });
  });
  await page.goto("/studio");
  await page.getByLabel("后台密码").fill("000000");
  await page.getByRole("button", { name: "进入后台" }).click();

  await page.getByLabel("替换中文海报").setInputFiles({
    name: "poster.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });

  await expect(page.getByAltText("中文海报预览")).toHaveAttribute("src", /^blob:/);
  await expect(page.getByRole("status")).toHaveText("海报已替换，刷新首页即可看到新图");
});

test("keeps the mobile page within the viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.goto("/zh");

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));

  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await expect(page.locator("article")).toHaveCount(9);

  const mobileTypography = await page.evaluate(() => {
    const localePage = document.querySelector(".locale-zh");
    const headline = document.querySelector(".catalogue-entry h2");
    return {
      localeClass: localePage?.className,
      fontFamily: headline ? getComputedStyle(headline).fontFamily : "",
      animationName: headline?.closest(".catalogue-entry")
        ? getComputedStyle(headline.closest(".catalogue-entry")!).animationName
        : "",
    };
  });
  expect(mobileTypography.localeClass).toContain("locale-zh");
  expect(mobileTypography.fontFamily).toContain("Songti SC");
  expect(mobileTypography.animationName).toBe("page-awaken");
});
