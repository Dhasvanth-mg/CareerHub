import { describe, expect, it } from "vitest";
import { annualBase, clampWeight, compensationScores, mixedCurrencies, scoreOffers, totalCash, type OfferIn } from "@/lib/offers";

const offer = (over: Partial<OfferIn> = {}): OfferIn => ({
  id: "a",
  label: "Acme",
  currency: "USD",
  base_amount: 100_000,
  pay_period: "year",
  bonus_amount: null,
  ratings: {},
  ...over,
});

describe("pay maths", () => {
  it("annualizes monthly and hourly pay with a stated assumption", () => {
    expect(annualBase(offer({ base_amount: 5_000, pay_period: "month" }))).toBe(60_000);
    expect(annualBase(offer({ base_amount: 30, pay_period: "hour" }))).toBe(62_400); // 30 x 2080
    expect(annualBase(offer({ base_amount: null }))).toBeNull();
  });
  it("adds only a bonus that was actually entered", () => {
    expect(totalCash(offer({ bonus_amount: 10_000 }))).toBe(110_000);
    expect(totalCash(offer())).toBe(100_000);
    expect(totalCash(offer({ base_amount: null, bonus_amount: 10_000 }))).toBeNull();
  });
});

describe("compensation scores", () => {
  it("scores relative to the best offer in the same currency", () => {
    const m = compensationScores([offer({ id: "a", base_amount: 100_000 }), offer({ id: "b", base_amount: 50_000 })]);
    expect(m.get("a")).toBe(5);
    expect(m.get("b")).toBe(3); // 1 + 4 * 0.5
  });
  it("never compares across currencies", () => {
    const m = compensationScores([offer({ id: "a", currency: "USD" }), offer({ id: "b", currency: "CAD", base_amount: 200_000 })]);
    expect(m.get("a")).toBeNull();
    expect(m.get("b")).toBeNull();
    expect(mixedCurrencies([offer({ currency: "USD" }), offer({ id: "b", currency: "CAD" })])).toBe(true);
  });
  it("has nothing to compare when there is a single offer or missing pay", () => {
    expect(compensationScores([offer()]).get("a")).toBeNull();
    const m = compensationScores([offer({ id: "a" }), offer({ id: "b", base_amount: null })]);
    expect(m.get("b")).toBeNull();
  });
});

describe("weighted scoring", () => {
  it("only counts criteria the user rated, and says how many that was", () => {
    const [s] = scoreOffers([offer({ ratings: { growth: 5, team: 3 } })], {});
    expect(s.ratedCount).toBe(2);
    expect(s.missing).toContain("Work-life balance");
    // equal weights: (5 + 3) / (2 * 5) = 80%
    expect(s.total).toBe(80);
  });
  it("follows the weights the user sets", () => {
    const o = offer({ ratings: { growth: 5, balance: 1 } });
    expect(scoreOffers([o], { growth: 10, balance: 0 })[0].total).toBe(100);
    expect(scoreOffers([o], { growth: 0, balance: 10 })[0].total).toBe(20);
  });
  it("returns no score when nothing is rated or all weights are zero", () => {
    expect(scoreOffers([offer()], {})[0].total).toBeNull();
    expect(scoreOffers([offer({ ratings: { growth: 5 } })], { growth: 0 })[0].total).toBeNull();
  });
  it("includes calculated pay alongside ratings when offers are comparable", () => {
    const res = scoreOffers(
      [offer({ id: "a", base_amount: 100_000, ratings: { growth: 3 } }), offer({ id: "b", base_amount: 50_000, ratings: { growth: 5 } })],
      { compensation: 5, growth: 5 },
    );
    const byId = Object.fromEntries(res.map((r) => [r.id, r]));
    expect(byId.a.total).toBe(80); // (5 + 3) / 10
    expect(byId.b.total).toBe(80); // (3 + 5) / 10
  });
  it("clamps out-of-range ratings and weights instead of trusting them", () => {
    const [s] = scoreOffers([offer({ ratings: { growth: 99 } })], { growth: 500 });
    expect(s.contributions[0].value).toBe(5);
    expect(s.contributions[0].weight).toBe(10);
    expect(clampWeight("abc")).toBe(5);
    expect(clampWeight(-4)).toBe(0);
  });
});
