export type ApiClientOptions = {
  baseUrl?: string;
  token?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl?.replace(/\/$/, "") || "";
    this.token = options.token;
    this.fetchImpl = options.fetchImpl || fetch;
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  async getJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;

    try {
      const response = await this.fetchImpl(url, {
        ...init,
        cache: init.cache ?? "no-store",
        headers: {
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...init.headers,
        },
        signal: init.signal || controller.signal,
      });

      if (!response.ok) throw new Error(`Request failed: ${response.status} ${url}`);
      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createApiClient(options?: ApiClientOptions) {
  return new ApiClient(options);
}
