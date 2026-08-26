ALTER TABLE estatus_agencies ADD COLUMN IF NOT EXISTS mou_valid_until TEXT;
ALTER TABLE estatus_agencies ADD COLUMN IF NOT EXISTS cooperation_pic_name TEXT NOT NULL DEFAULT '';
ALTER TABLE estatus_agencies ADD COLUMN IF NOT EXISTS cooperation_pic_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE estatus_agencies ADD COLUMN IF NOT EXISTS agreed_data_format TEXT NOT NULL DEFAULT '';
ALTER TABLE estatus_agencies ADD COLUMN IF NOT EXISTS cooperation_notes TEXT NOT NULL DEFAULT '';

ALTER TABLE estatus_transmission_logs ADD COLUMN IF NOT EXISTS processed_at TEXT;
ALTER TABLE estatus_transmission_logs ADD COLUMN IF NOT EXISTS rejected_at TEXT;
ALTER TABLE estatus_transmission_logs ADD COLUMN IF NOT EXISTS last_status_at TEXT;
ALTER TABLE estatus_transmission_logs ADD COLUMN IF NOT EXISTS feedback_note TEXT NOT NULL DEFAULT '';
ALTER TABLE estatus_transmission_logs ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE estatus_transmission_logs ADD COLUMN IF NOT EXISTS sla_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE estatus_transmission_logs ADD COLUMN IF NOT EXISTS retry_of_transmission_id TEXT;
ALTER TABLE estatus_transmission_logs ADD COLUMN IF NOT EXISTS resend_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE estatus_transmission_logs ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE estatus_transmission_logs ADD COLUMN IF NOT EXISTS updated_at TEXT;

ALTER TABLE estatus_documents ADD COLUMN IF NOT EXISTS verification_public_id TEXT NOT NULL DEFAULT '';
ALTER TABLE estatus_documents ADD COLUMN IF NOT EXISTS payload_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE estatus_documents ADD COLUMN IF NOT EXISTS watermark_text TEXT NOT NULL DEFAULT '';
ALTER TABLE estatus_documents ADD COLUMN IF NOT EXISTS document_status TEXT NOT NULL DEFAULT 'generated';

CREATE TABLE IF NOT EXISTS estatus_agency_feedbacks (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES estatus_batches(id),
  agency_id TEXT REFERENCES estatus_agencies(id),
  transmission_log_id TEXT REFERENCES estatus_transmission_logs(id),
  feedback_status TEXT NOT NULL,
  feedback_date TEXT NOT NULL,
  rejection_reason TEXT NOT NULL DEFAULT '',
  missing_fields_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  recorded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_estatus_transmission_logs_tracking ON estatus_transmission_logs(status, last_status_at, sla_days);
CREATE INDEX IF NOT EXISTS idx_estatus_agency_feedbacks_status ON estatus_agency_feedbacks(feedback_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estatus_documents_verification ON estatus_documents(verification_token_hash, document_status);
