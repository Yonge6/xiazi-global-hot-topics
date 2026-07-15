import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PRODUCTION_DOMAIN, PRODUCTION_ORIGIN, productionUrl } from "@/lib/site/domain";

const retiredDomain = ["pluto", "hk"].join(".");
const sourceRoots = ["src", "scripts", "docs"];
const rootFiles = ["README.md", "next.config.ts", "vercel.json"];
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".md", ".json"]);

async function collectTextFiles(entry: string): Promise<string[]> {
  const statEntries = await readdir(entry, { withFileTypes: true });
  const files = await Promise.all(
    statEntries.map(async (item) => {
      const itemPath = path.join(entry, item.name);
      if (item.isDirectory()) return collectTextFiles(itemPath);
      return textExtensions.has(path.extname(item.name)) ? [itemPath] : [];
    }),
  );
  return files.flat();
}

describe("production domain", () => {
  it("uses xiazishuo.com as the canonical origin", () => {
    expect(PRODUCTION_DOMAIN).toBe("xiazishuo.com");
    expect(PRODUCTION_ORIGIN).toBe("https://xiazishuo.com");
    expect(productionUrl("/zh/")).toBe("https://xiazishuo.com/zh/");
  });

  it("does not reference the retired domain in production source or runbooks", async () => {
    const nestedFiles = (await Promise.all(sourceRoots.map(collectTextFiles))).flat();
    const hits: string[] = [];

    for (const file of [...rootFiles, ...nestedFiles]) {
      const content = await readFile(file, "utf8");
      if (content.toLowerCase().includes(retiredDomain)) hits.push(file);
    }

    expect(hits).toEqual([]);
  });
});
