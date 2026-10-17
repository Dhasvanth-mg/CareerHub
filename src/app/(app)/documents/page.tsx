import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/app/local-time";
import { UploadForm } from "@/components/app/upload-form";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Document Vault | CareerHub AI" };

const KIND_LABEL: Record<string, string> = {
  resume: "Resume",
  cover_letter: "Cover letter",
  transcript: "Transcript",
  portfolio: "Portfolio",
  other: "Other",
};

type Doc = {
  id: string;
  kind: string;
  title: string;
  created_at: string;
  document_versions: { id: string; version: number; created_at: string; extraction_state: string }[];
};

export default async function DocumentsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data, error } = await supabase
    .from("documents")
    .select("id, kind, title, created_at, document_versions(id, version, created_at, extraction_state)")
    .order("created_at", { ascending: false })
    .limit(200);
  const docs = (data ?? []) as unknown as Doc[];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Document Vault</h1>
        <p className="text-sm text-muted-foreground">
          Keep your resumes and cover letters here. Every upload becomes a version, so you can always see exactly what you
          submitted. Files are private to your account.
        </p>
      </div>

      <section aria-labelledby="add-doc" className="space-y-3 rounded-lg border p-4">
        <h2 id="add-doc" className="font-medium">
          Add a document
        </h2>
        <UploadForm userId={auth.user.id} compact />
      </section>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t load your documents. Refresh to try again.
        </p>
      ) : docs.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing here yet. Upload your resume to get started.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {docs.map((d) => {
            const versions = [...d.document_versions].sort((a, b) => b.version - a.version);
            const latest = versions[0];
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <Link href={`/documents/${d.id}`} className="font-medium underline-offset-4 hover:underline">
                    {d.title}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {KIND_LABEL[d.kind] ?? d.kind} · {versions.length} version{versions.length === 1 ? "" : "s"}
                    {latest ? (
                      <>
                        {" · updated "}
                        <LocalTime iso={latest.created_at} dateOnly />
                      </>
                    ) : null}
                  </p>
                </div>
                {latest && latest.extraction_state !== "ok" ? (
                  <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-300">
                    No readable text
                  </Badge>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
