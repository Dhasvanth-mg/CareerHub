import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildDocx, buildPdf } from "@/lib/resume-export";
import { safeFileName } from "@/lib/documents";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain; charset=utf-8",
} as const;

/** Rebuilds a version's saved text as a PDF, Word or plain text file. The lookup runs under RLS, so only the owner can export it. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/documents/export/[versionId]">) {
  const { versionId } = await ctx.params;
  const format = request.nextUrl.searchParams.get("format") ?? "pdf";
  if (!UUID.test(versionId) || !(format in TYPES)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: version } = await supabase
    .from("document_versions")
    .select("version, extracted_text, documents(title)")
    .eq("id", versionId)
    .maybeSingle();
  const text = version?.extracted_text?.trim();
  if (!version || !text) return new NextResponse("There is no saved text for this version to export.", { status: 404 });

  const doc = Array.isArray(version.documents) ? version.documents[0] : version.documents;
  const title = doc?.title ?? "Resume";
  const base = safeFileName(`${title}-v${version.version}`).replace(/\.[a-z0-9]+$/i, "") || "resume";

  let body: BodyInit;
  if (format === "pdf") body = new Uint8Array(await buildPdf(title, text));
  else if (format === "docx") body = new Uint8Array(await buildDocx(title, text));
  else body = text + "\n";

  return new NextResponse(body, {
    headers: {
      "Content-Type": TYPES[format as keyof typeof TYPES],
      "Content-Disposition": `attachment; filename="${base}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
