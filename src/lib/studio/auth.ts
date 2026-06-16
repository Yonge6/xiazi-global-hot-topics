import { createHmac, timingSafeEqual } from "node:crypto";

export const studioCookieName = "vilesaint-studio-session";

function secret() {
  return process.env.STUDIO_SESSION_SECRET ?? "vilesaint-local-development-secret";
}

export function studioSessionValue() {
  return createHmac("sha256", secret()).update("vilesaint-studio").digest("hex");
}

export function validStudioSession(value: string | undefined) {
  if (!value) return false;
  const expected = studioSessionValue();
  if (value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}
