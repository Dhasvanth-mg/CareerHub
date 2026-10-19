import Link from "next/link";
import { ContactForm } from "@/components/app/contact-form";
import { createContact } from "../actions";

export const metadata = { title: "Add contact | CareerHub AI" };

export default function NewContactPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/contacts" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Contacts
        </Link>
        <h1 className="mt-2 text-3xl sm:text-4xl">Add contact</h1>
      </div>
      <ContactForm action={createContact} submitLabel="Create contact" />
    </div>
  );
}
