import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/app/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GROUP_LABEL, type ActionItem, type Group } from "@/lib/actions";
import { loadActionCenter } from "@/lib/actions-loader";
import { nowMs } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { addTaskFromAction, dismissAction, restoreAction } from "./actions";

export const metadata = { title: "Action Center | CareerHub AI" };

const FILTERS: { id: string; label: string; groups: Group[] | null }[] = [
  { id: "all", label: "All", groups: null },
  { id: "overdue", label: "Overdue", groups: ["overdue"] },
  { id: "due_soon", label: "Due soon", groups: ["due_soon", "prep"] },
  { id: "waiting", label: "Waiting on someone", groups: ["waiting"] },
  { id: "tidy", label: "Tidy up", groups: ["tidy"] },
];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ActionCenterPage({ searchParams }: PageProps<"/action-center">) {
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.id === one(sp.f)) ?? FILTERS[0];

  const supabase = await createClient();
  const { visible, hidden, error } = await loadActionCenter(supabase, new Date(nowMs()));
  const shown = filter.groups ? visible.filter((i) => filter.groups!.includes(i.group)) : visible;
  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, f.groups ? visible.filter((i) => f.groups!.includes(i.group)).length : visible.length]));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl">Action Center</h1>
        <p className="text-sm text-muted-foreground">
          What deserves your attention across every application, and exactly why. These come from your own dates and records. Nothing is
          done for you: add a suggestion as a task, snooze it, or dismiss it.
        </p>
      </div>

      <nav aria-label="Filter" className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id === "all" ? "/action-center" : `/action-center?f=${f.id}`}
            aria-current={filter.id === f.id ? "true" : undefined}
            className={cn("rounded-md border px-3 py-1", filter.id === f.id ? "bg-muted font-medium" : "text-muted-foreground")}
          >
            {f.label} <span className="tabular-nums">({counts[f.id]})</span>
          </Link>
        ))}
      </nav>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Some data couldn&apos;t be loaded, so this list may be incomplete. Refresh to try again.
        </p>
      ) : null}

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">{visible.length === 0 ? "You're all caught up" : "Nothing in this view"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {visible.length === 0
              ? "No overdue tasks, close deadlines or loose ends right now."
              : "Try another filter above."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((item) => (
            <ActionCard key={item.key} item={item} />
          ))}
        </ul>
      )}

      {hidden.length > 0 ? (
        <details className="rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] p-4 text-sm">
          <summary className="cursor-pointer font-medium">Snoozed or dismissed ({hidden.length})</summary>
          <ul className="mt-3 space-y-2">
            {hidden.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {item.title}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.until ? (
                      <>
                        snoozed until <LocalTime iso={item.until} dateOnly />
                      </>
                    ) : (
                      "dismissed"
                    )}
                  </span>
                </span>
                <form action={restoreAction.bind(null, item.key)}>
                  <Button type="submit" variant="ghost" size="sm">
                    Bring back
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ActionCard({ item }: { item: ActionItem }) {
  return (
    <li className="space-y-2 rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link href={item.href} className="font-medium underline-offset-4 hover:underline">
          {item.title}
        </Link>
        <Badge
          variant="secondary"
          className={cn(item.group === "overdue" && "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200")}
        >
          {GROUP_LABEL[item.group]}
        </Badge>
      </div>
      <p className="text-sm">{item.why}</p>
      <p className="text-xs text-muted-foreground">
        {item.applicationLabel}
        {item.dueDate ? ` · ${item.dueDate}` : ""} · Based on: {item.basis}
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        {item.task ? (
          <form action={addTaskFromAction.bind(null, item.key, item.applicationId, item.task.title, item.task.dueDate)}>
            <Button type="submit" size="sm">
              Add as a task
            </Button>
          </form>
        ) : null}
        <Button nativeButton={false} size="sm" variant="outline" render={<Link href={item.href} />}>
          Open
        </Button>
        <form action={dismissAction.bind(null, item.key, 3)}>
          <Button type="submit" size="sm" variant="ghost">
            Snooze 3 days
          </Button>
        </form>
        <form action={dismissAction.bind(null, item.key, null)}>
          <Button type="submit" size="sm" variant="ghost">
            Dismiss
          </Button>
        </form>
      </div>
    </li>
  );
}
