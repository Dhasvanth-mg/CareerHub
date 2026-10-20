import { AscentSketch } from "@/components/app/ascent";
import { Logo } from "@/components/app/logo";
import { SiteFooter } from "@/components/app/site-footer";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      {/* The brand side. Hidden on phones, where the form gets the whole screen. */}
      <aside className="relative hidden flex-col justify-between bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <Logo href="/" className="text-lg text-sidebar-accent-foreground" markClassName="size-9" />
        <div className="space-y-8">
          <p className="max-w-md font-heading text-4xl font-semibold leading-tight tracking-tight text-sidebar-accent-foreground">
            Know where you stand, and what to do next.
          </p>
          <AscentSketch className="max-w-md" />
        </div>
        <p className="max-w-sm text-sm text-sidebar-foreground/70">
          The AI suggests and shows its sources. You approve everything, and nothing is saved without you.
        </p>
      </aside>

      <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
        <Logo href="/" className="mb-8 text-lg lg:hidden" markClassName="size-9" />
        <div className="w-full max-w-sm">{children}</div>
        <SiteFooter className="mt-10" />
      </main>
    </div>
  );
}
