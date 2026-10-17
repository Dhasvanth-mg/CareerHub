"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Renders a UTC instant in the viewer's own time zone (server renders a stable UTC fallback). */
export function LocalTime({ iso, dateOnly = false }: { iso: string; dateOnly?: boolean }) {
  const text = useSyncExternalStore(
    subscribe,
    () =>
      new Date(iso).toLocaleString(undefined, dateOnly ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" }),
    () => new Date(iso).toISOString().slice(0, dateOnly ? 10 : 16).replace("T", " ") + (dateOnly ? "" : " UTC"),
  );
  return <time dateTime={iso}>{text}</time>;
}
