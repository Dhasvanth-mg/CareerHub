/**
 * Offer comparison maths. Pure and transparent:
 * - Pay is only compared between offers in the same currency. We never convert currencies.
 * - Only criteria the user has actually rated count, and the result says how many that was.
 * - The user sets the weights. Nothing here decides what matters.
 */

export const HOURS_PER_YEAR = 2080; // 40 hours x 52 weeks, stated wherever hourly pay is annualized

export const OFFER_CRITERIA = [
  { key: "growth", label: "Growth and learning" },
  { key: "team", label: "Team and manager" },
  { key: "interest", label: "Interest in the work" },
  { key: "location", label: "Location and commute" },
  { key: "balance", label: "Work-life balance" },
  { key: "stability", label: "Stability" },
] as const;
export type CriterionKey = (typeof OFFER_CRITERIA)[number]["key"] | "compensation";

export const ALL_CRITERIA: { key: CriterionKey; label: string }[] = [
  { key: "compensation", label: "Pay (calculated)" },
  ...OFFER_CRITERIA,
];

export type OfferIn = {
  id: string;
  label: string;
  currency: string;
  base_amount: number | null;
  pay_period: "year" | "month" | "hour";
  bonus_amount: number | null;
  ratings: Partial<Record<string, number>>;
};

export type Weights = Partial<Record<CriterionKey, number>>;

export const DEFAULT_WEIGHT = 5;
export const clampWeight = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(10, Math.round(v))) : DEFAULT_WEIGHT;
};

const PERIOD_FACTOR = { year: 1, month: 12, hour: HOURS_PER_YEAR } as const;

export function annualBase(o: OfferIn): number | null {
  return o.base_amount === null ? null : o.base_amount * PERIOD_FACTOR[o.pay_period];
}

/** Base pay (annualized) plus any stated bonus. Null when there is no base pay to go on. */
export function totalCash(o: OfferIn): number | null {
  const base = annualBase(o);
  return base === null ? null : base + (o.bonus_amount ?? 0);
}

/** 1 to 5, relative to the best offer in the same currency. Null when it can't be compared. */
export function compensationScores(offers: OfferIn[]): Map<string, number | null> {
  const out = new Map<string, number | null>();
  const byCurrency = new Map<string, OfferIn[]>();
  for (const o of offers) byCurrency.set(o.currency, [...(byCurrency.get(o.currency) ?? []), o]);
  for (const group of byCurrency.values()) {
    const totals = group.map((o) => ({ id: o.id, total: totalCash(o) }));
    const comparable = totals.filter((t): t is { id: string; total: number } => t.total !== null && t.total > 0);
    const best = Math.max(0, ...comparable.map((t) => t.total));
    for (const t of totals) {
      // One offer in a currency has nothing to be compared against.
      out.set(t.id, group.length < 2 || t.total === null || t.total <= 0 || best === 0 ? null : 1 + 4 * (t.total / best));
    }
  }
  return out;
}

export type Contribution = { key: CriterionKey; label: string; weight: number; value: number; points: number };

export type OfferScore = {
  id: string;
  /** 0 to 100, or null when nothing was rated. */
  total: number | null;
  contributions: Contribution[];
  ratedCount: number;
  missing: string[];
};

export function scoreOffers(offers: OfferIn[], weights: Weights): OfferScore[] {
  const comp = compensationScores(offers);
  return offers.map((o) => {
    const contributions: Contribution[] = [];
    const missing: string[] = [];
    for (const c of ALL_CRITERIA) {
      const raw = c.key === "compensation" ? comp.get(o.id) : o.ratings[c.key];
      const weight = clampWeight(weights[c.key] ?? DEFAULT_WEIGHT);
      if (raw === null || raw === undefined || !Number.isFinite(raw)) {
        missing.push(c.label);
        continue;
      }
      const value = Math.max(1, Math.min(5, raw));
      contributions.push({ key: c.key, label: c.label, weight, value, points: weight * value });
    }
    const weightSum = contributions.reduce((n, c) => n + c.weight, 0);
    const total = weightSum === 0 ? null : Math.round((contributions.reduce((n, c) => n + c.points, 0) / (weightSum * 5)) * 100);
    return { id: o.id, total, contributions, ratedCount: contributions.length, missing };
  });
}

/** True when the offers use more than one currency, so pay can't be compared directly. */
export const mixedCurrencies = (offers: OfferIn[]) => new Set(offers.map((o) => o.currency)).size > 1;
