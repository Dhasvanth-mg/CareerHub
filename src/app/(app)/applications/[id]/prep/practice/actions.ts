"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

/** Saves one answer from a timed session as the question's answer draft. A blank answer never overwrites an existing draft. */
export async function savePracticeAnswer(itemId: string, answer: string): Promise<{ ok: boolean }> {
  const id = uuid.safeParse(itemId);
  const text = String(answer ?? "").slice(0, 8000);
  if (!id.success || text.trim() === "") return { ok: id.success };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interview_prep_items")
    .update({ answer_draft: text })
    .eq("id", id.data)
    .select("application_id")
    .single();
  if (error || !data) return { ok: false };
  revalidatePath(`/applications/${data.application_id}/prep`);
  return { ok: true };
}
