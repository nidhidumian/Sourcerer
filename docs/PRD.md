# Sourcerer — Product Requirements (v1)

## Summary
Events Sourcerer: user enters company domain + target geography. App infers product, competitors, personas, and verticals — then finds and scores events for field/event marketing (sponsorship, panels, networking).

## User flow
1. Land on homepage — enter domain + geography — SUBMIT
2. Loading: analyze company (OpenAI) + search events (Exa)
3. Results: alternating cream/dark event cards
4. Pin to save (requires sign up / log in)
5. Saved events view (D1, cross-device)

## Homepage (match docs/DESIGN.md + DESIGN-branding.json)
- Nav center: Sourcerer, Events Sourcerer (Source Serif 4 italic)
- Nav right: SIGN UP OR LOG IN
- Headline: Don't share your deep, dark secrets, just *your domain*
- Body: I will study your product, understand decision makers, industry and what verticals your product is useful for to give you a list of events specifically for your field and event marketing goals.
- One row: [domain input pill] [geography input pill] SUBMIT
- Colors: background #FBF8F4, ink #16130F, fonts Source Serif 4 + JetBrains Mono
- Sharp corners (0px radius) on buttons/inputs

## Event discovery logic
### Track A — Industry events
Main theme matches what the company sells (from domain analysis).
Example: Cursor → dev tools / app building — not generic "tech."

### Track B — Vertical events
Industries they sell into — only if agenda/theme/speakers match the problem the product solves.
Eyebrow uses specific vertical name: PHARMA EVENT, PACKAGING EVENT — not generic "vertical."
Example: basetwo.ai → digital twin for engineering → pharma, cosmetics, packaging events.

### Validation / scoring signals
- Theme + agenda fit
- Persona fit (from domain analysis)
- Geography match (user input)
- Competitor sponsor/speaker history (recent years)
- Last-year signals: attendance, social buzz, lead quality proxies

## Event card UI
Alternating cream (--bone #F5F1EA) and dark (--ink #16130F) cards.

| Element | Style |
|---------|--------|
| Eyebrow | JetBrains Mono 10px uppercase, tracking 1.8px — INDUSTRY EVENT or VERTICAL NAME EVENT |
| Title | Source Serif 4 24px italic |
| Description | Source Serif 4 14px, line-height 1.55 |
| Pills | NETWORKING, PANEL, KEYNOTE, SPONSORSHIP, WEBSITE, LINKEDIN, EMAIL |
| Email pill | mailto with subject/body requesting sponsorship brochure |
| Pin (top-right) | Save — if not logged in: modal "Sign up with email or Google" |

## Auth + persistence (v1)
- No localStorage for saves
- D1 database on Cloudflare
- Google OAuth + email magic link (or email-only MVP if OAuth deferred)
- Tables: users, saved_events, searches, events_cache, analytics_events

## API (Cloudflare Worker)
- POST /api/analyze { domain, geography } → company profile + search queries
- POST /api/events { domain, geography, profile } → scored events
- GET/POST /api/saved — requires auth
- KV or D1 cache for analyze/events (24h TTL)

## Stack
- GitHub: nidhidumian/Sourcerer (source of truth)
- Cloudflare Pages (React + Vite + Tailwind)
- Cloudflare Worker (Hono)
- D1, KV optional for cache
- OpenAI, Exa
- Codex builds | Devin tests | Cloudflare prod

## Out of scope v1
- Map view, chat, photos tab
- Browserbase, n8n, Playwright
- localStorage saves

## Demo script
1. domain: cursor.com, geography: United States
2. Show industry events (dev tools) + vertical events
3. Show pills + pin save + login gate
