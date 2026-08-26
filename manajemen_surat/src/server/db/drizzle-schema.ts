import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
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
    additionalRoleIdsJson: text("additional_role_ids_json").notNull().default("[]"),
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

export const externalAppCredentials = pgTable(
  "external_app_credentials",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    appId: text("app_id").notNull(),
    externalUsername: text("external_username").notNull().default(""),
    encryptedPassword: text("encrypted_password").notNull().default(""),
    passwordMd5Hash: text("password_md5_hash").notNull().default(""),
    isEnabled: integer("is_enabled").notNull().default(0),
    lastVerifiedAt: text("last_verified_at"),
    lastVerifiedStatus: text("last_verified_status").notNull().default("not_tested"),
    lastLaunchAt: text("last_launch_at"),
    passwordUpdatedAt: text("password_updated_at"),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    userAppUnique: uniqueIndex("uq_external_app_credentials_user_app").on(table.userId, table.appId),
    appEnabledIdx: index("idx_external_app_credentials_app_enabled").on(table.appId, table.isEnabled),
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

export const aiModuleSettings = pgTable(
  "ai_module_settings",
  {
    moduleKey: text("module_key").primaryKey(),
    enabled: integer("enabled").notNull().default(1),
    inheritGlobal: integer("inherit_global").notNull().default(1),
    activeProviderId: text("active_provider_id"),
    activeModelId: text("active_model_id"),
    activeConnectionId: text("active_connection_id"),
    fallbackProviderId: text("fallback_provider_id"),
    fallbackModelId: text("fallback_model_id"),
    fallbackConnectionId: text("fallback_connection_id"),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    inheritIdx: index("idx_ai_module_settings_inherit").on(table.inheritGlobal),
    activeConnectionIdx: index("idx_ai_module_settings_connection").on(table.activeConnectionId),
  })
);

export const aiSuggestionLogs = pgTable(
  "ai_suggestion_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    feature: text("feature").notNull(),
    status: text("status").notNull(),
    providerId: text("provider_id"),
    modelId: text("model_id"),
    durationMs: integer("duration_ms").notNull().default(0),
    fallbackReason: text("fallback_reason").notNull().default(""),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    createdIdx: index("idx_ai_suggestion_logs_created").on(table.createdAt, table.feature, table.status),
  })
);

export const whatsappWebSettings = pgTable("whatsapp_web_settings", {
  id: integer("id").primaryKey(),
  phoneNumber: text("phone_number").notNull().default(""),
  sessionName: text("session_name").notNull(),
  status: text("status").notNull().default("inactive"),
  lastConnectedAt: text("last_connected_at"),
  updatedAt: text("updated_at").notNull(),
});

export const aletaBotSettings = pgTable("aleta_bot_settings", {
  id: integer("id").primaryKey(),
  botEnabled: integer("bot_enabled").notNull().default(0),
  notificationsEnabled: integer("notifications_enabled").notNull().default(0),
  adminWhatsappNumber: text("admin_whatsapp_number").notNull().default(""),
  messageDelayMs: integer("message_delay_ms").notNull().default(1500),
  retryLimit: integer("retry_limit").notNull().default(2),
  dryRunEnabled: integer("dry_run_enabled").notNull().default(1),
  scheduleCron: text("schedule_cron").notNull().default("00 07 * * Monday-Friday"),
  testTargetNumber: text("test_target_number").notNull().default(""),
  securityNotes: text("security_notes").notNull().default(""),
  dispositionDeadlineReminderEnabled: integer("disposition_deadline_reminder_enabled").notNull().default(0),
  dispositionDeadlineReminderMode: text("disposition_deadline_reminder_mode").notNull().default("dry_run"),
  dispositionDeadlineReminderApprovedAt: text("disposition_deadline_reminder_approved_at"),
  dispositionDeadlineReminderApprovedBy: text("disposition_deadline_reminder_approved_by"),
  dispositionDeadlineReminderLastRunAt: text("disposition_deadline_reminder_last_run_at"),
  dispositionDeadlineReminderLastStatus: text("disposition_deadline_reminder_last_status").notNull().default("idle"),
  dispositionDeadlineReminderLastMessage: text("disposition_deadline_reminder_last_message"),
  dispositionDeadlineReminderPilotUserIdsJson: text("disposition_deadline_reminder_pilot_user_ids_json").notNull().default("[]"),
  dispositionDeadlineReminderPilotRoleIdsJson: text("disposition_deadline_reminder_pilot_role_ids_json").notNull().default("[]"),
  dispositionDeadlineReminderPilotPositionIdsJson: text("disposition_deadline_reminder_pilot_position_ids_json").notNull().default("[]"),
  dispositionDeadlineReminderSchedulerEnabled: integer("disposition_deadline_reminder_scheduler_enabled").notNull().default(0),
  dispositionDeadlineReminderSchedulerMode: text("disposition_deadline_reminder_scheduler_mode").notNull().default("dry_run"),
  dispositionDeadlineReminderSchedulerTime: text("disposition_deadline_reminder_scheduler_time").notNull().default("08:00:00"),
  dispositionDeadlineReminderSchedulerLastRunAt: text("disposition_deadline_reminder_scheduler_last_run_at"),
  dispositionDeadlineReminderSchedulerLastMessage: text("disposition_deadline_reminder_scheduler_last_message"),
  dispositionDeadlineReminderKillSwitch: integer("disposition_deadline_reminder_kill_switch").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});

export const aletaBotTemplates = pgTable(
  "aleta_bot_templates",
  {
    id: text("id").primaryKey(),
    category: text("category").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    placeholdersJson: text("placeholders_json").notNull().default("[]"),
    editable: integer("editable").notNull().default(1),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    categoryIdx: index("idx_aleta_bot_templates_category").on(table.category),
  })
);

export const aletaBotJobs = pgTable("aleta_bot_jobs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  enabled: integer("enabled").notNull().default(0),
  scheduleCron: text("schedule_cron").notNull(),
  lastRunAt: text("last_run_at"),
  lastStatus: text("last_status").notNull().default("idle"),
  lastMessage: text("last_message"),
  updatedAt: text("updated_at").notNull(),
});

export const aletaBotQueries = pgTable(
  "aleta_bot_queries",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull().default(""),
    sqlText: text("sql_text").notNull(),
    outputColumnsJson: text("output_columns_json").notNull().default("[]"),
    recipientColumn: text("recipient_column").notNull().default(""),
    connectionKey: text("connection_key").notNull().default("sipp_primary"),
    isActive: integer("is_active").notNull().default(1),
    lastTestedAt: text("last_tested_at"),
    lastTestStatus: text("last_test_status").notNull().default("idle"),
    lastTestError: text("last_test_error"),
    lastTestDurationMs: integer("last_test_duration_ms").notNull().default(0),
    lastTestRowCount: integer("last_test_row_count").notNull().default(0),
    lastTestSampleJson: text("last_test_sample_json").notNull().default("[]"),
    lastTestSlow: integer("last_test_slow").notNull().default(0),
    lastTestMessage: text("last_test_message"),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    categoryIdx: index("idx_aleta_bot_queries_category").on(table.category, table.isActive),
  })
);

export const aletaBotDbConnections = pgTable(
  "aleta_bot_db_connections",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    driver: text("driver").notNull().default("mysql"),
    host: text("host").notNull(),
    port: integer("port").notNull().default(3306),
    databaseName: text("database_name").notNull(),
    username: text("username").notNull(),
    passwordEnvKey: text("password_env_key").notNull().default(""),
    passwordSecret: text("password_secret").notNull().default(""),
    passwordSource: text("password_source").notNull().default("env"),
    sslEnabled: integer("ssl_enabled").notNull().default(0),
    connectionTimeoutMs: integer("connection_timeout_ms").notNull().default(5000),
    isActive: integer("is_active").notNull().default(1),
    isDefault: integer("is_default").notNull().default(0),
    legacySource: text("legacy_source").notNull().default(""),
    lastTestStatus: text("last_test_status").notNull().default("idle"),
    lastTestError: text("last_test_error"),
    lastTestAt: text("last_test_at"),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    keyIdx: index("idx_aleta_bot_db_connections_key").on(table.key),
    activeIdx: index("idx_aleta_bot_db_connections_active").on(table.isActive, table.isDefault),
  })
);

export const aletaBotPublicQaIntents = pgTable(
  "aleta_bot_public_qa_intents",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("informasi_umum"),
    audience: text("audience").notNull().default("party"),
    isActive: integer("is_active").notNull().default(1),
    aiEnabled: integer("ai_enabled").notNull().default(0),
    exactTriggersJson: text("exact_triggers_json").notNull().default("[]"),
    exampleQuestionsJson: text("example_questions_json").notNull().default("[]"),
    requiredParametersJson: text("required_parameters_json").notNull().default("[]"),
    queryKey: text("query_key").notNull().default(""),
    legacyHandler: text("legacy_handler").notNull().default(""),
    legacyCommand: text("legacy_command").notNull().default(""),
    parameterizedLegacyCommand: text("parameterized_legacy_command").notNull().default(""),
    templateKey: text("template_key").notNull().default(""),
    responseMode: text("response_mode").notNull().default("legacy_handler"),
    confidenceThreshold: integer("confidence_threshold").notNull().default(65),
    requiresVerification: integer("requires_verification").notNull().default(0),
    requiresCaseNumber: integer("requires_case_number").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(2),
    fallbackMessage: text("fallback_message").notNull().default(""),
    riskLevel: text("risk_level").notNull().default("low"),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    activeIdx: index("idx_aleta_bot_public_qa_intents_active").on(table.isActive, table.audience),
  })
);

export const aletaBotPublicQaExamples = pgTable("aleta_bot_public_qa_examples", {
  id: text("id").primaryKey(),
  intentId: text("intent_id").notNull().references(() => aletaBotPublicQaIntents.id),
  questionText: text("question_text").notNull(),
  normalizedQuestion: text("normalized_question").notNull().default(""),
  isActive: integer("is_active").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const aletaBotPublicQaLogs = pgTable(
  "aleta_bot_public_qa_logs",
  {
    id: text("id").primaryKey(),
    senderNumber: text("sender_number").notNull().default(""),
    senderName: text("sender_name").notNull().default(""),
    rawMessage: text("raw_message").notNull().default(""),
    normalizedMessage: text("normalized_message").notNull().default(""),
    matchedIntentKey: text("matched_intent_key").notNull().default(""),
    matchedMethod: text("matched_method").notNull().default("fallback"),
    confidence: integer("confidence").notNull().default(0),
    parametersJson: text("parameters_json").notNull().default("{}"),
    queryKey: text("query_key").notNull().default(""),
    responsePreview: text("response_preview").notNull().default(""),
    status: text("status").notNull().default("fallback"),
    errorMessage: text("error_message"),
    needsHumanReview: integer("needs_human_review").notNull().default(0),
    reviewStatus: text("review_status").notNull().default("pending"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: text("reviewed_at"),
    reviewNote: text("review_note").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    createdIdx: index("idx_aleta_bot_public_qa_logs_created").on(table.createdAt, table.status),
    reviewIdx: index("idx_aleta_bot_public_qa_logs_review").on(table.needsHumanReview, table.reviewStatus, table.createdAt),
  })
);

export const aletaBotPublicQaSessions = pgTable(
  "aleta_bot_public_qa_sessions",
  {
    id: text("id").primaryKey(),
    senderNumber: text("sender_number").notNull(),
    currentIntentKey: text("current_intent_key").notNull().default(""),
    state: text("state").notNull().default("collecting"),
    collectedParamsJson: text("collected_params_json").notNull().default("{}"),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    senderIdx: index("idx_aleta_bot_public_qa_sessions_sender").on(table.senderNumber, table.expiresAt),
  })
);

export const aletaBotNotifications = pgTable(
  "aleta_bot_notifications",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull().default(""),
    queryId: text("query_id").notNull().references(() => aletaBotQueries.id),
    templateId: text("template_id").notNull().references(() => aletaBotTemplates.id),
    recipientSource: text("recipient_source").notNull(),
    recipientMappingJson: text("recipient_mapping_json").notNull().default("{}"),
    scheduleConfigJson: text("schedule_config_json").notNull().default("{}"),
    isActive: integer("is_active").notNull().default(0),
    attachDocument: integer("attach_document").notNull().default(1),
    delayMs: integer("delay_ms").notNull().default(1500),
    retryLimit: integer("retry_limit").notNull().default(2),
    lastRunAt: text("last_run_at"),
    lastStatus: text("last_status").notNull().default("idle"),
    lastMessage: text("last_message"),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    categoryIdx: index("idx_aleta_bot_notifications_category").on(table.category, table.isActive),
  })
);

export const aletaBotNotificationLogs = pgTable(
  "aleta_bot_notification_logs",
  {
    id: text("id").primaryKey(),
    notificationId: text("notification_id").references(() => aletaBotNotifications.id),
    queryId: text("query_id").references(() => aletaBotQueries.id),
    recipientNumber: text("recipient_number").notNull().default(""),
    recipientName: text("recipient_name").notNull().default(""),
    category: text("category").notNull(),
    messagePreview: text("message_preview").notNull().default(""),
    status: text("status").notNull(),
    whatsappMessageId: text("whatsapp_message_id").notNull().default(""),
    ack: integer("ack"),
    errorMessage: text("error_message"),
    sourceApp: text("source_app").notNull().default(""),
    sourceFeature: text("source_feature").notNull().default(""),
    entityType: text("entity_type").notNull().default(""),
    entityId: text("entity_id").notNull().default(""),
    metadataJson: text("metadata_json").notNull().default("{}"),
    sentAt: text("sent_at"),
    deliveredAt: text("delivered_at"),
    readAt: text("read_at"),
    failedAt: text("failed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    createdIdx: index("idx_aleta_bot_notification_logs_created").on(table.createdAt, table.status),
    entityIdx: index("idx_aleta_bot_notification_logs_entity").on(table.entityType, table.entityId, table.sourceFeature),
    whatsappMessageIdx: index("idx_aleta_bot_notification_logs_whatsapp_message").on(table.whatsappMessageId),
  })
);

export const aletaBotLogs = pgTable(
  "aleta_bot_logs",
  {
    id: text("id").primaryKey(),
    level: text("level").notNull(),
    eventType: text("event_type").notNull(),
    message: text("message").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    actorUserId: text("actor_user_id").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    createdIdx: index("idx_aleta_bot_logs_created").on(table.createdAt, table.eventType),
  })
);

export const aletaBotPolicySkipLogs = pgTable(
  "aleta_bot_policy_skip_logs",
  {
    id: text("id").primaryKey(),
    notificationKey: text("notification_key").notNull().default(""),
    notificationId: text("notification_id"),
    category: text("category").notNull().default(""),
    reason: text("reason").notNull().default("unknown"),
    sourceFeature: text("source_feature").notNull().default(""),
    entityType: text("entity_type").notNull().default(""),
    entityId: text("entity_id").notNull().default(""),
    recipientType: text("recipient_type").notNull().default(""),
    recipientCount: integer("recipient_count").notNull().default(0),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    createdIdx: index("idx_aleta_bot_policy_skip_logs_created").on(table.createdAt, table.reason),
    notificationIdx: index("idx_aleta_bot_policy_skip_logs_notification").on(table.notificationKey, table.createdAt),
  })
);

export const aletaBotDispositionReminderRuns = pgTable(
  "aleta_bot_disposition_reminder_runs",
  {
    id: text("id").primaryKey(),
    mode: text("mode").notNull().default("dry_run"),
    triggeredBy: text("triggered_by").notNull().default("manual"),
    triggeredByUserId: text("triggered_by_user_id").references(() => users.id),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    totalCandidates: integer("total_candidates").notNull().default(0),
    dryRunCreated: integer("dry_run_created").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    status: text("status").notNull().default("simulated"),
    summaryJson: text("summary_json").notNull().default("{}"),
  },
  (table) => ({
    createdIdx: index("idx_aleta_bot_disposition_reminder_runs_created").on(table.startedAt, table.mode, table.status),
  })
);

export const institutionIdentity = pgTable("institution_identity", {
  id: integer("id").primaryKey(),
  courtName: text("court_name").notNull(),
  courtShortName: text("court_short_name").notNull(),
  address: text("address").notNull(),
  phoneNumber: text("phone_number").notNull(),
  mobilePhone: text("mobile_phone").notNull(),
  csWhatsappNumber: text("cs_whatsapp_number").notNull().default(""),
  botWhatsappNumber: text("bot_whatsapp_number").notNull().default(""),
  email: text("email").notNull(),
  instagram: text("instagram"),
  facebook: text("facebook"),
  youtube: text("youtube"),
  website: text("website"),
  mapUrl: text("map_url"),
  logoUrl: text("logo_url"),
  updatedAt: text("updated_at").notNull(),
});

export const panelSettings = pgTable("panel_settings", {
  id: integer("id").primaryKey(),
  footerMode: text("footer_mode").notNull().default("auto"),
  portalCardsJson: text("portal_cards_json").notNull().default("{}"),
  publicAccessJson: text("public_access_json").notNull().default("{}"),
  externalAppsJson: text("external_apps_json").notNull().default("{}"),
  updatedBy: text("updated_by").references(() => users.id),
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

export const feedbackRequests = pgTable(
  "feedback_requests",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    appArea: text("app_area").notNull(),
    category: text("category").notNull(),
    priority: text("priority").notNull(),
    description: text("description").notNull(),
    reproductionSteps: text("reproduction_steps").notNull().default(""),
    expectedResult: text("expected_result").notNull().default(""),
    attachmentUrl: text("attachment_url").notNull().default(""),
    status: text("status").notNull().default("new"),
    reporterUserId: text("reporter_user_id").notNull().references(() => users.id),
    reporterName: text("reporter_name").notNull(),
    reporterRole: text("reporter_role").notNull(),
    reporterUnit: text("reporter_unit").notNull().default(""),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id),
    adminNote: text("admin_note").notNull().default(""),
    resolutionNote: text("resolution_note").notNull().default(""),
    duplicateOfId: text("duplicate_of_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    reviewedAt: text("reviewed_at"),
    completedAt: text("completed_at"),
  },
  (table) => ({
    reporterIdx: index("idx_feedback_requests_reporter").on(table.reporterUserId, table.createdAt),
    adminIdx: index("idx_feedback_requests_admin").on(table.status, table.type, table.priority, table.createdAt),
  })
);

export const userNotificationReads = pgTable(
  "user_notification_reads",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    seenAt: text("seen_at").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    uniqueRead: uniqueIndex("idx_user_notification_reads_unique").on(table.userId, table.entityType, table.entityId),
    userIdx: index("idx_user_notification_reads_user").on(table.userId, table.entityType, table.seenAt),
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

export const letterNumberSequences = pgTable(
  "letter_number_sequences",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    year: integer("year").notNull(),
    lastSequence: integer("last_sequence").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    typeYearUnique: uniqueIndex("idx_letter_number_sequences_unique").on(table.type, table.year),
  })
);

export const letterTemplates = pgTable(
  "letter_templates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull().default(""),
    body: text("body").notNull(),
    placeholdersJson: text("placeholders_json").notNull().default("[]"),
    isActive: integer("is_active").notNull().default(1),
    createdByUserId: text("created_by_user_id").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    activeIdx: index("idx_letter_templates_active").on(table.isActive, table.category),
  })
);

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
    workflowStatus: text("workflow_status").notNull().default("sent"),
    submittedAt: text("submitted_at"),
    submittedByUserId: text("submitted_by_user_id").references(() => users.id),
    approvedAt: text("approved_at"),
    approvedByUserId: text("approved_by_user_id").references(() => users.id),
    sentAt: text("sent_at"),
    sentByUserId: text("sent_by_user_id").references(() => users.id),
    rejectedAt: text("rejected_at"),
    rejectedByUserId: text("rejected_by_user_id").references(() => users.id),
    rejectionNote: text("rejection_note"),
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
    workflowStatusIdx: index("idx_letters_workflow_status").on(table.type, table.workflowStatus, table.deletedAt),
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
    queueId: text("queue_id").notNull().default(""),
    gatewayStatus: text("gateway_status").notNull().default(""),
    gatewayStage: text("gateway_stage").notNull().default(""),
    gatewayMessageId: text("gateway_message_id").notNull().default(""),
    gatewayError: text("gateway_error").notNull().default(""),
    lastAttemptAt: text("last_attempt_at").notNull(),
    deliveredAt: text("delivered_at"),
    readAt: text("read_at"),
    failedAt: text("failed_at"),
    lastGatewaySyncAt: text("last_gateway_sync_at"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    letterIdx: index("idx_letter_whatsapp_letter").on(table.letterId, table.status),
    queueIdx: index("idx_letter_whatsapp_queue").on(table.queueId),
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
    deadlineAt: text("deadline_at"),
    readAt: text("read_at"),
    readByUserId: text("read_by_user_id").references(() => users.id),
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
    deadlineIdx: index("idx_dispositions_deadline").on(table.deadlineAt, table.status, table.deletedAt),
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
    queueId: text("queue_id").notNull().default(""),
    gatewayStatus: text("gateway_status").notNull().default(""),
    gatewayStage: text("gateway_stage").notNull().default(""),
    gatewayMessageId: text("gateway_message_id").notNull().default(""),
    gatewayError: text("gateway_error").notNull().default(""),
    lastAttemptAt: text("last_attempt_at").notNull(),
    deliveredAt: text("delivered_at"),
    readAt: text("read_at"),
    failedAt: text("failed_at"),
    lastGatewaySyncAt: text("last_gateway_sync_at"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    dispositionIdx: index("idx_disposition_whatsapp_disposition").on(table.dispositionId, table.status),
    queueIdx: index("idx_disposition_whatsapp_queue").on(table.queueId),
  })
);

export const jlfCategories = pgTable(
  "jlf_categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: integer("is_active").notNull().default(1),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => ({
    slugUnique: uniqueIndex("idx_jlf_categories_slug_unique").on(table.slug),
    activeIdx: index("idx_jlf_categories_active").on(table.isActive),
    sortIdx: index("idx_jlf_categories_sort_order").on(table.sortOrder),
  })
);

export const jlfTemplates = pgTable(
  "jlf_templates",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id").notNull().references(() => jlfCategories.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    documentType: text("document_type").notNull(),
    fileType: text("file_type").notNull(),
    storagePath: text("storage_path").notNull().default(""),
    originalFilename: text("original_filename").notNull().default(""),
    status: text("status").notNull().default("draft"),
    requiresValidation: integer("requires_validation").notNull().default(1),
    supportsAi: integer("supports_ai").notNull().default(0),
    supportsWhatsappNotification: integer("supports_whatsapp_notification").notNull().default(0),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => ({
    slugUnique: uniqueIndex("idx_jlf_templates_slug_unique").on(table.slug),
    categoryIdx: index("idx_jlf_templates_category").on(table.categoryId),
    statusIdx: index("idx_jlf_templates_status").on(table.status),
  })
);

export const jlfTemplateVersions = pgTable(
  "jlf_template_versions",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id").notNull().references(() => jlfTemplates.id),
    versionNumber: integer("version_number").notNull(),
    storagePath: text("storage_path").notNull(),
    checksum: text("checksum").notNull().default(""),
    detectedPlaceholders: jsonb("detected_placeholders").notNull().default(sql`'[]'::jsonb`),
    changeNote: text("change_note").notNull().default(""),
    createdBy: text("created_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    templateVersionUnique: uniqueIndex("idx_jlf_template_versions_unique").on(table.templateId, table.versionNumber),
    templateIdx: index("idx_jlf_template_versions_template").on(table.templateId),
  })
);

export const jlfVariables = pgTable(
  "jlf_variables",
  {
    id: text("id").primaryKey(),
    legacyCode: text("legacy_code"),
    key: text("key").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    dataType: text("data_type").notNull(),
    sourceType: text("source_type").notNull(),
    sourceKey: text("source_key").notNull().default(""),
    transformKey: text("transform_key").notNull().default(""),
    fallbackValue: text("fallback_value").notNull().default(""),
    legacyAbtType: text("legacy_abt_type").notNull().default(""),
    fieldMode: text("field_mode").notNull().default(""),
    aiEnabled: integer("ai_enabled").notNull().default(0),
    manualOverrideAllowed: integer("manual_override_allowed").notNull().default(1),
    isRequired: integer("is_required").notNull().default(0),
    isActive: integer("is_active").notNull().default(1),
    exampleValue: text("example_value").notNull().default(""),
    adminNote: text("admin_note").notNull().default(""),
    sippQueryPreview: text("sipp_query_preview").notNull().default(""),
    sippQueryPreviewStatus: text("sipp_query_preview_status").notNull().default("not_generated"),
    sippQueryPreviewKey: text("sipp_query_preview_key").notNull().default(""),
    sippQueryPreviewGeneratedAt: text("sipp_query_preview_generated_at"),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    keyUnique: uniqueIndex("idx_jlf_variables_key_unique").on(table.key),
    legacyCodeUnique: uniqueIndex("idx_jlf_variables_legacy_code_unique").on(table.legacyCode),
    sourceTypeIdx: index("idx_jlf_variables_source_type").on(table.sourceType),
    activeIdx: index("idx_jlf_variables_active").on(table.isActive),
  })
);

export const jlfTemplateVariables = pgTable(
  "jlf_template_variables",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id").notNull().references(() => jlfTemplates.id, { onDelete: "cascade" }),
    variableId: text("variable_id").notNull().references(() => jlfVariables.id),
    placeholder: text("placeholder").notNull(),
    isRequired: integer("is_required").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    templatePlaceholderUnique: uniqueIndex("idx_jlf_template_variables_placeholder_unique").on(table.templateId, table.placeholder),
    templateIdx: index("idx_jlf_template_variables_template").on(table.templateId),
    variableIdx: index("idx_jlf_template_variables_variable").on(table.variableId),
  })
);

export const jlfManualValues = pgTable(
  "jlf_manual_values",
  {
    id: text("id").primaryKey(),
    nomorPerkara: text("nomor_perkara").notNull(),
    sippPerkaraId: text("sipp_perkara_id").notNull().default(""),
    templateId: text("template_id").references(() => jlfTemplates.id),
    variableKey: text("variable_key").notNull(),
    valueType: text("value_type").notNull(),
    valueText: text("value_text").notNull().default(""),
    valueJson: jsonb("value_json"),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    nomorPerkaraIdx: index("idx_jlf_manual_values_nomor_perkara").on(table.nomorPerkara),
    sippPerkaraIdx: index("idx_jlf_manual_values_sipp_perkara").on(table.sippPerkaraId),
    templateIdx: index("idx_jlf_manual_values_template").on(table.templateId),
    variableKeyIdx: index("idx_jlf_manual_values_variable_key").on(table.variableKey),
  })
);

export const jlfGeneratedDocuments = pgTable(
  "jlf_generated_documents",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id").notNull().references(() => jlfTemplates.id),
    templateVersionId: text("template_version_id").references(() => jlfTemplateVersions.id),
    nomorPerkara: text("nomor_perkara").notNull(),
    sippPerkaraId: text("sipp_perkara_id").notNull().default(""),
    status: text("status").notNull().default("draft"),
    outputFilePath: text("output_file_path").notNull().default(""),
    outputFileType: text("output_file_type").notNull().default(""),
    checksum: text("checksum").notNull().default(""),
    verificationToken: text("verification_token"),
    verificationTokenHash: text("verification_token_hash"),
    generatedBy: text("generated_by").references(() => users.id),
    validatedBy: text("validated_by").references(() => users.id),
    validatedAt: text("validated_at"),
    finalizedAt: text("finalized_at"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    templateIdx: index("idx_jlf_generated_documents_template").on(table.templateId),
    nomorPerkaraIdx: index("idx_jlf_generated_documents_nomor_perkara").on(table.nomorPerkara),
    sippPerkaraIdx: index("idx_jlf_generated_documents_sipp_perkara").on(table.sippPerkaraId),
    statusIdx: index("idx_jlf_generated_documents_status").on(table.status),
    generatedByIdx: index("idx_jlf_generated_documents_generated_by").on(table.generatedBy),
    createdAtIdx: index("idx_jlf_generated_documents_created_at").on(table.createdAt),
    verificationHashIdx: index("idx_jlf_generated_documents_verification_hash").on(table.verificationTokenHash),
  })
);

export const jlfDocumentVariablesSnapshot = pgTable(
  "jlf_document_variables_snapshot",
  {
    id: text("id").primaryKey(),
    generatedDocumentId: text("generated_document_id").notNull().references(() => jlfGeneratedDocuments.id, { onDelete: "cascade" }),
    variableKey: text("variable_key").notNull(),
    placeholder: text("placeholder").notNull(),
    resolvedValue: text("resolved_value").notNull().default(""),
    sourceType: text("source_type").notNull(),
    warnings: jsonb("warnings").notNull().default(sql`'[]'::jsonb`),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    documentIdx: index("idx_jlf_document_variables_snapshot_document").on(table.generatedDocumentId),
    variableKeyIdx: index("idx_jlf_document_variables_snapshot_variable_key").on(table.variableKey),
  })
);

export const jlfDocumentValidationLogs = pgTable(
  "jlf_document_validation_logs",
  {
    id: text("id").primaryKey(),
    generatedDocumentId: text("generated_document_id").notNull().references(() => jlfGeneratedDocuments.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    comment: text("comment").notNull().default(""),
    actorId: text("actor_id").references(() => users.id),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    documentIdx: index("idx_jlf_document_validation_logs_document").on(table.generatedDocumentId),
  })
);

export const jlfSettings = pgTable(
  "jlf_settings",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    value: jsonb("value").notNull().default(sql`'{}'::jsonb`),
    description: text("description").notNull().default(""),
    updatedBy: text("updated_by").references(() => users.id),
    updatedAt: text("updated_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    keyUnique: uniqueIndex("idx_jlf_settings_key_unique").on(table.key),
  })
);

export const jlfAuditLogs = pgTable(
  "jlf_audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull().default(""),
    nomorPerkara: text("nomor_perkara").notNull().default(""),
    ipAddress: text("ip_address").notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    userIdx: index("idx_jlf_audit_logs_user").on(table.userId),
    actionIdx: index("idx_jlf_audit_logs_action").on(table.action),
    entityTypeIdx: index("idx_jlf_audit_logs_entity_type").on(table.entityType),
    entityIdIdx: index("idx_jlf_audit_logs_entity_id").on(table.entityId),
    nomorPerkaraIdx: index("idx_jlf_audit_logs_nomor_perkara").on(table.nomorPerkara),
    createdAtIdx: index("idx_jlf_audit_logs_created_at").on(table.createdAt),
  })
);

export const jlfSippAccountLinks = pgTable(
  "jlf_sipp_account_links",
  {
    id: text("id").primaryKey(),
    aletaUserId: text("aleta_user_id").notNull().references(() => users.id),
    sippUserId: text("sipp_user_id").notNull(),
    sippUsername: text("sipp_username").notNull(),
    sippFullname: text("sipp_fullname").notNull().default(""),
    sippNip: text("sipp_nip").notNull().default(""),
    sippEmail: text("sipp_email").notNull().default(""),
    sippGroupId: text("sipp_group_id").notNull().default(""),
    sippGroupName: text("sipp_group_name").notNull().default(""),
    sippSatkerCode: text("sipp_satker_code").notNull().default(""),
    sippSatkerName: text("sipp_satker_name").notNull().default(""),
    linkStatus: text("link_status").notNull().default("suggested"),
    linkMethod: text("link_method").notNull().default("auto_suggestion"),
    confidenceScore: doublePrecision("confidence_score").notNull().default(0),
    matchedFields: jsonb("matched_fields").notNull().default(sql`'[]'::jsonb`),
    linkedBy: text("linked_by").references(() => users.id),
    linkedAt: text("linked_at"),
    unlinkedBy: text("unlinked_by").references(() => users.id),
    unlinkedAt: text("unlinked_at"),
    lastSyncedAt: text("last_synced_at"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    aletaUserIdx: index("idx_jlf_sipp_account_links_aleta_user").on(table.aletaUserId),
    sippUserIdx: index("idx_jlf_sipp_account_links_sipp_user").on(table.sippUserId),
    sippUsernameIdx: index("idx_jlf_sipp_account_links_sipp_username").on(table.sippUsername),
    sippNipIdx: index("idx_jlf_sipp_account_links_sipp_nip").on(table.sippNip),
    statusIdx: index("idx_jlf_sipp_account_links_status").on(table.linkStatus),
  })
);

export const jlfSippRoleMappings = pgTable(
  "jlf_sipp_role_mappings",
  {
    id: text("id").primaryKey(),
    sippGroupId: text("sipp_group_id").notNull(),
    sippGroupName: text("sipp_group_name").notNull(),
    suggestedAletaRoleId: text("suggested_aleta_role_id").references(() => roles.id),
    suggestedPermissions: jsonb("suggested_permissions").notNull().default(sql`'[]'::jsonb`),
    isAutoApply: integer("is_auto_apply").notNull().default(0),
    requiresAdminApproval: integer("requires_admin_approval").notNull().default(1),
    description: text("description").notNull().default(""),
    isActive: integer("is_active").notNull().default(1),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  }
);

export const jlfSippUserSnapshots = pgTable("jlf_sipp_user_snapshots", {
  id: text("id").primaryKey(),
  sippUserId: text("sipp_user_id").notNull(),
  sippUsername: text("sipp_username").notNull(),
  sippFullname: text("sipp_fullname").notNull().default(""),
  sippNip: text("sipp_nip").notNull().default(""),
  sippEmail: text("sipp_email").notNull().default(""),
  sippGroupId: text("sipp_group_id").notNull().default(""),
  sippGroupName: text("sipp_group_name").notNull().default(""),
  sippSatkerCode: text("sipp_satker_code").notNull().default(""),
  sippSatkerName: text("sipp_satker_name").notNull().default(""),
  rawSnapshot: jsonb("raw_snapshot").notNull().default(sql`'{}'::jsonb`),
  syncedAt: text("synced_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const jlfRegulationTypes = pgTable(
  "jlf_regulation_types",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    hierarchyLevel: integer("hierarchy_level").notNull().default(0),
    issuingScope: text("issuing_scope").notNull().default(""),
    isBinding: integer("is_binding").notNull().default(1),
    isActive: integer("is_active").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex("idx_jlf_regulation_types_code_unique").on(table.code),
    activeIdx: index("idx_jlf_regulation_types_active").on(table.isActive),
  })
);

export const jlfRegulations = pgTable(
  "jlf_regulations",
  {
    id: text("id").primaryKey(),
    regulationTypeId: text("regulation_type_id").notNull().references(() => jlfRegulationTypes.id),
    title: text("title").notNull(),
    shortTitle: text("short_title").notNull().default(""),
    regulationNumber: text("regulation_number").notNull().default(""),
    regulationYear: integer("regulation_year"),
    issuingBody: text("issuing_body").notNull().default(""),
    jurisdiction: text("jurisdiction").notNull().default(""),
    subject: text("subject").notNull().default(""),
    summary: text("summary").notNull().default(""),
    status: text("status").notNull().default("draft"),
    verificationStatus: text("verification_status").notNull().default("unverified"),
    sourceUrl: text("source_url").notNull().default(""),
    sourceName: text("source_name").notNull().default(""),
    officialDocumentPath: text("official_document_path").notNull().default(""),
    effectiveDate: text("effective_date"),
    promulgationDate: text("promulgation_date"),
    revokedAt: text("revoked_at"),
    revokedByRegulationId: text("revoked_by_regulation_id").references((): AnyPgColumn => jlfRegulations.id),
    supersededByRegulationId: text("superseded_by_regulation_id").references((): AnyPgColumn => jlfRegulations.id),
    tags: jsonb("tags").notNull().default(sql`'[]'::jsonb`),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdBy: text("created_by").references(() => users.id),
    verifiedBy: text("verified_by").references(() => users.id),
    verifiedAt: text("verified_at"),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => ({
    typeIdx: index("idx_jlf_regulations_type").on(table.regulationTypeId),
    statusIdx: index("idx_jlf_regulations_status").on(table.status),
    verificationIdx: index("idx_jlf_regulations_verification_status").on(table.verificationStatus),
    yearIdx: index("idx_jlf_regulations_year").on(table.regulationYear),
  })
);

export const jlfRegulationVersions = pgTable(
  "jlf_regulation_versions",
  {
    id: text("id").primaryKey(),
    regulationId: text("regulation_id").notNull().references(() => jlfRegulations.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    versionLabel: text("version_label").notNull().default(""),
    documentPath: text("document_path").notNull().default(""),
    checksum: text("checksum").notNull().default(""),
    textContent: text("text_content").notNull().default(""),
    extractedTextStatus: text("extracted_text_status").notNull().default("pending"),
    changeNote: text("change_note").notNull().default(""),
    createdBy: text("created_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    regulationVersionUnique: uniqueIndex("idx_jlf_regulation_versions_unique").on(table.regulationId, table.versionNumber),
    regulationIdx: index("idx_jlf_regulation_versions_regulation").on(table.regulationId),
  })
);

export const jlfRegulationSections = pgTable(
  "jlf_regulation_sections",
  {
    id: text("id").primaryKey(),
    regulationId: text("regulation_id").notNull().references(() => jlfRegulations.id, { onDelete: "cascade" }),
    regulationVersionId: text("regulation_version_id").references(() => jlfRegulationVersions.id, { onDelete: "cascade" }),
    sectionType: text("section_type").notNull(),
    sectionNumber: text("section_number").notNull().default(""),
    parentSectionId: text("parent_section_id").references((): AnyPgColumn => jlfRegulationSections.id),
    title: text("title").notNull().default(""),
    content: text("content").notNull().default(""),
    normalizedContent: text("normalized_content").notNull().default(""),
    pageNumber: integer("page_number"),
    sortOrder: integer("sort_order").notNull().default(0),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    regulationIdx: index("idx_jlf_regulation_sections_regulation").on(table.regulationId),
    versionIdx: index("idx_jlf_regulation_sections_version").on(table.regulationVersionId),
    parentIdx: index("idx_jlf_regulation_sections_parent").on(table.parentSectionId),
  })
);

export const jlfRegulationTopics = pgTable(
  "jlf_regulation_topics",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    parentId: text("parent_id").references((): AnyPgColumn => jlfRegulationTopics.id),
    isActive: integer("is_active").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("idx_jlf_regulation_topics_slug_unique").on(table.slug),
    parentIdx: index("idx_jlf_regulation_topics_parent").on(table.parentId),
  })
);

export const jlfRegulationTopicLinks = pgTable(
  "jlf_regulation_topic_links",
  {
    id: text("id").primaryKey(),
    regulationId: text("regulation_id").notNull().references(() => jlfRegulations.id, { onDelete: "cascade" }),
    topicId: text("topic_id").notNull().references(() => jlfRegulationTopics.id, { onDelete: "cascade" }),
    relevanceNote: text("relevance_note").notNull().default(""),
    createdBy: text("created_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    regulationTopicUnique: uniqueIndex("idx_jlf_regulation_topic_links_unique").on(table.regulationId, table.topicId),
  })
);

export const jlfTemplateRegulations = pgTable(
  "jlf_template_regulations",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id").notNull().references(() => jlfTemplates.id, { onDelete: "cascade" }),
    regulationId: text("regulation_id").notNull().references(() => jlfRegulations.id),
    regulationSectionId: text("regulation_section_id").references(() => jlfRegulationSections.id),
    relationType: text("relation_type").notNull(),
    note: text("note").notNull().default(""),
    createdBy: text("created_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    templateIdx: index("idx_jlf_template_regulations_template").on(table.templateId),
    regulationIdx: index("idx_jlf_template_regulations_regulation").on(table.regulationId),
  })
);

export const jlfVariableRegulations = pgTable(
  "jlf_variable_regulations",
  {
    id: text("id").primaryKey(),
    variableId: text("variable_id").notNull().references(() => jlfVariables.id, { onDelete: "cascade" }),
    regulationId: text("regulation_id").notNull().references(() => jlfRegulations.id),
    regulationSectionId: text("regulation_section_id").references(() => jlfRegulationSections.id),
    relationType: text("relation_type").notNull(),
    note: text("note").notNull().default(""),
    createdBy: text("created_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    variableIdx: index("idx_jlf_variable_regulations_variable").on(table.variableId),
    regulationIdx: index("idx_jlf_variable_regulations_regulation").on(table.regulationId),
  })
);

export const jlfAiPrompts = pgTable(
  "jlf_ai_prompts",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    promptTemplate: text("prompt_template").notNull(),
    inputSchema: jsonb("input_schema").notNull().default(sql`'{}'::jsonb`),
    outputSchema: jsonb("output_schema").notNull().default(sql`'{}'::jsonb`),
    isActive: integer("is_active").notNull().default(1),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    keyUnique: uniqueIndex("idx_jlf_ai_prompts_key_unique").on(table.key),
  })
);

export const jlfAiLogs = pgTable(
  "jlf_ai_logs",
  {
    id: text("id").primaryKey(),
    feature: text("feature").notNull(),
    userId: text("user_id").references(() => users.id),
    nomorPerkara: text("nomor_perkara").notNull().default(""),
    inputRedacted: jsonb("input_redacted").notNull().default(sql`'{}'::jsonb`),
    outputText: text("output_text").notNull().default(""),
    provider: text("provider").notNull().default(""),
    model: text("model").notNull().default(""),
    tokenUsage: jsonb("token_usage").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    featureIdx: index("idx_jlf_ai_logs_feature").on(table.feature),
    userIdx: index("idx_jlf_ai_logs_user").on(table.userId),
    createdAtIdx: index("idx_jlf_ai_logs_created_at").on(table.createdAt),
  })
);

export const jlfLegalAnalysisSessions = pgTable(
  "jlf_legal_analysis_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    nomorPerkara: text("nomor_perkara"),
    generatedDocumentId: text("generated_document_id").references(() => jlfGeneratedDocuments.id),
    analysisType: text("analysis_type").notNull(),
    inputSummary: text("input_summary").notNull().default(""),
    outputSummary: text("output_summary").notNull().default(""),
    status: text("status").notNull().default("draft"),
    aiUsed: integer("ai_used").notNull().default(0),
    model: text("model").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    userIdx: index("idx_jlf_legal_analysis_sessions_user").on(table.userId),
    documentIdx: index("idx_jlf_legal_analysis_sessions_document").on(table.generatedDocumentId),
  })
);

export const jlfLegalAnalysisSources = pgTable(
  "jlf_legal_analysis_sources",
  {
    id: text("id").primaryKey(),
    analysisSessionId: text("analysis_session_id").notNull().references(() => jlfLegalAnalysisSessions.id, { onDelete: "cascade" }),
    regulationId: text("regulation_id").notNull().references(() => jlfRegulations.id),
    regulationSectionId: text("regulation_section_id").references(() => jlfRegulationSections.id),
    quotedText: text("quoted_text").notNull().default(""),
    relevanceScore: doublePrecision("relevance_score").notNull().default(0),
    aiReason: text("ai_reason").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    sessionIdx: index("idx_jlf_legal_analysis_sources_session").on(table.analysisSessionId),
    regulationIdx: index("idx_jlf_legal_analysis_sources_regulation").on(table.regulationId),
  })
);

export const jlfWhatsappNotificationTemplates = pgTable(
  "jlf_whatsapp_notification_templates",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    eventType: text("event_type").notNull(),
    messageTemplate: text("message_template").notNull(),
    isActive: integer("is_active").notNull().default(1),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    keyUnique: uniqueIndex("idx_jlf_whatsapp_notification_templates_key_unique").on(table.key),
    eventIdx: index("idx_jlf_whatsapp_notification_templates_event").on(table.eventType),
  })
);

export const jlfWhatsappNotificationLogs = pgTable(
  "jlf_whatsapp_notification_logs",
  {
    id: text("id").primaryKey(),
    eventType: text("event_type").notNull(),
    recipientUserId: text("recipient_user_id").references(() => users.id),
    recipientPhoneMasked: text("recipient_phone_masked").notNull().default(""),
    relatedEntityType: text("related_entity_type").notNull().default(""),
    relatedEntityId: text("related_entity_id").notNull().default(""),
    nomorPerkara: text("nomor_perkara").notNull().default(""),
    messagePreview: text("message_preview").notNull().default(""),
    status: text("status").notNull(),
    gatewayProvider: text("gateway_provider").notNull().default("aleta_bot"),
    gatewayMessageId: text("gateway_message_id").notNull().default(""),
    errorMessage: text("error_message"),
    createdBy: text("created_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    eventIdx: index("idx_jlf_whatsapp_notification_logs_event").on(table.eventType),
    recipientIdx: index("idx_jlf_whatsapp_notification_logs_recipient").on(table.recipientUserId),
    entityIdx: index("idx_jlf_whatsapp_notification_logs_entity").on(table.relatedEntityType, table.relatedEntityId),
    createdAtIdx: index("idx_jlf_whatsapp_notification_logs_created_at").on(table.createdAt),
  })
);

export const aletaSippTables = pgTable(
  "aleta_sipp_tables",
  {
    id: text("id").primaryKey(),
    tableName: text("table_name").notNull(),
    humanName: text("human_name").notNull(),
    category: text("category").notNull(),
    priority: integer("priority").notNull().default(3),
    shortDescription: text("short_description").notNull().default(""),
    longDescription: text("long_description").notNull().default(""),
    functionInCaseProcess: text("function_in_case_process").notNull().default(""),
    tableKind: text("table_kind").notNull().default("pendukung"),
    sourceSchemaHash: text("source_schema_hash").notNull().default(""),
    riskNotes: jsonb("risk_notes").notNull().default(sql`'[]'::jsonb`),
    exampleUsage: text("example_usage").notNull().default(""),
    exampleQueryKey: text("example_query_key").notNull().default(""),
    businessFunction: text("business_function").notNull().default(""),
    mainColumnsSummary: text("main_columns_summary").notNull().default(""),
    relationSummary: text("relation_summary").notNull().default(""),
    usageExamples: jsonb("usage_examples").notNull().default(sql`'[]'::jsonb`),
    dataQualityNotes: text("data_quality_notes").notNull().default(""),
    analysisStatus: text("analysis_status").notNull().default("UNKNOWN"),
    confidenceScore: doublePrecision("confidence_score").notNull().default(0),
    reviewStatus: text("review_status").notNull().default("NEEDS_ADMIN_REVIEW"),
    reviewNotes: text("review_notes").notNull().default(""),
    analyzedAt: text("analyzed_at"),
    reviewedAt: text("reviewed_at"),
    reviewedBy: text("reviewed_by").references(() => users.id),
    isActive: integer("is_active").notNull().default(1),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    tableNameUnique: uniqueIndex("idx_aleta_sipp_tables_table_name_unique").on(table.tableName),
    categoryIdx: index("idx_aleta_sipp_tables_category").on(table.category, table.priority),
  })
);

export const aletaSippColumns = pgTable(
  "aleta_sipp_columns",
  {
    id: text("id").primaryKey(),
    tableId: text("table_id").notNull().references(() => aletaSippTables.id, { onDelete: "cascade" }),
    tableName: text("table_name").notNull(),
    columnName: text("column_name").notNull(),
    humanName: text("human_name").notNull().default(""),
    dataType: text("data_type").notNull().default(""),
    isNullable: integer("is_nullable").notNull().default(1),
    isPrimaryKey: integer("is_primary_key").notNull().default(0),
    isIndexed: integer("is_indexed").notNull().default(0),
    description: text("description").notNull().default(""),
    exampleValue: text("example_value").notNull().default(""),
    relationHint: text("relation_hint").notNull().default(""),
    queryUsageJson: jsonb("query_usage_json").notNull().default(sql`'[]'::jsonb`),
    qualityNotes: text("quality_notes").notNull().default(""),
    defaultValue: text("default_value").notNull().default(""),
    usageNotes: text("usage_notes").notNull().default(""),
    analysisStatus: text("analysis_status").notNull().default("UNKNOWN"),
    confidenceScore: doublePrecision("confidence_score").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    tableColumnUnique: uniqueIndex("idx_aleta_sipp_columns_table_column_unique").on(table.tableName, table.columnName),
    tableIdx: index("idx_aleta_sipp_columns_table").on(table.tableId, table.sortOrder),
  })
);

export const aletaSippRelations = pgTable(
  "aleta_sipp_relations",
  {
    id: text("id").primaryKey(),
    sourceTableId: text("source_table_id").references(() => aletaSippTables.id, { onDelete: "cascade" }),
    sourceTable: text("source_table").notNull(),
    sourceColumn: text("source_column").notNull(),
    targetTableId: text("target_table_id").references(() => aletaSippTables.id, { onDelete: "cascade" }),
    targetTable: text("target_table").notNull(),
    targetColumn: text("target_column").notNull().default("id"),
    relationType: text("relation_type").notNull().default("inferred"),
    confidence: text("confidence").notNull().default("medium"),
    description: text("description").notNull().default(""),
    exampleQueryKey: text("example_query_key").notNull().default(""),
    isActive: integer("is_active").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    relationIdx: index("idx_aleta_sipp_relations_source_target").on(table.sourceTable, table.targetTable),
  })
);

export const aletaSippQueryRegistry = pgTable(
  "aleta_sipp_query_registry",
  {
    id: text("id").primaryKey(),
    queryKey: text("query_key").notNull(),
    name: text("name").notNull(),
    queryName: text("query_name").notNull().default(""),
    queryTitle: text("query_title").notNull().default(""),
    category: text("category").notNull(),
    subCategory: text("sub_category").notNull().default(""),
    source: text("source").notNull(),
    businessPurpose: text("business_purpose").notNull().default(""),
    sourceType: text("source_type").notNull().default("AUTO_GENERATED"),
    sourceFile: text("source_file").notNull().default(""),
    sourceLocation: text("source_location").notNull().default(""),
    sourceLine: integer("source_line"),
    shortDescription: text("short_description").notNull().default(""),
    longDescription: text("long_description").notNull().default(""),
    tablesJson: jsonb("tables_json").notNull().default(sql`'[]'::jsonb`),
    outputColumnsJson: jsonb("output_columns_json").notNull().default(sql`'[]'::jsonb`),
    originalSql: text("original_sql").notNull().default(""),
    normalizedSql: text("normalized_sql").notNull().default(""),
    parameterizedSql: text("parameterized_sql").notNull().default(""),
    sqlHash: text("sql_hash").notNull().default(""),
    columnsUsedJson: jsonb("columns_used_json").notNull().default(sql`'[]'::jsonb`),
    parametersJson: jsonb("parameters_json").notNull().default(sql`'[]'::jsonb`),
    outputsJson: jsonb("outputs_json").notNull().default(sql`'[]'::jsonb`),
    relatedTableNamesJson: jsonb("related_table_names_json").notNull().default(sql`'[]'::jsonb`),
    relatedVariableCodesJson: jsonb("related_variable_codes_json").notNull().default(sql`'[]'::jsonb`),
    relatedVariableKeysJson: jsonb("related_variable_keys_json").notNull().default(sql`'[]'::jsonb`),
    executionMode: text("execution_mode").notNull().default("NEEDS_REVIEW"),
    securityStatus: text("security_status").notNull().default("NEEDS_REVIEW"),
    reviewStatus: text("review_status").notNull().default("NEEDS_ADMIN_REVIEW"),
    confidenceScore: doublePrecision("confidence_score").notNull().default(0),
    roleScopeJson: jsonb("role_scope_json").notNull().default(sql`'[]'::jsonb`),
    aiAllowed: integer("ai_allowed").notNull().default(0),
    whatsappAllowed: integer("whatsapp_allowed").notNull().default(0),
    pdfAllowed: integer("pdf_allowed").notNull().default(0),
    isAiUsable: integer("is_ai_usable").notNull().default(0),
    isWhatsappUsable: integer("is_whatsapp_usable").notNull().default(0),
    isPdfUsable: integer("is_pdf_usable").notNull().default(0),
    riskNotesJson: jsonb("risk_notes_json").notNull().default(sql`'[]'::jsonb`),
    riskNotes: text("risk_notes").notNull().default(""),
    usageNotes: text("usage_notes").notNull().default(""),
    exampleParams: jsonb("example_params").notNull().default(sql`'{}'::jsonb`),
    exampleOutput: jsonb("example_output").notNull().default(sql`'{}'::jsonb`),
    isActive: integer("is_active").notNull().default(1),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    queryKeyUnique: uniqueIndex("idx_aleta_sipp_query_registry_key_unique").on(table.queryKey),
    statusIdx: index("idx_aleta_sipp_query_registry_status").on(table.securityStatus, table.isActive),
    sourceTypeIdx: index("idx_aleta_sipp_query_registry_source_type").on(table.sourceType, table.isActive),
    executionIdx: index("idx_aleta_sipp_query_registry_execution").on(table.executionMode, table.securityStatus, table.reviewStatus, table.isActive),
    reviewIdx: index("idx_aleta_sipp_query_registry_review").on(table.reviewStatus, table.confidenceScore),
    sqlHashIdx: index("idx_aleta_sipp_query_registry_sql_hash").on(table.sqlHash),
  })
);

export const aletaSippQueryParameters = pgTable(
  "aleta_sipp_query_parameters",
  {
    id: text("id").primaryKey(),
    queryId: text("query_id").notNull().references(() => aletaSippQueryRegistry.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    label: text("label").notNull(),
    dataType: text("data_type").notNull(),
    required: integer("required").notNull().default(0),
    defaultValue: text("default_value").notNull().default(""),
    validationRule: text("validation_rule").notNull().default(""),
    exampleValue: text("example_value").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    queryParamUnique: uniqueIndex("idx_aleta_sipp_query_parameters_unique").on(table.queryId, table.name),
  })
);

export const aletaSippQueryOutputs = pgTable(
  "aleta_sipp_query_outputs",
  {
    id: text("id").primaryKey(),
    queryId: text("query_id").notNull().references(() => aletaSippQueryRegistry.id, { onDelete: "cascade" }),
    columnName: text("column_name").notNull(),
    label: text("label").notNull().default(""),
    dataType: text("data_type").notNull().default("text"),
    description: text("description").notNull().default(""),
    sensitive: integer("sensitive").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    queryOutputUnique: uniqueIndex("idx_aleta_sipp_query_outputs_unique").on(table.queryId, table.columnName),
  })
);

export const aletaSippVariables = pgTable(
  "aleta_sipp_variables",
  {
    id: text("id").primaryKey(),
    variableKey: text("variable_key").notNull().default(""),
    legacySource: text("legacy_source").notNull().default(""),
    legacyCode: text("legacy_code").notNull().default(""),
    legacyNumber: integer("legacy_number"),
    modernKey: text("modern_key").notNull(),
    displayName: text("display_name").notNull(),
    shortDescription: text("short_description").notNull().default(""),
    longDescription: text("long_description").notNull().default(""),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("Lainnya"),
    dataType: text("data_type").notNull().default("text"),
    variableType: text("variable_type").notNull().default("UNKNOWN"),
    sourceType: text("source_type").notNull().default("manual"),
    sourceTable: text("source_table").notNull().default(""),
    sourceColumn: text("source_column").notNull().default(""),
    queryId: text("query_id").references(() => aletaSippQueryRegistry.id),
    sourceQueryKey: text("source_query_key").notNull().default(""),
    sourceSqlFragment: text("source_sql_fragment").notNull().default(""),
    placeholderPattern: text("placeholder_pattern").notNull().default(""),
    templateFilesJson: jsonb("template_files_json").notNull().default(sql`'[]'::jsonb`),
    transformKey: text("transform_key").notNull().default(""),
    exampleValue: text("example_value").notNull().default(""),
    fallbackValue: text("fallback_value").notNull().default(""),
    fallbackStrategy: text("fallback_strategy").notNull().default(""),
    required: integer("required").notNull().default(0),
    isRepeating: integer("is_repeating").notNull().default(0),
    repeatGroup: text("repeat_group").notNull().default(""),
    mappingStatus: text("mapping_status").notNull().default("UNRESOLVED"),
    reviewStatus: text("review_status").notNull().default("NEEDS_ADMIN_REVIEW"),
    confidenceScore: doublePrecision("confidence_score").notNull().default(0),
    riskNotes: text("risk_notes").notNull().default(""),
    usageNotes: text("usage_notes").notNull().default(""),
    status: text("status").notNull().default("NEEDS_REVIEW"),
    sensitive: integer("sensitive").notNull().default(0),
    isActive: integer("is_active").notNull().default(1),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    modernKeyUnique: uniqueIndex("idx_aleta_sipp_variables_modern_key_unique").on(table.modernKey),
    legacyScopedIdx: index("idx_aleta_sipp_variables_legacy_scoped").on(table.legacySource, table.legacyCode),
    sourceIdx: index("idx_aleta_sipp_variables_source").on(table.legacySource, table.sourceType, table.isActive),
    mappingIdx: index("idx_aleta_sipp_variables_mapping").on(table.mappingStatus, table.reviewStatus, table.isActive),
    categoryIdx: index("idx_aleta_sipp_variables_category").on(table.category, table.variableType, table.isActive),
    legacyNumberIdx: index("idx_aleta_sipp_variables_legacy_number").on(table.legacyNumber),
  })
);

export const aletaSippVariableMappings = pgTable(
  "aleta_sipp_variable_mappings",
  {
    id: text("id").primaryKey(),
    variableId: text("variable_id").notNull().references(() => aletaSippVariables.id, { onDelete: "cascade" }),
    legacySource: text("legacy_source").notNull(),
    legacyCode: text("legacy_code").notNull(),
    modernKey: text("modern_key").notNull(),
    mappingStatus: text("mapping_status").notNull().default("NEEDS_REVIEW"),
    templateUsageJson: jsonb("template_usage_json").notNull().default(sql`'[]'::jsonb`),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    mappingUnique: uniqueIndex("idx_aleta_sipp_variable_mappings_unique").on(table.legacySource, table.legacyCode, table.modernKey),
  })
);

export const aletaSippQueryTableLinks = pgTable(
  "aleta_sipp_query_table_links",
  {
    id: text("id").primaryKey(),
    queryId: text("query_id").notNull().references(() => aletaSippQueryRegistry.id, { onDelete: "cascade" }),
    queryKey: text("query_key").notNull(),
    tableName: text("table_name").notNull(),
    columnNamesJson: jsonb("column_names_json").notNull().default(sql`'[]'::jsonb`),
    relationRole: text("relation_role").notNull().default("uses"),
    confidenceScore: doublePrecision("confidence_score").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    uniqueLink: uniqueIndex("idx_aleta_sipp_query_table_links_unique").on(table.queryKey, table.tableName),
    tableIdx: index("idx_aleta_sipp_query_table_links_table").on(table.tableName, table.queryKey),
  })
);

export const aletaSippQueryVariableLinks = pgTable(
  "aleta_sipp_query_variable_links",
  {
    id: text("id").primaryKey(),
    queryId: text("query_id").notNull().references(() => aletaSippQueryRegistry.id, { onDelete: "cascade" }),
    variableId: text("variable_id").references(() => aletaSippVariables.id, { onDelete: "set null" }),
    queryKey: text("query_key").notNull(),
    legacyCode: text("legacy_code").notNull().default(""),
    variableKey: text("variable_key").notNull().default(""),
    mappingStatus: text("mapping_status").notNull().default("UNRESOLVED"),
    sourceContext: text("source_context").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    uniqueLink: uniqueIndex("idx_aleta_sipp_query_variable_links_unique").on(table.queryKey, table.legacyCode, table.variableKey),
    queryIdx: index("idx_aleta_sipp_query_variable_links_query").on(table.queryKey, table.mappingStatus),
    variableIdx: index("idx_aleta_sipp_query_variable_links_variable").on(table.legacyCode, table.variableKey),
  })
);

export const aletaSippVariableTemplateLinks = pgTable(
  "aleta_sipp_variable_template_links",
  {
    id: text("id").primaryKey(),
    variableId: text("variable_id").references(() => aletaSippVariables.id, { onDelete: "cascade" }),
    legacyCode: text("legacy_code").notNull().default(""),
    variableKey: text("variable_key").notNull().default(""),
    sourceType: text("source_type").notNull().default(""),
    sourceFile: text("source_file").notNull().default(""),
    sourceLocation: text("source_location").notNull().default(""),
    usageContext: text("usage_context").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    uniqueLink: uniqueIndex("idx_aleta_sipp_variable_template_links_unique").on(table.legacyCode, table.variableKey, table.sourceFile, table.sourceLocation),
    variableIdx: index("idx_aleta_sipp_variable_template_links_variable").on(table.legacyCode, table.variableKey),
  })
);

export const aletaSippUnresolvedPlaceholders = pgTable(
  "aleta_sipp_unresolved_placeholders",
  {
    id: text("id").primaryKey(),
    legacyCode: text("legacy_code").notNull(),
    legacyNumber: integer("legacy_number"),
    sourceType: text("source_type").notNull().default(""),
    sourceFile: text("source_file").notNull().default(""),
    sourceLocation: text("source_location").notNull().default(""),
    contextText: text("context_text").notNull().default(""),
    suggestedVariableKey: text("suggested_variable_key").notNull().default(""),
    status: text("status").notNull().default("UNRESOLVED"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    uniquePlaceholder: uniqueIndex("idx_aleta_sipp_unresolved_placeholders_unique").on(table.legacyCode, table.sourceFile, table.sourceLocation),
    codeIdx: index("idx_aleta_sipp_unresolved_placeholders_code").on(table.legacyCode, table.status),
  })
);

export const aletaSippVariableConflicts = pgTable(
  "aleta_sipp_variable_conflicts",
  {
    id: text("id").primaryKey(),
    legacyCode: text("legacy_code").notNull(),
    variableKey: text("variable_key").notNull(),
    conflictType: text("conflict_type").notNull().default("DUPLICATE_MAPPING"),
    detailsJson: jsonb("details_json").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("OPEN"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  }
);

export const aletaSippImportJobs = pgTable(
  "aleta_sipp_import_jobs",
  {
    id: text("id").primaryKey(),
    importType: text("import_type").notNull(),
    sourcePath: text("source_path").notNull().default(""),
    mode: text("mode").notNull().default("dry_run"),
    status: text("status").notNull().default("PENDING"),
    summaryJson: jsonb("summary_json").notNull().default(sql`'{}'::jsonb`),
    errorMessage: text("error_message"),
    executedBy: text("executed_by").references(() => users.id),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    importStatusIdx: index("idx_aleta_sipp_import_jobs_status").on(table.importType, table.status, table.createdAt),
  })
);

export const aletaSippImportJobItems = pgTable(
  "aleta_sipp_import_job_items",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull().references(() => aletaSippImportJobs.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull(),
    sourceKey: text("source_key").notNull().default(""),
    status: text("status").notNull().default("NEEDS_REVIEW"),
    payloadJson: jsonb("payload_json").notNull().default(sql`'{}'::jsonb`),
    warningJson: jsonb("warning_json").notNull().default(sql`'[]'::jsonb`),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    jobItemIdx: index("idx_aleta_sipp_import_job_items_job").on(table.jobId, table.itemType, table.status),
  })
);

export const aletaSippAssessmentIndicators = pgTable(
  "aleta_sipp_assessment_indicators",
  {
    id: text("id").primaryKey(),
    indicatorCode: text("indicator_code").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    skBasis: text("sk_basis").notNull().default(""),
    description: text("description").notNull().default(""),
    weight: doublePrecision("weight").notNull().default(0),
    formula: text("formula").notNull().default(""),
    sourceTablesJson: jsonb("source_tables_json").notNull().default(sql`'[]'::jsonb`),
    queryId: text("query_id").references(() => aletaSippQueryRegistry.id),
    parameterPeriod: text("parameter_period").notNull().default(""),
    status: text("status").notNull().default("DATA_TIDAK_CUKUP"),
    assumptionNotes: text("assumption_notes").notNull().default(""),
    isActive: integer("is_active").notNull().default(1),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    indicatorCodeUnique: uniqueIndex("idx_aleta_sipp_assessment_indicators_code_unique").on(table.indicatorCode),
    categoryIdx: index("idx_aleta_sipp_assessment_indicators_category").on(table.category, table.status),
  })
);

export const aletaSippAssessmentQueries = pgTable("aleta_sipp_assessment_queries", {
  id: text("id").primaryKey(),
  indicatorId: text("indicator_id").notNull().references(() => aletaSippAssessmentIndicators.id, { onDelete: "cascade" }),
  queryId: text("query_id").references(() => aletaSippQueryRegistry.id),
  queryRole: text("query_role").notNull().default("score"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const aletaSippAssessmentRuns = pgTable(
  "aleta_sipp_assessment_runs",
  {
    id: text("id").primaryKey(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    status: text("status").notNull().default("PENDING"),
    totalScore: doublePrecision("total_score").notNull().default(0),
    summaryJson: jsonb("summary_json").notNull().default(sql`'{}'::jsonb`),
    executedBy: text("executed_by").references(() => users.id),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    periodIdx: index("idx_aleta_sipp_assessment_runs_period").on(table.periodStart, table.periodEnd, table.status),
  })
);

export const aletaSippAssessmentResults = pgTable(
  "aleta_sipp_assessment_results",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull().references(() => aletaSippAssessmentRuns.id, { onDelete: "cascade" }),
    indicatorId: text("indicator_id").notNull().references(() => aletaSippAssessmentIndicators.id),
    score: doublePrecision("score").notNull().default(0),
    status: text("status").notNull().default("DATA_TIDAK_CUKUP"),
    resultJson: jsonb("result_json").notNull().default(sql`'{}'::jsonb`),
    recommendation: text("recommendation").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    resultUnique: uniqueIndex("idx_aleta_sipp_assessment_results_unique").on(table.runId, table.indicatorId),
  })
);

export const aletaSippAssessmentResultItems = pgTable(
  "aleta_sipp_assessment_result_items",
  {
    id: text("id").primaryKey(),
    resultId: text("result_id").notNull().references(() => aletaSippAssessmentResults.id, { onDelete: "cascade" }),
    nomorPerkara: text("nomor_perkara").notNull().default(""),
    sourceCaseId: text("source_case_id").notNull().default(""),
    issueCode: text("issue_code").notNull().default(""),
    issueDescription: text("issue_description").notNull().default(""),
    recommendation: text("recommendation").notNull().default(""),
    itemJson: jsonb("item_json").notNull().default(sql`'{}'::jsonb`),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    resultItemIdx: index("idx_aleta_sipp_assessment_result_items_result").on(table.resultId, table.issueCode),
  })
);

export const aletaSippPdfTemplates = pgTable("aleta_sipp_pdf_templates", {
  id: text("id").primaryKey(),
  templateKey: text("template_key").notNull(),
  name: text("name").notNull(),
  documentType: text("document_type").notNull().default("jadwal_sidang"),
  layoutJson: jsonb("layout_json").notNull().default(sql`'{}'::jsonb`),
  isActive: integer("is_active").notNull().default(1),
  createdBy: text("created_by").references(() => users.id),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const aletaSippAuditLogs = pgTable(
  "aleta_sipp_audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull().default(""),
    queryKey: text("query_key").notNull().default(""),
    nomorPerkara: text("nomor_perkara").notNull().default(""),
    ipAddress: text("ip_address").notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    auditCreatedIdx: index("idx_aleta_sipp_audit_logs_created").on(table.createdAt, table.action, table.entityType),
    auditQueryIdx: index("idx_aleta_sipp_audit_logs_query").on(table.queryKey),
  })
);

export const aletaSippAiLogs = pgTable("aleta_sipp_ai_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  feature: text("feature").notNull(),
  promptRedacted: jsonb("prompt_redacted").notNull().default(sql`'{}'::jsonb`),
  responseText: text("response_text").notNull().default(""),
  status: text("status").notNull().default("draft"),
  provider: text("provider").notNull().default(""),
  model: text("model").notNull().default(""),
  metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
  createdAt: text("created_at").notNull(),
});

export const aletaSippUserSavedQueries = pgTable(
  "aleta_sipp_user_saved_queries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    queryId: text("query_id").references(() => aletaSippQueryRegistry.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    parametersJson: jsonb("parameters_json").notNull().default(sql`'{}'::jsonb`),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    savedUserIdx: index("idx_aleta_sipp_user_saved_queries_user").on(table.userId),
  })
);

export const aletaSippQueryFavorites = pgTable(
  "aleta_sipp_query_favorites",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    queryId: text("query_id").notNull().references(() => aletaSippQueryRegistry.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    favoriteUnique: uniqueIndex("idx_aleta_sipp_query_favorites_unique").on(table.userId, table.queryId),
  })
);

export const estatusSippConnections = pgTable(
  "estatus_sipp_connections",
  {
    id: text("id").primaryKey(),
    connectionName: text("connection_name").notNull(),
    host: text("host").notNull(),
    port: integer("port").notNull().default(3306),
    databaseName: text("database_name").notNull(),
    username: text("username").notNull(),
    encryptedPassword: text("encrypted_password").notNull().default(""),
    passwordSecretRef: text("password_secret_ref").notNull().default(""),
    driver: text("driver").notNull().default("mysql"),
    charset: text("charset").notNull().default("utf8mb4"),
    connectionMode: text("connection_mode").notNull().default("bridge"),
    readonlyEnforced: integer("readonly_enforced").notNull().default(1),
    syncScheduleCron: text("sync_schedule_cron").notNull().default(""),
    isActive: integer("is_active").notNull().default(1),
    lastTestStatus: text("last_test_status").notNull().default("idle"),
    lastTestMessage: text("last_test_message"),
    lastTestAt: text("last_test_at"),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    activeIdx: index("idx_estatus_sipp_connections_active").on(table.isActive, table.connectionMode),
  })
);

export const estatusSippMappings = pgTable(
  "estatus_sipp_mappings",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id").references(() => estatusSippConnections.id),
    connectionKey: text("connection_key").notNull().default("sipp_primary"),
    mappingVersion: text("mapping_version").notNull(),
    sourceSchemaHash: text("source_schema_hash").notNull().default(""),
    entityKey: text("entity_key").notNull(),
    tableName: text("table_name").notNull(),
    columnName: text("column_name").notNull().default(""),
    joinRule: jsonb("join_rule").notNull().default(sql`'{}'::jsonb`),
    confidenceScore: doublePrecision("confidence_score").notNull().default(0),
    isActive: integer("is_active").notNull().default(1),
    verifiedBy: text("verified_by").references(() => users.id),
    verifiedAt: text("verified_at"),
    createdBy: text("created_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    entityIdx: index("idx_estatus_sipp_mappings_entity").on(table.entityKey, table.isActive),
  })
);

export const estatusSyncLogs = pgTable(
  "estatus_sync_logs",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id").references(() => estatusSippConnections.id),
    connectionKey: text("connection_key").notNull().default("sipp_primary"),
    syncType: text("sync_type").notNull(),
    syncScope: text("sync_scope").notNull().default("all"),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    status: text("status").notNull(),
    totalScanned: integer("total_scanned").notNull().default(0),
    totalCandidates: integer("total_candidates").notNull().default(0),
    totalInserted: integer("total_inserted").notNull().default(0),
    totalUpdated: integer("total_updated").notNull().default(0),
    totalErrors: integer("total_errors").notNull().default(0),
    structureHash: text("structure_hash").notNull().default(""),
    queryHash: text("query_hash").notNull().default(""),
    errorMessage: text("error_message"),
    executedBy: text("executed_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    createdIdx: index("idx_estatus_sync_logs_created").on(table.createdAt, table.status),
  })
);

export const estatusAgencies = pgTable(
  "estatus_agencies",
  {
    id: text("id").primaryKey(),
    agencyType: text("agency_type").notNull(),
    agencyName: text("agency_name").notNull(),
    wilayah: text("wilayah").notNull().default(""),
    address: text("address").notNull().default(""),
    contactPerson: text("contact_person").notNull().default(""),
    officialEmail: text("official_email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    deliveryMethod: text("delivery_method").notNull().default("manual"),
    apiEndpoint: text("api_endpoint").notNull().default(""),
    apiKeyEncrypted: text("api_key_encrypted").notNull().default(""),
    sftpHost: text("sftp_host").notNull().default(""),
    sftpUsername: text("sftp_username").notNull().default(""),
    sftpSecretRef: text("sftp_secret_ref").notNull().default(""),
    isActive: integer("is_active").notNull().default(1),
    cooperationStatus: text("cooperation_status").notNull().default("draft"),
    mouNumber: text("mou_number").notNull().default(""),
    mouDate: text("mou_date"),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    typeIdx: index("idx_estatus_agencies_type").on(table.agencyType, table.isActive),
  })
);

export const estatusRecords = pgTable(
  "estatus_records",
  {
    id: text("id").primaryKey(),
    sourceConnectionId: text("source_connection_id").references(() => estatusSippConnections.id),
    sourceConnectionKey: text("source_connection_key").notNull().default("sipp_primary"),
    sourceCaseId: text("source_case_id").notNull(),
    nomorPerkara: text("nomor_perkara").notNull(),
    jenisPerkara: text("jenis_perkara").notNull(),
    kategoriPerubahan: text("kategori_perubahan").notNull(),
    statusHukum: text("status_hukum").notNull().default(""),
    tanggalPendaftaran: text("tanggal_pendaftaran"),
    tanggalPutusan: text("tanggal_putusan"),
    tanggalBht: text("tanggal_bht"),
    tanggalIkrarTalak: text("tanggal_ikrar_talak"),
    nomorAktaCerai: text("nomor_akta_cerai"),
    tanggalAktaCerai: text("tanggal_akta_cerai"),
    amarRingkas: text("amar_ringkas").notNull().default(""),
    sourceHash: text("source_hash").notNull(),
    sourceLastChangedAt: text("source_last_changed_at"),
    validationStatus: text("validation_status").notNull().default("NEEDS_REVIEW"),
    workflowStatus: text("workflow_status").notNull().default("CANDIDATE"),
    destinationAgencyId: text("destination_agency_id").references(() => estatusAgencies.id),
    alreadySent: integer("already_sent").notNull().default(0),
    excludedReason: text("excluded_reason").notNull().default(""),
    createdBy: text("created_by").references(() => users.id),
    updatedBy: text("updated_by").references(() => users.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => ({
    sourceKeyUnique: uniqueIndex("idx_estatus_records_source_key_unique").on(table.sourceConnectionKey, table.sourceCaseId, table.kategoriPerubahan),
    workflowIdx: index("idx_estatus_records_workflow").on(table.workflowStatus, table.validationStatus, table.kategoriPerubahan),
    nomorPerkaraIdx: index("idx_estatus_records_nomor_perkara").on(table.nomorPerkara),
  })
);

export const estatusParties = pgTable(
  "estatus_parties",
  {
    id: text("id").primaryKey(),
    estatusRecordId: text("estatus_record_id").notNull().references(() => estatusRecords.id, { onDelete: "cascade" }),
    partyRole: text("party_role").notNull(),
    nama: text("nama").notNull().default(""),
    nik: text("nik").notNull().default(""),
    nomorKk: text("nomor_kk").notNull().default(""),
    tempatLahir: text("tempat_lahir").notNull().default(""),
    tanggalLahir: text("tanggal_lahir"),
    jenisKelamin: text("jenis_kelamin").notNull().default(""),
    alamat: text("alamat").notNull().default(""),
    desaKelurahan: text("desa_kelurahan").notNull().default(""),
    kecamatan: text("kecamatan").notNull().default(""),
    kabupatenKota: text("kabupaten_kota").notNull().default(""),
    provinsi: text("provinsi").notNull().default(""),
    agama: text("agama").notNull().default(""),
    statusKawinLama: text("status_kawin_lama").notNull().default(""),
    statusKawinBaru: text("status_kawin_baru").notNull().default(""),
    pasanganNama: text("pasangan_nama").notNull().default(""),
    pasanganNik: text("pasangan_nik").notNull().default(""),
    dataSource: text("data_source").notNull().default("SIPP"),
    manualOverride: integer("manual_override").notNull().default(0),
    qualityScore: integer("quality_score").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    recordIdx: index("idx_estatus_parties_record").on(table.estatusRecordId, table.partyRole),
    nikIdx: index("idx_estatus_parties_nik").on(table.nik),
  })
);

export const estatusValidationRules = pgTable("estatus_validation_rules", {
  id: text("id").primaryKey(),
  ruleCode: text("rule_code").notNull().unique(),
  category: text("category").notNull(),
  changeType: text("change_type").notNull(),
  label: text("label").notNull(),
  severity: text("severity").notNull(),
  expression: jsonb("expression").notNull().default(sql`'{}'::jsonb`),
  isBlocking: integer("is_blocking").notNull().default(0),
  isActive: integer("is_active").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: text("created_by").references(() => users.id),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const estatusValidationResults = pgTable(
  "estatus_validation_results",
  {
    id: text("id").primaryKey(),
    estatusRecordId: text("estatus_record_id").notNull().references(() => estatusRecords.id, { onDelete: "cascade" }),
    validationCode: text("validation_code").notNull(),
    validationLevel: text("validation_level").notNull(),
    validationMessage: text("validation_message").notNull(),
    fieldPath: text("field_path").notNull().default(""),
    isResolved: integer("is_resolved").notNull().default(0),
    resolvedBy: text("resolved_by").references(() => users.id),
    resolvedAt: text("resolved_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    recordIdx: index("idx_estatus_validation_results_record").on(table.estatusRecordId, table.validationLevel),
  })
);

export const estatusBatches = pgTable(
  "estatus_batches",
  {
    id: text("id").primaryKey(),
    batchNumber: text("batch_number").notNull().unique(),
    batchType: text("batch_type").notNull(),
    destinationAgencyId: text("destination_agency_id").references(() => estatusAgencies.id),
    status: text("status").notNull().default("DRAFT"),
    totalRecords: integer("total_records").notNull().default(0),
    dataSnapshotHash: text("data_snapshot_hash").notNull().default(""),
    createdBy: text("created_by").references(() => users.id),
    reviewedBy: text("reviewed_by").references(() => users.id),
    approvedBy: text("approved_by").references(() => users.id),
    approvedAt: text("approved_at"),
    sentBy: text("sent_by").references(() => users.id),
    sentAt: text("sent_at"),
    lockedAt: text("locked_at"),
    revisionOfBatchId: text("revision_of_batch_id").references((): AnyPgColumn => estatusBatches.id),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    statusIdx: index("idx_estatus_batches_status").on(table.status, table.batchType, table.createdAt),
  })
);

export const estatusBatchItems = pgTable(
  "estatus_batch_items",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id").notNull().references(() => estatusBatches.id, { onDelete: "cascade" }),
    estatusRecordId: text("estatus_record_id").notNull().references(() => estatusRecords.id),
    itemStatus: text("item_status").notNull().default("DRAFT"),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    uniqueItem: uniqueIndex("idx_estatus_batch_items_unique").on(table.batchId, table.estatusRecordId),
  })
);

export const estatusRecordSnapshots = pgTable("estatus_record_snapshots", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").notNull().references(() => estatusBatches.id, { onDelete: "cascade" }),
  estatusRecordId: text("estatus_record_id").notNull().references(() => estatusRecords.id),
  snapshotJson: jsonb("snapshot_json").notNull().default(sql`'{}'::jsonb`),
  snapshotHash: text("snapshot_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const estatusTransmissionLogs = pgTable(
  "estatus_transmission_logs",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id").notNull().references(() => estatusBatches.id),
    agencyId: text("agency_id").references(() => estatusAgencies.id),
    method: text("method").notNull(),
    status: text("status").notNull(),
    idempotencyKey: text("idempotency_key").notNull().default(""),
    requestPayloadHash: text("request_payload_hash").notNull().default(""),
    responseCode: text("response_code").notNull().default(""),
    responseMessage: text("response_message").notNull().default(""),
    sentAt: text("sent_at"),
    receivedAt: text("received_at"),
    completedAt: text("completed_at"),
    receiptNumber: text("receipt_number").notNull().default(""),
    receiptFilePath: text("receipt_file_path").notNull().default(""),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    batchIdx: index("idx_estatus_transmission_logs_batch").on(table.batchId, table.status, table.createdAt),
  })
);

export const estatusDocuments = pgTable("estatus_documents", {
  id: text("id").primaryKey(),
  batchId: text("batch_id").references(() => estatusBatches.id),
  recordId: text("record_id").references(() => estatusRecords.id),
  documentType: text("document_type").notNull(),
  documentNumber: text("document_number").notNull().default(""),
  filePath: text("file_path").notNull(),
  fileHash: text("file_hash").notNull(),
  qrCode: text("qr_code").notNull().default(""),
  verificationTokenHash: text("verification_token_hash").notNull().default(""),
  generatedBy: text("generated_by").references(() => users.id),
  generatedAt: text("generated_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const estatusAuditLogs = pgTable(
  "estatus_audit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull().default(""),
    oldValueHash: text("old_value_hash").notNull().default(""),
    newValueHash: text("new_value_hash").notNull().default(""),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    ipAddress: text("ip_address").notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (table) => ({
    createdIdx: index("idx_estatus_audit_logs_created").on(table.createdAt, table.action, table.entityType),
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
  aiModuleSettings,
  whatsappWebSettings,
  aletaBotSettings,
  aletaBotTemplates,
  aletaBotJobs,
  aletaBotQueries,
  aletaBotDbConnections,
  aletaBotPublicQaIntents,
  aletaBotPublicQaExamples,
  aletaBotPublicQaLogs,
  aletaBotPublicQaSessions,
  aletaBotNotifications,
  aletaBotNotificationLogs,
  aletaBotLogs,
  institutionIdentity,
  panelSettings,
  institutionIdentityEnrichments,
  moduleVisibilitySettings,
  feedbackRequests,
  userNotificationReads,
  knowledgeBaseRegulations,
  letterOriginReferences,
  classificationCatalog,
  letterNumberSequences,
  letterTemplates,
  letters,
  letterTags,
  letterClassificationTags,
  letterAttachments,
  letterWhatsappDeliveries,
  dispositions,
  dispositionWhatsappDeliveries,
  jlfCategories,
  jlfTemplates,
  jlfTemplateVersions,
  jlfVariables,
  jlfTemplateVariables,
  jlfManualValues,
  jlfGeneratedDocuments,
  jlfDocumentVariablesSnapshot,
  jlfDocumentValidationLogs,
  jlfSettings,
  jlfAuditLogs,
  jlfSippAccountLinks,
  jlfSippRoleMappings,
  jlfSippUserSnapshots,
  jlfRegulationTypes,
  jlfRegulations,
  jlfRegulationVersions,
  jlfRegulationSections,
  jlfRegulationTopics,
  jlfRegulationTopicLinks,
  jlfTemplateRegulations,
  jlfVariableRegulations,
  jlfAiPrompts,
  jlfAiLogs,
  jlfLegalAnalysisSessions,
  jlfLegalAnalysisSources,
  jlfWhatsappNotificationTemplates,
  jlfWhatsappNotificationLogs,
  aletaSippTables,
  aletaSippColumns,
  aletaSippRelations,
  aletaSippQueryRegistry,
  aletaSippQueryParameters,
  aletaSippQueryOutputs,
  aletaSippVariables,
  aletaSippVariableMappings,
  aletaSippQueryTableLinks,
  aletaSippQueryVariableLinks,
  aletaSippVariableTemplateLinks,
  aletaSippUnresolvedPlaceholders,
  aletaSippVariableConflicts,
  aletaSippImportJobs,
  aletaSippImportJobItems,
  aletaSippAssessmentIndicators,
  aletaSippAssessmentQueries,
  aletaSippAssessmentRuns,
  aletaSippAssessmentResults,
  aletaSippAssessmentResultItems,
  aletaSippPdfTemplates,
  aletaSippAuditLogs,
  aletaSippAiLogs,
  aletaSippUserSavedQueries,
  aletaSippQueryFavorites,
  estatusSippConnections,
  estatusSippMappings,
  estatusSyncLogs,
  estatusAgencies,
  estatusRecords,
  estatusParties,
  estatusValidationRules,
  estatusValidationResults,
  estatusBatches,
  estatusBatchItems,
  estatusRecordSnapshots,
  estatusTransmissionLogs,
  estatusDocuments,
  estatusAuditLogs,
  auditLogs,
  accounts,
  sessions,
  verifications,
};

export type DrizzleSchema = typeof schema;
