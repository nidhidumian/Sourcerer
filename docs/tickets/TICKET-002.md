# TICKET-002 - Analyze API + homepage submit flow

## Agent
Codex (Application Development)

## Read first
- docs/PRD.md
- docs/GUARDRAILS.md
- docs/DESIGN.md
- docs/DESIGN-branding.json
- docs/tickets/TICKET-001.md

## Scope (only these)
Implement the first backend product step:
- POST /api/analyze in workers/api
- Homepage SUBMIT sends company domain + target geography to /api/analyze
- Analyze and score B2B event marketing fit with OpenAI
- Cache analyze results in D1 using sourcerer-db
- Keep costs bounded for an initial approximately $20 budget

## API contract
POST /api/analyze

Request:
```json
{
  "domain": "cursor.com",
  "geography": "United States"
}
```

Response:
```json
{
  "searchId": "uuid",
  "domain": "cursor.com",
  "geography": "United States",
  "cached": false,
  "profile": {
    "companyName": "Cursor",
    "oneLiner": "AI code editor for software teams.",
    "industry": "Developer tools",
    "productCategory": "AI coding assistant",
    "icp": ["Software engineering leaders", "Developers"],
    "verticals": ["Software", "Technology"],
    "competitors": ["GitHub Copilot"],
    "eventFitScore": 88,
    "scoreRationale": "Strong fit because...",
    "recommendedEventTypes": ["developer conferences", "AI engineering events"],
    "confidence": 0.74
  },
  "queries": ["developer tools events United States sponsors"]
}
```

## D1 cache
- Use the existing `searches` table from `migrations/001_init.sql`.
- Cache key is normalized `domain` + normalized `geography`.
- Cache TTL is 24 hours.
- Store profile JSON in `searches.profile_json`.
- Store search query JSON in `searches.queries_json`.
- D1 database: `sourcerer-db`
- D1 database_id: `2ce0fa48-be71-4319-b80f-b9cef8968aff`

## Budget guardrails
- Check D1 cache before calling OpenAI.
- Use a compact structured-output prompt.
- Cap OpenAI output tokens.
- Use low reasoning effort and low verbosity.
- Track OpenAI calls in `analytics_events`.
- Stop new OpenAI calls after `OPENAI_ANALYZE_MONTHLY_LIMIT` calls in the trailing 30-day window.
- Default limit can be changed through Worker vars.

## Do NOT
- Do not implement /api/events yet.
- Do not add auth, saved events, Exa, or event cards.
- Do not use localStorage.
- Do not store secrets in the repo.

## Acceptance criteria
- Homepage SUBMIT sends `{ domain, geography }` to POST /api/analyze.
- Worker returns cached D1 response when available.
- Worker calls OpenAI when cache is cold and `OPENAI_API_KEY` is present.
- Worker stores the analysis in D1.
- Invalid input returns 400.
- Missing OpenAI key returns 503 only after cache lookup.
- Budget limit returns 429.
- `npm run build` works in apps/web.
- Worker config validates with Wrangler dry-run.
