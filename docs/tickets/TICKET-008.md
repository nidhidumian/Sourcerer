# TICKET-008 — Universal card content quality (all B2B submitters)

## Product context
Sourcerer is a universal B2B events sourcerer — any B2B company finds trade shows,
conferences, and events for brand awareness, thought leadership, product demos,
booth/sponsorship, panels/keynotes. The rules below apply to **every** domain +
geography submit; nothing is tuned to a single company or vertical.

## Scope
- `workers/api` — agenda quality filter, grounded sponsor extraction/display, drop speakers.
- `apps/web` — remove the SPEAKERS card section, render the generalized sponsors line.

## Changes

### 1. Remove SPEAKERS from all cards
- `apps/web`: the SPEAKERS section is no longer rendered for any event.
- `workers/api`: `speakers` is dropped from the card payload, the Exa extraction
  schema, the raw-event parse, and the curated-flagship objects. v1 shows no
  speaker names on cards.

### 2. Agenda quality filter (worker, universal)
Agenda is kept (it shows event fit) but cleaned in the `curateEvents` / `finalizeCard`
pipeline via `cleanAgenda()` before it reaches the UI:
- **Drop website nav / CTA / section labels** masquerading as topics — e.g.
  "Why this year", "The venue", "Past speakers", "Dispatch", "Register",
  "Sponsors", "About", "Home", "Contact", "Tickets", "Pricing", "FAQ", "Schedule",
  "Day 1/2", login/search/menu, privacy/terms/cookies, etc.
- **Drop items that duplicate** the card's date / location / name.
- **Keep substantive tracks/topics.**
- **Cap at 5** items after filtering.

The Exa schema description was also tightened to ask only for substantive topics.

### 3. Grounded "Last year sponsors" on every card (worker + UI)
Shown for **all** events (curated flagships AND Exa-discovered) when grounded
sponsor data exists, via `buildLastYearSponsors()`:
- **Grounded only** — uses extracted sponsor/exhibitor names (Exa `sponsors`
  field) or curated `lastYearSponsors`. Never guessed.
- The Exa `sponsors` schema description now explicitly requests prior/most-recent
  edition sponsors, exhibitors, and partners so the line appears when public data
  exists (no per-event API calls added).
- **Up to 5 names.** If the analyze profile includes competitors, names matching
  competitors are surfaced first; if there is no competitor overlap, grounded
  sponsor names are still shown.
- No data → the line is omitted.

This replaces the previous competitor-only `competitorSponsors` payload field with
a generalized `lastYearSponsors` field. It remains additive and never affects
whether an event appears.

### 4. Cache
`EVENTS_CACHE_VERSION` bumped `4` → `5` so the first re-submit after deploy
re-runs the pipeline instead of serving old cached cards.

## Acceptance (universal — any B2B domain)
- No card shows a SPEAKERS block.
- No card shows nav junk in AGENDA (section titles posing as topics).
- Real multi-topic agendas still show for substantive events.
- When prior-year sponsor data is available, the card shows "Last year sponsors: …"
  regardless of flagship vs dated event.
- Pipeline changes apply in `workers/api` for all submits; UI changes in `apps/web`
  for all cards.
- `apps/web` build + `wrangler deploy --dry-run` pass.

## Post-merge
1. Run the `deploy-sourcerer-api` GitHub Action (deploys the Worker).
2. Redeploy `sourcerer-web` (Pages).
3. Re-submit domains — the `EVENTS_CACHE_VERSION` 4→5 bump makes the first
   re-submit fetch fresh cards.

Optional: spot-check 2–3 unrelated B2B domains + geographies (ad blocker off).
Do not hardcode or optimize for those domains.
