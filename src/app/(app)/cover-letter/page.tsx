import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AiGate } from "@/components/app/ai-gate";
import { CoverLetterAnalysisForm, CoverLetterDraftForm } from "@/components/app/cover-letter-forms";
import { LocalTime } from "@/components/app/local-time";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Cover Letter Studio | CareerHub AI" };
export const maxDuration = 60;

type VersionRow = { id: string; version: number; file_name: string; documents: { title: string } | null };
type RunRow = {
  id: string;
  created_at: string;
  status: string;
  score: number | null;
  job_postings: { title: string | null; company_name: string | null } | null;
  document_versions: { version: number; documents: { title: string } | null } | null;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function versionsOfKind(supabase: Awaited<ReturnType<typeof createClient>>, kind: "resume" | "cover_letter") {
  const { data } = await supabase
    .from("document_versions")
    .select("id, version, file_name, documents!inner(title, kind)")
    .eq("documents.kind", kind)
    .eq("extraction_state", "ok")
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as unknown as VersionRow[]).map((v) => ({
    id: v.id,
    label: `${v.documents?.title ?? v.file_name}, version ${v.version}`,
  }));
}

export default async function CoverLetterStudioPage({ searchParams }: PageProps<"/cover-letter">) {
  const sp = await searchParams;
  const applicationParam = one(sp.application);

  const supabase = await createClient();
  const [letters, resumes, jobsRes, runsRes, appRes, evidenceRes] = await Promise.all([
    versionsOfKind(supabase, "cover_letter"),
    versionsOfKind(supabase, "resume"),
    // Only postings that belong to an application, so abandoned imports never clutter the picker.
    supabase
      .from("applications")
      .select("job_posting_id, title, company_name")
      .not("job_posting_id", "is", null)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("analysis_runs")
      .select("id, created_at, status, score, job_postings(title, company_name), document_versions(version, documents(title))")
      .eq("kind", "cover_letter")
      .order("created_at", { ascending: false })
      .limit(10),
    applicationParam && /^[0-9a-f-]{36}$/i.test(applicationParam)
      ? supabase.from("applications").select("id, job_posting_id").eq("id", applicationParam).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("evidence_items").select("id", { count: "exact", head: true }),
  ]);
  const evidenceCount = evidenceRes.count ?? 0;

  const seen = new Set<string>();
  const jobs = (jobsRes.data ?? []).flatMap((a) => {
    const id = a.job_posting_id as string;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ id, label: [a.title, a.company_name].filter(Boolean).join(" at ") || "Untitled posting" }];
  });
  const runs = (runsRes.data ?? []) as unknown as RunRow[];
  const app = appRes.data as { id: string; job_posting_id: string | null } | null;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cover Letter Studio</h1>
        <p className="text-sm text-muted-foreground">
          Get paragraph-by-paragraph feedback on a letter for a specific job, or start from a draft built only from your resume. You
          edit and approve everything. Nothing is sent anywhere.
        </p>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">Import a job first</p>
          <p className="mt-1 text-sm text-muted-foreground">Letters are reviewed against a job&apos;s requirements.</p>
          <Button className="mt-4" nativeButton={false} render={<Link href="/jobs" />}>
            Go to Job Capture
          </Button>
        </div>
      ) : (
        <AiGate feature="Cover Letter Studio">
          <div className="space-y-8">
            <section aria-labelledby="review" className="space-y-3 rounded-lg border p-4">
              <h2 id="review" className="font-medium">
                Review a cover letter
              </h2>
              {letters.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  You haven&apos;t added a cover letter yet.{" "}
                  <Link href="/documents" className="underline underline-offset-4">
                    Upload or paste one in the Document Vault
                  </Link>{" "}
                  (choose the type &ldquo;Cover letter&rdquo;), or draft one below.
                </p>
              ) : (
                <CoverLetterAnalysisForm
                  letters={letters}
                  resumes={resumes}
                  jobs={jobs}
                  defaultLetter={one(sp.letter)}
                  defaultJob={one(sp.job) ?? app?.job_posting_id ?? undefined}
                  applicationId={app?.id}
                  evidenceCount={evidenceCount}
                />
              )}
            </section>

            <section aria-labelledby="draft" className="space-y-3 rounded-lg border p-4">
              <h2 id="draft" className="font-medium">
                Draft a first version
              </h2>
              {resumes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add a resume to the{" "}
                  <Link href="/documents" className="underline underline-offset-4">
                    Document Vault
                  </Link>{" "}
                  first. The draft is built only from what it says.
                </p>
              ) : (
                <CoverLetterDraftForm resumes={resumes} jobs={jobs} defaultJob={one(sp.job) ?? app?.job_posting_id ?? undefined} evidenceCount={evidenceCount} />
              )}
            </section>
          </div>
        </AiGate>
      )}

      {runs.length > 0 ? (
        <section aria-labelledby="past" className="space-y-3">
          <h2 id="past" className="text-lg font-medium">
            Recent reviews
          </h2>
          <ul className="divide-y rounded-lg border text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <Link href={`/cover-letter/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                    {r.document_versions?.documents?.title ?? "Cover letter"} vs.{" "}
                    {[r.job_postings?.title, r.job_postings?.company_name].filter(Boolean).join(" at ") || "a job"}
                  </Link>
                  <p className="text-muted-foreground">
                    <LocalTime iso={r.created_at} />
                    {r.status === "failed" ? " · Failed" : ""}
                  </p>
                </div>
                {r.score !== null ? <span className="tabular-nums text-muted-foreground">Guidance score {r.score}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
