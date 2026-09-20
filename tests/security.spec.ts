import { describe, expect, it } from "vitest";
import { validateWebUrl } from "../src/security.js";

const expectBlocked = (url: string) => {
  expect(() => validateWebUrl(url)).toThrow(/not allowed/i);
};

describe("validateWebUrl", () => {
  it("accepts normal public HTTP and HTTPS URLs", () => {
    expect(validateWebUrl("https://example.com/article?q=1").href).toBe("https://example.com/article?q=1");
    expect(validateWebUrl("http://example.com/").hostname).toBe("example.com");
  });

  it.each([
    "file:///etc/passwd",
    "ftp://example.com/file",
    "gopher://example.com/",
    "data:text/plain,hello",
  ])("blocks unsafe scheme: %s", expectBlocked);

  it("blocks credentials and fragments", () => {
    expectBlocked("https://user:pass@example.com/");
    expectBlocked("https://example.com/#secret");
  });

  it.each([
    "http://localhost/",
    "http://api.localhost/",
    "http://printer.local/",
    "http://service.internal/",
    "http://router.home.arpa/",
  ])("blocks local hostname: %s", expectBlocked);

  it.each([
    "http://127.0.0.1/",
    "http://10.0.0.1/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.1.1/",
    "http://169.254.169.254/",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://224.0.0.1/",
    "http://192.0.2.1/",
    "http://[::1]/",
    "http://[fc00::1]/",
    "http://[fe80::1]/",
    "http://[2001:db8::1]/",
  ])("blocks non-public IP: %s", expectBlocked);

  it("allows only standard web ports", () => {
    expect(validateWebUrl("https://example.com:443/path").port).toBe("");
    expect(validateWebUrl("http://example.com:80/path").port).toBe("");
    expectBlocked("https://example.com:8443/path");
  });

  it("enforces domain allowlist including subdomains", () => {
    expect(validateWebUrl("https://docs.example.com/", { allowedDomains: ["example.com"] }).hostname)
      .toBe("docs.example.com");
    expect(() => validateWebUrl("https://example.net/", { allowedDomains: ["example.com"] }))
      .toThrow(/not allowed/i);
  });

  it("gives the blocklist precedence over the allowlist", () => {
    expect(() => validateWebUrl("https://private.example.com/", {
      allowedDomains: ["example.com"],
      blockedDomains: ["private.example.com"],
    })).toThrow(/not allowed/i);
  });

  it("rejects invalid domain policy entries", () => {
    expect(() => validateWebUrl("https://example.com/", { allowedDomains: ["127.0.0.1"] }))
      .toThrow(/invalid domain/i);
    expect(() => validateWebUrl("https://example.com/", { blockedDomains: ["*.example.com"] }))
      .toThrow(/invalid domain/i);
  });
});
