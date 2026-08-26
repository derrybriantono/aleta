ALTER TABLE estatus_records ADD COLUMN IF NOT EXISTS readiness_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE estatus_records ADD COLUMN IF NOT EXISTS readiness_reasons JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE estatus_records ADD COLUMN IF NOT EXISTS duplicate_status TEXT NOT NULL DEFAULT 'none';
ALTER TABLE estatus_records ADD COLUMN IF NOT EXISTS duplicate_group_key TEXT NOT NULL DEFAULT '';
ALTER TABLE estatus_records ADD COLUMN IF NOT EXISTS duplicate_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE estatus_records ADD COLUMN IF NOT EXISTS last_validated_rule_version TEXT NOT NULL DEFAULT '';

ALTER TABLE estatus_sipp_mappings ADD COLUMN IF NOT EXISTS detected_from_sql_sample SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE estatus_sipp_mappings ADD COLUMN IF NOT EXISTS source_sql_path TEXT NOT NULL DEFAULT '';
ALTER TABLE estatus_sipp_mappings ADD COLUMN IF NOT EXISTS query_preview TEXT NOT NULL DEFAULT '';
ALTER TABLE estatus_sipp_mappings ADD COLUMN IF NOT EXISTS query_preview_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE estatus_sipp_mappings ADD COLUMN IF NOT EXISTS last_dry_run_status TEXT NOT NULL DEFAULT 'not_run';
ALTER TABLE estatus_sipp_mappings ADD COLUMN IF NOT EXISTS last_dry_run_message TEXT NOT NULL DEFAULT '';

ALTER TABLE estatus_agencies ADD COLUMN IF NOT EXISTS required_fields_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE estatus_agencies ADD COLUMN IF NOT EXISTS export_template_json JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE estatus_agencies ADD COLUMN IF NOT EXISTS letter_template TEXT NOT NULL DEFAULT '';

ALTER TABLE estatus_validation_results ADD COLUMN IF NOT EXISTS rule_id TEXT;
ALTER TABLE estatus_validation_results ADD COLUMN IF NOT EXISTS is_configurable SMALLINT NOT NULL DEFAULT 0;

ALTER TABLE estatus_batches ADD COLUMN IF NOT EXISTS revision_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE estatus_batches ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE estatus_batches ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE estatus_batches ADD COLUMN IF NOT EXISTS cancelled_at TEXT;
ALTER TABLE estatus_batches ADD COLUMN IF NOT EXISTS revision_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS estatus_sipp_schema_snapshots (
  id TEXT PRIMARY KEY,
  connection_key TEXT NOT NULL DEFAULT 'sipp_primary',
  source_sql_path TEXT NOT NULL DEFAULT '',
  schema_hash TEXT NOT NULL,
  detected_tables_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_mappings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  dangerous_sql_findings_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS estatus_agency_templates (
  id TEXT PRIMARY KEY,
  agency_id TEXT REFERENCES estatus_agencies(id),
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'ALL',
  format TEXT NOT NULL DEFAULT 'xlsx',
  required_fields_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  columns_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  body_template TEXT NOT NULL DEFAULT '',
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_estatus_sipp_schema_snapshots_created ON estatus_sipp_schema_snapshots(created_at DESC, connection_key);
CREATE INDEX IF NOT EXISTS idx_estatus_records_readiness ON estatus_records(readiness_score DESC, duplicate_status, workflow_status);
CREATE INDEX IF NOT EXISTS idx_estatus_agency_templates_agency ON estatus_agency_templates(agency_id, template_type, is_active);
