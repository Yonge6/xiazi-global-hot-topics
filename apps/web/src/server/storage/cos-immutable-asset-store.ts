import { createHash, createHmac } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

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
  requestTimeoutMs?: number;
  requestAttempts?: number;
  retryBaseDelayMs?: number;
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

const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_NETWORK_CODES = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "ETIMEDOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

function errorCode(error: unknown) {
  if (!(error instanceof Error)) return "UNKNOWN";
  if (error.name === "AbortError" || error.name === "TimeoutError") return error.name.toUpperCase();
  const cause = error.cause;
  if (cause && typeof cause === "object" && "code" in cause && typeof cause.code === "string") {
    return cause.code;
  }
  return error.name.toUpperCase();
}

function isTransientNetworkError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = errorCode(error);
  return error instanceof TypeError
    || code === "ABORTERROR"
    || code === "TIMEOUTERROR"
    || TRANSIENT_NETWORK_CODES.has(code);
}

export class CosImmutableAssetStore implements ImmutableAssetStore {
  readonly provider = "tencent-cos" as const;
  readonly publicOrigin: string;
  readonly conditionalCreateSupported: boolean;
  private readonly endpoint: URL;
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;
  private readonly requestAttempts: number;
  private readonly retryBaseDelayMs: number;

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
    this.requestTimeoutMs = config.requestTimeoutMs ?? 25_000;
    this.requestAttempts = config.requestAttempts ?? 3;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? 250;
    if (!Number.isSafeInteger(this.requestTimeoutMs)
      || this.requestTimeoutMs < 5_000
      || this.requestTimeoutMs > 300_000) {
      throw new ImmutableAssetError("IMMUTABLE_ASSET_POLICY_UNVERIFIED", "COS_REQUEST_TIMEOUT_INVALID");
    }
    if (!Number.isSafeInteger(this.requestAttempts)
      || this.requestAttempts < 1
      || this.requestAttempts > 5) {
      throw new ImmutableAssetError("IMMUTABLE_ASSET_POLICY_UNVERIFIED", "COS_REQUEST_ATTEMPTS_INVALID");
    }
    if (!Number.isSafeInteger(this.retryBaseDelayMs)
      || this.retryBaseDelayMs < 0
      || this.retryBaseDelayMs > 5_000) {
      throw new ImmutableAssetError("IMMUTABLE_ASSET_POLICY_UNVERIFIED", "COS_RETRY_DELAY_INVALID");
    }
  }

  private async request(method: string, key: string, init: RequestInit = {}) {
    const pathname = encodePath(key);
    const url = new URL(pathname, this.endpoint);
    const host = this.endpoint.host;
    for (let attempt = 1; attempt <= this.requestAttempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, {
          ...init,
          method,
          headers: {
            Authorization: authorization(this.config.secretId, this.config.secretKey, method, pathname, host),
            Host: host,
            ...init.headers,
          },
          redirect: "error",
          signal: init.signal || AbortSignal.timeout(this.requestTimeoutMs),
        });
        if (!TRANSIENT_STATUS_CODES.has(response.status)) return response;
        if (attempt === this.requestAttempts) {
          await response.body?.cancel();
          throw new Error(`COS_REQUEST_FAILED:${method}:${key}:attempt=${attempt}/${this.requestAttempts}:HTTP_${response.status}`);
        }
        await response.body?.cancel();
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("COS_REQUEST_FAILED:")) throw error;
        if (!isTransientNetworkError(error) || attempt === this.requestAttempts) {
          const code = errorCode(error);
          throw new Error(`COS_REQUEST_FAILED:${method}:${key}:attempt=${attempt}/${this.requestAttempts}:${code}`);
        }
      }
      await delay(this.retryBaseDelayMs * (2 ** (attempt - 1)));
    }
    throw new Error(`COS_REQUEST_FAILED:${method}:${key}:RETRY_EXHAUSTED`);
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
