import { ChevronsUpDown, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/auth/actions";
import { cn } from "@/lib/utils";

const initials = (value: string) =>
  value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";

/**
 * The account control. `rail` is the full row at the bottom of the dark sidebar; `compact` is just the avatar for the
 * phone header.
 */
export function UserMenu({ email, name, variant = "rail" }: { email: string; name?: string | null; variant?: "rail" | "compact" }) {
  const label = name?.trim() || email;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account menu"
            className={cn(
              "flex items-center gap-3 rounded-lg text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              variant === "rail"
                ? "min-w-0 flex-1 p-2 text-sidebar-foreground hover:bg-sidebar-accent"
                : "rounded-full",
            )}
          />
        }
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground ring-1 ring-sidebar-border md:bg-sidebar-accent">
            {initials(label)}
          </AvatarFallback>
        </Avatar>
        {variant === "rail" ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{label}</span>
              {name ? <span className="block truncate text-xs text-sidebar-foreground/60">{email}</span> : null}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-sidebar-foreground/50" aria-hidden="true" />
          </>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "rail" ? "start" : "end"} side={variant === "rail" ? "top" : "bottom"} className="w-60">
        {/* Base UI requires a group label to live inside a group; without it the menu throws on open. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{email}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <form action={logout}>
          <DropdownMenuItem render={<button type="submit" className="w-full cursor-pointer" />}>
            <LogOut className="size-4" aria-hidden="true" /> Log out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
