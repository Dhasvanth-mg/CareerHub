import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/app/local-time";
import { deleteTask, setTaskDone, snoozeTask } from "@/app/(app)/tasks/actions";
import { cn } from "@/lib/utils";

export type TaskItem = {
  id: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  completed_at: string | null;
  snoozed_until: string | null;
  application_id: string | null;
  applications?: { company_name: string; title: string } | null;
};

export function TaskList({
  tasks,
  now,
  showApplication = false,
}: {
  tasks: TaskItem[];
  now: number;
  showApplication?: boolean;
}) {
  return (
    <ul className="divide-y rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06]">
      {tasks.map((t) => {
        const done = Boolean(t.completed_at);
        const overdue = !done && t.due_at !== null && Date.parse(t.due_at) < now;
        const snoozed = !done && t.snoozed_until !== null && Date.parse(t.snoozed_until) > now;
        return (
          <li key={t.id} className="flex items-start gap-3 p-3">
            <form action={setTaskDone.bind(null, t.id, !done)} className="pt-0.5">
              <button
                type="submit"
                role="checkbox"
                aria-checked={done}
                aria-label={done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
                className="flex size-5 items-center justify-center rounded border border-input text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {done ? "✓" : ""}
              </button>
            </form>
            <div className="min-w-0 flex-1 space-y-1">
              <p className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}>{t.title}</p>
              {t.notes ? <p className="text-sm text-muted-foreground">{t.notes}</p> : null}
              <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                {t.due_at ? (
                  <span className={cn(overdue && "font-medium text-rose-600 dark:text-rose-300")}>
                    {overdue ? "Overdue: " : "Due "}
                    <LocalTime iso={t.due_at} />
                  </span>
                ) : (
                  <span>No due date</span>
                )}
                {snoozed && t.snoozed_until ? (
                  <span>
                    Snoozed until <LocalTime iso={t.snoozed_until} dateOnly />
                  </span>
                ) : null}
                {showApplication && t.application_id && t.applications ? (
                  <Link href={`/applications/${t.application_id}`} className="underline underline-offset-4">
                    {t.applications.title} at {t.applications.company_name}
                  </Link>
                ) : null}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!done ? (
                <form action={snoozeTask.bind(null, t.id, 1)}>
                  <Button type="submit" variant="ghost" size="sm">
                    Snooze 1d
                  </Button>
                </form>
              ) : null}
              <form action={deleteTask.bind(null, t.id)}>
                <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Delete task "${t.title}"`}>
                  <Trash2 aria-hidden="true" />
                </Button>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
