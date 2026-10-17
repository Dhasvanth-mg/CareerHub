import "server-only";
import { z } from "zod";

/** Thrown when the model can't be reached or isn't configured. Never carries prompt/document text. */
export class AiUnavailableError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
// openai/gpt-oss-120b supports strict JSON-schema output on Groq. Override with GROQ_MODEL.
export const DEFAULT_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

type Options<S extends z.ZodType> = {
  /** Name for the JSON schema (letters, digits, underscores). */
  name: string;
  /** Strict-mode JSON Schema: every property required, additionalProperties: false. */
  jsonSchema: Record<string, unknown>;
  system: string;
  user: string;
  /** Validates the model output. Server-side validation is the source of truth, not the model. */
  schema: S;
  maxTokens?: number;
  model?: string;
};

export async function groqJson<S extends z.ZodType>(opts: Options<S>): Promise<{ data: z.infer<S>; model: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new AiUnavailableError("AI features aren't configured yet.", false);
  const model = opts.model ?? DEFAULT_MODEL;

  let lastProblem = "The AI response couldn't be read.";
  for (let attempt = 0; attempt < 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_completion_tokens: opts.maxTokens ?? 4000,
          reasoning_effort: "low",
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: opts.name, strict: true, schema: opts.jsonSchema },
          },
        }),
      });
    } catch {
      throw new AiUnavailableError("The AI service didn't respond in time. Please try again.");
    }

    if (res.status === 401 || res.status === 403) {
      throw new AiUnavailableError("AI features aren't configured correctly.", false);
    }
    if (res.status === 429 || res.status >= 500) {
      throw new AiUnavailableError("The AI service is busy right now. Please try again in a minute.");
    }
    if (!res.ok) {
      throw new AiUnavailableError("The AI request was rejected.", false);
    }

    try {
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = body.choices?.[0]?.message?.content;
      if (!content) throw new Error("empty");
      const parsed = opts.schema.safeParse(JSON.parse(content));
      if (parsed.success) return { data: parsed.data, model };
      lastProblem = "The AI response didn't match the expected format.";
    } catch {
      lastProblem = "The AI response couldn't be read.";
    }
  }
  throw new AiUnavailableError(lastProblem);
}
