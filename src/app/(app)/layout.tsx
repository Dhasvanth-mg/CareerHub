import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CommandPalette } from "@/components/app/command-palette";
import { Logo } from "@/components/app/logo";
import { MobileNav } from "@/components/app/mobile-nav";
import { SiteFooter } from "@/components/app/site-footer";
import { NavLinks } from "@/components/app/nav-links";
import { ThemeToggle } from "@/components/app/theme";
import { UserMenu } from "@/components/app/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to main content
      </a>
      <aside className="hidden w-60 shrink-0 border-r bg-sidebar p-4 md:block">
        <Logo href="/dashboard" className="mb-6 px-3 text-lg" />
        <NavLinks />
        {isAdmin === true ? (
          <Link href="/admin" className="mt-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Admin
          </Link>
        ) : null}
        <SiteFooter className="mt-8 px-3" />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <MobileNav />
          <div className="ml-auto flex items-center gap-1">
            <CommandPalette />
            <ThemeToggle />
            <UserMenu email={data.user.email ?? "Account"} />
          </div>
        </header>
        <main id="main" className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
