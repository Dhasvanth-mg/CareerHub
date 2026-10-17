"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { moveApplication } from "@/app/(app)/applications/actions";
import { NativeSelect } from "@/components/ui/native-select";
import { DeadlineBadge } from "@/components/app/stage-badge";
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
    <div className="flex gap-3 overflow-x-auto pb-4" role="list" aria-label="Application stages">
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
              "flex w-64 shrink-0 flex-col gap-2 rounded-lg border bg-muted/40 p-2 transition-colors",
              overStage === stage && "border-ring bg-muted",
            )}
          >
            <h2 className="flex items-center justify-between px-1 text-sm font-medium">
              {STAGE_LABEL[stage]}
              <span className="text-xs text-muted-foreground">{inStage.length}</span>
            </h2>
            {inStage.length === 0 ? (
              <p className="px-1 py-4 text-center text-xs text-muted-foreground">Drop here</p>
            ) : null}
            {inStage.map((card) => (
              <article
                key={card.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", card.id)}
                className="cursor-grab space-y-2 rounded-md border bg-card p-3 text-sm shadow-xs active:cursor-grabbing"
              >
                <Link
                  href={`/applications/${card.id}`}
                  className="block font-medium outline-none hover:underline focus-visible:underline"
                >
                  {card.title}
                </Link>
                <p className="text-muted-foreground">{card.company_name}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {card.deadline ? <DeadlineBadge date={card.deadline} /> : null}
                  {card.priority === "high" ? (
                    <span className="text-xs font-medium text-rose-600 dark:text-rose-300">High priority</span>
                  ) : null}
                </div>
                <NativeSelect
                  aria-label={`Stage for ${card.title} at ${card.company_name}`}
                  value={card.stage}
                  onChange={(e) => move(card, e.target.value as Stage)}
                  className="h-7 text-xs"
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
