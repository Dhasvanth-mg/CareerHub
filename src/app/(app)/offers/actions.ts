"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbMessage, firstError, formToObject, optDate, optText, type ActionState } from "@/lib/forms";
import { WORK_MODES } from "@/lib/domain";
import { ALL_CRITERIA, OFFER_CRITERIA, clampWeight } from "@/lib/offers";

const money = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v.replace(/,/g, ""))))
  .pipe(z.number().min(0, "Amounts can't be negative.").max(1_000_000_000, "That amount is too large.").nullable())
  .default(null);

const rating = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .pipe(z.number().int().min(1).max(5).nullable())
  .default(null);

const base = z.object({
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, like USD or CAD.")
    .default("USD"),
  base_amount: money,
  pay_period: z.enum(["year", "month", "hour"]).default("year"),
  bonus_amount: money,
  equity_text: optText(500),
  benefits_text: optText(2000),
  location: optText(200),
  work_mode: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.enum(WORK_MODES).nullable())
    .default(null),
  start_date: optDate,
  decision_deadline: optDate,
  notes: optText(5000),
  ...Object.fromEntries(OFFER_CRITERIA.map((c) => [`r_${c.key}`, rating])),
});

function ratingsFrom(values: Record<string, unknown>) {
  const out: Record<string, number> = {};
  for (const c of OFFER_CRITERIA) {
    const v = values[`r_${c.key}`];
    if (typeof v === "number") out[c.key] = v;
  }
  return out;
}

function toRow(values: Record<string, unknown>) {
  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) if (!k.startsWith("r_")) row[k] = v;
  row.ratings = ratingsFrom(values);
  return row;
}

export async function createOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = base.extend({ application_id: z.string().uuid("Choose an application.") }).safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("offers").insert(toRow(parsed.data));
  if (error) {
    return { error: error.code === "23505" ? "That application already has an offer saved." : dbMessage(error, "Couldn't save the offer. Please try again.") };
  }
  revalidatePath("/offers");
  return undefined;
}

export async function updateOffer(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Offer not found." };
  const parsed = base.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("offers").update(toRow(parsed.data)).eq("id", id);
  if (error) return { error: "Couldn't save changes. Please try again." };
  revalidatePath("/offers");
  return undefined;
}

export async function deleteOffer(id: string) {
  if (!z.string().uuid().safeParse(id).success) return;
  const supabase = await createClient();
  await supabase.from("offers").delete().eq("id", id);
  revalidatePath("/offers");
}

/** Weights are the user's own statement of what matters. Stored with the career profile. */
export async function saveOfferWeights(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const weights: Record<string, number> = {};
  for (const c of ALL_CRITERIA) weights[c.key] = clampWeight(formData.get(`w_${c.key}`));

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please log in again." };
  const { data: existing } = await supabase.from("career_profiles").select("weights").eq("user_id", auth.user.id).maybeSingle();
  const merged = { ...((existing?.weights as Record<string, unknown> | null) ?? {}), offers: weights };
  const { error } = await supabase.from("career_profiles").upsert({ user_id: auth.user.id, weights: merged }, { onConflict: "user_id" });
  if (error) return { error: "Couldn't save your weights. Please try again." };
  revalidatePath("/offers");
  return { message: "Weights saved." };
}
