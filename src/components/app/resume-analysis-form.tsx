"use client";

import { runResumeAnalysis } from "@/app/(app)/resume/actions";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { NativeSelect } from "@/components/ui/native-select";
import { useSafeForm } from "@/lib/use-safe-form";

type Option = { id: string; label: string };

export function ResumeAnalysisForm({
  versions,
  jobs,
  defaultVersion,
  defaultJob,
  applicationId,
}: {
  versions: Option[];
  jobs: Option[];
  defaultVersion?: string;
  defaultJob?: string;
  applicationId?: string;
}) {
  const { state, onSubmit, pending } = useSafeForm(runResumeAnalysis);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {applicationId ? <input type="hidden" name="application_id" value={applicationId} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Resume" htmlFor="ra-version">
          <NativeSelect id="ra-version" name="document_version_id" defaultValue={defaultVersion ?? versions[0]?.id} required>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Job" htmlFor="ra-job">
          <NativeSelect id="ra-job" name="job_posting_id" defaultValue={defaultJob ?? jobs[0]?.id} required>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="show_score" value="1" defaultChecked className="mt-1" />
        <span>
          Include a guidance score
          <span className="block text-xs text-muted-foreground">
            It&apos;s a rubric to help you prioritize, not an ATS score or a hiring prediction. You&apos;ll see how it&apos;s built.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingText="Analyzing… this can take up to a minute">
          Analyze resume
        </SubmitButton>
        <p className="text-xs text-muted-foreground">
          Your resume text and the job requirements are sent to Groq, our AI provider. Nothing in your documents changes.
        </p>
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
