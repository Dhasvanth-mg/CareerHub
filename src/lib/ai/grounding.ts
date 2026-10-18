/** Shared checks for turning model output into things we are willing to show. */

export type SourceText = { label: string; text: string };

export const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Finds which source (resume, evidence item, ...) contains a quote the model gave us.
 * Returns the label of the first source that really contains it, or null. A quote that is not
 * found must never be shown as evidence.
 */
export function locateQuote(quote: string | null | undefined, sources: SourceText[]): string | null {
  if (!quote) return null;
  const q = normalize(quote);
  if (q.length < 8) return null; // too short to be meaningful evidence
  for (const s of sources) if (normalize(s.text).includes(q)) return s.label;
  return null;
}

export const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));

/** Escapes a closing tag so untrusted text can't break out of the data block it is placed in. */
export const fence = (text: string, tag: string, limit: number) => text.slice(0, limit).replaceAll(`</${tag}>`, "");
