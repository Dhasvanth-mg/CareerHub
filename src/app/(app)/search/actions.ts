"use server";

import { createClient } from "@/lib/supabase/server";

export type SearchHit = {
  id: string;
  group: "Applications" | "Contacts" | "Tasks" | "Documents" | "Evidence";
  title: string;
  sub: string;
  href: string;
};

const PER_GROUP = 5;

/** Searches the signed-in user's own records. Row level security scopes every query, so nothing else can match. */
export async function searchEverything(query: string): Promise<SearchHit[]> {
  const term = String(query ?? "")
    .replace(/[%,()*\\_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  if (term.length < 2) return [];

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const like = `%${term}%`;

  const [apps, contacts, tasks, docs, evidence] = await Promise.all([
    supabase
      .from("applications")
      .select("id, company_name, title, stage")
      .is("archived_at", null)
      .or(`company_name.ilike.${like},title.ilike.${like}`)
      .order("updated_at", { ascending: false })
      .limit(PER_GROUP),
    supabase
      .from("contacts")
      .select("id, name, company, position")
      .or(`name.ilike.${like},company.ilike.${like},email.ilike.${like}`)
      .limit(PER_GROUP),
    supabase.from("tasks").select("id, title, completed_at").ilike("title", like).order("due_at", { nullsFirst: false }).limit(PER_GROUP),
    supabase.from("documents").select("id, title, kind").ilike("title", like).limit(PER_GROUP),
    supabase.from("evidence_items").select("id, title, kind").ilike("title", like).limit(PER_GROUP),
  ]);

  const hits: SearchHit[] = [];
  for (const a of apps.data ?? []) {
    hits.push({ id: a.id, group: "Applications", title: `${a.title} at ${a.company_name}`, sub: a.stage, href: `/applications/${a.id}` });
  }
  for (const c of contacts.data ?? []) {
    hits.push({ id: c.id, group: "Contacts", title: c.name, sub: [c.position, c.company].filter(Boolean).join(" at "), href: `/contacts/${c.id}` });
  }
  for (const t of tasks.data ?? []) {
    hits.push({ id: t.id, group: "Tasks", title: t.title, sub: t.completed_at ? "Done" : "Open", href: "/tasks" });
  }
  for (const d of docs.data ?? []) {
    hits.push({ id: d.id, group: "Documents", title: d.title, sub: d.kind.replace("_", " "), href: `/documents/${d.id}` });
  }
  for (const e of evidence.data ?? []) {
    hits.push({ id: e.id, group: "Evidence", title: e.title, sub: e.kind, href: "/evidence" });
  }
  return hits;
}
