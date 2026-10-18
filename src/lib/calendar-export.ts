import type { SupabaseClient } from "@supabase/supabase-js";
import { STAGES, ROUND_TYPE_LABEL, type RoundType, type Stage } from "@/lib/domain";
import { UID_DOMAIN, type ExportEvent } from "@/lib/ics";

export const WINDOW_PAST_DAYS = 30;
export const WINDOW_FUTURE_DAYS = 365;
const PER_KIND_LIMIT = 500;
const ACTIVE = STAGES.filter((s) => !["rejected", "withdrawn", "accepted"].includes(s)) as Stage[];

export type EntryKind = "interview" | "task" | "deadline";
export type CalendarEntry = {
  /** "kind:uuid", the value of the checkbox in the export form. */
  key: string;
  kind: EntryKind;
  title: string;
  /** Instant (ISO-8601), or "YYYY-MM-DD" when `allDay`. */
  at: string;
  allDay: boolean;
  event: ExportEvent;
};

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://careerhub-woad.vercel.app").replace(/\/$/, "");

type RoundRow = {
  id: string;
  application_id: string;
  round_type: RoundType;
  scheduled_at: string;
  duration_minutes: number | null;
  location: string | null;
  interviewers: string | null;
  applications: { title: string; company_name: string } | null;
};
type TaskRow = { id: string; title: string; notes: string | null; due_at: string; application_id: string | null };
type DeadlineRow = { id: string; title: string; company_name: string; deadline: string };

/** Everything that would appear on the calendar between a month ago and a year from now. Row level security
 *  scopes every query to the signed-in user. */
export async function loadCalendarEntries(supabase: SupabaseClient, now: Date): Promise<CalendarEntry[]> {
  const from = new Date(now.getTime() - WINDOW_PAST_DAYS * 86_400_000);
  const to = new Date(now.getTime() + WINDOW_FUTURE_DAYS * 86_400_000);
  const base = siteUrl();

  const [rounds, tasks, deadlines] = await Promise.all([
    supabase
      .from("interview_rounds")
      .select("id, application_id, round_type, scheduled_at, duration_minutes, location, interviewers, applications(title, company_name)")
      .not("scheduled_at", "is", null)
      .neq("status", "cancelled")
      .gte("scheduled_at", from.toISOString())
      .lt("scheduled_at", to.toISOString())
      .order("scheduled_at")
      .limit(PER_KIND_LIMIT),
    supabase
      .from("tasks")
      .select("id, title, notes, due_at, application_id")
      .is("completed_at", null)
      .not("due_at", "is", null)
      .gte("due_at", from.toISOString())
      .lt("due_at", to.toISOString())
      .order("due_at")
      .limit(PER_KIND_LIMIT),
    supabase
      .from("applications")
      .select("id, title, company_name, deadline")
      .is("archived_at", null)
      .in("stage", ACTIVE)
      .not("deadline", "is", null)
      .gte("deadline", from.toISOString().slice(0, 10))
      .lte("deadline", to.toISOString().slice(0, 10))
      .order("deadline")
      .limit(PER_KIND_LIMIT),
  ]);

  const out: CalendarEntry[] = [];

  for (const r of (rounds.data ?? []) as unknown as RoundRow[]) {
    const company = r.applications?.company_name ?? "Interview";
    const title = `${ROUND_TYPE_LABEL[r.round_type]}: ${company}`;
    const start = Date.parse(r.scheduled_at);
    const description = [
      r.applications ? `${r.applications.title} at ${r.applications.company_name}` : null,
      r.interviewers ? `Interviewers: ${r.interviewers}` : null,
      `Open in CareerHub: ${base}/applications/${r.application_id}`,
    ]
      .filter(Boolean)
      .join("\n");
    out.push({
      key: `interview:${r.id}`,
      kind: "interview",
      title,
      at: r.scheduled_at,
      allDay: false,
      event: {
        uid: `interview-${r.id}@${UID_DOMAIN}`,
        title,
        start: r.scheduled_at,
        end: new Date(start + (r.duration_minutes ?? 60) * 60_000).toISOString(),
        description,
        location: r.location,
        url: `${base}/applications/${r.application_id}`,
      },
    });
  }

  for (const t of (tasks.data ?? []) as TaskRow[]) {
    const url = t.application_id ? `${base}/applications/${t.application_id}` : `${base}/tasks`;
    out.push({
      key: `task:${t.id}`,
      kind: "task",
      title: t.title,
      at: t.due_at,
      allDay: false,
      event: {
        uid: `task-${t.id}@${UID_DOMAIN}`,
        title: `Task: ${t.title}`,
        start: t.due_at,
        end: new Date(Date.parse(t.due_at) + 30 * 60_000).toISOString(),
        description: [t.notes, `Open in CareerHub: ${url}`].filter(Boolean).join("\n\n"),
        url,
      },
    });
  }

  for (const a of (deadlines.data ?? []) as DeadlineRow[]) {
    const url = `${base}/applications/${a.id}`;
    const title = `${a.company_name} deadline`;
    out.push({
      key: `deadline:${a.id}`,
      kind: "deadline",
      title,
      at: a.deadline,
      allDay: true,
      event: {
        uid: `deadline-${a.id}@${UID_DOMAIN}`,
        title: `Deadline: ${a.company_name}`,
        start: a.deadline,
        allDay: true,
        description: `${a.title} at ${a.company_name}\nOpen in CareerHub: ${url}`,
        url,
      },
    });
  }

  // Deadlines are dates, the rest are instants; compare on noon UTC so they interleave sensibly.
  const sortKey = (e: CalendarEntry) => (e.allDay ? `${e.at}T12:00:00.000Z` : e.at);
  return out.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}
