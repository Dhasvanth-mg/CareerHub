import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyDismissals, computeActions, type ActionInput, type Dismissal } from "@/lib/actions";

const ACTIVE = ["saved", "preparing", "applied", "assessment", "interview", "offer"];

/** Loads what the Action Center rules need, scoped to the signed-in user by row level security. */
export async function loadActionCenter(supabase: SupabaseClient, now = new Date()) {
  const since = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const [appsRes, tasksRes, eventsRes, roundsRes, prepRes, referralsRes, dismissalsRes] = await Promise.all([
    supabase
      .from("applications")
      .select("id, title, company_name, stage, applied_on, deadline, submitted_resume_version_id, created_at, updated_at")
      .is("archived_at", null)
      .in("stage", ACTIVE)
      .limit(1000),
    supabase
      .from("tasks")
      .select("id, title, due_at, completed_at, snoozed_until, application_id")
      .or(`completed_at.is.null,completed_at.gte.${since}`)
      .limit(1000),
    supabase
      .from("application_events")
      .select("application_id, type, summary, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("interview_rounds")
      .select("id, application_id, round_type, status, scheduled_at, prep_notes, debrief")
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", since)
      .limit(500),
    supabase.from("interview_prep_items").select("round_id").not("round_id", "is", null).limit(3000),
    supabase.from("referrals").select("application_id, status, updated_at, contacts(name)").eq("status", "requested").limit(500),
    supabase.from("action_dismissals").select("key, until").limit(5000),
  ]);

  const prepCounts = new Map<string, number>();
  for (const p of prepRes.data ?? []) prepCounts.set(p.round_id as string, (prepCounts.get(p.round_id as string) ?? 0) + 1);

  const input: ActionInput = {
    apps: appsRes.data ?? [],
    tasks: tasksRes.data ?? [],
    events: eventsRes.data ?? [],
    rounds: (roundsRes.data ?? []).map((r) => ({ ...r, prep_items: prepCounts.get(r.id) ?? 0 })),
    referrals: (referralsRes.data ?? []).map((r) => ({
      application_id: r.application_id,
      status: r.status,
      updated_at: r.updated_at,
      contact_name: (r.contacts as unknown as { name: string } | null)?.name ?? "your contact",
    })),
  };

  const error = Boolean(appsRes.error || tasksRes.error || roundsRes.error);
  const result = applyDismissals(computeActions(input, now), (dismissalsRes.data ?? []) as Dismissal[], now);
  return { ...result, error };
}
