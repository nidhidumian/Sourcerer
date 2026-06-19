PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  auth_provider TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS searches (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  domain TEXT NOT NULL,
  geography TEXT NOT NULL,
  profile_json TEXT,
  queries_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS saved_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  search_id TEXT,
  event_title TEXT NOT NULL,
  event_url TEXT NOT NULL,
  event_organizer TEXT,
  event_city TEXT,
  event_country TEXT,
  event_start_date TEXT,
  event_end_date TEXT,
  event_type TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (search_id) REFERENCES searches (id) ON DELETE SET NULL,
  UNIQUE (user_id, event_url)
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event_name TEXT NOT NULL,
  properties_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_searches_user_id ON searches (user_id);
CREATE INDEX IF NOT EXISTS idx_searches_domain_geography ON searches (domain, geography);
CREATE INDEX IF NOT EXISTS idx_saved_events_user_id ON saved_events (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_events_search_id ON saved_events (search_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events (user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events (event_name);
