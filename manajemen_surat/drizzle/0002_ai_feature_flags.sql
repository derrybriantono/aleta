ALTER TABLE "ai_global_settings" ADD COLUMN IF NOT EXISTS "feature_disposition_ai" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_global_settings" ADD COLUMN IF NOT EXISTS "feature_mail_intelligence" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_global_settings" ADD COLUMN IF NOT EXISTS "feature_draft_metadata" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_global_settings" ADD COLUMN IF NOT EXISTS "feature_manajemen_surat_ai" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_global_settings" ADD COLUMN IF NOT EXISTS "feature_disposisi_ai" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_global_settings" ADD COLUMN IF NOT EXISTS "feature_flags_json" text DEFAULT '{}' NOT NULL;
