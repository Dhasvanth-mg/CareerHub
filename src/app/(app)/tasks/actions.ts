"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import { dbMessage, firstError, formToObject, optText, type ActionState } from "@/lib/forms";

const taskSchema = z.object({
  title: z.string().trim().min(1, "Give the task a title.").max(300),
  notes: optText(5000),
  // ISO-8601 instant computed in the browser from the user's local time.
  due_at: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().datetime({ offset: true, message: "Use a valid date and time." }).nullable())
    .default(null),
  application_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().uuid().nullable())
    .default(null),
});

function refresh(applicationId?: string | null) {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  if (applicationId) revalidatePath(`/applications/${applicationId}`);
}

export async function createTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = taskSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert(parsed.data);
  if (error) return { error: dbMessage(error, "Could not save the task. Check the linked application and try again.") };

  if (parsed.data.application_id) {
    await logEvent(supabase, parsed.data.application_id, "task_added", `Added task: ${parsed.data.title}`);
  }
  refresh(parsed.data.application_id);
  return undefined;
}

export async function setTaskDone(id: string, done: boolean) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .update({ completed_at: done ? new Date().toISOString() : null })
    .eq("id", id)
    .select("title, application_id")
    .single();
  if (data?.application_id && done) {
    await logEvent(supabase, data.application_id, "task_completed", `Completed task: ${data.title}`);
  }
  refresh(data?.application_id);
}

export async function snoozeTask(id: string, days: number) {
  const until = new Date(Date.now() + Math.min(Math.max(days, 1), 30) * 86_400_000).toISOString();
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .update({ snoozed_until: until })
    .eq("id", id)
    .select("application_id")
    .single();
  refresh(data?.application_id);
}

export async function deleteTask(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("tasks").delete().eq("id", id).select("application_id").single();
  refresh(data?.application_id);
}
