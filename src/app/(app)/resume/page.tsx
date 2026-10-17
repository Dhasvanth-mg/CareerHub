import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/app/local-time";
import { ResumeAnalysisForm } from "@/components/app/resume-analysis-form";
import { AiGate } from "@/components/app/ai-gate";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Resume Studio | CareerHub AI" };
// The analysis runs inside a server action invoked from this page.
export const maxDuration = 60;

type VersionRow = {
  id: string;
  version: number;
  file_name: string;
  documents: { title: string; kind: string } | null;
};
type RunRow = {
  id: string;
  created_at: string;
  status: string;
  score: number | null;
  job_postings: { title: string | null; company_name: string | null } | null;
  document_versions: { version: number; documents: { title: string } | null } | null;
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ResumeStudioPage({ searchParams }: PageProps<"/resume">) {
  const sp = await searchParams;
  const applicationParam = one(sp.application);

  const supabase = await createClient();
  const [versionsRes, jobsRes, runsRes, appRes] = await Promise.all([
    supabase
      .from("document_versions")
      .select("id, version, file_name, documents!inner(title, kind)")
      .eq("documents.kind", "resume")
      .eq("extraction_state", "ok")
      .order("created_at", { ascending: false })
      .limit(100),
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
      .eq("kind", "resume")
      .order("created_at", { ascending: false })
      .limit(10),
    applicationParam && /^[0-9a-f-]{36}$/i.test(applicationParam)
      ? supabase.from("applications").select("id, job_posting_id").eq("id", applicationParam).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const versions = ((versionsRes.data ?? []) as unknown as VersionRow[]).map((v) => ({
    id: v.id,
    label: `${v.documents?.title ?? v.file_name}, version ${v.version}`,
  }));
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
        <h1 className="text-2xl font-semibold tracking-tight">Resume Studio</h1>
        <p className="text-sm text-muted-foreground">
          See which of a job&apos;s requirements your resume actually shows, with quotes from your own text. Suggestions only reword
          what&apos;s already there. You decide what to change.
        </p>
      </div>

      {versions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">Add a resume first</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload a PDF or paste your resume text in the Document Vault.</p>
          <Button className="mt-4" nativeButton={false} render={<Link href="/documents" />}>
            Go to Document Vault
          </Button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">Import a job to compare against</p>
          <p className="mt-1 text-sm text-muted-foreground">Job Capture saves the posting and its requirements.</p>
          <Button className="mt-4" nativeButton={false} render={<Link href="/jobs" />}>
            Go to Job Capture
          </Button>
        </div>
      ) : (
        <section aria-labelledby="run" className="space-y-3 rounded-lg border p-4">
          <h2 id="run" className="font-medium">
            New analysis
          </h2>
          <AiGate feature="Resume Studio">
            <ResumeAnalysisForm
              versions={versions}
              jobs={jobs}
              defaultVersion={one(sp.version)}
              defaultJob={one(sp.job) ?? app?.job_posting_id ?? undefined}
              applicationId={app?.id}
            />
          </AiGate>
        </section>
      )}

      {runs.length > 0 ? (
        <section aria-labelledby="past" className="space-y-3">
          <h2 id="past" className="text-lg font-medium">
            Recent analyses
          </h2>
          <ul className="divide-y rounded-lg border text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <Link href={`/resume/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                    {r.document_versions?.documents?.title ?? "Resume"} vs.{" "}
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
