/**
 * Action Center rules. Deterministic, so every suggestion can say exactly which dates and records it
 * came from. No AI is involved; nothing here guesses.
 *
 * Restraint is deliberate: a follow-up is only suggested once enough time has passed and when none has
 * been recorded recently, so the app never nags people into over-contacting employers.
 */

export type Group = "overdue" | "due_soon" | "waiting" | "prep" | "tidy";

export const GROUP_LABEL: Record<Group, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  waiting: "Waiting on someone",
  prep: "Prepare",
  tidy: "Tidy up",
};

export type ActionItem = {
  /** Stable identifier of this suggestion, used for snoozing and dismissing. */
  key: string;
  group: Group;
  /** Lower comes first. */
  priority: number;
  title: string;
  /** Plain-language reason, citing the dates and records behind it. */
  why: string;
  applicationId: string;
  applicationLabel: string;
  dueDate: string | null;
  /** How the suggestion was derived. */
  basis: string;
  /** If set, the item offers a one-click "add as a task" (the user approves it). */
  task: { title: string; dueDate: string | null } | null;
  href: string;
};

export type AppIn = {
  id: string;
  title: string;
  company_name: string;
  stage: string;
  applied_on: string | null;
  deadline: string | null;
  submitted_resume_version_id: string | null;
  created_at: string;
  updated_at: string;
};
export type TaskIn = { id: string; title: string; due_at: string | null; completed_at: string | null; snoozed_until: string | null; application_id: string | null };
export type EventIn = { application_id: string; type: string; summary: string; created_at: string };
export type RoundIn = {
  id: string;
  application_id: string;
  round_type: string;
  status: string;
  scheduled_at: string | null;
  prep_notes: string | null;
  debrief: string | null;
  prep_items: number;
};
export type ReferralIn = { application_id: string; status: string; updated_at: string; contact_name: string };

export type ActionInput = {
  apps: AppIn[];
  tasks: TaskIn[];
  events: EventIn[];
  rounds: RoundIn[];
  referrals: ReferralIn[];
};

const DAY = 86_400_000;
const ACTIVE_AFTER_APPLY = ["applied", "assessment", "interview"];
const label = (a: AppIn) => `${a.title} at ${a.company_name}`;
const dayOf = (iso: string) => iso.slice(0, 10);
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const daysBetween = (fromMs: number, toMs: number) => Math.floor((toMs - fromMs) / DAY);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function computeActions(input: ActionInput, now: Date): ActionItem[] {
  const nowMs = now.getTime();
  const today = ymd(nowMs);
  const items: ActionItem[] = [];
  const appById = new Map(input.apps.map((a) => [a.id, a]));

  // ------------------------------------------------------------ tasks
  for (const t of input.tasks) {
    if (t.completed_at || !t.due_at) continue;
    if (t.snoozed_until && Date.parse(t.snoozed_until) > nowMs) continue;
    const app = t.application_id ? appById.get(t.application_id) : undefined;
    const dueMs = Date.parse(t.due_at);
    const base = {
      applicationId: app?.id ?? "",
      applicationLabel: app ? label(app) : "General task",
      dueDate: dayOf(t.due_at),
      href: app ? `/applications/${app.id}` : "/tasks",
      task: null,
    };
    if (dueMs < nowMs) {
      const days = Math.max(1, daysBetween(dueMs, nowMs));
      items.push({
        ...base,
        key: `task-overdue:${t.id}`,
        group: "overdue",
        priority: 10,
        title: t.title,
        why: `This task was due ${plural(days, "day")} ago and isn't marked done.`,
        basis: "Task due date",
      });
    } else if (dueMs - nowMs <= 3 * DAY) {
      items.push({
        ...base,
        key: `task-soon:${t.id}`,
        group: "due_soon",
        priority: 30,
        title: t.title,
        why: `Due ${dayOf(t.due_at)}, within the next 3 days.`,
        basis: "Task due date",
      });
    }
  }

  // ------------------------------------------------------------ application rules
  for (const app of input.apps) {
    const stage = app.stage;
    const appEvents = input.events.filter((e) => e.application_id === app.id);
    const appTasks = input.tasks.filter((t) => t.application_id === app.id);
    const lastActivity = Math.max(Date.parse(app.updated_at), ...appEvents.map((e) => Date.parse(e.created_at)));

    // Deadlines on applications that haven't been sent yet.
    if ((stage === "saved" || stage === "preparing") && app.deadline) {
      const daysLeft = daysBetween(Date.parse(`${today}T00:00:00Z`), Date.parse(`${app.deadline}T00:00:00Z`));
      if (daysLeft < 0) {
        items.push({
          key: `deadline-passed:${app.id}`,
          group: "overdue",
          priority: 20,
          title: `Decide on ${label(app)}`,
          why: `The deadline was ${app.deadline} (${plural(-daysLeft, "day")} ago) and it is still marked ${stage}. Apply if it is still open, otherwise archive or withdraw it.`,
          applicationId: app.id,
          applicationLabel: label(app),
          dueDate: app.deadline,
          basis: "Application deadline",
          task: null,
          href: `/applications/${app.id}`,
        });
      } else if (daysLeft <= 3) {
        items.push({
          key: `deadline-soon:${app.id}`,
          group: "due_soon",
          priority: 15,
          title: `Submit ${label(app)}`,
          why: daysLeft === 0 ? "The deadline is today." : `The deadline is ${app.deadline}, in ${plural(daysLeft, "day")}.`,
          applicationId: app.id,
          applicationLabel: label(app),
          dueDate: app.deadline,
          basis: "Application deadline",
          task: { title: `Submit application: ${label(app)}`, dueDate: app.deadline },
          href: `/applications/${app.id}`,
        });
      }
    }

    // Follow-ups after applying, with restraint.
    if (ACTIVE_AFTER_APPLY.includes(stage) && app.applied_on) {
      const appliedMs = Date.parse(`${app.applied_on}T12:00:00Z`);
      const sinceApplied = daysBetween(appliedMs, nowMs);
      const recentFollowUp =
        appTasks.some((t) => /follow/i.test(t.title) && (!t.completed_at ? true : nowMs - Date.parse(t.completed_at) < 7 * DAY)) ||
        appEvents.some((e) => /follow/i.test(e.summary) && nowMs - Date.parse(e.created_at) < 7 * DAY);
      const recentMovement = nowMs - lastActivity < 7 * DAY;
      if (stage === "applied" && sinceApplied >= 7 && !recentFollowUp && !recentMovement) {
        items.push({
          key: `follow-up:${app.id}`,
          group: "waiting",
          priority: 50,
          title: `Consider a follow-up on ${label(app)}`,
          why: `You applied ${plural(sinceApplied, "day")} ago (${app.applied_on}) and nothing has changed for over a week. A short, polite check-in is reasonable. Only once, and give it time.`,
          applicationId: app.id,
          applicationLabel: label(app),
          dueDate: null,
          basis: `Applied ${app.applied_on}, no activity or follow-up in the last 7 days`,
          task: { title: `Follow up on ${label(app)}`, dueDate: null },
          href: `/applications/${app.id}`,
        });
      }
    }

    // Which resume was sent.
    if (ACTIVE_AFTER_APPLY.includes(stage) && !app.submitted_resume_version_id) {
      items.push({
        key: `resume-missing:${app.id}`,
        group: "tidy",
        priority: 80,
        title: `Record which resume you sent to ${app.company_name}`,
        why: "No submitted resume version is recorded, so you won't be able to tell later exactly what the employer saw.",
        applicationId: app.id,
        applicationLabel: label(app),
        dueDate: null,
        basis: "Missing submitted resume",
        task: null,
        href: `/applications/${app.id}`,
      });
    }

    // Applications that have sat untouched.
    if ((stage === "saved" || stage === "preparing") && nowMs - lastActivity > 21 * DAY) {
      const idle = daysBetween(lastActivity, nowMs);
      items.push({
        key: `stale:${app.id}`,
        group: "tidy",
        priority: 85,
        title: `Still interested in ${label(app)}?`,
        why: `Nothing has changed for ${plural(idle, "day")}. Apply, or archive it to keep your board clear.`,
        applicationId: app.id,
        applicationLabel: label(app),
        dueDate: null,
        basis: "No activity for 3+ weeks",
        task: null,
        href: `/applications/${app.id}`,
      });
    }
  }

  // ------------------------------------------------------------ interviews
  for (const r of input.rounds) {
    const app = appById.get(r.application_id);
    if (!app || !r.scheduled_at || r.status === "cancelled") continue;
    const atMs = Date.parse(r.scheduled_at);
    const hoursUntil = (atMs - nowMs) / 3_600_000;
    const type = r.round_type.replace(/_/g, " ");

    if (r.status === "scheduled" && hoursUntil > 0 && hoursUntil <= 72 && !r.prep_notes && r.prep_items === 0) {
      items.push({
        key: `prep:${r.id}`,
        group: "prep",
        priority: 12,
        title: `Prepare for your ${type} interview at ${app.company_name}`,
        why: `It's on ${dayOf(r.scheduled_at)} and you haven't added prep notes or practice questions yet.`,
        applicationId: app.id,
        applicationLabel: label(app),
        dueDate: dayOf(r.scheduled_at),
        basis: "Interview within 3 days with no prep",
        task: null,
        href: `/applications/${app.id}/prep?round=${r.id}`,
      });
    }
    // Interview has happened but nothing was recorded about it.
    if (hoursUntil < -2 && !r.debrief) {
      items.push({
        key: `debrief:${r.id}`,
        group: "prep",
        priority: 40,
        title: `Add a debrief for your ${type} interview at ${app.company_name}`,
        why: `It was ${dayOf(r.scheduled_at)}. Writing down what was asked and how it went while it's fresh helps you follow up and prepare for next rounds.${
          r.status === "scheduled" ? " It's still marked scheduled; mark it completed." : ""
        }`,
        applicationId: app.id,
        applicationLabel: label(app),
        dueDate: dayOf(r.scheduled_at),
        basis: "Interview date passed with no debrief",
        task: { title: `Send a thank-you note to ${app.company_name}`, dueDate: null },
        href: `/applications/${app.id}`,
      });
    }
  }

  // ------------------------------------------------------------ referrals
  for (const ref of input.referrals) {
    const app = appById.get(ref.application_id);
    if (!app || ref.status !== "requested") continue;
    const waited = daysBetween(Date.parse(ref.updated_at), nowMs);
    if (waited >= 7) {
      items.push({
        key: `referral:${app.id}:${ref.contact_name}`,
        group: "waiting",
        priority: 55,
        title: `Check in with ${ref.contact_name} about the referral`,
        why: `You asked for a referral for ${label(app)} ${plural(waited, "day")} ago and haven't recorded an answer.`,
        applicationId: app.id,
        applicationLabel: label(app),
        dueDate: null,
        basis: "Referral requested over a week ago",
        task: { title: `Check in with ${ref.contact_name} about the referral`, dueDate: null },
        href: `/applications/${app.id}`,
      });
    }
  }

  return items.sort((a, b) => a.priority - b.priority || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
}

export type Dismissal = { key: string; until: string | null };

/** Splits items into those to show now and those the user has snoozed or dismissed. */
export function applyDismissals(items: ActionItem[], dismissals: Dismissal[], now: Date) {
  const hidden = new Map(
    dismissals.filter((d) => d.until === null || Date.parse(d.until) > now.getTime()).map((d) => [d.key, d.until]),
  );
  return {
    visible: items.filter((i) => !hidden.has(i.key)),
    hidden: items.filter((i) => hidden.has(i.key)).map((i) => ({ ...i, until: hidden.get(i.key) ?? null })),
  };
}
