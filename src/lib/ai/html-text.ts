const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  bull: "-",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Math.min(parseInt(n, 16), 0x10ffff)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer|form|iframe)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped)
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type JsonLd = Record<string, unknown>;

function findJobPostings(node: unknown, out: JsonLd[] = []): JsonLd[] {
  if (Array.isArray(node)) node.forEach((n) => findJobPostings(n, out));
  else if (node && typeof node === "object") {
    const obj = node as JsonLd;
    const type = obj["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) out.push(obj);
    if (obj["@graph"]) findJobPostings(obj["@graph"], out);
  }
  return out;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Many job pages publish a schema.org JobPosting block; it is cleaner than scraped markup. */
export function extractJobPostingJsonLd(html: string): string {
  const parts: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      for (const job of findJobPostings(JSON.parse(m[1]))) {
        const org = job.hiringOrganization as JsonLd | undefined;
        const loc = job.jobLocation as JsonLd | JsonLd[] | undefined;
        const addr = ((Array.isArray(loc) ? loc[0] : loc)?.address ?? {}) as JsonLd;
        const lines = [
          `Title: ${str(job.title)}`,
          `Company: ${str(org?.name)}`,
          `Location: ${[str(addr.addressLocality), str(addr.addressRegion), str(addr.addressCountry)].filter(Boolean).join(", ")}`,
          `Employment type: ${Array.isArray(job.employmentType) ? job.employmentType.join(", ") : str(job.employmentType)}`,
          `Valid through: ${str(job.validThrough)}`,
          job.baseSalary ? `Listed salary data: ${JSON.stringify(job.baseSalary)}` : "",
          `Description:\n${htmlToText(str(job.description))}`,
        ];
        parts.push(lines.filter((l) => !/^[A-Za-z ]+: ?$/.test(l) && l).join("\n"));
      }
    } catch {
      // Ignore malformed JSON-LD.
    }
  }
  return parts.join("\n\n");
}

/** Text we send to the model for a fetched page. */
export function pageToText(html: string): string {
  const structured = extractJobPostingJsonLd(html);
  const visible = htmlToText(html);
  return structured ? `${structured}\n\n--- Page text ---\n${visible}` : visible;
}
