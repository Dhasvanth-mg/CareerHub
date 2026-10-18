"use client";

import Link from "next/link";
import { useState } from "react";
import { extractJob, saveJob } from "@/app/(app)/jobs/actions";
import type { ExtractState } from "@/app/(app)/jobs/types";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { WORK_MODES, WORK_MODE_LABEL } from "@/lib/domain";
import { useSafeForm } from "@/lib/use-safe-form";
import { cn } from "@/lib/utils";

export function JobCapture() {
  const [mode, setMode] = useState<"text" | "url">("text");
  const { state, onSubmit, pending } = useSafeForm(extractJob);

  return (
    <div className="space-y-8">
      <form method="post" onSubmit={onSubmit} className="space-y-4 rounded-lg border p-4">
        <input type="hidden" name="mode" value={mode} />
        <div role="group" aria-label="Import method" className="flex w-fit rounded-lg border p-0.5 text-sm">
          {(["text", "url"] as const).map((m) => (
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
              {m === "text" ? "Paste text" : "From a link"}
            </button>
          ))}
        </div>

        {mode === "text" ? (
          <Field label="Job posting text" htmlFor="job-text" hint="Paste the whole posting. This works on every site.">
            <Textarea id="job-text" name="text" rows={10} required minLength={80} maxLength={60000} />
          </Field>
        ) : (
          <Field
            label="Link to the posting"
            htmlFor="job-url"
            hint="Some sites block automated access or load content with JavaScript. If that happens, paste the text instead."
          >
            <Input id="job-url" name="url" type="url" required placeholder="https://…" />
          </Field>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending={pending} pendingText="Reading the posting…">
            Analyze posting
          </SubmitButton>
          <p className="text-xs text-muted-foreground">
            The posting text is sent to Groq, our AI provider, to pull out the details. Nothing is saved to an application until you
            review it.
          </p>
        </div>
        {state?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </form>

      {state?.postingId && state.extraction ? <ReviewForm key={state.postingId} state={state} /> : null}
    </div>
  );
}

function ReviewForm({ state }: { state: NonNullable<ExtractState> }) {
  const x = state.extraction!;
  const { state: saveState, onSubmit, pending } = useSafeForm(saveJob);
  const uncertain = new Set(x.uncertain_fields);
  const hint = (name: string, value: string | null) =>
    uncertain.has(name) ? "The AI wasn't sure about this. Please check it against the posting." : value === null ? "Not found in the posting." : undefined;
  const evidence = [...x.must_have, ...x.preferred].filter((r) => r.source_snippet);

  return (
    <section aria-labelledby="review" className="space-y-5">
      <div>
        <h2 id="review" className="text-lg font-medium">
          Review before saving
        </h2>
        <p className="text-sm text-muted-foreground">
          These are suggestions pulled from the posting. Fix anything that&apos;s wrong, then save to create the application.
        </p>
      </div>

      {state.aiError ? (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {state.aiError} Your posting text is saved, so you can fill in the details below by hand.
        </p>
      ) : null}
      {state.truncated ? (
        <p role="status" className="text-sm text-muted-foreground">
          This posting is long, so only the first part was analyzed. Check that nothing important is missing.
        </p>
      ) : null}

      <form method="post" onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="posting_id" value={state.postingId} />
        <Field label="Company" htmlFor="r-company" hint={hint("company_name", x.company_name)}>
          <Input id="r-company" name="company_name" required maxLength={200} defaultValue={x.company_name ?? ""} />
        </Field>
        <Field label="Role title" htmlFor="r-title" hint={hint("title", x.title)}>
          <Input id="r-title" name="title" required maxLength={200} defaultValue={x.title ?? ""} />
        </Field>
        <Field label="Location" htmlFor="r-location" hint={hint("location", x.location)}>
          <Input id="r-location" name="location" maxLength={200} defaultValue={x.location ?? ""} />
        </Field>
        <Field label="Work arrangement" htmlFor="r-mode" hint={hint("work_mode", x.work_mode)}>
          <NativeSelect id="r-mode" name="work_mode" defaultValue={x.work_mode ?? ""}>
            <option value="">Not specified</option>
            {WORK_MODES.map((m) => (
              <option key={m} value={m}>
                {WORK_MODE_LABEL[m]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Employment type" htmlFor="r-type" hint={hint("employment_type", x.employment_type)}>
          <Input id="r-type" name="employment_type" maxLength={100} defaultValue={x.employment_type ?? ""} />
        </Field>
        <Field
          label="Salary as listed"
          htmlFor="r-salary"
          hint={hint("salary_text", x.salary_text) ?? "Exactly what the posting says. We never estimate pay."}
        >
          <Input id="r-salary" name="salary_text" maxLength={200} defaultValue={x.salary_text ?? ""} />
        </Field>
        <Field label="Application deadline" htmlFor="r-deadline" hint={hint("deadline", x.deadline)}>
          <Input id="r-deadline" name="deadline" type="date" defaultValue={x.deadline ?? ""} />
        </Field>
        <Field label="Posting link" htmlFor="r-url" hint={state.sourceUrl ? undefined : hint("application_link", x.application_link)}>
          <Input
            id="r-url"
            name="posting_url"
            type="url"
            placeholder="https://…"
            defaultValue={state.sourceUrl ?? x.application_link ?? ""}
          />
        </Field>

        <Field label="Must-have requirements" htmlFor="r-must" hint="One per line." className="sm:col-span-2">
          <Textarea id="r-must" name="must_have" rows={6} defaultValue={x.must_have.map((r) => r.text).join("\n")} />
        </Field>
        <Field label="Preferred qualifications" htmlFor="r-pref" hint="One per line." className="sm:col-span-2">
          <Textarea id="r-pref" name="preferred" rows={4} defaultValue={x.preferred.map((r) => r.text).join("\n")} />
        </Field>

        {evidence.length > 0 ? (
          <details className="rounded-lg border p-3 text-sm sm:col-span-2">
            <summary className="cursor-pointer font-medium">Where each requirement came from</summary>
            <ul className="mt-3 space-y-2">
              {evidence.map((r) => (
                <li key={r.text}>
                  <p>{r.text}</p>
                  <blockquote className="border-l-2 pl-3 text-muted-foreground">{r.source_snippet}</blockquote>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <details className="rounded-lg border p-3 text-sm sm:col-span-2">
          <summary className="cursor-pointer font-medium">Text we analyzed</summary>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{state.sourcePreview}</pre>
        </details>

        {saveState?.duplicate ? (
          <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2 dark:bg-amber-950 dark:text-amber-200">
            You may already be tracking this role:{" "}
            <Link href={`/applications/${saveState.duplicate.id}`} className="font-medium underline underline-offset-4">
              {saveState.duplicate.label}
            </Link>
            . Save anyway to create a second application.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <SubmitButton pending={pending}>Save as application</SubmitButton>
          {saveState?.duplicate ? (
            <SubmitButton pending={pending} name="confirm_duplicate" value="1" variant="outline">
              Save anyway
            </SubmitButton>
          ) : null}
          {saveState?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {saveState.error}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
