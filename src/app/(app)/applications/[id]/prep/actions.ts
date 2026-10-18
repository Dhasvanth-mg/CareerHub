"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { formToObject, firstError, type ActionState } from "@/lib/forms";
import { AiUnavailableError } from "@/lib/ai/groq";
import { checkAiAllowed } from "@/lib/ai/guard";
import { generatePrepQuestions, giveAnswerFeedback } from "@/lib/ai/interview-prep";
import { defaultResumeVersionId, evidenceSources, requirementsForApplication, resumeSource } from "@/lib/ai/sources";
import { ROUND_TYPE_LABEL, type RoundType } from "@/lib/domain";
import type { SourceText } from "@/lib/ai/grounding";

const uuid = z.string().uuid();
const optUuid = z
  .string()
  .transform((v) => (v === "" ? null : v))
  .pipe(uuid.nullable())
  .default(null);

const generateSchema = z.object({
  round_id: optUuid,
  resume_version_id: optUuid,
  use_evidence: z.string().optional(),
  focus: z.string().trim().max(400).default(""),
});

export async function generatePrep(applicationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const appId = uuid.safeParse(applicationId);
  const parsed = generateSchema.safeParse(formToObject(formData));
  if (!appId.success || !parsed.success) return { error: parsed.success ? "Application not found." : firstError(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: app } = await supabase
    .from("applications")
    .select("id, title, company_name, job_posting_id")
    .eq("id", appId.data)
    .maybeSingle();
  if (!app) return { error: "Application not found." };

  let roundLabel = "General interview";
  if (v.round_id) {
    const { data: round } = await supabase
      .from("interview_rounds")
      .select("round_type")
      .eq("id", v.round_id)
      .eq("application_id", appId.data)
      .maybeSingle();
    if (!round) return { error: "That interview wasn't found." };
    roundLabel = ROUND_TYPE_LABEL[round.round_type as RoundType];
  }

  const sources: SourceText[] = [];
  const resume = await resumeSource(supabase, v.resume_version_id);
  if (resume) sources.push(resume);
  if (v.use_evidence === "1") sources.push(...(await evidenceSources(supabase)));
  const requirements = await requirementsForApplication(supabase, app.job_posting_id);

  const allowed = await checkAiAllowed(supabase, "interview_prep");
  if (!allowed.ok) return { error: allowed.message };

  let result;
  try {
    result = await generatePrepQuestions({
      jobTitle: app.title,
      company: app.company_name,
      roundLabel,
      requirements,
      sources,
      focus: v.focus || null,
    });
  } catch (e) {
    return { error: e instanceof AiUnavailableError ? e.message : "The practice questions couldn't be generated." };
  }

  // Keep anything the user already answered; replace only the unanswered questions for this round.
  let del = supabase.from("interview_prep_items").delete().eq("application_id", appId.data).is("answer_draft", null);
  del = v.round_id ? del.eq("round_id", v.round_id) : del.is("round_id", null);
  await del;

  const { error } = await supabase.from("interview_prep_items").insert(
    result.questions.map((q) => ({
      application_id: appId.data,
      round_id: v.round_id,
      question: q.question,
      category: q.category,
      why: q.why,
      requirement_text: q.requirement_text,
      resume_evidence: q.resume_evidence,
      evidence_source: q.evidence_source,
      // Stored with the outline so it can be shown beside the question.
      feedback: { outline: q.answer_outline },
    })),
  );
  if (error) return { error: "The questions couldn't be saved. Please try again." };

  revalidatePath(`/applications/${appId.data}/prep`);
  return undefined;
}

export async function saveAnswer(itemId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(itemId);
  const text = String(formData.get("answer") ?? "").slice(0, 8000);
  if (!id.success) return { error: "Question not found." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interview_prep_items")
    .update({ answer_draft: text.trim() === "" ? null : text })
    .eq("id", id.data)
    .select("application_id")
    .single();
  if (error || !data) return { error: "Couldn't save your answer. Please try again." };
  revalidatePath(`/applications/${data.application_id}/prep`);
  return undefined;
}

export async function getFeedback(itemId: string): Promise<ActionState> {
  const id = uuid.safeParse(itemId);
  if (!id.success) return { error: "Question not found." };
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("interview_prep_items")
    .select("id, application_id, question, answer_draft, feedback")
    .eq("id", id.data)
    .maybeSingle();
  if (!item) return { error: "Question not found." };
  if (!item.answer_draft || item.answer_draft.trim().length < 30) {
    return { error: "Write and save your answer first. A few sentences is enough to get useful feedback." };
  }

  const allowed = await checkAiAllowed(supabase, "interview_feedback");
  if (!allowed.ok) return { error: allowed.message };

  // Claims are checked against everything the candidate has told us is true: the resume and the evidence library.
  const resume = await resumeSource(supabase, await defaultResumeVersionId(supabase, item.application_id));
  const evidence = await evidenceSources(supabase);
  const support = [
    resume ? resume.text : null,
    evidence.length ? `Evidence library items:\n${evidence.map((e) => e.text).join("\n")}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  let feedback;
  try {
    feedback = await giveAnswerFeedback({ question: item.question, answer: item.answer_draft, resumeText: support || null });
  } catch (e) {
    return { error: e instanceof AiUnavailableError ? e.message : "The feedback couldn't be generated." };
  }

  const previous = (item.feedback ?? {}) as { outline?: string };
  const { error } = await supabase
    .from("interview_prep_items")
    .update({ feedback: { outline: previous.outline, review: { ...feedback, answered_text: item.answer_draft } } })
    .eq("id", id.data);
  if (error) return { error: "The feedback couldn't be saved. Please try again." };
  revalidatePath(`/applications/${item.application_id}/prep`);
  return undefined;
}

export async function deletePrepItem(itemId: string) {
  const id = uuid.safeParse(itemId);
  if (!id.success) return;
  const supabase = await createClient();
  const { data } = await supabase.from("interview_prep_items").delete().eq("id", id.data).select("application_id").maybeSingle();
  if (data) revalidatePath(`/applications/${data.application_id}/prep`);
}
