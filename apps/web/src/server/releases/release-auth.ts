import { timingSafeEqual } from "node:crypto";

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function validReleaseStageRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  const expected = process.env.RELEASE_STAGE_SECRET || process.env.CRON_SECRET || "";
  return Boolean(bearer && expected && safeEquals(bearer, expected));
}
