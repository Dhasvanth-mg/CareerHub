import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CommandPalette } from "@/components/app/command-palette";
import { Logo } from "@/components/app/logo";
import { MobileNav } from "@/components/app/mobile-nav";
import { NavLinks, RailLink } from "@/components/app/nav-links";
import { ThemeToggle } from "@/components/app/theme";
import { UserMenu } from "@/components/app/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  const email = data.user.email ?? "Account";
  const meta = data.user.user_metadata as { full_name?: string; name?: string } | undefined;
  const name = meta?.full_name ?? meta?.name ?? null;

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to main content
      </a>

      {/* The rail: always dark, so the pale canvas beside it reads as the place you work. */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="space-y-4 p-4 pb-3">
          <Logo href="/dashboard" className="px-1 text-lg text-sidebar-accent-foreground" markClassName="size-8" />
          <CommandPalette variant="rail" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 [scrollbar-width:thin]">
          <NavLinks />
        </div>
        <div className="space-y-1 border-t border-sidebar-border p-3">
          <RailLink href="/settings" />
          {isAdmin === true ? (
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 outline-none transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <ShieldCheck className="size-[18px] text-sidebar-foreground/60" aria-hidden="true" />
              Admin
            </Link>
          ) : null}
          <div className="flex items-center gap-1 pt-1">
            <UserMenu email={email} name={name} variant="rail" />
            <ThemeToggle className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phones get a slim bar; on larger screens everything lives in the rail. */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b bg-background/85 px-3 backdrop-blur md:hidden">
          <MobileNav />
          <Logo href="/dashboard" className="ml-1 text-base" markClassName="size-7" />
          <div className="ml-auto flex items-center gap-0.5">
            <CommandPalette variant="icon" />
            <ThemeToggle />
            <UserMenu email={email} name={name} variant="compact" />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-10 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
