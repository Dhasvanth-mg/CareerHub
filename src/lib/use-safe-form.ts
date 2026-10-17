"use client";

import { useActionState, useTransition, type FormEvent } from "react";

/**
 * Like `<form action={fn}>`, but React doesn't reset the fields afterwards.
 * React 19 clears uncontrolled inputs after every form action, which would wipe what the user
 * typed whenever validation fails. Submitting through a transition keeps their input.
 */
export function useSafeForm<S>(action: (prev: Awaited<S>, formData: FormData) => Promise<S>, initial?: Awaited<S>) {
  const [state, dispatch, actionPending] = useActionState<S, FormData>(action, initial as Awaited<S>);
  const [transitionPending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(e.currentTarget, submitter);
    startTransition(() => dispatch(formData));
  }

  return { state: state as Awaited<S>, onSubmit, pending: actionPending || transitionPending };
}
