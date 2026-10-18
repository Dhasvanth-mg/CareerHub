"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import { firstError, formToObject, type ActionState } from "@/lib/forms";
import { AiUnavailableError } from "@/lib/ai/groq";
import { checkAiAllowed } from "@/lib/ai/guard";
import { evidenceSources } from "@/lib/ai/sources";
import {
  COVER_PROMPT_VERSION,
  COVER_RUBRIC_VERSION,
  analyzeCoverLetter,
  draftCoverLetter,
} from "@/lib/ai/cover-letter";
import type { RequirementInput } from "@/lib/ai/resume-analysis";

const uuid = z.string().uuid();
const optUuid = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .pipe(uuid.nullable())
  .default(null);

async function loadJob(supabase: Awaited<ReturnType<typeof createClient>>, jobId: string) {
  const { data: posting } = await supabase
    .from("job_postings")
    .select("id, title, company_name")
    .eq("id", jobId)
    .maybeSingle();
  if (!posting) return { error: "That job wasn't found." } as const;
  const { data: reqRows } = await supabase
    .from("job_requirements")
    .select("id, text, kind")
    .eq("job_posting_id", jobId)
    .order("position")
    .limit(60);
  const requirements = (reqRows ?? []) as RequirementInput[];
  if (requirements.length === 0) {
    return { error: "This job has no saved requirements. Import it with Job Capture first." } as const;
  }
  return { posting, requirements } as const;
}

async function versionText(supabase: Awaited<ReturnType<typeof createClient>>, id: string | null) {
  if (!id) return null;
  const { data } = await supabase
    .from("document_versions")
    .select("extracted_text, extraction_state")
    .eq("id", id)
    .maybeSingle();
  return data && data.extraction_state === "ok" ? (data.extracted_text as string | null) : null;
}

const analyzeSchema = z.object({
  letter_version_id: uuid,
  job_posting_id: uuid,
  resume_version_id: optUuid,
  application_id: optUuid,
  show_score: z.string().optional(),
  use_evidence: z.string().optional(),
});

export async function runCoverLetterAnalysis(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = analyzeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: "Choose a cover letter and a job." };
  const v = parsed.data;

  const supabase = await createClient();
  const letter = await versionText(supabase, v.letter_version_id);
  if (!letter) return { error: "That cover letter has no readable text. Open it in the Document Vault and paste the text in." };
  const resume = await versionText(supabase, v.resume_version_id);

  const job = await loadJob(supabase, v.job_posting_id);
  if ("error" in job) return { error: job.error };

  if (v.application_id) {
    const { data: app } = await supabase.from("applications").select("id").eq("id", v.application_id).maybeSingle();
    if (!app) return { error: "That application wasn't found." };
  }

  const allowed = await checkAiAllowed(supabase, "cover_letter_analysis");
  if (!allowed.ok) return { error: allowed.message };

  const base = {
    kind: "cover_letter" as const,
    application_id: v.application_id,
    job_posting_id: v.job_posting_id,
    document_version_id: v.letter_version_id,
    prompt_version: COVER_PROMPT_VERSION,
    rubric_version: COVER_RUBRIC_VERSION,
  };

  let result;
  try {
    result = await analyzeCoverLetter({
      letter,
      resume,
      jobTitle: [job.posting.title, job.posting.company_name].filter(Boolean).join(" at ") || "the role",
      requirements: job.requirements,
      wantScore: v.show_score === "1",
      extraSources: v.use_evidence === "1" ? await evidenceSources(supabase) : [],
    });
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
      suggestions: { paragraphs: result.paragraphs, flagged: result.flagged, resume_version_id: v.resume_version_id },
    })
    .select("id")
    .single();
  if (error || !run) return { error: "The analysis finished but couldn't be saved. Please try again." };

  if (v.application_id) {
    await logEvent(supabase, v.application_id, "cover_letter_analyzed", "Cover letter reviewed", {
      data: { analysis_run_id: run.id },
    });
    revalidatePath(`/applications/${v.application_id}`);
  }
  revalidatePath("/cover-letter");
  redirect(`/cover-letter/${run.id}`);
}

export type DraftState = { error?: string; letter?: string; toVerify?: string[]; jobLabel?: string } | undefined;

const draftSchemaIn = z.object({
  resume_version_id: uuid,
  job_posting_id: uuid,
  notes: z.string().trim().max(600).default(""),
  use_evidence: z.string().optional(),
});

export async function generateCoverLetterDraft(_prev: DraftState, formData: FormData): Promise<DraftState> {
  const parsed = draftSchemaIn.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const resume = await versionText(supabase, v.resume_version_id);
  if (!resume) return { error: "That resume has no readable text. Open it in the Document Vault and paste the text in." };
  const job = await loadJob(supabase, v.job_posting_id);
  if ("error" in job) return { error: job.error };

  const allowed = await checkAiAllowed(supabase, "cover_letter_draft");
  if (!allowed.ok) return { error: allowed.message };

  try {
    const draft = await draftCoverLetter({
      resume,
      jobTitle: job.posting.title ?? "the role",
      company: job.posting.company_name,
      requirements: job.requirements,
      notes: v.notes || null,
      extraSources: v.use_evidence === "1" ? await evidenceSources(supabase) : [],
    });
    return {
      letter: draft.letter,
      toVerify: draft.toVerify,
      jobLabel: [job.posting.title, job.posting.company_name].filter(Boolean).join(" at "),
    };
  } catch (e) {
    return { error: e instanceof AiUnavailableError ? e.message : "The draft couldn't be generated." };
  }
}
