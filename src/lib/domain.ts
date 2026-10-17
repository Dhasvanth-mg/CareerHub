export const STAGES = [
  "saved",
  "preparing",
  "applied",
  "assessment",
  "interview",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABEL: Record<Stage, string> = {
  saved: "Saved",
  preparing: "Preparing",
  applied: "Applied",
  assessment: "Assessment",
  interview: "Interview",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

/** Moves into these stages are hard to undo emotionally and in analytics, so we confirm first. */
export const CONSEQUENTIAL_STAGES: Stage[] = ["offer", "accepted", "rejected", "withdrawn"];

export const PRIORITIES = ["low", "medium", "high"] as const;
export const WORK_MODES = ["remote", "hybrid", "on_site"] as const;
export const WORK_MODE_LABEL = { remote: "Remote", hybrid: "Hybrid", on_site: "On-site" } as const;

export const CONTACT_ROLES = ["recruiter", "hiring_manager", "alumni", "referrer", "other"] as const;
export const CONTACT_ROLE_LABEL: Record<(typeof CONTACT_ROLES)[number], string> = {
  recruiter: "Recruiter",
  hiring_manager: "Hiring manager",
  alumni: "Alumni",
  referrer: "Referrer",
  other: "Other",
};

export const REFERRAL_STATUSES = [
  "not_requested",
  "requested",
  "agreed",
  "submitted",
  "declined",
  "unknown",
] as const;
export const REFERRAL_LABEL: Record<(typeof REFERRAL_STATUSES)[number], string> = {
  not_requested: "Not requested",
  requested: "Requested",
  agreed: "Agreed",
  submitted: "Submitted",
  declined: "Declined",
  unknown: "Unknown",
};

export type ApplicationRow = {
  id: string;
  company_name: string;
  title: string;
  stage: Stage;
  priority: (typeof PRIORITIES)[number];
  location: string | null;
  work_mode: (typeof WORK_MODES)[number] | null;
  employment_type: string | null;
  posting_url: string | null;
  source: string | null;
  salary_text: string | null;
  applied_on: string | null;
  deadline: string | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Whole days from today (UTC date) to a YYYY-MM-DD date. Negative means past. */
export function daysUntil(date: string, now = new Date()): number {
  const target = Date.parse(`${date}T00:00:00Z`);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

export function deadlineLabel(date: string): { text: string; tone: "overdue" | "soon" | "normal" } {
  const d = daysUntil(date);
  if (d < 0) return { text: `${-d}d overdue`, tone: "overdue" };
  if (d === 0) return { text: "Due today", tone: "soon" };
  if (d <= 3) return { text: `Due in ${d}d`, tone: "soon" };
  return { text: `Due ${date}`, tone: "normal" };
}

/** Current time for server-rendered, per-request views (pages here are always dynamic). */
export function nowMs(): number {
  return Date.now();
}
