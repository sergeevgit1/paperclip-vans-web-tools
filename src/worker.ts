import { definePlugin, runWorker, type PluginContext, type ToolResult, type ToolRunContext } from "@paperclipai/plugin-sdk";
import manifest, { validatePluginConfig } from "./manifest.js";
import { executeWebFetch } from "./tools/fetch.js";
import { executeWebSearch } from "./tools/search.js";
import { DEFAULT_CONFIG, type PluginConfig } from "./types.js";
import { VansRouterClient } from "./vans-client.js";

async function resolveEffectiveConfig(ctx: PluginContext): Promise<PluginConfig> {
  const raw = await ctx.config.get();
  return {
    ...DEFAULT_CONFIG,
    ...(raw as Partial<PluginConfig>),
  };
}

async function createClientForRun(ctx: PluginContext, config: PluginConfig): Promise<VansRouterClient> {
  if (!config.apiKeyRef) {
    throw new Error("Plugin configuration error: apiKeyRef is required");
  }

  const resolvedKey = await ctx.secrets.resolve(config.apiKeyRef as unknown as string);
  if (!resolvedKey || typeof resolvedKey !== "string") {
    throw new Error("Failed to resolve secret reference for VansRouter API key");
  }

  const fetcher = ctx.http ? (url: string, init?: RequestInit) => ctx.http.fetch(url, init) : fetch;

  return new VansRouterClient({
    baseUrl: config.baseUrl,
    apiKey: resolvedKey,
    timeoutMs: config.timeoutMs,
    fetcher,
  });
}

const plugin = definePlugin({
  async setup(ctx: PluginContext) {
    ctx.logger.info("Initializing Vans Web Tools plugin");

    const searchDecl = manifest.tools?.find((t) => t.name === "vans_web_search");
    if (!searchDecl) {
      throw new Error("Manifest is missing declaration for vans_web_search");
    }

    ctx.tools.register(
      "vans_web_search",
      {
        displayName: searchDecl.displayName,
        description: searchDecl.description,
        parametersSchema: searchDecl.parametersSchema,
      },
      async (params: unknown, _runCtx: ToolRunContext): Promise<ToolResult> => {
        try {
          const config = await resolveEffectiveConfig(ctx);
          const client = await createClientForRun(ctx, config);
          return await executeWebSearch(client, config, params);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { error: message, content: `Tool error: ${message}` };
        }
      },
    );

    const fetchDecl = manifest.tools?.find((t) => t.name === "vans_web_fetch");
    if (!fetchDecl) {
      throw new Error("Manifest is missing declaration for vans_web_fetch");
    }

    ctx.tools.register(
      "vans_web_fetch",
      {
        displayName: fetchDecl.displayName,
        description: fetchDecl.description,
        parametersSchema: fetchDecl.parametersSchema,
      },
      async (params: unknown, _runCtx: ToolRunContext): Promise<ToolResult> => {
        try {
          const config = await resolveEffectiveConfig(ctx);
          const client = await createClientForRun(ctx, config);
          return await executeWebFetch(client, config, params);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { error: message, content: `Tool error: ${message}` };
        }
      },
    );
  },

  async onHealth() {
    return { status: "ok", message: "Vans Web Tools plugin is running" };
  },

  async onValidateConfig(config) {
    return validatePluginConfig(config);
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
