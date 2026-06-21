# TICKET-005 — Event card + analyze UI polish (frontend only)

## Product context
Sourcerer is a universal B2B events sourcerer — companies find trade shows, conferences,
and events for brand awareness, thought leadership, product demos, booth/sponsorship,
panels/keynotes. Event discovery logic shipped in TICKET-006. This ticket does **not**
change `workers/api`.

## Scope
`apps/web` only (`App.jsx`, `styles.css`). Clean, editorial aesthetic (minimal, readable).

## Changes

### Event cards
1. **Organizer eyebrow** — small-caps mono label (like DATE / LOCATION) placed **above** the
   event title, with a tight gap to the title.
2. **Description = "why"** — render API field `why` when present, else `description`. The value
   prop is the reason to attend/sponsor; date/city/country/organizer live in their own fields.
3. **Typography** — description/why uses the same size + line spacing as analyze body text
   (17px / line-height 1.45).
4. **Dark (alternating) cards** — title, description/why, meta values, "Last year", and
   "Last year sponsors" all use `var(--paper)` so they are readable on black. Eyebrow labels
   (organizer, DATE/LOCATION/AGENDA/SPEAKERS) stay muted. Universal rule, not per-event.
5. **Three pills** on every card: VISIT EVENT, WISHLIST, REQUEST SPONSORSHIP KIT.
6. **Sponsorship pill** — opens the default mail app via `mailto:` (set `window.location.href`,
   no blank browser tab). Subject + body pre-filled with the analyze company name; empty `to=`
   when no sponsorship email is known.
7. **Card order** — organizer eyebrow → title → why/description → DATE / LOCATION →
   Last year (only when the next date is TBD) → Last year sponsors (if any) → agenda/speakers
   (additive) → pills.

### Analyze section
8. **Unified body text** — the company one-liner under the name uses the same size/spacing as
   ICP / INDUSTRY / VERTICALS values (17px / 1.45), not larger hero text.

## Out of scope
- Event search, Firecrawl, Exa, cache, flagships (TICKET-006).
- Renaming `/api/events` so ad/tracker blockers don't suppress results → backlog TICKET-007.

## Acceptance (preview)
- All three pills visible and working on light and dark cards.
- Dark-card description readable (same color as title).
- Organizer rendered above the title as a small eyebrow.
- Analyze one-liner matches ICP/verticals typography.
- `npm run build` passes.

## Post-merge
Redeploy `sourcerer-web` (Pages).
