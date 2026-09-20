import { isIP } from "node:net";

export type DomainPolicyOptions = {
  allowedDomains?: string[];
  blockedDomains?: string[];
};

const BLOCKED_HOST_SUFFIXES = [
  "localhost",
  ".localhost",
  ".local",
  ".internal",
  ".home.arpa",
];

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [b0, b1] = parts as [number, number, number, number];

  if (b0 === 0) return true; // 0.0.0.0/8
  if (b0 === 10) return true; // 10.0.0.0/8
  if (b0 === 100 && b1 >= 64 && b1 <= 127) return true; // CGNAT 100.64.0.0/10
  if (b0 === 127) return true; // Loopback 127.0.0.0/8
  if (b0 === 169 && b1 === 254) return true; // Link-local 169.254.0.0/16
  if (b0 === 172 && b1 >= 16 && b1 <= 31) return true; // 172.16.0.0/12
  if (b0 === 192 && b1 === 168) return true; // 192.168.0.0/16
  if (b0 === 192 && b1 === 0 && parts[2] === 2) return true; // TEST-NET-1 192.0.2.0/24
  if (b0 === 198 && (b1 === 18 || b1 === 19)) return true; // 198.18.0.0/15
  if (b0 === 198 && b1 === 51 && parts[2] === 100) return true; // TEST-NET-2 198.51.100.0/24
  if (b0 === 203 && b1 === 0 && parts[2] === 113) return true; // TEST-NET-3 203.0.113.0/24
  if (b0 >= 224) return true; // Multicast & reserved 224.0.0.0/4

  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");

  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true; // Link-local fe80::/10
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true; // Unique local fc00::/7
  }
  if (normalized.startsWith("2001:db8:") || normalized === "2001:db8") {
    return true; // Documentation
  }
  if (normalized.startsWith("ff")) {
    return true; // Multicast
  }
  return false;
}

export function validateDomainPattern(domain: string, optionName = "domain"): string {
  const normalized = domain.trim().toLowerCase();
  if (
    !normalized ||
    normalized.includes("*") ||
    normalized.includes("/") ||
    normalized.includes(":") ||
    isIP(normalized) !== 0 ||
    !/^[a-z0-9.-]+$/.test(normalized) ||
    normalized.startsWith(".") ||
    normalized.endsWith(".")
  ) {
    throw new Error(`Invalid domain in ${optionName}: "${domain}"`);
  }
  return normalized;
}

function matchesDomain(hostname: string, targetDomain: string): boolean {
  return hostname === targetDomain || hostname.endsWith(`.${targetDomain}`);
}

export function validateWebUrl(input: string, policy: DomainPolicyOptions = {}): URL {
  if (typeof input !== "string" || !input.trim()) {
    throw new Error("URL is not allowed: empty input");
  }

  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new Error("URL is not allowed: malformed URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`URL is not allowed: unsupported protocol "${parsed.protocol}"`);
  }

  if (parsed.username || parsed.password) {
    throw new Error("URL is not allowed: credentials in URL are prohibited");
  }

  if (parsed.hash) {
    throw new Error("URL is not allowed: fragment is prohibited");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    throw new Error("URL is not allowed: empty hostname");
  }

  if (
    hostname === "localhost" ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(suffix))
  ) {
    throw new Error(`URL is not allowed: local or internal hostname "${hostname}"`);
  }

  const cleanHost = hostname.replace(/^\[/, "").replace(/\]$/, "");
  const ipFamily = isIP(cleanHost);
  if (ipFamily === 4) {
    if (isPrivateOrReservedIpv4(cleanHost)) {
      throw new Error(`URL is not allowed: non-public IPv4 address "${hostname}"`);
    }
  } else if (ipFamily === 6) {
    if (isPrivateOrReservedIpv6(cleanHost)) {
      throw new Error(`URL is not allowed: non-public IPv6 address "${hostname}"`);
    }
  }

  if (parsed.port) {
    const port = Number(parsed.port);
    const standard = (parsed.protocol === "http:" && port === 80) || (parsed.protocol === "https:" && port === 443);
    if (!standard) {
      throw new Error(`URL is not allowed: non-standard port "${parsed.port}"`);
    }
    parsed.port = "";
  }

  const allowedDomains = (policy.allowedDomains ?? []).map((d) => validateDomainPattern(d, "allowedDomains"));
  const blockedDomains = (policy.blockedDomains ?? []).map((d) => validateDomainPattern(d, "blockedDomains"));

  if (allowedDomains.length > 0) {
    const allowed = allowedDomains.some((domain) => matchesDomain(hostname, domain));
    if (!allowed) {
      throw new Error(`URL is not allowed: domain "${hostname}" is not in allowedDomains`);
    }
  }

  if (blockedDomains.length > 0) {
    const blocked = blockedDomains.some((domain) => matchesDomain(hostname, domain));
    if (blocked) {
      throw new Error(`URL is not allowed: domain "${hostname}" is blocked`);
    }
  }

  return parsed;
}
