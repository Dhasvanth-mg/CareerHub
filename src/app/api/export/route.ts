import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeAnalytics, type AppInput, type EventInput } from "@/lib/analytics";
import { toCsv } from "@/lib/csv";

const TABLES = [
  "profiles",
  "companies",
  "job_postings",
  "job_requirements",
  "applications",
  "application_events",
  "tasks",
  "contacts",
  "application_contacts",
  "referrals",
  "documents",
  "document_versions",
  "analysis_runs",
  "analysis_findings",
  "ai_proposals",
] as const;

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("format");
  const format = requested === "csv" || requested === "analytics" ? "csv" : "json";
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Unauthorized", { status: 401 });

  const stamp = new Date().toISOString().slice(0, 10);
  const headers = {
    "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="careerhub-${requested === "analytics" ? "analytics" : format === "csv" ? "applications" : "export"}-${stamp}.${format}"`,
  };

  // Row Level Security limits every query to the signed-in user's own rows.
  if (requested === "analytics") {
    const days = Number(request.nextUrl.searchParams.get("p"));
    let q = supabase.from("applications").select("id, stage, created_at, applied_on, source, submitted_resume_version_id").limit(5000);
    if (days === 30 || days === 90) q = q.gte("created_at", new Date(Date.now() - days * 86_400_000).toISOString());
    const { data: apps, error: appsError } = await q;
    if (appsError) return new NextResponse("Export failed", { status: 500 });
    const ids = (apps ?? []).map((a) => a.id).slice(0, 1000);
    const { data: events } = ids.length
      ? await supabase
          .from("application_events")
          .select("application_id, type, from_value, to_value, created_at")
          .in("type", ["created", "stage_changed"])
          .in("application_id", ids)
          .limit(20000)
      : { data: [] };
    const a = computeAnalytics((apps ?? []) as AppInput[], (events ?? []) as EventInput[]);
    const rows: Record<string, unknown>[] = [
      ...a.funnel.map((s) => ({ section: "funnel", name: s.stage, applied: s.count, interviews: "", note: s.fromPrevious === null ? "" : `${s.fromPrevious}% of previous stage` })),
      { section: "summary", name: "applied", applied: a.applied, interviews: "", note: "" },
      { section: "summary", name: "heard back", applied: a.responded, interviews: "", note: a.responseRate === null ? "" : `${a.responseRate}%` },
      { section: "summary", name: "still waiting", applied: a.waiting, interviews: "", note: "" },
      { section: "summary", name: "unknown history (not counted)", applied: a.unknownHistory, interviews: "", note: "" },
      ...a.bySource.map((s) => ({ section: "source", name: s.label, applied: s.applied, interviews: s.interviews, note: s.applied < 5 ? "small sample" : "" })),
    ];
    return new NextResponse("﻿" + toCsv(rows, ["section", "name", "applied", "interviews", "note"]), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
    });
  }
  if (format === "csv") {
    const { data, error } = await supabase
      .from("applications")
      .select(
        "company_name, title, stage, priority, location, work_mode, employment_type, posting_url, source, salary_text, applied_on, deadline, notes, archived_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(10000);
    if (error) return new NextResponse("Export failed", { status: 500 });
    const columns = [
      "company_name",
      "title",
      "stage",
      "priority",
      "location",
      "work_mode",
      "employment_type",
      "posting_url",
      "source",
      "salary_text",
      "applied_on",
      "deadline",
      "notes",
      "archived_at",
      "created_at",
      "updated_at",
    ];
    return new NextResponse("﻿" + toCsv(data ?? [], columns), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
    });
  }

  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { id: auth.user.id, email: auth.user.email },
    note: "Uploaded files themselves are not included here; download them from the Document Vault. Extracted text is included.",
  };
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*").limit(10000);
    if (error) return new NextResponse(`Export failed (${table})`, { status: 500 });
    out[table] = data;
  }
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}
