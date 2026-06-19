# Secrets checklist

Values live in password manager + Cloudflare dashboard only. Never commit keys.

| Variable | Service | Status |
|----------|---------|--------|
| EXA_API_KEY | Exa — event web search | ready |
| FIRECRAWL_API_KEY | Firecrawl — design/scrape | ready |
| OPENAI_API_KEY | OpenAI — analyze + score | add to Cloudflare when Worker exists |
| DATABASE | Cloudflare D1 binding | created in Ticket-001 |

## Cloudflare (after Ticket-001 deploy)
Dashboard → Workers & Pages → sourcerer → Settings → Variables → Secrets
