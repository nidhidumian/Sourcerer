# TICKET-006 — Company research + multi-angle event discovery

## Agent
Devin (Application Development)

## Read first
- docs/PRD.md
- docs/tickets/TICKET-003.md
- docs/tickets/TICKET-004.md

## Product context
Sourcerer is a universal B2B **events sourcerer** — not built for one company or
vertical. Users are B2B companies (any industry) who want to find trade shows,
conferences, and events where they can build brand awareness, establish thought
leadership, demo product, and join industry conversations. The app must research
each company properly, then search for events the way an experienced event
marketer would on Google — broad category + geography + vertical angles +
adjacent use cases — not one narrow query from a domain guess.

Live stack: Cloudflare Worker `sourcerer-api` + D1 + Exa + OpenAI. Pages frontend
unchanged in this ticket (except for any API-contract requirement — none here).

## Problem today
- `/api/analyze` mostly infers from domain + one OpenAI call. It does NOT read the
  company's website or customer stories.
- `/api/events` runs a few queries from analyze output, then over-filters. Result:
  valid B2B domains can return NO EVENTS; unrelated generic flagships appear for
  the wrong companies; search does not mirror manual research.

## Part A — Company research (new step, before events)
Uses **Firecrawl** (`FIRECRAWL_API_KEY` Worker secret). For each new analyze
submit (cached 24h in D1 by domain, table `company_research`):

1. Scrape homepage markdown (`POST https://api.firecrawl.dev/v1/scrape`,
   `formats: ["markdown","links"]`, `onlyMainContent: true`).
2. Discover 1–2 customer-story URLs from homepage links (paths like
   `/customer-stories`, `/customers`, `/case-studies`, `/success-stories`,
   `/stories`, `/resources/...case`) and scrape those too.
3. OpenAI structured extract from homepage + stories into an enriched profile:
   `companyName`, `oneLiner`, `industry`, `productCategory`, `coreICP[]`,
   `verticals[]`, `useCases[]`, `adjacentMarkets[{market,rationale}]`,
   `competitors[]`, `recommendedEventTypes[]`, `eventSearchThemes[]` (5–10),
   plus `eventFitScore`/`scoreRationale` for the UI. Source URLs stored in D1.

If `FIRECRAWL_API_KEY` is absent or scraping fails, the worker falls back to the
existing domain-only OpenAI analysis so `/api/analyze` always responds.
The `/api/analyze` response stays backward-compatible (`companyName`, `oneLiner`,
`icp`, `industry`, `verticals`, `scoreRationale` all still present); the events
step uses the enriched profile fields.

## Part B — Multi-angle event query planner (new)
From the enriched profile + geography, generate 8–12 Exa queries
(`EXA_EVENTS_MAX_QUERIES`, default 10). Query mix:
1. **Broad category + geography** — `"{topic} conferences {geo}"` /
   `"{topic} trade shows {geo}"` from `eventSearchThemes` + `recommendedEventTypes`
   (trailing event-type words stripped so we never produce "… conferences
   conferences").
2. **Vertical + angle** (cap ~3–4) — `"{vertical/useCase} {topic} events {geo}"`.
3. **Adjacent markets** (cap 2) — `"{adjacent} innovation summit {geo}"`.
4. **Named industry anchors** — targeted `"{flagship} {geo}"` queries, only when
   the flagship tightly matches the company's own industry/themes (generic tags
   like saas/cloud/b2b/ai never trigger one).

Never searches only the domain or only `oneLiner`.

## Part C — Event search + curation (updated pipeline)
- Run all planned queries through the existing Exa `/search` (rich schema kept).
- Dedupe by normalized event name + URL (trailing year stripped).
- Strict geography gate kept, BUT infer "United States" from a grounded state
  abbreviation/name or prior-year location (e.g. "Austin, TX", "Las Vegas,
  Nevada"). No "unknown country" pass-through.
- Relevance filter keyed off the company's **own** focus (industry +
  recommended event types + event search themes + use cases) — NOT customer
  verticals. **Fail open**: if relevance would empty the list, keep the
  geography-matched results so we never return zero when Exa found real events.
- Block obvious predatory/spam aggregators (`SPAM_HOST_SUBSTRINGS`, extendable
  via `EVENTS_SPAM_DOMAINS`, plus generic "International Conference on …" names).
- Competitor "Last year sponsors:" line — grounded only, all event types.
- `EVENTS_CACHE_VERSION` bumped (3 → 4).

## Data / config
- New D1 table `company_research` (migration `003_company_research.sql`).
- New env vars (`wrangler.toml [vars]`): `OPENAI_RESEARCH_MAX_OUTPUT_TOKENS`
  (1600), `EVENTS_SPAM_DOMAINS` (""). Changed: `EXA_EVENTS_MAX_QUERIES` 4→10,
  `EVENTS_CACHE_VERSION` 3→4.
- New secret: `FIRECRAWL_API_KEY` (set via `wrangler secret put`).

## Acceptance criteria (universal)
| Domain (example) | Geography | Must see |
|---|---|---|
| CX / contact center B2B SaaS | USA | Multiple CX / contact-center events; NOT empty |
| Legal tech AI | Canada | Legal innovation / legaltech events; no Mumbai; no policy debates |
| Dev infra / secrets | USA | Security/cloud events; tight flagships only |
| Agency / SMB business tool | USA | Agency/SMB-relevant; not generic AWS/SaaStr/Money20/20 unless matched |
| R&D / formulation (pharma + adjacent) | USA | Pharma/cosmetics + reasonable adjacent (food innovation, packaging) |

Global: NO EVENTS FOUND is unacceptable when the industry has conferences in the
geography; the same flagship list must NOT appear for unrelated domains; research
must visibly use homepage + customer-story content (source URLs stored in D1).

## Out of scope (TICKET-005, separate PR)
UI card layout, wishlist backend. Do not change `apps/web` here except for an API
contract change (none needed).

## Testing
- `node --check src/index.js` and `wrangler deploy --dry-run` pass.
- Unit-tested the query planner, US geography inference, spam block, flagship
  matching, relevance terms, and story discovery against sample profiles.

## Post-merge
Run the `deploy-sourcerer-api` GitHub Action (applies migration `003` + deploys
the Worker), set the `FIRECRAWL_API_KEY` secret, then re-submit domains. Because
`EVENTS_CACHE_VERSION` was bumped, the first re-submit ignores old cached events
and runs the new research + multi-angle search.
