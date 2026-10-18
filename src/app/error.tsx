"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground">
        That wasn&apos;t supposed to happen, and nothing you entered has been lost or changed by this error. Try again, and if it keeps
        failing, come back in a few minutes.
      </p>
      {error.digest ? <p className="text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      <div className="flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button nativeButton={false} variant="outline" render={<Link href="/dashboard" />}>
          Go to dashboard
        </Button>
      </div>
    </main>
  );
}
