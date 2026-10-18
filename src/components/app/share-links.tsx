"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { createShareLink } from "@/app/(app)/settings/share-actions";
import { Field } from "@/components/app/field";
import { SubmitButton } from "@/components/app/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DEFAULT_EXPIRY_DAYS, EXPIRY_DAYS } from "@/lib/share";
import { useOnComplete, useSafeForm } from "@/lib/use-safe-form";

/** Creates a link and shows it once. The secret is not stored, so it can't be shown again. */
export function ShareLinkForm() {
  const form = useSafeForm(createShareLink);
  const { state, onSubmit, pending } = form;
  const formRef = useRef<HTMLFormElement>(null);
  const [created, setCreated] = useState<string>("");

  useOnComplete(form, () => {
    if (state?.url) {
      setCreated(state.url);
      formRef.current?.reset();
    }
  });

  async function copy() {
    try {
      await navigator.clipboard.writeText(created);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it by hand.");
    }
  }

  return (
    <div className="space-y-4">
      <form ref={formRef} method="post" onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Who is it for?" htmlFor="share-label" hint="Only you see this name.">
          <Input id="share-label" name="label" required maxLength={80} placeholder="Career advisor, Dr. Patel" />
        </Field>
        <Field label="Works for" htmlFor="share-days">
          <NativeSelect id="share-days" name="days" defaultValue={String(DEFAULT_EXPIRY_DAYS)}>
            {EXPIRY_DAYS.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </NativeSelect>
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="include_interviews" className="size-4 accent-primary" />
          Also show upcoming interview dates (company, round and date only)
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <SubmitButton pending={pending} pendingText="Creating…">
            Create link
          </SubmitButton>
          {state?.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
        </div>
      </form>

      {created ? (
        <div role="status" className="space-y-2 rounded-lg border border-green-600/40 bg-green-50 p-3 text-sm dark:bg-green-950/40">
          <p className="font-medium">Your link is ready. Copy it now: it can&apos;t be shown again.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input readOnly value={created} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1" />
            <Button type="button" variant="outline" onClick={copy}>
              Copy
            </Button>
          </div>
          <p className="text-muted-foreground">Anyone who has this link can see the summary until it expires or you turn it off.</p>
        </div>
      ) : null}
    </div>
  );
}
