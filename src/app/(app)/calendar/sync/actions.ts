"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbMessage, firstError, type ActionState } from "@/lib/forms";
import { MAX_IMPORT_EVENTS } from "@/lib/ics";

const eventSchema = z.object({
  uid: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(300),
  start: z.string().datetime({ offset: true, message: "An event has an invalid date." }),
  allDay: z.boolean(),
  end: z.string().datetime({ offset: true }).nullable().optional(),
  location: z.string().max(500).nullable().optional(),
  description: z.string().max(3000).nullable().optional(),
});

const importSchema = z.object({
  events: z.array(eventSchema).min(1, "Select at least one event.").max(MAX_IMPORT_EVENTS),
  application_id: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().uuid().nullable()),
});

function notesFor(e: z.infer<typeof eventSchema>): string {
  const when = (iso: string) => new Date(iso).toUTCString().replace(/:\d\d GMT$/, " UTC");
  return [
    "Imported from a calendar file.",
    e.allDay ? null : `Starts: ${when(e.start)}${e.end ? `\nEnds: ${when(e.end)}` : ""}`,
    e.location ? `Location: ${e.location}` : null,
    e.description,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 5000);
}

/** Adds the ticked calendar events as tasks. Importing the same event twice is a no-op. */
export async function importCalendarEvents(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let events: unknown;
  try {
    events = JSON.parse(String(formData.get("events") ?? ""));
  } catch {
    return { error: "Could not read the selected events. Choose the file again." };
  }
  const parsed = importSchema.safeParse({ events, application_id: formData.get("application_id") ?? "" });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const seen = new Set<string>();
  const rows = parsed.data.events
    .filter((e) => (seen.has(e.uid) ? false : (seen.add(e.uid), true)))
    .map((e) => ({
      title: e.title,
      notes: notesFor(e),
      due_at: e.start,
      application_id: parsed.data.application_id,
      source_uid: `ics:${e.uid}`.slice(0, 300),
    }));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .upsert(rows, { onConflict: "user_id,source_uid", ignoreDuplicates: true })
    .select("id");
  if (error) return { error: dbMessage(error, "Could not add those events. Check the linked application and try again.") };

  const added = data?.length ?? 0;
  const already = rows.length - added;
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  if (parsed.data.application_id) revalidatePath(`/applications/${parsed.data.application_id}`);

  const parts = [`Added ${added} task${added === 1 ? "" : "s"}`];
  if (already > 0) parts.push(`${already} already imported`);
  return { message: `${parts.join("; ")}.` };
}
