import type { ToolResult } from "@paperclipai/plugin-sdk";
import type { PluginConfig, SearchProvider } from "../types.js";
import type { SearchRequest, SearchResponse, VansRouterClient } from "../vans-client.js";

const SEARCH_PROVIDERS: SearchProvider[] = ["searxng", "tavily"];
const KNOWN_PARAMS = new Set([
  "query",
  "provider",
  "maxResults",
  "searchType",
  "language",
  "country",
  "timeRange",
]);

function providerOrder(params: Record<string, unknown>, config: PluginConfig): SearchProvider[] {
  const requested = params.provider === "auto" || params.provider === undefined
    ? config.searchProvider
    : params.provider;
  if (!SEARCH_PROVIDERS.includes(requested as SearchProvider)) return [];
  const fallbackProviders = config.searchFallbackProviders
    ?? SEARCH_PROVIDERS.filter((provider) => provider !== requested);
  return [...new Set([
    requested as SearchProvider,
    ...fallbackProviders,
  ])];
}

function renderSearchResult(
  upstream: SearchResponse,
  query: string,
  effectiveMax: number,
  provider: SearchProvider,
  firstProvider: SearchProvider,
  attempts: SearchProvider[],
): ToolResult {
  const results = (upstream.results ?? []).slice(0, effectiveMax).map((item, idx) => ({
    position: item.position ?? idx + 1,
    title: (item.title ?? "").slice(0, 300),
    url: item.url,
    snippet: (item.snippet ?? "").slice(0, 2000),
    sourceType: item.source_type,
    publishedAt: item.published_at ?? null,
  }));

  const textLines: string[] = [`Search results for "${query}":`, `Provider: ${provider}`];
  if (provider !== firstProvider) textLines.push(`Fallback from: ${firstProvider}`);
  if (results.length === 0) {
    textLines.push("No results found.");
  } else {
    for (const item of results) {
      textLines.push(`[${item.position}] ${item.title}`);
      textLines.push(`URL: ${item.url}`);
      if (item.snippet) textLines.push(`Snippet: ${item.snippet}`);
      textLines.push("");
    }
  }

  return {
    content: textLines.join("\n").trim(),
    data: {
      provider,
      fallbackFrom: provider === firstProvider ? null : firstProvider,
      attempts,
      query,
      results,
      count: results.length,
    },
  };
}

export async function executeWebSearch(
  client: VansRouterClient,
  config: PluginConfig,
  rawParams: unknown,
): Promise<ToolResult> {
  if (!rawParams || typeof rawParams !== "object" || Array.isArray(rawParams)) {
    return { error: "Parameters must be an object", content: "Error: Parameters must be an object" };
  }
  const params = rawParams as Record<string, unknown>;

  for (const key of Object.keys(params)) {
    if (!KNOWN_PARAMS.has(key)) {
      return { error: `Unknown parameter: ${key}`, content: `Error: Unknown parameter "${key}"` };
    }
  }

  const query = typeof params.query === "string" ? params.query.trim() : "";
  if (!query) {
    return { error: "query is required and must be non-empty", content: "Error: query is required" };
  }
  if (query.length > 500) {
    return { error: "query is too long (max 500 characters)", content: "Error: query is too long" };
  }

  const providers = providerOrder(params, config);
  if (providers.length === 0) {
    return { error: "provider must be auto, searxng, or tavily", content: "Error: unsupported search provider" };
  }

  let requestedMax = typeof params.maxResults === "number" ? Math.floor(params.maxResults) : config.maxSearchResults;
  if (!Number.isFinite(requestedMax) || requestedMax < 1) requestedMax = 1;
  const effectiveMax = Math.min(requestedMax, config.maxSearchResults);
  const searchType = params.searchType === "news" ? "news" : "web";
  const language = typeof params.language === "string" && params.language.trim() ? params.language.trim() : undefined;
  const country = typeof params.country === "string" && params.country.trim() ? params.country.trim() : undefined;
  const timeRange = ["day", "week", "month", "year"].includes(String(params.timeRange))
    ? (params.timeRange as "day" | "week" | "month" | "year")
    : undefined;

  const attempts: SearchProvider[] = [];
  let lastError = "Search failed";
  for (const provider of providers) {
    attempts.push(provider);
    const request: SearchRequest = {
      model: provider,
      provider,
      query,
      max_results: effectiveMax,
      search_type: searchType,
      language,
      country,
      time_range: timeRange,
    };
    try {
      const upstream = await client.search(request);
      return renderSearchResult(upstream, query, effectiveMax, provider, providers[0]!, attempts);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    error: lastError,
    content: `Search failed after providers ${attempts.join(", ")}: ${lastError}`,
    data: { attempts },
  };
}
