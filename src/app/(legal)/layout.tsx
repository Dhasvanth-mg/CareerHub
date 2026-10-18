import { Logo } from "@/components/app/logo";
import { SiteFooter } from "@/components/app/site-footer";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-10">
      <Logo href="/" className="text-sm" markClassName="size-6" />
      <main id="main" className="prose-sm mt-8 space-y-6 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed [&_ul]:space-y-1">
        {children}
      </main>
      <SiteFooter className="mt-12 border-t pt-6" />
    </div>
  );
}
