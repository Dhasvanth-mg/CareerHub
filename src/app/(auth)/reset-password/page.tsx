import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/app/password-forms";

export const metadata = { title: "Choose a new password | CareerHub AI" };

export default async function ResetPasswordPage() {
  // Only reachable through a valid reset link, which signs the user in briefly.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?error=link");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl sm:text-4xl">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">You&apos;ll be logged in as {data.user.email} once it&apos;s saved.</p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
