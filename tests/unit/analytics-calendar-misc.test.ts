import { describe, expect, it } from "vitest";
import { computeAnalytics } from "@/lib/analytics";
import { overlappingRounds, parseMonth, shiftMonth } from "@/lib/calendar";
import { csvCell, toCsv } from "@/lib/csv";
import { daysUntil, deadlineLabel } from "@/lib/domain";
import { htmlToText, extractJobPostingJsonLd, pageToText } from "@/lib/ai/html-text";
import { looksLikePdf, looksLikeText, readabilityScore, safeFileName } from "@/lib/documents";
import { safeNext } from "@/lib/safe-redirect";
import { firstError, moneyInput, optDate, optText } from "@/lib/forms";
import { z } from "zod";

const t = (d: string) => `2026-10-${d}T12:00:00Z`;
const app = (id: string, stage: string, extra: Record<string, unknown> = {}) => ({
  id,
  stage,
  created_at: t("01"),
  applied_on: null,
  source: null,
  submitted_resume_version_id: null,
  ...extra,
});
const ev = (application_id: string, from_value: string | null, to_value: string, day: string) => ({
  application_id,
  type: "stage_changed",
  from_value,
  to_value,
  created_at: t(day),
});

describe("analytics", () => {
  const apps = [
    app("a", "interview", { source: "LinkedIn", submitted_resume_version_id: "r1" }),
    app("b", "applied", { source: "LinkedIn", submitted_resume_version_id: "r1" }),
    app("c", "rejected", { source: "Referral" }),
    app("d", "rejected"), // closed with no history: unknown, never assumed
    app("e", "saved"),
    app("f", "offer", { source: "Referral", submitted_resume_version_id: "r2" }),
    app("g", "withdrawn", { source: "Career fair" }),
  ];
  const events = [
    ev("a", "preparing", "applied", "02"),
    ev("a", "applied", "interview", "09"),
    ev("b", "preparing", "applied", "05"),
    ev("c", "preparing", "applied", "03"),
    ev("c", "applied", "rejected", "06"),
    ev("f", "preparing", "applied", "02"),
    ev("f", "applied", "offer", "12"),
    ev("g", "saved", "preparing", "02"),
    ev("g", "preparing", "withdrawn", "04"),
  ];
  const r = computeAnalytics(apps, events);

  it("keeps unknown outcomes out of the funnel instead of guessing", () => {
    expect(r.unknownHistory).toBe(1);
    expect(r.total).toBe(7);
  });
  it("counts a stage as reached even when intermediate stages were skipped", () => {
    const by = Object.fromEntries(r.funnel.map((s) => [s.stage, s.count]));
    expect(by.assessment).toBe(2); // a (interview) and f (offer, skipped assessment)
    expect(by.applied).toBe(4);
    expect(by.offer).toBe(1);
  });
  it("computes response rate, waiting and median wait from recorded history", () => {
    expect(r.applied).toBe(4);
    expect(r.responded).toBe(3);
    expect(r.waiting).toBe(1);
    expect(r.responseRate).toBe(75);
    expect(r.medianDaysToResponse).toBe(7); // a = 7, c = 3, f = 10
  });
  it("groups by source and resume among applied applications only", () => {
    expect(r.bySource).toEqual([
      { label: "LinkedIn", applied: 2, interviews: 1 },
      { label: "Referral", applied: 2, interviews: 1 },
    ]);
    expect(r.byResume).toEqual([
      { id: "r1", applied: 2, interviews: 1 },
      { id: "r2", applied: 1, interviews: 1 },
    ]);
  });
  it("handles an empty account without dividing by zero", () => {
    const empty = computeAnalytics([], []);
    expect(empty.responseRate).toBeNull();
    expect(empty.medianDaysToResponse).toBeNull();
    expect(empty.funnel.every((s) => s.count === 0)).toBe(true);
  });
});

describe("calendar helpers", () => {
  const round = (id: string, at: string | null, mins: number | null = 60, status = "scheduled") => ({
    id,
    status,
    scheduled_at: at,
    duration_minutes: mins,
  });
  it("flags overlapping interviews and nothing else", () => {
    const set = overlappingRounds([
      round("a", "2026-10-18T14:00:00Z", 60),
      round("b", "2026-10-18T14:30:00Z", 45),
      round("c", "2026-10-18T15:00:00Z", 30), // starts exactly when a ends, and after b starts: overlaps b
      round("d", "2026-10-19T09:00:00Z"),
    ]);
    expect([...set].sort()).toEqual(["a", "b", "c"]);
    expect(set.has("d")).toBe(false);
  });
  it("ignores cancelled and untimed rounds, and treats back-to-back as fine", () => {
    expect(overlappingRounds([round("a", "2026-10-18T14:00:00Z"), round("b", "2026-10-18T14:30:00Z", 60, "cancelled")]).size).toBe(0);
    expect(overlappingRounds([round("a", "2026-10-18T14:00:00Z", 60), round("b", "2026-10-18T15:00:00Z", 60)]).size).toBe(0);
    expect(overlappingRounds([round("a", null), round("b", null)]).size).toBe(0);
  });
  it("parses and shifts months across year boundaries", () => {
    const now = new Date("2026-10-17T12:00:00Z");
    expect(parseMonth("2026-12", now)).toEqual({ year: 2026, month: 11 });
    expect(parseMonth("garbage", now)).toEqual({ year: 2026, month: 9 });
    expect(parseMonth("2026-13", now)).toEqual({ year: 2026, month: 9 });
    expect(shiftMonth(2026, 11, 1)).toBe("2027-01");
    expect(shiftMonth(2026, 0, -1)).toBe("2025-12");
  });
});

describe("deadline helpers", () => {
  const now = new Date("2026-10-17T20:00:00Z");
  it("counts whole days from today's UTC date", () => {
    expect(daysUntil("2026-10-17", now)).toBe(0);
    expect(daysUntil("2026-10-19", now)).toBe(2);
    expect(daysUntil("2026-10-15", now)).toBe(-2);
  });
  it("labels overdue, soon and normal", () => {
    // deadlineLabel uses the real clock; build dates relative to it
    const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    expect(deadlineLabel(day(-3)).tone).toBe("overdue");
    expect(deadlineLabel(day(0)).tone).toBe("soon");
    expect(deadlineLabel(day(30)).tone).toBe("normal");
  });
});

describe("CSV export safety", () => {
  it("neutralises spreadsheet formula injection", () => {
    for (const evil of ["=HYPERLINK(\"http://evil\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd"]) {
      expect(csvCell(evil).replace(/^"/, "").startsWith("'")).toBe(true);
    }
  });
  it("quotes commas, quotes and newlines, and leaves plain text alone", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
  });
  it("builds rows with a header and CRLF endings", () => {
    expect(toCsv([{ a: 1, b: "x,y" }], ["a", "b"])).toBe('a,b\r\n1,"x,y"\r\n');
  });
});

describe("safeNext (open-redirect guard)", () => {
  it("allows same-site paths only", () => {
    expect(safeNext("/applications/1")).toBe("/applications/1");
    for (const bad of ["//evil.example", "https://evil.example", "/\\evil.example", "javascript:alert(1)", "", undefined, null, 42]) {
      expect(safeNext(bad as never)).toBe("/dashboard");
    }
    expect(safeNext("//evil", "/home")).toBe("/home");
  });
});

describe("html text extraction", () => {
  it("strips scripts, styles and tags, and decodes entities", () => {
    const text = htmlToText("<style>x{}</style><script>alert(1)</script><h1>Intern &amp; Co-op</h1><p>Use C&#43;&#43;</p><ul><li>Git</li></ul>");
    expect(text).toContain("Intern & Co-op");
    expect(text).toContain("C++");
    expect(text).toContain("- Git");
    expect(text).not.toMatch(/alert|x\{\}|<h1>/);
  });
  it("prefers a schema.org JobPosting block when the page has one", () => {
    const ld = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Embedded Intern",
      hiringOrganization: { name: "Acme" },
      description: "<p>Write <b>firmware</b>.</p>",
    });
    const html = `<html><script type="application/ld+json">${ld}</script><body>Visible text</body></html>`;
    expect(extractJobPostingJsonLd(html)).toMatch(/Title: Embedded Intern[\s\S]*Company: Acme[\s\S]*Write firmware/);
    expect(pageToText(html)).toContain("Visible text");
  });
  it("survives malformed JSON-LD", () => {
    expect(extractJobPostingJsonLd('<script type="application/ld+json">{not json</script>')).toBe("");
  });
});

describe("document helpers", () => {
  it("recognises real PDFs and rejects imposters", () => {
    expect(looksLikePdf(new TextEncoder().encode("%PDF-1.7 ..."))).toBe(true);
    expect(looksLikePdf(new TextEncoder().encode("MZ executable"))).toBe(false);
    expect(looksLikePdf(new Uint8Array([]))).toBe(false);
  });
  it("rejects binary data posing as text", () => {
    expect(looksLikeText(new TextEncoder().encode("hello world"))).toBe(true);
    expect(looksLikeText(new Uint8Array([104, 105, 0, 1, 2]))).toBe(false);
  });
  it("scores readability from the extracted text", () => {
    const good = "Experienced engineer with strong skills. ".repeat(40);
    expect(readabilityScore(good, "ok", 1)).toBeGreaterThanOrEqual(85);
    expect(readabilityScore("", "empty", 1)).toBe(0);
    expect(readabilityScore("\u0001\u0002�".repeat(200), "ok", 1)).toBeLessThan(60);
  });
  it("makes file names safe", () => {
    expect(safeFileName("../../etc/pass wd?.pdf")).not.toMatch(/[\\/?]/);
    expect(safeFileName("")).toBe("document");
    expect(safeFileName("a".repeat(500)).length).toBeLessThanOrEqual(120);
  });
});

describe("form helpers", () => {
  it("turns empty optional text and dates into null and validates date shape", () => {
    expect(z.object({ x: optText(10) }).parse({ x: "  " }).x).toBeNull();
    expect(z.object({ d: optDate }).parse({ d: "" }).d).toBeNull();
    expect(z.object({ d: optDate }).parse({ d: "2026-10-17" }).d).toBe("2026-10-17");
    expect(z.object({ d: optDate }).safeParse({ d: "tomorrow" }).success).toBe(false);
    expect(z.object({ x: optText(3) }).safeParse({ x: "toolong" }).success).toBe(false);
  });
  it("words the first validation error for people", () => {
    const res = z.object({ company_name: z.string().min(1, "Company is required.") }).safeParse({ company_name: "" });
    expect(res.success).toBe(false);
    if (!res.success) expect(firstError(res.error)).toBe("company name: Company is required.");
  });
});

describe("moneyInput", () => {
  const parse = (v: string) => z.object({ m: moneyInput("pay") }).safeParse({ m: v });
  it("accepts the ways people actually write money", () => {
    for (const [input, want] of [["70000", 70000], ["70,000", 70000], ["$70 000", 70000], ["£70_000.50", 70000.5], ["", null]] as const) {
      const r = parse(input);
      expect(r.success && r.data.m).toBe(want);
    }
  });
  it("explains itself instead of showing a parser error", () => {
    const r = parse("a lot");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("Enter the pay as a number, like 60000.");
      expect(r.error.issues[0].message).not.toMatch(/NaN|Invalid input/);
    }
  });
  it("rejects negative and absurd amounts", () => {
    expect(parse("-5").success).toBe(false);
    expect(parse("99999999999").success).toBe(false);
  });
});
