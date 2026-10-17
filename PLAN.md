# CareerHub AI: 24-hour launch plan (+ 24h hardening)

The README describes 16 modules, a FastAPI + Redis + S3 stack and 5 roadmap phases. That is weeks of work. Nothing is built yet (the repo holds only the README). To go live in 24 hours we ship a **vertical slice of Phases 1 and 2**, on a stack that removes infrastructure work, and defer the rest.

## 1. Decisions locked (override now or never)

| README says | We do | Why |
| --- | --- | --- |
| FastAPI + SQLAlchemy + Alembic | **Next.js route handlers / server actions** + Supabase SQL migrations | One repo, one language, one deploy. Saves ~4h of glue. |
| Clerk **or** Supabase Auth | **Supabase Auth** (email + Google) | Same vendor as DB and storage, and RLS gives per-user authorization for free. |
| PostgreSQL | **Supabase Postgres** with RLS on every table | |
| S3-compatible storage | **Supabase Storage**, private bucket, signed URLs | |
| Redis + worker | **None.** Analysis runs synchronously in a route handler (`maxDuration` 60s), UI shows progress. | Resume analysis fits in one Groq call. |
| PyMuPDF | `unpdf` (pdf.js) in Node | Same job without a Python service. |
| Groq | Groq, server-side only, JSON-schema output validated with Zod | Per README. Verify model id at build time. |
| Hosting | **Vercel** (frontend + API) | |

Tradeoff: this departs from the README stack. If the FastAPI backend matters for the course or the portfolio, say so now. It adds ~6-8h and the 24h target is then at risk.

## 2. Scope

### MUST ship in 24h (the "it works end to end" slice)
1. **Auth and shell**: sign up and login, protected routes, sidebar nav, responsive layout.
2. **Application tracker** (3.2): CRUD, Kanban with drag between stages, table view with search and filter, detail page, archive, activity timeline (auto-written on create and stage change).
3. **Tasks and reminders** (3.4 and 3.9 lite): tasks linked to applications, due dates, overdue and due-soon list. In-app only, no external calendar.
4. **Contacts and referrals** (3.8 lite): contact CRUD, link to applications, referral status.
5. **Job Capture** (3.7): paste text or URL, Groq extracts company, role, location, requirements (must vs preferred), deadline. Editable before saving. URL fetch has an SSRF guard, and a failed fetch falls back to paste.
6. **Resume Studio** (3.5): PDF upload, show extracted text, run analysis against a saved job. Requirement-to-evidence table (`supported` / `unclear` / `not_evidenced` with quoted evidence). Optional rubric score with a visible breakdown. Saved as a versioned `analysis_run`.
7. **Document Vault** (3.13 lite): upload resumes and cover letters, versions, link the submitted version to an application.
8. **Dashboard** (3.1): summary cards, upcoming tasks, recent activity, status breakdown.
9. **AI next-action** on the application detail page, with the source record fields shown. This also matches the ETI 200 hypothesis in README section 15.
10. **Trust and safety basics**: RLS on all tables, `GROQ_API_KEY` server-only, upload size and type limits, untrusted-input prompt framing, no AI auto-actions (suggestions only), basic rate limit on AI routes, Groq-down error state with retry.
11. **Data export** (CSV and JSON) and account deletion. README acceptance tests require both.

### SHOULD ship in the next 24h (fast follow)
- Cover Letter Studio (reuses the Resume Studio pipeline)
- Application Copilot chat panel (per-application context)
- Internal calendar view
- Duplicate detection, bulk operations
- Evidence library
- Funnel analytics
- Playwright smoke tests and an accessibility pass

### CUT (not in this release)
Google/Microsoft calendar and Gmail/Outlook sync, browser extension, offer comparison, career planner, interview prep (stretch if time remains), speech practice, malware scanning (mitigate with type and size limits plus private bucket), Redis queue.

Be honest in the UI and on the landing page: cut modules are not shown in the nav. The README's own rule is that nothing should look done that isn't.

## 3. Schema (one migration)

`profiles`, `companies`, `job_postings`, `applications`, `application_events`, `tasks`, `contacts`, `application_contacts`, `referrals`, `documents`, `document_versions`, `job_requirements`, `analysis_runs`, `analysis_findings`, `ai_proposals`, `audit_events`.

Every table has `user_id` with an RLS policy `user_id = auth.uid()`. Storage policies are scoped to `{user_id}/` path prefixes. Timestamps are `timestamptz` (UTC). The deferred tables (`calendar_events`, `offers`, `interview_rounds`, `integration_accounts`, `notifications`, `copilot_sessions`, `experience_evidence`) are added later.

## 4. Hour-by-hour (24h)

| Hours | Work | Done when |
| --- | --- | --- |
| 0-1 | Scaffold Next.js + TS + Tailwind + shadcn. Create the Supabase project, env vars, Vercel project linked to the repo. Deploy an empty app. | A live URL exists and deploys on push |
| 1-3 | Migration (schema + RLS + storage policies). Auth pages, middleware, app shell and nav. | Sign up, log in and see an empty dashboard on production |
| 3-8 | Applications: CRUD, table, Kanban, detail page, timeline events, tasks, archive. Contacts and referrals. | Create an application, drag it to a new stage, see the timeline, refresh and it persists |
| 8-12 | Groq client, shared structured-output helper (Zod), prompt-injection framing. Job Capture (paste and URL). Job to application flow. | Paste a posting, edit the extraction, save it as an application |
| 12-17 | Document upload and PDF extraction. Resume Studio: analysis, findings table, score breakdown, versions. | Upload a PDF, run analysis, get evidence-linked findings saved against the application |
| 17-19 | Dashboard, AI next-action panel, export, account deletion. | Dashboard numbers match the data. Export downloads. |
| 19-22 | QA and hardening: cross-user access test, Groq-down path, bad PDF, blocked URL, mobile layout, empty and error states, keyboard and focus pass. | The README acceptance table rows for the MUST scope pass |
| 22-24 | Production env check, seed a demo account, smoke test on the prod URL, monitor logs, tag the release. | Live, with a rollback ready (Vercel promote) |

Rule: if a block overruns by 1h, cut from the bottom of MUST (export, then the next-action panel). Never cut RLS or the cross-user test.

## 5. Parallel lanes (optional)

After hour 3 the work splits cleanly if you want to use several Claude sessions. Each lane touches different files.
- **Lane A:** tracker, tasks, contacts (UI and server actions).
- **Lane B:** `lib/ai/*`, job capture, resume analysis (Groq, Zod, prompts).
- **Lane C:** documents, storage, PDF extraction, then export and delete.

Lane B and C depend only on the schema from hour 1-3, so the schema must be final before the lanes split.

## 6. Risks

| Risk | Mitigation |
| --- | --- |
| Groq model or JSON-mode behaviour differs from expectation | Validate output with Zod and retry once. On failure show an editable manual form. Check the model id against the Groq docs at hour 8. |
| Vercel function timeout on long analyses | Cap input text, set `maxDuration = 60`, use a smaller model for extraction. |
| Scanned PDFs return no text | Detect empty extraction, show a warning, offer paste-text fallback (README acceptance row). |
| Job sites block URL fetch | Expected. Paste fallback is a first-class path. |
| RLS mistake leaks data | Dedicated two-user test before launch. Run the Supabase security advisors. |
| Scope creep | The CUT list is final for this release. |
| Privacy disclosure | Add a short "what is sent to Groq" notice at first AI use (README section 12). Review Groq retention terms before inviting real users. |

## 7. Needed from you before hour 0

1. Confirm the stack deviation (Next.js + Supabase, no FastAPI).
2. A Groq API key, a Supabase project (or permission to create one) and a Vercel account or team to deploy to.
3. Whether "live" means real public signups or an invite-only/demo launch. This changes how strict the rate limits and the privacy notice need to be.
4. Whether the ETI 200 Sprint 4 prototype is the same deadline. It needs separate non-code deliverables (personas, spec, reflection, APA citations), and only you can supply the assigned readings.
