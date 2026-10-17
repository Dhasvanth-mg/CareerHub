-- One referral record per (application, contact); status changes update it in place.
alter table public.referrals
  add constraint referrals_application_contact_key unique (application_id, contact_id);
