"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { deleteAccount, updateProfile } from "@/app/(app)/settings/actions";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { Input } from "@/components/ui/input";
import { useSafeForm } from "@/lib/use-safe-form";

export function ProfileForm({ displayName }: { displayName: string }) {
  const { state, onSubmit, pending } = useSafeForm(updateProfile);
  const handled = useRef(state);
  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (!state?.error) toast.success("Profile saved");
  }, [state]);

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <Field label="Display name" htmlFor="display_name" className="w-64">
        <Input id="display_name" name="display_name" maxLength={100} defaultValue={displayName} />
      </Field>
      <SubmitButton pending={pending} variant="secondary">
        Save
      </SubmitButton>
      {state?.error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function DeleteAccountForm() {
  const { state, onSubmit, pending } = useSafeForm(deleteAccount);
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="Type DELETE to confirm" htmlFor="confirm" className="w-64">
        <Input id="confirm" name="confirm" autoComplete="off" required />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingText="Deleting…" variant="destructive">
          Delete my account
        </SubmitButton>
        {state?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
