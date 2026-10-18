import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }),
}));

import { checkAiAllowed, hasAiConsent } from "@/lib/ai/guard";
import { clientAddress, hashId, withinLimit } from "@/lib/rate-limit";
import { dbMessage } from "@/lib/forms";

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }>;

function fakeSupabase(opts: { user?: boolean; consent?: boolean; rpc?: Rpc }) {
  const rpc = vi.fn(opts.rpc ?? (async () => ({ data: "ok", error: null })));
  return {
    rpc,
    auth: { getUser: async () => ({ data: { user: opts.user === false ? null : { id: "u1" } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: opts.consent === false ? { ai_notice_accepted_at: null } : { ai_notice_accepted_at: "2026-10-01" } }) }),
      }),
    }),
  } as never;
}

beforeEach(() => vi.restoreAllMocks());

describe("hasAiConsent", () => {
  it("is false when signed out or when the notice was never accepted", async () => {
    expect(await hasAiConsent(fakeSupabase({ user: false }))).toBe(false);
    expect(await hasAiConsent(fakeSupabase({ consent: false }))).toBe(false);
    expect(await hasAiConsent(fakeSupabase({}))).toBe(true);
  });
});

describe("checkAiAllowed", () => {
  it("blocks before touching the quota when consent is missing", async () => {
    const sb = fakeSupabase({ consent: false });
    const res = await checkAiAllowed(sb, "resume");
    expect(res).toMatchObject({ ok: false, reason: "consent" });
    expect((sb as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["ok", true, undefined],
    ["user_limit", false, "user_limit"],
    ["global_limit", false, "global_limit"],
    ["unauthenticated", false, "error"],
    ["something-else", false, "error"],
  ])("maps quota answer %s", async (answer, ok, reason) => {
    const res = await checkAiAllowed(fakeSupabase({ rpc: async () => ({ data: answer, error: null }) }), "resume");
    expect(res.ok).toBe(ok);
    if (!res.ok) expect(res.reason).toBe(reason);
  });

  it("fails closed when the quota call errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await checkAiAllowed(fakeSupabase({ rpc: async () => ({ data: null, error: { code: "XX000" } }) }), "resume");
    expect(res).toMatchObject({ ok: false, reason: "error" });
  });

  it("sends the limits from the environment", async () => {
    process.env.AI_USER_HOURLY_LIMIT = "7";
    process.env.AI_GLOBAL_DAILY_LIMIT = "99";
    const sb = fakeSupabase({});
    await checkAiAllowed(sb, "resume");
    const rpc = (sb as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc;
    expect(rpc).toHaveBeenCalledWith("consume_ai_quota", { p_kind: "resume", p_user_hourly: 7, p_global_daily: 99 });
    delete process.env.AI_USER_HOURLY_LIMIT;
    delete process.env.AI_GLOBAL_DAILY_LIMIT;
  });
});

describe("rate limiting", () => {
  it("hashes identifiers so no raw address or email is stored, ignoring case and spacing", () => {
    expect(hashId("Person@Example.com ")).toBe(hashId("person@example.com"));
    expect(hashId("a")).not.toBe(hashId("b"));
    expect(hashId("203.0.113.9")).toMatch(/^[0-9a-f]{32}$/);
    expect(hashId("203.0.113.9")).not.toContain("203");
  });

  it("uses the first forwarded address", async () => {
    expect(await clientAddress()).toBe("203.0.113.9");
  });

  it("builds a key the database accepts and passes the limits through", async () => {
    const sb = fakeSupabase({ rpc: async () => ({ data: true, error: null }) });
    expect(await withinLimit(sb, "signup", "ip", "203.0.113.9", 8, 3600)).toBe(true);
    const call = (sb as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls[0];
    expect(call[0]).toBe("rate_limit_hit");
    expect(call[1].p_key).toMatch(/^signup:ip:[0-9a-f]{32}$/);
    expect(call[1]).toMatchObject({ p_limit: 8, p_window_seconds: 3600 });
  });

  it("reports over-limit, and fails open if the limiter is down", async () => {
    expect(await withinLimit(fakeSupabase({ rpc: async () => ({ data: false, error: null }) }), "login", "email", "a@b.co", 10, 900)).toBe(false);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await withinLimit(fakeSupabase({ rpc: async () => ({ data: null, error: { code: "XX000" } }) }), "login", "ip", "1.2.3.4", 60, 900)).toBe(true);
  });
});

describe("dbMessage", () => {
  it("explains cap violations and otherwise keeps the fallback", () => {
    expect(dbMessage({ code: "54000", message: "limit reached: at most 2000 rows allowed in applications" }, "x")).toMatch(/limit for this account/);
    expect(dbMessage({ code: "54000", message: "storage limit reached: 100 MB" }, "x")).toMatch(/100 MB/);
    expect(dbMessage({ code: "23505" }, "fallback")).toBe("fallback");
    expect(dbMessage(null, "fallback")).toBe("fallback");
  });
});
