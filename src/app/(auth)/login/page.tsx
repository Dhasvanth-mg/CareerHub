import Link from "next/link";
import { AuthForm } from "@/components/app/auth-form";
import { login } from "@/app/auth/actions";

export const metadata = { title: "Log in | CareerHub AI" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const error = typeof params.error === "string" ? params.error : undefined;
  const initialError =
    error === "link"
      ? "That link is invalid or has expired. Request a new one below."
      : error
        ? "Sign-in failed. Please try again."
        : undefined;
  const notice = params.deleted ? "Your account and data have been deleted." : undefined;

  return (
    <div className="space-y-4">
      <AuthForm mode="login" action={login} next={next} initialError={initialError} notice={notice} />
      {error === "link" ? (
        <p className="text-center text-sm">
          <Link href="/forgot-password" className="font-medium underline underline-offset-4">
            Reset your password
          </Link>
        </p>
      ) : null}
    </div>
  );
}
