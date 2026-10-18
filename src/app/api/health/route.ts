import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Liveness check for uptime monitors. Reveals nothing beyond whether the app and database answer. */
export async function GET() {
  let db = false;
  try {
    const supabase = await createClient();
    // With no session, row-level security returns zero rows. An error means the database is unreachable.
    const { error } = await supabase.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
    db = !error;
  } catch {
    db = false;
  }
  return NextResponse.json(
    { status: db ? "ok" : "degraded", database: db ? "up" : "down", time: new Date().toISOString() },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
