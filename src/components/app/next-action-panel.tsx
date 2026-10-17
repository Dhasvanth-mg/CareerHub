import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AiGate } from "@/components/app/ai-gate";
import { GenerateNextAction } from "@/components/app/generate-next-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { decideProposal } from "@/app/(app)/applications/ai-actions";

type Proposal = {
  id: string;
  rationale: string | null;
  sources: { key: string; text: string }[] | null;
  payload: {
    action: string;
    confidence: "high" | "medium" | "low";
    uncertainty: string | null;
    task_title: string | null;
    task_due_date: string | null;
  };
};

const CONFIDENCE = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" } as const;

export async function NextActionPanel({ applicationId }: { applicationId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_proposals")
    .select("id, rationale, sources, payload")
    .eq("application_id", applicationId)
    .eq("kind", "next_action")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);
  const proposal = (data?.[0] ?? null) as Proposal | null;

  return (
    <section aria-labelledby="next-action" className="space-y-3 rounded-lg border p-4">
      <h2 id="next-action" className="flex items-center gap-2 text-lg font-medium">
        <Sparkles className="size-4" aria-hidden="true" /> Suggested next step
      </h2>
      <AiGate feature="next-step suggestions">
        {proposal ? (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              AI suggestion · not saved to your record
            </p>
            <p className="text-base font-medium">{proposal.payload.action}</p>
            <p className="text-sm">{proposal.rationale}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{CONFIDENCE[proposal.payload.confidence]}</Badge>
              {proposal.payload.task_title ? (
                <span className="text-xs text-muted-foreground">
                  Approving adds the task &ldquo;{proposal.payload.task_title}&rdquo;
                  {proposal.payload.task_due_date ? ` due ${proposal.payload.task_due_date}` : ""}.
                </span>
              ) : null}
            </div>
            {proposal.payload.uncertainty ? (
              <p className="text-sm text-muted-foreground">Not sure about: {proposal.payload.uncertainty}</p>
            ) : null}

            <div>
              <h3 className="text-sm font-medium">Based on these parts of your record</h3>
              {proposal.sources && proposal.sources.length > 0 ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                  {proposal.sources.map((s) => (
                    <li key={s.key}>{s.text}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Nothing specific. Treat this as a general idea.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <form action={decideProposal.bind(null, proposal.id, true)}>
                <Button type="submit">{proposal.payload.task_title ? "Approve and add task" : "Got it"}</Button>
              </form>
              <form action={decideProposal.bind(null, proposal.id, false)}>
                <Button type="submit" variant="outline">
                  Dismiss
                </Button>
              </form>
            </div>
            <GenerateNextAction applicationId={applicationId} hasExisting />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Get one concrete next step based on this application&apos;s stage, deadline, tasks, contacts and history. You&apos;ll see
              exactly which parts of the record it used, and nothing changes unless you approve it.
            </p>
            <GenerateNextAction applicationId={applicationId} hasExisting={false} />
          </div>
        )}
      </AiGate>
    </section>
  );
}
