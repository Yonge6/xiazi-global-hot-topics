import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const outputDir = path.join(root, "public/posters/en");
const thumbnailDir = path.join(root, "public/posters/thumb/en");
const xiazi = await fs.readFile(path.join(root, "public/brand/characters/xiazi/xiazi-master-front.png"));
const doudou = await fs.readFile(path.join(root, "public/brand/characters/doudou/doudou-master-front.png"));

const topics = [
  {
    file: "ai-governance",
    category: "TECHNOLOGY",
    fact: "AI GOVERNANCE MOVES FROM PRINCIPLES TO ENFORCEMENT",
    view: "THE DECISIVE RACE IS NOW INSTITUTIONAL CAPACITY",
    insight: "In the next AI cycle, rules become infrastructure.",
    accent: "#b93427",
    symbol: "AI / 01",
  },
  {
    file: "supply-chain",
    category: "BUSINESS",
    fact: "GLOBAL SUPPLY CHAINS KEEP REDRAWING THEIR ROUTES",
    view: "RESILIENCE IS REPLACING EFFICIENCY AS THE PREMIUM METRIC",
    insight: "Supply-chain value is ultimately measured in rough weather.",
    accent: "#155f61",
    symbol: "ROUTE / 02",
  },
  {
    file: "climate-adaptation",
    category: "CLIMATE",
    fact: "EXTREME WEATHER IS FORCING CITIES TO REBUILD",
    view: "ADAPTATION HAS BECOME A TEST OF PUBLIC GOVERNANCE",
    insight: "Climate adaptation means redesigning everyday life.",
    accent: "#b93427",
    symbol: "CITY / 03",
  },
  {
    file: "space-orbit",
    category: "SCIENCE",
    fact: "LOW EARTH ORBIT IS BECOMING INCREASINGLY CROWDED",
    view: "SPACE IS TURNING INTO AN INDUSTRIAL COMMONS",
    insight: "A real space economy must take responsibility for shared space.",
    accent: "#b89963",
    symbol: "ORBIT / 04",
  },
  {
    file: "public-health",
    category: "WORLD",
    fact: "COUNTRIES STRENGTHEN PUBLIC-HEALTH WARNING NETWORKS",
    view: "THE NEXT CRISIS GAP WILL BE DEFINED BY PREPAREDNESS",
    insight: "Public confidence is built before the emergency.",
    accent: "#155f61",
    symbol: "HEALTH / 05",
  },
  {
    file: "world-cup",
    category: "SPORT",
    fact: "THE WORLD CUP ENTERS ITS NORTH AMERICAN CHAPTER",
    view: "GLOBAL ATTENTION IS GATHERING AGAIN",
    insight: "The score stops at full time. The emotion does not.",
    accent: "#b93427",
    symbol: "WORLD CUP / 06",
  },
  {
    file: "cultural-heritage",
    category: "CULTURE",
    fact: "DIGITAL TOOLS ARE REBUILDING HERITAGE ARCHIVES",
    view: "PRESERVING MEMORY MEANS CONFRONTING TECHNOLOGY'S LIFESPAN",
    insight: "Heritage survives through responsibility, not storage alone.",
    accent: "#b89963",
    symbol: "MEMORY / 07",
  },
  {
    file: "clean-energy",
    category: "BUSINESS",
    fact: "CLEAN-ENERGY GROWTH IS TESTING POWER GRIDS",
    view: "THE BOTTLENECK IS MOVING FROM GENERATION TO COORDINATION",
    insight: "The next energy contest happens inside the invisible grid.",
    accent: "#155f61",
    symbol: "GRID / 08",
  },
  {
    file: "high-seas",
    category: "WORLD",
    fact: "HIGH-SEAS PROTECTION MOVES TOWARD IMPLEMENTATION",
    view: "GLOBAL COMMONS NEED VERIFIABLE ACTION",
    insight: "Shared resources demand shared responsibility.",
    accent: "#b93427",
    symbol: "OCEAN / 09",
  },
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrap(value, max) {
  const words = value.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > max && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function textLines(lines, x, y, size, lineHeight, color, weight = 700) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" fill="${color}" font-family="Georgia, Times New Roman, serif" font-size="${size}" font-weight="${weight}" letter-spacing="-1">${escapeXml(line)}</text>`,
    )
    .join("");
}

function posterSvg(topic, index) {
  const factLines = wrap(topic.fact, 25);
  const viewLines = wrap(topic.view, 28);
  const insightLines = wrap(topic.insight, 48);
  const xiaziData = `data:image/png;base64,${xiazi.toString("base64")}`;
  const doudouData = `data:image/png;base64,${doudou.toString("base64")}`;
  const rings = Array.from({ length: 8 }, (_, ring) => {
    const radius = 105 + ring * 54;
    return `<circle cx="512" cy="1165" r="${radius}" fill="none" stroke="${ring % 2 ? topic.accent : "#155f61"}" stroke-width="${ring % 3 === 0 ? 3 : 1}" opacity="${0.42 - ring * 0.035}"/>`;
  }).join("");
  const rays = Array.from({ length: 18 }, (_, ray) => {
    const angle = (Math.PI * 2 * ray) / 18;
    const x = 512 + Math.cos(angle) * 460;
    const y = 1165 + Math.sin(angle) * 460;
    return `<line x1="512" y1="1165" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#155f61" stroke-width="1" opacity=".25"/>`;
  }).join("");

  return Buffer.from(`
    <svg width="1024" height="2048" viewBox="0 0 1024 2048" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="paper"><feTurbulence baseFrequency=".55" numOctaves="4" seed="${index + 11}" type="fractalNoise"/><feColorMatrix values="0 0 0 0 0.45 0 0 0 0 0.39 0 0 0 0 0.28 0 0 0 .12 0"/></filter>
        <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#155f61" stroke-width="1" opacity=".12"/></pattern>
        <clipPath id="frame"><rect x="18" y="18" width="988" height="2012" rx="2"/></clipPath>
      </defs>
      <rect width="1024" height="2048" fill="#f2ead8"/>
      <rect width="1024" height="2048" filter="url(#paper)" opacity=".55"/>
      <rect x="18" y="18" width="988" height="2012" fill="none" stroke="#9b7c48" stroke-width="2"/>
      <path d="M48 88H976M48 682H976M48 1732H976M48 1960H976" stroke="#9b7c48" stroke-width="1"/>

      <text x="54" y="68" fill="#101418" font-family="Georgia, Times New Roman, serif" font-size="27" font-weight="700" letter-spacing="2">XIAZI GLOBAL HOT TOPICS</text>
      <text x="970" y="68" text-anchor="end" fill="${topic.accent}" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="3">${topic.category}  ·  2026.06.14</text>

      ${textLines(factLines, 54, 150, 52, 60, "#101418")}
      ${textLines(viewLines, 54, 150 + factLines.length * 60 + 28, 42, 50, topic.accent)}
      <text x="54" y="630" fill="#69645b" font-family="Arial, sans-serif" font-size="17" letter-spacing="2">FACT  /  VIEWPOINT  /  PRIMARY SOURCE</text>

      <rect x="48" y="720" width="928" height="960" fill="url(#grid)"/>
      ${rays}
      ${rings}
      <circle cx="512" cy="1165" r="84" fill="${topic.accent}" opacity=".92"/>
      <text x="512" y="1152" text-anchor="middle" fill="#fffaf0" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="3">${topic.symbol}</text>
      <text x="512" y="1186" text-anchor="middle" fill="#fffaf0" font-family="Arial, sans-serif" font-size="14" letter-spacing="2">THE WORLD YESTERDAY</text>
      <path d="M128 934C288 770 438 824 512 1165S788 1514 902 1320" fill="none" stroke="${topic.accent}" stroke-width="8" opacity=".72"/>
      <path d="M90 1324C252 1490 366 1400 512 1165S768 770 930 902" fill="none" stroke="#155f61" stroke-width="5" opacity=".65"/>

      <image href="${xiaziData}" x="52" y="1142" width="430" height="520" preserveAspectRatio="xMidYMax meet"/>
      <image href="${doudouData}" x="596" y="1200" width="350" height="452" preserveAspectRatio="xMidYMax meet"/>

      <text x="54" y="1784" fill="${topic.accent}" font-family="Arial, sans-serif" font-size="16" font-weight="700" letter-spacing="4">EDITORIAL INSIGHT</text>
      ${textLines(insightLines, 54, 1848, 36, 46, "#101418", 600)}
      <text x="54" y="1988" fill="#155f61" font-family="Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="5">BEIJING 05:00  ·  ISSUE 193</text>
      <text x="970" y="1988" text-anchor="end" fill="#101418" font-family="Georgia, Times New Roman, serif" font-size="24" font-weight="700" letter-spacing="2">xiazishuo.com</text>
    </svg>
  `);
}

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(thumbnailDir, { recursive: true });

for (const [index, topic] of topics.entries()) {
  const posterPath = path.join(outputDir, `${topic.file}.png`);
  await sharp(posterSvg(topic, index)).png({ compressionLevel: 9 }).toFile(posterPath);
  await sharp(posterPath)
    .resize(640, 1280, { fit: "cover" })
    .webp({ quality: 82, effort: 5 })
    .toFile(path.join(thumbnailDir, `${topic.file}.webp`));
}

console.log(`Rendered ${topics.length} English posters.`);
