CREATE TABLE IF NOT EXISTS external_app_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  app_id TEXT NOT NULL CHECK (app_id IN ('sipp', 'aps-badilag')),
  external_username TEXT NOT NULL DEFAULT '',
  encrypted_password TEXT NOT NULL DEFAULT '',
  password_md5_hash TEXT NOT NULL DEFAULT '',
  is_enabled SMALLINT NOT NULL DEFAULT 0,
  last_verified_at TEXT,
  last_verified_status TEXT NOT NULL DEFAULT 'not_tested',
  last_launch_at TEXT,
  password_updated_at TEXT,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_external_app_credentials_user_app UNIQUE (user_id, app_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_external_app_credentials_app_enabled
  ON external_app_credentials(app_id, is_enabled);
