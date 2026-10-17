import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const HOURLY_LIMIT = 30;

/**
 * Per-user AI rate limit backed by audit_events, so it holds across serverless instances.
 * Returns false when the user is over their hourly allowance. Records the call otherwise.
 */
export async function consumeAiQuota(supabase: SupabaseClient, kind: string): Promise<boolean> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error } = await supabase
    .from("audit_events")
    .select("id", { count: "exact", head: true })
    .eq("action", "ai_call")
    .gte("created_at", since);
  if (error) return false; // fail closed: an unknown quota is treated as exhausted
  if ((count ?? 0) >= HOURLY_LIMIT) return false;
  await supabase.from("audit_events").insert({ action: "ai_call", subject_type: kind });
  return true;
}
