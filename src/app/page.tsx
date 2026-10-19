import Link from "next/link";
import { BarChart3, Layers, ScanSearch } from "lucide-react";
import { AscentSketch } from "@/components/app/ascent";
import { Logo } from "@/components/app/logo";
import { SiteFooter } from "@/components/app/site-footer";
import { Button } from "@/components/ui/button";

const PILLARS = [
  {
    icon: ScanSearch,
    title: "Keep every application in view",
    body: "Paste a posting or a link and the details are pulled out for you to check. Stages, deadlines, interviews and follow-ups live in one place.",
  },
  {
    icon: Layers,
    title: "Prepare from what you have actually done",
    body: "Resume and cover letter feedback quotes your own words, and says plainly when your documents don't back up a requirement.",
  },
  {
    icon: BarChart3,
    title: "Decide with the full picture",
    body: "See where applications stall, compare offers on the things you care about, and plan the next stretch.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo href="/" className="text-lg" markClassName="size-8" />
        <nav aria-label="Account" className="flex items-center gap-2">
          <Button nativeButton={false} variant="ghost" render={<Link href="/login" />}>
            Log in
          </Button>
          <Button nativeButton={false} render={<Link href="/signup" />}>
            Get started
          </Button>
        </nav>
      </header>

      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div className="space-y-6">
            <h1 className="text-5xl leading-[1.02] sm:text-6xl">Your job search, one clear climb.</h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Track every application, capture postings, and get resume feedback grounded in your own experience. The AI suggests. You decide.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button nativeButton={false} size="lg" render={<Link href="/signup" />}>
                Start for free
              </Button>
              <Button nativeButton={false} size="lg" variant="outline" render={<Link href="/login" />}>
                I already have an account
              </Button>
            </div>
          </div>
          <AscentSketch className="lg:h-[26rem]" />
        </section>

        <section aria-labelledby="how" className="border-t bg-card/60">
          <div className="mx-auto max-w-6xl space-y-10 px-6 py-16">
            <h2 id="how" className="max-w-xl text-3xl">
              Built for the people who have the most to figure out
            </h2>
            <ul className="grid gap-10 md:grid-cols-3">
              {PILLARS.map((p) => (
                <li key={p.title} className="space-y-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <p.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-lg">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="trust" className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-8 rounded-3xl bg-sidebar p-8 text-sidebar-foreground md:grid-cols-[1fr_1.4fr] md:p-12">
            <h2 id="trust" className="text-3xl text-sidebar-accent-foreground">
              AI that shows its work
            </h2>
            <ul className="space-y-4 text-sm leading-relaxed text-sidebar-foreground/85">
              <li>Every quote the AI gives is checked against your own resume or the job posting. If it can&apos;t be found, it is dropped.</li>
              <li>Nothing is saved, sent or changed until you approve it. Suggestions are always labelled as suggestions.</li>
              <li>Your postings and documents can&apos;t give the AI instructions, and you can turn AI off whenever you like.</li>
            </ul>
          </div>
        </section>
      </main>

      <div className="mx-auto max-w-6xl px-6 pb-10">
        <SiteFooter />
      </div>
    </div>
  );
}
