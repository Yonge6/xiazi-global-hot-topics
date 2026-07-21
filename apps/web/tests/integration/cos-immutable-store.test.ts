import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CosImmutableAssetStore } from "@/server/storage/cos-immutable-asset-store";
import { createVerifiedImmutableObject, type ImmutableCreateInput } from "@/server/storage/immutable-asset-store";
import { immutableAssetKey } from "@xiazi/domain";

type Stored = { body: Buffer; headers: Record<string, string>; etag: string };
const objects = new Map<string, Stored>();
let observedConditionalHeader = false;
let observedEncryptionHeader = false;

async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function objectHeaders(response: ServerResponse, object: Stored) {
  response.setHeader("content-type", object.headers["content-type"]);
  response.setHeader("content-length", String(object.body.length));
  response.setHeader("etag", `"${object.etag}"`);
  response.setHeader("x-cos-server-side-encryption", "AES256");
  for (const [key, value] of Object.entries(object.headers)) {
    if (key.startsWith("x-cos-meta-")) response.setHeader(key, value);
  }
}

const server = createServer(async (request, response) => {
  const key = decodeURIComponent((request.url || "").replace(/^\//, ""));
  const existing = objects.get(key);
  if (request.method === "PUT") {
    observedConditionalHeader ||= request.headers["x-cos-forbid-overwrite"] === "true";
    observedEncryptionHeader ||= request.headers["x-cos-server-side-encryption"] === "AES256";
    const bytes = await body(request);
    if (objects.has(key) && request.headers["x-cos-forbid-overwrite"] === "true") {
      response.statusCode = 409;
      response.end("FileAlreadyExists");
      return;
    }
    const headers = Object.fromEntries(Object.entries(request.headers)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    const etag = `etag-${objects.size + 1}`;
    objects.set(key, { body: bytes, headers, etag });
    response.statusCode = 200;
    response.setHeader("etag", `"${etag}"`);
    response.end();
    return;
  }
  if (!existing) {
    response.statusCode = 404;
    response.end();
    return;
  }
  objectHeaders(response, existing);
  if (request.method === "HEAD") response.end();
  else if (request.method === "GET") response.end(existing.body);
  else {
    response.statusCode = 405;
    response.end();
  }
});

let endpoint = "";

beforeEach(async () => {
  objects.clear();
  observedConditionalHeader = false;
  observedEncryptionHeader = false;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  endpoint = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

function store(versioningState: "never-enabled" | "enabled" = "never-enabled") {
  return new CosImmutableAssetStore({
    secretId: "test-id",
    secretKey: "test-secret",
    bucket: "xiazi-staging-0000000000",
    region: "ap-hongkong",
    publicOrigin: endpoint,
    endpointOrigin: endpoint,
    versioningState,
  });
}

const assetBatchId = "asset_20260720_primary";
function input(content = "simulated png bytes"): ImmutableCreateInput {
  return {
    key: immutableAssetKey(assetBatchId, "zh", "no-01"),
    content: Buffer.from(content),
    contentType: "image/png",
    assetBatchId,
    topicId: "topic-1",
    locale: "zh",
    issueDate: "2026-07-20",
    expectedNumber: 1,
    expectedSite: "xiazishuo.com",
    createdAt: "2026-07-20T00:00:00.000Z",
    uploaderVersion: "uploader-v1",
  };
}

describe("Tencent COS create-only adapter against local simulator", () => {
  it("conditionally creates, rereads and returns idempotency", async () => {
    const adapter = store();
    const first = await createVerifiedImmutableObject(adapter, input());
    const retry = await createVerifiedImmutableObject(adapter, input());
    expect(first.created).toBe(true);
    expect(retry.idempotent).toBe(true);
    expect(observedConditionalHeader).toBe(true);
    expect(observedEncryptionHeader).toBe(true);
    expect(retry.object.storageVersionId).toContain("cos-unversioned");
  });

  it("rejects a different second payload and serializes concurrent creation", async () => {
    const adapter = store();
    await createVerifiedImmutableObject(adapter, input());
    await expect(createVerifiedImmutableObject(adapter, input("different"))).rejects.toThrow(/CONTENT_CONFLICT/);

    objects.clear();
    const concurrent = await Promise.all([
      createVerifiedImmutableObject(adapter, input()),
      createVerifiedImmutableObject(adapter, input()),
    ]);
    expect(concurrent.filter((result) => result.created)).toHaveLength(1);
    expect(concurrent.filter((result) => result.idempotent)).toHaveLength(1);
  });

  it("fails closed for a bucket with versioning enabled", async () => {
    await expect(createVerifiedImmutableObject(store("enabled"), input()))
      .rejects.toThrow(/IMMUTABLE_ASSET_CONDITIONAL_WRITE_REQUIRED/);
  });
});
