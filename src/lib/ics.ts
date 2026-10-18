/**
 * Minimal iCalendar (RFC 5545) reading and writing for calendar export and import.
 * Pure functions: no I/O, so they run in the browser (import preview) and on the server (export).
 */

/** UIDs we write all end with this, so re-importing our own export can be recognised and skipped. */
export const UID_DOMAIN = "careerhub-woad.vercel.app";

export const MAX_ICS_CHARS = 2_000_000;
export const MAX_IMPORT_EVENTS = 500;

export type ExportEvent = {
  uid: string;
  title: string;
  /** Instant (ISO-8601) for timed events, or "YYYY-MM-DD" when `allDay`. */
  start: string;
  allDay?: boolean;
  /** Instant (ISO-8601). Ignored for all-day events. */
  end?: string | null;
  description?: string | null;
  location?: string | null;
  url?: string | null;
};

// ---------------------------------------------------------------- writing

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

function utcStamp(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

export function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

/** Folds a content line to 75 octets per RFC 5545, never splitting a character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
      limit = 74; // continuation lines start with a space
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** Strips control characters that would corrupt a content line. */
const clean = (v: string) => v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");

export function buildIcs(events: ExportEvent[], now = new Date()): string {
  const stamp = utcStamp(now.getTime());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CareerHub AI//Calendar export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:CareerHub AI",
  ];

  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${clean(e.uid)}`, `DTSTAMP:${stamp}`);
    if (e.allDay) {
      const d = e.start.slice(0, 10).replace(/-/g, "");
      const next = new Date(Date.parse(`${e.start.slice(0, 10)}T00:00:00Z`) + 86_400_000);
      lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${utcStamp(next.getTime()).slice(0, 8)}`);
    } else {
      const start = Date.parse(e.start);
      lines.push(`DTSTART:${utcStamp(start)}`);
      const end = e.end ? Date.parse(e.end) : NaN;
      if (Number.isFinite(end) && end > start) lines.push(`DTEND:${utcStamp(end)}`);
    }
    lines.push(`SUMMARY:${escapeText(clean(e.title))}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(clean(e.description))}`);
    if (e.location) lines.push(`LOCATION:${escapeText(clean(e.location))}`);
    if (e.url) lines.push(`URL:${clean(e.url)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------- reading

export type ParsedEvent = {
  /** Stable id for de-duplication: the file's UID, plus the recurrence id for edited occurrences. */
  uid: string;
  title: string;
  /** Instant (ISO-8601) for timed events; for all-day events the UTC noon of that date. */
  start: string;
  allDay: boolean;
  end: string | null;
  description: string | null;
  location: string | null;
  /** The event repeats; only the first occurrence is read. */
  recurring: boolean;
  /** The event's time zone was not recognised, so UTC was assumed. */
  zoneAssumed: boolean;
  /** Written by CareerHub itself. */
  own: boolean;
  cancelled: boolean;
};

export type ParseResult = { events: ParsedEvent[]; warnings: string[] };

/** Windows time zone names (used by Outlook) mapped to IANA names. Not exhaustive. */
const WINDOWS_ZONES: Record<string, string> = {
  "UTC": "UTC",
  "Greenwich Standard Time": "Atlantic/Reykjavik",
  "GMT Standard Time": "Europe/London",
  "W. Europe Standard Time": "Europe/Berlin",
  "Central Europe Standard Time": "Europe/Budapest",
  "Romance Standard Time": "Europe/Paris",
  "Central European Standard Time": "Europe/Warsaw",
  "E. Europe Standard Time": "Europe/Chisinau",
  "GTB Standard Time": "Europe/Bucharest",
  "FLE Standard Time": "Europe/Kiev",
  "Russian Standard Time": "Europe/Moscow",
  "Turkey Standard Time": "Europe/Istanbul",
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "US Mountain Standard Time": "America/Phoenix",
  "Pacific Standard Time": "America/Los_Angeles",
  "Alaskan Standard Time": "America/Anchorage",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "Atlantic Standard Time": "America/Halifax",
  "Canada Central Standard Time": "America/Regina",
  "Mexico Standard Time": "America/Mexico_City",
  "SA Pacific Standard Time": "America/Bogota",
  "E. South America Standard Time": "America/Sao_Paulo",
  "Argentina Standard Time": "America/Argentina/Buenos_Aires",
  "India Standard Time": "Asia/Kolkata",
  "Pakistan Standard Time": "Asia/Karachi",
  "Bangladesh Standard Time": "Asia/Dhaka",
  "China Standard Time": "Asia/Shanghai",
  "Singapore Standard Time": "Asia/Singapore",
  "Tokyo Standard Time": "Asia/Tokyo",
  "Korea Standard Time": "Asia/Seoul",
  "AUS Eastern Standard Time": "Australia/Sydney",
  "E. Australia Standard Time": "Australia/Brisbane",
  "New Zealand Standard Time": "Pacific/Auckland",
  "South Africa Standard Time": "Africa/Johannesburg",
  "Egypt Standard Time": "Africa/Cairo",
  "Arab Standard Time": "Asia/Riyadh",
  "Arabian Standard Time": "Asia/Dubai",
};

function resolveZone(tzid: string): string | null {
  const name = tzid.replace(/^\/[^/]*\//, "").trim(); // some writers prefix "/softwarestudio.org/Olson_20011030_5/"
  const candidate = WINDOWS_ZONES[name] ?? name;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return null;
  }
}

/** Offset of `zone` from UTC in milliseconds at the instant `ms`. */
function zoneOffset(ms: number, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Wall-clock time in `zone` to a UTC instant (milliseconds). Handles daylight-saving boundaries. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, zone: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const first = guess - zoneOffset(guess, zone);
  const second = guess - zoneOffset(first, zone);
  return second;
}

type Prop = { name: string; params: Record<string, string>; value: string };

function unfold(text: string): string[] {
  return text.replace(/\r\n|\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function parseLine(line: string): Prop | null {
  // Find the first colon that is not inside a quoted parameter value.
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuote = !inQuote;
    else if (c === ":" && !inQuote) {
      colon = i;
      break;
    }
  }
  if (colon < 1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments: string[] = [];
  let cur = "";
  inQuote = false;
  for (const c of head) {
    if (c === '"') inQuote = !inQuote;
    if (c === ";" && !inQuote) {
      segments.push(cur);
      cur = "";
    } else cur += c;
  }
  segments.push(cur);
  const [name, ...rest] = segments;
  const params: Record<string, string> = {};
  for (const p of rest) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value };
}

export function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_m, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

type When = { ms: number; allDay: boolean; zoneAssumed: boolean };

function parseWhen(prop: Prop, defaultZone: string): When | null {
  const m = prop.value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  if (m[4] === undefined) {
    // A date with no time: an all-day event. Noon UTC keeps it on the same calendar date in nearly every zone.
    return { ms: Date.UTC(y, mo - 1, d, 12), allDay: true, zoneAssumed: false };
  }
  const [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  if (h > 24 || mi > 59 || s > 60) return null;
  if (m[7]) return { ms: Date.UTC(y, mo - 1, d, h, mi, s), allDay: false, zoneAssumed: false };
  const tzid = prop.params.TZID;
  if (tzid) {
    const zone = resolveZone(tzid);
    if (zone) return { ms: zonedToUtc(y, mo, d, h, mi, s, zone), allDay: false, zoneAssumed: false };
    return { ms: Date.UTC(y, mo - 1, d, h, mi, s), allDay: false, zoneAssumed: true };
  }
  // Floating time: it means "this wall-clock time wherever you are", so use the importer's zone.
  return { ms: zonedToUtc(y, mo, d, h, mi, s, defaultZone), allDay: false, zoneAssumed: false };
}

function parseDuration(value: string): number | null {
  const m = value.trim().match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const n = (v: string | undefined) => Number(v ?? 0);
  const ms = (((n(m[2]) * 7 + n(m[3])) * 24 + n(m[4])) * 60 + n(m[5])) * 60_000 + n(m[6]) * 1000;
  return m[1] === "-" ? -ms : ms;
}

export function parseIcs(text: string, defaultZone = "UTC"): ParseResult {
  const warnings: string[] = [];
  if (text.length > MAX_ICS_CHARS) return { events: [], warnings: ["That file is too large to import (limit about 2 MB)."] };
  if (!/BEGIN:VCALENDAR/i.test(text)) return { events: [], warnings: ["That doesn't look like a calendar (.ics) file."] };

  const zone = resolveZone(defaultZone) ?? "UTC";
  const events: ParsedEvent[] = [];
  let current: Prop[] | null = null;
  let depth = 0; // nested components such as VALARM inside a VEVENT
  let unreadable = 0;
  let overLimit = false;

  for (const raw of unfold(text)) {
    const line = raw.trimEnd();
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      current = [];
      depth = 0;
      continue;
    }
    if (!current) continue;
    if (upper === "END:VEVENT") {
      const done = current;
      current = null;
      if (events.length >= MAX_IMPORT_EVENTS) {
        overLimit = true;
        continue;
      }
      const ev = buildEvent(done, zone);
      if (ev) events.push(ev);
      else unreadable++;
      continue;
    }
    if (upper.startsWith("BEGIN:")) {
      depth++;
      continue;
    }
    if (upper.startsWith("END:")) {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0) continue;
    const prop = parseLine(line);
    if (prop) current.push(prop);
  }

  if (unreadable) warnings.push(`${unreadable} event${unreadable === 1 ? " was" : "s were"} skipped because the date could not be read.`);
  if (overLimit) warnings.push(`Only the first ${MAX_IMPORT_EVENTS} events are shown. Split the file to import the rest.`);
  if (events.length === 0 && warnings.length === 0) warnings.push("No events were found in that file.");

  events.sort((a, b) => a.start.localeCompare(b.start));
  return { events, warnings };
}

function buildEvent(props: Prop[], zone: string): ParsedEvent | null {
  const first = (name: string) => props.find((p) => p.name === name);
  const dtstart = first("DTSTART");
  if (!dtstart) return null;
  const start = parseWhen(dtstart, zone);
  if (!start) return null;

  let endMs: number | null = null;
  const dtend = first("DTEND");
  const duration = first("DURATION");
  if (dtend) endMs = parseWhen(dtend, zone)?.ms ?? null;
  else if (duration) {
    const ms = parseDuration(duration.value);
    if (ms !== null) endMs = start.ms + ms;
  }
  if (endMs !== null && endMs < start.ms) endMs = null;

  const text = (name: string) => {
    const p = first(name);
    return p ? unescapeText(p.value).trim() : "";
  };
  const baseUid = text("UID");
  const recurrenceId = first("RECURRENCE-ID")?.value.trim();
  const title = text("SUMMARY").replace(/\s+/g, " ").slice(0, 300) || "(No title)";
  const uid = baseUid
    ? `${baseUid}${recurrenceId ? `#${recurrenceId}` : ""}`.slice(0, 255)
    : `${title}|${new Date(start.ms).toISOString()}`.slice(0, 255);

  return {
    uid,
    title,
    start: new Date(start.ms).toISOString(),
    allDay: start.allDay,
    end: endMs !== null && !start.allDay ? new Date(endMs).toISOString() : null,
    description: text("DESCRIPTION").slice(0, 3000) || null,
    location: text("LOCATION").slice(0, 500) || null,
    recurring: Boolean(first("RRULE") || first("RDATE")),
    zoneAssumed: start.zoneAssumed,
    own: baseUid.endsWith(`@${UID_DOMAIN}`),
    cancelled: text("STATUS").toUpperCase() === "CANCELLED",
  };
}
