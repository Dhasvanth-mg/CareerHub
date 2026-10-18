import type { SupabaseClient } from "@supabase/supabase-js";

export type StoredFile = { path: string; size: number; createdAt: string | null };

/** Uploads younger than this are left alone: they may still be on their way to being saved. */
export const ORPHAN_MIN_AGE_MS = 2 * 60 * 60 * 1000;
const PAGE = 1000;

/** Every file under the user's storage prefix (files are stored flat as `<user id>/<version id>.<ext>`). */
export async function listUserFiles(supabase: SupabaseClient, uid: string): Promise<StoredFile[]> {
  const out: StoredFile[] = [];
  for (let offset = 0; offset < 20_000; offset += PAGE) {
    const { data, error } = await supabase.storage.from("documents").list(uid, { limit: PAGE, offset });
    if (error || !data) break;
    for (const entry of data) {
      // Folders come back without an id; the app never creates any, so skip them.
      if (!entry.id) continue;
      const meta = (entry.metadata ?? {}) as { size?: number };
      out.push({ path: `${uid}/${entry.name}`, size: Number(meta.size ?? 0), createdAt: entry.created_at ?? null });
    }
    if (data.length < PAGE) break;
  }
  return out;
}

/** Files in storage that no saved version points at, and that are old enough to be sure they are abandoned. */
export function pickOrphans(files: StoredFile[], referenced: Set<string>, now: number, minAgeMs = ORPHAN_MIN_AGE_MS): StoredFile[] {
  return files.filter((f) => {
    if (referenced.has(f.path)) return false;
    const created = f.createdAt ? Date.parse(f.createdAt) : NaN;
    // If a file has no readable timestamp, leave it: removing something we can't date is the riskier mistake.
    return Number.isFinite(created) && now - created >= minAgeMs;
  });
}

export async function findOrphans(supabase: SupabaseClient, uid: string, now = Date.now()) {
  const [files, versions] = await Promise.all([
    listUserFiles(supabase, uid),
    supabase.from("document_versions").select("storage_path").limit(5000),
  ]);
  // If the list of saved versions failed to load, say nothing is an orphan rather than risk deleting real files.
  if (versions.error) return { files, orphans: [] as StoredFile[] };
  const referenced = new Set((versions.data ?? []).map((v) => v.storage_path as string));
  return { files, orphans: pickOrphans(files, referenced, now) };
}

/** Deletes orphaned files for the user. Returns how many were removed. */
export async function sweepOrphans(supabase: SupabaseClient, uid: string): Promise<{ removed: number; bytes: number }> {
  const { orphans } = await findOrphans(supabase, uid);
  let removed = 0;
  let bytes = 0;
  for (let i = 0; i < orphans.length; i += 100) {
    const batch = orphans.slice(i, i + 100);
    const { error } = await supabase.storage.from("documents").remove(batch.map((f) => f.path));
    if (!error) {
      removed += batch.length;
      bytes += batch.reduce((n, f) => n + f.size, 0);
    }
  }
  return { removed, bytes };
}
