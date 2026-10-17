import { Badge } from "@/components/ui/badge";
import { STAGE_LABEL, deadlineLabel, type Stage } from "@/lib/domain";
import { cn } from "@/lib/utils";

const STAGE_STYLE: Partial<Record<Stage, string>> = {
  offer: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  accepted: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  rejected: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  withdrawn: "bg-muted text-muted-foreground",
};

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <Badge variant="secondary" className={cn(STAGE_STYLE[stage])}>
      {STAGE_LABEL[stage]}
    </Badge>
  );
}

export function DeadlineBadge({ date }: { date: string }) {
  const { text, tone } = deadlineLabel(date);
  return (
    <Badge
      variant="outline"
      className={cn(
        tone === "overdue" && "border-rose-300 text-rose-700 dark:text-rose-300",
        tone === "soon" && "border-amber-300 text-amber-700 dark:text-amber-300",
      )}
    >
      {text}
    </Badge>
  );
}
