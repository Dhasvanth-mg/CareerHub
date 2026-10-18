import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Liveness check for uptime monitors. Reveals nothing beyond whether the app and database answer. */
export async function GET() {
  let db = false;
  try {
    const supabase = await createClient();
    // Signed-out visitors can't read tables, so ask the database a question it can always answer.
    const { data, error } = await supabase.rpc("health_check");
    db = !error && data === true;
  } catch {
    db = false;
  }
  return NextResponse.json(
    { status: db ? "ok" : "degraded", database: db ? "up" : "down", time: new Date().toISOString() },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
