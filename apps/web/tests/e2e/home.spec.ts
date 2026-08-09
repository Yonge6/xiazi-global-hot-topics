import { expect, test, type APIRequestContext } from "@playwright/test";

type IssueResponse = {
  issue: {
    issueDate: string;
    topics: Array<{
      slug: string;
      rank: number;
      localizations: Record<string, {
        headlineFact: string;
        headlineFull: string;
        intro: string;
      }>;
    }>;
  };
};

async function latestIssue(request: APIRequestContext) {
  const response = await request.get("/api/v1/issues/latest/");
  expect(response.ok()).toBe(true);
  return (await response.json()) as IssueResponse;
}

function zhDate(issueDate: string) {
  return `${issueDate.replaceAll("-", ".")} · 北京时间 05:00 发布`;
}

function enDate(issueDate: string) {
  const date = new Date(`${issueDate}T05:00:00+08:00`);
  return `${new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    timeZone: "Asia/Shanghai",
  }).format(date)} · Published at 05:00 Beijing Time`;
}

test("renders the Chinese issue with one overview and eight stories", async ({ page, request }) => {
  const { issue } = await latestIssue(request);
  const lead = issue.topics[0].localizations["zh-CN"];

  await page.goto("/zh");
  await expect(page.getByRole("heading", { name: "昨日世界." })).toBeVisible();
  await expect(page.getByText("每天看懂世界上最重要的 8 件事，就够了。")).toBeVisible();
  await expect(page.getByText("1 张今日总览 · 8 件全球热点")).toBeVisible();
  await expect(page.locator("article")).toHaveCount(9);
  await expect(page.locator("article").filter({ hasText: lead.headlineFact })).toBeVisible();
  await expect(page.getByText("xiazishuo.com").first()).toBeVisible();
  await expect(page.getByText(zhDate(issue.issueDate))).toBeVisible();
  await expect(page.getByRole("link", { name: /今日风格.*Style Atlas/ })).toHaveAttribute(
    "href",
    "https://style-atlas.wonderelian.com/",
  );
  await expect(page.getByText("点击日期，查看当期 1 张今日总览、8 件全球热点的文字、来源与海报。")).toBeVisible();
  await expect(page.getByText(/每天看懂\s*9\s*件重要的事/)).toHaveCount(0);
});

test("renders the Chinese homepage at the root domain", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "昨日世界." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Switch to English" })).toHaveAttribute(
    "href",
    "/en/",
  );
});

test("groups archive editions by month and opens only the latest month by default", async ({ page }) => {
  await page.goto("/zh/#archive");

  const months = page.locator("details.archive-month");
  await expect(months).toHaveCount(2);

  const july = months.filter({ hasText: "2026年7月" });
  const june = months.filter({ hasText: "2026年6月" });
  await expect(july).toHaveAttribute("open", "");
  await expect(june).not.toHaveAttribute("open", "");
  await expect(july.getByRole("button", { name: /2026\.07\.23/ })).toBeVisible();
  await expect(july.getByRole("button", { name: /2026\.07\.20/ })).toBeVisible();
  await expect(july.getByRole("button", { name: /2026\.07\.19/ })).toBeVisible();

  await june.locator("summary").click();
  await expect(june).toHaveAttribute("open", "");
  await expect(june.getByRole("button", { name: /2026\.06\.30/ })).toBeVisible();
});

test("switches locale while keeping the page context", async ({ page, request }) => {
  const { issue } = await latestIssue(request);
  const lead = issue.topics[0].localizations["en-US"];

  await page.goto("/zh");
  await page.getByRole("link", { name: "Switch to English" }).click();
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.getByRole("heading", { name: "THE WORLD YESTERDAY." })).toBeVisible();
  await expect(page.getByText("1 Daily Overview · 8 Global Stories")).toBeVisible();
  await expect(page.locator("article").filter({ hasText: lead.headlineFact })).toBeVisible();
  await expect(page.getByText(enDate(issue.issueDate))).toBeVisible();
  await expect(page.getByRole("link", { name: /TODAY'S STYLE.*Style Atlas/ })).toHaveAttribute(
    "href",
    "https://style-atlas.wonderelian.com/",
  );
  await expect(page.locator('article img[src*="/api/posters/en/"]').first()).toBeVisible();
  await expect(page.getByText("Browse each edition: 1 daily overview, 8 global stories, sources, and bilingual posters.")).toBeVisible();
});

test("follows the system theme and remembers a manual theme choice", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/zh");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "打开菜单" }).click();
  }
  const toggle = testInfo.project.name === "mobile"
    ? page.getByRole("switch", { name: "切换日间或夜间模式" })
    : page.getByRole("button", { name: "切换日间或夜间模式" });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("opens the mobile world drawer with Xiazi navigation and related projects", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.goto("/zh");

  await expect(page.getByRole("link", { name: "Switch to English" })).toBeVisible();
  const menuTrigger = page.getByRole("button", { name: "打开菜单" });
  await expect(menuTrigger).toHaveText("");
  await menuTrigger.click();
  let drawer = page.getByRole("dialog", { name: "你的世界" });
  await expect(drawer).toBeVisible();
  const closeButton = drawer.getByRole("button", { name: "关闭菜单" });
  await expect(closeButton).toBeFocused();
  await expect(closeButton).toHaveAttribute("data-suppress-focus-ring", "true");
  await expect(drawer.getByText("今日刊物")).toHaveCount(0);
  await expect(drawer.locator(".drawer-support")).toBeVisible();
  await expect(drawer.getByRole("switch", { name: "切换日间或夜间模式" })).toBeVisible();
  await drawer.getByRole("button", { name: /关于虾子曰/ }).click();
  drawer = page.getByRole("dialog", { name: "关于虾子曰" });
  await expect(drawer.getByText("生命不是用来证明自己的，而是用来认识、接纳、成为并活出自己。")).toBeVisible();
  await drawer.getByRole("button", { name: "返回菜单" }).click();
  drawer = page.getByRole("dialog", { name: "你的世界" });
  await drawer.getByRole("button", { name: /联系与回响/ }).click();
  drawer = page.getByRole("dialog", { name: "联系与回响" });
  await expect(drawer.getByRole("link", { name: /小红书/ })).toBeVisible();
  await expect(drawer.getByRole("link", { name: /TikTok/ })).toBeVisible();
  await expect(drawer).toHaveCSS("font-family", /Noto Serif SC|Songti SC|STSong/);
  await drawer.getByRole("button", { name: "视频号 查看二维码" }).click();
  const videoChannelDialog = drawer.getByRole("dialog", { name: "视频号二维码" });
  const videoChannelQr = videoChannelDialog.getByRole("img", { name: "视频号二维码" });
  await expect(videoChannelQr).toBeVisible();
  await expect.poll(() => videoChannelQr.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(686);
  await expect(videoChannelDialog.getByText("扫码关注视频号")).toBeVisible();
  await videoChannelDialog.getByRole("button", { name: "关闭", exact: true }).click();
  await expect(videoChannelDialog).toBeHidden();
  await expect(drawer.getByText("扫码联系与交流")).toHaveCount(0);
  await drawer.getByRole("button", { name: "返回菜单" }).click();
  drawer = page.getByRole("dialog", { name: "你的世界" });
  await drawer.getByRole("button", { name: /随喜相助/ }).click();
  drawer = page.getByRole("dialog", { name: "随喜相助" });
  await expect(drawer.getByAltText("微信赞赏码")).toBeVisible();
  await drawer.getByRole("button", { name: "返回菜单" }).click();
  drawer = page.getByRole("dialog", { name: "你的世界" });
  await expect(drawer.getByRole("link", { name: /艺术风格图鉴/ })).toHaveAttribute(
    "href",
    "https://style-atlas.wonderelian.com/",
  );
  await expect(drawer.getByRole("link", { name: /三慢问道/ })).toHaveAttribute(
    "href",
    "https://wendao.wonderelian.com/",
  );
  await expect(drawer.getByRole("link", { name: /人类图/ })).toHaveAttribute(
    "href",
    "https://human-design.wonderelian.com/",
  );

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("button", { name: "打开菜单" })).toBeFocused();
  await expect(page.getByRole("button", { name: "打开菜单" })).toHaveAttribute("data-suppress-focus-ring", "true");
});

test("hides support and uses Apple sharing inside the iOS shell", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile");
  await page.addInitScript(() => {
    const nativeMessages: unknown[] = [];
    Object.defineProperty(window, "__xiaziNativeMessages", { value: nativeMessages });
    Object.defineProperty(window, "XiaziNativeBridge", {
      value: { platform: "ios", shellVersion: "1.0.0", capabilities: ["poster.share"] },
    });
    Object.defineProperty(window, "webkit", {
      value: {
        messageHandlers: {
          xiaziNative: {
            postMessage(message: { type: string }) {
              nativeMessages.push(message);
            },
          },
        },
      },
    });
  });

  await page.goto("/zh/?surface=ios");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  await page.getByRole("button", { name: "打开菜单" }).click();
  const drawer = page.getByRole("dialog", { name: "你的世界" });
  await expect(drawer.locator(".drawer-support")).toBeHidden();
  await drawer.getByRole("button", { name: "关闭菜单" }).click();

  await page.getByRole("button", { name: /^分享/ }).first().click();
  const shareDialog = page.getByRole("dialog", { name: "分享海报" });
  await shareDialog.getByRole("button", { name: /用苹果系统分享/ }).click();
  await expect(shareDialog.getByText("已打开苹果系统分享")).toBeVisible();
  await shareDialog.getByRole("button", { name: "关闭", exact: true }).click();

  await page.getByRole("button", { name: /保存海报/ }).first().click();
  await page.getByRole("button", { name: /查看原图/ }).first().click();
  await expect(page.getByRole("dialog", { name: "海报原图" }).getByRole("button", { name: /保存原图/ })).toBeVisible();

  const nativeMessages = await page.evaluate(() => (
    window as unknown as Window & { __xiaziNativeMessages: unknown[] }
  ).__xiaziNativeMessages);
  expect(nativeMessages).toHaveLength(2);
  for (const message of nativeMessages) {
    expect(message).toEqual(expect.objectContaining({
      type: "poster.share",
      payload: expect.objectContaining({
        url: expect.stringMatching(/^https?:\/\/[^/]+\/api\/posters\/zh\//),
        title: expect.any(String),
        text: expect.any(String),
      }),
    }));
  }
});

test("opens, navigates and closes the poster lightbox", async ({ page, request }) => {
  const { issue } = await latestIssue(request);
  const lead = issue.topics[0].localizations["zh-CN"];

  await page.goto("/zh");
  await page.getByRole("button", { name: `查看${lead.headlineFact}海报原图` }).click();

  const dialog = page.getByRole("dialog", { name: "海报原图" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("01 / 09")).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByText("02 / 09")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("opens sharing options for every poster", async ({ page, request }) => {
  const { issue } = await latestIssue(request);
  const lead = issue.topics[0].localizations["zh-CN"];

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
  expect(decodeURIComponent(whatsappHref || "")).toContain(lead.headlineFact);
  expect(decodeURIComponent(whatsappHref || "")).toContain(lead.intro.slice(0, 24));
  expect(decodeURIComponent(whatsappHref || "")).toContain("https://xiazishuo.com/zh/");
  expect(decodeURIComponent(whatsappHref || "")).not.toContain("pluto.hk");
  await expect(dialog.getByText("标题 + 100字介绍 + 海报图片")).toBeVisible();
});

test("renders the mobile studio editor", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.getByRole("heading", { name: "手机编辑后台" })).toBeVisible();
  await expect(page.getByText("世界杯硬规则：始终保持第一条新闻")).toBeHidden();
  await page.getByLabel("后台密码").fill("000000");
  await page.getByRole("button", { name: "进入后台" }).click();
  await expect(page.getByText("手机编辑后台")).toBeVisible();
  await page.getByRole("button", { name: "内容编辑" }).click();
  await page.locator(".studio-topic-tabs").getByRole("button", { name: "2" }).click();
  await expect(page.getByText("世界杯硬规则：始终保持第一条新闻")).toBeHidden();
  await expect(page.getByAltText("中文海报预览")).toBeVisible();
  await expect(page.getByAltText("英文海报预览")).toBeVisible();
  await expect(page.getByRole("button", { name: "发布当前期修改" })).toBeVisible();
});

test("rejects an incorrect studio login password", async ({ page }) => {
  await page.goto("/studio");
  await page.getByLabel("后台密码").fill("123456");
  await page.getByRole("button", { name: "进入后台" }).click();
  await expect(page.getByText("密码不正确")).toBeVisible();
  await expect(page.getByRole("button", { name: "发布当前期修改" })).toBeHidden();
});

test("publishes the issue through GitHub", async ({ page }) => {
  let publishRequests = 0;
  let syncRequests = 0;
  await page.route("**/api/studio/publish", async (route) => {
    publishRequests += 1;
    const payload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        published: true,
        issue: payload.issue,
        issueDate: payload.issue.issueDate,
        publishRequestId: `studio-publish:${payload.issue.issueDate}:e2e`,
        target: { source: "current", value: "current" },
        primary: { target: "github", status: "succeeded", commitSha: "e2e-github-commit" },
        shadow: { target: "supabase", status: "disabled", changed: false },
        compare: { status: "not_started", differenceCount: 0 },
      }),
    });
  });
  await page.route("**/api/studio/sync-issue-posters", async (route) => {
    syncRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.goto("/studio");
  await page.getByLabel("后台密码").fill("000000");
  await page.getByRole("button", { name: "进入后台" }).click();
  await page.getByRole("button", { name: "内容编辑" }).click();
  await page.getByRole("button", { name: "发布当前期修改" }).click();
  await expect.poll(() => publishRequests).toBe(1);
  await expect.poll(() => syncRequests).toBe(1);
  await expect(page.getByRole("status")).toHaveText(/发布成功|当前期已载入/);
  await expect(page.getByText("主发布成功，影子双写未启用")).toBeVisible();
});

test("shows partial Studio publish success and retries shadow sync", async ({ page }) => {
  let publishRequests = 0;
  let retryRequests = 0;
  await page.route("**/api/studio/publish", async (route) => {
    publishRequests += 1;
    const payload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        published: true,
        issue: payload.issue,
        issueDate: payload.issue.issueDate,
        publishRequestId: `studio-publish:${payload.issue.issueDate}:e2e-shadow-failed`,
        target: { source: "current", value: "current" },
        primary: { target: "github", status: "succeeded", commitSha: "e2e-github-commit" },
        shadow: { target: "supabase", status: "failed", changed: false },
        compare: { status: "failed", differenceCount: 0 },
      }),
    });
  });
  await page.route("**/api/studio/sync-issue-posters", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/api/studio/publish-runs/*/retry-shadow", async (route) => {
    retryRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        shadow: { target: "supabase", status: "succeeded", changed: true },
        compare: { status: "matched", differenceCount: 0 },
        retryCount: 1,
      }),
    });
  });

  await page.goto("/studio");
  await page.getByLabel("后台密码").fill("000000");
  await page.getByRole("button", { name: "进入后台" }).click();
  await page.getByRole("button", { name: "内容编辑" }).click();
  await page.getByRole("button", { name: "发布当前期修改" }).click();

  await expect.poll(() => publishRequests).toBe(1);
  await expect(page.getByRole("status")).toHaveText(/影子同步失败/);
  await expect(page.getByText("主发布成功，影子链路需要处理")).toBeVisible();
  await page.getByRole("button", { name: "重试影子同步" }).click();
  await expect.poll(() => retryRequests).toBe(1);
  await expect(page.getByRole("status")).toHaveText("影子同步重试成功，内容一致");
  await expect(page.getByText("主发布与影子同步一致")).toBeVisible();
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
  await page.getByRole("button", { name: "内容编辑" }).click();

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
