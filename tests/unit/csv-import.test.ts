import { describe, expect, it } from "vitest";
import { TEMPLATE_CSV, guessMapping, normalizeStage, parseCsv, parseLooseDate, prepareRow, normalizePriority, normalizeWorkMode, cleanUrl } from "@/lib/csv-import";

describe("parseCsv", () => {
  it("handles quotes, embedded commas, newlines and doubled quotes", () => {
    const rows = parseCsv('a,b,c\r\n1,"x, y","line1\nline2"\r\n"say ""hi""",,3\r\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "x, y", "line1\nline2"],
      ['say "hi"', "", "3"],
    ]);
  });

  it("detects semicolon and tab delimiters and strips a byte-order mark", () => {
    expect(parseCsv("﻿a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("drops blank lines and handles a missing final newline", () => {
    expect(parseCsv("a,b\n\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("reads the template it ships", () => {
    const rows = parseCsv(TEMPLATE_CSV);
    expect(rows[0]).toHaveLength(12);
    expect(rows[1][4]).toBe("Austin, TX");
  });
});

describe("guessMapping", () => {
  it("matches common header names and uses each column once", () => {
    const m = guessMapping(["Company Name", "Position", "Status", "Date Applied", "Due Date", "URL", "Comments"]);
    expect(m).toMatchObject({ company_name: 0, title: 1, stage: 2, applied_on: 3, deadline: 4, posting_url: 5, notes: 6 });
  });

  it("prefers the exact column when two could match", () => {
    const m = guessMapping(["Date", "Date applied", "Company", "Role"]);
    expect(m.applied_on).toBe(1); // "date applied" is exact; the bare "Date" column is not stolen for it
  });
});

describe("normalizeStage", () => {
  it.each([
    ["Applied", "applied"],
    ["Interviewing", "interview"],
    ["Phone screen", "interview"],
    ["OA", "assessment"],
    ["Wishlist", "saved"],
    ["Offer received", "offer"],
    ["Rejected", "rejected"],
    ["Withdrew", "withdrawn"],
    ["Hired", "accepted"],
    ["Ghosted", "applied"], // an unknown outcome is never counted as a rejection
  ])("%s -> %s", (input, expected) => {
    expect(normalizeStage(input)).toEqual({ stage: expected, recognised: true });
  });

  it("falls back to saved and says it did not recognise the value", () => {
    expect(normalizeStage("banana")).toEqual({ stage: "saved", recognised: false });
    expect(normalizeStage("")).toEqual({ stage: "saved", recognised: true });
  });
});

describe("parseLooseDate", () => {
  it("reads ISO, month-first and day-first slash dates", () => {
    expect(parseLooseDate("2026-10-05")).toBe("2026-10-05");
    expect(parseLooseDate("10/5/2026", "month-first")).toBe("2026-10-05");
    expect(parseLooseDate("10/5/2026", "day-first")).toBe("2026-05-10");
    expect(parseLooseDate("5.10.26", "day-first")).toBe("2026-10-05");
  });

  it("reads month names", () => {
    expect(parseLooseDate("Oct 5, 2026")).toBe("2026-10-05");
    expect(parseLooseDate("October 5th, 2026")).toBe("2026-10-05");
    expect(parseLooseDate("5 Oct 2026")).toBe("2026-10-05");
  });

  it("rejects impossible and unreadable dates", () => {
    expect(parseLooseDate("2026-02-30")).toBeNull();
    expect(parseLooseDate("13/13/2026")).toBeNull();
    expect(parseLooseDate("soon")).toBeNull();
    expect(parseLooseDate("")).toBeNull();
  });
});

describe("small normalizers", () => {
  it("maps priority, work mode and links", () => {
    expect(normalizePriority("High")).toBe("high");
    expect(normalizePriority("3")).toBe("low");
    expect(normalizePriority("whatever")).toBe("medium");
    expect(normalizeWorkMode("Hybrid (3 days)")).toBe("hybrid");
    expect(normalizeWorkMode("On-site")).toBe("on_site");
    expect(normalizeWorkMode("")).toBeNull();
    expect(cleanUrl("example.com/jobs/1")).toBe("https://example.com/jobs/1");
    expect(cleanUrl("javascript:alert(1)")).toBeNull();
    expect(cleanUrl("not a link")).toBeNull();
  });
});

describe("prepareRow", () => {
  const mapping = guessMapping(["Company", "Role", "Stage", "Applied", "Deadline", "Link"]);

  it("builds an application and notes what it had to adjust", () => {
    const { row, notes } = prepareRow(["Acme", "Intern", "Interviewing", "10/5/2026", "later", "acme.com/j"], mapping);
    expect(row).toMatchObject({ company_name: "Acme", title: "Intern", stage: "interview", applied_on: "2026-10-05", deadline: null, posting_url: "https://acme.com/j" });
    expect(notes.join(" ")).toMatch(/Deadline date "later" not understood/);
  });

  it("refuses rows without a company or a title", () => {
    expect(prepareRow(["", "Intern", "", "", "", ""], mapping).problems).toEqual(["Missing company"]);
    expect(prepareRow(["Acme", " ", "", "", "", ""], mapping).row).toBeNull();
  });

  it("never lets a cell grow past the database limits", () => {
    const { row } = prepareRow(["x".repeat(500), "y".repeat(500), "", "", "", ""], mapping);
    expect(row?.company_name.length).toBe(200);
    expect(row?.title.length).toBe(200);
  });

  it("does not turn spreadsheet formulas into anything special (stored as plain text)", () => {
    const { row } = prepareRow(["=HYPERLINK(\"x\")", "Intern", "", "", "", ""], mapping);
    expect(row?.company_name).toBe('=HYPERLINK("x")');
  });
});
