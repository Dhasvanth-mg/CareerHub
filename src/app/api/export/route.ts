import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

/** Spreadsheet apps treat cells starting with = + - @ as formulas; neutralise them. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  return [columns.join(","), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(","))].join("\r\n") + "\r\n";
}

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Unauthorized", { status: 401 });

  const stamp = new Date().toISOString().slice(0, 10);
  const headers = {
    "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="careerhub-${format === "csv" ? "applications" : "export"}-${stamp}.${format}"`,
  };

  // Row Level Security limits every query to the signed-in user's own rows.
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
