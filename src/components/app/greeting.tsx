"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function greetingFor(hour: number) {
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** Greets by the viewer's own clock. The server render uses a neutral line so there is no flash of the wrong time of day. */
export function Greeting({ name }: { name?: string | null }) {
  const text = useSyncExternalStore(
    subscribe,
    () => greetingFor(new Date().getHours()),
    () => "Welcome back",
  );
  return (
    <>
      {text}
      {name ? `, ${name}` : ""}.
    </>
  );
}
