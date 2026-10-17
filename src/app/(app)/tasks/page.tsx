import { createClient } from "@/lib/supabase/server";
import { TaskForm } from "@/components/app/task-form";
import { TaskList, type TaskItem } from "@/components/app/task-list";
import { nowMs } from "@/lib/domain";

export const metadata = { title: "Tasks | CareerHub AI" };

export default async function TasksPage() {
  const supabase = await createClient();
  const [tasksRes, appsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, notes, due_at, completed_at, snoozed_until, application_id, applications(company_name, title)")
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(500),
    supabase
      .from("applications")
      .select("id, company_name, title")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);

  const tasks = (tasksRes.data ?? []) as unknown as TaskItem[];
  const now = nowMs();
  const weekAhead = now + 7 * 86_400_000;
  const snoozed = (t: TaskItem) => t.snoozed_until !== null && Date.parse(t.snoozed_until) > now;

  const open = tasks.filter((t) => !t.completed_at);
  const sections: { title: string; items: TaskItem[] }[] = [
    { title: "Overdue", items: open.filter((t) => !snoozed(t) && t.due_at && Date.parse(t.due_at) < now) },
    {
      title: "Due in the next 7 days",
      items: open.filter((t) => !snoozed(t) && t.due_at && Date.parse(t.due_at) >= now && Date.parse(t.due_at) <= weekAhead),
    },
    {
      title: "Later or no date",
      items: open.filter((t) => !snoozed(t) && (!t.due_at || Date.parse(t.due_at) > weekAhead)),
    },
    { title: "Snoozed", items: open.filter(snoozed) },
    { title: "Completed", items: tasks.filter((t) => t.completed_at).slice(0, 25) },
  ];

  const applications = (appsRes.data ?? []).map((a) => ({ id: a.id, label: `${a.title} at ${a.company_name}` }));

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>

      <section aria-labelledby="add-task" className="space-y-3 rounded-lg border p-4">
        <h2 id="add-task" className="font-medium">
          Add a task
        </h2>
        <TaskForm applications={applications} />
      </section>

      {tasksRes.error ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t load tasks. Refresh to try again.
        </p>
      ) : tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No tasks yet. Add follow-ups, deadlines and prep work above, and they will show up here and on your dashboard.
        </p>
      ) : (
        sections
          .filter((s) => s.items.length > 0)
          .map((s) => (
            <section key={s.title} aria-label={s.title} className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {s.title} ({s.items.length})
              </h2>
              <TaskList tasks={s.items} now={now} showApplication />
            </section>
          ))
      )}
    </div>
  );
}
