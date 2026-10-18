import Link from "next/link";
import { ApplicationImport } from "@/components/app/application-import";

export const metadata = { title: "Import applications | CareerHub AI" };

export default function ImportApplicationsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <Link href="/applications" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Applications
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Import applications</h1>
        <p className="text-sm text-muted-foreground">
          Bring in a tracker you already keep in Excel, Google Sheets or Notion. Export it as CSV, choose the file, check that the columns
          line up, and import the rows you want. Applications already in your tracker are skipped.
        </p>
      </div>
      <ApplicationImport />
    </div>
  );
}
