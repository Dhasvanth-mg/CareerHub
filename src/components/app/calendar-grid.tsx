"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

export type CalendarItem = {
  id: string;
  kind: "interview" | "task" | "deadline";
  title: string;
  /** An ISO instant for interviews and tasks, or a plain YYYY-MM-DD date for deadlines. */
  at: string;
  href: string;
  conflict?: boolean;
};

const KIND_STYLE: Record<CalendarItem["kind"], string> = {
  interview: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  task: "bg-muted text-foreground",
  deadline: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
};
const KIND_LABEL: Record<CalendarItem["kind"], string> = { interview: "Interview", task: "Task", deadline: "Deadline" };

const subscribe = () => () => {};
const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Buckets items into days using the viewer's own time zone. Deadlines are calendar dates and never shift. */
export function CalendarGrid({ year, month, items }: { year: number; month: number; items: CalendarItem[] }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);

  const { weeks, byDay, todayKey } = useMemo(() => {
    const byDay = new Map<string, CalendarItem[]>();
    if (isClient) {
      for (const item of items) {
        const key = item.kind === "deadline" ? item.at : dayKey(new Date(item.at));
        byDay.set(key, [...(byDay.get(key) ?? []), item]);
      }
    }
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    const weeks: Date[][] = [];
    for (let w = 0; w < 6; w++) {
      const row = Array.from({ length: 7 }, (_, d) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d));
      if (w >= 4 && row[0].getMonth() !== month) break;
      weeks.push(row);
    }
    return { weeks, byDay, todayKey: dayKey(new Date()) };
  }, [isClient, items, year, month]);

  if (!isClient) {
    return <div className="h-64 animate-pulse rounded-lg border bg-muted/30" aria-hidden="true" />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[40rem] table-fixed border-collapse text-xs">
        <caption className="sr-only">Month calendar. The agenda below lists the same items in order.</caption>
        <thead className="bg-muted/40">
          <tr>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <th key={d} scope="col" className="border-b px-2 py-1.5 text-left font-medium text-muted-foreground">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((row, i) => (
            <tr key={i}>
              {row.map((d) => {
                const key = dayKey(d);
                const inMonth = d.getMonth() === month;
                const dayItems = (byDay.get(key) ?? []).sort((a, b) => a.at.localeCompare(b.at));
                return (
                  <td key={key} className={cn("h-24 border-b border-r p-1 align-top", !inMonth && "bg-muted/20 text-muted-foreground")}>
                    <div className={cn("mb-1 w-fit rounded px-1 font-medium", key === todayKey && "bg-primary text-primary-foreground")}>
                      {d.getDate()}
                    </div>
                    <ul className="space-y-0.5">
                      {dayItems.slice(0, 3).map((item) => (
                        <li key={`${item.kind}-${item.id}`}>
                          <Link
                            href={item.href}
                            title={`${KIND_LABEL[item.kind]}: ${item.title}${item.conflict ? " (overlaps another interview)" : ""}`}
                            className={cn("block truncate rounded px-1 py-0.5 hover:underline", KIND_STYLE[item.kind], item.conflict && "ring-1 ring-amber-500")}
                          >
                            <span className="sr-only">{KIND_LABEL[item.kind]}: </span>
                            {item.title}
                          </Link>
                        </li>
                      ))}
                      {dayItems.length > 3 ? <li className="px-1 text-muted-foreground">+{dayItems.length - 3} more</li> : null}
                    </ul>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
