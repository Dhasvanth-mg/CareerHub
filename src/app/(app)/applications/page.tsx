import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/app/empty-state";
import { Board, type BoardCard } from "@/components/app/board";
import { ApplicationsTable } from "@/components/app/applications-table";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const metadata = { title: "Applications | CareerHub AI" };

const SORTS = {
  company: "company_name",
  title: "title",
  stage: "stage",
  deadline: "deadline",
  updated: "updated_at",
} as const;
type SortKey = keyof typeof SORTS;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function ApplicationsPage({ searchParams }: PageProps<"/applications">) {
  const sp = await searchParams;
  const view = one(sp.view) === "table" ? "table" : "board";
  const term = one(sp.q)
    .replace(/[%,()*\\]/g, " ")
    .trim()
    .slice(0, 100);
  const stage = (STAGES as readonly string[]).includes(one(sp.stage)) ? (one(sp.stage) as Stage) : "";
  const archived = one(sp.archived) === "1";
  const sort = (one(sp.sort) in SORTS ? one(sp.sort) : "updated") as SortKey;
  const dir = one(sp.dir) === "asc" ? "asc" : "desc";

  const supabase = await createClient();
  let query = supabase
    .from("applications")
    .select("id, company_name, title, stage, priority, deadline, location, applied_on, updated_at");
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  if (stage) query = query.eq("stage", stage);
  if (term) query = query.or(`company_name.ilike.%${term}%,title.ilike.%${term}%`);
  const { data, error } = await query
    .order(SORTS[sort], { ascending: dir === "asc", nullsFirst: false })
    .limit(500);
  const apps = data ?? [];

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const base: Record<string, string> = { view, q: term, stage, archived: archived ? "1" : "", sort, dir, ...over };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    return `/applications?${p.toString()}`;
  };
  const sortLink = (key: SortKey) => qs({ sort: key, dir: sort === key && dir === "asc" ? "desc" : "asc" });
  const ariaSort = (key: SortKey) =>
    sort === key ? (dir === "asc" ? ("ascending" as const) : ("descending" as const)) : undefined;
  const filtered = Boolean(term || stage || archived);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <h1 className="text-3xl sm:text-4xl">{archived ? "Archived applications" : "Applications"}</h1>
          <p className="text-muted-foreground">
            {apps.length === 0 ? "Nothing here yet." : `${apps.length} ${apps.length === 1 ? "application" : "applications"}${filtered ? " match" : " in your search"}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button nativeButton={false} variant="outline" render={<Link href="/applications/import" />}>
            Import CSV
          </Button>
          <Button nativeButton={false} render={<Link href="/applications/new" />}>
            <Plus aria-hidden="true" /> Add application
          </Button>
        </div>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2" role="search">
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="sr-only">
            Search company or role
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id="q" name="q" defaultValue={term} placeholder="Search company or role" className="h-9 pl-9" />
          </div>
        </div>
        <div className="w-40">
          <label htmlFor="stage" className="sr-only">
            Stage
          </label>
          <NativeSelect id="stage" name="stage" defaultValue={stage}>
            <option value="">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <label className="flex h-8 items-center gap-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived} /> Archived
        </label>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        <div className="ml-auto flex rounded-full bg-muted p-1 text-sm" role="group" aria-label="View">
          {(["board", "table"] as const).map((v) => (
            <Link
              key={v}
              href={qs({ view: v })}
              aria-current={view === v ? "true" : undefined}
              className={cn("rounded-full px-4 py-1 capitalize transition-colors", view === v ? "bg-card font-medium shadow-xs" : "text-muted-foreground hover:text-foreground")}
            >
              {v}
            </Link>
          ))}
        </div>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t load applications. Refresh to try again.
        </p>
      ) : apps.length === 0 ? (
        <EmptyState
          title={filtered ? "No applications match these filters" : "No applications yet"}
          description={filtered ? "Try a different search or clear the filters to see everything." : "Add the first role you're interested in. A company and a title are enough to start."}
        >
          {filtered ? (
            <Button nativeButton={false} variant="outline" render={<Link href="/applications" />}>
              Clear filters
            </Button>
          ) : (
            <Button nativeButton={false} render={<Link href="/applications/new" />}>
              Add an application
            </Button>
          )}
        </EmptyState>
      ) : view === "board" ? (
        <Board apps={apps as BoardCard[]} />
      ) : (
        <ApplicationsTable
          archivedView={archived}
          rows={apps.map((a) => ({
            id: a.id,
            company_name: a.company_name,
            title: a.title,
            stage: a.stage as Stage,
            deadline: a.deadline,
            updated_at: a.updated_at,
          }))}
          headers={(
            [
              ["company", "Company"],
              ["title", "Role"],
              ["stage", "Stage"],
              ["deadline", "Deadline"],
              ["updated", "Updated"],
            ] as const
          ).map(([key, label]) => ({
            key,
            label,
            href: sortLink(key),
            aria: ariaSort(key),
            arrow: sort === key ? (dir === "asc" ? " ↑" : " ↓") : "",
          }))}
        />
      )}
    </div>
  );
}
