/**
 * Password reset needs a working email sender (SMTP) on the Supabase project. Until that is set up,
 * the built-in mailer only reaches Supabase team members, so the links would silently fail for
 * everyone else. Set NEXT_PUBLIC_EMAIL_FLOWS=1 (and rebuild) once SMTP works.
 */
export const EMAIL_FLOWS_ENABLED = process.env.NEXT_PUBLIC_EMAIL_FLOWS === "1";
