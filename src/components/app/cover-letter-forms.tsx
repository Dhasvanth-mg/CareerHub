"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { saveTextVersion } from "@/app/(app)/documents/actions";
import { generateCoverLetterDraft, runCoverLetterAnalysis } from "@/app/(app)/cover-letter/actions";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useSafeForm } from "@/lib/use-safe-form";

type Option = { id: string; label: string };

export function CoverLetterAnalysisForm({
  letters,
  resumes,
  jobs,
  defaultLetter,
  defaultJob,
  applicationId,
}: {
  letters: Option[];
  resumes: Option[];
  jobs: Option[];
  defaultLetter?: string;
  defaultJob?: string;
  applicationId?: string;
}) {
  const { state, onSubmit, pending } = useSafeForm(runCoverLetterAnalysis);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {applicationId ? <input type="hidden" name="application_id" value={applicationId} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cover letter" htmlFor="cl-letter">
          <NativeSelect id="cl-letter" name="letter_version_id" defaultValue={defaultLetter ?? letters[0]?.id} required>
            {letters.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Job" htmlFor="cl-job">
          <NativeSelect id="cl-job" name="job_posting_id" defaultValue={defaultJob ?? jobs[0]?.id} required>
            {jobs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label="Check against a resume (optional)"
          htmlFor="cl-resume"
          hint="Lets us flag claims in the letter that your resume doesn't support."
          className="sm:col-span-2"
        >
          <NativeSelect id="cl-resume" name="resume_version_id" defaultValue="">
            <option value="">Don&apos;t compare</option>
            {resumes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
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
            A rubric to help you prioritize, not a verdict on the letter or on you.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingText="Reviewing… this can take up to a minute">
          Review cover letter
        </SubmitButton>
        <p className="text-xs text-muted-foreground">
          The letter, the job requirements and (if chosen) your resume text are sent to Groq.
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

export function CoverLetterDraftForm({ resumes, jobs }: { resumes: Option[]; jobs: Option[] }) {
  const { state, onSubmit, pending } = useSafeForm(generateCoverLetterDraft);
  const [edited, setEdited] = useState<{ source: string | undefined; text: string }>({ source: undefined, text: "" });
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The draft is editable; the editor resets whenever a new draft arrives.
  const text = edited.source === state?.letter ? edited.text : (state?.letter ?? "");
  const suggestedTitle = title || (state?.jobLabel ? `Cover letter, ${state.jobLabel}` : "Cover letter");

  async function save() {
    setSaving(true);
    setSaveError(null);
    const result = await saveTextVersion({ kind: "cover_letter", title: suggestedTitle, documentId: null, text });
    setSaving(false);
    if (result?.error) {
      setSaveError(result.error);
      return;
    }
    setSaved(result?.documentId ?? null);
    toast.success("Saved to your Document Vault");
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Resume to draw from" htmlFor="dr-resume">
            <NativeSelect id="dr-resume" name="resume_version_id" defaultValue={resumes[0]?.id} required>
              {resumes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Job" htmlFor="dr-job">
            <NativeSelect id="dr-job" name="job_posting_id" defaultValue={jobs[0]?.id} required>
              {jobs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Anything to emphasise (optional)" htmlFor="dr-notes" className="sm:col-span-2">
            <Input id="dr-notes" name="notes" maxLength={600} placeholder="For example: my teaching background and the robotics club" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending={pending} pendingText="Drafting…" variant="secondary">
            Draft a first version
          </SubmitButton>
          <p className="text-xs text-muted-foreground">
            The draft only uses facts from your resume and leaves [placeholders] for anything it doesn&apos;t know.
          </p>
        </div>
        {state?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </form>

      {state?.letter ? (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">AI draft · not saved yet</p>
          {state.toVerify && state.toVerify.length > 0 ? (
            <div className="text-sm">
              <p className="font-medium">Check before using</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {state.toVerify.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <label htmlFor="draft-text" className="sr-only">
            Draft text
          </label>
          <Textarea
            id="draft-text"
            rows={16}
            value={text}
            onChange={(e) => setEdited({ source: state.letter, text: e.target.value })}
          />
          <Field label="Save as" htmlFor="draft-title">
            <Input id="draft-title" value={suggestedTitle} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={save} disabled={saving || text.trim().length < 50}>
              {saving ? "Saving…" : "Save to vault"}
            </Button>
            {saved ? (
              <Link href={`/documents/${saved}`} className="text-sm underline underline-offset-4">
                View in Document Vault
              </Link>
            ) : null}
            {saveError ? (
              <p role="alert" className="text-sm text-destructive">
                {saveError}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
