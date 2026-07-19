import type { z } from "zod";

import {
  REVIEW_PROTOCOL_VERSION,
  type SemanticReviewPayload,
  type SemanticReviewResponse,
  type VisualReviewPayload,
  type VisualReviewResponse,
  semanticReviewResponseSchema,
  visualReviewResponseSchema,
} from "@xiazi/contracts";
import { reviewInputHash, signReviewRequest } from "@xiazi/domain";

type ReviewerRequest<TPayload, TResponse> = {
  endpoint: string | undefined;
  path: "/api/review/semantic" | "/api/review/visual";
  rulesetVersion: string;
  payload: TPayload;
  schema: z.ZodType<TResponse>;
  unavailableCode: string;
  failedCode: string;
  invalidCode: string;
};

const responseLimitBytes = 2 * 1024 * 1024;

function requireReviewerEndpoint(value: string | undefined, unavailableCode: string) {
  const bearerSecret = process.env.RELEASE_REVIEW_BEARER_SECRET;
  const signingSecret = process.env.RELEASE_REVIEW_SIGNING_SECRET;
  if (!value || !bearerSecret || !signingSecret) throw new Error(unavailableCode);
  const endpoint = new URL(value);
  if (process.env.NODE_ENV === "production" && endpoint.protocol !== "https:") {
    throw new Error(`${unavailableCode}:HTTPS_REQUIRED`);
  }
  return { endpoint, bearerSecret, signingSecret };
}

async function boundedResponseText(response: Response) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > responseLimitBytes) throw new Error("REVIEW_RESPONSE_TOO_LARGE");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > responseLimitBytes) {
      await reader.cancel();
      throw new Error("REVIEW_RESPONSE_TOO_LARGE");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

async function postReview<TPayload, TResponse>(input: ReviewerRequest<TPayload, TResponse>): Promise<TResponse> {
  const auth = requireReviewerEndpoint(input.endpoint, input.unavailableCode);
  const requestId = crypto.randomUUID();
  const requestedAt = new Date().toISOString();
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const inputHash = await reviewInputHash(input.payload);
  const envelope = {
    metadata: {
      protocolVersion: REVIEW_PROTOCOL_VERSION,
      rulesetVersion: input.rulesetVersion,
      requestId,
      requestedAt,
      nonce,
      inputHash,
    },
    payload: input.payload,
  };
  const rawBody = JSON.stringify(envelope);
  const signature = await signReviewRequest(auth.signingSecret, {
    timestamp: requestedAt,
    nonce,
    method: "POST",
    path: input.path,
    rawBody,
  });
  const timeoutMs = Number.parseInt(process.env.RELEASE_REVIEW_TIMEOUT_MS || "45000", 10);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(auth.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.bearerSecret}`,
        "X-Xiazi-Review-Timestamp": requestedAt,
        "X-Xiazi-Review-Nonce": nonce,
        "X-Xiazi-Review-Signature": signature,
      },
      body: rawBody,
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error(`${input.failedCode}:TIMEOUT`);
    throw new Error(`${input.failedCode}:UNAVAILABLE`);
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`${input.failedCode}:${response.status}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await boundedResponseText(response));
  } catch (error) {
    if (error instanceof Error && error.message === "REVIEW_RESPONSE_TOO_LARGE") throw error;
    throw new Error(`${input.invalidCode}:MALFORMED_JSON`);
  }
  const result = input.schema.safeParse(parsed);
  if (!result.success) throw new Error(`${input.invalidCode}:SCHEMA`);
  const metadata = (result.data as { metadata: {
    protocolVersion: string;
    rulesetVersion: string;
    requestId: string;
    inputHash: string;
  } }).metadata;
  if (metadata.protocolVersion !== REVIEW_PROTOCOL_VERSION
    || metadata.rulesetVersion !== input.rulesetVersion
    || metadata.requestId !== requestId
    || metadata.inputHash !== inputHash) {
    throw new Error(`${input.invalidCode}:IDENTITY_MISMATCH`);
  }
  return result.data;
}

export function requestSemanticReview(payload: SemanticReviewPayload): Promise<SemanticReviewResponse> {
  return postReview({
    endpoint: process.env.SOURCE_SEMANTIC_REVIEW_URL,
    path: "/api/review/semantic",
    rulesetVersion: "semantic-2026-07-19.1",
    payload,
    schema: semanticReviewResponseSchema,
    unavailableCode: "SOURCE_SEMANTIC_REVIEW_UNAVAILABLE",
    failedCode: "SOURCE_SEMANTIC_REVIEW_FAILED",
    invalidCode: "SOURCE_SEMANTIC_REVIEW_INVALID",
  });
}

export function requestVisualReview(payload: VisualReviewPayload): Promise<VisualReviewResponse> {
  return postReview({
    endpoint: process.env.POSTER_VISION_REVIEW_URL,
    path: "/api/review/visual",
    rulesetVersion: "visual-2026-07-19.1",
    payload,
    schema: visualReviewResponseSchema,
    unavailableCode: "POSTER_VISION_REVIEW_UNAVAILABLE",
    failedCode: "POSTER_VISION_REVIEW_FAILED",
    invalidCode: "POSTER_VISION_REVIEW_INVALID",
  });
}
