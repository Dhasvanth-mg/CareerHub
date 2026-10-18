import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const hashId = (value: string) =>
  createHash("sha256")
    .update(`${process.env.RATE_LIMIT_SALT ?? "careerhub"}:${value.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);

/** The caller's address as seen by the platform proxy. Only ever stored hashed. */
export async function clientAddress(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

type Scope = "signup" | "login" | "reset" | "resend";

/**
 * Counts one attempt and says whether it is within the limit. Fails open: if the limiter itself is
 * unavailable, people can still sign in (the platform's own auth limits still apply).
 */
export async function withinLimit(
  supabase: SupabaseClient,
  scope: Scope,
  kind: "ip" | "email",
  id: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("rate_limit_hit", {
    p_key: `${scope}:${kind}:${hashId(id)}`,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error(JSON.stringify({ level: "warn", msg: "rate limit check failed", code: error.code }));
    return true;
  }
  return data === true;
}

export const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
