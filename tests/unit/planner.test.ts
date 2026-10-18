import { describe, expect, it } from "vitest";
import { rankOpportunities, suggestedFit, summarizeGaps } from "@/lib/planner";

const item = (id: string, ratings: Record<string, number> = {}) => ({ id, label: `Role ${id}`, ratings });

describe("rankOpportunities", () => {
  it("ranks by the user's own ratings and weights", () => {
    const out = rankOpportunities(
      [item("a", { interest: 5, fit: 2 }), item("b", { interest: 2, fit: 5 })],
      { interest: 10, fit: 1 },
    );
    expect(out.map((r) => r.id)).toEqual(["a", "b"]);
    const flipped = rankOpportunities([item("a", { interest: 5, fit: 2 }), item("b", { interest: 2, fit: 5 })], { interest: 1, fit: 10 });
    expect(flipped.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("lists unrated opportunities after the ranked ones instead of dropping them", () => {
    const out = rankOpportunities([item("none"), item("rated", { interest: 3 }), item("none2")], {});
    expect(out.map((r) => r.id)).toEqual(["rated", "none", "none2"]);
    expect(out[1].score).toBeNull();
    expect(out[1].why).toMatch(/Not rated yet/);
  });

  it("explains what drove a score, and says how much it was based on", () => {
    const [r] = rankOpportunities([item("a", { interest: 5, growth: 5, compensation: 1 })], {});
    expect(r.why).toMatch(/Strong on/);
    expect(r.why).toMatch(/interest in the work \(5\/5\)/);
    expect(r.why).toMatch(/weaker on pay \(1\/5\)/);
    expect(r.why).toMatch(/Based on 3 of 5 criteria/);
  });

  it("ignores criteria with zero weight, and handles all-zero weights", () => {
    const only = rankOpportunities([item("a", { interest: 5, compensation: 1 })], { compensation: 0 });
    expect(only[0].score).toBe(100);
    const zero = rankOpportunities([item("a", { interest: 5 })], { interest: 0 });
    expect(zero[0].score).toBeNull();
  });

  it("clamps out-of-range ratings and weights", () => {
    const [r] = rankOpportunities([item("a", { interest: 50 })], { interest: 99 });
    expect(r.score).toBe(100);
  });

  it("is stable for ties", () => {
    const out = rankOpportunities([item("x", { interest: 3 }), item("y", { interest: 3 })], {});
    expect(out.map((r) => r.id)).toEqual(["x", "y"]);
  });
});

describe("suggestedFit", () => {
  it("maps a 0-100 analysis score to a 1-5 suggestion", () => {
    expect(suggestedFit(94)).toBe(5);
    expect(suggestedFit(61)).toBe(3);
    expect(suggestedFit(5)).toBe(1);
    expect(suggestedFit(null)).toBeNull();
    expect(suggestedFit(Number.NaN)).toBeNull();
  });
});

describe("summarizeGaps", () => {
  it("groups the same requirement across applications, most common first", () => {
    const gaps = summarizeGaps([
      { requirement: "Experience with Kubernetes.", application_id: "1" },
      { requirement: "experience with kubernetes", application_id: "2" },
      { requirement: "Experience with Kubernetes.", application_id: "2" },
      { requirement: "SQL", application_id: "1" },
    ]);
    expect(gaps[0]).toEqual({ requirement: "Experience with Kubernetes.", applications: 2 });
    expect(gaps[1]).toEqual({ requirement: "SQL", applications: 1 });
  });
  it("respects the limit and ignores blanks", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ requirement: `Skill ${i}`, application_id: "1" }));
    expect(summarizeGaps([...many, { requirement: "  ", application_id: "1" }], 5)).toHaveLength(5);
  });
});
