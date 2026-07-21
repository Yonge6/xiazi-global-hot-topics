import {
  REVIEW_PROTOCOL_VERSION,
  SEMANTIC_REVIEW_RULESET_VERSION,
  VISUAL_REVIEW_RULESET_VERSION,
  semanticReviewRequestSchema,
  semanticReviewResponseSchema,
  visualReviewRequestSchema,
  visualReviewResponseSchema,
  type SemanticReviewPayload,
  type VisualReviewPayload,
} from "@xiazi/contracts";
import { reviewInputHash } from "@xiazi/domain";
import { ZodError } from "zod";

import { authenticateReviewRequest } from "./auth";
import { readBoundedBody } from "./body";
import { withConcurrencyLimit } from "./concurrency";
import { reviewerConfigFromEnv, type ReviewerConfig } from "./config";
import { logReview } from "./log";
import { OpenAICompatibleReviewerProvider, type ReviewerProvider } from "./provider";
import { replayStoreFromConfig, type ReplayStore } from "./replay-store";

type ReviewKind = "semantic" | "visual";
type HandlerDependencies = {
  config?: ReviewerConfig;
  provider?: ReviewerProvider;
  replayStore?: ReplayStore;
  now?: () => Date;
};

function failureStatus(code: string) {
  if (code === "REVIEW_REQUEST_TOO_LARGE") return 413;
  if (code === "REVIEWER_CONCURRENCY_LIMIT") return 429;
  if (code === "REVIEW_AUTH_BEARER_INVALID") return 401;
  if (code.startsWith("REVIEW_AUTH_")) return 403;
  if (code.startsWith("REVIEWER_CONFIG_") || code.includes("REPLAY_STORE") || code.includes("UNAVAILABLE") || code.includes("TIMEOUT")) return 503;
  if (code.startsWith("REVIEW_PROVIDER_")) return 502;
  return 422;
}

function jsonError(code: string, requestId: string | null) {
  return Response.json({ error: { code, requestId, failClosed: true } }, { status: failureStatus(code) });
}

function semanticResultMatches(payload: SemanticReviewPayload, result: unknown) {
  const value = result as {
    sourceId?: unknown;
    topicId?: unknown;
    correctionStatus?: unknown;
    claimResults?: Array<{ field: string; locale: string; text: string }>;
  };
  if (value.sourceId !== payload.source.sourceId || value.topicId !== payload.source.topicId) {
    throw new Error("SEMANTIC_REVIEW_SOURCE_IDENTITY_MISMATCH");
  }
  const expected = new Map(payload.source.claims.map((claim) => [`${claim.field}:${claim.locale}`, claim.text]));
  const actual = new Map<string, string>();
  for (const claim of value.claimResults || []) {
    const key = `${claim.field}:${claim.locale}`;
    if (actual.has(key) || !expected.has(key) || expected.get(key) !== claim.text) {
      throw new Error("SEMANTIC_REVIEW_CLAIM_IDENTITY_MISMATCH");
    }
    actual.set(key, claim.text);
  }
  if (actual.size !== expected.size) throw new Error("SEMANTIC_REVIEW_CLAIMS_INCOMPLETE");
  if (payload.source.retractionMarkerDetected && value.correctionStatus !== "retracted") {
    throw new Error("SEMANTIC_REVIEW_RETRACTION_IGNORED");
  }
  if (payload.source.correctionMarkerDetected && value.correctionStatus === "clear") {
    throw new Error("SEMANTIC_REVIEW_CORRECTION_IGNORED");
  }
}

function slotKey(topicId: string, locale: string) {
  return `${topicId}:${locale}`;
}

function pairKey(input: { leftTopicId: string; leftLocale: string; rightTopicId: string; rightLocale: string }) {
  return [slotKey(input.leftTopicId, input.leftLocale), slotKey(input.rightTopicId, input.rightLocale)].sort().join("|");
}

function visualResultMatches(payload: VisualReviewPayload, result: unknown) {
  const value = result as {
    assetBatchId?: unknown;
    reviews?: Array<{ topicId: string; locale: string }>;
    comparisons?: Array<{ leftTopicId: string; leftLocale: string; rightTopicId: string; rightLocale: string }>;
  };
  if (value.assetBatchId !== payload.assetBatchId) throw new Error("VISUAL_REVIEW_BATCH_IDENTITY_MISMATCH");
  const expectedSlots = new Set(payload.posters.map((poster) => slotKey(poster.topicId, poster.locale)));
  const actualSlots = new Set((value.reviews || []).map((review) => slotKey(review.topicId, review.locale)));
  if (actualSlots.size !== expectedSlots.size || [...expectedSlots].some((key) => !actualSlots.has(key))) {
    throw new Error("VISUAL_REVIEW_SLOTS_MISMATCH");
  }
  const expectedPairs = new Set<string>();
  const slots = [...expectedSlots];
  for (let left = 0; left < slots.length; left += 1) {
    for (let right = left + 1; right < slots.length; right += 1) {
      expectedPairs.add([slots[left], slots[right]].sort().join("|"));
    }
  }
  const actualPairs = new Set((value.comparisons || []).map(pairKey));
  if (actualPairs.size !== expectedPairs.size || [...expectedPairs].some((key) => !actualPairs.has(key))) {
    throw new Error("VISUAL_REVIEW_COMPARISONS_MISMATCH");
  }
}

export async function handleReviewRequest(request: Request, kind: ReviewKind, dependencies: HandlerDependencies = {}) {
  const startedAt = Date.now();
  let requestId: string | null = null;
  let candidateId: string | null = null;
  let rulesetVersion: string | null = null;
  let inputHash: string | null = null;
  let config: ReviewerConfig | undefined;
  try {
    config = dependencies.config || reviewerConfigFromEnv();
    const path = `/api/review/${kind}`;
    const rawBody = await readBoundedBody(request, config.maxBodyBytes);
    const replayStore = dependencies.replayStore || replayStoreFromConfig(config);
    const auth = await authenticateReviewRequest({
      request,
      rawBody,
      path,
      bearerSecret: config.bearerSecret,
      hmacSecret: config.hmacSecret,
      replayStore,
      now: dependencies.now,
    });
    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      throw new Error("REVIEW_REQUEST_MALFORMED_JSON");
    }
    const parsed = kind === "semantic"
      ? semanticReviewRequestSchema.parse(json)
      : visualReviewRequestSchema.parse(json);
    requestId = parsed.metadata.requestId;
    rulesetVersion = parsed.metadata.rulesetVersion;
    inputHash = parsed.metadata.inputHash;
    if (parsed.metadata.requestedAt !== auth.timestamp || parsed.metadata.nonce !== auth.nonce) {
      throw new Error("REVIEW_REQUEST_AUTH_METADATA_MISMATCH");
    }
    const calculatedHash = await reviewInputHash(parsed.payload);
    if (calculatedHash !== parsed.metadata.inputHash) throw new Error("REVIEW_REQUEST_INPUT_HASH_MISMATCH");
    candidateId = kind === "semantic"
      ? (parsed.payload as SemanticReviewPayload).releaseCandidateId
      : (parsed.payload as VisualReviewPayload).assetBatchId;
    const provider = dependencies.provider || new OpenAICompatibleReviewerProvider(config);
    const result = await withConcurrencyLimit(config.maxConcurrency, () => kind === "semantic"
      ? provider.semantic(parsed.payload as SemanticReviewPayload)
      : provider.visual(parsed.payload as VisualReviewPayload));
    const reviewedAt = (dependencies.now || (() => new Date()))().toISOString();
    const response = {
      metadata: {
        protocolVersion: REVIEW_PROTOCOL_VERSION,
        rulesetVersion: kind === "semantic" ? SEMANTIC_REVIEW_RULESET_VERSION : VISUAL_REVIEW_RULESET_VERSION,
        provider: config.provider,
        model: config.model,
        modelVersion: config.modelVersion,
        requestId,
        inputHash,
        reviewedAt,
        durationMs: Date.now() - startedAt,
      },
      result,
    };
    const validated = kind === "semantic"
      ? semanticReviewResponseSchema.parse(response)
      : visualReviewResponseSchema.parse(response);
    if (kind === "semantic") semanticResultMatches(parsed.payload as SemanticReviewPayload, validated.result);
    else visualResultMatches(parsed.payload as VisualReviewPayload, validated.result);
    logReview({
      requestId,
      candidateId,
      provider: config.provider,
      model: config.model,
      rulesetVersion,
      inputHash,
      status: "passed",
      durationMs: Date.now() - startedAt,
      errorCode: null,
      failClosed: false,
    });
    return Response.json(validated, { status: 200 });
  } catch (error) {
    const code = error instanceof ZodError
      ? "REVIEW_PROTOCOL_SCHEMA_INVALID"
      : error instanceof Error ? error.message.split("\n")[0].slice(0, 160) : "REVIEWER_UNKNOWN_ERROR";
    logReview({
      requestId,
      candidateId,
      provider: config?.provider || null,
      model: config?.model || null,
      rulesetVersion,
      inputHash,
      status: "failed",
      durationMs: Date.now() - startedAt,
      errorCode: code,
      failClosed: true,
    });
    return jsonError(code, requestId);
  }
}
