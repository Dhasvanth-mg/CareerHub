import { describe, expect, it } from "vitest";
import { applyDismissals, computeActions, type ActionInput, type AppIn } from "@/lib/actions";

const NOW = new Date("2026-10-17T15:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();
const ahead = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString();
const dateAgo = (days: number) => ago(days).slice(0, 10);

const app = (over: Partial<AppIn> = {}): AppIn => ({
  id: "a1",
  title: "SWE Intern",
  company_name: "Acme",
  stage: "applied",
  applied_on: dateAgo(10),
  deadline: null,
  submitted_resume_version_id: "v1",
  created_at: ago(30),
  updated_at: ago(10),
  ...over,
});
const input = (over: Partial<ActionInput> = {}): ActionInput => ({ apps: [app()], tasks: [], events: [], rounds: [], referrals: [], ...over });
const keys = (i: ActionInput) => computeActions(i, NOW).map((a) => a.key);

describe("tasks", () => {
  const task = (over = {}) => ({ id: "t1", title: "Email recruiter", due_at: ahead(10), completed_at: null, snoozed_until: null, application_id: "a1", ...over });
  it("flags overdue and soon-due open tasks, and ignores far-off, done or undated ones", () => {
    expect(keys(input({ tasks: [task({ due_at: ago(2) })] }))).toContain("task-overdue:t1");
    expect(keys(input({ tasks: [task({ due_at: ahead(2) })] }))).toContain("task-soon:t1");
    expect(keys(input({ tasks: [task({ due_at: ahead(10) })] }))).not.toContain("task-soon:t1");
    expect(keys(input({ tasks: [task({ due_at: ago(2), completed_at: ago(1) })] }))).not.toContain("task-overdue:t1");
    expect(keys(input({ tasks: [task({ due_at: null })] }))).not.toContain("task-overdue:t1");
  });
  it("hides a task while it is snoozed", () => {
    expect(keys(input({ tasks: [task({ due_at: ago(2), snoozed_until: ahead(1) })] }))).not.toContain("task-overdue:t1");
    expect(keys(input({ tasks: [task({ due_at: ago(2), snoozed_until: ago(1) })] }))).toContain("task-overdue:t1");
  });
});

describe("deadlines on unsent applications", () => {
  it("warns when the deadline is close and when it has passed", () => {
    const soon = keys(input({ apps: [app({ stage: "preparing", applied_on: null, deadline: dateAgo(-2) })] }));
    expect(soon).toContain("deadline-soon:a1");
    const passed = keys(input({ apps: [app({ stage: "saved", applied_on: null, deadline: dateAgo(3) })] }));
    expect(passed).toContain("deadline-passed:a1");
  });
  it("does not nag about deadlines on applications that were already sent", () => {
    const k = keys(input({ apps: [app({ stage: "applied", deadline: dateAgo(3) })] }));
    expect(k.some((x) => x.startsWith("deadline"))).toBe(false);
  });
});

describe("follow-ups show restraint", () => {
  it("suggests one after a quiet week", () => {
    expect(keys(input())).toContain("follow-up:a1");
  });
  it("waits until a full week has passed since applying", () => {
    expect(keys(input({ apps: [app({ applied_on: dateAgo(5) })] }))).not.toContain("follow-up:a1");
  });
  it("does not suggest another when a follow-up task or event was recorded recently", () => {
    const task = { id: "t", title: "Follow up with recruiter", due_at: null, completed_at: ago(2), snoozed_until: null, application_id: "a1" };
    expect(keys(input({ tasks: [task] }))).not.toContain("follow-up:a1");
    const ev = { application_id: "a1", type: "task_completed", summary: "Completed task: follow up email", created_at: ago(3) };
    expect(keys(input({ events: [ev] }))).not.toContain("follow-up:a1");
  });
  it("stays quiet when anything has moved in the last week", () => {
    const ev = { application_id: "a1", type: "updated", summary: "Updated application details", created_at: ago(2) };
    expect(keys(input({ events: [ev] }))).not.toContain("follow-up:a1");
  });
  it("only applies to the applied stage", () => {
    expect(keys(input({ apps: [app({ stage: "interview" })] }))).not.toContain("follow-up:a1");
  });
});

describe("interviews", () => {
  const round = (over = {}) => ({
    id: "r1",
    application_id: "a1",
    round_type: "technical",
    status: "scheduled",
    scheduled_at: ahead(1),
    prep_notes: null,
    debrief: null,
    prep_items: 0,
    ...over,
  });
  it("asks for prep within three days when there is none", () => {
    expect(keys(input({ rounds: [round()] }))).toContain("prep:r1");
    expect(keys(input({ rounds: [round({ prep_notes: "Reviewed" })] }))).not.toContain("prep:r1");
    expect(keys(input({ rounds: [round({ prep_items: 4 })] }))).not.toContain("prep:r1");
    expect(keys(input({ rounds: [round({ scheduled_at: ahead(10) })] }))).not.toContain("prep:r1");
  });
  it("asks for a debrief after an interview, and never for cancelled ones", () => {
    expect(keys(input({ rounds: [round({ scheduled_at: ago(1) })] }))).toContain("debrief:r1");
    expect(keys(input({ rounds: [round({ scheduled_at: ago(1), debrief: "Went well" })] }))).not.toContain("debrief:r1");
    expect(keys(input({ rounds: [round({ scheduled_at: ago(1), status: "cancelled" })] }))).not.toContain("debrief:r1");
  });
});

describe("referrals and housekeeping", () => {
  it("checks in on a referral requested over a week ago", () => {
    const k = keys(input({ referrals: [{ application_id: "a1", status: "requested", updated_at: ago(9), contact_name: "Priya" }] }));
    expect(k.some((x) => x.startsWith("referral:"))).toBe(true);
    const recent = keys(input({ referrals: [{ application_id: "a1", status: "requested", updated_at: ago(2), contact_name: "Priya" }] }));
    expect(recent.some((x) => x.startsWith("referral:"))).toBe(false);
  });
  it("flags a missing submitted resume and long-idle saved applications", () => {
    expect(keys(input({ apps: [app({ submitted_resume_version_id: null })] }))).toContain("resume-missing:a1");
    expect(keys(input({ apps: [app({ stage: "saved", applied_on: null, updated_at: ago(30) })] }))).toContain("stale:a1");
    expect(keys(input({ apps: [app({ stage: "saved", applied_on: null, updated_at: ago(5) })] }))).not.toContain("stale:a1");
  });
});

describe("ordering and dismissals", () => {
  it("puts overdue work before soft suggestions", () => {
    const order = computeActions(
      input({
        apps: [app({ submitted_resume_version_id: null })],
        tasks: [{ id: "t1", title: "Send thanks", due_at: ago(3), completed_at: null, snoozed_until: null, application_id: "a1" }],
      }),
      NOW,
    ).map((a) => a.group);
    expect(order[0]).toBe("overdue");
    expect(order.indexOf("tidy")).toBeGreaterThan(order.indexOf("overdue"));
  });
  it("every item explains itself", () => {
    for (const item of computeActions(input({ apps: [app({ submitted_resume_version_id: null })] }), NOW)) {
      expect(item.why.length).toBeGreaterThan(10);
      expect(item.basis.length).toBeGreaterThan(3);
      expect(item.title.length).toBeGreaterThan(3);
    }
  });
  it("hides dismissed and snoozed items, and brings snoozed ones back when the snooze ends", () => {
    const items = computeActions(input(), NOW);
    const key = items[0].key;
    expect(applyDismissals(items, [{ key, until: null }], NOW).visible.map((i) => i.key)).not.toContain(key);
    expect(applyDismissals(items, [{ key, until: ahead(2) }], NOW).visible.map((i) => i.key)).not.toContain(key);
    expect(applyDismissals(items, [{ key, until: ago(1) }], NOW).visible.map((i) => i.key)).toContain(key);
    expect(applyDismissals(items, [{ key, until: null }], NOW).hidden.map((i) => i.key)).toContain(key);
  });
});
