"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";

/**
 * Like `<form action={fn}>`, but React doesn't reset the fields afterwards.
 * React 19 clears uncontrolled inputs after every form action, which would wipe what the user
 * typed whenever validation fails. Submitting through a transition keeps their input.
 *
 * `completions` increases by one every time a submit finishes, whether or not the action returned
 * anything. Actions that succeed return `undefined`, which is indistinguishable from "nothing has
 * happened yet", so effects should key off `completions` rather than comparing `state`.
 */
export function useSafeForm<S>(action: (prev: Awaited<S>, formData: FormData) => Promise<S>, initial?: Awaited<S>) {
  const [state, dispatch, actionPending] = useActionState<S, FormData>(action, initial as Awaited<S>);
  const [transitionPending, startTransition] = useTransition();
  const pending = actionPending || transitionPending;

  // Count the pending -> idle edge. Adjusting state during render is the supported way to derive this.
  const [wasPending, setWasPending] = useState(false);
  const [completions, setCompletions] = useState(0);
  if (wasPending !== pending) {
    setWasPending(pending);
    if (wasPending && !pending) setCompletions((n) => n + 1);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }

  return { state: state as Awaited<S>, onSubmit, pending, completions };
}

/** Runs `callback` once each time a `useSafeForm` submit finishes. The callback decides what success means. */
export function useOnComplete(form: { completions: number }, callback: () => void) {
  const last = useRef(0);
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });
  useEffect(() => {
    if (form.completions === last.current) return;
    last.current = form.completions;
    latest.current();
  }, [form.completions]);
}
