import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import {
  assertPublicIpAddress,
  collectLimitedBody,
  createPinnedLookup,
  fetchSafeSource,
} from "@/server/releases/safe-source-fetch";

const publicDns = async () => [{ address: "93.184.216.34", family: 4 as const }];

describe("safe source fetch", () => {
  it("returns the pinned address array when Node 22 requests all lookup results", async () => {
    const lookup = createPinnedLookup({ address: "93.184.216.34", family: 4 });
    const addresses = await new Promise((resolve, reject) => {
      lookup("public.example", { all: true }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    expect(addresses).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });

  it("returns the pinned scalar address for the legacy lookup callback", async () => {
    const lookup = createPinnedLookup({ address: "93.184.216.34", family: 4 });
    const result = await new Promise((resolve, reject) => {
      lookup("public.example", {}, (error, address, family) => {
        if (error) reject(error);
        else resolve({ address, family });
      });
    });
    expect(result).toEqual({ address: "93.184.216.34", family: 4 });
  });

  it("blocks a public URL redirecting to loopback before the second request occurs", async () => {
    const requestOnce = vi.fn(async () => ({
      status: 302,
      body: "",
      headers: { location: "https://127.0.0.1/admin" },
    }));
    await expect(fetchSafeSource("https://public.example/story", {
      resolver: publicDns,
      requestOnce,
    })).rejects.toThrow(/SOURCE_DNS_ADDRESS_NOT_PUBLIC/);
    expect(requestOnce).toHaveBeenCalledTimes(1);
  });

  it("blocks DNS answers containing private addresses before connecting", async () => {
    const requestOnce = vi.fn();
    await expect(fetchSafeSource("https://public.example/story", {
      resolver: async () => [{ address: "10.0.0.8", family: 4 }],
      requestOnce,
    })).rejects.toThrow(/SOURCE_DNS_ADDRESS_NOT_PUBLIC/);
    expect(requestOnce).not.toHaveBeenCalled();
  });

  it("blocks IPv4-mapped IPv6 loopback and private ranges", () => {
    expect(() => assertPublicIpAddress("::ffff:127.0.0.1")).toThrow(/NOT_PUBLIC/);
    expect(() => assertPublicIpAddress("fc00::1")).toThrow(/NOT_PUBLIC/);
    expect(() => assertPublicIpAddress("fe80::1")).toThrow(/NOT_PUBLIC/);
    expect(() => assertPublicIpAddress("64:ff9b::7f00:1")).toThrow(/NOT_PUBLIC/);
    expect(() => assertPublicIpAddress("2001:2::1")).toThrow(/NOT_PUBLIC/);
  });

  it("stops streaming once the configured body byte limit is exceeded", async () => {
    const stream = Readable.from([Buffer.alloc(6), Buffer.alloc(6)]);
    await expect(collectLimitedBody(stream, 10)).rejects.toThrow(/SOURCE_BODY_TOO_LARGE/);
  });

  it("limits redirect chains", async () => {
    const requestOnce = vi.fn(async (url: URL) => ({
      status: 302,
      body: "",
      headers: { location: `${url.pathname}/next` },
    }));
    await expect(fetchSafeSource("https://public.example/story", {
      resolver: publicDns,
      requestOnce,
      maxRedirects: 2,
    })).rejects.toThrow(/SOURCE_TOO_MANY_REDIRECTS/);
    expect(requestOnce).toHaveBeenCalledTimes(3);
  });
});
