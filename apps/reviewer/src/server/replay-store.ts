export type ReplayStore = {
  reserve: (nonce: string, ttlSeconds: number) => Promise<boolean>;
};

export class MemoryReplayStore implements ReplayStore {
  private readonly seen = new Map<string, number>();

  async reserve(nonce: string, ttlSeconds: number) {
    const now = Date.now();
    for (const [key, expiresAt] of this.seen) {
      if (expiresAt <= now) this.seen.delete(key);
    }
    if (this.seen.has(nonce)) return false;
    this.seen.set(nonce, now + ttlSeconds * 1000);
    return true;
  }
}

export class RedisRestReplayStore implements ReplayStore {
  constructor(private readonly url: string, private readonly token: string) {}

  async reserve(nonce: string, ttlSeconds: number) {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["SET", `xiazi:review:nonce:${nonce}`, "1", "NX", "EX", ttlSeconds]),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw new Error(`REVIEW_REPLAY_STORE_FAILED:${response.status}`);
    const result = await response.json() as { result?: unknown };
    return result.result === "OK";
  }
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class SupabaseReplayStore implements ReplayStore {
  constructor(private readonly url: string, private readonly serviceRoleKey: string) {}

  async reserve(nonce: string, ttlSeconds: number) {
    const endpoint = new URL("/rest/v1/rpc/reserve_review_request_nonce", this.url);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_nonce_hash: await sha256Hex(nonce),
        p_ttl_seconds: ttlSeconds,
      }),
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok) throw new Error(`REVIEW_REPLAY_STORE_FAILED:${response.status}`);
    return await response.json() === true;
  }
}

let developmentStore: MemoryReplayStore | undefined;

export function replayStoreFromConfig(config: {
  replayStoreProvider?: "redis-rest" | "supabase";
  replayStoreUrl?: string;
  replayStoreToken?: string;
}) {
  if (config.replayStoreUrl && config.replayStoreToken) {
    if (config.replayStoreProvider === "supabase") {
      return new SupabaseReplayStore(config.replayStoreUrl, config.replayStoreToken);
    }
    return new RedisRestReplayStore(config.replayStoreUrl, config.replayStoreToken);
  }
  if (process.env.NODE_ENV === "production") throw new Error("REVIEWER_DURABLE_REPLAY_STORE_REQUIRED");
  developmentStore ||= new MemoryReplayStore();
  return developmentStore;
}
