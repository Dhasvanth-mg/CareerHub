import { describe, expect, it } from "vitest";
import { FetchBlockedError, isPublicIp, safeFetchText, validateUrl } from "@/lib/ai/safe-fetch";

describe("isPublicIp", () => {
  const cases: [string, boolean][] = [
    ["8.8.8.8", true],
    ["1.1.1.1", true],
    ["172.32.0.1", true],
    ["2606:4700:4700::1111", true],
    ["::ffff:8.8.8.8", true],
    ["127.0.0.1", false],
    ["10.1.2.3", false],
    ["172.16.0.1", false],
    ["172.31.255.255", false],
    ["192.168.1.1", false],
    ["169.254.169.254", false], // cloud metadata
    ["100.64.0.1", false], // carrier-grade NAT
    ["0.0.0.0", false],
    ["224.0.0.1", false],
    ["255.255.255.255", false],
    ["::1", false],
    ["::", false],
    ["fe80::1", false],
    ["fd00::1", false],
    ["fc00::1", false],
    ["ff02::1", false],
    ["::ffff:127.0.0.1", false],
    ["::ffff:7f00:1", false],
    ["64:ff9b::7f00:1", false],
    ["2001:db8::1", false],
    ["not-an-ip", false],
    ["999.1.1.1", false],
  ];
  it.each(cases)("%s -> %s", (ip, expected) => {
    expect(isPublicIp(ip)).toBe(expected);
  });
});

describe("validateUrl", () => {
  it("accepts ordinary public https and http links", () => {
    expect(validateUrl("https://example.com/jobs/1").hostname).toBe("example.com");
    expect(validateUrl("http://example.com").protocol).toBe("http:");
    expect(validateUrl("https://example.com:443/x").port).toBe("");
  });

  it.each([
    "file:///etc/passwd",
    "ftp://example.com/",
    "javascript:alert(1)",
    "data:text/html,hi",
    "gopher://example.com",
    "https://example.com:8443/",
    "http://example.com:22/",
    "http://user:pw@example.com/",
    "http://localhost/",
    "http://LOCALHOST/",
    "http://app.localhost/",
    "http://printer.local/",
    "http://db.internal/",
    "http://127.0.0.1/",
    "http://127.1/",
    "http://2130706433/", // 127.0.0.1 written as a single integer
    "http://0x7f000001/",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.1/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[fd00::1]/",
    "not a url",
    "",
  ])("rejects %s", (url) => {
    expect(() => validateUrl(url)).toThrow(FetchBlockedError);
  });
});

describe("safeFetchText", () => {
  it("refuses hostile targets before making any request", async () => {
    for (const url of ["http://127.0.0.1/", "http://169.254.169.254/", "file:///etc/passwd", "http://[::1]:80/"]) {
      await expect(safeFetchText(url)).rejects.toBeInstanceOf(FetchBlockedError);
    }
  });
});
