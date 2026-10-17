import { AuthForm } from "@/components/app/auth-form";
import { signup } from "@/app/auth/actions";

export const metadata = { title: "Sign up | CareerHub AI" };

export default function SignupPage() {
  return <AuthForm mode="signup" action={signup} />;
}
