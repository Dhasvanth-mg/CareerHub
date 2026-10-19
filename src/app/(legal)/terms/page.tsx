export const metadata = { title: "Terms | CareerHub AI" };

export default function TermsPage() {
  return (
    <>
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl">Terms of use</h1>
        <p className="text-sm text-muted-foreground">Last updated October 17, 2026</p>
      </div>

      <p>
        CareerHub AI is an early-stage tool to help you organize a job search. By creating an account you agree to these terms. If you
        don&apos;t agree, please don&apos;t use it.
      </p>

      <h2>Your account and content</h2>
      <ul>
        <li>You are responsible for your account and for keeping your password safe.</li>
        <li>What you put in the app stays yours. We only use it to provide the features you ask for.</li>
        <li>Only add information you have the right to store. Don&apos;t upload other people&apos;s private documents.</li>
      </ul>

      <h2>AI features</h2>
      <ul>
        <li>AI suggestions can be incomplete or wrong. Check them against the real job posting and your own records.</li>
        <li>
          You are responsible for what you send to employers. Don&apos;t claim experience, skills or credentials you don&apos;t have,
          whatever a suggestion says.
        </li>
        <li>Scores are guidance to help you decide what to improve. They are not employer scores or hiring predictions.</li>
        <li>The app never submits applications or sends messages for you.</li>
      </ul>

      <h2>Acceptable use</h2>
      <ul>
        <li>Don&apos;t try to break, overload or get around the limits of the service, or access other people&apos;s data.</li>
        <li>Don&apos;t use automated tools to create accounts or call the service in bulk.</li>
        <li>Don&apos;t import links to places you aren&apos;t allowed to access.</li>
      </ul>
      <p>We can limit or suspend accounts that abuse the service.</p>

      <h2>Limits and availability</h2>
      <p>
        Accounts have limits on stored items, document storage and AI use, and some features may pause when AI capacity is reached.
        The service is provided as is, without warranties, and it may change or be unavailable at times. Keep your own copies of
        anything important. You can export your data at any time from Settings.
      </p>

      <h2>Ending your use</h2>
      <p>You can delete your account in Settings at any time, which permanently removes your data. See the privacy page for details.</p>

      <h2>Changes</h2>
      <p>If these terms change in a meaningful way, we&apos;ll update this page and its date.</p>
    </>
  );
}
