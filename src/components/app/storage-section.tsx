import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { cleanUpUploads } from "@/app/(app)/settings/actions";
import { findOrphans } from "@/lib/storage-sweep";

const CAP_BYTES = 100 * 1024 * 1024;
const mb = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(0, Math.round(bytes / 1024))} KB`);

/** Settings block: how much of the document allowance is used, and a way to clear abandoned uploads. */
export async function StorageSection({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [{ data: versions }, { orphans }] = await Promise.all([
    supabase.from("document_versions").select("size_bytes").limit(5000),
    findOrphans(supabase, userId),
  ]);
  const used = (versions ?? []).reduce((n, v) => n + Number(v.size_bytes ?? 0), 0);
  const orphanBytes = orphans.reduce((n, f) => n + f.size, 0);
  const pct = Math.min(100, Math.round((used / CAP_BYTES) * 100));

  return (
    <section aria-labelledby="storage" className="space-y-3">
      <h2 id="storage" className="text-xl">
        Storage
      </h2>
      <p className="text-sm text-muted-foreground">
        {mb(used)} of {mb(CAP_BYTES)} used by your saved documents.
      </p>
      <div
        className="h-1.5 max-w-sm overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Document storage used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      {orphans.length > 0 ? (
        <form action={cleanUpUploads} className="flex flex-wrap items-center gap-3">
          <p className="text-sm">
            {orphans.length} unused file{orphans.length === 1 ? "" : "s"} ({mb(orphanBytes)}) from uploads that were never saved.
          </p>
          <Button type="submit" variant="outline" size="sm">
            Remove them
          </Button>
        </form>
      ) : null}
    </section>
  );
}
