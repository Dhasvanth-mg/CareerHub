import Link from "next/link";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STAGE_LABEL, nowMs, type Stage } from "@/lib/domain";
import { computeAnalytics, isSmall, type AppInput, type EventInput } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export const metadata = { title: "Analytics | CareerHub AI" };

const PERIODS = [
  ["all", "All time"],
  ["90", "Last 90 days"],
  ["30", "Last 30 days"],
] as const;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  const sp = await searchParams;
  const period = PERIODS.some(([k]) => k === one(sp.p)) ? (one(sp.p) as string) : "all";

  const supabase = await createClient();
  let appsQuery = supabase
    .from("applications")
    .select("id, stage, created_at, applied_on, source, submitted_resume_version_id")
    .limit(5000);
  if (period !== "all") {
    appsQuery = appsQuery.gte("created_at", new Date(nowMs() - Number(period) * 86_400_000).toISOString());
  }
  const { data: apps, error } = await appsQuery;
  const appIds = (apps ?? []).map((a) => a.id);

  const { data: events } = appIds.length
    ? await supabase
        .from("application_events")
        .select("application_id, type, from_value, to_value, created_at")
        .in("type", ["created", "stage_changed"])
        .in("application_id", appIds.slice(0, 1000))
        .limit(20000)
    : { data: [] };

  const result = computeAnalytics((apps ?? []) as AppInput[], (events ?? []) as EventInput[]);

  const resumeIds = result.byResume.map((r) => r.id);
  const { data: versions } = resumeIds.length
    ? await supabase.from("document_versions").select("id, version, documents(title)").in("id", resumeIds)
    : { data: [] };
  const versionLabel = new Map(
    ((versions ?? []) as unknown as { id: string; version: number; documents: { title: string } | null }[]).map((v) => [
      v.id,
      `${v.documents?.title ?? "Resume"}, version ${v.version}`,
    ]),
  );

  const top = Math.max(1, ...result.funnel.map((s) => s.count));
  const cards = [
    { label: "Applications", value: String(result.total), hint: result.unknownHistory ? `${result.unknownHistory} with unknown history` : undefined },
    { label: "Applied", value: String(result.applied) },
    {
      label: "Heard back",
      value: result.responseRate === null ? "n/a" : `${result.responseRate}%`,
      hint: result.applied ? `${result.responded} of ${result.applied} applied` : "No applications sent yet",
    },
    {
      label: "Typical wait",
      value: result.medianDaysToResponse === null ? "n/a" : `${Math.round(result.medianDaysToResponse)} days`,
      hint: result.responseSample ? `Median of ${result.responseSample}` : "Needs recorded stage changes",
    },
    { label: "Still waiting", value: String(result.waiting), hint: "Applied, no movement yet" },
  ];

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Time period" className="flex rounded-lg border p-0.5 text-sm">
            {PERIODS.map(([k, label]) => (
              <Link
                key={k}
                href={`/analytics?p=${k}`}
                aria-current={period === k ? "true" : undefined}
                className={cn("rounded-md px-3 py-1", period === k ? "bg-muted font-medium" : "text-muted-foreground")}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Button nativeButton={false} variant="outline" size="sm" render={<a href={`/api/export?format=analytics&p=${period}`} />}>
            <Download aria-hidden="true" /> Download CSV
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t load your data. Refresh to try again.
        </p>
      ) : result.total === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">Nothing to analyze yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add applications and move them through stages, and this page will show how your search is going.
          </p>
          <Button className="mt-4" nativeButton={false} render={<Link href="/applications/new" />}>
            Add an application
          </Button>
        </div>
      ) : (
        <>
          <section aria-label="Summary">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {cards.map((c) => (
                <li key={c.label}>
                  <Card size="sm" className="h-full">
                    <CardHeader>
                      <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-semibold tabular-nums">{c.value}</p>
                      {c.hint ? <p className="text-xs text-muted-foreground">{c.hint}</p> : null}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="funnel" className="space-y-3">
            <h2 id="funnel" className="text-lg font-medium">
              Funnel
            </h2>
            <p className="text-sm text-muted-foreground">
              How many applications reached each stage at some point, based on the stage changes you&apos;ve recorded. The percentage is
              the share of the stage before it.
            </p>
            <ul className="space-y-2 text-sm">
              {result.funnel.map((s) => (
                <li key={s.stage} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-muted-foreground">{STAGE_LABEL[s.stage as Stage]}</span>
                  <div className="h-3 flex-1 rounded-full bg-muted" aria-hidden="true">
                    <div className="h-3 rounded-full bg-primary" style={{ width: `${(s.count / top) * 100}%` }} />
                  </div>
                  <span className="w-28 text-right tabular-nums">
                    {s.count}
                    {s.fromPrevious !== null ? <span className="text-muted-foreground"> · {s.fromPrevious}%</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            {result.unknownHistory > 0 ? (
              <p className="text-xs text-muted-foreground">
                {result.unknownHistory} closed application{result.unknownHistory === 1 ? " has" : "s have"} no recorded stage history, so
                {result.unknownHistory === 1 ? " it isn't" : " they aren't"} counted in the funnel. They&apos;re unknown, not assumed to be
                rejections from any particular stage.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="outcomes" className="space-y-3">
            <h2 id="outcomes" className="text-lg font-medium">
              Outcomes
            </h2>
            <p className="text-sm">
              Of {result.applied} applied: {result.responded} moved on or were answered, {result.waiting} still waiting. Closed by you or
              the employer overall: {result.rejected} rejected, {result.withdrawn} withdrawn.
            </p>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="sources" className="space-y-3">
              <h2 id="sources" className="text-lg font-medium">
                By source
              </h2>
              <BreakdownTable
                caption="Applications and interviews by source"
                rows={result.bySource.map((r) => ({ key: r.label, label: r.label, applied: r.applied, interviews: r.interviews }))}
                empty="Add a source to your applications (job board, referral, career fair) to compare them."
              />
            </section>
            <section aria-labelledby="resumes" className="space-y-3">
              <h2 id="resumes" className="text-lg font-medium">
                By submitted resume
              </h2>
              <BreakdownTable
                caption="Applications and interviews by resume version"
                rows={result.byResume.map((r) => ({
                  key: r.id,
                  label: versionLabel.get(r.id) ?? "Deleted resume",
                  applied: r.applied,
                  interviews: r.interviews,
                }))}
                empty="Record which resume version you submitted on each application to compare them."
              />
            </section>
          </div>

          <details className="rounded-lg border p-4 text-sm">
            <summary className="cursor-pointer font-medium">How these numbers are calculated</summary>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>A stage counts as &ldquo;reached&rdquo; if the application is there now, or you moved it there or past it.</li>
              <li>&ldquo;Heard back&rdquo; counts applications that moved past Applied, plus ones the employer rejected after you applied.</li>
              <li>Typical wait is the median time between moving to Applied and the next stage change, for applications where both were recorded.</li>
              <li>Closed applications with no recorded history are shown as unknown. They are never assumed to be rejections.</li>
              <li>
                Small groups are marked, because a few applications can&apos;t show a real pattern. These are comparisons, not proof: a
                resume or source doing &ldquo;better&rdquo; doesn&apos;t mean it caused the difference.
              </li>
            </ul>
          </details>
        </>
      )}
    </div>
  );
}

function BreakdownTable({
  caption,
  rows,
  empty,
}: {
  caption: string;
  rows: { key: string; label: string; applied: number; interviews: number }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b bg-muted/40">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Name</th>
            <th scope="col" className="px-3 py-2 font-medium">Applied</th>
            <th scope="col" className="px-3 py-2 font-medium">Interviews</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="px-3 py-2">
                {r.label}
                {isSmall(r.applied) ? <span className="ml-2 text-xs text-muted-foreground">small sample</span> : null}
              </td>
              <td className="px-3 py-2 tabular-nums">{r.applied}</td>
              <td className="px-3 py-2 tabular-nums">
                {r.interviews}
                <span className="text-muted-foreground"> ({Math.round((r.interviews / r.applied) * 100)}%)</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
