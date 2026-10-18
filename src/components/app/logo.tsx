import Link from "next/link";
import { cn } from "@/lib/utils";

/** The CareerHub mark: steps rising to a goal. Decorative; the product name is always shown beside it. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <defs>
        <linearGradient id="careerhub-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#careerhub-mark)" />
      <path
        d="M120 372 H196 V300 H272 V228 H322"
        fill="none"
        stroke="#fff"
        strokeWidth="40"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="388" cy="160" r="46" fill="#fff" />
      <circle cx="388" cy="160" r="18" fill="#4f46e5" />
    </svg>
  );
}

export function Logo({
  href,
  className,
  markClassName,
}: {
  href: string;
  className?: string;
  markClassName?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark className={markClassName} />
      CareerHub AI
    </Link>
  );
}
