import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractPdfText } from "@/lib/documents";

async function makePdf(pages: number, text?: string) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = pdf.addPage([612, 792]);
    if (text) page.drawText(`${text} (page ${i + 1})`, { x: 40, y: 740, size: 10, font });
  }
  return new Uint8Array(await pdf.save());
}

describe("extractPdfText", () => {
  it("reads text from a normal PDF", async () => {
    const out = await extractPdfText(await makePdf(1, "Firmware engineer with C and Git experience, built robots for campus events."));
    expect(out.state).toBe("ok");
    expect(out.pages).toBe(1);
    expect(out.text).toContain("Firmware engineer");
  });

  it("reports a PDF with no text as empty rather than analysing nothing", async () => {
    expect((await extractPdfText(await makePdf(1))).state).toBe("empty");
  });

  it("fails safely on a file that only claims to be a PDF", async () => {
    expect((await extractPdfText(new TextEncoder().encode("%PDF-1.4 definitely not a real pdf"))).state).toBe("failed");
  });

  it("refuses PDFs with an excessive number of pages", async () => {
    const out = await extractPdfText(await makePdf(120, "Page text that is long enough to matter for the test."));
    expect(out.state).toBe("failed");
    expect(out.pages).toBe(120);
  });
});
