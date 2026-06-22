import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const issueDate = "2026-06-15";

const topics = [
  {
    slug: "world-cup-global-stage",
    file: "world-cup",
    category: "sports",
    region: "North America",
    countries: ["HT", "GB"],
    score: 94,
    scores: [27, 20, 17, 15, 15],
    zh: {
      label: "世界杯",
      fact: "苏格兰 1:0 击败海地",
      view: "等待 36 年的胜利，提醒世界足球从不缺少迟到的故事",
      intro: "苏格兰凭借约翰·麦金的进球以 1:0 战胜海地，取得自 1990 年以来首场世界杯胜利。比分并不夸张，意义却足够沉重：漫长缺席、几代球迷的等待和一场艰难零封，都让这次回归成为世界杯最有人情味的开场之一。",
      xiazi: "真正珍贵的胜利，往往背着很长的时间。",
      doudou: "等了 36 年，庆祝久一点不过分。",
      takeaway: "世界杯记录比分，也替一代人偿还等待。",
    },
    en: {
      label: "World Cup",
      fact: "Scotland beat Haiti 1-0",
      view: "a victory 36 years in the making proves football never runs out of late stories",
      intro: "John McGinn's goal gave Scotland a 1-0 win over Haiti and their first World Cup victory since 1990. The score was narrow, but the meaning was enormous: decades away, generations of waiting and a hard-earned clean sheet turned this return into one of the tournament's most human opening chapters.",
      xiazi: "The most valuable victories often carry the longest history.",
      doudou: "After waiting 36 years, celebrate for more than 90 minutes.",
      takeaway: "The World Cup records scores and repays generations of waiting.",
    },
    source: ["Scotland v Haiti result", "FIFA", "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/scores-fixtures"],
  },
  {
    slug: "ai-governance-crossroads",
    file: "ai-governance",
    category: "technology",
    region: "Global",
    countries: ["US"],
    score: 96,
    scores: [30, 19, 20, 14, 13],
    zh: {
      label: "AI 与科技",
      fact: "Anthropic 暂停外国用户访问 Fable 5 与 Mythos 5",
      view: "最强模型越接近基础设施，使用权就越像地缘政治",
      intro: "Anthropic 表示，美国政府以国家安全为由要求暂停所有外国公民访问 Fable 5 与 Mythos 5，公司因此突然关闭相关服务。事件说明前沿 AI 已不只是产品竞争：模型能力、出口管制、人员身份和跨境服务正在被同一套权力逻辑重新划线。",
      xiazi: "技术越像基础设施，边界就越由制度决定。",
      doudou: "AI 越来越聪明，人类越来越看不懂使用条款。",
      takeaway: "前沿模型的竞争，已经进入技术与主权交叉地带。",
    },
    en: {
      label: "AI & Technology",
      fact: "Anthropic suspends foreign access to Fable 5 and Mythos 5",
      view: "the closer frontier models get to infrastructure, the more access resembles geopolitics",
      intro: "Anthropic says a U.S. national-security directive forced it to suspend access to Fable 5 and Mythos 5 for all foreign nationals. The episode shows that frontier AI is no longer only a product race: capability, export controls, identity and cross-border service are being redrawn by the same political logic.",
      xiazi: "As technology becomes infrastructure, institutions decide its borders.",
      doudou: "AI gets smarter while the terms of service become unreadable.",
      takeaway: "Frontier AI now sits where technology and sovereignty collide.",
    },
    source: ["Statement on access suspension", "Anthropic", "https://www.anthropic.com/news/fable-mythos-access"],
  },
  {
    slug: "trade-routes-rewired",
    file: "supply-chain",
    category: "business",
    region: "United States",
    countries: ["US"],
    score: 95,
    scores: [29, 20, 20, 13, 13],
    zh: {
      label: "商业与资本",
      fact: "OpenAI 秘密提交 IPO 注册草案",
      view: "AI 的估值神话，终于要接受公开市场的审问",
      intro: "OpenAI 宣布已向美国证监会秘密提交 S-1 注册草案，为潜在上市迈出正式一步。公开市场不仅会衡量模型能力，也会追问收入、算力成本、治理结构和长期现金流。AI 可以制造宏大想象，但上市会把所有想象翻译成可核验的数字。",
      xiazi: "资本市场的价值，是把愿景放进统一坐标系。",
      doudou: "模型会推理，估值也得会。",
      takeaway: "AI 巨头从实验室走向公开市场，透明度将成为新能力。",
    },
    en: {
      label: "Business & Capital",
      fact: "OpenAI confidentially submits a draft S-1",
      view: "AI's valuation story is finally heading for a public-market examination",
      intro: "OpenAI has confidentially submitted a draft S-1 registration statement to the U.S. SEC, taking a formal step toward a possible listing. Public markets will test more than model quality: revenue, compute costs, governance and durable cash flow will all face scrutiny. Imagination now needs auditable numbers.",
      xiazi: "Markets place grand visions inside a common coordinate system.",
      doudou: "The model can reason. The valuation had better learn.",
      takeaway: "As AI labs approach public markets, transparency becomes a capability.",
    },
    source: ["Confidential submission of draft S-1", "OpenAI", "https://openai.com/index/openai-submits-confidential-s-1/"],
  },
  {
    slug: "energy-transition-grid",
    file: "clean-energy",
    category: "international",
    region: "Europe",
    countries: ["FR"],
    score: 91,
    scores: [29, 18, 19, 13, 12],
    zh: {
      label: "国际政治",
      fact: "G7 埃维昂峰会今日开幕",
      view: "桌上谈合作，桌下仍在计算战争、能源与技术筹码",
      intro: "法国于 6 月 15 日至 17 日在埃维昂主持 G7 峰会，乌克兰、中东、全球失衡、人工智能与经济安全将成为核心议题。多边会议的真正价值不在合影和公报，而在成员能否把不同的国内压力交换成可执行的共同动作。",
      xiazi: "峰会的含金量，要看共识能否穿过各国边界。",
      doudou: "合影站位很整齐，利益从来不排队。",
      takeaway: "全球合作最难的不是表达一致，而是承担成本。",
    },
    en: {
      label: "International Politics",
      fact: "The G7 Evian summit opens today",
      view: "cooperation is on the table while war, energy and technology remain the leverage underneath",
      intro: "France hosts G7 leaders in Evian from June 15 to 17, with Ukraine, the Middle East, global imbalances, AI and economic security high on the agenda. The summit's value will not be measured by photographs or communiqués, but by whether different domestic pressures can become executable joint action.",
      xiazi: "A summit matters when consensus can cross national borders.",
      doudou: "The photo line is orderly. Interests never are.",
      takeaway: "The hardest part of cooperation is agreeing who pays its cost.",
    },
    source: ["G7 summit, Evian, 15-17 June 2026", "European Council", "https://www.consilium.europa.eu/en/meetings/international-summit/2026/06/15-17/"],
  },
  {
    slug: "global-health-readiness",
    file: "public-health",
    category: "business",
    region: "Global",
    countries: [],
    score: 93,
    scores: [30, 17, 20, 15, 11],
    zh: {
      label: "全球经济",
      fact: "世界银行将 2026 年全球增速预期下调至 2.5%",
      view: "战争推高的不只是油价，也在压缩普通人的未来空间",
      intro: "世界银行预计 2026 年全球经济增长放缓至 2.5%，低于 2025 年的 2.9%，并下调约三分之二经济体的预测。中东冲突带来的能源价格、通胀与融资压力正在层层传导，最终会进入就业、利率、商品价格和家庭预算。",
      xiazi: "宏观数字的终点，总是每个人的现金流。",
      doudou: "增长少零点几，账单可不只多零点几。",
      takeaway: "低增长与高不确定性，正在成为全球经济的新常态。",
    },
    en: {
      label: "Global Economy",
      fact: "The World Bank cuts 2026 global growth to 2.5%",
      view: "war raises more than oil prices; it narrows the future available to ordinary people",
      intro: "The World Bank expects global growth to slow to 2.5% in 2026 from 2.9% in 2025 and has downgraded forecasts for roughly two-thirds of economies. Energy costs, inflation and financing pressure from the Middle East conflict will ultimately reach jobs, interest rates, prices and household budgets.",
      xiazi: "Macroeconomic numbers always end in personal cash flow.",
      doudou: "Growth loses a decimal. Your bills rarely stop there.",
      takeaway: "Low growth and high uncertainty are becoming the global baseline.",
    },
    source: ["Global Economic Prospects, June 2026", "World Bank", "https://www.worldbank.org/en/news/press-release/2026/06/11/global-economic-prospects-june-2026-press-release"],
  },
  {
    slug: "space-economy-orbit",
    file: "space-orbit",
    category: "science",
    region: "Moon",
    countries: ["US", "IT"],
    score: 89,
    scores: [26, 16, 20, 13, 14],
    zh: {
      label: "科学与航天",
      fact: "NASA 公布 Artemis III 载人登月任务成员",
      view: "重返月球不只是一次飞行，而是在重建深空时代的组织能力",
      intro: "NASA 公布计划于 2027 年执行的 Artemis III 任务成员，登月计划由硬件阶段进一步进入人员与任务整合阶段。真正困难的不只是把人送上月面，而是把火箭、飞船、着陆器、国际伙伴与长期科研目标组织成可重复的深空能力。",
      xiazi: "伟大探索的背后，是把复杂系统变成可靠协作。",
      doudou: "月球很远，项目管理更远。",
      takeaway: "登月不是终点，而是深空基础设施的第一次压力测试。",
    },
    en: {
      label: "Science & Space",
      fact: "NASA names the Artemis III crew",
      view: "returning to the Moon is not one flight but a rebuilding of deep-space capability",
      intro: "NASA has named the crew for Artemis III, planned for 2027, moving the lunar program further from hardware development into integrated mission execution. The challenge is not only reaching the surface, but coordinating rockets, spacecraft, landers, international partners and science into repeatable deep-space capability.",
      xiazi: "Great exploration turns complex systems into reliable cooperation.",
      doudou: "The Moon is far. Project management may be farther.",
      takeaway: "A lunar landing is the first stress test for deep-space infrastructure.",
    },
    source: ["NASA names Artemis III crew", "NASA", "https://www.nasa.gov/news-release/nasa-marches-toward-artemis-iii-mission-in-2027-names-crew-members/"],
  },
  {
    slug: "culture-restoration-digital",
    file: "cultural-heritage",
    category: "culture",
    region: "Europe",
    countries: ["AT", "BE", "NL", "PL"],
    score: 84,
    scores: [23, 17, 17, 15, 12],
    zh: {
      label: "社会与文化",
      fact: "TikTok Shop 今日扩展至四个欧洲市场",
      view: "内容平台不再满足于影响审美，而要直接接管购买决定",
      intro: "TikTok Shop 从 6 月 15 日起进入奥地利、比利时、荷兰和波兰，继续扩大欧洲版图。短视频平台正在把观看、种草、信任和支付压缩进同一条链路。文化传播与商业转化之间的距离越短，创作者的影响力就越接近新的零售基础设施。",
      xiazi: "注意力的终点，正在从观点变成交易。",
      doudou: "以前刷完忘了，现在刷完下单。",
      takeaway: "内容电商正在重写欧洲消费者的发现路径。",
    },
    en: {
      label: "Society & Culture",
      fact: "TikTok Shop expands into four European markets today",
      view: "content platforms no longer want to shape taste alone; they want to own the purchase decision",
      intro: "TikTok Shop launches in Austria, Belgium, the Netherlands and Poland on June 15, extending its European footprint. Video platforms are compressing discovery, trust and payment into one journey. As culture and conversion move closer together, creator influence starts to resemble retail infrastructure.",
      xiazi: "The endpoint of attention is shifting from opinion to transaction.",
      doudou: "You used to forget after scrolling. Now you check out.",
      takeaway: "Content commerce is rewriting how European consumers discover products.",
    },
    source: ["TikTok Shop expands across Europe", "TikTok", "https://newsroom.tiktok.com/tiktok-shop-expands-across-europe?lang=en-150"],
  },
  {
    slug: "ocean-treaty-action",
    file: "high-seas",
    category: "climate",
    region: "Global Ocean",
    countries: [],
    score: 90,
    scores: [29, 15, 20, 14, 12],
    zh: {
      label: "环境与气候",
      fact: "联合国世界海洋评估再次发出警报",
      view: "海洋不是遥远风景，而是全球经济与生命系统的底盘",
      intro: "联合国最新世界海洋评估指出，气候变化、过度捕捞、污染与生物多样性下降正在让海洋承受持续加速的压力。海洋调节气候、提供食物并支撑亿万人生计，它的退化会通过天气、供应链、公共健康和食品价格回到每个人身边。",
      xiazi: "保护海洋，就是维护地球最庞大的公共基础设施。",
      doudou: "看不见海底，不代表账单不会浮上来。",
      takeaway: "共同海洋需要共同承担责任，也需要更快行动。",
    },
    en: {
      label: "Environment & Climate",
      fact: "The UN World Ocean Assessment issues another warning",
      view: "the ocean is not distant scenery but the operating system beneath life and the global economy",
      intro: "The UN's latest World Ocean Assessment says climate change, overfishing, pollution and biodiversity loss are accelerating pressure on the ocean. It regulates climate, supplies food and supports billions of livelihoods. Its decline returns through weather, supply chains, public health and food prices.",
      xiazi: "Protecting the ocean means maintaining Earth's largest public infrastructure.",
      doudou: "You may not see the seabed. The bill still floats up.",
      takeaway: "A shared ocean demands shared responsibility and faster action.",
    },
    source: ["Third World Ocean Assessment", "United Nations", "https://www.un.org/sustainabledevelopment/blog/2026/06/press-release-as-ocean-pressures-mount-united-nations-report-calls-for-urgent-global-collaboration-to-protect-marine-ecosystems/"],
  },
  {
    slug: "climate-adaptation-city",
    file: "climate-adaptation",
    category: "technology",
    region: "Global",
    countries: ["US"],
    score: 88,
    scores: [25, 17, 20, 14, 12],
    zh: {
      label: "编辑精选",
      fact: "OpenAI 宣布收购云端开发环境公司 Ona",
      view: "AI Agent 的下一场竞争，不是更会聊天，而是能否持续把事做完",
      intro: "OpenAI 计划收购 Ona，为 Codex 引入安全、持久、可由企业控制的云端工作环境。AI Agent 正从一次性回答走向长期执行：它需要记住上下文、连接工具、跨越多个工作阶段并承担结果。真正的机会不是再造聊天框，而是重做工作流。",
      xiazi: "智能的价值，不在回答多少，而在完成多少。",
      doudou: "别再问 AI 会不会，先看它能不能交作业。",
      takeaway: "持久化工作环境可能成为 Agent 时代的新操作系统。",
    },
    en: {
      label: "Editor's Pick",
      fact: "OpenAI plans to acquire cloud-environment company Ona",
      view: "the next agent race is not about better chat but sustained completion",
      intro: "OpenAI plans to acquire Ona, bringing secure, persistent and customer-controlled cloud environments to Codex. Agents are moving from one-off answers to long-running execution: they need context, tools, multiple work stages and accountability for outcomes. The opportunity is not another chat box, but rebuilt workflows.",
      xiazi: "Intelligence is measured by what it completes, not how much it answers.",
      doudou: "Stop asking whether AI can. Check whether it submits the work.",
      takeaway: "Persistent environments may become the operating system of the agent era.",
    },
    source: ["OpenAI to acquire Ona", "OpenAI", "https://openai.com/index/openai-to-acquire-ona/"],
  },
];

function uuid(group, index) {
  return `${group}0000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

const issueId = uuid("1", 2);
const storyPool = {
  updatedAt: `${issueDate}T05:00:00+08:00`,
  stories: topics.map((topic) => ({
    storyId: topic.slug.replaceAll("-", "_"),
    status: "new",
    firstSeen: issueDate,
    lastSeen: issueDate,
    followupDay: 1,
    latestHeadline: topic.zh.fact,
  })),
};
const issue = {
  id: issueId,
  slug: issueDate,
  issueDate,
  slotHour: 5,
  beijingTimestamp: `${issueDate}T05:00:00+08:00`,
  gmtTimestamp: "2026-06-14T21:00:00Z",
  status: "published",
  featuredTopicId: uuid("2", 1),
  topics: topics.map((topic, index) => ({
    id: uuid("2", index + 1),
    issueId,
    slug: topic.slug,
    rank: index + 1,
    category: topic.category,
    region: topic.region,
    countryCodes: topic.countries,
    eventTime: null,
    isDeveloping: index !== 0,
    verificationStatus: "verified",
    scoreTotal: topic.score,
    storyId: topic.slug.replaceAll("-", "_"),
    storyStatus: "new",
    followupDay: 1,
    informationIncrementScore: 100,
    localizations: {
      "zh-CN": {
        categoryLabel: topic.zh.label,
        headlineFact: topic.zh.fact,
        headlineView: topic.zh.view,
        headlineFull: `${topic.zh.fact}；${topic.zh.view}`,
        intro: topic.zh.intro,
        xiaziQuote: topic.zh.xiazi,
        doudouQuote: topic.zh.doudou,
        footerTakeaway: topic.zh.takeaway,
      },
      "en-US": {
        categoryLabel: topic.en.label,
        headlineFact: topic.en.fact,
        headlineView: topic.en.view,
        headlineFull: `${topic.en.fact}; ${topic.en.view}`,
        intro: topic.en.intro,
        xiaziQuote: topic.en.xiazi,
        doudouQuote: topic.en.doudou,
        footerTakeaway: topic.en.takeaway,
      },
    },
    sources: [{
      id: uuid("3", index + 1),
      topicId: uuid("2", index + 1),
      title: topic.source[0],
      publisher: topic.source[1],
      url: topic.source[2],
      publishedAt: null,
      sourceType: "official",
      sourceTier: 1,
      locale: "en-US",
      isPrimary: true,
    }],
  })),
};

function escapeXml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[char]);
}

function textUnits(value) {
  return [...value].reduce((total, char) => {
    if (/[\u3400-\u9fff]/.test(char)) return total + 1;
    if (/[A-Z0-9]/.test(char)) return total + 0.65;
    if (/\s/.test(char)) return total + 0.3;
    return total + 0.52;
  }, 0);
}

function wrap(value, maxUnits, maxLines) {
  const isCjk = /[\u3400-\u9fff]/.test(value);
  const words = isCjk ? [...value] : value.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = isCjk ? `${line}${word}` : `${line}${line ? " " : ""}${word}`;
    if (textUnits(candidate) > maxUnits && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) {
        const remaining = words.slice(words.indexOf(word) + 1).join(isCjk ? "" : " ");
        if (remaining) line += isCjk ? "…" : "…";
        break;
      }
    } else {
      line = candidate;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function textLines(lines, x, y, size, lineHeight, anchor = "start", weight = 700) {
  return lines.map((line, index) =>
    `<text x="${x}" y="${y + index * lineHeight}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`,
  ).join("");
}

function posterSvg(topic, locale, index) {
  const content = locale === "zh" ? topic.zh : topic.en;
  const storyStatus = topic.storyStatus ?? "new";
  const fact = wrap(content.fact, locale === "zh" ? 12 : 13, 4);
  const view = wrap(content.view, locale === "zh" ? 18 : 24, 3);
  const intro = wrap(content.intro, locale === "zh" ? 29 : 42, 5);
  const xiaziQuote = wrap(content.xiazi, locale === "zh" ? 15 : 19, 3);
  const doudouQuote = wrap(content.doudou, locale === "zh" ? 15 : 19, 3);
  const takeaway = wrap(content.takeaway, locale === "zh" ? 20 : 30, 2);
  const palette = [
    ["#06121f", "#0b3150", "#f3b566"],
    ["#120c20", "#34205d", "#fb8a58"],
    ["#11151c", "#283b50", "#e7bc79"],
    ["#101929", "#263e64", "#e3623d"],
    ["#1d1010", "#563125", "#f1c27b"],
    ["#06151e", "#16465d", "#f19b54"],
    ["#25120f", "#6a3326", "#f4c67b"],
    ["#031a22", "#075264", "#ecb55f"],
    ["#13111d", "#3a3157", "#f09962"],
  ][index];
  return Buffer.from(`
  <svg width="1024" height="2048" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${palette[0]}"/>
        <stop offset=".55" stop-color="${palette[1]}"/>
        <stop offset="1" stop-color="#02070d"/>
      </linearGradient>
      <radialGradient id="glow"><stop stop-color="${palette[2]}" stop-opacity=".34"/><stop offset="1" stop-color="${palette[2]}" stop-opacity="0"/></radialGradient>
      <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#fff" stroke-opacity=".055"/></pattern>
    </defs>
    <rect width="1024" height="2048" fill="url(#bg)"/>
    <rect width="1024" height="2048" fill="url(#grid)"/>
    <circle cx="790" cy="500" r="470" fill="url(#glow)"/>
    <rect x="46" y="46" width="932" height="1956" rx="18" fill="none" stroke="${palette[2]}" stroke-opacity=".7" stroke-width="2"/>
    <rect x="70" y="72" width="884" height="72" rx="10" fill="#05090f" fill-opacity=".78" stroke="${palette[2]}" stroke-opacity=".7"/>
    <g fill="#fff" font-family="${locale === "zh" ? "PingFang SC, Noto Sans CJK SC, sans-serif" : "Arial, sans-serif"}">
      <text x="100" y="119" font-size="25" font-weight="800" letter-spacing="2">${locale === "zh" ? "虾子曰全球热点海报" : "XIAZI GLOBAL HOT TOPICS"}</text>
      <text x="924" y="119" text-anchor="end" font-size="20" fill="${palette[2]}">${issueDate} · NO.${String(index + 1).padStart(2, "0")}</text>
      <text x="76" y="210" font-size="23" font-weight="800" fill="${palette[2]}" letter-spacing="3">${escapeXml(content.label.toUpperCase())}</text>
      ${storyStatus === "followup" ? `<text x="948" y="210" text-anchor="end" font-size="22" font-weight="900" fill="${palette[2]}">${locale === "zh" ? `事件追踪 · DAY ${topic.followupDay}` : `FOLLOW-UP · DAY ${topic.followupDay}`}</text>` : ""}
      ${textLines(fact, 512, 310, locale === "zh" ? 68 : 52, 70, "middle", 900)}
      <line x1="172" y1="610" x2="852" y2="610" stroke="${palette[2]}" stroke-width="3"/>
      ${textLines(view, 512, 684, locale === "zh" ? 33 : 29, 46, "middle", 700)}
      <rect x="82" y="845" width="860" height="290" rx="24" fill="#03070c" fill-opacity=".66" stroke="#fff" stroke-opacity=".14"/>
      ${textLines(intro, 118, 910, locale === "zh" ? 24 : 22, 44, "start", 400)}
      <rect x="72" y="1200" width="430" height="180" rx="24" fill="#f5e6cc"/>
      <text x="106" y="1245" font-size="24" font-weight="900" fill="#a43b27">${locale === "zh" ? "虾子曰" : "SHRIMP LEO"}</text>
      <g fill="#241b17">${textLines(xiaziQuote, 106, 1293, locale === "zh" ? 23 : 20, 34, "start", 700)}</g>
      <rect x="522" y="1200" width="430" height="180" rx="24" fill="#f5e6cc"/>
      <text x="556" y="1245" font-size="24" font-weight="900" fill="#126a70">${locale === "zh" ? "豆豆龙" : "BEAN DRAGON"}</text>
      <g fill="#241b17">${textLines(doudouQuote, 556, 1293, locale === "zh" ? 23 : 20, 34, "start", 700)}</g>
      <g fill="${palette[2]}">${textLines(takeaway, 512, 1800, locale === "zh" ? 37 : 31, 45, "middle", 900)}</g>
      <text x="512" y="1938" text-anchor="middle" font-size="22" letter-spacing="5" fill="#fff" fill-opacity=".7">VILESAINT.COM</text>
    </g>
  </svg>`);
}

async function renderPoster(topic, locale, index) {
  const posterDir = path.join(root, "public/posters", locale);
  const thumbDir = path.join(root, "public/posters/thumb", locale);
  await Promise.all([mkdir(posterDir, { recursive: true }), mkdir(thumbDir, { recursive: true })]);
  const [xiazi, doudou, logo] = await Promise.all([
    sharp(path.join(root, "public/brand/characters/xiazi/xiazi-master-front.webp")).resize(340, 340, { fit: "contain" }).png().toBuffer(),
    sharp(path.join(root, "public/brand/characters/doudou/doudou-master-front.webp")).resize(310, 310, { fit: "contain" }).png().toBuffer(),
    sharp(path.join(root, "public/brand/logo/xiazi-global-hot-topics.webp")).resize(150, 150, { fit: "contain" }).png().toBuffer(),
  ]);
  const output = path.join(posterDir, `${topic.file}.png`);
  await sharp(posterSvg(topic, locale, index))
    .composite([
      { input: logo, left: 437, top: 1510 },
      { input: xiazi, left: 115, top: 1395 },
      { input: doudou, left: 605, top: 1415 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(output);
  await sharp(output)
    .resize({ width: 480 })
    .webp({ quality: 72, effort: 5 })
    .toFile(path.join(thumbDir, `${topic.file}.webp`));
}

await writeFile(path.join(root, "src/data/current-issue.json"), `${JSON.stringify(issue, null, 2)}\n`);
await writeFile(path.join(root, "data/story-pool.json"), `${JSON.stringify(storyPool, null, 2)}\n`);
await Promise.all(topics.flatMap((topic, index) => [
  renderPoster(topic, "zh", index),
  renderPoster(topic, "en", index),
]));

const report = [
  `# 虾子曰每日选题评分｜${issueDate}`,
  "",
  "| # | 九宫格 | 选题 | 状态 | 信息增量 | 全球影响 | 热度 | 未来影响 | 普通人关系 | 视觉 | 总分 |",
  "|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|",
  ...topics.map((topic, index) =>
    `| ${index + 1} | ${topic.zh.label} | ${topic.zh.fact} | New | 100 | ${topic.scores.join(" | ")} | ${topic.score} |`,
  ),
  "",
  "本期 9 条全部为 New，无重复跟进；所有入选事实均使用官方来源核验；世界杯内容固定第一。",
].join("\n");
await mkdir(path.join(root, "docs/daily"), { recursive: true });
await writeFile(path.join(root, `docs/daily/${issueDate}.md`), `${report}\n`);

console.log(`Produced ${topics.length} topics and ${topics.length * 2} posters for ${issueDate}.`);
