"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { updateExtractedText } from "@/app/(app)/documents/actions";
import { SubmitButton } from "@/components/app/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { useSafeForm } from "@/lib/use-safe-form";

export function ExtractedTextEditor({ versionId, initial }: { versionId: string; initial: string }) {
  const { state, onSubmit, pending } = useSafeForm(updateExtractedText.bind(null, versionId));
  const handled = useRef(state);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (!state?.error) toast.success("Corrected text saved");
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="extracted-text" className="text-sm font-medium">
        Extracted text
      </label>
      <p className="text-xs text-muted-foreground">
        This is what analysis uses, not the file itself. Fix anything the PDF reader got wrong. The original file is untouched.
      </p>
      <Textarea id="extracted-text" name="text" rows={16} defaultValue={initial} className="font-mono text-xs" />
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending}>Save corrected text</SubmitButton>
        {state?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
