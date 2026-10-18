import { describe, expect, it } from "vitest";
import { ORPHAN_MIN_AGE_MS, pickOrphans, type StoredFile } from "@/lib/storage-sweep";

const now = Date.parse("2026-10-18T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();
const file = (name: string, age: number | null): StoredFile => ({ path: `u1/${name}`, size: 100, createdAt: age === null ? null : ago(age) });

describe("pickOrphans", () => {
  it("returns only old files that no saved version references", () => {
    const files = [file("saved.pdf", 5 * 86_400_000), file("abandoned.pdf", 3 * 86_400_000), file("fresh.pdf", 60_000)];
    const orphans = pickOrphans(files, new Set(["u1/saved.pdf"]), now);
    expect(orphans.map((f) => f.path)).toEqual(["u1/abandoned.pdf"]);
  });

  it("leaves a file alone when its age is unknown or just under the threshold", () => {
    const files = [file("nodate.pdf", null), file("almost.pdf", ORPHAN_MIN_AGE_MS - 1000), file("just.pdf", ORPHAN_MIN_AGE_MS)];
    expect(pickOrphans(files, new Set(), now).map((f) => f.path)).toEqual(["u1/just.pdf"]);
  });

  it("never returns a referenced file, however old", () => {
    expect(pickOrphans([file("a.pdf", 400 * 86_400_000)], new Set(["u1/a.pdf"]), now)).toEqual([]);
  });
});

import { createHash } from "node:crypto";
import { hashShareToken, newShareToken } from "@/lib/share";

describe("share tokens", () => {
  it("hashes exactly as the database does (sha256 of the UTF-8 text, hex)", () => {
    expect(hashShareToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hashShareToken("x")).toBe(createHash("sha256").update("x").digest("hex"));
  });

  it("makes long, unique, URL-safe secrets", () => {
    const a = newShareToken();
    const b = newShareToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
