<p align="center"><img src="public/brand/careerhub-logo.svg" alt="CareerHub AI logo" width="96" height="96"></p>

# CareerHub AI

An AI-assisted career workspace for students and early-career professionals. Track every application, capture job postings, get evidence-based feedback on a resume or cover letter, and keep contacts, interviews, tasks and documents in one connected place.

The AI only **suggests**. It cites the parts of your own record or document it relied on, and nothing is saved, sent or changed without you approving it.

- Live app: <https://careerhub-woad.vercel.app>
- Product vision and long-term spec: [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md)
- Build plan and decisions: [docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md)
- Running it in production: [docs/OPERATIONS.md](docs/OPERATIONS.md)

## What works today

| Area | What you can do |
| --- | --- |
| **Applications** | Kanban board (drag between stages) and sortable table with bulk move, archive and delete, detail page, append-only timeline. |
| **Action Center** | One list of what needs attention across every application (overdue tasks, close deadlines, interviews to prepare for, debriefs, quiet follow-ups), each with the dates behind it. Add as a task, snooze or dismiss. |
| **Tasks and calendar** | Tasks with timezone-safe due dates and snooze. A calendar of interviews, task due dates and deadlines, with overlap detection. |
| **Contacts and referrals** | Contacts linked to applications with a referral status per application. |
| **Interviews and prep** | Rounds per application with prep notes and a debrief. AI practice questions tied to the job and your real experience, and feedback on your written answers that flags claims you can't back up. |
| **Job Capture** | Paste a posting or a link. AI extracts the fields and requirements for you to review. Quotes are verified against the posting, uncertain fields are flagged, duplicates are warned about. |
| **Document Vault** | Versioned PDF and text uploads, text extraction you can correct, signed short-lived downloads, and a record of which exact version you submitted. |
| **Resume Studio** | Requirement-by-requirement analysis with verified quotes from your resume, an optional transparent guidance score, and edits saved as new versions. |
| **Cover Letter Studio** | Paragraph-level review, claims checked against your resume, and drafting from your resume facts only. |
| **Next step and Copilot** | One suggested next action per application with the exact record facts it used, plus a chat that answers only from that application's record and drafts messages it never sends. |
| **Evidence library** | Real projects, results and skills in your own words. Resume Studio, Cover Letter Studio and Interview Prep can cite them as proof. |
| **Offers** | Side-by-side comparison with weights you set. Pay is never estimated or converted between currencies. |
| **Career planner** | Goals, a ranking of your opportunities by your own ratings and weights (with the reasons), skill gaps from your analyses, and milestones. |
| **Analytics** | Funnel, response rate, typical wait, and source and resume breakdowns. Unknown outcomes are never counted as rejections. |
| **Data control** | JSON and CSV export, AI on/off switch, and full account deletion including stored files. |

Not built yet: Google/Outlook calendar and email sync, the browser extension, and speech-based interview practice.

## How it is built

- **Next.js 16** (App Router, server actions) and **TypeScript**, **Tailwind CSS 4**, **shadcn/ui** on Base UI.
- **Supabase** for Postgres, Auth and private file storage. Authorization is enforced by **row level security** on every table, so each user can only reach their own rows, files and results.
- **Groq** for language-model calls, made only from the server, with strict JSON-schema output that is validated and then checked against the source text before anything is shown.
- **Vercel** for hosting. Pushes to `main` deploy to production.

### The trust model for AI output

1. The model returns structured JSON, validated with Zod.
2. Every quote it gives is checked against the real posting, resume or letter. Quotes that are not there are dropped, and a "supported" claim without a real quote is downgraded.
3. Job postings, resumes and notes are treated as untrusted data and cannot give the model instructions.
4. Suggestions are labelled as suggestions. Approving one is a separate, explicit step, and it is audited.
5. Scores come from a published rubric, computed on the server, and can be turned off.

## Getting started

You need Node 22 and a Supabase project.

```bash
npm install
cp .env.example .env.local   # then fill in the values
```

Apply the SQL files in `supabase/migrations/` in order (SQL editor or `psql`). Then:

```bash
npm run dev
```

Open <http://localhost:3000>. Email confirmation is off by default and AI features need `GROQ_API_KEY` (without it, AI features show a friendly message and manual entry still works).

### Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project (safe to expose). |
| `GROQ_API_KEY` | Server only. Never put it in a `NEXT_PUBLIC_*` variable. |
| `GROQ_MODEL` | Optional. Defaults to `openai/gpt-oss-120b`, which supports strict JSON-schema output. |
| `AI_USER_HOURLY_LIMIT`, `AI_GLOBAL_DAILY_LIMIT` | Optional AI budgets (defaults 30 per user per hour, 3000 per day overall). |
| `NEXT_PUBLIC_OAUTH_PROVIDERS` | Comma list of social sign-in buttons to show, once each is configured: `github`, `google`, `linkedin`. See [docs/SOCIAL_SIGNIN.md](docs/SOCIAL_SIGNIN.md). |
| `NEXT_PUBLIC_EMAIL_FLOWS` | Set to `1` once SMTP works, to enable password reset links. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Optional contact shown on the privacy page. |
| `RATE_LIMIT_SALT` | Optional secret salt for hashing addresses used in rate limits. |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server. |
| `npm run typecheck`, `npm run lint` | Static checks. |
| `npm test` | Unit tests (Vitest): SSRF guard, AI trust boundaries, analytics, calendar, CSV safety, rate limits and more. |
| `npm run test:e2e` | Browser tests (Playwright) on desktop and phone sizes, including accessibility scans. Build first. |
| `npm run ci` | Everything CI runs. |

CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests, a production build and the browser tests on every push and pull request.

## Security at a glance

- Row level security on every table, least-privilege grants, and a private storage bucket scoped per user.
- Nonce-based Content Security Policy and standard security headers on every response.
- The link importer blocks private, loopback and metadata addresses, validates every redirect hop, and checks addresses at connect time to defeat DNS rebinding.
- Uploads are re-verified on the server (ownership, size, real file type), with page and time limits on PDF parsing.
- Per-user AI allowance and an app-wide daily AI cap, plus rate limits on sign-in, signup and resets, a honeypot on signup, and database-enforced caps on rows and storage per account.
- No analytics or advertising trackers. Logs never contain resume, job or note text.

Found a security issue? Please report it privately to the maintainer rather than opening a public issue.

## Project layout

```
src/app/(app)/      signed-in pages and their server actions
src/app/(auth)/     login, signup, password flows
src/app/(legal)/    privacy and terms
src/lib/ai/         Groq client, prompts, and the checks applied to model output
src/lib/supabase/   server, browser and proxy clients
supabase/migrations ordered SQL migrations (schema, policies, limits)
tests/unit          Vitest
tests/e2e           Playwright
```
