"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import { firstError, formToObject, optText, type ActionState } from "@/lib/forms";
import { ROUND_STATUSES, ROUND_TYPES, ROUND_TYPE_LABEL } from "@/lib/domain";

const roundSchema = z.object({
  round_type: z.enum(ROUND_TYPES).default("other"),
  status: z.enum(ROUND_STATUSES).default("scheduled"),
  // ISO-8601 instant computed in the browser from the user's local time.
  scheduled_at: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().datetime({ offset: true, message: "Use a valid date and time." }).nullable())
    .default(null),
  duration_minutes: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int().min(5, "Duration must be at least 5 minutes.").max(600, "Duration can't exceed 10 hours.").nullable())
    .default(null),
  location: optText(500),
  interviewers: optText(500),
  prep_notes: optText(10000),
  questions_asked: optText(10000),
  debrief: optText(10000),
});

function refresh(applicationId: string) {
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

export async function createRound(applicationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const appId = z.string().uuid().safeParse(applicationId);
  if (!appId.success) return { error: "Application not found." };
  const parsed = roundSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("interview_rounds").insert({ ...parsed.data, application_id: appId.data });
  if (error) return { error: "Couldn't save the interview. Please try again." };

  await logEvent(supabase, appId.data, "interview_added", `Added interview: ${ROUND_TYPE_LABEL[parsed.data.round_type]}`, {
    data: { scheduled_at: parsed.data.scheduled_at },
  });
  refresh(appId.data);
  return undefined;
}

export async function updateRound(roundId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = z.string().uuid().safeParse(roundId);
  if (!id.success) return { error: "Interview not found." };
  const parsed = roundSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data: before } = await supabase.from("interview_rounds").select("status, application_id").eq("id", id.data).maybeSingle();
  if (!before) return { error: "Interview not found." };
  const { error } = await supabase.from("interview_rounds").update(parsed.data).eq("id", id.data);
  if (error) return { error: "Couldn't save changes. Please try again." };

  if (before.status !== parsed.data.status) {
    await logEvent(
      supabase,
      before.application_id,
      "interview_status",
      `Interview (${ROUND_TYPE_LABEL[parsed.data.round_type]}) marked ${parsed.data.status}`,
    );
  }
  refresh(before.application_id);
  return undefined;
}

export async function deleteRound(roundId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("interview_rounds").delete().eq("id", roundId).select("application_id").maybeSingle();
  if (data) refresh(data.application_id);
}
