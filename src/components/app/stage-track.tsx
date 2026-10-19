import { STAGE_LABEL, type Stage } from "@/lib/domain";
import { cn } from "@/lib/utils";

const CLIMB = ["saved", "preparing", "applied", "assessment", "interview", "offer"] as const;

/**
 * Where one application sits on the climb: six small steps rising left to right. Steps already passed are filled,
 * the current one is strong, the rest are empty. Rejected, withdrawn and accepted applications show the outcome instead.
 */
export function StageTrack({ stage }: { stage: Stage }) {
  const index = CLIMB.indexOf(stage as (typeof CLIMB)[number]);
  const outcome = index === -1;
  const label = outcome ? STAGE_LABEL[stage] : `${STAGE_LABEL[stage]}, step ${index + 1} of ${CLIMB.length}`;

  return (
    <div role="img" aria-label={`Stage: ${label}`} className="flex items-end gap-1.5">
      {CLIMB.map((s, i) => {
        const reached = !outcome && i <= index;
        const current = !outcome && i === index;
        return (
          <span key={s} data-stage={s} className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "w-10 rounded-t-md transition-colors sm:w-14",
                reached ? "stage-solid" : "bg-muted",
                current ? "opacity-100" : reached ? "opacity-45" : "",
              )}
              style={{ height: `${10 + i * 5}px` }}
            />
            <span className={cn("text-[11px] leading-none", current ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {STAGE_LABEL[s]}
            </span>
          </span>
        );
      })}
      {outcome ? (
        <span data-stage={stage} className="stage-soft ml-3 inline-flex h-6 items-center rounded-full px-3 text-xs font-medium">
          {STAGE_LABEL[stage]}
        </span>
      ) : null}
    </div>
  );
}
