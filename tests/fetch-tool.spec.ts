import { describe, expect, it, vi } from "vitest";
import { executeWebFetch } from "../src/tools/fetch.js";
import type { PluginConfig } from "../src/types.js";
import type { WebFetchRequest, WebFetchResponse } from "../src/vans-client.js";

const config: PluginConfig = {
  baseUrl: "http://vansrouter:20128",
  apiKeyRef: "VANS_API_KEY",
  searchProvider: "searxng",
  fetchProvider: "scrapling",
  timeoutMs: 30_000,
  maxSearchResults: 5,
  maxContentChars: 20_000,
  allowedDomains: [],
  blockedDomains: [],
};

describe("executeWebFetch", () => {
  it("blocks internal URLs before calling VansRouter", async () => {
    const fetch = vi.fn();
    const client = { fetch };

    const result = await executeWebFetch(client as any, config, {
      url: "http://169.254.169.254/latest/meta-data/",
    });

    expect(result.error).toMatch(/not allowed/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("normalizes live response shape and truncates to the configured character limit", async () => {
    let capturedRequest: WebFetchRequest | undefined;
    const client = {
      fetch: async (req: WebFetchRequest): Promise<WebFetchResponse> => {
        capturedRequest = req;
        return {
          provider: "scrapling",
          url: "https://example.com/",
          title: "Example Domain",
          content: { format: "markdown", text: "X".repeat(2500), length: 2500 },
        };
      },
    };

    const result = await executeWebFetch(
      client as any,
      { ...config, maxContentChars: 2000 },
      { url: "https://example.com/", format: "markdown", maxChars: 5000 },
    );

    expect(capturedRequest).toEqual({
      provider: "scrapling",
      url: "https://example.com/",
      format: "markdown",
    });

    const data = result.data as { content: string; contentChars: number; truncated: boolean };
    expect(data.content).toHaveLength(2000);
    expect(data.contentChars).toBe(2000);
    expect(data.truncated).toBe(true);
    expect(result.content).toContain("Example Domain");
  });

  it("enforces allowedDomains and blockedDomains", async () => {
    const fetch = vi.fn();
    const client = { fetch };
    const domainConfig = {
      ...config,
      allowedDomains: ["example.com"],
      blockedDomains: ["private.example.com"],
    };

    expect((await executeWebFetch(client as any, domainConfig, { url: "https://example.net/" })).error)
      .toMatch(/not allowed/i);
    expect((await executeWebFetch(client as any, domainConfig, { url: "https://private.example.com/" })).error)
      .toMatch(/not allowed/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects unknown parameters and unsupported formats", async () => {
    const client = { fetch: vi.fn() };
    expect((await executeWebFetch(client as any, config, { url: "https://example.com", extra: true })).error)
      .toMatch(/unknown parameter/i);
    expect((await executeWebFetch(client as any, config, { url: "https://example.com", format: "html" })).error)
      .toMatch(/format/i);
  });

  it("supports provider override, scrapling mode, and falls back to camofox on bot block", async () => {
    const calls: WebFetchRequest[] = [];
    const client = {
      fetch: async (req: WebFetchRequest): Promise<WebFetchResponse> => {
        calls.push(req);
        if (req.provider === "scrapling") {
          throw new Error("VansRouter request failed (403): Cloudflare bot challenge detected");
        }
        return {
          provider: "camofox",
          url: req.url,
          title: "Camofox Bypassed Page",
          content: { format: "markdown", text: "Clean extracted body after anti-bot bypass", length: 44 },
        };
      },
    };

    const result = await executeWebFetch(
      client as any,
      config,
      {
        url: "https://example.com/protected",
        provider: "scrapling",
        mode: "stealth",
      },
    );

    expect(result.error).toBeUndefined();
    expect(calls).toEqual([
      { provider: "scrapling", mode: "stealth", url: "https://example.com/protected", format: "markdown" },
      { provider: "camofox", url: "https://example.com/protected", format: "markdown" },
    ]);
    expect(result.content).toContain("Camofox Bypassed Page");
    expect((result.data as any).provider).toBe("camofox");
    expect((result.data as any).fallbackFrom).toBe("scrapling");
  });
});
