"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LogoMark } from "./logo";
import { NavLinks, RailLink } from "./nav-links";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation" />}>
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 gap-0 overflow-y-auto border-sidebar-border bg-sidebar p-4 text-sidebar-foreground [&_[data-slot=sheet-close]]:text-sidebar-foreground"
      >
        <SheetHeader className="p-0 pb-5">
          <SheetTitle className="flex items-center gap-2.5 font-heading text-base font-semibold text-sidebar-accent-foreground">
            <LogoMark />
            CareerHub AI
          </SheetTitle>
        </SheetHeader>
        <NavLinks onNavigate={() => setOpen(false)} />
        <div className="mt-5 border-t border-sidebar-border pt-3">
          <RailLink href="/settings" onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
