import { createClient } from "@/lib/supabase/server";
import { hasAiConsent } from "@/lib/ai/guard";
import { Button } from "@/components/ui/button";
import { acceptAiNotice } from "@/app/(app)/settings/actions";

export function AiNoticeText() {
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
      <li>
        When you use an AI feature, the text it works on is sent to <strong className="text-foreground">Groq</strong>, our AI
        provider: job posting text, your resume text, or a summary of an application record.
      </li>
      <li>Resumes often contain your name and contact details. They are sent exactly as written.</li>
      <li>
        We store the results (extracted fields, findings, suggestions) in your account so you can review them. AI only suggests;
        nothing is changed or sent without your approval.
      </li>
      <li>You can turn AI features off again in Settings. Tracking, tasks, contacts and documents keep working without AI.</li>
      <li>See Groq&apos;s own terms and privacy policy for how they handle data on their side.</li>
    </ul>
  );
}

/** Shows children once the user has accepted the AI notice; otherwise shows the notice instead. */
export async function AiGate({ children, feature }: { children: React.ReactNode; feature: string }) {
  const supabase = await createClient();
  if (await hasAiConsent(supabase)) return <>{children}</>;
  return (
    <section aria-labelledby="ai-notice" className="space-y-3 rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] p-4">
      <h2 id="ai-notice" className="font-medium">
        Before you use {feature}
      </h2>
      <AiNoticeText />
      <form action={acceptAiNotice}>
        <Button type="submit">I understand, turn on AI features</Button>
      </form>
    </section>
  );
}
