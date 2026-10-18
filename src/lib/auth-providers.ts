/**
 * Social sign-in. A provider's button only appears when it is listed in NEXT_PUBLIC_OAUTH_PROVIDERS,
 * which is set once the provider has been configured in Supabase, so nobody ever sees a broken button.
 */
export const PROVIDERS = [
  { id: "github", label: "GitHub", supabase: "github" },
  { id: "google", label: "Google", supabase: "google" },
  { id: "linkedin", label: "LinkedIn", supabase: "linkedin_oidc" },
] as const;

export type ProviderId = (typeof PROVIDERS)[number]["id"];

export function parseProviders(value: string | undefined): (typeof PROVIDERS)[number][] {
  const wanted = new Set((value ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  return PROVIDERS.filter((p) => wanted.has(p.id));
}

export const enabledProviders = () => parseProviders(process.env.NEXT_PUBLIC_OAUTH_PROVIDERS);

export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id);
