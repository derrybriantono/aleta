CREATE TABLE IF NOT EXISTS aleta_sipp_tables (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL UNIQUE,
  human_name TEXT NOT NULL,
  category TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 3,
  short_description TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
  function_in_case_process TEXT NOT NULL DEFAULT '',
  table_kind TEXT NOT NULL DEFAULT 'pendukung',
  source_schema_hash TEXT NOT NULL DEFAULT '',
  risk_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  example_usage TEXT NOT NULL DEFAULT '',
  example_query_key TEXT NOT NULL DEFAULT '',
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_columns (
  id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES aleta_sipp_tables(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  human_name TEXT NOT NULL DEFAULT '',
  data_type TEXT NOT NULL DEFAULT '',
  is_nullable SMALLINT NOT NULL DEFAULT 1,
  is_primary_key SMALLINT NOT NULL DEFAULT 0,
  is_indexed SMALLINT NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  example_value TEXT NOT NULL DEFAULT '',
  relation_hint TEXT NOT NULL DEFAULT '',
  query_usage_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality_notes TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_aleta_sipp_columns_table_column UNIQUE (table_name, column_name)
);

CREATE TABLE IF NOT EXISTS aleta_sipp_relations (
  id TEXT PRIMARY KEY,
  source_table_id TEXT REFERENCES aleta_sipp_tables(id) ON DELETE CASCADE,
  source_table TEXT NOT NULL,
  source_column TEXT NOT NULL,
  target_table_id TEXT REFERENCES aleta_sipp_tables(id) ON DELETE CASCADE,
  target_table TEXT NOT NULL,
  target_column TEXT NOT NULL DEFAULT 'id',
  relation_type TEXT NOT NULL DEFAULT 'inferred',
  confidence TEXT NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL DEFAULT '',
  example_query_key TEXT NOT NULL DEFAULT '',
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_query_registry (
  id TEXT PRIMARY KEY,
  query_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  long_description TEXT NOT NULL DEFAULT '',
  tables_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_columns_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  original_sql TEXT NOT NULL DEFAULT '',
  normalized_sql TEXT NOT NULL DEFAULT '',
  security_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
  role_scope_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_allowed SMALLINT NOT NULL DEFAULT 0,
  whatsapp_allowed SMALLINT NOT NULL DEFAULT 0,
  pdf_allowed SMALLINT NOT NULL DEFAULT 0,
  risk_notes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_query_parameters (
  id TEXT PRIMARY KEY,
  query_id TEXT NOT NULL REFERENCES aleta_sipp_query_registry(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  data_type TEXT NOT NULL,
  required SMALLINT NOT NULL DEFAULT 0,
  default_value TEXT NOT NULL DEFAULT '',
  validation_rule TEXT NOT NULL DEFAULT '',
  example_value TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_aleta_sipp_query_parameters_query_name UNIQUE (query_id, name)
);

CREATE TABLE IF NOT EXISTS aleta_sipp_query_outputs (
  id TEXT PRIMARY KEY,
  query_id TEXT NOT NULL REFERENCES aleta_sipp_query_registry(id) ON DELETE CASCADE,
  column_name TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  data_type TEXT NOT NULL DEFAULT 'text',
  description TEXT NOT NULL DEFAULT '',
  sensitive SMALLINT NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_aleta_sipp_query_outputs_query_column UNIQUE (query_id, column_name)
);

CREATE TABLE IF NOT EXISTS aleta_sipp_variables (
  id TEXT PRIMARY KEY,
  legacy_source TEXT NOT NULL DEFAULT '',
  legacy_code TEXT NOT NULL DEFAULT '',
  modern_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  data_type TEXT NOT NULL DEFAULT 'text',
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_table TEXT NOT NULL DEFAULT '',
  source_column TEXT NOT NULL DEFAULT '',
  query_id TEXT REFERENCES aleta_sipp_query_registry(id),
  transform_key TEXT NOT NULL DEFAULT '',
  example_value TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
  sensitive SMALLINT NOT NULL DEFAULT 0,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aleta_sipp_variables_legacy_scoped ON aleta_sipp_variables(legacy_source, legacy_code);

CREATE TABLE IF NOT EXISTS aleta_sipp_variable_mappings (
  id TEXT PRIMARY KEY,
  variable_id TEXT NOT NULL REFERENCES aleta_sipp_variables(id) ON DELETE CASCADE,
  legacy_source TEXT NOT NULL,
  legacy_code TEXT NOT NULL,
  modern_key TEXT NOT NULL,
  mapping_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
  template_usage_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_aleta_sipp_variable_mappings_key UNIQUE (legacy_source, legacy_code, modern_key)
);

CREATE TABLE IF NOT EXISTS aleta_sipp_import_jobs (
  id TEXT PRIMARY KEY,
  import_type TEXT NOT NULL,
  source_path TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'dry_run',
  status TEXT NOT NULL DEFAULT 'PENDING',
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  executed_by TEXT REFERENCES users(id),
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_import_job_items (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES aleta_sipp_import_jobs(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  source_key TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  warning_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_assessment_indicators (
  id TEXT PRIMARY KEY,
  indicator_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sk_basis TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  weight DOUBLE PRECISION NOT NULL DEFAULT 0,
  formula TEXT NOT NULL DEFAULT '',
  source_tables_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  query_id TEXT REFERENCES aleta_sipp_query_registry(id),
  parameter_period TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DATA_TIDAK_CUKUP',
  assumption_notes TEXT NOT NULL DEFAULT '',
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_assessment_queries (
  id TEXT PRIMARY KEY,
  indicator_id TEXT NOT NULL REFERENCES aleta_sipp_assessment_indicators(id) ON DELETE CASCADE,
  query_id TEXT REFERENCES aleta_sipp_query_registry(id),
  query_role TEXT NOT NULL DEFAULT 'score',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_assessment_runs (
  id TEXT PRIMARY KEY,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  total_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  executed_by TEXT REFERENCES users(id),
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_assessment_results (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES aleta_sipp_assessment_runs(id) ON DELETE CASCADE,
  indicator_id TEXT NOT NULL REFERENCES aleta_sipp_assessment_indicators(id),
  score DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DATA_TIDAK_CUKUP',
  result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  CONSTRAINT uq_aleta_sipp_assessment_results_run_indicator UNIQUE (run_id, indicator_id)
);

CREATE TABLE IF NOT EXISTS aleta_sipp_assessment_result_items (
  id TEXT PRIMARY KEY,
  result_id TEXT NOT NULL REFERENCES aleta_sipp_assessment_results(id) ON DELETE CASCADE,
  nomor_perkara TEXT NOT NULL DEFAULT '',
  source_case_id TEXT NOT NULL DEFAULT '',
  issue_code TEXT NOT NULL DEFAULT '',
  issue_description TEXT NOT NULL DEFAULT '',
  recommendation TEXT NOT NULL DEFAULT '',
  item_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_pdf_templates (
  id TEXT PRIMARY KEY,
  template_key TEXT NOT NULL,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'jadwal_sidang',
  layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  query_key TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_ai_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  feature TEXT NOT NULL,
  prompt_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_user_saved_queries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_id TEXT REFERENCES aleta_sipp_query_registry(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parameters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aleta_sipp_query_favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_id TEXT NOT NULL REFERENCES aleta_sipp_query_registry(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  CONSTRAINT uq_aleta_sipp_query_favorites_user_query UNIQUE (user_id, query_id)
);

CREATE INDEX IF NOT EXISTS idx_aleta_sipp_tables_category ON aleta_sipp_tables(category, priority);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_columns_table ON aleta_sipp_columns(table_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_relations_source_target ON aleta_sipp_relations(source_table, target_table);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_query_registry_status ON aleta_sipp_query_registry(security_status, is_active);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_import_jobs_status ON aleta_sipp_import_jobs(import_type, status, created_at);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_assessment_indicators_category ON aleta_sipp_assessment_indicators(category, status);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_assessment_runs_period ON aleta_sipp_assessment_runs(period_start, period_end, status);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_audit_logs_created ON aleta_sipp_audit_logs(created_at, action, entity_type);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_audit_logs_query ON aleta_sipp_audit_logs(query_key);
