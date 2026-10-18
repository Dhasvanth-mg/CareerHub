"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithProvider, type AuthState } from "@/app/auth/actions";
import { EMAIL_FLOWS_ENABLED } from "@/lib/flags";
import { useSafeForm } from "@/lib/use-safe-form";

type Props = {
  mode: "login" | "signup";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  /** Social sign-in providers that are switched on. */
  providers?: { id: string; label: string }[];
  next?: string;
  initialError?: string;
  /** Neutral, non-error message shown above the form (for example after deleting an account). */
  notice?: string;
};

export function AuthForm({ mode, action, providers = [], next, initialError, notice }: Props) {
  const { state, onSubmit, pending } = useSafeForm(action);
  const isLogin = mode === "login";
  const error = state?.error ?? initialError;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isLogin ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isLogin ? "Log in to your CareerHub workspace." : "Track every application in one place."}
        </p>
      </div>

      {notice ? (
        <p role="status" className="rounded-md border p-3 text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}

      {providers.length > 0 ? (
        <div className="space-y-2">
          {providers.map((p) => (
            // A plain server-action form: works without JavaScript and never puts anything in the URL.
            <form key={p.id} action={signInWithProvider.bind(null, p.id)}>
              <Button type="submit" variant="outline" className="w-full">
                Continue with {p.label}
              </Button>
            </form>
          ))}
          <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            or use email
            <span className="h-px flex-1 bg-border" />
          </div>
        </div>
      ) : null}

      <form method="post" onSubmit={onSubmit} className="space-y-4" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {!isLogin ? (
          // Honeypot: invisible to people, tempting to bots. A filled value means the signup is ignored.
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Leave this field empty
              <input type="text" name="company_website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {isLogin && EMAIL_FLOWS_ENABLED ? (
              <Link href="/forgot-password" className="text-xs text-muted-foreground underline underline-offset-4">
                Forgot password?
              </Link>
            ) : null}
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={8}
            required
          />
        </div>
        <div aria-live="polite" className="min-h-5 text-sm">
          {error ? <p className="text-destructive">{error}</p> : null}
          {state?.message ? <p className="text-muted-foreground">{state.message}</p> : null}
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Please wait…" : isLogin ? "Log in" : "Sign up"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {isLogin ? "New to CareerHub?" : "Already have an account?"}{" "}
        <Link href={isLogin ? "/signup" : "/login"} className="font-medium text-foreground underline underline-offset-4">
          {isLogin ? "Sign up" : "Log in"}
        </Link>
      </p>
    </div>
  );
}
