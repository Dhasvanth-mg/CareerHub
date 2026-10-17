import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeAiQuota } from "./quota";

export type AiCheck = { ok: true } | { ok: false; reason: "consent" | "quota"; message: string };

/** True when the signed-in user has accepted the AI notice. Fails closed. */
export async function hasAiConsent(supabase: SupabaseClient): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data } = await supabase.from("profiles").select("ai_notice_accepted_at").eq("id", auth.user.id).maybeSingle();
  return Boolean(data?.ai_notice_accepted_at);
}

/** Every AI call goes through this: consent first, then the per-user hourly quota. */
export async function checkAiAllowed(supabase: SupabaseClient, kind: string): Promise<AiCheck> {
  if (!(await hasAiConsent(supabase))) {
    return { ok: false, reason: "consent", message: "Turn on AI features first. You can do that on this page or in Settings." };
  }
  if (!(await consumeAiQuota(supabase, kind))) {
    return { ok: false, reason: "quota", message: "You've reached the hourly AI limit. Please try again later." };
  }
  return { ok: true };
}
