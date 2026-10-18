"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sweepOrphans } from "@/lib/storage-sweep";
import {
  DOC_KINDS,
  MAX_FILE_BYTES,
  MAX_TEXT_CHARS,
  extractPdfText,
  looksLikePdf,
  looksLikeText,
  safeFileName,
} from "@/lib/documents";
import { logEvent } from "@/lib/events";
import { dbMessage, firstError, type ActionState } from "@/lib/forms";

type FinalizeResult = { error?: string; documentId?: string; extraction?: "ok" | "empty" | "failed" } | undefined;

const finalizeSchema = z.object({
  kind: z.enum(DOC_KINDS),
  title: z.string().trim().min(1, "Give the document a title.").max(200),
  /** Existing document to add a new version to. */
  documentId: z.string().uuid().nullable(),
  versionId: z.string().uuid(),
  path: z.string().min(10).max(400),
  fileName: z.string().min(1).max(300),
});

async function nextVersion(supabase: Awaited<ReturnType<typeof createClient>>, documentId: string): Promise<number> {
  const { data } = await supabase
    .from("document_versions")
    .select("version")
    .eq("document_id", documentId)
    .order("version", { ascending: false })
    .limit(1);
  return (data?.[0]?.version ?? 0) + 1;
}

/**
 * Step 2 of upload. The browser has already put the file in the user's own storage prefix;
 * here we re-verify it server-side (ownership, size, real file type) and extract its text.
 */
export async function finalizeUpload(input: z.input<typeof finalizeSchema>): Promise<FinalizeResult> {
  const parsed = finalizeSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please log in again." };
  const uid = auth.user.id;

  const expectedPrefix = `${uid}/`;
  if (!v.path.startsWith(expectedPrefix) || v.path.includes("..")) return { error: "That upload isn't valid." };

  const cleanup = () => supabase.storage.from("documents").remove([v.path]);

  const { data: blob, error: dlError } = await supabase.storage.from("documents").download(v.path);
  if (dlError || !blob) return { error: "We couldn't find the uploaded file. Please try again." };
  if (blob.size > MAX_FILE_BYTES || blob.size === 0) {
    await cleanup();
    return { error: "Files must be between 1 byte and 10 MB." };
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());

  let mime: string;
  let text = "";
  let state: "ok" | "empty" | "failed";
  let pages = 0;
  if (looksLikePdf(bytes)) {
    mime = "application/pdf";
    const r = await extractPdfText(bytes);
    ({ text, state, pages } = r);
  } else if (looksLikeText(bytes)) {
    mime = "text/plain";
    text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, MAX_TEXT_CHARS).trim();
    state = text.length < 50 ? "empty" : "ok";
  } else {
    await cleanup();
    return { error: "Only PDF and plain-text files are supported." };
  }
  void pages;

  let documentId = v.documentId;
  if (documentId) {
    const { data: existing } = await supabase.from("documents").select("id").eq("id", documentId).maybeSingle();
    if (!existing) {
      await cleanup();
      return { error: "That document no longer exists." };
    }
  } else {
    const { data: doc, error } = await supabase.from("documents").insert({ kind: v.kind, title: v.title }).select("id").single();
    if (error || !doc) {
      await cleanup();
      return { error: dbMessage(error, "Couldn't save the document. Please try again.") };
    }
    documentId = doc.id;
  }

  const { error: versionError } = await supabase.from("document_versions").insert({
    id: v.versionId,
    document_id: documentId,
    version: await nextVersion(supabase, documentId as string),
    storage_path: v.path,
    file_name: safeFileName(v.fileName),
    mime_type: mime,
    size_bytes: blob.size,
    extracted_text: text || null,
    extraction_state: state,
  });
  if (versionError) {
    await cleanup();
    if (!v.documentId) await supabase.from("documents").delete().eq("id", documentId as string);
    return { error: dbMessage(versionError, "Couldn't save the file details. Please try again.") };
  }

  // Tidy up after earlier interrupted uploads. Best effort: it must never fail this save.
  try {
    await sweepOrphans(supabase, uid);
  } catch {
    // ignored on purpose
  }

  revalidatePath("/documents");
  revalidatePath("/resume");
  return { documentId: documentId as string, extraction: state };
}

const textSchema = z.object({
  kind: z.enum(DOC_KINDS),
  title: z.string().trim().min(1, "Give the document a title.").max(200),
  documentId: z.string().uuid().nullable(),
  text: z.string().trim().min(50, "Paste at least a few lines of text.").max(MAX_TEXT_CHARS),
});

/** Saves pasted or edited text as a new text version. Originals are never overwritten. */
export async function saveTextVersion(input: z.input<typeof textSchema>): Promise<FinalizeResult> {
  const parsed = textSchema.safeParse(input);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please log in again." };

  let documentId = v.documentId;
  const createdDoc = !documentId;
  if (documentId) {
    const { data: existing } = await supabase.from("documents").select("id").eq("id", documentId).maybeSingle();
    if (!existing) return { error: "That document no longer exists." };
  } else {
    const { data: doc, error } = await supabase.from("documents").insert({ kind: v.kind, title: v.title }).select("id").single();
    if (error || !doc) return { error: "Couldn't save the document. Please try again." };
    documentId = doc.id;
  }

  const versionId = crypto.randomUUID();
  const path = `${auth.user.id}/${documentId}/${versionId}.txt`;
  const body = new Blob([v.text], { type: "text/plain" });
  const { error: uploadError } = await supabase.storage.from("documents").upload(path, body, { contentType: "text/plain" });
  if (uploadError) {
    if (createdDoc) await supabase.from("documents").delete().eq("id", documentId as string);
    return { error: "Couldn't store the text. Please try again." };
  }

  const { error } = await supabase.from("document_versions").insert({
    id: versionId,
    document_id: documentId,
    version: await nextVersion(supabase, documentId as string),
    storage_path: path,
    file_name: `${safeFileName(v.title)}.txt`,
    mime_type: "text/plain",
    size_bytes: Math.max(1, body.size),
    extracted_text: v.text,
    extraction_state: "ok",
  });
  if (error) {
    await supabase.storage.from("documents").remove([path]);
    if (createdDoc) await supabase.from("documents").delete().eq("id", documentId as string);
    return { error: dbMessage(error, "Couldn't save the version. Please try again.") };
  }
  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);
  revalidatePath("/resume");
  return { documentId: documentId as string, extraction: "ok" };
}

/** Lets the user correct extracted text (e.g. a bad PDF parse) without touching the stored file. */
export async function updateExtractedText(versionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const text = String(formData.get("text") ?? "").trim().slice(0, MAX_TEXT_CHARS);
  if (text.length < 50) return { error: "The text is too short to use." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_versions")
    .update({ extracted_text: text, extraction_state: "ok" })
    .eq("id", versionId)
    .select("document_id")
    .single();
  if (error || !data) return { error: "Couldn't save the corrected text." };
  revalidatePath(`/documents/${data.document_id}`);
  return undefined;
}

export async function deleteDocument(documentId: string) {
  const supabase = await createClient();
  const { data: versions } = await supabase.from("document_versions").select("storage_path").eq("document_id", documentId);
  const paths = (versions ?? []).map((v) => v.storage_path);
  if (paths.length) await supabase.storage.from("documents").remove(paths);
  await supabase.from("documents").delete().eq("id", documentId);
  revalidatePath("/documents");
  revalidatePath("/resume");
  redirect("/documents");
}

export async function deleteVersion(versionId: string) {
  const supabase = await createClient();
  const { data: version } = await supabase
    .from("document_versions")
    .select("storage_path, document_id")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) return;
  await supabase.storage.from("documents").remove([version.storage_path]);
  await supabase.from("document_versions").delete().eq("id", versionId);
  const { count } = await supabase
    .from("document_versions")
    .select("id", { count: "exact", head: true })
    .eq("document_id", version.document_id);
  if (!count) {
    await supabase.from("documents").delete().eq("id", version.document_id);
    revalidatePath("/documents");
    redirect("/documents");
  }
  revalidatePath(`/documents/${version.document_id}`);
  revalidatePath("/documents");
}

/** Records which exact version was submitted with an application. */
export async function setSubmittedVersion(applicationId: string, field: "resume" | "cover_letter", formData: FormData) {
  const raw = String(formData.get("version_id") ?? "");
  const versionId = raw === "" ? null : z.string().uuid().parse(raw);
  const column = field === "resume" ? "submitted_resume_version_id" : "submitted_cover_letter_version_id";
  const supabase = await createClient();
  const { error } = await supabase.from("applications").update({ [column]: versionId }).eq("id", applicationId);
  if (!error) {
    let label = "cleared";
    if (versionId) {
      const { data } = await supabase
        .from("document_versions")
        .select("version, file_name, documents(title)")
        .eq("id", versionId)
        .maybeSingle();
      const title = (data?.documents as unknown as { title: string } | null)?.title ?? data?.file_name ?? "document";
      label = `${title} (version ${data?.version ?? "?"})`;
    }
    await logEvent(
      supabase,
      applicationId,
      "submitted_document",
      versionId
        ? `Recorded submitted ${field === "resume" ? "resume" : "cover letter"}: ${label}`
        : `Cleared submitted ${field === "resume" ? "resume" : "cover letter"}`,
      { to: versionId },
    );
  }
  revalidatePath(`/applications/${applicationId}`);
}
