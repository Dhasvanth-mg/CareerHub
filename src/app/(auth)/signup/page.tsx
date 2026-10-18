import { AuthForm } from "@/components/app/auth-form";
import { signup } from "@/app/auth/actions";
import { enabledProviders } from "@/lib/auth-providers";

export const metadata = { title: "Sign up | CareerHub AI" };

export default function SignupPage() {
  return <AuthForm mode="signup" action={signup} providers={enabledProviders()} />;
}
