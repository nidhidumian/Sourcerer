PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS events_cache (
  id TEXT PRIMARY KEY,
  search_id TEXT,
  domain TEXT NOT NULL,
  geography TEXT NOT NULL,
  events_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (search_id) REFERENCES searches (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_events_cache_search_id ON events_cache (search_id);
CREATE INDEX IF NOT EXISTS idx_events_cache_domain_geography ON events_cache (domain, geography);
