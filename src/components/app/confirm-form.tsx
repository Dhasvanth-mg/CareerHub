"use client";

import { Button } from "@/components/ui/button";

/** A one-button form that asks for confirmation before running a (usually destructive) server action. */
export function ConfirmForm({
  action,
  message,
  children,
  variant = "outline",
}: {
  action: () => Promise<void>;
  message: string;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      <Button type="submit" variant={variant}>
        {children}
      </Button>
    </form>
  );
}
