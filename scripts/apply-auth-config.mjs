// Applies CareerHub's Supabase Auth settings (email on, SMTP, templates, redirect URLs).
// Secrets come from the environment so they never land in shell history or the repo:
//   SUPABASE_ACCESS_TOKEN  personal access token (revoke it afterwards)
//   SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM [SMTP_SENDER_NAME]
//   SITE_URL (default https://careerhub-woad.vercel.app)
import { readFileSync } from "node:fs";

const ref = "yvbyanbixchjeztglpve";
const env = (k, d) => process.env[k] ?? d;
const need = (k) => {
  if (!process.env[k]) throw new Error(`Missing ${k}`);
  return process.env[k];
};

const site = env("SITE_URL", "https://careerhub-woad.vercel.app").replace(/\/$/, "");
const token = need("SUPABASE_ACCESS_TOKEN");
const read = (f) => readFileSync(new URL(`../supabase/email-templates/${f}`, import.meta.url), "utf8");

const body = {
  site_url: site,
  uri_allow_list: [`${site}/**`, "http://localhost:3000/**"].join(","),
  mailer_autoconfirm: false,
  smtp_host: need("SMTP_HOST"),
  smtp_port: need("SMTP_PORT"),
  smtp_user: need("SMTP_USER"),
  smtp_pass: need("SMTP_PASS"),
  smtp_admin_email: need("SMTP_FROM"),
  smtp_sender_name: env("SMTP_SENDER_NAME", "CareerHub AI"),
  rate_limit_email_sent: 30,
  mailer_subjects_confirmation: "Confirm your CareerHub account",
  mailer_templates_confirmation_content: read("confirmation.html"),
  mailer_subjects_recovery: "Reset your CareerHub password",
  mailer_templates_recovery_content: read("recovery.html"),
};

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
console.log("PATCH", res.status);
if (!res.ok) {
  console.log((await res.text()).slice(0, 300));
  process.exit(1);
}
const cfg = await (await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, { headers: { Authorization: `Bearer ${token}` } })).json();
console.log({
  site_url: cfg.site_url,
  uri_allow_list: cfg.uri_allow_list,
  mailer_autoconfirm: cfg.mailer_autoconfirm,
  smtp_host: cfg.smtp_host,
  smtp_admin_email: cfg.smtp_admin_email,
  confirmation_template_uses_token_hash: String(cfg.mailer_templates_confirmation_content).includes("token_hash"),
  recovery_template_uses_token_hash: String(cfg.mailer_templates_recovery_content).includes("token_hash"),
});
