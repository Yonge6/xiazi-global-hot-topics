import { createHash, createHmac } from "node:crypto";

import type { ImmutableAssetStore, ImmutableCreateInput, ImmutableObjectMetadata } from "./immutable-asset-store";
import { ImmutableAssetError } from "./immutable-asset-store";

export type CosImmutableStoreConfig = {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
  publicOrigin: string;
  endpointOrigin?: string;
  versioningState: "never-enabled" | "enabled" | "suspended" | "unknown";
  fetchImpl?: typeof fetch;
};

function hmacSha1(key: string, value: string) {
  return createHmac("sha1", key).update(value).digest("hex");
}

function sha1(value: string) {
  return createHash("sha1").update(value).digest("hex");
}

function md5(value: Buffer) {
  return createHash("md5").update(value).digest("base64");
}

function encodePath(key: string) {
  return `/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function authorization(secretId: string, secretKey: string, method: string, pathname: string, host: string) {
  const now = Math.floor(Date.now() / 1000);
  const keyTime = `${now - 60};${now + 900}`;
  const httpString = `${method.toLowerCase()}\n${pathname}\n\nhost=${host}\n`;
  const stringToSign = `sha1\n${keyTime}\n${sha1(httpString)}\n`;
  const signature = hmacSha1(hmacSha1(secretKey, keyTime), stringToSign);
  return [
    "q-sign-algorithm=sha1",
    `q-ak=${secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    "q-header-list=host",
    "q-url-param-list=",
    `q-signature=${signature}`,
  ].join("&");
}

function customMetadata(headers: Headers) {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (key.startsWith("x-cos-meta-")) result[key.slice("x-cos-meta-".length)] = value;
  });
  return result;
}

function cleanEtag(value: string | null) {
  return (value || "").replace(/^"|"$/g, "");
}

export class CosImmutableAssetStore implements ImmutableAssetStore {
  readonly provider = "tencent-cos" as const;
  readonly publicOrigin: string;
  readonly conditionalCreateSupported: boolean;
  private readonly endpoint: URL;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: CosImmutableStoreConfig) {
    if (!config.secretId || !config.secretKey || !config.bucket || !config.region) {
      throw new ImmutableAssetError("IMMUTABLE_ASSET_POLICY_UNVERIFIED", "COS_CONFIG_MISSING");
    }
    const publicOrigin = new URL(config.publicOrigin);
    const localPublicOrigin = ["localhost", "127.0.0.1"].includes(publicOrigin.hostname);
    if (publicOrigin.username
      || publicOrigin.password
      || publicOrigin.pathname !== "/"
      || publicOrigin.search
      || publicOrigin.hash
      || (publicOrigin.protocol !== "https:" && !(localPublicOrigin && publicOrigin.protocol === "http:"))) {
      throw new ImmutableAssetError("IMMUTABLE_ASSET_ORIGIN_NOT_ALLOWED", publicOrigin.origin);
    }
    this.publicOrigin = publicOrigin.toString();
    this.endpoint = new URL(config.endpointOrigin || `https://${config.bucket}.cos.${config.region}.myqcloud.com`);
    const localEndpoint = ["localhost", "127.0.0.1"].includes(this.endpoint.hostname);
    if (this.endpoint.protocol !== "https:" && !(localEndpoint && this.endpoint.protocol === "http:")) {
      throw new ImmutableAssetError("IMMUTABLE_ASSET_POLICY_UNVERIFIED", "COS_HTTPS_REQUIRED");
    }
    this.conditionalCreateSupported = config.versioningState === "never-enabled";
    this.fetchImpl = config.fetchImpl || fetch;
  }

  private async request(method: string, key: string, init: RequestInit = {}) {
    const pathname = encodePath(key);
    const url = new URL(pathname, this.endpoint);
    const host = this.endpoint.host;
    return this.fetchImpl(url, {
      ...init,
      method,
      headers: {
        Authorization: authorization(this.config.secretId, this.config.secretKey, method, pathname, host),
        Host: host,
        ...init.headers,
      },
      redirect: "error",
      signal: init.signal || AbortSignal.timeout(25_000),
    });
  }

  async createObject(input: ImmutableCreateInput & { sha256: string }) {
    if (!this.conditionalCreateSupported) {
      throw new ImmutableAssetError("IMMUTABLE_ASSET_CONDITIONAL_WRITE_REQUIRED", this.config.versioningState);
    }
    const response = await this.request("PUT", input.key, {
      headers: {
        "Content-Type": input.contentType,
        "Content-Length": String(input.content.length),
        "Content-MD5": md5(input.content),
        "Cache-Control": "public, max-age=31536000, immutable",
        "x-cos-forbid-overwrite": "true",
        "x-cos-server-side-encryption": "AES256",
        "x-cos-meta-asset-batch-id": input.assetBatchId,
        "x-cos-meta-topic-id": input.topicId,
        "x-cos-meta-locale": input.locale,
        "x-cos-meta-issue-date": input.issueDate,
        "x-cos-meta-expected-number": String(input.expectedNumber),
        "x-cos-meta-expected-site": input.expectedSite,
        "x-cos-meta-sha256": input.sha256,
        "x-cos-meta-created-at": input.createdAt,
        "x-cos-meta-uploader-version": input.uploaderVersion,
      },
      body: new Uint8Array(input.content),
    });
    if (response.status === 409) throw new ImmutableAssetError("IMMUTABLE_ASSET_ALREADY_EXISTS", input.key);
    if (!response.ok) throw new Error(`COS_IMMUTABLE_CREATE_FAILED:${response.status}`);
    const metadata = await this.headObject(input.key);
    if (!metadata) throw new ImmutableAssetError("IMMUTABLE_ASSET_METADATA_MISMATCH", `${input.key}:missing-head`);
    return metadata;
  }

  async headObject(key: string): Promise<ImmutableObjectMetadata | null> {
    const response = await this.request("HEAD", key);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`COS_IMMUTABLE_HEAD_FAILED:${response.status}`);
    const etag = cleanEtag(response.headers.get("etag"));
    const metadata = customMetadata(response.headers);
    const versionId = response.headers.get("x-cos-version-id");
    const sha256 = metadata.sha256 || "missing-sha256";
    return {
      key,
      contentType: response.headers.get("content-type") || "",
      sizeBytes: Number(response.headers.get("content-length") || -1),
      etag,
      storageVersionId: versionId || `cos-unversioned:${etag}:${sha256}`,
      serverSideEncryption: response.headers.get("x-cos-server-side-encryption") || "",
      customMetadata: metadata,
    };
  }

  async readObject(key: string) {
    const response = await this.request("GET", key);
    if (!response.ok || !response.body) throw new Error(`COS_IMMUTABLE_READ_FAILED:${response.status}`);
    return response.body;
  }
}
