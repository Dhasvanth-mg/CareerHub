"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbMessage, firstError, type ActionState } from "@/lib/forms";
import { MAX_IMPORT_ROWS } from "@/lib/csv-import";
import { PRIORITIES, STAGES, WORK_MODES } from "@/lib/domain";

const nullableText = (max: number) => z.string().max(max).nullable();
const nullableDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

// The browser has already cleaned each row; everything is checked again here because the form data is not trusted.
const rowSchema = z.object({
  company_name: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  stage: z.enum(STAGES),
  priority: z.enum(PRIORITIES),
  location: nullableText(200),
  work_mode: z.enum(WORK_MODES).nullable(),
  employment_type: nullableText(100),
  posting_url: z
    .string()
    .max(2000)
    .refine((v) => /^https?:\/\//i.test(v))
    .nullable(),
  source: nullableText(200),
  salary_text: nullableText(200),
  applied_on: nullableDate,
  deadline: nullableDate,
  notes: nullableText(10000),
});

const key = (company: string, title: string) => `${company.trim().toLowerCase()}|${title.trim().toLowerCase()}`;

export async function importApplications(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("rows") ?? ""));
  } catch {
    return { error: "Could not read the selected rows. Choose the file again." };
  }
  const parsed = z.array(rowSchema).min(1, "Select at least one row.").max(MAX_IMPORT_ROWS).safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();

  // Skip rows that match an application already in the tracker (same company and role), and repeats within the file.
  const { data: existing } = await supabase.from("applications").select("company_name, title").limit(5000);
  const seen = new Set((existing ?? []).map((a) => key(a.company_name, a.title)));
  const fresh = parsed.data.filter((r) => {
    const k = key(r.company_name, r.title);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const skipped = parsed.data.length - fresh.length;

  let added = 0;
  if (fresh.length > 0) {
    const { data, error } = await supabase.from("applications").insert(fresh).select("id, stage");
    if (error) return { error: dbMessage(error, "Could not import those rows. Please try again.") };
    added = data?.length ?? 0;
    // The timeline is best-effort, as everywhere else.
    if (data && data.length > 0) {
      await supabase.from("application_events").insert(
        data.map((a) => ({ application_id: a.id, type: "created", summary: "Imported from a spreadsheet", to_value: a.stage, actor: "user" })),
      );
    }
  }

  revalidatePath("/applications");
  revalidatePath("/dashboard");
  const parts = [`Imported ${added} application${added === 1 ? "" : "s"}`];
  if (skipped > 0) parts.push(`${skipped} skipped as already in your tracker`);
  return { message: `${parts.join("; ")}.` };
}
