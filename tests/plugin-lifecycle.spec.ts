import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";

describe("plugin worker lifecycle", () => {
  it("registers both web tools in setup and responds to health and tool execution", async () => {
    const harness = createTestHarness({
      manifest,
      config: {
        baseUrl: "http://vansrouter:20128",
        apiKeyRef: "VANS_API_KEY",
        searchProvider: "searxng",
        fetchProvider: "scrapling",
        timeoutMs: 5000,
        maxSearchResults: 5,
        maxContentChars: 2000,
        allowedDomains: [],
        blockedDomains: [],
      },
    });

    // Mock secrets resolution on harness context
    harness.ctx.secrets.resolve = async (ref: string) => `test-token-for-${ref}`;

    // Mock outbound HTTP via ctx.http.fetch
    harness.ctx.http.fetch = async (url: string) => {
      if (url.endsWith("/v1/search")) {
        return new Response(JSON.stringify({
          model: "searxng",
          query: "test search",
          results: [{ title: "T", url: "https://example.com/", snippet: "S", position: 1 }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/v1/web/fetch")) {
        return new Response(JSON.stringify({
          provider: "scrapling",
          url: "https://example.com/",
          title: "Example Title",
          content: { format: "markdown", text: "Fetched body text", length: 17 },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("Not found", { status: 404 });
    };

    await plugin.definition.setup(harness.ctx);

    const health = await plugin.definition.onHealth?.();
    expect(health).toEqual({ status: "ok", message: "Vans Web Tools plugin is running" });

    // Execute vans_web_search through the harness
    const searchResult = await harness.executeTool("vans_web_search", { query: "test search" });
    expect(searchResult.error).toBeUndefined();
    expect(searchResult.content).toContain("https://example.com/");
    const searchData = searchResult.data as { count: number; results: any[] };
    expect(searchData.count).toBe(1);

    // Execute vans_web_fetch through the harness
    const fetchResult = await harness.executeTool("vans_web_fetch", { url: "https://example.com/" });
    expect(fetchResult.error).toBeUndefined();
    expect(fetchResult.content).toContain("Fetched body text");
    const fetchData = fetchResult.data as { provider: string; title: string };
    expect(fetchData.provider).toBe("scrapling");
    expect(fetchData.title).toBe("Example Title");
  });
});
