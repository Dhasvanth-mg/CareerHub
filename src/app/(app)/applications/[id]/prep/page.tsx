import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AiGate } from "@/components/app/ai-gate";
import { LocalTime } from "@/components/app/local-time";
import { PrepGenerateForm, PrepItemCard, type PrepItem } from "@/components/app/prep-ui";
import { defaultResumeVersionId } from "@/lib/ai/sources";
import { ROUND_TYPE_LABEL, type RoundType } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const metadata = { title: "Interview prep | CareerHub AI" };
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PrepPage({ params, searchParams }: PageProps<"/applications/[id]/prep">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("id, title, company_name").eq("id", id).maybeSingle();
  if (!app) notFound();

  const [roundsRes, versionsRes, evidenceRes, defaultResume] = await Promise.all([
    supabase
      .from("interview_rounds")
      .select("id, round_type, status, scheduled_at")
      .eq("application_id", id)
      .order("scheduled_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("document_versions")
      .select("id, version, documents!inner(title, kind)")
      .eq("documents.kind", "resume")
      .eq("extraction_state", "ok")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("evidence_items").select("id", { count: "exact", head: true }),
    defaultResumeVersionId(supabase, id),
  ]);

  const rounds = roundsRes.data ?? [];
  const requested = one(sp.round);
  const roundId = requested && rounds.some((r) => r.id === requested) ? requested : null;

  let itemsQuery = supabase
    .from("interview_prep_items")
    .select("id, question, category, why, requirement_text, resume_evidence, evidence_source, answer_draft, feedback")
    .eq("application_id", id)
    .order("created_at", { ascending: true });
  itemsQuery = roundId ? itemsQuery.eq("round_id", roundId) : itemsQuery.is("round_id", null);
  const { data: items } = await itemsQuery;

  const resumes = ((versionsRes.data ?? []) as unknown as { id: string; version: number; documents: { title: string } }[]).map((v) => ({
    id: v.id,
    label: `${v.documents.title}, version ${v.version}`,
  }));

  const tabs = [{ id: null as string | null, label: "General" }, ...rounds.map((r) => ({ id: r.id as string | null, label: ROUND_TYPE_LABEL[r.round_type as RoundType] }))];

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-2">
        <Link href={`/applications/${id}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← {app.title} at {app.company_name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Interview prep</h1>
        <p className="text-sm text-muted-foreground">
          Practice questions based on this role&apos;s requirements and your own experience. Write your answers in your own words. The AI
          reviews them but never writes them for you.
        </p>
      </div>

      <nav aria-label="Interview" className="flex flex-wrap gap-2 text-sm">
        {tabs.map((t, i) => {
          const active = t.id === roundId;
          const r = rounds.find((x) => x.id === t.id);
          return (
            <Link
              key={`${t.id}-${i}`}
              href={t.id ? `/applications/${id}/prep?round=${t.id}` : `/applications/${id}/prep`}
              aria-current={active ? "true" : undefined}
              className={cn("rounded-md border px-3 py-1", active ? "bg-muted font-medium" : "text-muted-foreground")}
            >
              {t.label}
              {r?.scheduled_at ? (
                <span className="ml-1 text-xs">
                  · <LocalTime iso={r.scheduled_at} dateOnly />
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <section aria-labelledby="gen" className="space-y-3 rounded-lg border p-4">
        <h2 id="gen" className="font-medium">
          {items && items.length ? "Generate more questions" : "Generate practice questions"}
        </h2>
        <AiGate feature="interview prep">
          <PrepGenerateForm
            applicationId={id}
            roundId={roundId}
            resumes={resumes}
            defaultResume={defaultResume ?? undefined}
            evidenceCount={evidenceRes.count ?? 0}
          />
        </AiGate>
      </section>

      {items && items.length > 0 ? (
        <ul className="space-y-4">
          {(items as unknown as PrepItem[]).map((item) => (
            <PrepItemCard key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No practice questions yet. Generate a set above.
        </p>
      )}
    </div>
  );
}
