import { STAGE_LABEL, deadlineLabel, type Stage } from "@/lib/domain";
import { cn } from "@/lib/utils";

const chip = "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium";

/** The stage as a small tinted pill with a dot, in the stage's own hue. */
export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <span data-stage={stage} className={cn(chip, "stage-soft", className)}>
      <span aria-hidden="true" className="stage-solid size-1.5 rounded-full" />
      {STAGE_LABEL[stage]}
    </span>
  );
}

export function DeadlineBadge({ date }: { date: string }) {
  const { text, tone } = deadlineLabel(date);
  return (
    <span
      className={cn(
        chip,
        tone === "overdue" && "bg-destructive/10 text-destructive",
        tone === "soon" && "bg-sunrise/25 text-sunrise-foreground dark:bg-sunrise/20 dark:text-sunrise",
        tone === "normal" && "bg-muted text-muted-foreground",
      )}
    >
      {text}
    </span>
  );
}
