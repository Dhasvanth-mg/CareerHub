"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { firstError, formToObject, type ActionState } from "@/lib/forms";

const profileSchema = z.object({
  display_name: z.string().trim().max(100).transform((v) => (v === "" ? null : v)),
});

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = profileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please log in again." };
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", auth.user.id);
  if (error) return { error: "Couldn't save your profile." };
  revalidatePath("/settings");
  return undefined;
}

export async function acceptAiNotice() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  await supabase.from("profiles").update({ ai_notice_accepted_at: new Date().toISOString() }).eq("id", auth.user.id);
  await supabase.from("audit_events").insert({ action: "ai_notice_accepted" });
  revalidatePath("/", "layout");
}

export async function revokeAiNotice() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  await supabase.from("profiles").update({ ai_notice_accepted_at: null }).eq("id", auth.user.id);
  await supabase.from("audit_events").insert({ action: "ai_notice_revoked" });
  revalidatePath("/", "layout");
}

/** Lists every file under the user's storage prefix, including files that were never finalized. */
async function listAllFiles(supabase: Awaited<ReturnType<typeof createClient>>, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 3) return [];
  const { data } = await supabase.storage.from("documents").list(prefix, { limit: 1000 });
  const out: string[] = [];
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`;
    // Folders come back without an id.
    if (entry.id) out.push(path);
    else out.push(...(await listAllFiles(supabase, path, depth + 1)));
  }
  return out;
}

export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (String(formData.get("confirm") ?? "").trim() !== "DELETE") {
    return { error: 'Type DELETE in capital letters to confirm.' };
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please log in again." };

  // 1. Files first: removing rows in SQL would leave the stored files behind.
  const files = await listAllFiles(supabase, auth.user.id);
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await supabase.storage.from("documents").remove(files.slice(i, i + 100));
    if (error) return { error: "We couldn't delete your files, so nothing was deleted. Please try again." };
  }

  // 2. Then the account. Foreign keys cascade to every table the user owns.
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: "We couldn't delete your account. Please try again." };

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}
