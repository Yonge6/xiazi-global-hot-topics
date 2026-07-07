import { describe, expect, it } from "vitest";

import { parseBatchCopy, posterOrder } from "@/lib/studio/batch-publish";

const block = (rank: number) => `NO.${String(rank).padStart(2, "0")} 分类${rank}｜中文标题${rank}；中文观点${rank}
中文正文：中文正文 ${rank}
English Version: English intro ${rank}; English view ${rank}
推荐阅读来源：Source ${rank}
虾子曰评价：Xiazi ${rank}
豆豆龙评价：Doudou ${rank}`;

describe("batch publish helpers", () => {
  it("parses nine numbered bilingual story blocks", () => {
    const stories = parseBatchCopy(Array.from({ length: 9 }, (_, index) => block(index + 1)).join("\n\n"));
    expect(stories).toHaveLength(9);
    expect(stories[0].rank).toBe(1);
    expect(stories[0].categoryLabel).toBe("分类1");
    expect(stories[0].zh.title).toBe("中文标题1；中文观点1");
    expect(stories[8].en.intro).toBe("English intro 9; English view 9");
  });

  it("extracts poster order from common mobile filenames", () => {
    expect(posterOrder("NO.01-中文.png")).toBe(1);
    expect(posterOrder("海报 09 英文.png")).toBe(9);
    expect(posterOrder("poster-without-number.png")).toBe(99);
  });
});
