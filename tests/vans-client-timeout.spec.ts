import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VansRouterClient } from "../src/vans-client.js";

describe("VansRouterClient slow body timeout", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    server = http.createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
      });
      res.write('{"provider":"scrapling","url":"https://example.com","content":{"text":"start');
      // Intentionally never finish the body to test read timeout
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

  it("aborts when response body hangs beyond timeoutMs", async () => {
    const client = new VansRouterClient({
      baseUrl,
      apiKey: "token",
      timeoutMs: 300,
    });

    await expect(client.fetch({ provider: "scrapling", url: "https://example.com/", format: "markdown" }))
      .rejects.toThrow(/timed out/i);
  });
});
