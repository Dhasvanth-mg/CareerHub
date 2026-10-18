# Social sign-in (GitHub, Google, LinkedIn)

People can sign in with a provider instead of an email and password. The provider has already verified their email, so there is
nothing to confirm and no password to reset. No email sending is involved.

A provider's button appears on the login and signup pages only after you list it in `NEXT_PUBLIC_OAUTH_PROVIDERS`, so nobody ever sees
a button that doesn't work. Set that variable last, once the provider is configured.

**Values you will need in every provider's console**

| Field | Value |
| --- | --- |
| Site / homepage URL | `https://careerhub-woad.vercel.app` |
| Redirect / callback URL | `https://yvbyanbixchjeztglpve.supabase.co/auth/v1/callback` (this is Supabase's address, not the app's) |

## GitHub (about 5 minutes)

1. Go to <https://github.com/settings/developers>, **OAuth Apps**, **New OAuth App**.
2. Application name `CareerHub AI`. Set the homepage URL and callback URL from the table above.
3. Register the app, then **Generate a new client secret**. Copy the client ID and the secret (shown once).

## Google (about 15 minutes)

1. In <https://console.cloud.google.com>, open **APIs & Services, OAuth consent screen**. Choose **External**, fill in the app name and a
   support email, keep only the default scopes (email, profile, openid), and save.
2. Click **Publish app**. While it is in "Testing", only people you list can sign in. The basic scopes don't need Google's review.
3. Open **Credentials, Create credentials, OAuth client ID, Web application**.
   - Authorized JavaScript origin: the site URL.
   - Authorized redirect URI: the Supabase callback URL.
4. Copy the client ID and the client secret.

## LinkedIn (about 15 minutes)

1. At <https://www.linkedin.com/developers/apps> choose **Create app**. LinkedIn requires the app to be tied to a LinkedIn Page. If you
   don't have one, create a simple Page for CareerHub first.
2. On the **Products** tab, request **Sign In with LinkedIn using OpenID Connect**. It is approved immediately.
3. On the **Auth** tab, add the Supabase callback URL under **Authorized redirect URLs**.
4. Copy the **Client ID** and the **Primary Client Secret**.

## Turn each provider on

Run this once per provider from the project folder. The secrets stay in your terminal session.

```powershell
$env:SUPABASE_ACCESS_TOKEN='sbp_...'; $env:PROVIDER='github'; $env:CLIENT_ID='...'; $env:CLIENT_SECRET='...'; node scripts/enable-provider.mjs
```

Use `PROVIDER` values `github`, `google` or `linkedin`. Revoke the access token afterwards at
<https://supabase.com/dashboard/account/tokens>. (You can instead paste the ID and secret under Authentication, Providers in the Supabase
dashboard.)

Then show the buttons: in Vercel, set `NEXT_PUBLIC_OAUTH_PROVIDERS` to the providers you configured, for example
`github,google,linkedin`, and redeploy (push a commit, or run `vercel deploy --prod`).

## Good to know

- **Account linking:** if someone signs in with a provider using an email that already has an account, Supabase links them to the same
  account. This is safe because these providers only return emails they have verified.
- **Names:** the display name comes from the provider profile. People can change it in Settings.
- **If a provider breaks:** remove it from `NEXT_PUBLIC_OAUTH_PROVIDERS` and redeploy. Its button disappears and email sign-in is unaffected.
- **Deleting an account** removes the app's data. The provider account itself is untouched.
