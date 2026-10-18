"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbMessage, firstError, formToObject, optDate, optText, type ActionState } from "@/lib/forms";
import { RANK_CRITERIA } from "@/lib/planner";

const uuid = z.string().uuid();

const list = (maxItems: number, maxLen: number) =>
  z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.slice(0, maxLen)),
    )
    .pipe(z.array(z.string()).max(maxItems, `Please list at most ${maxItems}.`));

const profileSchema = z.object({
  target_roles: list(20, 80),
  target_industries: list(20, 80),
  target_locations: list(20, 80),
  min_salary: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v.replace(/,/g, ""))))
    .pipe(z.number().min(0).max(1_000_000_000).nullable())
    .default(null),
  salary_currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code.").default("USD"),
  constraints_note: optText(2000),
});

async function currentUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, userId: data.user?.id ?? null };
}

export async function saveProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = profileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { supabase, userId } = await currentUserId();
  if (!userId) return { error: "Please log in again." };
  const { error } = await supabase.from("career_profiles").upsert({ user_id: userId, ...parsed.data }, { onConflict: "user_id" });
  if (error) return { error: "Couldn't save your goals. Please try again." };
  revalidatePath("/planner");
  return { message: "Goals saved." };
}

export async function saveRankWeights(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const weights: Record<string, number> = {};
  for (const c of RANK_CRITERIA) {
    const v = Number(formData.get(`w_${c.key}`));
    weights[c.key] = Number.isFinite(v) ? Math.max(0, Math.min(10, Math.round(v))) : 5;
  }
  const { supabase, userId } = await currentUserId();
  if (!userId) return { error: "Please log in again." };
  const { data: existing } = await supabase.from("career_profiles").select("weights").eq("user_id", userId).maybeSingle();
  const merged = { ...((existing?.weights as Record<string, unknown> | null) ?? {}), ranking: weights };
  const { error } = await supabase.from("career_profiles").upsert({ user_id: userId, weights: merged }, { onConflict: "user_id" });
  if (error) return { error: "Couldn't save your weights. Please try again." };
  revalidatePath("/planner");
  return { message: "Weights saved." };
}

export async function saveRatings(applicationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!uuid.safeParse(applicationId).success) return { error: "Application not found." };
  const ratings: Record<string, number> = {};
  for (const c of RANK_CRITERIA) {
    const raw = String(formData.get(`r_${c.key}`) ?? "");
    if (raw === "") continue;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 5) return { error: "Ratings are 1 to 5." };
    ratings[c.key] = n;
  }
  const supabase = await createClient();
  const { error } = await supabase.from("applications").update({ ratings }).eq("id", applicationId);
  if (error) return { error: "Couldn't save the ratings. Please try again." };
  revalidatePath("/planner");
  return { message: "Saved." };
}

const milestoneSchema = z.object({
  title: z.string().trim().min(1, "Give the milestone a title.").max(200),
  skill: optText(100),
  due_on: optDate,
  notes: optText(2000),
});

export async function addMilestone(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = milestoneSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("milestones").insert(parsed.data);
  if (error) return { error: dbMessage(error, "Couldn't save the milestone. Please try again.") };
  revalidatePath("/planner");
  return undefined;
}

export async function addMilestoneFromGap(requirement: string) {
  const title = z.string().trim().min(1).max(160).safeParse(requirement);
  if (!title.success) return;
  const supabase = await createClient();
  await supabase.from("milestones").insert({ title: `Build evidence for: ${title.data}`, skill: title.data.slice(0, 100) });
  revalidatePath("/planner");
}

export async function toggleMilestone(id: string, done: boolean) {
  if (!uuid.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from("milestones").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id);
  revalidatePath("/planner");
}

export async function deleteMilestone(id: string) {
  if (!uuid.safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from("milestones").delete().eq("id", id);
  revalidatePath("/planner");
}
