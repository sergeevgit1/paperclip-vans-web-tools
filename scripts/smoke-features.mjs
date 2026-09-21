import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../dist/manifest.js";
import plugin from "../dist/worker.js";

const baseUrl = process.env.VANS_BASE_URL ?? "https://rout.unicrawl.ru";
const apiKey = process.env.VANS_API_KEY;
if (!apiKey) throw new Error("VANS_API_KEY is required");

const harness = createTestHarness({
  manifest,
  config: {
    baseUrl,
    apiKeyRef: "VANS_API_KEY",
    searchProvider: "searxng",
    fetchProvider: "scrapling",
    searchFallbackProviders: ["searxng"],
    fetchFallbackProviders: ["camofox", "jina-reader"],
    timeoutMs: 30_000,
    maxSearchResults: 3,
    maxContentChars: 5_000,
    allowedDomains: [],
    blockedDomains: [],
  },
});

harness.ctx.secrets.resolve = async () => apiKey;
harness.ctx.http.fetch = (url, init) => {
  const headers = new Headers(init?.headers);
  headers.set("User-Agent", "Mozilla/5.0");
  headers.set("Origin", "https://company.unicrawl.ru");
  headers.set("Referer", "https://company.unicrawl.ru/");
  return fetch(url, { ...init, headers });
};

await plugin.definition.setup(harness.ctx);

const searchFallback = await harness.executeTool("vans_web_search", {
  query: "OpenAI news",
  provider: "tavily",
  maxResults: 2,
});

const fetchScraplingStealth = await harness.executeTool("vans_web_fetch", {
  url: "https://example.com/",
  provider: "scrapling",
  mode: "stealth",
  format: "markdown",
});

const fetchCamofox = await harness.executeTool("vans_web_fetch", {
  url: "https://example.com/",
  provider: "camofox",
  format: "markdown",
});

const serialized = JSON.stringify({ searchFallback, fetchScraplingStealth, fetchCamofox });
if (serialized.includes(apiKey)) throw new Error("API key leak detected!");

console.log(JSON.stringify({
  searchFallback: {
    requested: "tavily",
    effective: searchFallback.data?.provider,
    fallbackFrom: searchFallback.data?.fallbackFrom,
    count: searchFallback.data?.count,
  },
  fetchScraplingStealth: {
    provider: fetchScraplingStealth.data?.provider,
    chars: fetchScraplingStealth.data?.contentChars,
  },
  fetchCamofox: {
    provider: fetchCamofox.data?.provider,
    chars: fetchCamofox.data?.contentChars,
  },
  secretLeak: false,
}, null, 2));
