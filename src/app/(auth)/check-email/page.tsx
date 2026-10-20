import Link from "next/link";
import { cookies } from "next/headers";
import { ResendConfirmationForm } from "@/components/app/password-forms";

export const metadata = { title: "Check your email | CareerHub AI" };

export default async function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  const sp = await searchParams;
  const unconfirmed = sp.reason === "unconfirmed";
  const email = (await cookies()).get("ch_pending_email")?.value;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl sm:text-4xl">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          {unconfirmed ? "You need to confirm your email before logging in. " : ""}
          {email ? (
            <>
              We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
            </>
          ) : (
            "We sent you a confirmation link."
          )}{" "}
          Open it on any device to finish setting up your account.
        </p>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>It can take a minute to arrive. Check your spam or promotions folder.</li>
        <li>The link works once and expires after a while.</li>
        <li>Typed the wrong address? Sign up again with the right one.</li>
      </ul>

      <ResendConfirmationForm />

      <p className="text-center text-sm text-muted-foreground">
        Already confirmed?{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Log in
        </Link>
        {" · "}
        <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
          Sign up again
        </Link>
      </p>
    </div>
  );
}
