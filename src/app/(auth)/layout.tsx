import Link from "next/link";
import { SiteFooter } from "@/components/app/site-footer";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 text-lg font-semibold tracking-tight">
        CareerHub AI
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <SiteFooter className="mt-10" />
    </main>
  );
}
