import { JobCapture } from "@/components/app/job-capture";

export const metadata = { title: "Job Capture | CareerHub AI" };

export default function JobsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job Capture</h1>
        <p className="text-sm text-muted-foreground">
          Paste a posting or give us a link. We pull out the details and requirements for you to review. The AI only suggests; nothing
          is saved to your tracker until you confirm.
        </p>
      </div>
      <JobCapture />
    </div>
  );
}
