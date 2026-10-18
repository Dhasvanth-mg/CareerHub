import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { AlignmentType, BorderStyle, Document, LevelFormat, Packer, Paragraph, TextRun } from "docx";

/**
 * Rebuilds a clean, ATS-friendly resume file from the text stored for a version. It is a plain layout, not a copy of the original
 * design: the original upload is always available to download as it was.
 */

export type Block =
  | { kind: "name"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "text"; text: string }
  | { kind: "gap" };

const BULLET = /^\s*([•·▪◦●○\-–—*])\s+(.*)$/;

/** Splits resume text into a name line, section headings, bullets and paragraphs. */
export function parseBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n?/g, "\n").replace(/ /g, " ").split("\n");
  const blocks: Block[] = [];
  let seenContent = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    if (!line.trim()) {
      if (blocks.length > 0 && blocks[blocks.length - 1].kind !== "gap") blocks.push({ kind: "gap" });
      continue;
    }
    const text = line.trim();
    const bullet = line.match(BULLET);
    if (!seenContent) {
      seenContent = true;
      blocks.push({ kind: "name", text });
    } else if (bullet) {
      blocks.push({ kind: "bullet", text: bullet[2] });
    } else if (isHeading(text)) {
      blocks.push({ kind: "heading", text });
    } else {
      blocks.push({ kind: "text", text });
    }
  }
  while (blocks.length > 0 && blocks[blocks.length - 1].kind === "gap") blocks.pop();
  return blocks;
}

function isHeading(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3 || text.length > 50) return false;
  // "EXPERIENCE", "Work Experience:" and similar short section titles.
  return letters === letters.toUpperCase() || /^[A-Z][A-Za-z &/,-]{2,40}:$/.test(text);
}

// ---------------------------------------------------------------- PDF

const REPLACEMENTS: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "−": "-",
  "…": "...",
  "•": "-",
  " ": " ",
  "​": "",
  "\t": "    ",
};

/** The standard PDF fonts only cover Western European characters, so swap look-alikes and drop the rest. */
export function pdfSafe(text: string, font: PDFFont): string {
  const supported = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of text) {
    const mapped = REPLACEMENTS[ch] ?? ch;
    for (const c of mapped) out += supported.has(c.codePointAt(0) as number) ? c : "?";
  }
  return out;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    // A single very long token (a URL) is split so it never runs off the page.
    let rest = word;
    while (font.widthOfTextAtSize(rest, size) > maxWidth) {
      let cut = rest.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    cur = rest;
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function buildPdf(title: string, text: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title.slice(0, 200));
  pdf.setProducer("CareerHub AI");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 612;
  const H = 792;
  const margin = 54;
  const maxWidth = W - margin * 2;
  let page = pdf.addPage([W, H]);
  let y = H - margin;

  const ensure = (needed: number) => {
    if (y - needed < margin) {
      page = pdf.addPage([W, H]);
      y = H - margin;
    }
  };
  const draw = (line: string, font: PDFFont, size: number, x: number, leading: number) => {
    ensure(leading);
    y -= leading;
    page.drawText(line, { x, y: y + (leading - size) * 0.25, size, font, color: rgb(0.08, 0.08, 0.1) });
  };

  for (const block of parseBlocks(text)) {
    switch (block.kind) {
      case "name":
        for (const l of wrap(pdfSafe(block.text, bold), bold, 18, maxWidth)) draw(l, bold, 18, margin, 24);
        y -= 4;
        break;
      case "heading": {
        ensure(34);
        y -= 8;
        for (const l of wrap(pdfSafe(block.text.replace(/:$/, ""), bold), bold, 11.5, maxWidth)) draw(l, bold, 11.5, margin, 16);
        page.drawLine({ start: { x: margin, y: y - 2 }, end: { x: W - margin, y: y - 2 }, thickness: 0.6, color: rgb(0.55, 0.55, 0.6) });
        y -= 4;
        break;
      }
      case "bullet": {
        const lines = wrap(pdfSafe(block.text, regular), regular, 10.5, maxWidth - 16);
        lines.forEach((l, i) => {
          if (i === 0) {
            ensure(14);
            page.drawCircle({ x: margin + 5, y: y - 8.6, size: 1.4, color: rgb(0.2, 0.2, 0.25) });
          }
          draw(l, regular, 10.5, margin + 16, 14);
        });
        break;
      }
      case "text":
        for (const l of wrap(pdfSafe(block.text, regular), regular, 10.5, maxWidth)) draw(l, regular, 10.5, margin, 14);
        break;
      case "gap":
        y -= 5;
        break;
    }
  }
  return pdf.save();
}

// ---------------------------------------------------------------- DOCX

export async function buildDocx(title: string, text: string): Promise<Buffer> {
  const FONT = "Calibri";
  const children: Paragraph[] = [];
  for (const block of parseBlocks(text)) {
    switch (block.kind) {
      case "name":
        children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: block.text, bold: true, size: 36, font: FONT })] }));
        break;
      case "heading":
        children.push(
          new Paragraph({
            spacing: { before: 200, after: 80 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "8A8A96", space: 2 } },
            children: [new TextRun({ text: block.text.replace(/:$/, ""), bold: true, size: 23, font: FONT })],
          }),
        );
        break;
      case "bullet":
        children.push(
          new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 40 }, children: [new TextRun({ text: block.text, size: 21, font: FONT })] }),
        );
        break;
      case "text":
        children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: block.text, size: 21, font: FONT })] }));
        break;
      case "gap":
        children.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        break;
    }
  }
  const doc = new Document({
    creator: "CareerHub AI",
    title: title.slice(0, 200),
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }],
        },
      ],
    },
    sections: [{ properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } }, children }],
  });
  return Packer.toBuffer(doc);
}
