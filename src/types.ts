export type FetchProvider = "scrapling" | "jina-reader" | "camofox";

export type PluginConfig = {
  baseUrl: string;
  apiKeyRef: string;
  searchProvider: "searxng";
  fetchProvider: FetchProvider;
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
  timeoutMs: 30_000,
  maxSearchResults: 5,
  maxContentChars: 20_000,
  allowedDomains: [],
  blockedDomains: [],
};
