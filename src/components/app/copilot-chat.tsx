"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { clearCopilot, sendCopilotMessage } from "@/app/(app)/applications/[id]/copilot-actions";
import { SubmitButton } from "@/components/app/submit-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOnComplete, useSafeForm } from "@/lib/use-safe-form";

export type CopilotMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: { key: string; text: string }[] | null;
  draft: string | null;
};

const SUGGESTIONS = [
  "What should I do next?",
  "What has changed recently?",
  "Draft a polite follow-up email",
  "Summarize my contacts and referrals",
];

export function CopilotChat({ applicationId, messages }: { applicationId: string; messages: CopilotMessage[] }) {
  const form = useSafeForm(sendCopilotMessage.bind(null, applicationId));
  const { state, onSubmit, pending } = form;
  const formRef = useRef<HTMLFormElement>(null);
  const [text, setText] = useState("");

  useOnComplete(form, () => {
    if (!state?.error) setText("");
  });

  async function copy(draft: string) {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("Draft copied");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it yourself.");
    }
  }

  return (
    <div className="space-y-4">
      {messages.length > 0 ? (
        <ol className="space-y-3" aria-label="Conversation">
          {messages.map((m) => (
            <li
              key={m.id}
              className={m.role === "user" ? "ml-8 rounded-lg bg-muted/60 p-3 text-sm" : "mr-8 space-y-2 rounded-lg border p-3 text-sm"}
            >
              <p className="text-xs font-medium text-muted-foreground">{m.role === "user" ? "You" : "Assistant"}</p>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.draft ? (
                <div className="space-y-2 rounded-md border border-dashed p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Draft · not sent. Review and edit before using it.
                  </p>
                  <p className="whitespace-pre-wrap">{m.draft}</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => copy(m.draft as string)}>
                    Copy draft
                  </Button>
                </div>
              ) : null}
              {m.role === "assistant" ? (
                m.sources && m.sources.length > 0 ? (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Based on {m.sources.length} part{m.sources.length === 1 ? "" : "s"} of your record</summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {m.sources.map((s) => (
                        <li key={s.key}>{s.text}</li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <p className="text-xs text-muted-foreground">Not based on anything specific in your record.</p>
                )
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
          {SUGGESTIONS.map((s) => (
            <Button key={s} type="button" variant="outline" size="sm" onClick={() => setText(s)}>
              {s}
            </Button>
          ))}
        </div>
      )}

      <form ref={formRef} method="post" onSubmit={onSubmit} className="space-y-2">
        <label htmlFor="copilot-q" className="sr-only">
          Ask about this application
        </label>
        <Textarea
          id="copilot-q"
          name="question"
          rows={2}
          maxLength={1000}
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about this application, or ask for a draft message"
        />
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton pending={pending} pendingText="Thinking…">
            Ask
          </SubmitButton>
        </div>
        {state?.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}
      </form>

      {messages.length > 0 ? (
        <form
          action={clearCopilot.bind(null, applicationId)}
          onSubmit={(e) => {
            if (!window.confirm("Clear this conversation?")) e.preventDefault();
          }}
        >
          <Button type="submit" variant="ghost" size="sm">
            <Trash2 aria-hidden="true" /> Clear conversation
          </Button>
        </form>
      ) : null}
    </div>
  );
}
