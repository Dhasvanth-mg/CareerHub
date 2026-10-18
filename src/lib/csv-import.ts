import { PRIORITIES, STAGES, WORK_MODES, type Stage } from "@/lib/domain";

/** Reading a spreadsheet export into applications. Pure functions, used in the browser for the preview
 *  and again on the server (via the shared schema) before anything is saved. */

export const MAX_CSV_CHARS = 2_000_000;
export const MAX_IMPORT_ROWS = 500;

export type ImportField =
  | "company_name"
  | "title"
  | "stage"
  | "priority"
  | "location"
  | "work_mode"
  | "employment_type"
  | "posting_url"
  | "source"
  | "salary_text"
  | "applied_on"
  | "deadline"
  | "notes";

export const IMPORT_FIELDS: { key: ImportField; label: string; required?: boolean; words: string[] }[] = [
  { key: "company_name", label: "Company", required: true, words: ["company", "company name", "employer", "organization", "organisation", "firm"] },
  { key: "title", label: "Role title", required: true, words: ["title", "role", "role title", "job title", "position", "job", "position title"] },
  { key: "stage", label: "Stage", words: ["stage", "status", "state", "progress", "application status"] },
  { key: "priority", label: "Priority", words: ["priority", "importance", "rank"] },
  { key: "location", label: "Location", words: ["location", "city", "place", "where"] },
  { key: "work_mode", label: "Work arrangement", words: ["work mode", "work arrangement", "remote", "remote/onsite", "arrangement", "work type"] },
  { key: "employment_type", label: "Employment type", words: ["employment type", "job type", "type", "contract"] },
  { key: "posting_url", label: "Posting link", words: ["url", "link", "posting url", "job url", "job link", "posting", "posting link", "application link"] },
  { key: "source", label: "Source", words: ["source", "found on", "found via", "board", "referral source"] },
  { key: "salary_text", label: "Salary as listed", words: ["salary", "pay", "compensation", "salary range", "wage"] },
  { key: "applied_on", label: "Date applied", words: ["applied", "applied on", "date applied", "application date", "applied date", "date"] },
  { key: "deadline", label: "Deadline", words: ["deadline", "due", "due date", "apply by", "closing date", "closes"] },
  { key: "notes", label: "Notes", words: ["notes", "note", "comments", "comment", "details", "description"] },
];

// ---------------------------------------------------------------- CSV text

/** Parses CSV text (RFC 4180 quoting). The delimiter is detected from the header line: comma, semicolon or tab. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0] ?? "";
  const count = (ch: string) => {
    let n = 0;
    let q = false;
    for (const c of firstLine) {
      if (c === '"') q = !q;
      else if (c === ch && !q) n++;
    }
    return n;
  };
  const delimiter = [",", ";", "\t"].map((d) => ({ d, n: count(d) })).sort((a, b) => b.n - a.n)[0];
  const sep = delimiter.n > 0 ? delimiter.d : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"' && cell === "") {
      inQuotes = true;
    } else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ---------------------------------------------------------------- column mapping

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ").trim();

/** Best-guess column for each field, by header name. Each column is used at most once. */
export function guessMapping(headers: string[]): Partial<Record<ImportField, number>> {
  const mapping: Partial<Record<ImportField, number>> = {};
  const used = new Set<number>();
  const normalized = headers.map(norm);
  // Exact names first, then "contains", so "Date" doesn't steal the column "Date applied".
  for (const pass of ["exact", "contains"] as const) {
    for (const f of IMPORT_FIELDS) {
      if (mapping[f.key] !== undefined) continue;
      for (const word of f.words) {
        const idx = normalized.findIndex((h, i) => !used.has(i) && (pass === "exact" ? h === word : word.length > 3 && h.includes(word)));
        if (idx >= 0) {
          mapping[f.key] = idx;
          used.add(idx);
          break;
        }
      }
    }
  }
  return mapping;
}

// ---------------------------------------------------------------- value cleaning

const STAGE_WORDS: Record<Stage, string[]> = {
  saved: ["saved", "wishlist", "wish list", "interested", "bookmarked", "to apply", "todo", "to do", "want to apply", "found", "lead"],
  preparing: ["preparing", "drafting", "in progress", "working on", "tailoring", "prep"],
  applied: ["applied", "submitted", "sent", "ghosted", "no response", "waiting", "pending", "awaiting"],
  assessment: ["assessment", "online assessment", "oa", "coding challenge", "take home", "take-home", "test", "hackerrank", "codesignal"],
  interview: ["interview", "interviewing", "phone screen", "screen", "screening", "onsite", "on site", "final round", "technical", "recruiter call", "interviewed"],
  offer: ["offer", "offered", "offer received", "negotiating"],
  accepted: ["accepted", "hired", "signed", "joined", "started"],
  rejected: ["rejected", "denied", "turned down", "not selected", "declined by company", "closed", "passed on"],
  withdrawn: ["withdrawn", "withdrew", "cancelled", "canceled", "declined", "not interested"],
};

export function normalizeStage(value: string): { stage: Stage; recognised: boolean } {
  const v = norm(value);
  if (!v) return { stage: "saved", recognised: true };
  if ((STAGES as readonly string[]).includes(v)) return { stage: v as Stage, recognised: true };
  for (const stage of Object.keys(STAGE_WORDS) as Stage[]) {
    if (STAGE_WORDS[stage].some((w) => norm(w) === v)) return { stage, recognised: true };
  }
  for (const stage of Object.keys(STAGE_WORDS) as Stage[]) {
    if (STAGE_WORDS[stage].some((w) => norm(w).length > 3 && v.includes(norm(w)))) return { stage, recognised: true };
  }
  return { stage: "saved", recognised: false };
}

export function normalizePriority(value: string): (typeof PRIORITIES)[number] {
  const v = norm(value);
  if (/^(h|high|urgent|top|1|a)$/.test(v) || v.startsWith("high")) return "high";
  if (/^(l|low|3|c)$/.test(v) || v.startsWith("low")) return "low";
  return "medium";
}

export function normalizeWorkMode(value: string): (typeof WORK_MODES)[number] | null {
  const v = norm(value);
  if (!v) return null;
  if (v.includes("hybrid")) return "hybrid";
  if (v.includes("remote") || v === "wfh") return "remote";
  if (/on ?site|in ?person|in office|office/.test(v)) return "on_site";
  return null;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const validDate = (y: number, m: number, d: number) => {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

export type DateOrder = "month-first" | "day-first";

/** Reads dates like 2026-10-05, 10/5/2026, 5.10.2026, "Oct 5, 2026" and "5 October 2026" into "YYYY-MM-DD".
 *  Slash dates are ambiguous, so the caller says which order to expect. */
export function parseLooseDate(value: string, order: DateOrder = "month-first"): string | null {
  const v = value.trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
  if (m) return validDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return order === "month-first" ? validDate(y, a, b) : validDate(y, b, a);
  }
  m = v.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/);
  if (m) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    return mo >= 0 ? validDate(Number(m[3]), mo + 1, Number(m[2])) : null;
  }
  m = v.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/);
  if (m) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    return mo >= 0 ? validDate(Number(m[3]), mo + 1, Number(m[1])) : null;
  }
  return null;
}

export function cleanUrl(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : /^[\w-]+(\.[\w-]+)+(\/|$)/.test(v) ? `https://${v}` : null;
  if (!withScheme) return null;
  try {
    return new URL(withScheme).toString().slice(0, 2000);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- rows

export type ImportRow = {
  company_name: string;
  title: string;
  stage: Stage;
  priority: (typeof PRIORITIES)[number];
  location: string | null;
  work_mode: (typeof WORK_MODES)[number] | null;
  employment_type: string | null;
  posting_url: string | null;
  source: string | null;
  salary_text: string | null;
  applied_on: string | null;
  deadline: string | null;
  notes: string | null;
};

export type PreparedRow = { row: ImportRow | null; problems: string[]; notes: string[] };

const text = (v: string | undefined, max: number) => {
  const t = (v ?? "").trim().slice(0, max);
  return t === "" ? null : t;
};

/** Turns one spreadsheet row into an application, or explains why it can't be. */
export function prepareRow(
  cells: string[],
  mapping: Partial<Record<ImportField, number>>,
  order: DateOrder = "month-first",
): PreparedRow {
  const get = (f: ImportField) => (mapping[f] === undefined ? "" : (cells[mapping[f] as number] ?? ""));
  const problems: string[] = [];
  const notes: string[] = [];

  const company_name = text(get("company_name"), 200);
  const title = text(get("title"), 200);
  if (!company_name) problems.push("Missing company");
  if (!title) problems.push("Missing role title");

  const stageRaw = get("stage");
  const { stage, recognised } = normalizeStage(stageRaw);
  if (!recognised) notes.push(`Stage "${stageRaw.trim().slice(0, 30)}" not recognised, set to Saved`);

  const dateField = (f: "applied_on" | "deadline") => {
    const raw = get(f).trim();
    if (!raw) return null;
    const parsed = parseLooseDate(raw, order);
    if (!parsed) notes.push(`${f === "applied_on" ? "Applied" : "Deadline"} date "${raw.slice(0, 20)}" not understood, left blank`);
    return parsed;
  };
  const applied_on = dateField("applied_on");
  const deadline = dateField("deadline");

  const rawUrl = get("posting_url").trim();
  const posting_url = cleanUrl(rawUrl);
  if (rawUrl && !posting_url) notes.push("Link not valid, left blank");

  if (problems.length > 0) return { row: null, problems, notes };
  return {
    row: {
      company_name: company_name as string,
      title: title as string,
      stage,
      priority: normalizePriority(get("priority")),
      location: text(get("location"), 200),
      work_mode: normalizeWorkMode(get("work_mode")),
      employment_type: text(get("employment_type"), 100),
      posting_url,
      source: text(get("source"), 200),
      salary_text: text(get("salary_text"), 200),
      applied_on,
      deadline,
      notes: text(get("notes"), 10000),
    },
    problems,
    notes,
  };
}

export const TEMPLATE_CSV =
  "Company,Role,Stage,Priority,Location,Work arrangement,Link,Source,Salary,Date applied,Deadline,Notes\r\n" +
  'Acme Corp,Software Engineer Intern,Applied,High,"Austin, TX",Hybrid,https://example.com/jobs/123,LinkedIn,$38/hr,2026-10-01,2026-12-01,Referred by Sam\r\n';
