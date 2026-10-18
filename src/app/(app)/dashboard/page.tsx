import Link from "next/link";
import { cookies } from "next/headers";
import { BriefcaseBusiness, CheckSquare, ScanSearch, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeadlineBadge } from "@/components/app/stage-badge";
import { LocalTime } from "@/components/app/local-time";
import { STAGES, STAGE_LABEL, daysUntil, nowMs, type Stage } from "@/lib/domain";
import { loadActionCenter } from "@/lib/actions-loader";
import { OnboardingChecklist, type OnboardingStep } from "@/components/app/onboarding-checklist";
import { ONBOARDING_COOKIE } from "@/lib/onboarding";

export const metadata = { title: "Dashboard | CareerHub AI" };

const ACTIVE: Stage[] = ["saved", "preparing", "applied", "assessment", "interview", "offer"];

type EventRow = {
  id: string;
  summary: string;
  created_at: string;
  application_id: string;
  applications: { title: string; company_name: string } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const now = nowMs();
  const horizon = new Date(now + 7 * 86_400_000).toISOString();

  const hidden = (await cookies()).get(ONBOARDING_COOKIE)?.value === "1";
  const any = (table: "documents" | "tasks" | "contacts") =>
    supabase.from(table).select("id", { count: "exact", head: true }).limit(1);
  const [appsRes, tasksRes, referralsRes, eventsRes, hasResume, hasTask, hasContact, profileRes] = await Promise.all([
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
      .limit(8),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("kind", "resume"),
    any("tasks"),
    any("contacts"),
    supabase.from("profiles").select("ai_notice_accepted_at").maybeSingle(),
  ]);

  const attention = await loadActionCenter(supabase, new Date(now));
  const urgent = attention.visible.filter((i) => i.group === "overdue" || i.group === "due_soon" || i.group === "prep");
  const loadFailed = Boolean(appsRes.error || tasksRes.error || eventsRes.error);
  const apps = appsRes.data ?? [];
  const byStage = new Map<Stage, number>();
  for (const a of apps) byStage.set(a.stage as Stage, (byStage.get(a.stage as Stage) ?? 0) + 1);

  const dueTasks = (tasksRes.data ?? []).filter((t) => !t.snoozed_until || Date.parse(t.snoozed_until) <= now);
  const overdueTasks = dueTasks.filter((t) => Date.parse(t.due_at as string) < now);
  const upcomingDeadlines = apps
    .filter((a) => a.deadline && ACTIVE.includes(a.stage as Stage) && daysUntil(a.deadline) <= 14)
    .sort((a, b) => (a.deadline as string).localeCompare(b.deadline as string))
    .slice(0, 6);
  const events = (eventsRes.data ?? []) as unknown as EventRow[];

  const cards: { label: string; value: number; hint?: string }[] = [
    { label: "Total applications", value: apps.length },
    { label: "Active", value: ACTIVE.reduce((n, s) => n + (byStage.get(s) ?? 0), 0), hint: "Saved through offer" },
    { label: "Interviews", value: byStage.get("interview") ?? 0 },
    { label: "Offers", value: (byStage.get("offer") ?? 0) + (byStage.get("accepted") ?? 0) },
    { label: "Rejections", value: byStage.get("rejected") ?? 0 },
    { label: "Tasks due", value: dueTasks.length, hint: overdueTasks.length ? `${overdueTasks.length} overdue` : "Next 7 days" },
    { label: "Referrals pending", value: referralsRes.count ?? 0, hint: "Requested, no answer yet" },
  ];
  const maxStage = Math.max(1, ...STAGES.map((s) => byStage.get(s) ?? 0));

  const steps: OnboardingStep[] = [
    { key: "app", label: "Add your first application", hint: "Add one by hand, import a CSV, or paste a posting.", href: "/applications/new", done: apps.length > 0 },
    { key: "resume", label: "Upload your resume", hint: "Keep versions and see which one you sent where.", href: "/documents", done: (hasResume.count ?? 0) > 0 },
    { key: "ai", label: "Turn on AI features", hint: "Job Capture, Resume Studio and next steps. You can turn them off any time.", href: "/settings", done: Boolean(profileRes.data?.ai_notice_accepted_at) },
    { key: "task", label: "Add a task or deadline", hint: "A follow-up or a due date shows up on your calendar.", href: "/tasks", done: (hasTask.count ?? 0) > 0 },
    { key: "contact", label: "Add a contact", hint: "Recruiters, alumni and referrals, linked to applications.", href: "/contacts/new", done: (hasContact.count ?? 0) > 0 },
  ];
  const showOnboarding = !hidden && !loadFailed && steps.some((s) => !s.done);

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
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
          <Button nativeButton={false} variant="outline" render={<Link href="/contacts/new" />}>
            <UserPlus aria-hidden="true" /> Add contact
          </Button>
        </div>
      </div>

      {loadFailed ? (
        <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          Some dashboard data couldn&apos;t be loaded. Refresh to try again.
        </p>
      ) : null}

      {showOnboarding ? <OnboardingChecklist steps={steps} /> : null}

      {apps.length === 0 && !loadFailed ? (
        <div className="rounded-lg border border-dashed p-8">
          <h2 className="text-lg font-medium">Start your search</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Add a role you&apos;re interested in, or paste a job posting and let CareerHub pull out the details for you to review. Your
            next steps and deadlines will show up here.
          </p>
          <div className="mt-4 flex gap-2">
            <Button nativeButton={false} render={<Link href="/jobs" />}>
              Import a job posting
            </Button>
            <Button nativeButton={false} variant="outline" render={<Link href="/applications/new" />}>
              Add manually
            </Button>
          </div>
        </div>
      ) : (
        <>
          {attention.visible.length > 0 ? (
            <section aria-labelledby="attention" className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="attention" className="font-medium">
                  {urgent.length > 0
                    ? `${urgent.length} thing${urgent.length === 1 ? "" : "s"} need${urgent.length === 1 ? "s" : ""} your attention`
                    : `${attention.visible.length} suggestion${attention.visible.length === 1 ? "" : "s"} to tidy up`}
                </h2>
                <Link href="/action-center" className="text-sm underline underline-offset-4">
                  Open Action Center
                </Link>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {attention.visible.slice(0, 3).map((i) => (
                  <li key={i.key}>
                    <Link href={i.href} className="underline-offset-4 hover:underline">
                      {i.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-label="Summary">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {cards.map((c) => (
                <li key={c.label}>
                  <Card size="sm" className="h-full">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-semibold tabular-nums">{c.value}</p>
                      {c.hint ? <p className="text-xs text-muted-foreground">{c.hint}</p> : null}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="coming-up" className="space-y-3">
              <h2 id="coming-up" className="text-lg font-medium">
                Coming up
              </h2>
              {dueTasks.length === 0 && upcomingDeadlines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing due in the next week. Nice.</p>
              ) : (
                <ul className="divide-y rounded-lg border text-sm">
                  {dueTasks.slice(0, 6).map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                      <Link
                        href={t.application_id ? `/applications/${t.application_id}` : "/tasks"}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {t.title}
                      </Link>
                      <span className={Date.parse(t.due_at as string) < now ? "text-rose-600 dark:text-rose-300" : "text-muted-foreground"}>
                        {Date.parse(t.due_at as string) < now ? "Overdue: " : ""}
                        <LocalTime iso={t.due_at as string} />
                      </span>
                    </li>
                  ))}
                  {upcomingDeadlines.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                      <Link href={`/applications/${a.id}`} className="font-medium underline-offset-4 hover:underline">
                        {a.title} at {a.company_name}
                      </Link>
                      <DeadlineBadge date={a.deadline as string} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="by-stage" className="space-y-3">
              <h2 id="by-stage" className="text-lg font-medium">
                By stage
              </h2>
              <ul className="space-y-2 text-sm">
                {STAGES.map((s) => {
                  const n = byStage.get(s) ?? 0;
                  return (
                    <li key={s} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-muted-foreground">{STAGE_LABEL[s]}</span>
                      <div className="h-2 flex-1 rounded-full bg-muted" aria-hidden="true">
                        <div className="h-2 rounded-full bg-primary" style={{ width: `${(n / maxStage) * 100}%` }} />
                      </div>
                      <span className="w-6 text-right tabular-nums">{n}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <section aria-labelledby="activity" className="space-y-3">
            <h2 id="activity" className="text-lg font-medium">
              Recent activity
            </h2>
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {events.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <p>
                      {e.summary}
                      {e.applications ? (
                        <>
                          {" · "}
                          <Link href={`/applications/${e.application_id}`} className="text-muted-foreground underline underline-offset-4">
                            {e.applications.title} at {e.applications.company_name}
                          </Link>
                        </>
                      ) : null}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      <LocalTime iso={e.created_at} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
