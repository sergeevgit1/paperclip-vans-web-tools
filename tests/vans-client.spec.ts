import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VansRouterClient } from "../src/vans-client.js";

describe("VansRouterClient", () => {
  let server: http.Server;
  let baseUrl: string;
  let receivedRequests: Array<{ method?: string; url?: string; headers: http.IncomingHttpHeaders; body: string }> = [];
  let handler: http.RequestListener;

  beforeEach(async () => {
    receivedRequests = [];
    server = http.createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => { body += String(chunk); });
      req.on("end", () => {
        receivedRequests.push({ method: req.method, url: req.url, headers: req.headers, body });
        handler(req, res);
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("performs search and attaches Bearer authorization", async () => {
    handler = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        model: "searxng",
        query: "test query",
        results: [
          { title: "Result 1", url: "https://example.com/1", snippet: "Snippet 1", position: 1 },
        ],
      }));
    };

    const client = new VansRouterClient({
      baseUrl,
      apiKey: "test-mock-key",
      timeoutMs: 5000,
    });

    const response = await client.search({
      model: "searxng",
      query: "test query",
      max_results: 5,
      search_type: "web",
    });

    expect(response.results).toHaveLength(1);
    expect(receivedRequests[0]?.url).toBe("/v1/search");
    expect(receivedRequests[0]?.headers.authorization).toBe("Bearer test-mock-key");
    expect(receivedRequests[0]?.headers["content-type"]).toBe("application/json");
  });

  it("performs fetch and normalizes the payload", async () => {
    handler = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        provider: "scrapling",
        url: "https://example.com/",
        title: "Example",
        format: "markdown",
        content: { format: "markdown", text: "# Example Domain", length: 16 },
      }));
    };

    const client = new VansRouterClient({
      baseUrl,
      apiKey: "test-mock-key",
      timeoutMs: 5000,
    });

    const response = await client.fetch({
      provider: "scrapling",
      url: "https://example.com/",
      format: "markdown",
    });

    expect(response.title).toBe("Example");
    expect(response.content.text).toBe("# Example Domain");
    expect(response.content.format).toBe("markdown");
    expect(receivedRequests[0]?.url).toBe("/v1/web/fetch");
  });

  it("redacts credentials and token from upstream errors", async () => {
    handler = (_req, res) => {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid token: test-mock-key" }));
    };

    const client = new VansRouterClient({
      baseUrl,
      apiKey: "test-mock-key",
      timeoutMs: 5000,
    });

    await expect(client.search({ model: "searxng", query: "test" }))
      .rejects.toThrowError(/authentication failed/i);
    await expect(client.search({ model: "searxng", query: "test" }))
      .rejects.not.toThrowError(/test-mock-key/);
  });

  it("protects against oversized upstream response bodies", async () => {
    handler = (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end("A".repeat(50_000));
    };

    const client = new VansRouterClient({
      baseUrl,
      apiKey: "token",
      timeoutMs: 5000,
      maxResponseBytes: 10_000,
    });

    await expect(client.fetch({ provider: "scrapling", url: "https://example.com/", format: "markdown" }))
      .rejects.toThrow(/response too large/i);
  });
});
