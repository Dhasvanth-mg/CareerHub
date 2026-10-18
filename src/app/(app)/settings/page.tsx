import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AiNoticeText } from "@/components/app/ai-gate";
import { DeleteAccountForm, ProfileForm } from "@/components/app/settings-forms";
import { StorageSection } from "@/components/app/storage-section";
import { ShareSection } from "@/components/app/share-section";
import { SignInMethods } from "@/components/app/sign-in-methods";
import { ThemeChooser } from "@/components/app/theme";
import { LocalTime } from "@/components/app/local-time";
import { Button } from "@/components/ui/button";
import { acceptAiNotice, revokeAiNotice } from "./actions";

export const metadata = { title: "Settings | CareerHub AI" };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const sp = await searchParams;
  const link = Array.isArray(sp.link) ? sp.link[0] : sp.link;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, ai_notice_accepted_at")
    .eq("id", auth.user.id)
    .maybeSingle();
  const aiOn = Boolean(profile?.ai_notice_accepted_at);
  const { data: identityData } = await supabase.auth.getUserIdentities();
  const identities = identityData?.identities ?? [];

  return (
    <div className="max-w-3xl space-y-10">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <section aria-labelledby="profile" className="space-y-3">
        <h2 id="profile" className="text-lg font-medium">
          Profile
        </h2>
        <p className="text-sm text-muted-foreground">Signed in as {auth.user.email}.</p>
        <ProfileForm displayName={profile?.display_name ?? ""} />
      </section>

      <SignInMethods identities={identities} notice={link} />

      <section aria-labelledby="appearance" className="space-y-3">
        <h2 id="appearance" className="text-lg font-medium">
          Appearance
        </h2>
        <p className="text-sm text-muted-foreground">System follows your device setting. The choice is remembered on this browser.</p>
        <ThemeChooser />
      </section>

      <section aria-labelledby="ai" className="space-y-3">
        <h2 id="ai" className="text-lg font-medium">
          AI features
        </h2>
        <AiNoticeText />
        {aiOn ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">
              On since <LocalTime iso={profile!.ai_notice_accepted_at!} dateOnly />.
            </p>
            <form action={revokeAiNotice}>
              <Button type="submit" variant="outline">
                Turn off AI features
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm">Off. Job Capture, Resume Studio and next-action suggestions are paused.</p>
            <form action={acceptAiNotice}>
              <Button type="submit">Turn on AI features</Button>
            </form>
          </div>
        )}
      </section>

      <StorageSection userId={auth.user.id} />

      <ShareSection />

      <section aria-labelledby="data" className="space-y-3">
        <h2 id="data" className="text-lg font-medium">
          Your data
        </h2>
        <p className="text-sm text-muted-foreground">
          Download everything you&apos;ve stored. The full export is a JSON file with all your records and the text extracted from
          your documents. Files themselves can be downloaded from the Document Vault.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button nativeButton={false} variant="outline" render={<a href="/api/export?format=json" />}>
            <Download aria-hidden="true" /> Everything (JSON)
          </Button>
          <Button nativeButton={false} variant="outline" render={<a href="/api/export?format=csv" />}>
            <Download aria-hidden="true" /> Applications (CSV)
          </Button>
        </div>
      </section>

      <section aria-labelledby="danger" className="space-y-3 rounded-lg border border-destructive/40 p-4">
        <h2 id="danger" className="text-lg font-medium text-destructive">
          Delete account
        </h2>
        <p className="text-sm text-muted-foreground">
          This permanently deletes your account, every application, contact, task, analysis and all uploaded files. It can&apos;t be
          undone, so download your data first if you want a copy.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
