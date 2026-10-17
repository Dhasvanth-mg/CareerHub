import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocalTime } from "@/components/app/local-time";

export const metadata = { title: "Contacts & Referrals | CareerHub AI" };

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const term = (raw ?? "").replace(/[%,()*\\]/g, " ").trim().slice(0, 100);

  const supabase = await createClient();
  let query = supabase
    .from("contacts")
    .select("id, name, company, position, email, relationship, last_contacted_on, updated_at");
  if (term) query = query.or(`name.ilike.%${term}%,company.ilike.%${term}%`);
  const { data, error } = await query.order("name").limit(500);
  const contacts = data ?? [];

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Contacts &amp; referrals</h1>
        <Button nativeButton={false} render={<Link href="/contacts/new" />}>
          <Plus aria-hidden="true" /> Add contact
        </Button>
      </div>

      <form method="get" role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Search by name or company
        </label>
        <Input id="q" name="q" defaultValue={term} placeholder="Search by name or company" className="max-w-sm" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t load contacts. Refresh to try again.
        </p>
      ) : contacts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="font-medium">{term ? "No contacts match that search." : "No contacts yet."}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {term ? (
              <Link href="/contacts" className="underline underline-offset-4">
                Clear search
              </Link>
            ) : (
              "Add recruiters, alumni and anyone who might refer you, then link them to applications."
            )}
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <Link href={`/contacts/${c.id}`} className="font-medium underline-offset-4 hover:underline">
                  {c.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {[c.position, c.company].filter(Boolean).join(", ") || c.relationship || "No details yet"}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {c.last_contacted_on ? (
                  <>
                    Last contact <LocalTime iso={`${c.last_contacted_on}T12:00:00Z`} dateOnly />
                  </>
                ) : (
                  "Not contacted yet"
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
