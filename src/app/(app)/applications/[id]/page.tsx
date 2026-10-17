import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, ExternalLink, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { ApplicationForm } from "@/components/app/application-form";
import { ConfirmForm } from "@/components/app/confirm-form";
import { AddInterviewForm, RoundCard } from "@/components/app/interviews";
import { LinkContactForm } from "@/components/app/link-contact-form";
import { NextActionPanel } from "@/components/app/next-action-panel";
import { LocalTime } from "@/components/app/local-time";
import { DeadlineBadge } from "@/components/app/stage-badge";
import { StageSelect } from "@/components/app/stage-select";
import { TaskForm } from "@/components/app/task-form";
import { TaskList, type TaskItem } from "@/components/app/task-list";
import {
  CONTACT_ROLE_LABEL,
  REFERRAL_LABEL,
  REFERRAL_STATUSES,
  nowMs,
  type InterviewRound,
  type ApplicationRow,
} from "@/lib/domain";
import { overlappingRounds } from "@/lib/calendar";
import { setSubmittedVersion } from "../../documents/actions";
import { deleteApplication, setArchived, updateApplication } from "../actions";
import { setReferralStatus, unlinkContact } from "../../contacts/actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: PageProps<"/applications/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Application | CareerHub AI" };
  const supabase = await createClient();
  const { data } = await supabase.from("applications").select("title, company_name").eq("id", id).maybeSingle();
  return { title: data ? `${data.title} at ${data.company_name} | CareerHub AI` : "Application | CareerHub AI" };
}

type LinkedContact = {
  contact_id: string;
  role: keyof typeof CONTACT_ROLE_LABEL;
  contacts: { id: string; name: string; company: string | null; position: string | null; email: string | null } | null;
};

export default async function ApplicationDetailPage({ params }: PageProps<"/applications/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: app } = await supabase.from("applications").select("*").eq("id", id).maybeSingle();
  if (!app) notFound();
  const row = app as ApplicationRow;

  const [eventsRes, tasksRes, linkedRes, referralsRes, contactsRes] = await Promise.all([
    supabase
      .from("application_events")
      .select("id, summary, created_at")
      .eq("application_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("tasks")
      .select("id, title, notes, due_at, completed_at, snoozed_until, application_id")
      .eq("application_id", id)
      .order("completed_at", { ascending: true, nullsFirst: true })
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("application_contacts")
      .select("contact_id, role, contacts(id, name, company, position, email)")
      .eq("application_id", id),
    supabase.from("referrals").select("contact_id, status").eq("application_id", id),
    supabase.from("contacts").select("id, name, company").order("name").limit(500),
  ]);

  const { data: docVersions } = await supabase
    .from("document_versions")
    .select("id, version, documents!inner(title, kind)")
    .in("documents.kind", ["resume", "cover_letter"])
    .order("created_at", { ascending: false })
    .limit(200);
  const versionOptions = ((docVersions ?? []) as unknown as {
    id: string;
    version: number;
    documents: { title: string; kind: string };
  }[]).map((v) => ({ id: v.id, kind: v.documents.kind, label: `${v.documents.title}, version ${v.version}` }));
  const materials = [
    { field: "resume" as const, label: "Submitted resume", current: (app as { submitted_resume_version_id: string | null }).submitted_resume_version_id },
    {
      field: "cover_letter" as const,
      label: "Submitted cover letter",
      current: (app as { submitted_cover_letter_version_id: string | null }).submitted_cover_letter_version_id,
    },
  ];
  const jobPostingId = (app as { job_posting_id: string | null }).job_posting_id;

  const { data: allRounds } = await supabase
    .from("interview_rounds")
    .select("id, application_id, round_type, status, scheduled_at, duration_minutes, location, interviewers, prep_notes, questions_asked, debrief")
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(500);
  const rounds = (allRounds ?? []) as InterviewRound[];
  const myRounds = rounds.filter((r) => r.application_id === id);
  const roundConflicts = overlappingRounds(rounds);

  const events = eventsRes.data ?? [];
  const tasks = (tasksRes.data ?? []) as TaskItem[];
  const linked = (linkedRes.data ?? []) as unknown as LinkedContact[];
  const referralByContact = new Map((referralsRes.data ?? []).map((r) => [r.contact_id, r.status]));
  const linkedIds = new Set(linked.map((l) => l.contact_id));
  const linkable = (contactsRes.data ?? [])
    .filter((c) => !linkedIds.has(c.id))
    .map((c) => ({ id: c.id, label: c.company ? `${c.name} (${c.company})` : c.name }));

  const archived = Boolean(row.archived_at);

  return (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-3">
        <Link href="/applications" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Applications
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{row.title}</h1>
            <p className="text-muted-foreground">
              {row.company_name}
              {row.location ? ` · ${row.location}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {row.deadline ? <DeadlineBadge date={row.deadline} /> : null}
              {archived ? <span className="text-sm text-muted-foreground">Archived</span> : null}
              {row.posting_url ? (
                <a
                  href={row.posting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm underline underline-offset-4"
                >
                  Posting <ExternalLink className="size-3" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StageSelect id={id} stage={row.stage} />
            <form action={setArchived.bind(null, id, !archived)}>
              <Button type="submit" variant="outline">
                {archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
                {archived ? "Restore" : "Archive"}
              </Button>
            </form>
            <ConfirmForm
              action={deleteApplication.bind(null, id)}
              message="Delete this application and its timeline permanently? This can't be undone."
              variant="destructive"
            >
              <Trash2 aria-hidden="true" /> Delete
            </ConfirmForm>
          </div>
        </div>
      </div>

      <NextActionPanel applicationId={id} />

      <section aria-labelledby="details" className="space-y-4">
        <h2 id="details" className="text-lg font-medium">
          Details
        </h2>
        <ApplicationForm action={updateApplication.bind(null, id)} defaults={row} submitLabel="Save changes" toastOnSuccess />
      </section>

      <section aria-labelledby="materials" className="space-y-4">
        <h2 id="materials" className="text-lg font-medium">
          Materials
        </h2>
        <p className="text-sm text-muted-foreground">
          Record which exact version you sent, so you can always find it later.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {materials.map((m) => (
            <form key={m.field} action={setSubmittedVersion.bind(null, id, m.field)} className="space-y-1.5">
              <label htmlFor={`sub-${m.field}`} className="text-sm font-medium">
                {m.label}
              </label>
              <div className="flex gap-2">
                <NativeSelect id={`sub-${m.field}`} name="version_id" defaultValue={m.current ?? ""}>
                  <option value="">Not recorded</option>
                  {versionOptions
                    .filter((o) => o.kind === m.field)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                </NativeSelect>
                <Button type="submit" variant="secondary" size="sm">
                  Save
                </Button>
              </div>
            </form>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          {jobPostingId ? (
            <Link href={`/resume?application=${id}`} className="underline underline-offset-4">
              Analyze a resume against this job
            </Link>
          ) : (
            <span className="text-muted-foreground">
              Import this role with{" "}
              <Link href="/jobs" className="underline underline-offset-4">
                Job Capture
              </Link>{" "}
              to analyze a resume against its requirements.
            </span>
          )}
          <Link href="/documents" className="underline underline-offset-4">
            Document Vault
          </Link>
        </div>
      </section>

      <section aria-labelledby="interviews" className="space-y-4">
        <h2 id="interviews" className="text-lg font-medium">
          Interviews
        </h2>
        {myRounds.length > 0 ? (
          <ul className="space-y-2">
            {myRounds.map((r) => (
              <RoundCard key={r.id} round={r} conflict={roundConflicts.has(r.id)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No interviews yet. Add one and it shows up on your calendar, with a place for prep notes and a debrief afterwards.
          </p>
        )}
        <div className="rounded-lg border p-4">
          <h3 className="mb-3 text-sm font-medium">Add an interview</h3>
          <AddInterviewForm applicationId={id} />
        </div>
      </section>

      <section aria-labelledby="tasks" className="space-y-4">
        <h2 id="tasks" className="text-lg font-medium">
          Tasks
        </h2>
        {tasks.length > 0 ? <TaskList tasks={tasks} now={nowMs()} /> : <p className="text-sm text-muted-foreground">No tasks for this application yet.</p>}
        <div className="rounded-lg border p-4">
          <TaskForm applicationId={id} />
        </div>
      </section>

      <section aria-labelledby="people" className="space-y-4">
        <h2 id="people" className="text-lg font-medium">
          Contacts &amp; referrals
        </h2>
        {linked.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {linked.map((l) => {
              const c = l.contacts;
              if (!c) return null;
              const status = referralByContact.get(c.id) ?? "not_requested";
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <Link href={`/contacts/${c.id}`} className="font-medium underline-offset-4 hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {CONTACT_ROLE_LABEL[l.role]}
                      {c.position || c.company ? ` · ${[c.position, c.company].filter(Boolean).join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={setReferralStatus.bind(null, id, c.id)} className="flex items-center gap-1">
                      <label htmlFor={`ref-${c.id}`} className="sr-only">
                        Referral status for {c.name}
                      </label>
                      <NativeSelect id={`ref-${c.id}`} name="status" defaultValue={status} className="w-36">
                        {REFERRAL_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {REFERRAL_LABEL[s]}
                          </option>
                        ))}
                      </NativeSelect>
                      <Button type="submit" variant="secondary" size="sm">
                        Update
                      </Button>
                    </form>
                    <form action={unlinkContact.bind(null, id, c.id)}>
                      <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Unlink ${c.name}`}>
                        <X aria-hidden="true" />
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No contacts linked yet.</p>
        )}
        <LinkContactForm applicationId={id} contacts={linkable} />
      </section>

      <section aria-labelledby="timeline" className="space-y-4">
        <h2 id="timeline" className="text-lg font-medium">
          Timeline
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <ol className="space-y-3 border-l pl-4">
            {events.map((e) => (
              <li key={e.id} className="text-sm">
                <p>{e.summary}</p>
                <p className="text-xs text-muted-foreground">
                  <LocalTime iso={e.created_at} />
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
