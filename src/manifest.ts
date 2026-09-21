import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import { PLUGIN_ID, PLUGIN_VERSION } from "./constants.js";
import { validateDomainPattern } from "./security.js";
import { DEFAULT_CONFIG } from "./types.js";

const CONFIG_FIELDS = new Set(Object.keys(DEFAULT_CONFIG));
const SEARCH_PROVIDERS = ["searxng", "tavily"] as const;
const FETCH_PROVIDERS = ["auto", "scrapling", "camofox", "jina-reader"] as const;

export function validatePluginConfig(config: unknown): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ok: false, errors: ["Config must be an object"], warnings };
  }
  const value = config as Record<string, unknown>;

  for (const field of Object.keys(value)) {
    if (!CONFIG_FIELDS.has(field)) errors.push(`Unknown config field: ${field}`);
  }

  if (typeof value.baseUrl !== "string" || !value.baseUrl.trim()) {
    errors.push("baseUrl is required");
  } else {
    try {
      const base = new URL(value.baseUrl.trim());
      if (base.protocol !== "http:" && base.protocol !== "https:") errors.push("baseUrl must use http or https");
      if (base.username || base.password) errors.push("baseUrl must not contain credentials");
      if (base.search || base.hash) errors.push("baseUrl must not contain query or fragment");
      if (base.pathname !== "/" && base.pathname !== "") errors.push("baseUrl must not contain a path");
    } catch {
      errors.push("baseUrl must be a valid absolute URL");
    }
  }

  if (typeof value.apiKeyRef === "string") {
    if (!value.apiKeyRef.trim()) errors.push("apiKeyRef is required");
  } else if (value.apiKeyRef && typeof value.apiKeyRef === "object" && !Array.isArray(value.apiKeyRef)) {
    const ref = value.apiKeyRef as Record<string, unknown>;
    if (ref.type !== "secret_ref") errors.push('apiKeyRef.type must be "secret_ref"');
    if (typeof ref.secretId !== "string" || !ref.secretId.trim()) errors.push("apiKeyRef.secretId is required");
  } else {
    errors.push("apiKeyRef is required and must be a string or a secret_ref object");
  }
  if (!SEARCH_PROVIDERS.includes(value.searchProvider as typeof SEARCH_PROVIDERS[number])) {
    errors.push("searchProvider must be one of: searxng, tavily");
  }
  if (!FETCH_PROVIDERS.includes(value.fetchProvider as typeof FETCH_PROVIDERS[number])) {
    errors.push("fetchProvider must be one of: auto, scrapling, camofox, jina-reader");
  }

  if (value.searchFallbackProviders !== undefined) {
    if (!Array.isArray(value.searchFallbackProviders)) {
      errors.push("searchFallbackProviders must be an array");
    } else {
      for (const p of value.searchFallbackProviders) {
        if (!SEARCH_PROVIDERS.includes(p as typeof SEARCH_PROVIDERS[number])) {
          errors.push(`Invalid search fallback provider: ${p}`);
        }
      }
    }
  }

  if (value.fetchFallbackProviders !== undefined) {
    if (!Array.isArray(value.fetchFallbackProviders)) {
      errors.push("fetchFallbackProviders must be an array");
    } else {
      for (const p of value.fetchFallbackProviders) {
        if (p === "auto" || !FETCH_PROVIDERS.includes(p as typeof FETCH_PROVIDERS[number])) {
          errors.push(`Invalid fetch fallback provider: ${p}`);
        }
      }
    }
  }

  validateIntegerRange(value.timeoutMs, 1_000, 60_000, "timeoutMs", errors);
  validateIntegerRange(value.maxSearchResults, 1, 20, "maxSearchResults", errors);
  validateIntegerRange(value.maxContentChars, 1_000, 100_000, "maxContentChars", errors);

  validateDomainList(value.allowedDomains, "allowedDomains", errors);
  validateDomainList(value.blockedDomains, "blockedDomains", errors);

  return { ok: errors.length === 0, errors, warnings };
}

function validateIntegerRange(value: unknown, min: number, max: number, field: string, errors: string[]): void {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    errors.push(`${field} must be an integer between ${min} and ${max}`);
  }
}

function validateDomainList(value: unknown, field: string, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array`);
    return;
  }
  for (const domain of value) {
    if (typeof domain !== "string") {
      errors.push(`${field} must contain only strings`);
      continue;
    }
    try {
      validateDomainPattern(domain, field);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Invalid domain in ${field}`);
    }
  }
}

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Vans Web Tools",
  description: "Web search and public page fetch through VansRouter.",
  author: "Openser",
  categories: ["connector"],
  capabilities: [
    "agent.tools.register",
    "http.outbound",
    "secrets.read-ref",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    additionalProperties: false,
    required: [
      "baseUrl",
      "apiKeyRef",
      "searchProvider",
      "fetchProvider",
      "timeoutMs",
      "maxSearchResults",
      "maxContentChars",
      "allowedDomains",
      "blockedDomains",
    ],
    properties: {
      baseUrl: { type: "string", title: "VansRouter Base URL", default: DEFAULT_CONFIG.baseUrl },
      apiKeyRef: {
        title: "API key secret reference",
        format: "secret-ref",
        oneOf: [
          { type: "string", minLength: 1 },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "secretId"],
            properties: {
              type: { type: "string", const: "secret_ref" },
              secretId: { type: "string", minLength: 1 },
              version: { oneOf: [{ type: "string", const: "latest" }, { type: "integer", minimum: 1 }] },
            },
          },
        ],
        default: DEFAULT_CONFIG.apiKeyRef,
      },
      searchProvider: {
        type: "string",
        title: "Search provider",
        enum: [...SEARCH_PROVIDERS],
        default: DEFAULT_CONFIG.searchProvider,
      },
      fetchProvider: {
        type: "string",
        title: "Fetch provider",
        enum: [...FETCH_PROVIDERS],
        default: DEFAULT_CONFIG.fetchProvider,
      },
      searchFallbackProviders: {
        type: "array",
        title: "Search fallback providers",
        items: { type: "string", enum: [...SEARCH_PROVIDERS] },
        default: DEFAULT_CONFIG.searchFallbackProviders,
      },
      fetchFallbackProviders: {
        type: "array",
        title: "Fetch fallback providers",
        items: { type: "string", enum: ["scrapling", "camofox", "jina-reader"] },
        default: DEFAULT_CONFIG.fetchFallbackProviders,
      },
      timeoutMs: { type: "integer", title: "Request timeout, ms", minimum: 1_000, maximum: 60_000, default: DEFAULT_CONFIG.timeoutMs },
      maxSearchResults: { type: "integer", title: "Maximum search results", minimum: 1, maximum: 20, default: DEFAULT_CONFIG.maxSearchResults },
      maxContentChars: { type: "integer", title: "Maximum fetched characters", minimum: 1_000, maximum: 100_000, default: DEFAULT_CONFIG.maxContentChars },
      allowedDomains: { type: "array", title: "Allowed public domains", items: { type: "string" }, default: [] },
      blockedDomains: { type: "array", title: "Blocked domains", items: { type: "string" }, default: [] },
    },
  },
  tools: [
    {
      name: "vans_web_search",
      displayName: "Web Search",
      description: "Search the public web through VansRouter.",
      parametersSchema: {
        type: "object",
        additionalProperties: false,
        required: ["query"],
        properties: {
          query: { type: "string", minLength: 1, maxLength: 500 },
          provider: { type: "string", enum: ["auto", ...SEARCH_PROVIDERS], description: "Optional provider override; falls back according to company settings." },
          maxResults: { type: "integer", minimum: 1, maximum: 20 },
          searchType: { type: "string", enum: ["web", "news"] },
          language: { type: "string" },
          country: { type: "string" },
          timeRange: { type: "string", enum: ["day", "week", "month", "year"] },
        },
      },
    },
    {
      name: "vans_web_fetch",
      displayName: "Web Fetch",
      description: "Fetch readable text from one public HTTP(S) page through VansRouter.",
      parametersSchema: {
        type: "object",
        additionalProperties: false,
        required: ["url"],
        properties: {
          url: { type: "string" },
          provider: {
            type: "string",
            enum: [...FETCH_PROVIDERS],
            description: "Extraction provider (scrapling for stealth/fast scraping, camofox for heavy browser anti-bot).",
          },
          mode: {
            type: "string",
            enum: ["fast", "browser", "stealth"],
            description: "Scrapling mode (fast for standard pages, stealth for aggressive Cloudflare/WAF).",
          },
          format: { type: "string", enum: ["markdown", "text"] },
          maxChars: { type: "integer", minimum: 1_000, maximum: 100_000 },
        },
      },
    },
  ],
};

export default manifest;
