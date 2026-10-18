import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_CHARS = 60_000;

export const DOC_KINDS = ["resume", "cover_letter", "transcript", "portfolio", "other"] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export const DOC_KIND_LABEL: Record<DocKind, string> = {
  resume: "Resume",
  cover_letter: "Cover letter",
  transcript: "Transcript",
  portfolio: "Portfolio",
  other: "Other",
};

export type ExtractionState = "ok" | "empty" | "failed";

/** A PDF starts with "%PDF-". The browser's reported type is not trusted. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length > 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
}

/** Plain text only: reject anything containing NUL bytes (binary). */
export function looksLikeText(bytes: Uint8Array): boolean {
  return !bytes.slice(0, 4096).includes(0);
}

const MAX_PDF_PAGES = 80;
const PDF_TIMEOUT_MS = 20_000;

export async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; state: ExtractionState; pages: number }> {
  const failed = { text: "", state: "failed" as const, pages: 0 };
  let timer: ReturnType<typeof setTimeout> | undefined;

  const work = (async () => {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      // A hostile or enormous file shouldn't be able to tie up a server function.
      if (pdf.numPages > MAX_PDF_PAGES) return { ...failed, pages: pdf.numPages };
      const { text, totalPages } = await extractText(pdf, { mergePages: true });
      const clean = (Array.isArray(text) ? text.join("\n") : text)
        .replace(/\u0000/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, MAX_TEXT_CHARS);
      // Scanned/image-only PDFs yield (almost) nothing. Tell the user instead of analysing noise.
      return { text: clean, state: (clean.length < 50 ? "empty" : "ok") as ExtractionState, pages: totalPages };
    } catch {
      return failed;
    }
  })();
  const timeout = new Promise<typeof failed>((resolve) => {
    timer = setTimeout(() => resolve(failed), PDF_TIMEOUT_MS);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** 0-100 readability/extractability signal from the extracted text itself. Deterministic, not AI. */
export function readabilityScore(text: string, state: string, pages: number): number {
  if (state !== "ok") return 0;
  const letters = (text.match(/[A-Za-z]/g) ?? []).length;
  const weird = (text.match(/[^\x09\x0a\x0d\x20-\x7e -ɏ‐-•]/g) ?? []).length;
  const garbled = weird / Math.max(text.length, 1);
  const perPage = text.length / Math.max(pages, 1);
  let score = 100;
  if (text.length < 400) score -= 40;
  if (perPage < 600 && pages > 0) score -= 15;
  if (letters / Math.max(text.length, 1) < 0.5) score -= 20;
  score -= Math.min(40, Math.round(garbled * 400));
  return Math.max(0, Math.min(100, score));
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "document";
}
