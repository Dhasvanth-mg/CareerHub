import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceText } from "./grounding";
import type { RequirementInput } from "./resume-analysis";

/** The text of one resume version, if it has readable text. */
export async function resumeSource(supabase: SupabaseClient, versionId: string | null): Promise<SourceText | null> {
  if (!versionId) return null;
  const { data } = await supabase
    .from("document_versions")
    .select("extracted_text, extraction_state")
    .eq("id", versionId)
    .maybeSingle();
  return data?.extraction_state === "ok" && data.extracted_text ? { label: "Resume", text: data.extracted_text as string } : null;
}

/**
 * The resume to use for an application: the version recorded as submitted, otherwise the newest
 * resume that has readable text.
 */
export async function defaultResumeVersionId(supabase: SupabaseClient, applicationId: string): Promise<string | null> {
  const { data: app } = await supabase.from("applications").select("submitted_resume_version_id").eq("id", applicationId).maybeSingle();
  if (app?.submitted_resume_version_id) return app.submitted_resume_version_id as string;
  const { data } = await supabase
    .from("document_versions")
    .select("id, documents!inner(kind)")
    .eq("documents.kind", "resume")
    .eq("extraction_state", "ok")
    .order("created_at", { ascending: false })
    .limit(1);
  return (data?.[0]?.id as string | undefined) ?? null;
}

/** The user's evidence library as labelled text, so AI features can cite real, approved material. */
export async function evidenceSources(supabase: SupabaseClient): Promise<SourceText[]> {
  const { data } = await supabase
    .from("evidence_items")
    .select("kind, title, details, outcome, when_text")
    .order("updated_at", { ascending: false })
    .limit(60);
  return (data ?? []).map((e) => ({
    label: `Evidence: ${e.title}`,
    text: [e.title, e.when_text, e.details, e.outcome].filter(Boolean).join(". "),
  }));
}

/** Requirements saved for an application's job posting (empty if it has none). */
export async function requirementsForApplication(
  supabase: SupabaseClient,
  jobPostingId: string | null,
): Promise<RequirementInput[]> {
  if (!jobPostingId) return [];
  const { data } = await supabase
    .from("job_requirements")
    .select("id, text, kind")
    .eq("job_posting_id", jobPostingId)
    .order("position")
    .limit(60);
  return (data ?? []) as RequirementInput[];
}
