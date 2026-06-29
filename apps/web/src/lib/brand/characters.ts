export const brandPalette = {
  ink: "#0D3B4C",
  teal: "#1F6F7A",
  paper: "#F6F2E9",
  ivory: "#EEDFC1",
  champagne: "#DBB98A",
  xiaziOrange: "#E44B2E",
  xiaziSky: "#CFE6EA",
  xiaziPink: "#F7B6C2",
  doudouOrange: "#FF8A22",
  doudouGold: "#FFD76B",
  doudouBlue: "#4DA6C6",
} as const;

export const characterReferences = {
  xiazi: {
    nameZh: "虾子曰",
    nameEn: "Xiazi Says",
    productionAsset: "/brand/xiazi-reference.png",
    referenceSheet: "/brand/references/xiazi-character-sheet.png",
    fullBodyReference: "/brand/references/xiazi-fullbody-reference.png",
    immutableTraits: [
      "red-orange anthropomorphic shrimp body",
      "two exceptionally long, flowing antennae",
      "large powerful claws",
      "wise, calm and subtly humorous expression",
      "elegant Chinese long robe with teal edging",
    ],
    allowedVariation: [
      "topic-relevant robe details",
      "expression and gesture",
      "handheld prop",
      "camera angle and action",
    ],
    forbidden: [
      "missing or shortened antennae",
      "ordinary human hands",
      "realistic seafood or horror styling",
      "generic lobster anatomy",
      "western formalwear replacing the Chinese robe",
    ],
  },
  doudoulong: {
    nameZh: "豆豆龙",
    nameEn: "Doudoulong",
    productionAsset: "/brand/doudoulong-reference.png",
    referenceSheet: "/brand/references/doudoulong-character-sheet.png",
    fullBodyReference: "/brand/references/doudoulong-fullbody-reference.png",
    plushTurnaround: "/brand/references/doudoulong-plush-turnaround.png",
    immutableTraits: [
      "warm orange small dragon body",
      "two ivory horns",
      "small orange wings with golden inner membranes",
      "long rounded tail",
      "teal star-covered wizard hat and teal cloak",
      "gold star wand",
      "curious, brave and playful personality",
    ],
    allowedVariation: [
      "topic-relevant expression",
      "gesture and pose",
      "small supporting prop",
      "hat and cloak accessories that preserve the silhouette",
    ],
    forbidden: [
      "missing horns, wings, tail, hat or wand",
      "extra limbs",
      "dinosaur or mammal anatomy",
      "photoreal monster or horror styling",
      "formal suit or unrelated costume replacing the wizard outfit",
    ],
  },
} as const;

export const posterBrandRules = {
  emotionalTone: [
    "bright",
    "sunny",
    "hopeful",
    "energetic",
    "constructive rather than alarmist",
  ],
  requiredElements: [
    "Xiazi and Doudoulong both clearly visible",
    "Beijing Time on Chinese posters",
    "Greenwich Mean Time on English posters",
    "xiazishuo.com",
    "scannable topic-specific QR code",
  ],
  compositionRules: [
    "characters must not overlap the title safe zone",
    "preserve recognizable character silhouettes",
    "vary clothing details, expression, action and props by topic",
    "do not generate long text inside the AI art base",
    "leave clean areas for the independent SVG typography layer",
  ],
} as const;

export function buildCharacterConsistencyPrompt() {
  const xiazi = characterReferences.xiazi;
  const doudoulong = characterReferences.doudoulong;

  return [
    "CHARACTER CONSISTENCY REQUIREMENTS:",
    `Xiazi: ${xiazi.immutableTraits.join("; ")}.`,
    `Never: ${xiazi.forbidden.join("; ")}.`,
    `Doudoulong: ${doudoulong.immutableTraits.join("; ")}.`,
    `Never: ${doudoulong.forbidden.join("; ")}.`,
    `Tone: ${posterBrandRules.emotionalTone.join(", ")}.`,
    `Composition: ${posterBrandRules.compositionRules.join("; ")}.`,
  ].join("\n");
}
