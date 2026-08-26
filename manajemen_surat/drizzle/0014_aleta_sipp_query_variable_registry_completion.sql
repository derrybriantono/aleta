ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS query_name TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS query_title TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS sub_category TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS business_purpose TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'AUTO_GENERATED';
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS source_file TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS source_location TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS source_line INTEGER;
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS parameterized_sql TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS sql_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS columns_used_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS parameters_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS outputs_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS related_table_names_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS related_variable_codes_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS related_variable_keys_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS execution_mode TEXT NOT NULL DEFAULT 'NEEDS_REVIEW';
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'NEEDS_ADMIN_REVIEW';
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS risk_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS usage_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS example_params JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS example_output JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS is_ai_usable SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS is_whatsapp_usable SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE aleta_sipp_query_registry ADD COLUMN IF NOT EXISTS is_pdf_usable SMALLINT NOT NULL DEFAULT 0;

UPDATE aleta_sipp_query_registry
SET query_name = COALESCE(NULLIF(query_name, ''), name),
    query_title = COALESCE(NULLIF(query_title, ''), name),
    source_type = CASE
      WHEN source ILIKE '%antrian%' THEN 'ANTRIAN_SIDANG'
      WHEN source ILIKE '%word%' THEN 'WORD_QUERY_DOCX'
      WHEN source ILIKE '%sk%' THEN 'SK_PENILAIAN_SIPP'
      WHEN source ILIKE '%struktur%' OR source ILIKE '%metadata%' THEN 'SIPP_METADATA'
      ELSE source_type
    END,
    parameterized_sql = COALESCE(NULLIF(parameterized_sql, ''), normalized_sql),
    sql_hash = COALESCE(NULLIF(sql_hash, ''), md5(COALESCE(NULLIF(normalized_sql, ''), original_sql, query_key))),
    related_table_names_json = CASE WHEN related_table_names_json = '[]'::jsonb THEN tables_json ELSE related_table_names_json END,
    outputs_json = CASE WHEN outputs_json = '[]'::jsonb THEN output_columns_json ELSE outputs_json END,
    execution_mode = CASE WHEN security_status = 'SAFE_READ_ONLY' THEN 'READY_READ_ONLY' ELSE execution_mode END,
    review_status = CASE WHEN security_status = 'SAFE_READ_ONLY' THEN 'AUTO_GENERATED' ELSE review_status END,
    is_ai_usable = CASE WHEN ai_allowed = 1 THEN 1 ELSE is_ai_usable END,
    is_whatsapp_usable = CASE WHEN whatsapp_allowed = 1 THEN 1 ELSE is_whatsapp_usable END,
    is_pdf_usable = CASE WHEN pdf_allowed = 1 THEN 1 ELSE is_pdf_usable END
WHERE query_name = '' OR query_title = '' OR source_type = 'AUTO_GENERATED' OR parameterized_sql = '' OR sql_hash = '';

ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS variable_key TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS legacy_number INTEGER;
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS short_description TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS long_description TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Lainnya';
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS variable_type TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS source_query_key TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS source_sql_fragment TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS placeholder_pattern TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS template_files_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS fallback_value TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS fallback_strategy TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS required SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS is_repeating SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS repeat_group TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS mapping_status TEXT NOT NULL DEFAULT 'UNRESOLVED';
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'NEEDS_ADMIN_REVIEW';
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS risk_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE aleta_sipp_variables ADD COLUMN IF NOT EXISTS usage_notes TEXT NOT NULL DEFAULT '';

UPDATE aleta_sipp_variables
SET variable_key = COALESCE(NULLIF(variable_key, ''), modern_key),
    legacy_number = COALESCE(legacy_number, NULLIF(regexp_replace(legacy_code, '[^0-9]', '', 'g'), '')::integer),
    short_description = COALESCE(NULLIF(short_description, ''), description),
    long_description = COALESCE(NULLIF(long_description, ''), description),
    placeholder_pattern = COALESCE(NULLIF(placeholder_pattern, ''), legacy_code),
    mapping_status = CASE
      WHEN status = 'MAPPED' THEN 'MAPPED_TO_TABLE_COLUMN'
      WHEN status = 'NEEDS_REVIEW' THEN 'UNRESOLVED'
      ELSE mapping_status
    END,
    review_status = CASE WHEN status = 'MAPPED' THEN 'AUTO_MAPPED' ELSE review_status END,
    confidence_score = CASE WHEN status = 'MAPPED' AND confidence_score = 0 THEN 85 ELSE confidence_score END
WHERE variable_key = '' OR short_description = '' OR placeholder_pattern = '';

CREATE TABLE IF NOT EXISTS aleta_sipp_query_table_links (
  id TEXT PRIMARY KEY,
  query_id TEXT NOT NULL REFERENCES aleta_sipp_query_registry(id) ON DELETE CASCADE,
  query_key TEXT NOT NULL,
  table_name TEXT NOT NULL,
  column_names_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  relation_role TEXT NOT NULL DEFAULT 'uses',
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_aleta_sipp_query_table_link UNIQUE (query_key, table_name)
);

CREATE TABLE IF NOT EXISTS aleta_sipp_query_variable_links (
  id TEXT PRIMARY KEY,
  query_id TEXT NOT NULL REFERENCES aleta_sipp_query_registry(id) ON DELETE CASCADE,
  variable_id TEXT REFERENCES aleta_sipp_variables(id) ON DELETE SET NULL,
  query_key TEXT NOT NULL,
  legacy_code TEXT NOT NULL DEFAULT '',
  variable_key TEXT NOT NULL DEFAULT '',
  mapping_status TEXT NOT NULL DEFAULT 'UNRESOLVED',
  source_context TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_aleta_sipp_query_variable_link UNIQUE (query_key, legacy_code, variable_key)
);

CREATE TABLE IF NOT EXISTS aleta_sipp_variable_template_links (
  id TEXT PRIMARY KEY,
  variable_id TEXT REFERENCES aleta_sipp_variables(id) ON DELETE CASCADE,
  legacy_code TEXT NOT NULL DEFAULT '',
  variable_key TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT '',
  source_file TEXT NOT NULL DEFAULT '',
  source_location TEXT NOT NULL DEFAULT '',
  usage_context TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_aleta_sipp_variable_template_link UNIQUE (legacy_code, variable_key, source_file, source_location)
);

CREATE TABLE IF NOT EXISTS aleta_sipp_unresolved_placeholders (
  id TEXT PRIMARY KEY,
  legacy_code TEXT NOT NULL,
  legacy_number INTEGER,
  source_type TEXT NOT NULL DEFAULT '',
  source_file TEXT NOT NULL DEFAULT '',
  source_location TEXT NOT NULL DEFAULT '',
  context_text TEXT NOT NULL DEFAULT '',
  suggested_variable_key TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'UNRESOLVED',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT uq_aleta_sipp_unresolved_placeholder UNIQUE (legacy_code, source_file, source_location)
);

CREATE TABLE IF NOT EXISTS aleta_sipp_variable_conflicts (
  id TEXT PRIMARY KEY,
  legacy_code TEXT NOT NULL,
  variable_key TEXT NOT NULL,
  conflict_type TEXT NOT NULL DEFAULT 'DUPLICATE_MAPPING',
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aleta_sipp_query_registry_source_type ON aleta_sipp_query_registry(source_type, is_active);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_query_registry_execution ON aleta_sipp_query_registry(execution_mode, security_status, review_status, is_active);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_query_registry_review ON aleta_sipp_query_registry(review_status, confidence_score);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_query_registry_sql_hash ON aleta_sipp_query_registry(sql_hash);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_variables_source ON aleta_sipp_variables(legacy_source, source_type, is_active);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_variables_mapping ON aleta_sipp_variables(mapping_status, review_status, is_active);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_variables_category ON aleta_sipp_variables(category, variable_type, is_active);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_variables_legacy_number ON aleta_sipp_variables(legacy_number);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_query_table_links_table ON aleta_sipp_query_table_links(table_name, query_key);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_query_variable_links_query ON aleta_sipp_query_variable_links(query_key, mapping_status);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_query_variable_links_variable ON aleta_sipp_query_variable_links(legacy_code, variable_key);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_variable_template_links_variable ON aleta_sipp_variable_template_links(legacy_code, variable_key);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_unresolved_placeholders_code ON aleta_sipp_unresolved_placeholders(legacy_code, status);
