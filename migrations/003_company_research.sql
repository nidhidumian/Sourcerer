-- TICKET-006: deep company research (Firecrawl homepage + customer stories ->
-- OpenAI enriched profile). Cached per-domain for 24h, independent of geography.
CREATE TABLE IF NOT EXISTS company_research (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  profile_json TEXT NOT NULL,
  source_urls_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_company_research_domain ON company_research (domain);
CREATE INDEX IF NOT EXISTS idx_company_research_created_at ON company_research (created_at);
