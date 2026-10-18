/**
 * Opportunity ranking for the Career Planner.
 *
 * - The score comes only from ratings the user entered and weights the user chose.
 * - Nothing is excluded or hidden because of who the user is. Unrated opportunities are listed, not dropped.
 * - Every ranked item explains what drove its position.
 */

export const RANK_CRITERIA = [
  { key: "interest", label: "Interest in the work" },
  { key: "fit", label: "How well I fit" },
  { key: "compensation", label: "Pay" },
  { key: "location", label: "Location and arrangement" },
  { key: "growth", label: "Growth and learning" },
] as const;
export type RankKey = (typeof RANK_CRITERIA)[number]["key"];
export type RankWeights = Partial<Record<RankKey, number>>;

export const DEFAULT_RANK_WEIGHT = 5;
const clampWeight = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(10, Math.round(v))) : DEFAULT_RANK_WEIGHT;
};

export type RankInput = {
  id: string;
  label: string;
  ratings: Partial<Record<string, number>>;
};

export type RankedItem = {
  id: string;
  label: string;
  /** 0 to 100, or null when nothing has been rated yet. */
  score: number | null;
  ratedCount: number;
  /** What drove the score, in plain words. */
  why: string;
};

export function rankOpportunities(items: RankInput[], weights: RankWeights): RankedItem[] {
  const ranked = items.map((item): RankedItem => {
    const parts = RANK_CRITERIA.flatMap((c) => {
      const raw = item.ratings[c.key];
      if (typeof raw !== "number" || !Number.isFinite(raw)) return [];
      const value = Math.max(1, Math.min(5, raw));
      const weight = clampWeight(weights[c.key] ?? DEFAULT_RANK_WEIGHT);
      return [{ label: c.label, value, weight, points: value * weight }];
    });
    const weightSum = parts.reduce((n, p) => n + p.weight, 0);
    if (parts.length === 0 || weightSum === 0) {
      return {
        id: item.id,
        label: item.label,
        score: null,
        ratedCount: parts.length,
        why: parts.length === 0 ? "Not rated yet. Rate it below to place it in the ranking." : "Every rated criterion has a weight of 0.",
      };
    }
    const score = Math.round((parts.reduce((n, p) => n + p.points, 0) / (weightSum * 5)) * 100);
    const weighted = parts.filter((p) => p.weight > 0);
    const high = [...weighted].sort((a, b) => b.points - a.points).slice(0, 2).filter((p) => p.value >= 4);
    const low = [...weighted].sort((a, b) => a.value - b.value || b.weight - a.weight)[0];
    const bits: string[] = [];
    if (high.length) bits.push(`Strong on ${high.map((p) => `${p.label.toLowerCase()} (${p.value}/5)`).join(" and ")}`);
    if (low && low.value <= 2) bits.push(`${bits.length ? "weaker" : "Weaker"} on ${low.label.toLowerCase()} (${low.value}/5)`);
    if (bits.length === 0) bits.push("Middling across the criteria you rated");
    return {
      id: item.id,
      label: item.label,
      score,
      ratedCount: parts.length,
      why: `${bits.join(", ")}. Based on ${parts.length} of ${RANK_CRITERIA.length} criteria.`,
    };
  });
  // Highest first. Unrated items follow, in their original order, rather than being dropped.
  return ranked
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (b.r.score ?? -1) - (a.r.score ?? -1) || a.i - b.i)
    .map((x) => x.r);
}

/** Suggests a 1-5 "fit" from a resume-analysis score (0-100). It's only a suggestion; the user decides. */
export const suggestedFit = (score: number | null | undefined): number | null =>
  typeof score === "number" && Number.isFinite(score) ? Math.max(1, Math.min(5, Math.round(score / 20))) : null;

export type GapInput = { requirement: string; application_id: string };
export type Gap = { requirement: string; applications: number };

/** Requirements that weren't evidenced, grouped by wording, most common first. */
export function summarizeGaps(findings: GapInput[], limit = 8): Gap[] {
  const groups = new Map<string, { requirement: string; apps: Set<string> }>();
  for (const f of findings) {
    const key = f.requirement.toLowerCase().replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
    if (!key) continue;
    const g = groups.get(key) ?? { requirement: f.requirement.trim(), apps: new Set<string>() };
    g.apps.add(f.application_id);
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({ requirement: g.requirement, applications: g.apps.size }))
    .sort((a, b) => b.applications - a.applications || a.requirement.localeCompare(b.requirement))
    .slice(0, limit);
}
