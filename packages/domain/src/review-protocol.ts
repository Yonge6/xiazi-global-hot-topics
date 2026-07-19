const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

export async function sha256Hex(value: string | Uint8Array) {
  const input = typeof value === "string" ? encoder.encode(value) : Uint8Array.from(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input.buffer);
  return bytesToHex(new Uint8Array(digest));
}

export function reviewInputHash(payload: unknown) {
  return sha256Hex(canonicalJson(payload));
}

export function reviewSignatureMessage(input: {
  timestamp: string;
  nonce: string;
  method: string;
  path: string;
  rawBody: string;
}) {
  return [
    "xiazi-review-signature-v1",
    input.timestamp,
    input.nonce,
    input.method.toUpperCase(),
    input.path,
    input.rawBody,
  ].join("\n");
}

export async function signReviewRequest(secret: string, input: Parameters<typeof reviewSignatureMessage>[0]) {
  if (secret.length < 32) throw new Error("REVIEW_SECRET_TOO_SHORT");
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(reviewSignatureMessage(input)));
  return bytesToHex(new Uint8Array(signature));
}

export function constantTimeHexEqual(left: string, right: string) {
  if (!/^[0-9a-f]+$/i.test(left) || !/^[0-9a-f]+$/i.test(right) || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
