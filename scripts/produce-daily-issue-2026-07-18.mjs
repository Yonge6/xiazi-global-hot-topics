import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const issueDate = "2026-07-18";
const compactDate = issueDate.replaceAll("-", "");
const posterRoot = path.join(root, "tmp/image2-2026-07-18");

const stories = [
  {
    slug: "overview",
    category: "international",
    region: "Global",
    countryCodes: [],
    scoreTotal: 98,
    storyId: `xzs-overview-${compactDate}`,
    storyStatus: "new",
    followupDay: 1,
    informationIncrementScore: 100,
    zh: {
      categoryLabel: "今日总览",
      fact: "世界杯进入决赛周末，Kimi K3与单人创业继续扩张",
      view: "效率越高，安全、规则与公共系统越要跟上。",
      intro: "世界杯在统计窗口内无完赛，西班牙与阿根廷等待决赛；月之暗面公布Kimi K3，最新创业研究显示单人创始人比例继续上升。与此同时，航空监管、海底矿产、气候归因、新西兰禽流感与美港贸易安排都出现新变化。",
      xiaziQuote: "今天八条新闻的共同主线，是技术和效率向前冲时，监督、生态与公共系统必须同步升级。",
      doudouQuote: "世界按下加速键，别忘了先检查安全带、说明书和备用电源。",
      posterTitle: "决赛周末与效率竞赛",
      posterBody: "世界杯静待终局，Kimi K3与单人创业加速；航空、海洋、气候、健康和贸易规则同步调整。",
    },
    en: {
      categoryLabel: "Overview",
      fact: "The World Cup enters its final weekend as Kimi K3 and solo entrepreneurship expand",
      view: "the faster efficiency rises, the more safety, rules and public systems must keep pace.",
      intro: "No World Cup match finished inside the reporting window as Spain and Argentina awaited the final. Moonshot unveiled Kimi K3, while new startup research showed solo founders becoming more common. Aviation oversight, seabed minerals, climate attribution, New Zealand bird flu and U.S.-Hong Kong trade treatment also shifted.",
      xiaziQuote: "Across today’s eight stories, speed and efficiency are rising faster than the systems meant to supervise, protect and absorb their costs.",
      doudouQuote: "The world pressed fast-forward; please check the seat belt, manual and backup power first.",
      posterTitle: "A Final Weekend and an Efficiency Race",
      posterBody: "The World Cup awaits its finale as Kimi K3 and solo startups accelerate. Aviation, oceans, climate, health and trade rules are shifting too.",
    },
    source: {
      title: "US restores Hong Kong's preferential privileges",
      publisher: "Associated Press",
      url: "https://apnews.com/article/hong-kong-us-china-preferential-trade-b0a7e46fac0906bba975e3a1f52ebe7d",
      publishedAt: "2026-07-17T16:45:03Z",
      sourceType: "wire",
    },
  },
  {
    slug: "world-cup-final-weekend-rest-day",
    category: "sports",
    region: "Global",
    countryCodes: ["ES", "AR", "FR", "GB"],
    scoreTotal: 94,
    storyId: "xzs-world-cup-final-rest-day-20260717",
    storyStatus: "followup",
    followupDay: 2,
    informationIncrementScore: 72,
    zh: {
      categoryLabel: "世界杯日报",
      fact: "统计窗口内仍无完赛，法国与英格兰、西班牙与阿根廷等待终局",
      view: "大赛最后的空窗，也是一场体能与情绪管理。",
      intro: "北京时间7月17日05:00至7月18日05:00没有世界杯比赛完赛。法国与英格兰将争夺季军，西班牙与阿根廷将争夺冠军，两场比赛均在本期统计窗口之后进行，因此不得提前写入赛果。",
      xiaziQuote: "决赛周末的空窗并不空白，球队正在把最后的体能、战术和情绪压缩成一次选择。",
      doudouQuote: "今天没有新比分，只有全世界一起刷新倒计时。",
      posterTitle: "终局前最后空窗",
      posterBody: "北京时间7月17日05:00至18日05:00无完赛。法国对英格兰、西班牙对阿根廷均在窗口后进行。",
    },
    en: {
      categoryLabel: "World Cup Daily",
      fact: "No match finishes in the reporting window as France and England, then Spain and Argentina, await the finale",
      view: "the final pause is also a test of fitness and emotional control.",
      intro: "No World Cup match was completed between 05:00 on July 17 and 05:00 on July 18 Beijing time. France versus England in the third-place playoff and Spain versus Argentina in the final both fall outside this issue’s reporting window, so no result is recorded early.",
      xiaziQuote: "The final weekend’s quiet interval is not empty; teams are compressing their remaining fitness, tactics and emotion into one last decision.",
      doudouQuote: "No new score today—only the whole world refreshing the countdown.",
      posterTitle: "The Last Pause Before the Finale",
      posterBody: "No match finished from 05:00 July 17 to 05:00 July 18 Beijing time. The third-place playoff and final come later.",
    },
    source: {
      title: "FIFA World Cup 2026 match schedule, fixtures and results",
      publisher: "FIFA",
      url: "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/match-schedule-fixtures-results-teams-stadiums",
      publishedAt: "2026-07-17T00:00:00Z",
      sourceType: "official",
    },
  },
  {
    slug: "moonshot-kimi-k3-open-model",
    category: "technology",
    region: "Asia",
    countryCodes: ["CN"],
    scoreTotal: 96,
    storyId: `xzs-moonshot-kimi-k3-${compactDate}`,
    storyStatus: "new",
    followupDay: 1,
    informationIncrementScore: 96,
    zh: {
      categoryLabel: "AI热点",
      fact: "月之暗面公布2.8万亿参数Kimi K3",
      view: "开放模型的竞争，正从追赶速度转向生态吸引力。",
      intro: "据路透社，月之暗面公布总参数2.8万亿的Kimi K3，并称其为全球最大开放权重模型，权重计划于7月27日发布。参数规模不是胜负本身，开发者采用、推理成本和真实任务可靠性才决定长期影响。",
      xiaziQuote: "开放权重把竞争从一家公司内部，推向全球开发者共同验证的市场。",
      doudouQuote: "参数已经大到能绕月球，接下来请用真实任务证明它不是只会摆造型。",
      posterTitle: "Kimi K3公布",
      posterBody: "月之暗面公布2.8万亿参数开放权重模型Kimi K3，权重计划7月27日发布。",
    },
    en: {
      categoryLabel: "Artificial Intelligence",
      fact: "Moonshot unveils the 2.8-trillion-parameter Kimi K3",
      view: "open-model competition is shifting from catch-up speed to ecosystem appeal.",
      intro: "Reuters reported that Moonshot unveiled Kimi K3, a 2.8-trillion-parameter model it describes as the world’s largest open-weight system, with weights scheduled for release on July 27. Parameter count alone is not victory; adoption, inference cost and reliability on real tasks will determine lasting impact.",
      xiaziQuote: "Open weights move competition from one company’s lab into a global market of developer testing and adoption.",
      doudouQuote: "The parameter count can orbit the moon; now let real work prove it is more than a pose.",
      posterTitle: "Moonshot Unveils Kimi K3",
      posterBody: "Moonshot unveiled the 2.8-trillion-parameter open-weight Kimi K3. Model weights are scheduled for release on July 27.",
    },
    source: {
      title: "China's Moonshot unveils world's largest open AI model, closing in on US rivals",
      publisher: "Reuters",
      url: "https://www.reuters.com/world/china/chinas-moonshot-unveils-worlds-largest-open-ai-model-closing-us-rivals-2026-07-17/",
      publishedAt: "2026-07-17T08:00:00Z",
      sourceType: "wire",
    },
  },
  {
    slug: "altshare-solo-founder-q2-2026",
    category: "business",
    region: "Global",
    countryCodes: [],
    scoreTotal: 92,
    storyId: `xzs-altshare-solo-founder-q2-${compactDate}`,
    storyStatus: "new",
    followupDay: 1,
    informationIncrementScore: 90,
    zh: {
      categoryLabel: "OPC一人公司",
      fact: "近四分之一新创公司由单人创办，较四年前接近翻倍",
      view: "AI减少了人手，却没有替代商业验证。",
      intro: "股权管理平台altshare的2026年第二季度创业股权报告显示，近四分之一新设创业公司由单人创办，比例接近四年前的两倍。AI让小团队更容易启动，但投资人同时要求更清晰的商业牵引力与里程碑。",
      xiaziQuote: "一人公司真正的优势不是永远一个人，而是先用更小成本证明需求，再决定何时扩张。",
      doudouQuote: "团队可以先不招满，客户可不能等到以后再找。",
      posterTitle: "单人创始人接近四分之一",
      posterBody: "altshare称近四分之一新创公司由单人创办，较四年前接近翻倍；投资人更看重商业牵引力。",
    },
    en: {
      categoryLabel: "OPC Solo Company",
      fact: "Nearly one in four new startups has a solo founder, almost double the share four years ago",
      view: "AI reduces headcount but does not replace market validation.",
      intro: "Altshare’s Q2 2026 Startup Equity Report says nearly one-quarter of newly established startups now have a single founder, almost twice the share four years ago. AI makes leaner launches possible, while investors demand clearer commercial traction and milestones before committing capital.",
      xiaziQuote: "A solo company’s real advantage is not staying alone forever, but proving demand cheaply before deciding when to expand.",
      doudouQuote: "You can postpone hiring the whole team; you cannot postpone finding customers.",
      posterTitle: "Solo Founders Near One in Four",
      posterBody: "Altshare says nearly one-quarter of new startups have one founder, almost double four years ago. Investors want clearer traction.",
    },
    source: {
      title: "One in four startups now has a solo founder as AI transforms entrepreneurship",
      publisher: "CTech / altshare",
      url: "https://www.calcalistech.com/ctechnews/article/rknbfqmemx",
      publishedAt: "2026-07-14T11:16:23Z",
      sourceType: "publisher",
    },
  },
  {
    slug: "faa-boeing-airworthiness-certificates",
    category: "business",
    region: "North America",
    countryCodes: ["US"],
    scoreTotal: 91,
    storyId: `xzs-faa-boeing-certificates-${compactDate}`,
    storyStatus: "new",
    followupDay: 1,
    informationIncrementScore: 94,
    zh: {
      categoryLabel: "航空监管",
      fact: "FAA允许波音恢复737 MAX与787适航证签发",
      view: "监管放权的前提，是把数据与持续监督写进流程。",
      intro: "美国联邦航空管理局表示，经过八个月数据与安全审查，波音可自7月20日起恢复为全部737 MAX和787签发适航证。FAA仍将持续检查、审计和监控制造体系；这不是监督退出，而是责任边界重新调整。",
      xiaziQuote: "高风险行业的信任不能靠一句恢复，而要靠长期可审计的数据积累。",
      doudouQuote: "把印章交回去可以，检查清单可千万别一起打包退货。",
      posterTitle: "波音恢复适航证签发",
      posterBody: "FAA经八个月审查后，允许波音自7月20日起恢复737 MAX与787适航证签发，并保留持续监督。",
    },
    en: {
      categoryLabel: "Aviation Oversight",
      fact: "The FAA lets Boeing resume issuing airworthiness certificates for 737 MAX and 787 aircraft",
      view: "delegation works only when data and continuous oversight remain in the process.",
      intro: "After eight months of data and safety review, the FAA said Boeing may resume issuing airworthiness certificates for all 737 MAX and 787 aircraft from July 20. The agency will continue inspections, audits and production monitoring; this changes responsibility without ending oversight.",
      xiaziQuote: "Trust in a high-risk industry cannot return through one announcement; it must be rebuilt with auditable evidence over time.",
      doudouQuote: "Return the stamp if you must, but please keep the inspection checklist on the desk.",
      posterTitle: "Boeing Regains Certificate Authority",
      posterBody: "After an eight-month review, the FAA will let Boeing resume 737 MAX and 787 airworthiness certificates on July 20, with oversight continuing.",
    },
    source: {
      title: "After Months of Safety Review, FAA Allows Boeing to Resume Issuing Certificates for New Airplanes",
      publisher: "Federal Aviation Administration",
      url: "https://www.faa.gov/newsroom/after-months-safety-review-faa-allows-boeing-resume-issuing-certificates-new-airplanes",
      publishedAt: "2026-07-17T12:00:00Z",
      sourceType: "official",
    },
  },
  {
    slug: "american-samoa-minerals-lease-plan",
    category: "economy",
    region: "Pacific",
    countryCodes: ["US"],
    scoreTotal: 90,
    storyId: `xzs-american-samoa-minerals-${compactDate}`,
    storyStatus: "new",
    followupDay: 1,
    informationIncrementScore: 91,
    zh: {
      categoryLabel: "关键矿产",
      fact: "美国推进美属萨摩亚近海矿产租赁",
      view: "关键矿产安全不能跳过海洋生态账本。",
      intro: "美国海洋能源管理局7月16日公布拟议租赁通知，推动年内举行美属萨摩亚外大陆架矿产租赁。当前环境评估仅覆盖勘察等前期活动，并不等于批准商业开采；供应链目标仍需接受生态与程序审查。",
      xiaziQuote: "关键矿产的地缘价值越高，越需要把环境代价和地方利益写进起点，而不是留到终点。",
      doudouQuote: "海底宝藏不是抽屉里的备用电池，打开前先问问海洋邻居。",
      posterTitle: "美属萨摩亚海底矿产租赁",
      posterBody: "美国公布拟议租赁通知，推动年内近海矿产租赁；现阶段只覆盖勘察等前期活动。",
    },
    en: {
      categoryLabel: "Critical Minerals",
      fact: "The United States advances an offshore minerals lease sale near American Samoa",
      view: "critical-mineral security cannot skip the ocean’s ecological ledger.",
      intro: "The Bureau of Ocean Energy Management issued a proposed leasing notice on July 16 for a possible American Samoa offshore minerals sale later this year. Its environmental review covers preliminary surveys, not commercial extraction approval, leaving ecological and procedural scrutiny ahead.",
      xiaziQuote: "The greater a mineral’s strategic value, the earlier environmental costs and local interests must enter the decision.",
      doudouQuote: "The seabed is not a spare-battery drawer; ask the ocean’s neighbors before opening it.",
      posterTitle: "American Samoa Seabed Lease Plan",
      posterBody: "The U.S. issued a proposed notice for an offshore minerals lease sale later this year. Current review covers preliminary surveys only.",
    },
    source: {
      title: "Potential American Samoa Offshore Minerals Lease Sale",
      publisher: "Bureau of Ocean Energy Management",
      url: "https://www.boem.gov/marine-minerals/potential-american-samoa-offshore-minerals-lease-sale",
      publishedAt: "2026-07-16T12:00:00Z",
      sourceType: "official",
    },
  },
  {
    slug: "national-academies-extreme-event-attribution",
    category: "climate",
    region: "Global",
    countryCodes: ["US"],
    scoreTotal: 89,
    storyId: `xzs-extreme-event-attribution-${compactDate}`,
    storyStatus: "new",
    followupDay: 1,
    informationIncrementScore: 88,
    zh: {
      categoryLabel: "气候科学",
      fact: "美国国家科学院更新极端天气归因评估",
      view: "能解释多少气候影响，正在决定城市如何准备与追责。",
      intro: "美国国家科学院新报告称，极端事件归因科学过去十年显著进步，对极端高温、低温和大范围强降雨的结论信心最高；对雷暴、龙卷风等小尺度过程仍有限。更可靠的归因将影响规划、保险与公共政策。",
      xiaziQuote: "把气候变化从长期趋势连接到具体灾害，是风险治理从争论走向行动的一步。",
      doudouQuote: "天气会变脸，科学至少要把它的变脸记录得更清楚。",
      posterTitle: "极端天气归因科学更新",
      posterBody: "新报告称高温、低温和大范围强降雨归因信心最高，雷暴与龙卷风等小尺度过程仍有限。",
    },
    en: {
      categoryLabel: "Climate Science",
      fact: "The U.S. National Academies updates its assessment of extreme-event attribution",
      view: "what science can explain increasingly shapes how cities prepare and assign responsibility.",
      intro: "A new National Academies report says extreme-event attribution has advanced substantially in a decade. Confidence is highest for extreme heat, cold and large-scale heavy rainfall, but remains lower for small-scale processes such as thunderstorms and tornadoes. Stronger attribution can inform planning, insurance and policy.",
      xiaziQuote: "Connecting climate change to specific disasters helps risk governance move from abstract argument toward practical action.",
      doudouQuote: "Weather changes its face quickly; science should at least keep a clearer record.",
      posterTitle: "Extreme-Event Attribution Advances",
      posterBody: "Confidence is highest for extreme heat, cold and large-scale heavy rain, but remains lower for thunderstorms and tornadoes.",
    },
    source: {
      title: "The Science of Extreme Event Attribution Has Advanced, But Challenges Remain",
      publisher: "National Academies of Sciences, Engineering, and Medicine",
      url: "https://www.nationalacademies.org/news/the-science-of-extreme-event-attribution-which-analyzes-climate-change-s-influence-on-specific-weather-events-has-advanced-but-challenges-remain",
      publishedAt: "2026-07-15T13:51:40Z",
      sourceType: "official",
    },
  },
  {
    slug: "new-zealand-second-h5-bird-flu-case",
    category: "health",
    region: "Oceania",
    countryCodes: ["NZ"],
    scoreTotal: 92,
    storyId: `xzs-new-zealand-second-h5-${compactDate}`,
    storyStatus: "new",
    followupDay: 1,
    informationIncrementScore: 95,
    zh: {
      categoryLabel: "公共健康",
      fact: "新西兰确认第二例H5禽流感，首次涉及本土猛禽",
      view: "早发现不等于可松懈，监测与保护必须同时加速。",
      intro: "新西兰7月17日确认，一只在怀拉拉帕发现的沼泽鹞成为该国第二只感染H5禽流感的鸟，也是首只确认感染的本土鸟类。政府称家禽中尚未检出，并将加强野鸟监测、家禽业支持和濒危鸟类疫苗接种。",
      xiaziQuote: "从迁徙海鸟到本土猛禽，病毒跨越的不是一条物种名单，而是生态系统的连接。",
      doudouQuote: "第二只鸟就是第二次提醒：看见异常，离远一点，快点报告。",
      posterTitle: "新西兰第二例H5禽流感",
      posterBody: "本土沼泽鹞确认为该国第二例H5禽流感；家禽尚未检出，野鸟监测与疫苗接种将加强。",
    },
    en: {
      categoryLabel: "Public Health",
      fact: "New Zealand confirms a second H5 bird-flu case, its first in a native raptor",
      view: "early detection is not permission to relax; monitoring and protection must accelerate together.",
      intro: "New Zealand confirmed on July 17 that a swamp harrier found in Wairarapa was the country’s second bird with H5 avian influenza and the first confirmed native bird. Officials said poultry remained unaffected and announced stronger wildlife checks, industry support and vaccination for threatened birds.",
      xiaziQuote: "From a migratory seabird to a native raptor, the virus is crossing connections inside an ecosystem, not merely a species list.",
      doudouQuote: "A second bird is a second reminder: keep your distance, notice problems and report quickly.",
      posterTitle: "New Zealand Confirms Second H5 Case",
      posterBody: "A native swamp harrier is New Zealand’s second H5 bird-flu case. Poultry remains unaffected as surveillance and vaccination expand.",
    },
    source: {
      title: "Bird flu work steps up – second case confirmed",
      publisher: "New Zealand Department of Conservation",
      url: "https://www.doc.govt.nz/news/media-releases/2026-media-releases/bird-flu-work-steps-up-second-case-confirmed/",
      publishedAt: "2026-07-17T04:00:00Z",
      sourceType: "official",
    },
  },
  {
    slug: "us-restores-hong-kong-preferences",
    category: "economy",
    region: "Asia",
    countryCodes: ["US", "CN", "HK"],
    scoreTotal: 91,
    storyId: `xzs-us-hong-kong-preferences-${compactDate}`,
    storyStatus: "new",
    followupDay: 1,
    informationIncrementScore: 93,
    zh: {
      categoryLabel: "全球贸易",
      fact: "美国恢复香港优惠待遇",
      view: "贸易关系回暖时，制度与制裁的不确定性仍会留在企业账上。",
      intro: "美方7月17日确认，不续签此前撤销香港特殊贸易地位的行政令，恢复相关优惠待遇。美国财政部称该行政令下的国家紧急状态已到期；部分个人在不同制裁清单间调整，显示关系缓和并不等于所有限制归零。",
      xiaziQuote: "政策转向可以很快，企业重新建立供应链、合规判断和信心却需要更长时间。",
      doudouQuote: "优惠回来了，合规团队的咖啡大概还不能停。",
      posterTitle: "美国恢复香港优惠待遇",
      posterBody: "美国确认不续签撤销香港特殊贸易地位的行政令；关系缓和不等于所有制裁与限制归零。",
    },
    en: {
      categoryLabel: "Global Trade",
      fact: "The United States restores Hong Kong’s preferential treatment",
      view: "even as trade ties warm, regulatory and sanctions uncertainty stays on corporate balance sheets.",
      intro: "The United States confirmed on July 17 that it would not renew the executive order revoking Hong Kong’s special trading status, restoring related privileges. The Treasury said the national emergency under that order had expired, while some people moved between sanctions lists, showing that easing does not erase every restriction.",
      xiaziQuote: "Policy can turn quickly, but rebuilding supply chains, compliance judgments and business confidence takes much longer.",
      doudouQuote: "The preferences are back; the compliance team probably should not stop brewing coffee yet.",
      posterTitle: "U.S. Restores Hong Kong Preferences",
      posterBody: "The U.S. will not renew the order revoking Hong Kong’s special trade status. Easing does not remove every sanction or restriction.",
    },
    source: {
      title: "US restores Hong Kong's preferential privileges",
      publisher: "Associated Press",
      url: "https://apnews.com/article/hong-kong-us-china-preferential-trade-b0a7e46fac0906bba975e3a1f52ebe7d",
      publishedAt: "2026-07-17T16:45:03Z",
      sourceType: "wire",
    },
  },
];

function localized(value, locale) {
  const separator = locale === "zh-CN" ? "；" : "; ";
  return {
    categoryLabel: value.categoryLabel,
    headlineFact: value.fact,
    headlineView: value.view,
    headlineFull: `${value.fact}${separator}${value.view}`,
    intro: value.intro,
    xiaziQuote: value.xiaziQuote,
    doudouQuote: value.doudouQuote,
    footerTakeaway: locale === "zh-CN" ? `今日关键词：${value.categoryLabel}。` : `Keyword: ${value.categoryLabel}.`,
  };
}

function buildIssue(base) {
  const issueId = `issue-${issueDate}`;
  const topics = stories.map((story, index) => {
    const topicId = `topic-${issueDate}-${String(index + 1).padStart(2, "0")}`;
    return {
      ...base.topics[index],
      id: topicId,
      issueId,
      slug: story.slug,
      rank: index + 1,
      category: story.category,
      region: story.region,
      countryCodes: story.countryCodes,
      eventTime: null,
      isDeveloping: index === 1 || index === 2 || index === 7,
      verificationStatus: "verified",
      scoreTotal: story.scoreTotal,
      storyId: story.storyId,
      storyStatus: story.storyStatus,
      followupDay: story.followupDay,
      informationIncrementScore: story.informationIncrementScore,
      localizations: {
        "zh-CN": localized(story.zh, "zh-CN"),
        "en-US": localized(story.en, "en-US"),
      },
      sources: [{
        id: `source-${issueDate}-${String(index + 1).padStart(2, "0")}-1`,
        topicId,
        title: story.source.title,
        publisher: story.source.publisher,
        url: story.source.url,
        publishedAt: story.source.publishedAt,
        sourceType: story.source.sourceType,
        sourceTier: 1,
        locale: "en-US",
        isPrimary: true,
      }],
    };
  });
  return {
    ...base,
    id: issueId,
    slug: issueDate,
    issueDate,
    assetVersion: `issue-${issueDate}-style-atlas-075-image2-v1`,
    status: "published",
    slotHour: 5,
    beijingTimestamp: `${issueDate}T05:00:00+08:00`,
    gmtTimestamp: "2026-07-17T21:00:00Z",
    featuredTopicId: topics[0].id,
    style: {
      name: "Style Atlas #75 North American Indigenous Art",
      zhName: "Style Atlas #75 北美原住民艺术",
      description: "Earth-pigment editorial poster language with woven texture, handcrafted print character, rhythmic geometry, and symbolic sun, mountain, river, and sky composition; sacred and tribe-specific symbols are excluded.",
    },
    topics,
  };
}

function posterPrompt(story, index, locale) {
  const copy = locale === "zh" ? story.zh : story.en;
  const header = locale === "zh"
    ? `NO.${String(index + 1).padStart(2, "0")}｜${copy.categoryLabel}`
    : `NO.${String(index + 1).padStart(2, "0")} | ${copy.categoryLabel}`;
  const xiaziLabel = locale === "zh" ? "虾子曰：" : "XIAZI SAYS: ";
  const doudouLabel = locale === "zh" ? "豆豆龙：" : "DOUDOU SAYS: ";
  return `Create one final 9:18 news poster PNG ready to publish. Use today's Style Atlas #75 direction: refined earth-pigment textile and handcrafted print aesthetics in terracotta, ochre, muted blue-gray, cream and black, with rhythmic geometric borders and symbolic sun, mountain, river and sky composition. Keep the information hierarchy and narrative density of a premium museum editorial poster. Do not copy sacred symbols, tribe-specific marks, regalia or ceremonial objects. Do not use a grid, contact sheet, placeholder, official logo, real-person portrait or extra text.

Both supplied reference characters must appear together and participate in the scene. Preserve their identity exactly and keep text away from their faces.

Render exactly seven legible text blocks in the requested language: header, title, body, Xiazi quote, Doudou quote, date and website. Put all text directly in the final pixels; do not translate, paraphrase, omit, duplicate or add text.

HEADER: “${header}”
TITLE: “${copy.posterTitle}”
BODY: “${copy.posterBody}”
XIAZI: “${xiaziLabel}${copy.xiaziQuote}”
DOUDOU: “${doudouLabel}${copy.doudouQuote}”
DATE: “2026.07.18”
WEBSITE: “xiazishuo.com”

The main visual metaphor must match this topic: ${copy.fact}. Make the final pixels complete and immediately publishable, with no empty text boxes and no post-production required.`;
}

async function writeJson(relative, value) {
  const destination = path.join(root, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, `${JSON.stringify(value, null, 2)}\n`);
}

async function prepare() {
  const prompts = [];
  for (const locale of ["zh", "en"]) {
    for (const [index, story] of stories.entries()) {
      prompts.push({
        locale,
        number: index + 1,
        slug: story.slug,
        output: path.join(posterRoot, locale, `NO.${String(index + 1).padStart(2, "0")}.png`),
        prompt: posterPrompt(story, index, locale),
      });
    }
  }
  await writeJson("tmp/daily-fallback-2026-07-18/image2-prompts.json", prompts);
  await writeJson("tmp/daily-fallback-2026-07-18/selected-stories.json", stories.map((story, index) => ({
    rank: index + 1,
    slug: story.slug,
    storyId: story.storyId,
    storyStatus: story.storyStatus,
    informationIncrementScore: story.informationIncrementScore,
    zhTitle: `${story.zh.fact}；${story.zh.view}`,
    enTitle: `${story.en.fact}; ${story.en.view}`,
    source: story.source,
  })));
  console.log(JSON.stringify({ issueDate, prompts: prompts.length, selectedStories: stories.length, posterRoot }, null, 2));
}

async function publishLocal() {
  const base = JSON.parse(await fs.readFile(path.join(root, "data/archive/2026-07-17.json"), "utf8"));
  const issue = buildIssue(base);
  let posterBytes = 0;
  const compression = [];

  for (const locale of ["zh", "en"]) {
    for (const [index, story] of stories.entries()) {
      const source = path.join(posterRoot, locale, `NO.${String(index + 1).padStart(2, "0")}.png`);
      const input = await fs.readFile(source);
      const before = await sharp(input).metadata();
      const output = await sharp(input).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
      const after = await sharp(output).metadata();
      if (before.width !== after.width || before.height !== after.height || after.format !== "png") {
        throw new Error(`Sharp changed poster dimensions or format for ${locale} NO.${index + 1}`);
      }
      posterBytes += output.length;
      compression.push({ locale, number: index + 1, before: input.length, after: output.length, width: after.width, height: after.height });
      for (const relative of [
        `public/posters/${locale}/${story.slug}.png`,
        `public/archive/${issueDate}/posters/${locale}/${story.slug}.png`,
        `apps/web/public/posters/${locale}/${story.slug}.png`,
        `apps/web/public/archive/${issueDate}/posters/${locale}/${story.slug}.png`,
      ]) {
        const destination = path.join(root, relative);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, output);
      }
    }
  }

  for (const relative of [
    "data/current-issue.json", "src/data/current-issue.json", "public/data/current-issue.json",
    "apps/web/data/current-issue.json", "apps/web/src/data/current-issue.json", "apps/web/public/data/current-issue.json",
    `data/archive/${issueDate}.json`, `src/data/archive/${issueDate}.json`, `public/data/archive/${issueDate}.json`,
    `apps/web/data/archive/${issueDate}.json`, `apps/web/src/data/archive/${issueDate}.json`, `apps/web/public/data/archive/${issueDate}.json`,
  ]) await writeJson(relative, issue);

  const pool = JSON.parse(await fs.readFile(path.join(root, "data/story-pool.json"), "utf8"));
  if (!Array.isArray(pool)) throw new Error("Story Pool must be an array");
  for (const topic of issue.topics.slice(1)) {
    const existing = pool.find((entry) => entry.storyId === topic.storyId);
    const next = {
      storyId: topic.storyId,
      storyStatus: topic.storyStatus,
      followupDay: topic.followupDay,
      informationIncrementScore: topic.informationIncrementScore,
      firstSeenDate: existing?.firstSeenDate || issueDate,
      lastSeenDate: issueDate,
      lastIssueDate: issueDate,
      lastTopicSlug: topic.slug,
      slug: topic.slug,
    };
    if (existing) Object.assign(existing, next);
    else pool.push(next);
  }
  for (const relative of [
    "data/story-pool.json", "src/data/story-pool.json", "public/data/story-pool.json",
    "apps/web/data/story-pool.json", "apps/web/src/data/story-pool.json", "apps/web/public/data/story-pool.json",
  ]) await writeJson(relative, pool);

  for (const relative of ["public/data/archive/index.json", "apps/web/public/data/archive/index.json"]) {
    const destination = path.join(root, relative);
    const index = JSON.parse(await fs.readFile(destination, "utf8"));
    index.issues = Array.from(new Set([issueDate, ...(index.issues || [])])).sort((a, b) => b.localeCompare(a));
    await writeJson(relative, index);
  }

  await writeJson("tmp/daily-fallback-2026-07-18/compression-report.json", compression);
  console.log(JSON.stringify({
    issueDate,
    assetVersion: issue.assetVersion,
    style: issue.style.name,
    titles: issue.topics.map((topic) => topic.localizations["zh-CN"].headlineFull),
    statuses: issue.topics.map((topic) => ({ storyId: topic.storyId, status: topic.storyStatus, day: topic.followupDay, increment: topic.informationIncrementScore })),
    posterCount: 18,
    posterBytes,
    compression: "Sharp PNG lossless; dimensions preserved; thumbnails generated: 0",
  }, null, 2));
}

const mode = process.argv[2] || "--prepare";
if (mode === "--prepare") await prepare();
else if (mode === "--publish-local") await publishLocal();
else throw new Error(`Unknown mode: ${mode}`);
