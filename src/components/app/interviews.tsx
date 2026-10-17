"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createRound, deleteRound, updateRound } from "@/app/(app)/applications/interview-actions";
import { Field } from "@/components/app/field";
import { LocalTime } from "@/components/app/local-time";
import { SubmitButton } from "@/components/app/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  ROUND_STATUSES,
  ROUND_STATUS_LABEL,
  ROUND_TYPES,
  ROUND_TYPE_LABEL,
  type InterviewRound,
} from "@/lib/domain";
import { useSafeForm } from "@/lib/use-safe-form";

const subscribe = () => () => {};

/** An ISO instant as the value of a datetime-local input, in the viewer's own time zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");

function useLocalDateTime(initialIso: string | null) {
  // Server renders "" (no time zone known); the browser fills in the local value after hydration.
  const initial = useSyncExternalStore(subscribe, () => toLocalInput(initialIso), () => "");
  const [override, setOverride] = useState<string | null>(null);
  return [override ?? initial, setOverride] as const;
}

function RoundFields({ round, idPrefix }: { round?: InterviewRound; idPrefix: string }) {
  const [when, setWhen] = useLocalDateTime(round?.scheduled_at ?? null);
  return (
    <>
      <Field label="Type" htmlFor={`${idPrefix}-type`}>
        <NativeSelect id={`${idPrefix}-type`} name="round_type" defaultValue={round?.round_type ?? "technical"}>
          {ROUND_TYPES.map((t) => (
            <option key={t} value={t}>
              {ROUND_TYPE_LABEL[t]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="When (your local time)" htmlFor={`${idPrefix}-when`}>
        <Input id={`${idPrefix}-when`} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <input type="hidden" name="scheduled_at" value={toIso(when)} />
      </Field>
      <Field label="Length (minutes)" htmlFor={`${idPrefix}-dur`}>
        <Input
          id={`${idPrefix}-dur`}
          name="duration_minutes"
          type="number"
          min={5}
          max={600}
          defaultValue={round?.duration_minutes ?? ""}
        />
      </Field>
      <Field label="Where or link" htmlFor={`${idPrefix}-loc`}>
        <Input id={`${idPrefix}-loc`} name="location" maxLength={500} defaultValue={round?.location ?? ""} placeholder="Zoom link or address" />
      </Field>
      <Field label="Interviewers" htmlFor={`${idPrefix}-who`} className="sm:col-span-2">
        <Input id={`${idPrefix}-who`} name="interviewers" maxLength={500} defaultValue={round?.interviewers ?? ""} />
      </Field>
      <Field label="Prep notes" htmlFor={`${idPrefix}-prep`} className="sm:col-span-2">
        <Textarea id={`${idPrefix}-prep`} name="prep_notes" rows={3} maxLength={10000} defaultValue={round?.prep_notes ?? ""} />
      </Field>
    </>
  );
}

export function AddInterviewForm({ applicationId }: { applicationId: string }) {
  const { state, onSubmit, pending } = useSafeForm(createRound.bind(null, applicationId));
  const formRef = useRef<HTMLFormElement>(null);
  const handled = useRef(state);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (!state?.error) {
      toast.success("Interview added");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <RoundFields idPrefix="new-round" />
      <input type="hidden" name="status" value="scheduled" />
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pending={pending} pendingText="Adding…">
          Add interview
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

export function RoundCard({ round, conflict }: { round: InterviewRound; conflict: boolean }) {
  const { state, onSubmit, pending } = useSafeForm(updateRound.bind(null, round.id));
  const handled = useRef(state);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (!state?.error) toast.success("Interview saved");
  }, [state]);

  return (
    <li className="rounded-lg border">
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <span className="font-medium">
            {ROUND_TYPE_LABEL[round.round_type]}
            {round.scheduled_at ? (
              <span className="ml-2 font-normal text-muted-foreground">
                <LocalTime iso={round.scheduled_at} />
              </span>
            ) : (
              <span className="ml-2 font-normal text-muted-foreground">No time set</span>
            )}
          </span>
          <span className="flex items-center gap-2">
            {conflict ? (
              <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-300">
                Overlaps another interview
              </Badge>
            ) : null}
            <Badge variant="secondary">{ROUND_STATUS_LABEL[round.status]}</Badge>
          </span>
        </summary>
        <form onSubmit={onSubmit} className="grid gap-3 border-t p-3 sm:grid-cols-2">
          <Field label="Status" htmlFor={`${round.id}-status`}>
            <NativeSelect id={`${round.id}-status`} name="status" defaultValue={round.status}>
              {ROUND_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ROUND_STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div />
          <RoundFields round={round} idPrefix={round.id} />
          <Field label="Questions they asked" htmlFor={`${round.id}-qs`} className="sm:col-span-2">
            <Textarea id={`${round.id}-qs`} name="questions_asked" rows={3} maxLength={10000} defaultValue={round.questions_asked ?? ""} />
          </Field>
          <Field label="Debrief" htmlFor={`${round.id}-debrief`} hint="How it went, what to follow up on." className="sm:col-span-2">
            <Textarea id={`${round.id}-debrief`} name="debrief" rows={4} maxLength={10000} defaultValue={round.debrief ?? ""} />
          </Field>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <SubmitButton pending={pending}>Save interview</SubmitButton>
            {state?.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
          </div>
        </form>
        <form
          action={deleteRound.bind(null, round.id)}
          onSubmit={(e) => {
            if (!window.confirm("Delete this interview?")) e.preventDefault();
          }}
          className="border-t p-3"
        >
          <Button type="submit" variant="ghost" size="sm">
            <Trash2 aria-hidden="true" /> Delete interview
          </Button>
        </form>
      </details>
    </li>
  );
}
