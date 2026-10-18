# Operations guide

How to run, change and recover CareerHub AI in production.

## Where things live

| Thing | Where |
| --- | --- |
| App hosting | Vercel project `careerhub`, production domain `careerhub-woad.vercel.app`. Connected to the GitHub repo, so a push to `main` deploys. |
| Database, auth, files | Supabase project `yvbyanbixchjeztglpve` (us-east-1). |
| AI | Groq. The key lives only in Vercel's environment variables and `.env.local`. |
| Logs | Vercel project logs. Server errors are one JSON line each (error name, digest, route, method). They never contain request bodies or document text. |
| Health | `GET /api/health` returns 200 when the app and database answer, 503 otherwise. Point an uptime monitor at it. |

## Deploying

1. Make sure `npm run ci` passes locally (CI runs the same on GitHub).
2. Push to `main`. Vercel builds and promotes it.
3. If a deploy is bad, promote the previous deployment from the Vercel dashboard (or `vercel rollback`). Database migrations are not rolled back by this, so keep them backward compatible.

## Database changes

- Add a new numbered file in `supabase/migrations/` and apply it to the Supabase project. Do not edit migrations that have already been applied.
- Every new table needs row level security and policies in the same migration. Tables only touched by security-definer functions should have RLS on and no policies.
- After a schema change, rerun the isolation checks: a second user must not be able to read, change or link to the first user's rows.

## Secrets and rotation

| Secret | Where to rotate |
| --- | --- |
| Groq API key | console.groq.com, then update `GROQ_API_KEY` in Vercel (production) and redeploy. |
| Supabase database password | Supabase dashboard, Project Settings, Database. |
| Supabase access tokens | supabase.com/dashboard/account/tokens. Revoke any token after using it. |
| Vercel tokens | Vercel account settings. |

Never paste secrets into chats or commit them. `.env*` files are git-ignored.

## Cost and abuse controls

- `AI_USER_HOURLY_LIMIT` (default 30) and `AI_GLOBAL_DAILY_LIMIT` (default 3000) cap AI use. When the global cap is hit, AI features pause for everyone until the rolling 24 hours clear. Raise or lower them in Vercel and redeploy.
- Sign-in, signup, reset and resend attempts are rate limited per address and per email. A hidden honeypot field on signup quietly ignores bots.
- The database caps rows per account (applications 2000, contacts 2000, tasks 5000, documents 200, versions 1000, postings 1000, analyses 2000, interviews 1000) and total document storage (100 MB).
- Uploads are limited to 10 MB, PDF or plain text, and PDFs over 80 pages are refused.

## Known gaps and decisions

- **Email confirmation is off.** Anyone can sign up with an address they do not own. Turning it on needs SMTP: run `scripts/apply-auth-config.mjs` with SMTP settings and a Supabase access token, then set `NEXT_PUBLIC_EMAIL_FLOWS=1`. Password reset is hidden until then.
- **Google sign-in is off** until OAuth credentials are configured.
- **Files uploaded but never saved** (an upload that fails after the file reaches storage) are not swept automatically yet.
- **No point-in-time database backups** on the free Supabase plan. Users can export their own data; consider a scheduled export or a paid plan before relying on it.

## Incident checklist

1. Check `/api/health` and the Vercel logs for the failing route (look for the error digest).
2. If a bad deploy: roll back in Vercel.
3. If AI is misbehaving or costing too much: lower `AI_GLOBAL_DAILY_LIMIT`, or remove `GROQ_API_KEY` (AI features then show a friendly message and manual entry keeps working).
4. If a secret leaked: rotate it (table above), then review recent logs.
