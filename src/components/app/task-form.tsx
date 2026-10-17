"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { createTask } from "@/app/(app)/tasks/actions";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useOnComplete, useSafeForm } from "@/lib/use-safe-form";

type Props = {
  /** Fixed application (detail page). */
  applicationId?: string;
  /** Pick-list of applications (tasks page). */
  applications?: { id: string; label: string }[];
};

function toIsoFromLocal(local: string): string {
  // datetime-local has no zone; `new Date(local)` interprets it in the browser's zone.
  return local ? new Date(local).toISOString() : "";
}

export function TaskForm({ applicationId, applications }: Props) {
  const form = useSafeForm(createTask);
  const { state, onSubmit, pending } = form;
  const [due, setDue] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  useOnComplete(form, () => {
    if (!state?.error) {
      formRef.current?.reset();
      setDue("");
      toast.success("Task added");
    }
  });

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      {applicationId ? <input type="hidden" name="application_id" value={applicationId} /> : null}
      <Field label="Task" htmlFor="task-title" className="sm:col-span-2">
        <Input id="task-title" name="title" required maxLength={300} placeholder="Follow up with recruiter" />
      </Field>
      <Field label="Due (your local time)" htmlFor="task-due">
        <Input id="task-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        <input type="hidden" name="due_at" value={toIsoFromLocal(due)} />
      </Field>
      {applications ? (
        <Field label="Application (optional)" htmlFor="task-app">
          <NativeSelect id="task-app" name="application_id" defaultValue="">
            <option value="">General task</option>
            {applications.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pending={pending} pendingText="Adding…">
          Add task
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
