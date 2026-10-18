import "server-only";
import dns from "node:dns";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

/** User-facing failure. Messages are safe to show. */
export class FetchBlockedError extends Error {}

function isPublicIpv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b, c] = p;
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 169 && b === 254) return false; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
}

export function isPublicIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPublicIpv4(ip);
  if (!net.isIPv6(ip)) return false;
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return false;
  const mapped = lower.match(/^::ffff:(.+)$/);
  if (mapped) {
    const rest = mapped[1];
    if (rest.includes(".")) return isPublicIpv4(rest);
    const g = rest.split(":").map((h) => parseInt(h, 16));
    if (g.length === 2 && g.every((n) => Number.isInteger(n))) {
      return isPublicIpv4(`${g[0] >> 8}.${g[0] & 255}.${g[1] >> 8}.${g[1] & 255}`);
    }
    return false;
  }
  if (/^(fc|fd)/.test(lower)) return false; // unique local
  if (/^fe[89ab]/.test(lower)) return false; // link-local
  if (lower.startsWith("ff")) return false; // multicast
  if (lower.startsWith("64:ff9b:")) return false; // NAT64
  if (lower.startsWith("2001:db8:") || lower.startsWith("2001:0db8:")) return false;
  return true;
}

/** Validates every resolved address at connect time, which also defeats DNS rebinding. */
const agent = new Agent({
  headersTimeout: 10_000,
  bodyTimeout: 10_000,
  connect: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lookup: ((hostname: string, options: any, callback: any) => {
      dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
        if (err) return callback(err, "", 4);
        if (!addresses.length || addresses.some((a) => !isPublicIp(a.address))) {
          return callback(new Error("blocked address"), "", 4);
        }
        if (options?.all) return callback(null, addresses);
        return callback(null, addresses[0].address, addresses[0].family);
      });
    }) as never,
  },
});

export function validateUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchBlockedError("That doesn't look like a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchBlockedError("Only http and https links can be imported.");
  }
  if (url.username || url.password) throw new FetchBlockedError("Links with embedded credentials aren't supported.");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new FetchBlockedError("Links with custom ports can't be imported.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    (net.isIP(host) && !isPublicIp(host))
  ) {
    throw new FetchBlockedError("That address can't be imported.");
  }
  return url;
}

const MAX_BYTES = 1_500_000;

async function readCapped(body: { getReader(): ReadableStreamDefaultReader<Uint8Array> } | null): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break; // keep what we have; job text is almost always near the top
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

/** Fetches a public web page with SSRF protections: scheme/port allow-list, per-hop validation of
 *  redirects, connect-time IP checks, size and time limits. Returns raw HTML or text. */
export async function safeFetchText(rawUrl: string): Promise<{ body: string; finalUrl: string; contentType: string }> {
  let url = validateUrl(rawUrl);
  for (let hop = 0; hop < 4; hop++) {
    let res;
    try {
      res = await undiciFetch(url, {
        dispatcher: agent,
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
        headers: {
          "User-Agent": "CareerHubBot/1.0 (user-initiated job import)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
        },
      });
    } catch {
      throw new FetchBlockedError("We couldn't reach that page.");
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) throw new FetchBlockedError("That page redirected somewhere we couldn't follow.");
      url = validateUrl(new URL(location, url).toString());
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new FetchBlockedError(
        res.status === 401 || res.status === 403 || res.status === 429
          ? "That site blocked automated access."
          : `That page returned an error (${res.status}).`,
      );
    }
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!/text\/html|application\/xhtml|text\/plain/.test(contentType)) {
      await res.body?.cancel();
      throw new FetchBlockedError("That link isn't a web page we can read.");
    }
    return { body: await readCapped(res.body), finalUrl: url.toString(), contentType };
  }
  throw new FetchBlockedError("That link redirected too many times.");
}
