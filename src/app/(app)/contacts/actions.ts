"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import { firstError, formToObject, optDate, optText, type ActionState } from "@/lib/forms";
import { CONTACT_ROLES, CONTACT_ROLE_LABEL, REFERRAL_LABEL, REFERRAL_STATUSES } from "@/lib/domain";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(200),
  company: optText(200),
  position: optText(200),
  email: optText(320).refine((v) => v === null || z.string().email().safeParse(v).success, "Enter a valid email."),
  linkedin_url: optText(500).refine((v) => v === null || /^https?:\/\//i.test(v), "Use a full http(s) link."),
  relationship: optText(200),
  where_met: optText(200),
  notes: optText(10000),
  last_contacted_on: optDate,
});

export async function createContact(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = contactSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.from("contacts").insert(parsed.data).select("id").single();
  if (error || !data) return { error: "Could not save the contact. Please try again." };
  revalidatePath("/contacts");
  redirect(`/contacts/${data.id}`);
}

export async function updateContact(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = contactSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update(parsed.data).eq("id", id);
  if (error) return { error: "Could not save changes. Please try again." };
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  return undefined;
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  await supabase.from("contacts").delete().eq("id", id);
  revalidatePath("/contacts");
  redirect("/contacts");
}

const linkSchema = z.object({
  contact_id: z.string().uuid("Choose a contact."),
  role: z.enum(CONTACT_ROLES).default("other"),
});

export async function linkContact(applicationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = linkSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("application_contacts")
    .insert({ application_id: applicationId, ...parsed.data });
  if (error) {
    return { error: error.code === "23505" ? "That contact is already linked." : "Could not link the contact." };
  }
  const { data: contact } = await supabase.from("contacts").select("name").eq("id", parsed.data.contact_id).single();
  await logEvent(
    supabase,
    applicationId,
    "contact_linked",
    `Linked ${contact?.name ?? "a contact"} as ${CONTACT_ROLE_LABEL[parsed.data.role].toLowerCase()}`,
  );
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath(`/contacts/${parsed.data.contact_id}`);
  return undefined;
}

export async function unlinkContact(applicationId: string, contactId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("application_contacts")
    .delete()
    .eq("application_id", applicationId)
    .eq("contact_id", contactId);
  if (!error) {
    // A referral only makes sense while the contact is linked to the application.
    await supabase.from("referrals").delete().eq("application_id", applicationId).eq("contact_id", contactId);
    await logEvent(supabase, applicationId, "contact_unlinked", "Unlinked a contact");
  }
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath(`/contacts/${contactId}`);
}

export async function setReferralStatus(applicationId: string, contactId: string, formData: FormData) {
  const parsed = z.enum(REFERRAL_STATUSES).safeParse(formData.get("status"));
  if (!parsed.success) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("referrals")
    .upsert(
      { application_id: applicationId, contact_id: contactId, status: parsed.data },
      { onConflict: "application_id,contact_id" },
    );
  if (!error) {
    const { data: contact } = await supabase.from("contacts").select("name").eq("id", contactId).single();
    await logEvent(
      supabase,
      applicationId,
      "referral_status",
      `Referral via ${contact?.name ?? "contact"}: ${REFERRAL_LABEL[parsed.data]}`,
      { to: parsed.data },
    );
  }
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath(`/contacts/${contactId}`);
}
