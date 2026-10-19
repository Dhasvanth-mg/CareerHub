"use client";

import { useRef } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createEvidence, deleteEvidence, updateEvidence } from "@/app/(app)/evidence/actions";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { EVIDENCE_KINDS, EVIDENCE_KIND_LABEL, type EvidenceKind } from "@/lib/domain";
import { useOnComplete, useSafeForm } from "@/lib/use-safe-form";

export type EvidenceRow = {
  id: string;
  kind: EvidenceKind;
  title: string;
  when_text: string | null;
  details: string | null;
  outcome: string | null;
  link: string | null;
};

function Fields({ item, idPrefix }: { item?: EvidenceRow; idPrefix: string }) {
  return (
    <>
      <Field label="Type" htmlFor={`${idPrefix}-kind`}>
        <NativeSelect id={`${idPrefix}-kind`} name="kind" defaultValue={item?.kind ?? "project"}>
          {EVIDENCE_KINDS.map((k) => (
            <option key={k} value={k}>
              {EVIDENCE_KIND_LABEL[k]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Title" htmlFor={`${idPrefix}-title`}>
        <Input id={`${idPrefix}-title`} name="title" required maxLength={200} defaultValue={item?.title ?? ""} placeholder="Line-following robot" />
      </Field>
      <Field label="When" htmlFor={`${idPrefix}-when`} hint="For example Fall 2025, or 2024 to present.">
        <Input id={`${idPrefix}-when`} name="when_text" maxLength={100} defaultValue={item?.when_text ?? ""} />
      </Field>
      <Field label="Link (optional)" htmlFor={`${idPrefix}-link`}>
        <Input id={`${idPrefix}-link`} name="link" type="url" placeholder="https://…" defaultValue={item?.link ?? ""} />
      </Field>
      <Field label="What you did" htmlFor={`${idPrefix}-details`} hint="In your own words. Only things that are true." className="sm:col-span-2">
        <Textarea id={`${idPrefix}-details`} name="details" rows={4} maxLength={4000} defaultValue={item?.details ?? ""} />
      </Field>
      <Field label="Result or impact" htmlFor={`${idPrefix}-outcome`} hint="Real numbers or outcomes if you have them." className="sm:col-span-2">
        <Textarea id={`${idPrefix}-outcome`} name="outcome" rows={2} maxLength={1000} defaultValue={item?.outcome ?? ""} />
      </Field>
    </>
  );
}

export function AddEvidenceForm() {
  const form = useSafeForm(createEvidence);
  const { state, onSubmit, pending } = form;
  const formRef = useRef<HTMLFormElement>(null);
  useOnComplete(form, () => {
    if (!state?.error) {
      formRef.current?.reset();
      toast.success("Added to your evidence library");
    }
  });
  return (
    <form ref={formRef} method="post" onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <Fields idPrefix="new-ev" />
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pending={pending}>Add to library</SubmitButton>
        {state?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function EvidenceCard({ item }: { item: EvidenceRow }) {
  const form = useSafeForm(updateEvidence.bind(null, item.id));
  const { state, onSubmit, pending } = form;
  useOnComplete(form, () => {
    if (!state?.error) toast.success("Saved");
  });
  return (
    <li className="rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06]">
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <span className="font-medium">
            {item.title}
            {item.when_text ? <span className="ml-2 font-normal text-muted-foreground">{item.when_text}</span> : null}
          </span>
          <Badge variant="secondary">{EVIDENCE_KIND_LABEL[item.kind]}</Badge>
        </summary>
        <form method="post" onSubmit={onSubmit} className="grid gap-3 border-t p-3 sm:grid-cols-2">
          <Fields item={item} idPrefix={item.id} />
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <SubmitButton pending={pending}>Save</SubmitButton>
            {state?.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
          </div>
        </form>
        <form
          action={deleteEvidence.bind(null, item.id)}
          onSubmit={(e) => {
            if (!window.confirm(`Delete "${item.title}"?`)) e.preventDefault();
          }}
          className="border-t p-3"
        >
          <Button type="submit" variant="ghost" size="sm">
            <Trash2 aria-hidden="true" /> Delete
          </Button>
        </form>
      </details>
    </li>
  );
}
