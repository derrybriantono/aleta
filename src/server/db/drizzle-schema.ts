import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";

const textDate = customType<{ data: Date; driverData: string }>({
  dataType() {
    return 'text';
  },
  fromDriver(value: string): Date {
    return new Date(value);
  },
  toDriver(value: Date): string {
    return value.toISOString();
  },
});

export const roles = pgTable("roles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
});

export const positions = pgTable(
  "positions",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    unitKerja: text("unit_kerja").notNull(),
    levelHierarchy: integer("level_hierarchy").notNull(),
    reportsToPositionId: text("reports_to_position_id").references((): AnyPgColumn => positions.id),
    dispositionTargetPositionIdsJson: text("disposition_target_position_ids_json").notNull().default("[]"),
    canForwardToLeadership: integer("can_forward_to_leadership").notNull().default(0),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    reportsToIdx: index("idx_positions_reports_to").on(table.reportsToPositionId, table.levelHierarchy),
  })
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    nip: text("nip"),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(true),
    whatsappNumber: text("whatsapp_number").notNull(),
    image: text("profile_photo_url"),
    roleId: text("role_id").notNull().references(() => roles.id),
    positionId: text("position_id").notNull().references(() => positions.id),
    isActive: integer("is_active").notNull().default(1),
    canBypassHierarchy: integer("can_bypass_hierarchy").notNull().default(0),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    usernameUnique: uniqueIndex("users_username_unique").on(table.username),
    userPositionRoleIdx: index("idx_users_position_role").on(table.positionId, table.roleId, table.deletedAt),
  })
);

export const actingAssignments = pgTable(
  "acting_assignments",
  {
    id: text("id").primaryKey(),
    userIdPengganti: text("user_id_pengganti").notNull().references(() => users.id),
    jabatanIdTarget: text("jabatan_id_target").notNull().references(() => positions.id),
    tipe: text("tipe").notNull(),
    roleIdTarget: text("role_id_target").notNull(),
    assignedByUserId: text("assigned_by_user_id").notNull().references(() => users.id),
    authorizedByUserId: text("authorized_by_user_id").notNull().references(() => users.id),
    tanggalMulai: text("tanggal_mulai").notNull(),
    tanggalSelesai: text("tanggal_selesai"),
    assignedAt: text("assigned_at").notNull(),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    actingTargetIdx: index("idx_acting_assignments_target").on(
      table.userIdPengganti,
      table.jabatanIdTarget,
      table.deletedAt
    ),
  })
);

export const aiGlobalSettings = pgTable("ai_global_settings", {
  id: integer("id").primaryKey(),
  enabled: integer("enabled").notNull().default(1),
  activeProviderId: text("active_provider_id").notNull(),
  activeModelId: text("active_model_id").notNull(),
  activeConnectionId: text("active_connection_id"),
  primaryLanguage: text("primary_language").notNull().default("id"),
  featureDispositionAi: integer("feature_disposition_ai").notNull().default(1),
  featureMailIntelligence: integer("feature_mail_intelligence").notNull().default(1),
  featureDraftMetadata: integer("feature_draft_metadata").notNull().default(1),
  featureManajemenSuratAi: integer("feature_manajemen_surat_ai").notNull().default(1),
  featureDisposisiAi: integer("feature_disposisi_ai").notNull().default(1),
  featureFlagsJson: text("feature_flags_json").notNull().default("{}"),
  updatedAt: text("updated_at").notNull(),
});

export const aiProviders = pgTable("ai_providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  providerId: text("provider_id"),
  endpointUrl: text("endpoint_url"),
  apiKey: text("api_key").notNull().default(""),
  maskedApiKey: text("masked_api_key").notNull().default(""),
  modelsJson: text("models_json").notNull().default("[]"),
  modelId: text("model_id"),
  builtin: integer("builtin").notNull().default(0),
  connectionStatus: text("connection_status").notNull().default("idle"),
  isActive: integer("is_active").notNull().default(0),
  lastTestedAt: text("last_tested_at"),
  lastConnectionMessage: text("last_connection_message"),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const whatsappWebSettings = pgTable("whatsapp_web_settings", {
  id: integer("id").primaryKey(),
  phoneNumber: text("phone_number").notNull().default(""),
  sessionName: text("session_name").notNull(),
  status: text("status").notNull().default("inactive"),
  lastConnectedAt: text("last_connected_at"),
  updatedAt: text("updated_at").notNull(),
});

export const institutionIdentity = pgTable("institution_identity", {
  id: integer("id").primaryKey(),
  courtName: text("court_name").notNull(),
  courtShortName: text("court_short_name").notNull(),
  address: text("address").notNull(),
  phoneNumber: text("phone_number").notNull(),
  mobilePhone: text("mobile_phone").notNull(),
  email: text("email").notNull(),
  instagram: text("instagram"),
  facebook: text("facebook"),
  youtube: text("youtube"),
  website: text("website"),
  mapUrl: text("map_url"),
  updatedAt: text("updated_at").notNull(),
});

export const institutionIdentityEnrichments = pgTable("institution_identity_enrichments", {
  courtId: text("court_id").primaryKey(),
  queryText: text("query_text"),
  courtName: text("court_name").notNull(),
  courtShortName: text("court_short_name").notNull().default(""),
  address: text("address").notNull().default(""),
  phoneNumber: text("phone_number").notNull().default(""),
  mobilePhone: text("mobile_phone").notNull().default(""),
  email: text("email").notNull().default(""),
  instagram: text("instagram"),
  facebook: text("facebook"),
  youtube: text("youtube"),
  website: text("website"),
  mapUrl: text("map_url"),
  sourceOfficialWebsite: text("source_official_website"),
  sourceGooglePlace: text("source_google_place"),
  sourceGoogleSearch: text("source_google_search"),
  sourcesJson: text("sources_json").notNull().default("[]"),
  fieldsFoundJson: text("fields_found_json").notNull().default("[]"),
  fieldsMissingJson: text("fields_missing_json").notNull().default("[]"),
  warningsJson: text("warnings_json").notNull().default("[]"),
  confidence: text("confidence").notNull().default("low"),
  fieldSourcesJson: text("field_sources_json").notNull().default("{}"),
  fieldConfidenceJson: text("field_confidence_json").notNull().default("{}"),
  enrichmentStatus: text("enrichment_status").notNull().default("catalog_only"),
  lastEnrichedAt: text("last_enriched_at"),
  lastErrorMessage: text("last_error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const moduleVisibilitySettings = pgTable(
  "module_visibility_settings",
  {
    roleId: text("role_id").notNull().references(() => roles.id),
    moduleId: text("module_id").notNull(),
    enabled: integer("enabled").notNull().default(1),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.moduleId] }),
  })
);

export const knowledgeBaseRegulations = pgTable("knowledge_base_regulations", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  source: text("source").notNull(),
  jurisdiction: text("jurisdiction").notNull(),
  moduleIdsJson: text("module_ids_json").notNull().default("[]"),
  keywordsJson: text("keywords_json").notNull().default("[]"),
  summary: text("summary").notNull(),
  citation: text("citation").notNull(),
  recommendedPositionIdsJson: text("recommended_position_ids_json").notNull().default("[]"),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const letterOriginReferences = pgTable(
  "letter_origin_references",
  {
    id: text("id").primaryKey(),
    label: text("label").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    labelUnique: uniqueIndex("letter_origin_references_label_unique").on(table.label),
  })
);

export const classificationCatalog = pgTable("classification_catalog", {
  code: text("code").primaryKey(),
  label: text("label").notNull(),
  category: text("category").notNull(),
  keywordsJson: text("keywords_json").notNull().default("[]"),
  isSystem: integer("is_system").notNull().default(1),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const letters = pgTable(
  "letters",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    nomorSurat: text("nomor_surat").notNull(),
    nomorUrut: text("nomor_urut"),
    tanggalSurat: text("tanggal_surat").notNull(),
    tanggalTerima: text("tanggal_terima"),
    tanggalKirim: text("tanggal_kirim"),
    tanggalAdministratif: text("tanggal_administratif"),
    pengirim: text("pengirim").notNull(),
    perihal: text("perihal").notNull(),
    status: text("status").notNull(),
    assignedUnit: text("assigned_unit").notNull(),
    confidentiality: text("confidentiality").notNull(),
    currentDispositionId: text("current_disposition_id"),
    ringkasan: text("ringkasan").notNull(),
    asalSurat: text("asal_surat").notNull(),
    tujuanSurat: text("tujuan_surat").notNull(),
    klasifikasiUtama: text("klasifikasi_utama").notNull(),
    kodeKlasifikasi: text("kode_klasifikasi").references(() => classificationCatalog.code),
    lampiranJson: text("lampiran_json").notNull().default("[]"),
    tagsJson: text("tags_json").notNull().default("[]"),
    klasifikasiTagsJson: text("klasifikasi_tags_json").notNull().default("[]"),
    viewerMode: text("viewer_mode").notNull().default("download"),
    qrCodeLabel: text("qr_code_label").notNull(),
    documentAspectRatio: doublePrecision("document_aspect_ratio"),
    documentFileName: text("document_file_name"),
    documentSizeMb: doublePrecision("document_size_mb"),
    documentTextExtract: text("document_text_extract"),
    documentFilePath: text("document_file_path"),
    targetPositionId: text("target_position_id").references(() => positions.id),
    targetUserId: text("target_user_id").references(() => users.id),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    searchDocument: text("search_document").notNull().default(""),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    typeStatusIdx: index("idx_letters_type_status").on(table.type, table.status, table.deletedAt),
    datesIdx: index("idx_letters_dates").on(table.tanggalSurat, table.tanggalTerima, table.tanggalKirim),
    originCodeIdx: index("idx_letters_origin_code").on(table.asalSurat, table.kodeKlasifikasi),
    searchDocumentFtsIdx: index("idx_letters_search_document_fts").using(
      "gin",
      sql`to_tsvector('simple', ${table.searchDocument})`
    ),
  })
);

export const letterTags = pgTable(
  "letter_tags",
  {
    letterId: text("letter_id").notNull().references(() => letters.id, { onDelete: "cascade" }),
    tagValue: text("tag_value").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.letterId, table.tagValue] }),
    valueIdx: index("idx_letter_tags_value").on(table.tagValue, table.letterId),
  })
);

export const letterClassificationTags = pgTable(
  "letter_classification_tags",
  {
    letterId: text("letter_id").notNull().references(() => letters.id, { onDelete: "cascade" }),
    tagValue: text("tag_value").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.letterId, table.tagValue] }),
    valueIdx: index("idx_letter_classification_tags_value").on(table.tagValue, table.letterId),
  })
);

export const letterAttachments = pgTable(
  "letter_attachments",
  {
    letterId: text("letter_id").notNull().references(() => letters.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.letterId, table.fileName] }),
  })
);

export const letterWhatsappDeliveries = pgTable(
  "letter_whatsapp_deliveries",
  {
    id: text("id").primaryKey(),
    letterId: text("letter_id").notNull().references(() => letters.id, { onDelete: "cascade" }),
    recipientName: text("recipient_name").notNull(),
    recipientWhatsapp: text("recipient_whatsapp").notNull(),
    status: text("status").notNull(),
    lastAttemptAt: text("last_attempt_at").notNull(),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    letterIdx: index("idx_letter_whatsapp_letter").on(table.letterId, table.status),
  })
);

export const dispositions = pgTable(
  "dispositions",
  {
    id: text("id").primaryKey(),
    suratId: text("surat_id").notNull().references(() => letters.id, { onDelete: "cascade" }),
    pengirimId: text("pengirim_id").notNull().references(() => users.id),
    penerimaId: text("penerima_id").notNull().references(() => users.id),
    targetPositionId: text("target_position_id").notNull().references(() => positions.id),
    instruksi: text("instruksi").notNull(),
    parentDispositionId: text("parent_disposition_id").references((): AnyPgColumn => dispositions.id),
    status: text("status").notNull(),
    allowDownload: integer("allow_download").notNull().default(0),
    approvalQrCode: text("approval_qr_code").notNull(),
    createdAt: text("created_at").notNull(),
    urgent: integer("urgent").notNull().default(0),
    bypass: integer("bypass").notNull().default(0),
    routingType: text("routing_type").notNull().default("standard"),
    followUpNote: text("follow_up_note"),
    followUpFileName: text("follow_up_file_name"),
    deletedAt: text("deleted_at"),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    letterStatusIdx: index("idx_dispositions_letter_status").on(table.suratId, table.status, table.deletedAt),
    recipientIdx: index("idx_dispositions_recipient").on(table.penerimaId, table.targetPositionId, table.createdAt),
  })
);

export const dispositionWhatsappDeliveries = pgTable(
  "disposition_whatsapp_deliveries",
  {
    id: text("id").primaryKey(),
    dispositionId: text("disposition_id").notNull().references(() => dispositions.id, { onDelete: "cascade" }),
    recipientName: text("recipient_name").notNull(),
    recipientWhatsapp: text("recipient_whatsapp").notNull(),
    status: text("status").notNull(),
    lastAttemptAt: text("last_attempt_at").notNull(),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    dispositionIdx: index("idx_disposition_whatsapp_disposition").on(table.dispositionId, table.status),
  })
);

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  payloadJson: text("payload_json"),
  createdAt: text("created_at").notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: textDate("access_token_expires_at"),
    refreshTokenExpiresAt: textDate("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: textDate("created_at").notNull(),
    updatedAt: textDate("updated_at").notNull(),
  },
  (table) => ({
    providerAccountUnique: uniqueIndex("idx_accounts_provider_account").on(table.providerId, table.accountId),
  })
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: textDate("expires_at").notNull(),
    token: text("token").notNull(),
    createdAt: textDate("created_at").notNull(),
    updatedAt: textDate("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => ({
    tokenUnique: uniqueIndex("idx_sessions_token").on(table.token),
  })
);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: textDate("expires_at").notNull(),
  createdAt: textDate("created_at"),
  updatedAt: textDate("updated_at"),
});

export const schema = {
  roles,
  positions,
  users,
  actingAssignments,
  aiGlobalSettings,
  aiProviders,
  whatsappWebSettings,
  institutionIdentity,
  institutionIdentityEnrichments,
  moduleVisibilitySettings,
  knowledgeBaseRegulations,
  letterOriginReferences,
  classificationCatalog,
  letters,
  letterTags,
  letterClassificationTags,
  letterAttachments,
  letterWhatsappDeliveries,
  dispositions,
  dispositionWhatsappDeliveries,
  auditLogs,
  accounts,
  sessions,
  verifications,
};

export type DrizzleSchema = typeof schema;
