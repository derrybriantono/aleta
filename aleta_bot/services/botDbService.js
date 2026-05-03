const db = require("../db_config");

let schemaReady = false;
let schemaPromise = null;
let lastError = null;

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, result) => {
      if (error) {
        lastError = error;
        reject(error);
        return;
      }
      resolve(result);
    });
  });
}

async function addColumnIfMissing(tableName, columnName, definition) {
  const rows = await query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
  if (Array.isArray(rows) && rows.length > 0) return;
  await query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
}

async function initializeSchema() {
  if (schemaReady) return true;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS aleta_bot_message_queue (
        id VARCHAR(64) PRIMARY KEY,
        idempotency_key VARCHAR(191),
        notification_key VARCHAR(191),
        category VARCHAR(64) NOT NULL DEFAULT 'manual',
        recipient_number VARCHAR(64) NOT NULL DEFAULT '',
        recipient_name VARCHAR(191) NOT NULL DEFAULT '',
        message_body MEDIUMTEXT,
        message_preview TEXT,
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
        metadata_json MEDIUMTEXT,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        INDEX idx_abmq_status_schedule (status, scheduled_at, priority),
        INDEX idx_abmq_idempotency (idempotency_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
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
        retry_count INT NOT NULL DEFAULT 0,
        error_message TEXT,
        sent_at DATETIME NULL,
        metadata_json MEDIUMTEXT,
        created_at DATETIME NOT NULL,
        INDEX idx_abml_created_status (created_at, status),
        INDEX idx_abml_idempotency (idempotency_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS aleta_bot_settings (
        id VARCHAR(64) PRIMARY KEY,
        \`key\` VARCHAR(191) NOT NULL UNIQUE,
        value_json MEDIUMTEXT,
        description TEXT,
        updated_by VARCHAR(191),
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_intents (
        id VARCHAR(64) PRIMARY KEY,
        \`key\` VARCHAR(191) NOT NULL UNIQUE,
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
        created_by VARCHAR(191),
        updated_by VARCHAR(191),
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        INDEX idx_abpqi_active (is_active, audience),
        INDEX idx_abpqi_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_examples (
        id VARCHAR(64) PRIMARY KEY,
        intent_id VARCHAR(64) NOT NULL,
        question_text TEXT NOT NULL,
        normalized_question TEXT,
        is_active TINYINT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        INDEX idx_abpqe_intent (intent_id, is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await addColumnIfMissing("aleta_bot_message_queue", "source_app", "VARCHAR(191) NOT NULL DEFAULT ''");
    await addColumnIfMissing("aleta_bot_message_queue", "source_feature", "VARCHAR(191) NOT NULL DEFAULT ''");
    await addColumnIfMissing("aleta_bot_message_queue", "entity_type", "VARCHAR(191) NOT NULL DEFAULT ''");
    await addColumnIfMissing("aleta_bot_message_queue", "entity_id", "VARCHAR(191) NOT NULL DEFAULT ''");
    await addColumnIfMissing("aleta_bot_message_queue", "resolved_at", "DATETIME NULL");
    await addColumnIfMissing("aleta_bot_message_queue", "resolved_by", "VARCHAR(191) NOT NULL DEFAULT ''");
    await addColumnIfMissing("aleta_bot_message_queue", "resolved_note", "TEXT");

    await addColumnIfMissing("aleta_bot_public_qa_intents", "legacy_command", "VARCHAR(191) NOT NULL DEFAULT ''");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "parameterized_legacy_command", "VARCHAR(191) NOT NULL DEFAULT ''");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "ai_answer_enabled", "TINYINT NOT NULL DEFAULT 0");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "ai_answer_mode", "VARCHAR(64) NOT NULL DEFAULT 'off'");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "answer_policy", "VARCHAR(64) NOT NULL DEFAULT 'public_info_only'");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "verification_policy", "VARCHAR(64) NOT NULL DEFAULT 'none'");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "allowed_data_fields_json", "MEDIUMTEXT");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "blocked_data_fields_json", "MEDIUMTEXT");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "ai_system_prompt", "MEDIUMTEXT");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "ai_user_prompt_template", "MEDIUMTEXT");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "max_ai_tokens", "INT NOT NULL DEFAULT 400");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "temperature", "DECIMAL(4,2) NOT NULL DEFAULT 0.20");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "requires_approval_before_active", "TINYINT NOT NULL DEFAULT 1");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "version", "INT NOT NULL DEFAULT 1");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "status", "VARCHAR(32) NOT NULL DEFAULT 'draft'");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "approved_by", "VARCHAR(191)");
    await addColumnIfMissing("aleta_bot_public_qa_intents", "approved_at", "DATETIME NULL");

    await query(`
      CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_intent_versions (
        id VARCHAR(64) PRIMARY KEY,
        intent_id VARCHAR(64) NOT NULL,
        version INT NOT NULL DEFAULT 1,
        snapshot_json MEDIUMTEXT,
        change_note TEXT,
        created_by VARCHAR(191),
        created_at DATETIME NOT NULL,
        INDEX idx_abpqiv_intent (intent_id, version)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    schemaReady = true;
    return true;
  })();

  return schemaPromise;
}

async function ensureSchema() {
  try {
    await initializeSchema();
    return true;
  } catch (error) {
    lastError = error;
    return false;
  }
}

function toMysqlDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function getDbStatus() {
  return {
    schemaReady,
    lastError: lastError ? lastError.message : "",
  };
}

module.exports = {
  query,
  initializeSchema,
  ensureSchema,
  toMysqlDate,
  getDbStatus,
};
