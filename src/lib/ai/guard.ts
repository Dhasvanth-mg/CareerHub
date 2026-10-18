import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AiCheck = { ok: true } | { ok: false; reason: "consent" | "user_limit" | "global_limit" | "error"; message: string };

const intEnv = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/** True when the signed-in user has accepted the AI notice. Fails closed. */
export async function hasAiConsent(supabase: SupabaseClient): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data } = await supabase.from("profiles").select("ai_notice_accepted_at").eq("id", auth.user.id).maybeSingle();
  return Boolean(data?.ai_notice_accepted_at);
}

/**
 * Every AI call goes through this. Consent first, then one atomic database call that enforces the
 * per-user hourly allowance and the app-wide daily cap, and records the use. Fails closed.
 */
export async function checkAiAllowed(supabase: SupabaseClient, kind: string): Promise<AiCheck> {
  if (!(await hasAiConsent(supabase))) {
    return { ok: false, reason: "consent", message: "Turn on AI features first. You can do that on this page or in Settings." };
  }
  const { data, error } = await supabase.rpc("consume_ai_quota", {
    p_kind: kind,
    p_user_hourly: intEnv("AI_USER_HOURLY_LIMIT", 30),
    p_global_daily: intEnv("AI_GLOBAL_DAILY_LIMIT", 3000),
  });
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "ai quota check failed", code: error.code }));
    return { ok: false, reason: "error", message: "AI features are unavailable right now. Please try again shortly." };
  }
  if (data === "ok") return { ok: true };
  if (data === "user_limit") {
    return { ok: false, reason: "user_limit", message: "You've reached the hourly AI limit. Please try again later." };
  }
  if (data === "global_limit") {
    return { ok: false, reason: "global_limit", message: "AI features are at capacity for today. Please try again tomorrow." };
  }
  return { ok: false, reason: "error", message: "AI features are unavailable right now. Please try again shortly." };
}
