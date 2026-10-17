/**
 * Funnel analytics. Pure functions so the maths can be tested without a database.
 *
 * Honesty rules (from the product spec):
 * - "Reached a stage" comes from recorded history (events), never guessed.
 * - Applications with no usable history are counted as unknown, not as rejections.
 * - Percentages come with their counts, and small samples are labelled.
 */

export const PIPELINE = ["saved", "preparing", "applied", "assessment", "interview", "offer", "accepted"] as const;
type Pipeline = (typeof PIPELINE)[number];

export type AppInput = {
  id: string;
  stage: string;
  created_at: string;
  applied_on: string | null;
  source: string | null;
  submitted_resume_version_id: string | null;
};
export type EventInput = {
  application_id: string;
  type: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
};

const idx = (s: string | null): number => (s ? PIPELINE.indexOf(s as Pipeline) : -1);

export type AppFacts = {
  id: string;
  /** Furthest pipeline stage index reached, or -1 when unknown. */
  maxIndex: number;
  /** True when the history is too thin to say how far the application got. */
  unknown: boolean;
  current: string;
  /** Left the "applied" stage and when (for time-to-response). */
  appliedAt: number | null;
  respondedAt: number | null;
  source: string | null;
  resumeVersionId: string | null;
};

export function factsFor(apps: AppInput[], events: EventInput[]): AppFacts[] {
  const byApp = new Map<string, EventInput[]>();
  for (const e of events) byApp.set(e.application_id, [...(byApp.get(e.application_id) ?? []), e]);

  return apps.map((a) => {
    const evs = (byApp.get(a.id) ?? []).sort((x, y) => x.created_at.localeCompare(y.created_at));
    let max = idx(a.stage);
    let sawTerminalFrom = -1;
    for (const e of evs) {
      max = Math.max(max, idx(e.to_value), idx(e.from_value));
      if (e.to_value === "rejected" || e.to_value === "withdrawn") sawTerminalFrom = Math.max(sawTerminalFrom, idx(e.from_value));
    }
    const terminal = a.stage === "rejected" || a.stage === "withdrawn";
    // A rejected/withdrawn application only tells us how far it got if we saw the move that closed it.
    const unknown = terminal && sawTerminalFrom < 0;
    if (terminal) max = sawTerminalFrom;

    const appliedEvent = evs.find((e) => e.type === "stage_changed" && e.to_value === "applied");
    const appliedAt = appliedEvent
      ? Date.parse(appliedEvent.created_at)
      : a.applied_on
        ? Date.parse(`${a.applied_on}T12:00:00Z`)
        : null;
    const exit = evs.find(
      (e) => e.type === "stage_changed" && e.from_value === "applied" && e.to_value !== "applied" && e.to_value !== "saved" && e.to_value !== "preparing",
    );

    return {
      id: a.id,
      maxIndex: unknown ? -1 : max,
      unknown,
      current: a.stage,
      appliedAt,
      respondedAt: exit ? Date.parse(exit.created_at) : null,
      source: a.source?.trim() || null,
      resumeVersionId: a.submitted_resume_version_id,
    };
  });
}

export type FunnelStep = { stage: Pipeline; count: number; fromPrevious: number | null };

export type Analytics = {
  total: number;
  unknownHistory: number;
  funnel: FunnelStep[];
  applied: number;
  /** Applied and moved on (assessment, interview, offer, or closed by the employer). */
  responded: number;
  waiting: number;
  rejected: number;
  withdrawn: number;
  responseRate: number | null;
  medianDaysToResponse: number | null;
  responseSample: number;
  bySource: { label: string; applied: number; interviews: number }[];
  byResume: { id: string; applied: number; interviews: number }[];
};

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 100) : null);

export function computeAnalytics(apps: AppInput[], events: EventInput[]): Analytics {
  const facts = factsFor(apps, events);
  const known = facts.filter((f) => !f.unknown);
  const appliedIdx = PIPELINE.indexOf("applied");
  const interviewIdx = PIPELINE.indexOf("interview");

  const funnel: FunnelStep[] = PIPELINE.map((stage, i) => {
    const count = known.filter((f) => f.maxIndex >= i).length;
    return { stage, count, fromPrevious: null };
  });
  funnel.forEach((s, i) => {
    s.fromPrevious = i === 0 ? null : pct(s.count, funnel[i - 1].count);
  });

  const reachedApplied = known.filter((f) => f.maxIndex >= appliedIdx);
  const closedByEmployer = facts.filter((f) => f.current === "rejected" && f.maxIndex >= appliedIdx);
  const responded = new Set<string>([
    ...reachedApplied.filter((f) => f.maxIndex > appliedIdx).map((f) => f.id),
    ...closedByEmployer.map((f) => f.id),
  ]);
  const waiting = reachedApplied.filter((f) => f.current === "applied").length;

  const days = reachedApplied
    .filter((f) => f.appliedAt !== null && f.respondedAt !== null && f.respondedAt >= (f.appliedAt as number))
    .map((f) => ((f.respondedAt as number) - (f.appliedAt as number)) / 86_400_000);

  const group = <K extends string>(key: (f: AppFacts) => K | null) => {
    const map = new Map<K, { applied: number; interviews: number }>();
    for (const f of reachedApplied) {
      const k = key(f);
      if (k === null) continue;
      const row = map.get(k) ?? { applied: 0, interviews: 0 };
      row.applied += 1;
      if (f.maxIndex >= interviewIdx) row.interviews += 1;
      map.set(k, row);
    }
    return [...map.entries()].map(([k, v]) => ({ key: k, ...v })).sort((a, b) => b.applied - a.applied);
  };

  return {
    total: apps.length,
    unknownHistory: facts.filter((f) => f.unknown).length,
    funnel,
    applied: reachedApplied.length,
    responded: responded.size,
    waiting,
    rejected: facts.filter((f) => f.current === "rejected").length,
    withdrawn: facts.filter((f) => f.current === "withdrawn").length,
    responseRate: pct(responded.size, reachedApplied.length),
    medianDaysToResponse: median(days),
    responseSample: days.length,
    bySource: group((f) => f.source).map((r) => ({ label: r.key, applied: r.applied, interviews: r.interviews })),
    byResume: group((f) => f.resumeVersionId).map((r) => ({ id: r.key, applied: r.applied, interviews: r.interviews })),
  };
}

export const SMALL_SAMPLE = 5;
export const isSmall = (n: number) => n < SMALL_SAMPLE;
