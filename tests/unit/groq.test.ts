import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AiUnavailableError, groqJson } from "@/lib/ai/groq";

const schema = z.object({ ok: z.boolean() });
const opts = { name: "t", jsonSchema: { type: "object" }, system: "s", user: "u", schema };

const reply = (content: unknown, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }] }), {
    status,
  });

describe("groqJson", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-key";
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refuses to run without an API key", async () => {
    delete process.env.GROQ_API_KEY;
    const err = await groqJson(opts).catch((e) => e);
    expect(err).toBeInstanceOf(AiUnavailableError);
    expect(err.retryable).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns validated data and sends strict json_schema", async () => {
    fetchMock.mockResolvedValueOnce(reply({ ok: true }));
    const res = await groqJson(opts);
    expect(res.data).toEqual({ ok: true });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-key");
  });

  it("retries once when the output fails validation, then succeeds", async () => {
    fetchMock.mockResolvedValueOnce(reply({ ok: "nope" })).mockResolvedValueOnce(reply({ ok: true }));
    expect((await groqJson(opts)).data.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after two unreadable answers", async () => {
    fetchMock.mockResolvedValue(reply("not json at all"));
    await expect(groqJson(opts)).rejects.toBeInstanceOf(AiUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    [401, false],
    [403, false],
    [400, false],
    [429, true],
    [500, true],
    [503, true],
  ])("maps HTTP %i to a safe error (retryable=%s)", async (status, retryable) => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status }));
    const err = await groqJson(opts).catch((e) => e);
    expect(err).toBeInstanceOf(AiUnavailableError);
    expect(err.retryable).toBe(retryable);
  });

  it("never leaks the key or the prompt in error messages", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    const err = await groqJson({ ...opts, user: "SECRET RESUME TEXT" }).catch((e) => e);
    expect(String(err.message)).not.toMatch(/test-key|SECRET RESUME TEXT/);
  });

  it("turns a network failure into an AiUnavailableError", async () => {
    fetchMock.mockRejectedValueOnce(new Error("socket hang up"));
    await expect(groqJson(opts)).rejects.toBeInstanceOf(AiUnavailableError);
  });
});
