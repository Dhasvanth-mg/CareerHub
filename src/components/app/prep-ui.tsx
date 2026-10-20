"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePrepItem, generatePrep, getFeedback, saveAnswer } from "@/app/(app)/applications/[id]/prep/actions";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useOnComplete, useSafeForm } from "@/lib/use-safe-form";

export function PrepGenerateForm({
  applicationId,
  roundId,
  resumes,
  defaultResume,
  evidenceCount,
}: {
  applicationId: string;
  roundId: string | null;
  resumes: { id: string; label: string }[];
  defaultResume?: string;
  evidenceCount: number;
}) {
  const form = useSafeForm(generatePrep.bind(null, applicationId));
  const { state, onSubmit, pending } = form;
  useOnComplete(form, () => {
    if (!state?.error) toast.success("Practice questions ready");
  });

  return (
    <form method="post" onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="round_id" value={roundId ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Draw from this resume" htmlFor="prep-resume" hint="Questions can point to real experience in it.">
          <NativeSelect id="prep-resume" name="resume_version_id" defaultValue={defaultResume ?? ""}>
            <option value="">None</option>
            {resumes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Anything to focus on (optional)" htmlFor="prep-focus">
          <Input id="prep-focus" name="focus" maxLength={400} placeholder="For example: system design, teamwork" />
        </Field>
      </div>
      {evidenceCount > 0 ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="use_evidence" value="1" defaultChecked className="mt-1" />
          <span>
            Also use my evidence library
            <span className="block text-xs text-muted-foreground">{evidenceCount} saved items could be cited as real examples.</span>
          </span>
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending={pending} pendingText="Writing questions…">
          Generate practice questions
        </SubmitButton>
        <p className="text-xs text-muted-foreground">
          The job requirements and the text you choose are sent to Groq. Unanswered questions are replaced; ones you&apos;ve answered are kept.
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

export type PrepItem = {
  id: string;
  question: string;
  category: string;
  why: string | null;
  requirement_text: string | null;
  resume_evidence: string | null;
  evidence_source: string | null;
  answer_draft: string | null;
  feedback: {
    outline?: string;
    review?: {
      strengths: string[];
      improvements: string[];
      star: { situation: boolean; task: boolean; action: boolean; result: boolean };
      scores: { specificity: number; structure: number; relevance: number };
      unsupported_claims: { claim: string; concern: string }[];
      summary: string;
      answered_text?: string;
    };
  } | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  behavioral: "Behavioral",
  technical: "Technical",
  role: "Role",
  company: "Company",
  other: "Other",
};

export function PrepItemCard({ item }: { item: PrepItem }) {
  const form = useSafeForm(saveAnswer.bind(null, item.id));
  const { state, onSubmit, pending } = form;
  useOnComplete(form, () => {
    if (!state?.error) toast.success("Answer saved");
  });

  const [askingFeedback, setAskingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  async function requestFeedback() {
    setAskingFeedback(true);
    setFeedbackError(null);
    const result = await getFeedback(item.id);
    setAskingFeedback(false);
    if (result?.error) setFeedbackError(result.error);
  }

  const review = item.feedback?.review;
  const stale = Boolean(review && review.answered_text !== item.answer_draft);

  return (
    <li className="space-y-3 rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-medium">{item.question}</p>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{CATEGORY_LABEL[item.category] ?? item.category}</Badge>
          <form
            action={deletePrepItem.bind(null, item.id)}
            onSubmit={(e) => {
              if (!window.confirm("Remove this question and your answer?")) e.preventDefault();
            }}
          >
            <Button type="submit" variant="ghost" size="icon-sm" aria-label="Remove this question">
              <Trash2 aria-hidden="true" />
            </Button>
          </form>
        </div>
      </div>

      {item.why ? <p className="text-sm text-muted-foreground">Why they might ask: {item.why}</p> : null}
      {item.requirement_text ? <p className="text-xs text-muted-foreground">Relates to: {item.requirement_text}</p> : null}

      {item.resume_evidence ? (
        <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">
          From your {item.evidence_source === "Resume" ? "resume" : item.evidence_source}: &ldquo;{item.resume_evidence}&rdquo;
        </blockquote>
      ) : null}

      {item.feedback?.outline ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">How to structure your answer</summary>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{item.feedback.outline}</p>
        </details>
      ) : null}

      <form method="post" onSubmit={onSubmit} className="space-y-2">
        <label htmlFor={`ans-${item.id}`} className="text-sm font-medium">
          Your answer
        </label>
        <Textarea id={`ans-${item.id}`} name="answer" rows={6} maxLength={8000} defaultValue={item.answer_draft ?? ""} />
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton pending={pending} variant="secondary" size="sm">
            Save answer
          </SubmitButton>
          <Button type="button" size="sm" variant="outline" onClick={requestFeedback} disabled={askingFeedback || !item.answer_draft}>
            {askingFeedback ? "Reviewing…" : review ? "Get new feedback" : "Get feedback"}
          </Button>
          {!item.answer_draft ? <span className="text-xs text-muted-foreground">Save an answer to get feedback.</span> : null}
        </div>
        {state?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
        {feedbackError ? (
          <p role="alert" className="text-sm text-destructive">
            {feedbackError}
          </p>
        ) : null}
      </form>

      {review ? (
        <div className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
          {stale ? <p className="text-xs text-amber-700 dark:text-amber-300">You&apos;ve changed your answer since this feedback. Get new feedback to refresh it.</p> : null}
          <p>{review.summary}</p>
          <p className="text-xs text-muted-foreground">
            Specificity {review.scores.specificity} · Structure {review.scores.structure} · Relevance {review.scores.relevance} (guidance only) ·
            Covers:{" "}
            {(["situation", "task", "action", "result"] as const)
              .map((k) => `${k[0].toUpperCase()}${k.slice(1)} ${review.star[k] ? "✓" : "✗"}`)
              .join(", ")}
          </p>
          {review.strengths.length ? (
            <div>
              <p className="font-medium">Working well</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {review.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {review.improvements.length ? (
            <div>
              <p className="font-medium">To improve</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {review.improvements.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {review.unsupported_claims.length ? (
            <div>
              <p className="font-medium">Claims to double-check</p>
              <ul className="space-y-1 text-muted-foreground">
                {review.unsupported_claims.map((c, i) => (
                  <li key={i}>
                    &ldquo;{c.claim}&rdquo;: {c.concern}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
