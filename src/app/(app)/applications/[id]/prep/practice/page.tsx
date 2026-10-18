import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PracticeSession, type PracticeQuestion } from "@/components/app/practice-session";

export const metadata = { title: "Timed practice | CareerHub AI" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PracticePage({ params, searchParams }: PageProps<"/applications/[id]/prep/practice">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const round = one(sp.round);
  const roundId = round && UUID.test(round) ? round : null;

  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("id, title, company_name").eq("id", id).maybeSingle();
  if (!app) notFound();

  let query = supabase
    .from("interview_prep_items")
    .select("id, question, category, answer_draft")
    .eq("application_id", id)
    .order("created_at", { ascending: true });
  query = roundId ? query.eq("round_id", roundId) : query.is("round_id", null);
  const { data } = await query;
  const questions: PracticeQuestion[] = (data ?? []).map((q) => ({
    id: q.id,
    question: q.question,
    category: q.category,
    hasDraft: Boolean(q.answer_draft),
  }));
  const back = roundId ? `/applications/${id}/prep?round=${roundId}` : `/applications/${id}/prep`;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link href={back} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Interview prep for {app.title} at {app.company_name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Timed practice</h1>
        <p className="text-sm text-muted-foreground">
          Answer your practice questions against a clock, like the real thing. Nothing is sent to the AI during the session.
        </p>
      </div>
      <PracticeSession questions={questions} backHref={back} />
    </div>
  );
}
