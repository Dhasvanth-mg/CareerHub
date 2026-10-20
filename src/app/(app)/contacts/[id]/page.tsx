import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ConfirmForm } from "@/components/app/confirm-form";
import { ContactForm, type ContactRow } from "@/components/app/contact-form";
import { CONTACT_ROLE_LABEL, REFERRAL_LABEL } from "@/lib/domain";
import { deleteContact, updateContact } from "../actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Linked = {
  role: keyof typeof CONTACT_ROLE_LABEL;
  application_id: string;
  applications: { id: string; title: string; company_name: string } | null;
};

export async function generateMetadata({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Contact | CareerHub AI" };
  const supabase = await createClient();
  const { data } = await supabase.from("contacts").select("name").eq("id", id).maybeSingle();
  return { title: data ? `${data.name} | CareerHub AI` : "Contact | CareerHub AI" };
}

export default async function ContactDetailPage({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: contact } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
  if (!contact) notFound();

  const [linkedRes, referralsRes] = await Promise.all([
    supabase
      .from("application_contacts")
      .select("role, application_id, applications(id, title, company_name)")
      .eq("contact_id", id),
    supabase.from("referrals").select("application_id, status").eq("contact_id", id),
  ]);
  const linked = (linkedRes.data ?? []) as unknown as Linked[];
  const referralStatus = new Map((referralsRes.data ?? []).map((r) => [r.application_id, r.status]));

  return (
    <div className="max-w-3xl space-y-8">
      <div className="space-y-3">
        <Link href="/contacts" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Contacts
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl">{contact.name}</h1>
          <ConfirmForm
            action={deleteContact.bind(null, id)}
            message={`Delete ${contact.name}? They will be unlinked from every application. This can't be undone.`}
            variant="destructive"
          >
            <Trash2 aria-hidden="true" /> Delete
          </ConfirmForm>
        </div>
      </div>

      <section aria-labelledby="linked" className="space-y-3">
        <h2 id="linked" className="text-xl">
          Linked applications
        </h2>
        {linked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Not linked to any application yet. Open an application and use &ldquo;Contacts &amp; referrals&rdquo; to link this person.
          </p>
        ) : (
          <ul className="divide-y rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06]">
            {linked.map((l) =>
              l.applications ? (
                <li key={l.application_id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <Link href={`/applications/${l.applications.id}`} className="font-medium underline-offset-4 hover:underline">
                    {l.applications.title} at {l.applications.company_name}
                  </Link>
                  <span className="text-muted-foreground">
                    {CONTACT_ROLE_LABEL[l.role]} · Referral:{" "}
                    {REFERRAL_LABEL[(referralStatus.get(l.application_id) ?? "not_requested") as keyof typeof REFERRAL_LABEL]}
                  </span>
                </li>
              ) : null,
            )}
          </ul>
        )}
      </section>

      <section aria-labelledby="details" className="space-y-4">
        <h2 id="details" className="text-xl">
          Details
        </h2>
        <ContactForm
          action={updateContact.bind(null, id)}
          defaults={contact as ContactRow}
          submitLabel="Save changes"
          toastOnSuccess
        />
      </section>
    </div>
  );
}
