import type { ToolResult } from "@paperclipai/plugin-sdk";
import { validateWebUrl } from "../security.js";
import type { PluginConfig } from "../types.js";
import type { VansRouterClient } from "../vans-client.js";

const KNOWN_PARAMS = new Set(["url", "format", "maxChars"]);

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

  try {
    const upstream = await client.fetch({
      provider: config.fetchProvider,
      url: parsed.href,
      format,
    });

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

    return {
      content: [
        title ? `Title: ${title}` : null,
        `URL: ${upstream.url}`,
        `Provider: ${upstream.provider}`,
        truncated ? `[Content truncated to ${effectiveMax} characters]` : null,
        "",
        content,
      ].filter((line) => line !== null).join("\n"),
      data: {
        provider: upstream.provider,
        url: upstream.url,
        title,
        format: upstream.content.format ?? format,
        content,
        contentChars: content.length,
        truncated,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: message,
      content: `Fetch failed: ${message}`,
    };
  }
}
