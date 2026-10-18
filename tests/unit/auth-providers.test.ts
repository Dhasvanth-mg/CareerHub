import { describe, expect, it } from "vitest";
import { PROVIDERS, parseProviders, providerById } from "@/lib/auth-providers";

describe("social sign-in providers", () => {
  it("shows nothing until a provider is switched on", () => {
    expect(parseProviders(undefined)).toEqual([]);
    expect(parseProviders("")).toEqual([]);
  });
  it("shows only the providers that are listed, in a fixed order", () => {
    expect(parseProviders("linkedin, github").map((p) => p.id)).toEqual(["github", "linkedin"]);
    expect(parseProviders("GOOGLE").map((p) => p.id)).toEqual(["google"]);
  });
  it("ignores unknown names, so a typo can't enable something unintended", () => {
    expect(parseProviders("facebook,github,twitter").map((p) => p.id)).toEqual(["github"]);
  });
  it("maps LinkedIn to the OpenID Connect provider Supabase uses", () => {
    expect(providerById("linkedin")?.supabase).toBe("linkedin_oidc");
    expect(providerById("github")?.supabase).toBe("github");
    expect(providerById("nope")).toBeUndefined();
    expect(PROVIDERS).toHaveLength(3);
  });
});
