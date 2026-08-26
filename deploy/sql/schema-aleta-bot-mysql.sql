-- Schema lengkap ALETA Bot untuk database MySQL/MariaDB `aleta_bot`.
-- Jalankan setelah `deploy/sql/setup-aleta-mysql-databases.sql`.
-- Script ini hanya membuat tabel jika belum ada dan TIDAK menyentuh database SIPP.

USE `aleta_bot`;

CREATE TABLE IF NOT EXISTS aleta_bot_settings (
  id VARCHAR(64) PRIMARY KEY,
  `key` VARCHAR(191) NOT NULL UNIQUE,
  value_json MEDIUMTEXT,
  description TEXT,
  updated_by VARCHAR(191),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_message_templates (
  id VARCHAR(64) PRIMARY KEY,
  template_key VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(191) NOT NULL,
  description TEXT,
  category VARCHAR(64) NOT NULL DEFAULT 'general',
  channel VARCHAR(32) NOT NULL DEFAULT 'whatsapp',
  audience VARCHAR(64) NOT NULL DEFAULT 'internal',
  language VARCHAR(16) NOT NULL DEFAULT 'id',
  body MEDIUMTEXT NOT NULL,
  sample_payload_json MEDIUMTEXT,
  placeholders_json MEDIUMTEXT,
  role_scope_json MEDIUMTEXT,
  is_active TINYINT NOT NULL DEFAULT 1,
  is_default TINYINT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  version INT NOT NULL DEFAULT 1,
  created_by VARCHAR(191),
  updated_by VARCHAR(191),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_abmt_active_category (is_active, category),
  INDEX idx_abmt_channel_audience (channel, audience),
  INDEX idx_abmt_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_message_template_versions (
  id VARCHAR(64) PRIMARY KEY,
  template_id VARCHAR(64) NOT NULL,
  template_key VARCHAR(191) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  body MEDIUMTEXT NOT NULL,
  placeholders_json MEDIUMTEXT,
  sample_payload_json MEDIUMTEXT,
  change_note TEXT,
  created_by VARCHAR(191),
  created_at DATETIME NOT NULL,
  INDEX idx_abmtv_template (template_id, version),
  INDEX idx_abmtv_key (template_key, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_message_template_placeholders (
  id VARCHAR(64) PRIMARY KEY,
  template_id VARCHAR(64) NOT NULL,
  placeholder_key VARCHAR(191) NOT NULL,
  label VARCHAR(191) NOT NULL DEFAULT '',
  description TEXT,
  data_type VARCHAR(64) NOT NULL DEFAULT 'string',
  is_required TINYINT NOT NULL DEFAULT 1,
  default_value TEXT,
  source_path VARCHAR(191) NOT NULL DEFAULT '',
  validation_rule TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uq_abmtp_template_placeholder (template_id, placeholder_key),
  INDEX idx_abmtp_placeholder (placeholder_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_message_template_render_logs (
  id VARCHAR(64) PRIMARY KEY,
  template_key VARCHAR(191) NOT NULL,
  template_version INT NOT NULL DEFAULT 1,
  source_app VARCHAR(191) NOT NULL DEFAULT '',
  source_feature VARCHAR(191) NOT NULL DEFAULT '',
  entity_type VARCHAR(191) NOT NULL DEFAULT '',
  entity_id VARCHAR(191) NOT NULL DEFAULT '',
  payload_preview MEDIUMTEXT,
  rendered_preview TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at DATETIME NOT NULL,
  INDEX idx_abmtrl_template_created (template_key, created_at),
  INDEX idx_abmtrl_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_notification_definitions (
  id VARCHAR(64) PRIMARY KEY,
  notification_key VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(191) NOT NULL,
  description TEXT,
  category VARCHAR(64) NOT NULL DEFAULT 'system',
  trigger_type VARCHAR(64) NOT NULL DEFAULT 'manual',
  schedule_cron VARCHAR(191) NOT NULL DEFAULT '',
  source_query_key VARCHAR(191) NOT NULL DEFAULT '',
  template_key VARCHAR(191) NOT NULL DEFAULT '',
  recipient_resolver_key VARCHAR(191) NOT NULL DEFAULT '',
  max_retries INT NOT NULL DEFAULT 0,
  priority INT NOT NULL DEFAULT 5,
  is_active TINYINT NOT NULL DEFAULT 1,
  dry_run_only TINYINT NOT NULL DEFAULT 1,
  metadata_json MEDIUMTEXT,
  created_by VARCHAR(191),
  updated_by VARCHAR(191),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_abnd_active_category (is_active, category),
  INDEX idx_abnd_trigger (trigger_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_notification_recipients (
  id VARCHAR(64) PRIMARY KEY,
  notification_id VARCHAR(64) NOT NULL,
  recipient_type VARCHAR(64) NOT NULL DEFAULT 'role',
  role_id VARCHAR(191) NOT NULL DEFAULT '',
  position_id VARCHAR(191) NOT NULL DEFAULT '',
  user_id VARCHAR(191) NOT NULL DEFAULT '',
  phone_number VARCHAR(64) NOT NULL DEFAULT '',
  display_name VARCHAR(191) NOT NULL DEFAULT '',
  is_active TINYINT NOT NULL DEFAULT 1,
  metadata_json MEDIUMTEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_abnr_notification_active (notification_id, is_active),
  INDEX idx_abnr_role (role_id),
  INDEX idx_abnr_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_message_queue (
  id VARCHAR(64) PRIMARY KEY,
  idempotency_key VARCHAR(191),
  notification_key VARCHAR(191),
  category VARCHAR(64) NOT NULL DEFAULT 'manual',
  recipient_number VARCHAR(64) NOT NULL DEFAULT '',
  recipient_name VARCHAR(191) NOT NULL DEFAULT '',
  message_body MEDIUMTEXT,
  message_preview TEXT,
  attachment_source TEXT,
  attachment_name VARCHAR(255) NOT NULL DEFAULT '',
  attachment_mime_type VARCHAR(191) NOT NULL DEFAULT '',
  attachment_kind VARCHAR(64) NOT NULL DEFAULT '',
  attachment_required TINYINT NOT NULL DEFAULT 0,
  attachment_size BIGINT NULL,
  attachment_checksum VARCHAR(191) NOT NULL DEFAULT '',
  whatsapp_message_id VARCHAR(191) NOT NULL DEFAULT '',
  ack INT NULL,
  delivered_at DATETIME NULL,
  read_at DATETIME NULL,
  priority INT NOT NULL DEFAULT 5,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 0,
  scheduled_at DATETIME NOT NULL,
  processed_at DATETIME NULL,
  last_error TEXT,
  resolved_at DATETIME NULL,
  resolved_by VARCHAR(191) NOT NULL DEFAULT '',
  resolved_note TEXT,
  source_app VARCHAR(191) NOT NULL DEFAULT '',
  source_feature VARCHAR(191) NOT NULL DEFAULT '',
  entity_type VARCHAR(191) NOT NULL DEFAULT '',
  entity_id VARCHAR(191) NOT NULL DEFAULT '',
  metadata_json MEDIUMTEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_abmq_status_schedule (status, scheduled_at, priority),
  INDEX idx_abmq_idempotency (idempotency_key),
  INDEX idx_abmq_whatsapp_message (whatsapp_message_id),
  INDEX idx_abmq_status_updated (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_message_logs (
  id VARCHAR(64) PRIMARY KEY,
  queue_id VARCHAR(64),
  idempotency_key VARCHAR(191),
  notification_key VARCHAR(191),
  category VARCHAR(64) NOT NULL DEFAULT 'system',
  recipient_number VARCHAR(64) NOT NULL DEFAULT '',
  recipient_name VARCHAR(191) NOT NULL DEFAULT '',
  message_preview TEXT,
  status VARCHAR(32) NOT NULL,
  whatsapp_message_id VARCHAR(191) NOT NULL DEFAULT '',
  ack INT NULL,
  retry_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  sent_at DATETIME NULL,
  delivered_at DATETIME NULL,
  read_at DATETIME NULL,
  failed_at DATETIME NULL,
  metadata_json MEDIUMTEXT,
  created_at DATETIME NOT NULL,
  INDEX idx_abml_created_status (created_at, status),
  INDEX idx_abml_idempotency (idempotency_key),
  INDEX idx_abml_whatsapp_message (whatsapp_message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_system_logs (
  id VARCHAR(64) PRIMARY KEY,
  event_type VARCHAR(191) NOT NULL,
  severity VARCHAR(32) NOT NULL DEFAULT 'info',
  message TEXT,
  source VARCHAR(191) NOT NULL DEFAULT 'aleta_bot',
  metadata_json MEDIUMTEXT,
  created_at DATETIME NOT NULL,
  INDEX idx_absl_created_severity (created_at, severity),
  INDEX idx_absl_event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_notification_runs (
  id VARCHAR(64) PRIMARY KEY,
  notification_key VARCHAR(191) NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'system',
  status VARCHAR(32) NOT NULL DEFAULT 'running',
  total_targets INT NOT NULL DEFAULT 0,
  queued_count INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  started_at DATETIME NOT NULL,
  finished_at DATETIME NULL,
  error_message TEXT,
  metadata_json MEDIUMTEXT,
  created_at DATETIME NOT NULL,
  INDEX idx_abnr_created_status (created_at, status),
  INDEX idx_abnr_notification (notification_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_policy_skip_logs (
  id VARCHAR(64) PRIMARY KEY,
  notification_key VARCHAR(191) NOT NULL DEFAULT '',
  notification_id VARCHAR(191),
  category VARCHAR(64) NOT NULL DEFAULT '',
  reason VARCHAR(64) NOT NULL DEFAULT 'unknown',
  source_feature VARCHAR(191) NOT NULL DEFAULT '',
  entity_type VARCHAR(191) NOT NULL DEFAULT '',
  entity_id VARCHAR(191) NOT NULL DEFAULT '',
  recipient_type VARCHAR(64) NOT NULL DEFAULT '',
  recipient_count INT NOT NULL DEFAULT 0,
  metadata_json MEDIUMTEXT,
  created_at DATETIME NOT NULL,
  INDEX idx_abps_created_reason (created_at, reason),
  INDEX idx_abps_notification (notification_key, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_intents (
  id VARCHAR(64) PRIMARY KEY,
  `key` VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(191) NOT NULL,
  description TEXT,
  category VARCHAR(64) NOT NULL DEFAULT 'informasi_umum',
  audience VARCHAR(32) NOT NULL DEFAULT 'party',
  is_active TINYINT NOT NULL DEFAULT 1,
  ai_enabled TINYINT NOT NULL DEFAULT 0,
  exact_triggers_json MEDIUMTEXT,
  example_questions_json MEDIUMTEXT,
  required_parameters_json MEDIUMTEXT,
  query_key VARCHAR(191),
  legacy_handler VARCHAR(191),
  template_key VARCHAR(191),
  response_mode VARCHAR(64) NOT NULL DEFAULT 'legacy_handler',
  confidence_threshold DECIMAL(5,2) NOT NULL DEFAULT 0.65,
  requires_verification TINYINT NOT NULL DEFAULT 0,
  requires_case_number TINYINT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 2,
  fallback_message TEXT,
  risk_level VARCHAR(32) NOT NULL DEFAULT 'low',
  notes TEXT,
  legacy_command VARCHAR(191) NOT NULL DEFAULT '',
  parameterized_legacy_command VARCHAR(191) NOT NULL DEFAULT '',
  ai_answer_enabled TINYINT NOT NULL DEFAULT 0,
  ai_answer_mode VARCHAR(64) NOT NULL DEFAULT 'off',
  answer_policy VARCHAR(64) NOT NULL DEFAULT 'public_info_only',
  verification_policy VARCHAR(64) NOT NULL DEFAULT 'none',
  allowed_data_fields_json MEDIUMTEXT,
  blocked_data_fields_json MEDIUMTEXT,
  ai_system_prompt MEDIUMTEXT,
  ai_user_prompt_template MEDIUMTEXT,
  max_ai_tokens INT NOT NULL DEFAULT 400,
  temperature DECIMAL(4,2) NOT NULL DEFAULT 0.20,
  requires_approval_before_active TINYINT NOT NULL DEFAULT 1,
  version INT NOT NULL DEFAULT 1,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  approved_by VARCHAR(191),
  approved_at DATETIME NULL,
  created_by VARCHAR(191),
  updated_by VARCHAR(191),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_abpqi_active (is_active, audience),
  INDEX idx_abpqi_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_examples (
  id VARCHAR(64) PRIMARY KEY,
  intent_id VARCHAR(64) NOT NULL,
  question_text TEXT NOT NULL,
  normalized_question TEXT,
  is_active TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_abpqe_intent (intent_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_logs (
  id VARCHAR(64) PRIMARY KEY,
  sender_number VARCHAR(64),
  sender_name VARCHAR(191),
  raw_message TEXT,
  normalized_message TEXT,
  matched_intent_key VARCHAR(191),
  matched_method VARCHAR(32) NOT NULL DEFAULT 'fallback',
  confidence DECIMAL(5,2) NOT NULL DEFAULT 0,
  parameters_json MEDIUMTEXT,
  query_key VARCHAR(191),
  response_preview TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'fallback',
  error_message TEXT,
  created_at DATETIME NOT NULL,
  INDEX idx_abpql_created (created_at),
  INDEX idx_abpql_intent (matched_intent_key, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_sessions (
  id VARCHAR(64) PRIMARY KEY,
  sender_number VARCHAR(64) NOT NULL,
  current_intent_key VARCHAR(191),
  state VARCHAR(64) NOT NULL DEFAULT 'collecting',
  collected_params_json MEDIUMTEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_abpqs_sender (sender_number, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_intent_versions (
  id VARCHAR(64) PRIMARY KEY,
  intent_id VARCHAR(64) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  snapshot_json MEDIUMTEXT,
  change_note TEXT,
  created_by VARCHAR(191),
  created_at DATETIME NOT NULL,
  INDEX idx_abpqiv_intent (intent_id, version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_ai_logs (
  id VARCHAR(64) PRIMARY KEY,
  qa_log_id VARCHAR(64),
  intent_key VARCHAR(191),
  ai_provider VARCHAR(64) NOT NULL DEFAULT 'openai',
  ai_model VARCHAR(191),
  prompt_preview TEXT,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  confidence DECIMAL(5,2) NOT NULL DEFAULT 0,
  safety_status VARCHAR(191) NOT NULL DEFAULT 'not_used',
  ai_response_preview TEXT,
  fallback_used TINYINT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at DATETIME NOT NULL,
  INDEX idx_abpqail_created (created_at),
  INDEX idx_abpqail_intent (intent_key, safety_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_knowledge (
  id VARCHAR(64) PRIMARY KEY,
  `key` VARCHAR(191) NOT NULL UNIQUE,
  title VARCHAR(191) NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'informasi_umum',
  audience VARCHAR(32) NOT NULL DEFAULT 'public',
  keywords_json MEDIUMTEXT,
  answer MEDIUMTEXT,
  source_label VARCHAR(191) NOT NULL DEFAULT '',
  source_url TEXT,
  priority INT NOT NULL DEFAULT 50,
  is_active TINYINT NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL,
  INDEX idx_abpqk_active_category (is_active, category, priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_db_connections (
  id VARCHAR(64) PRIMARY KEY,
  `key` VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(191) NOT NULL,
  description TEXT,
  driver VARCHAR(64) NOT NULL DEFAULT 'mysql',
  host VARCHAR(191) NOT NULL,
  port INT NOT NULL DEFAULT 3306,
  database_name VARCHAR(191) NOT NULL,
  username VARCHAR(191) NOT NULL,
  password_env_key VARCHAR(191) NOT NULL DEFAULT '',
  password_secret MEDIUMTEXT,
  password_source VARCHAR(64) NOT NULL DEFAULT 'env',
  ssl_enabled TINYINT NOT NULL DEFAULT 0,
  connection_timeout_ms INT NOT NULL DEFAULT 5000,
  is_active TINYINT NOT NULL DEFAULT 1,
  is_default TINYINT NOT NULL DEFAULT 0,
  legacy_source VARCHAR(191) NOT NULL DEFAULT '',
  last_test_status VARCHAR(32) NOT NULL DEFAULT 'idle',
  last_test_error TEXT,
  last_test_at DATETIME NULL,
  created_by VARCHAR(191),
  updated_by VARCHAR(191),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_abdc_active_default (is_active, is_default),
  INDEX idx_abdc_legacy_source (legacy_source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_approval_requests (
  id VARCHAR(64) PRIMARY KEY,
  entity_type VARCHAR(191) NOT NULL,
  entity_id VARCHAR(191) NOT NULL,
  entity_name VARCHAR(191) NOT NULL DEFAULT '',
  action VARCHAR(64) NOT NULL DEFAULT 'update',
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  requested_by VARCHAR(191),
  reviewed_by VARCHAR(191),
  requested_at DATETIME NOT NULL,
  reviewed_at DATETIME NULL,
  request_payload_json MEDIUMTEXT,
  review_note TEXT,
  INDEX idx_abar_status_entity (status, entity_type, entity_id),
  INDEX idx_abar_requested_at (requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  actor_id VARCHAR(191) NOT NULL DEFAULT '',
  actor_name VARCHAR(191) NOT NULL DEFAULT '',
  action VARCHAR(191) NOT NULL,
  entity_type VARCHAR(191) NOT NULL,
  entity_id VARCHAR(191) NOT NULL DEFAULT '',
  before_json MEDIUMTEXT,
  after_json MEDIUMTEXT,
  metadata_json MEDIUMTEXT,
  created_at DATETIME NOT NULL,
  INDEX idx_abau_entity (entity_type, entity_id),
  INDEX idx_abau_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aleta_bot_worker_locks (
  lock_key VARCHAR(191) PRIMARY KEY,
  owner_id VARCHAR(191) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_abwl_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO aleta_bot_settings (id, `key`, value_json, description, updated_by, created_at, updated_at)
VALUES
  ('setting-runtime-mode', 'runtime.mode', JSON_QUOTE('aleta_bot'), 'Runtime efektif ALETA Bot.', 'schema', NOW(), NOW()),
  ('setting-dry-run-default', 'delivery.dry_run_default', 'true', 'Default pengiriman aman/dry-run sampai gateway live divalidasi.', 'schema', NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at);

INSERT INTO aleta_bot_message_templates (
  id, template_key, name, description, category, channel, audience, language, body,
  sample_payload_json, placeholders_json, role_scope_json, is_active, is_default,
  status, version, created_by, updated_by, created_at, updated_at
)
VALUES
  (
    'tmpl-surat-disposisi-default',
    'manajemen_surat.disposisi.default',
    'Disposisi Surat',
    'Format pesan default untuk pemberitahuan disposisi surat.',
    'manajemen_surat',
    'whatsapp',
    'internal',
    'id',
    'Assalamu''alaikum {{nama_penerima}}.\n\nAda disposisi surat baru:\nNomor: {{nomor_surat}}\nPerihal: {{perihal}}\nInstruksi: {{instruksi}}\n\nSilakan tindak lanjuti melalui Portal ALETA.',
    '{"nama_penerima":"Bapak/Ibu","nomor_surat":"001/PA.Dgl/2026","perihal":"Undangan","instruksi":"Mohon ditindaklanjuti"}',
    '["nama_penerima","nomor_surat","perihal","instruksi"]',
    '["hakim","panitera","jurusita","operator_surat"]',
    1,
    1,
    'active',
    1,
    'schema',
    'schema',
    NOW(),
    NOW()
  ),
  (
    'tmpl-surat-status-default',
    'manajemen_surat.status.default',
    'Status Surat',
    'Format pesan default untuk perubahan status surat.',
    'manajemen_surat',
    'whatsapp',
    'internal',
    'id',
    'Assalamu''alaikum {{nama_penerima}}.\n\nStatus surat telah diperbarui:\nNomor: {{nomor_surat}}\nPerihal: {{perihal}}\nStatus: {{status_surat}}\n\nSilakan cek detail pada Portal ALETA.',
    '{"nama_penerima":"Bapak/Ibu","nomor_surat":"001/PA.Dgl/2026","perihal":"Undangan","status_surat":"Diproses"}',
    '["nama_penerima","nomor_surat","perihal","status_surat"]',
    '["admin","operator_surat"]',
    1,
    1,
    'active',
    1,
    'schema',
    'schema',
    NOW(),
    NOW()
  )
ON DUPLICATE KEY UPDATE
  body = VALUES(body),
  placeholders_json = VALUES(placeholders_json),
  sample_payload_json = VALUES(sample_payload_json),
  updated_at = VALUES(updated_at);
