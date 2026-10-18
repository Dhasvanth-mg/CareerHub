export const metadata = { title: "Privacy | CareerHub AI" };

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default function PrivacyPage() {
  return (
    <>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy</h1>
        <p className="text-sm text-muted-foreground">Last updated October 17, 2026</p>
      </div>

      <p>
        CareerHub AI is an early-stage app for tracking job applications. This page explains, in plain language, what it stores, who
        it shares that with, and how you can get your data back or remove it.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>Your account: email address, display name, and a password hash managed by our authentication provider.</li>
        <li>
          What you enter: applications, notes, tasks, contacts, referral and interview details, saved job postings, and the documents
          you upload (such as resumes and cover letters) along with the text extracted from them.
        </li>
        <li>Results of AI features you run (extracted job details, resume and cover-letter feedback, suggestions) and which ones you approved.</li>
        <li>
          Technical data needed to run and protect the service: sign-in cookies, and a one-way hash of your network address (never the
          address itself) used to limit repeated sign-in and signup attempts.
        </li>
      </ul>
      <p>We do not use advertising or analytics trackers. The only cookies are the ones that keep you signed in.</p>

      <h2>AI features and Groq</h2>
      <p>
        When you choose to use an AI feature, the text it needs is sent to <strong>Groq</strong>, which runs the language model. That
        can be the text of a job posting, your resume or cover letter (which may include your name and contact details), the job&apos;s
        requirements, or a short summary of one application record. Nothing is sent to Groq until you accept the AI notice, and you
        can turn AI features off again in Settings. See Groq&apos;s own terms and privacy policy for how they handle data on their side.
      </p>
      <p>
        AI output can be wrong. The app shows where its suggestions come from and never sends, submits or changes anything on your
        behalf without you approving it.
      </p>

      <h2>Who else handles your data</h2>
      <ul>
        <li>Supabase: database, file storage and sign-in.</li>
        <li>Vercel: hosting.</li>
        <li>Groq: AI processing, only when you use an AI feature.</li>
      </ul>
      <p>We don&apos;t sell your data or share it for marketing.</p>

      <h2>Keeping it safe</h2>
      <p>
        Data is encrypted in transit. Every record belongs to your account and is protected so other accounts cannot read it, and your
        files are in a private store with short-lived download links. No system is perfectly secure, so avoid uploading anything you
        wouldn&apos;t be comfortable having on a cloud service.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Download everything we hold about you from Settings (JSON for all data, CSV for applications).</li>
        <li>Delete your account from Settings. This permanently removes your records and uploaded files.</li>
        <li>Turn AI features on or off at any time in Settings.</li>
      </ul>
      <p>
        Data stays until you delete it. Deleted accounts are removed from our database and file storage straight away; copies may
        persist in provider backups for a short time.
      </p>

      <h2>Children</h2>
      <p>CareerHub AI isn&apos;t directed at children under 13, and you should not use it if you are younger than that.</p>

      <h2>Changes and contact</h2>
      <p>
        We&apos;ll update this page and its date when something changes.{" "}
        {CONTACT ? (
          <>
            Questions or requests: <a href={`mailto:${CONTACT}`} className="underline underline-offset-4">{CONTACT}</a>.
          </>
        ) : (
          "For questions or requests, contact whoever invited you to this app."
        )}
      </p>
    </>
  );
}
