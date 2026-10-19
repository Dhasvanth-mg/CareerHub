# Design system: "The Ascent"

CareerHub's logo is a staircase leading to a goal, and a job search really is a climb through stages. The interface leans on that
one idea and keeps everything around it quiet.

## The memorable thing

The dashboard's **Ascent** (`src/components/app/ascent.tsx`): the pipeline drawn as six rising steps, one per stage from Saved to
Offer. Each step shows its count and a couple of company names and links to those applications. It rises into place once on load,
and a small goal marker sits on the top step, like the one in the logo. The same shape appears, smaller, on each application
(`stage-track.tsx`) and on the landing and sign-in pages (`AscentSketch`).

## Colour

Defined as tokens in `src/app/globals.css`, in OKLCH, with a light and a dark set.

| Role | Light | Notes |
| --- | --- | --- |
| Ink rail (`--sidebar`) | deep navy | The sidebar is always dark, so the pale canvas beside it reads as the place you work. |
| Canvas (`--background`) | cool pale lilac-white | Cards sit on it as white surfaces with a hairline ring, not heavy shadows. |
| Ultramarine (`--primary`) | saturated indigo | Things you can act on: buttons, links, focus. |
| Sunrise (`--sunrise`) | warm amber | Reserved for the goal, high priority and deadlines that need you. |
| Stage hues | see below | One hue per pipeline stage. |

### Stage colours

Set `data-stage="applied"` (and so on) on any element, then use `.stage-soft` (tinted chip), `.stage-solid` (dot or bar),
`.stage-text` or `.stage-tread` (strong top edge). Saved is slate, Preparing is sky, Applied is indigo, Assessment is violet,
Interview is amber, Offer is green, Rejected is a muted rose, Withdrawn is grey. The same hue follows an application everywhere:
board column, chip, monogram, table row and the Ascent. Dark mode derives its tints from the same hue, so nothing is redefined.

## Type

- **Headings:** Bricolage Grotesque (variable), tight tracking, weight 600. Set once in the base layer, so a plain `<h1>` or
  `<h2>` is already correct. Page titles use `text-3xl sm:text-4xl`, section titles `text-xl`.
- **Everything else:** Geist, for legibility at small sizes. Numerals that line up in columns use `.tabular`.
- No all-caps labels, no mono labels and no decorative punctuation. Group labels are sentence case.

## Surfaces and shape

- Radius scale from `--radius` (0.75rem): controls are `rounded-lg`, panels and cards `rounded-2xl`, chips and toggles are full pills.
- A panel is `rounded-2xl bg-card shadow-xs ring-1 ring-foreground/[0.06]`. Borders appear only where they carry meaning (dashed for
  "nothing here yet", coloured for alerts).
- Lift is reserved for things you can pick up or that float: `shadow-lift` on a hovered card, `shadow-float` while dragging and on dialogs.

## Motion

One orchestrated moment: the Ascent rising on load. Everything else moves only in response to a person (dialogs pop in, cards lift
on hover and drag, the stage selector fades in on a card). Loading states use a quiet shimmer (`.skeleton`, `loading.tsx`).
`prefers-reduced-motion` turns all of it off and shows the finished state.

## Layout

- **Shell:** a 16rem dark rail with the search field on top, navigation grouped as Track, Prepare and Decide, and account and theme at
  the bottom. On phones it becomes a slim top bar with the same navigation in a drawer.
- **Pages:** one column of content, `max-w-6xl`, with generous vertical rhythm. Settings uses titles on the left and controls on
  the right.
- **Empty states** show the staircase and offer the first move (`EmptyState`).

## Accessibility floor

Every signed-in page is scanned with axe in light and dark, at desktop and phone widths, and must have no violations. Keyboard
focus is always visible, targets are at least 32px, and colour is never the only signal: stage chips carry the stage name, and the
Ascent steps carry their counts in text.
