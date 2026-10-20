import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ExportPicker, ImportPicker, type ExportItem } from "@/components/app/calendar-sync";
import { loadCalendarEntries, WINDOW_FUTURE_DAYS, WINDOW_PAST_DAYS } from "@/lib/calendar-export";
import { nowMs } from "@/lib/domain";

export const metadata = { title: "Calendar sync | CareerHub AI" };

export default async function CalendarSyncPage() {
  const supabase = await createClient();
  const [entries, appsRes] = await Promise.all([
    loadCalendarEntries(supabase, new Date(nowMs())),
    supabase
      .from("applications")
      .select("id, company_name, title")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);

  const items: ExportItem[] = entries.map((e) => ({ key: e.key, kind: e.kind, title: e.title, at: e.at, allDay: e.allDay }));
  const applications = (appsRes.data ?? []).map((a) => ({ id: a.id, label: `${a.title} at ${a.company_name}` }));

  return (
    <div className="max-w-3xl space-y-10">
      <div className="space-y-2">
        <Link href="/calendar" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Calendar
        </Link>
        <h1 className="text-3xl sm:text-4xl">Calendar sync</h1>
        <p className="text-sm text-muted-foreground">
          Move events in and out with a standard calendar file (.ics). It works with Google Calendar, Apple Calendar and Outlook. Nothing
          is shared automatically: you choose what goes in or out.
        </p>
      </div>

      <section aria-labelledby="export" className="space-y-4">
        <div className="space-y-1">
          <h2 id="export" className="text-xl">
            Export
          </h2>
          <p className="text-sm text-muted-foreground">
            Tick the events to put in your own calendar. Covers the last {WINDOW_PAST_DAYS} days through the next {WINDOW_FUTURE_DAYS} days.
            Importing the file again later updates the same events instead of duplicating them.
          </p>
        </div>
        <ExportPicker items={items} />
      </section>

      <section aria-labelledby="import" className="space-y-4">
        <div className="space-y-1">
          <h2 id="import" className="text-xl">
            Import
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick a calendar file, review the events, and add the ones you want as tasks with their date and time. Re-importing the same
            event never creates a duplicate.
          </p>
        </div>
        <ImportPicker applications={applications} />
      </section>
    </div>
  );
}
