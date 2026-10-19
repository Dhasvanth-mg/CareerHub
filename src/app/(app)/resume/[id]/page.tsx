import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/app/local-time";
import { ResumeRevisionEditor } from "@/components/app/resume-revision-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ScoreLine = { key: string; label: string; weight: number; score: number; basis: string };
type Suggestion = { original: string | null; suggestion: string; rationale: string };
type Finding = {
  id: string;
  requirement: string;
  evidence: string | null;
  evidence_source: string | null;
  assessment: "supported" | "unclear" | "not_evidenced";
  explanation: string;
  job_requirements: { kind: string } | null;
};

const ASSESSMENT = {
  supported: { label: "Evidenced", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" },
  unclear: { label: "Unclear", className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  not_evidenced: { label: "Not evidenced", className: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200" },
} as const;

export const metadata = { title: "Resume analysis | CareerHub AI" };

export default async function AnalysisPage({ params }: PageProps<"/resume/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: run } = await supabase
    .from("analysis_runs")
    .select(
      "id, created_at, status, model, prompt_version, rubric_version, score, score_breakdown, summary, suggestions, error, application_id, job_posting_id, document_version_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!run) notFound();

  const [findingsRes, postingRes, versionRes] = await Promise.all([
    supabase
      .from("analysis_findings")
      .select("id, requirement, evidence, evidence_source, assessment, explanation, job_requirements(kind)")
      .eq("analysis_run_id", id),
    run.job_posting_id
      ? supabase.from("job_postings").select("title, company_name").eq("id", run.job_posting_id).maybeSingle()
      : Promise.resolve({ data: null }),
    run.document_version_id
      ? supabase
          .from("document_versions")
          .select("id, version, extracted_text, document_id, documents(title)")
          .eq("id", run.document_version_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const findings = ((findingsRes.data ?? []) as unknown as Finding[]).sort((a, b) => {
    const rank = (f: Finding) => (f.job_requirements?.kind === "must_have" ? 0 : 1);
    return rank(a) - rank(b);
  });
  const posting = postingRes.data as { title: string | null; company_name: string | null } | null;
  const version = versionRes.data as unknown as {
    id: string;
    version: number;
    extracted_text: string | null;
    document_id: string;
    documents: { title: string } | null;
  } | null;
  const breakdown = run.score_breakdown as { lines?: ScoreLine[]; note?: string } | null;
  const suggestions = (run.suggestions ?? []) as Suggestion[];
  const jobLabel = [posting?.title, posting?.company_name].filter(Boolean).join(" at ") || "the job";
  const counts = {
    supported: findings.filter((f) => f.assessment === "supported").length,
    unclear: findings.filter((f) => f.assessment === "unclear").length,
    not_evidenced: findings.filter((f) => f.assessment === "not_evidenced").length,
  };

  const rerun = new URLSearchParams();
  if (run.document_version_id) rerun.set("version", run.document_version_id);
  if (run.job_posting_id) rerun.set("job", run.job_posting_id);
  if (run.application_id) rerun.set("application", run.application_id);

  return (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-3">
        <Link href="/resume" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Resume Studio
        </Link>
        <h1 className="text-3xl sm:text-4xl">
          {version?.documents?.title ?? "Resume"} vs. {jobLabel}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <LocalTime iso={run.created_at} />
          {run.application_id ? (
            <Link href={`/applications/${run.application_id}`} className="underline underline-offset-4">
              View application
            </Link>
          ) : null}
          <Button nativeButton={false} size="sm" variant="outline" render={<Link href={`/resume?${rerun.toString()}`} />}>
            Run again
          </Button>
        </div>
      </div>

      {run.status === "failed" ? (
        <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          This analysis didn&apos;t complete{run.error ? `: ${run.error}` : "."} Nothing was changed. Run it again.
        </p>
      ) : (
        <>
          <section aria-labelledby="summary" className="space-y-3">
            <h2 id="summary" className="text-xl">
              Summary
            </h2>
            <p className="text-sm">{run.summary}</p>
            <p className="text-sm text-muted-foreground">
              {counts.supported} evidenced · {counts.unclear} unclear · {counts.not_evidenced} not evidenced
            </p>
          </section>

          <section aria-labelledby="score" className="space-y-3">
            <h2 id="score" className="text-xl">
              Guidance score
            </h2>
            {run.score !== null && breakdown?.lines ? (
              <>
                <p className="text-sm">
                  <span className="text-3xl font-semibold tabular-nums">{run.score}</span>
                  <span className="text-muted-foreground"> / 100</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  A rubric to help you decide what to work on. It is not an ATS score, a hiring prediction or a measure of your worth.
                  Rubric {run.rubric_version}.
                </p>
                <div className="overflow-x-auto rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06]">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Score breakdown</caption>
                    <thead className="border-b bg-muted/40">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-medium">Category</th>
                        <th scope="col" className="px-3 py-2 font-medium">Weight</th>
                        <th scope="col" className="px-3 py-2 font-medium">Score</th>
                        <th scope="col" className="px-3 py-2 font-medium">Why</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {breakdown.lines.map((l) => (
                        <tr key={l.key}>
                          <td className="px-3 py-2">{l.label}</td>
                          <td className="px-3 py-2 tabular-nums">{l.weight}%</td>
                          <td className="px-3 py-2 tabular-nums">{l.score}</td>
                          <td className="px-3 py-2 text-muted-foreground">{l.basis}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{breakdown?.note ?? "No score for this analysis."}</p>
            )}
          </section>

          <section aria-labelledby="findings" className="space-y-3">
            <h2 id="findings" className="text-xl">
              Requirement by requirement
            </h2>
            <ul className="space-y-3">
              {findings.map((f) => (
                <li key={f.id} className="space-y-2 rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium">
                      {f.requirement}
                      {f.job_requirements?.kind === "preferred" ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">Preferred</span>
                      ) : null}
                    </p>
                    <Badge variant="secondary" className={cn(ASSESSMENT[f.assessment].className)}>
                      {ASSESSMENT[f.assessment].label}
                    </Badge>
                  </div>
                  {f.evidence ? (
                    <blockquote className="border-l-2 pl-3 text-muted-foreground">
                      &ldquo;{f.evidence}&rdquo;
                      {f.evidence_source ? <span className="block text-xs">From: {f.evidence_source}</span> : null}
                    </blockquote>
                  ) : null}
                  <p>{f.explanation}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="suggestions" className="space-y-3">
            <h2 id="suggestions" className="text-xl">
              Suggested edits
            </h2>
            <p className="text-sm text-muted-foreground">
              These reword what&apos;s already in your resume. Only use a change if it&apos;s true. Replace any [placeholder] with your
              real details, or skip it.
            </p>
            {suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No edits suggested.</p>
            ) : (
              <ul className="space-y-3">
                {suggestions.map((s, i) => (
                  <li key={i} className="space-y-2 rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] p-3 text-sm">
                    {s.original ? (
                      <blockquote className="border-l-2 pl-3 text-muted-foreground line-through decoration-muted-foreground/50">
                        {s.original}
                      </blockquote>
                    ) : null}
                    <p className="font-medium">{s.suggestion}</p>
                    <p className="text-muted-foreground">{s.rationale}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {version?.extracted_text ? (
            <section aria-labelledby="revise" className="space-y-3">
              <h2 id="revise" className="text-xl">
                Make your edits
              </h2>
              <p className="text-sm text-muted-foreground">
                Edit the text below, then save it as a new version. The version analyzed here, version {version.version}, is kept as it
                is.
              </p>
              <ResumeRevisionEditor
                documentId={version.document_id}
                title={version.documents?.title ?? "Resume"}
                initial={version.extracted_text}
              />
            </section>
          ) : null}

          <section aria-labelledby="materials" className="space-y-2 text-sm text-muted-foreground">
            <h2 id="materials" className="text-sm font-medium text-foreground">
              Materials used
            </h2>
            <p>
              Resume: {version?.documents?.title ?? "deleted document"}, version {version?.version ?? "?"}. Job: {jobLabel}. Model{" "}
              {run.model}, prompt {run.prompt_version}.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
