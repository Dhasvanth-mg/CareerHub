import { describe, expect, it } from "vitest";
import { UID_DOMAIN, buildIcs, escapeText, foldLine, parseIcs, unescapeText, zonedToUtc } from "@/lib/ics";

const wrap = (...events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Test//EN", ...events, "END:VCALENDAR"].join("\r\n");
const vevent = (...lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");

describe("ICS writing", () => {
  it("escapes text the way RFC 5545 requires", () => {
    expect(escapeText("a, b; c\\d\nnext")).toBe("a\\, b\\; c\\\\d\\nnext");
    expect(unescapeText(escapeText("a, b; c\\d\nnext"))).toBe("a, b; c\\d\nnext");
  });

  it("folds long lines at 75 octets without splitting characters", () => {
    const line = "SUMMARY:" + "é".repeat(100);
    const folded = foldLine(line);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("writes timed and all-day events with CRLF endings", () => {
    const ics = buildIcs(
      [
        { uid: `interview-1@${UID_DOMAIN}`, title: "Technical: Acme", start: "2026-11-03T15:00:00.000Z", end: "2026-11-03T16:00:00.000Z", location: "Zoom" },
        { uid: `deadline-2@${UID_DOMAIN}`, title: "Acme deadline", start: "2026-11-30", allDay: true },
      ],
      new Date("2026-10-18T12:00:00Z"),
    );
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261103T150000Z");
    expect(ics).toContain("DTEND:20261103T160000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261130");
    expect(ics).toContain("DTEND;VALUE=DATE:20261201");
    expect(ics).toContain("DTSTAMP:20261018T120000Z");
    expect(ics.match(/\r?\n/g)?.every((n) => n === "\r\n")).toBe(true);
  });

  it("cannot be broken by control characters or newlines in titles", () => {
    const ics = buildIcs([{ uid: "x@y", title: "Hi\r\nEND:VCALENDAR\r\nBEGIN:VEVENT", start: "2026-11-03T15:00:00Z" }]);
    // The injected text stays inside the escaped SUMMARY line; no extra structural lines appear.
    const lines = ics.split("\r\n");
    expect(lines.filter((l) => l === "END:VCALENDAR")).toHaveLength(1);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
  });

  it("round-trips through the parser", () => {
    const events = [
      { uid: `a@${UID_DOMAIN}`, title: "Call, with; Sam", start: "2026-11-03T15:00:00.000Z", end: "2026-11-03T15:30:00.000Z", description: "Line 1\nLine 2", location: "Room 4" },
    ];
    const parsed = parseIcs(buildIcs(events)).events;
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ title: "Call, with; Sam", start: events[0].start, end: events[0].end, description: "Line 1\nLine 2", location: "Room 4", own: true });
  });
});

describe("ICS reading", () => {
  it("rejects non-calendar text", () => {
    expect(parseIcs("hello").warnings[0]).toMatch(/doesn't look like a calendar/);
  });

  it("reads UTC, zoned, floating and all-day times", () => {
    const text = wrap(
      vevent("UID:1", "SUMMARY:Utc", "DTSTART:20261103T150000Z"),
      vevent("UID:2", "SUMMARY:Zoned", "DTSTART;TZID=America/New_York:20261103T100000"),
      vevent("UID:3", "SUMMARY:Floating", "DTSTART:20261103T100000"),
      vevent("UID:4", "SUMMARY:All day", "DTSTART;VALUE=DATE:20261105"),
    );
    const byTitle = Object.fromEntries(parseIcs(text, "America/Chicago").events.map((e) => [e.title, e]));
    expect(byTitle.Utc.start).toBe("2026-11-03T15:00:00.000Z");
    expect(byTitle.Zoned.start).toBe("2026-11-03T15:00:00.000Z"); // EST in November is UTC-5
    expect(byTitle.Floating.start).toBe("2026-11-03T16:00:00.000Z"); // CST is UTC-6
    expect(byTitle["All day"]).toMatchObject({ allDay: true, start: "2026-11-05T12:00:00.000Z", end: null });
  });

  it("handles daylight saving correctly", () => {
    // 2026-07-01 10:00 in New York is EDT (UTC-4).
    expect(new Date(zonedToUtc(2026, 7, 1, 10, 0, 0, "America/New_York")).toISOString()).toBe("2026-07-01T14:00:00.000Z");
    // 2026-12-01 10:00 is EST (UTC-5).
    expect(new Date(zonedToUtc(2026, 12, 1, 10, 0, 0, "America/New_York")).toISOString()).toBe("2026-12-01T15:00:00.000Z");
    // Half-hour zone.
    expect(new Date(zonedToUtc(2026, 7, 1, 10, 0, 0, "Asia/Kolkata")).toISOString()).toBe("2026-07-01T04:30:00.000Z");
  });

  it("understands Outlook's Windows zone names and flags unknown zones", () => {
    const text = wrap(
      vevent("UID:1", "SUMMARY:Win", "DTSTART;TZID=Eastern Standard Time:20261103T100000"),
      vevent("UID:2", "SUMMARY:Unknown", "DTSTART;TZID=Mars/Olympus:20261103T100000"),
    );
    const { events } = parseIcs(text);
    expect(events.find((e) => e.title === "Win")).toMatchObject({ start: "2026-11-03T15:00:00.000Z", zoneAssumed: false });
    expect(events.find((e) => e.title === "Unknown")).toMatchObject({ start: "2026-11-03T10:00:00.000Z", zoneAssumed: true });
  });

  it("unfolds long lines and unescapes text", () => {
    const text = wrap(vevent("UID:1", "SUMMARY:Long titl", " e here\\, really", "DTSTART:20261103T150000Z", "DESCRIPTION:a\\nb"));
    const [e] = parseIcs(text).events;
    expect(e.title).toBe("Long title here, really");
    expect(e.description).toBe("a\nb");
  });

  it("computes the end from DURATION and ignores an end before the start", () => {
    const text = wrap(
      vevent("UID:1", "SUMMARY:A", "DTSTART:20261103T150000Z", "DURATION:PT1H30M"),
      vevent("UID:2", "SUMMARY:B", "DTSTART:20261103T150000Z", "DTEND:20261103T140000Z"),
    );
    const { events } = parseIcs(text);
    expect(events.find((e) => e.title === "A")?.end).toBe("2026-11-03T16:30:00.000Z");
    expect(events.find((e) => e.title === "B")?.end).toBeNull();
  });

  it("flags repeating and cancelled events and ignores alarms", () => {
    const text = wrap(
      vevent("UID:1", "SUMMARY:Weekly", "DTSTART:20261103T150000Z", "RRULE:FREQ=WEEKLY", "BEGIN:VALARM", "TRIGGER:-PT15M", "DESCRIPTION:ring", "END:VALARM"),
      vevent("UID:2", "SUMMARY:Gone", "DTSTART:20261104T150000Z", "STATUS:CANCELLED"),
    );
    const { events } = parseIcs(text);
    const weekly = events.find((e) => e.title === "Weekly");
    expect(weekly).toMatchObject({ recurring: true, description: null });
    expect(events.find((e) => e.title === "Gone")?.cancelled).toBe(true);
  });

  it("keeps edited occurrences of a repeating event distinct", () => {
    const text = wrap(
      vevent("UID:abc", "SUMMARY:Standup", "DTSTART:20261103T150000Z", "RRULE:FREQ=DAILY"),
      vevent("UID:abc", "SUMMARY:Standup moved", "DTSTART:20261105T160000Z", "RECURRENCE-ID:20261105T150000Z"),
    );
    const uids = parseIcs(text).events.map((e) => e.uid);
    expect(new Set(uids).size).toBe(2);
  });

  it("skips events it cannot date and says so", () => {
    const text = wrap(vevent("UID:1", "SUMMARY:Bad", "DTSTART:garbage"), vevent("UID:2", "SUMMARY:Good", "DTSTART:20261103T150000Z"));
    const result = parseIcs(text);
    expect(result.events).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/1 event was skipped/);
  });

  it("falls back to a generated id and a placeholder title", () => {
    const [e] = parseIcs(wrap(vevent("DTSTART:20261103T150000Z"))).events;
    expect(e.title).toBe("(No title)");
    expect(e.uid.length).toBeGreaterThan(0);
  });

  it("recognises its own export so it is not imported twice", () => {
    const [e] = parseIcs(wrap(vevent(`UID:task-9@${UID_DOMAIN}`, "SUMMARY:x", "DTSTART:20261103T150000Z"))).events;
    expect(e.own).toBe(true);
  });

  it("caps the number of events and the file size", () => {
    const many = wrap(...Array.from({ length: 600 }, (_, i) => vevent(`UID:${i}`, "SUMMARY:x", "DTSTART:20261103T150000Z")));
    const r = parseIcs(many);
    expect(r.events).toHaveLength(500);
    expect(r.warnings.join(" ")).toMatch(/first 500/);
    expect(parseIcs("BEGIN:VCALENDAR" + "x".repeat(2_100_000)).warnings[0]).toMatch(/too large/);
  });

  it("does not treat colons inside quoted parameters as the value separator", () => {
    const [e] = parseIcs(wrap(vevent("UID:1", 'SUMMARY;LANGUAGE="en:US":Hello', "DTSTART:20261103T150000Z"))).events;
    expect(e.title).toBe("Hello");
  });
});
