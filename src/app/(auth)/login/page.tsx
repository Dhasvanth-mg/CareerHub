import { AuthForm } from "@/components/app/auth-form";
import { login } from "@/app/auth/actions";

export const metadata = { title: "Log in | CareerHub AI" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const initialError = params.error ? "Sign-in failed. Please try again." : undefined;
  return (
    <AuthForm mode="login" action={login} next={next} initialError={initialError} />
  );
}
