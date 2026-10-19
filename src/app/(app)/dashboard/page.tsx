import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowUpRight, BriefcaseBusiness, CheckSquare, ScanSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Ascent, type AscentData } from "@/components/app/ascent";
import { EmptyState } from "@/components/app/empty-state";
import { Greeting } from "@/components/app/greeting";
import { LocalTime } from "@/components/app/local-time";
import { OnboardingChecklist, type OnboardingStep } from "@/components/app/onboarding-checklist";
import { STAGES, daysUntil, deadlineLabel, nowMs, type Stage } from "@/lib/domain";
import { loadActionCenter } from "@/lib/actions-loader";
import { ONBOARDING_COOKIE } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard | CareerHub AI" };

const ACTIVE: Stage[] = ["saved", "preparing", "applied", "assessment", "interview", "offer"];

type EventRow = {
  id: string;
  summary: string;
  created_at: string;
  application_id: string;
  applications: { title: string; company_name: string } | null;
};

type NextUp = { key: string; kind: "overdue" | "task" | "deadline"; title: string; href: string; at: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = nowMs();
  const horizon = new Date(now + 7 * 86_400_000).toISOString();

  const hidden = (await cookies()).get(ONBOARDING_COOKIE)?.value === "1";
  const any = (table: "documents" | "tasks" | "contacts") =>
    supabase.from(table).select("id", { count: "exact", head: true }).limit(1);
  const [appsRes, tasksRes, referralsRes, eventsRes, hasResume, hasTask, hasContact, profileRes, roundsRes] = await Promise.all([
    supabase.from("applications").select("id, company_name, title, stage, deadline").is("archived_at", null).limit(1000),
    supabase
      .from("tasks")
      .select("id, title, due_at, snoozed_until, application_id")
      .is("completed_at", null)
      .not("due_at", "is", null)
      .lte("due_at", horizon)
      .order("due_at", { ascending: true })
      .limit(50),
    supabase.from("referrals").select("id", { count: "exact", head: true }).eq("status", "requested"),
    supabase
      .from("application_events")
      .select("id, summary, created_at, application_id, applications(title, company_name)")
      .order("created_at", { ascending: false })
      .limit(7),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("kind", "resume"),
    any("tasks"),
    any("contacts"),
    supabase.from("profiles").select("display_name, ai_notice_accepted_at").maybeSingle(),
    supabase
      .from("interview_rounds")
      .select("id", { count: "exact", head: true })
      .neq("status", "cancelled")
      .gte("scheduled_at", new Date(now).toISOString())
      .lt("scheduled_at", horizon),
  ]);

  const attention = await loadActionCenter(supabase, new Date(now));
  const urgent = attention.visible.filter((i) => i.group === "overdue" || i.group === "due_soon" || i.group === "prep");
  const loadFailed = Boolean(appsRes.error || tasksRes.error || eventsRes.error);
  const apps = appsRes.data ?? [];

  const ascent = Object.fromEntries(STAGES.map((s) => [s, { count: 0, names: [] as string[] }])) as AscentData;
  for (const a of apps) {
    const slot = ascent[a.stage as Stage];
    if (!slot) continue;
    slot.count++;
    slot.names.push(a.company_name);
  }
  const count = (s: Stage) => ascent[s].count;
  const active = ACTIVE.reduce((n, s) => n + count(s), 0);

  const dueTasks = (tasksRes.data ?? []).filter((t) => !t.snoozed_until || Date.parse(t.snoozed_until) <= now);
  const overdueTasks = dueTasks.filter((t) => Date.parse(t.due_at as string) < now);
  const upcomingDeadlines = apps
    .filter((a) => a.deadline && ACTIVE.includes(a.stage as Stage) && daysUntil(a.deadline) <= 14)
    .sort((a, b) => (a.deadline as string).localeCompare(b.deadline as string))
    .slice(0, 6);
  const events = (eventsRes.data ?? []) as unknown as EventRow[];

  // One list of what is coming, soonest first, with anything overdue on top.
  const nextUp: NextUp[] = [
    ...dueTasks.slice(0, 8).map((t) => ({
      key: `t-${t.id}`,
      kind: (Date.parse(t.due_at as string) < now ? "overdue" : "task") as NextUp["kind"],
      title: t.title,
      href: t.application_id ? `/applications/${t.application_id}` : "/tasks",
      at: t.due_at as string,
    })),
    ...upcomingDeadlines.map((a) => ({
      key: `d-${a.id}`,
      kind: "deadline" as const,
      title: `${a.title} at ${a.company_name}`,
      href: `/applications/${a.id}`,
      at: `${a.deadline}T12:00:00Z`,
    })),
  ]
    .sort((a, b) => (a.kind === "overdue" ? -1 : 0) - (b.kind === "overdue" ? -1 : 0) || a.at.localeCompare(b.at))
    .slice(0, 8);

  const interviewsThisWeek = roundsRes.count ?? 0;
  const summary = [
    plural(active, "active application"),
    interviewsThisWeek > 0 ? `${plural(interviewsThisWeek, "interview")} in the next week` : null,
    count("offer") > 0 ? `${plural(count("offer"), "offer")} to answer` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const steps: OnboardingStep[] = [
    { key: "app", label: "Add your first application", hint: "Add one by hand, import a CSV, or paste a posting.", href: "/applications/new", done: apps.length > 0 },
    { key: "resume", label: "Upload your resume", hint: "Keep versions and see which one you sent where.", href: "/documents", done: (hasResume.count ?? 0) > 0 },
    { key: "ai", label: "Turn on AI features", hint: "Job Capture, Resume Studio and next steps. You can turn them off any time.", href: "/settings", done: Boolean(profileRes.data?.ai_notice_accepted_at) },
    { key: "task", label: "Add a task or deadline", hint: "A follow-up or a due date shows up on your calendar.", href: "/tasks", done: (hasTask.count ?? 0) > 0 },
    { key: "contact", label: "Add a contact", hint: "Recruiters, alumni and referrals, linked to applications.", href: "/contacts/new", done: (hasContact.count ?? 0) > 0 },
  ];
  const showOnboarding = !hidden && !loadFailed && steps.some((s) => !s.done);
  const firstName = profileRes.data?.display_name?.trim().split(/\s+/)[0] ?? null;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="space-y-1.5">
          <h1 className="text-3xl sm:text-4xl">
            <Greeting name={firstName} />
          </h1>
          <p className="text-muted-foreground">
            {apps.length === 0 ? "Your search starts here." : summary ? `${summary}.` : "Nothing in motion yet."}
            {overdueTasks.length > 0 ? (
              <>
                {" "}
                <Link href="/tasks" className="font-medium text-destructive underline-offset-4 hover:underline">
                  {plural(overdueTasks.length, "task")} overdue
                </Link>
                .
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} render={<Link href="/applications/new" />}>
            <BriefcaseBusiness aria-hidden="true" /> Add application
          </Button>
          <Button nativeButton={false} variant="outline" render={<Link href="/jobs" />}>
            <ScanSearch aria-hidden="true" /> Import job
          </Button>
          <Button nativeButton={false} variant="outline" render={<Link href="/tasks" />}>
            <CheckSquare aria-hidden="true" /> Add task
          </Button>
        </div>
      </header>

      {loadFailed ? (
        <p role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive">
          Some dashboard data couldn&apos;t be loaded. Refresh to try again.
        </p>
      ) : null}

      {showOnboarding ? <OnboardingChecklist steps={steps} /> : null}

      {apps.length === 0 && !loadFailed ? (
        <EmptyState
          title="Start your climb"
          description="Add a role you're interested in, or paste a job posting and let CareerHub pull out the details for you to review. Your next steps and deadlines will show up here."
        >
          <Button nativeButton={false} render={<Link href="/jobs" />}>
            Import a job posting
          </Button>
          <Button nativeButton={false} variant="outline" render={<Link href="/applications/new" />}>
            Add one by hand
          </Button>
        </EmptyState>
      ) : (
        <>
          <Ascent data={ascent} />

          {urgent.length > 0 ? (
            <section aria-labelledby="attention" className="rounded-2xl border-l-4 border-sunrise bg-card p-5 shadow-lift">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="attention" className="text-lg font-semibold">
                  {plural(urgent.length, "thing")} need{urgent.length === 1 ? "s" : ""} you soon
                </h2>
                <Link href="/action-center" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
                  Open Action Center <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {urgent.slice(0, 3).map((i) => (
                  <li key={i.key}>
                    <Link href={i.href} className="underline-offset-4 hover:underline">
                      {i.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[3fr_2fr]">
            <section aria-labelledby="coming-up" className="space-y-3">
              <h2 id="coming-up" className="text-xl">
                Coming up
              </h2>
              {nextUp.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                  Nothing due in the next week. A good moment to add an application or tidy your notes.
                </p>
              ) : (
                <ul className="divide-y text-sm">
                  {nextUp.map((n) => (
                    <li key={n.key} className="flex items-center gap-3 py-3">
                      <span
                        aria-hidden="true"
                        className={cn("size-2.5 shrink-0 rounded-full", n.kind === "overdue" ? "bg-destructive" : n.kind === "deadline" ? "bg-sunrise" : "bg-primary")}
                      />
                      <Link href={n.href} className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:underline">
                        {n.title}
                      </Link>
                      <span className={cn("shrink-0 text-xs", n.kind === "overdue" ? "font-medium text-destructive" : "text-muted-foreground")}>
                        {n.kind === "overdue" ? "Overdue, " : n.kind === "deadline" ? `${deadlineLabel(n.at.slice(0, 10)).text}, ` : ""}
                        {n.kind === "deadline" ? <LocalTime iso={n.at} dateOnly /> : <LocalTime iso={n.at} />}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {(referralsRes.count ?? 0) > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {plural(referralsRes.count ?? 0, "referral request")} waiting for an answer.
                </p>
              ) : null}
            </section>

            <section aria-labelledby="activity" className="space-y-3">
              <h2 id="activity" className="text-xl">
                Recent activity
              </h2>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Changes you make to applications show up here.</p>
              ) : (
                <ol className="relative ml-1.5 space-y-5 border-l pl-6 text-sm">
                  {events.map((e) => (
                    <li key={e.id} className="relative">
                      <span aria-hidden="true" className="absolute -left-[29px] top-1.5 size-2 rounded-full bg-border ring-4 ring-background" />
                      <p>{e.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.applications ? (
                          <>
                            <Link href={`/applications/${e.application_id}`} className="underline-offset-4 hover:underline">
                              {e.applications.title} at {e.applications.company_name}
                            </Link>
                            {" "}
                          </>
                        ) : null}
                        <LocalTime iso={e.created_at} />
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
