import Link from "next/link";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AddMilestoneForm, ProfileForm, RankWeightsForm, RatingsForm, type Profile } from "@/components/app/planner-ui";
import { DeadlineBadge } from "@/components/app/stage-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { STAGE_LABEL, type Stage } from "@/lib/domain";
import { rankOpportunities, suggestedFit, summarizeGaps, type RankWeights } from "@/lib/planner";
import { addMilestoneFromGap, deleteMilestone, toggleMilestone } from "./actions";

export const metadata = { title: "Career planner | CareerHub AI" };

const OPEN_STAGES = ["saved", "preparing", "applied", "assessment", "interview", "offer"];

type AppRow = {
  id: string;
  title: string;
  company_name: string;
  stage: Stage;
  deadline: string | null;
  ratings: Partial<Record<string, number>> | null;
};

export default async function PlannerPage() {
  const supabase = await createClient();
  const [profileRes, appsRes, runsRes, findingsRes, milestonesRes] = await Promise.all([
    supabase.from("career_profiles").select("*").maybeSingle(),
    supabase
      .from("applications")
      .select("id, title, company_name, stage, deadline, ratings")
      .is("archived_at", null)
      .in("stage", OPEN_STAGES)
      .order("updated_at", { ascending: false })
      .limit(300),
    supabase
      .from("analysis_runs")
      .select("id, application_id, score, created_at")
      .eq("kind", "resume")
      .eq("status", "succeeded")
      .not("application_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("analysis_findings")
      .select("requirement, analysis_run_id")
      .eq("assessment", "not_evidenced")
      .limit(1000),
    supabase.from("milestones").select("id, title, skill, due_on, done_at").order("created_at", { ascending: false }).limit(200),
  ]);

  const p = profileRes.data as
    | (Profile & { weights: { ranking?: RankWeights } | null })
    | null;
  const profile: Profile = {
    target_roles: p?.target_roles ?? [],
    target_industries: p?.target_industries ?? [],
    target_locations: p?.target_locations ?? [],
    min_salary: p?.min_salary === null || p?.min_salary === undefined ? null : Number(p.min_salary),
    salary_currency: p?.salary_currency ?? "USD",
    constraints_note: p?.constraints_note ?? null,
  };
  const weights = p?.weights?.ranking ?? {};

  const apps = (appsRes.data ?? []) as AppRow[];
  const appById = new Map(apps.map((a) => [a.id, a]));

  // Latest resume analysis per application: used for the fit suggestion and for skill gaps.
  const latestRun = new Map<string, { id: string; score: number | null }>();
  for (const r of runsRes.data ?? []) if (!latestRun.has(r.application_id as string)) latestRun.set(r.application_id as string, { id: r.id, score: r.score });
  const runToApp = new Map([...latestRun.entries()].map(([appId, r]) => [r.id, appId]));
  const gaps = summarizeGaps(
    (findingsRes.data ?? []).flatMap((f) => {
      const appId = runToApp.get(f.analysis_run_id as string);
      return appId && appById.has(appId) ? [{ requirement: f.requirement as string, application_id: appId }] : [];
    }),
  );

  const ranked = rankOpportunities(
    apps.map((a) => ({ id: a.id, label: `${a.title} at ${a.company_name}`, ratings: a.ratings ?? {} })),
    weights,
  );
  const milestones = milestonesRes.data ?? [];

  return (
    <div className="max-w-4xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Career planner</h1>
        <p className="text-sm text-muted-foreground">
          Decide what you&apos;re aiming for, rank your opportunities by what matters to you, and plan how to close real gaps. The ranking
          only uses your own ratings and weights, shows why each one landed where it did, and never hides an opportunity.
        </p>
      </div>

      <section aria-labelledby="goals" className="space-y-3">
        <h2 id="goals" className="text-lg font-medium">
          Your goals
        </h2>
        <ProfileForm profile={profile} />
      </section>

      <section aria-labelledby="rank" className="space-y-4">
        <h2 id="rank" className="text-lg font-medium">
          Which opportunities fit best
        </h2>
        <RankWeightsForm weights={weights} />
        {ranked.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No open applications to rank yet. Add some and rate them here.
          </p>
        ) : (
          <ol className="space-y-3">
            {ranked.map((r, i) => {
              const a = appById.get(r.id) as AppRow;
              const fit = suggestedFit(latestRun.get(r.id)?.score);
              return (
                <li key={r.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {r.score !== null ? <span className="mr-2 text-muted-foreground tabular-nums">#{i + 1}</span> : null}
                        <Link href={`/applications/${r.id}`} className="underline-offset-4 hover:underline">
                          {r.label}
                        </Link>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">{STAGE_LABEL[a.stage]}</Badge>
                        {a.deadline && (a.stage === "saved" || a.stage === "preparing") ? <DeadlineBadge date={a.deadline} /> : null}
                      </p>
                    </div>
                    <p className="text-right">
                      {r.score === null ? (
                        <span className="text-sm text-muted-foreground">Not rated</span>
                      ) : (
                        <>
                          <span className="text-2xl font-semibold tabular-nums">{r.score}</span>
                          <span className="text-muted-foreground"> / 100</span>
                        </>
                      )}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.why}</p>
                  <RatingsForm applicationId={r.id} ratings={a.ratings ?? {}} suggestedFit={fit} />
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="gaps" className="space-y-3">
        <h2 id="gaps" className="text-lg font-medium">
          Gaps worth closing
        </h2>
        <p className="text-sm text-muted-foreground">
          Requirements your latest resume analyses found no evidence for. If you really do have the experience, add it to your evidence
          library instead. If you don&apos;t, these are honest places to build it.
        </p>
        {gaps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing to show yet. Run a resume analysis from an application and the unmet requirements will appear here.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {gaps.map((g) => (
              <li key={g.requirement} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>
                  {g.requirement}
                  <span className="ml-2 text-xs text-muted-foreground">
                    in {g.applications} application{g.applications === 1 ? "" : "s"}
                  </span>
                </span>
                <form action={addMilestoneFromGap.bind(null, g.requirement)}>
                  <Button type="submit" variant="outline" size="sm">
                    Add as milestone
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="milestones" className="space-y-3">
        <h2 id="milestones" className="text-lg font-medium">
          Milestones
        </h2>
        {milestones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No milestones yet. Add steps like a course, a project or a certification.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {milestones.map((m) => {
              const done = Boolean(m.done_at);
              return (
                <li key={m.id} className="flex items-start gap-3 p-3 text-sm">
                  <form action={toggleMilestone.bind(null, m.id, !done)} className="pt-0.5">
                    <button
                      type="submit"
                      role="checkbox"
                      aria-checked={done}
                      aria-label={done ? `Mark "${m.title}" not done` : `Mark "${m.title}" done`}
                      className="flex size-5 items-center justify-center rounded border border-input text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {done ? "✓" : ""}
                    </button>
                  </form>
                  <div className="min-w-0 flex-1">
                    <p className={done ? "text-muted-foreground line-through" : "font-medium"}>{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {[m.skill, m.due_on ? `Target ${m.due_on}` : null].filter(Boolean).join(" · ") || "No target date"}
                    </p>
                  </div>
                  <form action={deleteMilestone.bind(null, m.id)}>
                    <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Delete milestone "${m.title}"`}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <div className="rounded-lg border p-4">
          <AddMilestoneForm />
        </div>
      </section>
    </div>
  );
}
