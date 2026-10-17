import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Board, type BoardCard } from "@/components/app/board";
import { DeadlineBadge, StageBadge } from "@/components/app/stage-badge";
import { LocalTime } from "@/components/app/local-time";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{archived ? "Archived applications" : "Applications"}</h1>
        <Button nativeButton={false} render={<Link href="/applications/new" />}>
          <Plus aria-hidden="true" /> Add application
        </Button>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2" role="search">
        <input type="hidden" name="view" value={view} />
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="sr-only">
            Search company or role
          </label>
          <Input id="q" name="q" defaultValue={term} placeholder="Search company or role" />
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
        <div className="ml-auto flex rounded-lg border p-0.5 text-sm" role="group" aria-label="View">
          {(["board", "table"] as const).map((v) => (
            <Link
              key={v}
              href={qs({ view: v })}
              aria-current={view === v ? "true" : undefined}
              className={cn("rounded-md px-3 py-1 capitalize", view === v ? "bg-muted font-medium" : "text-muted-foreground")}
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
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">{filtered ? "No applications match these filters." : "No applications yet."}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered ? (
              <Link href="/applications" className="underline underline-offset-4">
                Clear filters
              </Link>
            ) : (
              "Add the first role you're interested in. A company and a title are enough to start."
            )}
          </p>
        </div>
      ) : view === "board" ? (
        <Board apps={apps as BoardCard[]} />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Applications</caption>
            <thead className="border-b bg-muted/40">
              <tr>
                {(
                  [
                    ["company", "Company"],
                    ["title", "Role"],
                    ["stage", "Stage"],
                    ["deadline", "Deadline"],
                    ["updated", "Updated"],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key} scope="col" aria-sort={ariaSort(key)} className="px-3 py-2 font-medium">
                    <Link href={sortLink(key)} className="hover:underline">
                      {label}
                      {sort === key ? (dir === "asc" ? " ↑" : " ↓") : ""}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {apps.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">{a.company_name}</td>
                  <td className="px-3 py-2">
                    <Link href={`/applications/${a.id}`} className="font-medium underline-offset-4 hover:underline">
                      {a.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <StageBadge stage={a.stage as Stage} />
                  </td>
                  <td className="px-3 py-2">
                    {a.deadline ? <DeadlineBadge date={a.deadline} /> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <LocalTime iso={a.updated_at} dateOnly />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
