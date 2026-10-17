"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import { firstError, formToObject, type ActionState } from "@/lib/forms";
import { AiUnavailableError } from "@/lib/ai/groq";
import { consumeAiQuota } from "@/lib/ai/quota";
import {
  RESUME_PROMPT_VERSION,
  RESUME_RUBRIC_VERSION,
  analyzeResume,
  type RequirementInput,
} from "@/lib/ai/resume-analysis";

const schema = z.object({
  document_version_id: z.string().uuid("Choose a resume."),
  job_posting_id: z.string().uuid("Choose a job."),
  application_id: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().uuid().nullable())
    .default(null),
  show_score: z.string().optional(),
});

export async function runResumeAnalysis(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = parsed.data;
  const wantScore = v.show_score === "1";

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please log in again." };

  const { data: version } = await supabase
    .from("document_versions")
    .select("id, extracted_text, extraction_state")
    .eq("id", v.document_version_id)
    .maybeSingle();
  if (!version) return { error: "That resume version wasn't found." };
  if (version.extraction_state !== "ok" || !version.extracted_text) {
    return { error: "That resume has no readable text yet. Open it in the Document Vault and paste the text in first." };
  }

  const { data: posting } = await supabase.from("job_postings").select("id").eq("id", v.job_posting_id).maybeSingle();
  if (!posting) return { error: "That job wasn't found." };
  const { data: reqRows } = await supabase
    .from("job_requirements")
    .select("id, text, kind")
    .eq("job_posting_id", v.job_posting_id)
    .order("position")
    .limit(60);
  const requirements = (reqRows ?? []) as RequirementInput[];
  if (requirements.length === 0) {
    return { error: "This job has no saved requirements. Import it with Job Capture so its requirements can be reviewed first." };
  }

  if (v.application_id) {
    const { data: app } = await supabase.from("applications").select("id").eq("id", v.application_id).maybeSingle();
    if (!app) return { error: "That application wasn't found." };
  }

  if (!(await consumeAiQuota(supabase, "resume_analysis"))) {
    return { error: "You've reached the hourly AI limit. Please try again later." };
  }

  const base = {
    kind: "resume" as const,
    application_id: v.application_id,
    job_posting_id: v.job_posting_id,
    document_version_id: v.document_version_id,
    prompt_version: RESUME_PROMPT_VERSION,
    rubric_version: RESUME_RUBRIC_VERSION,
  };

  let result;
  try {
    result = await analyzeResume({ resumeText: version.extracted_text, requirements, wantScore });
  } catch (e) {
    const message = e instanceof AiUnavailableError ? e.message : "The analysis couldn't be completed.";
    await supabase.from("analysis_runs").insert({ ...base, status: "failed", error: message });
    return { error: `${message} Nothing was changed. You can retry.` };
  }

  const { data: run, error } = await supabase
    .from("analysis_runs")
    .insert({
      ...base,
      status: "succeeded",
      model: result.model,
      score: result.score?.total ?? null,
      score_breakdown: result.score ? { lines: result.score.lines } : { note: result.scoreNote },
      summary: result.summary,
      suggestions: result.suggestions,
    })
    .select("id")
    .single();
  if (error || !run) return { error: "The analysis finished but couldn't be saved. Please try again." };

  const { error: findingsError } = await supabase.from("analysis_findings").insert(
    result.findings.map((f) => ({
      analysis_run_id: run.id,
      job_requirement_id: f.requirement_id,
      requirement: f.requirement,
      evidence: f.evidence,
      evidence_source: f.evidence_source,
      assessment: f.assessment,
      explanation: f.explanation,
    })),
  );
  if (findingsError) return { error: "The analysis finished but its findings couldn't be saved. Please try again." };

  if (v.application_id) {
    const musts = result.findings.filter((f) => f.kind === "must_have");
    const ok = musts.filter((f) => f.assessment === "supported").length;
    await logEvent(
      supabase,
      v.application_id,
      "resume_analyzed",
      musts.length
        ? `Resume analysis: ${ok} of ${musts.length} must-have requirements clearly evidenced`
        : "Resume analysis completed",
      { data: { analysis_run_id: run.id } },
    );
    revalidatePath(`/applications/${v.application_id}`);
  }
  revalidatePath("/resume");
  redirect(`/resume/${run.id}`);
}
