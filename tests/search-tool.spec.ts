import { describe, expect, it } from "vitest";
import { executeWebSearch } from "../src/tools/search.js";
import type { PluginConfig } from "../src/types.js";
import type { SearchRequest, SearchResponse } from "../src/vans-client.js";

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

describe("executeWebSearch", () => {
  it("rejects invalid inputs", async () => {
    const fakeClient = { search: async () => ({ model: "searxng", query: "", results: [] }) };
    await expect(executeWebSearch(fakeClient as any, config, { query: "" }))
      .resolves.toMatchObject({ error: expect.stringMatching(/query is required/i) });

    await expect(executeWebSearch(fakeClient as any, config, { query: "ok", extra: 1 }))
      .resolves.toMatchObject({ error: expect.stringMatching(/unknown parameter/i) });
  });

  it("normalizes and caps results to config limit", async () => {
    let capturedRequest: SearchRequest | null = null;
    const fakeClient = {
      search: async (req: SearchRequest): Promise<SearchResponse> => {
        capturedRequest = req;
        return {
          model: "searxng",
          query: req.query,
          results: [
            { title: "Result 1", url: "https://example.com/1", snippet: "S".repeat(5000), position: 1 },
            { title: "Result 2", url: "https://example.com/2", snippet: "Snippet 2", position: 2 },
            { title: "Result 3", url: "https://example.com/3", snippet: "Snippet 3", position: 3 },
          ],
        };
      },
    };

    const toolResult = await executeWebSearch(
      fakeClient as any,
      { ...config, maxSearchResults: 2 },
      { query: "example query", maxResults: 10 },
    );

    expect(toolResult.error).toBeUndefined();
    expect(capturedRequest).toMatchObject({
      model: "searxng",
      query: "example query",
      max_results: 2,
    });

    const data = toolResult.data as { results: Array<{ title: string; snippet?: string }> };
    expect(data.results).toHaveLength(2);
    expect(data.results[0]?.snippet?.length).toBeLessThanOrEqual(2000);
    expect(toolResult.content).toContain("Result 1");
    expect(toolResult.content).toContain("https://example.com/1");
  });

  it("returns safe error when upstream search fails", async () => {
    const fakeClient = {
      search: async (): Promise<SearchResponse> => {
        throw new Error("VansRouter authentication failed. Please check apiKeyRef configuration.");
      },
    };

    const toolResult = await executeWebSearch(fakeClient as any, config, { query: "fail" });
    expect(toolResult.error).toMatch(/authentication failed/i);
    expect(toolResult.content).toContain("Search failed");
  });
});
