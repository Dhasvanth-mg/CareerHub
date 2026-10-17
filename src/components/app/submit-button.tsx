"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Pass `pending` when the form is submitted through `useSafeForm`; otherwise the form status is used. */
export function SubmitButton({
  children,
  pendingText = "Saving…",
  pending: pendingProp,
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
