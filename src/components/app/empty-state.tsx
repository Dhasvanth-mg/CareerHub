import { cn } from "@/lib/utils";

/** The logo's staircase, drawn large and quiet. Used wherever a page has nothing to show yet. */
export function StairsIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 110" aria-hidden="true" className={cn("h-24 w-auto", className)}>
      <rect x="6" y="78" width="30" height="26" rx="6" className="fill-primary/15" />
      <rect x="40" y="62" width="30" height="42" rx="6" className="fill-primary/25" />
      <rect x="74" y="44" width="30" height="60" rx="6" className="fill-primary/40" />
      <rect x="108" y="26" width="30" height="78" rx="6" className="fill-primary/60" />
      <circle cx="133" cy="12" r="9" className="fill-sunrise" />
      <circle cx="133" cy="12" r="3.5" className="fill-sunrise-foreground/70" />
    </svg>
  );
}

/** An empty page is an invitation: say what belongs here and offer the first move. */
export function EmptyState({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center", className)}>
      <StairsIllustration />
      <h2 className="mt-5 text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {children ? <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}
