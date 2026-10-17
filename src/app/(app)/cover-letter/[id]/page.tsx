import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/app/local-time";
import { ResumeRevisionEditor } from "@/components/app/resume-revision-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ScoreLine = { key: string; label: string; weight: number; score: number; basis: string };
type Paragraph = { quote: string | null; issue: string; feedback: string; suggestion: string | null };
type Flagged = { claim: string; concern: string; resume_quote: string | null };

const ISSUE_LABEL: Record<string, string> = {
  none: "Working well",
  generic: "Too generic",
  unsupported_claim: "Needs support",
  off_topic: "Off topic",
  tone: "Tone",
  structure: "Structure",
};

export default async function CoverLetterResultPage({ params }: PageProps<"/cover-letter/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: run } = await supabase
    .from("analysis_runs")
    .select(
      "id, created_at, status, model, prompt_version, rubric_version, score, score_breakdown, summary, suggestions, error, application_id, job_posting_id, document_version_id, kind",
    )
    .eq("id", id)
    .eq("kind", "cover_letter")
    .maybeSingle();
  if (!run) notFound();

  const [postingRes, versionRes] = await Promise.all([
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
  const posting = postingRes.data as { title: string | null; company_name: string | null } | null;
  const version = versionRes.data as unknown as {
    version: number;
    extracted_text: string | null;
    document_id: string;
    documents: { title: string } | null;
  } | null;
  const breakdown = run.score_breakdown as { lines?: ScoreLine[]; note?: string } | null;
  const details = (run.suggestions ?? {}) as { paragraphs?: Paragraph[]; flagged?: Flagged[]; resume_version_id?: string | null };
  const paragraphs = details.paragraphs ?? [];
  const flagged = details.flagged ?? [];
  const jobLabel = [posting?.title, posting?.company_name].filter(Boolean).join(" at ") || "the job";

  const rerun = new URLSearchParams();
  if (run.document_version_id) rerun.set("letter", run.document_version_id);
  if (run.job_posting_id) rerun.set("job", run.job_posting_id);
  if (run.application_id) rerun.set("application", run.application_id);

  return (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-3">
        <Link href="/cover-letter" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Cover Letter Studio
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {version?.documents?.title ?? "Cover letter"} vs. {jobLabel}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <LocalTime iso={run.created_at} />
          {run.application_id ? (
            <Link href={`/applications/${run.application_id}`} className="underline underline-offset-4">
              View application
            </Link>
          ) : null}
          <Button nativeButton={false} size="sm" variant="outline" render={<Link href={`/cover-letter?${rerun.toString()}`} />}>
            Review again
          </Button>
        </div>
      </div>

      {run.status === "failed" ? (
        <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          This review didn&apos;t complete{run.error ? `: ${run.error}` : "."} Nothing was changed. Run it again.
        </p>
      ) : (
        <>
          <section aria-labelledby="summary" className="space-y-2">
            <h2 id="summary" className="text-lg font-medium">
              Summary
            </h2>
            <p className="text-sm">{run.summary}</p>
          </section>

          <section aria-labelledby="score" className="space-y-3">
            <h2 id="score" className="text-lg font-medium">
              Guidance score
            </h2>
            {run.score !== null && breakdown?.lines ? (
              <>
                <p className="text-sm">
                  <span className="text-3xl font-semibold tabular-nums">{run.score}</span>
                  <span className="text-muted-foreground"> / 100</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  A rubric to help you decide what to work on. It&apos;s not a hiring prediction or a measure of your worth. Rubric{" "}
                  {run.rubric_version}.
                </p>
                <div className="overflow-x-auto rounded-lg border">
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
              <p className="text-sm text-muted-foreground">{breakdown?.note ?? "No score for this review."}</p>
            )}
          </section>

          {flagged.length > 0 ? (
            <section aria-labelledby="flagged" className="space-y-3">
              <h2 id="flagged" className="text-lg font-medium">
                Statements to double-check
              </h2>
              <p className="text-sm text-muted-foreground">
                These claims aren&apos;t backed up by your resume, or they conflict with it. It doesn&apos;t mean they&apos;re false.
                Only keep what you can stand behind.
              </p>
              <ul className="space-y-3">
                {flagged.map((f, i) => (
                  <li key={i} className="space-y-2 rounded-lg border border-amber-300 p-3 text-sm">
                    <blockquote className="border-l-2 pl-3">&ldquo;{f.claim}&rdquo;</blockquote>
                    <p>{f.concern}</p>
                    {f.resume_quote ? (
                      <blockquote className="border-l-2 pl-3 text-muted-foreground">
                        Your resume says: &ldquo;{f.resume_quote}&rdquo;
                      </blockquote>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="paras" className="space-y-3">
            <h2 id="paras" className="text-lg font-medium">
              Paragraph by paragraph
            </h2>
            <ul className="space-y-3">
              {paragraphs.map((p, i) => (
                <li key={i} className="space-y-2 rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium">Paragraph {i + 1}</p>
                    <Badge variant="secondary">{ISSUE_LABEL[p.issue] ?? p.issue}</Badge>
                  </div>
                  {p.quote ? <blockquote className="border-l-2 pl-3 text-muted-foreground">&ldquo;{p.quote}&rdquo;…</blockquote> : null}
                  <p>{p.feedback}</p>
                  {p.suggestion ? (
                    <p className="rounded-md bg-muted/50 p-2">
                      <span className="font-medium">Try: </span>
                      {p.suggestion}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {version?.extracted_text ? (
            <section aria-labelledby="revise" className="space-y-3">
              <h2 id="revise" className="text-lg font-medium">
                Make your edits
              </h2>
              <p className="text-sm text-muted-foreground">
                Edit the letter and save it as a new version. The version reviewed here, version {version.version}, stays as it is.
              </p>
              <ResumeRevisionEditor
                kind="cover_letter"
                documentId={version.document_id}
                title={version.documents?.title ?? "Cover letter"}
                initial={version.extracted_text}
              />
            </section>
          ) : null}

          <section aria-labelledby="materials" className="space-y-1 text-sm text-muted-foreground">
            <h2 id="materials" className="text-sm font-medium text-foreground">
              Materials used
            </h2>
            <p>
              Letter: {version?.documents?.title ?? "deleted document"}, version {version?.version ?? "?"}. Job: {jobLabel}.
              {details.resume_version_id ? " Compared against a resume." : " Not compared against a resume."} Model {run.model}, prompt{" "}
              {run.prompt_version}.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
