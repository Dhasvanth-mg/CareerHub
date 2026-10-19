/** Shown while a page's data loads, so navigating feels immediate instead of frozen. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-8">
      <div className="space-y-3">
        <div className="skeleton h-10 w-72" />
        <div className="skeleton h-4 w-96 max-w-full" />
      </div>
      <div className="grid h-56 grid-cols-6 items-end gap-3">
        {[40, 50, 60, 72, 84, 96].map((h, i) => (
          <div key={i} className="skeleton rounded-b-none" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-10" />
          ))}
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-14" />
          ))}
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
