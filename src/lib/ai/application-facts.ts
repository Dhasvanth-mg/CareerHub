import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTACT_ROLE_LABEL, REFERRAL_LABEL, STAGE_LABEL, ROUND_TYPE_LABEL, daysUntil, type Stage, type RoundType } from "@/lib/domain";
import type { Fact } from "./next-action";

const day = (iso: string) => iso.slice(0, 10);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

function relative(date: string, today: string): string {
  const d = daysUntil(date, new Date(`${today}T00:00:00Z`));
  if (d === 0) return "today";
  return d < 0 ? `${-d} days ago` : `in ${d} days`;
}

export type ApplicationRecord = {
  id: string;
  title: string;
  company_name: string;
  stage: Stage;
  job_posting_id: string | null;
  [key: string]: unknown;
};

/**
 * Everything the model may rely on about one application, as keyed facts it must cite.
 * Free-text fields written by the user are marked untrusted so the model never follows them.
 */
export async function buildApplicationFacts(
  supabase: SupabaseClient,
  applicationId: string,
  today = new Date().toISOString().slice(0, 10),
): Promise<{ app: ApplicationRecord; facts: Fact[] } | null> {
  const { data: app } = await supabase.from("applications").select("*").eq("id", applicationId).maybeSingle();
  if (!app) return null;

  const [tasksRes, eventsRes, contactsRes, referralsRes, roundsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, due_at, completed_at")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("application_events")
      .select("id, summary, created_at")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase.from("application_contacts").select("contact_id, role, contacts(name)").eq("application_id", applicationId),
    supabase.from("referrals").select("contact_id, status").eq("application_id", applicationId),
    supabase
      .from("interview_rounds")
      .select("id, round_type, status, scheduled_at, debrief")
      .eq("application_id", applicationId)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(10),
  ]);

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
  if (app.location) facts.push({ key: "location", text: `Location: ${app.location}` });
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
  for (const r of roundsRes.data ?? []) {
    const when = r.scheduled_at ? ` on ${day(r.scheduled_at)} (${relative(day(r.scheduled_at), today)})` : "";
    const debrief = r.debrief ? ` Debrief (untrusted text): "${clip(String(r.debrief).replace(/\s+/g, " "), 300)}"` : "";
    facts.push({
      key: `interview:${r.id}`,
      text: `Interview (${ROUND_TYPE_LABEL[r.round_type as RoundType]}), ${r.status}${when}.${debrief}`,
    });
  }
  const referral = new Map((referralsRes.data ?? []).map((r) => [r.contact_id, r.status as keyof typeof REFERRAL_LABEL]));
  for (const c of contactsRes.data ?? []) {
    const name = (c.contacts as unknown as { name: string } | null)?.name ?? "A contact";
    facts.push({
      key: `contact:${c.contact_id}`,
      text: `${name} (${CONTACT_ROLE_LABEL[c.role as keyof typeof CONTACT_ROLE_LABEL]}), referral: ${REFERRAL_LABEL[referral.get(c.contact_id) ?? "not_requested"]}`,
    });
  }

  return { app: app as ApplicationRecord, facts };
}
