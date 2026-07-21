import type { LookupAddress } from "node:dns";
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP, type LookupFunction } from "node:net";

export type SafeSourceResponse = {
  status: number;
  finalUrl: string;
  body: string;
  headers: Record<string, string>;
};

type HopResponse = {
  status: number;
  body: string;
  headers: Record<string, string>;
};

type SafeSourceFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  resolver?: (hostname: string) => Promise<LookupAddress[]>;
  requestOnce?: (
    url: URL,
    address: LookupAddress,
    limits: { timeoutMs: number; maxBytes: number },
  ) => Promise<HopResponse>;
};

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "");
}

function ipv4Bytes(address: string) {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const bytes = parts.map((part) => Number(part));
  return bytes.every((value) => Number.isInteger(value) && value >= 0 && value <= 255) ? bytes : null;
}

function ipv6Words(address: string) {
  let value = address.toLowerCase().split("%")[0];
  const ipv4Match = value.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Match) {
    const bytes = ipv4Bytes(ipv4Match[1]);
    if (!bytes) return null;
    value = value.slice(0, -ipv4Match[1].length)
      + `${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
  }
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  const words = [...left, ...Array.from({ length: missing }, () => "0"), ...right]
    .map((part) => Number.parseInt(part || "0", 16));
  return words.length === 8 && words.every((word) => Number.isInteger(word) && word >= 0 && word <= 0xffff)
    ? words
    : null;
}

function publicIpv4(address: string) {
  const bytes = ipv4Bytes(address);
  if (!bytes) return false;
  const [a, b] = bytes;
  return !(a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168))
    || (a === 198 && (b === 18 || b === 19 || b === 51))
    || (a === 203 && b === 0)
    || a >= 224);
}

function publicIpv6(address: string) {
  const words = ipv6Words(address);
  if (!words) return false;
  const ipv4MappedPrefix = words.slice(0, 5).every((word) => word === 0)
    && (words[5] === 0xffff || words[5] === 0);
  if (ipv4MappedPrefix) {
    return publicIpv4(`${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`);
  }
  const allZero = words.every((word) => word === 0);
  const loopback = words.slice(0, 7).every((word) => word === 0) && words[7] === 1;
  const nat64WellKnown = words[0] === 0x0064 && words[1] === 0xff9b && words[2] === 0 && words[3] === 0 && words[4] === 0;
  const nat64LocalUse = words[0] === 0x0064 && words[1] === 0xff9b && words[2] === 1;
  return !(allZero
    || loopback
    || nat64WellKnown
    || nat64LocalUse
    || (words[0] & 0xfe00) === 0xfc00
    || (words[0] & 0xffc0) === 0xfe80
    || (words[0] & 0xff00) === 0xff00
    || (words[0] === 0x2001 && (words[1] === 0 || words[1] === 0x0db8))
    || (words[0] === 0x2001 && words[1] === 2)
    || (words[0] === 0x2001 && (words[1] & 0xfff0) === 0x0010)
    || (words[0] === 0x2001 && (words[1] & 0xfff0) === 0x0020)
    || words[0] === 0x2002);
}

export function assertPublicIpAddress(address: string) {
  const family = isIP(address);
  const allowed = family === 4 ? publicIpv4(address) : family === 6 ? publicIpv6(address) : false;
  if (!allowed) throw new Error(`SOURCE_DNS_ADDRESS_NOT_PUBLIC:${address}`);
}

export function assertSafeSourceUrl(value: string | URL) {
  const url = value instanceof URL ? new URL(value) : new URL(value);
  const hostname = normalizeHostname(url.hostname);
  if (url.protocol !== "https:") throw new Error(`SOURCE_URL_REQUIRES_HTTPS:${url.href}`);
  if (url.username || url.password || !hostname) throw new Error(`SOURCE_URL_NOT_PUBLIC:${url.href}`);
  if (hostname === "localhost" || hostname.endsWith(".local")) throw new Error(`SOURCE_URL_NOT_PUBLIC:${url.href}`);
  if (hostname === "chatgpt.com" || hostname.endsWith(".chatgpt.com")) {
    throw new Error(`CHATGPT_SHARE_LINK_FORBIDDEN:${url.href}`);
  }
  if (isIP(hostname)) assertPublicIpAddress(hostname);
  return url;
}

async function defaultResolver(hostname: string) {
  return dnsLookup(hostname, { all: true, verbatim: true });
}

export function createPinnedLookup(resolved: LookupAddress): LookupFunction {
  return (_hostname, options, callback) => {
    if (typeof options === "object" && options.all) {
      callback(null, [resolved]);
      return;
    }
    callback(null, resolved.address, resolved.family);
  };
}

async function resolvePublicAddress(hostname: string, resolver: (hostname: string) => Promise<LookupAddress[]>) {
  const normalized = normalizeHostname(hostname);
  if (isIP(normalized)) {
    assertPublicIpAddress(normalized);
    return { address: normalized, family: isIP(normalized) as 4 | 6 };
  }
  const answers = await resolver(normalized);
  if (!answers.length || answers.length > 32) throw new Error(`SOURCE_DNS_INVALID:${normalized}`);
  for (const answer of answers) assertPublicIpAddress(answer.address);
  return answers[0];
}

export async function collectLimitedBody(stream: AsyncIterable<Buffer | Uint8Array | string>, maxBytes: number) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maxBytes) {
      const destroyable = stream as { destroy?: (error?: Error) => void };
      destroyable.destroy?.();
      throw new Error(`SOURCE_BODY_TOO_LARGE:${total}`);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function defaultRequestOnce(
  url: URL,
  resolved: LookupAddress,
  limits: { timeoutMs: number; maxBytes: number },
): Promise<HopResponse> {
  return new Promise((resolve, reject) => {
    const lookup = createPinnedLookup(resolved);
    const request = httpsRequest(url, {
      method: "GET",
      headers: {
        "Accept-Encoding": "identity",
        "User-Agent": "xiazishuo-release-source-gate/2.1",
      },
      lookup,
    }, (response) => {
      const status = response.statusCode || 0;
      const headers = Object.fromEntries(Object.entries(response.headers).flatMap(([key, value]) => {
        if (value === undefined) return [];
        return [[key.toLowerCase(), Array.isArray(value) ? value.join(",") : value]];
      }));
      const declaredLength = Number(headers["content-length"] || 0);
      if (declaredLength > limits.maxBytes) {
        response.destroy();
        reject(new Error(`SOURCE_BODY_TOO_LARGE:${declaredLength}`));
        return;
      }
      if (headers["content-encoding"] && headers["content-encoding"] !== "identity") {
        response.destroy();
        reject(new Error(`SOURCE_ENCODING_UNSUPPORTED:${headers["content-encoding"]}`));
        return;
      }
      collectLimitedBody(response, limits.maxBytes)
        .then((body) => resolve({ status, body, headers }))
        .catch(reject);
    });
    request.setTimeout(limits.timeoutMs, () => request.destroy(new Error("SOURCE_FETCH_TIMEOUT")));
    request.once("error", reject);
    request.end();
  });
}

export async function fetchSafeSource(value: string, options: SafeSourceFetchOptions = {}): Promise<SafeSourceResponse> {
  const timeoutMs = options.timeoutMs || 20_000;
  const maxBytes = options.maxBytes || 1_000_000;
  const maxRedirects = options.maxRedirects ?? 5;
  const resolver = options.resolver || defaultResolver;
  const requestOnce = options.requestOnce || defaultRequestOnce;
  let current = assertSafeSourceUrl(value);

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const address = await resolvePublicAddress(current.hostname, resolver);
    const response = await requestOnce(current, address, { timeoutMs, maxBytes });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.location;
      if (!location) throw new Error(`SOURCE_REDIRECT_WITHOUT_LOCATION:${current.href}`);
      if (hop === maxRedirects) throw new Error(`SOURCE_TOO_MANY_REDIRECTS:${value}`);
      current = assertSafeSourceUrl(new URL(location, current));
      continue;
    }
    return {
      status: response.status,
      finalUrl: current.href,
      body: response.body,
      headers: response.headers,
    };
  }
  throw new Error(`SOURCE_TOO_MANY_REDIRECTS:${value}`);
}
