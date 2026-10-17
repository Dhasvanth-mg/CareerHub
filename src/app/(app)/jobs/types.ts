import type { JobExtraction } from "@/lib/ai/job-extraction";

export type ExtractState =
  | {
      error?: string;
      postingId?: string;
      extraction?: JobExtraction;
      /** Set when AI couldn't run; the user fills the form by hand. */
      aiError?: string;
      sourceUrl?: string | null;
      sourcePreview?: string;
      truncated?: boolean;
    }
  | undefined;

export type SaveState =
  | {
      error?: string;
      duplicate?: { id: string; label: string };
    }
  | undefined;
