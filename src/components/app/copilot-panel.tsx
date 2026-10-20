import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AiGate } from "@/components/app/ai-gate";
import { CopilotChat, type CopilotMessage } from "@/components/app/copilot-chat";

export async function CopilotPanel({ applicationId }: { applicationId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("copilot_messages")
    .select("id, role, content, sources, draft")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(30);
  const messages = ((data ?? []) as CopilotMessage[]).reverse();

  return (
    <section aria-labelledby="copilot" className="space-y-3 rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] p-4">
      <h2 id="copilot" className="flex items-center gap-2 text-lg font-medium">
        <MessageCircle className="size-4" aria-hidden="true" /> Ask about this application
      </h2>
      <p className="text-sm text-muted-foreground">
        Answers come only from this application&apos;s record and show which parts they used. It can draft messages, but it never sends
        anything.
      </p>
      <AiGate feature="the assistant">
        <CopilotChat applicationId={applicationId} messages={messages} />
      </AiGate>
    </section>
  );
}
