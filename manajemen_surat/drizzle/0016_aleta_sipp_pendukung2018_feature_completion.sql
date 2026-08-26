CREATE TABLE IF NOT EXISTS aleta_sipp_legacy_feature_catalog (
  id TEXT PRIMARY KEY,
  feature_key TEXT NOT NULL UNIQUE,
  feature_code TEXT NOT NULL DEFAULT '',
  feature_name TEXT NOT NULL,
  group_key TEXT NOT NULL,
  group_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  source_type TEXT NOT NULL DEFAULT 'PENDUKUNG2018',
  source_files_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  implementation_status TEXT NOT NULL DEFAULT 'REFERENCE_ONLY',
  migration_status TEXT NOT NULL DEFAULT 'REFERENCE_ONLY',
  safety_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
  review_status TEXT NOT NULL DEFAULT 'NEEDS_ADMIN_REVIEW',
  related_query_key TEXT NOT NULL DEFAULT '',
  related_indicator_key TEXT NOT NULL DEFAULT '',
  tables_used_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  columns_used_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  period_type TEXT NOT NULL DEFAULT 'PERIODE_TANGGAL',
  calculation_mode TEXT NOT NULL DEFAULT 'REFERENCE_ONLY',
  result_type TEXT NOT NULL DEFAULT 'EXPORT_REFERENCE',
  no_query_reason TEXT NOT NULL DEFAULT '',
  requires_manual_input SMALLINT NOT NULL DEFAULT 0,
  external_dependency TEXT NOT NULL DEFAULT '',
  ui_route TEXT NOT NULL DEFAULT '',
  risk_notes TEXT NOT NULL DEFAULT '',
  recommendation_template TEXT NOT NULL DEFAULT '',
  admin_notes TEXT NOT NULL DEFAULT '',
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aleta_sipp_legacy_feature_group ON aleta_sipp_legacy_feature_catalog(group_key, sort_order);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_legacy_feature_status ON aleta_sipp_legacy_feature_catalog(implementation_status, safety_status, review_status, is_active);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_legacy_feature_query ON aleta_sipp_legacy_feature_catalog(related_query_key);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_legacy_feature_indicator ON aleta_sipp_legacy_feature_catalog(related_indicator_key);
