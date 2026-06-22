---
name: testing-sourcerer-cards
description: End-to-end UAT for Sourcerer event-card features (sponsorship/wishlist popups, WHY description, normalized dates, last-year sponsors, agenda filtering, typography). Use when verifying frontend card changes against the live worker API.
---

# Testing Sourcerer event cards

## App shape
- Frontend: Cloudflare Pages `sourcerer-app.ican-ai.me` (React/Vite, `apps/web`).
- API: Cloudflare Worker `sourcerer-api.<acct>.workers.dev` (`workers/api`). Deployed separately from Pages.
- Deterministic test input: `gladly.com` / `USA` (cached analyze + events → stable 7-card set).

## CRITICAL: verify the deployed bundle before trusting the live site
The live site has repeatedly served a **stale frontend bundle** (Pages deploy lags or rolls back while the worker updates). A feature can be merged + the worker live, yet the old JS is served, so UI features appear "broken" when they're just not deployed.

Always confirm which bundle the browser actually runs:
```js
// browser console
document.querySelector('script[type=module]').src   // -> /assets/index-XXXX.js
```
Compare against a local build hash:
```bash
cd apps/web && VITE_API_BASE_URL="https://sourcerer-api.<acct>.workers.dev" npm run build
# vite prints dist/assets/index-XXXX.js — if hashes differ, prod is stale
```
Quick content check of a bundle (old vs new sponsorship behavior):
```bash
curl -s .../assets/index-XXXX.js | grep -c "mailto"            # old pill = 1
curl -s .../assets/index-XXXX.js | grep -c "sponsorship-title" # new popup = 1
```
A cache-busted `curl "...?cb=$RANDOM"` that still returns the old hash 3x = it's the deployment, not browser cache. Report as an operator action (re-promote/redeploy Pages); you likely can't fix it (Cloudflare token `code: 10000` has blocked deploys all series).

## Workaround to actually test the merged frontend
Build locally from `main` and serve against the LIVE worker (CORS reflects origin, so localhost works unless `CORS_ORIGIN` is set):
```bash
cd apps/web && VITE_API_BASE_URL="https://sourcerer-api.<acct>.workers.dev" npm run build && npm run preview  # :4173
```
The local bundle hash matches the CDN's new bundle → this is a faithful test of the merged code + live data.

## What to assert (card features)
- **Sponsorship pill** → in-page popup ("…request a media kit" + GOT IT), NOT mailto/new tab. (Old bundle = mailto, silently no-ops with no mail handler — looks like nothing happens.)
- **WISHLIST pill** → popup ("Sign up coming soon…" + GOT IT). Same modal pattern; good control to prove modals render.
- **Description = WHY**: company-specific value prop, no recap/placeholder, no organizer/date/location repeat.
- **Typography parity**: measure computed styles — `.event-description`, `.event-meta dd`, `.event-extra dd` should all be 15px / 21.75px.
  ```js
  getComputedStyle(document.querySelector('.event-description')).fontSize
  ```
- **Dates**: `Month D-D, YYYY` (full month, plain hyphen, cross-year ok).
- **Last year sponsors**: grounded names, readable on dark (alternating black) cards.
- **No SPEAKERS** block anywhere.

## Known data-quality gap (may still be open)
`buildLastYearSponsors` / `isSponsorTierLabel` only drop exact tier labels ("Gold Sponsor", "Partners"), so descriptive sentences leak (e.g. "Sponsors include 2026 sponsors (list not provided on page)", "Sponsorship Opportunities"). Check CX-network-sourced cards. A tighter filter (drop entries with verbs / many words / "sponsors include" / "opportunities") would help.

## Practical notes
- Use the stripped annotated DOM returned with screenshots to read all card text at once instead of scrolling+screenshotting each.
- If events show "Failed to fetch", an ad blocker may be blocking `/api/events?` (ERR_BLOCKED_BY_CLIENT). Use the clean test Chrome / disable uBlock.
- Record browser tests with `annotate_recording` (setup/test_start/assertion). Post ONE PR comment with results + session link.

## Devin Secrets Needed
None for read-only UAT (uses the public live site + worker). Deploying Pages/worker or applying D1 migrations requires a working Cloudflare API token (historically blocked with `Authentication error [code: 10000]`).
