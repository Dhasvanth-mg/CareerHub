"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { saveTextVersion } from "@/app/(app)/documents/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Edit the resume text and save it as a NEW version. The version analysed is never changed. */
export function ResumeRevisionEditor({
  documentId,
  title,
  initial,
  kind = "resume",
}: {
  documentId: string;
  title: string;
  initial: string;
  kind?: "resume" | "cover_letter";
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await saveTextVersion({ kind, title, documentId, text });
    setBusy(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSavedId(result?.documentId ?? documentId);
    toast.success("Saved as a new version. The original is unchanged.");
  }

  return (
    <div className="space-y-3">
      <label htmlFor="revision-text" className="sr-only">
        {kind === "resume" ? "Resume text" : "Cover letter text"}
      </label>
      <Textarea
        id="revision-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={16}
        className="font-mono text-xs"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={busy || text.trim() === initial.trim() || text.trim().length < 50}>
          {busy ? "Saving…" : "Save as new version"}
        </Button>
        {savedId ? (
          <Link href={`/documents/${savedId}`} className="text-sm underline underline-offset-4">
            View in Document Vault
          </Link>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
