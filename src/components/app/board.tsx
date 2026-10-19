"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { moveApplication } from "@/app/(app)/applications/actions";
import { NativeSelect } from "@/components/ui/native-select";
import { DeadlineBadge } from "@/components/app/stage-badge";
import { Monogram } from "@/components/app/monogram";
import { CONSEQUENTIAL_STAGES, STAGES, STAGE_LABEL, type Stage } from "@/lib/domain";
import { cn } from "@/lib/utils";

export type BoardCard = {
  id: string;
  company_name: string;
  title: string;
  stage: Stage;
  priority: "low" | "medium" | "high";
  deadline: string | null;
};

export function Board({ apps }: { apps: BoardCard[] }) {
  const [cards, applyMove] = useOptimistic(apps, (state, m: { id: string; stage: Stage }) =>
    state.map((c) => (c.id === m.id ? { ...c, stage: m.stage } : c)),
  );
  const [, startTransition] = useTransition();
  const [overStage, setOverStage] = useState<Stage | null>(null);

  function move(card: BoardCard, stage: Stage) {
    if (card.stage === stage) return;
    if (
      CONSEQUENTIAL_STAGES.includes(stage) &&
      !window.confirm(`Move "${card.title}" at ${card.company_name} to ${STAGE_LABEL[stage]}?`)
    ) {
      return;
    }
    startTransition(async () => {
      applyMove({ id: card.id, stage });
      const result = await moveApplication(card.id, stage);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="-mr-4 flex snap-x gap-3 overflow-x-auto pb-6 pr-4 md:-mr-10 md:pr-10" role="list" aria-label="Application stages">
      {STAGES.map((stage) => {
        const inStage = cards.filter((c) => c.stage === stage);
        return (
          <section
            key={stage}
            role="listitem"
            aria-label={`${STAGE_LABEL[stage]}, ${inStage.length} ${inStage.length === 1 ? "application" : "applications"}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverStage(stage);
            }}
            onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setOverStage(null);
              const card = cards.find((c) => c.id === e.dataTransfer.getData("text/plain"));
              if (card) move(card, stage);
            }}
            className={cn(
              "flex w-72 shrink-0 snap-start flex-col gap-2.5 rounded-2xl bg-muted/70 p-2.5 transition-[background-color,box-shadow]",
              overStage === stage && "bg-accent ring-2 ring-primary/40",
            )}
          >
            <h2 data-stage={stage} className="flex items-center gap-2 px-1.5 pt-1 text-sm font-semibold">
              <span aria-hidden="true" className="stage-solid size-2.5 rounded-full" />
              {STAGE_LABEL[stage]}
              <span className="tabular ml-auto rounded-full bg-background/70 px-2 py-0.5 text-xs font-medium text-muted-foreground">{inStage.length}</span>
            </h2>
            {inStage.length === 0 ? (
              <p className="rounded-xl border border-dashed px-1 py-6 text-center text-xs text-muted-foreground">Drop an application here</p>
            ) : null}
            {inStage.map((card) => (
              <article
                key={card.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)}
                className="group/card relative cursor-grab space-y-3 rounded-xl bg-card p-3.5 text-sm shadow-xs ring-1 ring-foreground/[0.06] transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-lift active:cursor-grabbing active:shadow-float"
              >
                <div className="flex items-start gap-3">
                  <Monogram company={card.company_name} stage={card.stage} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{card.company_name}</p>
                    <Link
                      href={`/applications/${card.id}`}
                      className="block text-muted-foreground outline-none after:absolute after:inset-0 hover:text-foreground focus-visible:underline"
                    >
                      {card.title}
                    </Link>
                  </div>
                </div>
                {card.deadline || card.priority === "high" ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {card.deadline ? <DeadlineBadge date={card.deadline} /> : null}
                    {card.priority === "high" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-sunrise" />
                        High priority
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <NativeSelect
                  aria-label={`Stage for ${card.title} at ${card.company_name}`}
                  value={card.stage}
                  onChange={(e) => move(card, e.target.value as Stage)}
                  className="relative z-10 h-7 border-transparent bg-muted/70 text-xs text-muted-foreground md:absolute md:bottom-2.5 md:right-2.5 md:w-32 md:bg-card md:opacity-0 md:shadow-xs md:transition-opacity md:group-hover/card:opacity-100 md:focus:opacity-100"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABEL[s]}
                    </option>
                  ))}
                </NativeSelect>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
