import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const issueId = "10000000-0000-4000-8000-000000000003";
const publishedAt = "2026-06-15T00:00:00Z";

const stories = [
  {
    slug: "world-cup-global-stage",
    category: "sports",
    region: "North America",
    countryCodes: ["SE", "TN", "JP", "NL", "CI", "EC"],
    scoreTotal: 95,
    storyId: "world_cup_sweden_tunisia_2026",
    storyStatus: "new",
    informationIncrementScore: 100,
    zh: {
      categoryLabel: "世界杯",
      headlineFact: "瑞典 5:1 大胜突尼斯",
      headlineView: "真正的强势开局，不只拿三分，也重新划定小组格局",
      intro: "瑞典凭借阿亚里梅开二度，以及伊萨克、哲凯赖什等人的进球，以 5:1 击败突尼斯，暂时领跑 F 组。当天其他比赛中，日本两度落后仍以 2:2 逼平荷兰；科特迪瓦则在第 90 分钟绝杀厄瓜多尔，以 1:0 取得开门红。",
      xiaziQuote: "强队第一战，赢球是结果，立威才是战略。",
      doudouQuote: "5 个球不是热身，是先把气势踢满了。",
      footerTakeaway: "强势首战不仅拿到积分，也会改变整个小组的心理格局。",
    },
    en: {
      categoryLabel: "World Cup",
      headlineFact: "Sweden beat Tunisia 5-1",
      headlineView: "a truly strong start is not just about three points, but redrawing the group picture",
      intro: "Sweden opened with a 5-1 win over Tunisia as Yasin Ayari scored twice and Alexander Isak and Viktor Gyokeres also found the net. Elsewhere, Japan twice came from behind to draw 2-2 with the Netherlands, while Cote d'Ivoire beat Ecuador 1-0 with a 90th-minute winner.",
      xiaziQuote: "A big team's first win is not just about points. It is about setting the tone.",
      doudouQuote: "Five goals is not a warm-up. It is an opening statement.",
      footerTakeaway: "A dominant opener can reshape both the table and the psychology of a group.",
    },
    sources: [
      ["Sweden 5-1 Tunisia: World Cup 2026", "The Guardian", "https://www.theguardian.com/football/live/2026/jun/15/fifa-world-cup-2026-live-sweden-v-tunisia-updates-swe-vs-tun-group-f-match-score-latest", "publisher"],
      ["Netherlands vs Japan highlights", "FOX Sports", "https://www.foxsports.com/watch/fmc-y854dpm391bsi95a", "publisher"],
    ],
  },
  {
    slug: "energy-transition-grid",
    category: "international",
    region: "Middle East",
    countryCodes: ["US", "IR"],
    scoreTotal: 98,
    storyId: "us_iran_peace_framework_2026",
    storyStatus: "followup",
    followupDay: 2,
    informationIncrementScore: 100,
    isDeveloping: true,
    zh: {
      categoryLabel: "中东局势",
      headlineFact: "美国与伊朗达成初步和平框架",
      headlineView: "真正的和平，要从宣布走到签字，再从签字走到执行",
      intro: "美国与伊朗确认达成初步协议，内容涉及永久停火、结束战争以及重新开放霍尔木兹海峡，正式文件预计稍后签署。消息推动油价下跌、全球风险资产回升，但核问题、制裁、航运恢复以及地区各方能否保持克制，仍是协议落地的关键。",
      xiaziQuote: "和平最难的，不是宣布，而是兑现。",
      doudouQuote: "会开完了，真正的考题才刚开始。",
      footerTakeaway: "框架是重大转折，正式签署与执行才决定和平能走多远。",
    },
    en: {
      categoryLabel: "Middle East",
      headlineFact: "The U.S. and Iran reach an initial peace framework",
      headlineView: "real peace must move from announcement to signature, and from signature to execution",
      intro: "The United States and Iran confirmed an initial framework covering a permanent ceasefire, an end to the war and the reopening of the Strait of Hormuz, with formal documents expected later. Markets rallied, but nuclear issues, sanctions, shipping and regional restraint remain the decisive tests.",
      xiaziQuote: "Peace is hardest not at the moment of announcement, but at the moment of delivery.",
      doudouQuote: "The meeting may be over, but the real exam is just beginning.",
      footerTakeaway: "The framework is a major turn; signatures and implementation will determine its durability.",
    },
    sources: [
      ["Trump arrives at G7 summit after announcing a deal to end the Iran war", "Associated Press", "https://apnews.com/article/992fb57188610d04660fb342c53e639e", "wire"],
    ],
  },
  {
    slug: "culture-restoration-digital",
    category: "culture",
    region: "United Kingdom",
    countryCodes: ["GB"],
    scoreTotal: 91,
    storyId: "uk_under16_social_media_ban_2026",
    storyStatus: "new",
    informationIncrementScore: 100,
    zh: {
      categoryLabel: "互联网与未成年人",
      headlineFact: "英国宣布限制 16 岁以下使用主流社交媒体",
      headlineView: "保护未成年人，正从平台自律走向国家规则",
      intro: "英国宣布将对 16 岁以下用户使用 TikTok、Instagram、YouTube、Snapchat 等社交平台施加更严格限制，部分游戏、直播、陌生人私信和无限滚动功能也将受到监管。政策预计于明年春季前后实施，但年龄验证、规避手段和执行成本仍将面临现实考验。",
      xiaziQuote: "技术越快，边界越要提早想清楚。",
      doudouQuote: "刷屏很轻松，管住算法可没那么轻松。",
      footerTakeaway: "儿童网络安全正从家庭选择转向平台与国家共同负责。",
    },
    en: {
      categoryLabel: "Internet & Minors",
      headlineFact: "Britain will restrict major social platforms for under-16s",
      headlineView: "protecting minors is moving from platform self-discipline to national rules",
      intro: "Britain plans tighter restrictions for users under 16 across TikTok, Instagram, YouTube, Snapchat and other platforms, alongside controls on gaming, livestreaming, stranger messaging and infinite scrolling. Implementation is expected around next spring, while age checks and enforcement remain difficult.",
      xiaziQuote: "The faster technology moves, the earlier the boundary must be defined.",
      doudouQuote: "Scrolling is easy. Setting the rules never is.",
      footerTakeaway: "Child online safety is becoming a shared duty of families, platforms and the state.",
    },
    sources: [
      ["Social media to be banned for under-16s", "UK Government", "https://www.gov.uk/government/news/social-media-to-be-banned-for-under-16s-in-landmark-government-move-to-givekids-their-childhood-back", "official"],
    ],
  },
  {
    slug: "ai-governance-crossroads",
    category: "technology",
    region: "United States",
    countryCodes: ["US"],
    scoreTotal: 90,
    storyId: "xai_openai_trade_secret_case_2026",
    storyStatus: "new",
    informationIncrementScore: 100,
    zh: {
      categoryLabel: "AI 与法律",
      headlineFact: "法院驳回 xAI 对 OpenAI 的商业秘密诉讼",
      headlineView: "AI 竞争不只拼模型，也在重画人才与知识产权边界",
      intro: "美国联邦法官驳回 xAI 针对 OpenAI 提起的商业秘密诉讼，并认为 xAI 未能证明 OpenAI 诱导前员工窃取或披露机密。本案围绕人才流动、代码、模型研发资料和企业秘密展开，也说明 AI 巨头之间的竞争正从算力、产品和融资延伸到法庭。",
      xiaziQuote: "技术的边界，最终也要回到规则里。",
      doudouQuote: "模型在打架，律师也没闲着。",
      footerTakeaway: "人才流动和知识产权正在成为 AI 竞争的第二战场。",
    },
    en: {
      categoryLabel: "AI & Law",
      headlineFact: "A court dismisses xAI's trade secret case against OpenAI",
      headlineView: "the AI race is now also about talent and intellectual property boundaries",
      intro: "A U.S. federal judge dismissed xAI's trade secret lawsuit against OpenAI, finding that xAI had not shown OpenAI induced a former employee to steal or disclose confidential information. The dispute shows AI competition expanding from models and compute into talent mobility, data use and intellectual property.",
      xiaziQuote: "The boundaries of technology eventually have to return to the rules.",
      doudouQuote: "The models are fighting, and the lawyers are busy too.",
      footerTakeaway: "Talent and intellectual property are becoming a second front in the AI race.",
    },
    sources: [
      ["OpenAI wins dismissal of trade secret lawsuit by Elon Musk's xAI", "Reuters via The Straits Times", "https://www.straitstimes.com/business/openai-wins-dismissal-of-trade-secret-lawsuit-by-musks-xai", "wire"],
    ],
  },
  {
    slug: "trade-routes-rewired",
    category: "business",
    region: "United States",
    countryCodes: ["US"],
    scoreTotal: 94,
    storyId: "fox_acquires_roku_2026",
    storyStatus: "new",
    informationIncrementScore: 100,
    zh: {
      categoryLabel: "媒体与商业",
      headlineFact: "Fox 与 Roku 达成约 220 亿美元收购协议",
      headlineView: "流媒体下一战，争的不只是内容，更是入口、数据与分发权",
      intro: "Fox 宣布以现金加股票方式收购 Roku，交易估值约 220 亿美元，预计在获得监管批准后于 2027 年上半年完成。Roku 覆盖超过一亿户家庭，Fox 则拥有新闻、体育和直播内容，两者结合意味着传统媒体正在主动争夺智能电视入口和广告数据。",
      xiaziQuote: "内容决定吸引力，入口决定控制力。",
      doudouQuote: "看似买平台，本质是在买流量总闸门。",
      footerTakeaway: "流媒体竞争正在从内容库存升级为内容、入口与数据的闭环。",
    },
    en: {
      categoryLabel: "Media & Business",
      headlineFact: "Fox and Roku strike a $22 billion acquisition deal",
      headlineView: "the next streaming battle is about content, entry points, data and distribution",
      intro: "Fox agreed to acquire Roku in a cash-and-stock deal valued at about $22 billion, expected to close in the first half of 2027 after regulatory approval. Roku reaches more than 100 million households, while Fox brings news, sports and live programming to the combined platform.",
      xiaziQuote: "Content drives attraction; access determines control.",
      doudouQuote: "Buying a platform is really buying a traffic gate.",
      footerTakeaway: "Streaming competition is becoming a closed loop of content, access and user data.",
    },
    sources: [
      ["Fox Corporation to Acquire Roku, Inc.", "Fox Corporation", "https://www.foxcorporation.com/news/corp-press-releases/2026/fox-corporation-to-acquire-roku-inc/", "official"],
      ["Fox strikes $22bn deal for Roku to fuel streaming push", "Reuters via The Guardian", "https://www.theguardian.com/media/2026/jun/15/fox-roku-acquisition-deal", "wire"],
    ],
  },
  {
    slug: "space-economy-orbit",
    category: "technology",
    region: "Europe",
    countryCodes: ["US", "SE", "NL"],
    scoreTotal: 89,
    storyId: "tesla_fsd_europe_safety_data_2026",
    storyStatus: "new",
    informationIncrementScore: 100,
    isDeveloping: true,
    zh: {
      categoryLabel: "自动驾驶",
      headlineFact: "路透调查称特斯拉向欧洲监管机构提交具争议的 FSD 安全数据",
      headlineView: "自动驾驶想赢得许可，先要赢得数据可信度",
      intro: "路透调查称，特斯拉在争取 FSD 进入欧洲市场时，向瑞典和荷兰监管机构提供了自行发布的安全统计，一些独立交通安全研究者质疑其中的对比方法。自动驾驶不仅要在道路上证明能力，也必须让监管者相信其数据口径、公平性与可复核性。",
      xiaziQuote: "自动驾驶要先说服监管，再说服市场。",
      doudouQuote: "车会自己开，数据可不能自己说了算。",
      footerTakeaway: "自动驾驶审批既审技术，也审数据是否可信和可复核。",
    },
    en: {
      categoryLabel: "Autonomous Driving",
      headlineFact: "A Reuters investigation says Tesla submitted disputed FSD safety data to European regulators",
      headlineView: "autonomous driving must first win trust in its data",
      intro: "A Reuters investigation says Tesla presented self-published FSD safety statistics to regulators in Sweden and the Netherlands while seeking wider European approval. Independent traffic-safety researchers questioned the comparisons, putting data definitions, sampling and reproducibility alongside technical performance.",
      xiaziQuote: "Autonomous driving must convince regulators before it convinces the market.",
      doudouQuote: "Cars may drive themselves, but data cannot judge itself.",
      footerTakeaway: "Approval depends on credible and reviewable evidence as much as technical capability.",
    },
    sources: [
      ["Tesla presented misleading Full Self-Driving safety data to European regulators", "Electrek, citing Reuters", "https://electrek.co/2026/06/15/tesla-fsd-misleading-safety-data-european-regulators/", "publisher"],
    ],
  },
  {
    slug: "global-health-readiness",
    category: "international",
    region: "Europe",
    countryCodes: ["UA", "RU", "FR"],
    scoreTotal: 92,
    storyId: "zelenskiy_putin_g7_meeting_offer_2026",
    storyStatus: "new",
    informationIncrementScore: 100,
    isDeveloping: true,
    zh: {
      categoryLabel: "俄乌局势",
      headlineFact: "泽连斯基称曾提议在 G7 期间会见普京，俄方未予接受",
      headlineView: "和平窗口不缺提议，缺的是双方都愿意走进去",
      intro: "乌克兰总统泽连斯基表示，他曾提议在法国 G7 峰会期间与俄罗斯总统普京会面，并获得美国与法国方面支持，但俄方没有表现出会谈意愿。与此同时，乌克兰继续寻求防空系统和国际援助，说明外交接触与战场压力仍在同步推进。",
      xiaziQuote: "真正难的不是开口，而是双方都愿意坐下。",
      doudouQuote: "会面的门没锁，问题是谁肯一起推开。",
      footerTakeaway: "外交提议存在，但互信与实质行动仍是和平进程的门槛。",
    },
    en: {
      categoryLabel: "Russia-Ukraine",
      headlineFact: "Zelensky says he proposed meeting Putin during the G7, but Russia did not accept",
      headlineView: "peace windows lack two sides willing to walk through",
      intro: "Ukrainian President Volodymyr Zelensky said he proposed meeting Vladimir Putin during the G7 summit in France, with support from the United States and France, but Russia showed no willingness to talk. Ukraine is also seeking more air defenses and international aid as diplomacy and battlefield pressure continue in parallel.",
      xiaziQuote: "The hardest part is not opening the conversation. It is getting both sides to sit down.",
      doudouQuote: "The door to talks is not locked. The question is who will push it together.",
      footerTakeaway: "A proposal exists, but trust and substantive follow-through remain the real barriers.",
    },
    sources: [
      ["Ukraine's Zelenskiy says he offered to meet Putin at G7", "Reuters via Internazionale", "https://www.internazionale.it/ultime-notizie-reuters/2026/06/15/ukraine-s-zelenskiy-says-he-offered-to-meet-putin-at-g7", "wire"],
    ],
  },
  {
    slug: "ocean-treaty-action",
    category: "business",
    region: "Hong Kong",
    countryCodes: ["HK", "CN"],
    scoreTotal: 86,
    storyId: "hong_kong_first_five_year_plan_2026",
    storyStatus: "new",
    informationIncrementScore: 100,
    zh: {
      categoryLabel: "香港与经济治理",
      headlineFact: "香港启动首份五年规划公众咨询",
      headlineView: "自由市场城市正在引入更强的长期发展坐标",
      intro: "香港启动为期两个月的首份五年发展规划公众咨询，内容将衔接国家“十五五”规划，并涵盖金融、贸易、航运、北部都会区和大湾区融合等方向。它既希望为企业和个人提供更稳定的长期预期，也引发市场对政府规划与自由市场边界的讨论。",
      xiaziQuote: "短期繁看活力，长期竞争看方向。",
      doudouQuote: "市场讲效率，规划讲定力，两者未必冲突。",
      footerTakeaway: "香港正尝试在市场效率与长期发展坐标之间建立新平衡。",
    },
    en: {
      categoryLabel: "Hong Kong & Economic Governance",
      headlineFact: "Hong Kong launches public consultation on its first five-year plan",
      headlineView: "a free-market city is introducing a stronger long-term development compass",
      intro: "Hong Kong opened a two-month public consultation on its first five-year development plan, aligning with China's 15th Five-Year Plan and covering finance, trade, shipping, the Northern Metropolis and Greater Bay Area integration. The move seeks greater long-term certainty while reopening debate about planning and free markets.",
      xiaziQuote: "In the short term, prosperity shows vitality. In the long term, competitiveness needs direction.",
      doudouQuote: "Markets speak of efficiency, planning speaks of focus. The two do not have to clash.",
      footerTakeaway: "Hong Kong is testing a new balance between market efficiency and long-term direction.",
    },
    sources: [
      ["Hong Kong opens consultation on first 5-year plan", "Associated Press", "https://apnews.com/article/b978eafd937901d62d849207dc7c148e", "wire"],
    ],
  },
  {
    slug: "climate-adaptation-city",
    category: "technology",
    region: "North America",
    countryCodes: ["US", "CA", "CN"],
    scoreTotal: 91,
    storyId: "google_unc6508_research_intrusions_2026",
    storyStatus: "new",
    informationIncrementScore: 100,
    zh: {
      categoryLabel: "网络安全",
      headlineFact: "Google 称中国关联黑客长期渗透美加研究机构",
      headlineView: "科研竞争的前线，已经延伸到邮箱、数据库与登录凭证",
      intro: "Google 威胁情报团队称，一个被其编号为 UNC6508 的中国关联黑客组织，曾持续一年多入侵美国和加拿大的医学、学术及军事研究机构，目标涉及 AI、无人系统、公共卫生和印太军事战略。研究成果越有价值，围绕数据和人才的暗战就越激烈。",
      xiaziQuote: "知识越值钱，围绕它的暗战就越激烈。",
      doudouQuote: "实验室看起来安静，数据世界可一点都不安静。",
      footerTakeaway: "高价值科研机构必须把身份、邮件和数据库视为同一条安全防线。",
    },
    en: {
      categoryLabel: "Cybersecurity",
      headlineFact: "Google says Chinese-linked hackers infiltrated U.S. and Canadian research institutions",
      headlineView: "the front line now extends to inboxes, databases and login credentials",
      intro: "Google says UNC6508, a China-linked threat actor, spent more than a year inside U.S. and Canadian medical, academic and military research institutions. The collection targeted AI, uncrewed systems, public health and Indo-Pacific military strategy through compromised applications, credentials and email rules.",
      xiaziQuote: "The more valuable knowledge becomes, the fiercer the hidden war around it.",
      doudouQuote: "Labs may look quiet, but their data worlds are anything but.",
      footerTakeaway: "Research security now requires one defensive line across identity, email and databases.",
    },
    sources: [
      ["Public and Private Medical Community Targeted by China-Nexus Threat Actor", "Google Threat Intelligence Group", "https://cloud.google.com/blog/topics/threat-intelligence/prc-targets-us-medical-research", "official"],
      ["Chinese-linked hackers targeted U.S., Canadian research facilities", "Reuters via Internazionale", "https://www.internazionale.it/ultime-notizie-reuters/2026/06/15/chinese-linked-hackers-targeted-u-s-canadian-research-facilities-for-a-year-google-says", "wire"],
    ],
  },
];

function source(topicId, item, index) {
  const [title, publisher, url, sourceType] = item;
  return {
    id: `30000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    topicId,
    title,
    publisher,
    url,
    publishedAt,
    sourceType,
    sourceTier: 1,
    locale: "en-US",
    isPrimary: index % 10 === 1,
  };
}

const topics = stories.map((story, index) => {
  const rank = index + 1;
  const topicId = `20000000-0000-4000-8000-${String(rank).padStart(12, "0")}`;
  return {
    id: topicId,
    issueId,
    slug: story.slug,
    rank,
    category: story.category,
    region: story.region,
    countryCodes: story.countryCodes,
    eventTime: null,
    isDeveloping: story.isDeveloping ?? false,
    verificationStatus: "verified",
    scoreTotal: story.scoreTotal,
    storyId: story.storyId,
    storyStatus: story.storyStatus,
    followupDay: story.followupDay ?? 1,
    informationIncrementScore: story.informationIncrementScore,
    localizations: {
      "zh-CN": {
        ...story.zh,
        headlineFull: `${story.zh.headlineFact}；${story.zh.headlineView}。`,
      },
      "en-US": {
        ...story.en,
        headlineFull: `${story.en.headlineFact}; ${story.en.headlineView}.`,
      },
    },
    sources: story.sources.map((item, sourceIndex) => source(topicId, item, rank * 10 + sourceIndex + 1)),
  };
});

const issue = {
  id: issueId,
  slug: "2026-06-16",
  assetVersion: `2026-06-16-user-${Date.now()}`,
  issueDate: "2026-06-16",
  slotHour: 0,
  beijingTimestamp: "2026-06-16T00:05:00+08:00",
  gmtTimestamp: "2026-06-15T16:05:00Z",
  status: "published",
  featuredTopicId: topics[0].id,
  topics,
};

const storyPoolPath = path.join(root, "data/story-pool.json");
const storyPool = JSON.parse(await readFile(storyPoolPath, "utf8"));
const replacedStoryIds = new Set([
  "salesforce_acquires_fin_2026",
  "imf_global_economy_war_shock_2026",
  "nih_oriva_human_research_2026",
  "global_mycorrhizal_network_map_2026",
  "drc_uganda_ebola_bundibugyo_2026",
]);
storyPool.stories = storyPool.stories
  .filter((item) => !replacedStoryIds.has(item.storyId))
  .map((item) => {
    const replacement = stories.find((story) => story.storyId === item.storyId);
    if (!replacement) return item;
    return {
      ...item,
      status: replacement.storyStatus,
      lastSeen: "2026-06-16",
      followupDay: replacement.followupDay ?? 1,
      informationIncrementScore: replacement.informationIncrementScore,
      latestHeadline: replacement.zh.headlineFact,
    };
  });
for (const story of stories) {
  if (storyPool.stories.some((item) => item.storyId === story.storyId)) continue;
  storyPool.stories.push({
    storyId: story.storyId,
    status: story.storyStatus,
    firstSeen: "2026-06-16",
    lastSeen: "2026-06-16",
    followupDay: story.followupDay ?? 1,
    informationIncrementScore: story.informationIncrementScore,
    latestHeadline: story.zh.headlineFact,
  });
}
storyPool.updatedAt = new Date().toISOString();

await Promise.all([
  writeFile(path.join(root, "data/current-issue.json"), `${JSON.stringify(issue, null, 2)}\n`),
  writeFile(path.join(root, "data/archive/2026-06-16.json"), `${JSON.stringify(issue, null, 2)}\n`),
  writeFile(path.join(root, "src/data/current-issue.json"), `${JSON.stringify(issue, null, 2)}\n`),
  writeFile(storyPoolPath, `${JSON.stringify(storyPool, null, 2)}\n`),
]);

console.log(JSON.stringify({
  issueDate: issue.issueDate,
  topics: issue.topics.length,
  newStories: issue.topics.filter((topic) => topic.storyStatus === "new").length,
  followups: issue.topics.filter((topic) => topic.storyStatus === "followup").length,
}, null, 2));
