"use client";

import { useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createOffer, deleteOffer, saveOfferWeights, updateOffer } from "@/app/(app)/offers/actions";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { WORK_MODES, WORK_MODE_LABEL } from "@/lib/domain";
import {
  ALL_CRITERIA,
  DEFAULT_WEIGHT,
  HOURS_PER_YEAR,
  OFFER_CRITERIA,
  clampWeight,
  mixedCurrencies,
  scoreOffers,
  totalCash,
  type OfferIn,
  type Weights,
} from "@/lib/offers";
import { useOnComplete, useSafeForm } from "@/lib/use-safe-form";

export type OfferRow = OfferIn & {
  application_id: string;
  equity_text: string | null;
  benefits_text: string | null;
  location: string | null;
  work_mode: "remote" | "hybrid" | "on_site" | null;
  start_date: string | null;
  decision_deadline: string | null;
  notes: string | null;
};

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString()}`;
  }
};

function OfferFields({ offer, idPrefix }: { offer?: OfferRow; idPrefix: string }) {
  return (
    <>
      <Field label="Currency" htmlFor={`${idPrefix}-cur`} hint="3-letter code. We never convert between currencies.">
        <Input id={`${idPrefix}-cur`} name="currency" maxLength={3} defaultValue={offer?.currency ?? "USD"} className="uppercase" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Base pay" htmlFor={`${idPrefix}-base`}>
          <Input id={`${idPrefix}-base`} name="base_amount" inputMode="decimal" defaultValue={offer?.base_amount ?? ""} />
        </Field>
        <Field label="Per" htmlFor={`${idPrefix}-period`}>
          <NativeSelect id={`${idPrefix}-period`} name="pay_period" defaultValue={offer?.pay_period ?? "year"}>
            <option value="year">Year</option>
            <option value="month">Month</option>
            <option value="hour">Hour</option>
          </NativeSelect>
        </Field>
      </div>
      <Field label="Bonus (per year, if any)" htmlFor={`${idPrefix}-bonus`}>
        <Input id={`${idPrefix}-bonus`} name="bonus_amount" inputMode="decimal" defaultValue={offer?.bonus_amount ?? ""} />
      </Field>
      <Field label="Equity or other pay" htmlFor={`${idPrefix}-equity`}>
        <Input id={`${idPrefix}-equity`} name="equity_text" maxLength={500} defaultValue={offer?.equity_text ?? ""} />
      </Field>
      <Field label="Location" htmlFor={`${idPrefix}-loc`}>
        <Input id={`${idPrefix}-loc`} name="location" maxLength={200} defaultValue={offer?.location ?? ""} />
      </Field>
      <Field label="Work arrangement" htmlFor={`${idPrefix}-mode`}>
        <NativeSelect id={`${idPrefix}-mode`} name="work_mode" defaultValue={offer?.work_mode ?? ""}>
          <option value="">Not specified</option>
          {WORK_MODES.map((m) => (
            <option key={m} value={m}>
              {WORK_MODE_LABEL[m]}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Start date" htmlFor={`${idPrefix}-start`}>
        <Input id={`${idPrefix}-start`} name="start_date" type="date" defaultValue={offer?.start_date ?? ""} />
      </Field>
      <Field label="Decision deadline" htmlFor={`${idPrefix}-deadline`}>
        <Input id={`${idPrefix}-deadline`} name="decision_deadline" type="date" defaultValue={offer?.decision_deadline ?? ""} />
      </Field>
      <Field label="Benefits (as offered)" htmlFor={`${idPrefix}-benefits`} hint="Only what the offer actually says." className="sm:col-span-2">
        <Textarea id={`${idPrefix}-benefits`} name="benefits_text" rows={3} maxLength={2000} defaultValue={offer?.benefits_text ?? ""} />
      </Field>
      <fieldset className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-medium">Your ratings (1 = poor, 5 = great)</legend>
        {OFFER_CRITERIA.map((c) => (
          <Field key={c.key} label={c.label} htmlFor={`${idPrefix}-r-${c.key}`}>
            <NativeSelect id={`${idPrefix}-r-${c.key}`} name={`r_${c.key}`} defaultValue={offer?.ratings[c.key] ?? ""}>
              <option value="">Not rated</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ))}
      </fieldset>
      <Field label="Notes and negotiation" htmlFor={`${idPrefix}-notes`} className="sm:col-span-2">
        <Textarea id={`${idPrefix}-notes`} name="notes" rows={3} maxLength={5000} defaultValue={offer?.notes ?? ""} />
      </Field>
    </>
  );
}

export function AddOfferForm({ applications }: { applications: { id: string; label: string }[] }) {
  const form = useSafeForm(createOffer);
  const { state, onSubmit, pending } = form;
  const formRef = useRef<HTMLFormElement>(null);
  useOnComplete(form, () => {
    if (!state?.error) {
      formRef.current?.reset();
      toast.success("Offer saved");
    }
  });
  if (applications.length === 0) {
    return <p className="text-sm text-muted-foreground">Every application already has an offer saved, or you have no applications yet.</p>;
  }
  return (
    <form ref={formRef} method="post" onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Application" htmlFor="new-offer-app" className="sm:col-span-2">
        <NativeSelect id="new-offer-app" name="application_id" defaultValue={applications[0]?.id} required>
          {applications.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <OfferFields idPrefix="new-offer" />
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pending={pending}>Save offer</SubmitButton>
        {state?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function OfferCard({ offer }: { offer: OfferRow }) {
  const form = useSafeForm(updateOffer.bind(null, offer.id));
  const { state, onSubmit, pending } = form;
  useOnComplete(form, () => {
    if (!state?.error) toast.success("Offer updated");
  });
  const total = totalCash(offer);
  return (
    <li className="rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06]">
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <span className="font-medium">{offer.label}</span>
          <span className="text-muted-foreground">{total === null ? "No pay entered" : `${money(total, offer.currency)} / year`}</span>
        </summary>
        <form method="post" onSubmit={onSubmit} className="grid gap-3 border-t p-3 sm:grid-cols-2">
          <OfferFields offer={offer} idPrefix={offer.id} />
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <SubmitButton pending={pending}>Save changes</SubmitButton>
            {state?.error ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
          </div>
        </form>
        <form
          action={deleteOffer.bind(null, offer.id)}
          onSubmit={(e) => {
            if (!window.confirm(`Delete the offer from ${offer.label}?`)) e.preventDefault();
          }}
          className="border-t p-3"
        >
          <Button type="submit" variant="ghost" size="sm">
            <Trash2 aria-hidden="true" /> Delete offer
          </Button>
        </form>
      </details>
    </li>
  );
}

export function OfferComparison({ offers, initialWeights }: { offers: OfferRow[]; initialWeights: Weights }) {
  const [weights, setWeights] = useState<Weights>(() => Object.fromEntries(ALL_CRITERIA.map((c) => [c.key, clampWeight(initialWeights[c.key] ?? DEFAULT_WEIGHT)])));
  const form = useSafeForm(saveOfferWeights);
  const { state, onSubmit, pending } = form;
  useOnComplete(form, () => {
    if (state?.message) toast.success(state.message);
  });

  const scores = useMemo(() => scoreOffers(offers, weights), [offers, weights]);
  const top = Math.max(...scores.map((s) => s.total ?? -1));
  const mixed = mixedCurrencies(offers);

  return (
    <div className="space-y-4">
      <form method="post" onSubmit={onSubmit} className="space-y-3">
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="mb-1 text-sm font-medium">How much does each thing matter to you? (0 to 10)</legend>
          {ALL_CRITERIA.map((c) => (
            <div key={c.key} className="space-y-1">
              <label htmlFor={`w-${c.key}`} className="text-sm">
                {c.label}
              </label>
              <Input
                id={`w-${c.key}`}
                name={`w_${c.key}`}
                type="number"
                min={0}
                max={10}
                value={weights[c.key] ?? DEFAULT_WEIGHT}
                onChange={(e) => setWeights((w) => ({ ...w, [c.key]: clampWeight(e.target.value) }))}
              />
            </div>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending={pending} variant="secondary" size="sm">
            Save my weights
          </SubmitButton>
          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
        </div>
      </form>

      {mixed ? (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          These offers use different currencies. We don&apos;t convert between them, so pay isn&apos;t scored. Compare the amounts yourself and rate
          the rest.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06]">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <caption className="sr-only">Offer comparison</caption>
          <thead className="border-b bg-muted/40">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                &nbsp;
              </th>
              {offers.map((o) => (
                <th key={o.id} scope="col" className="px-3 py-2 font-medium">
                  {o.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <th scope="row" className="px-3 py-2 font-medium">
                Yearly pay
              </th>
              {offers.map((o) => {
                const t = totalCash(o);
                return (
                  <td key={o.id} className="px-3 py-2">
                    {t === null ? "—" : money(t, o.currency)}
                    {o.pay_period === "hour" && t !== null ? (
                      <span className="block text-xs text-muted-foreground">Hourly pay counted as {HOURS_PER_YEAR.toLocaleString()} hours a year</span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row" className="px-3 py-2 font-medium">
                Decision deadline
              </th>
              {offers.map((o) => (
                <td key={o.id} className="px-3 py-2">
                  {o.decision_deadline ?? "—"}
                </td>
              ))}
            </tr>
            {ALL_CRITERIA.map((c) => (
              <tr key={c.key}>
                <th scope="row" className="px-3 py-2 font-normal text-muted-foreground">
                  {c.label} <span className="text-xs">(weight {weights[c.key] ?? DEFAULT_WEIGHT})</span>
                </th>
                {scores.map((s) => {
                  const contribution = s.contributions.find((x) => x.key === c.key);
                  return (
                    <td key={s.id} className="px-3 py-2 tabular-nums">
                      {contribution ? contribution.value.toFixed(contribution.key === "compensation" ? 1 : 0) : <span className="text-muted-foreground">Not rated</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-muted/30">
              <th scope="row" className="px-3 py-2 font-medium">
                Score on your weights
              </th>
              {scores.map((s) => (
                <td key={s.id} className="px-3 py-2">
                  {s.total === null ? (
                    <span className="text-muted-foreground">Not enough ratings</span>
                  ) : (
                    <>
                      <span className="text-lg font-semibold tabular-nums">{s.total}</span>
                      <span className="text-muted-foreground"> / 100</span>
                      {s.total === top && scores.filter((x) => x.total === top).length === 1 ? (
                        <Badge variant="secondary" className="ml-2">
                          Highest on your weights
                        </Badge>
                      ) : null}
                      <span className="block text-xs text-muted-foreground">
                        Based on {s.ratedCount} of {ALL_CRITERIA.length} criteria
                      </span>
                    </>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <details className="rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] p-4 text-sm">
        <summary className="cursor-pointer font-medium">How this is calculated</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Each criterion you rated is scored 1 to 5 and multiplied by its weight. The score is the total as a share of the best possible.</li>
          <li>Criteria you left unrated are skipped, and the score says how many were used.</li>
          <li>Pay is scored 1 to 5 against the highest yearly pay among offers in the same currency. Monthly pay is multiplied by 12.</li>
          <li>The score only reflects what you entered. It isn&apos;t advice, and a higher number doesn&apos;t mean an offer is right for you.</li>
        </ul>
      </details>
    </div>
  );
}
