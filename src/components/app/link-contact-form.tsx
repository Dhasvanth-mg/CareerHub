"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { linkContact } from "@/app/(app)/contacts/actions";
import { SubmitButton } from "@/components/app/submit-button";
import { NativeSelect } from "@/components/ui/native-select";
import { CONTACT_ROLES, CONTACT_ROLE_LABEL } from "@/lib/domain";
import { useSafeForm } from "@/lib/use-safe-form";

export function LinkContactForm({
  applicationId,
  contacts,
}: {
  applicationId: string;
  contacts: { id: string; label: string }[];
}) {
  const { state, onSubmit, pending } = useSafeForm(linkContact.bind(null, applicationId));
  const handled = useRef(state);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (!state?.error) toast.success("Contact linked");
  }, [state]);

  if (contacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No contacts to link.{" "}
        <Link href="/contacts/new" className="underline underline-offset-4">
          Add a contact
        </Link>{" "}
        first.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="link-contact" className="mb-1 block text-xs text-muted-foreground">
          Contact
        </label>
        <NativeSelect id="link-contact" name="contact_id" defaultValue="" required className="w-52">
          <option value="" disabled>
            Choose a contact
          </option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div>
        <label htmlFor="link-role" className="mb-1 block text-xs text-muted-foreground">
          Role
        </label>
        <NativeSelect id="link-role" name="role" defaultValue="recruiter" className="w-40">
          {CONTACT_ROLES.map((r) => (
            <option key={r} value={r}>
              {CONTACT_ROLE_LABEL[r]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <SubmitButton pending={pending} variant="secondary" pendingText="Linking…">
        Link
      </SubmitButton>
      {state?.error ? (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
