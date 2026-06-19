# TICKET-001 — Scaffold + Homepage shell

## Agent
Codex (Application Development)

## Read first
- docs/VISION.md
- docs/PRD.md
- docs/GUARDRAILS.md
- docs/DESIGN.md
- docs/DESIGN-branding.json

## Scope (only these)
Create Cloudflare full-stack scaffold on branch feature/ticket-001-scaffold.

Folder structure to create (Codex creates these — not the human):
- apps/web — React + Vite + Tailwind (the website UI)
- workers/api — Hono Worker (the backend API, empty for now)
- wrangler.toml — Cloudflare config (Pages + Worker + D1)
- .github/workflows — auto-deploy to Cloudflare (if straightforward)

## Homepage (static — no API yet)
Match Astro Charts / DESIGN-branding.json:
- Nav center: Sourcerer, Events Sourcerer
- Nav right: SIGN UP OR LOG IN
- Hero headline + body from PRD
- One row: black sharp-corner inputs (TYPE DOMAIN HERE / type target geography here) + SUBMIT
- Fonts: Source Serif 4 + JetBrains Mono (Google Fonts OK)

## D1 database
- Create D1 database named sourcerer-db
- Add migrations/001_init.sql with tables: users, saved_events, searches, analytics_events

## Do NOT
- Implement /api/analyze or /api/events yet
- Add real auth yet (SIGN UP OR LOG IN can be a dummy button)
- Use localStorage
- Add extra npm packages beyond react, vite, tailwind, hono, wrangler

## Acceptance criteria
- npm install and npm run build works in apps/web
- wrangler.toml valid for Pages + Worker + D1
- Homepage matches DESIGN-branding.json colors and fonts
- Open a Pull Request against main

## After PR
Stop. Do not start Ticket-002.
