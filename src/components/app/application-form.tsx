"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  PRIORITIES,
  STAGES,
  STAGE_LABEL,
  WORK_MODES,
  WORK_MODE_LABEL,
  type ApplicationRow,
} from "@/lib/domain";
import type { ActionState } from "@/lib/forms";
import { useSafeForm } from "@/lib/use-safe-form";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: Partial<ApplicationRow>;
  submitLabel: string;
  /** Show a "Saved" toast on success (edit mode; create redirects away instead). */
  toastOnSuccess?: boolean;
};

export function ApplicationForm({ action, defaults = {}, submitLabel, toastOnSuccess = false }: Props) {
  const { state, onSubmit, pending } = useSafeForm(action);
  const lastHandled = useRef(state);

  useEffect(() => {
    if (state === lastHandled.current) return;
    lastHandled.current = state;
    if (toastOnSuccess && !state?.error) toast.success("Changes saved");
  }, [state, toastOnSuccess]);

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <Field label="Company" htmlFor="company_name">
        <Input id="company_name" name="company_name" required maxLength={200} defaultValue={defaults.company_name ?? ""} />
      </Field>
      <Field label="Role title" htmlFor="title">
        <Input id="title" name="title" required maxLength={200} defaultValue={defaults.title ?? ""} />
      </Field>
      <Field label="Stage" htmlFor="stage">
        <NativeSelect id="stage" name="stage" defaultValue={defaults.stage ?? "saved"}>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Priority" htmlFor="priority">
        <NativeSelect id="priority" name="priority" defaultValue={defaults.priority ?? "medium"}>
          {PRIORITIES.map((p) => (
            <option key={p} value={p} className="capitalize">
              {p[0].toUpperCase() + p.slice(1)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Location" htmlFor="location">
        <Input id="location" name="location" maxLength={200} defaultValue={defaults.location ?? ""} />
      </Field>
      <Field label="Work arrangement" htmlFor="work_mode">
        <NativeSelect id="work_mode" name="work_mode" defaultValue={defaults.work_mode ?? ""}>
          <option value="">Not specified</option>
          {WORK_MODES.map((m) => (
            <option key={m} value={m}>
              {WORK_MODE_LABEL[m]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Employment type" htmlFor="employment_type" hint="For example internship, co-op, full-time.">
        <Input id="employment_type" name="employment_type" maxLength={100} defaultValue={defaults.employment_type ?? ""} />
      </Field>
      <Field label="Source" htmlFor="source" hint="Where you found it: job board, referral, career fair.">
        <Input id="source" name="source" maxLength={200} defaultValue={defaults.source ?? ""} />
      </Field>
      <Field label="Posting link" htmlFor="posting_url" className="sm:col-span-2">
        <Input id="posting_url" name="posting_url" type="url" placeholder="https://…" defaultValue={defaults.posting_url ?? ""} />
      </Field>
      <Field label="Salary as listed" htmlFor="salary_text" hint="Copy what the posting says. Leave blank if it doesn't list one.">
        <Input id="salary_text" name="salary_text" maxLength={200} defaultValue={defaults.salary_text ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Applied on" htmlFor="applied_on">
          <Input id="applied_on" name="applied_on" type="date" defaultValue={defaults.applied_on ?? ""} />
        </Field>
        <Field label="Deadline" htmlFor="deadline">
          <Input id="deadline" name="deadline" type="date" defaultValue={defaults.deadline ?? ""} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
        <Textarea id="notes" name="notes" rows={5} maxLength={10000} defaultValue={defaults.notes ?? ""} />
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
