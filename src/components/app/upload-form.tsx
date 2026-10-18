"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { finalizeUpload, saveTextVersion } from "@/app/(app)/documents/actions";
import { Field } from "@/components/app/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const KINDS = [
  ["resume", "Resume"],
  ["cover_letter", "Cover letter"],
  ["transcript", "Transcript"],
  ["portfolio", "Portfolio"],
  ["other", "Other"],
] as const;
const MAX_BYTES = 10 * 1024 * 1024;

type Props = {
  userId: string;
  /** When set, the upload becomes a new version of this document. */
  documentId?: string;
  defaultKind?: string;
  defaultTitle?: string;
  /** After saving, where to go. Defaults to the document page. */
  compact?: boolean;
};

export function UploadForm({ userId, documentId, defaultKind = "resume", defaultTitle = "", compact = false }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"file" | "text">("file");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const kind = String(fd.get("kind") ?? "resume");
    const title = String(fd.get("title") ?? defaultTitle).trim();
    setBusy(true);
    try {
      let result;
      if (mode === "text") {
        result = await saveTextVersion({
          kind: kind as "resume",
          title,
          documentId: documentId ?? null,
          text: String(fd.get("text") ?? ""),
        });
      } else {
        const file = fd.get("file");
        if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload.");
        if (file.size > MAX_BYTES) throw new Error("Files must be 10 MB or smaller.");
        const ext = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "txt";
        const versionId = crypto.randomUUID();
        const path = `${userId}/${versionId}.${ext}`;
        const { error: uploadError } = await createClient()
          .storage.from("documents")
          .upload(path, file, { contentType: ext === "pdf" ? "application/pdf" : "text/plain" });
        if (uploadError) throw new Error("The upload failed. Check your connection and try again.");
        result = await finalizeUpload({
          kind: kind as "resume",
          title,
          documentId: documentId ?? null,
          versionId,
          path,
          fileName: file.name,
        });
      }
      if (result?.error || !result?.documentId) throw new Error(result?.error ?? "Something went wrong.");
      if (result.extraction === "ok") toast.success("Saved. Check that the extracted text looks right.");
      else toast.warning("Saved, but we couldn't read any text from this file. Open it to paste the text in by hand.");
      form.reset();
      router.push(`/documents/${result.documentId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <div role="group" aria-label="Add by" className="flex w-fit rounded-lg border p-0.5 text-sm">
        {(["file", "text"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              "rounded-md px-3 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              mode === m ? "bg-muted font-medium" : "text-muted-foreground",
            )}
          >
            {m === "file" ? "Upload a file" : "Paste text"}
          </button>
        ))}
      </div>

      <div className={cn("grid gap-3", compact ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
        {!documentId ? (
          <>
            <Field label="Type" htmlFor="up-kind">
              <NativeSelect id="up-kind" name="kind" defaultValue={defaultKind}>
                {KINDS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Title" htmlFor="up-title" className={compact ? "" : "sm:col-span-2"}>
              <Input id="up-title" name="title" required maxLength={200} defaultValue={defaultTitle} placeholder="Resume, general" />
            </Field>
          </>
        ) : (
          <>
            <input type="hidden" name="kind" value={defaultKind} />
            <input type="hidden" name="title" value={defaultTitle} />
          </>
        )}
      </div>

      {mode === "file" ? (
        <Field label="File" htmlFor="up-file" hint="PDF or plain text, up to 10 MB. Scanned PDFs have no readable text; paste the text instead.">
          <Input id="up-file" name="file" type="file" accept=".pdf,.txt,application/pdf,text/plain" required />
        </Field>
      ) : (
        <Field label="Text" htmlFor="up-text">
          <Textarea id="up-text" name="text" rows={10} required minLength={50} maxLength={60000} />
        </Field>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : documentId ? "Save new version" : "Save to vault"}
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
