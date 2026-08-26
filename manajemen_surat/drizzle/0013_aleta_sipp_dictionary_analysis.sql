ALTER TABLE aleta_sipp_tables ADD COLUMN IF NOT EXISTS business_function TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_tables ADD COLUMN IF NOT EXISTS main_columns_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_tables ADD COLUMN IF NOT EXISTS relation_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_tables ADD COLUMN IF NOT EXISTS usage_examples JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aleta_sipp_tables ADD COLUMN IF NOT EXISTS data_quality_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_tables ADD COLUMN IF NOT EXISTS analysis_status TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE aleta_sipp_tables ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE aleta_sipp_tables ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'NEEDS_ADMIN_REVIEW';
ALTER TABLE aleta_sipp_tables ADD COLUMN IF NOT EXISTS review_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_tables ADD COLUMN IF NOT EXISTS analyzed_at TEXT;
ALTER TABLE aleta_sipp_tables ADD COLUMN IF NOT EXISTS reviewed_at TEXT;
ALTER TABLE aleta_sipp_tables ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES users(id);

ALTER TABLE aleta_sipp_columns ADD COLUMN IF NOT EXISTS default_value TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_columns ADD COLUMN IF NOT EXISTS usage_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_columns ADD COLUMN IF NOT EXISTS analysis_status TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE aleta_sipp_columns ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_aleta_sipp_tables_analysis_status ON aleta_sipp_tables(analysis_status, review_status, is_active);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_tables_category_analysis ON aleta_sipp_tables(category, analysis_status, priority);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_columns_analysis_status ON aleta_sipp_columns(table_name, analysis_status);
