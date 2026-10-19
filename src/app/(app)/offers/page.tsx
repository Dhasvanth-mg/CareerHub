import { createClient } from "@/lib/supabase/server";
import { AddOfferForm, OfferCard, OfferComparison, type OfferRow } from "@/components/app/offers-ui";
import { STAGES, type Stage } from "@/lib/domain";
import type { Weights } from "@/lib/offers";

export const metadata = { title: "Offers | CareerHub AI" };

type Row = Omit<OfferRow, "label"> & { applications: { title: string; company_name: string; stage: string } | null };

export default async function OffersPage() {
  const supabase = await createClient();
  const [offersRes, appsRes, profileRes] = await Promise.all([
    supabase
      .from("offers")
      .select(
        "id, application_id, currency, base_amount, pay_period, bonus_amount, equity_text, benefits_text, location, work_mode, start_date, decision_deadline, notes, ratings, applications(title, company_name, stage)",
      )
      .order("created_at", { ascending: true })
      .limit(200),
    supabase.from("applications").select("id, title, company_name, stage").is("archived_at", null).order("updated_at", { ascending: false }).limit(300),
    supabase.from("career_profiles").select("weights").maybeSingle(),
  ]);

  const offers: OfferRow[] = ((offersRes.data ?? []) as unknown as Row[]).map((o) => ({
    ...o,
    base_amount: o.base_amount === null ? null : Number(o.base_amount),
    bonus_amount: o.bonus_amount === null ? null : Number(o.bonus_amount),
    label: o.applications ? `${o.applications.company_name}: ${o.applications.title}` : "Offer",
  }));
  const withOffers = new Set(offers.map((o) => o.application_id));
  // Applications already at the offer stage come first, since those are the likely candidates.
  const rank = (s: string) => (s === "offer" || s === "accepted" ? 0 : 1);
  const choices = (appsRes.data ?? [])
    .filter((a) => !withOffers.has(a.id) && STAGES.includes(a.stage as Stage))
    .sort((a, b) => rank(a.stage) - rank(b.stage))
    .map((a) => ({ id: a.id, label: `${a.title} at ${a.company_name}${rank(a.stage) === 0 ? " (offer)" : ""}` }));
  const weights = ((profileRes.data?.weights as { offers?: Weights } | null)?.offers ?? {}) as Weights;

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl sm:text-4xl">Offers</h1>
        <p className="text-sm text-muted-foreground">
          Compare offers side by side using the numbers you enter and the weights you choose. Nothing here is estimated or looked up: pay
          and benefits are exactly what each offer says.
        </p>
      </div>

      {offers.length >= 2 ? (
        <section aria-labelledby="compare" className="space-y-3">
          <h2 id="compare" className="text-xl">
            Compare
          </h2>
          <OfferComparison offers={offers} initialWeights={weights} />
        </section>
      ) : null}

      <section aria-labelledby="offers" className="space-y-3">
        <h2 id="offers" className="text-xl">
          Your offers
        </h2>
        {offers.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            No offers yet. When one comes in, add it below. Comparison appears once you have two.
          </p>
        ) : (
          <ul className="space-y-2">
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="add" className="space-y-3 rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] p-4">
        <h2 id="add" className="font-medium">
          Add an offer
        </h2>
        <AddOfferForm applications={choices} />
      </section>
    </div>
  );
}
