import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const files = [
  path.join(root, "data/current-issue.json"),
  path.join(root, "data/archive/2026-06-16.json"),
  path.join(root, "src/data/current-issue.json"),
];

const zh = {
  categoryLabel: "世界杯",
  headlineFact: "佛得角 0:0 逼平西班牙",
  headlineView: "真正的黑马，不是偶尔偷走一分，而是让强队失去熟悉的节奏",
  headlineFull: "佛得角 0:0 逼平西班牙；真正的黑马，不是偶尔偷走一分，而是让强队失去熟悉的节奏。",
  intro: "世界杯新军佛得角在队史首场世界杯比赛中，以 0:0 逼平欧洲冠军西班牙。西班牙掌握近四分之三控球并完成 27 次射门，却始终无法攻破 40 岁门将沃齐尼亚把守的球门。同期其他比赛中，瑞典 5:1 大胜突尼斯，科特迪瓦凭第 90 分钟进球 1:0 绝杀厄瓜多尔，比利时则与埃及 1:1 战平。",
  xiaziQuote: "控球能占据画面，进球才决定答案。",
  doudouQuote: "27 脚都没进，足球果然不发勤奋奖。",
  footerTakeaway: "佛得角面对西班牙承受 27 次射门仍保持零封，门将沃齐尼亚成为比赛焦点；瑞典则由阿亚里梅开二度，以 5:1 取得强势开局；科特迪瓦依靠阿马德·迪亚洛第 90 分钟的进球击败厄瓜多尔。",
};

const en = {
  categoryLabel: "World Cup",
  headlineFact: "Cape Verde hold Spain to 0:0",
  headlineView: "a real dark horse doesn't just steal a point, it makes a powerhouse lose its familiar rhythm",
  headlineFull: "Cape Verde hold Spain to 0:0; a real dark horse doesn't just steal a point, it makes a powerhouse lose its familiar rhythm.",
  intro: "World Cup debutants Cape Verde held European champions Spain to a 0:0 draw in their first-ever World Cup match. Spain had nearly three-quarters of possession and 27 attempts, but could not beat 40-year-old goalkeeper Vozinha. Elsewhere, Sweden beat Tunisia 5:1, Côte d'Ivoire edged Ecuador 1:0 in the 90th minute, and Belgium drew 1:1 with Egypt.",
  xiaziQuote: "Possession controls the picture; goals decide the answer.",
  doudouQuote: "27 shots, no goal. Football gives no prize for effort alone.",
  footerTakeaway: "Cape Verde's clean sheet turned Vozinha into the face of a historic World Cup debut.",
};

const sources = [
  {
    id: "30000000-0000-4000-8000-000000000011",
    topicId: "20000000-0000-4000-8000-000000000001",
    title: "World Cup debutants Cape Verde hold Spain to goalless draw",
    publisher: "Reuters via The Daily Star",
    url: "https://www.thedailystar.net/sports/sports-special/fifa-world-cup-2026/news/world-cup-debutants-cape-verde-hold-spain-goalless-draw-4199751",
    publishedAt: "2026-06-15T00:00:00Z",
    sourceType: "wire",
    sourceTier: 1,
    locale: "en-US",
    isPrimary: true,
  },
  {
    id: "30000000-0000-4000-8000-000000000012",
    topicId: "20000000-0000-4000-8000-000000000001",
    title: "Yasin Ayari brace helps Sweden overwhelm Tunisia",
    publisher: "Field Level Media",
    url: "https://fieldlevelmedia.com/recap/yasin-ayari-brace-helps-sweden-overwhelm-tunisia/",
    publishedAt: "2026-06-15T00:00:00Z",
    sourceType: "publisher",
    sourceTier: 1,
    locale: "en-US",
    isPrimary: false,
  },
  {
    id: "30000000-0000-4000-8000-000000000013",
    topicId: "20000000-0000-4000-8000-000000000001",
    title: "Amad Diallo scores in the 90th minute to lift Ivory Coast past Ecuador",
    publisher: "Associated Press via Times Union",
    url: "https://www.timesunion.com/sports/article/amad-diallo-scores-in-the-90th-minute-to-lift-22305148.php",
    publishedAt: "2026-06-15T00:00:00Z",
    sourceType: "wire",
    sourceTier: 1,
    locale: "en-US",
    isPrimary: false,
  },
  {
    id: "30000000-0000-4000-8000-000000000014",
    topicId: "20000000-0000-4000-8000-000000000001",
    title: "Belgium 1-1 Egypt: World Cup 2026",
    publisher: "The Guardian",
    url: "https://www.theguardian.com/football/2026/jun/15/belgium-egypt-world-cup-2026-group-g-match-report",
    publishedAt: "2026-06-15T00:00:00Z",
    sourceType: "publisher",
    sourceTier: 1,
    locale: "en-US",
    isPrimary: false,
  },
];

async function updateIssue(file) {
  const issue = JSON.parse(await readFile(file, "utf8"));
  const topic = issue.topics.find((item) => item.rank === 1);
  topic.region = "North America";
  topic.countryCodes = ["CV", "ES", "SE", "TN", "CI", "EC", "BE", "EG"];
  topic.storyId = "world_cup_cape_verde_spain_2026";
  topic.storyStatus = "new";
  topic.followupDay = 1;
  topic.informationIncrementScore = 100;
  topic.scoreTotal = 96;
  topic.localizations["zh-CN"] = zh;
  topic.localizations["en-US"] = en;
  topic.sources = sources;
  issue.assetVersion = `2026-06-16-world-cup-cape-verde-${Date.now()}`;
  await writeFile(file, `${JSON.stringify(issue, null, 2)}\n`);
}

await Promise.all(files.map(updateIssue));

const poolPath = path.join(root, "data/story-pool.json");
const storyPool = JSON.parse(await readFile(poolPath, "utf8"));
const existingSweden = storyPool.stories.find((story) => story.storyId === "world_cup_sweden_tunisia_2026");
if (existingSweden) existingSweden.status = "finished";
const capeVerde = storyPool.stories.find((story) => story.storyId === "world_cup_cape_verde_spain_2026");
if (capeVerde) {
  capeVerde.status = "new";
  capeVerde.lastSeen = "2026-06-16";
  capeVerde.followupDay = 1;
  capeVerde.informationIncrementScore = 100;
  capeVerde.latestHeadline = zh.headlineFact;
} else {
  storyPool.stories.push({
    storyId: "world_cup_cape_verde_spain_2026",
    status: "new",
    firstSeen: "2026-06-16",
    lastSeen: "2026-06-16",
    followupDay: 1,
    informationIncrementScore: 100,
    latestHeadline: zh.headlineFact,
  });
}
storyPool.updatedAt = new Date().toISOString();
await writeFile(poolPath, `${JSON.stringify(storyPool, null, 2)}\n`);

const issue = JSON.parse(await readFile(files[0], "utf8"));
console.log(JSON.stringify({
  title: issue.topics[0].localizations["zh-CN"].headlineFull,
  storyId: issue.topics[0].storyId,
  sources: issue.topics[0].sources.length,
}, null, 2));
