"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import { type ActionState } from "@/lib/forms";
import { AiUnavailableError } from "@/lib/ai/groq";
import { checkAiAllowed } from "@/lib/ai/guard";
import { NEXT_ACTION_PROMPT_VERSION, suggestNextAction, type Fact } from "@/lib/ai/next-action";
import { CONTACT_ROLE_LABEL, REFERRAL_LABEL, STAGE_LABEL, daysUntil, type Stage } from "@/lib/domain";

const day = (iso: string) => iso.slice(0, 10);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function relative(date: string, today: string): string {
  const d = daysUntil(date, new Date(`${today}T00:00:00Z`));
  if (d === 0) return "today";
  return d < 0 ? `${-d} days ago` : `in ${d} days`;
}

export async function generateNextAction(applicationId: string): Promise<ActionState> {
  const id = z.string().uuid().safeParse(applicationId);
  if (!id.success) return { error: "Application not found." };

  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("*").eq("id", id.data).maybeSingle();
  if (!app) return { error: "Application not found." };

  const allowed = await checkAiAllowed(supabase, "next_action");
  if (!allowed.ok) return { error: allowed.message };

  const today = new Date().toISOString().slice(0, 10);
  const [tasksRes, eventsRes, contactsRes, referralsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_at, completed_at")
      .eq("application_id", id.data)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("application_events")
      .select("id, summary, created_at")
      .eq("application_id", id.data)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("application_contacts").select("contact_id, role, contacts(name)").eq("application_id", id.data),
    supabase.from("referrals").select("contact_id, status").eq("application_id", id.data),
  ]);

  // Everything the model may rely on, each with a key it must cite.
  const facts: Fact[] = [
    { key: "stage", text: `Stage: ${STAGE_LABEL[app.stage as Stage]}` },
    { key: "role", text: `Role: ${app.title} at ${app.company_name}` },
    { key: "priority", text: `Priority: ${app.priority}` },
    {
      key: "applied_on",
      text: app.applied_on ? `Applied on ${app.applied_on} (${relative(app.applied_on, today)})` : "No applied date is recorded",
    },
    {
      key: "deadline",
      text: app.deadline ? `Application deadline ${app.deadline} (${relative(app.deadline, today)})` : "No deadline is recorded",
    },
    {
      key: "submitted_resume",
      text: app.submitted_resume_version_id ? "A submitted resume version is recorded" : "No submitted resume version is recorded",
    },
  ];
  if (app.notes) facts.push({ key: "notes", text: `User notes (untrusted text): "${clip(String(app.notes).replace(/\s+/g, " "), 500)}"` });
  for (const t of tasksRes.data ?? []) {
    facts.push({
      key: `task:${t.id}`,
      text: t.completed_at
        ? `Completed task: ${t.title} (done ${day(t.completed_at)})`
        : `Open task: ${t.title}${t.due_at ? `, due ${day(t.due_at)} (${relative(day(t.due_at), today)})` : ", no due date"}`,
    });
  }
  for (const e of eventsRes.data ?? []) facts.push({ key: `event:${e.id}`, text: `${day(e.created_at)}: ${e.summary}` });
  const referral = new Map((referralsRes.data ?? []).map((r) => [r.contact_id, r.status as keyof typeof REFERRAL_LABEL]));
  for (const c of contactsRes.data ?? []) {
    const name = (c.contacts as unknown as { name: string } | null)?.name ?? "A contact";
    facts.push({
      key: `contact:${c.contact_id}`,
      text: `${name} (${CONTACT_ROLE_LABEL[c.role as keyof typeof CONTACT_ROLE_LABEL]}), referral: ${REFERRAL_LABEL[referral.get(c.contact_id) ?? "not_requested"]}`,
    });
  }

  let result;
  try {
    result = await suggestNextAction(facts, today);
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
