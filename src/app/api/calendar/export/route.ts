import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadCalendarEntries } from "@/lib/calendar-export";
import { buildIcs } from "@/lib/ics";

const KEY = /^(interview|task|deadline):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_SELECTED = 1500;

async function respond(selected: Set<string> | null) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Sign in to export your calendar." }, { status: 401 });

  const now = new Date();
  const entries = await loadCalendarEntries(supabase, now);
  const chosen = selected ? entries.filter((e) => selected.has(e.key)) : entries;
  if (chosen.length === 0) return NextResponse.json({ error: "Nothing to export." }, { status: 400 });

  return new NextResponse(buildIcs(chosen.map((e) => e.event), now), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="careerhub-calendar-${now.toISOString().slice(0, 10)}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Everything on the calendar, as an .ics file. */
export async function GET() {
  return respond(null);
}

/** Only the events ticked on the export form. Keys are re-checked against the database, so a forged key exports nothing. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const keys = form
    .getAll("sel")
    .filter((v): v is string => typeof v === "string" && KEY.test(v))
    .slice(0, MAX_SELECTED);
  if (keys.length === 0) return NextResponse.json({ error: "Select at least one event." }, { status: 400 });
  return respond(new Set(keys));
}
