import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found | CareerHub AI" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-4 px-6">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold tracking-tight">We can&apos;t find that page</h1>
      <p className="text-muted-foreground">
        The link may be old, or the item may have been deleted. Your data is safe; head back and try again.
      </p>
      <div className="flex gap-3">
        <Button nativeButton={false} render={<Link href="/dashboard" />}>
          Go to dashboard
        </Button>
        <Button nativeButton={false} variant="outline" render={<Link href="/" />}>
          Home
        </Button>
      </div>
    </main>
  );
}
