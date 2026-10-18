"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-redirect";
import { TOO_MANY, clientAddress, withinLimit } from "@/lib/rate-limit";
import { enabledProviders, providerById } from "@/lib/auth-providers";

export type AuthState = { error?: string; message?: string } | undefined;

const PENDING_EMAIL_COOKIE = "ch_pending_email";

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});
const emailOnly = z.object({ email: z.string().trim().email("Enter a valid email address.") });

async function siteOrigin(): Promise<string> {
  return (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
}

/** Remembers which address is waiting for confirmation without putting it in a URL. */
async function rememberPendingEmail(email: string) {
  (await cookies()).set(PENDING_EMAIL_COOKIE, email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const ip = await clientAddress();
  if (
    !(await withinLimit(supabase, "login", "ip", ip, 60, 900)) ||
    !(await withinLimit(supabase, "login", "email", parsed.data.email, 10, 900))
  ) {
    return { error: TOO_MANY };
  }
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      await rememberPendingEmail(parsed.data.email);
      redirect("/check-email?reason=unconfirmed");
    }
    return { error: "Incorrect email or password." };
  }
  redirect(safeNext(formData.get("next")));
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Bots fill every field, including the hidden one. Look like a success and do nothing.
  if (String(formData.get("company_website") ?? "").trim() !== "") redirect("/check-email");

  const origin = await siteOrigin();
  const supabase = await createClient();
  const ip = await clientAddress();
  if (
    !(await withinLimit(supabase, "signup", "ip", ip, 8, 3600)) ||
    !(await withinLimit(supabase, "signup", "email", parsed.data.email, 3, 3600))
  ) {
    return { error: TOO_MANY };
  }
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };
  if (!data.session) {
    // Confirmation is on: the user must click the emailed link before they can log in.
    await rememberPendingEmail(parsed.data.email);
    redirect("/check-email");
  }
  redirect("/dashboard");
}

/**
 * Always answers the same way, so the form can't be used to find out which addresses have accounts.
 */
export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = emailOnly.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const origin = await siteOrigin();
  const supabase = await createClient();
  if (
    !(await withinLimit(supabase, "reset", "ip", await clientAddress(), 8, 3600)) ||
    !(await withinLimit(supabase, "reset", "email", parsed.data.email, 3, 3600))
  ) {
    return { error: TOO_MANY };
  }
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  return { message: "If an account exists for that address, we've emailed a link to reset the password. It expires in an hour." };
}

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters.").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match.", path: ["confirm"] });

/** Runs for a user who arrived through a reset link (they hold a short-lived session). */
export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = passwordSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "This reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "Choose a password you haven't used before."
          : error.code === "weak_password"
            ? "That password is too easy to guess. Try a longer one."
            : "Couldn't update the password. Request a new link and try again.",
    };
  }
  redirect("/dashboard");
}

export async function resendConfirmation(): Promise<AuthState> {
  const email = (await cookies()).get(PENDING_EMAIL_COOKIE)?.value;
  if (!email) return { error: "We don't have an address to resend to. Sign up again, or log in." };

  const origin = await siteOrigin();
  const supabase = await createClient();
  if (!(await withinLimit(supabase, "resend", "email", email, 3, 3600))) return { error: TOO_MANY };
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error?.code === "over_email_send_rate_limit" || error?.status === 429) {
    return { error: "Please wait a minute before asking for another email." };
  }
  if (error) return { error: "Couldn't send the email. Please try again shortly." };
  return { message: "Sent. It can take a minute to arrive. Check your spam folder too." };
}

/** Starts social sign-in. Only providers that have been switched on can be used. */
export async function signInWithProvider(providerId: string) {
  const provider = providerById(providerId);
  if (!provider || !enabledProviders().some((p) => p.id === provider.id)) redirect("/login?error=oauth");

  const origin = await siteOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider.supabase,
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
