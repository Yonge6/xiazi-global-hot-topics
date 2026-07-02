import { describe, expect, it } from "vitest";

import {
  buildCharacterConsistencyPrompt,
  characterReferences,
  posterBrandRules,
} from "@/lib/brand/characters";

describe("brand rules", () => {
  it("requires both characters and the website mark", () => {
    expect(posterBrandRules.requiredElements).toContain(
      "Xiazi and Doudoulong both clearly visible",
    );
    expect(posterBrandRules.requiredElements).toContain("xiazishuo.com");
  });

  it("preserves each character's defining silhouette", () => {
    expect(characterReferences.xiazi.immutableTraits).toContain(
      "two exceptionally long, flowing antennae",
    );
    expect(characterReferences.doudoulong.immutableTraits).toContain(
      "teal star-covered wizard hat and teal cloak",
    );
  });

  it("builds a reusable generation prompt", () => {
    const prompt = buildCharacterConsistencyPrompt();
    expect(prompt).toContain("CHARACTER CONSISTENCY REQUIREMENTS");
    expect(prompt).toContain("sunny");
    expect(prompt).toContain("do not generate long text");
  });
});
