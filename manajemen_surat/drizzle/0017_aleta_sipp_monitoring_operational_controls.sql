ALTER TABLE aleta_sipp_monitoring_manual_inputs ADD COLUMN IF NOT EXISTS evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE aleta_sipp_monitoring_manual_inputs ADD COLUMN IF NOT EXISTS submitted_at TEXT;
ALTER TABLE aleta_sipp_monitoring_manual_inputs ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES users(id);
ALTER TABLE aleta_sipp_monitoring_manual_inputs ADD COLUMN IF NOT EXISTS reviewed_at TEXT;
ALTER TABLE aleta_sipp_monitoring_manual_inputs ADD COLUMN IF NOT EXISTS review_notes TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_aleta_sipp_manual_inputs_status ON aleta_sipp_monitoring_manual_inputs(status, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_aleta_sipp_manual_inputs_indicator ON aleta_sipp_monitoring_manual_inputs(indicator_id, status, period_start, period_end);
