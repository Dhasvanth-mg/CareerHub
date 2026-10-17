"use client";

import { generateNextAction } from "@/app/(app)/applications/ai-actions";
import { SubmitButton } from "@/components/app/submit-button";
import { useSafeForm } from "@/lib/use-safe-form";

export function GenerateNextAction({ applicationId, hasExisting }: { applicationId: string; hasExisting: boolean }) {
  const { state, onSubmit, pending } = useSafeForm(generateNextAction.bind(null, applicationId));
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
      <SubmitButton pending={pending} pendingText="Thinking…" variant={hasExisting ? "outline" : "default"}>
        {hasExisting ? "Suggest again" : "Suggest a next step"}
      </SubmitButton>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
