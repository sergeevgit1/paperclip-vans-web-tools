import type { ToolResult } from "@paperclipai/plugin-sdk";
import { validateWebUrl } from "../security.js";
import type { FetchProvider, PluginConfig, ScraplingMode } from "../types.js";
import type { VansRouterClient, WebFetchRequest, WebFetchResponse } from "../vans-client.js";

const VALID_PROVIDERS: Array<Exclude<FetchProvider, "auto">> = ["scrapling", "camofox", "jina-reader"];
const SCRAPLING_MODES: ScraplingMode[] = ["fast", "browser", "stealth"];
const KNOWN_PARAMS = new Set(["url", "format", "maxChars", "provider", "mode"]);

function buildProviderQueue(
  params: Record<string, unknown>,
  config: PluginConfig,
): Array<Exclude<FetchProvider, "auto">> {
  const chosen = params.provider === "auto" || params.provider === undefined
    ? (config.fetchProvider === "auto" ? "scrapling" : config.fetchProvider)
    : params.provider;
  if (!VALID_PROVIDERS.includes(chosen as any)) return [];

  const rawFallback = config.fetchFallbackProviders ?? ["camofox", "jina-reader"];
  const cleanFallback = rawFallback.filter(
    (p): p is Exclude<FetchProvider, "auto"> => p !== "auto" && VALID_PROVIDERS.includes(p as any),
  );

  return [...new Set([chosen as Exclude<FetchProvider, "auto">, ...cleanFallback])];
}

function renderFetchResult(
  upstream: WebFetchResponse,
  effectiveProvider: Exclude<FetchProvider, "auto">,
  initialProvider: Exclude<FetchProvider, "auto">,
  effectiveMax: number,
  format: "markdown" | "text",
  attempts: Array<Exclude<FetchProvider, "auto">>,
): ToolResult {
  const fullText = upstream.content?.text;
  if (typeof fullText !== "string") {
    return {
      error: "Invalid upstream response: content.text must be a string",
      content: "Fetch failed: Invalid upstream response",
    };
  }

  const content = fullText.slice(0, effectiveMax);
  const truncated = content.length < fullText.length;
  const title = upstream.title ?? null;
  const fallbackFrom = effectiveProvider === initialProvider ? null : initialProvider;

  return {
    content: [
      title ? `Title: ${title}` : null,
      `URL: ${upstream.url}`,
      `Provider: ${effectiveProvider}`,
      fallbackFrom ? `Fallback from: ${fallbackFrom}` : null,
      truncated ? `[Content truncated to ${effectiveMax} characters]` : null,
      "",
      content,
    ].filter((line) => line !== null).join("\n"),
    data: {
      provider: effectiveProvider,
      fallbackFrom,
      attempts,
      url: upstream.url,
      title,
      format: upstream.content.format ?? format,
      content,
      contentChars: content.length,
      truncated,
    },
  };
}

export async function executeWebFetch(
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

  if (typeof params.url !== "string" || !params.url.trim()) {
    return { error: "url is required", content: "Error: url is required" };
  }

  if (params.format !== undefined && params.format !== "markdown" && params.format !== "text") {
    return { error: "format must be markdown or text", content: "Error: format must be markdown or text" };
  }

  if (params.mode !== undefined && !SCRAPLING_MODES.includes(params.mode as ScraplingMode)) {
    return { error: "mode must be one of: fast, browser, stealth", content: "Error: invalid mode" };
  }

  const providers = buildProviderQueue(params, config);
  if (providers.length === 0) {
    return {
      error: "provider must be one of: auto, scrapling, camofox, jina-reader",
      content: "Error: unsupported fetch provider",
    };
  }

  let parsed: URL;
  try {
    parsed = validateWebUrl(params.url, {
      allowedDomains: config.allowedDomains,
      blockedDomains: config.blockedDomains,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message, content: `Fetch blocked: ${message}` };
  }

  const format = params.format === "text" ? "text" : "markdown";
  let requestedMax = typeof params.maxChars === "number" ? Math.floor(params.maxChars) : config.maxContentChars;
  if (!Number.isFinite(requestedMax) || requestedMax < 1_000) requestedMax = 1_000;
  const effectiveMax = Math.min(requestedMax, config.maxContentChars);

  const attempts: Array<Exclude<FetchProvider, "auto">> = [];
  let lastError = "Fetch failed";
  const initialProvider = providers[0]!;

  for (const provider of providers) {
    attempts.push(provider);
    const request: WebFetchRequest = {
      provider,
      url: parsed.href,
      format,
    };
    if (provider === "scrapling" && typeof params.mode === "string") {
      request.mode = params.mode as ScraplingMode;
    }

    try {
      const upstream = await client.fetch(request);
      return renderFetchResult(upstream, provider, initialProvider, effectiveMax, format, attempts);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return {
    error: lastError,
    content: `Fetch failed after providers ${attempts.join(", ")}: ${lastError}`,
    data: { attempts },
  };
}
