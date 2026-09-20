import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../dist/manifest.js";
import plugin from "../dist/worker.js";

const baseUrl = process.env.VANS_BASE_URL ?? "http://127.0.0.1:20129";
const apiKey = process.env.VANS_API_KEY;
if (!apiKey) throw new Error("VANS_API_KEY is required");

const harness = createTestHarness({
  manifest,
  config: {
    baseUrl,
    apiKeyRef: "VANS_API_KEY",
    searchProvider: "searxng",
    fetchProvider: "scrapling",
    timeoutMs: 30_000,
    maxSearchResults: 3,
    maxContentChars: 5_000,
    allowedDomains: [],
    blockedDomains: [],
  },
});

harness.ctx.secrets.resolve = async (ref) => {
  if (ref !== "VANS_API_KEY") throw new Error("Unexpected secret reference");
  return apiKey;
};
harness.ctx.http.fetch = globalThis.fetch;

await plugin.definition.setup(harness.ctx);

const search = await harness.executeTool("vans_web_search", {
  query: "Example Domain IANA",
  maxResults: 2,
});
if (search.error) throw new Error(`Search smoke failed: ${search.error}`);
const searchData = search.data;
if (!searchData || !Array.isArray(searchData.results) || searchData.results.length === 0) {
  throw new Error("Search smoke returned no results");
}

const page = await harness.executeTool("vans_web_fetch", {
  url: "https://example.com/",
  format: "markdown",
  maxChars: 5_000,
});
if (page.error) throw new Error(`Fetch smoke failed: ${page.error}`);
const pageData = page.data;
if (!pageData || typeof pageData.content !== "string" || pageData.content.length === 0) {
  throw new Error("Fetch smoke returned empty content");
}

const serialized = JSON.stringify({ search, page });
if (serialized.includes(apiKey)) throw new Error("Secret leaked into tool result");

console.log(JSON.stringify({
  pluginId: manifest.id,
  toolCount: manifest.tools?.length ?? 0,
  searchResults: searchData.results.length,
  firstSearchHost: new URL(searchData.results[0].url).hostname,
  fetchProvider: pageData.provider,
  fetchedChars: pageData.contentChars,
  fetchTruncated: pageData.truncated,
  secretLeak: false,
}));
