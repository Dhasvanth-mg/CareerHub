import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin | CareerHub AI" };

type Overview = {
  generated_at: string;
  users: { total: number; new_7d: number; new_30d: number; active_1d: number; active_7d: number; ai_enabled: number };
  signups_by_day: { day: string; n: number }[];
  providers: Record<string, number>;
  rows: Record<string, number>;
  storage_bytes: number;
  ai: { calls_24h: number; calls_72h: number; users_24h: number; by_kind_24h: Record<string, number> };
};

const PROVIDER_LABEL: Record<string, string> = { email: "Email and password", github: "GitHub", google: "Google", linkedin_oidc: "LinkedIn" };
const ROW_LABEL: Record<string, string> = {
  applications: "Applications",
  tasks: "Tasks",
  contacts: "Contacts",
  interview_rounds: "Interview rounds",
  documents: "Documents",
  document_versions: "Document versions",
  analysis_runs: "AI analyses",
  evidence_items: "Evidence items",
  offers: "Offers",
  share_links_active: "Active share links",
};
const mb = (b: number) => `${(b / 1_048_576).toFixed(1)} MB`;

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  // Everyone else sees an ordinary not-found page, so the route's existence isn't advertised.
  if (isAdmin !== true) notFound();

  const { data, error } = await supabase.rpc("admin_overview");
  const o = data as Overview | null;
  if (error || !o) {
    return (
      <div className="max-w-5xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p role="alert" className="text-sm text-destructive">
          The overview couldn&apos;t be loaded. Try again in a moment.
        </p>
      </div>
    );
  }

  const aiCap = Number(process.env.AI_GLOBAL_DAILY_LIMIT) || 3000;
  const aiPct = Math.min(100, Math.round((o.ai.calls_24h / aiCap) * 100));
  const maxDay = Math.max(1, ...o.signups_by_day.map((d) => d.n));

  const stats: [string, number | string, string?][] = [
    ["Users", o.users.total],
    ["New this week", o.users.new_7d, `${o.users.new_30d} in 30 days`],
    ["Active today", o.users.active_1d, `${o.users.active_7d} in 7 days`],
    ["AI turned on", o.users.ai_enabled, `of ${o.users.total}`],
    ["Document storage", mb(o.storage_bytes), "of 100 MB per person"],
  ];

  return (
    <div className="max-w-5xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Counts only. This page never shows anyone&apos;s email, documents, notes or AI output. Numbers as of{" "}
          {new Date(o.generated_at).toISOString().slice(0, 16).replace("T", " ")} UTC.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stats.map(([label, value, hint]) => (
          <div key={label} className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-semibold">{value}</dd>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </div>
        ))}
      </dl>

      <section aria-labelledby="ai" className="space-y-3">
        <h2 id="ai" className="text-lg font-medium">
          AI use
        </h2>
        <p className="text-sm">
          {o.ai.calls_24h} call{o.ai.calls_24h === 1 ? "" : "s"} in the last 24 hours from {o.ai.users_24h} {o.ai.users_24h === 1 ? "person" : "people"}
          , against a daily cap of {aiCap}. {o.ai.calls_72h} in the last 3 days.
        </p>
        <div
          className="h-1.5 max-w-md overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Share of the daily AI cap used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={aiPct}
        >
          <div className={`h-full ${aiPct >= 80 ? "bg-destructive" : "bg-primary"}`} style={{ width: `${aiPct}%` }} />
        </div>
        {Object.keys(o.ai.by_kind_24h).length > 0 ? (
          <ul className="flex flex-wrap gap-2 text-sm">
            {Object.entries(o.ai.by_kind_24h)
              .sort((a, b) => b[1] - a[1])
              .map(([kind, n]) => (
                <li key={kind} className="rounded-md border px-2 py-1">
                  {kind.replace(/_/g, " ")}: {n}
                </li>
              ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="signups" className="space-y-3">
        <h2 id="signups" className="text-lg font-medium">
          Sign-ups, last 30 days
        </h2>
        {o.signups_by_day.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sign-ups in the last 30 days.</p>
        ) : (
          <ul className="flex h-28 items-end gap-1" aria-label="Sign-ups per day">
            {o.signups_by_day.map((d) => (
              <li key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${d.n}`}>
                <span className="text-[10px] text-muted-foreground">{d.n}</span>
                <span className="w-full rounded-sm bg-primary" style={{ height: `${Math.max(6, (d.n / maxDay) * 80)}px` }} />
                <span className="sr-only">
                  {d.day}: {d.n}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-labelledby="providers" className="space-y-3">
          <h2 id="providers" className="text-lg font-medium">
            Sign-in methods
          </h2>
          <ul className="divide-y rounded-lg border text-sm">
            {Object.entries(o.providers)
              .sort((a, b) => b[1] - a[1])
              .map(([p, n]) => (
                <li key={p} className="flex justify-between p-2.5">
                  <span>{PROVIDER_LABEL[p] ?? p}</span>
                  <span className="font-medium">{n}</span>
                </li>
              ))}
          </ul>
        </section>

        <section aria-labelledby="rows" className="space-y-3">
          <h2 id="rows" className="text-lg font-medium">
            Records stored
          </h2>
          <ul className="divide-y rounded-lg border text-sm">
            {Object.entries(o.rows).map(([k, n]) => (
              <li key={k} className="flex justify-between p-2.5">
                <span>{ROW_LABEL[k] ?? k}</span>
                <span className="font-medium">{n}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
