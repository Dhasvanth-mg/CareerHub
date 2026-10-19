import Link from "next/link";
import { ApplicationForm } from "@/components/app/application-form";
import { createApplication } from "../actions";

export const metadata = { title: "Add application | CareerHub AI" };

export default function NewApplicationPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/applications" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Applications
        </Link>
        <h1 className="mt-2 text-3xl sm:text-4xl">Add application</h1>
        <p className="text-sm text-muted-foreground">Only company and role are required. You can fill in the rest later.</p>
      </div>
      <ApplicationForm action={createApplication} submitLabel="Create application" />
    </div>
  );
}
