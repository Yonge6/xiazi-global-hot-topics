import { createHash, createHmac } from "node:crypto";
import { ImmutableAssetError, type ImmutableAssetStore, type ImmutableCreateInput, type ImmutableObjectMetadata } from "./immutable-asset-store";

export const OSS_ORIGIN = "https://xiazi-release-assets-20260824.oss-cn-wulanchabu.aliyuncs.com";
export type OssConfig = { accessKeyId: string; accessKeySecret: string; bucket: string; region: string };

/** OSS writes are scoped to immutable posters; every PUT is conditional. */
export class OssImmutableAssetStore implements ImmutableAssetStore {
  readonly provider = "aliyun-oss" as const;
  readonly publicOrigin = OSS_ORIGIN;
  conditionalCreateSupported = false;
  constructor(private config: OssConfig, private fetchImpl: typeof fetch = fetch) {
    if (!config.accessKeyId || !config.accessKeySecret
      || config.bucket !== "xiazi-release-assets-20260824" || config.region !== "cn-wulanchabu") {
      throw new Error("OSS_SCOPE_MISMATCH");
    }
  }

  private async request(method: string, key: string, headers: Record<string, string> = {}, content?: Buffer, query = "") {
    if (key && (!key.startsWith("release-assets/") || key.split("/").some((p) => !p || p === "." || p === ".."))) throw new Error("OSS_KEY_SCOPE_INVALID");
    const pathname = "/" + key.split("/").map(encodeURIComponent).join("/");
    for (let attempt = 0; attempt < 3; attempt++) {
      const date = new Date().toUTCString();
      const canonical = Object.entries(headers).filter(([k]) => k.startsWith("x-oss-")).sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v.trim()}\n`).join("");
      const resource = `/${this.config.bucket}${pathname}${query ? `?${query}` : ""}`;
      const stringToSign = `${method}\n${headers["Content-MD5"] || ""}\n${headers["Content-Type"] || ""}\n${date}\n${canonical}${resource}`;
      const signature = createHmac("sha1", this.config.accessKeySecret).update(stringToSign).digest("base64");
      try {
        const response = await this.fetchImpl(`${OSS_ORIGIN}${pathname}${query ? `?${query}` : ""}`, {
          method, headers: { ...headers, Date: date, Authorization: `OSS ${this.config.accessKeyId}:${signature}` },
          ...(content ? { body: new Uint8Array(content) } : {}), redirect: "error", signal: AbortSignal.timeout(120000),
        });
        if (![408, 429, 500, 502, 503, 504].includes(response.status) || attempt === 2) return response;
        await response.body?.cancel();
      } catch (error) { if (attempt === 2) throw error; }
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
    throw new Error("OSS_RETRY_EXHAUSTED");
  }

  async verifyVersioning() {
    const response = await this.request("GET", "", {}, undefined, "versioning");
    const xml = await response.text();
    if (!response.ok || !/<VersioningConfiguration[\s/>]/.test(xml) || /<Status[\s>]/.test(xml)) throw new Error("OSS_VERSIONING_MUST_BE_NEVER_ENABLED");
    this.conditionalCreateSupported = true;
  }

  async createObject(input: ImmutableCreateInput & { sha256: string }) {
    if (!this.conditionalCreateSupported) throw new ImmutableAssetError("IMMUTABLE_ASSET_CONDITIONAL_WRITE_REQUIRED");
    const response = await this.request("PUT", input.key, {
      "Content-Type": input.contentType, "Content-MD5": createHash("md5").update(input.content).digest("base64"),
      "Cache-Control": "public, max-age=31536000, immutable", "x-oss-forbid-overwrite": "true", "x-oss-server-side-encryption": "AES256",
      "x-oss-meta-asset-batch-id": input.assetBatchId, "x-oss-meta-topic-id": input.topicId, "x-oss-meta-locale": input.locale,
      "x-oss-meta-issue-date": input.issueDate, "x-oss-meta-expected-number": String(input.expectedNumber), "x-oss-meta-expected-site": input.expectedSite,
      "x-oss-meta-sha256": input.sha256, "x-oss-meta-created-at": input.createdAt, "x-oss-meta-uploader-version": input.uploaderVersion,
    }, input.content);
    if (response.status === 409) throw new ImmutableAssetError("IMMUTABLE_ASSET_ALREADY_EXISTS", input.key);
    if (!response.ok) throw new Error(`OSS_CREATE_FAILED:${response.status}`);
    const metadata = await this.headObject(input.key);
    if (!metadata) throw new ImmutableAssetError("IMMUTABLE_ASSET_METADATA_MISMATCH", input.key);
    return metadata;
  }

  async headObject(key: string): Promise<ImmutableObjectMetadata | null> {
    const response = await this.request("HEAD", key);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`OSS_HEAD_FAILED:${response.status}`);
    const metadata: Record<string, string> = {};
    response.headers.forEach((v, k) => { if (k.startsWith("x-oss-meta-")) metadata[k.slice(11)] = v; });
    const etag = (response.headers.get("etag") || "").replaceAll('"', "");
    return { key, contentType: response.headers.get("content-type") || "", sizeBytes: Number(response.headers.get("content-length") || -1), etag,
      storageVersionId: response.headers.get("x-oss-version-id") || `oss-unversioned:${etag}:${metadata.sha256}`,
      serverSideEncryption: response.headers.get("x-oss-server-side-encryption") || "", customMetadata: metadata };
  }

  async readObject(key: string) {
    const response = await this.request("GET", key);
    if (!response.ok || !response.body) throw new Error(`OSS_READ_FAILED:${response.status}`);
    return response.body;
  }
}
