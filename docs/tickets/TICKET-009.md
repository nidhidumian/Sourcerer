# TICKET-009 — Card copy, dates, agenda, sponsorship popup, past sponsors

## Product context
Sourcerer is a universal B2B events sourcerer — any B2B company finds trade shows,
conferences, and events for brand awareness, thought leadership, product demos,
booth/sponsorship, panels/keynotes. Every rule below applies to **every** domain +
geography submit; nothing is tuned to a single company or vertical.

## Scope
- `apps/web` — sponsorship pill becomes a popup; event description typography.
- `workers/api` — generated company-specific WHY, agenda filler/stat filter,
  consistent date formatting, improved past-year sponsor extraction, cache bump.

## Changes

### 1. REQUEST SPONSORSHIP KIT → popup (`apps/web`)
The pill no longer opens a `mailto:`/new tab. It opens a modal (same pattern as
WISHLIST):
- Title: `REQUEST SPONSORSHIP KIT`
- Body: "Feature coming soon. We'll let you send events to request a media kit."
- Button: `GOT IT`

The `sponsorshipMailto()` helper and the now-unused `companyName` variable were
removed.

### 2. Description = WHY (`workers/api` + `apps/web`)
The card description is now the **value prop for this submitter's company at this
event**, not a recap of the event page.
- Generated at card finalization (`attachEventWhys`) in one batched OpenAI call
  using the analyze profile (company, one-liner, industry, ICP, verticals,
  competitors) + event name + grounded agenda themes + geography. One or two
  concrete sentences, no event name / organizer / date / city / country.
- Returned on a new `why` field; the UI already prefers `why` over `description`.
- **Never emits schema/prompt placeholders.** The Exa `description` schema text was
  neutralized, and `sanitizeDescription()` / `isPlaceholderText()` strip leaked
  prompt text (e.g. "One concise sentence describing the event") on both the
  scraped input and the generated output.
- **Fail-safe:** if the OpenAI call fails or no key is set, a deterministic
  `genericWhy()` builds a short themes-based value prop — never placeholder text,
  never a raw recap. The raw card `description` is sent as `null`.

### 3. Agenda — no filler (`workers/api`)
`cleanAgenda()` (TICKET-008) now also drops:
- **Generic filler** — "Panel sessions", "Interactive workshops", "Networking",
  "Keynotes", "Roundtables", "Demos", "Awards", "Reception", etc.
- **Stats / vanity metrics** — "10,000+ Attendees", "400+ Speakers", "51 Countries",
  "64% Loyalists" (via `isAgendaStat()`), plus all the nav junk from TICKET-008.

If **zero** real items remain after filtering, the agenda is `["TBA"]` so the
section renders as `AGENDA · TBA` rather than being silently omitted.

### 4. Date format — consistent (`workers/api`)
`formatDisplayDate()` / `normalizeDateRange()` normalize all displayed dates to:
- `FullMonth startDay-endDay, year` (e.g. `October 19-21, 2026`)
- single day: `FullMonth day, year` (e.g. `November 19, 2026`)
- cross-month range: `October 30 - November 2, 2026`
Full month names (October, not Oct), days joined by a plain hyphen (en/em dashes
and "to" normalized). Handles month-first, day-first, and ISO inputs. `TBD` for
flagships is unchanged. `formatEventDate()` now uses the long month name too.

### 5. Past year sponsors (`workers/api`)
- The Exa `sponsors` schema description was broadened to pull sponsor/exhibitor/
  partner names from logo grids and "sponsored by" / "in partnership with" text.
- `buildLastYearSponsors()` drops generic tier labels ("Gold Sponsor", "Partners",
  "Exhibitors") via `isSponsorTierLabel()` so only real company names show,
  competitors first, up to 5; omitted when none.

### 6. Event description typography (`apps/web`)
`.event-description` font-size 17px → 15px so the WHY/description matches
`.event-meta dd` (DATE/LOCATION values) and `.event-extra dd` (agenda) on both
light and dark cards. Readable color from TICKET-005 unchanged.

### 7. Cache / config
- `EVENTS_CACHE_VERSION` bumped to `6` in both code default and `wrangler.toml`
  (the `[vars]` entry had been left at `4`, which overrode the TICKET-008 code
  default of `5` in production — now corrected).
- New optional var `OPENAI_WHY_MAX_OUTPUT_TOKENS` (default `1200`).

## Acceptance (universal — any B2B domain)
- Sponsorship pill opens a popup only — never a blank tab / mailto.
- No card shows "One concise sentence describing the event" or any prompt/schema
  placeholder.
- Description reads as a company-specific WHY (no event recap, no organizer name).
- No generic agenda filler or vanity stats; empty agenda → `TBA`.
- Dates render as `Month D-D, YYYY`.
- "Last year sponsors: …" appears when public sponsor data exists (flagship or
  Exa event).
- `apps/web` build + `wrangler deploy --dry-run` pass.

## Post-merge
1. Run the `deploy-sourcerer-api` GitHub Action (deploys the Worker).
2. Redeploy `sourcerer-web` (Pages).
3. Re-submit domains — the `EVENTS_CACHE_VERSION` bump to `6` makes the first
   re-submit fetch fresh cards.

Optional smoke: spot-check a legal-tech B2B + USA and a marketing B2B + USA with
the ad blocker off. Do not hardcode or optimize for those domains.
