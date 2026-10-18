"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";

const key = z.string().min(1).max(200);

function refresh() {
  revalidatePath("/action-center");
  revalidatePath("/dashboard");
  revalidatePath("/tasks");
}

/** Snooze for a number of days, or dismiss until the situation changes (days = null). */
export async function dismissAction(itemKey: string, days: number | null) {
  const k = key.safeParse(itemKey);
  if (!k.success) return;
  const until = days === null ? null : new Date(Date.now() + Math.min(Math.max(days, 1), 90) * 86_400_000).toISOString();
  const supabase = await createClient();
  await supabase.from("action_dismissals").upsert({ key: k.data, until }, { onConflict: "user_id,key" });
  refresh();
}

export async function restoreAction(itemKey: string) {
  const k = key.safeParse(itemKey);
  if (!k.success) return;
  const supabase = await createClient();
  await supabase.from("action_dismissals").delete().eq("key", k.data);
  refresh();
}

/** The user clicked "Add as a task": nothing is created until they do. */
export async function addTaskFromAction(itemKey: string, applicationId: string, title: string, dueDate: string | null) {
  const parsed = z
    .object({
      key,
      applicationId: z.string().uuid().or(z.literal("")),
      title: z.string().trim().min(1).max(300),
      dueDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
    })
    .safeParse({ key: itemKey, applicationId, title, dueDate });
  if (!parsed.success) return;
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    application_id: v.applicationId || null,
    title: v.title,
    notes: "Added from the Action Center",
    // Noon UTC keeps the calendar date right in every time zone from UTC-11 to UTC+11.
    due_at: v.dueDate ? `${v.dueDate}T12:00:00Z` : null,
  });
  if (error) return;
  if (v.applicationId) await logEvent(supabase, v.applicationId, "task_added", `Added task from a suggestion: ${v.title}`);
  // Don't show the same suggestion again for two weeks now that it has become a task.
  await supabase
    .from("action_dismissals")
    .upsert({ key: v.key, until: new Date(Date.now() + 14 * 86_400_000).toISOString() }, { onConflict: "user_id,key" });
  refresh();
  if (v.applicationId) revalidatePath(`/applications/${v.applicationId}`);
}
