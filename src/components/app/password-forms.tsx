"use client";

import Link from "next/link";
import {
  requestPasswordReset,
  resendConfirmation,
  updatePassword,
  type AuthState,
} from "@/app/auth/actions";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { Input } from "@/components/ui/input";
import { useSafeForm } from "@/lib/use-safe-form";

function Feedback({ state }: { state: AuthState }) {
  return (
    <div aria-live="polite" className="min-h-5 text-sm">
      {state?.error ? <p className="text-destructive">{state.error}</p> : null}
      {state?.message ? <p className="text-muted-foreground">{state.message}</p> : null}
    </div>
  );
}

export function ForgotPasswordForm() {
  const { state, onSubmit, pending } = useSafeForm(requestPasswordReset);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Feedback state={state} />
      <SubmitButton pending={pending} pendingText="Sending…" className="w-full">
        Email me a reset link
      </SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Back to log in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const { state, onSubmit, pending } = useSafeForm(updatePassword);
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="New password" htmlFor="password" hint="At least 8 characters.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Feedback state={state} />
      <SubmitButton pending={pending} className="w-full">
        Set new password
      </SubmitButton>
      {state?.error?.includes("expired") ? (
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="font-medium underline underline-offset-4">
            Request a new link
          </Link>
        </p>
      ) : null}
    </form>
  );
}

export function ResendConfirmationForm() {
  const { state, onSubmit, pending } = useSafeForm(resendConfirmation);
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <SubmitButton pending={pending} pendingText="Sending…" variant="outline" className="w-full">
        Resend the email
      </SubmitButton>
      <Feedback state={state} />
    </form>
  );
}
