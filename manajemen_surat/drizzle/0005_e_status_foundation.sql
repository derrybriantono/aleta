CREATE TABLE IF NOT EXISTS estatus_sipp_connections (
  id TEXT PRIMARY KEY,
  connection_name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 3306,
  database_name TEXT NOT NULL,
  username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL DEFAULT '',
  password_secret_ref TEXT NOT NULL DEFAULT '',
  driver TEXT NOT NULL DEFAULT 'mysql',
  charset TEXT NOT NULL DEFAULT 'utf8mb4',
  connection_mode TEXT NOT NULL DEFAULT 'bridge',
  readonly_enforced SMALLINT NOT NULL DEFAULT 1,
  sync_schedule_cron TEXT NOT NULL DEFAULT '',
  is_active SMALLINT NOT NULL DEFAULT 1,
  last_test_status TEXT NOT NULL DEFAULT 'idle',
  last_test_message TEXT,
  last_test_at TEXT,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS estatus_sipp_mappings (
  id TEXT PRIMARY KEY,
  connection_id TEXT REFERENCES estatus_sipp_connections(id),
  mapping_version TEXT NOT NULL,
  source_schema_hash TEXT NOT NULL DEFAULT '',
  entity_key TEXT NOT NULL,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL DEFAULT '',
  join_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_active SMALLINT NOT NULL DEFAULT 1,
  verified_by TEXT REFERENCES users(id),
  verified_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS estatus_sync_logs (
  id TEXT PRIMARY KEY,
  connection_id TEXT REFERENCES estatus_sipp_connections(id),
  sync_type TEXT NOT NULL,
  sync_scope TEXT NOT NULL DEFAULT 'all',
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  total_scanned INTEGER NOT NULL DEFAULT 0,
  total_candidates INTEGER NOT NULL DEFAULT 0,
  total_inserted INTEGER NOT NULL DEFAULT 0,
  total_updated INTEGER NOT NULL DEFAULT 0,
  total_errors INTEGER NOT NULL DEFAULT 0,
  structure_hash TEXT NOT NULL DEFAULT '',
  query_hash TEXT NOT NULL DEFAULT '',
  error_message TEXT,
  executed_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS estatus_agencies (
  id TEXT PRIMARY KEY,
  agency_type TEXT NOT NULL,
  agency_name TEXT NOT NULL,
  wilayah TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  contact_person TEXT NOT NULL DEFAULT '',
  official_email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  delivery_method TEXT NOT NULL DEFAULT 'manual',
  api_endpoint TEXT NOT NULL DEFAULT '',
  api_key_encrypted TEXT NOT NULL DEFAULT '',
  sftp_host TEXT NOT NULL DEFAULT '',
  sftp_username TEXT NOT NULL DEFAULT '',
  sftp_secret_ref TEXT NOT NULL DEFAULT '',
  is_active SMALLINT NOT NULL DEFAULT 1,
  cooperation_status TEXT NOT NULL DEFAULT 'draft',
  mou_number TEXT NOT NULL DEFAULT '',
  mou_date TEXT,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS estatus_records (
  id TEXT PRIMARY KEY,
  source_connection_id TEXT REFERENCES estatus_sipp_connections(id),
  source_case_id TEXT NOT NULL,
  nomor_perkara TEXT NOT NULL,
  jenis_perkara TEXT NOT NULL,
  kategori_perubahan TEXT NOT NULL,
  status_hukum TEXT NOT NULL DEFAULT '',
  tanggal_pendaftaran TEXT,
  tanggal_putusan TEXT,
  tanggal_bht TEXT,
  tanggal_ikrar_talak TEXT,
  nomor_akta_cerai TEXT,
  tanggal_akta_cerai TEXT,
  amar_ringkas TEXT NOT NULL DEFAULT '',
  source_hash TEXT NOT NULL,
  source_last_changed_at TEXT,
  validation_status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
  workflow_status TEXT NOT NULL DEFAULT 'CANDIDATE',
  destination_agency_id TEXT REFERENCES estatus_agencies(id),
  already_sent SMALLINT NOT NULL DEFAULT 0,
  excluded_reason TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS estatus_parties (
  id TEXT PRIMARY KEY,
  estatus_record_id TEXT NOT NULL REFERENCES estatus_records(id) ON DELETE CASCADE,
  party_role TEXT NOT NULL,
  nama TEXT NOT NULL DEFAULT '',
  nik TEXT NOT NULL DEFAULT '',
  nomor_kk TEXT NOT NULL DEFAULT '',
  tempat_lahir TEXT NOT NULL DEFAULT '',
  tanggal_lahir TEXT,
  jenis_kelamin TEXT NOT NULL DEFAULT '',
  alamat TEXT NOT NULL DEFAULT '',
  desa_kelurahan TEXT NOT NULL DEFAULT '',
  kecamatan TEXT NOT NULL DEFAULT '',
  kabupaten_kota TEXT NOT NULL DEFAULT '',
  provinsi TEXT NOT NULL DEFAULT '',
  agama TEXT NOT NULL DEFAULT '',
  status_kawin_lama TEXT NOT NULL DEFAULT '',
  status_kawin_baru TEXT NOT NULL DEFAULT '',
  pasangan_nama TEXT NOT NULL DEFAULT '',
  pasangan_nik TEXT NOT NULL DEFAULT '',
  data_source TEXT NOT NULL DEFAULT 'SIPP',
  manual_override SMALLINT NOT NULL DEFAULT 0,
  quality_score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS estatus_validation_rules (
  id TEXT PRIMARY KEY,
  rule_code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  change_type TEXT NOT NULL,
  label TEXT NOT NULL,
  severity TEXT NOT NULL,
  expression JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_blocking SMALLINT NOT NULL DEFAULT 0,
  is_active SMALLINT NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS estatus_validation_results (
  id TEXT PRIMARY KEY,
  estatus_record_id TEXT NOT NULL REFERENCES estatus_records(id) ON DELETE CASCADE,
  validation_code TEXT NOT NULL,
  validation_level TEXT NOT NULL,
  validation_message TEXT NOT NULL,
  field_path TEXT NOT NULL DEFAULT '',
  is_resolved SMALLINT NOT NULL DEFAULT 0,
  resolved_by TEXT REFERENCES users(id),
  resolved_at TEXT,
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS estatus_batches (
  id TEXT PRIMARY KEY,
  batch_number TEXT NOT NULL UNIQUE,
  batch_type TEXT NOT NULL,
  destination_agency_id TEXT REFERENCES estatus_agencies(id),
  status TEXT NOT NULL DEFAULT 'DRAFT',
  total_records INTEGER NOT NULL DEFAULT 0,
  data_snapshot_hash TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id),
  reviewed_by TEXT REFERENCES users(id),
  approved_by TEXT REFERENCES users(id),
  approved_at TEXT,
  sent_by TEXT REFERENCES users(id),
  sent_at TEXT,
  locked_at TEXT,
  revision_of_batch_id TEXT REFERENCES estatus_batches(id),
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS estatus_batch_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES estatus_batches(id) ON DELETE CASCADE,
  estatus_record_id TEXT NOT NULL REFERENCES estatus_records(id),
  item_status TEXT NOT NULL DEFAULT 'DRAFT',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS estatus_record_snapshots (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES estatus_batches(id) ON DELETE CASCADE,
  estatus_record_id TEXT NOT NULL REFERENCES estatus_records(id),
  snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS estatus_transmission_logs (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES estatus_batches(id),
  agency_id TEXT REFERENCES estatus_agencies(id),
  method TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL DEFAULT '',
  request_payload_hash TEXT NOT NULL DEFAULT '',
  response_code TEXT NOT NULL DEFAULT '',
  response_message TEXT NOT NULL DEFAULT '',
  sent_at TEXT,
  received_at TEXT,
  completed_at TEXT,
  receipt_number TEXT NOT NULL DEFAULT '',
  receipt_file_path TEXT NOT NULL DEFAULT '',
  error_message TEXT,
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS estatus_documents (
  id TEXT PRIMARY KEY,
  batch_id TEXT REFERENCES estatus_batches(id),
  record_id TEXT REFERENCES estatus_records(id),
  document_type TEXT NOT NULL,
  document_number TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  qr_code TEXT NOT NULL DEFAULT '',
  verification_token_hash TEXT NOT NULL DEFAULT '',
  generated_by TEXT REFERENCES users(id),
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS estatus_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  old_value_hash TEXT NOT NULL DEFAULT '',
  new_value_hash TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_estatus_records_source_unique
  ON estatus_records(source_connection_id, source_case_id, kategori_perubahan)
  WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_estatus_records_workflow
  ON estatus_records(workflow_status, validation_status, kategori_perubahan);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_estatus_parties_record
  ON estatus_parties(estatus_record_id, party_role);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_estatus_parties_nik
  ON estatus_parties(nik);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_estatus_batches_status
  ON estatus_batches(status, batch_type, created_at);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_estatus_batch_items_unique
  ON estatus_batch_items(batch_id, estatus_record_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_estatus_transmission_logs_batch
  ON estatus_transmission_logs(batch_id, status, created_at);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_estatus_audit_logs_created
  ON estatus_audit_logs(created_at, action, entity_type);
