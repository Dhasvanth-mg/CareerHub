const DEFAULT_MINUTES = 60;

type TimedRound = { id: string; status: string; scheduled_at: string | null; duration_minutes: number | null };

/** Ids of interview rounds whose time ranges overlap another active round. Works on UTC instants,
 *  so the answer is the same in every time zone. */
export function overlappingRounds(rounds: TimedRound[]): Set<string> {
  const timed = rounds
    .filter((r) => r.status !== "cancelled" && r.scheduled_at)
    .map((r) => {
      const start = Date.parse(r.scheduled_at as string);
      return { id: r.id, start, end: start + (r.duration_minutes ?? DEFAULT_MINUTES) * 60_000 };
    })
    .filter((r) => Number.isFinite(r.start))
    .sort((a, b) => a.start - b.start);

  const conflicts = new Set<string>();
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length && timed[j].start < timed[i].end; j++) {
      conflicts.add(timed[i].id);
      conflicts.add(timed[j].id);
    }
  }
  return conflicts;
}

/** "YYYY-MM" for a Date, in UTC. */
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseMonth(value: string | undefined, now: Date): { year: number; month: number } {
  const m = value?.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (m) return { year: Number(m[1]), month: Number(m[2]) - 1 };
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}

export function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return monthKey(d);
}
