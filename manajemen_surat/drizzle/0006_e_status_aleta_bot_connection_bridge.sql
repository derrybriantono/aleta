ALTER TABLE estatus_sync_logs
  ADD COLUMN IF NOT EXISTS connection_key TEXT NOT NULL DEFAULT 'sipp_primary';--> statement-breakpoint
ALTER TABLE estatus_records
  ADD COLUMN IF NOT EXISTS source_connection_key TEXT NOT NULL DEFAULT 'sipp_primary';--> statement-breakpoint
ALTER TABLE estatus_sipp_mappings
  ADD COLUMN IF NOT EXISTS connection_key TEXT NOT NULL DEFAULT 'sipp_primary';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_estatus_records_source_key_unique
  ON estatus_records(source_connection_key, source_case_id, kategori_perubahan)
  WHERE deleted_at IS NULL;--> statement-breakpoint
