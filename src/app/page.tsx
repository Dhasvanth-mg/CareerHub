import Link from "next/link";
import { SiteFooter } from "@/components/app/site-footer";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-start justify-center gap-6 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">CareerHub AI</h1>
      <p className="text-lg text-muted-foreground">
        Track every application, capture job postings, and get evidence-based resume feedback. You stay in
        control: the AI suggests, you decide.
      </p>
      <div className="flex gap-3">
        <Button nativeButton={false} render={<Link href="/signup" />}>
          Get started
        </Button>
        <Button nativeButton={false} variant="outline" render={<Link href="/login" />}>
          Log in
        </Button>
      </div>
      <SiteFooter className="mt-8" />
    </main>
  );
}
