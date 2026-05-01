CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" text,
	"refresh_token_expires_at" text,
	"scope" text,
	"password" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acting_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id_pengganti" text NOT NULL,
	"jabatan_id_target" text NOT NULL,
	"tipe" text NOT NULL,
	"role_id_target" text NOT NULL,
	"assigned_by_user_id" text NOT NULL,
	"authorized_by_user_id" text NOT NULL,
	"tanggal_mulai" text NOT NULL,
	"tanggal_selesai" text,
	"assigned_at" text NOT NULL,
	"deleted_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_global_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"active_provider_id" text NOT NULL,
	"active_model_id" text NOT NULL,
	"primary_language" text DEFAULT 'id' NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"endpoint_url" text,
	"api_key" text DEFAULT '' NOT NULL,
	"models_json" text DEFAULT '[]' NOT NULL,
	"builtin" integer DEFAULT 0 NOT NULL,
	"connection_status" text DEFAULT 'idle' NOT NULL,
	"is_active" integer DEFAULT 0 NOT NULL,
	"deleted_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload_json" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classification_catalog" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"keywords_json" text DEFAULT '[]' NOT NULL,
	"is_system" integer DEFAULT 1 NOT NULL,
	"deleted_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disposition_whatsapp_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"disposition_id" text NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_whatsapp" text NOT NULL,
	"status" text NOT NULL,
	"last_attempt_at" text NOT NULL,
	"deleted_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispositions" (
	"id" text PRIMARY KEY NOT NULL,
	"surat_id" text NOT NULL,
	"pengirim_id" text NOT NULL,
	"penerima_id" text NOT NULL,
	"target_position_id" text NOT NULL,
	"instruksi" text NOT NULL,
	"parent_disposition_id" text,
	"status" text NOT NULL,
	"allow_download" integer DEFAULT 0 NOT NULL,
	"approval_qr_code" text NOT NULL,
	"created_at" text NOT NULL,
	"urgent" integer DEFAULT 0 NOT NULL,
	"bypass" integer DEFAULT 0 NOT NULL,
	"routing_type" text DEFAULT 'standard' NOT NULL,
	"follow_up_note" text,
	"follow_up_file_name" text,
	"deleted_at" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institution_identity" (
	"id" integer PRIMARY KEY NOT NULL,
	"court_name" text NOT NULL,
	"court_short_name" text NOT NULL,
	"address" text NOT NULL,
	"phone_number" text NOT NULL,
	"mobile_phone" text NOT NULL,
	"email" text NOT NULL,
	"instagram" text,
	"facebook" text,
	"youtube" text,
	"website" text,
	"map_url" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base_regulations" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"source" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"module_ids_json" text DEFAULT '[]' NOT NULL,
	"keywords_json" text DEFAULT '[]' NOT NULL,
	"summary" text NOT NULL,
	"citation" text NOT NULL,
	"recommended_position_ids_json" text DEFAULT '[]' NOT NULL,
	"deleted_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "letter_attachments" (
	"letter_id" text NOT NULL,
	"file_name" text NOT NULL,
	CONSTRAINT "letter_attachments_letter_id_file_name_pk" PRIMARY KEY("letter_id","file_name")
);
--> statement-breakpoint
CREATE TABLE "letter_classification_tags" (
	"letter_id" text NOT NULL,
	"tag_value" text NOT NULL,
	CONSTRAINT "letter_classification_tags_letter_id_tag_value_pk" PRIMARY KEY("letter_id","tag_value")
);
--> statement-breakpoint
CREATE TABLE "letter_origin_references" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "letter_tags" (
	"letter_id" text NOT NULL,
	"tag_value" text NOT NULL,
	CONSTRAINT "letter_tags_letter_id_tag_value_pk" PRIMARY KEY("letter_id","tag_value")
);
--> statement-breakpoint
CREATE TABLE "letter_whatsapp_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"letter_id" text NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_whatsapp" text NOT NULL,
	"status" text NOT NULL,
	"last_attempt_at" text NOT NULL,
	"deleted_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "letters" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"nomor_surat" text NOT NULL,
	"nomor_urut" text,
	"tanggal_surat" text NOT NULL,
	"tanggal_terima" text,
	"tanggal_kirim" text,
	"tanggal_administratif" text,
	"pengirim" text NOT NULL,
	"perihal" text NOT NULL,
	"status" text NOT NULL,
	"assigned_unit" text NOT NULL,
	"confidentiality" text NOT NULL,
	"current_disposition_id" text,
	"ringkasan" text NOT NULL,
	"asal_surat" text NOT NULL,
	"tujuan_surat" text NOT NULL,
	"klasifikasi_utama" text NOT NULL,
	"kode_klasifikasi" text,
	"lampiran_json" text DEFAULT '[]' NOT NULL,
	"tags_json" text DEFAULT '[]' NOT NULL,
	"klasifikasi_tags_json" text DEFAULT '[]' NOT NULL,
	"viewer_mode" text DEFAULT 'download' NOT NULL,
	"qr_code_label" text NOT NULL,
	"document_aspect_ratio" double precision,
	"document_file_name" text,
	"document_size_mb" double precision,
	"document_text_extract" text,
	"document_file_path" text,
	"target_position_id" text,
	"target_user_id" text,
	"created_by_user_id" text,
	"search_document" text DEFAULT '' NOT NULL,
	"deleted_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"unit_kerja" text NOT NULL,
	"level_hierarchy" integer NOT NULL,
	"reports_to_position_id" text,
	"disposition_target_position_ids_json" text DEFAULT '[]' NOT NULL,
	"can_forward_to_leadership" integer DEFAULT 0 NOT NULL,
	"deleted_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" text NOT NULL,
	"token" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"nip" text,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT true NOT NULL,
	"whatsapp_number" text NOT NULL,
	"profile_photo_url" text,
	"role_id" text NOT NULL,
	"position_id" text NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"can_bypass_hierarchy" integer DEFAULT 0 NOT NULL,
	"deleted_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "whatsapp_web_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"phone_number" text DEFAULT '' NOT NULL,
	"session_name" text NOT NULL,
	"status" text DEFAULT 'inactive' NOT NULL,
	"last_connected_at" text,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acting_assignments" ADD CONSTRAINT "acting_assignments_user_id_pengganti_users_id_fk" FOREIGN KEY ("user_id_pengganti") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acting_assignments" ADD CONSTRAINT "acting_assignments_jabatan_id_target_positions_id_fk" FOREIGN KEY ("jabatan_id_target") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acting_assignments" ADD CONSTRAINT "acting_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acting_assignments" ADD CONSTRAINT "acting_assignments_authorized_by_user_id_users_id_fk" FOREIGN KEY ("authorized_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disposition_whatsapp_deliveries" ADD CONSTRAINT "disposition_whatsapp_deliveries_disposition_id_dispositions_id_fk" FOREIGN KEY ("disposition_id") REFERENCES "public"."dispositions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispositions" ADD CONSTRAINT "dispositions_surat_id_letters_id_fk" FOREIGN KEY ("surat_id") REFERENCES "public"."letters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispositions" ADD CONSTRAINT "dispositions_pengirim_id_users_id_fk" FOREIGN KEY ("pengirim_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispositions" ADD CONSTRAINT "dispositions_penerima_id_users_id_fk" FOREIGN KEY ("penerima_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispositions" ADD CONSTRAINT "dispositions_target_position_id_positions_id_fk" FOREIGN KEY ("target_position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispositions" ADD CONSTRAINT "dispositions_parent_disposition_id_dispositions_id_fk" FOREIGN KEY ("parent_disposition_id") REFERENCES "public"."dispositions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_attachments" ADD CONSTRAINT "letter_attachments_letter_id_letters_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."letters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_classification_tags" ADD CONSTRAINT "letter_classification_tags_letter_id_letters_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."letters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_tags" ADD CONSTRAINT "letter_tags_letter_id_letters_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."letters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_whatsapp_deliveries" ADD CONSTRAINT "letter_whatsapp_deliveries_letter_id_letters_id_fk" FOREIGN KEY ("letter_id") REFERENCES "public"."letters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters" ADD CONSTRAINT "letters_kode_klasifikasi_classification_catalog_code_fk" FOREIGN KEY ("kode_klasifikasi") REFERENCES "public"."classification_catalog"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters" ADD CONSTRAINT "letters_target_position_id_positions_id_fk" FOREIGN KEY ("target_position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters" ADD CONSTRAINT "letters_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letters" ADD CONSTRAINT "letters_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_reports_to_position_id_positions_id_fk" FOREIGN KEY ("reports_to_position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_acting_assignments_target" ON "acting_assignments" USING btree ("user_id_pengganti","jabatan_id_target","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_disposition_whatsapp_disposition" ON "disposition_whatsapp_deliveries" USING btree ("disposition_id","status");--> statement-breakpoint
CREATE INDEX "idx_dispositions_letter_status" ON "dispositions" USING btree ("surat_id","status","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_dispositions_recipient" ON "dispositions" USING btree ("penerima_id","target_position_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_letter_classification_tags_value" ON "letter_classification_tags" USING btree ("tag_value","letter_id");--> statement-breakpoint
CREATE INDEX "idx_letter_tags_value" ON "letter_tags" USING btree ("tag_value","letter_id");--> statement-breakpoint
CREATE INDEX "idx_letter_whatsapp_letter" ON "letter_whatsapp_deliveries" USING btree ("letter_id","status");--> statement-breakpoint
CREATE INDEX "idx_letters_type_status" ON "letters" USING btree ("type","status","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_letters_dates" ON "letters" USING btree ("tanggal_surat","tanggal_terima","tanggal_kirim");--> statement-breakpoint
CREATE INDEX "idx_letters_origin_code" ON "letters" USING btree ("asal_surat","kode_klasifikasi");--> statement-breakpoint
CREATE INDEX "idx_positions_reports_to" ON "positions" USING btree ("reports_to_position_id","level_hierarchy");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_users_position_role" ON "users" USING btree ("position_id","role_id","deleted_at");