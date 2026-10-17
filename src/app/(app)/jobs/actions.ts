"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import { firstError, formToObject, optDate, optText } from "@/lib/forms";
import { WORK_MODES } from "@/lib/domain";
import { AiUnavailableError } from "@/lib/ai/groq";
import { checkAiAllowed } from "@/lib/ai/guard";
import { extractJobFields, emptyExtraction, PROMPT_VERSION, type JobExtraction } from "@/lib/ai/job-extraction";
import { FetchBlockedError, safeFetchText } from "@/lib/ai/safe-fetch";
import { pageToText } from "@/lib/ai/html-text";
import type { ExtractState, SaveState } from "./types";

const MAX_SNAPSHOT = 60_000;

/** Removes this user's imports that were never saved as an application and are over a day old. Best effort. */
async function pruneAbandonedImports(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: linked } = await supabase.from("applications").select("job_posting_id").not("job_posting_id", "is", null);
  const keep = (linked ?? []).map((a) => a.job_posting_id as string);
  const cutoff = new Date(Date.now() - 86_400_000).toISOString();
  let q = supabase.from("job_postings").delete().lt("created_at", cutoff);
  if (keep.length) q = q.not("id", "in", `(${keep.join(",")})`);
  await q;
}
const MIN_TEXT = 80;

export async function extractJob(_prev: ExtractState, formData: FormData): Promise<ExtractState> {
  const mode = formData.get("mode") === "url" ? "url" : "text";
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please log in again." };

  await pruneAbandonedImports(supabase);

  let text = "";
  let sourceUrl: string | null = null;

  if (mode === "url") {
    const raw = String(formData.get("url") ?? "").trim();
    if (!raw) return { error: "Enter the link to the job posting." };
    try {
      const page = await safeFetchText(raw);
      sourceUrl = page.finalUrl;
      text = /text\/plain/.test(page.contentType) ? page.body : pageToText(page.body);
    } catch (e) {
      const why = e instanceof FetchBlockedError ? e.message : "We couldn't read that page.";
      return { error: `${why} Many job sites block automated access: paste the posting text instead.` };
    }
  } else {
    text = String(formData.get("text") ?? "");
  }

  text = text.replace(/\u0000/g, "").trim().slice(0, MAX_SNAPSHOT);
  if (text.length < MIN_TEXT) {
    return {
      error:
        mode === "url"
          ? "That page had almost no readable text (it may load its content with JavaScript). Paste the posting text instead."
          : "Paste more of the posting: a few sentences at least.",
    };
  }

  let extraction: JobExtraction | null = null;
  let aiError: string | undefined;
  let truncated = false;
  let model: string | undefined;
  const allowed = await checkAiAllowed(supabase, "job_extraction");
  if (!allowed.ok) {
    aiError = allowed.message;
  } else {
    try {
      const result = await extractJobFields(text);
      extraction = result.extraction;
      truncated = result.truncated;
      model = result.model;
    } catch (e) {
      aiError = e instanceof AiUnavailableError ? e.message : "The AI couldn't process this posting.";
    }
  }

  // The snapshot is saved either way: the original URL may expire and the text is the source of truth.
  const { data: posting, error } = await supabase
    .from("job_postings")
    .insert({
      snapshot_text: text,
      source_url: sourceUrl,
      title: extraction?.title ?? null,
      company_name: extraction?.company_name ?? null,
      extraction: extraction ? { ...extraction, model, prompt_version: PROMPT_VERSION } : null,
      extraction_state: extraction ? "needs_review" : "failed",
    })
    .select("id")
    .single();
  if (error || !posting) return { error: "Couldn't save the posting. Please try again." };

  return {
    postingId: posting.id,
    extraction: extraction ?? emptyExtraction(),
    aiError,
    sourceUrl,
    sourcePreview: text.slice(0, 6000),
    truncated,
  };
}

const lines = (max: number) =>
  z
    .string()
    .default("")
    .transform((v) =>
      v
        .split(/\r?\n/)
        .map((l) => l.replace(/^[-*•\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, max),
    )
    .pipe(z.array(z.string().max(500)));

const saveSchema = z.object({
  posting_id: z.string().uuid(),
  company_name: z.string().trim().min(1, "Company is required.").max(200),
  title: z.string().trim().min(1, "Role title is required.").max(200),
  location: optText(200),
  work_mode: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.enum(WORK_MODES).nullable())
    .default(null),
  employment_type: optText(100),
  salary_text: optText(200),
  deadline: optDate,
  posting_url: optText(2000).refine((v) => v === null || /^https?:\/\//i.test(v), "Use a full http(s) link."),
  must_have: lines(50),
  preferred: lines(50),
});

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export async function saveJob(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const parsed = saveSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = parsed.data;
  const confirmDuplicate = formData.get("confirm_duplicate") === "1";

  const supabase = await createClient();
  const { data: posting } = await supabase
    .from("job_postings")
    .select("id, extraction")
    .eq("id", v.posting_id)
    .maybeSingle();
  if (!posting) return { error: "That import has expired. Please import the posting again." };

  if (!confirmDuplicate) {
    const byUrl = v.posting_url
      ? await supabase.from("applications").select("id, title, company_name").eq("posting_url", v.posting_url).limit(1)
      : { data: [] };
    const byName = await supabase
      .from("applications")
      .select("id, title, company_name")
      .ilike("company_name", escapeLike(v.company_name))
      .ilike("title", escapeLike(v.title))
      .limit(1);
    const dupe = byUrl.data?.[0] ?? byName.data?.[0];
    if (dupe) return { duplicate: { id: dupe.id, label: `${dupe.title} at ${dupe.company_name}` } };
  }

  const { error: postingError } = await supabase
    .from("job_postings")
    .update({
      company_name: v.company_name,
      title: v.title,
      location: v.location,
      work_mode: v.work_mode,
      employment_type: v.employment_type,
      salary_text: v.salary_text,
      deadline: v.deadline,
      extraction_state: "extracted",
    })
    .eq("id", v.posting_id);
  if (postingError) return { error: "Couldn't save your edits. Please try again." };

  // Keep the quote that supported each requirement, but only where the user left its text unchanged.
  const original = (posting.extraction ?? {}) as Partial<JobExtraction>;
  const snippets = new Map<string, string | null>(
    [...(original.must_have ?? []), ...(original.preferred ?? [])].map((r) => [r.text, r.source_snippet]),
  );
  await supabase.from("job_requirements").delete().eq("job_posting_id", v.posting_id);
  const requirementRows = [
    ...v.must_have.map((text, i) => ({ kind: "must_have", text, position: i })),
    ...v.preferred.map((text, i) => ({ kind: "preferred", text, position: v.must_have.length + i })),
  ].map((r) => ({ ...r, job_posting_id: v.posting_id, source_snippet: snippets.get(r.text) ?? null }));
  if (requirementRows.length) {
    const { error } = await supabase.from("job_requirements").insert(requirementRows);
    if (error) return { error: "Couldn't save the requirements. Please try again." };
  }

  const { data: app, error: appError } = await supabase
    .from("applications")
    .insert({
      job_posting_id: v.posting_id,
      company_name: v.company_name,
      title: v.title,
      stage: "preparing",
      location: v.location,
      work_mode: v.work_mode,
      employment_type: v.employment_type,
      salary_text: v.salary_text,
      deadline: v.deadline,
      posting_url: v.posting_url,
      source: "Job import",
    })
    .select("id")
    .single();
  if (appError || !app) return { error: "Couldn't create the application. Please try again." };

  await logEvent(supabase, app.id, "created", `Imported ${v.title} at ${v.company_name} from a job posting`, {
    to: "preparing",
    data: { source: "job_capture" },
  });
  revalidatePath("/applications");
  revalidatePath("/dashboard");
  redirect(`/applications/${app.id}`);
}
