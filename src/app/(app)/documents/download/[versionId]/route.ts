import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Redirects to a short-lived signed URL. The version lookup runs under RLS, so only the owner gets one. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/documents/download/[versionId]">) {
  const { versionId } = await ctx.params;
  if (!UUID.test(versionId)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: version } = await supabase
    .from("document_versions")
    .select("storage_path, file_name")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(version.storage_path, 60, { download: version.file_name });
  if (error || !data) return new NextResponse("Couldn't prepare the download", { status: 502 });

  const res = NextResponse.redirect(data.signedUrl);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
