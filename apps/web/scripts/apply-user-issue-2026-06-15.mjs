import { readFile, writeFile } from "node:fs/promises";

const issuePath = new URL("../src/data/current-issue.json", import.meta.url);
const storyPoolPath = new URL("../data/story-pool.json", import.meta.url);
const issue = JSON.parse(await readFile(issuePath, "utf8"));

const content = [
  {
    slug: "world-cup-global-stage",
    category: "sports",
    region: "North America",
    countryCodes: ["DE", "CW"],
    status: "new",
    increment: 100,
    score: 96,
    zh: ["世界杯", "德国7:1大胜库拉索", "强队的第一场，不只要赢，更要建立威慑", "德国在世界杯小组赛首战中以7:1击败首次参赛的库拉索，哈弗茨梅开二度，多名球员取得进球。库拉索虽然遭遇大比分失利，但也攻入队史首粒世界杯进球。德国展示了进攻厚度，也提前向其他争冠球队发出了强烈信号。", "强队第一战，赢球是结果，立威才是战略。", "七个球不是热身，这是先把气势拉满了。"],
    en: ["World Cup", "Germany beat Curaçao 7–1", "opening matches are not only for winning, but for sending a warning", "Germany opened its World Cup campaign with a commanding 7–1 victory over debutants Curaçao. Kai Havertz scored twice, while several German players found the net. Curaçao suffered a heavy defeat but still celebrated the first World Cup goal in the nation’s history. Germany demonstrated depth, efficiency and attacking power, sending an early message to its title rivals.", "Great teams do not merely collect points. They establish pressure.", "Seven goals in game one? That is not a warm-up. That is a warning."],
    source: ["Germany’s 7–1 win over Curaçao", "Reuters", "https://www.reuters.com/sports/soccer/germany-crush-debutants-curacao-7-1-world-cup-group-e-opener-2026-06-14/"],
  },
  {
    slug: "energy-transition-grid",
    category: "international",
    region: "Europe",
    countryCodes: ["FR"],
    status: "followup",
    increment: 70,
    score: 91,
    zh: ["G7峰会", "G7埃维昂峰会将于今日开幕", "议题越来越多，共识却越来越昂贵", "G7领导人将于6月15日至17日在法国埃维昂举行峰会，乌克兰、中东、贸易、经济安全、关键矿产和AI治理预计成为重点议题。峰会前夕，附近地区已经出现抗议活动。会议讨论的问题越来越多，但主要国家达成真正共识的难度也在不断提高。", "峰会真正稀缺的，不是议题，而是共识。", "会议桌越来越大，大家能同意的事情却越来越少。"],
    en: ["G7 Summit", "The G7 summit opens in Évian today", "the broader the agenda, the more expensive consensus becomes", "G7 leaders are gathering in Évian, France, from June 15 to 17. Ukraine, the Middle East, trade, economic security, critical minerals and AI governance are expected to dominate the agenda. Protests have already taken place nearby. The summit reflects a difficult reality: the list of global problems continues to grow, while meaningful agreement among major powers becomes harder to achieve.", "What global summits lack most is not an agenda, but consensus.", "The table keeps getting bigger, while the list of shared answers keeps getting smaller."],
    source: ["2026 G7 Summit of Évian", "Élysée Palace", "https://www.elysee.fr/en/G7evian"],
  },
  {
    slug: "trade-routes-rewired",
    category: "international",
    region: "Middle East",
    countryCodes: ["IR", "IL", "LB", "US"],
    status: "new",
    increment: 100,
    score: 95,
    zh: ["中东局势", "美国称伊朗协议接近达成，以色列却空袭贝鲁特", "和平最怕下一声爆炸", "美国方面表示，与伊朗达成协议的距离正在缩小，但以色列随后对贝鲁特的真主党目标发动空袭。外交谈判与军事行动同时推进，让本已脆弱的和平窗口变得更加不确定。越接近协议，各方越需要防止一次意外行动让局势重新失控。", "真正脆弱的，从来不是谈判桌，而是桌外的火光。", "都说快谈成了，结果下一秒又像要谈崩。"],
    en: ["Middle East", "Washington says an Iran deal is close as Israel strikes Beirut", "peace is always one explosion away from collapse", "The United States says an agreement with Iran is drawing closer, but an Israeli strike on Hezbollah targets in Beirut has again raised regional tensions. Diplomacy and military action are moving forward at the same time, making the window for peace increasingly fragile. The closer the parties move toward an agreement, the more important it becomes to prevent one incident from restarting a wider conflict.", "Diplomacy remains fragile when missiles are still speaking.", "Everyone says the deal is close, and then the sky explodes again."],
    source: ["Iran negotiations and the Beirut strike", "Reuters", "https://www.reuters.com/world/asia-pacific/us-iran-inch-closer-deal-timing-remains-unclear-2026-06-14/"],
  },
  {
    slug: "global-health-readiness",
    category: "science",
    region: "Africa",
    countryCodes: ["CD", "UG"],
    status: "new",
    increment: 100,
    score: 94,
    zh: ["全球健康", "刚果（金）通报782例埃博拉确诊病例", "疫情真正危险的，是传播速度超过响应速度", "刚果（金）卫生部门通报，埃博拉确诊病例已升至782例，并有新的卫生区受到影响。疫情发生地区同时面临人口流动、基础设施不足和安全局势复杂等问题。病例数量固然重要，但更值得警惕的是，监测、隔离与医疗响应能否追上传播速度。", "疫情之中，时间不是细节，而是战场。", "病毒不等开会，响应慢一步，就可能多扩一圈。"],
    en: ["Global Health", "DR Congo reports 782 confirmed Ebola cases", "outbreaks become most dangerous when transmission outruns response", "Health authorities in the Democratic Republic of Congo say confirmed Ebola cases have risen to 782, with additional health zones affected. The outbreak is unfolding in areas already challenged by population displacement, weak infrastructure and insecurity. The case count is alarming, but the larger question is whether surveillance, isolation and medical response systems can move faster than the virus.", "In an epidemic, time is not a detail. It is the battlefield.", "Viruses do not wait for meetings. One slow response can widen the outbreak."],
    source: ["Latest case and regional data", "Reuters", "https://www.reuters.com/business/healthcare-pharmaceuticals/congo-says-782-ebola-cases-confirmed-two-new-health-zones-affected-2026-06-14/"],
  },
  {
    slug: "ai-governance-crossroads",
    category: "technology",
    region: "United States",
    countryCodes: ["US"],
    status: "followup",
    increment: 70,
    score: 93,
    zh: ["AI政策", "据报道，Anthropic人员赴华盛顿与白宫官员会面", "模型访问争议正升级为国家战略问题", "在先进模型访问政策引发争议后，据报道，Anthropic高级技术人员前往华盛顿，与白宫官员讨论相关问题。讨论焦点已经不只是一款产品能否开放，还涉及国家安全、供应链、出口管制和技术主权。最强模型正逐渐从商业产品变成战略资产。", "当模型成为基础设施，争议就不再只是产品问题。", "以前比谁更聪明，现在还得比谁被允许使用。"],
    en: ["AI Policy", "Anthropic staff head to Washington for White House talks", "model access is becoming a matter of national strategy", "Senior Anthropic technical staff have reportedly travelled to Washington for talks with White House officials following a dispute over access to advanced AI models. The discussion now extends far beyond product availability. National security, supply chains, export controls and technological sovereignty are all becoming part of the debate. The world’s most capable models are increasingly being treated as strategic assets.", "Once models become infrastructure, the debate is no longer only about products.", "AI companies used to compete over intelligence. Now they also compete over permission."],
    source: ["Anthropic staff meet White House officials", "Reuters", "https://www.reuters.com/world/us/anthropic-staff-meet-white-house-officials-next-week-axios-reports-2026-06-14/"],
  },
  {
    slug: "climate-adaptation-city",
    category: "technology",
    region: "United States",
    countryCodes: ["US"],
    status: "new",
    increment: 100,
    score: 88,
    zh: ["AI监管", "美国多州继续推进AI监管", "技术跑得越快，地方政府越不愿等待统一答案", "尽管美国联邦层面希望建立统一的AI政策框架，越来越多州仍在推动聊天机器人、未成年人保护、算法责任、就业决策和数据安全等立法。美国AI治理可能形成联邦、州和行业规则并行的格局，企业需要面对的合规成本也会持续增加。", "技术在加速，规则也不会永远缺席。", "AI还没学会停，法规已经准备踩刹车了。"],
    en: ["AI Regulation", "U.S. states keep advancing AI rules", "the faster technology moves, the less local governments want to wait", "Although the federal government is seeking a more unified national framework, a growing number of U.S. states continue to advance legislation covering chatbots, youth protection, algorithmic accountability, employment decisions and data security. The result may be a patchwork of federal, state and industry rules, increasing both regulatory complexity and compliance costs for AI companies.", "Technology is accelerating, but rules will not remain absent forever.", "AI has not learned to stop, but lawmakers are already reaching for the brakes."],
    source: ["U.S. states continue to pursue AI regulation", "AP News", "https://apnews.com/article/23a0e44ab05402ddfe9cdfd0bffa0ade"],
  },
  {
    slug: "space-economy-orbit",
    category: "business",
    region: "Asia",
    countryCodes: ["KR", "US"],
    status: "new",
    increment: 100,
    score: 89,
    zh: ["半导体与资本", "SK海力士据报倾向选择纳斯达克上市", "AI芯片竞争正延伸到资本定价权", "据报道，韩国存储芯片企业SK海力士正考虑为其美国上市计划选择纳斯达克，希望扩大美国投资者基础，并提升其在全球资本市场中的影响力。作为AI高带宽内存的重要供应商，公司之间的竞争已经不只发生在技术和产能层面，也延伸到了估值与资本定价。", "技术的上限决定价值，资本的偏好也会反过来塑造竞争。", "会做芯片是一回事，会讲资本故事又是另一回事。"],
    en: ["Semiconductors & Capital", "SK hynix is reportedly leaning toward Nasdaq", "the AI chip race is expanding into capital-market pricing power", "SK hynix is reportedly considering Nasdaq for its planned U.S. listing, seeking to broaden its American investor base and strengthen its global capital-market profile. As a major supplier of high-bandwidth memory for AI systems, the company sits at the centre of the infrastructure boom. Competition among chipmakers now extends beyond technology and manufacturing into valuation, investor attention and capital pricing.", "Technology defines the ceiling of value, but capital can reshape the competition.", "Building great chips is one skill. Telling a great capital story is another."],
    source: ["SK hynix and its planned Nasdaq listing", "Reuters", "https://www.reuters.com/business/retail-consumer/south-koreas-sk-hynix-opt-nasdaq-planned-us-listing-sources-say-2026-06-12/"],
  },
  {
    slug: "ocean-treaty-action",
    category: "international",
    region: "Taiwan Strait",
    countryCodes: ["TW", "CN"],
    status: "new",
    increment: 100,
    score: 90,
    zh: ["台海与情报", "台湾情报机构上线面向中国大陆人士的安全举报通道", "情报竞争正进入公开数字入口", "台湾安全部门宣布建立新的网页渠道，供中国大陆人士安全提交情报线索，并表示近期主动提供信息的人有所增加。传统上高度隐蔽的情报招募，正在借助网站、加密通信与数字平台变得更加公开，这也可能进一步加剧两岸在安全、网络和信息领域的博弈。", "情报竞争最先升级的，往往不是边界，而是入口。", "以前拼的是线人，现在连线索入口都做成网页了。"],
    en: ["Taiwan & Intelligence", "Taiwan launches a secure tip channel for people in mainland China", "intelligence competition is moving into public digital gateways", "Taiwan’s National Security Bureau has launched a secure webpage allowing people in mainland China to submit intelligence-related information. The agency says more individuals have recently approached Taiwanese authorities with potential tips. Intelligence recruitment, once highly secretive, is becoming more visible through websites, encrypted communication and digital platforms, adding another dimension to cross-strait security competition.", "In intelligence competition, the first thing to change is often not the border, but the entry point.", "Espionage used to need shadows. Now it also needs a web form."],
    source: ["Taiwan launches an intelligence tip website", "Reuters", "https://www.reuters.com/world/china/taiwan-launches-website-chinese-nationals-report-intelligence-2026-06-14/"],
  },
  {
    slug: "culture-restoration-digital",
    category: "climate",
    region: "Global",
    countryCodes: [],
    status: "new",
    increment: 100,
    score: 92,
    zh: ["气候变化", "NOAA确认厄尔尼诺已形成", "气候波动正在变成粮食、能源与保险账单", "美国国家海洋和大气管理局确认厄尔尼诺条件已经形成，并预计其可能持续增强。厄尔尼诺会改变不同地区的降雨、高温、农业产量和风暴活动。气候现象不只存在于天气预报和温度曲线中，也会逐渐反映到食品价格、能源需求和保险成本上。", "气候不是遥远议题，它最终都会变成每个人的成本。", "地球一发烧，最后最先感受到的往往是钱包。"],
    en: ["Climate", "NOAA confirms El Niño conditions", "climate volatility is becoming a bill for food, energy and insurance", "The U.S. National Oceanic and Atmospheric Administration has confirmed that El Niño conditions are present and expected to strengthen. The climate pattern can reshape rainfall, heat, agricultural production and storm activity across different regions. Its impact will not remain confined to weather forecasts. It is likely to appear in food prices, energy demand, insurance costs and disaster preparedness.", "Climate is not a distant issue. It eventually becomes everyone’s cost.", "When the planet runs a fever, the first place many people feel it is their wallet."],
    source: ["El Niño advisory and outlook", "NOAA", "https://www.noaa.gov/news-release/el-nino-forms-expected-to-strengthen-say-noaa-forecasters"],
  },
];

issue.featuredTopicId = issue.topics[0].id;
issue.topics = content.map((item, index) => {
  const existing = issue.topics.find((topic) => topic.slug === item.slug) ?? issue.topics[index];
  const [zhLabel, zhFact, zhView, zhIntro, zhXiazi, zhDoudou] = item.zh;
  const [enLabel, enFact, enView, enIntro, enXiazi, enDoudou] = item.en;
  return {
    ...existing,
    slug: item.slug,
    rank: index + 1,
    category: item.category,
    region: item.region,
    countryCodes: item.countryCodes,
    isDeveloping: item.status === "followup",
    scoreTotal: item.score,
    storyId: item.slug.replaceAll("-", "_"),
    storyStatus: item.status,
    followupDay: item.status === "followup" ? 2 : 1,
    informationIncrementScore: item.increment,
    localizations: {
      "zh-CN": {
        categoryLabel: zhLabel,
        headlineFact: zhFact,
        headlineView: zhView,
        headlineFull: `${zhFact}；${zhView}。`,
        intro: zhIntro,
        xiaziQuote: zhXiazi,
        doudouQuote: zhDoudou,
        footerTakeaway: zhView,
      },
      "en-US": {
        categoryLabel: enLabel,
        headlineFact: enFact,
        headlineView: enView,
        headlineFull: `${enFact}; ${enView}.`,
        intro: enIntro,
        xiaziQuote: enXiazi,
        doudouQuote: enDoudou,
        footerTakeaway: enView,
      },
    },
    sources: [{
      ...existing.sources[0],
      title: item.source[0],
      publisher: item.source[1],
      url: item.source[2],
      sourceType: item.source[1] === "NOAA" || item.source[1] === "Élysée Palace" ? "official" : "wire",
      sourceTier: 1,
      isPrimary: true,
    }],
  };
});

await writeFile(issuePath, `${JSON.stringify(issue, null, 2)}\n`);
await writeFile(storyPoolPath, `${JSON.stringify({
  updatedAt: issue.beijingTimestamp,
  stories: issue.topics.map((topic) => ({
    storyId: topic.storyId,
    status: topic.storyStatus,
    firstSeen: topic.storyStatus === "followup" ? "2026-06-14" : issue.issueDate,
    lastSeen: issue.issueDate,
    followupDay: topic.followupDay,
    informationIncrementScore: topic.informationIncrementScore,
    latestHeadline: topic.localizations["zh-CN"].headlineFact,
  })),
}, null, 2)}\n`);
console.log("Applied user-provided 2026-06-15 issue.");
