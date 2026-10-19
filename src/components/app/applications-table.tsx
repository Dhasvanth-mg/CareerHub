"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { bulkApplications } from "@/app/(app)/applications/bulk-actions";
import { LocalTime } from "@/components/app/local-time";
import { Monogram } from "@/components/app/monogram";
import { DeadlineBadge, StageBadge } from "@/components/app/stage-badge";
import { SubmitButton } from "@/components/app/submit-button";
import { NativeSelect } from "@/components/ui/native-select";
import { CONSEQUENTIAL_STAGES, STAGES, STAGE_LABEL, type Stage } from "@/lib/domain";
import { useOnComplete, useSafeForm } from "@/lib/use-safe-form";

export type TableRow = {
  id: string;
  company_name: string;
  title: string;
  stage: Stage;
  deadline: string | null;
  updated_at: string;
};

type Header = { key: string; label: string; href: string; aria: "ascending" | "descending" | undefined; arrow: string };

export function ApplicationsTable({ rows, headers, archivedView }: { rows: TableRow[]; headers: Header[]; archivedView: boolean }) {
  const form = useSafeForm(bulkApplications);
  const { state, onSubmit, pending } = form;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [op, setOp] = useState<"move" | "archive" | "restore" | "delete">(archivedView ? "restore" : "move");
  const [stage, setStage] = useState<Stage>("applied");
  const formRef = useRef<HTMLFormElement>(null);

  useOnComplete(form, () => {
    if (state?.message) {
      toast.success(state.message);
      setSelected(new Set());
    }
  });

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function guard(e: React.FormEvent<HTMLFormElement>) {
    if (op === "delete" && !window.confirm(`Permanently delete ${selected.size} application${selected.size === 1 ? "" : "s"}? This can't be undone.`)) {
      e.preventDefault();
      return;
    }
    if (op === "move" && CONSEQUENTIAL_STAGES.includes(stage) && !window.confirm(`Move ${selected.size} to ${STAGE_LABEL[stage]}?`)) {
      e.preventDefault();
      return;
    }
    onSubmit(e);
  }

  return (
    <form ref={formRef} method="post" onSubmit={guard} className="space-y-3">
      <div
        className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/70 p-2 text-sm"
        role="group"
        aria-label="Bulk actions"
      >
        <span className="px-1 tabular-nums" aria-live="polite">
          {selected.size} selected
        </span>
        <label className="sr-only" htmlFor="bulk-op">
          Action
        </label>
        <NativeSelect id="bulk-op" name="op" value={op} onChange={(e) => setOp(e.target.value as typeof op)} className="w-36">
          {archivedView ? null : <option value="move">Move to…</option>}
          {archivedView ? <option value="restore">Restore</option> : <option value="archive">Archive</option>}
          <option value="delete">Delete</option>
        </NativeSelect>
        {op === "move" ? (
          <>
            <label className="sr-only" htmlFor="bulk-stage">
              Stage
            </label>
            <NativeSelect id="bulk-stage" name="stage" value={stage} onChange={(e) => setStage(e.target.value as Stage)} className="w-36">
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </>
        ) : null}
        <SubmitButton pending={pending} disabled={selected.size === 0} variant={op === "delete" ? "destructive" : "secondary"} size="sm" pendingText="Working…">
          Apply
        </SubmitButton>
        {state?.error ? (
          <p role="alert" className="text-destructive">
            {state.error}
          </p>
        ) : null}
      </div>

      {[...selected].map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}

      <div className="overflow-x-auto rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06]">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Applications</caption>
          <thead className="border-b text-muted-foreground">
            <tr>
              <th scope="col" className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  aria-label="Select all applications"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                />
              </th>
              {headers.map((h) => (
                <th key={h.key} scope="col" aria-sort={h.aria} className="px-3 py-3 text-xs font-medium">
                  <Link href={h.href} className="hover:text-foreground">
                    {h.label}
                    {h.arrow}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((a) => (
              <tr key={a.id} className={selected.has(a.id) ? "bg-accent/70" : "transition-colors hover:bg-accent/40"}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`Select ${a.title} at ${a.company_name}`}
                    checked={selected.has(a.id)}
                    onChange={() => toggle(a.id)}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-3">
                    <Monogram company={a.company_name} stage={a.stage} className="size-7 text-xs" />
                    <span className="font-medium">{a.company_name}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <Link href={`/applications/${a.id}`} className="underline-offset-4 hover:underline">
                    {a.title}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <StageBadge stage={a.stage} />
                </td>
                <td className="px-3 py-2">
                  {a.deadline ? <DeadlineBadge date={a.deadline} /> : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  <LocalTime iso={a.updated_at} dateOnly />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
