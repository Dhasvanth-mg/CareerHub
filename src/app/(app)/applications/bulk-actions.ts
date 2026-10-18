"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import type { ActionState } from "@/lib/forms";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/domain";

const MAX_BULK = 200;

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Select at least one application.").max(MAX_BULK, `Select up to ${MAX_BULK} at a time.`),
  op: z.enum(["move", "archive", "restore", "delete"]),
  stage: z.enum(STAGES).optional(),
});

/** Acts on several applications at once. Row level security still decides what the caller may touch. */
export async function bulkApplications(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse({
    ids: formData.getAll("ids").map(String),
    op: formData.get("op"),
    stage: formData.get("stage") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { ids, op, stage } = parsed.data;
  if (op === "move" && !stage) return { error: "Choose a stage to move them to." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("applications").select("id, stage, applied_on, title, company_name").in("id", ids);
  const rows = current ?? [];
  if (rows.length === 0) return { error: "Those applications couldn't be found." };
  const today = new Date().toISOString().slice(0, 10);

  if (op === "delete") {
    const { error } = await supabase.from("applications").delete().in("id", rows.map((r) => r.id));
    if (error) return { error: "Couldn't delete them. Please try again." };
  } else if (op === "archive" || op === "restore") {
    const { error } = await supabase
      .from("applications")
      .update({ archived_at: op === "archive" ? new Date().toISOString() : null })
      .in("id", rows.map((r) => r.id));
    if (error) return { error: "Couldn't update them. Please try again." };
    for (const r of rows) await logEvent(supabase, r.id, op === "archive" ? "archived" : "restored", op === "archive" ? "Archived" : "Restored from archive");
  } else if (stage) {
    const toMove = rows.filter((r) => r.stage !== stage);
    if (toMove.length) {
      const { error } = await supabase.from("applications").update({ stage }).in("id", toMove.map((r) => r.id));
      if (error) return { error: "Couldn't move them. Please try again." };
      if (stage === "applied") {
        const noDate = toMove.filter((r) => !r.applied_on).map((r) => r.id);
        if (noDate.length) await supabase.from("applications").update({ applied_on: today }).in("id", noDate);
      }
      for (const r of toMove) {
        await logEvent(supabase, r.id, "stage_changed", `Moved from ${STAGE_LABEL[r.stage as Stage]} to ${STAGE_LABEL[stage]}`, {
          from: r.stage,
          to: stage,
        });
      }
    }
  }

  revalidatePath("/applications");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
  const n = rows.length;
  const verb = op === "move" ? `moved to ${STAGE_LABEL[stage as Stage]}` : op === "archive" ? "archived" : op === "restore" ? "restored" : "deleted";
  return { message: `${n} application${n === 1 ? "" : "s"} ${verb}.` };
}
