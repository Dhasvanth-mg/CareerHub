import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hideOnboarding } from "@/app/(app)/dashboard/onboarding";

export type OnboardingStep = { key: string; label: string; hint: string; href: string; done: boolean };

/** A short getting-started list. Each step ticks itself off when the thing exists, so there is nothing to maintain. */
export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const done = steps.filter((s) => s.done).length;
  return (
    <section aria-labelledby="getting-started" className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="getting-started" className="font-medium">
          Getting started <span className="font-normal text-muted-foreground">({done} of {steps.length} done)</span>
        </h2>
        <form action={hideOnboarding}>
          <Button type="submit" variant="ghost" size="sm">
            Hide
          </Button>
        </form>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Getting started progress"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done}
      >
        <div className="h-full bg-primary transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.key} className="flex items-start gap-3 text-sm">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${s.done ? "border-primary bg-primary text-primary-foreground" : ""}`}
            >
              {s.done ? <Check className="size-3" /> : null}
            </span>
            <span>
              <Link href={s.href} className={`font-medium underline-offset-4 hover:underline ${s.done ? "text-muted-foreground line-through" : ""}`}>
                {s.label}
              </Link>
              <span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
              {!s.done ? <span className="block text-muted-foreground">{s.hint}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
