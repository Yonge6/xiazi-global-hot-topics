import { constantTimeHexEqual, signReviewRequest } from "@xiazi/domain";

import type { ReplayStore } from "./replay-store";

function constantTimeTextEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

export async function authenticateReviewRequest(input: {
  request: Request;
  rawBody: string;
  path: string;
  bearerSecret: string;
  hmacSecret: string;
  replayStore: ReplayStore;
  now?: () => Date;
  maxClockSkewMs?: number;
}) {
  const authorization = input.request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")
    || !constantTimeTextEqual(authorization.slice(7), input.bearerSecret)) {
    throw new Error("REVIEW_AUTH_BEARER_INVALID");
  }
  const timestamp = input.request.headers.get("x-xiazi-review-timestamp") || "";
  const nonce = input.request.headers.get("x-xiazi-review-nonce") || "";
  const signature = input.request.headers.get("x-xiazi-review-signature") || "";
  if (!timestamp || !nonce || !signature) throw new Error("REVIEW_AUTH_HEADERS_MISSING");
  const timestampMs = Date.parse(timestamp);
  const nowMs = (input.now || (() => new Date()))().getTime();
  const maxClockSkewMs = input.maxClockSkewMs || 5 * 60_000;
  if (!Number.isFinite(timestampMs) || Math.abs(nowMs - timestampMs) > maxClockSkewMs) {
    throw new Error("REVIEW_AUTH_TIMESTAMP_INVALID");
  }
  const expected = await signReviewRequest(input.hmacSecret, {
    timestamp,
    nonce,
    method: input.request.method,
    path: input.path,
    rawBody: input.rawBody,
  });
  if (!constantTimeHexEqual(signature, expected)) throw new Error("REVIEW_AUTH_SIGNATURE_INVALID");
  if (!await input.replayStore.reserve(nonce, Math.ceil(maxClockSkewMs / 1000) * 2)) {
    throw new Error("REVIEW_AUTH_REPLAYED");
  }
  return { timestamp, nonce };
}
