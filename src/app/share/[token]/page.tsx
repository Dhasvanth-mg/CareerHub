import type { Metadata } from "next";
import { LogoMark } from "@/components/app/logo";
import { LocalTime } from "@/components/app/local-time";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { ROUND_TYPE_LABEL, STAGES, STAGE_LABEL, type RoundType, type Stage } from "@/lib/domain";
import type { SharedProgress } from "@/lib/share";

// The link is a secret: keep it out of search engines and out of Referer headers.
export const metadata: Metadata = {
  title: "Shared job search progress | CareerHub AI",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const dateOnly = (d: string) => `${d}T12:00:00Z`;

export default async function SharedPage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_shared_progress", { p_token: token });
  const progress = (data ?? null) as SharedProgress | null;

  if (!progress) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <LogoMark className="size-10" />
        <h1 className="text-xl font-semibold">This link isn&apos;t available</h1>
        <p className="text-sm text-muted-foreground">It may have expired or been turned off. Ask the person who sent it for a new one.</p>
      </main>
    );
  }

  const counts = new Map<string, number>();
  for (const a of progress.applications) counts.set(a.stage, (counts.get(a.stage) ?? 0) + 1);
  const active = progress.applications.filter((a) => !["rejected", "withdrawn", "accepted"].includes(a.stage)).length;
  const owner = progress.owner?.trim() || "Someone";

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-8 px-6 py-10">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LogoMark className="size-6" /> Shared from CareerHub AI
        </div>
        <h1 className="text-3xl sm:text-4xl">{owner}&apos;s job search</h1>
        <p className="text-sm text-muted-foreground">
          Read-only summary for {progress.label}. It updates as they work, and this link stops working on{" "}
          <LocalTime iso={progress.expires_at} dateOnly />.
        </p>
      </header>

      <section aria-labelledby="overview" className="space-y-3">
        <h2 id="overview" className="sr-only">
          Overview
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Applications", progress.applications.length],
            ["Still active", active],
            ["Interviewing", counts.get("interview") ?? 0],
            ["Offers", (counts.get("offer") ?? 0) + (counts.get("accepted") ?? 0)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <ul className="flex flex-wrap gap-2 text-sm">
          {STAGES.filter((s) => counts.get(s)).map((s) => (
            <li key={s}>
              <Badge variant="secondary">
                {STAGE_LABEL[s as Stage]}: {counts.get(s)}
              </Badge>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="apps" className="space-y-3">
        <h2 id="apps" className="text-xl">
          Applications
        </h2>
        {progress.applications.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06]">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="p-2">Company</th>
                  <th scope="col" className="p-2">Role</th>
                  <th scope="col" className="p-2">Stage</th>
                  <th scope="col" className="p-2">Applied</th>
                  <th scope="col" className="p-2">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {progress.applications.map((a, i) => (
                  <tr key={i}>
                    <td className="p-2 font-medium">{a.company}</td>
                    <td className="p-2">
                      {a.title}
                      {a.location ? <span className="block text-xs text-muted-foreground">{a.location}</span> : null}
                    </td>
                    <td className="p-2">{STAGE_LABEL[a.stage as Stage] ?? a.stage}</td>
                    <td className="whitespace-nowrap p-2">{a.applied_on ? <LocalTime iso={dateOnly(a.applied_on)} dateOnly /> : "—"}</td>
                    <td className="whitespace-nowrap p-2">{a.deadline ? <LocalTime iso={dateOnly(a.deadline)} dateOnly /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {progress.include_interviews && progress.interviews.length > 0 ? (
        <section aria-labelledby="interviews" className="space-y-3">
          <h2 id="interviews" className="text-xl">
            Upcoming interviews
          </h2>
          <ul className="divide-y rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] text-sm">
            {progress.interviews.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <span>
                  <span className="font-medium">{r.company}</span>{" "}
                  <span className="text-muted-foreground">{ROUND_TYPE_LABEL[r.round_type as RoundType] ?? r.round_type}</span>
                </span>
                <LocalTime iso={r.scheduled_at} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        This page shows only company names, roles, stages and dates. It is read-only and needs no account.
      </footer>
    </main>
  );
}
