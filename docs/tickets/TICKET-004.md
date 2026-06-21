# TICKET-004 — Event quality + AirOps-inspired event cards

## Agent
Devin (Application Development)

## Read first
- docs/PRD.md
- docs/GUARDRAILS.md
- docs/DESIGN.md
- docs/DESIGN-branding.json
- docs/tickets/TICKET-003.md

## Scope (only these)
Raise the quality of the events returned by `GET /api/events` (workers/api) and
redesign the homepage event cards (apps/web). No new dependencies, no localStorage,
no fit score on the UI, and no change to the `/api/analyze` contract.

## EVENT QUALITY (workers/api)

### Strict geography (hard gate for ALL events)
- The search geography is a hard gate. `Canada` search → Canada only; drop clear
  non-matches (e.g. an event in Mumbai for a Canada search).
- Do **not** default a missing event location to the search geography.
- Drop any event whose country cannot be **confirmed** to match the search geography.
- Non-flagship events with unknown location → drop.
- Flagship events → keep **only** if the event's known country matches the search
  geography (date/venue may be TBD, country may not be).

### Date window
- Window: tomorrow through +12 months (`EVENTS_LOOKAHEAD_MONTHS=12` default).
- Drop past events.
- Sort chronologically (soonest first).
- TBD / flagship events are exempt from the date filter and pinned to the bottom.

### Relevance filter
- Drop events that don't match the analyze `icp` / `verticals` /
  `recommended_event_types` (e.g. Spellbook should not see random lawyer policy
  debates).
- Fail open: if the relevance filter would empty the list, relax it rather than
  return nothing.

### Flagship anchors
- For major recurring industry events, show even when the next date/venue is unknown
  — but **only** when the event's known country matches the search geography
  (e.g. AWS re:Invent shows for USA, **not** Poland).
- Render `Date/Venue TBD` + `Last year: {date} · {location}`.
- Derive the flagship set from the analyze `recommended_event_types` plus a small
  curated map per vertical/geography (e.g. AWS re:Invent for USA dev/infra/security).
  Do **not** hardcode hundreds of events.

### Competitor line
- Intersect the analyze `competitors` with the **extracted** event sponsors; show
  `Last year sponsors: {names}` only when sponsors are actually found — never
  hallucinate.
- This line is **additive only** and must never affect whether an event appears.

### Exa schema expansion (within the existing call — no per-event API calls)
Expand the structured `summary.schema` used in the single Exa `/search` call to also
extract, when available:
- `organizer`
- `description` (one line)
- `country`, `city`
- `startDate` (ISO `YYYY-MM-DD` when determinable), `dateText` (display range)
- `isRecurring`
- `priorYearDate`, `priorYearLocation`
- `agenda`, `speakers`
- `sponsors`
- `sponsorshipEmail` / `contactEmail`

## EVENT CARDS (apps/web) — AirOps-inspired
Each card shows:
- Title
- Organizer (under the title)
- One-line description
- Date / location, or `TBD` + `Last year: {date} · {location}` note
- Optional agenda / speakers
- Competitor sponsors line (only when grounded)
- Three pills: `VISIT EVENT` | `WISHLIST` | `REQUEST SPONSORSHIP KIT`
- No fit score.

### Pills
- `VISIT EVENT` — opens the event URL in a new tab.
- `WISHLIST` (v1) — popup only: "Sign up coming soon. We'll let you save events
  soon." No backend.
- `REQUEST SPONSORSHIP KIT` — `mailto:` pre-filled:
  - `to`: extracted `sponsorshipEmail`/`contactEmail` when found, else blank.
  - subject: `Sponsorship kit request — {event}`
  - body: `Hi, I'm from {company}. I'd like to request a media kit/sponsorship
    brochure for {event}. We're exploring sponsorship opportunities.`
  - `{company}` = analyze `company_name`, falling back to the domain.

## Worker vars (workers/api/wrangler.toml)
- `EVENTS_LOOKAHEAD_MONTHS = "12"`
- `EVENTS_CACHE_VERSION = "2"` — bumped so the first re-submit after this deploy
  ignores the old (v1) cached events and re-fetches with the new quality logic.

## Cache bypass for testing
The events cache (`events_cache`, 24h TTL) now stores a `{ version, events }`
wrapper and only serves rows whose `version` matches `EVENTS_CACHE_VERSION`. Bumping
`EVENTS_CACHE_VERSION` invalidates all previously cached events, so the next request
re-runs Exa with the new logic.

**To test after merge:**
1. Operator runs the `deploy-sourcerer-api` GitHub Action (Worker) and redeploys
   `sourcerer-web` (Pages).
2. Re-submit the domain on the homepage. Because `EVENTS_CACHE_VERSION` was bumped,
   the old cached events are ignored and a fresh Exa search runs.

## Do NOT
- Do not add new dependencies.
- Do not use localStorage.
- Do not store secrets in the repo.
- Do not change the `/api/analyze` contract.
- Do not add per-event Exa/API calls.
- Do not show a fit score on the UI.

## Acceptance criteria
- Every returned event's country is confirmed to match the search geography;
  non-matches and unknown-country events are dropped (flagship included).
- Dated events fall within tomorrow..+12 months and are sorted soonest-first; TBD /
  flagship events are pinned to the bottom.
- Irrelevant events are dropped, but the list is never emptied by the relevance
  filter (fail open).
- Flagship anchors render with `TBD` + `Last year` and only appear when their known
  country matches the search geography.
- The competitor sponsors line appears only when an analyze competitor is found in
  the extracted sponsors, and never changes which events appear.
- Cards render title, organizer, description, date/location-or-TBD, optional
  agenda/speakers, grounded competitor line, and the three pills; no fit score.
- `WISHLIST` shows the coming-soon popup; `REQUEST SPONSORSHIP KIT` opens a
  pre-filled `mailto:`.
- `npm run build` works in apps/web and the Worker validates with `wrangler deploy
  --dry-run`.
