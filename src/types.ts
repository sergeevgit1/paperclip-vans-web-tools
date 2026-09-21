export type SecretRefBinding = {
  type: "secret_ref";
  secretId: string;
  version?: "latest" | number;
};

export type SearchProvider = "searxng" | "tavily";
export type FetchProvider = "auto" | "scrapling" | "camofox" | "jina-reader";
export type ScraplingMode = "fast" | "browser" | "stealth";

export type PluginConfig = {
  baseUrl: string;
  apiKeyRef: string | SecretRefBinding;
  searchProvider: SearchProvider;
  fetchProvider: FetchProvider;
  searchFallbackProviders?: SearchProvider[];
  fetchFallbackProviders?: FetchProvider[];
  timeoutMs: number;
  maxSearchResults: number;
  maxContentChars: number;
  allowedDomains: string[];
  blockedDomains: string[];
};

export const DEFAULT_CONFIG: PluginConfig = {
  baseUrl: "http://vansrouter:20128",
  apiKeyRef: "VANS_API_KEY",
  searchProvider: "searxng",
  fetchProvider: "scrapling",
  searchFallbackProviders: ["tavily"],
  fetchFallbackProviders: ["camofox", "jina-reader"],
  timeoutMs: 30_000,
  maxSearchResults: 5,
  maxContentChars: 20_000,
  allowedDomains: [],
  blockedDomains: [],
};
