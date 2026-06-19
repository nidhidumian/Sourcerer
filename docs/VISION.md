# Sourcerer — Vision

## One line
Enter your company domain and a geography. Sourcerer finds events worth your time — sponsorship, panels, networking — scored like a field marketer would.

## Homepage
- Nav center: Sourcerer, Events Sourcerer (serif italic)
- Nav right: SIGN UP OR LOG IN (no hamburger)
- Headline: Don't share your deep, dark secrets, just *your domain*
- Subcopy: I will study your product, understand decision makers, industry and what verticals your product is useful for to give you a list of events specifically for your field and event marketing goals.
- Inputs (one row): [domain pill] [geography pill] SUBMIT

## Event discovery logic
- Track A — Industry events: main theme matches what the company sells (e.g. Cursor → dev tools, not generic tech)
- Track B — Vertical events: industries they sell into, only if agenda/theme/speakers match the problem the product solves (e.g. basetwo.ai → PHARMA EVENT, PACKAGING EVENT)
- Validate: theme, agenda, persona fit, geography, competitor sponsor/speaker history, last-year buzz (attendance, social, lead quality)

## Event cards (alternating cream / dark)
- Eyebrow: INDUSTRY EVENT or named vertical (PACKAGING EVENT)
- Title: event name (Source Serif 4, 24px italic on dark)
- Description: 14px serif
- Pills: SPONSORSHIP, PANEL, KEYNOTE, NETWORKING, WEBSITE, LINKEDIN, EMAIL
- Email pill → mailto with brochure request for sponsorship
- Pin top-right → save (login required)

## Design inspiration
https://astro-charts.com — cream/black, Source Serif 4 + JetBrains Mono, sharp corners

## Stack
- GitHub = source of truth (online only)
- Cloudflare Pages + Workers + D1
- OpenAI (company analysis + scoring)
- Exa (event search)
- Firecrawl (design extract + optional page scrape)
- Codex builds | Devin tests | Cloudflare runs
