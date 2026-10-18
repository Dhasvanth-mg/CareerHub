"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbMessage, firstError, formToObject } from "@/lib/forms";
import { EXPIRY_DAYS, hashShareToken, newShareToken } from "@/lib/share";

export type ShareState = { error?: string; url?: string } | undefined;

const createSchema = z.object({
  label: z.string().trim().min(1, "Give the link a name, like the person it is for.").max(80),
  days: z.coerce.number().refine((n) => (EXPIRY_DAYS as readonly number[]).includes(n), "Choose how long the link should work."),
  include_interviews: z.string().optional(),
});

/** Makes a link. The secret is shown once, here, and never stored: only its hash is. */
export async function createShareLink(_prev: ShareState, formData: FormData): Promise<ShareState> {
  const parsed = createSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please log in again." };

  const token = newShareToken();
  const { error } = await supabase.from("share_links").insert({
    token_hash: hashShareToken(token),
    label: parsed.data.label,
    include_interviews: parsed.data.include_interviews === "on",
    expires_at: new Date(Date.now() + parsed.data.days * 86_400_000).toISOString(),
  });
  if (error) return { error: dbMessage(error, "Could not create the link. Please try again.") };

  await supabase.from("audit_events").insert({ action: "share_link_created" });
  revalidatePath("/settings");
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://careerhub-woad.vercel.app";
  return { url: `${origin.replace(/\/$/, "")}/share/${token}` };
}

export async function revokeShareLink(id: string) {
  const supabase = await createClient();
  await supabase.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("revoked_at", null);
  await supabase.from("audit_events").insert({ action: "share_link_revoked", subject_type: "share_link", subject_id: id });
  revalidatePath("/settings");
}

export async function deleteShareLink(id: string) {
  const supabase = await createClient();
  await supabase.from("share_links").delete().eq("id", id);
  revalidatePath("/settings");
}
