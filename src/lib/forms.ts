import { z } from "zod";

export type ActionState = { error?: string } | undefined;

/** "" -> null for optional text fields. */
export const optText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null);

export const optDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.").nullable())
  .default(null);

export function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") obj[k] = v;
  return obj;
}

export function firstError(error: z.ZodError): string {
  const i = error.issues[0];
  return i.path.length ? `${String(i.path[0]).replace(/_/g, " ")}: ${i.message}` : i.message;
}

/** Row and storage caps are enforced by the database (SQLSTATE 54000). Say so plainly. */
export function dbMessage(error: { code?: string; message?: string } | null | undefined, fallback: string): string {
  if (error?.code === "54000") {
    return /storage/i.test(error.message ?? "")
      ? "You've reached the 100 MB document limit for this account. Delete some files first."
      : "You've reached the limit for this account. Delete some old items first.";
  }
  return fallback;
}
