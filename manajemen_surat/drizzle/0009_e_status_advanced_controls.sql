CREATE TABLE IF NOT EXISTS estatus_file_exchange_logs (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES estatus_batches(id),
  document_id TEXT REFERENCES estatus_documents(id),
  exchange_method TEXT NOT NULL DEFAULT 'manual_encrypted_file',
  encryption_status TEXT NOT NULL DEFAULT 'not_encrypted',
  encryption_algorithm TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL DEFAULT '',
  package_hash TEXT NOT NULL DEFAULT '',
  sftp_host TEXT NOT NULL DEFAULT '',
  destination_path TEXT NOT NULL DEFAULT '',
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at TEXT,
  downloaded_by TEXT REFERENCES users(id),
  receipt_file_path TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'prepared',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS estatus_api_integrations (
  id TEXT PRIMARY KEY,
  agency_id TEXT REFERENCES estatus_agencies(id),
  integration_name TEXT NOT NULL,
  api_base_url TEXT NOT NULL DEFAULT '',
  auth_type TEXT NOT NULL DEFAULT 'token',
  token_secret_ref TEXT NOT NULL DEFAULT '',
  signature_secret_ref TEXT NOT NULL DEFAULT '',
  ip_whitelist_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 30,
  is_active SMALLINT NOT NULL DEFAULT 0,
  last_test_status TEXT NOT NULL DEFAULT 'idle',
  last_test_at TEXT,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS estatus_api_requests (
  id TEXT PRIMARY KEY,
  batch_id TEXT REFERENCES estatus_batches(id),
  agency_id TEXT REFERENCES estatus_agencies(id),
  integration_id TEXT REFERENCES estatus_api_integrations(id),
  endpoint_path TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT 'POST',
  status TEXT NOT NULL DEFAULT 'draft',
  idempotency_key TEXT NOT NULL DEFAULT '',
  request_hash TEXT NOT NULL DEFAULT '',
  response_code TEXT NOT NULL DEFAULT '',
  response_message TEXT NOT NULL DEFAULT '',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  callback_received_at TEXT,
  callback_status TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS estatus_ai_assist_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  feature TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  input_hash TEXT NOT NULL DEFAULT '',
  output_text TEXT NOT NULL DEFAULT '',
  guardrails_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS estatus_incident_logs (
  id TEXT PRIMARY KEY,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  batch_id TEXT REFERENCES estatus_batches(id),
  record_id TEXT REFERENCES estatus_records(id),
  agency_id TEXT REFERENCES estatus_agencies(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  impact_summary TEXT NOT NULL DEFAULT '',
  containment_action TEXT NOT NULL DEFAULT '',
  reported_by TEXT REFERENCES users(id),
  resolved_by TEXT REFERENCES users(id),
  resolved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS estatus_data_minimization_findings (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  field_name TEXT NOT NULL DEFAULT '',
  finding_level TEXT NOT NULL DEFAULT 'warning',
  finding_code TEXT NOT NULL,
  message TEXT NOT NULL,
  is_resolved SMALLINT NOT NULL DEFAULT 0,
  resolved_by TEXT REFERENCES users(id),
  resolved_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_estatus_file_exchange_logs_batch ON estatus_file_exchange_logs(batch_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estatus_api_integrations_agency ON estatus_api_integrations(agency_id, is_active);
CREATE INDEX IF NOT EXISTS idx_estatus_api_requests_tracking ON estatus_api_requests(status, next_retry_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estatus_ai_assist_logs_feature ON estatus_ai_assist_logs(feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estatus_incident_logs_status ON estatus_incident_logs(status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estatus_data_minimization_findings_entity ON estatus_data_minimization_findings(entity_type, entity_id, is_resolved);
