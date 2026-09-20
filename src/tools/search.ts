import type { ToolResult } from "@paperclipai/plugin-sdk";
import type { PluginConfig } from "../types.js";
import type { SearchRequest, VansRouterClient } from "../vans-client.js";

const KNOWN_PARAMS = new Set([
  "query",
  "maxResults",
  "searchType",
  "language",
  "country",
  "timeRange",
]);

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

  let requestedMax = typeof params.maxResults === "number" ? Math.floor(params.maxResults) : config.maxSearchResults;
  if (!Number.isFinite(requestedMax) || requestedMax < 1) requestedMax = 1;
  const effectiveMax = Math.min(requestedMax, config.maxSearchResults);

  const searchType = params.searchType === "news" ? "news" : "web";
  const language = typeof params.language === "string" && params.language.trim() ? params.language.trim() : undefined;
  const country = typeof params.country === "string" && params.country.trim() ? params.country.trim() : undefined;
  const timeRange = ["day", "week", "month", "year"].includes(String(params.timeRange))
    ? (params.timeRange as "day" | "week" | "month" | "year")
    : undefined;

  const request: SearchRequest = {
    model: "searxng",
    query,
    max_results: effectiveMax,
    search_type: searchType,
    language,
    country,
    time_range: timeRange,
  };

  try {
    const upstream = await client.search(request);
    const results = (upstream.results ?? []).slice(0, effectiveMax).map((item, idx) => ({
      position: item.position ?? idx + 1,
      title: (item.title ?? "").slice(0, 300),
      url: item.url,
      snippet: (item.snippet ?? "").slice(0, 2000),
      sourceType: item.source_type,
      publishedAt: item.published_at ?? null,
    }));

    const textLines: string[] = [`Search results for "${query}":`];
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
        provider: "searxng",
        query,
        results,
        count: results.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: message,
      content: `Search failed: ${message}`,
    };
  }
}
