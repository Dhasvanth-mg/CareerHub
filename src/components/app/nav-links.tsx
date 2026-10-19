"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, NAV_ITEMS } from "./nav-items";

/** One rail link. A short sunrise bar marks where you are. */
export function RailLink({ href, onNavigate }: { href: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  // Looked up here rather than passed in: icons are components, which a server layout cannot hand to a client component.
  const item = NAV_ITEMS.find((n) => n.href === href);
  if (!item) return null;
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/link relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      {active ? <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-sidebar-primary" /> : null}
      <Icon
        className={cn("size-[18px] shrink-0 transition-colors", active ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover/link:text-sidebar-foreground")}
        aria-hidden="true"
      />
      {item.label}
    </Link>
  );
}

/** The grouped navigation. Built for the dark rail, so its colours come from the sidebar tokens. */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-xs font-medium text-sidebar-foreground/55">{group.label}</p>
          {group.items.map((item) => (
            <RailLink key={item.href} href={item.href} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}
