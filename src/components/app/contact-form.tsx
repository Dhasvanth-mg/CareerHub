"use client";

import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/forms";
import { useOnComplete, useSafeForm } from "@/lib/use-safe-form";

export type ContactRow = {
  id: string;
  name: string;
  company: string | null;
  position: string | null;
  email: string | null;
  linkedin_url: string | null;
  relationship: string | null;
  where_met: string | null;
  notes: string | null;
  last_contacted_on: string | null;
};

export function ContactForm({
  action,
  defaults = {},
  submitLabel,
  toastOnSuccess = false,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: Partial<ContactRow>;
  submitLabel: string;
  toastOnSuccess?: boolean;
}) {
  const form = useSafeForm(action);
  const { state, onSubmit, pending } = form;
  useOnComplete(form, () => {
    if (toastOnSuccess && !state?.error) toast.success("Changes saved");
  });

  return (
    <form method="post" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name" htmlFor="name" className="sm:col-span-2">
        <Input id="name" name="name" required maxLength={200} defaultValue={defaults.name ?? ""} />
      </Field>
      <Field label="Company" htmlFor="company">
        <Input id="company" name="company" maxLength={200} defaultValue={defaults.company ?? ""} />
      </Field>
      <Field label="Position" htmlFor="position">
        <Input id="position" name="position" maxLength={200} defaultValue={defaults.position ?? ""} />
      </Field>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" maxLength={320} defaultValue={defaults.email ?? ""} />
      </Field>
      <Field label="LinkedIn" htmlFor="linkedin_url">
        <Input id="linkedin_url" name="linkedin_url" type="url" placeholder="https://…" defaultValue={defaults.linkedin_url ?? ""} />
      </Field>
      <Field label="Relationship" htmlFor="relationship" hint="For example alumnus, recruiter, classmate.">
        <Input id="relationship" name="relationship" maxLength={200} defaultValue={defaults.relationship ?? ""} />
      </Field>
      <Field label="Where you met" htmlFor="where_met">
        <Input id="where_met" name="where_met" maxLength={200} defaultValue={defaults.where_met ?? ""} />
      </Field>
      <Field label="Last contacted" htmlFor="last_contacted_on">
        <Input id="last_contacted_on" name="last_contacted_on" type="date" defaultValue={defaults.last_contacted_on ?? ""} />
      </Field>
      <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
        <Textarea id="notes" name="notes" rows={4} maxLength={10000} defaultValue={defaults.notes ?? ""} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
        {state?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
