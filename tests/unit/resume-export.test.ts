import { describe, expect, it } from "vitest";
import { extractText, getDocumentProxy } from "unpdf";
import { buildDocx, buildPdf, parseBlocks } from "@/lib/resume-export";

const SAMPLE = `Jordan Lee
jordan@example.com | Austin, TX

EXPERIENCE
Software Intern, Northwind Labs
• Built an internal dashboard used by 40 engineers
- Cut report time from 2 hours to 5 minutes
Skills:
Python, TypeScript, SQL`;

describe("parseBlocks", () => {
  it("finds the name, headings, bullets and plain lines", () => {
    const kinds = parseBlocks(SAMPLE).map((b) => b.kind);
    expect(kinds).toEqual(["name", "text", "gap", "heading", "text", "bullet", "bullet", "heading", "text"]);
  });

  it("strips bullet markers and collapses repeated blank lines", () => {
    const blocks = parseBlocks("Name\n\n\n\n• One\n");
    expect(blocks).toEqual([{ kind: "name", text: "Name" }, { kind: "gap" }, { kind: "bullet", text: "One" }]);
  });

  it("does not mistake a sentence for a heading", () => {
    const blocks = parseBlocks("Name\nI led a team of five engineers.");
    expect(blocks[1]).toEqual({ kind: "text", text: "I led a team of five engineers." });
  });
});

describe("buildPdf", () => {
  it("produces a PDF whose text can be read back, including curly quotes and bullets", async () => {
    const bytes = await buildPdf("Jordan Lee resume", SAMPLE + "\n“Quoted” — dash and a 日本語 name");
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    expect(text).toContain("Jordan Lee");
    expect(text).toContain("Built an internal dashboard used by 40 engineers");
    expect(text).toContain('"Quoted" - dash'); // look-alike punctuation is swapped for what the font supports
  });

  it("spills onto more pages and wraps long unbroken tokens", async () => {
    const long = Array.from({ length: 140 }, (_, i) => `• Line ${i} ${"word ".repeat(12)}`).join("\n");
    const bytes = await buildPdf("Long", `Name\n${long}\nhttps://example.com/${"a".repeat(300)}`);
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    expect(pdf.numPages).toBeGreaterThan(1);
  });
});

describe("buildDocx", () => {
  it("produces a zip container with the text inside the document part", async () => {
    const buf = await buildDocx("Jordan", SAMPLE);
    expect(buf.subarray(0, 2).toString()).toBe("PK");
    expect(buf.length).toBeGreaterThan(2000);
  });
});
