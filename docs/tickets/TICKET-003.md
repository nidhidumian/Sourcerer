# TICKET-003 — Events API + homepage event cards

## Agent
Devin (Application Development)

## Read first
- docs/PRD.md
- docs/GUARDRAILS.md
- docs/DESIGN.md
- docs/DESIGN-branding.json
- docs/tickets/TICKET-002.md

## Scope (only these)
Implement the second backend product step plus its homepage wiring:
- GET /api/events in workers/api
- Use Exa to search B2B events from the analyze output (domain, geography, and the
  `search_queries` stored in D1 by /api/analyze)
- Cache events in D1 (`sourcerer-db`)
- After /api/analyze succeeds, the homepage automatically loads and displays event
  cards (name, date, location, link)
- Budget-aware Exa usage
- No localStorage

## API contract
GET /api/events

Query params (one of):
- `searchId` — the `searchId` returned by POST /api/analyze (preferred)
- `domain` + `geography` — falls back to the most recent matching analyze row

Response:
```json
{
  "searchId": "uuid",
  "domain": "ramp.com",
  "geography": "Canada",
  "cached": false,
  "events": [
    {
      "name": "SaaStr Annual",
      "date": "Sep 10-12, 2025",
      "location": "San Mateo, United States",
      "url": "https://www.saastrannual.com/"
    }
  ]
}
```

## Exa usage
- Endpoint: `POST https://api.exa.ai/search` with header `x-api-key: EXA_API_KEY`.
- Drive searches from the stored `queries_json` (the analyze `search_queries`), each
  augmented with the target geography.
- Use Exa structured summaries (`contents.summary.schema`) to extract `eventName`,
  `date`, `location`, and an `isEvent` flag per result.
- Aggregate across queries, drop non-events, dedupe by URL, and cap the result count.

## D1 cache
- New table `events_cache` (migrations/002_events_cache.sql).
- Cache key: `search_id` (falls back to normalized domain + geography).
- Cache TTL: 24 hours.
- Store the rendered event list in `events_cache.events_json`.
- D1 database: `sourcerer-db`
- D1 database_id: `2ce0fa48-be71-4319-b80f-b9cef8968aff`

## Budget guardrails
- Check the D1 events cache before calling Exa.
- Cap the number of analyze queries used per request.
- Cap `numResults` per Exa query and the total number of returned events.
- Track Exa calls in `analytics_events` (`events_exa_call`).
- Stop new Exa calls after `EXA_SEARCH_MONTHLY_LIMIT` calls in the trailing 30-day
  window (default configurable via Worker vars).

## Do NOT
- Do not add auth or saved events.
- Do not use localStorage.
- Do not store secrets in the repo.
- Do not change the /api/analyze contract.

## Acceptance criteria
- GET /api/events returns cached D1 events when available.
- Worker calls Exa when cache is cold and `EXA_API_KEY` is present.
- Missing `EXA_API_KEY` returns 503 only after cache lookup.
- Unknown `searchId` (and no domain/geography) returns 404 / 400.
- Budget limit returns 429.
- After analyze succeeds, the homepage fetches and renders event cards
  (name, date, location, link) without localStorage.
- `npm run build` works in apps/web.
- Worker config validates with Wrangler dry-run.
