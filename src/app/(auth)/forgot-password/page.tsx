import Link from "next/link";
import { ForgotPasswordForm } from "@/components/app/password-forms";
import { EMAIL_FLOWS_ENABLED } from "@/lib/flags";

export const metadata = { title: "Reset your password | CareerHub AI" };

export default function ForgotPasswordPage() {
  if (!EMAIL_FLOWS_ENABLED) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl">Password reset isn&apos;t available yet</h1>
        <p className="text-sm text-muted-foreground">
          Email sending isn&apos;t set up for this app yet, so we can&apos;t send reset links. Contact the person who invited you if you
          are locked out.
        </p>
        <Link href="/login" className="text-sm font-medium underline underline-offset-4">
          Back to log in
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl sm:text-4xl">Reset your password</h1>
        <p className="text-sm text-muted-foreground">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
