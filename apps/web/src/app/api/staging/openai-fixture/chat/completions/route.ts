import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type OpenAIMessage = {
  role?: unknown;
  content?: unknown;
};

type SemanticPayload = {
  releaseCandidateId: string;
  source: {
    sourceId: string;
    topicId: string;
    correctionMarkerDetected: boolean;
    retractionMarkerDetected: boolean;
    claims: Array<{ field: string; locale: string; text: string }>;
  };
};

type VisualPayload = {
  assetBatchId: string;
  posters: Array<{
    topicId: string;
    locale: "zh" | "en";
    expectedNumber: number;
    expectedTitle: string;
  }>;
};

function unavailable() {
  return NextResponse.json({ message: "Not found" }, { status: 404 });
}

function openAIEnvelope(result: unknown) {
  return NextResponse.json({
    id: "staging-fault-injection",
    object: "chat.completion",
    created: 0,
    model: "staging-fault-provider-v1",
    choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(result) } }],
  }, { headers: { "Cache-Control": "no-store" } });
}

function userPayload(messages: OpenAIMessage[]) {
  const user = messages.find((message) => message.role === "user");
  if (!user) throw new Error("FAULT_PROVIDER_USER_MESSAGE_MISSING");
  if (typeof user.content === "string") return JSON.parse(user.content) as SemanticPayload;
  if (Array.isArray(user.content)) {
    const text = user.content.find((item) => item && typeof item === "object" && (item as { type?: unknown }).type === "text") as { text?: unknown } | undefined;
    if (!text || typeof text.text !== "string") throw new Error("FAULT_PROVIDER_TEXT_PART_MISSING");
    return JSON.parse(text.text) as VisualPayload;
  }
  throw new Error("FAULT_PROVIDER_CONTENT_INVALID");
}

function faultMode(rawBody: string) {
  return rawBody.match(/fault-(401|429|500|malformed|timeout|unsupported|uncertain|correction-ignored|retraction-ignored|visual-ip|visual-incomplete|visual-theme|visual-duplicate)/)?.[1] || "supported";
}

function semanticResult(payload: SemanticPayload, mode: string) {
  const status = mode === "unsupported" ? "unsupported" : mode === "uncertain" ? "uncertain" : "supported";
  const correctionStatus = mode === "correction-ignored" || mode === "retraction-ignored"
    ? "clear"
    : payload.source.retractionMarkerDetected
      ? "retracted"
      : payload.source.correctionMarkerDetected ? "corrected" : "clear";
  return {
    sourceId: payload.source.sourceId,
    topicId: payload.source.topicId,
    correctionStatus,
    rationale: `Controlled staging fault provider result: ${mode}.`,
    claimResults: payload.source.claims.map((claim) => ({
      ...claim,
      status,
      rationale: `Controlled ${status} claim for fail-closed staging verification.`,
      evidenceLocator: "staging-fault-provider",
    })),
  };
}

function visualResult(payload: VisualPayload, mode: string) {
  const reviews = payload.posters.map((poster, index) => ({
    topicId: poster.topicId,
    locale: poster.locale,
    ocrText: `${poster.expectedTitle} xiazishuo.com STAGING ONLY controlled OCR evidence`,
    detectedNumber: poster.expectedNumber,
    detectedLanguage: poster.locale,
    titleMatches: true,
    dateMatches: true,
    siteMatches: true,
    themeMatches: true,
    xiaziMatches: !(mode === "visual-ip" && index === 0),
    doudoulongMatches: true,
    nearDuplicate: false,
    needsHumanReview: false,
    rationale: `Controlled staging visual result: ${mode}.`,
  }));
  const comparisons = [];
  for (let left = 0; left < payload.posters.length; left += 1) {
    for (let right = left + 1; right < payload.posters.length; right += 1) {
      const sameTheme = payload.posters[left].topicId === payload.posters[right].topicId;
      comparisons.push({
        leftTopicId: payload.posters[left].topicId,
        leftLocale: payload.posters[left].locale,
        rightTopicId: payload.posters[right].topicId,
        rightLocale: payload.posters[right].locale,
        semanticSimilarity: sameTheme ? 0.75 : 0.2,
        sameTheme,
        nearDuplicate: false,
        needsHumanReview: false,
        rationale: sameTheme ? "Controlled bilingual topic pair." : "Controlled distinct topic pair.",
      });
    }
  }
  if (mode === "visual-theme") {
    const sameTopic = comparisons.find((item) => item.leftTopicId === item.rightTopicId);
    if (sameTopic) sameTopic.sameTheme = false;
  }
  if (mode === "visual-duplicate") {
    const distinct = comparisons.find((item) => item.leftTopicId !== item.rightTopicId);
    if (distinct) {
      distinct.semanticSimilarity = 0.99;
      distinct.nearDuplicate = true;
      distinct.needsHumanReview = true;
    }
  }
  if (mode === "visual-incomplete") comparisons.pop();
  return { assetBatchId: payload.assetBatchId, reviews, comparisons };
}

export async function POST(request: Request) {
  const token = process.env.STAGING_FAULT_PROVIDER_TOKEN;
  if (process.env.RELEASE_ENVIRONMENT !== "staging"
    || process.env.STAGING_FAULT_PROVIDER_ENABLED !== "true"
    || !token
    || request.headers.get("authorization") !== `Bearer ${token}`) {
    return unavailable();
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > 1_000_000) {
    return NextResponse.json({ error: { message: "Request too large" } }, { status: 413 });
  }
  const mode = faultMode(rawBody);
  if (mode === "401" || mode === "429" || mode === "500") {
    return NextResponse.json({ error: { message: `Controlled staging provider ${mode}` } }, { status: Number(mode) });
  }
  if (mode === "malformed") {
    return new NextResponse("{controlled-malformed-response", {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
  if (mode === "timeout") {
    const delay = Number.parseInt(process.env.STAGING_FAULT_PROVIDER_TIMEOUT_MS || "4000", 10);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  try {
    const requestBody = JSON.parse(rawBody) as { messages?: OpenAIMessage[] };
    const payload = userPayload(requestBody.messages || []);
    if ("source" in payload) return openAIEnvelope(semanticResult(payload, mode));
    return openAIEnvelope(visualResult(payload, mode));
  } catch {
    return NextResponse.json({ error: { message: "Controlled staging provider request invalid" } }, { status: 422 });
  }
}
