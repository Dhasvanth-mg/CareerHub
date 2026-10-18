"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbMessage, type ActionState } from "@/lib/forms";
import { buildApplicationFacts } from "@/lib/ai/application-facts";
import { askCopilot } from "@/lib/ai/copilot";
import { AiUnavailableError } from "@/lib/ai/groq";
import { checkAiAllowed } from "@/lib/ai/guard";

const uuid = z.string().uuid();

export async function sendCopilotMessage(applicationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const id = uuid.safeParse(applicationId);
  const question = String(formData.get("question") ?? "").trim();
  if (!id.success) return { error: "Application not found." };
  if (question.length < 2) return { error: "Type a question first." };
  if (question.length > 1000) return { error: "Please keep questions under 1,000 characters." };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const record = await buildApplicationFacts(supabase, id.data, today);
  if (!record) return { error: "Application not found." };

  const allowed = await checkAiAllowed(supabase, "copilot");
  if (!allowed.ok) return { error: allowed.message };

  const { data: past } = await supabase
    .from("copilot_messages")
    .select("role, content")
    .eq("application_id", id.data)
    .order("created_at", { ascending: false })
    .limit(8);
  const history = (past ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string }));

  let reply;
  try {
    reply = await askCopilot({ facts: record.facts, history, question, today });
  } catch (e) {
    return { error: e instanceof AiUnavailableError ? e.message : "The assistant couldn't answer. Please try again." };
  }

  const { error } = await supabase.from("copilot_messages").insert([
    { application_id: id.data, role: "user", content: question },
    {
      application_id: id.data,
      role: "assistant",
      content: reply.answer,
      sources: reply.sources,
      draft: reply.draft,
    },
  ]);
  if (error) return { error: dbMessage(error, "The answer couldn't be saved. Please try again.") };

  revalidatePath(`/applications/${id.data}`);
  return undefined;
}

export async function clearCopilot(applicationId: string) {
  const id = uuid.safeParse(applicationId);
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("copilot_messages").delete().eq("application_id", id.data);
  revalidatePath(`/applications/${id.data}`);
}
