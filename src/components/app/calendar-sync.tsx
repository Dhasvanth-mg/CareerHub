"use client";

import { useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { importCalendarEvents } from "@/app/(app)/calendar/sync/actions";
import { LocalTime } from "@/components/app/local-time";
import { SubmitButton } from "@/components/app/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { MAX_ICS_CHARS, parseIcs, type ParsedEvent } from "@/lib/ics";
import { useOnComplete, useSafeForm } from "@/lib/use-safe-form";

// ---------------------------------------------------------------- export

export type ExportItem = { key: string; kind: "interview" | "task" | "deadline"; title: string; at: string; allDay: boolean };

const KIND_LABEL = { interview: "Interviews", task: "Task due dates", deadline: "Application deadlines" } as const;
const KINDS = ["interview", "task", "deadline"] as const;

const checkbox = "mt-0.5 size-4 shrink-0 accent-primary";

export function ExportPicker({ items }: { items: ExportItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(items.map((i) => i.key)));

  const setMany = (keys: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing to export yet. Interviews, task due dates and deadlines will show up here.</p>;
  }

  return (
    <form method="post" action="/api/calendar/export" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setMany(items.map((i) => i.key), true)}>
          Select all
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setMany(items.map((i) => i.key), false)}>
          Clear
        </Button>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {selected.size} of {items.length} selected
        </span>
      </div>

      {KINDS.map((kind) => {
        const group = items.filter((i) => i.kind === kind);
        if (group.length === 0) return null;
        const allOn = group.every((i) => selected.has(i.key));
        return (
          <fieldset key={kind} className="rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06]">
            <legend className="sr-only">{KIND_LABEL[kind]}</legend>
            <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
              <h3 className="text-sm font-medium">
                {KIND_LABEL[kind]} <span className="font-normal text-muted-foreground">({group.length})</span>
              </h3>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMany(group.map((i) => i.key), !allOn)}>
                {allOn ? "Clear these" : "Select these"}
              </Button>
            </div>
            <ul className="max-h-72 divide-y overflow-y-auto text-sm">
              {group.map((i) => (
                <li key={i.key}>
                  <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/40">
                    <input
                      type="checkbox"
                      name="sel"
                      value={i.key}
                      className={checkbox}
                      checked={selected.has(i.key)}
                      onChange={(e) => setMany([i.key], e.target.checked)}
                    />
                    <span className="min-w-0 flex-1 break-words">{i.title}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {i.allDay ? <LocalTime iso={`${i.at}T12:00:00Z`} dateOnly /> : <LocalTime iso={i.at} />}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={selected.size === 0}>
          Download {selected.size} event{selected.size === 1 ? "" : "s"} (.ics)
        </Button>
        <a href="/api/calendar/export" className="text-sm text-muted-foreground underline underline-offset-4">
          Download everything
        </a>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- import

type Row = ParsedEvent & { key: string; past: boolean };

export function ImportPicker({ applications }: { applications: { id: string; label: string }[] }) {
  const fileId = useId();
  const appId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [readError, setReadError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const form = useSafeForm(importCalendarEvents);
  const { state, onSubmit, pending } = form;

  useOnComplete(form, () => {
    if (state?.message) {
      toast.success(state.message);
      setRows([]);
      setSelected(new Set());
      setWarnings([]);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    }
  });

  async function onFile(file: File | undefined) {
    setReadError("");
    setWarnings([]);
    setRows([]);
    setSelected(new Set());
    setFileName(file?.name ?? "");
    if (!file) return;
    if (file.size > MAX_ICS_CHARS) {
      setReadError("That file is too large to import (limit about 2 MB).");
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setReadError("Could not read that file.");
      return;
    }
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const result = parseIcs(text, zone);
    const now = Date.now();
    const parsed = result.events.map((e, i) => ({ ...e, key: `${i}`, past: Date.parse(e.start) < now - 3_600_000 }));
    setRows(parsed);
    setWarnings(result.warnings);
    // Tick upcoming events by default. Past events, cancelled ones and our own export are left for the user to opt into.
    setSelected(new Set(parsed.filter((e) => !e.own && !e.cancelled && !e.past).map((e) => e.key)));
  }

  const setMany = (keys: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });

  const payload = useMemo(
    () =>
      JSON.stringify(
        rows
          .filter((r) => selected.has(r.key))
          .map(({ uid, title, start, allDay, end, location, description }) => ({ uid, title, start, allDay, end, location, description })),
      ),
    [rows, selected],
  );
  const upcomingKeys = rows.filter((e) => !e.past).map((e) => e.key);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor={fileId} className="text-sm font-medium">
          Calendar file (.ics)
        </label>
        <Input
          id={fileId}
          ref={fileRef}
          type="file"
          accept=".ics,text/calendar"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <p className="text-xs text-muted-foreground">
          Exported from Google Calendar, Apple Calendar or Outlook. The file is read in your browser; only the events you tick are sent.
        </p>
        {readError ? (
          <p role="alert" className="text-sm text-destructive">
            {readError}
          </p>
        ) : null}
      </div>

      {warnings.length > 0 ? (
        <ul className="space-y-1 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100" role="status">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      {rows.length > 0 ? (
        <form method="post" onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="events" value={payload} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setMany(upcomingKeys, true)}>
              Select upcoming
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setMany(rows.map((r) => r.key), true)}>
              Select all
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setMany(rows.map((r) => r.key), false)}>
              Clear
            </Button>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {selected.size} of {rows.length} selected from {fileName}
            </span>
          </div>

          <ul className="max-h-96 divide-y overflow-y-auto rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] text-sm">
            {rows.map((r) => {
              return (
                <li key={r.key}>
                  <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/40">
                    <input
                      type="checkbox"
                      className={checkbox}
                      checked={selected.has(r.key)}
                      onChange={(e) => setMany([r.key], e.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words font-medium">{r.title}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {r.past ? <Badge variant="outline">Past</Badge> : null}
                        {r.allDay ? <Badge variant="secondary">All day</Badge> : null}
                        {r.recurring ? <Badge variant="secondary">Repeats: first only</Badge> : null}
                        {r.own ? <Badge variant="outline">From CareerHub</Badge> : null}
                        {r.cancelled ? <Badge variant="destructive">Cancelled</Badge> : null}
                        {r.zoneAssumed ? <Badge variant="destructive">Unknown time zone: UTC assumed</Badge> : null}
                      </span>
                      {r.location ? <span className="mt-1 block break-words text-xs text-muted-foreground">{r.location}</span> : null}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {r.allDay ? <LocalTime iso={r.start} dateOnly /> : <LocalTime iso={r.start} />}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor={appId} className="text-sm font-medium">
                Link to an application (optional)
              </label>
              <NativeSelect id={appId} name="application_id" defaultValue="">
                <option value="">General tasks</option>
                {applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pending={pending} pendingText="Adding…" disabled={selected.size === 0}>
              Add {selected.size} as task{selected.size === 1 ? "" : "s"}
            </SubmitButton>
            {state?.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
