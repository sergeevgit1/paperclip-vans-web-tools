export type FetchFunction = (url: string, init?: RequestInit) => Promise<Response>;

export type VansRouterClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  fetcher?: FetchFunction;
};

export type SearchRequest = {
  model: "searxng" | "tavily";
  provider?: "searxng" | "tavily";
  query: string;
  max_results?: number;
  search_type?: "web" | "news";
  language?: string;
  country?: string;
  time_range?: "day" | "week" | "month" | "year";
};

export type SearchResultItem = {
  title: string;
  url: string;
  snippet?: string;
  published_at?: string;
  position?: number;
  source_type?: string;
};

export type SearchResponse = {
  model: string;
  query: string;
  results: SearchResultItem[];
};

export type WebFetchRequest = {
  provider: "scrapling" | "jina-reader" | "camofox";
  mode?: "fast" | "browser" | "stealth";
  url: string;
  format?: "markdown" | "text";
};

export type WebFetchResponse = {
  provider: string;
  url: string;
  title?: string | null;
  content: {
    format?: string;
    text: string;
    length?: number;
  };
  metadata?: {
    author?: string | null;
    published_at?: string | null;
    language?: string | null;
  };
};

export class VansRouterClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;
  private readonly fetcher: FetchFunction;

  constructor(options: VansRouterClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 1_000_000;
    this.fetcher = options.fetcher ?? fetch;
  }

  async search(request: SearchRequest): Promise<SearchResponse> {
    return this.postJson<SearchResponse>("/v1/search", request);
  }

  async fetch(request: WebFetchRequest): Promise<WebFetchResponse> {
    return this.postJson<WebFetchResponse>("/v1/web/fetch", request);
  }

  async health(): Promise<{ ok: boolean }> {
    const url = `${this.baseUrl}/api/health`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, 5000));
    try {
      const response = await this.fetcher(url, {
        method: "GET",
        signal: controller.signal,
      });
      return { ok: response.ok };
    } catch {
      return { ok: false };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async postJson<T>(path: string, payload: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const bodyText = await this.readBoundedText(response, controller.signal);

      if (!response.ok) {
        this.handleHttpError(response.status, bodyText);
      }

      try {
        return JSON.parse(bodyText) as T;
      } catch {
        throw new Error("Invalid upstream JSON response");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Upstream request timed out");
      }
      if (error instanceof Error && (error.message.includes("timed out") || error.message.includes("aborted"))) {
        throw new Error("Upstream request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readBoundedText(response: Response, signal?: AbortSignal): Promise<string> {
    const reader = response.body?.getReader();
    if (!reader) {
      const text = await response.text();
      if (text.length > this.maxResponseBytes) {
        throw new Error("Upstream response too large");
      }
      return text;
    }

    let receivedBytes = 0;
    const decoder = new TextDecoder("utf-8");
    let accumulated = "";

    const onAbort = () => {
      try {
        reader.cancel().catch(() => {});
      } catch {
        /* ignore */
      }
    };
    if (signal) {
      if (signal.aborted) throw new Error("Upstream request timed out");
      signal.addEventListener("abort", onAbort, { once: true });
    }

    try {
      while (true) {
        let readResult: ReadableStreamReadResult<Uint8Array>;
        try {
          readResult = await reader.read();
        } catch (readError) {
          if (signal?.aborted) {
            throw new Error("Upstream request timed out");
          }
          throw readError;
        }

        const { done, value } = readResult;
        if (done) break;
        if (value) {
          receivedBytes += value.byteLength;
          if (receivedBytes > this.maxResponseBytes) {
            try { reader.cancel().catch(() => {}); } catch { /* ignore */ }
            throw new Error("Upstream response too large");
          }
          accumulated += decoder.decode(value, { stream: true });
        }
      }
      accumulated += decoder.decode();
      return accumulated;
    } finally {
      if (signal) signal.removeEventListener("abort", onAbort);
    }
  }

  private handleHttpError(status: number, bodyText: string): never {
    const sanitized = this.sanitizeMessage(bodyText);
    if (status === 401 || status === 403) {
      throw new Error("VansRouter authentication failed. Please check apiKeyRef configuration.");
    }
    if (status === 429) {
      throw new Error("VansRouter rate limit exceeded. Please retry later.");
    }
    if (status >= 500) {
      throw new Error(`VansRouter upstream error (${status}): ${sanitized.slice(0, 200)}`);
    }
    throw new Error(`VansRouter request failed (${status}): ${sanitized.slice(0, 200)}`);
  }

  private sanitizeMessage(input: unknown): string {
    const text = input instanceof Error ? input.message : String(input ?? "");
    let sanitized = text;
    if (this.apiKey) {
      sanitized = sanitized.replaceAll(this.apiKey, "[REDACTED]");
    }
    sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]");
    return sanitized;
  }
}
