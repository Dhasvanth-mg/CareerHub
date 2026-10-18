// Turns on a social sign-in provider in Supabase Auth, taking secrets from the environment so they never
// land in shell history, chat or the repo.
//
//   SUPABASE_ACCESS_TOKEN   personal access token (revoke it afterwards)
//   PROVIDER                github | google | linkedin
//   CLIENT_ID, CLIENT_SECRET   from the provider's developer console
//
// PowerShell example:
//   $env:SUPABASE_ACCESS_TOKEN='sbp_...'; $env:PROVIDER='github'; $env:CLIENT_ID='...'; $env:CLIENT_SECRET='...'; node scripts/enable-provider.mjs

const ref = "yvbyanbixchjeztglpve";
const KEYS = { github: "github", google: "google", linkedin: "linkedin_oidc" };

const need = (k) => {
  if (!process.env[k]) throw new Error(`Missing ${k}`);
  return process.env[k];
};

const provider = need("PROVIDER").toLowerCase();
const key = KEYS[provider];
if (!key) throw new Error(`PROVIDER must be one of: ${Object.keys(KEYS).join(", ")}`);
const token = need("SUPABASE_ACCESS_TOKEN");

const body = {
  [`external_${key}_enabled`]: true,
  [`external_${key}_client_id`]: need("CLIENT_ID"),
  [`external_${key}_secret`]: need("CLIENT_SECRET"),
};

const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const res = await fetch(url, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
console.log("PATCH", res.status);
if (!res.ok) {
  console.log((await res.text()).slice(0, 300));
  process.exit(1);
}
const cfg = await (await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).json();
console.log({
  provider,
  enabled: cfg[`external_${key}_enabled`],
  client_id_set: Boolean(cfg[`external_${key}_client_id`]),
  redirect_uri_to_register: `https://${ref}.supabase.co/auth/v1/callback`,
});
console.log(`Next: add "${provider}" to NEXT_PUBLIC_OAUTH_PROVIDERS in Vercel and redeploy to show its button.`);
