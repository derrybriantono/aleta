CREATE TABLE IF NOT EXISTS jlf_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_templates (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES jlf_categories(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  document_type TEXT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL DEFAULT '',
  original_filename TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  requires_validation SMALLINT NOT NULL DEFAULT 1,
  supports_ai SMALLINT NOT NULL DEFAULT 1,
  supports_whatsapp_notification SMALLINT NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES jlf_templates(id),
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  checksum TEXT NOT NULL DEFAULT '',
  detected_placeholders JSONB NOT NULL DEFAULT '[]'::jsonb,
  change_note TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_variables (
  id TEXT PRIMARY KEY,
  legacy_code TEXT,
  "key" TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  data_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_key TEXT NOT NULL DEFAULT '',
  transform_key TEXT NOT NULL DEFAULT '',
  fallback_value TEXT NOT NULL DEFAULT '',
  is_required SMALLINT NOT NULL DEFAULT 0,
  is_active SMALLINT NOT NULL DEFAULT 1,
  example_value TEXT NOT NULL DEFAULT '',
  admin_note TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_template_variables (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES jlf_templates(id) ON DELETE CASCADE,
  variable_id TEXT NOT NULL REFERENCES jlf_variables(id),
  placeholder TEXT NOT NULL,
  is_required SMALLINT NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_manual_values (
  id TEXT PRIMARY KEY,
  nomor_perkara TEXT NOT NULL,
  sipp_perkara_id TEXT NOT NULL DEFAULT '',
  template_id TEXT REFERENCES jlf_templates(id),
  variable_key TEXT NOT NULL,
  value_type TEXT NOT NULL,
  value_text TEXT NOT NULL DEFAULT '',
  value_json JSONB,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_generated_documents (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES jlf_templates(id),
  template_version_id TEXT REFERENCES jlf_template_versions(id),
  nomor_perkara TEXT NOT NULL,
  sipp_perkara_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  output_file_path TEXT NOT NULL DEFAULT '',
  output_file_type TEXT NOT NULL DEFAULT '',
  checksum TEXT NOT NULL DEFAULT '',
  verification_token TEXT,
  verification_token_hash TEXT,
  generated_by TEXT REFERENCES users(id),
  validated_by TEXT REFERENCES users(id),
  validated_at TEXT,
  finalized_at TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_document_variables_snapshot (
  id TEXT PRIMARY KEY,
  generated_document_id TEXT NOT NULL REFERENCES jlf_generated_documents(id) ON DELETE CASCADE,
  variable_key TEXT NOT NULL,
  placeholder TEXT NOT NULL,
  resolved_value TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_document_validation_logs (
  id TEXT PRIMARY KEY,
  generated_document_id TEXT NOT NULL REFERENCES jlf_generated_documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  actor_id TEXT REFERENCES users(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_settings (
  id TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT NOT NULL DEFAULT '',
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_sipp_account_links (
  id TEXT PRIMARY KEY,
  aleta_user_id TEXT NOT NULL REFERENCES users(id),
  sipp_user_id TEXT NOT NULL,
  sipp_username TEXT NOT NULL,
  sipp_fullname TEXT NOT NULL DEFAULT '',
  sipp_nip TEXT NOT NULL DEFAULT '',
  sipp_email TEXT NOT NULL DEFAULT '',
  sipp_group_id TEXT NOT NULL DEFAULT '',
  sipp_group_name TEXT NOT NULL DEFAULT '',
  sipp_satker_code TEXT NOT NULL DEFAULT '',
  sipp_satker_name TEXT NOT NULL DEFAULT '',
  link_status TEXT NOT NULL DEFAULT 'suggested',
  link_method TEXT NOT NULL DEFAULT 'auto_suggestion',
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  matched_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_by TEXT REFERENCES users(id),
  linked_at TEXT,
  unlinked_by TEXT REFERENCES users(id),
  unlinked_at TEXT,
  last_synced_at TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_sipp_role_mappings (
  id TEXT PRIMARY KEY,
  sipp_group_id TEXT NOT NULL,
  sipp_group_name TEXT NOT NULL,
  suggested_aleta_role_id TEXT REFERENCES roles(id),
  suggested_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_auto_apply SMALLINT NOT NULL DEFAULT 0,
  requires_admin_approval SMALLINT NOT NULL DEFAULT 1,
  description TEXT NOT NULL DEFAULT '',
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_sipp_user_snapshots (
  id TEXT PRIMARY KEY,
  sipp_user_id TEXT NOT NULL,
  sipp_username TEXT NOT NULL,
  sipp_fullname TEXT NOT NULL DEFAULT '',
  sipp_nip TEXT NOT NULL DEFAULT '',
  sipp_email TEXT NOT NULL DEFAULT '',
  sipp_group_id TEXT NOT NULL DEFAULT '',
  sipp_group_name TEXT NOT NULL DEFAULT '',
  sipp_satker_code TEXT NOT NULL DEFAULT '',
  sipp_satker_name TEXT NOT NULL DEFAULT '',
  raw_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_regulation_types (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  hierarchy_level INTEGER NOT NULL DEFAULT 0,
  issuing_scope TEXT NOT NULL DEFAULT '',
  is_binding SMALLINT NOT NULL DEFAULT 1,
  is_active SMALLINT NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_regulations (
  id TEXT PRIMARY KEY,
  regulation_type_id TEXT NOT NULL REFERENCES jlf_regulation_types(id),
  title TEXT NOT NULL,
  short_title TEXT NOT NULL DEFAULT '',
  regulation_number TEXT NOT NULL DEFAULT '',
  regulation_year INTEGER,
  issuing_body TEXT NOT NULL DEFAULT '',
  jurisdiction TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  source_url TEXT NOT NULL DEFAULT '',
  source_name TEXT NOT NULL DEFAULT '',
  official_document_path TEXT NOT NULL DEFAULT '',
  effective_date TEXT,
  promulgation_date TEXT,
  revoked_at TEXT,
  revoked_by_regulation_id TEXT REFERENCES jlf_regulations(id),
  superseded_by_regulation_id TEXT REFERENCES jlf_regulations(id),
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT REFERENCES users(id),
  verified_by TEXT REFERENCES users(id),
  verified_at TEXT,
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_regulation_versions (
  id TEXT PRIMARY KEY,
  regulation_id TEXT NOT NULL REFERENCES jlf_regulations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  version_label TEXT NOT NULL DEFAULT '',
  document_path TEXT NOT NULL DEFAULT '',
  checksum TEXT NOT NULL DEFAULT '',
  text_content TEXT NOT NULL DEFAULT '',
  extracted_text_status TEXT NOT NULL DEFAULT 'pending',
  change_note TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_regulation_sections (
  id TEXT PRIMARY KEY,
  regulation_id TEXT NOT NULL REFERENCES jlf_regulations(id) ON DELETE CASCADE,
  regulation_version_id TEXT REFERENCES jlf_regulation_versions(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL,
  section_number TEXT NOT NULL DEFAULT '',
  parent_section_id TEXT REFERENCES jlf_regulation_sections(id),
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  normalized_content TEXT NOT NULL DEFAULT '',
  page_number INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_regulation_topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  parent_id TEXT REFERENCES jlf_regulation_topics(id),
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_regulation_topic_links (
  id TEXT PRIMARY KEY,
  regulation_id TEXT NOT NULL REFERENCES jlf_regulations(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES jlf_regulation_topics(id) ON DELETE CASCADE,
  relevance_note TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_template_regulations (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES jlf_templates(id) ON DELETE CASCADE,
  regulation_id TEXT NOT NULL REFERENCES jlf_regulations(id),
  regulation_section_id TEXT REFERENCES jlf_regulation_sections(id),
  relation_type TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_variable_regulations (
  id TEXT PRIMARY KEY,
  variable_id TEXT NOT NULL REFERENCES jlf_variables(id) ON DELETE CASCADE,
  regulation_id TEXT NOT NULL REFERENCES jlf_regulations(id),
  regulation_section_id TEXT REFERENCES jlf_regulation_sections(id),
  relation_type TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_ai_prompts (
  id TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  prompt_template TEXT NOT NULL,
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_ai_logs (
  id TEXT PRIMARY KEY,
  feature TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  nomor_perkara TEXT NOT NULL DEFAULT '',
  input_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_text TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_legal_analysis_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  nomor_perkara TEXT,
  generated_document_id TEXT REFERENCES jlf_generated_documents(id),
  analysis_type TEXT NOT NULL,
  input_summary TEXT NOT NULL DEFAULT '',
  output_summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  ai_used SMALLINT NOT NULL DEFAULT 0,
  model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_legal_analysis_sources (
  id TEXT PRIMARY KEY,
  analysis_session_id TEXT NOT NULL REFERENCES jlf_legal_analysis_sessions(id) ON DELETE CASCADE,
  regulation_id TEXT NOT NULL REFERENCES jlf_regulations(id),
  regulation_section_id TEXT REFERENCES jlf_regulation_sections(id),
  quoted_text TEXT NOT NULL DEFAULT '',
  relevance_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  ai_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_whatsapp_notification_templates (
  id TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message_template TEXT NOT NULL,
  is_active SMALLINT NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS jlf_whatsapp_notification_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  recipient_user_id TEXT REFERENCES users(id),
  recipient_phone_masked TEXT NOT NULL DEFAULT '',
  related_entity_type TEXT NOT NULL DEFAULT '',
  related_entity_id TEXT NOT NULL DEFAULT '',
  nomor_perkara TEXT NOT NULL DEFAULT '',
  message_preview TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  gateway_provider TEXT NOT NULL DEFAULT 'aleta_bot',
  gateway_message_id TEXT NOT NULL DEFAULT '',
  error_message TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_jlf_categories_slug_unique ON jlf_categories(slug);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_categories_active ON jlf_categories(is_active);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_categories_sort_order ON jlf_categories(sort_order);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_jlf_templates_slug_unique ON jlf_templates(slug);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_templates_category ON jlf_templates(category_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_templates_status ON jlf_templates(status);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_jlf_template_versions_unique ON jlf_template_versions(template_id, version_number);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_template_versions_template ON jlf_template_versions(template_id);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_jlf_variables_key_unique ON jlf_variables("key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_jlf_variables_legacy_code_unique ON jlf_variables(legacy_code);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_variables_source_type ON jlf_variables(source_type);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_variables_active ON jlf_variables(is_active);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_jlf_template_variables_placeholder_unique ON jlf_template_variables(template_id, placeholder);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_template_variables_template ON jlf_template_variables(template_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_template_variables_variable ON jlf_template_variables(variable_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_manual_values_nomor_perkara ON jlf_manual_values(nomor_perkara);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_manual_values_sipp_perkara ON jlf_manual_values(sipp_perkara_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_manual_values_template ON jlf_manual_values(template_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_manual_values_variable_key ON jlf_manual_values(variable_key);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_generated_documents_template ON jlf_generated_documents(template_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_generated_documents_nomor_perkara ON jlf_generated_documents(nomor_perkara);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_generated_documents_sipp_perkara ON jlf_generated_documents(sipp_perkara_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_generated_documents_status ON jlf_generated_documents(status);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_generated_documents_generated_by ON jlf_generated_documents(generated_by);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_generated_documents_created_at ON jlf_generated_documents(created_at);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_generated_documents_verification_hash ON jlf_generated_documents(verification_token_hash);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_document_variables_snapshot_document ON jlf_document_variables_snapshot(generated_document_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_document_variables_snapshot_variable_key ON jlf_document_variables_snapshot(variable_key);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_document_validation_logs_document ON jlf_document_validation_logs(generated_document_id);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_jlf_settings_key_unique ON jlf_settings("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_audit_logs_user ON jlf_audit_logs(user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_audit_logs_action ON jlf_audit_logs(action);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_audit_logs_entity_type ON jlf_audit_logs(entity_type);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_audit_logs_entity_id ON jlf_audit_logs(entity_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_audit_logs_nomor_perkara ON jlf_audit_logs(nomor_perkara);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_audit_logs_created_at ON jlf_audit_logs(created_at);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_sipp_account_links_aleta_user ON jlf_sipp_account_links(aleta_user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_sipp_account_links_sipp_user ON jlf_sipp_account_links(sipp_user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_sipp_account_links_sipp_username ON jlf_sipp_account_links(sipp_username);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_sipp_account_links_sipp_nip ON jlf_sipp_account_links(sipp_nip);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_sipp_account_links_status ON jlf_sipp_account_links(link_status);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_jlf_regulation_types_code_unique ON jlf_regulation_types(code);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_regulation_types_active ON jlf_regulation_types(is_active);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_regulations_type ON jlf_regulations(regulation_type_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_regulations_status ON jlf_regulations(status);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_regulations_verification_status ON jlf_regulations(verification_status);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_regulations_year ON jlf_regulations(regulation_year);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_jlf_regulation_versions_unique ON jlf_regulation_versions(regulation_id, version_number);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_regulation_versions_regulation ON jlf_regulation_versions(regulation_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_regulation_sections_regulation ON jlf_regulation_sections(regulation_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_regulation_sections_version ON jlf_regulation_sections(regulation_version_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_regulation_sections_parent ON jlf_regulation_sections(parent_section_id);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_jlf_regulation_topics_slug_unique ON jlf_regulation_topics(slug);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_regulation_topics_parent ON jlf_regulation_topics(parent_id);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_jlf_regulation_topic_links_unique ON jlf_regulation_topic_links(regulation_id, topic_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_template_regulations_template ON jlf_template_regulations(template_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_template_regulations_regulation ON jlf_template_regulations(regulation_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_variable_regulations_variable ON jlf_variable_regulations(variable_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_variable_regulations_regulation ON jlf_variable_regulations(regulation_id);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_jlf_ai_prompts_key_unique ON jlf_ai_prompts("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_ai_logs_feature ON jlf_ai_logs(feature);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_ai_logs_user ON jlf_ai_logs(user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_ai_logs_created_at ON jlf_ai_logs(created_at);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_legal_analysis_sessions_user ON jlf_legal_analysis_sessions(user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_legal_analysis_sessions_document ON jlf_legal_analysis_sessions(generated_document_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_legal_analysis_sources_session ON jlf_legal_analysis_sources(analysis_session_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_legal_analysis_sources_regulation ON jlf_legal_analysis_sources(regulation_id);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_jlf_whatsapp_notification_templates_key_unique ON jlf_whatsapp_notification_templates("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_whatsapp_notification_templates_event ON jlf_whatsapp_notification_templates(event_type);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_whatsapp_notification_logs_event ON jlf_whatsapp_notification_logs(event_type);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_whatsapp_notification_logs_recipient ON jlf_whatsapp_notification_logs(recipient_user_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_whatsapp_notification_logs_entity ON jlf_whatsapp_notification_logs(related_entity_type, related_entity_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_jlf_whatsapp_notification_logs_created_at ON jlf_whatsapp_notification_logs(created_at);--> statement-breakpoint
INSERT INTO jlf_categories (id, name, slug, description, icon, sort_order, is_active, created_at, updated_at) VALUES
  ('jlf-cat-gugatan-permohonan', 'Gugatan & Permohonan', 'gugatan-permohonan', 'Template perkara gugatan dan permohonan.', 'scale', 10, 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-cat-kepaniteraan', 'Kepaniteraan', 'kepaniteraan', 'Template administrasi kepaniteraan.', 'archive', 20, 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-cat-jinayat', 'Jinayat', 'jinayat', 'Template perkara jinayat sesuai kewenangan satker.', 'shield-check', 30, 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-cat-berita-acara-sidang', 'Berita Acara Sidang', 'berita-acara-sidang', 'Template BAS dan dokumen persidangan.', 'book-open-text', 40, 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-cat-mediasi', 'Mediasi', 'mediasi', 'Template administrasi mediasi.', 'users-round', 50, 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-cat-putusan-penetapan', 'Putusan & Penetapan', 'putusan-penetapan', 'Template putusan, penetapan, dan naskah terkait.', 'file-text', 60, 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-cat-ikrar-talak', 'Ikrar Talak', 'ikrar-talak', 'Template ikrar talak dan dokumen pendukung.', 'landmark', 70, 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-cat-ecourt', 'e-Court', 'e-court', 'Template yang mendukung administrasi e-Court.', 'globe', 80, 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-cat-template-ai', 'Template AI', 'template-ai', 'Template yang boleh memakai bantuan AI global ALETA.', 'sparkles', 90, 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-cat-lainnya', 'Lainnya', 'lainnya', 'Kategori cadangan untuk template JLF lain.', 'settings', 100, 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT)
ON CONFLICT (id) DO NOTHING;--> statement-breakpoint
INSERT INTO jlf_settings (id, "key", value, description, updated_at, created_at) VALUES
  ('jlf-setting-enabled', 'jlf.enabled', 'true'::jsonb, 'Status aktivasi modul Judicia Legal Form.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-sipp-enabled', 'jlf.sipp.enabled', 'false'::jsonb, 'Status adapter SIPP read-only JLF.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-document-store-generated-files', 'jlf.document.store_generated_files', 'true'::jsonb, 'Simpan file hasil generate dokumen JLF.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-document-qr-verification-enabled', 'jlf.document.qr_verification_enabled', 'true'::jsonb, 'Aktifkan QR dan verifikasi dokumen JLF.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-upload-max-file-size-mb', 'jlf.upload.max_file_size_mb', '25'::jsonb, 'Batas unggah template/dokumen JLF dalam MB.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-upload-allowed-template-types', 'jlf.upload.allowed_template_types', '["docx","rtf"]'::jsonb, 'Tipe file template yang boleh diunggah.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-upload-allowed-anonymizer-types', 'jlf.upload.allowed_anonymizer_types', '["docx","pdf","txt"]'::jsonb, 'Tipe file yang boleh diproses anonimisasi.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-template-legacy-placeholder', 'jlf.template.legacy_placeholder_support_enabled', 'true'::jsonb, 'Dukung placeholder legacy #0001# pada template JLF.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-template-modern-placeholder', 'jlf.template.modern_placeholder_support_enabled', 'true'::jsonb, 'Dukung placeholder modern {{key}} pada template JLF.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-template-default-validation', 'jlf.template.default_requires_validation', 'true'::jsonb, 'Template baru default memerlukan validasi manusia.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-ai-enabled', 'jlf.ai.enabled', 'true'::jsonb, 'Aktifkan fitur AI JLF melalui konfigurasi AI global ALETA.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-ai-use-global', 'jlf.ai.use_global_aleta_ai_settings', 'true'::jsonb, 'JLF wajib memakai provider/model AI global ALETA.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-ai-legal-analysis-enabled', 'jlf.ai.legal_analysis.enabled', 'false'::jsonb, 'Aktifkan legal analysis setelah Legal KB terverifikasi siap.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-ai-require-verified-regulations', 'jlf.ai.require_verified_regulations', 'true'::jsonb, 'Mode production hanya memakai peraturan terverifikasi.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-whatsapp-enabled', 'jlf.whatsapp.enabled', 'false'::jsonb, 'Aktifkan notifikasi WhatsApp JLF melalui gateway global.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-whatsapp-use-global', 'jlf.whatsapp.use_global_aleta_bot_gateway', 'true'::jsonb, 'JLF wajib memakai ALETA Bot/WhatsApp Gateway global.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-whatsapp-validation', 'jlf.whatsapp.send_validation_notifications', 'false'::jsonb, 'Kirim notifikasi validasi dokumen JLF.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-whatsapp-document-ready', 'jlf.whatsapp.send_document_ready_notifications', 'false'::jsonb, 'Kirim notifikasi dokumen siap diunduh dengan link aman.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-whatsapp-regulation-review', 'jlf.whatsapp.send_regulation_review_notifications', 'false'::jsonb, 'Kirim notifikasi review peraturan JLF.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-account-sync-enabled', 'jlf.account_sync.enabled', 'false'::jsonb, 'Aktifkan sinergi akun ALETA-SIPP.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-setting-legacy-import-enabled', 'jlf.legacy_import.enabled', 'false'::jsonb, 'Aktifkan importer legacy setelah mapping diverifikasi.', CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT)
ON CONFLICT (id) DO NOTHING;--> statement-breakpoint
INSERT INTO jlf_regulation_types (id, code, name, description, hierarchy_level, issuing_scope, is_binding, is_active, sort_order, created_at, updated_at) VALUES
  ('jlf-regtype-uud', 'UUD', 'UUD', 'Undang-Undang Dasar.', 10, 'nasional', 1, 1, 10, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-tap-mpr', 'TAP_MPR', 'TAP MPR', 'Ketetapan Majelis Permusyawaratan Rakyat.', 20, 'nasional', 1, 1, 20, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-uu', 'UU', 'Undang-Undang', 'Undang-Undang Republik Indonesia.', 30, 'nasional', 1, 1, 30, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-perppu', 'PERPPU', 'Peraturan Pemerintah Pengganti Undang-Undang', 'Perppu Republik Indonesia.', 40, 'nasional', 1, 1, 40, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-pp', 'PP', 'Peraturan Pemerintah', 'Peraturan Pemerintah Republik Indonesia.', 50, 'nasional', 1, 1, 50, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-perpres', 'PERPRES', 'Peraturan Presiden', 'Peraturan Presiden Republik Indonesia.', 60, 'nasional', 1, 1, 60, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-perma', 'PERMA', 'Peraturan Mahkamah Agung', 'Peraturan Mahkamah Agung Republik Indonesia.', 70, 'mahkamah_agung', 1, 1, 70, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-sema', 'SEMA', 'Surat Edaran Mahkamah Agung', 'Surat Edaran Mahkamah Agung Republik Indonesia.', 80, 'mahkamah_agung', 1, 1, 80, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-sk-kma', 'SK_KMA', 'Keputusan Ketua Mahkamah Agung', 'Keputusan Ketua Mahkamah Agung Republik Indonesia.', 90, 'mahkamah_agung', 1, 1, 90, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-permen', 'PERMEN', 'Peraturan Menteri', 'Peraturan Menteri.', 100, 'kementerian', 1, 1, 100, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-kepmen', 'KEPMEN', 'Keputusan Menteri', 'Keputusan Menteri.', 110, 'kementerian', 1, 1, 110, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-peraturan-badilag', 'PERATURAN_BADILAG', 'Peraturan Badilag', 'Peraturan pada lingkungan Badilag.', 120, 'badilag', 1, 1, 120, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-se-badilag', 'SE_BADILAG', 'Surat Edaran Badilag', 'Surat Edaran Badilag.', 130, 'badilag', 1, 1, 130, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-sk-dirjen-badilag', 'SK_DIRJEN_BADILAG', 'Keputusan Dirjen Badilag', 'Keputusan Direktur Jenderal Badilag.', 140, 'badilag', 1, 1, 140, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-hir', 'HIR', 'HIR', 'Herzien Inlandsch Reglement.', 150, 'hukum_acara', 1, 1, 150, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-rbg', 'RBG', 'RBg', 'Rechtsreglement voor de Buitengewesten.', 160, 'hukum_acara', 1, 1, 160, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-khi', 'KHI', 'Kompilasi Hukum Islam', 'Kompilasi Hukum Islam.', 170, 'hukum_islam', 1, 1, 170, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-qanun', 'QANUN', 'Qanun', 'Qanun dan regulasi daerah khusus.', 180, 'daerah', 1, 1, 180, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-perda', 'PERDA', 'Peraturan Daerah', 'Peraturan daerah.', 190, 'daerah', 1, 1, 190, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-yurisprudensi', 'YURISPRUDENSI', 'Yurisprudensi', 'Yurisprudensi dan putusan rujukan.', 200, 'peradilan', 0, 1, 200, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-pedoman-teknis', 'PEDOMAN_TEKNIS', 'Pedoman Teknis', 'Pedoman teknis internal atau eksternal.', 210, 'pedoman', 0, 1, 210, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-sop-internal', 'SOP_INTERNAL', 'SOP Internal', 'Standar operasional internal satuan kerja.', 220, 'internal', 0, 1, 220, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-template-internal', 'TEMPLATE_INTERNAL', 'Template Internal', 'Template dan blangko internal.', 230, 'internal', 0, 1, 230, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-regtype-lainnya', 'LAINNYA', 'Lainnya', 'Jenis peraturan atau rujukan lain.', 240, 'lainnya', 0, 1, 240, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT)
ON CONFLICT (id) DO NOTHING;--> statement-breakpoint
INSERT INTO jlf_regulation_topics (id, name, slug, description, is_active, created_at, updated_at) VALUES
  ('jlf-topic-cerai-gugat', 'cerai gugat', 'cerai-gugat', 'Topik cerai gugat.', 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-topic-cerai-talak', 'cerai talak', 'cerai-talak', 'Topik cerai talak.', 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-topic-itsbat-nikah', 'itsbat nikah', 'itsbat-nikah', 'Topik itsbat nikah.', 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-topic-dispensasi-kawin', 'dispensasi kawin', 'dispensasi-kawin', 'Topik dispensasi kawin.', 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-topic-waris', 'waris', 'waris', 'Topik waris.', 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-topic-ekonomi-syariah', 'ekonomi syariah', 'ekonomi-syariah', 'Topik ekonomi syariah.', 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-topic-jinayat', 'jinayat', 'jinayat', 'Topik jinayat.', 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-topic-mediasi', 'mediasi', 'mediasi', 'Topik mediasi.', 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-topic-eksekusi', 'eksekusi', 'eksekusi', 'Topik eksekusi.', 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-topic-ecourt', 'e-court', 'e-court', 'Topik e-Court.', 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-topic-biaya-perkara', 'biaya perkara', 'biaya-perkara', 'Topik biaya perkara.', 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-topic-pembuktian', 'pembuktian', 'pembuktian', 'Topik pembuktian.', 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-topic-putusan', 'putusan', 'putusan', 'Topik putusan.', 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-topic-penetapan', 'penetapan', 'penetapan', 'Topik penetapan.', 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT),
  ('jlf-topic-bas', 'BAS', 'bas', 'Topik Berita Acara Sidang.', 1, CURRENT_TIMESTAMP::TEXT, CURRENT_TIMESTAMP::TEXT)
ON CONFLICT (id) DO NOTHING;
