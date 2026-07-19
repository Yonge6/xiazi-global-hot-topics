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

let developmentStore: MemoryReplayStore | undefined;

export function replayStoreFromConfig(config: { replayStoreUrl?: string; replayStoreToken?: string }) {
  if (config.replayStoreUrl && config.replayStoreToken) {
    return new RedisRestReplayStore(config.replayStoreUrl, config.replayStoreToken);
  }
  if (process.env.NODE_ENV === "production") throw new Error("REVIEWER_DURABLE_REPLAY_STORE_REQUIRED");
  developmentStore ||= new MemoryReplayStore();
  return developmentStore;
}
