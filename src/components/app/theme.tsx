"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeProvider({ nonce, children }: { nonce?: string; children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
      {children}
    </NextThemesProvider>
  );
}

const subscribe = () => () => {};
/** False on the server and during hydration, true afterwards, so theme-dependent text never mismatches. */
function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

const CHOICES = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

/** Radio group for Settings. */
export function ThemeChooser() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  return (
    <div role="radiogroup" aria-label="Theme" className="flex w-fit rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] p-0.5 text-sm">
      {CHOICES.map((c) => {
        const on = mounted && (theme ?? "system") === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => setTheme(c.value)}
            className={`rounded-md px-3 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "bg-muted font-medium" : "text-muted-foreground"}`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/** Header button: flips between light and dark from whatever is showing now. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
    </Button>
  );
}
