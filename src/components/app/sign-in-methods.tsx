import type { UserIdentity } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { connectProvider, disconnectProvider } from "@/app/(app)/settings/actions";
import { enabledProviders } from "@/lib/auth-providers";

const LABEL: Record<string, string> = { email: "Email and password", github: "GitHub", google: "Google", linkedin_oidc: "LinkedIn" };

const MESSAGE: Record<string, { text: string; tone: "ok" | "error" }> = {
  added: { text: "Sign-in method connected.", tone: "ok" },
  removed: { text: "Sign-in method removed.", tone: "ok" },
  last: { text: "You can't remove your only sign-in method. Connect another one first.", tone: "error" },
  disabled: { text: "Connecting another account isn't switched on yet. Turn on manual linking in the Supabase Auth settings.", tone: "error" },
  failed: { text: "That didn't work. Please try again.", tone: "error" },
};

/** Shows how this account can sign in, and lets the person add or remove methods. */
export function SignInMethods({ identities, notice }: { identities: UserIdentity[]; notice?: string }) {
  const connected = new Set(identities.map((i) => i.provider));
  const available = enabledProviders().filter((p) => !connected.has(p.supabase));
  const message = notice ? MESSAGE[notice] : undefined;

  return (
    <section aria-labelledby="signin" className="space-y-3">
      <h2 id="signin" className="text-xl">
        Sign-in methods
      </h2>
      <p className="text-sm text-muted-foreground">
        Connect more than one so you can always get back in, even if the services use different email addresses. They all open the same
        account and the same data.
      </p>
      {message ? (
        <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-destructive" : "text-green-700 dark:text-green-400"}`}>
          {message.text}
        </p>
      ) : null}
      <ul className="divide-y rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] text-sm">
        {identities.map((i) => {
          const email = typeof i.identity_data?.email === "string" ? i.identity_data.email : null;
          return (
            <li key={i.identity_id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="font-medium">{LABEL[i.provider] ?? i.provider}</p>
                {email ? <p className="text-muted-foreground">{email}</p> : null}
              </div>
              {identities.length > 1 ? (
                <form action={disconnectProvider.bind(null, i.identity_id)}>
                  <Button type="submit" variant="outline" size="sm">
                    Remove
                  </Button>
                </form>
              ) : (
                <span className="text-xs text-muted-foreground">Only method</span>
              )}
            </li>
          );
        })}
      </ul>
      {available.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {available.map((p) => (
            <form key={p.id} action={connectProvider.bind(null, p.id)}>
              <Button type="submit" variant="outline" size="sm">
                Connect {p.label}
              </Button>
            </form>
          ))}
        </div>
      ) : null}
    </section>
  );
}
