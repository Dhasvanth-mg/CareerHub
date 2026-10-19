"use client";

import { useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { importApplications } from "@/app/(app)/applications/import/actions";
import { SubmitButton } from "@/components/app/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  IMPORT_FIELDS,
  MAX_CSV_CHARS,
  MAX_IMPORT_ROWS,
  TEMPLATE_CSV,
  guessMapping,
  parseCsv,
  prepareRow,
  type DateOrder,
  type ImportField,
} from "@/lib/csv-import";
import { STAGE_LABEL } from "@/lib/domain";
import { useOnComplete, useSafeForm } from "@/lib/use-safe-form";

type Mapping = Partial<Record<ImportField, number>>;

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "careerhub-applications-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ApplicationImport() {
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [order, setOrder] = useState<DateOrder>("month-first");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [readError, setReadError] = useState("");
  const [truncated, setTruncated] = useState(false);

  const form = useSafeForm(importApplications);
  const { state, onSubmit, pending } = form;

  function reset() {
    setFileName("");
    setHeaders([]);
    setData([]);
    setMapping({});
    setExcluded(new Set());
    setTruncated(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  useOnComplete(form, () => {
    if (state?.message) {
      toast.success(state.message);
      reset();
    }
  });

  async function onFile(file: File | undefined) {
    setReadError("");
    reset();
    if (!file) return;
    setFileName(file.name);
    if (file.size > MAX_CSV_CHARS) {
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
    const rows = parseCsv(text);
    if (rows.length < 2) {
      setReadError("That file needs a header row and at least one row of data.");
      return;
    }
    const [head, ...body] = rows;
    setHeaders(head.map((h) => h.trim()));
    setMapping(guessMapping(head));
    setTruncated(body.length > MAX_IMPORT_ROWS);
    setData(body.slice(0, MAX_IMPORT_ROWS));
  }

  const prepared = useMemo(() => data.map((cells) => prepareRow(cells, mapping, order)), [data, mapping, order]);
  const importable = prepared.map((p, i) => (p.row && !excluded.has(i) ? i : -1)).filter((i) => i >= 0);
  const validCount = prepared.filter((p) => p.row).length;
  const payload = useMemo(() => JSON.stringify(importable.map((i) => prepared[i].row)), [importable, prepared]);
  const missingRequired = IMPORT_FIELDS.filter((f) => f.required && mapping[f.key] === undefined);

  const toggle = (i: number, on: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (on) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <label htmlFor={fileId} className="text-sm font-medium">
          CSV file
        </label>
        <Input id={fileId} ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} />
        <p className="text-xs text-muted-foreground">
          The file is read in your browser and only the rows you keep are sent. No file yet?{" "}
          <button type="button" onClick={downloadTemplate} className="underline underline-offset-4">
            Download a template
          </button>
          .
        </p>
        {readError ? (
          <p role="alert" className="text-sm text-destructive">
            {readError}
          </p>
        ) : null}
      </div>

      {headers.length > 0 ? (
        <form method="post" onSubmit={onSubmit} className="space-y-6">
          <input type="hidden" name="rows" value={payload} />

          <section aria-labelledby="columns" className="space-y-3">
            <h2 id="columns" className="text-xl">
              Match your columns
            </h2>
            <p className="text-sm text-muted-foreground">We guessed from your headers. Change any that look wrong.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {IMPORT_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <label htmlFor={`map-${f.key}`} className="text-sm font-medium">
                    {f.label}
                    {f.required ? <span className="text-destructive"> *</span> : null}
                  </label>
                  <NativeSelect
                    id={`map-${f.key}`}
                    value={mapping[f.key] === undefined ? "" : String(mapping[f.key])}
                    onChange={(e) =>
                      setMapping((m) => {
                        const next = { ...m };
                        if (e.target.value === "") delete next[f.key];
                        else next[f.key] = Number(e.target.value);
                        return next;
                      })
                    }
                  >
                    <option value="">{f.required ? "Choose a column…" : "Not in my file"}</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `(column ${i + 1})`}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ))}
              <div className="space-y-1">
                <label htmlFor="date-order" className="text-sm font-medium">
                  Dates like 3/4/2026 mean
                </label>
                <NativeSelect id="date-order" value={order} onChange={(e) => setOrder(e.target.value as DateOrder)}>
                  <option value="month-first">March 4 (month first)</option>
                  <option value="day-first">3 April (day first)</option>
                </NativeSelect>
              </div>
            </div>
            {missingRequired.length > 0 ? (
              <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
                Choose the column for: {missingRequired.map((f) => f.label).join(", ")}.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="preview" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="preview" className="text-xl">
                Review rows
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setExcluded(new Set())}>
                  Select all
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setExcluded(new Set(data.map((_, i) => i)))}>
                  Clear
                </Button>
                <span className="text-sm text-muted-foreground" aria-live="polite">
                  {importable.length} of {data.length} selected from {fileName}
                  {validCount < data.length ? ` (${data.length - validCount} can't be imported)` : ""}
                </span>
              </div>
            </div>
            {truncated ? (
              <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
                Only the first {MAX_IMPORT_ROWS} rows are shown. Split the file to import the rest.
              </p>
            ) : null}

            <div className="max-h-[28rem] overflow-auto rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06]">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th scope="col" className="w-10 p-2">
                      <span className="sr-only">Import</span>
                    </th>
                    <th scope="col" className="p-2">Company</th>
                    <th scope="col" className="p-2">Role</th>
                    <th scope="col" className="p-2">Stage</th>
                    <th scope="col" className="p-2">Applied</th>
                    <th scope="col" className="p-2">Deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {prepared.map((p, i) => (
                    <tr key={i} className={p.row ? "" : "bg-destructive/5"}>
                      <td className="p-2 align-top">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          aria-label={`Import row ${i + 1}`}
                          disabled={!p.row}
                          checked={Boolean(p.row) && !excluded.has(i)}
                          onChange={(e) => toggle(i, e.target.checked)}
                        />
                      </td>
                      <td className="p-2 align-top">
                        {p.row?.company_name ?? <span className="text-muted-foreground">—</span>}
                        {p.problems.length > 0 || p.notes.length > 0 ? (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.problems.map((x) => (
                              <Badge key={x} variant="destructive">
                                {x}
                              </Badge>
                            ))}
                            {p.notes.map((x) => (
                              <Badge key={x} variant="outline">
                                {x}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-2 align-top">{p.row?.title ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="p-2 align-top">{p.row ? STAGE_LABEL[p.row.stage] : ""}</td>
                      <td className="whitespace-nowrap p-2 align-top">{p.row?.applied_on ?? ""}</td>
                      <td className="whitespace-nowrap p-2 align-top">{p.row?.deadline ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pending={pending} pendingText="Importing…" disabled={importable.length === 0}>
              Import {importable.length} application{importable.length === 1 ? "" : "s"}
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
