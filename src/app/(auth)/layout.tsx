import { Logo } from "@/components/app/logo";
import { SiteFooter } from "@/components/app/site-footer";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <Logo href="/" className="mb-8 text-lg" markClassName="size-9" />
      <div className="w-full max-w-sm">{children}</div>
      <SiteFooter className="mt-10" />
    </main>
  );
}
