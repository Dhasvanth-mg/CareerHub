import type { SupabaseClient } from "@supabase/supabase-js";

export async function logEvent(
  supabase: SupabaseClient,
  applicationId: string,
  type: string,
  summary: string,
  extra: { from?: string | null; to?: string | null; data?: Record<string, unknown>; actor?: "user" | "ai_proposal" | "system" } = {},
) {
  // The timeline is best-effort: a failed log line must never fail the user's action.
  await supabase.from("application_events").insert({
    application_id: applicationId,
    type,
    summary,
    from_value: extra.from ?? null,
    to_value: extra.to ?? null,
    data: extra.data ?? null,
    actor: extra.actor ?? "user",
  });
}
