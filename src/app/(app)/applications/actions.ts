"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import { firstError, formToObject, optDate, optText, type ActionState } from "@/lib/forms";
import { PRIORITIES, STAGES, STAGE_LABEL, WORK_MODES, type Stage } from "@/lib/domain";

const applicationSchema = z.object({
  company_name: z.string().trim().min(1, "Company is required.").max(200),
  title: z.string().trim().min(1, "Role title is required.").max(200),
  stage: z.enum(STAGES).default("saved"),
  priority: z.enum(PRIORITIES).default("medium"),
  location: optText(200),
  work_mode: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.enum(WORK_MODES).nullable())
    .default(null),
  employment_type: optText(100),
  posting_url: optText(2000).refine((v) => v === null || /^https?:\/\//i.test(v), "Use a full http(s) link."),
  source: optText(200),
  salary_text: optText(200),
  applied_on: optDate,
  deadline: optDate,
  notes: optText(10000),
});

const today = () => new Date().toISOString().slice(0, 10);

export async function createApplication(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = applicationSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const values = parsed.data;
  if (values.stage === "applied" && !values.applied_on) values.applied_on = today();

  const supabase = await createClient();
  const { data, error } = await supabase.from("applications").insert(values).select("id").single();
  if (error || !data) return { error: "Could not save the application. Please try again." };

  await logEvent(supabase, data.id, "created", `Added ${values.title} at ${values.company_name}`, {
    to: values.stage,
  });
  revalidatePath("/applications");
  redirect(`/applications/${data.id}`);
}

export async function updateApplication(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = applicationSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const values = parsed.data;

  const supabase = await createClient();
  const { data: before } = await supabase.from("applications").select("stage").eq("id", id).single();
  if (!before) return { error: "Application not found." };
  if (values.stage === "applied" && !values.applied_on && before.stage !== "applied") values.applied_on = today();

  const { error } = await supabase.from("applications").update(values).eq("id", id);
  if (error) return { error: "Could not save changes. Please try again." };

  if (before.stage !== values.stage) {
    await logEvent(
      supabase,
      id,
      "stage_changed",
      `Moved from ${STAGE_LABEL[before.stage as Stage]} to ${STAGE_LABEL[values.stage]}`,
      { from: before.stage, to: values.stage },
    );
  } else {
    await logEvent(supabase, id, "updated", "Updated application details");
  }
  revalidatePath("/applications");
  revalidatePath(`/applications/${id}`);
  return undefined;
}

/** Used by the board (drag/drop + select) and the detail page stage control. */
export async function moveApplication(id: string, stage: string): Promise<ActionState> {
  const parsed = z.enum(STAGES).safeParse(stage);
  if (!parsed.success) return { error: "Unknown stage." };

  const supabase = await createClient();
  const { data: before } = await supabase.from("applications").select("stage, applied_on").eq("id", id).single();
  if (!before) return { error: "Application not found." };
  if (before.stage === parsed.data) return undefined;

  const patch: { stage: Stage; applied_on?: string } = { stage: parsed.data };
  if (parsed.data === "applied" && !before.applied_on) patch.applied_on = today();
  const { error } = await supabase.from("applications").update(patch).eq("id", id);
  if (error) return { error: "Could not move the application." };

  await logEvent(
    supabase,
    id,
    "stage_changed",
    `Moved from ${STAGE_LABEL[before.stage as Stage]} to ${STAGE_LABEL[parsed.data]}`,
    { from: before.stage, to: parsed.data },
  );
  revalidatePath("/applications");
  revalidatePath(`/applications/${id}`);
  revalidatePath("/dashboard");
  return undefined;
}

export async function setArchived(id: string, archived: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("applications")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (!error) await logEvent(supabase, id, archived ? "archived" : "restored", archived ? "Archived" : "Restored from archive");
  revalidatePath("/applications");
  revalidatePath(`/applications/${id}`);
}

export async function deleteApplication(id: string) {
  const supabase = await createClient();
  await supabase.from("applications").delete().eq("id", id);
  revalidatePath("/applications");
  redirect("/applications");
}
