"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbMessage, firstError, formToObject, optText, type ActionState } from "@/lib/forms";
import { EVIDENCE_KINDS } from "@/lib/domain";

const schema = z.object({
  kind: z.enum(EVIDENCE_KINDS).default("project"),
  title: z.string().trim().min(1, "Give it a short title.").max(200),
  when_text: optText(100),
  details: optText(4000),
  outcome: optText(1000),
  link: optText(2000).refine((v) => v === null || /^https?:\/\//i.test(v), "Use a full http(s) link."),
});

export async function createEvidence(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("evidence_items").insert(parsed.data);
  if (error) return { error: dbMessage(error, "Couldn't save that. Please try again.") };
  revalidatePath("/evidence");
  return undefined;
}

export async function updateEvidence(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Item not found." };
  const parsed = schema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("evidence_items").update(parsed.data).eq("id", id);
  if (error) return { error: "Couldn't save changes. Please try again." };
  revalidatePath("/evidence");
  return undefined;
}

export async function deleteEvidence(id: string) {
  if (!z.string().uuid().safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from("evidence_items").delete().eq("id", id);
  revalidatePath("/evidence");
}
