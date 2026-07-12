import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const issue = JSON.parse(await fs.readFile(path.join(root, "data/current-issue.json"), "utf8"));

const source = (rank, title, publisher, url, type = "publisher") => ({
  id: `source-2026-07-12-${String(rank).padStart(2, "0")}-1`,
  topicId: `topic-2026-07-12-${String(rank).padStart(2, "0")}`,
  title,
  publisher,
  url,
  publishedAt: "2026-07-11T00:00:00Z",
  sourceType: type,
  sourceTier: 1,
  locale: "zh-CN",
  isPrimary: true,
});

const topic = ({ rank, slug, category, region, countries, score, storyId, status = "new", day = 1, increment = 100, zh, en, source: storySource }) => ({
  id: `topic-2026-07-12-${String(rank).padStart(2, "0")}`,
  issueId: issue.id,
  slug,
  rank,
  category,
  region,
  countryCodes: countries,
  eventTime: null,
  isDeveloping: rank !== 1,
  verificationStatus: "verified",
  scoreTotal: score,
  storyId,
  storyStatus: status,
  followupDay: day,
  informationIncrementScore: increment,
  localizations: {
    "zh-CN": { ...zh, headlineFull: `${zh.headlineFact}；${zh.headlineView}。` },
    "en-US": { ...en, headlineFull: `${en.headlineFact}; ${en.headlineView}.` },
  },
  sources: [storySource],
});

issue.assetVersion = "issue-2026-07-12-chatgpt56-tinypng-v3";
issue.featuredTopicId = "topic-2026-07-12-01";
issue.topics = [
  topic({
    rank: 1, slug: "overview", category: "international", region: "Global", countries: [], score: 99,
    storyId: "xzs-20260712-overview",
    zh: { categoryLabel: "今日总览", headlineFact: "世界杯四强最后两席今日决出，美伊边打边谈，亚洲多地遭遇台风与洪水", headlineView: "世界最重要的变化，正在赛场、航道、灾区与AI规则里同时发生", intro: "过去一天，世界杯没有比赛在统计窗口内完赛，但挪威与英格兰恰在今日05:00开球，阿根廷将在09:00迎战瑞士。球场之外，美伊同意继续谈判，俄乌防空压力上升，台风巴威登陆中国东部，孟加拉国洪灾造成至少44人死亡；Meta隐私争议、印尼反腐调查和印新战略伙伴关系也在同步推进。", xiaziQuote: "赛场、航道、防空、灾区与AI规则看似分散，其实都在回答同一个问题：系统能否在压力到来前做好准备。", doudouQuote: "今天的世界像九宫格直播，比分、风速、水位和规则一起刷新。", footerTakeaway: "今日关键词：四强、航道、防空、转移、洪水、隐私、反腐与印太。" },
    en: { categoryLabel: "Overview", headlineFact: "The last two World Cup semifinal places are decided today as U.S.-Iran talks continue and Asian disasters intensify", headlineView: "the day's biggest shifts are unfolding across stadiums, sea lanes, disaster zones and AI rules", intro: "No World Cup match finished inside the reporting window, but Norway versus England kicked off at 05:00 Beijing time and Argentina meets Switzerland at 09:00. Beyond football, U.S.-Iran talks continued, Ukraine pressed for air defenses, Typhoon Bavi hit eastern China, Bangladesh floods killed at least 44, and new disputes emerged around Meta privacy, Indonesian anti-corruption and India-New Zealand ties.", xiaziQuote: "Stadiums, sea lanes, air defenses, disaster zones and AI rules all ask whether systems prepare before pressure arrives.", doudouQuote: "Today looks like a nine-panel live feed: scores, wind, water and rules updating together.", footerTakeaway: "Keywords: semifinals, Hormuz, air defense, evacuations, floods, privacy, corruption and the Indo-Pacific." },
    source: source(1, "World Cup schedule today: Norway v England and Argentina v Switzerland", "The Guardian", "https://www.theguardian.com/football/2026/jul/11/how-to-watch-world-cup-england-norway-argentina-switzerland"),
  }),
  topic({
    rank: 2, slug: "world-cup-july12-no-new-results", category: "sports", region: "Global", countries: ["NO", "GB", "AR", "CH"], score: 96,
    storyId: "xzs-world-cup-daily-20260712", status: "followup", day: 3, increment: 80,
    zh: { categoryLabel: "世界杯", headlineFact: "过去24小时没有比赛完赛，挪威与英格兰05:00开球，阿根廷与瑞士09:00登场", headlineView: "淘汰赛越到最后，等待本身也成为剧情", intro: "北京时间7月11日05:00至7月12日05:00，世界杯没有比赛在窗口内完赛。西班牙2:1击败比利时的比赛早于窗口结束。今天最后两场四分之一决赛为05:00挪威对英格兰、09:00阿根廷对瑞士，两场胜者将在半决赛相遇。", xiaziQuote: "没有赛果的一天，不代表没有故事，只是悬念被留到了下一分钟。", doudouQuote: "球刚开踢就催比分，不是日报，是许愿池。", footerTakeaway: "24小时关键词：零完赛、四强倒计时、哈兰德对凯恩、梅西再登场。" },
    en: { categoryLabel: "World Cup", headlineFact: "No match finished in the past 24 hours as Norway-England kicks off at 05:00 and Argentina-Switzerland at 09:00", headlineView: "late in the knockout stage, waiting becomes part of the drama", intro: "From July 11 05:00 to July 12 05:00 Beijing time, no World Cup match finished inside the window. Spain's 2-1 win over Belgium ended before it began. The final quarterfinals are Norway versus England at 05:00 and Argentina versus Switzerland at 09:00, with the winners meeting in the semifinal.", xiaziQuote: "A day without a result is not a day without a story; the suspense simply carries into the next minute.", doudouQuote: "Demanding a score at kickoff is not reporting; it is wishing.", footerTakeaway: "Keywords: zero final whistles, semifinal countdown, Haaland versus Kane and Messi returns." },
    source: source(2, "England get fitness boost ahead of World Cup quarter-final v Norway", "Reuters", "https://www.reuters.com/sports/soccer/england-get-fitness-boost-ahead-world-cup-quarter-final-v-norway-2026-07-11/", "wire"),
  }),
  topic({
    rank: 3, slug: "us-iran-hormuz-threats", category: "international", region: "Middle East", countries: ["US", "IR", "OM"], score: 98,
    storyId: "xzs-us-iran-hormuz-20260712", status: "followup", day: 4, increment: 88,
    zh: { categoryLabel: "美伊局势", headlineFact: "美伊同意继续谈判，特朗普却宣布停火已经结束", headlineView: "真正危险的不是谈判破裂，而是谈判与攻击同时进行", intro: "美国同意伊朗提出的继续谈判请求，但要求伊朗停止袭击，并确保霍尔木兹海峡安全、免费通行。伊朗通过中间方讨论新的航运安排，希望保留部分水域管理权。油轮遇袭、航运放缓与相互打击继续推高能源供应和通胀风险。", xiaziQuote: "一边谈和平，一边准备下一轮攻击，是国际政治最常见也最危险的双线程运行。", doudouQuote: "谈判桌和发射台同时亮灯，谁都不敢先眨眼。", footerTakeaway: "今日关键词：谈判、航运、油价与停火。" },
    en: { categoryLabel: "U.S.-Iran", headlineFact: "The U.S. and Iran agree to continue talks even as Trump says the ceasefire is over", headlineView: "the greater danger is negotiation and attack running at the same time", intro: "Washington accepted Iran's request to continue talks but demanded an end to attacks and safe, free passage through the Strait of Hormuz. Iran discussed new shipping arrangements through intermediaries while seeking authority over some waters. Tanker attacks, slower shipping and reciprocal strikes continue to raise energy and inflation risks.", xiaziQuote: "Talking peace while preparing the next strike is geopolitics' most familiar and dangerous dual process.", doudouQuote: "The negotiating table and launch pad are both lit, and nobody wants to blink first.", footerTakeaway: "Keywords: talks, shipping, oil prices and ceasefire." },
    source: source(3, "US seeks free Hormuz access from Iran as talks focus on strait", "Reuters", "https://www.reuters.com/world/asia-pacific/trump-says-us-iran-agree-continue-talks-ceasefire-over-2026-07-11/", "wire"),
  }),
  topic({
    rank: 4, slug: "russia-ukraine-air-defense-shortage", category: "international", region: "Europe", countries: ["UA", "RU"], score: 97,
    storyId: "xzs-russia-ukraine-air-defense-20260712",
    zh: { categoryLabel: "俄乌局势", headlineFact: "俄罗斯新一轮导弹与无人机袭击造成7人死亡，乌克兰再催防空武器", headlineView: "战争最昂贵的短缺，是拦截导弹所剩的时间", intro: "俄罗斯对基辅、苏梅、敖德萨、哈尔科夫和扎波罗热等地发动导弹、无人机及滑翔炸弹袭击，造成至少7人死亡、数十人受伤。泽连斯基称爱国者防空弹药持续短缺，要求盟友加快武器交付。", xiaziQuote: "进攻武器决定战争能打多远，防空武器决定普通人还能不能正常生活。", doudouQuote: "战争里最残酷的倒计时，是危险抵达前还剩多少拦截机会。", footerTakeaway: "今日关键词：空袭、防空、交付与平民安全。" },
    en: { categoryLabel: "Russia-Ukraine", headlineFact: "Russian missile and drone strikes kill seven as Ukraine presses for air defenses", headlineView: "the costliest shortage in war is interception time", intro: "Russian missiles, drones and glide bombs hit Kyiv, Sumy, Odesa, Kharkiv and Zaporizhzhia, killing at least seven and wounding dozens. President Zelenskiy said Patriot ammunition remains scarce and urged allies to accelerate weapons deliveries.", xiaziQuote: "Offensive weapons decide how far war travels; air defenses decide whether civilians can live normally.", doudouQuote: "War's harshest countdown is how many interception chances remain before danger arrives.", footerTakeaway: "Keywords: strikes, air defense, deliveries and civilian safety." },
    source: source(4, "Russian strikes kill seven, wound dozens, Ukraine seeks faster weapons deliveries", "Reuters", "https://www.reuters.com/world/europe/kyiv-under-russian-missile-attack-officials-say-2026-07-11/", "wire"),
  }),
  topic({
    rank: 5, slug: "typhoon-bavi-taizhou-evacuations", category: "climate", region: "East Asia", countries: ["CN", "TW", "JP", "PH"], score: 95,
    storyId: "xzs-typhoon-bavi-landfall-20260712", status: "followup", day: 2, increment: 86,
    zh: { categoryLabel: "台风巴威", headlineFact: "台风巴威登陆浙江台州，近200万人提前转移", headlineView: "灾害治理最重要的成绩，往往是那些最终没有发生的伤亡", intro: "巴威登陆中国东部沿海时最大持续风速约每小时144公里。浙江转移超过170万人，福建、上海等地也采取转移、停航和停运措施，累计接近200万人。台风此前还影响日本、台湾和菲律宾。", xiaziQuote: "提前转移看起来没有戏剧性，但真正成熟的防灾，就是让灾难失去制造悲剧的机会。", doudouQuote: "最好的灾害新闻，是最后没有更坏的新闻。", footerTakeaway: "今日关键词：登陆、转移、停航与预防。" },
    en: { categoryLabel: "Typhoon Bavi", headlineFact: "Typhoon Bavi lands in Taizhou after nearly two million people evacuate", headlineView: "disaster prevention is measured by casualties that never happen", intro: "Bavi made landfall on China's eastern coast with sustained winds near 144 kilometers per hour. Zhejiang evacuated more than 1.7 million people, while Fujian, Shanghai and other areas suspended transport and moved residents, bringing the regional total close to two million.", xiaziQuote: "Evacuation looks undramatic, but mature prevention means denying disaster the chance to become tragedy.", doudouQuote: "The best disaster update is the worse headline that never arrives.", footerTakeaway: "Keywords: landfall, evacuation, closures and prevention." },
    source: source(5, "Typhoon Bavi makes landfall in eastern China after nearly 2 million evacuated", "Reuters", "https://www.reuters.com/business/environment/thousands-evacuated-taiwan-shuts-down-typhoon-bavi-2026-07-11/", "wire"),
  }),
  topic({
    rank: 6, slug: "bangladesh-floods-44-dead", category: "climate", region: "South Asia", countries: ["BD"], score: 94,
    storyId: "xzs-bangladesh-floods-20260712",
    zh: { categoryLabel: "孟加拉国洪灾", headlineFact: "孟加拉国洪水与山体滑坡造成至少44人死亡，超过百万人受困", headlineView: "灾难真正拉开差距的，是救援能否抵达最后一户人家", intro: "连续强降雨在孟加拉国东南部引发洪水和山体滑坡，至少44人死亡，超过100万人受困。七个地区约26.8万户家庭受影响，停电、道路损毁和通信中断进一步拖慢救援。", xiaziQuote: "洪水淹没的不只是房屋，也会淹没道路、通信和一个地区自救的能力。", doudouQuote: "水位上涨时，最后一公里往往比第一千公里更难。", footerTakeaway: "今日关键词：洪水、滑坡、断电与救援。" },
    en: { categoryLabel: "Bangladesh Floods", headlineFact: "Floods and landslides kill at least 44 and strand more than one million in Bangladesh", headlineView: "the real test is whether aid reaches the last household", intro: "Heavy rain triggered floods and landslides in southeastern Bangladesh, killing at least 44 and stranding more than one million people. About 268,000 households across seven districts were affected as power cuts, damaged roads and communications failures slowed rescue work.", xiaziQuote: "Floodwater submerges more than homes; it can erase roads, communications and a region's ability to help itself.", doudouQuote: "When water rises, the last mile is often harder than the first thousand.", footerTakeaway: "Keywords: floods, landslides, outages and rescue." },
    source: source(6, "Floods in Bangladesh kill 44, leave over a million stranded", "Reuters", "https://www.reuters.com/business/environment/floods-bangladesh-kill-44-leave-over-million-stranded-2026-07-11/", "wire"),
  }),
  topic({
    rank: 7, slug: "meta-muse-image-privacy", category: "technology", region: "Global", countries: ["US"], score: 93,
    storyId: "xzs-meta-muse-privacy-20260712",
    zh: { categoryLabel: "AI与隐私", headlineFact: "Meta推出AI图像功能仅数日便紧急下架", headlineView: "创新速度再快，也不能把用户同意当成默认选项", intro: "Meta停止使用刚推出的Muse Image功能。该工具可利用公开Instagram账号内容生成和编辑图片，但因自动开启、用户缺乏明确选择权，引发演员、创作者和行业组织批评。Meta承认功能没有达到预期并将其撤下。", xiaziQuote: "技术可以默认开启，权利不能默认放弃。", doudouQuote: "公开可见不是一张无限次复印许可证。", footerTakeaway: "今日关键词：AI图像、同意、隐私与下架。" },
    en: { categoryLabel: "AI and Privacy", headlineFact: "Meta removes its AI image feature only days after launch", headlineView: "fast innovation cannot treat consent as the default", intro: "Meta discontinued the newly launched Muse Image feature, which could use public Instagram content to generate and edit images. Automatic activation and weak user choice drew criticism from actors, creators and industry groups, and Meta acknowledged the feature did not meet expectations.", xiaziQuote: "Technology may switch on by default; rights cannot switch off by default.", doudouQuote: "Publicly visible is not an unlimited photocopy license.", footerTakeaway: "Keywords: AI images, consent, privacy and removal." },
    source: source(7, "Meta scraps AI image feature days after launch following privacy backlash", "Reuters", "https://www.reuters.com/technology/meta-discontinues-ai-image-feature-days-after-launch-2026-07-10/", "wire"),
  }),
  topic({
    rank: 8, slug: "indonesia-prosecutor-corruption", category: "international", region: "Southeast Asia", countries: ["ID"], score: 92,
    storyId: "xzs-indonesia-prosecutor-corruption-20260712",
    zh: { categoryLabel: "印尼反腐", headlineFact: "印尼高级反腐检察官在调查中辞职，警方查获逾2000万美元现金和74公斤黄金", headlineView: "监督者一旦失去监督，权力就会开始自我保护", intro: "印尼总检察院特别犯罪部门负责人Febrie Adriansyah宣布辞职。警方将其列为涉嫌敲诈、受贿和洗钱案件的嫌疑人，并称相关行动查获超过2000万美元现金及约74公斤金条。Febrie否认指控。", xiaziQuote: "反腐最难的部分，从来不是调查别人，而是允许调查者也被调查。", doudouQuote: "监督者也要过安检，尤其是行李特别重的时候。", footerTakeaway: "今日关键词：辞职、调查、现金与黄金。" },
    en: { categoryLabel: "Indonesia Anti-Graft", headlineFact: "A senior Indonesian anti-graft prosecutor resigns as police seize over $20 million and 74 kilograms of gold", headlineView: "when watchdogs lose oversight, power starts protecting itself", intro: "Febrie Adriansyah, head of special crimes at Indonesia's attorney general's office, resigned after police named him a suspect in an extortion, bribery and money-laundering probe. Police reported seizing more than $20 million in cash and about 74 kilograms of gold. He denies wrongdoing.", xiaziQuote: "The hardest part of anti-corruption is not investigating others, but allowing investigators to be investigated.", doudouQuote: "Watchdogs need security checks too, especially when the luggage is unusually heavy.", footerTakeaway: "Keywords: resignation, investigation, cash and gold." },
    source: source(8, "Top Indonesian prosecutor resigns amid corruption probe", "Reuters", "https://www.reuters.com/world/asia-pacific/top-indonesian-prosecutor-resigns-amid-corruption-probe-2026-07-11/", "wire"),
  }),
  topic({
    rank: 9, slug: "india-new-zealand-strategic-partnership", category: "international", region: "Indo-Pacific", countries: ["IN", "NZ"], score: 91,
    storyId: "xzs-india-new-zealand-partnership-20260712",
    zh: { categoryLabel: "印太关系", headlineFact: "印度与新西兰将关系升级为战略伙伴", headlineView: "印太竞争正在把曾经遥远的双边关系，变成新的安全支点", intro: "印度总理莫迪访问奥克兰，这是印度总理40年来首次访问新西兰。两国宣布升级为战略伙伴关系，并签署新的防务合作安排，加强海上安全、经贸和地区事务合作。", xiaziQuote: "国家之间没有永远遥远的关系，只有还没有变得足够重要的利益。", doudouQuote: "地图上的距离没变，战略上的距离突然缩短了。", footerTakeaway: "今日关键词：战略伙伴、防务、海上安全与印太。" },
    en: { categoryLabel: "Indo-Pacific", headlineFact: "India and New Zealand upgrade relations to a strategic partnership", headlineView: "Indo-Pacific competition is turning distant bilateral ties into new security anchors", intro: "Prime Minister Narendra Modi visited Auckland in the first visit by an Indian prime minister to New Zealand in 40 years. The countries upgraded relations to a strategic partnership and signed new defense arrangements covering maritime security, trade and regional cooperation.", xiaziQuote: "Countries are never permanently distant; their interests simply have not yet become important enough.", doudouQuote: "The map did not shrink, but the strategic distance suddenly did.", footerTakeaway: "Keywords: strategic partnership, defense, maritime security and the Indo-Pacific." },
    source: source(9, "New Zealand, India upgrade ties as PM Modi visits Auckland", "Reuters", "https://www.reuters.com/world/asia-pacific/new-zealand-india-upgrade-ties-pm-modi-visits-auckland-2026-07-11/", "wire"),
  }),
];

const issueTargets = [
  "data/current-issue.json", "data/archive/2026-07-12.json",
  "src/data/current-issue.json", "src/data/archive/2026-07-12.json",
  "public/data/current-issue.json", "public/data/archive/2026-07-12.json",
  "apps/web/data/current-issue.json", "apps/web/data/archive/2026-07-12.json",
  "apps/web/src/data/current-issue.json", "apps/web/src/data/archive/2026-07-12.json",
  "apps/web/public/data/current-issue.json", "apps/web/public/data/archive/2026-07-12.json",
];
for (const target of issueTargets) {
  await fs.mkdir(path.dirname(path.join(root, target)), { recursive: true });
  await fs.writeFile(path.join(root, target), `${JSON.stringify(issue, null, 2)}\n`);
}

const poolPath = path.join(root, "data/story-pool.json");
const pool = JSON.parse(await fs.readFile(poolPath, "utf8"));
const retained = pool.filter((entry) => entry.lastIssueDate !== "2026-07-12");
const nextPool = retained.concat(issue.topics.map((entry) => ({
  storyId: entry.storyId,
  storyStatus: entry.storyStatus,
  followupDay: entry.followupDay,
  informationIncrementScore: entry.informationIncrementScore,
  lastIssueDate: issue.issueDate,
  lastTopicSlug: entry.slug,
  category: entry.category,
})));
for (const target of ["data/story-pool.json", "src/data/story-pool.json", "public/data/story-pool.json", "apps/web/data/story-pool.json", "apps/web/src/data/story-pool.json", "apps/web/public/data/story-pool.json"]) {
  await fs.writeFile(path.join(root, target), `${JSON.stringify(nextPool, null, 2)}\n`);
}

console.log(`Updated ${issueTargets.length} issue files and 6 story-pool files.`);
