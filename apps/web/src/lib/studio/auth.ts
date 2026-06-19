import { createHmac, timingSafeEqual } from "node:crypto";

export const studioCookieName = "pluto-studio-session";

const devStudioPassword = "000000";
const devStudioSessionSecret = "pluto-local-development-secret";

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function requiredStudioEnv(name: "STUDIO_PASSWORD" | "STUDIO_SESSION_SECRET") {
  const value = process.env[name];
  if (value) return value;
  if (isProductionRuntime()) {
    throw new Error(`${name} is required in production`);
  }
  return name === "STUDIO_PASSWORD" ? devStudioPassword : devStudioSessionSecret;
}

export function studioPassword() {
  return requiredStudioEnv("STUDIO_PASSWORD");
}

function secret() {
  return requiredStudioEnv("STUDIO_SESSION_SECRET");
}

export function studioSessionValue() {
  return createHmac("sha256", secret()).update("pluto-studio").digest("hex");
}

export function validStudioSession(value: string | undefined) {
  if (!value) return false;
  const expected = studioSessionValue();
  if (value.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
}

export function validStudioOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const expected = new URL(request.url);
    const actual = new URL(origin);
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    if (localHosts.has(expected.hostname) && localHosts.has(actual.hostname)) {
      return expected.port === actual.port;
    }
    return actual.protocol === expected.protocol && actual.host === expected.host;
  } catch {
    return false;
  }
}
