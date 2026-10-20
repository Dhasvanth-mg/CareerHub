"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { savePracticeAnswer } from "@/app/(app)/applications/[id]/prep/practice/actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export type PracticeQuestion = { id: string; question: string; category: string; hasDraft: boolean };
type Result = { id: string; question: string; answer: string; usedSeconds: number; timedOut: boolean; saved: boolean };

const SECONDS = [60, 90, 120, 180, 300];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

function shuffled<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function PracticeSession({ questions, backHref }: { questions: PracticeQuestion[]; backHref: string }) {
  const [phase, setPhase] = useState<"setup" | "run" | "done">("setup");
  const [seconds, setSeconds] = useState(120);
  const [count, setCount] = useState(Math.min(5, questions.length));
  const [shuffle, setShuffle] = useState(true);

  const [order, setOrder] = useState<PracticeQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [saving, setSaving] = useState(false);
  const [announce, setAnnounce] = useState("");

  const deadline = useRef(0);
  const finishing = useRef(false);
  const answerRef = useRef("");
  const textRef = useRef<HTMLTextAreaElement>(null);

  const current = order[index];

  function start() {
    const pool = shuffle ? shuffled(questions) : questions;
    setOrder(pool.slice(0, Math.max(1, Math.min(count, pool.length))));
    setIndex(0);
    setResults([]);
    beginQuestion();
    setPhase("run");
  }

  function beginQuestion() {
    finishing.current = false;
    answerRef.current = "";
    setAnswer("");
    setRemaining(seconds);
    deadline.current = Date.now() + seconds * 1000;
    setAnnounce("");
  }

  const finish = useCallback(
    async (timedOut: boolean) => {
      if (finishing.current || !current) return;
      finishing.current = true;
      const text = answerRef.current;
      const used = Math.min(seconds, Math.max(0, Math.round(seconds - (deadline.current - Date.now()) / 1000)));
      setSaving(true);
      let saved = false;
      try {
        saved = (await savePracticeAnswer(current.id, text)).ok;
      } catch {
        saved = false;
      }
      setSaving(false);
      setResults((r) => [...r, { id: current.id, question: current.question, answer: text, usedSeconds: timedOut ? seconds : used, timedOut, saved }]);
      if (index + 1 >= order.length) {
        setPhase("done");
      } else {
        setIndex((i) => i + 1);
        beginQuestion();
      }
    },
    // beginQuestion reads only refs and `seconds`; listing it would re-create the callback every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, index, order.length, seconds],
  );

  // Countdown from a fixed deadline, so a throttled background tab can't stretch the time.
  useEffect(() => {
    if (phase !== "run") return;
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 30) setAnnounce("30 seconds left");
      if (left === 10) setAnnounce("10 seconds left");
      if (left === 0) {
        setAnnounce("Time is up");
        void finish(true);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [phase, finish]);

  useEffect(() => {
    if (phase === "run") textRef.current?.focus();
  }, [phase, index]);

  if (questions.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        There are no practice questions here yet.{" "}
        <Link href={backHref} className="underline underline-offset-4">
          Generate some first
        </Link>
        .
      </p>
    );
  }

  if (phase === "setup") {
    return (
      <section aria-labelledby="setup" className="space-y-4 rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] p-4">
        <h2 id="setup" className="font-medium">
          Set up your session
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label htmlFor="p-count" className="text-sm font-medium">
              Questions
            </label>
            <NativeSelect id="p-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {Array.from(new Set([1, 3, 5, 8, questions.length].filter((n) => n <= questions.length))).sort((a, b) => a - b).map((n) => (
                <option key={n} value={n}>
                  {n === questions.length ? `All ${n}` : n}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <label htmlFor="p-time" className="text-sm font-medium">
              Time per answer
            </label>
            <NativeSelect id="p-time" value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
              {SECONDS.map((s) => (
                <option key={s} value={s}>
                  {fmt(s)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <label className="flex items-end gap-2 pb-1.5 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
            Shuffle the order
          </label>
        </div>
        {questions.some((q) => q.hasDraft) ? (
          <p className="text-sm text-muted-foreground">
            Some questions already have a saved answer. A new answer from this session replaces it. Blank answers never do.
          </p>
        ) : null}
        <Button type="button" onClick={start}>
          Start
        </Button>
      </section>
    );
  }

  if (phase === "done") {
    const answered = results.filter((r) => r.answer.trim()).length;
    return (
      <section aria-labelledby="done" className="space-y-4">
        <h2 id="done" className="text-xl">
          Session complete
        </h2>
        <p className="text-sm text-muted-foreground">
          You answered {answered} of {results.length}. Answers are saved to your prep notes, so you can ask for feedback on each one there.
        </p>
        {results.some((r) => r.answer.trim() && !r.saved) ? (
          <p role="alert" className="text-sm text-destructive">
            Some answers couldn&apos;t be saved. Copy them from below before leaving this page.
          </p>
        ) : null}
        <ol className="space-y-3">
          {results.map((r) => (
            <li key={r.id} className="space-y-1 rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06] p-3 text-sm">
              <p className="font-medium">{r.question}</p>
              <p className="text-xs text-muted-foreground">
                {r.answer.trim() ? `${words(r.answer)} words` : "No answer"} · {fmt(r.usedSeconds)} of {fmt(seconds)}
                {r.timedOut ? " · time ran out" : ""}
              </p>
              {r.answer.trim() ? <p className="whitespace-pre-wrap">{r.answer}</p> : null}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setPhase("setup")}>
            Practice again
          </Button>
          <Button nativeButton={false} render={<Link href={backHref} />}>
            Review and get feedback
          </Button>
        </div>
      </section>
    );
  }

  const urgent = remaining <= 10;
  return (
    <section aria-labelledby="q" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-muted-foreground">
          Question {index + 1} of {order.length} · <span className="capitalize">{current?.category}</span>
        </p>
        <p
          role="timer"
          aria-live="off"
          className={`rounded-md border px-2.5 py-1 font-mono text-base tabular-nums ${urgent ? "border-destructive text-destructive" : ""}`}
        >
          {fmt(remaining)}
        </p>
      </div>
      <h2 id="q" className="text-xl">
        {current?.question}
      </h2>
      <Textarea
        ref={textRef}
        aria-labelledby="q"
        rows={10}
        value={answer}
        maxLength={8000}
        placeholder="Answer as you would in the interview."
        onChange={(e) => {
          setAnswer(e.target.value);
          answerRef.current = e.target.value;
        }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void finish(false);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void finish(false)} disabled={saving}>
          {saving ? "Saving…" : index + 1 >= order.length ? "Finish" : "Next question"}
        </Button>
        <span className="text-xs text-muted-foreground">{words(answer)} words · Ctrl+Enter to continue</span>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
    </section>
  );
}
