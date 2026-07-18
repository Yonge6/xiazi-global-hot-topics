import { createHash } from "node:crypto";

import { stableJson } from "../shadow/content-parity";

export function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function stableHash(value: unknown) {
  return sha256(stableJson(value));
}
