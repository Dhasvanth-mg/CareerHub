"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import { type ActionState } from "@/lib/forms";
import { buildApplicationFacts } from "@/lib/ai/application-facts";
import { AiUnavailableError } from "@/lib/ai/groq";
import { checkAiAllowed } from "@/lib/ai/guard";
import { NEXT_ACTION_PROMPT_VERSION, suggestNextAction } from "@/lib/ai/next-action";

export async function generateNextAction(applicationId: string): Promise<ActionState> {
  const id = z.string().uuid().safeParse(applicationId);
  if (!id.success) return { error: "Application not found." };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const record = await buildApplicationFacts(supabase, id.data, today);
  if (!record) return { error: "Application not found." };

  const allowed = await checkAiAllowed(supabase, "next_action");
  if (!allowed.ok) return { error: allowed.message };

  let result;
  try {
    result = await suggestNextAction(record.facts, today);
  } catch (e) {
    return { error: e instanceof AiUnavailableError ? e.message : "The suggestion couldn't be generated." };
  }

  // Only one open suggestion per application; decided ones stay as history.
  await supabase.from("ai_proposals").delete().eq("application_id", id.data).eq("status", "pending").eq("kind", "next_action");
  const { error } = await supabase.from("ai_proposals").insert({
    application_id: id.data,
    kind: "next_action",
    payload: {
      action: result.action,
      confidence: result.confidence,
      uncertainty: result.uncertainty,
      task_title: result.task_title,
      task_due_date: result.task_due_date,
      prompt_version: NEXT_ACTION_PROMPT_VERSION,
    },
    rationale: result.why,
    sources: result.sources,
    model: result.model,
  });
  if (error) return { error: "The suggestion couldn't be saved. Please try again." };

  revalidatePath(`/applications/${id.data}`);
  return undefined;
}

/** Approve turns the suggestion into a real task; reject just records the decision. */
export async function decideProposal(proposalId: string, approve: boolean) {
  const id = z.string().uuid().safeParse(proposalId);
  if (!id.success) return;
  const supabase = await createClient();
  const { data: proposal } = await supabase.from("ai_proposals").select("*").eq("id", id.data).maybeSingle();
  if (!proposal || proposal.status !== "pending") return;

  const payload = proposal.payload as { action: string; task_title: string | null; task_due_date: string | null };
  if (approve && proposal.application_id) {
    if (payload.task_title) {
      await supabase.from("tasks").insert({
        application_id: proposal.application_id,
        title: payload.task_title,
        notes: `From an AI suggestion you approved: ${payload.action}`,
        // Noon UTC keeps the calendar date right in every time zone from UTC-11 to UTC+11.
        due_at: payload.task_due_date ? `${payload.task_due_date}T12:00:00Z` : null,
      });
    }
    await logEvent(
      supabase,
      proposal.application_id,
      "ai_suggestion_accepted",
      payload.task_title ? `Accepted AI suggestion and added task: ${payload.task_title}` : `Accepted AI suggestion: ${payload.action}`,
      { actor: "ai_proposal", data: { proposal_id: proposal.id } },
    );
  }

  await supabase
    .from("ai_proposals")
    .update({ status: approve ? "approved" : "rejected", decided_at: new Date().toISOString() })
    .eq("id", id.data);
  await supabase.from("audit_events").insert({
    action: approve ? "ai_proposal_approved" : "ai_proposal_rejected",
    subject_type: "ai_proposal",
    subject_id: proposal.id,
  });

  if (proposal.application_id) revalidatePath(`/applications/${proposal.application_id}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}
