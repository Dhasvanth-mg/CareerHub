import { createClient } from "@/lib/supabase/server";
import { ShareLinkForm } from "@/components/app/share-links";
import { LocalTime } from "@/components/app/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteShareLink, revokeShareLink } from "@/app/(app)/settings/share-actions";
import { nowMs } from "@/lib/domain";

type LinkRow = {
  id: string;
  label: string;
  include_interviews: boolean;
  expires_at: string;
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
};

/** Settings block for read-only share links. */
export async function ShareSection() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("share_links")
    .select("id, label, include_interviews, expires_at, revoked_at, view_count, last_viewed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  const links = (data ?? []) as LinkRow[];
  const now = nowMs();

  return (
    <section aria-labelledby="sharing" className="space-y-3">
      <h2 id="sharing" className="text-lg font-medium">
        Share your progress
      </h2>
      <p className="text-sm text-muted-foreground">
        Give a mentor or advisor a read-only link to a summary of your search: each company, role, stage and date. It never shows your
        notes, salary, contacts, documents or AI results, and nobody needs an account. You can turn a link off at any time.
      </p>
      <ShareLinkForm />
      {links.length > 0 ? (
        <ul className="divide-y rounded-lg border text-sm">
          {links.map((l) => {
            const expired = Date.parse(l.expires_at) <= now;
            const active = !l.revoked_at && !expired;
            return (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {l.label}
                    {active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">{l.revoked_at ? "Turned off" : "Expired"}</Badge>}
                  </p>
                  <p className="text-muted-foreground">
                    {active ? (
                      <>
                        Expires <LocalTime iso={l.expires_at} dateOnly />
                      </>
                    ) : null}
                    {active ? " · " : ""}
                    {l.view_count} view{l.view_count === 1 ? "" : "s"}
                    {l.last_viewed_at ? (
                      <>
                        {" "}
                        · last <LocalTime iso={l.last_viewed_at} />
                      </>
                    ) : null}
                    {l.include_interviews ? " · shows interview dates" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {active ? (
                    <form action={revokeShareLink.bind(null, l.id)}>
                      <Button type="submit" variant="outline" size="sm">
                        Turn off
                      </Button>
                    </form>
                  ) : null}
                  <form action={deleteShareLink.bind(null, l.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Remove
                    </Button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
