import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CalendarGrid, type CalendarItem } from "@/components/app/calendar-grid";
import { LocalTime } from "@/components/app/local-time";
import { Badge } from "@/components/ui/badge";
import { overlappingRounds, parseMonth, shiftMonth } from "@/lib/calendar";
import { ROUND_TYPE_LABEL, STAGES, nowMs, type RoundType, type Stage } from "@/lib/domain";

export const metadata = { title: "Calendar | CareerHub AI" };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ACTIVE: Stage[] = STAGES.filter((s) => !["rejected", "withdrawn", "accepted"].includes(s)) as Stage[];
const iso = (d: Date) => d.toISOString();
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

type RoundRow = {
  id: string;
  application_id: string;
  round_type: RoundType;
  status: string;
  scheduled_at: string;
  duration_minutes: number | null;
  applications: { title: string; company_name: string } | null;
};
type TaskRow = { id: string; title: string; due_at: string; application_id: string | null };
type DeadlineRow = { id: string; title: string; company_name: string; deadline: string };

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const sp = await searchParams;
  const now = new Date(nowMs());
  const { year, month } = parseMonth(one(sp.m), now);

  // Pad the window by a day each way so items near month edges land correctly in any time zone.
  const from = new Date(Date.UTC(year, month, 1) - 2 * 86_400_000);
  const to = new Date(Date.UTC(year, month + 1, 1) + 2 * 86_400_000);
  const fromDate = from.toISOString().slice(0, 10);
  const toDate = to.toISOString().slice(0, 10);

  const supabase = await createClient();
  const [roundsRes, tasksRes, deadlinesRes, allRoundsRes] = await Promise.all([
    supabase
      .from("interview_rounds")
      .select("id, application_id, round_type, status, scheduled_at, duration_minutes, applications(title, company_name)")
      .not("scheduled_at", "is", null)
      .neq("status", "cancelled")
      .gte("scheduled_at", iso(from))
      .lt("scheduled_at", iso(to))
      .order("scheduled_at"),
    supabase
      .from("tasks")
      .select("id, title, due_at, application_id")
      .is("completed_at", null)
      .not("due_at", "is", null)
      .gte("due_at", iso(from))
      .lt("due_at", iso(to))
      .order("due_at"),
    supabase
      .from("applications")
      .select("id, title, company_name, deadline")
      .is("archived_at", null)
      .in("stage", ACTIVE)
      .not("deadline", "is", null)
      .gte("deadline", fromDate)
      .lte("deadline", toDate)
      .order("deadline"),
    supabase
      .from("interview_rounds")
      .select("id, status, scheduled_at, duration_minutes")
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", iso(new Date(from.getTime() - 86_400_000)))
      .lt("scheduled_at", iso(new Date(to.getTime() + 86_400_000))),
  ]);

  const rounds = (roundsRes.data ?? []) as unknown as RoundRow[];
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const deadlines = (deadlinesRes.data ?? []) as DeadlineRow[];
  const conflicts = overlappingRounds(allRoundsRes.data ?? []);

  const items: CalendarItem[] = [
    ...rounds.map((r) => ({
      id: r.id,
      kind: "interview" as const,
      title: `${ROUND_TYPE_LABEL[r.round_type]}: ${r.applications?.company_name ?? "interview"}`,
      at: r.scheduled_at,
      href: `/applications/${r.application_id}`,
      conflict: conflicts.has(r.id),
    })),
    ...tasks.map((t) => ({
      id: t.id,
      kind: "task" as const,
      title: t.title,
      at: t.due_at,
      href: t.application_id ? `/applications/${t.application_id}` : "/tasks",
    })),
    ...deadlines.map((a) => ({
      id: a.id,
      kind: "deadline" as const,
      title: `${a.company_name} deadline`,
      at: a.deadline,
      href: `/applications/${a.id}`,
    })),
  ];

  // The agenda is server-rendered and doubles as the accessible, no-JavaScript view.
  const todayIso = now.toISOString();
  const agenda = items
    .filter((i) => (i.kind === "deadline" ? `${i.at}T23:59:59Z` >= todayIso : i.at >= todayIso))
    .sort((a, b) => (a.kind === "deadline" ? `${a.at}T12:00:00Z` : a.at).localeCompare(b.kind === "deadline" ? `${b.at}T12:00:00Z` : b.at))
    .slice(0, 25);

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const today = shiftMonth(now.getUTCFullYear(), now.getUTCMonth(), 0);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl sm:text-4xl">Calendar</h1>
        <nav aria-label="Month" className="flex items-center gap-2 text-sm">
          <Link href={`/calendar?m=${prev}`} className="rounded-md border px-3 py-1 hover:bg-muted">
            ← Previous
          </Link>
          <span className="min-w-36 text-center font-medium" aria-live="polite">
            {MONTH_NAMES[month]} {year}
          </span>
          <Link href={`/calendar?m=${next}`} className="rounded-md border px-3 py-1 hover:bg-muted">
            Next →
          </Link>
          <Link href={`/calendar?m=${today}`} className="rounded-md px-3 py-1 text-muted-foreground underline underline-offset-4">
            Today
          </Link>
          <Link href="/calendar/sync" className="rounded-md border px-3 py-1 hover:bg-muted">
            Import / export
          </Link>
        </nav>
      </div>

      <p className="text-sm text-muted-foreground">
        Interviews, task due dates and application deadlines in one place, shown in your local time. Add interviews from an application.
      </p>

      <CalendarGrid year={year} month={month} items={items} />

      <section aria-labelledby="agenda" className="space-y-3">
        <h2 id="agenda" className="text-xl">
          Coming up
        </h2>
        {agenda.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled from now through the end of this view.</p>
        ) : (
          <ul className="divide-y rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] text-sm">
            {agenda.map((i) => (
              <li key={`${i.kind}-${i.id}`} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{i.kind === "interview" ? "Interview" : i.kind === "task" ? "Task" : "Deadline"}</Badge>
                  <Link href={i.href} className="font-medium underline-offset-4 hover:underline">
                    {i.title}
                  </Link>
                  {i.conflict ? <span className="text-xs text-amber-700 dark:text-amber-300">Overlaps another interview</span> : null}
                </div>
                <span className="text-muted-foreground">
                  {i.kind === "deadline" ? <LocalTime iso={`${i.at}T12:00:00Z`} dateOnly /> : <LocalTime iso={i.at} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
