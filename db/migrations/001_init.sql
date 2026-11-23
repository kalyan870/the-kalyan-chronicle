-- The Kalyan Chronicle — Durable Relational Schema (Neon PostgreSQL)
-- Run automatically via src/server/neonDb.ts or psql "$DATABASE_URL" -f db/migrations/001_init.sql

CREATE TABLE IF NOT EXISTS chronicle_editions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  author_user_id TEXT NOT NULL,
  r2_object_key TEXT NOT NULL,
  storage_backend TEXT NOT NULL DEFAULT 'neon-r2',
  repo_count INTEGER NOT NULL DEFAULT 0,
  commit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chronicle_media_assets (
  id TEXT PRIMARY KEY,
  edition_id TEXT REFERENCES chronicle_editions(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL DEFAULT 0,
  r2_object_key TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chronicle_newsletter_logs (
  id TEXT PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  resend_message_id TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chronicle_automation_runs (
  id TEXT PRIMARY KEY,
  trigger_source TEXT NOT NULL,
  status TEXT NOT NULL,
  edition_key TEXT NOT NULL DEFAULT '',
  commit_count INTEGER NOT NULL DEFAULT 0,
  substack_count INTEGER NOT NULL DEFAULT 0,
  newsletter_sent BOOLEAN NOT NULL DEFAULT FALSE,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chronicle_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chronicle_rag_memories (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chronicle_editions_created_at
  ON chronicle_editions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chronicle_media_created_at
  ON chronicle_media_assets (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chronicle_newsletter_created_at
  ON chronicle_newsletter_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chronicle_automation_created_at
  ON chronicle_automation_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chronicle_subscribers_created_at
  ON chronicle_subscribers (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chronicle_rag_memories_session_created
  ON chronicle_rag_memories (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chronicle_user_accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chronicle_storage_objects (
  object_key TEXT PRIMARY KEY,
  bucket TEXT NOT NULL DEFAULT 'chronicle-backend',
  content_type TEXT NOT NULL DEFAULT 'application/json',
  byte_size INTEGER NOT NULL DEFAULT 0,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  checksum_sha256 TEXT NOT NULL DEFAULT '',
  owner_user_id TEXT NOT NULL,
  storage_backend TEXT NOT NULL DEFAULT 'backend-sql',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chronicle_auth_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_key TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chronicle_storage_objects_updated
  ON chronicle_storage_objects (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_chronicle_auth_events_created
  ON chronicle_auth_events (created_at DESC);

