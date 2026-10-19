"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { searchEverything, type SearchHit } from "@/app/(app)/search/actions";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "./nav-items";

type Entry = { id: string; group: string; title: string; sub?: string; href: string };

const ACTIONS: Entry[] = [
  { id: "a-app", group: "Quick actions", title: "Add application", href: "/applications/new" },
  { id: "a-import-job", group: "Quick actions", title: "Import a job posting", href: "/jobs" },
  { id: "a-task", group: "Quick actions", title: "Add task", href: "/tasks" },
  { id: "a-contact", group: "Quick actions", title: "Add contact", href: "/contacts/new" },
  { id: "a-csv", group: "Quick actions", title: "Import applications from CSV", href: "/applications/import" },
  { id: "a-cal", group: "Quick actions", title: "Calendar import / export", href: "/calendar/sync" },
];
const PAGES: Entry[] = NAV_ITEMS.map((n) => ({ id: `p-${n.href}`, group: "Go to", title: n.label, href: n.href }));

/** "g" then a letter jumps to a page; "n" starts a new application. */
const GO: Record<string, { href: string; label: string }> = {
  d: { href: "/dashboard", label: "Dashboard" },
  a: { href: "/applications", label: "Applications" },
  t: { href: "/tasks", label: "Tasks" },
  c: { href: "/calendar", label: "Calendar" },
  p: { href: "/contacts", label: "Contacts" },
  j: { href: "/jobs", label: "Job Capture" },
  r: { href: "/resume", label: "Resume Studio" },
  s: { href: "/settings", label: "Settings" },
};

const typing = (el: EventTarget | null) => {
  const e = el as HTMLElement | null;
  if (!e) return false;
  return e.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.tagName);
};

export function CommandPalette() {
  const router = useRouter();
  const searchRef = useRef<HTMLDialogElement>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);
  const keyNav = useRef(false);

  const openSearch = useCallback(() => {
    helpRef.current?.close();
    if (!searchRef.current?.open) searchRef.current?.showModal();
    inputRef.current?.focus();
  }, []);
  const closeAll = useCallback(() => {
    searchRef.current?.close();
    helpRef.current?.close();
  }, []);
  const go = useCallback(
    (href: string) => {
      closeAll();
      router.push(href);
    },
    [router, closeAll],
  );

  // Global keys. Ignored while typing in a field and when a modifier other than Ctrl/Cmd+K is held.
  useEffect(() => {
    let gPending: ReturnType<typeof setTimeout> | null = null;
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      if (searchRef.current?.open || helpRef.current?.open) return;
      if (gPending) {
        clearTimeout(gPending);
        gPending = null;
        const dest = GO[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          router.push(dest.href);
        }
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        openSearch();
      } else if (e.key === "?") {
        e.preventDefault();
        helpRef.current?.showModal();
      } else if (e.key === "g") {
        gPending = setTimeout(() => {
          gPending = null;
        }, 1200);
      } else if (e.key === "n") {
        e.preventDefault();
        router.push("/applications/new");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gPending) clearTimeout(gPending);
    };
  }, [openSearch, router]);

  // Debounced search of the user's own records.
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchEverything(term);
        if (mine === seq.current) setHits(result);
      } catch {
        if (mine === seq.current) setHits([]);
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const entries = useMemo<Entry[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [...ACTIONS, ...PAGES];
    const local = [...ACTIONS, ...PAGES].filter((e) => e.title.toLowerCase().includes(q));
    return [...hits.map((h) => ({ ...h, id: `${h.group}-${h.id}` })), ...local];
  }, [query, hits]);

  const clamped = Math.min(active, Math.max(0, entries.length - 1));

  // Keep the highlighted result in view as the arrow keys move through the list. Only keyboard moves scroll:
  // hovering with the mouse must not make the list jump under the pointer.
  useEffect(() => {
    if (!keyNav.current) return;
    keyNav.current = false;
    // Scroll the whole row, so a group's heading comes into view along with its first result.
    const row = document.getElementById(`${listId}-${clamped}`)?.closest("li");
    if (clamped === 0) row?.parentElement?.scrollTo({ top: 0 });
    else row?.scrollIntoView({ block: "nearest" });
  }, [clamped, listId]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      keyNav.current = true;
      setActive(Math.min(entries.length - 1, clamped + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      keyNav.current = true;
      setActive(Math.max(0, clamped - 1));
    } else if (e.key === "Enter" && entries[clamped]) {
      e.preventDefault();
      go(entries[clamped].href);
    }
  };

  const onBackdrop = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) e.currentTarget.close();
  };
  const dialogClass =
    "m-auto w-[min(36rem,calc(100vw-2rem))] rounded-xl border bg-popover p-0 text-popover-foreground shadow-xl backdrop:bg-black/40";

  let lastGroup = "";
  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={openSearch} aria-label="Search" className="gap-2 text-muted-foreground">
        <Search className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border px-1 text-xs sm:inline" aria-hidden="true">
          /
        </kbd>
      </Button>

      <dialog
        ref={searchRef}
        aria-label="Search and jump"
        className={dialogClass}
        onClick={onBackdrop}
        onClose={() => {
          setQuery("");
          setHits([]);
          setActive(0);
        }}
      >
        <div className="border-b p-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={entries[clamped] ? `${listId}-${clamped}` : undefined}
            aria-label="Search applications, contacts, tasks and documents, or jump to a page"
            placeholder="Search your records or jump to a page…"
            autoComplete="off"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul id={listId} role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {entries.map((e, i) => {
            const header = e.group !== lastGroup;
            lastGroup = e.group;
            return (
              <li key={e.id} role="presentation">
                {header ? <div className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">{e.group}</div> : null}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === clamped}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(e.href)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 ${i === clamped ? "bg-accent text-accent-foreground" : ""}`}
                >
                  <span className="min-w-0 truncate">{e.title}</span>
                  {e.sub ? <span className="shrink-0 text-xs capitalize text-muted-foreground">{e.sub}</span> : null}
                </div>
              </li>
            );
          })}
          {entries.length === 0 ? (
            <li role="presentation" className="px-2 py-6 text-center text-muted-foreground">
              {searching ? "Searching…" : "No matches."}
            </li>
          ) : null}
        </ul>
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <span>↑ ↓ to move, Enter to open, Esc to close</span>
          <span aria-live="polite">{searching ? "Searching…" : ""}</span>
        </div>
      </dialog>

      <dialog ref={helpRef} aria-label="Keyboard shortcuts" className={dialogClass} onClick={onBackdrop}>
        <div className="space-y-3 p-4 text-sm">
          <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
          <p className="text-muted-foreground">They work anywhere except while typing in a field.</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {[
              ["/ or Ctrl/⌘ K", "Search and jump"],
              ["n", "New application"],
              ["?", "This list"],
              ...Object.entries(GO).map(([k, v]) => [`g then ${k}`, v.label]),
            ].map(([keys, label]) => (
              <div key={keys} className="contents">
                <dt>
                  <kbd className="rounded border px-1.5 py-0.5 text-xs">{keys}</kbd>
                </dt>
                <dd className="text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => helpRef.current?.close()}>
              Close
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
