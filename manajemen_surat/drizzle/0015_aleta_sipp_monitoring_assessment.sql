CREATE TABLE IF NOT EXISTS aleta_sipp_monitoring_sources (
  id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_path TEXT NOT NULL DEFAULT '',
  source_version TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_import_job_id TEXT,
  last_imported_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_monitoring_categories (
  id TEXT PRIMARY KEY,
  category_key TEXT NOT NULL UNIQUE,
  category_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_monitoring_indicators (
  id TEXT PRIMARY KEY,
  indicator_key TEXT NOT NULL UNIQUE,
  indicator_code TEXT NOT NULL DEFAULT '',
  indicator_name TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL,
  source_file TEXT NOT NULL DEFAULT '',
  source_location TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Lainnya',
  sub_category TEXT NOT NULL DEFAULT '',
  period_type TEXT NOT NULL DEFAULT 'PERIODE_TANGGAL',
  formula_text TEXT NOT NULL DEFAULT '',
  formula_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  weight DOUBLE PRECISION NOT NULL DEFAULT 0,
  max_score DOUBLE PRECISION NOT NULL DEFAULT 100,
  threshold_green DOUBLE PRECISION,
  threshold_yellow DOUBLE PRECISION,
  threshold_red DOUBLE PRECISION,
  query_key TEXT NOT NULL DEFAULT '',
  query_id TEXT REFERENCES aleta_sipp_query_registry(id),
  tables_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  columns_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_scope TEXT NOT NULL DEFAULT '',
  result_type TEXT NOT NULL DEFAULT 'SCORE',
  calculation_mode TEXT NOT NULL DEFAULT 'QUERY_REGISTRY',
  safety_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
  review_status TEXT NOT NULL DEFAULT 'NEEDS_ADMIN_REVIEW',
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  risk_notes TEXT NOT NULL DEFAULT '',
  recommendation_template TEXT NOT NULL DEFAULT '',
  sk_basis TEXT NOT NULL DEFAULT '',
  assumption_notes TEXT NOT NULL DEFAULT '',
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_monitoring_indicator_mappings (
  id TEXT PRIMARY KEY,
  source_indicator_id TEXT NOT NULL REFERENCES aleta_sipp_monitoring_indicators(id) ON DELETE CASCADE,
  target_indicator_id TEXT NOT NULL REFERENCES aleta_sipp_monitoring_indicators(id) ON DELETE CASCADE,
  mapping_type TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
  similarity_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL DEFAULT 'NEEDS_ADMIN_REVIEW',
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_aleta_sipp_monitoring_indicator_mapping UNIQUE (source_indicator_id, target_indicator_id)
);

CREATE TABLE IF NOT EXISTS aleta_sipp_monitoring_runs (
  id TEXT PRIMARY KEY,
  run_key TEXT NOT NULL UNIQUE,
  run_name TEXT NOT NULL,
  run_type TEXT NOT NULL,
  year INTEGER,
  quarter INTEGER,
  date_start TEXT NOT NULL,
  date_end TEXT NOT NULL,
  datasource_mode TEXT NOT NULL DEFAULT 'SNAPSHOT_CACHE',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  total_indicators INTEGER NOT NULL DEFAULT 0,
  completed_indicators INTEGER NOT NULL DEFAULT 0,
  failed_indicators INTEGER NOT NULL DEFAULT 0,
  score_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  score_max DOUBLE PRECISION NOT NULL DEFAULT 0,
  score_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  green_count INTEGER NOT NULL DEFAULT 0,
  yellow_count INTEGER NOT NULL DEFAULT 0,
  red_count INTEGER NOT NULL DEFAULT 0,
  needs_review_count INTEGER NOT NULL DEFAULT 0,
  data_not_enough_count INTEGER NOT NULL DEFAULT 0,
  manual_input_count INTEGER NOT NULL DEFAULT 0,
  query_not_ready_count INTEGER NOT NULL DEFAULT 0,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TEXT,
  finished_at TEXT,
  created_by TEXT REFERENCES users(id),
  error_message TEXT,
  audit_log_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_monitoring_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES aleta_sipp_monitoring_runs(id) ON DELETE CASCADE,
  indicator_id TEXT NOT NULL REFERENCES aleta_sipp_monitoring_indicators(id),
  query_key TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
  numerator DOUBLE PRECISION,
  denominator DOUBLE PRECISION,
  raw_value DOUBLE PRECISION,
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  max_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  score_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  weight DOUBLE PRECISION NOT NULL DEFAULT 0,
  weighted_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  result_summary TEXT NOT NULL DEFAULT '',
  recommendation TEXT NOT NULL DEFAULT '',
  error_message TEXT,
  calculated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT uq_aleta_sipp_monitoring_results_run_indicator UNIQUE (run_id, indicator_id)
);

CREATE TABLE IF NOT EXISTS aleta_sipp_monitoring_result_items (
  id TEXT PRIMARY KEY,
  result_id TEXT NOT NULL REFERENCES aleta_sipp_monitoring_results(id) ON DELETE CASCADE,
  perkara_id TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  item_type TEXT NOT NULL,
  item_title TEXT NOT NULL,
  item_description TEXT NOT NULL DEFAULT '',
  item_status TEXT NOT NULL DEFAULT 'BELUM_DITINDAKLANJUTI',
  responsible_role TEXT NOT NULL DEFAULT '',
  responsible_name TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  source_table TEXT NOT NULL DEFAULT '',
  source_data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation TEXT NOT NULL DEFAULT '',
  followup_status TEXT NOT NULL DEFAULT 'BELUM_DITINDAKLANJUTI',
  admin_notes TEXT NOT NULL DEFAULT '',
  completed_at TEXT,
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_monitoring_jobs (
  id TEXT PRIMARY KEY,
  job_key TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL,
  source_path TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'RUNNING',
  total_items INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  warning_count INTEGER NOT NULL DEFAULT 0,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_monitoring_manual_inputs (
  id TEXT PRIMARY KEY,
  indicator_id TEXT NOT NULL REFERENCES aleta_sipp_monitoring_indicators(id) ON DELETE CASCADE,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_monitoring_exports (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES aleta_sipp_monitoring_runs(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PLACEHOLDER',
  file_path TEXT NOT NULL DEFAULT '',
  error_message TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aleta_sipp_monitoring_sources_type ON aleta_sipp_monitoring_sources(source_type, status);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_monitoring_indicators_source ON aleta_sipp_monitoring_indicators(source_type, is_active);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_monitoring_indicators_status ON aleta_sipp_monitoring_indicators(safety_status, review_status, is_active);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_monitoring_indicators_category ON aleta_sipp_monitoring_indicators(category, source_type, is_active);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_monitoring_indicators_query ON aleta_sipp_monitoring_indicators(query_key);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_monitoring_mappings_source ON aleta_sipp_monitoring_indicator_mappings(source_indicator_id, mapping_type);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_monitoring_runs_type_period ON aleta_sipp_monitoring_runs(run_type, year, quarter, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_monitoring_results_run_status ON aleta_sipp_monitoring_results(run_id, status);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_monitoring_items_result_status ON aleta_sipp_monitoring_result_items(result_id, item_status, followup_status);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_monitoring_jobs_type_status ON aleta_sipp_monitoring_jobs(job_type, status, created_at DESC);
