import { describe, expect, it } from "vitest";
import manifest, { validatePluginConfig } from "../src/manifest.js";

const validConfig = {
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

describe("plugin manifest", () => {
  it("declares the minimal Paperclip V1 plugin surface", () => {
    expect(manifest).toMatchObject({
      id: "zaruba.vans-web-tools",
      apiVersion: 1,
      version: "0.2.0",
      entrypoints: { worker: "./dist/worker.js" },
      capabilities: [
        "agent.tools.register",
        "http.outbound",
        "secrets.read-ref",
      ],
    });
    expect(manifest.tools?.map((tool) => tool.name)).toEqual([
      "vans_web_search",
      "vans_web_fetch",
    ]);
  });

  it("uses apiKeyRef and has no plaintext apiKey setting", () => {
    const properties = (manifest.instanceConfigSchema?.properties ?? {}) as Record<string, Record<string, unknown>>;
    expect(properties).toHaveProperty("apiKeyRef");
    expect(properties).not.toHaveProperty("apiKey");
    expect(properties.apiKeyRef).toMatchObject({
      format: "secret-ref",
      oneOf: expect.arrayContaining([
        expect.objectContaining({ type: "string" }),
        expect.objectContaining({ type: "object" }),
      ]),
    });
    expect(manifest.instanceConfigSchema).toMatchObject({ additionalProperties: false });
  });

  it("exposes provider choice, fallback order, and scrapling anti-bot modes", () => {
    const configProperties = (manifest.instanceConfigSchema?.properties ?? {}) as Record<string, Record<string, any>>;
    expect(configProperties.searchProvider?.enum).toEqual(["searxng", "tavily"]);
    expect(configProperties.fetchProvider?.enum).toEqual(["auto", "scrapling", "camofox", "jina-reader"]);
    expect(configProperties.searchFallbackProviders?.items.enum).toEqual(["searxng", "tavily"]);
    expect(configProperties.fetchFallbackProviders?.items.enum).toEqual(["scrapling", "camofox", "jina-reader"]);

    const searchTool = manifest.tools?.find((tool) => tool.name === "vans_web_search");
    const fetchTool = manifest.tools?.find((tool) => tool.name === "vans_web_fetch");
    const searchParams = searchTool?.parametersSchema.properties as Record<string, Record<string, unknown>>;
    const fetchParams = fetchTool?.parametersSchema.properties as Record<string, Record<string, unknown>>;
    expect(searchParams.provider?.enum).toEqual(["auto", "searxng", "tavily"]);
    expect(fetchParams.provider?.enum).toEqual(["auto", "scrapling", "camofox", "jina-reader"]);
    expect(fetchParams.mode?.enum).toEqual(["fast", "browser", "stealth"]);
  });

  it("accepts an object-shaped secret_ref binding", () => {
    const result = validatePluginConfig({
      ...validConfig,
      apiKeyRef: { type: "secret_ref", secretId: "11111111-1111-4111-8111-111111111111", version: "latest" },
    });
    expect(result).toEqual({ ok: true, errors: [], warnings: [] });
  });
});

describe("validatePluginConfig", () => {
  it("accepts a valid config and normalizes the base URL", () => {
    const result = validatePluginConfig({ ...validConfig, baseUrl: "http://vansrouter:20128/" });
    expect(result).toEqual({ ok: true, errors: [], warnings: [] });
  });

  it.each([
    "",
    "vansrouter:20128",
    "ftp://vansrouter:20128",
    "http://vansrouter:20128/v1",
    "http://vansrouter:20128?x=1",
    "http://vansrouter:20128#x",
    "http://user:pass@vansrouter:20128",
  ])("rejects invalid baseUrl: %s", (baseUrl) => {
    expect(validatePluginConfig({ ...validConfig, baseUrl }).errors).not.toEqual([]);
  });

  it("requires apiKeyRef but does not validate or expose a key value", () => {
    expect(validatePluginConfig({ ...validConfig, apiKeyRef: "" }).errors).toContain("apiKeyRef is required");
    expect(validatePluginConfig({ ...validConfig, apiKey: "secret" }).errors).toContain("Unknown config field: apiKey");
  });

  it.each([
    ["timeoutMs", 999],
    ["timeoutMs", 60_001],
    ["maxSearchResults", 0],
    ["maxSearchResults", 21],
    ["maxContentChars", 999],
    ["maxContentChars", 100_001],
  ])("rejects %s outside its range", (field, value) => {
    expect(validatePluginConfig({ ...validConfig, [field]: value }).errors).not.toEqual([]);
  });

  it("rejects unsupported providers", () => {
    expect(validatePluginConfig({ ...validConfig, searchProvider: "google" }).errors)
      .toContain("searchProvider must be one of: searxng, tavily");
    expect(validatePluginConfig({ ...validConfig, fetchProvider: "firecrawl" }).errors)
      .toContain("fetchProvider must be one of: auto, scrapling, camofox, jina-reader");
  });

  it("rejects unknown fields and invalid domain lists", () => {
    expect(validatePluginConfig({ ...validConfig, extra: true }).errors)
      .toContain("Unknown config field: extra");
    expect(validatePluginConfig({ ...validConfig, allowedDomains: ["127.0.0.1"] }).errors)
      .not.toEqual([]);
  });
});
