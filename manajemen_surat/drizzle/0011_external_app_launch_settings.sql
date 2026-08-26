ALTER TABLE panel_settings ADD COLUMN IF NOT EXISTS external_apps_json TEXT NOT NULL DEFAULT '{}';
