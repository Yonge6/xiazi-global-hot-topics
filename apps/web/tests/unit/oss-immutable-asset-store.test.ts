import { describe, expect, it } from "vitest";
import { OssImmutableAssetStore } from "../../src/server/storage/oss-immutable-asset-store";

const config = { accessKeyId: "test", accessKeySecret: "test", bucket: "xiazi-release-assets-20260824", region: "cn-wulanchabu" };
const input = { key: "release-assets/asset_prod_20260915_test/zh/topic.png", content: Buffer.from("test"), contentType: "image/png" as const,
  assetBatchId: "asset_prod_20260915_test", topicId: "topic", locale: "zh" as const, issueDate: "2026-09-15", expectedNumber: 1,
  expectedSite: "xiazishuo.com" as const, createdAt: "2026-09-15T00:00:00Z", uploaderVersion: "test", sha256: "a".repeat(64) };

describe("OSS immutable storage", () => {
  it("refuses writes before checking versioning", async () => {
    const store = new OssImmutableAssetStore(config, async () => { throw new Error("unexpected request"); });
    await expect(store.createObject(input)).rejects.toThrow("CONDITIONAL_WRITE_REQUIRED");
  });
  it("rejects enabled and suspended versioning", async () => {
    for (const state of ["Enabled", "Suspended"]) {
      const store = new OssImmutableAssetStore(config, async () => new Response(`<VersioningConfiguration><Status>${state}</Status></VersioningConfiguration>`));
      await expect(store.verifyVersioning()).rejects.toThrow("OSS_VERSIONING_MUST_BE_NEVER_ENABLED");
    }
  });
  it("rejects unexpected versioning responses", async () => {
    const store = new OssImmutableAssetStore(config, async () => new Response("<html>proxy error</html>"));
    await expect(store.verifyVersioning()).rejects.toThrow("OSS_VERSIONING_MUST_BE_NEVER_ENABLED");
  });
  it("signs conditional encrypted writes and treats collision as already existing", async () => {
    const calls: RequestInit[] = [];
    const store = new OssImmutableAssetStore(config, async (_url, init) => {
      calls.push(init!);
      return init!.method === "GET" ? new Response("<VersioningConfiguration/>") : new Response("", { status: 409 });
    });
    await store.verifyVersioning();
    await expect(store.createObject(input)).rejects.toThrow("IMMUTABLE_ASSET_ALREADY_EXISTS");
    const headers = new Headers(calls[1].headers);
    expect(headers.get("x-oss-forbid-overwrite")).toBe("true");
    expect(headers.get("x-oss-server-side-encryption")).toBe("AES256");
    expect(headers.get("Authorization")).toMatch(/^OSS test:/);
    expect(headers.get("x-oss-meta-sha256")).toBe(input.sha256);
  });
  it("rejects foreign buckets and path traversal", async () => {
    expect(() => new OssImmutableAssetStore({ ...config, bucket: "other" })).toThrow("OSS_SCOPE_MISMATCH");
    const store = new OssImmutableAssetStore(config);
    await expect(store.headObject("release-assets/../private")).rejects.toThrow("OSS_KEY_SCOPE_INVALID");
  });
});
