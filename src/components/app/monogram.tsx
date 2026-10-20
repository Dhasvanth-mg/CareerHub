import { cn } from "@/lib/utils";
import type { Stage } from "@/lib/domain";

/** A company's first letter on a tile tinted by the application's stage, so a list scans by colour as well as by name. */
export function Monogram({ company, stage, className }: { company: string; stage: Stage; className?: string }) {
  return (
    <span
      aria-hidden="true"
      data-stage={stage}
      className={cn("stage-soft flex size-8 shrink-0 items-center justify-center rounded-lg font-heading text-sm font-semibold", className)}
    >
      {company.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
