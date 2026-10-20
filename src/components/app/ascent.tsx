import Link from "next/link";
import { STAGE_LABEL, type Stage } from "@/lib/domain";
import { cn } from "@/lib/utils";

/** The stages that make up the climb, bottom to top. Accepted, rejected and withdrawn are outcomes, shown beneath. */
export const ASCENT_STAGES = ["saved", "preparing", "applied", "assessment", "interview", "offer"] as const;
const OUTCOMES = ["accepted", "rejected", "withdrawn"] as const;

export type AscentData = Record<Stage, { count: number; names: string[] }>;

const stepHeight = (i: number) => 54 + i * 8.6;

/**
 * The dashboard's centrepiece: your pipeline as a staircase. Each step is a stage and links to those applications.
 * The steps always rise left to right, because that is the direction of travel; the numbers and dots on them say
 * where your applications actually are. A small goal marker sits on the top step, like the one in the logo.
 */
export function Ascent({ data }: { data: AscentData }) {
  const total = ASCENT_STAGES.reduce((n, s) => n + data[s].count, 0);
  return (
    <section aria-labelledby="ascent" className="space-y-4">
      <h2 id="ascent" className="sr-only">
        Where your applications stand
      </h2>

      <ol className="relative grid h-[clamp(250px,30vw,340px)] grid-cols-6 items-end gap-1.5 pt-10 sm:gap-2.5" aria-label="Pipeline stages">
        {ASCENT_STAGES.map((stage, i) => {
          const { count, names } = data[stage];
          const empty = count === 0;
          const last = i === ASCENT_STAGES.length - 1;
          return (
            <li key={stage} className="relative flex h-full items-end" data-stage={stage}>
              <Link
                href={`/applications?stage=${stage}`}
                aria-label={`${STAGE_LABEL[stage]}: ${count} ${count === 1 ? "application" : "applications"}`}
                style={{ height: `${stepHeight(i)}%`, ["--i" as string]: i }}
                className={cn(
                  "ascend-step group relative flex w-full flex-col justify-between rounded-t-2xl p-2 outline-none transition-[filter] focus-visible:ring-2 focus-visible:ring-ring sm:p-4",
                  empty
                    ? "border border-b-0 border-dashed border-border bg-card/40 text-muted-foreground"
                    : "stage-soft stage-tread hover:brightness-[0.98]",
                )}
              >
                <span className="truncate text-[10px] font-medium sm:text-sm">{STAGE_LABEL[stage]}</span>
                <span className="space-y-2">
                  {names.length > 0 ? (
                    <span className="hidden space-y-0.5 text-xs leading-snug opacity-80 lg:block">
                      {names.slice(0, 1).map((n) => (
                        <span key={n} className="block truncate">
                          {n}
                        </span>
                      ))}
                      {names.length > 1 ? <span className="block">and {names.length - 1} more</span> : null}
                    </span>
                  ) : null}
                  <span className="tabular block font-heading text-3xl font-semibold leading-none sm:text-5xl">{count}</span>
                </span>
              </Link>
              {last ? (
                <span
                  aria-hidden="true"
                  className="goal-in absolute right-3 flex size-9 items-center justify-center rounded-full bg-sunrise shadow-lift sm:right-4"
                  style={{ bottom: `calc(${stepHeight(i)}% + 0.5rem)` }}
                >
                  <span className="size-3.5 rounded-full bg-sunrise-foreground/80" />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t pt-3 text-sm text-muted-foreground">
        <span>
          <span className="tabular font-medium text-foreground">{total}</span> in play
        </span>
        {OUTCOMES.map((o) => (
          <Link
            key={o}
            href={`/applications?stage=${o}`}
            data-stage={o}
            className="inline-flex items-center gap-1.5 rounded-md px-1 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span aria-hidden="true" className="stage-solid size-2 rounded-full" />
            <span className="tabular font-medium text-foreground">{data[o].count}</span> {STAGE_LABEL[o].toLowerCase()}
          </Link>
        ))}
      </div>
    </section>
  );
}

const SKETCH = [
  { stage: "saved", count: 4, label: "Saved" },
  { stage: "preparing", count: 3, label: "Prep" },
  { stage: "applied", count: 6, label: "Applied" },
  { stage: "assessment", count: 2, label: "Assess" },
  { stage: "interview", count: 2, label: "Interview" },
  { stage: "offer", count: 1, label: "Offer" },
] as const;

/** A decorative, non-interactive staircase with sample numbers, for the landing and sign-in pages. */
export function AscentSketch({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative grid h-72 grid-cols-6 items-end gap-2 pt-10 sm:h-80", className)}>
      {SKETCH.map((s, i) => (
        <div key={s.stage} className="relative flex h-full items-end" data-stage={s.stage}>
          <div
            style={{ height: `${stepHeight(i)}%`, ["--i" as string]: i }}
            className="ascend-step stage-soft stage-tread flex w-full flex-col justify-between rounded-t-2xl p-2 sm:p-3.5"
          >
            <span className="truncate text-[10px] font-medium sm:text-xs">{s.label}</span>
            <span className="tabular font-heading text-3xl font-semibold leading-none sm:text-4xl">{s.count}</span>
          </div>
          {i === SKETCH.length - 1 ? (
            <span
              className="goal-in absolute right-2 flex size-9 items-center justify-center rounded-full bg-sunrise shadow-lift"
              style={{ bottom: `calc(${stepHeight(i)}% + 0.5rem)` }}
            >
              <span className="size-3.5 rounded-full bg-sunrise-foreground/80" />
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
