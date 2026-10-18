import Link from "next/link";

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`text-xs text-muted-foreground ${className}`}>
      <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/privacy" className="underline-offset-4 hover:underline">
          Privacy
        </Link>
        <Link href="/terms" className="underline-offset-4 hover:underline">
          Terms
        </Link>
      </nav>
    </footer>
  );
}
