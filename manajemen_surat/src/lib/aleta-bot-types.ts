export type AletaBotRuntimeState = "active" | "disabled" | "dry-run" | "error";
export type AletaBotLogLevel = "info" | "warning" | "error" | "success";
export type AletaBotLogType =
  | "connection"
  | "database"
  | "message"
  | "settings"
  | "template"
  | "query"
  | "public_qa"
  | "notification"
  | "admin";
export type AletaBotNotificationCategory = "employee" | "party";
export type AletaBotQueryCategory = "employee" | "party" | "system";

export type AletaBotSettings = {
  botEnabled: boolean;
  notificationsEnabled: boolean;
  adminWhatsappNumber: string;
  messageDelayMs: number;
  retryLimit: number;
  dryRunEnabled: boolean;
  scheduleCron: string;
  testTargetNumber: string;
  securityNotes: string;
  deadlineReminderEnabled: boolean;
  deadlineReminderMode: "disabled" | "dry_run" | "pilot" | "production";
  deadlineReminderApprovedAt: string | null;
  deadlineReminderApprovedBy: string | null;
  deadlineReminderLastRunAt: string | null;
  deadlineReminderLastStatus: "idle" | "simulated" | "skipped" | "sent" | "blocked";
  deadlineReminderLastMessage: string | null;
  deadlineReminderPilotUserIds: string[];
  deadlineReminderPilotRoleIds: string[];
  deadlineReminderPilotPositionIds: string[];
  deadlineReminderSchedulerEnabled: boolean;
  deadlineReminderSchedulerMode: "disabled" | "dry_run" | "pilot" | "production";
  deadlineReminderSchedulerTime: string;
  deadlineReminderSchedulerLastRunAt: string | null;
  deadlineReminderSchedulerLastMessage: string | null;
  deadlineReminderKillSwitch: boolean;
  updatedAt: string;
};

export type AletaBotTemplate = {
  id: string;
  category: string;
  title: string;
  body: string;
  placeholders: string[];
  editable: boolean;
  updatedAt: string;
};

export type AletaBotJob = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  scheduleCron: string;
  lastRunAt: string | null;
  lastStatus: "idle" | "success" | "failed" | "simulated";
  lastMessage: string | null;
  updatedAt: string;
};

export type AletaBotQueryCatalogItem = {
  id: string;
  sourceFile: "app.js" | "notifikasi.js" | "query.js" | "whatsapp.js" | "formatter.js";
  exportName: string;
  category: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  testable: boolean;
};

export type AletaBotQuery = {
  id: string;
  name: string;
  category: AletaBotQueryCategory;
  description: string;
  sqlText: string;
  outputColumns: string[];
  recipientColumn: string;
  connectionKey: string;
  isActive: boolean;
  usedByNotifications: string[];
  lastTestedAt: string | null;
  lastTestStatus: "idle" | "success" | "failed";
  lastTestError: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AletaBotDbConnection = {
  id: string;
  key: string;
  name: string;
  description: string;
  driver: "mysql";
  host: string;
  port: number;
  databaseName: string;
  username: string;
  usernameMasked: string;
  passwordEnvKey: string;
  passwordConfigured: boolean;
  passwordSource: "manual" | "env" | "none";
  sslEnabled: boolean;
  connectionTimeoutMs: number;
  isActive: boolean;
  isDefault: boolean;
  legacySource: string;
  lastTestStatus: "idle" | "success" | "failed";
  lastTestError: string | null;
  lastTestAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AletaBotPublicQaIntent = {
  id: string;
  key: string;
  name: string;
  description: string;
  category:
    | "informasi_umum"
    | "status_perkara"
    | "jadwal_sidang"
    | "biaya_panjar"
    | "akta_cerai"
    | "layanan"
    | "pengaduan"
    | "ecourt"
    | "fallback";
  audience: "party" | "public" | "employee" | "admin";
  isActive: boolean;
  aiEnabled: boolean;
  exactTriggers: string[];
  exampleQuestions: string[];
  requiredParameters: string[];
  queryKey: string;
  legacyHandler: string;
  legacyCommand: string;
  parameterizedLegacyCommand: string;
  templateKey: string;
  responseMode: "static_template" | "query_template" | "legacy_handler" | "ai_guided_template" | "fallback";
  confidenceThreshold: number;
  requiresVerification: boolean;
  requiresCaseNumber: boolean;
  maxAttempts: number;
  fallbackMessage: string;
  riskLevel: "low" | "medium" | "high";
  notes: string;
  aiAnswerEnabled: boolean;
  aiAnswerMode: "off" | "template_only" | "template_rewrite" | "query_summarize" | "guided_answer";
  answerPolicy: "public_info_only" | "case_status_limited" | "requires_verified_party" | "admin_only";
  verificationPolicy: "none" | "case_number_only" | "phone_match" | "case_number_and_phone" | "manual_ptsp";
  allowedDataFields: string[];
  blockedDataFields: string[];
  aiSystemPrompt: string;
  aiUserPromptTemplate: string;
  maxAiTokens: number;
  temperature: number;
  requiresApprovalBeforeActive: boolean;
  version: number;
  status: "draft" | "active" | "archived";
  approvedBy: string | null;
  approvedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AletaBotPublicQaLogEntry = {
  id: string;
  senderNumber: string;
  senderName: string;
  rawMessage: string;
  normalizedMessage: string;
  matchedIntentKey: string;
  matchedMethod: "exact" | "alias" | "ai" | "session" | "fallback";
  confidence: number;
  parameters: Record<string, unknown>;
  queryKey: string;
  responsePreview: string;
  status: "answered" | "fallback" | "needs_more_info" | "blocked" | "error";
  errorMessage: string | null;
  needsHumanReview: boolean;
  reviewStatus: "pending" | "reviewed" | "ignored" | "converted_to_intent";
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string;
  createdAt: string;
};

export type AletaBotNotification = {
  id: string;
  name: string;
  category: AletaBotNotificationCategory;
  description: string;
  queryId: string;
  templateId: string;
  recipientSource: "users" | "query";
  recipientMapping: Record<string, unknown>;
  scheduleConfig: {
    type: "cron" | "manual" | "event";
    cron: string;
    trigger: string;
  };
  isActive: boolean;
  delayMs: number;
  retryLimit: number;
  lastRunAt: string | null;
  lastStatus: "idle" | "success" | "failed" | "simulated";
  lastMessage: string | null;
  policyStatus?: {
    dryRunPassed: boolean;
    recipientPreviewPassed: boolean;
    approved: boolean;
    canActivate: boolean;
    reason: string;
  };
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AletaBotEmployeeRecipient = {
  id: string;
  name: string;
  username: string;
  roleId: string;
  positionId: string;
  positionName: string;
  whatsappNumber: string;
  whatsappChatId: string;
};

export type AletaBotWhatsappNumberCompleteness = {
  totalActiveUsers: number;
  withWhatsapp: number;
  missingWhatsapp: number;
  coveragePercent: number;
  importantMissing: Array<{
    id: string;
    name: string;
    roleId: string;
    positionId: string;
    positionName: string;
    unitKerja: string;
  }>;
  roleBreakdown: Array<{
    roleId: string;
    total: number;
    withWhatsapp: number;
    missingWhatsapp: number;
  }>;
};

export type AletaBotNotificationLogEntry = {
  id: string;
  notificationId: string | null;
  queryId: string | null;
  recipientNumber: string;
  recipientName: string;
  category: AletaBotNotificationCategory | "system";
  messagePreview: string;
  status: "success" | "failed" | "simulated";
  errorMessage: string | null;
  sourceApp: string;
  sourceFeature: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  sentAt: string | null;
  createdAt: string;
};

export type AletaBotLogEntry = {
  id: string;
  level: AletaBotLogLevel;
  eventType: AletaBotLogType;
  message: string;
  metadata: Record<string, unknown>;
  actorUserId: string | null;
  createdAt: string;
};

export type AletaBotApprovalStatus = "pending" | "approved" | "rejected";

export type AletaBotApprovalRequest = {
  id: string;
  entityType: "public_qa_intent" | "notification" | "query" | "template";
  entityId: string;
  entityName: string;
  requestedBy: string;
  requestedAt: string;
  status: AletaBotApprovalStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string;
  snapshotJson: string;
  createdAt: string;
  updatedAt: string;
};

export type AletaBotDeadLetter = {
  id: string;
  idempotencyKey: string;
  recipientNumber: string;
  recipientName: string;
  messagePreview: string;
  category: string;
  notificationKey: string;
  priority: number;
  status: string;
  retryCount: number;
  maxRetries: number;
  lastError: string;
  sourceApp: string;
  sourceFeature: string;
  entityType: string;
  entityId: string;
  scheduledAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AletaBotWorkerState = {
  enabled: boolean;
  running: boolean;
  paused: boolean;
  intervalMs: number;
  batchSize: number;
  lastHeartbeatAt: string | null;
  lastBatchProcessed: number;
  lastError: string;
  startedAt: string | null;
  pausedAt: string | null;
  pauseReason: string;
  activeTimer: boolean;
};

export type AletaBotLegacyMigration = {
  id: string;
  feature: string;
  /** Short unique key matching the source function/feature, e.g. "sendPihakBaru" */
  legacyKey: string;
  /** Exact function name in the source file */
  sourceFunction: string;
  /** Classification of the legacy feature */
  legacyType: "party_notification" | "employee_notification" | "public_command" | "admin_command" | "infrastructure" | "ai_service" | "other";
  /** Human-readable grouping category */
  category: string;
  /** Operational risk level if migration is done incorrectly */
  riskLevel: "low" | "medium" | "high";
  /** Source file and function path (e.g. "app.js → sendPihakBaru") */
  legacySource: string;
  /** Original cron expression(s) from app.js; empty for event-driven/manual */
  cronSchedule: string;
  portalEntity: string;
  /** Which portal registry type this migrates to */
  registryTargetType: string;
  /** Key or id in the target registry */
  registryTargetKey: string;
  /** New service that replaces this legacy code */
  replacementService: string;
  /** Whether legacy source code can be safely archived/deleted */
  canArchive: boolean;
  status:
    | "pending"
    | "in_progress"
    | "migrated"
    | "skipped"
    | "not_migrated"
    | "mapped"
    | "registry_draft"
    | "needs_manual_mapping"
    | "dry_run"
    | "pending_approval"
    | "active_registry"
    | "legacy_disabled"
    | "archivable";
  notes: string;
  migratedAt: string | null;
  migratedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AletaBotUnknownQuestionReview = {
  id: string;
  logIds: string[];
  normalizedMessage: string;
  rawMessage: string;
  frequency: number;
  lastAskedAt: string;
  senderMasked: string;
  fallbackReason: string;
  needsHumanReview: boolean;
  reviewStatus: "pending" | "reviewed" | "ignored" | "converted_to_intent";
  reviewNote: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  suggestedIntentKey: string;
  confidence: number;
  safetyRisk: "low" | "medium" | "high";
  suggestedAction: "add_as_example" | "create_intent_draft" | "human_handoff" | "ignore";
};

export type AletaBotDeadlineReminderDryRunResult = {
  ok: boolean;
  totalCandidates: number;
  dryRunCreated: number;
  skipped: number;
  mode?: "disabled" | "dry_run" | "pilot" | "production";
  productionSent?: number;
  blocked?: boolean;
  blockerReasons?: string[];
  warnings: string[];
  items: Array<{
    dispositionId: string;
    letterId: string;
    recipientName: string;
    recipientNumber: string;
    perihal: string;
    deadline: string;
    status: "simulated" | "skipped" | "enqueued";
    messagePreview: string;
    idempotencyKey: string;
    skipReason?: string;
  }>;
};

export type AletaBotPolicySkipSummary = {
  totalToday: number;
  totalAllTime: number;
  lastSkippedAt: string | null;
  topReasons: Array<{ reason: string; count: number }>;
  topNotifications: Array<{ notificationKey: string; count: number }>;
  recent: Array<{
    id: string;
    notificationKey: string;
    notificationId: string;
    category: string;
    reason: string;
    sourceFeature: string;
    entityType: string;
    entityId: string;
    recipientType: string;
    recipientCount: number;
    createdAt: string;
  }>;
};

export type AletaBotDispositionReminderRun = {
  id: string;
  mode: "disabled" | "dry_run" | "pilot" | "production";
  triggeredBy: "manual" | "manual_dry_run" | "manual_controlled" | "scheduler" | "scheduler_dry_run" | "scheduler_blocked";
  triggeredByUserId: string | null;
  startedAt: string;
  finishedAt: string | null;
  totalCandidates: number;
  dryRunCreated: number;
  sentCount: number;
  skippedCount: number;
  errorCount: number;
  status: "simulated" | "skipped" | "completed" | "failed" | "blocked";
  summary: Record<string, unknown>;
};

export type AletaBotSnapshot = {
  settings: AletaBotSettings;
  runtimeState: AletaBotRuntimeState;
  whatsapp: {
    runtimeStatus: string;
    internalStatus: string;
    qrCode: string | null;
    linked: boolean;
    phoneNumber: string;
    sessionName: string;
    savedStatus: string;
    lastConnectedAt: string | null;
    lastErrorMessage: string | null;
  };
  metrics: {
    sentToday: number;
    failedToday: number;
    lastNotificationAt: string | null;
    activeJobs: number;
    enabledTemplates: number;
  };
  templates: AletaBotTemplate[];
  jobs: AletaBotJob[];
  notifications: AletaBotNotification[];
  queries: AletaBotQuery[];
  dbConnections: AletaBotDbConnection[];
  publicQaIntents: AletaBotPublicQaIntent[];
  publicQaLogs: AletaBotPublicQaLogEntry[];
  employeeRecipients: AletaBotEmployeeRecipient[];
  whatsappNumberCompleteness: AletaBotWhatsappNumberCompleteness;
  policySkipSummary: AletaBotPolicySkipSummary;
  deadlineReminderRuns: AletaBotDispositionReminderRun[];
  notificationLogs: AletaBotNotificationLogEntry[];
  queryCatalog: AletaBotQueryCatalogItem[];
  logs: AletaBotLogEntry[];
  approvalRequests: AletaBotApprovalRequest[];
  deadLetters: AletaBotDeadLetter[];
  workerState: AletaBotWorkerState | null;
  legacyMigrations: AletaBotLegacyMigration[];
  unknownQuestionReviews: AletaBotUnknownQuestionReview[];
};
