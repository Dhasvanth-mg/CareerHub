import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ConfirmForm } from "@/components/app/confirm-form";
import { ExtractedTextEditor } from "@/components/app/extracted-text-editor";
import { LocalTime } from "@/components/app/local-time";
import { UploadForm } from "@/components/app/upload-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteDocument, deleteVersion } from "../actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KIND_LABEL: Record<string, string> = {
  resume: "Resume",
  cover_letter: "Cover letter",
  transcript: "Transcript",
  portfolio: "Portfolio",
  other: "Other",
};

const size = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export async function generateMetadata({ params }: PageProps<"/documents/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Document | CareerHub AI" };
  const supabase = await createClient();
  const { data } = await supabase.from("documents").select("title").eq("id", id).maybeSingle();
  return { title: data ? `${data.title} | CareerHub AI` : "Document | CareerHub AI" };
}

export default async function DocumentPage({ params, searchParams }: PageProps<"/documents/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;
  const requested = typeof sp.v === "string" ? sp.v : undefined;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: doc } = await supabase.from("documents").select("id, kind, title").eq("id", id).maybeSingle();
  if (!doc) notFound();
  const { data: versions } = await supabase
    .from("document_versions")
    .select("id, version, file_name, mime_type, size_bytes, created_at, extraction_state, extracted_text")
    .eq("document_id", id)
    .order("version", { ascending: false });
  const list = versions ?? [];
  const selected = list.find((v) => v.id === requested) ?? list[0];

  return (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-3">
        <Link href="/documents" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Document Vault
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
            <p className="text-sm text-muted-foreground">{KIND_LABEL[doc.kind] ?? doc.kind}</p>
          </div>
          <div className="flex gap-2">
            {doc.kind === "resume" ? (
              <Button nativeButton={false} variant="outline" render={<Link href="/resume" />}>
                Analyze against a job
              </Button>
            ) : null}
            <ConfirmForm
              action={deleteDocument.bind(null, id)}
              message="Delete this document and all its versions? Applications that used it will lose the link. This can't be undone."
              variant="destructive"
            >
              <Trash2 aria-hidden="true" /> Delete
            </ConfirmForm>
          </div>
        </div>
      </div>

      <section aria-labelledby="versions" className="space-y-3">
        <h2 id="versions" className="text-lg font-medium">
          Versions
        </h2>
        <ul className="divide-y rounded-lg border">
          {list.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  <Link href={`/documents/${id}?v=${v.id}`} className="underline-offset-4 hover:underline">
                    Version {v.version}
                  </Link>
                  {v.id === selected?.id ? <span className="ml-2 text-xs text-muted-foreground">(viewing)</span> : null}
                </p>
                <p className="text-muted-foreground">
                  {v.file_name} · {size(v.size_bytes)} · <LocalTime iso={v.created_at} />
                </p>
              </div>
              <div className="flex items-center gap-2">
                {v.extraction_state !== "ok" ? (
                  <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-300">
                    {v.extraction_state === "empty" ? "No readable text" : "Couldn't read file"}
                  </Badge>
                ) : null}
                <Button
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  render={<a href={`/documents/download/${v.id}`} />}
                >
                  <Download aria-hidden="true" /> Download
                </Button>
                <ConfirmForm
                  action={deleteVersion.bind(null, v.id)}
                  message={`Delete version ${v.version}? This can't be undone.`}
                  variant="ghost"
                >
                  <Trash2 aria-hidden="true" />
                  <span className="sr-only">Delete version {v.version}</span>
                </ConfirmForm>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {selected ? (
        <section aria-labelledby="text" className="space-y-3">
          <h2 id="text" className="text-lg font-medium">
            Text of version {selected.version}
          </h2>
          {selected.extraction_state !== "ok" ? (
            <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              We couldn&apos;t read any text from this file. It may be a scan or an image. Paste the text below so you can still use it
              for analysis.
            </p>
          ) : null}
          <ExtractedTextEditor key={selected.id} versionId={selected.id} initial={selected.extracted_text ?? ""} />
        </section>
      ) : null}

      {selected?.extracted_text?.trim() ? (
        <section aria-labelledby="export" className="space-y-3">
          <h2 id="export" className="text-lg font-medium">
            Export version {selected.version}
          </h2>
          <p className="text-sm text-muted-foreground">
            Rebuilds a clean, single-column file from the text above, which applications and recruiter tools read reliably. Your original
            file keeps its own design: use Download for that. Fix any wrong text above first, and save.
          </p>
          <div className="flex flex-wrap gap-2">
            {(["pdf", "docx", "txt"] as const).map((f) => (
              <Button key={f} nativeButton={false} variant="outline" size="sm" render={<a href={`/api/documents/export/${selected.id}?format=${f}`} />}>
                <Download aria-hidden="true" /> {f === "pdf" ? "PDF" : f === "docx" ? "Word (.docx)" : "Plain text"}
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="newver" className="space-y-3 rounded-lg border p-4">
        <h2 id="newver" className="font-medium">
          Add a new version
        </h2>
        <UploadForm userId={auth.user.id} documentId={id} defaultKind={doc.kind} defaultTitle={doc.title} compact />
      </section>
    </div>
  );
}
