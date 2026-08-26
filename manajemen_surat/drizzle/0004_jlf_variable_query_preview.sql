ALTER TABLE jlf_variables
  ADD COLUMN IF NOT EXISTS sipp_query_preview TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sipp_query_preview_status TEXT NOT NULL DEFAULT 'not_generated',
  ADD COLUMN IF NOT EXISTS sipp_query_preview_key TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sipp_query_preview_generated_at TEXT;
