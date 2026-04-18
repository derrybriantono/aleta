import { type AletaDatabase } from "@/server/db/client";

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unit_kerja TEXT NOT NULL,
    level_hierarchy INTEGER NOT NULL,
    reports_to_position_id TEXT,
    disposition_target_position_ids_json TEXT NOT NULL DEFAULT '[]',
    can_forward_to_leadership SMALLINT NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT fk_positions_reports_to
      FOREIGN KEY (reports_to_position_id) REFERENCES positions(id)
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    nip TEXT,
    email TEXT NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT TRUE,
    whatsapp_number TEXT NOT NULL,
    profile_photo_url TEXT,
    role_id TEXT NOT NULL,
    position_id TEXT NOT NULL,
    is_active SMALLINT NOT NULL DEFAULT 1,
    can_bypass_hierarchy SMALLINT NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
    CONSTRAINT fk_users_position FOREIGN KEY (position_id) REFERENCES positions(id)
  )`,
  `CREATE TABLE IF NOT EXISTS acting_assignments (
    id TEXT PRIMARY KEY,
    user_id_pengganti TEXT NOT NULL,
    jabatan_id_target TEXT NOT NULL,
    tipe TEXT NOT NULL CHECK (tipe IN ('PLH', 'PLT')),
    role_id_target TEXT NOT NULL,
    assigned_by_user_id TEXT NOT NULL,
    authorized_by_user_id TEXT NOT NULL,
    tanggal_mulai TEXT NOT NULL,
    tanggal_selesai TEXT,
    assigned_at TEXT NOT NULL,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT fk_acting_user FOREIGN KEY (user_id_pengganti) REFERENCES users(id),
    CONSTRAINT fk_acting_position FOREIGN KEY (jabatan_id_target) REFERENCES positions(id),
    CONSTRAINT fk_acting_assigned_by FOREIGN KEY (assigned_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_acting_authorized_by FOREIGN KEY (authorized_by_user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ai_global_settings (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    enabled SMALLINT NOT NULL DEFAULT 1,
    active_provider_id TEXT NOT NULL,
    active_model_id TEXT NOT NULL,
    primary_language TEXT NOT NULL DEFAULT 'id',
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ai_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    endpoint_url TEXT,
    api_key TEXT NOT NULL DEFAULT '',
    models_json TEXT NOT NULL DEFAULT '[]',
    builtin SMALLINT NOT NULL DEFAULT 0,
    connection_status TEXT NOT NULL DEFAULT 'idle',
    is_active SMALLINT NOT NULL DEFAULT 0,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS whatsapp_web_settings (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    phone_number TEXT NOT NULL DEFAULT '',
    session_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'inactive',
    last_connected_at TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS institution_identity (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    court_name TEXT NOT NULL,
    court_short_name TEXT NOT NULL,
    address TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    mobile_phone TEXT NOT NULL,
    email TEXT NOT NULL,
    instagram TEXT,
    facebook TEXT,
    youtube TEXT,
    website TEXT,
    map_url TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS module_visibility_settings (
    role_id TEXT NOT NULL,
    module_id TEXT NOT NULL,
    enabled SMALLINT NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (role_id, module_id),
    CONSTRAINT fk_module_visibility_role FOREIGN KEY (role_id) REFERENCES roles(id)
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_base_regulations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    module_ids_json TEXT NOT NULL DEFAULT '[]',
    keywords_json TEXT NOT NULL DEFAULT '[]',
    summary TEXT NOT NULL,
    citation TEXT NOT NULL,
    recommended_position_ids_json TEXT NOT NULL DEFAULT '[]',
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS letter_origin_references (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS classification_catalog (
    code TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    keywords_json TEXT NOT NULL DEFAULT '[]',
    is_system SMALLINT NOT NULL DEFAULT 1,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS letters (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('masuk', 'keluar')),
    nomor_surat TEXT NOT NULL,
    nomor_urut TEXT,
    tanggal_surat TEXT NOT NULL,
    tanggal_terima TEXT,
    tanggal_kirim TEXT,
    tanggal_administratif TEXT,
    pengirim TEXT NOT NULL,
    perihal TEXT NOT NULL,
    status TEXT NOT NULL,
    assigned_unit TEXT NOT NULL,
    confidentiality TEXT NOT NULL,
    current_disposition_id TEXT,
    ringkasan TEXT NOT NULL,
    asal_surat TEXT NOT NULL,
    tujuan_surat TEXT NOT NULL,
    klasifikasi_utama TEXT NOT NULL,
    kode_klasifikasi TEXT,
    lampiran_json TEXT NOT NULL DEFAULT '[]',
    tags_json TEXT NOT NULL DEFAULT '[]',
    klasifikasi_tags_json TEXT NOT NULL DEFAULT '[]',
    viewer_mode TEXT NOT NULL DEFAULT 'download',
    qr_code_label TEXT NOT NULL,
    document_aspect_ratio DOUBLE PRECISION,
    document_file_name TEXT,
    document_size_mb DOUBLE PRECISION,
    document_text_extract TEXT,
    document_file_path TEXT,
    target_position_id TEXT,
    target_user_id TEXT,
    created_by_user_id TEXT,
    search_document TEXT NOT NULL DEFAULT '',
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT fk_letters_target_position FOREIGN KEY (target_position_id) REFERENCES positions(id),
    CONSTRAINT fk_letters_target_user FOREIGN KEY (target_user_id) REFERENCES users(id),
    CONSTRAINT fk_letters_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_letters_classification FOREIGN KEY (kode_klasifikasi) REFERENCES classification_catalog(code)
  )`,
  `CREATE TABLE IF NOT EXISTS letter_tags (
    letter_id TEXT NOT NULL,
    tag_value TEXT NOT NULL,
    PRIMARY KEY (letter_id, tag_value),
    CONSTRAINT fk_letter_tags_letter FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS letter_classification_tags (
    letter_id TEXT NOT NULL,
    tag_value TEXT NOT NULL,
    PRIMARY KEY (letter_id, tag_value),
    CONSTRAINT fk_letter_class_tags_letter FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS letter_attachments (
    letter_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    PRIMARY KEY (letter_id, file_name),
    CONSTRAINT fk_letter_attachments_letter FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS letter_whatsapp_deliveries (
    id TEXT PRIMARY KEY,
    letter_id TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_whatsapp TEXT NOT NULL,
    status TEXT NOT NULL,
    last_attempt_at TEXT NOT NULL,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT fk_letter_whatsapp_letter FOREIGN KEY (letter_id) REFERENCES letters(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS dispositions (
    id TEXT PRIMARY KEY,
    surat_id TEXT NOT NULL,
    pengirim_id TEXT NOT NULL,
    penerima_id TEXT NOT NULL,
    target_position_id TEXT NOT NULL,
    instruksi TEXT NOT NULL,
    parent_disposition_id TEXT,
    status TEXT NOT NULL,
    allow_download SMALLINT NOT NULL DEFAULT 0,
    approval_qr_code TEXT NOT NULL,
    created_at TEXT NOT NULL,
    urgent SMALLINT NOT NULL DEFAULT 0,
    bypass SMALLINT NOT NULL DEFAULT 0,
    routing_type TEXT NOT NULL DEFAULT 'standard',
    follow_up_note TEXT,
    follow_up_file_name TEXT,
    deleted_at TEXT,
    updated_at TEXT NOT NULL,
    CONSTRAINT fk_dispositions_letter FOREIGN KEY (surat_id) REFERENCES letters(id) ON DELETE CASCADE,
    CONSTRAINT fk_dispositions_sender FOREIGN KEY (pengirim_id) REFERENCES users(id),
    CONSTRAINT fk_dispositions_recipient FOREIGN KEY (penerima_id) REFERENCES users(id),
    CONSTRAINT fk_dispositions_target_position FOREIGN KEY (target_position_id) REFERENCES positions(id),
    CONSTRAINT fk_dispositions_parent FOREIGN KEY (parent_disposition_id) REFERENCES dispositions(id)
  )`,
  `CREATE TABLE IF NOT EXISTS disposition_whatsapp_deliveries (
    id TEXT PRIMARY KEY,
    disposition_id TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_whatsapp TEXT NOT NULL,
    status TEXT NOT NULL,
    last_attempt_at TEXT NOT NULL,
    deleted_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT fk_disposition_whatsapp_disposition
      FOREIGN KEY (disposition_id) REFERENCES dispositions(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload_json TEXT,
    created_at TEXT NOT NULL,
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TEXT,
    refresh_token_expires_at TEXT,
    scope TEXT,
    password TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CONSTRAINT fk_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    expires_at TEXT NOT NULL,
    token TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    user_id TEXT NOT NULL,
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS verifications (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
  )`,
];

const indexStatements = [
  `CREATE INDEX IF NOT EXISTS idx_positions_reports_to ON positions(reports_to_position_id, level_hierarchy)`,
  `CREATE INDEX IF NOT EXISTS idx_users_position_role ON users(position_id, role_id, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_acting_assignments_target ON acting_assignments(user_id_pengganti, jabatan_id_target, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_letters_type_status ON letters(type, status, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_letters_dates ON letters(tanggal_surat, tanggal_terima, tanggal_kirim)`,
  `CREATE INDEX IF NOT EXISTS idx_letters_origin_code ON letters(asal_surat, kode_klasifikasi)`,
  `CREATE INDEX IF NOT EXISTS idx_letter_tags_value ON letter_tags(tag_value, letter_id)`,
  `CREATE INDEX IF NOT EXISTS idx_letter_classification_tags_value ON letter_classification_tags(tag_value, letter_id)`,
  `CREATE INDEX IF NOT EXISTS idx_dispositions_letter_status ON dispositions(surat_id, status, deleted_at)`,
  `CREATE INDEX IF NOT EXISTS idx_dispositions_recipient ON dispositions(penerima_id, target_position_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_letter_whatsapp_letter ON letter_whatsapp_deliveries(letter_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_disposition_whatsapp_disposition ON disposition_whatsapp_deliveries(disposition_id, status)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_provider_account ON accounts(provider_id, account_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`,
  `CREATE INDEX IF NOT EXISTS idx_letters_search_document_fts
    ON letters USING GIN (to_tsvector('simple', search_document))`,
];

export async function ensureAletaSchema(db: AletaDatabase) {
  for (const statement of schemaStatements) {
    await db.exec(statement);
  }

  for (const statement of indexStatements) {
    if (!db.supportsFullTextSearch() && statement.includes("idx_letters_search_document_fts")) {
      continue;
    }
    await db.exec(statement);
  }
}
