import { createClient } from "@/lib/supabase/server";
import { AddEvidenceForm, EvidenceCard, type EvidenceRow } from "@/components/app/evidence-ui";
import { EVIDENCE_KINDS, EVIDENCE_KIND_LABEL } from "@/lib/domain";

export const metadata = { title: "Evidence library | CareerHub AI" };

export default async function EvidencePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("evidence_items")
    .select("id, kind, title, when_text, details, outcome, link")
    .order("updated_at", { ascending: false })
    .limit(500);
  const items = (data ?? []) as EvidenceRow[];

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Evidence library</h1>
        <p className="text-sm text-muted-foreground">
          Real projects, results and skills you can point to, in your own words. Resume Studio, Cover Letter Studio and Interview Prep can
          cite these as proof, and never invent anything beyond them. This is especially useful if your experience doesn&apos;t fit neatly
          on a resume.
        </p>
      </div>

      <section aria-labelledby="add" className="space-y-3 rounded-lg border p-4">
        <h2 id="add" className="font-medium">
          Add something you&apos;ve done
        </h2>
        <AddEvidenceForm />
      </section>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t load your library. Refresh to try again.
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing here yet. Start with a project, a class, a volunteer role or a result you&apos;re proud of.
        </p>
      ) : (
        EVIDENCE_KINDS.map((kind) => {
          const group = items.filter((i) => i.kind === kind);
          if (group.length === 0) return null;
          return (
            <section key={kind} aria-label={EVIDENCE_KIND_LABEL[kind]} className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                {EVIDENCE_KIND_LABEL[kind]} ({group.length})
              </h2>
              <ul className="space-y-2">
                {group.map((item) => (
                  <EvidenceCard key={item.id} item={item} />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
