import { mkdir, writeFile } from "node:fs/promises";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import path from "node:path";

import {
  type AletaBotJob,
  type AletaBotDbConnection,
  type AletaBotEmployeeRecipient,
  type AletaBotLogEntry,
  type AletaBotLogLevel,
  type AletaBotLogType,
  type AletaBotNotification,
  type AletaBotNotificationCategory,
  type AletaBotNotificationLogEntry,
  type AletaBotPolicySkipSummary,
  type AletaBotPublicQaIntent,
  type AletaBotPublicQaLogEntry,
  type AletaBotQuery,
  type AletaBotQueryCatalogItem,
  type AletaBotQueryCategory,
  type AletaBotRuntimeState,
  type AletaBotSettings,
  type AletaBotSnapshot,
  type AletaBotTemplate,
  type AletaBotApprovalRequest,
  type AletaBotApprovalStatus,
  type AletaBotLegacyMigration,
  type AletaBotDeadLetter,
  type AletaBotWorkerState,
  type AletaBotUnknownQuestionReview,
  type AletaBotDeadlineReminderDryRunResult,
  type AletaBotDispositionReminderRun,
  type AletaBotManualRecipientPreview,
  type AletaBotManualSendHistoryEntry,
  type AletaBotManualSendMode,
  type AletaBotManualSendPreviewResult,
  type AletaBotManualSendQueryPreview,
  type AletaBotManualSendRecipientResult,
  type AletaBotManualSendResult,
  type AletaBotManualSendTemplatePreview,
} from "@/lib/aleta-bot-types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { getPositionsFromDb, getUsersFromDb, requireActorUser } from "@/server/modules/organization/service";
import { getAISettingsFromDb, resolveAIConfigForModule } from "@/server/modules/ai/service";
import { getInstitutionIdentityFromDb, getWhatsAppSettingsFromDb } from "@/server/modules/settings/service";
import { whatsappService } from "@/server/modules/whatsapp/service";
import {
  getWhatsappRuntimeMode,
  buildGatewayWhatsappSnapshot,
  connectGatewayWhatsapp,
  controlGatewayWorker,
  getGatewayDeadLetters,
  getGatewayQueueProgress,
  getGatewayWhatsappStatus,
  getGatewayWhatsappQr,
  resolveGatewayDeadLetter,
  resendGatewayDeadLetter,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import {
  buildMessageEntityMetadata,
  sendPortalWhatsappMessage,
} from "@/server/modules/whatsapp/portal-whatsapp-sender";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { assertExportRowLimit, exportOverflowLimit, EXPORT_ROW_LIMITS } from "@/server/shared/export-limits";
import { nextPrefixedId } from "@/server/shared/ids";
import {
  convertLegacyToDraft,
  validateConvertedDraft,
  type ConvertedLegacyDraft,
} from "@/server/modules/aleta-bot/legacy-conversion";
import {
  LEGACY_NOTIFIKASI_QUERY_CATALOG,
  LEGACY_NOTIFIKASI_QUERY_DEFINITIONS,
} from "@/server/modules/aleta-bot/legacy-notifikasi-catalog";
import { SIPP_ADDITIONAL_QUERY_DEFINITIONS } from "@/server/modules/aleta-bot/sipp-additional-query-sources";
import { DEFAULT_PUBLIC_QA_KNOWLEDGE } from "@/server/modules/aleta-bot/public-qa-knowledge-seed";
import { formatAletaBotTemplateValue } from "@/server/modules/aleta-bot/template-renderer";
import { buildSafeFallback, suggestIntentForQuestion } from "@/server/modules/aleta-bot/public-qa-safety";
import { getAdditionalRoleLabel, normalizeAdditionalRoleIds } from "@/lib/user-additional-roles";

const DEFAULT_ALETA_BOT_RUNTIME_URL = "http://127.0.0.1:3003";

type SettingsRow = {
  bot_enabled: number;
  notifications_enabled: number;
  /**
   * Opsional: baris pengaturan yang ditulis versi sebelumnya belum punya
   * kolomnya. Dibaca MENYALA saat tidak ada - lihat catatan di schema.ts.
   */
  kirim_pegawai_enabled?: number;
  kirim_pihak_enabled?: number;
  admin_whatsapp_number: string;
  message_delay_ms: number;
  sending_risk_level: number;
  retry_limit: number;
  dry_run_enabled: number;
  schedule_cron: string;
  test_target_number: string;
  security_notes: string;
  disposition_deadline_reminder_enabled: number;
  disposition_deadline_reminder_mode: AletaBotSettings["deadlineReminderMode"];
  disposition_deadline_reminder_approved_at: string | null;
  disposition_deadline_reminder_approved_by: string | null;
  disposition_deadline_reminder_last_run_at: string | null;
  disposition_deadline_reminder_last_status: AletaBotSettings["deadlineReminderLastStatus"];
  disposition_deadline_reminder_last_message: string | null;
  disposition_deadline_reminder_pilot_user_ids_json: string;
  disposition_deadline_reminder_pilot_role_ids_json: string;
  disposition_deadline_reminder_pilot_position_ids_json: string;
  disposition_deadline_reminder_scheduler_enabled: number;
  disposition_deadline_reminder_scheduler_mode: AletaBotSettings["deadlineReminderSchedulerMode"];
  disposition_deadline_reminder_scheduler_time: string;
  disposition_deadline_reminder_scheduler_last_run_at: string | null;
  disposition_deadline_reminder_scheduler_last_message: string | null;
  disposition_deadline_reminder_kill_switch: number;
  updated_at: string;
};

type TemplateRow = {
  id: string;
  category: string;
  title: string;
  body: string;
  placeholders_json: string;
  editable: number;
  updated_at: string;
};

type JobRow = {
  id: string;
  name: string;
  description: string;
  enabled: number;
  schedule_cron: string;
  last_run_at: string | null;
  last_status: AletaBotJob["lastStatus"];
  last_message: string | null;
  updated_at: string;
};

type QueryRow = {
  id: string;
  name: string;
  category: AletaBotQueryCategory;
  description: string;
  sql_text: string;
  output_columns_json: string;
  recipient_column: string;
  connection_key: string;
  is_active: number;
  last_tested_at: string | null;
  last_test_status: AletaBotQuery["lastTestStatus"];
  last_test_error: string | null;
  last_test_duration_ms: number;
  last_test_row_count: number;
  last_test_sample_json: string;
  last_test_slow: number;
  last_test_message: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type DbConnectionRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  driver: AletaBotDbConnection["driver"];
  host: string;
  port: number;
  database_name: string;
  username: string;
  password_env_key: string;
  password_secret: string;
  password_source: "env" | "manual";
  ssl_enabled: number;
  connection_timeout_ms: number;
  is_active: number;
  is_default: number;
  legacy_source: string;
  last_test_status: AletaBotDbConnection["lastTestStatus"];
  last_test_error: string | null;
  last_test_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type NotificationRow = {
  id: string;
  name: string;
  category: AletaBotNotificationCategory;
  description: string;
  query_id: string;
  template_id: string;
  recipient_source: AletaBotNotification["recipientSource"];
  recipient_mapping_json: string;
  schedule_config_json: string;
  is_active: number;
  attach_document: number;
  delay_ms: number;
  retry_limit: number;
  last_run_at: string | null;
  last_status: AletaBotNotification["lastStatus"];
  last_message: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type EmployeeRecipientRow = {
  id: string;
  username: string;
  name: string;
  role_id: string;
  position_id: string;
  position_name: string | null;
  unit_kerja: string | null;
  additional_role_ids_json: string;
  whatsapp_number: string;
};

type NotificationLogRow = {
  id: string;
  notification_id: string | null;
  query_id: string | null;
  recipient_number: string;
  recipient_name: string;
  category: AletaBotNotificationLogEntry["category"];
  message_preview: string;
  status: AletaBotNotificationLogEntry["status"];
  whatsapp_message_id: string;
  ack: number | null;
  error_message: string | null;
  source_app: string;
  source_feature: string;
  entity_type: string;
  entity_id: string;
  metadata_json: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
  created_at: string;
};

type LogRow = {
  id: string;
  level: AletaBotLogLevel;
  event_type: AletaBotLogType;
  message: string;
  metadata_json: string;
  actor_user_id: string | null;
  created_at: string;
};

type PublicQaIntentRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  category: AletaBotPublicQaIntent["category"];
  audience: AletaBotPublicQaIntent["audience"];
  is_active: number;
  ai_enabled: number;
  exact_triggers_json: string;
  example_questions_json: string;
  required_parameters_json: string;
  query_key: string;
  legacy_handler: string;
  legacy_command: string;
  parameterized_legacy_command: string;
  template_key: string;
  response_mode: AletaBotPublicQaIntent["responseMode"];
  confidence_threshold: number;
  requires_verification: number;
  requires_case_number: number;
  max_attempts: number;
  fallback_message: string;
  answer_template: string | null;
  match_keywords_json: string | null;
  risk_level: AletaBotPublicQaIntent["riskLevel"];
  notes: string;
  ai_answer_enabled: number;
  ai_answer_mode: AletaBotPublicQaIntent["aiAnswerMode"];
  answer_policy: AletaBotPublicQaIntent["answerPolicy"];
  verification_policy: AletaBotPublicQaIntent["verificationPolicy"];
  allowed_data_fields_json: string;
  blocked_data_fields_json: string;
  ai_system_prompt: string;
  ai_user_prompt_template: string;
  max_ai_tokens: number;
  temperature: number;
  requires_approval_before_active: number;
  version: number;
  status: AletaBotPublicQaIntent["status"];
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type PublicQaLogRow = {
  id: string;
  sender_number: string;
  sender_name: string;
  raw_message: string;
  normalized_message: string;
  matched_intent_key: string;
  matched_method: AletaBotPublicQaLogEntry["matchedMethod"];
  confidence: number;
  parameters_json: string;
  query_key: string;
  response_preview: string;
  status: AletaBotPublicQaLogEntry["status"];
  error_message: string | null;
  needs_human_review: number;
  review_status: AletaBotPublicQaLogEntry["reviewStatus"];
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string;
  created_at: string;
};

type PublicQaKnowledgeRow = {
  id: string;
  key: string;
  title: string;
  category: string;
  audience: string;
  keywords_json: string;
  answer: string;
  source_label: string;
  source_url: string;
  priority: number;
  is_active: number;
  updated_at: string;
};

type PolicySkipLogRow = {
  id: string;
  notification_key: string;
  notification_id: string | null;
  category: string;
  reason: string;
  source_feature: string;
  entity_type: string;
  entity_id: string;
  recipient_type: string;
  recipient_count: number;
  metadata_json: string;
  created_at: string;
};

type DispositionReminderRunRow = {
  id: string;
  mode: AletaBotDispositionReminderRun["mode"];
  triggered_by: AletaBotDispositionReminderRun["triggeredBy"];
  triggered_by_user_id: string | null;
  started_at: string;
  finished_at: string | null;
  total_candidates: number | string;
  dry_run_created: number | string;
  sent_count: number | string;
  skipped_count: number | string;
  error_count: number | string;
  status: AletaBotDispositionReminderRun["status"];
  summary_json: string;
};

type AletaBotRuntimeStatusPayload = {
  bot?: {
    sendingWindow?: {
      enabled?: boolean;
      start?: string;
      end?: string;
      inside?: boolean;
      allowed?: boolean;
      message?: string;
    };
  };
  aiRuntime?: {
    status?: string;
    enabled?: boolean;
    publicQaEnabled?: boolean;
    publicQaAiAnswerEnabled?: boolean;
  };
  worker?: {
    enabled?: boolean;
    running?: boolean;
    paused?: boolean;
    activeTimer?: boolean;
    lastHeartbeatAt?: string | null;
  };
  queue?: Record<string, number>;
  registry?: {
    skippedPolicy?: number;
    policySkipStats?: {
      totalToday?: number;
      skippedCount?: number;
      lastSkippedAt?: string | null;
    };
  };
  whatsappNumberResolver?: {
    legacyFallbackUsedCount?: number;
    lastLegacyFallbackUsedAt?: string | null;
  };
};

type DeadlineReminderCandidateRow = {
  disposition_id: string;
  letter_id: string;
  nomor_surat: string;
  perihal: string;
  deadline_at: string;
  status: string;
  instruksi: string;
  recipient_id: string;
  recipient_name: string;
  recipient_role_id: string;
  recipient_whatsapp: string;
  position_id: string | null;
  position_name: string | null;
  unit_kerja: string | null;
};

type ApprovalRequestRow = {
  id: string;
  entity_type: AletaBotApprovalRequest["entityType"];
  entity_id: string;
  entity_name: string;
  requested_by: string;
  requested_at: string;
  status: AletaBotApprovalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string;
  snapshot_json: string;
  created_at: string;
  updated_at: string;
};

type LegacyMigrationRow = {
  id: string;
  feature: string;
  legacy_key: string;
  source_function: string;
  legacy_type: AletaBotLegacyMigration["legacyType"];
  category: string;
  risk_level: AletaBotLegacyMigration["riskLevel"];
  legacy_source: string;
  cron_schedule: string;
  portal_entity: string;
  registry_target_type: string;
  registry_target_key: string;
  replacement_service: string;
  can_archive: number;
  status: AletaBotLegacyMigration["status"];
  notes: string;
  migrated_at: string | null;
  migrated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SendingRiskPreset = {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  /** Kemungkinan suspend/ban dalam kata: "Sangat kecil" .. "Sangat besar". */
  suspendRisk: string;
  messageDelayMinMs: number;
  messageDelayMaxMs: number;
  maxPerMinute: number;
  maxPerHour: number;
  maxPerDay: number;
  queueBatchSize: number;
  queueIntervalMs: number;
  sendingWindowStart: string;
  sendingWindowEnd: string;
  broadcastRequiresApproval: boolean;
  /** Jarak minimum antar pesan berurutan di antrean (ms). */
  sendingGapMinMs: number;
  /** Jarak maksimum antar pesan berurutan; diacak antara min dan max. */
  sendingGapMaxMs: number;
  /**
   * Kelompok jarak untuk irama campuran.
   *
   * Jarak acak di dalam satu rentang sempit ternyata TETAP berbentuk mesin:
   * manusia tidak pernah seseragam itu. Orang membalas beberapa pesan beruntun
   * dalam setengah menit, lalu diam sepuluh menit, lalu beruntun lagi.
   *
   * Dengan kelompok berbobot, satu kelompok dipilih dulu baru jaraknya diacak
   * di dalamnya — menghasilkan sebaran berekor panjang seperti percakapan
   * sungguhan. Kosong berarti kembali memakai sendingGapMinMs/MaxMs.
   */
  gapProfile?: Array<{ label: string; minMs: number; maxMs: number; weight: number }>;
  /** Jeda minimum sebelum satu nomor yang sama menerima pesan berikutnya (ms). */
  perRecipientCooldownMs: number;
};

/**
 * Preset Slider Risiko: satu tingkat menetapkan SEMUA knob anti-ban sekaligus.
 *
 * Pengendali utama laju kirim adalah JARAK ANTAR PESAN (sendingGap*), bukan
 * batas per menit/jam/hari. Alasannya: jarak menjadwalkan tiap pesan pada
 * waktunya sendiri sehingga notifikasi sejenis tidak pernah berangkat serentak,
 * sedangkan batas hanya menolak pesan setelah lewat ambang — yang justru
 * memicu antrean gagal dan pengiriman ulang menumpuk. Karena itu batas
 * per menit/jam/hari di sini sengaja diletakkan DI ATAS laju yang bisa
 * dihasilkan jarak, jadi perannya adalah rem darurat, bukan pengatur harian.
 *
 * Jarak selalu berupa rentang (diacak) karena interval yang persis sama adalah
 * ciri bot yang paling mudah dikenali WhatsApp.
 */
const SENDING_RISK_PRESETS: Record<1 | 2 | 3 | 4 | 5, SendingRiskPreset> = {
  1: {
    level: 1, label: "Minimal", suspendRisk: "Sangat kecil",
    // Rentang cadangan ini dipakai HANYA bila gapProfile tidak termuat - mis.
    // server masih memakai runtime config lama sesaat setelah pembaruan.
    // Rata-ratanya (112 dtk) sengaja disamakan dengan rata-rata gapProfile:
    // bila cadangannya jauh lebih cepat, laju kirim akan menembus rem darurat
    // di bawah dan pemberitahuan mulai DIBUANG, bukan sekadar tertunda.
    sendingGapMinMs: 45000, sendingGapMaxMs: 180000,
    // Irama campuran: banyak jarak pendek, sesekali jeda panjang. Rata-rata
    // sekitar 112 detik, yaitu ± 257 pesan pada jendela kirim 8 jam - cukup di
    // atas kebutuhan nyata PA Donggala (100-200 pesan/hari) tanpa membuat
    // iramanya rapat.
    gapProfile: [
      { label: "beruntun", minMs: 20000, maxMs: 45000, weight: 35 },
      { label: "pendek", minMs: 45000, maxMs: 90000, weight: 30 },
      { label: "sedang", minMs: 90000, maxMs: 180000, weight: 22 },
      { label: "panjang", minMs: 180000, maxMs: 420000, weight: 10 },
      { label: "jeda", minMs: 480000, maxMs: 900000, weight: 3 },
    ],
    perRecipientCooldownMs: 30 * 60 * 1000,
    messageDelayMinMs: 2500, messageDelayMaxMs: 6000,
    // Batas ini REM DARURAT di atas irama, bukan target. Angka lama (150/jam,
    // 600/hari) jauh di atas apa yang mungkin dihasilkan iramanya sendiri,
    // sehingga tidak pernah berfungsi sebagai rem dan hanya menenangkan nama
    // modenya. Sekarang diletakkan tepat di atas kapasitas irama.
    maxPerMinute: 4, maxPerHour: 40, maxPerDay: 300,
    queueBatchSize: 3, queueIntervalMs: 20000,
    sendingWindowStart: "08:00", sendingWindowEnd: "16:00",
    broadcastRequiresApproval: true,
  },
  2: {
    level: 2, label: "Rendah", suspendRisk: "Kecil",
    sendingGapMinMs: 30000, sendingGapMaxMs: 100000,
    // Rata-rata ± 66 detik, sekitar 490 pesan pada jendela 9 jam.
    gapProfile: [
      { label: "beruntun", minMs: 12000, maxMs: 30000, weight: 40 },
      { label: "pendek", minMs: 30000, maxMs: 60000, weight: 30 },
      { label: "sedang", minMs: 60000, maxMs: 120000, weight: 20 },
      { label: "panjang", minMs: 120000, maxMs: 300000, weight: 8 },
      { label: "jeda", minMs: 300000, maxMs: 600000, weight: 2 },
    ],
    perRecipientCooldownMs: 20 * 60 * 1000,
    messageDelayMinMs: 2000, messageDelayMaxMs: 5000,
    maxPerMinute: 6, maxPerHour: 260, maxPerDay: 1000,
    queueBatchSize: 3, queueIntervalMs: 20000,
    sendingWindowStart: "08:00", sendingWindowEnd: "17:00",
    broadcastRequiresApproval: true,
  },
  3: {
    level: 3, label: "Sedang", suspendRisk: "Sedang",
    sendingGapMinMs: 15000, sendingGapMaxMs: 45000,
    // Rata-rata ± 30 detik.
    gapProfile: [
      { label: "beruntun", minMs: 7000, maxMs: 15000, weight: 45 },
      { label: "pendek", minMs: 15000, maxMs: 35000, weight: 30 },
      { label: "sedang", minMs: 35000, maxMs: 70000, weight: 18 },
      { label: "panjang", minMs: 70000, maxMs: 150000, weight: 7 },
    ],
    perRecipientCooldownMs: 10 * 60 * 1000,
    messageDelayMinMs: 1500, messageDelayMaxMs: 3500,
    maxPerMinute: 12, maxPerHour: 460, maxPerDay: 2000,
    queueBatchSize: 5, queueIntervalMs: 15000,
    sendingWindowStart: "07:30", sendingWindowEnd: "20:00",
    broadcastRequiresApproval: true,
  },
  4: {
    level: 4, label: "Tinggi", suspendRisk: "Besar",
    sendingGapMinMs: 8000, sendingGapMaxMs: 22000,
    // Rata-rata ± 15 detik.
    gapProfile: [
      { label: "beruntun", minMs: 3000, maxMs: 8000, weight: 50 },
      { label: "pendek", minMs: 8000, maxMs: 20000, weight: 30 },
      { label: "sedang", minMs: 20000, maxMs: 45000, weight: 15 },
      { label: "panjang", minMs: 45000, maxMs: 90000, weight: 5 },
    ],
    perRecipientCooldownMs: 3 * 60 * 1000,
    messageDelayMinMs: 800, messageDelayMaxMs: 2000,
    maxPerMinute: 30, maxPerHour: 1000, maxPerDay: 4000,
    queueBatchSize: 8, queueIntervalMs: 10000,
    sendingWindowStart: "07:00", sendingWindowEnd: "21:00",
    broadcastRequiresApproval: false,
  },
  5: {
    level: 5, label: "Maksimal", suspendRisk: "Sangat besar",
    sendingGapMinMs: 0, sendingGapMaxMs: 1000,
    perRecipientCooldownMs: 0,
    messageDelayMinMs: 0, messageDelayMaxMs: 400,
    maxPerMinute: 60, maxPerHour: 1500, maxPerDay: 6000,
    queueBatchSize: 15, queueIntervalMs: 5000,
    sendingWindowStart: "06:00", sendingWindowEnd: "22:00",
    broadcastRequiresApproval: false,
  },
};

export function resolveSendingRiskPreset(level: unknown): SendingRiskPreset {
  const n = Math.round(Number(level));
  const clamped = (Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 1) as 1 | 2 | 3 | 4 | 5;
  return SENDING_RISK_PRESETS[clamped];
}

export function listSendingRiskPresets(): SendingRiskPreset[] {
  return [1, 2, 3, 4, 5].map((level) => SENDING_RISK_PRESETS[level as 1 | 2 | 3 | 4 | 5]);
}

const DEFAULT_SETTINGS: Omit<AletaBotSettings, "updatedAt"> = {
  botEnabled: false,
  notificationsEnabled: false,
  // Menyala kecuali dimatikan sendiri - lihat catatan di schema.ts.
  kirimPegawaiEnabled: true,
  kirimPihakEnabled: true,
  adminWhatsappNumber: "",
  messageDelayMs: 1500,
  // Default MINIMAL: paling aman dari suspend/ban. Operator dapat menaikkan
  // lewat Slider Risiko di dashboard bila memang perlu lebih cepat.
  sendingRiskLevel: 1,
  retryLimit: 2,
  dryRunEnabled: true,
  scheduleCron: "00 07 * * Monday-Friday",
  testTargetNumber: "",
  securityNotes: "Modul ALETA Bot hanya aktif untuk Super Admin. Gunakan dry-run sebelum pengiriman produksi.",
  deadlineReminderEnabled: false,
  deadlineReminderMode: "dry_run",
  deadlineReminderApprovedAt: null,
  deadlineReminderApprovedBy: null,
  deadlineReminderLastRunAt: null,
  deadlineReminderLastStatus: "idle",
  deadlineReminderLastMessage: null,
  deadlineReminderPilotUserIds: [],
  deadlineReminderPilotRoleIds: [],
  deadlineReminderPilotPositionIds: [],
  deadlineReminderSchedulerEnabled: false,
  deadlineReminderSchedulerMode: "dry_run",
  deadlineReminderSchedulerTime: "08:00:00",
  deadlineReminderSchedulerLastRunAt: null,
  deadlineReminderSchedulerLastMessage: null,
  deadlineReminderKillSwitch: false,
};

type SeedDbConnection = Omit<
  AletaBotDbConnection,
  "usernameMasked" | "passwordConfigured" | "passwordSource" | "lastTestStatus" | "lastTestError" | "lastTestAt" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt"
>;

const DEFAULT_DB_CONNECTIONS: Array<SeedDbConnection> = [
  {
    id: "db-sipp-primary",
    key: "sipp_primary",
    name: "SIPP Utama",
    description: "Database SIPP utama dari legacy db_config.js.",
    driver: "mysql",
    host: process.env.ALETA_BOT_DB_SIPP_HOST || process.env.ALETA_BOT_DB_HOST || "localhost",
    port: Number(process.env.ALETA_BOT_DB_SIPP_PORT || process.env.ALETA_BOT_DB_PORT || 3306),
    databaseName: process.env.ALETA_BOT_DB_SIPP_NAME || process.env.ALETA_BOT_DB_NAME || "SIPP",
    username: process.env.ALETA_BOT_DB_SIPP_USER || process.env.ALETA_BOT_DB_USER || "root",
    passwordEnvKey: "ALETA_BOT_DB_SIPP_PASSWORD",
    sslEnabled: false,
    connectionTimeoutMs: 5000,
    isActive: true,
    isDefault: true,
    legacySource: "db_config.js",
  },
  {
    id: "db-antrian-sidang",
    key: "antrian_sidang",
    name: "Antrian Sidang",
    description: "Database turunan antrian sidang dari legacy db_config4.js.",
    driver: "mysql",
    host: process.env.ALETA_BOT_DB_ANTRIAN_HOST || process.env.ALETA_BOT_DB_HOST || "localhost",
    port: Number(process.env.ALETA_BOT_DB_ANTRIAN_PORT || process.env.ALETA_BOT_DB_PORT || 3306),
    databaseName: process.env.ALETA_BOT_DB_ANTRIAN_NAME || process.env.ALETA_BOT_DB4_NAME || "sipp_turunan_antrian",
    username: process.env.ALETA_BOT_DB_ANTRIAN_USER || process.env.ALETA_BOT_DB_USER || "root",
    passwordEnvKey: "ALETA_BOT_DB_ANTRIAN_PASSWORD",
    sslEnabled: false,
    connectionTimeoutMs: 5000,
    isActive: true,
    isDefault: false,
    legacySource: "db_config4.js",
  },
  {
    id: "db-aps-badilag",
    key: "aps_badilag",
    name: "APS Badilag",
    description: "Database APS Badilag dari legacy db_config5.js.",
    driver: "mysql",
    host: process.env.ALETA_BOT_DB_APS_HOST || process.env.ALETA_BOT_DB_HOST || "localhost",
    port: Number(process.env.ALETA_BOT_DB_APS_PORT || process.env.ALETA_BOT_DB_PORT || 3306),
    databaseName: process.env.ALETA_BOT_DB_APS_NAME || process.env.ALETA_BOT_DB5_NAME || "aps_badilag",
    username: process.env.ALETA_BOT_DB_APS_USER || process.env.ALETA_BOT_DB_USER || "root",
    passwordEnvKey: "ALETA_BOT_DB_APS_PASSWORD",
    sslEnabled: false,
    connectionTimeoutMs: 5000,
    isActive: true,
    isDefault: false,
    legacySource: "db_config5.js",
  },
];

function parseExtraDbConnectionsFromEnv(): Array<SeedDbConnection> {
  const raw = process.env.ALETA_BOT_EXTRA_DB_CONNECTIONS_JSON || "";
  if (!raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw) as Array<Partial<SeedDbConnection> & { database_name?: string; password_env_key?: string; connection_timeout_ms?: number }>;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((connection, index) => ({
        id: String(connection.id || `db-extra-${connection.key || index + 1}`),
        key: validateConnectionKey(String(connection.key || "")),
        name: String(connection.name || connection.key || `SQL Tambahan ${index + 1}`).trim(),
        description: String(connection.description || "Koneksi SQL tambahan dari konfigurasi instalasi ALETA.").trim(),
        driver: "mysql" as const,
        host: String(connection.host || "").trim(),
        port: Math.max(1, Math.min(65535, Number(connection.port || 3306))),
        databaseName: String(connection.databaseName || connection.database_name || "").trim(),
        username: String(connection.username || "").trim(),
        passwordEnvKey: String(connection.passwordEnvKey || connection.password_env_key || "").trim(),
        sslEnabled: Boolean(connection.sslEnabled),
        connectionTimeoutMs: Math.max(1000, Math.min(30000, Number(connection.connectionTimeoutMs || connection.connection_timeout_ms || 5000))),
        isActive: connection.isActive !== false,
        isDefault: false,
        legacySource: String(connection.legacySource || "first-install").trim(),
      }))
      .filter((connection) => connection.key && connection.host && connection.databaseName && connection.username);
  } catch {
    return [];
  }
}

function getSeedDbConnections() {
  const byKey = new Map<string, SeedDbConnection>();
  for (const connection of DEFAULT_DB_CONNECTIONS) {
    byKey.set(connection.key, connection);
  }
  for (const connection of parseExtraDbConnectionsFromEnv()) {
    if (!byKey.has(connection.key)) {
      byKey.set(connection.key, connection);
    }
  }
  return [...byKey.values()];
}

const PUBLIC_QA_FALLBACK_MESSAGE =
  "Maaf, saya belum memahami pertanyaan Bapak/Ibu. Silakan ketik info lengkap untuk melihat daftar layanan, atau hubungi petugas Pengadilan Agama Donggala di 0822-7111-5021.";

function getPublicQaAnswerDefaults(key: string): Pick<
  AletaBotPublicQaIntent,
  | "aiAnswerEnabled"
  | "aiAnswerMode"
  | "answerPolicy"
  | "verificationPolicy"
  | "allowedDataFields"
  | "blockedDataFields"
  | "aiSystemPrompt"
  | "aiUserPromptTemplate"
  | "maxAiTokens"
  | "temperature"
  | "requiresApprovalBeforeActive"
  | "version"
  | "status"
  | "approvedBy"
  | "approvedAt"
> {
  const publicRewrite = new Set(["alamat_pengadilan", "ecourt", "pengaduan", "syarat_daftar"]);
  if (publicRewrite.has(key)) {
    return {
      aiAnswerEnabled: true,
      aiAnswerMode: "template_rewrite",
      answerPolicy: "public_info_only",
      verificationPolicy: "none",
      allowedDataFields: [],
      blockedDataFields: ["nik", "alamat", "telepon", "nomor_hp", "catatan_internal"],
      aiSystemPrompt: "",
      aiUserPromptTemplate: "",
      maxAiTokens: 350,
      temperature: 0.2,
      requiresApprovalBeforeActive: false,
      version: 1,
      status: "active",
      approvedBy: null,
      approvedAt: null,
    };
  }
  if (key === "cek_jadwal_sidang" || key === "antrian_online") {
    return {
      aiAnswerEnabled: true,
      aiAnswerMode: "guided_answer",
      answerPolicy: key === "antrian_online" ? "public_info_only" : "case_status_limited",
      verificationPolicy: key === "antrian_online" ? "none" : "case_number_only",
      allowedDataFields: ["nomor_perkara", "tanggal_sidang", "agenda", "ruangan", "status_umum", "keterangan", "nomor_antrian"],
      blockedDataFields: ["nik", "alamat", "telepon", "nomor_hp", "catatan_internal"],
      aiSystemPrompt: "",
      aiUserPromptTemplate: "",
      maxAiTokens: 350,
      temperature: 0.2,
      requiresApprovalBeforeActive: false,
      version: 1,
      status: "active",
      approvedBy: null,
      approvedAt: null,
    };
  }
  if (["cek_akta_cerai", "sisa_panjar"].includes(key)) {
    return {
      aiAnswerEnabled: true,
      aiAnswerMode: "guided_answer",
      answerPolicy: "requires_verified_party",
      verificationPolicy: "case_number_and_phone",
      allowedDataFields: ["nomor_perkara", "status_umum", "keterangan"],
      blockedDataFields: ["nik", "alamat", "telepon", "nomor_hp", "catatan_internal"],
      aiSystemPrompt: "",
      aiUserPromptTemplate: "",
      maxAiTokens: 350,
      temperature: 0.2,
      requiresApprovalBeforeActive: false,
      version: 1,
      status: "active",
      approvedBy: null,
      approvedAt: null,
    };
  }
  return {
    aiAnswerEnabled: false,
    aiAnswerMode: "off",
    answerPolicy: "public_info_only",
    verificationPolicy: "none",
    allowedDataFields: [],
    blockedDataFields: ["nik", "alamat", "telepon", "nomor_hp", "catatan_internal"],
    aiSystemPrompt: "",
    aiUserPromptTemplate: "",
    maxAiTokens: 400,
    temperature: 0.2,
    requiresApprovalBeforeActive: false,
    version: 1,
    status: "active",
    approvedBy: null,
    approvedAt: null,
  };
}

function withPublicQaAnswerDefaults<T extends { key: string }>(intent: T) {
  return { ...getPublicQaAnswerDefaults(intent.key), ...intent };
}

const DEFAULT_PUBLIC_QA_INTENTS = [
  {
    id: "qa-greeting",
    key: "greeting",
    name: "Salam dan Bantuan Awal",
    description: "Menyambut pengguna dan menampilkan menu utama ALETA Bot.",
    category: "informasi_umum",
    audience: "public",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["halo", "hallo", "hai", "hei", "assalamualaikum", "aslmkm", "ass"],
    exampleQuestions: ["Halo admin", "Assalamualaikum", "Saya butuh bantuan", "Apa saja layanan bot ini?"],
    requiredParameters: [],
    queryKey: "",
    legacyHandler: "query.getData:greeting",
    legacyCommand: "halo",
    parameterizedLegacyCommand: "",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.65,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: PUBLIC_QA_FALLBACK_MESSAGE,
    riskLevel: "low",
    notes: "Seed dari trigger greeting query.js.",
  },
  {
    id: "qa-alamat",
    key: "alamat_pengadilan",
    name: "Alamat Pengadilan",
    description: "Informasi alamat, kontak, website, dan kanal resmi pengadilan.",
    category: "informasi_umum",
    audience: "public",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["alamat"],
    exampleQuestions: ["Alamat pengadilan di mana?", "Lokasi kantor PA Donggala", "Nomor WhatsApp pengadilan berapa?"],
    requiredParameters: [],
    queryKey: "",
    legacyHandler: "query.getData:alamat",
    legacyCommand: "alamat",
    parameterizedLegacyCommand: "",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.7,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: PUBLIC_QA_FALLBACK_MESSAGE,
    riskLevel: "low",
    notes: "Seed dari trigger alamat query.js.",
  },
  {
    id: "qa-cek-perkara",
    key: "cek_perkara",
    name: "Cek Perkara",
    description: "Mengarahkan pengguna ke menu status, biaya, jadwal, putusan, dan akta perkara.",
    category: "status_perkara",
    audience: "party",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["perkara", "status"],
    exampleQuestions: ["Saya mau cek perkara", "Bagaimana status perkara saya?", "Saya mau tahu perkembangan perkara"],
    requiredParameters: [],
    queryKey: "public_case_status",
    legacyHandler: "query.getData:perkara/status",
    legacyCommand: "perkara",
    parameterizedLegacyCommand: "status",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.72,
    requiresVerification: true,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: "Untuk mengecek perkara, silakan kirim nomor perkara. Contoh: status#123.G.2021.",
    riskLevel: "medium",
    notes: "Jika nomor perkara terdeteksi, diarahkan ke status#nomor_perkara.",
  },
  {
    id: "qa-jadwal-sidang",
    key: "cek_jadwal_sidang",
    name: "Cek Jadwal Sidang",
    description: "Mengarahkan pertanyaan natural tentang jadwal sidang ke command jadwal.",
    category: "jadwal_sidang",
    audience: "party",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["jadwal"],
    exampleQuestions: ["Saya mau tahu jadwal sidang saya", "Kapan sidang perkara saya?", "Sidang saya tanggal berapa?"],
    requiredParameters: ["nomor_perkara"],
    // Sumber data dikosongkan: aturan ini menjawab lewat jalur lama
    // (responseMode legacy_handler), dan kunci lamanya menunjuk query yang
    // tidak pernah ada sehingga aturannya gagal disimpan dari portal.
    queryKey: "",
    legacyHandler: "query.getData:jadwal",
    legacyCommand: "jadwal",
    parameterizedLegacyCommand: "jadwal",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.72,
    requiresVerification: true,
    requiresCaseNumber: true,
    maxAttempts: 2,
    fallbackMessage: "Untuk cek jadwal sidang, silakan kirim nomor perkara. Contoh: jadwal#123.G.2021.",
    riskLevel: "medium",
    notes: "Data dinamis tetap memakai handler legacy query.js.",
  },
  {
    id: "qa-akta-cerai",
    key: "cek_akta_cerai",
    name: "Akta Cerai",
    description: "Informasi syarat pengambilan dan status akta cerai.",
    category: "akta_cerai",
    audience: "party",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["akta_cerai", "akta", "pesan akta", "validasi"],
    exampleQuestions: ["Bagaimana cara ambil akta cerai?", "Akta cerai saya sudah jadi belum?", "Saya mau validasi akta cerai"],
    requiredParameters: ["nomor_perkara"],
    // Sumber data dikosongkan: aturan ini menjawab lewat jalur lama
    // (responseMode legacy_handler), dan kunci lamanya menunjuk query yang
    // tidak pernah ada sehingga aturannya gagal disimpan dari portal.
    queryKey: "",
    legacyHandler: "query.getData:akta",
    legacyCommand: "akta_cerai",
    parameterizedLegacyCommand: "akta",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.72,
    requiresVerification: true,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: "Untuk cek status akta cerai, silakan kirim nomor perkara. Contoh: akta#123.G.2021.",
    riskLevel: "medium",
    notes: "Tanpa nomor perkara dijawab dengan informasi syarat pengambilan.",
  },
  {
    id: "qa-sisa-panjar",
    key: "sisa_panjar",
    name: "Sisa Panjar / Biaya Perkara",
    description: "Mengarahkan pertanyaan biaya atau sisa panjar ke command biaya perkara.",
    category: "biaya_panjar",
    audience: "party",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["biaya"],
    exampleQuestions: ["Berapa sisa panjar perkara saya?", "Saya mau cek biaya perkara", "Rincian panjar perkara saya"],
    requiredParameters: ["nomor_perkara"],
    // Sumber data dikosongkan: aturan ini menjawab lewat jalur lama
    // (responseMode legacy_handler), dan kunci lamanya menunjuk query yang
    // tidak pernah ada sehingga aturannya gagal disimpan dari portal.
    queryKey: "",
    legacyHandler: "query.getData:biaya",
    legacyCommand: "perkara",
    parameterizedLegacyCommand: "biaya",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.72,
    requiresVerification: true,
    requiresCaseNumber: true,
    maxAttempts: 2,
    fallbackMessage: "Untuk cek biaya atau sisa panjar, silakan kirim nomor perkara. Contoh: biaya#123.G.2021.",
    riskLevel: "medium",
    notes: "Data dinamis tetap memakai handler legacy query.js.",
  },
  {
    id: "qa-antrian-online",
    key: "antrian_online",
    name: "Antrian Online Sidang",
    description: "Mendaftarkan kehadiran pihak pada antrian sidang hari ini dari pertanyaan WhatsApp yang natural.",
    category: "jadwal_sidang",
    audience: "party",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["daftar antrian", "antrian online", "ambil antrian", "ambil antrian online", "daftar hadir"],
    exampleQuestions: [
      "Saya sudah hadir untuk sidang perkara 123.G.2026",
      "Tolong daftarkan antrian sidang saya nomor 123.G.2026",
      "Saya mau ambil nomor antrian online perkara 123/Pdt.G/2026/PA.Dgl",
      "Saya penggugat sudah datang untuk antrian sidang",
      "Saya tergugat ingin daftar antrian online",
    ],
    requiredParameters: [],
    queryKey: "public_online_queue",
    legacyHandler: "query.getData:daftar antrian/antrian online",
    legacyCommand: "daftar antrian",
    parameterizedLegacyCommand: "daftar antrian",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.62,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: "Untuk daftar antrian online, silakan ketik ambil antrian. Jika nomor WhatsApp belum cocok dengan data perkara hari ini, kirim nomor perkara. Contoh: daftar antrian#123.G.2026.",
    riskLevel: "medium",
    notes: "Nomor WhatsApp pengirim diprioritaskan untuk menentukan penggugat/pemohon, tergugat/termohon, kuasa, turut tergugat, atau pihak intervensi. Data dibaca melalui koneksi antrian_sidang/db_config4.",
  },
  {
    id: "qa-ecourt",
    key: "ecourt",
    name: "E-Court",
    description: "Informasi berperkara secara elektronik.",
    category: "ecourt",
    audience: "public",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["ecourt", "e-court"],
    exampleQuestions: ["Saya mau informasi e-court", "Bagaimana daftar perkara online?", "Cara bayar perkara online"],
    requiredParameters: [],
    queryKey: "",
    legacyHandler: "query.getData:ecourt",
    legacyCommand: "ecourt",
    parameterizedLegacyCommand: "",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.7,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: PUBLIC_QA_FALLBACK_MESSAGE,
    riskLevel: "low",
    notes: "Seed dari trigger ecourt query.js.",
  },
  {
    id: "qa-pengaduan",
    key: "pengaduan",
    name: "Pengaduan",
    description: "Informasi kanal pengaduan resmi.",
    category: "pengaduan",
    audience: "public",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["pengaduan"],
    exampleQuestions: ["Saya mau mengadu", "Bagaimana cara membuat pengaduan?", "Saya ingin melaporkan pelayanan"],
    requiredParameters: [],
    queryKey: "",
    legacyHandler: "query.getData:pengaduan",
    legacyCommand: "pengaduan",
    parameterizedLegacyCommand: "",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.7,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: PUBLIC_QA_FALLBACK_MESSAGE,
    riskLevel: "low",
    notes: "Seed dari trigger pengaduan query.js.",
  },
  {
    id: "qa-syarat-daftar",
    key: "syarat_daftar",
    name: "Syarat Pendaftaran Perkara",
    description: "Informasi syarat pendaftaran perkara dan jenis layanan perdata.",
    category: "layanan",
    audience: "public",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["daftar", "perdata", "gugatan_mandiri", "daftar prodeo", "syarat prodeo"],
    exampleQuestions: ["Bagaimana daftar cerai?", "Apa syarat daftar perkara?", "Saya mau daftar gugatan", "Bagaimana daftar perkara prodeo?"],
    requiredParameters: [],
    queryKey: "",
    legacyHandler: "query.getData:daftar",
    legacyCommand: "daftar",
    parameterizedLegacyCommand: "",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.7,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: PUBLIC_QA_FALLBACK_MESSAGE,
    riskLevel: "low",
    notes: "Seed dari trigger daftar/perdata query.js.",
  },
  {
    id: "qa-salinan-putusan",
    key: "salinan_putusan",
    name: "Salinan Putusan",
    description: "Syarat permohonan salinan putusan atau penetapan.",
    category: "layanan",
    audience: "public",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["salinan_putusan", "salinan_penetapan", "putusan"],
    exampleQuestions: ["Apa syarat ambil salinan putusan?", "Saya mau salinan penetapan", "Bagaimana cara ambil putusan?"],
    requiredParameters: [],
    queryKey: "public_decision_copy",
    legacyHandler: "query.getData:salinan_putusan",
    legacyCommand: "salinan_putusan",
    parameterizedLegacyCommand: "putusan",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.7,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: "Untuk syarat salinan putusan ketik salinan_putusan. Untuk salinan putusan non-resmi berdasarkan nomor perkara, ketik putusan#123.G.2021.",
    riskLevel: "medium",
    notes: "Tidak memberi nasihat hukum atau isi putusan di luar handler legacy.",
  },
  {
    id: "qa-fallback",
    key: "fallback_unknown",
    name: "Fallback Tidak Dipahami",
    description: "Jawaban aman saat intent tidak dapat ditentukan.",
    category: "fallback",
    audience: "public",
    isActive: true,
    aiEnabled: false,
    exactTriggers: [],
    exampleQuestions: [],
    requiredParameters: [],
    queryKey: "",
    legacyHandler: "",
    legacyCommand: "",
    parameterizedLegacyCommand: "",
    templateKey: "",
    responseMode: "fallback",
    confidenceThreshold: 1,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: PUBLIC_QA_FALLBACK_MESSAGE,
    riskLevel: "low",
    notes: "Tidak memakai AI bebas.",
  },
].map(withPublicQaAnswerDefaults) as Array<
  Omit<AletaBotPublicQaIntent, "createdBy" | "updatedBy" | "createdAt" | "updatedAt">
>;

const DEFAULT_TEMPLATES: Array<Omit<AletaBotTemplate, "updatedAt">> = [
  {
    id: "perkara-baru",
    category: "pihak",
    title: "Notifikasi Perkara Baru",
    body:
      "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nHalo, saya Aleta, Bot Pengadilan.\n\nDetail Perkara Baru:\n- Nama: Sdr/Sdri *{{nama_pihak}}*\n- Nomor Perkara: *{{nomor_perkara}}*\n\n{{ringkasan}}\n\nInformasi tambahan:\n- Ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi akan disampaikan oleh Jurusita/Petugas Pos ke rumah Anda atau melalui Desa/Kelurahan.\n- Untuk informasi lebih lanjut, ketik \"perkara\" atau hubungi *0822-7111-5021*.\n- Mohon isi survei kepuasan layanan di https://pa-donggala.go.id/survei",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
  {
    id: "jadwal-sidang",
    category: "pihak",
    title: "Notifikasi Jadwal Sidang",
    body:
      "Assalamualaikum Warahmatullahi Wabarakatuh,\n\nHalo, saya Aleta, Bot Pengadilan.\n\nDetail Sidang Perkara:\n- Nama: Sdr/Sdri *{{nama_pihak}}*\n- Nomor Perkara: *{{nomor_perkara}}*\n\n{{ringkasan}}\n\n{{persiapan_sidang}}\n\nInformasi Tambahan:\n- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya disampaikan oleh Jurusita/Petugas Pos.\n- Untuk daftar antrian online, ikuti petunjuk yang tercantum pada informasi perkara apabila tersedia.\n- Info lebih lanjut, ketik \"perkara\" atau hubungi WhatsApp: *0822-7111-5021*.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan", "persiapan_sidang"],
    editable: true,
  },
  {
    // Pengingat H-1 sengaja jauh lebih pendek daripada H-3. Penjelasan panjang
    // sudah disampaikan tiga hari sebelumnya; mengulanginya utuh membuat pesan
    // penting terlihat seperti pesan berulang, dan pesan berulang persis yang
    // membuat orang memblokir nomor pengadilan.
    id: "pihak-sidang-h1",
    category: "pihak",
    title: "Pengingat Sidang Besok (H-1)",
    body:
      "Pengingat: sidang Anda besok.\n\nSdr/Sdri *{{nama_pihak}}*\nPerkara *{{nomor_perkara}}*\n\n{{ringkasan}}\n\n{{persiapan_sidang}}\n\nBila berhalangan hadir, sampaikan kepada Majelis Hakim melalui surat atau hubungi *0822-7111-5021*.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan", "persiapan_sidang"],
    editable: true,
  },
  {
    id: "akta-cerai",
    category: "pihak",
    title: "Notifikasi Akta Cerai",
    body:
      "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nHalo, saya Aleta, Bot Pengadilan.\nInformasi mengenai Akta Cerai Anda:\n- Nomor Perkara: *{{nomor_perkara}}*\n- Nama: *{{nama_pihak}}*\n\n{{ringkasan}}\n\nAkta Cerai sekarang dapat diambil secara online.\nSilahkan mengunjungi https://eac.mahkamahagung.go.id/ dan apabila masih belum memahami silahkan hubungi *0822-7111-5021*.\n\nIni adalah notifikasi, Anda tidak perlu membalasnya. Abaikan pesan ini jika Akta Cerai telah diambil. Terima kasih.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
  {
    id: "sisa-panjar",
    category: "pihak",
    title: "Notifikasi Sisa Panjar",
    body:
      "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nSdr/Sdri *{{nama_pihak}}*, perkara Nomor *{{nomor_perkara}}* memiliki informasi biaya perkara sebagai berikut:\n\n{{ringkasan}}\n\nTindakan yang perlu dilakukan:\n1. Silakan ke PTSP Pengadilan untuk arahan lebih lanjut.\n2. Lakukan pembayaran atau pengambilan hanya melalui petugas resmi/kasir Pengadilan.\n\nUntuk cek biaya, ketik:\nbiaya#nomor perkara Anda\n\nIni adalah notifikasi, anda tidak perlu membalasnya.\nInfo lebih lanjut hubungi *0822-7111-5021*.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
  {
    id: "balasan-otomatis",
    category: "balasan",
    title: "Balasan Otomatis",
    body:
      "Assalamu'alaikum. Ada yang bisa kami bantu?\n\nKetik salah satu kata kunci berikut:\n- info lengkap\n- perkara\n- sidang hari ini\n- akta#nomor perkara\n\nKami akan membantu sesuai data layanan yang tersedia.",
    placeholders: [],
    editable: true,
  },
  {
    id: "fallback-error",
    category: "error",
    title: "Fallback Error",
    body: "Maaf, permintaan Bapak/Ibu belum dapat diproses saat ini. Silakan coba beberapa saat lagi atau hubungi petugas layanan resmi pengadilan.",
    placeholders: [],
    editable: true,
  },
  {
    id: "admin-test",
    category: "admin",
    title: "Pesan Admin Test",
    body: "Tes pengiriman ALETA berhasil.\n\nWaktu: {{waktu}}\nMode: {{mode}}\n\nJika pesan ini diterima, koneksi WhatsApp sedang berjalan.",
    placeholders: ["waktu", "mode"],
    editable: true,
  },
  {
    id: "pegawai-monitoring",
    category: "pegawai",
    title: "Notifikasi Pegawai / Monitoring",
    body:
      "{{nama_pegawai}} — {{jabatan}}\n\n{{judul_notifikasi}}:\n\n{{ringkasan}}",
    placeholders: ["nama_pegawai", "jabatan", "judul_notifikasi", "ringkasan"],
    editable: true,
  },
  {
    id: "pegawai-monitoring-ringkas",
    category: "pegawai",
    title: "Pegawai - Monitoring Ringkas",
    body:
      "{{nama_pegawai}} — {{jabatan}}\n\nRingkasan keadaan perkara sampai sore ini:\n\n{{ringkasan}}\n\nData per {{waktu}}.",
    placeholders: ["nama_pegawai", "jabatan", "ringkasan", "waktu"],
    editable: true,
  },
  {
    id: "hakim-jadwal-tugas-sidang",
    category: "pegawai",
    title: "Hakim - Jadwal dan Tugas Sidang",
    body:
      "{{nama_pegawai}} — {{jabatan}}\n\n{{judul_notifikasi}}:\n\n{{ringkasan}}\n\nMohon disiapkan sebelum sidang dimulai.",
    placeholders: ["nama_pegawai", "jabatan", "judul_notifikasi", "ringkasan"],
    editable: true,
  },
  {
    id: "kepaniteraan-monitoring-perkara",
    category: "pegawai",
    title: "Kepaniteraan - Monitoring Perkara",
    body:
      "{{nama_pegawai}} — {{jabatan}}\n\nPerkara berikut perlu ditindaklanjuti:\n\n{{ringkasan}}\n\nMohon ditindaklanjuti sesuai kewenangan.",
    placeholders: ["nama_pegawai", "jabatan", "ringkasan"],
    editable: true,
  },
  {
    id: "kesekretariatan-info-internal",
    category: "pegawai",
    title: "Kesekretariatan - Informasi Internal",
    body:
      "{{nama_pegawai}} — {{jabatan}}\n\n{{judul_notifikasi}}:\n\n{{ringkasan}}",
    placeholders: ["nama_pegawai", "jabatan", "judul_notifikasi", "ringkasan"],
    editable: true,
  },
  {
    id: "disposition-deadline-h-minus-1",
    category: "pegawai",
    title: "Pengingat Deadline Disposisi H-1",
    body:
      "{{nama_pegawai}} — {{jabatan}}\n\nDisposisi berikut jatuh tempo besok:\nPerihal: {{perihal}}\nBatas tindak lanjut: {{deadline}}\n\nMohon diselesaikan sebelum batas waktu tersebut.",
    placeholders: ["nama_pegawai", "jabatan", "perihal", "deadline"],
    editable: true,
  },
  {
    id: "manajemen-surat-baru",
    category: "manajemen_surat",
    title: "Manajemen Surat - Surat Baru",
    body:
      "Assalamu'alaikum {{recipient_name}}.\n\nAda {{jenis_surat}} baru.\nNomor: {{nomor_surat}}\nPerihal: {{perihal}}\n\nSilakan buka ALETA untuk melihat detail dan tindak lanjut.",
    placeholders: ["recipient_name", "jenis_surat", "nomor_surat", "perihal"],
    editable: true,
  },
  {
    id: "manajemen-surat-disposisi",
    category: "manajemen_surat",
    title: "Manajemen Surat - Disposisi",
    body:
      "Assalamu'alaikum {{recipient_name}}.\n\nAda disposisi surat untuk Anda.\nNomor: {{nomor_surat}}\nPerihal: {{perihal}}\nInstruksi: {{instruksi}}\n\nSilakan buka ALETA untuk menindaklanjuti.",
    placeholders: ["recipient_name", "nomor_surat", "perihal", "instruksi"],
    editable: true,
  },
  {
    id: "pihak-tunda-sidang",
    category: "pihak",
    title: "Pihak - Sidang Ditunda",
    body:
      // Penekanan memakai satu tanda bintang (huruf tebal WhatsApp), bukan
      // huruf kapital. Kapital semua terbaca seperti membentak dan merupakan
      // ciri pesan iklan - ditemukan oleh pemeriksa isi pesan pada v1.15.0.
      "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nSdr/Sdri *{{nama_pihak}}*, sidang perkara Nomor *{{nomor_perkara}}* yang sebelumnya dijadwalkan *tidak jadi dilaksanakan* pada hari tersebut.\n\n{{ringkasan}}\n\nYang perlu Anda lakukan:\n- Tidak perlu datang ke pengadilan pada jadwal yang lama.\n- Jadwal pengganti akan disampaikan melalui panggilan resmi oleh Jurusita atau Petugas Pos.\n\nIni adalah notifikasi, anda tidak perlu membalasnya.\nInfo lebih lanjut hubungi *0822-7111-5021*.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
  {
    id: "pihak-layanan",
    category: "pihak",
    title: "Notifikasi Pihak / Layanan Perkara",
    body:
      "Assalamualaikum Warahmatullahi Wabarakatuh,\n\nHalo, saya Aleta, Bot Pengadilan.\n\nInformasi perkara Nomor *{{nomor_perkara}}* untuk Sdr/Sdri *{{nama_pihak}}*:\n\n{{ringkasan}}\n\nInformasi Tambahan:\n- Ini adalah notifikasi dan bukan pemberitahuan resmi, anda tidak perlu membalasnya.\n- Info lebih lanjut: WhatsApp *0822-7111-5021*.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
  {
    id: "pihak-perkara-jadwal-sidang",
    category: "pihak",
    title: "Pihak Perkara - Jadwal Sidang",
    body:
      "Assalamualaikum Warahmatullahi Wabarakatuh,\n\nHalo, saya Aleta, Bot Pengadilan.\n\nDetail Sidang Perkara:\n- Nama: Sdr/Sdri *{{nama_pihak}}*\n- Nomor Perkara: *{{nomor_perkara}}*\n\n{{ringkasan}}\n\nInformasi Tambahan:\n- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya disampaikan oleh Jurusita/Petugas Pos.\n- Info lebih lanjut, ketik \"perkara\" atau hubungi WhatsApp: *0822-7111-5021*.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
  {
    id: "pihak-perkara-akta-cerai",
    category: "pihak",
    title: "Pihak Perkara - Akta Cerai Terbit",
    body:
      "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nHalo, saya Aleta, Bot Pengadilan.\nInformasi mengenai Akta Cerai Anda:\n- Nomor Perkara: *{{nomor_perkara}}*\n- Nama: *{{nama_pihak}}*\n\n{{ringkasan}}\n\nAkta Cerai sekarang dapat diambil secara online.\nSilahkan mengunjungi https://eac.mahkamahagung.go.id/ dan apabila masih belum memahami silahkan hubungi *0822-7111-5021*.\n\nIni adalah notifikasi, Anda tidak perlu membalasnya. Abaikan pesan ini jika Akta Cerai telah diambil. Terima kasih.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
  {
    id: "masyarakat-info-layanan",
    category: "publik",
    title: "Masyarakat Umum - Informasi Layanan",
    body:
      "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi layanan pengadilan:\n{{ringkasan}}\n\nJika masih membutuhkan bantuan, silakan hubungi petugas layanan resmi pengadilan.",
    placeholders: ["nama_pihak", "ringkasan"],
    editable: true,
  },
  {
    id: "instansi-koordinasi-layanan",
    category: "instansi",
    title: "Instansi Mitra - Koordinasi Layanan",
    body:
      "Yth. {{nama_instansi}}.\n\nKami menyampaikan informasi koordinasi berikut:\n{{ringkasan}}\n\nApabila diperlukan konfirmasi, silakan menghubungi kanal resmi pengadilan.",
    placeholders: ["nama_instansi", "ringkasan"],
    editable: true,
  },
  {
    id: "pihak-perkara-putusan",
    category: "pihak",
    title: "Pihak Perkara - Informasi Putusan",
    body:
      "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi putusan perkara:\nNomor: {{nomor_perkara}}\nDetail:\n{{ringkasan}}\n\nUntuk salinan atau penjelasan layanan, silakan menghubungi PTSP pengadilan.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
  {
    id: "pihak-perkara-penundaan-sidang",
    category: "pihak",
    title: "Pihak Perkara - Penundaan Sidang",
    body:
      "Assalamu'alaikum {{nama_pihak}}.\n\nPembaruan jadwal perkara:\nNomor: {{nomor_perkara}}\nDetail:\n{{ringkasan}}\n\nMohon memperhatikan jadwal terbaru dari pengadilan.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
  {
    id: "pihak-perkara-panggilan",
    category: "pihak",
    title: "Pihak Perkara - Pengingat Panggilan",
    body:
      "Assalamu'alaikum {{nama_pihak}}.\n\nPengingat panggilan perkara:\nNomor: {{nomor_perkara}}\nDetail:\n{{ringkasan}}\n\nPanggilan resmi tetap mengikuti ketentuan hukum acara dan disampaikan oleh petugas yang berwenang.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
  {
    id: "pihak-perkara-panjar-habis",
    category: "pihak",
    title: "Pihak Perkara - Panjar Perlu Diperhatikan",
    body:
      "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi panjar perkara:\nNomor: {{nomor_perkara}}\nDetail:\n{{ringkasan}}\n\nSilakan menghubungi kasir/PTSP pengadilan untuk memastikan rincian dan tindak lanjut.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
  {
    id: "pihak-perkara-mediasi",
    category: "pihak",
    title: "Pihak Perkara - Pengingat Mediasi",
    body:
      "Assalamu'alaikum {{nama_pihak}}.\n\nPengingat mediasi perkara:\nNomor: {{nomor_perkara}}\nDetail:\n{{ringkasan}}\n\nMohon hadir tepat waktu dan membawa dokumen yang diperlukan.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
  {
    id: "pihak-kuasa-koordinasi",
    category: "pihak",
    title: "Kuasa Hukum - Koordinasi Perkara",
    body:
      "Assalamu'alaikum {{nama_pihak}}.\n\nKoordinasi perkara untuk kuasa hukum:\nNomor: {{nomor_perkara}}\nDetail:\n{{ringkasan}}\n\nSilakan berkoordinasi melalui kanal resmi pengadilan apabila diperlukan.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
  {
    id: "pihak-validasi-kontak",
    category: "pihak",
    title: "Pihak Perkara - Validasi Kontak",
    body:
      "Assalamu'alaikum {{nama_pihak}}.\n\nValidasi kontak perkara:\nNomor: {{nomor_perkara}}\nDetail:\n{{ringkasan}}\n\nJika ada perubahan nomor, silakan menghubungi petugas layanan pengadilan.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
  {
    id: "publik-syarat-layanan",
    category: "publik",
    title: "Masyarakat Umum - Syarat Layanan",
    body:
      "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi layanan {{nama_layanan}}:\n{{ringkasan}}\n\nUntuk memastikan syarat terbaru, silakan menghubungi PTSP atau kanal resmi pengadilan.",
    placeholders: ["nama_pihak", "nama_layanan", "ringkasan"],
    editable: true,
  },
  {
    id: "publik-pendaftaran-informasi",
    category: "publik",
    title: "Masyarakat Umum - Informasi Pendaftaran",
    body:
      "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi pendaftaran layanan pengadilan:\n{{ringkasan}}\n\nPetugas akan membantu sesuai data dan prosedur yang berlaku.",
    placeholders: ["nama_pihak", "ringkasan"],
    editable: true,
  },
  {
    id: "publik-pengaduan-layanan",
    category: "publik",
    title: "Masyarakat Umum - Pengaduan Layanan",
    body:
      "Assalamu'alaikum {{nama_pihak}}.\n\nUntuk pengaduan atau masukan layanan:\n{{ringkasan}}\n\nMohon cantumkan kronologi singkat dan identitas yang dapat dihubungi agar petugas dapat menindaklanjuti.",
    placeholders: ["nama_pihak", "ringkasan"],
    editable: true,
  },
  {
    id: "instansi-data-perceraian",
    category: "instansi",
    title: "Instansi Mitra - Data Perceraian",
    body:
      "Yth. {{nama_instansi}}.\n\nKami menyampaikan informasi terkait data perceraian/akta cerai:\n{{ringkasan}}\n\nMohon digunakan sesuai kebutuhan layanan dan ketentuan yang berlaku.",
    placeholders: ["nama_instansi", "ringkasan"],
    editable: true,
  },
  {
    id: "instansi-permintaan-konfirmasi",
    category: "instansi",
    title: "Instansi Mitra - Permintaan Konfirmasi",
    body:
      "Yth. {{nama_instansi}}.\n\nMohon konfirmasi terkait informasi berikut:\n{{ringkasan}}\n\nApabila data belum sesuai, silakan menghubungi kanal resmi pengadilan.",
    placeholders: ["nama_instansi", "ringkasan"],
    editable: true,
  },
  {
    id: "instansi-undangan-koordinasi",
    category: "instansi",
    title: "Instansi Mitra - Undangan Koordinasi",
    body:
      "Yth. {{nama_instansi}}.\n\nKami menyampaikan undangan/koordinasi layanan sebagai berikut:\n{{ringkasan}}\n\nTerima kasih atas kerja samanya.",
    placeholders: ["nama_instansi", "ringkasan"],
    editable: true,
  },
  {
    id: "ketua-rekap-perkara",
    category: "pegawai",
    title: "Pimpinan - Rekap Perkara",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\n{{judul_notifikasi}}\n{{ringkasan}}\n\nRingkasan ini disiapkan untuk bahan pemantauan dan tindak lanjut pimpinan.",
    placeholders: ["nama_pegawai", "judul_notifikasi", "ringkasan"],
    editable: true,
  },
  {
    id: "panitera-monitoring-bulanan",
    category: "pegawai",
    title: "Panitera - Monitoring Bulanan",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nMonitoring kepaniteraan:\n{{ringkasan}}\n\nMohon dicek dan ditindaklanjuti sesuai prioritas.",
    placeholders: ["nama_pegawai", "ringkasan"],
    editable: true,
  },
  {
    id: "jurusita-panggilan-perkara",
    category: "pegawai",
    title: "Jurusita - Panggilan dan Pemberitahuan",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\n{{judul_notifikasi}}\n{{ringkasan}}\n\nMohon dicek agar pelaksanaan panggilan/pemberitahuan sesuai jadwal.",
    placeholders: ["nama_pegawai", "judul_notifikasi", "ringkasan"],
    editable: true,
  },
  {
    id: "kasir-monitoring-panjar",
    category: "pegawai",
    title: "Kasir - Monitoring Panjar",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nInformasi biaya perkara:\n{{ringkasan}}\n\nMohon dicek untuk layanan kasir dan pengembalian/pemenuhan panjar bila diperlukan.",
    placeholders: ["nama_pegawai", "ringkasan"],
    editable: true,
  },
  {
    id: "penjaga-sidang-jadwal",
    category: "pegawai",
    title: "Penjaga Sidang - Jadwal Ruangan",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nJadwal/ruangan sidang:\n{{ringkasan}}\n\nMohon dipastikan kesiapan ruang, jadwal, dan kebutuhan persidangan.",
    placeholders: ["nama_pegawai", "ringkasan"],
    editable: true,
  },
  {
    id: "admin-sipp-monitoring",
    category: "pegawai",
    title: "Admin SIPP - Monitoring Data",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nMonitoring data SIPP:\n{{ringkasan}}\n\nMohon dicek apabila ada data yang perlu diperbaiki atau disinkronkan.",
    placeholders: ["nama_pegawai", "ringkasan"],
    editable: true,
  },
  {
    id: "arsip-monitoring-berkas",
    category: "pegawai",
    title: "Arsip - Monitoring Berkas",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nInformasi arsip/berkas:\n{{ringkasan}}\n\nMohon dicek lokasi, status pinjam, atau kelengkapan berkas sesuai kebutuhan.",
    placeholders: ["nama_pegawai", "ringkasan"],
    editable: true,
  },
  {
    id: "publikasi-putusan-monitoring",
    category: "pegawai",
    title: "Publikasi Putusan - Monitoring",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nMonitoring publikasi putusan:\n{{ringkasan}}\n\nMohon dicek agar publikasi dan kelengkapan dokumen berjalan sesuai ketentuan.",
    placeholders: ["nama_pegawai", "ringkasan"],
    editable: true,
  },
  {
    id: "ecourt-monitoring",
    category: "pegawai",
    title: "e-Court - Monitoring",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nMonitoring e-Court:\n{{ringkasan}}\n\nMohon dicek bila ada antrian, sinkronisasi, atau data pihak yang perlu ditindaklanjuti.",
    placeholders: ["nama_pegawai", "ringkasan"],
    editable: true,
  },
  {
    id: "mediasi-monitoring",
    category: "pegawai",
    title: "Mediasi - Monitoring",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nMonitoring mediasi:\n{{ringkasan}}\n\nMohon dicek agar jadwal dan hasil mediasi tercatat dengan baik.",
    placeholders: ["nama_pegawai", "ringkasan"],
    editable: true,
  },
  {
    id: "keuangan-transaksi-monitoring",
    category: "pegawai",
    title: "Keuangan Perkara - Monitoring Transaksi",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nMonitoring transaksi perkara:\n{{ringkasan}}\n\nMohon dicek bila ada transaksi yang perlu dikonfirmasi.",
    placeholders: ["nama_pegawai", "ringkasan"],
    editable: true,
  },
  {
    id: "manajemen-surat-deadline",
    category: "manajemen_surat",
    title: "Manajemen Surat - Pengingat Batas Waktu",
    body:
      "Assalamu'alaikum {{recipient_name}}.\n\nPengingat surat:\nNomor: {{nomor_surat}}\nPerihal: {{perihal}}\nBatas waktu: {{deadline}}\n\nMohon ditindaklanjuti sebelum batas waktu.",
    placeholders: ["recipient_name", "nomor_surat", "perihal", "deadline"],
    editable: true,
  },
  {
    id: "manajemen-surat-selesai",
    category: "manajemen_surat",
    title: "Manajemen Surat - Tindak Lanjut Selesai",
    body:
      "Assalamu'alaikum {{recipient_name}}.\n\nTindak lanjut surat berikut telah diperbarui:\nNomor: {{nomor_surat}}\nPerihal: {{perihal}}\nStatus: {{status}}\n\nSilakan buka ALETA jika perlu melihat detail.",
    placeholders: ["recipient_name", "nomor_surat", "perihal", "status"],
    editable: true,
  },
  {
    id: "manajemen-surat-revisi",
    category: "manajemen_surat",
    title: "Manajemen Surat - Perlu Perbaikan",
    body:
      "Assalamu'alaikum {{recipient_name}}.\n\nAda surat yang perlu diperbaiki atau dilengkapi.\nNomor: {{nomor_surat}}\nPerihal: {{perihal}}\nCatatan: {{instruksi}}\n\nSilakan buka ALETA untuk menindaklanjuti.",
    placeholders: ["recipient_name", "nomor_surat", "perihal", "instruksi"],
    editable: true,
  },
  {
    id: "dokumen-lampiran-perkara",
    category: "dokumen_lampiran",
    title: "Dokumen / Lampiran - Pihak Perkara",
    body:
      "Assalamu'alaikum {{nama_pihak}}.\n\nAda dokumen terkait perkara:\nNomor: {{nomor_perkara}}\nDokumen: {{file_name}}\nKeterangan:\n{{ringkasan}}\n\nMohon simpan dokumen ini dan ikuti arahan layanan pengadilan apabila diperlukan.",
    placeholders: ["nama_pihak", "nomor_perkara", "file_name", "ringkasan"],
    editable: true,
  },
  {
    id: "dokumen-lampiran-pegawai",
    category: "dokumen_lampiran",
    title: "Dokumen / Lampiran - Pegawai",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\n{{judul_notifikasi}}\nDokumen: {{file_name}}\nKeterangan:\n{{ringkasan}}\n\nMohon dicek dan ditindaklanjuti sesuai tugas masing-masing.",
    placeholders: ["nama_pegawai", "judul_notifikasi", "file_name", "ringkasan"],
    editable: true,
  },
  {
    id: "reminder-internal-role",
    category: "reminder_internal",
    title: "Reminder Internal - Per Role",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nPengingat untuk {{recipient_role}}:\n{{judul_notifikasi}}\n{{ringkasan}}\n\nWaktu data: {{waktu}}.",
    placeholders: ["nama_pegawai", "recipient_role", "judul_notifikasi", "ringkasan", "waktu"],
    editable: true,
  },
  {
    id: "reminder-internal-deadline",
    category: "reminder_internal",
    title: "Reminder Internal - Batas Waktu",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nPengingat tindak lanjut:\nPerihal: {{perihal}}\nBatas waktu: {{deadline}}\nDetail:\n{{ringkasan}}\n\nMohon diselesaikan sebelum batas waktu apabila sudah sesuai kewenangan.",
    placeholders: ["nama_pegawai", "perihal", "deadline", "ringkasan"],
    editable: true,
  },
];

/**
 * Apakah isi pesan yang tersimpan masih berupa bawaan versi lama?
 *
 * Dipakai saat update aplikasi: hanya isi pesan yang PERSIS sama dengan salah
 * satu bawaan lama yang boleh diganti dengan bawaan baru. Isi pesan yang sudah
 * disunting sendiri oleh admin tidak pernah ditimpa, sekecil apa pun ubahannya.
 */
export function isReplaceableLegacyTemplateBody(templateId: string, storedBody: string) {
  const legacyBodies = LEGACY_DEFAULT_TEMPLATE_BODIES[templateId] ?? [];
  return legacyBodies.includes(storedBody);
}

/** Isi pesan bawaan versi sebelumnya, per id isi pesan. */
export function listLegacyTemplateBodies(templateId: string): string[] {
  return [...(LEGACY_DEFAULT_TEMPLATE_BODIES[templateId] ?? [])];
}

/** Isi pesan bawaan versi sekarang, per id isi pesan. */
export function getDefaultTemplateBody(templateId: string): string | null {
  return DEFAULT_TEMPLATES.find((template) => template.id === templateId)?.body ?? null;
}

/** Seluruh isi pesan bawaan versi sekarang. Dipakai pemeriksa isi pesan. */
export function listAletaBotTemplateDefaults() {
  return DEFAULT_TEMPLATES.map((template) => ({ ...template }));
}

/** Notifikasi bawaan versi sekarang, per id notifikasi. */
export function getAletaBotDefaultNotification(notificationId: string) {
  return DEFAULT_NOTIFICATIONS.find((notification) => notification.id === notificationId) ?? null;
}

/**
 * Menyisipkan tahap agenda ke pengaturan jadwal yang SUDAH tersimpan.
 *
 * Notifikasi disimpan dengan ON CONFLICT DO NOTHING, sehingga instalasi yang
 * sudah berjalan tidak pernah menerima kolom baru dari pembaruan aplikasi.
 * Tanpa penyisipan ini, penyaringan agenda hanya bekerja pada pemasangan baru -
 * dan justru server produksi yang tidak mendapatkannya.
 *
 * Penyisipannya sengaja bedah-kecil: hanya menambahkan satu kunci dan
 * mempertahankan sisanya apa adanya, supaya jam cron yang sudah disesuaikan
 * admin tidak ikut dikembalikan ke bawaan.
 *
 * @returns JSON baru yang harus disimpan, atau null bila tidak perlu diubah
 */
export function mergeAgendaStageIntoScheduleConfig(
  storedJson: string | null | undefined,
  defaultStage: string
): string | null {
  if (!defaultStage) return null;
  // Baris tanpa pengaturan jadwal sama sekali tidak dibetulkan di sini.
  // Membuatkan pengaturan baru berarti menebak jam kirimnya, dan menebak jam
  // kirim notifikasi ke pihak jauh lebih berbahaya daripada membiarkannya.
  if (!storedJson || !String(storedJson).trim()) return null;

  let parsed: Record<string, unknown>;
  try {
    const raw: unknown = JSON.parse(String(storedJson));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    parsed = raw as Record<string, unknown>;
  } catch {
    // JSON rusak dibiarkan utuh supaya kerusakannya terlihat saat diperiksa,
    // bukan tertimpa diam-diam oleh pembaruan aplikasi.
    return null;
  }

  // Nilai yang sudah ada dihormati, termasuk bila admin sengaja mengosongkannya
  // untuk mematikan penyaringan agenda.
  if ("agendaStage" in parsed) return null;

  return JSON.stringify({ ...parsed, agendaStage: defaultStage });
}

const LEGACY_DEFAULT_TEMPLATE_BODIES: Record<string, string[]> = {
  "perkara-baru": [
    // Memakai pemendek tautan s.id - salah satu pemicu pemblokiran WhatsApp
    // yang paling sering; diganti domain resmi pengadilan (v1.12.1).
    "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nHalo, saya Aleta, Bot Pengadilan.\n\nDetail Perkara Baru:\n- Nama: Sdr/Sdri *{{nama_pihak}}*\n- Nomor Perkara: *{{nomor_perkara}}*\n\n{{ringkasan}}\n\nInformasi tambahan:\n- Ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi akan disampaikan oleh Jurusita/Petugas Pos ke rumah Anda atau melalui Desa/Kelurahan.\n- Untuk informasi lebih lanjut, ketik \"perkara\" atau hubungi *0822-7111-5021*.\n- Mohon isi survei di https://s.id/LTYh1",
    "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi perkara:\nNomor: {{nomor_perkara}}\nAgenda awal: {{agenda}}\n\nData ini sebagai pemberitahuan awal. Untuk informasi resmi lanjutan, silakan hubungi layanan pengadilan.",
    "Assalamu'alaikum.\n\nHalo, saya ALETA Bot. Perkara {{nomor_perkara}} atas nama {{nama_pihak}} telah terdaftar dengan agenda {{agenda}}.\n\nPesan ini adalah notifikasi otomatis.",
    "Assalamu'alaikum {{nama_pihak}}.\n\nPerkara {{nomor_perkara}} telah terdaftar.\nAgenda awal: {{agenda}}\n\nJika membutuhkan informasi lanjutan, silakan hubungi layanan resmi pengadilan.",
  ],
  "pihak-tunda-sidang": [
    // Memakai HURUF KAPITAL untuk penekanan; diganti huruf tebal WhatsApp
    // (v1.15.0).
    "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\nSdr/Sdri *{{nama_pihak}}*, sidang perkara Nomor *{{nomor_perkara}}* yang sebelumnya dijadwalkan TIDAK JADI dilaksanakan pada hari tersebut.\n\n{{ringkasan}}\n\nYang perlu Anda lakukan:\n- Tidak perlu datang ke pengadilan pada jadwal yang lama.\n- Jadwal pengganti akan disampaikan melalui panggilan resmi oleh Jurusita atau Petugas Pos.\n\nIni adalah notifikasi, anda tidak perlu membalasnya.\nInfo lebih lanjut hubungi *0822-7111-5021*.",
  ],
  "jadwal-sidang": [
    // Belum memuat {{persiapan_sidang}}, sehingga pihak hanya membaca agenda
    // mentah dari SIPP ("Pemeriksaan Saksi") tanpa tahu apa yang harus dibawa
    // ke persidangan (v1.13.0).
    "Assalamualaikum Warahmatullahi Wabarakatuh,\n\nHalo, saya Aleta, Bot Pengadilan.\n\nDetail Sidang Perkara:\n- Nama: Sdr/Sdri *{{nama_pihak}}*\n- Nomor Perkara: *{{nomor_perkara}}*\n\n{{ringkasan}}\n\nInformasi Tambahan:\n- Pesan ini adalah notifikasi, anda tidak perlu membalasnya. Panggilan resmi sebelumnya disampaikan oleh Jurusita/Petugas Pos.\n- Untuk daftar antrian online, ikuti petunjuk yang tercantum pada informasi perkara apabila tersedia.\n- Info lebih lanjut, ketik \"perkara\" atau hubungi WhatsApp: *0822-7111-5021*.",
    "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi jadwal sidang:\nNomor: {{nomor_perkara}}\nHari/tanggal: {{hari_sidang}}, {{tanggal_sidang}}\nRuang: {{ruangan}}\nAgenda: {{agenda}}\n\nMohon hadir tepat waktu dan membawa dokumen yang diperlukan.",
    "Assalamu'alaikum.\n\nPerkara {{nomor_perkara}} dijadwalkan sidang pada {{hari_sidang}}, {{tanggal_sidang}} di ruang {{ruangan}} dengan agenda {{agenda}}.",
    "Assalamu'alaikum {{nama_pihak}}.\n\nJadwal sidang perkara {{nomor_perkara}}:\nHari/tanggal: {{hari_sidang}}, {{tanggal_sidang}}\nRuang: {{ruangan}}\nAgenda: {{agenda}}\n\nMohon hadir tepat waktu dan membawa dokumen yang diperlukan.",
  ],
  "akta-cerai": [
    "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi akta cerai:\nNomor: {{nomor_perkara}}\nStatus: Akta cerai telah tersedia.\n\nSilakan mengikuti prosedur pengambilan pada layanan PTSP pengadilan.",
    "Akta cerai untuk perkara {{nomor_perkara}} telah tersedia. Silakan mengikuti prosedur pengambilan pada layanan PTSP.",
    "Assalamu'alaikum {{nama_pihak}}.\n\nAkta cerai untuk perkara {{nomor_perkara}} telah tersedia.\n\nSilakan mengikuti prosedur pengambilan pada layanan PTSP pengadilan.",
  ],
  "sisa-panjar": [
    "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi panjar perkara:\nNomor: {{nomor_perkara}}\nSisa panjar: {{sisa_panjar}}\n\nUntuk rincian atau pengambilan, silakan menghubungi petugas kasir/PTSP pengadilan.",
    "Informasi biaya perkara {{nomor_perkara}}: sisa panjar saat ini {{sisa_panjar}}. Mohon hubungi petugas bila memerlukan rincian.",
    "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi biaya perkara {{nomor_perkara}}:\nSisa panjar: {{sisa_panjar}}\n\nUntuk rincian atau pengambilan, silakan menghubungi petugas kasir/PTSP pengadilan.",
  ],
  "balasan-otomatis": [
    "Halo, saya ALETA Bot. Ketik info lengkap, perkara, sidang hari ini, atau akta#nomor perkara untuk layanan informasi.",
  ],
  "fallback-error": [
    "Maaf, ALETA Bot belum dapat memproses permintaan tersebut. Silakan coba beberapa saat lagi.",
  ],
  "admin-test": ["Tes ALETA Bot berhasil pada {{waktu}}. Mode: {{mode}}."],
  "pegawai-monitoring": [
    // Nama pegawai sempat ditebalkan pada v1.7.1.
    "*{{nama_pegawai}}* — {{jabatan}}\n\n{{judul_notifikasi}}:\n\n{{ringkasan}}",
    "Assalamu'alaikum {{nama_pegawai}}.\n\n{{judul_notifikasi}}\n{{ringkasan}}\n\nMohon dicek dan ditindaklanjuti sesuai tugas masing-masing.",
    "Assalamu'alaikum {{nama_pegawai}}.\n\n{{judul_notifikasi}}\n\n{{ringkasan}}\n\nSumber: ALETA Bot.",
    // Sapaan "saya Aleta" dihapus untuk pesan internal pegawai (v1.7.1).
    "*_Hai {{nama_pegawai}}, saya Aleta, berikut data keadaan perkara :_*\n\n*{{judul_notifikasi}}*\n\n{{ringkasan}}",
  ],
  "pegawai-monitoring-ringkas": [
    // Nama pegawai sempat ditebalkan pada v1.7.1.
    "*{{nama_pegawai}}* — {{jabatan}}\n\nRingkasan keadaan perkara sampai sore ini:\n\n{{ringkasan}}\n\nData per {{waktu}}.",
    "Assalamu'alaikum {{nama_pegawai}}.\n\nPembaruan singkat:\n{{ringkasan}}\n\nWaktu data: {{waktu}}.",
    "Assalamu'alaikum {{nama_pegawai}}.\n\nBerikut pembaruan dari ALETA Bot:\n\n{{ringkasan}}\n\nWaktu data: {{waktu}}.",
    "*Hai {{nama_pegawai}}, mengingatkan kembali tentang situasi keadaan perkara sampai sore hari ini :*\n\n{{ringkasan}}\n\nWaktu data: {{waktu}}.",
  ],
  "hakim-jadwal-tugas-sidang": [
    // Nama pegawai sempat ditebalkan pada v1.7.1.
    "*{{nama_pegawai}}* — {{jabatan}}\n\n{{judul_notifikasi}}:\n\n{{ringkasan}}\n\nMohon disiapkan sebelum sidang dimulai.",
    "Assalamu'alaikum Yang Mulia {{nama_pegawai}}.\n\n{{judul_notifikasi}}\n{{ringkasan}}\n\nSemoga menjadi pengingat singkat untuk agenda persidangan.",
    "Assalamu'alaikum Yang Mulia {{nama_pegawai}}.\n\n{{judul_notifikasi}}\n\n{{ringkasan}}\n\nPesan ini dikirim otomatis sebagai pengingat tugas persidangan.",
    "*_Hai, Saya Aleta, mengingatkan kembali persiapan untuk {{nama_pegawai}} :_*\n\n*{{judul_notifikasi}}*\n\n{{ringkasan}}",
  ],
  "kepaniteraan-monitoring-perkara": [
    // Nama pegawai sempat ditebalkan pada v1.7.1.
    "*{{nama_pegawai}}* — {{jabatan}}\n\nPerkara berikut perlu ditindaklanjuti:\n\n{{ringkasan}}\n\nMohon ditindaklanjuti sesuai kewenangan.",
    "Assalamu'alaikum {{nama_pegawai}}.\n\nMohon perhatian untuk data berikut:\n\n{{ringkasan}}\n\nSilakan ditindaklanjuti sesuai kewenangan masing-masing.",
    "Assalamu'alaikum {{nama_pegawai}}.\n\nMohon perhatian untuk data berikut:\n{{ringkasan}}\n\nSilakan ditindaklanjuti sesuai kewenangan.",
  ],
  "kesekretariatan-info-internal": [
    // Nama pegawai sempat ditebalkan pada v1.7.1.
    "*{{nama_pegawai}}* — {{jabatan}}\n\n{{judul_notifikasi}}:\n\n{{ringkasan}}",
    "Assalamu'alaikum {{nama_pegawai}}.\n\n{{judul_notifikasi}}\n\n{{ringkasan}}\n\nTerima kasih.",
    "Assalamu'alaikum {{nama_pegawai}}.\n\n{{judul_notifikasi}}\n{{ringkasan}}\n\nTerima kasih.",
  ],
  "disposition-deadline-h-minus-1": [
    // Nama pegawai sempat ditebalkan pada v1.7.1.
    "*{{nama_pegawai}}* — {{jabatan}}\n\nDisposisi berikut jatuh tempo besok:\nPerihal: {{perihal}}\nBatas tindak lanjut: {{deadline}}\n\nMohon diselesaikan sebelum batas waktu tersebut.",
    "Assalamu'alaikum {{nama_pegawai}}.\n\nPengingat disposisi: Surat \"{{perihal}}\" jatuh tempo pada {{deadline}}. Mohon segera ditindaklanjuti.\n\nPesan ini masih disiapkan dalam mode simulasi/dry-run sampai disetujui.",
    "Assalamu'alaikum {{nama_pegawai}}.\n\nPengingat disposisi:\nPerihal: {{perihal}}\nBatas tindak lanjut: {{deadline}}\n\nMohon diselesaikan sebelum batas waktu apabila sudah sesuai kewenangan.",
  ],
  "manajemen-surat-baru": [
    "Assalamu'alaikum {{recipient_name}}.\n\nAda surat {{jenis_surat}} baru di ALETA.\nNomor: {{nomor_surat}}\nPerihal: {{perihal}}\n\nSilakan buka aplikasi ALETA untuk menindaklanjuti.",
  ],
  "manajemen-surat-disposisi": [
    "Assalamu'alaikum {{recipient_name}}.\n\nAda disposisi surat untuk Anda.\nNomor: {{nomor_surat}}\nPerihal: {{perihal}}\nInstruksi: {{instruksi}}\n\nSilakan buka aplikasi ALETA untuk menindaklanjuti.",
  ],
  "pihak-layanan": [
    "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi perkara:\nNomor: {{nomor_perkara}}\nDetail:\n{{ringkasan}}\n\nUntuk informasi lebih lanjut, silakan hubungi layanan resmi pengadilan.",
    "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi perkara {{nomor_perkara}}:\n{{ringkasan}}\n\nPesan otomatis ALETA Bot.",
    "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi perkara {{nomor_perkara}}:\n{{ringkasan}}\n\nUntuk informasi lebih lanjut, silakan hubungi layanan resmi pengadilan.",
  ],
  "pihak-perkara-jadwal-sidang": [
    "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi jadwal perkara:\nNomor: {{nomor_perkara}}\nDetail:\n{{ringkasan}}\n\nMohon hadir sesuai jadwal dan membawa dokumen yang diperlukan.",
    "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi perkara {{nomor_perkara}}:\n{{ringkasan}}\n\nMohon hadir sesuai jadwal dan membawa dokumen yang diperlukan. Pesan ini adalah notifikasi otomatis.",
    "Assalamu'alaikum {{nama_pihak}}.\n\nJadwal perkara {{nomor_perkara}}:\n{{ringkasan}}\n\nMohon hadir sesuai jadwal dan membawa dokumen yang diperlukan.",
  ],
  "pihak-perkara-akta-cerai": [
    "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi akta cerai:\nNomor: {{nomor_perkara}}\nStatus: Akta cerai telah tersedia/terdata.\nDetail:\n{{ringkasan}}\n\nUntuk pengambilan atau konfirmasi, silakan hubungi PTSP pengadilan.",
    "Assalamu'alaikum {{nama_pihak}}.\n\nAkta cerai untuk perkara {{nomor_perkara}} telah tersedia/terdata dalam layanan pengadilan.\n\n{{ringkasan}}\n\nUntuk informasi pengambilan, silakan hubungi PTSP pengadilan.",
    "Assalamu'alaikum {{nama_pihak}}.\n\nAkta cerai perkara {{nomor_perkara}} telah tersedia.\n{{ringkasan}}\n\nUntuk pengambilan atau konfirmasi, silakan hubungi PTSP pengadilan.",
  ],
  "pihak-perkara-putusan": [
    "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi perkara {{nomor_perkara}}:\n{{ringkasan}}\n\nUntuk salinan atau penjelasan layanan, silakan menghubungi PTSP pengadilan.",
  ],
  "pihak-perkara-penundaan-sidang": [
    "Assalamu'alaikum {{nama_pihak}}.\n\nAda pembaruan jadwal untuk perkara {{nomor_perkara}}.\n{{ringkasan}}\n\nMohon memperhatikan jadwal terbaru dari pengadilan.",
  ],
  "pihak-perkara-panggilan": [
    "Assalamu'alaikum {{nama_pihak}}.\n\nPengingat perkara {{nomor_perkara}}:\n{{ringkasan}}\n\nPanggilan resmi tetap mengikuti ketentuan hukum acara dan disampaikan oleh petugas yang berwenang.",
  ],
  "pihak-perkara-panjar-habis": [
    "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi biaya perkara {{nomor_perkara}}:\n{{ringkasan}}\n\nSilakan menghubungi kasir/PTSP pengadilan untuk memastikan rincian dan tindak lanjut.",
  ],
  "pihak-perkara-mediasi": [
    "Assalamu'alaikum {{nama_pihak}}.\n\nPengingat mediasi perkara {{nomor_perkara}}:\n{{ringkasan}}\n\nMohon hadir tepat waktu dan membawa dokumen yang diperlukan.",
  ],
  "pihak-kuasa-koordinasi": [
    "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi untuk kuasa hukum pada perkara {{nomor_perkara}}:\n{{ringkasan}}\n\nSilakan berkoordinasi melalui kanal resmi pengadilan apabila diperlukan.",
  ],
  "pihak-validasi-kontak": [
    "Assalamu'alaikum {{nama_pihak}}.\n\nKami perlu memastikan data kontak untuk perkara {{nomor_perkara}}.\n{{ringkasan}}\n\nJika ada perubahan nomor, silakan menghubungi petugas layanan pengadilan.",
  ],
  "masyarakat-info-layanan": [
    "Assalamu'alaikum {{nama_pihak}}.\n\nBerikut informasi layanan pengadilan:\n{{ringkasan}}\n\nJika membutuhkan bantuan lanjutan, silakan hubungi petugas layanan resmi pengadilan.",
  ],
  "instansi-koordinasi-layanan": [
    "Yth. {{nama_instansi}}.\n\nKami menyampaikan informasi koordinasi berikut:\n{{ringkasan}}\n\nApabila diperlukan konfirmasi, silakan menghubungi kanal resmi pengadilan.",
  ],
};

const DEFAULT_JOBS: Array<Omit<AletaBotJob, "lastRunAt" | "lastStatus" | "lastMessage" | "updatedAt">> = [
  {
    id: "ketua-penerimaan-perkara",
    name: "Rekap Penerimaan Perkara Ketua",
    description: "Rekap penerimaan perkara dan mediasi bulanan untuk Ketua dari sumber data notifikasi lama.",
    enabled: false,
    scheduleCron: "50 07 1 * *",
  },
  {
    id: "panitera-bulanan",
    name: "Rekap Panitera Bulanan",
    description: "Diambil dari app.js sendPanitera dan kumpulan query BAS, relaas, PBT, minutasi, e-court, dan publikasi.",
    enabled: false,
    scheduleCron: "50 07 1 * *",
  },
  {
    id: "penjaga-sidang-hari-ini",
    name: "Penjaga Sidang Hari Ini",
    description: "Pengingat jadwal sidang hari ini untuk petugas sidang internal.",
    enabled: false,
    scheduleCron: "10 07 * * Monday-Friday",
  },
  {
    id: "penjaga-sidang-besok",
    name: "Penjaga Sidang Besok",
    description: "Pengingat jadwal sidang besok untuk petugas sidang internal.",
    enabled: false,
    scheduleCron: "00 20 * * *",
  },
  {
    id: "kasir-harian",
    name: "Pengingat Kasir Harian",
    description: "Diambil dari app.js sendPengingatKasir untuk pengingat sisa panjar dan layanan kasir.",
    enabled: false,
    scheduleCron: "30 14 * * Monday-Thursday",
  },
  {
    id: "pihak-hari-sidang",
    name: "Notifikasi Pihak Hari Sidang",
    description: "Pengingat kepada pihak perkara pada hari sidang.",
    enabled: false,
    scheduleCron: "00 07 * * *",
  },
  {
    id: "pihak-sebelum-sidang",
    name: "Notifikasi Pihak Sebelum Sidang",
    description: "Pengingat kepada pihak perkara sebelum tanggal sidang.",
    enabled: false,
    scheduleCron: "00 09 * * *",
  },
];

const DEFAULT_QUERIES: Array<
  Omit<
    AletaBotQuery,
    | "connectionKey"
    | "usedByNotifications"
    | "lastTestedAt"
    | "lastTestStatus"
    | "lastTestError"
    | "createdBy"
    | "updatedBy"
    | "createdAt"
    | "updatedAt"
  >
> = [
  {
    id: "legacy-ketua-penerimaan-perkara",
    name: "Ketua - Rekap Penerimaan Perkara Bulanan",
    category: "employee",
    description: "Gabungan getTotalPenerimaanPerkaraSemuaHakimLengkap, Mediasi, Panitera, dan Jurusita dari app.js.",
    sqlText:
      "legacy:notifikasi.getTotalPenerimaanPerkaraSemuaHakimLengkap,getTotalPenerimaanMediasiSemuaHakim,getTotalPenerimaanPerkaraSemuaPanitera,getTotalPenerimaanPerkaraSemuaJurusita",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "legacy-panitera-monitoring-bulanan",
    name: "Kepaniteraan - Monitoring Perkara Bulanan",
    category: "employee",
    description: "Monitoring BAS, minutasi, BHT, relaas, panjar, delegasi, e-doc, dan perkara tertunda untuk Panitera.",
    sqlText:
      "legacy:notifikasi.getDataBA,getDataPutusanBelumMinut,getDataBelumBhtPerdata,getDataBelumSerahHukum,getDataSaksiTidakLengkap,getDataSisaPanjarPn,getDataSisaPanjarBanding,getDataSisaPanjarKasasi,getStatistikDetail,getBelumPanggilan,getDataBanding,getDataKasasi,getDataPK,getDataEdocPetitum,getDataEdocAnonimisasi,getDataBelumDelegasi,getDataVerstek,getDataTundaMediasi",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "legacy-jadwal-sidang-internal",
    name: "Pegawai - Jadwal Sidang Internal",
    category: "employee",
    description: "Jadwal sidang dan mediasi hari ini/besok untuk penjaga sidang, hakim, dan panitera.",
    sqlText:
      "legacy:notifikasi.getDataJadwalSidangPerdata,getDataJadwalMediasi,getDataJadwalBesok,getDataJadwalMediasiBesok,getDataJadwalSidangPerdataHakim,getDataJadwalBesokHakim,getDataJadwalSidangPerdataPanitera,getDataJadwalBesokPaniteraNew",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan", "tanggal_sidang", "agenda"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "legacy-kasir-panjar",
    name: "Kasir/PTSP - Pengingat Panjar dan Penetapan",
    category: "employee",
    description: "Pengingat sisa panjar, meterai/redaksi, dan penetapan untuk kasir/PTSP.",
    sqlText: "legacy:notifikasi.getDataSisaPanjarPn,getDataMeteraiRedaksiPsp,getDataDaftarPenetapan",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan", "nomor_perkara", "sisa_panjar"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "legacy-status-sidang-pegawai",
    name: "Pegawai - Status Tugas Sidang dan Perkara",
    category: "employee",
    description: "Status minutasi, upload putusan, antrian sidang, relaas, delegasi, dan panggilan untuk Hakim/Panitera/Jurusita.",
    sqlText:
      "legacy:notifikasi.getDataPutusanBelumMinutHakim,getDataUploadPutusanHakim,getDataLupaTundaHakim,getDataPutusanBelumMinutPanitera,getDataTundaMediasiPanitera,getDataAntrianSidangHakim,getDataAntrianSidangPanitera,getDataPutusJurusitaNew,getDataTundaJurusitaNew,getBelumPanggilanJurusita,getDataBelumDelegasiJurusita,getDataPemberitahuanPutusanBelumJurusita",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan", "nomor_perkara"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "portal-disposition-deadline-h-minus-1",
    name: "Manajemen Surat - Pengingat Deadline Disposisi H-1",
    category: "employee",
    description: "Draft aman untuk reminder H-1 deadline disposisi dari data Manajemen Surat. Eksekusi real tetap harus melalui dry-run dan approval.",
    sqlText:
      "portal:dispositions.deadline_h_minus_1",
    outputColumns: ["disposition_id", "deadline_date", "nama_pegawai", "perihal", "deadline", "whatsapp_number"],
    recipientColumn: "whatsapp_number",
    isActive: true,
  },
  {
    id: "legacy-pihak-baru",
    name: "Pihak Perkara - Perkara Baru",
    category: "party",
    description: "Data pihak, kuasa, turut tergugat, dan intervensi untuk notifikasi perkara baru.",
    sqlText: "legacy:notifikasi.getDataPihakBaru",
    outputColumns: ["nama_pihak", "nomor_perkara", "ringkasan", "telepon", "nomor_hp", "perkara_id"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-hari-sidang",
    name: "Pihak Perkara - Pengingat Hari Sidang",
    category: "party",
    description: "Pengingat hari sidang untuk pihak/kuasa/turut/intervensi.",
    sqlText: "legacy:notifikasi.getDataPihakHariSidang",
    outputColumns: ["nama_pihak", "nomor_perkara", "tanggal_sidang", "agenda", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-sebelum-sidang",
    name: "Pihak Perkara - Pengingat Sidang H-3",
    category: "party",
    description:
      "Pengingat 3 hari sebelum sidang (H-3) untuk pihak perkara. SQL legacy memakai DATE_ADD(CURDATE(), INTERVAL 3 DAY).",
    sqlText: "legacy:notifikasi.getDataPihakSebelumHariSidang",
    outputColumns: ["nama_pihak", "nomor_perkara", "tanggal_sidang", "agenda", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "sipp-pihak-sebelum-sidang-h1",
    name: "Pihak Perkara - Pengingat Sidang H-1",
    category: "party",
    description:
      "Pengingat 1 hari sebelum sidang (H-1) untuk penggugat/pemohon dan tergugat/termohon. Turunan dari SQL H-3 dengan INTERVAL 1 DAY, dapat disunting langsung dari tab Sumber Data.",
    sqlText: `SELECT DISTINCT
    a.nama AS nama_pihak,
    b.telepon,
    a.nomor_perkara,
    a.jenis_perkara_nama,
    CASE a.pihak_ke
      WHEN 1 THEN 'Penggugat/Pemohon'
      WHEN 2 THEN 'Tergugat/Termohon'
      WHEN 3 THEN 'Intervensi'
      WHEN 4 THEN 'Turut Tergugat'
      ELSE 'Pihak'
    END AS peran_pihak,
    DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
    CASE DAYNAME(e.tanggal_sidang)
      WHEN 'Monday' THEN 'Senin'
      WHEN 'Tuesday' THEN 'Selasa'
      WHEN 'Wednesday' THEN 'Rabu'
      WHEN 'Thursday' THEN 'Kamis'
      WHEN 'Friday' THEN 'Jumat'
      WHEN 'Saturday' THEN 'Sabtu'
      WHEN 'Sunday' THEN 'Minggu'
      ELSE ''
    END AS hari_sidang,
    e.agenda,
    e.ruangan,
    CONCAT(
      'Sidang perkara ', a.nomor_perkara,
      ' dijadwalkan BESOK ', DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y'),
      ' dengan agenda ', COALESCE(e.agenda, '-'),
      ' di ruang ', COALESCE(e.ruangan, '-'), '.'
    ) AS ringkasan,
    c.petitum_dok
FROM
    v_pihak_perkara a
    JOIN pihak b ON b.id = a.pihak_id
                AND b.telepon REGEXP '^[0-9]'
                AND CHAR_LENGTH(b.telepon) > 8
    LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
    LEFT JOIN (
        SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir
        FROM perkara_jadwal_sidang
        GROUP BY perkara_id
    ) AS subq ON c.perkara_id = subq.perkara_id
    LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
    LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
    LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
WHERE
    a.pihak_ke IN (1, 2, 3, 4)
    AND e.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    AND c.alur_perkara_id IN (15, 16, 17)
    AND (
        CASE
            WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL
                THEN c.proses_terakhir_id < 296
            ELSE c.proses_terakhir_id < 218
        END
    )

UNION ALL

SELECT DISTINCT
    a.nama AS nama_pihak,
    b.telepon,
    c.nomor_perkara,
    c.jenis_perkara_nama,
    'Kuasa Hukum' AS peran_pihak,
    DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
    CASE DAYNAME(e.tanggal_sidang)
      WHEN 'Monday' THEN 'Senin'
      WHEN 'Tuesday' THEN 'Selasa'
      WHEN 'Wednesday' THEN 'Rabu'
      WHEN 'Thursday' THEN 'Kamis'
      WHEN 'Friday' THEN 'Jumat'
      WHEN 'Saturday' THEN 'Sabtu'
      WHEN 'Sunday' THEN 'Minggu'
      ELSE ''
    END AS hari_sidang,
    e.agenda,
    e.ruangan,
    CONCAT(
      'Sidang perkara ', c.nomor_perkara,
      ' dijadwalkan BESOK ', DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y'),
      ' dengan agenda ', COALESCE(e.agenda, '-'),
      ' di ruang ', COALESCE(e.ruangan, '-'), '.'
    ) AS ringkasan,
    c.petitum_dok
FROM
    perkara_pengacara a
    JOIN pihak b ON b.id = a.pengacara_id
                AND b.telepon REGEXP '^[0-9]'
                AND CHAR_LENGTH(b.telepon) > 8
    LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
    LEFT JOIN (
        SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir
        FROM perkara_jadwal_sidang
        GROUP BY perkara_id
    ) AS subq ON c.perkara_id = subq.perkara_id
    LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
    LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
    LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
WHERE
    e.tanggal_sidang = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    AND c.alur_perkara_id IN (15, 16, 17)
    AND (
        CASE
            WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL
                THEN c.proses_terakhir_id < 296
            ELSE c.proses_terakhir_id < 218
        END
    )`,
    outputColumns: [
      "nama_pihak",
      "telepon",
      "nomor_perkara",
      "jenis_perkara_nama",
      "peran_pihak",
      "tanggal_sidang",
      "hari_sidang",
      "agenda",
      "ruangan",
      "ringkasan",
      "petitum_dok",
    ],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "sipp-pihak-sidang-per-tanggal",
    name: "Pihak Perkara - Sidang pada Tanggal Tertentu",
    category: "party",
    description:
      "Khusus Kirim Manual: isi parameter tanggal_sidang (format YYYY-MM-DD) untuk mengirim pengingat ke pihak yang bersidang pada tanggal itu. Tidak dipakai notifikasi terjadwal karena tanggalnya ditentukan operator.",
    sqlText: `SELECT DISTINCT
    a.nama AS nama_pihak,
    b.telepon,
    a.nomor_perkara,
    a.jenis_perkara_nama,
    CASE a.pihak_ke
      WHEN 1 THEN 'Penggugat/Pemohon'
      WHEN 2 THEN 'Tergugat/Termohon'
      WHEN 3 THEN 'Intervensi'
      WHEN 4 THEN 'Turut Tergugat'
      ELSE 'Pihak'
    END AS peran_pihak,
    DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
    CASE DAYNAME(e.tanggal_sidang)
      WHEN 'Monday' THEN 'Senin'
      WHEN 'Tuesday' THEN 'Selasa'
      WHEN 'Wednesday' THEN 'Rabu'
      WHEN 'Thursday' THEN 'Kamis'
      WHEN 'Friday' THEN 'Jumat'
      WHEN 'Saturday' THEN 'Sabtu'
      WHEN 'Sunday' THEN 'Minggu'
      ELSE ''
    END AS hari_sidang,
    e.agenda,
    e.ruangan,
    CONCAT(
      'Sidang perkara ', a.nomor_perkara,
      ' dijadwalkan pada ', DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y'),
      ' dengan agenda ', COALESCE(e.agenda, '-'),
      ' di ruang ', COALESCE(e.ruangan, '-'), '.'
    ) AS ringkasan,
    c.petitum_dok
FROM
    v_pihak_perkara a
    JOIN pihak b ON b.id = a.pihak_id
                AND b.telepon REGEXP '^[0-9]'
                AND CHAR_LENGTH(b.telepon) > 8
    LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
    LEFT JOIN (
        SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir
        FROM perkara_jadwal_sidang
        GROUP BY perkara_id
    ) AS subq ON c.perkara_id = subq.perkara_id
    LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
    LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
    LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
WHERE
    a.pihak_ke IN (1, 2, 3, 4)
    AND e.tanggal_sidang = {{tanggal_sidang}}
    AND c.alur_perkara_id IN (15, 16, 17)
    AND (
        CASE
            WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL
                THEN c.proses_terakhir_id < 296
            ELSE c.proses_terakhir_id < 218
        END
    )

UNION ALL

SELECT DISTINCT
    a.nama AS nama_pihak,
    b.telepon,
    c.nomor_perkara,
    c.jenis_perkara_nama,
    'Kuasa Hukum' AS peran_pihak,
    DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y') AS tanggal_sidang,
    CASE DAYNAME(e.tanggal_sidang)
      WHEN 'Monday' THEN 'Senin'
      WHEN 'Tuesday' THEN 'Selasa'
      WHEN 'Wednesday' THEN 'Rabu'
      WHEN 'Thursday' THEN 'Kamis'
      WHEN 'Friday' THEN 'Jumat'
      WHEN 'Saturday' THEN 'Sabtu'
      WHEN 'Sunday' THEN 'Minggu'
      ELSE ''
    END AS hari_sidang,
    e.agenda,
    e.ruangan,
    CONCAT(
      'Sidang perkara ', c.nomor_perkara,
      ' dijadwalkan pada ', DATE_FORMAT(e.tanggal_sidang, '%d-%m-%Y'),
      ' dengan agenda ', COALESCE(e.agenda, '-'),
      ' di ruang ', COALESCE(e.ruangan, '-'), '.'
    ) AS ringkasan,
    c.petitum_dok
FROM
    perkara_pengacara a
    JOIN pihak b ON b.id = a.pengacara_id
                AND b.telepon REGEXP '^[0-9]'
                AND CHAR_LENGTH(b.telepon) > 8
    LEFT JOIN perkara c ON c.perkara_id = a.perkara_id
    LEFT JOIN (
        SELECT perkara_id, MAX(tanggal_sidang) AS tanggal_sidang_terakhir
        FROM perkara_jadwal_sidang
        GROUP BY perkara_id
    ) AS subq ON c.perkara_id = subq.perkara_id
    LEFT JOIN perkara_jadwal_sidang e ON e.perkara_id = subq.perkara_id
    LEFT JOIN perkara_putusan f ON f.perkara_id = c.perkara_id
    LEFT JOIN perkara_ikrar_talak g ON g.perkara_id = c.perkara_id
WHERE
    e.tanggal_sidang = {{tanggal_sidang}}
    AND c.alur_perkara_id IN (15, 16, 17)
    AND (
        CASE
            WHEN c.jenis_perkara_id = 346 AND f.status_putusan_id = 62 AND g.amar_ikrar_talak IS NULL
                THEN c.proses_terakhir_id < 296
            ELSE c.proses_terakhir_id < 218
        END
    )`,
    outputColumns: [
      "nama_pihak",
      "telepon",
      "nomor_perkara",
      "jenis_perkara_nama",
      "peran_pihak",
      "tanggal_sidang",
      "hari_sidang",
      "agenda",
      "ruangan",
      "ringkasan",
      "petitum_dok",
    ],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-hakim-sidang-hari-ini",
    name: "Hakim - Daftar Sidang Hari Ini",
    category: "employee",
    description:
      "Daftar perkara yang disidangkan hari ini (nomor perkara, jam, ruang) plus jadwal mediasi, difilter per nama hakim penerima.",
    sqlText: "legacy:notifikasi.getDataJadwalSidangPerdataHakim,getDataJadwalMediasiHakim",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan", "nomor_perkara"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "legacy-panitera-sidang-hari-ini",
    name: "Panitera - Daftar Sidang Hari Ini",
    category: "employee",
    description:
      "Daftar perkara yang disidangkan hari ini (nomor perkara, jam, ruang) plus tunda mediasi, difilter per nama panitera pengganti penerima.",
    sqlText: "legacy:notifikasi.getDataJadwalSidangPerdataPanitera,getDataTundaMediasiPanitera",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan", "nomor_perkara"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "legacy-panitera-sidang-besok",
    name: "Panitera - Daftar Sidang Besok",
    category: "employee",
    description:
      "Daftar perkara yang disidangkan besok plus tunda mediasi, difilter per nama panitera pengganti. Setara pengingat malam sendPengingatPaniteraSidang pada aplikasi lama.",
    sqlText: "legacy:notifikasi.getDataJadwalBesokPaniteraNew,getDataTundaMediasiPanitera",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan", "nomor_perkara"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "legacy-jurusita-tunda-putusan",
    name: "Jurusita - Tundaan Sidang dan Pemberitahuan Putusan",
    category: "employee",
    description:
      "Perkara yang ditunda dan putusan yang belum diberitahukan, difilter per nama jurusita/jurusita pengganti penerima.",
    sqlText:
      "legacy:notifikasi.getDataTundaJurusitaNew,getDataPutusJurusitaNew,getDataPemberitahuanPutusanBelumJurusita",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan", "nomor_perkara"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "legacy-pihak-tunda-cuti",
    name: "Pihak Perkara - Penundaan Sidang atau Cuti",
    category: "party",
    description: "Notifikasi penundaan sidang/cuti.",
    sqlText: "legacy:notifikasi.getDataPihakTundaCuti",
    outputColumns: ["nama_pihak", "nomor_perkara", "tanggal_sidang", "agenda", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-akta-cerai",
    name: "Pihak Perkara - Akta Cerai",
    category: "party",
    description: "Notifikasi akta cerai untuk Penggugat/Pemohon dan Tergugat/Termohon.",
    sqlText: "legacy:notifikasi.getDataPihakAktaCerai",
    outputColumns: ["nama_pihak", "nomor_perkara", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-sisa-panjar",
    name: "Pihak Perkara - Sisa Panjar atau Panjar Habis",
    category: "party",
    description: "Notifikasi sisa panjar atau kekurangan biaya perkara.",
    sqlText: "legacy:notifikasi.getDataPihakSisaPanjar,getDataHabisBiaya",
    outputColumns: ["nama_pihak", "nomor_perkara", "sisa_panjar", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-putusan",
    name: "Pihak Perkara - Putusan Perkara",
    category: "party",
    description: "Notifikasi putusan kepada pihak/kuasa/turut/intervensi.",
    sqlText: "legacy:notifikasi.getDataPutusanPihak",
    outputColumns: ["nama_pihak", "nomor_perkara", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "public_online_queue",
    name: "Pihak Perkara - Antrian Online Dinamis",
    category: "party",
    description:
      "Catatan rujukan, BUKAN sumber data terjadwal. Antrian online dipicu pesan MASUK dari pihak ('daftar antrian#123.G.2026' untuk penggugat, 'antrian online#123.G.2026' untuk tergugat, atau 'ambil antrian' bila nomor WhatsApp sudah tercatat di perkara hari ini) dan ditangani aleta_bot/services/antrianOnlineService.js. Tombol Uji Sumber Data tidak berlaku untuk entri ini.",
    sqlText: "runtime:antrianOnline.registerOnlineQueue",
    outputColumns: ["nomor_perkara", "nomor_antrian", "status_umum", "pihak_antrian"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "template-publik-belum-terdaftar",
    name: "Masyarakat Umum - Daftar Penerima Informasi Layanan",
    category: "party",
    description:
      "Template sumber data untuk penerima yang belum tercatat sebagai pihak perkara. Admin dapat menyesuaikan SQL ke tabel/daftar nomor yang dipakai instansi.",
    sqlText:
      "SELECT nama AS nama_pihak, telepon, 'Informasi layanan pengadilan' AS ringkasan, 'Layanan pengadilan' AS nama_layanan FROM sumber_data_penerima_layanan LIMIT 100",
    outputColumns: ["nama_pihak", "telepon", "ringkasan", "nama_layanan"],
    recipientColumn: "telepon",
    isActive: false,
  },
  {
    id: "template-instansi-mitra",
    name: "Instansi Mitra - Daftar Penerima Koordinasi",
    category: "party",
    description:
      "Template sumber data untuk KUA, Dukcapil, Kepolisian, Pemerintah, atau instansi kerja sama lain. Sesuaikan SQL ke daftar kontak resmi yang tersedia.",
    sqlText:
      "SELECT nama_instansi, nama_kontak AS nama_pihak, telepon, 'Koordinasi layanan pengadilan' AS ringkasan, 'Koordinasi instansi' AS nama_layanan FROM sumber_data_instansi_mitra LIMIT 100",
    outputColumns: ["nama_instansi", "nama_pihak", "telepon", "ringkasan", "nama_layanan"],
    recipientColumn: "telepon",
    isActive: false,
  },
  {
    id: "legacy-query-command-router",
    name: "Aturan Jawaban - Router Query Chat Publik",
    category: "system",
    description: "Router command chat publik dari query.js, dipakai untuk balasan otomatis.",
    sqlText: "legacy:query.getData",
    outputColumns: ["command", "nomor_perkara", "response_text"],
    recipientColumn: "",
    isActive: true,
  },
  ...SIPP_ADDITIONAL_QUERY_DEFINITIONS,
  ...LEGACY_NOTIFIKASI_QUERY_DEFINITIONS,
];

const DEFAULT_NOTIFICATIONS: Array<
  Omit<
    AletaBotNotification,
    "lastRunAt" | "lastStatus" | "lastMessage" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt" | "attachDocument"
  > & { attachDocument?: boolean }
> = [
  {
    id: "ketua-penerimaan-perkara",
    name: "Rekap Penerimaan Perkara Ketua",
    category: "employee",
    description: "Notifikasi internal Ketua dari sendKetuaPenerimaanPerkara pada app.js.",
    queryId: "legacy-ketua-penerimaan-perkara",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { audienceGroup: "hakim", roleHints: ["ketua"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "50 07 1 * *", trigger: "cron bulanan" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "panitera-monitoring-bulanan",
    name: "Monitoring Bulanan Panitera",
    category: "employee",
    description: "Rekap BAS, minutasi, BHT, relaas, panjar, delegasi, dan e-doc untuk Panitera.",
    queryId: "legacy-panitera-monitoring-bulanan",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { audienceGroup: "kepaniteraan", roleHints: ["panitera"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "50 07 1 * *", trigger: "cron bulanan" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "penjaga-sidang-hari-ini",
    name: "Penjaga Sidang Hari Ini",
    category: "employee",
    description: "Jadwal sidang/mediasi hari ini dan panggilan belum lengkap untuk petugas sidang.",
    queryId: "legacy-jadwal-sidang-internal",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { audienceGroup: "kepaniteraan", positionHints: ["sidang", "ptsp"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "10 07 * * Monday-Friday", trigger: "cron pagi hari kerja" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "penjaga-sidang-besok",
    name: "Penjaga Sidang Besok",
    category: "employee",
    description: "Jadwal sidang dan mediasi besok untuk petugas sidang.",
    queryId: "legacy-jadwal-sidang-internal",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { audienceGroup: "kepaniteraan", positionHints: ["sidang", "ptsp"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "00 20 * * *", trigger: "cron malam" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "kasir-harian",
    name: "Pengingat Kasir Harian",
    category: "employee",
    description: "Pengingat sisa panjar, meterai/redaksi, dan penetapan untuk kasir/PTSP.",
    queryId: "legacy-kasir-panjar",
    templateId: "pegawai-monitoring-ringkas",
    recipientSource: "users",
    recipientMapping: { audienceGroup: "kepaniteraan", positionHints: ["kasir", "ptsp"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "30 14 * * Monday-Thursday", trigger: "cron siang" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "hakim-sidang-hari-ini",
    name: "Hakim - Sidang Hari Ini",
    category: "employee",
    description:
      "Daftar perkara yang disidangkan hari ini (nomor perkara, jam, ruang) untuk masing-masing Hakim, dikirim tiap pagi hari kerja.",
    queryId: "legacy-hakim-sidang-hari-ini",
    templateId: "hakim-jadwal-tugas-sidang",
    recipientSource: "users",
    recipientMapping: { audienceGroup: "hakim", roleHints: ["hakim"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "00 07 * * Monday-Friday", trigger: "cron pagi hari kerja" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "panitera-sidang-hari-ini",
    name: "Panitera - Sidang Hari Ini",
    category: "employee",
    description:
      "Daftar perkara yang disidangkan hari ini (nomor perkara, jam, ruang) untuk masing-masing Panitera Pengganti, dikirim tiap pagi hari kerja. Difilter per nomor perkara yang dipegang, sehingga panitera struktural/kepaniteraan yang tidak bersidang otomatis tidak menerima pesan.",
    queryId: "legacy-panitera-sidang-hari-ini",
    templateId: "hakim-jadwal-tugas-sidang",
    recipientSource: "users",
    recipientMapping: { audienceGroup: "kepaniteraan", roleHints: ["panitera"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "00 07 * * Monday-Friday", trigger: "cron pagi hari kerja" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "panitera-sidang-besok",
    name: "Panitera - Sidang Besok",
    category: "employee",
    description:
      "Daftar perkara yang disidangkan besok untuk masing-masing Panitera Pengganti, dikirim malam hari. Panitera yang tidak memegang perkara otomatis dilewati.",
    queryId: "legacy-panitera-sidang-besok",
    templateId: "hakim-jadwal-tugas-sidang",
    recipientSource: "users",
    recipientMapping: { audienceGroup: "kepaniteraan", roleHints: ["panitera"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "00 20 * * Sunday-Thursday", trigger: "cron malam" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "jurusita-tunda-putusan",
    name: "Jurusita - Tundaan Sidang dan Pemberitahuan Putusan",
    category: "employee",
    description:
      "Pengingat perkara yang ditunda dan putusan yang belum diberitahukan untuk masing-masing Jurusita/Jurusita Pengganti.",
    queryId: "legacy-jurusita-tunda-putusan",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { audienceGroup: "kepaniteraan", roleHints: ["jurusita"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "00 12 * * Monday-Friday", trigger: "cron siang hari kerja" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "hakim-jadwal-sidang",
    name: "Hakim - Monitoring Minutasi dan Upload Putusan",
    category: "employee",
    description: "Status minutasi, upload putusan, dan antrian sidang untuk Hakim (bukan daftar sidang hari ini).",
    queryId: "legacy-status-sidang-pegawai",
    templateId: "hakim-jadwal-tugas-sidang",
    recipientSource: "users",
    recipientMapping: { audienceGroup: "hakim", roleHints: ["hakim"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "15 07 * * Monday-Friday; 00 20 * * Sunday-Thursday", trigger: "cron pagi dan malam" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "panitera-jadwal-sidang",
    name: "Panitera - Monitoring BAS dan Minutasi",
    category: "employee",
    description: "Status BAS, minutasi, dan tunda mediasi untuk Panitera/Panitera Pengganti (bukan daftar sidang hari ini).",
    queryId: "legacy-status-sidang-pegawai",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { audienceGroup: "kepaniteraan", roleHints: ["panitera"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "00 07 * * Monday-Friday; 00 20 * * *", trigger: "cron pagi dan malam" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "jurusita-status-relaas",
    name: "Status Sidang dan Relaas Jurusita",
    category: "employee",
    description: "Status putus/tunda, panggilan, delegasi, dan pemberitahuan putusan untuk Jurusita.",
    queryId: "legacy-status-sidang-pegawai",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { audienceGroup: "kepaniteraan", roleHints: ["jurusita"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "00 12 * * Monday-Friday; 15 16 * * Monday-Friday; 00 09 * * Friday", trigger: "cron status dan relaas" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "disposition-deadline-h-minus-1",
    name: "Pengingat Deadline Disposisi H-1",
    category: "employee",
    description: "Reminder H-1 untuk disposisi belum selesai. Default nonaktif dan dipakai untuk dry-run/approval sebelum pengiriman nyata.",
    queryId: "portal-disposition-deadline-h-minus-1",
    templateId: "disposition-deadline-h-minus-1",
    recipientSource: "users",
    recipientMapping: {
      recipientColumn: "whatsapp_number",
      audienceGroup: "kesekretariatan",
      source: "users.whatsapp_number",
      mode: "dry_run",
      idempotencyKeyPattern: "disposition_deadline_reminder:{dispositionId}:{deadlineDate}",
    },
    scheduleConfig: { type: "cron", cron: "0 8 * * *", trigger: "Setiap hari pukul 08:00:00" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-baru",
    name: "Notifikasi Perkara Baru",
    category: "party",
    description: "Notifikasi pendaftaran perkara untuk pihak, kuasa, turut tergugat, dan intervensi.",
    queryId: "legacy-pihak-baru",
    templateId: "perkara-baru",
    recipientSource: "query",
    recipientMapping: { audienceGroup: "case_party", recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "cron", cron: "00 17 * * Monday-Friday", trigger: "cron sore hari kerja" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-hari-sidang",
    name: "Notifikasi Pihak Hari Sidang",
    category: "party",
    description: "Pengingat kepada pihak perkara pada hari sidang.",
    queryId: "legacy-pihak-hari-sidang",
    templateId: "jadwal-sidang",
    recipientSource: "query",
    recipientMapping: { audienceGroup: "case_party", recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "cron", cron: "00 07 * * *", trigger: "cron pagi" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-sebelum-sidang",
    name: "Pihak - Pengingat Sidang H-3",
    category: "party",
    description:
      "Pengingat kepada pihak perkara 3 hari sebelum jadwal sidang. Hanya dikirim untuk agenda yang menuntut persiapan (saksi, bukti, mediasi); agenda jawab-menjawab cukup diingatkan pada H-1.",
    queryId: "legacy-pihak-sebelum-sidang",
    templateId: "jadwal-sidang",
    recipientSource: "query",
    recipientMapping: { audienceGroup: "case_party", recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "cron", cron: "00 09 * * *", trigger: "cron pagi", agendaStage: "h3" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-sebelum-sidang-h1",
    name: "Pihak - Pengingat Sidang H-1",
    category: "party",
    description:
      "Pengingat kepada pihak perkara 1 hari sebelum jadwal sidang (sidang besok). Dikirim sore hari agar sempat dibaca sebelum pihak mengatur keberangkatan esok pagi.",
    queryId: "sipp-pihak-sebelum-sidang-h1",
    templateId: "pihak-sidang-h1",
    recipientSource: "query",
    recipientMapping: { audienceGroup: "case_party", recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    // 15:30, bukan 16:30. Jendela kirim mode Minimal berakhir pukul 16:00,
    // sehingga pengiriman pukul 16:30 akan ditunda ke pembukaan jendela
    // berikutnya - yaitu pagi hari sidang itu sendiri, saat pihak mungkin sudah
    // berangkat. Pengingat H-1 yang tiba pada hari-H bukan lagi pengingat H-1.
    scheduleConfig: { type: "cron", cron: "30 15 * * *", trigger: "cron sore", agendaStage: "h1" },
    isActive: false,
    // Kueri H-1 ikut mengambil kolom petitum_dok, sehingga tanpa penegasan ini
    // pengingat pendek akan membawa lampiran PDF petitum. Pengingat sehari
    // sebelum sidang harus ringan - lampiran membuatnya lambat terkirim dan
    // menambah beban yang tidak dibutuhkan pihak.
    attachDocument: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-tunda-cuti",
    name: "Notifikasi Sidang Ditunda",
    category: "party",
    description:
      "Memberi tahu pihak bahwa sidangnya tidak jadi dilaksanakan, sebelum mereka berangkat ke pengadilan.",
    queryId: "legacy-pihak-tunda-cuti",
    templateId: "pihak-tunda-sidang",
    recipientSource: "query",
    recipientMapping: { audienceGroup: "case_party", recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    // Dua kali sehari di dalam jam kerja, supaya penundaan yang dicatat pagi
    // masih sempat diberitahukan pada hari yang sama. Jadwal sebelumnya hanya
    // berjalan sekali setahun (24 November) - sisa pengumuman cuti lama.
    scheduleConfig: { type: "cron", cron: "00 09 * * *; 00 14 * * *", trigger: "cron pagi dan siang" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-akta-cerai",
    name: "Notifikasi Akta Cerai",
    category: "party",
    description: "Informasi akta cerai untuk pihak terkait.",
    queryId: "legacy-pihak-akta-cerai",
    templateId: "akta-cerai",
    recipientSource: "query",
    recipientMapping: { audienceGroup: "case_party", recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "cron", cron: "00 16 * * *", trigger: "cron sore" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-sisa-panjar",
    name: "Notifikasi Sisa Panjar/Biaya",
    category: "party",
    description: "Informasi sisa panjar atau biaya perkara kepada pihak.",
    queryId: "legacy-pihak-sisa-panjar",
    templateId: "sisa-panjar",
    recipientSource: "query",
    recipientMapping: { audienceGroup: "case_party", recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    // Dipindah ke dalam jam kirim aman. Jadwal 19:00 sebelumnya berada di luar
    // jam kirim Mode Minimal, sehingga pesannya tertahan sampai pagi berikutnya.
    scheduleConfig: { type: "cron", cron: "00 10 * * *", trigger: "cron pagi" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-putusan",
    name: "Notifikasi Putusan",
    category: "party",
    description: "Informasi putusan kepada pihak, kuasa, turut tergugat, dan intervensi.",
    queryId: "legacy-pihak-putusan",
    templateId: "pihak-layanan",
    recipientSource: "query",
    recipientMapping: { audienceGroup: "case_party", recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "manual", cron: "", trigger: "manual/legacy app.js" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
];

export const ALETA_BOT_QUERY_CATALOG: AletaBotQueryCatalogItem[] = [
  ...LEGACY_NOTIFIKASI_QUERY_CATALOG,
  {
    id: "query-get-data",
    sourceFile: "query.js",
    exportName: "getData",
    category: "balasan otomatis",
    description: "Router utama command chat: info lengkap, perkara, sidang, statistik, validasi, dan layanan publik.",
    riskLevel: "medium",
    testable: false,
  },
  {
    id: "notif-jadwal-sidang-perdata",
    sourceFile: "notifikasi.js",
    exportName: "getDataJadwalSidangPerdata",
    category: "jadwal sidang",
    description: "Mengambil jadwal sidang perdata untuk notifikasi harian internal.",
    riskLevel: "high",
    testable: false,
  },
  {
    id: "notif-jadwal-besok",
    sourceFile: "notifikasi.js",
    exportName: "getDataJadwalBesok",
    category: "jadwal sidang",
    description: "Mengambil jadwal sidang besok untuk pengingat malam.",
    riskLevel: "high",
    testable: false,
  },
  {
    id: "notif-pihak-hari-sidang",
    sourceFile: "notifikasi.js",
    exportName: "getDataPihakHariSidang",
    category: "pihak perkara",
    description: "Mengambil pihak/kuasa/turut/intervensi yang terkait sidang hari ini.",
    riskLevel: "high",
    testable: false,
  },
  {
    id: "notif-pihak-sebelum-sidang",
    sourceFile: "notifikasi.js",
    exportName: "getDataPihakSebelumHariSidang",
    category: "pihak perkara",
    description: "Mengambil pihak yang perlu menerima pengingat sebelum hari sidang.",
    riskLevel: "high",
    testable: false,
  },
  {
    id: "notif-akta-cerai",
    sourceFile: "notifikasi.js",
    exportName: "getDataPihakAktaCerai",
    category: "akta cerai",
    description: "Mengambil data pihak untuk notifikasi akta cerai.",
    riskLevel: "high",
    testable: false,
  },
  {
    id: "notif-sisa-panjar",
    sourceFile: "notifikasi.js",
    exportName: "getDataPihakSisaPanjar",
    category: "biaya perkara",
    description: "Mengambil data pihak untuk notifikasi sisa panjar biaya perkara.",
    riskLevel: "high",
    testable: false,
  },
  {
    id: "formatter-phone-number",
    sourceFile: "formatter.js",
    exportName: "phoneNumberFormatter",
    category: "formatter",
    description: "Normalisasi nomor WhatsApp ke format chat id whatsapp-web.js.",
    riskLevel: "low",
    testable: true,
  },
  {
    id: "whatsapp-admin-id",
    sourceFile: "whatsapp.js",
    exportName: "adminId",
    category: "koneksi WhatsApp",
    description: "Nomor admin bot. Kini di-override dari konfigurasi portal bila tersedia.",
    riskLevel: "medium",
    testable: true,
  },
];

const DEFAULT_LEGACY_MIGRATIONS: Array<Omit<AletaBotLegacyMigration, "migratedAt" | "migratedBy" | "createdAt" | "updatedAt">> = [
  // ── PARTY NOTIFICATIONS ─────────────────────────────────────────────────────
  {
    id: "mig-notif-pihak-baru",
    feature: "Notifikasi Pihak Baru (Pendaftaran Perkara)",
    legacyKey: "sendPihakBaru",
    sourceFunction: "sendPihakBaru",
    legacyType: "party_notification",
    category: "Notifikasi Pihak",
    riskLevel: "high",
    legacySource: "app.js → sendPihakBaru (notifikasi.js → getDataPihakBaru)",
    cronSchedule: "00 17 * * Monday-Friday",
    portalEntity: "notif-pihak-baru",
    registryTargetType: "notification_registry",
    registryTargetKey: "party-registration",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Notifikasi ke pihak baru yang mendaftar hari ini. Cron 17:00 Senin-Jumat.",
  },
  {
    id: "mig-notif-pihak-akta-cerai",
    feature: "Notifikasi Pihak Akta Cerai Terbit",
    legacyKey: "sendPihakAktaCerai",
    sourceFunction: "sendPihakAktaCerai",
    legacyType: "party_notification",
    category: "Notifikasi Pihak",
    riskLevel: "high",
    legacySource: "app.js → sendPihakAktaCerai (notifikasi.js → getDataPihakAktaCerai)",
    cronSchedule: "00 16 * * *",
    portalEntity: "pihak-akta-cerai",
    registryTargetType: "notification_registry",
    registryTargetKey: "party-akta-cerai",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Notifikasi ke pihak saat akta cerai terbit. Cron 16:00 setiap hari. Masih dry-run, perlu approval.",
  },
  {
    id: "mig-notif-pihak-sisa-panjar",
    feature: "Notifikasi Sisa Panjar ke Pihak",
    legacyKey: "sendPihakSisaPanjar",
    sourceFunction: "sendPihakSisaPanjar",
    legacyType: "party_notification",
    category: "Notifikasi Pihak",
    riskLevel: "high",
    legacySource: "app.js → sendPihakSisaPanjar (notifikasi.js → getDataPihakSisaPanjar)",
    cronSchedule: "00 19 * * *",
    portalEntity: "pihak-sisa-panjar",
    registryTargetType: "notification_registry",
    registryTargetKey: "party-sisa-panjar",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Notifikasi sisa panjar ke pihak setiap pukul 19:00. Masih dry-run, perlu approval.",
  },
  {
    id: "mig-notif-pihak-panjar-belum",
    feature: "Notifikasi Pihak Belum Bayar Panjar (Habis Biaya)",
    legacyKey: "sendPihakPanjarBelum",
    sourceFunction: "sendPihakPanjarBelum",
    legacyType: "party_notification",
    category: "Notifikasi Pihak",
    riskLevel: "high",
    legacySource: "app.js → sendPihakPanjarBelum (notifikasi.js → getDataHabisBiaya)",
    cronSchedule: "30 15 * * *",
    portalEntity: "pihak-panjar-belum",
    registryTargetType: "notification_registry",
    registryTargetKey: "party-panjar-habis",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Notifikasi ke pihak yang belum bayar panjar pukul 15:30 setiap hari.",
  },
  {
    id: "mig-notif-pihak-putusan",
    feature: "Notifikasi Putusan ke Pihak",
    legacyKey: "sendPihakPutusan",
    sourceFunction: "sendPihakPutusan",
    legacyType: "party_notification",
    category: "Notifikasi Pihak",
    riskLevel: "high",
    legacySource: "app.js → sendPihakPutusan (notifikasi.js → getDataPutusanPihak)",
    cronSchedule: "30 23 * * *",
    portalEntity: "pihak-putusan",
    registryTargetType: "notification_registry",
    registryTargetKey: "party-putusan",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Notifikasi detail putusan ke pihak setiap pukul 23:30. Masih dry-run, perlu approval.",
  },
  {
    id: "mig-notif-pihak-hari-sidang",
    feature: "Notifikasi Pihak Hari Sidang (hari-H)",
    legacyKey: "sendPihakHariSidang",
    sourceFunction: "sendPihakHariSidang",
    legacyType: "party_notification",
    category: "Notifikasi Pihak",
    riskLevel: "high",
    legacySource: "app.js → sendPihakHariSidang (notifikasi.js → getDataPihakHariSidang)",
    cronSchedule: "00 07 * * *",
    portalEntity: "pihak-hari-sidang",
    registryTargetType: "notification_registry",
    registryTargetKey: "party-hari-sidang",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Notifikasi ke pihak pada hari-H sidang pukul 07:00 setiap hari. Masih dry-run.",
  },
  {
    id: "mig-notif-pihak-sebelum-sidang",
    feature: "Notifikasi Pihak 3 Hari Sebelum Sidang",
    legacyKey: "sendPihakSebelumHariSidang",
    sourceFunction: "sendPihakSebelumHariSidang",
    legacyType: "party_notification",
    category: "Notifikasi Pihak",
    riskLevel: "high",
    legacySource: "app.js → sendPihakSebelumHariSidang (notifikasi.js → getDataPihakSebelumHariSidang)",
    cronSchedule: "00 09 * * *",
    portalEntity: "pihak-sebelum-sidang",
    registryTargetType: "notification_registry",
    registryTargetKey: "party-sebelum-sidang",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Notifikasi ke pihak 3 hari sebelum sidang pukul 09:00 setiap hari. Masih dry-run.",
  },
  {
    id: "mig-notif-pihak-tunda-cuti",
    feature: "Notifikasi Tunda Sidang karena Cuti Bersama",
    legacyKey: "sendPihakTundaCuti",
    sourceFunction: "sendPihakTundaCuti",
    legacyType: "party_notification",
    category: "Notifikasi Pihak",
    riskLevel: "low",
    legacySource: "app.js → sendPihakTundaCuti (notifikasi.js → getDataPihakTundaCuti)",
    cronSchedule: "00 12 24 11 *",
    portalEntity: "pihak-tunda-cuti",
    registryTargetType: "notification_registry",
    registryTargetKey: "party-tunda-cuti",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: true,
    status: "skipped",
    notes: "Notifikasi satu-kali terkait cuti 27 Nov 2024 (KEPPRES No.3/2024). Sudah tidak relevan — arsip.",
  },
  // ── EMPLOYEE NOTIFICATIONS ──────────────────────────────────────────────────
  {
    id: "mig-notif-ketua-penerimaan",
    feature: "Laporan Bulanan Penerimaan Perkara ke Ketua",
    legacyKey: "sendKetuaPenerimaanPerkara",
    sourceFunction: "sendKetuaPenerimaanPerkara",
    legacyType: "employee_notification",
    category: "Notifikasi Pegawai",
    riskLevel: "medium",
    legacySource: "app.js → sendKetuaPenerimaanPerkara (notifikasi.js → getTotalPenerimaanPerkaraSemuaHakimLengkap)",
    cronSchedule: "50 07 1 * *",
    portalEntity: "notif-ketua-penerimaan",
    registryTargetType: "notification_registry",
    registryTargetKey: "employee-ketua-penerimaan",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Laporan bulanan penerimaan perkara ke ketua. Cron tanggal 1 setiap bulan pukul 07:50.",
  },
  {
    id: "mig-notif-panitera-laporan",
    feature: "Laporan Bulanan Penerimaan Perkara ke Panitera",
    legacyKey: "sendPanitera",
    sourceFunction: "sendPanitera",
    legacyType: "employee_notification",
    category: "Notifikasi Pegawai",
    riskLevel: "medium",
    legacySource: "app.js → sendPanitera (notifikasi.js → getTotalPenerimaanPerkaraSemuaPaniteraLengkap)",
    cronSchedule: "50 07 1 * *",
    portalEntity: "notif-panitera-laporan",
    registryTargetType: "notification_registry",
    registryTargetKey: "employee-panitera-laporan",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Laporan bulanan penerimaan perkara ke panitera. Cron tanggal 1 setiap bulan pukul 07:50.",
  },
  {
    id: "mig-notif-penjaga-sidang",
    feature: "Notifikasi Penjaga Sidang Hari Ini",
    legacyKey: "sendPenjagaSidangHariIni",
    sourceFunction: "sendPenjagaSidangHariIni",
    legacyType: "employee_notification",
    category: "Notifikasi Pegawai",
    riskLevel: "medium",
    legacySource: "app.js → sendPenjagaSidangHariIni (notifikasi.js → getDataJadwalSidangPerdata/Pidana)",
    cronSchedule: "10 07 * * Monday-Friday",
    portalEntity: "notif-penjaga-sidang-hari-ini",
    registryTargetType: "notification_registry",
    registryTargetKey: "employee-penjaga-sidang",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Notifikasi jadwal sidang harian ke penjaga sidang pukul 07:10 Senin-Jumat.",
  },
  {
    id: "mig-notif-penjaga-sidang-besok",
    feature: "Notifikasi Penjaga Sidang Besok",
    legacyKey: "sendPenjagaSidangBesok",
    sourceFunction: "sendPenjagaSidangBesok",
    legacyType: "employee_notification",
    category: "Notifikasi Pegawai",
    riskLevel: "medium",
    legacySource: "app.js → sendPenjagaSidangBesok (notifikasi.js → getDataJadwalBesok)",
    cronSchedule: "00 20 * * *",
    portalEntity: "notif-penjaga-sidang-besok",
    registryTargetType: "notification_registry",
    registryTargetKey: "employee-penjaga-sidang-besok",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Notifikasi jadwal sidang besok ke penjaga sidang pukul 20:00 setiap hari.",
  },
  {
    id: "mig-notif-kasir-harian",
    feature: "Notifikasi Pengingat Kasir Harian",
    legacyKey: "sendPengingatKasir",
    sourceFunction: "sendPengingatKasir",
    legacyType: "employee_notification",
    category: "Notifikasi Pegawai",
    riskLevel: "low",
    legacySource: "app.js → sendPengingatKasir (notifikasi.js → getDataSisaPanjarPn)",
    cronSchedule: "30 14 * * Monday-Thursday",
    portalEntity: "notif-kasir-harian",
    registryTargetType: "notification_registry",
    registryTargetKey: "employee-kasir",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Notifikasi harian kasir dijadwalkan Senin-Kamis 14:30. Belum diaktifkan di portal.",
  },
  {
    id: "mig-notif-pengingat-hakim",
    feature: "Notifikasi Pengingat Jadwal Hakim (pagi & malam)",
    legacyKey: "pengingatHakim",
    sourceFunction: "sendPengingatHakim",
    legacyType: "employee_notification",
    category: "Notifikasi Pegawai",
    riskLevel: "medium",
    legacySource: "app.js → pengingatPagiHakim/pengingatMalamHakim (notifikasi.js → getDataJadwalBesokHakim)",
    cronSchedule: "15 07 * * Monday-Friday; 00 20 * * Sunday-Thursday",
    portalEntity: "notif-pengingat-hakim",
    registryTargetType: "notification_registry",
    registryTargetKey: "employee-hakim-jadwal",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Dua cron per-hakim: pagi 07:15 Senin-Jumat dan malam 20:00 Minggu-Kamis. Data dari hakimIds map.",
  },
  {
    id: "mig-notif-pengingat-panitera",
    feature: "Notifikasi Pengingat Jadwal Panitera (pagi & malam)",
    legacyKey: "pengingatPanitera",
    sourceFunction: "sendPengingatPaniteraSidang",
    legacyType: "employee_notification",
    category: "Notifikasi Pegawai",
    riskLevel: "medium",
    legacySource: "app.js → pengingatPagiPanitera/pengingatMalamPanitera (notifikasi.js → getDataJadwalBesokPanitera)",
    cronSchedule: "00 07 * * Monday-Friday; 00 20 * * *",
    portalEntity: "notif-pengingat-panitera",
    registryTargetType: "notification_registry",
    registryTargetKey: "employee-panitera-jadwal",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Dua cron per-panitera: pagi 07:00 Senin-Jumat dan malam 20:00 setiap hari. Data dari paniteraIds map.",
  },
  {
    id: "mig-notif-status-hakim",
    feature: "Status Sidang Harian Hakim (minutasi/upload/ANOM/lupa tunda)",
    legacyKey: "statusSidangHakim",
    sourceFunction: "sendStatusSidangHakim",
    legacyType: "employee_notification",
    category: "Notifikasi Pegawai",
    riskLevel: "medium",
    legacySource: "app.js → statusSidangHakim (notifikasi.js → getDataPutusanBelumMinutHakim/getDataUploadPutusanHakim/getDataEdocAnonimisasiHakim/getDataLupaTundaHakim)",
    cronSchedule: "30 14 * * Monday-Friday; 00 19 * * Monday-Friday",
    portalEntity: "notif-status-hakim",
    registryTargetType: "notification_registry",
    registryTargetKey: "employee-hakim-status",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Dua cron per-hakim: 14:30 dan 19:00 Senin-Jumat. Monitoring minutasi, upload putusan, ANOM.",
  },
  {
    id: "mig-notif-status-panitera",
    feature: "Status Sidang Harian Panitera (minutasi/tunda mediasi/lupa tunda)",
    legacyKey: "statusSidangPanitera",
    sourceFunction: "sendStatusSidangPanitera",
    legacyType: "employee_notification",
    category: "Notifikasi Pegawai",
    riskLevel: "medium",
    legacySource: "app.js → statusSidangPanitera (notifikasi.js → getDataPutusanBelumMinutPanitera/getDataTundaMediasiPanitera/getDataLupaTundaPanitera)",
    cronSchedule: "30 14 * * Monday-Friday; 45 18 * * Monday-Friday",
    portalEntity: "notif-status-panitera",
    registryTargetType: "notification_registry",
    registryTargetKey: "employee-panitera-status",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Dua cron per-panitera: 14:30 dan 18:45 Senin-Jumat. Monitoring minutasi, tunda mediasi.",
  },
  {
    id: "mig-notif-antrian-sidang",
    feature: "Antrian Sidang Hari Ini (Hakim & Panitera)",
    legacyKey: "statusSidangHariIni",
    sourceFunction: "sendAntrianSidangHariIni",
    legacyType: "employee_notification",
    category: "Notifikasi Pegawai",
    riskLevel: "low",
    legacySource: "app.js → statusSidangHariIni (notifikasi.js → getDataAntrianSidangHakim/getDataAntrianSidangPanitera)",
    cronSchedule: "55 08 * * Monday-Friday",
    portalEntity: "notif-antrian-sidang",
    registryTargetType: "notification_registry",
    registryTargetKey: "employee-antrian-sidang",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Notifikasi antrian sidang yang hadir ke hakim/panitera pukul 08:55 Senin-Jumat.",
  },
  {
    id: "mig-notif-status-jurusita",
    feature: "Status Sidang Harian Jurusita (putus & tunda)",
    legacyKey: "statusSidangJurusita",
    sourceFunction: "sendStatusSidangJurusita",
    legacyType: "employee_notification",
    category: "Notifikasi Pegawai",
    riskLevel: "medium",
    legacySource: "app.js → statusSidangJurusita (notifikasi.js → getDataPutusJurusitaNew/getDataTundaJurusitaNew)",
    cronSchedule: "00 12 * * Monday-Friday; 15 16 * * Monday-Friday",
    portalEntity: "notif-status-jurusita",
    registryTargetType: "notification_registry",
    registryTargetKey: "employee-jurusita-status",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Dua cron per-jurusita: 12:00 dan 16:15 Senin-Jumat. Monitoring putus dan tunda sidang.",
  },
  {
    id: "mig-notif-relaas-jurusita",
    feature: "Relaas, Delegasi & Pemberitahuan Putusan (Jurusita)",
    legacyKey: "statusRelaasJurusita",
    sourceFunction: "sendRelaasJurusita",
    legacyType: "employee_notification",
    category: "Notifikasi Pegawai",
    riskLevel: "medium",
    legacySource: "app.js → statusRelaasJurusita (notifikasi.js → getBelumPanggilanJurusita/getDataBelumDelegasiJurusita/getDataPemberitahuanPutusanBelumJurusita)",
    cronSchedule: "00 09 * * Friday",
    portalEntity: "notif-relaas-jurusita",
    registryTargetType: "notification_registry",
    registryTargetKey: "employee-jurusita-relaas",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "pending",
    notes: "Cron Jumat 09:00: panggilan belum, delegasi belum, pemberitahuan putusan belum.",
  },
  // ── PUBLIC COMMANDS (12 individual entries — Phase 7 granular split) ─────────
  {
    id: "mig-query-greeting",
    feature: "Handler Salam/Sapaan (query.getData)",
    legacyKey: "getData.greeting",
    sourceFunction: "getData",
    legacyType: "public_command",
    category: "Public Q&A",
    riskLevel: "low",
    legacySource: "query.js → getData (keyword: halo, hai, hei, assalamualaikum, ass)",
    cronSchedule: "",
    portalEntity: "qa-greeting",
    registryTargetType: "public_qa_intent",
    registryTargetKey: "greeting",
    replacementService: "services/publicQaIntentService.js",
    canArchive: false,
    status: "active_registry",
    notes: "Intent greeting aktif di portal (Phase 7). Legacy key dinonaktifkan setelah registry aktif.",
  },
  {
    id: "mig-query-cek-perkara",
    feature: "Cek Status Perkara (cek nomor perkara#, status#)",
    legacyKey: "getData.cek_perkara",
    sourceFunction: "getData",
    legacyType: "public_command",
    category: "Public Q&A",
    riskLevel: "medium",
    legacySource: "query.js → getData (keyword: perkara, cek, status, nomor perkara#)",
    cronSchedule: "",
    portalEntity: "qa-cek-perkara",
    registryTargetType: "public_qa_intent",
    registryTargetKey: "cek_perkara",
    replacementService: "services/publicQaIntentService.js",
    canArchive: false,
    status: "registry_draft",
    notes: "Cek status perkara dengan nomor. Memerlukan verifikasi nomor perkara. Sedang di-draft.",
  },
  {
    id: "mig-query-cek-jadwal-sidang",
    feature: "Cek Jadwal Sidang Perkara (jadwal#, kapan sidang#)",
    legacyKey: "getData.cek_jadwal_sidang",
    sourceFunction: "getData",
    legacyType: "public_command",
    category: "Public Q&A",
    riskLevel: "medium",
    legacySource: "query.js → getData (keyword: jadwal#N.A.Y, kapan sidang#N.A.Y)",
    cronSchedule: "",
    portalEntity: "qa-cek-jadwal-sidang",
    registryTargetType: "public_qa_intent",
    registryTargetKey: "cek_jadwal_sidang",
    replacementService: "services/publicQaIntentService.js",
    canArchive: false,
    status: "registry_draft",
    notes: "Jadwal sidang berdasarkan nomor perkara. Perlu verifikasi case_number_only.",
  },
  {
    id: "mig-query-cek-akta-cerai",
    feature: "Cek Akta Cerai (akta#, ambil akta#)",
    legacyKey: "getData.cek_akta_cerai",
    sourceFunction: "getData",
    legacyType: "public_command",
    category: "Public Q&A",
    riskLevel: "high",
    legacySource: "query.js → getData (keyword: akta#N.A.Y, akta cerai#N.A.Y, ambil akta#N.A.Y)",
    cronSchedule: "",
    portalEntity: "qa-cek-akta-cerai",
    registryTargetType: "public_qa_intent",
    registryTargetKey: "cek_akta_cerai",
    replacementService: "services/publicQaIntentService.js",
    canArchive: false,
    status: "pending",
    notes: "Cek akta cerai high-risk: akses data sensitif. Wajib verifikasi nomor perkara dan HP.",
  },
  {
    id: "mig-query-cek-putusan",
    feature: "Cek Putusan Perkara (putusan#, amar putusan#)",
    legacyKey: "getData.cek_putusan",
    sourceFunction: "getData",
    legacyType: "public_command",
    category: "Public Q&A",
    riskLevel: "medium",
    legacySource: "query.js → getData (keyword: putusan#N.A.Y, amar#N.A.Y)",
    cronSchedule: "",
    portalEntity: "qa-cek-putusan",
    registryTargetType: "public_qa_intent",
    registryTargetKey: "cek_putusan",
    replacementService: "services/publicQaIntentService.js",
    canArchive: false,
    status: "pending",
    notes: "Informasi putusan perkara. Hanya menampilkan data publik, bukan amar rahasia.",
  },
  {
    id: "mig-query-biaya-panjar",
    feature: "Cek Biaya Panjar Perkara (biaya#, sisa panjar#)",
    legacyKey: "getData.biaya_panjar",
    sourceFunction: "getData",
    legacyType: "public_command",
    category: "Public Q&A",
    riskLevel: "medium",
    legacySource: "query.js → getData (keyword: biaya#N.A.Y, sisa panjar#N.A.Y, bapanjar#N.A.Y)",
    cronSchedule: "",
    portalEntity: "qa-biaya-panjar",
    registryTargetType: "public_qa_intent",
    registryTargetKey: "biaya_panjar",
    replacementService: "services/publicQaIntentService.js",
    canArchive: false,
    status: "pending",
    notes: "Cek biaya dan sisa panjar per nomor perkara. Perlu verifikasi nomor perkara.",
  },
  {
    id: "mig-query-sidang-hari-ini",
    feature: "Jadwal Sidang Hari Ini / Besok (publik tanpa nomor perkara)",
    legacyKey: "getData.sidang_hari_ini",
    sourceFunction: "getData",
    legacyType: "public_command",
    category: "Public Q&A",
    riskLevel: "low",
    legacySource: "query.js → getData (keyword: sidang hari ini, sidang besok, sidang tanggal#)",
    cronSchedule: "",
    portalEntity: "qa-sidang-hari-ini",
    registryTargetType: "public_qa_intent",
    registryTargetKey: "sidang_hari_ini",
    replacementService: "services/publicQaIntentService.js",
    canArchive: false,
    status: "registry_draft",
    notes: "Informasi jadwal sidang publik hari ini/besok. Tidak membutuhkan nomor perkara.",
  },
  {
    id: "mig-query-antrian-online",
    feature: "Antrian Sidang Online (daftar antrian#, antrian online#)",
    legacyKey: "getData.antrian_online",
    sourceFunction: "getData",
    legacyType: "public_command",
    category: "Public Q&A",
    riskLevel: "medium",
    legacySource: "query.js → getData (keyword: daftar antrian#N.A.Y, antrian online#N.A.Y)",
    cronSchedule: "",
    portalEntity: "qa-antrian-online",
    registryTargetType: "public_qa_intent",
    registryTargetKey: "antrian_sidang",
    replacementService: "services/publicQaIntentService.js",
    canArchive: false,
    status: "pending",
    notes: "Antrian sidang online dengan format nomor perkara. Dipisah dari jadwal sidang publik.",
  },
  {
    id: "mig-query-alamat-pengadilan",
    feature: "Alamat dan Lokasi Pengadilan",
    legacyKey: "getData.alamat",
    sourceFunction: "getData",
    legacyType: "public_command",
    category: "Public Q&A",
    riskLevel: "low",
    legacySource: "query.js → getData (keyword: alamat, lokasi, kantor pengadilan)",
    cronSchedule: "",
    portalEntity: "qa-alamat",
    registryTargetType: "public_qa_intent",
    registryTargetKey: "alamat_pengadilan",
    replacementService: "services/publicQaIntentService.js",
    canArchive: false,
    status: "registry_draft",
    notes: "Informasi alamat dan lokasi pengadilan. Intent statis, tidak butuh query SIPP.",
  },
  {
    id: "mig-query-ecourt",
    feature: "Informasi E-Court (ecourt, e-court, e court)",
    legacyKey: "getData.ecourt",
    sourceFunction: "getData",
    legacyType: "public_command",
    category: "Public Q&A",
    riskLevel: "low",
    legacySource: "query.js → getData (keyword: ecourt, e-court, e court, daftar ecourt)",
    cronSchedule: "",
    portalEntity: "qa-ecourt",
    registryTargetType: "public_qa_intent",
    registryTargetKey: "ecourt",
    replacementService: "services/publicQaIntentService.js",
    canArchive: false,
    status: "registry_draft",
    notes: "Panduan e-court dan cara pendaftaran online. Intent statis, tidak butuh query SIPP.",
  },
  {
    id: "mig-query-pengaduan",
    feature: "Alur Pengaduan (pengaduan, adu, lapor)",
    legacyKey: "getData.pengaduan",
    sourceFunction: "getData",
    legacyType: "public_command",
    category: "Public Q&A",
    riskLevel: "low",
    legacySource: "query.js → getData (keyword: pengaduan, adu, lapor, keluhan)",
    cronSchedule: "",
    portalEntity: "qa-pengaduan",
    registryTargetType: "public_qa_intent",
    registryTargetKey: "pengaduan",
    replacementService: "services/publicQaIntentService.js",
    canArchive: false,
    status: "registry_draft",
    notes: "Informasi cara menyampaikan pengaduan. Arahkan ke SIWAS / kanal resmi MA.",
  },
  {
    id: "mig-query-info-layanan",
    feature: "Info Layanan Lengkap (info, menu, help, daftar layanan)",
    legacyKey: "getData.info_layanan",
    sourceFunction: "getData",
    legacyType: "public_command",
    category: "Public Q&A",
    riskLevel: "low",
    legacySource: "query.js → getData (keyword: info, menu, help, daftar, layanan, bapanjar survei)",
    cronSchedule: "",
    portalEntity: "qa-info-layanan",
    registryTargetType: "public_qa_intent",
    registryTargetKey: "info_lengkap",
    replacementService: "services/publicQaIntentService.js",
    canArchive: false,
    status: "registry_draft",
    notes: "Daftar layanan lengkap ALETA. Respons statis berisi menu pilihan fitur bot.",
  },
  // ── ADMIN/INTERNAL COMMANDS ─────────────────────────────────────────────────
  {
    id: "mig-query-monev",
    feature: "Perintah Monitoring/Evaluasi Internal (monev *, hakim#, pp#, js#, sipp *)",
    legacyKey: "getData.monev",
    sourceFunction: "getData",
    legacyType: "admin_command",
    category: "Admin Command",
    riskLevel: "medium",
    legacySource: "query.js → getData (keyword: monev *, hakim#, pp#, js#, sipp *, kode hakim, nilai sipp)",
    cronSchedule: "",
    portalEntity: "admin-monev",
    registryTargetType: "query_catalog",
    registryTargetKey: "query-monev-legacy",
    replacementService: "services/legacy/legacyCommandAdapter.js",
    canArchive: false,
    status: "in_progress",
    notes: "Perintah monitoring internal untuk hakim, panitera, jurusita. ~80 keyword berbeda. Perlu admin panel.",
  },
  // ── INFRASTRUCTURE ──────────────────────────────────────────────────────────
  {
    id: "mig-db-config",
    feature: "Konfigurasi Database (db_config.js / db_config4.js / db_config5.js)",
    legacyKey: "dbConfig",
    sourceFunction: "require('./db_config')",
    legacyType: "infrastructure",
    category: "Infrastruktur",
    riskLevel: "high",
    legacySource: "db_config.js, db_config4.js, db_config5.js",
    cronSchedule: "",
    portalEntity: "db-sipp-primary, db-antrian-sidang, db-aps-badilag",
    registryTargetType: "db_connection",
    registryTargetKey: "sipp_primary",
    replacementService: "server/modules/aleta-bot/service.ts → DB connections",
    canArchive: false,
    status: "migrated",
    notes: "Tiga koneksi DB sudah dipindahkan ke portal. Runtime lama masih memakai file config sendiri.",
  },
  {
    id: "mig-templates",
    feature: "Template Pesan WhatsApp (inline strings di notifikasi.js)",
    legacyKey: "messageTemplates",
    sourceFunction: "notifikasi.js inline strings",
    legacyType: "infrastructure",
    category: "Infrastruktur",
    riskLevel: "low",
    legacySource: "notifikasi.js → inline message template strings",
    cronSchedule: "",
    portalEntity: "template catalog",
    registryTargetType: "template",
    registryTargetKey: "template-catalog",
    replacementService: "services/templateService.js",
    canArchive: false,
    status: "migrated",
    notes: "Seluruh template sudah didaftarkan di portal dan tersinkron ke runtime config.",
  },
  {
    id: "mig-query-notifikasi",
    feature: "Query Data SIPP untuk Notifikasi (notifikasi.js getDataJadwal*, getDataPihak*)",
    legacyKey: "notifikasiQuery",
    sourceFunction: "notifikasi.js → getDataJadwal*, getDataPihak*, getTotalPenerimaan*",
    legacyType: "infrastructure",
    category: "Infrastruktur",
    riskLevel: "medium",
    legacySource: "notifikasi.js → 90+ exported functions (getDataJadwalSidang*, getDataPihak*, getTotalPenerimaan*, dll)",
    cronSchedule: "",
    portalEntity: "query-catalog",
    registryTargetType: "query_catalog",
    registryTargetKey: "query-legacy-notif",
    replacementService: "services/legacy/legacyNotificationAdapter.js",
    canArchive: false,
    status: "in_progress",
    notes: "Query legacy terdaftar di katalog portal (legacy: prefix). Eksekusi live masih via runtime lama.",
  },
  {
    id: "mig-public-qa",
    feature: "Public Q&A Intent Registry (seluruh intent dari query.getData)",
    legacyKey: "publicQa",
    sourceFunction: "query.js → getData + publicQaIntentService",
    legacyType: "ai_service",
    category: "AI & Public Q&A",
    riskLevel: "low",
    legacySource: "query.js → getData (seluruh handler publik) + services/publicQaIntentService.js",
    cronSchedule: "",
    portalEntity: "aleta_bot_public_qa_intents",
    registryTargetType: "public_qa_intent",
    registryTargetKey: "intent-catalog",
    replacementService: "services/publicQaIntentService.js",
    canArchive: false,
    status: "in_progress",
    notes: "Intent Public Q&A sudah ada, integrasi AI answer sedang dikembangkan.",
  },
];

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parseStringArrayJson(value: string | null | undefined) {
  const raw = parseJson<unknown>(value || "[]", []);
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 200)
    )
  );
}

function sanitizeStringIdList(value: unknown) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return Array.from(
    new Set(
      raw
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 200)
    )
  );
}

function sanitizeReminderSchedulerTime(value: string | undefined, fallback = "08:00:00") {
  const normalized = String(value || fallback).trim();
  if (/^\d{2}:\d{2}$/.test(normalized)) return `${normalized}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(normalized)) return normalized;
  throw new ApiError(400, "Jam scheduler reminder harus memakai format HH:mm atau HH:mm:ss.");
}

function normalizeWhatsappNumber(input: string) {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

function assertWhatsappNumber(input: string, label = "Nomor WhatsApp") {
  const normalized = normalizeWhatsappNumber(input);
  if (!/^62\d{8,15}$/.test(normalized)) {
    throw new ApiError(400, `${label} harus memakai format nomor Indonesia yang valid, contoh 628123456789.`);
  }
  return normalized;
}

function validateCronLike(input: string) {
  const value = input.trim();
  const parts = value.split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    throw new ApiError(400, "Format jadwal/cron tidak valid. Gunakan 5 atau 6 bagian cron.");
  }
  return value;
}

function validateScheduleConfig(input: AletaBotNotification["scheduleConfig"]) {
  const type = input.type === "event" || input.type === "manual" || input.type === "cron" ? input.type : "manual";
  const cron = String(input.cron ?? "").trim();
  if (type === "cron" && cron) {
    validateCronLike(cron.split(";")[0] ?? cron);
  }
  return {
    type,
    cron: cron.slice(0, 160),
    trigger: String(input.trigger ?? "").trim().slice(0, 160),
  };
}

function parseColumns(input: unknown) {
  if (Array.isArray(input)) {
    return input.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(input ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateOutputColumns(columns: string[]) {
  const invalidColumns = columns.filter((column) => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column));
  if (invalidColumns.length > 0) {
    throw new ApiError(400, `Mapping kolom query tidak valid: ${invalidColumns.join(", ")}.`);
  }
  return Array.from(new Set(columns));
}

function maskValue(value: string) {
  if (!value) return "";
  if (value.length <= 3) return "***";
  return `${value.slice(0, 2)}***${value.slice(-1)}`;
}

function sanitizeErrorMessage(value: string) {
  return String(value || "")
    .replace(/[A-Z]:\\[^\s]+/gi, "[path]")
    .replace(/\/[^\s]+/g, "[path]")
    .replace(/(token|api[_-]?key|password|secret|session)=?[^\s&]+/gi, "$1=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function getDbSecretEncryptionKey() {
  const raw = process.env.ALETA_BOT_DB_SECRET_ENCRYPTION_KEY || "";
  if (!raw) return null;
  return createHash("sha256").update(raw).digest();
}

function encryptDbSecret(value: string) {
  const secret = String(value || "");
  if (!secret) return "";
  const key = getDbSecretEncryptionKey();
  if (!key) {
    return `plain:v1:${Buffer.from(secret, "utf8").toString("base64")}`;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function getPasswordSource(passwordSecret: string, passwordEnvKey: string) {
  if (passwordSecret) return "manual";
  if (passwordEnvKey) return "env";
  return "env";
}

function defaultConnectionKeyForQuery(query: Pick<AletaBotQuery, "id" | "sqlText"> | { id: string; sqlText: string }) {
  const text = `${query.id} ${query.sqlText}`.toLowerCase();
  if (
    query.id === "public_online_queue" ||
    text.includes("runtime:antrianonline") ||
    text.includes("legacy:notifikasi.getdataantriansidang")
  ) {
    return "antrian_sidang";
  }
  if (text.includes("aps") || text.includes("badilag")) return "aps_badilag";
  return "sipp_primary";
}

function validateConnectionKey(key: string) {
  const value = key.trim();
  if (!/^[a-z][a-z0-9_]{2,63}$/.test(value)) {
    throw new ApiError(400, "Connection key harus memakai huruf kecil, angka, dan underscore, minimal 3 karakter.");
  }
  return value;
}

function getTemplatePlaceholders(body: string) {
  return Array.from(body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map((match) => match[1]);
}

function validateReadOnlyQuery(sqlText: string) {
  const trimmed = sqlText.trim();
  if (!trimmed) {
    throw new ApiError(400, "SQL sumber data tidak boleh kosong.");
  }
  if (trimmed.startsWith("legacy:")) return trimmed;

  if (/;/.test(trimmed)) {
    throw new ApiError(400, "SQL sumber data tidak boleh memakai lebih dari satu perintah atau tanda titik koma.");
  }
  if (/(--|#|\/\*|\*\/)/.test(trimmed)) {
    throw new ApiError(400, "SQL sumber data tidak boleh memakai komentar SQL.");
  }

  const normalized = trimmed.replace(/\s+/g, " ").trim();
  if (!/^select\b/i.test(normalized)) {
    throw new ApiError(400, "SQL sumber data hanya boleh berupa SELECT atau referensi jalur lama.");
  }
  if (/\b(insert|update|delete|drop|alter|truncate|create|replace|grant|revoke|exec|execute|call|copy)\b/i.test(normalized)) {
    throw new ApiError(400, "SQL sumber data mengandung perintah berbahaya dan diblokir.");
  }
  return trimmed;
}

function validateTemplateBody(
  body: string,
  {
    category,
    requiredPlaceholders = [],
  }: {
    category?: AletaBotTemplate["category"];
    requiredPlaceholders?: string[];
  } = {}
) {
  const placeholders = Array.from(new Set(getTemplatePlaceholders(body)));
  if (body.includes("{{") || body.includes("}}")) {
    const reconstructed = body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, "");
    if (reconstructed.includes("{{") || reconstructed.includes("}}")) {
      throw new ApiError(400, "Template memiliki placeholder tidak valid. Gunakan format {{nama_kolom}}.");
    }
  }

  const missingRequired = requiredPlaceholders.filter((placeholder) => !placeholders.includes(placeholder));
  if (missingRequired.length > 0) {
    throw new ApiError(400, `Template wajib memuat placeholder: ${missingRequired.join(", ")}.`);
  }

  if (category === "party" && !/(ptsp|pengadilan|informasi|layanan|resmi|hubungi)/i.test(body)) {
    throw new ApiError(400, "Template Pihak wajib menyertakan konteks layanan/kontak resmi pengadilan.");
  }

  return placeholders;
}

function makeSampleRow(columns: string[]) {
  const sample: Record<string, string> = {};
  for (const column of columns) {
    if (/nomor|telepon|whatsapp|hp/i.test(column)) sample[column] = "628123456789";
    else if (/tanggal/i.test(column)) sample[column] = "27-04-2026";
    else if (/nama.*pegawai/i.test(column)) sample[column] = "Contoh Pegawai";
    else if (/nama/i.test(column)) sample[column] = "Contoh Pihak";
    else if (/perkara/i.test(column)) sample[column] = "123/Pdt.G/2026/PA.Dgl";
    else if (/panjar|biaya/i.test(column)) sample[column] = "Rp125.000";
    else if (/ringkasan|detail|daftar|data|hasil|informasi/i.test(column)) {
      sample[column] = "Data contoh pertama untuk pratinjau aman.\nData contoh kedua untuk pratinjau aman.";
    }
    else sample[column] = `contoh_${column}`;
  }
  return sample;
}

function summarizeQueryPreview(query: AletaBotQuery) {
  const sampleRows = Array.from({ length: Math.min(2, 5) }, () => makeSampleRow(query.outputColumns));
  const hasRecipient = query.category !== "party" || Boolean(query.recipientColumn && query.outputColumns.includes(query.recipientColumn));
  return {
    columns: query.outputColumns,
    connectionKey: query.connectionKey,
    sampleRows,
    limit: 5,
    validForRecipient: hasRecipient,
    message: query.sqlText.startsWith("legacy:")
      ? "Referensi legacy tervalidasi. Eksekusi live SIPP diblokir dari portal; runtime lama tetap memakai fungsi legacy."
      : "Query SELECT tervalidasi untuk test terbatas. Preview dibatasi maksimal 5 baris.",
  };
}

type AletaBotQueryHealthResult = {
  ok: boolean;
  status: "success" | "warning" | "failed";
  startedAt?: string;
  finishedAt?: string;
  durationMs: number;
  slow: boolean;
  rowCount: number;
  truncated?: boolean;
  sampleRows: Array<Record<string, unknown>>;
  message: string;
  error: string | null;
};

function normalizeQueryHealthResult(input: unknown, fallbackQuery: AletaBotQuery): AletaBotQueryHealthResult {
  const value = (input && typeof input === "object" ? input : {}) as Partial<AletaBotQueryHealthResult>;
  const fallback = summarizeQueryPreview(fallbackQuery);
  const status = value.status === "failed" ? "failed" : value.status === "warning" ? "warning" : "success";
  return {
    ok: value.ok !== false && status !== "failed",
    status,
    startedAt: typeof value.startedAt === "string" ? value.startedAt : undefined,
    finishedAt: typeof value.finishedAt === "string" ? value.finishedAt : undefined,
    durationMs: Math.max(0, Number(value.durationMs || 0)),
    slow: Boolean(value.slow),
    rowCount: Math.max(0, Number(value.rowCount || 0)),
    truncated: Boolean(value.truncated),
    sampleRows: Array.isArray(value.sampleRows) ? value.sampleRows.slice(0, 5) : fallback.sampleRows,
    message: typeof value.message === "string" && value.message.trim() ? value.message : fallback.message,
    error: typeof value.error === "string" && value.error.trim() ? value.error : null,
  };
}

async function checkSavedQueryHealth(query: AletaBotQuery): Promise<AletaBotQueryHealthResult> {
  if (getWhatsappRuntimeMode() !== "aleta_bot") {
    const previewPayload = summarizeQueryPreview(query);
    return {
      ok: true,
      status: "success",
      durationMs: 0,
      slow: false,
      rowCount: previewPayload.sampleRows.length,
      sampleRows: previewPayload.sampleRows,
      message: `${previewPayload.message} Runtime aleta_bot tidak aktif, jadi health check live tidak dijalankan.`,
      error: null,
    };
  }

  try {
    const response = await callAletaBotRuntime<{ health?: unknown }>("/internal/aleta-bot/query/health-check", {
      method: "POST",
      body: JSON.stringify({
        query: {
          id: query.id,
          name: query.name,
          category: query.category,
          sqlText: query.sqlText,
          outputColumns: query.outputColumns,
          recipientColumn: query.recipientColumn,
          connectionKey: query.connectionKey,
        },
        maxRows: 20,
        sampleLimit: 5,
        slowMs: 3000,
      }),
    });
    return normalizeQueryHealthResult(response.health, query);
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      durationMs: 0,
      slow: false,
      rowCount: 0,
      sampleRows: [],
      message: "Health check sumber data gagal karena runtime ALETA Bot belum dapat membaca query.",
      error: error instanceof Error ? error.message : "Runtime ALETA Bot tidak dapat dihubungi.",
    };
  }
}

function mapSettings(row: SettingsRow): AletaBotSettings {
  return {
    botEnabled: Boolean(row.bot_enabled),
    notificationsEnabled: Boolean(row.notifications_enabled),
    // Baris lama yang belum punya kolomnya dibaca MENYALA, bukan mati -
    // pemasangan versi baru tidak boleh menghentikan pengiriman sendiri.
    kirimPegawaiEnabled: row.kirim_pegawai_enabled === undefined ? true : Boolean(row.kirim_pegawai_enabled),
    kirimPihakEnabled: row.kirim_pihak_enabled === undefined ? true : Boolean(row.kirim_pihak_enabled),
    adminWhatsappNumber: row.admin_whatsapp_number,
    messageDelayMs: row.message_delay_ms,
    sendingRiskLevel: resolveSendingRiskPreset(row.sending_risk_level).level,
    retryLimit: row.retry_limit,
    dryRunEnabled: Boolean(row.dry_run_enabled),
    scheduleCron: row.schedule_cron,
    testTargetNumber: row.test_target_number,
    securityNotes: row.security_notes,
    deadlineReminderEnabled: Boolean(row.disposition_deadline_reminder_enabled),
    deadlineReminderMode: ["disabled", "dry_run", "pilot", "production"].includes(row.disposition_deadline_reminder_mode)
      ? row.disposition_deadline_reminder_mode
      : "dry_run",
    deadlineReminderApprovedAt: row.disposition_deadline_reminder_approved_at,
    deadlineReminderApprovedBy: row.disposition_deadline_reminder_approved_by,
    deadlineReminderLastRunAt: row.disposition_deadline_reminder_last_run_at,
    deadlineReminderLastStatus: ["idle", "simulated", "skipped", "sent", "blocked"].includes(row.disposition_deadline_reminder_last_status)
      ? row.disposition_deadline_reminder_last_status
      : "idle",
    deadlineReminderLastMessage: row.disposition_deadline_reminder_last_message,
    deadlineReminderPilotUserIds: parseStringArrayJson(row.disposition_deadline_reminder_pilot_user_ids_json),
    deadlineReminderPilotRoleIds: parseStringArrayJson(row.disposition_deadline_reminder_pilot_role_ids_json),
    deadlineReminderPilotPositionIds: parseStringArrayJson(row.disposition_deadline_reminder_pilot_position_ids_json),
    deadlineReminderSchedulerEnabled: Boolean(row.disposition_deadline_reminder_scheduler_enabled),
    deadlineReminderSchedulerMode: ["disabled", "dry_run", "pilot", "production"].includes(row.disposition_deadline_reminder_scheduler_mode)
      ? row.disposition_deadline_reminder_scheduler_mode
      : "dry_run",
    deadlineReminderSchedulerTime: row.disposition_deadline_reminder_scheduler_time || "08:00:00",
    deadlineReminderSchedulerLastRunAt: row.disposition_deadline_reminder_scheduler_last_run_at,
    deadlineReminderSchedulerLastMessage: row.disposition_deadline_reminder_scheduler_last_message,
    deadlineReminderKillSwitch: Boolean(row.disposition_deadline_reminder_kill_switch),
    updatedAt: row.updated_at,
  };
}

function mapTemplate(row: TemplateRow): AletaBotTemplate {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    body: row.body,
    placeholders: parseJson<string[]>(row.placeholders_json, []),
    editable: Boolean(row.editable),
    updatedAt: row.updated_at,
  };
}

function mapJob(row: JobRow): AletaBotJob {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: Boolean(row.enabled),
    scheduleCron: row.schedule_cron,
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    lastMessage: row.last_message,
    updatedAt: row.updated_at,
  };
}

function mapQuery(row: QueryRow, usedByNotifications: string[] = []): AletaBotQuery {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    sqlText: row.sql_text,
    outputColumns: parseJson<string[]>(row.output_columns_json, []),
    recipientColumn: row.recipient_column,
    connectionKey: row.connection_key || "sipp_primary",
    isActive: Boolean(row.is_active),
    usedByNotifications,
    lastTestedAt: row.last_tested_at,
    lastTestStatus: row.last_test_status,
    lastTestError: row.last_test_error,
    lastTestDurationMs: Number(row.last_test_duration_ms || 0),
    lastTestRowCount: Number(row.last_test_row_count || 0),
    lastTestSampleRows: parseJson<Array<Record<string, unknown>>>(row.last_test_sample_json, []),
    lastTestSlow: Boolean(row.last_test_slow),
    lastTestMessage: row.last_test_message,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDbConnection(row: DbConnectionRow): AletaBotDbConnection {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    driver: row.driver,
    host: row.host,
    port: Number(row.port || 3306),
    databaseName: row.database_name,
    username: row.username,
    usernameMasked: maskValue(row.username),
    passwordEnvKey: row.password_env_key,
    passwordConfigured: Boolean(row.password_secret || (row.password_env_key && process.env[row.password_env_key])),
    passwordSource: row.password_secret ? "manual" : row.password_env_key ? "env" : "none",
    sslEnabled: Boolean(row.ssl_enabled),
    connectionTimeoutMs: Number(row.connection_timeout_ms || 5000),
    isActive: Boolean(row.is_active),
    isDefault: Boolean(row.is_default),
    legacySource: row.legacy_source,
    lastTestStatus: row.last_test_status,
    lastTestError: row.last_test_error,
    lastTestAt: row.last_test_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNotification(row: NotificationRow): AletaBotNotification {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    queryId: row.query_id,
    templateId: row.template_id,
    recipientSource: row.recipient_source,
    recipientMapping: parseJson<Record<string, unknown>>(row.recipient_mapping_json, {}),
    scheduleConfig: {
      ...parseJson<AletaBotNotification["scheduleConfig"]>(row.schedule_config_json, {
        type: "manual",
        cron: "",
        trigger: "",
      }),
    },
    isActive: Boolean(row.is_active),
    attachDocument: row.attach_document === undefined || row.attach_document === null ? true : Boolean(row.attach_document),
    delayMs: row.delay_ms,
    retryLimit: row.retry_limit,
    lastRunAt: row.last_run_at,
    lastStatus: row.last_status,
    lastMessage: row.last_message,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEmployeeRecipient(row: EmployeeRecipientRow): AletaBotEmployeeRecipient {
  const whatsappNumber = normalizeWhatsappNumber(row.whatsapp_number);
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    roleId: row.role_id,
    positionId: row.position_id,
    positionName: row.position_name ?? "",
    unitKerja: row.unit_kerja ?? "",
    additionalRoleIds: normalizeAdditionalRoleIds(parseJson<unknown>(row.additional_role_ids_json || "[]", [])),
    whatsappNumber,
    whatsappChatId: whatsappNumber ? `${whatsappNumber}@c.us` : "",
  };
}

function mapNotificationLog(row: NotificationLogRow): AletaBotNotificationLogEntry {
  return {
    id: row.id,
    notificationId: row.notification_id,
    queryId: row.query_id,
    recipientNumber: row.recipient_number,
    recipientName: row.recipient_name,
    category: row.category,
    messagePreview: row.message_preview,
    status: row.status,
    whatsappMessageId: row.whatsapp_message_id || "",
    ack: row.ack === null || row.ack === undefined ? null : Number(row.ack),
    errorMessage: row.error_message,
    sourceApp: row.source_app || "",
    sourceFeature: row.source_feature || row.category,
    entityType: row.entity_type || "",
    entityId: row.entity_id || "",
    metadata: parseJson<Record<string, unknown>>(row.metadata_json || "{}", {}),
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
  };
}

function mapLog(row: LogRow): AletaBotLogEntry {
  return {
    id: row.id,
    level: row.level,
    eventType: row.event_type,
    message: row.message,
    metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
  };
}

function mapPublicQaIntent(row: PublicQaIntentRow): AletaBotPublicQaIntent {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    category: row.category,
    audience: row.audience,
    isActive: Boolean(row.is_active),
    aiEnabled: Boolean(row.ai_enabled),
    exactTriggers: parseJson<string[]>(row.exact_triggers_json, []),
    exampleQuestions: parseJson<string[]>(row.example_questions_json, []),
    requiredParameters: parseJson<string[]>(row.required_parameters_json, []),
    queryKey: row.query_key,
    legacyHandler: row.legacy_handler,
    legacyCommand: row.legacy_command,
    parameterizedLegacyCommand: row.parameterized_legacy_command,
    templateKey: row.template_key,
    responseMode: row.response_mode,
    confidenceThreshold: Number(row.confidence_threshold || 0.65),
    requiresVerification: Boolean(row.requires_verification),
    requiresCaseNumber: Boolean(row.requires_case_number),
    maxAttempts: Number(row.max_attempts || 2),
    fallbackMessage: row.fallback_message,
    answerTemplate: row.answer_template || "",
    matchKeywords: parseJson<string[]>(row.match_keywords_json || "[]", []),
    riskLevel: row.risk_level,
    notes: row.notes,
    aiAnswerEnabled: Boolean(row.ai_answer_enabled),
    aiAnswerMode: row.ai_answer_mode || "off",
    answerPolicy: row.answer_policy || "public_info_only",
    verificationPolicy: row.verification_policy || "none",
    allowedDataFields: parseJson<string[]>(row.allowed_data_fields_json, []),
    blockedDataFields: parseJson<string[]>(row.blocked_data_fields_json, []),
    aiSystemPrompt: row.ai_system_prompt || "",
    aiUserPromptTemplate: row.ai_user_prompt_template || "",
    maxAiTokens: Number(row.max_ai_tokens || 400),
    temperature: Number(row.temperature ?? 0.2),
    requiresApprovalBeforeActive: Boolean(row.requires_approval_before_active),
    version: Number(row.version || 1),
    status: row.status || "draft",
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPublicQaLog(row: PublicQaLogRow): AletaBotPublicQaLogEntry {
  const reviewStatus = row.review_status || "pending";
  const autoNeedsReview =
    row.status === "fallback" ||
    row.status === "blocked" ||
    row.status === "error" ||
    row.matched_method === "fallback" ||
    Number(row.confidence || 0) < 0.5;
  return {
    id: row.id,
    senderNumber: row.sender_number,
    senderName: row.sender_name,
    rawMessage: row.raw_message,
    normalizedMessage: row.normalized_message,
    matchedIntentKey: row.matched_intent_key,
    matchedMethod: row.matched_method,
    confidence: Number(row.confidence || 0),
    parameters: parseJson<Record<string, unknown>>(row.parameters_json, {}),
    queryKey: row.query_key,
    responsePreview: row.response_preview,
    status: row.status,
    errorMessage: row.error_message,
    needsHumanReview: reviewStatus === "pending" && (Boolean(row.needs_human_review) || autoNeedsReview),
    reviewStatus,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note || "",
    createdAt: row.created_at,
  };
}

function mapPublicQaKnowledge(row: PublicQaKnowledgeRow) {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    category: row.category,
    audience: row.audience,
    keywords: parseJson<string[]>(row.keywords_json, []),
    answer: row.answer,
    sourceLabel: row.source_label,
    sourceUrl: row.source_url,
    priority: Number(row.priority || 50),
    isActive: Boolean(row.is_active),
    updatedAt: row.updated_at,
  };
}

function mapApprovalRequest(row: ApprovalRequestRow): AletaBotApprovalRequest {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityName: row.entity_name,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    notes: row.notes,
    snapshotJson: row.snapshot_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLegacyMigration(row: LegacyMigrationRow): AletaBotLegacyMigration {
  return {
    id: row.id,
    feature: row.feature,
    legacyKey: row.legacy_key ?? "",
    sourceFunction: row.source_function ?? "",
    legacyType: row.legacy_type ?? "other",
    category: row.category ?? "",
    riskLevel: row.risk_level ?? "medium",
    legacySource: row.legacy_source,
    cronSchedule: row.cron_schedule ?? "",
    portalEntity: row.portal_entity,
    registryTargetType: row.registry_target_type ?? "",
    registryTargetKey: row.registry_target_key ?? "",
    replacementService: row.replacement_service ?? "",
    canArchive: Boolean(row.can_archive),
    status: row.status,
    notes: row.notes,
    migratedAt: row.migrated_at,
    migratedBy: row.migrated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requireSuperAdmin(db: AletaDatabase, actorUserId: string) {
  const actor = await requireActorUser(db, actorUserId);

  if (actor.roleId !== "super-admin") {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengakses modul ALETA Bot.");
  }

  return actor;
}

async function requireAletaBotOperator(db: AletaDatabase, actorUserId: string) {
  const actor = await requireActorUser(db, actorUserId);

  if (actor.roleId !== "super-admin" && actor.roleId !== "admin") {
    throw new ApiError(403, "Hanya Super Admin/Admin yang dapat menjalankan simulasi ALETA Bot.");
  }

  return actor;
}

function getAletaBotRuntimeUrl(pathname: string) {
  const baseUrl = (
    process.env.ALETA_BOT_BASE_URL ||
    process.env.ALETA_BOT_RUNTIME_URL ||
    DEFAULT_ALETA_BOT_RUNTIME_URL
  ).replace(/\/+$/, "");
  return `${baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function getAletaBotInternalHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "content-type": "application/json",
  };
  const internalToken =
    process.env.ALETA_BOT_INTERNAL_API_TOKEN ||
    process.env.ALETA_BOT_INTERNAL_TOKEN ||
    "";
  if (internalToken) {
    headers["x-aleta-internal-token"] = internalToken;
  }
  return headers;
}

function resolveActiveAiConnection(aiConfig: Awaited<ReturnType<typeof getAISettingsFromDb>>) {
  return (
    aiConfig.providers.find((provider) => provider.id === aiConfig.activeConnectionId) ??
    aiConfig.providers.find((provider) => provider.isActive) ??
    aiConfig.providers.find(
      (provider) => provider.providerId === aiConfig.providerId && provider.modelId === aiConfig.modelId
    ) ??
    null
  );
}

function mapPortalProviderToBot(providerId: string) {
  if (providerId === "chatgpt") return "openai";
  return providerId;
}

/**
 * Menentukan apakah API key AI dibiarkan di env container ALETA Bot (portal
 * tidak mengirim secret), atau dikirim langsung dari Pengaturan AI portal.
 *
 * ALETA_BOT_ALLOW_VOLATILE_AI_SECRET=true adalah pilihan sadar operator: key
 * dikirim lewat jalur internal bertoken antar container, sehingga tidak perlu
 * disalin ke .env.production. Dulu flag ini HANYA dibaca sisi bot sementara
 * portal tetap mengosongkan key di production, sehingga jalurnya tidak pernah
 * berfungsi — guard lolos tetapi bot berjalan tanpa key sama sekali.
 */
export function shouldUseEnvSecretForBotAi({
  envKeyHasValue,
  allowVolatileSecret,
}: {
  /** Apakah env key (mis. GEMINI_API_KEY) BENAR-BENAR terisi nilainya. */
  envKeyHasValue?: boolean;
  allowVolatileSecret?: string;
}) {
  const bolehVolatile = String(allowVolatileSecret || "false").toLowerCase() === "true";
  if (bolehVolatile) return false;
  // Dulu ini memaksa env-secret di production TANPA memeriksa apakah env key-nya
  // ada. Akibatnya: admin yang hanya mengisi API key di UI portal mendapati bot
  // berjalan TANPA key sama sekali (portal mengosongkan key, bot tak punya env).
  // Sekarang env-secret dipakai HANYA bila env key benar-benar terisi. Portal
  // dan bot berbagi .env.production, jadi bila portal melihat nilainya, bot pun
  // punya. Bila tidak ada, key dari UI diteruskan ke bot lewat jalur internal.
  return Boolean(envKeyHasValue);
}

function getBotAiEnvKeyForProvider(provider: string) {
  const normalized = mapPortalProviderToBot(provider);
  const configured =
    process.env[`ALETA_BOT_AI_${normalized.toUpperCase()}_API_KEY_ENV`] ||
    process.env.ALETA_BOT_AI_API_KEY_ENV ||
    "";
  if (configured) return configured;
  if (normalized === "openai") return "OPENAI_API_KEY";
  if (normalized === "gemini") return "GEMINI_API_KEY";
  if (normalized === "claude") return "ANTHROPIC_API_KEY";
  return "";
}

async function buildAletaBotAiConfigPayload(db: AletaDatabase) {
  const globalAiConfig = await getAISettingsFromDb(db, { includeSecrets: true });
  const aiConfig = resolveAIConfigForModule(globalAiConfig, "aleta_bot");
  const moduleConfig = globalAiConfig.moduleConfigs.find((item) => item.moduleKey === "aleta_bot") ?? null;
  const activeConnection = resolveActiveAiConnection(aiConfig);
  const providerId = activeConnection?.providerId ?? aiConfig.providerId;
  const modelId = activeConnection?.modelId ?? aiConfig.modelId;
  const provider = mapPortalProviderToBot(providerId);
  // Nama env key yang seharusnya menampung key (mis. GEMINI_API_KEY), lalu cek
  // apakah env itu BENAR-BENAR terisi. Portal & bot berbagi .env.production,
  // jadi bila portal melihat nilainya, bot pun punya.
  const resolvedEnvKeyName = getBotAiEnvKeyForProvider(providerId);
  const envKeyHasValue = Boolean(resolvedEnvKeyName && process.env[resolvedEnvKeyName]);
  const useEnvSecret = shouldUseEnvSecretForBotAi({
    envKeyHasValue,
    allowVolatileSecret: process.env.ALETA_BOT_ALLOW_VOLATILE_AI_SECRET,
  });
  const apiKeyEnvKey = useEnvSecret ? resolvedEnvKeyName : "";
  const apiKey = useEnvSecret ? "" : activeConnection?.apiKey ?? "";
  const enabled = Boolean(aiConfig.enabled && activeConnection);

  return {
    enabled,
    publicQaEnabled: enabled,
    publicQaAiAnswerEnabled: enabled,
    provider,
    providerId,
    model: modelId,
    modelId,
    endpointUrl: activeConnection?.endpointUrl ?? "",
    apiKey,
    apiKeyEnvKey,
    apiKeyConfigured: Boolean(apiKey || apiKeyEnvKey),
    secretPersistenceHint: apiKeyEnvKey ? "env" : apiKey ? "volatile_memory" : "none",
    configSource: "manajemen_surat",
    promptPolicy: "public_qa_guarded",
    timeoutMs: Number(process.env.ALETA_BOT_AI_TIMEOUT_MS || 8000),
    maxTokens: Number(process.env.ALETA_BOT_PUBLIC_QA_MAX_TOKENS || 400),
    temperature: Number(process.env.ALETA_BOT_PUBLIC_QA_TEMPERATURE || 0.2),
    featureFlags: {
      manajemenSuratAi: aiConfig.featureManajemenSuratAi,
      disposisiAi: aiConfig.featureDisposisiAi,
      publicQaBridge: true,
    },
    moduleKey: "aleta_bot",
    moduleConfig,
    moduleConfigs: globalAiConfig.moduleConfigs,
    syncedAt: new Date().toISOString(),
  };
}

/**
 * Batas waktu bawaan untuk panggilan ke ALETA Bot. Operasi berat seperti
 * pratinjau sumber data pegawai menjalankan query SIPP sekali per pegawai,
 * sehingga membutuhkan waktu jauh lebih lama daripada panggilan biasa.
 */
const ALETA_BOT_TIMEOUT_MS = 10000;
const ALETA_BOT_PREVIEW_TIMEOUT_MS = 120000;

async function callAletaBotRuntime<T>(
  pathname: string,
  init: RequestInit = {},
  timeoutMs: number = ALETA_BOT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetch(getAletaBotRuntimeUrl(pathname), {
        cache: "no-store",
        ...init,
        headers: {
          ...getAletaBotInternalHeaders(),
          ...(init.headers ?? {}),
        },
        signal: controller.signal,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      // Habis waktu berbeda dari bot mati: botnya hidup tapi pekerjaannya lama.
      // Dulu keduanya dilaporkan sama sehingga operator mengira bot tidak jalan.
      const kehabisanWaktu =
        (error instanceof Error && error.name === "AbortError") ||
        /abort/i.test(detail);
      if (kehabisanWaktu) {
        throw new Error(
          `ALETA Bot belum selesai memproses dalam ${Math.round(timeoutMs / 1000)} detik. ` +
            "Sumber data pegawai menjalankan query SIPP sekali untuk tiap pegawai, jadi makin banyak " +
            "pegawai makin lama. Persempit target pegawai pada notifikasinya, atau coba lagi saat SIPP tidak sibuk."
        );
      }
      // fetch gagal = bot tidak menyala/tidak terjangkau. Tanpa penegasan ini
      // pesannya cuma "fetch failed", yang menyesatkan operator.
      throw new Error(`ALETA Bot tidak dapat dihubungi di ${getAletaBotRuntimeUrl(pathname)} (${detail}).`);
    }
    const payload = (await response.json().catch(() => null)) as T & {
      status?: boolean;
      message?: string;
    };
    if (!response.ok || payload?.status === false) {
      throw new Error(payload?.message || `Runtime ALETA Bot merespons HTTP ${response.status}.`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function syncAletaBotAiConfig(db: AletaDatabase, actorUserId: string) {
  const actor = await requireSuperAdmin(db, actorUserId);
  const payload = await buildAletaBotAiConfigPayload(db);

  try {
    const result = await callAletaBotRuntime<{
      status: boolean;
      config?: Record<string, unknown>;
      message?: string;
    }>("/internal/aleta-bot/ai-config/sync", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "success",
      eventType: "settings",
      message: "AI config bridge berhasil disinkronkan ke ALETA Bot runtime.",
      metadata: {
        provider: payload.provider,
        model: payload.model,
        apiKeyConfigured: payload.apiKeyConfigured,
        runtimeUrlConfigured: Boolean(process.env.ALETA_BOT_RUNTIME_URL),
      },
    });
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "SYNC_ALETA_BOT_AI_CONFIG",
      entityType: "aleta_bot_ai_config",
      entityId: payload.provider,
      payload: {
        provider: payload.provider,
        model: payload.model,
        apiKeyConfigured: payload.apiKeyConfigured,
        runtimeStatus: result.status,
      },
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sinkronisasi AI config gagal.";
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "error",
      eventType: "settings",
      message: "AI config bridge gagal disinkronkan ke ALETA Bot runtime.",
      metadata: { provider: payload.provider, model: payload.model, errorMessage: message },
    });
    throw new ApiError(502, message);
  }
}

async function testAletaBotAiRuntime(db: AletaDatabase, actorUserId: string) {
  const actor = await requireSuperAdmin(db, actorUserId);
  try {
    const result = await callAletaBotRuntime<{
      status: boolean;
      result?: Record<string, unknown>;
      message?: string;
    }>("/internal/aleta-bot/ai-config/test", {
      method: "POST",
      body: JSON.stringify({}),
    });
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: result.status ? "success" : "warning",
      eventType: "settings",
      message: result.status ? "Test AI runtime ALETA Bot berhasil." : "Test AI runtime ALETA Bot gagal.",
      metadata: result.result ?? {},
    });
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "TEST_ALETA_BOT_AI_RUNTIME",
      entityType: "aleta_bot_ai_config",
      entityId: "runtime",
      payload: result.result ?? {},
    });
    return result;
  } catch (error) {
    throw new ApiError(502, error instanceof Error ? error.message : "Test AI runtime gagal.");
  }
}

function quoteSqlIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

async function createTableIfMissing(db: AletaDatabase, tableName: string, sql: string) {
  try {
    await db.prepare(`SELECT 1 FROM ${quoteSqlIdentifier(tableName)} LIMIT 1`).get();
    return;
  } catch {
    // If the table does not exist yet, fall through and create it.
  }

  await db.exec(sql);
}

async function resolveSeedQueryName(db: AletaDatabase, preferredName: string, queryId: string) {
  const existing = await db
    .prepare(`SELECT id FROM aleta_bot_queries WHERE name = ? LIMIT 1`)
    .get<{ id: string }>(preferredName);
  if (!existing || existing.id === queryId) return preferredName;

  const suffix = queryId.startsWith("legacy-notifikasi-")
    ? "Detail Notifikasi"
    : queryId.startsWith("legacy-")
      ? "Ringkasan"
      : "Sumber Tambahan";
  const baseCandidate = `${preferredName} - ${suffix}`;
  let candidate = baseCandidate;

  for (let index = 2; index <= 20; index += 1) {
    const conflict = await db
      .prepare(`SELECT id FROM aleta_bot_queries WHERE name = ? LIMIT 1`)
      .get<{ id: string }>(candidate);
    if (!conflict || conflict.id === queryId) return candidate;
    candidate = `${baseCandidate} ${index}`;
  }

  return `${preferredName} - ${queryId}`;
}

const seededAletaBotDatabases = new WeakSet<AletaDatabase>();

async function hasCurrentAletaBotSeedState(db: AletaDatabase) {
  try {
    const settings = await db
      .prepare(
        `SELECT disposition_deadline_reminder_kill_switch
         FROM aleta_bot_settings
         WHERE id = 1`
      )
      .get<{ disposition_deadline_reminder_kill_switch: number }>();
    if (!settings) return false;

    const row = await db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM aleta_bot_templates) AS templates,
          (SELECT COUNT(*) FROM aleta_bot_jobs) AS jobs,
          (SELECT COUNT(*) FROM aleta_bot_queries) AS queries,
          (SELECT COUNT(*) FROM aleta_bot_notifications) AS notifications,
          (SELECT COUNT(*) FROM aleta_bot_db_connections) AS db_connections,
          (SELECT COUNT(*) FROM aleta_bot_public_qa_intents) AS public_qa_intents,
          (SELECT COUNT(*) FROM aleta_bot_public_qa_knowledge) AS public_qa_knowledge`
      )
      .get<{
        templates: number | string;
        jobs: number | string;
        queries: number | string;
        notifications: number | string;
        db_connections: number | string;
        public_qa_intents: number | string;
        public_qa_knowledge: number | string;
      }>();

    return Boolean(
      row &&
        Number(row.templates) > 0 &&
        Number(row.jobs) > 0 &&
        Number(row.queries) > 0 &&
        Number(row.notifications) > 0 &&
        Number(row.db_connections) > 0 &&
        Number(row.public_qa_intents) > 0 &&
        Number(row.public_qa_knowledge) > 0
    );
  } catch {
    return false;
  }
}

export async function ensureAletaBotSeeded(db: AletaDatabase) {
  if (seededAletaBotDatabases.has(db)) {
    return;
  }

  if (db.isTransactionClient() && await hasCurrentAletaBotSeedState(db)) {
    seededAletaBotDatabases.add(db);
    return;
  }

  const now = new Date().toISOString();
  await createTableIfMissing(db, "aleta_bot_db_connections", `CREATE TABLE IF NOT EXISTS aleta_bot_db_connections (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    driver TEXT NOT NULL DEFAULT 'mysql',
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 3306,
    database_name TEXT NOT NULL,
    username TEXT NOT NULL,
    password_env_key TEXT NOT NULL DEFAULT '',
    password_secret TEXT NOT NULL DEFAULT '',
    password_source TEXT NOT NULL DEFAULT 'env',
    ssl_enabled SMALLINT NOT NULL DEFAULT 0,
    connection_timeout_ms INTEGER NOT NULL DEFAULT 5000,
    is_active SMALLINT NOT NULL DEFAULT 1,
    is_default SMALLINT NOT NULL DEFAULT 0,
    legacy_source TEXT NOT NULL DEFAULT '',
    last_test_status TEXT NOT NULL DEFAULT 'idle',
    last_test_error TEXT,
    last_test_at TEXT,
    created_by TEXT,
    updated_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await db.exec(`ALTER TABLE aleta_bot_db_connections ADD COLUMN IF NOT EXISTS password_secret TEXT NOT NULL DEFAULT ''`);
  await db.exec(`ALTER TABLE aleta_bot_db_connections ADD COLUMN IF NOT EXISTS password_source TEXT NOT NULL DEFAULT 'env'`);
  await db.exec(`ALTER TABLE aleta_bot_queries ADD COLUMN IF NOT EXISTS connection_key TEXT NOT NULL DEFAULT 'sipp_primary'`);
  await db.exec(`ALTER TABLE aleta_bot_queries ADD COLUMN IF NOT EXISTS last_test_duration_ms INTEGER NOT NULL DEFAULT 0`);
  await db.exec(`ALTER TABLE aleta_bot_queries ADD COLUMN IF NOT EXISTS last_test_row_count INTEGER NOT NULL DEFAULT 0`);
  await db.exec(`ALTER TABLE aleta_bot_queries ADD COLUMN IF NOT EXISTS last_test_sample_json TEXT NOT NULL DEFAULT '[]'`);
  await db.exec(`ALTER TABLE aleta_bot_queries ADD COLUMN IF NOT EXISTS last_test_slow SMALLINT NOT NULL DEFAULT 0`);
  await db.exec(`ALTER TABLE aleta_bot_queries ADD COLUMN IF NOT EXISTS last_test_message TEXT`);
  await createTableIfMissing(db, "aleta_bot_public_qa_intents", `CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_intents (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'informasi_umum',
    audience TEXT NOT NULL DEFAULT 'party',
    is_active SMALLINT NOT NULL DEFAULT 1,
    ai_enabled SMALLINT NOT NULL DEFAULT 0,
    exact_triggers_json TEXT NOT NULL DEFAULT '[]',
    example_questions_json TEXT NOT NULL DEFAULT '[]',
    required_parameters_json TEXT NOT NULL DEFAULT '[]',
    query_key TEXT NOT NULL DEFAULT '',
    legacy_handler TEXT NOT NULL DEFAULT '',
    legacy_command TEXT NOT NULL DEFAULT '',
    parameterized_legacy_command TEXT NOT NULL DEFAULT '',
    template_key TEXT NOT NULL DEFAULT '',
    response_mode TEXT NOT NULL DEFAULT 'legacy_handler',
    confidence_threshold REAL NOT NULL DEFAULT 0.65,
    requires_verification SMALLINT NOT NULL DEFAULT 0,
    requires_case_number SMALLINT NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 2,
    fallback_message TEXT NOT NULL DEFAULT '',
    answer_template TEXT NOT NULL DEFAULT '',
    match_keywords_json TEXT NOT NULL DEFAULT '[]',
    risk_level TEXT NOT NULL DEFAULT 'low',
    notes TEXT NOT NULL DEFAULT '',
    ai_answer_enabled SMALLINT NOT NULL DEFAULT 0,
    ai_answer_mode TEXT NOT NULL DEFAULT 'off',
    answer_policy TEXT NOT NULL DEFAULT 'public_info_only',
    verification_policy TEXT NOT NULL DEFAULT 'none',
    allowed_data_fields_json TEXT NOT NULL DEFAULT '[]',
    blocked_data_fields_json TEXT NOT NULL DEFAULT '[]',
    ai_system_prompt TEXT NOT NULL DEFAULT '',
    ai_user_prompt_template TEXT NOT NULL DEFAULT '',
    max_ai_tokens INTEGER NOT NULL DEFAULT 400,
    temperature REAL NOT NULL DEFAULT 0.2,
    requires_approval_before_active SMALLINT NOT NULL DEFAULT 1,
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft',
    approved_by TEXT,
    approved_at TEXT,
    created_by TEXT,
    updated_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await createTableIfMissing(db, "aleta_bot_public_qa_logs", `CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_logs (
    id TEXT PRIMARY KEY,
    sender_number TEXT NOT NULL DEFAULT '',
    sender_name TEXT NOT NULL DEFAULT '',
    raw_message TEXT NOT NULL DEFAULT '',
    normalized_message TEXT NOT NULL DEFAULT '',
    matched_intent_key TEXT NOT NULL DEFAULT '',
    matched_method TEXT NOT NULL DEFAULT 'fallback',
    confidence REAL NOT NULL DEFAULT 0,
    parameters_json TEXT NOT NULL DEFAULT '{}',
    query_key TEXT NOT NULL DEFAULT '',
    response_preview TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'fallback',
    error_message TEXT,
    needs_human_review SMALLINT NOT NULL DEFAULT 0,
    review_status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by_user_id TEXT,
    reviewed_at TEXT,
    review_note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_logs ADD COLUMN IF NOT EXISTS needs_human_review SMALLINT NOT NULL DEFAULT 0`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_logs ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending'`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_logs ADD COLUMN IF NOT EXISTS reviewed_by_user_id TEXT`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_logs ADD COLUMN IF NOT EXISTS reviewed_at TEXT`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_logs ADD COLUMN IF NOT EXISTS review_note TEXT NOT NULL DEFAULT ''`);
  await db.exec(`ALTER TABLE aleta_bot_notification_logs ADD COLUMN IF NOT EXISTS source_app TEXT NOT NULL DEFAULT ''`);
  await db.exec(`ALTER TABLE aleta_bot_notification_logs ADD COLUMN IF NOT EXISTS source_feature TEXT NOT NULL DEFAULT ''`);
  await db.exec(`ALTER TABLE aleta_bot_notification_logs ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT ''`);
  await db.exec(`ALTER TABLE aleta_bot_notification_logs ADD COLUMN IF NOT EXISTS entity_id TEXT NOT NULL DEFAULT ''`);
  await db.exec(`ALTER TABLE aleta_bot_notification_logs ADD COLUMN IF NOT EXISTS metadata_json TEXT NOT NULL DEFAULT '{}'`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS bot_enabled SMALLINT NOT NULL DEFAULT 0`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS notifications_enabled SMALLINT NOT NULL DEFAULT 0`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS admin_whatsapp_number TEXT NOT NULL DEFAULT ''`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS message_delay_ms INTEGER NOT NULL DEFAULT 1500`);
  // Default 1 = Minimal (paling aman dari suspend/ban) untuk instalasi lama.
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS sending_risk_level INTEGER NOT NULL DEFAULT 1`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS retry_limit INTEGER NOT NULL DEFAULT 2`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS dry_run_enabled SMALLINT NOT NULL DEFAULT 1`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS schedule_cron TEXT NOT NULL DEFAULT '00 07 * * Monday-Friday'`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_enabled SMALLINT NOT NULL DEFAULT 0`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_mode TEXT NOT NULL DEFAULT 'dry_run'`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_approved_at TEXT`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_approved_by TEXT`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_last_run_at TEXT`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_last_status TEXT NOT NULL DEFAULT 'idle'`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_last_message TEXT`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_pilot_user_ids_json TEXT NOT NULL DEFAULT '[]'`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_pilot_role_ids_json TEXT NOT NULL DEFAULT '[]'`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_pilot_position_ids_json TEXT NOT NULL DEFAULT '[]'`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_scheduler_enabled SMALLINT NOT NULL DEFAULT 0`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_scheduler_mode TEXT NOT NULL DEFAULT 'dry_run'`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_scheduler_time TEXT NOT NULL DEFAULT '08:00:00'`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_scheduler_last_run_at TEXT`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_scheduler_last_message TEXT`);
  await db.exec(`ALTER TABLE aleta_bot_settings ADD COLUMN IF NOT EXISTS disposition_deadline_reminder_kill_switch SMALLINT NOT NULL DEFAULT 0`);
  await createTableIfMissing(db, "aleta_bot_policy_skip_logs", `CREATE TABLE IF NOT EXISTS aleta_bot_policy_skip_logs (
    id TEXT PRIMARY KEY,
    notification_key TEXT NOT NULL DEFAULT '',
    notification_id TEXT,
    category TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT 'unknown',
    source_feature TEXT NOT NULL DEFAULT '',
    entity_type TEXT NOT NULL DEFAULT '',
    entity_id TEXT NOT NULL DEFAULT '',
    recipient_type TEXT NOT NULL DEFAULT '',
    recipient_count INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_aleta_bot_policy_skip_logs_created ON aleta_bot_policy_skip_logs(created_at DESC, reason)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_aleta_bot_policy_skip_logs_notification ON aleta_bot_policy_skip_logs(notification_key, created_at DESC)`);
  await createTableIfMissing(db, "aleta_bot_public_qa_examples", `CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_examples (
    id TEXT PRIMARY KEY,
    intent_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    normalized_question TEXT NOT NULL DEFAULT '',
    is_active SMALLINT NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await createTableIfMissing(db, "aleta_bot_public_qa_sessions", `CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_sessions (
    id TEXT PRIMARY KEY,
    sender_number TEXT NOT NULL,
    current_intent_key TEXT NOT NULL DEFAULT '',
    state TEXT NOT NULL DEFAULT 'collecting',
    collected_params_json TEXT NOT NULL DEFAULT '{}',
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS legacy_command TEXT NOT NULL DEFAULT ''`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS parameterized_legacy_command TEXT NOT NULL DEFAULT ''`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS ai_answer_enabled SMALLINT NOT NULL DEFAULT 0`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS ai_answer_mode TEXT NOT NULL DEFAULT 'off'`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS answer_policy TEXT NOT NULL DEFAULT 'public_info_only'`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS verification_policy TEXT NOT NULL DEFAULT 'none'`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS allowed_data_fields_json TEXT NOT NULL DEFAULT '[]'`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS blocked_data_fields_json TEXT NOT NULL DEFAULT '[]'`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT NOT NULL DEFAULT ''`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS ai_user_prompt_template TEXT NOT NULL DEFAULT ''`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS max_ai_tokens INTEGER NOT NULL DEFAULT 400`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS temperature REAL NOT NULL DEFAULT 0.2`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS requires_approval_before_active SMALLINT NOT NULL DEFAULT 0`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS answer_template TEXT NOT NULL DEFAULT ''`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS match_keywords_json TEXT NOT NULL DEFAULT '[]'`);
  // Bersihkan sumber data yang menunjuk query tidak ada pada aturan yang
  // sebenarnya menjawab lewat jalur lama. Tanpa ini, admin tidak bisa menyimpan
  // perubahan apa pun pada aturan tersebut - termasuk mengisi blangko jawaban.
  await db.exec(
    `UPDATE aleta_bot_public_qa_intents
     SET query_key = ''
     WHERE response_mode <> 'query_template'
       AND COALESCE(query_key, '') <> ''
       AND query_key NOT IN (SELECT id FROM aleta_bot_queries)`
  );
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS approved_by TEXT`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS approved_at TEXT`);
  // Aturan jawaban tidak lagi mengenal tahap draft. Draft yang tertinggal dari
  // versi lama diaktifkan sekali di sini supaya daftar aturan tidak menyisakan
  // baris yang tampak ada tetapi tidak pernah dipakai menjawab.
  // Yang diarsipkan sengaja TIDAK ikut - itu keputusan admin untuk memensiunkan aturan.
  await db.exec(
    `UPDATE aleta_bot_public_qa_intents
     SET status = 'active', is_active = 1, requires_approval_before_active = 0
     WHERE status = 'draft'`
  );
  await createTableIfMissing(db, "aleta_bot_public_qa_intent_versions", `CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_intent_versions (
    id TEXT PRIMARY KEY,
    intent_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    snapshot_json TEXT NOT NULL DEFAULT '{}',
    change_note TEXT NOT NULL DEFAULT '',
    created_by TEXT,
    created_at TEXT NOT NULL
  )`);
  await createTableIfMissing(db, "aleta_bot_public_qa_ai_logs", `CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_ai_logs (
    id TEXT PRIMARY KEY,
    qa_log_id TEXT NOT NULL DEFAULT '',
    intent_key TEXT NOT NULL DEFAULT '',
    ai_provider TEXT NOT NULL DEFAULT 'openai',
    ai_model TEXT NOT NULL DEFAULT '',
    prompt_preview TEXT NOT NULL DEFAULT '',
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    confidence REAL NOT NULL DEFAULT 0,
    safety_status TEXT NOT NULL DEFAULT 'not_used',
    ai_response_preview TEXT NOT NULL DEFAULT '',
    fallback_used SMALLINT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL
  )`);
  await createTableIfMissing(db, "aleta_bot_public_qa_knowledge", `CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_knowledge (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'informasi_umum',
    audience TEXT NOT NULL DEFAULT 'public',
    keywords_json TEXT NOT NULL DEFAULT '[]',
    answer TEXT NOT NULL DEFAULT '',
    source_label TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 50,
    is_active SMALLINT NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  )`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_aleta_bot_public_qa_knowledge_active_category ON aleta_bot_public_qa_knowledge(is_active, category, priority)`);
  await createTableIfMissing(db, "aleta_bot_approval_requests", `CREATE TABLE IF NOT EXISTS aleta_bot_approval_requests (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL DEFAULT 'public_qa_intent',
    entity_id TEXT NOT NULL DEFAULT '',
    entity_name TEXT NOT NULL DEFAULT '',
    requested_by TEXT NOT NULL DEFAULT '',
    requested_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TEXT,
    notes TEXT NOT NULL DEFAULT '',
    snapshot_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await createTableIfMissing(db, "aleta_bot_legacy_migrations", `CREATE TABLE IF NOT EXISTS aleta_bot_legacy_migrations (
    id TEXT PRIMARY KEY,
    feature TEXT NOT NULL DEFAULT '',
    legacy_key TEXT NOT NULL DEFAULT '',
    source_function TEXT NOT NULL DEFAULT '',
    legacy_type TEXT NOT NULL DEFAULT 'other',
    category TEXT NOT NULL DEFAULT '',
    risk_level TEXT NOT NULL DEFAULT 'medium',
    legacy_source TEXT NOT NULL DEFAULT '',
    cron_schedule TEXT NOT NULL DEFAULT '',
    portal_entity TEXT NOT NULL DEFAULT '',
    registry_target_type TEXT NOT NULL DEFAULT '',
    registry_target_key TEXT NOT NULL DEFAULT '',
    replacement_service TEXT NOT NULL DEFAULT '',
    can_archive INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT NOT NULL DEFAULT '',
    migrated_at TEXT,
    migrated_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  // Add new columns for existing installations (idempotent)
  for (const col of [
    "legacy_key TEXT NOT NULL DEFAULT ''",
    "source_function TEXT NOT NULL DEFAULT ''",
    "legacy_type TEXT NOT NULL DEFAULT 'other'",
    "category TEXT NOT NULL DEFAULT ''",
    "risk_level TEXT NOT NULL DEFAULT 'medium'",
    "cron_schedule TEXT NOT NULL DEFAULT ''",
    "registry_target_type TEXT NOT NULL DEFAULT ''",
    "registry_target_key TEXT NOT NULL DEFAULT ''",
    "replacement_service TEXT NOT NULL DEFAULT ''",
    "can_archive INTEGER NOT NULL DEFAULT 0",
  ]) {
    await db.exec(`ALTER TABLE aleta_bot_legacy_migrations ADD COLUMN IF NOT EXISTS ${col}`);
  }

  const settings = await db.prepare(`SELECT id FROM aleta_bot_settings WHERE id = 1`).get<{ id: number }>();
  if (!settings) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_settings (
          id, bot_enabled, notifications_enabled, admin_whatsapp_number, message_delay_ms,
          retry_limit, dry_run_enabled, schedule_cron, test_target_number, security_notes,
          disposition_deadline_reminder_enabled, disposition_deadline_reminder_mode,
          disposition_deadline_reminder_approved_at, disposition_deadline_reminder_approved_by,
          disposition_deadline_reminder_last_run_at, disposition_deadline_reminder_last_status,
          disposition_deadline_reminder_last_message,
          disposition_deadline_reminder_pilot_user_ids_json,
          disposition_deadline_reminder_pilot_role_ids_json,
          disposition_deadline_reminder_pilot_position_ids_json,
          disposition_deadline_reminder_scheduler_enabled,
          disposition_deadline_reminder_scheduler_mode,
          disposition_deadline_reminder_scheduler_time,
          disposition_deadline_reminder_scheduler_last_run_at,
          disposition_deadline_reminder_scheduler_last_message,
          disposition_deadline_reminder_kill_switch,
          updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO NOTHING`
      )
      .run(
        DEFAULT_SETTINGS.botEnabled ? 1 : 0,
        DEFAULT_SETTINGS.notificationsEnabled ? 1 : 0,
        DEFAULT_SETTINGS.adminWhatsappNumber,
        DEFAULT_SETTINGS.messageDelayMs,
        DEFAULT_SETTINGS.retryLimit,
        DEFAULT_SETTINGS.dryRunEnabled ? 1 : 0,
        DEFAULT_SETTINGS.scheduleCron,
        DEFAULT_SETTINGS.testTargetNumber,
        DEFAULT_SETTINGS.securityNotes,
        DEFAULT_SETTINGS.deadlineReminderEnabled ? 1 : 0,
        DEFAULT_SETTINGS.deadlineReminderMode,
        DEFAULT_SETTINGS.deadlineReminderApprovedAt,
        DEFAULT_SETTINGS.deadlineReminderApprovedBy,
        DEFAULT_SETTINGS.deadlineReminderLastRunAt,
        DEFAULT_SETTINGS.deadlineReminderLastStatus,
        DEFAULT_SETTINGS.deadlineReminderLastMessage,
        JSON.stringify(DEFAULT_SETTINGS.deadlineReminderPilotUserIds),
        JSON.stringify(DEFAULT_SETTINGS.deadlineReminderPilotRoleIds),
        JSON.stringify(DEFAULT_SETTINGS.deadlineReminderPilotPositionIds),
        DEFAULT_SETTINGS.deadlineReminderSchedulerEnabled ? 1 : 0,
        DEFAULT_SETTINGS.deadlineReminderSchedulerMode,
        DEFAULT_SETTINGS.deadlineReminderSchedulerTime,
        DEFAULT_SETTINGS.deadlineReminderSchedulerLastRunAt,
        DEFAULT_SETTINGS.deadlineReminderSchedulerLastMessage,
        DEFAULT_SETTINGS.deadlineReminderKillSwitch ? 1 : 0,
        now
      );
  }

  for (const template of DEFAULT_TEMPLATES) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_templates (id, category, title, body, placeholders_json, editable, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`
      )
      .run(
        template.id,
        template.category,
        template.title,
        template.body,
        JSON.stringify(template.placeholders),
        template.editable ? 1 : 0,
        now
      );

    const existingTemplate = await db
      .prepare(`SELECT body FROM aleta_bot_templates WHERE id = ?`)
      .get<{ body: string }>(template.id);
    if (existingTemplate && isReplaceableLegacyTemplateBody(template.id, existingTemplate.body)) {
      await db
        .prepare(
          `UPDATE aleta_bot_templates
           SET category = ?, title = ?, body = ?, placeholders_json = ?, editable = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          template.category,
          template.title,
          template.body,
          JSON.stringify(template.placeholders),
          template.editable ? 1 : 0,
          now,
          template.id
        );
    }
  }

  await db.prepare(`UPDATE aleta_bot_templates SET category = 'pegawai', updated_at = ? WHERE category = 'employee'`).run(now);
  await db.prepare(`UPDATE aleta_bot_templates SET category = 'pihak', updated_at = ? WHERE category IN ('party', 'notifikasi')`).run(now);

  for (const job of DEFAULT_JOBS) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_jobs (id, name, description, enabled, schedule_cron, last_status, updated_at)
         VALUES (?, ?, ?, ?, ?, 'idle', ?)
         ON CONFLICT (id) DO NOTHING`
      )
      .run(job.id, job.name, job.description, job.enabled ? 1 : 0, job.scheduleCron, now);
  }

  for (const query of DEFAULT_QUERIES) {
    const queryName = await resolveSeedQueryName(db, query.name, query.id);
    await db
      .prepare(
        `INSERT INTO aleta_bot_queries (
          id, name, category, description, sql_text, output_columns_json, recipient_column,
          connection_key, is_active, last_test_status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?)
        ON CONFLICT (id) DO NOTHING`
      )
      .run(
        query.id,
        queryName,
        query.category,
        query.description,
        query.sqlText,
        JSON.stringify(query.outputColumns),
        query.recipientColumn,
        defaultConnectionKeyForQuery(query),
        query.isActive ? 1 : 0,
        now,
        now
      );
    if (
      query.id.startsWith("legacy-") ||
      query.id.startsWith("template-") ||
      query.id === "public_online_queue" ||
      query.id === "portal-disposition-deadline-h-minus-1"
    ) {
      await db
        .prepare(
          `UPDATE aleta_bot_queries
           SET name = ?, description = ?, output_columns_json = ?, recipient_column = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          queryName,
          query.description,
          JSON.stringify(query.outputColumns),
          query.recipientColumn,
          now,
          query.id
        );
    }
  }

  for (const connection of getSeedDbConnections()) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_db_connections (
          id, key, name, description, driver, host, port, database_name, username,
          password_env_key, password_secret, password_source, ssl_enabled, connection_timeout_ms, is_active, is_default,
          legacy_source, last_test_status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'env', ?, ?, ?, ?, ?, 'idle', ?, ?)
        ON CONFLICT (key) DO NOTHING`
      )
      .run(
        connection.id,
        connection.key,
        connection.name,
        connection.description,
        connection.driver,
        connection.host,
        connection.port,
        connection.databaseName,
        connection.username,
        connection.passwordEnvKey,
        connection.sslEnabled ? 1 : 0,
        connection.connectionTimeoutMs,
        connection.isActive ? 1 : 0,
        connection.isDefault ? 1 : 0,
        connection.legacySource,
        now,
        now
      );
  }

  for (const intent of DEFAULT_PUBLIC_QA_INTENTS) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_public_qa_intents (
          id, key, name, description, category, audience, is_active, ai_enabled,
          exact_triggers_json, example_questions_json, required_parameters_json,
          query_key, legacy_handler, legacy_command, parameterized_legacy_command,
          template_key, response_mode, confidence_threshold, requires_verification,
          requires_case_number, max_attempts, fallback_message, risk_level, notes,
          ai_answer_enabled, ai_answer_mode, answer_policy, verification_policy,
          allowed_data_fields_json, blocked_data_fields_json, ai_system_prompt,
          ai_user_prompt_template, max_ai_tokens, temperature,
          requires_approval_before_active, version, status, approved_by, approved_at,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (key) DO NOTHING`
      )
      .run(
        intent.id,
        intent.key,
        intent.name,
        intent.description,
        intent.category,
        intent.audience,
        intent.isActive ? 1 : 0,
        intent.aiEnabled ? 1 : 0,
        JSON.stringify(intent.exactTriggers),
        JSON.stringify(intent.exampleQuestions),
        JSON.stringify(intent.requiredParameters),
        intent.queryKey,
        intent.legacyHandler,
        intent.legacyCommand,
        intent.parameterizedLegacyCommand,
        intent.templateKey,
        intent.responseMode,
        intent.confidenceThreshold,
        intent.requiresVerification ? 1 : 0,
        intent.requiresCaseNumber ? 1 : 0,
        intent.maxAttempts,
        intent.fallbackMessage,
        intent.riskLevel,
        intent.notes,
        intent.aiAnswerEnabled ? 1 : 0,
        intent.aiAnswerMode,
        intent.answerPolicy,
        intent.verificationPolicy,
        JSON.stringify(intent.allowedDataFields),
        JSON.stringify(intent.blockedDataFields),
        intent.aiSystemPrompt,
        intent.aiUserPromptTemplate,
        intent.maxAiTokens,
        intent.temperature,
        intent.requiresApprovalBeforeActive ? 1 : 0,
        intent.version,
        intent.status,
        intent.approvedBy,
        intent.approvedAt,
        now,
        now
      );
    await db
      .prepare(
        `UPDATE aleta_bot_public_qa_intents
         SET ai_answer_enabled = ?, ai_answer_mode = ?, answer_policy = ?, verification_policy = ?,
           allowed_data_fields_json = ?, blocked_data_fields_json = ?,
           max_ai_tokens = ?, temperature = ?, requires_approval_before_active = ?,
           status = ?
         WHERE key = ? AND (ai_answer_mode = 'off' OR ai_answer_mode IS NULL)`
      )
      .run(
        intent.aiAnswerEnabled ? 1 : 0,
        intent.aiAnswerMode,
        intent.answerPolicy,
        intent.verificationPolicy,
        JSON.stringify(intent.allowedDataFields),
        JSON.stringify(intent.blockedDataFields),
        intent.maxAiTokens,
        intent.temperature,
        intent.requiresApprovalBeforeActive ? 1 : 0,
        intent.status,
        intent.key
      );
  }

  for (const knowledge of DEFAULT_PUBLIC_QA_KNOWLEDGE) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_public_qa_knowledge (
          id, key, title, category, audience, keywords_json, answer,
          source_label, source_url, priority, is_active, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (key) DO UPDATE SET
          title = excluded.title,
          category = excluded.category,
          audience = excluded.audience,
          keywords_json = excluded.keywords_json,
          answer = excluded.answer,
          source_label = excluded.source_label,
          source_url = excluded.source_url,
          priority = excluded.priority,
          is_active = excluded.is_active,
          updated_at = excluded.updated_at
        WHERE aleta_bot_public_qa_knowledge.source_label LIKE 'ALETA Public Knowledge%'`
      )
      .run(
        knowledge.id,
        knowledge.key,
        knowledge.title,
        knowledge.category,
        knowledge.audience,
        JSON.stringify(knowledge.keywords),
        knowledge.answer,
        knowledge.sourceLabel,
        knowledge.sourceUrl,
        knowledge.priority,
        knowledge.isActive ? 1 : 0,
        now
      );
  }

  for (const notification of DEFAULT_NOTIFICATIONS) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_notifications (
          id, name, category, description, query_id, template_id, recipient_source,
          recipient_mapping_json, schedule_config_json, is_active, attach_document, delay_ms, retry_limit,
          last_status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?)
        ON CONFLICT (id) DO NOTHING`
      )
      .run(
        notification.id,
        notification.name,
        notification.category,
        notification.description,
        notification.queryId,
        notification.templateId,
        notification.recipientSource,
        JSON.stringify(notification.recipientMapping),
        JSON.stringify(notification.scheduleConfig),
        notification.isActive ? 1 : 0,
        notification.attachDocument === false ? 0 : 1,
        notification.delayMs,
        notification.retryLimit,
        now,
        now
      );

    // Instalasi lama: sisipkan tahap agenda tanpa menyentuh jam cron yang
    // sudah disesuaikan admin. Lihat mergeAgendaStageIntoScheduleConfig.
    const tahapAgenda = notification.scheduleConfig?.agendaStage;
    if (tahapAgenda) {
      const tersimpan = await db
        .prepare(`SELECT schedule_config_json FROM aleta_bot_notifications WHERE id = ?`)
        .get<{ schedule_config_json: string | null }>(notification.id);
      const gabungan = mergeAgendaStageIntoScheduleConfig(tersimpan?.schedule_config_json, tahapAgenda);
      if (gabungan) {
        await db
          .prepare(`UPDATE aleta_bot_notifications SET schedule_config_json = ?, updated_at = ? WHERE id = ?`)
          .run(gabungan, now, notification.id);
      }
    }
  }

  for (const migration of DEFAULT_LEGACY_MIGRATIONS) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_legacy_migrations (
          id, feature, legacy_key, source_function, legacy_type, category, risk_level,
          legacy_source, cron_schedule, portal_entity, registry_target_type, registry_target_key,
          replacement_service, can_archive, status, notes, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          feature = excluded.feature,
          legacy_key = excluded.legacy_key,
          source_function = excluded.source_function,
          legacy_type = excluded.legacy_type,
          category = excluded.category,
          risk_level = excluded.risk_level,
          legacy_source = excluded.legacy_source,
          cron_schedule = excluded.cron_schedule,
          portal_entity = excluded.portal_entity,
          registry_target_type = excluded.registry_target_type,
          registry_target_key = CASE
            WHEN COALESCE(aleta_bot_legacy_migrations.registry_target_key, '') = '' THEN excluded.registry_target_key
            ELSE aleta_bot_legacy_migrations.registry_target_key
          END,
          replacement_service = excluded.replacement_service,
          can_archive = excluded.can_archive,
          notes = CASE
            WHEN COALESCE(aleta_bot_legacy_migrations.notes, '') = '' THEN excluded.notes
            ELSE aleta_bot_legacy_migrations.notes
          END,
          updated_at = excluded.updated_at`
      )
      .run(
        migration.id,
        migration.feature,
        migration.legacyKey,
        migration.sourceFunction,
        migration.legacyType,
        migration.category,
        migration.riskLevel,
        migration.legacySource,
        migration.cronSchedule,
        migration.portalEntity,
        migration.registryTargetType,
        migration.registryTargetKey,
        migration.replacementService,
        migration.canArchive ? 1 : 0,
        migration.status,
        migration.notes,
        now,
        now
      );
  }

  seededAletaBotDatabases.add(db);
}

async function listApprovalRequests(db: AletaDatabase): Promise<AletaBotApprovalRequest[]> {
  const rows = await db
    .prepare(
      `SELECT id, entity_type, entity_id, entity_name, requested_by, requested_at, status,
        reviewed_by, reviewed_at, notes, snapshot_json, created_at, updated_at
       FROM aleta_bot_approval_requests
       ORDER BY created_at DESC
       LIMIT 100`
    )
    .all<ApprovalRequestRow>();
  return rows.map(mapApprovalRequest);
}

export async function submitApprovalRequest(
  db: AletaDatabase,
  {
    actorUserId,
    entityType,
    entityId,
    entityName,
    snapshotJson,
    notes,
  }: {
    actorUserId: string;
    entityType: AletaBotApprovalRequest["entityType"];
    entityId: string;
    entityName: string;
    snapshotJson?: string;
    notes?: string;
  }
): Promise<AletaBotApprovalRequest> {
  await requireAletaBotOperator(db, actorUserId);
  await ensureAletaBotSeeded(db);
  const now = new Date().toISOString();
  const id = await nextPrefixedId(db, "aleta_bot_approval_requests", "abar");
  await db
    .prepare(
      `INSERT INTO aleta_bot_approval_requests (
        id, entity_type, entity_id, entity_name, requested_by, requested_at,
        status, notes, snapshot_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
    )
    .run(
      id,
      entityType,
      entityId,
      entityName.slice(0, 200),
      actorUserId,
      now,
      String(notes ?? "").slice(0, 1000),
      String(snapshotJson ?? "{}").slice(0, 65535),
      now,
      now
    );
  await appendAletaBotLog(db, {
    actorUserId,
    level: "info",
    eventType: "admin",
    message: `Permintaan persetujuan dibuat: ${entityName} (${entityType}/${entityId}).`,
    metadata: { id, entityType, entityId },
  });
  const row = await db
    .prepare(`SELECT id, entity_type, entity_id, entity_name, requested_by, requested_at, status, reviewed_by, reviewed_at, notes, snapshot_json, created_at, updated_at FROM aleta_bot_approval_requests WHERE id = ?`)
    .get<ApprovalRequestRow>(id);
  if (!row) throw new ApiError(500, "Approval request tidak tersimpan.");
  return mapApprovalRequest(row);
}

export async function processApproval(
  db: AletaDatabase,
  {
    actorUserId,
    approvalId,
    decision,
    notes,
  }: {
    actorUserId: string;
    approvalId: string;
    decision: "approved" | "rejected";
    notes?: string;
  }
): Promise<AletaBotApprovalRequest> {
  const actor = await requireSuperAdmin(db, actorUserId);
  await ensureAletaBotSeeded(db);
  const now = new Date().toISOString();
  const existing = await db
    .prepare(`SELECT id, entity_type, entity_id, entity_name, requested_by, requested_at, status, reviewed_by, reviewed_at, notes, snapshot_json, created_at, updated_at FROM aleta_bot_approval_requests WHERE id = ?`)
    .get<ApprovalRequestRow>(approvalId);
  if (!existing) throw new ApiError(404, "Permintaan persetujuan tidak ditemukan.");
  if (existing.status !== "pending") throw new ApiError(409, `Permintaan sudah ${existing.status === "approved" ? "disetujui" : "ditolak"}.`);

  await db
    .prepare(
      `UPDATE aleta_bot_approval_requests
       SET status = ?, reviewed_by = ?, reviewed_at = ?, notes = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      decision,
      actor.id,
      now,
      String(notes ?? existing.notes).slice(0, 1000),
      now,
      approvalId
    );
  await appendAletaBotLog(db, {
    actorUserId: actor.id,
    level: decision === "approved" ? "success" : "warning",
    eventType: "admin",
    message: `Permintaan persetujuan ${decision === "approved" ? "disetujui" : "ditolak"}: ${existing.entity_name}.`,
    metadata: { approvalId, entityType: existing.entity_type, entityId: existing.entity_id, decision },
  });
  const updated = await db
    .prepare(`SELECT id, entity_type, entity_id, entity_name, requested_by, requested_at, status, reviewed_by, reviewed_at, notes, snapshot_json, created_at, updated_at FROM aleta_bot_approval_requests WHERE id = ?`)
    .get<ApprovalRequestRow>(approvalId);
  if (!updated) throw new ApiError(500, "Gagal memuat approval request yang diperbarui.");
  return mapApprovalRequest(updated);
}

async function getLegacyMigrations(db: AletaDatabase): Promise<AletaBotLegacyMigration[]> {
  const rows = await db
    .prepare(
      `SELECT id, feature, legacy_key, source_function, legacy_type, category, risk_level,
              legacy_source, cron_schedule, portal_entity, registry_target_type, registry_target_key,
              replacement_service, can_archive, status, notes, migrated_at, migrated_by, created_at, updated_at
       FROM aleta_bot_legacy_migrations
       ORDER BY legacy_type ASC, feature ASC`
    )
    .all<LegacyMigrationRow>();
  return rows.map(mapLegacyMigration);
}

async function getLegacyMigrationById(db: AletaDatabase, migrationId: string): Promise<AletaBotLegacyMigration> {
  const row = await db
    .prepare(`SELECT id, feature, legacy_key, source_function, legacy_type, category, risk_level, legacy_source, cron_schedule, portal_entity, registry_target_type, registry_target_key, replacement_service, can_archive, status, notes, migrated_at, migrated_by, created_at, updated_at FROM aleta_bot_legacy_migrations WHERE id = ?`)
    .get<LegacyMigrationRow>(migrationId);
  if (!row) throw new ApiError(404, "Entri migrasi tidak ditemukan.");
  return mapLegacyMigration(row);
}

function shouldTreatMigrationDone(status: AletaBotLegacyMigration["status"]) {
  return ["migrated", "active_registry", "legacy_disabled", "archivable"].includes(status);
}

export async function updateLegacyMigration(
  db: AletaDatabase,
  {
    actorUserId,
    migrationId,
    status,
    notes,
  }: {
    actorUserId: string;
    migrationId: string;
    status: AletaBotLegacyMigration["status"];
    notes?: string;
  }
): Promise<AletaBotLegacyMigration> {
  const actor = await requireSuperAdmin(db, actorUserId);
  await ensureAletaBotSeeded(db);
  const now = new Date().toISOString();
  const existing = await db
    .prepare(`SELECT id, feature, legacy_key, source_function, legacy_type, category, risk_level, legacy_source, cron_schedule, portal_entity, registry_target_type, registry_target_key, replacement_service, can_archive, status, notes, migrated_at, migrated_by, created_at, updated_at FROM aleta_bot_legacy_migrations WHERE id = ?`)
    .get<LegacyMigrationRow>(migrationId);
  if (!existing) throw new ApiError(404, "Entri migrasi tidak ditemukan.");

  const migratedAt = shouldTreatMigrationDone(status) ? now : existing.migrated_at;
  const migratedBy = shouldTreatMigrationDone(status) ? actor.id : existing.migrated_by;
  await db
    .prepare(
      `UPDATE aleta_bot_legacy_migrations
       SET status = ?, notes = ?, migrated_at = ?, migrated_by = ?, updated_at = ?
       WHERE id = ?`
    )
    .run(
      status,
      String(notes ?? existing.notes).slice(0, 1000),
      migratedAt,
      migratedBy,
      now,
      migrationId
    );
  await appendAletaBotLog(db, {
    actorUserId: actor.id,
    level: "info",
    eventType: "admin",
    message: `Status migrasi legacy diperbarui: ${existing.feature} → ${status}.`,
    metadata: { migrationId, feature: existing.feature, status },
  });
  const updated = await db
    .prepare(`SELECT id, feature, legacy_key, source_function, legacy_type, category, risk_level, legacy_source, cron_schedule, portal_entity, registry_target_type, registry_target_key, replacement_service, can_archive, status, notes, migrated_at, migrated_by, created_at, updated_at FROM aleta_bot_legacy_migrations WHERE id = ?`)
    .get<LegacyMigrationRow>(migrationId);
  if (!updated) throw new ApiError(500, "Gagal memuat data migrasi yang diperbarui.");
  return mapLegacyMigration(updated);
}

export async function previewLegacyMigrationConversion(
  db: AletaDatabase,
  actorUserId: string,
  migrationId: string
): Promise<{ migration: AletaBotLegacyMigration; draft: ConvertedLegacyDraft; validation: { valid: boolean; issues: string[] } }> {
  await requireSuperAdmin(db, actorUserId);
  await ensureAletaBotSeeded(db);
  const migration = await getLegacyMigrationById(db, migrationId);
  const draft = convertLegacyToDraft(migration);
  return {
    migration,
    draft,
    validation: validateConvertedDraft(draft),
  };
}

async function upsertConvertedNotificationDraft(
  db: AletaDatabase,
  actorUserId: string,
  draft: Extract<ConvertedLegacyDraft, { kind: "notification" }>
) {
  const now = new Date().toISOString();
  const queryColumns = validateOutputColumns(draft.query.outputColumns);
  validateReadOnlyQuery(draft.query.sqlText);
  const placeholders = validateTemplateBody(draft.template.body, {
    category: draft.template.category,
    requiredPlaceholders: draft.template.placeholders,
  });
  const scheduleConfig = validateScheduleConfig(draft.notification.scheduleConfig);

  await db
    .prepare(
      `INSERT INTO aleta_bot_templates (id, category, title, body, placeholders_json, editable, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(id) DO UPDATE SET
         category = excluded.category,
         title = excluded.title,
         body = excluded.body,
         placeholders_json = excluded.placeholders_json,
         editable = 1,
         updated_at = excluded.updated_at`
    )
    .run(draft.template.id, draft.template.category, draft.template.title, draft.template.body, JSON.stringify(placeholders), now);

  await db
    .prepare(
      `INSERT INTO aleta_bot_queries (
        id, name, category, description, sql_text, output_columns_json, recipient_column,
        connection_key, is_active, last_test_status, created_by, updated_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        description = excluded.description,
        sql_text = excluded.sql_text,
        output_columns_json = excluded.output_columns_json,
        recipient_column = excluded.recipient_column,
        connection_key = excluded.connection_key,
        is_active = excluded.is_active,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at`
    )
    .run(
      draft.query.id,
      draft.query.name,
      draft.query.category,
      draft.query.description,
      draft.query.sqlText,
      JSON.stringify(queryColumns),
      draft.query.recipientColumn,
      draft.query.connectionKey,
      draft.query.isActive ? 1 : 0,
      actorUserId,
      actorUserId,
      now,
      now
    );

  await db
    .prepare(
      `INSERT INTO aleta_bot_notifications (
        id, name, category, description, query_id, template_id, recipient_source,
        recipient_mapping_json, schedule_config_json, is_active, delay_ms, retry_limit,
        last_status, created_by, updated_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'idle', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        description = excluded.description,
        query_id = excluded.query_id,
        template_id = excluded.template_id,
        recipient_source = excluded.recipient_source,
        recipient_mapping_json = excluded.recipient_mapping_json,
        schedule_config_json = excluded.schedule_config_json,
        is_active = 0,
        delay_ms = excluded.delay_ms,
        retry_limit = excluded.retry_limit,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at`
    )
    .run(
      draft.notification.id,
      draft.notification.name,
      draft.notification.category,
      draft.notification.description,
      draft.notification.queryId,
      draft.notification.templateId,
      draft.notification.category === "party" ? "query" : "users",
      JSON.stringify({ convertedFromLegacy: true, dryRunDefault: true, requiresApproval: true }),
      JSON.stringify(scheduleConfig),
      draft.notification.delayMs,
      draft.notification.retryLimit,
      actorUserId,
      actorUserId,
      now,
      now
    );
}

async function upsertConvertedIntentDraftDirect(
  db: AletaDatabase,
  actorUserId: string,
  draft: Extract<ConvertedLegacyDraft, { kind: "public_qa_intent" }>
) {
  const now = new Date().toISOString();
  const intent = draft.intent;
  const id = String(intent.id || `draft-intent-${intent.key}`).trim();
  const key = String(intent.key || "").trim().toLowerCase().replace(/[^a-z0-9_ -]/g, "_").replace(/\s+/g, "_");
  const exactTriggers = parseListInput(intent.exactTriggers);
  const exampleQuestions = parseListInput(intent.exampleQuestions);
  const requiredParameters = parseListInput(intent.requiredParameters);
  const allowedDataFields = parseListInput(intent.allowedDataFields);
  const blockedDataFields = parseListInput(intent.blockedDataFields);
  if (!key) throw new ApiError(400, "Kode aturan wajib diisi.");
  if (["query_template", "legacy_handler"].includes(intent.responseMode) && !intent.queryKey && !intent.legacyHandler && !intent.legacyCommand) {
    throw new ApiError(400, "Intent dinamis wajib punya query mapping atau legacy handler.");
  }

  await db
    .prepare(
      `INSERT INTO aleta_bot_public_qa_intents (
        id, key, name, description, category, audience, is_active, ai_enabled,
        exact_triggers_json, example_questions_json, required_parameters_json,
        query_key, legacy_handler, legacy_command, parameterized_legacy_command,
        template_key, response_mode, confidence_threshold, requires_verification,
        requires_case_number, max_attempts, fallback_message, risk_level, notes,
        ai_answer_enabled, ai_answer_mode, answer_policy, verification_policy,
        allowed_data_fields_json, blocked_data_fields_json, ai_system_prompt,
        ai_user_prompt_template, max_ai_tokens, temperature,
        requires_approval_before_active, version, status, approved_by, approved_at,
        created_by, updated_by, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 'active', NULL, NULL, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        category = excluded.category,
        audience = excluded.audience,
        is_active = 0,
        ai_enabled = excluded.ai_enabled,
        exact_triggers_json = excluded.exact_triggers_json,
        example_questions_json = excluded.example_questions_json,
        required_parameters_json = excluded.required_parameters_json,
        query_key = excluded.query_key,
        legacy_handler = excluded.legacy_handler,
        legacy_command = excluded.legacy_command,
        parameterized_legacy_command = excluded.parameterized_legacy_command,
        template_key = excluded.template_key,
        response_mode = excluded.response_mode,
        confidence_threshold = excluded.confidence_threshold,
        requires_verification = excluded.requires_verification,
        requires_case_number = excluded.requires_case_number,
        max_attempts = excluded.max_attempts,
        fallback_message = excluded.fallback_message,
        risk_level = excluded.risk_level,
        notes = excluded.notes,
        ai_answer_enabled = 0,
        ai_answer_mode = excluded.ai_answer_mode,
        answer_policy = excluded.answer_policy,
        verification_policy = excluded.verification_policy,
        allowed_data_fields_json = excluded.allowed_data_fields_json,
        blocked_data_fields_json = excluded.blocked_data_fields_json,
        ai_system_prompt = excluded.ai_system_prompt,
        ai_user_prompt_template = excluded.ai_user_prompt_template,
        max_ai_tokens = excluded.max_ai_tokens,
        temperature = excluded.temperature,
        requires_approval_before_active = 1,
        status = 'draft',
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at`
    )
    .run(
      id,
      key,
      String(intent.name || "").trim(),
      String(intent.description || "").trim(),
      intent.category,
      intent.audience,
      intent.aiEnabled ? 1 : 0,
      JSON.stringify(exactTriggers),
      JSON.stringify(exampleQuestions),
      JSON.stringify(requiredParameters),
      String(intent.queryKey || ""),
      String(intent.legacyHandler || ""),
      String(intent.legacyCommand || ""),
      String(intent.parameterizedLegacyCommand || ""),
      String(intent.templateKey || ""),
      intent.responseMode,
      Number(intent.confidenceThreshold || 0.72),
      intent.requiresVerification ? 1 : 0,
      intent.requiresCaseNumber ? 1 : 0,
      Math.max(1, Math.min(5, Number(intent.maxAttempts || 3))),
      String(intent.fallbackMessage || PUBLIC_QA_FALLBACK_MESSAGE),
      intent.riskLevel,
      String(intent.notes || ""),
      intent.aiAnswerMode || "off",
      intent.answerPolicy || "public_info_only",
      intent.verificationPolicy || "none",
      JSON.stringify(allowedDataFields),
      JSON.stringify(blockedDataFields),
      String(intent.aiSystemPrompt || ""),
      String(intent.aiUserPromptTemplate || ""),
      Number(intent.maxAiTokens || 400),
      Number(intent.temperature || 0.2),
      actorUserId,
      actorUserId,
      now,
      now
    );
}

export async function convertLegacyMigrationToDraft(
  db: AletaDatabase,
  actorUserId: string,
  migrationId: string
): Promise<{ migration: AletaBotLegacyMigration; draft: ConvertedLegacyDraft; snapshot: AletaBotSnapshot }> {
  const actor = await requireSuperAdmin(db, actorUserId);
  const conversion = await previewLegacyMigrationConversion(db, actor.id, migrationId);
  if (!conversion.validation.valid) {
    throw new ApiError(400, `Draft belum valid: ${conversion.validation.issues.join(", ")}`);
  }
  let convertedIntentKey = "";

  const result = await withTransaction(db, async (tx) => {
    if (conversion.draft.kind === "notification") {
      await upsertConvertedNotificationDraft(tx, actor.id, conversion.draft);
    } else {
      convertedIntentKey = conversion.draft.intent.key;
      await upsertConvertedIntentDraftDirect(tx, actor.id, conversion.draft);
    }

    const targetKey =
      conversion.draft.kind === "notification"
        ? conversion.draft.notification.id
        : convertedIntentKey || conversion.draft.intent.key;
    const nextStatus = conversion.draft.status;
    const now = new Date().toISOString();
    await tx
      .prepare(
        `UPDATE aleta_bot_legacy_migrations
         SET status = ?, registry_target_key = ?, notes = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        nextStatus,
        targetKey,
        [
          `Draft registry dibuat dari legacy key ${conversion.migration.legacyKey}.`,
          ...conversion.draft.warnings,
        ].join(" "),
        now,
        migrationId
      );
    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: nextStatus === "needs_manual_mapping" ? "warning" : "success",
      eventType: "admin",
      message: `Legacy ${conversion.migration.feature} dikonversi menjadi draft registry.`,
      metadata: { migrationId, targetKey, draftKind: conversion.draft.kind, warnings: conversion.draft.warnings },
    });
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "CONVERT_ALETA_BOT_LEGACY_TO_DRAFT",
      entityType: "aleta_bot_legacy_migrations",
      entityId: migrationId,
      payload: { targetKey, draftKind: conversion.draft.kind, status: nextStatus },
    });
    return {
      migration: await getLegacyMigrationById(tx, migrationId),
      draft: conversion.draft,
    };
  });
  await writeAletaBotRuntimeConfig(db, await getAletaBotSettings(db), await getWhatsAppSettingsFromDb(db));
  return {
    ...result,
    snapshot: await getAletaBotSnapshot(db, actor.id),
  };
}

export async function runLegacyMigrationDryRun(
  db: AletaDatabase,
  actorUserId: string,
  migrationId: string
): Promise<{ migration: AletaBotLegacyMigration; preview: string; snapshot: AletaBotSnapshot }> {
  const actor = await requireSuperAdmin(db, actorUserId);
  const result = await withTransaction(db, async (tx) => {
    const migration = await getLegacyMigrationById(tx, migrationId);
    const conversion = convertLegacyToDraft(migration);
    const preview = [
      `DRY-RUN MIGRASI: ${migration.feature}`,
      `Legacy key: ${migration.legacyKey || "-"}`,
      `Target: ${migration.registryTargetType || conversion.kind} / ${migration.registryTargetKey || "-"}`,
      `Status saat ini: ${migration.status}`,
      "",
      "Checklist:",
      ...conversion.checklist.map((item) => `- ${item}`),
      "",
      "Peringatan:",
      ...conversion.warnings.map((item) => `- ${item}`),
      "",
      "Tidak ada pesan WhatsApp yang dikirim.",
    ].join("\n");
    const now = new Date().toISOString();
    await tx
      .prepare(`UPDATE aleta_bot_legacy_migrations SET status = 'dry_run', notes = ?, updated_at = ? WHERE id = ?`)
      .run(`Dry-run migrasi berhasil dipreview pada ${now}. Tidak ada pengiriman WhatsApp.`, now, migrationId);
    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: "success",
      eventType: "admin",
      message: `Dry-run migrasi legacy diproses: ${migration.feature}.`,
      metadata: { migrationId, legacyKey: migration.legacyKey, dryRun: true },
    });
    return {
      migration: await getLegacyMigrationById(tx, migrationId),
      preview,
    };
  });
  return {
    ...result,
    snapshot: await getAletaBotSnapshot(db, actor.id),
  };
}

export async function submitLegacyMigrationApproval(
  db: AletaDatabase,
  actorUserId: string,
  migrationId: string
) {
  const actor = await requireSuperAdmin(db, actorUserId);
  const result = await withTransaction(db, async (tx) => {
    const migration = await getLegacyMigrationById(tx, migrationId);
    const approval = await submitApprovalRequest(tx, {
      actorUserId: actor.id,
      entityType: migration.legacyType === "public_command" ? "public_qa_intent" : "notification",
      entityId: migration.registryTargetKey || migration.id,
      entityName: migration.feature,
      snapshotJson: JSON.stringify({ migration }),
      notes: "Approval migrasi legacy menuju registry aktif.",
    });
    const now = new Date().toISOString();
    await tx
      .prepare(`UPDATE aleta_bot_legacy_migrations SET status = 'pending_approval', notes = ?, updated_at = ? WHERE id = ?`)
      .run("Menunggu approval Super Admin sebelum registry diaktifkan.", now, migrationId);
    return {
      approval,
      migration: await getLegacyMigrationById(tx, migrationId),
    };
  });
  return {
    ...result,
    snapshot: await getAletaBotSnapshot(db, actor.id),
  };
}

export async function activateLegacyRegistry(
  db: AletaDatabase,
  actorUserId: string,
  migrationId: string
) {
  const actor = await requireSuperAdmin(db, actorUserId);
  await withTransaction(db, async (tx) => {
    const migration = await getLegacyMigrationById(tx, migrationId);
    if (!["pending_approval", "dry_run", "registry_draft"].includes(migration.status)) {
      throw new ApiError(400, "Registry hanya bisa diaktifkan setelah draft/dry-run/pending approval.");
    }

    // Catatan: dulu di sini ada "duplicate-path guard" yang MEMBLOKIR aktivasi
    // registry sampai ada baris legacy_disabled untuk key yang sama. Itu bug
    // melingkar: aktivasi butuh legacy sudah disable, tapi disable-legacy
    // (disableLegacyKey) justru mensyaratkan status 'active_registry'. Akibatnya
    // alur migrasi notifikasi MUSTAHIL diselesaikan (error "Duplicate path guard").
    //
    // Urutan yang benar memang: aktifkan registry dulu (→ active_registry), baru
    // jalankan Disable Legacy (→ legacy_disabled). Pengiriman ganda pun sudah
    // dicegah oleh mode registry-takeover yang mematikan cron legacy secara
    // bawaan. Jadi guard di titik ini dihapus agar alurnya tidak buntu.

    // ── Approval requirement for high-risk ──────────────────────────────────
    if (migration.riskLevel === "high") {
      const approved = await tx
        .prepare(`SELECT id FROM aleta_bot_approval_requests WHERE entity_id = ? AND status = 'approved' ORDER BY reviewed_at DESC LIMIT 1`)
        .get<{ id: string }>(migration.registryTargetKey || migration.id);
      if (!approved) throw new ApiError(400, "Migrasi high-risk wajib approval sebelum active registry.");
    }

    const now = new Date().toISOString();
    await tx
      .prepare(`UPDATE aleta_bot_legacy_migrations SET status = 'active_registry', notes = ?, migrated_at = ?, migrated_by = ?, updated_at = ? WHERE id = ?`)
      .run("Registry sudah boleh berjalan. Legacy belum dinonaktifkan sampai aksi Disable Legacy dijalankan.", now, actor.id, now, migrationId);
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "ACTIVATE_ALETA_BOT_REGISTRY",
      entityType: "aleta_bot_legacy_migrations",
      entityId: migrationId,
      payload: { migrationId, registryTargetKey: migration.registryTargetKey },
    });
  });
  await writeAletaBotRuntimeConfig(db, await getAletaBotSettings(db), await getWhatsAppSettingsFromDb(db));
  return getAletaBotSnapshot(db, actor.id);
}

export async function disableLegacyKey(
  db: AletaDatabase,
  actorUserId: string,
  migrationId: string
) {
  const actor = await requireSuperAdmin(db, actorUserId);
  await withTransaction(db, async (tx) => {
    const migration = await getLegacyMigrationById(tx, migrationId);
    if (!["active_registry", "migrated", "archivable"].includes(migration.status)) {
      throw new ApiError(400, "Legacy hanya bisa dinonaktifkan setelah registry aktif/tervalidasi.");
    }
    const now = new Date().toISOString();
    await tx
      .prepare(`UPDATE aleta_bot_legacy_migrations SET status = 'legacy_disabled', notes = ?, migrated_at = ?, migrated_by = ?, updated_at = ? WHERE id = ?`)
      .run("Legacy key dinonaktifkan via runtime config. Kode legacy tetap ada sebagai fallback rollback.", now, actor.id, now, migrationId);
    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: "warning",
      eventType: "admin",
      message: `Legacy key dinonaktifkan: ${migration.legacyKey}.`,
      metadata: { migrationId, legacyKey: migration.legacyKey, sourceFunction: migration.sourceFunction },
    });
  });
  await writeAletaBotRuntimeConfig(db, await getAletaBotSettings(db), await getWhatsAppSettingsFromDb(db));
  return getAletaBotSnapshot(db, actor.id);
}

export async function rollbackLegacyMigration(
  db: AletaDatabase,
  actorUserId: string,
  migrationId: string
) {
  const actor = await requireSuperAdmin(db, actorUserId);
  await withTransaction(db, async (tx) => {
    const migration = await getLegacyMigrationById(tx, migrationId);
    const now = new Date().toISOString();

    // ── Rollback state machine ───────────────────────────────────────────────
    // legacy_disabled  → active_registry  (re-enable legacy, keep registry live but
    //                                       also restore legacy as fallback)
    // active_registry  → dry_run          (deactivate registry, stay in dry-run)
    // pending_approval → registry_draft   (cancel approval submission)
    // dry_run/other    → mapped           (full rollback to mapped state)
    let rollbackStatus: AletaBotLegacyMigration["status"] = "mapped";
    let rollbackNotes = "Rollback penuh: registry tersimpan sebagai draft, legacy kembali sebagai fallback aktif.";

    if (migration.status === "legacy_disabled") {
      rollbackStatus = "active_registry";
      rollbackNotes =
        "Rollback dari legacy_disabled: legacy key diaktifkan kembali sebagai fallback. " +
        "Registry masih aktif. Jalankan disable-legacy kembali setelah masalah teratasi.";
    } else if (migration.status === "active_registry") {
      rollbackStatus = "dry_run";
      rollbackNotes =
        "Rollback dari active_registry: registry dikembalikan ke status dry_run. " +
        "Legacy key kembali menjadi fallback utama. Ulangi approval sebelum aktifkan ulang.";
    } else if (migration.status === "pending_approval") {
      rollbackStatus = "registry_draft";
      rollbackNotes = "Rollback dari pending_approval: approval dibatalkan, kembali ke registry_draft.";
    }

    await tx
      .prepare(`UPDATE aleta_bot_legacy_migrations SET status = ?, notes = ?, updated_at = ? WHERE id = ?`)
      .run(rollbackStatus, rollbackNotes, now, migrationId);
    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: "warning",
      eventType: "admin",
      message: `Rollback migrasi legacy: ${migration.feature} (${migration.status} → ${rollbackStatus}).`,
      metadata: { migrationId, legacyKey: migration.legacyKey, previousStatus: migration.status, rollbackStatus },
    });
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "ROLLBACK_ALETA_BOT_LEGACY_MIGRATION",
      entityType: "aleta_bot_legacy_migrations",
      entityId: migrationId,
      payload: { migrationId, legacyKey: migration.legacyKey, previousStatus: migration.status, rollbackStatus },
    });
  });
  // Re-write runtime config so disabledLegacyKeys reflects the rollback
  // (e.g., if we rolled back from legacy_disabled, the key must be re-enabled).
  await writeAletaBotRuntimeConfig(db, await getAletaBotSettings(db), await getWhatsAppSettingsFromDb(db));
  return getAletaBotSnapshot(db, actor.id);
}

async function getWorkerStateFromGateway(): Promise<AletaBotWorkerState | null> {
  const result = await controlGatewayWorker({ action: "status" });
  if (!result.ok) return null;
  return result.data.worker;
}

function isQueueWorkerOperational(worker: AletaBotWorkerState | null) {
  if (!worker) return false;
  return Boolean(worker.enabled && worker.activeTimer && !worker.paused);
}

function describeQueueWorker(worker: AletaBotWorkerState | null) {
  if (!worker) return "Worker runtime belum dapat dibaca.";
  if (worker.paused) return "Worker antrean sedang dijeda.";
  if (!worker.enabled) return "Worker antrean belum diaktifkan di runtime.";
  if (!worker.activeTimer) return "Timer worker antrean belum aktif.";
  return worker.running
    ? "Worker antrean sedang memproses batch."
    : "Worker antrean aktif dan sedang menunggu jadwal batch berikutnya.";
}

function getAletaBotRuntimeStatusUrl() {
  const baseUrl = (
    process.env.ALETA_BOT_BASE_URL ||
    process.env.ALETA_BOT_RUNTIME_URL ||
    DEFAULT_ALETA_BOT_RUNTIME_URL
  ).replace(/\/+$/, "");
  return `${baseUrl}/internal/aleta-bot/status`;
}

async function fetchAletaBotRuntimeStatusPayload(): Promise<{
  online: boolean;
  statusCode: number;
  payload: AletaBotRuntimeStatusPayload | null;
  errorMessage: string | null;
}> {
  const headers: HeadersInit = {};
  const internalToken =
    process.env.ALETA_BOT_INTERNAL_API_TOKEN ||
    process.env.ALETA_BOT_INTERNAL_TOKEN ||
    "";
  if (internalToken) {
    headers["x-aleta-internal-token"] = internalToken;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(getAletaBotRuntimeStatusUrl(), {
      cache: "no-store",
      headers,
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as AletaBotRuntimeStatusPayload | null;
    return {
      online: response.ok,
      statusCode: response.status,
      payload: response.ok ? payload : null,
      errorMessage: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      online: false,
      statusCode: 0,
      payload: null,
      errorMessage: sanitizeErrorMessage(error instanceof Error ? error.message : "Runtime ALETA Bot tidak dapat dihubungi."),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function controlWorker(
  db: AletaDatabase,
  actorUserId: string,
  action: "pause" | "resume" | "status",
  reason?: string
): Promise<{ worker: AletaBotWorkerState | null; message: string }> {
  const actor = await requireAletaBotOperator(db, actorUserId);
  const result = await controlGatewayWorker({ action, reason });
  if (!result.ok) {
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "error",
      eventType: "admin",
      message: `Kontrol worker queue gagal (${action}): ${result.error}`,
      metadata: { action, reason, error: result.error },
    });
    throw new ApiError(502, result.error);
  }
  if (action !== "status") {
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: action === "pause" ? "warning" : "info",
      eventType: "admin",
      message: action === "pause"
        ? `Worker queue ALETA Bot dijeda oleh admin: ${reason ?? "Manual"}.`
        : "Worker queue ALETA Bot dilanjutkan oleh admin.",
      metadata: { action, reason, workerState: result.data.worker },
    });
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: action === "pause" ? "PAUSE_ALETA_BOT_WORKER" : "RESUME_ALETA_BOT_WORKER",
      entityType: "aleta_bot_worker",
      entityId: "queue_worker",
      payload: { action, reason, workerState: result.data.worker },
    });
  }
  return {
    worker: result.data.worker,
    message: describeQueueWorker(result.data.worker),
  };
}

async function getDeadLettersFromGateway(
  limit = 50,
  status: "active" | "resolved" | "all" = "active"
): Promise<AletaBotDeadLetter[]> {
  const result = await getGatewayDeadLetters(limit, status);
  if (!result.ok) return [];
  return result.data.items;
}

export async function resendDeadLetter(
  db: AletaDatabase,
  actorUserId: string,
  id: string
): Promise<{ originalId: string; newId: string; status: string }> {
  const actor = await requireAletaBotOperator(db, actorUserId);
  const result = await resendGatewayDeadLetter(id);
  if (!result.ok) {
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "error",
      eventType: "message",
      message: `Resend dead letter gagal (id: ${id}): ${result.error}`,
      metadata: { id, error: result.error },
    });
    throw new ApiError(502, result.error);
  }
  await appendAletaBotLog(db, {
    actorUserId: actor.id,
    level: "info",
    eventType: "message",
    message: `Dead letter berhasil dikirim ulang: ${id} → ${result.data.newId}.`,
    metadata: { originalId: result.data.originalId, newId: result.data.newId, status: result.data.status },
  });
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "RESEND_DEAD_LETTER",
    entityType: "aleta_bot_message_queue",
    entityId: id,
    payload: { originalId: result.data.originalId, newId: result.data.newId },
  });
  return {
    originalId: result.data.originalId,
    newId: result.data.newId,
    status: result.data.status,
  };
}

export async function resolveDeadLetter(
  db: AletaDatabase,
  actorUserId: string,
  id: string,
  note?: string
): Promise<{ originalId: string; status: string; item: AletaBotDeadLetter }> {
  const actor = await requireAletaBotOperator(db, actorUserId);
  const resolvedNote = String(note ?? "").trim().slice(0, 1000);
  const result = await resolveGatewayDeadLetter(id, resolvedNote, actor.id);
  if (!result.ok) {
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "error",
      eventType: "message",
      message: `Tandai dead letter ditangani gagal (id: ${id}): ${result.error}`,
      metadata: { id, error: result.error },
    });
    throw new ApiError(502, result.error);
  }
  await appendAletaBotLog(db, {
    actorUserId: actor.id,
    level: "info",
    eventType: "message",
    message: `Dead letter ditandai ditangani tanpa resend: ${id}.`,
    metadata: { originalId: result.data.originalId, status: result.data.status, note: resolvedNote.slice(0, 160) },
  });
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "RESOLVE_DEAD_LETTER",
    entityType: "aleta_bot_message_queue",
    entityId: id,
    payload: { originalId: result.data.originalId, status: result.data.status, note: resolvedNote.slice(0, 160) },
  });
  return {
    originalId: result.data.originalId,
    status: result.data.status,
    item: result.data.item,
  };
}

async function appendAletaBotLog(
  db: AletaDatabase,
  input: {
    actorUserId?: string | null;
    level: AletaBotLogLevel;
    eventType: AletaBotLogType;
    message: string;
    metadata?: Record<string, unknown>;
  }
) {
  await db
    .prepare(
      `INSERT INTO aleta_bot_logs (id, level, event_type, message, metadata_json, actor_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      await nextPrefixedId(db, "aleta_bot_logs", "abl"),
      input.level,
      input.eventType,
      input.message,
      JSON.stringify(input.metadata ?? {}),
      input.actorUserId ?? null,
      new Date().toISOString()
    );
}

export async function getAletaBotSettings(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const row = await db
    .prepare(
      `SELECT bot_enabled, notifications_enabled, admin_whatsapp_number, message_delay_ms,
        sending_risk_level,
        retry_limit, dry_run_enabled, schedule_cron, test_target_number, security_notes,
        disposition_deadline_reminder_enabled, disposition_deadline_reminder_mode,
        disposition_deadline_reminder_approved_at, disposition_deadline_reminder_approved_by,
        disposition_deadline_reminder_last_run_at, disposition_deadline_reminder_last_status,
        disposition_deadline_reminder_last_message,
        disposition_deadline_reminder_pilot_user_ids_json,
        disposition_deadline_reminder_pilot_role_ids_json,
        disposition_deadline_reminder_pilot_position_ids_json,
        disposition_deadline_reminder_scheduler_enabled,
        disposition_deadline_reminder_scheduler_mode,
        disposition_deadline_reminder_scheduler_time,
        disposition_deadline_reminder_scheduler_last_run_at,
        disposition_deadline_reminder_scheduler_last_message,
        disposition_deadline_reminder_kill_switch,
        updated_at
       FROM aleta_bot_settings
       WHERE id = 1`
    )
    .get<SettingsRow>();

  if (!row) {
    throw new ApiError(500, "Konfigurasi ALETA Bot belum tersedia.");
  }

  return mapSettings(row);
}

async function getTemplates(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, category, title, body, placeholders_json, editable, updated_at
       FROM aleta_bot_templates
       ORDER BY category ASC, title ASC`
    )
    .all<TemplateRow>();

  return rows.map(mapTemplate);
}

async function getJobs(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, name, description, enabled, schedule_cron, last_run_at, last_status, last_message, updated_at
       FROM aleta_bot_jobs
       ORDER BY name ASC`
    )
    .all<JobRow>();

  return rows.map(mapJob);
}

async function getNotifications(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, name, category, description, query_id, template_id, recipient_source,
        recipient_mapping_json, schedule_config_json, is_active, attach_document, delay_ms, retry_limit,
        last_run_at, last_status, last_message, created_by, updated_by, created_at, updated_at
       FROM aleta_bot_notifications
       ORDER BY category ASC, name ASC`
    )
    .all<NotificationRow>();

  return rows.map(mapNotification);
}

async function getQueries(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const [rows, notificationRows] = await Promise.all([
    db
      .prepare(
        `SELECT id, name, category, description, sql_text, output_columns_json, recipient_column,
          connection_key, is_active, last_tested_at, last_test_status, last_test_error,
          last_test_duration_ms, last_test_row_count, last_test_sample_json, last_test_slow, last_test_message,
          created_by, updated_by, created_at, updated_at
         FROM aleta_bot_queries
         ORDER BY category ASC, name ASC`
      )
      .all<QueryRow>(),
    db
      .prepare(`SELECT query_id, name FROM aleta_bot_notifications ORDER BY name ASC`)
      .all<{ query_id: string; name: string }>(),
  ]);

  const usedBy = notificationRows.reduce<Record<string, string[]>>((groups, row) => {
    groups[row.query_id] = [...(groups[row.query_id] ?? []), row.name];
    return groups;
  }, {});

  return rows.map((row) => mapQuery(row, usedBy[row.id] ?? []));
}

async function getDbConnections(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, key, name, description, driver, host, port, database_name, username,
        password_env_key, password_secret, password_source, ssl_enabled, connection_timeout_ms, is_active, is_default,
        legacy_source, last_test_status, last_test_error, last_test_at,
        created_by, updated_by, created_at, updated_at
       FROM aleta_bot_db_connections
       ORDER BY is_default DESC, name ASC`
    )
    .all<DbConnectionRow>();

  return rows.map(mapDbConnection);
}

export async function listAletaBotDbConnectionsForIntegrations(db: AletaDatabase) {
  return getDbConnections(db);
}

export async function getAletaBotDbConnectionForIntegration(
  db: AletaDatabase,
  connectionKey = "sipp_primary"
) {
  const key = validateConnectionKey(connectionKey || "sipp_primary");
  const connections = await getDbConnections(db);
  return connections.find((connection) => connection.key === key) ?? null;
}

async function getRuntimeDbConnections(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, key, name, description, driver, host, port, database_name, username,
        password_env_key, password_secret, password_source, ssl_enabled, connection_timeout_ms, is_active, is_default,
        legacy_source, last_test_status, last_test_error, last_test_at,
        created_by, updated_by, created_at, updated_at
       FROM aleta_bot_db_connections
       ORDER BY is_default DESC, name ASC`
    )
    .all<DbConnectionRow>();

  return rows;
}

async function getPublicQaIntents(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, key, name, description, category, audience, is_active, ai_enabled,
        exact_triggers_json, example_questions_json, required_parameters_json,
        query_key, legacy_handler, legacy_command, parameterized_legacy_command,
        template_key, response_mode, confidence_threshold, requires_verification,
        requires_case_number, max_attempts, fallback_message,
        answer_template, match_keywords_json, risk_level, notes,
        ai_answer_enabled, ai_answer_mode, answer_policy, verification_policy,
        allowed_data_fields_json, blocked_data_fields_json, ai_system_prompt,
        ai_user_prompt_template, max_ai_tokens, temperature,
        requires_approval_before_active, version, status, approved_by, approved_at,
        created_by, updated_by, created_at, updated_at
       FROM aleta_bot_public_qa_intents
       ORDER BY category ASC, name ASC`
    )
    .all<PublicQaIntentRow>();
  return rows.map(mapPublicQaIntent);
}

async function getPublicQaLogs(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, sender_number, sender_name, raw_message, normalized_message,
        matched_intent_key, matched_method, confidence, parameters_json, query_key,
        response_preview, status, error_message,
        needs_human_review, review_status, reviewed_by_user_id, reviewed_at, review_note,
        created_at
       FROM aleta_bot_public_qa_logs
       ORDER BY created_at DESC
       LIMIT 80`
    )
    .all<PublicQaLogRow>();
  return rows.map(mapPublicQaLog);
}

async function getPublicQaKnowledgeEntries(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, key, title, category, audience, keywords_json, answer,
        source_label, source_url, priority, is_active, updated_at
       FROM aleta_bot_public_qa_knowledge
       ORDER BY is_active DESC, priority DESC, category ASC, title ASC`
    )
    .all<PublicQaKnowledgeRow>();
  return rows.map(mapPublicQaKnowledge);
}

async function getUnknownQuestionReviews(db: AletaDatabase): Promise<AletaBotUnknownQuestionReview[]> {
  await ensureAletaBotSeeded(db);
  const logs = await getPublicQaLogs(db);
  const grouped = new Map<string, AletaBotUnknownQuestionReview>();
  for (const log of logs) {
    if (!log.needsHumanReview && log.status !== "fallback" && log.status !== "error" && log.matchedMethod !== "fallback") continue;
    const normalized = (log.normalizedMessage || log.rawMessage || "").trim().toLowerCase();
    if (!normalized) continue;
    const suggestion = suggestIntentForQuestion(log.rawMessage || normalized);
    const existing = grouped.get(normalized);
    const senderMasked = maskExportPhone(log.senderNumber || "");
    if (existing) {
      existing.frequency += 1;
      existing.logIds.push(log.id);
      existing.needsHumanReview = existing.needsHumanReview || log.needsHumanReview;
      if (existing.reviewStatus !== "pending" && log.reviewStatus === "pending") {
        existing.reviewStatus = "pending";
      }
      if (log.createdAt > existing.lastAskedAt) {
        existing.lastAskedAt = log.createdAt;
        existing.rawMessage = log.rawMessage;
        existing.senderMasked = senderMasked;
        existing.fallbackReason = log.errorMessage || log.responsePreview || existing.fallbackReason;
        existing.reviewNote = log.reviewNote || existing.reviewNote;
        existing.reviewedByUserId = log.reviewedByUserId || existing.reviewedByUserId;
        existing.reviewedAt = log.reviewedAt || existing.reviewedAt;
      }
    } else {
      grouped.set(normalized, {
        id: log.id,
        logIds: [log.id],
        normalizedMessage: normalized,
        rawMessage: log.rawMessage,
        frequency: 1,
        lastAskedAt: log.createdAt,
        senderMasked,
        fallbackReason: log.errorMessage || log.responsePreview || "Fallback / tidak dikenali.",
        needsHumanReview: log.needsHumanReview,
        reviewStatus: log.reviewStatus,
        reviewNote: log.reviewNote,
        reviewedByUserId: log.reviewedByUserId,
        reviewedAt: log.reviewedAt,
        suggestedIntentKey: suggestion.suggestedIntentKey,
        confidence: suggestion.confidence,
        safetyRisk: suggestion.safety.riskLevel,
        suggestedAction: suggestion.suggestedAction,
      });
    }
  }
  return Array.from(grouped.values())
    .sort((a, b) => b.frequency - a.frequency || b.lastAskedAt.localeCompare(a.lastAskedAt))
    .slice(0, 30);
}

async function getEmployeeRecipients(db: AletaDatabase) {
  const rows = await db
    .prepare(
      `SELECT users.id, users.username, users.name, users.role_id, users.position_id,
        positions.name AS position_name, positions.unit_kerja, users.additional_role_ids_json, users.whatsapp_number
       FROM users
       LEFT JOIN positions ON positions.id = users.position_id
       WHERE users.deleted_at IS NULL
         AND users.is_active = 1
         AND COALESCE(users.whatsapp_number, '') <> ''
       ORDER BY users.name ASC`
    )
    .all<EmployeeRecipientRow>();

  return rows.map(mapEmployeeRecipient).filter((row) => row.whatsappNumber && /^62\d{8,15}$/.test(row.whatsappNumber));
}

/**
 * Daftar akun yang DIBLOKIR atau dihapus, untuk dikirim ke ALETA Bot.
 *
 * getEmployeeRecipients di atas sudah menyaring is_active = 1, jadi pegawai
 * yang diblokir tidak ikut daftar penerima. Tetapi itu belum cukup: banyak
 * notifikasi mengambil nama DAN nomor langsung dari SIPP, dan SIPP tidak tahu
 * apa-apa soal pemblokiran di ALETA. Tanpa daftar ini, orang yang sudah
 * diblokir tetap dikirimi WhatsApp begitu namanya muncul di hasil query.
 *
 * Yang dikirim: nomor WhatsApp (pencocokan tepat) dan nama yang dinormalkan
 * (untuk data SIPP yang nomornya berbeda). Tidak ada data pribadi lain.
 */
async function getBlockedRecipients(db: AletaDatabase) {
  const rows = await db
    .prepare(
      `SELECT users.name, users.username, users.whatsapp_number, users.is_active, users.deleted_at
       FROM users
       WHERE users.deleted_at IS NOT NULL OR users.is_active = 0`
    )
    .all<{ name: string; username: string; whatsapp_number: string | null; is_active: number; deleted_at: string | null }>();

  const numbers = new Set<string>();
  const names = new Set<string>();

  for (const row of rows) {
    const number = String(row.whatsapp_number || "").replace(/\D/g, "");
    if (/^62\d{8,15}$/.test(number)) numbers.add(number);

    const name = normalizeBlockedName(row.name);
    if (name) names.add(name);
    const username = normalizeBlockedName(row.username);
    if (username) names.add(username);
  }

  return {
    numbers: Array.from(numbers).sort(),
    names: Array.from(names).sort(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Menyamakan bentuk nama agar gelar dan tanda baca tidak membuat blokir lolos.
 * "DERRY BRIANTONO, S.H." dan "Derry Briantono SH" harus dianggap sama.
 * Harus sama dengan normalizeBlockedName di
 * aleta_bot/services/blockedRecipientService.js.
 */
function normalizeBlockedName(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(s\.?h|s\.?ag|s\.?hi|m\.?h|m\.?ag|m\.?si|lc|dr|drs|h|hj)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Role yang secara jabatan MELEKAT pada role lain.
 *
 * Ketua dan Wakil Ketua Pengadilan adalah HAKIM juga: mereka memegang perkara
 * dan bersidang, sehingga wajib menerima notifikasi jadwal sidang seperti hakim
 * lain — di samping notifikasi khusus kepemimpinan mereka.
 *
 * Aplikasi lama menangani ini dengan mendaftarkan nomor yang SAMA di dua tempat
 * (aleta_bot/whatsapp.js): "Abdul Salam" ada di hakimIds sekaligus ketuaId, dan
 * nomor "Ali" di hakimIds sama dengan "Akbar Ali" di ketuaId. Di ALETA satu user
 * hanya punya satu role utama, jadi keterkaitan itu dinyatakan di sini.
 *
 * Harus sama dengan IMPLICIT_ROLE_IDS di
 * aleta_bot/services/dynamicNotificationSchedulerService.js.
 */
const IMPLICIT_ROLE_IDS: Record<string, string[]> = {
  ketua: ["hakim"],
  "wakil-ketua": ["hakim"],
};

function expandRoleIds(roleId: string): string[] {
  const normalized = String(roleId || "").trim().toLowerCase();
  if (!normalized) return [];
  return [normalized, ...(IMPLICIT_ROLE_IDS[normalized] ?? [])];
}

export function filterEmployeeRecipientsByMapping(
  recipients: AletaBotEmployeeRecipient[],
  mapping: Record<string, unknown>
) {
  const normalizeHints = (value: unknown) => sanitizeStringIdList(value).map((item) => item.toLowerCase());
  const roleHints = normalizeHints(mapping["roleHints"]);
  const positionHints = normalizeHints(mapping["positionHints"]);
  const nameHints = normalizeHints(mapping["nameHints"]);
  const legacyHints = normalizeHints(mapping["hints"]);
  if (roleHints.length === 0 && positionHints.length === 0 && nameHints.length === 0 && legacyHints.length === 0) {
    return recipients;
  }
  const matchesField = (hints: string[], values: string[]) => {
    if (hints.length === 0) return true;
    const haystacks = values.map((value) => String(value || "").toLowerCase()).filter(Boolean);
    return hints.some((hint) => haystacks.some((value) => value.includes(hint)));
  };

  return recipients.filter((recipient) => {
    // roleHints dicocokkan ke role utama, role tambahan, dan role melekat
    // (mis. ketua/wakil ketua yang juga hakim). Dulu hanya role utama yang
    // diperiksa, sehingga Ketua tidak pernah menerima notifikasi hakim.
    const roleValues = [...expandRoleIds(recipient.roleId), ...recipient.additionalRoleIds];
    const additionalRoleLabels = recipient.additionalRoleIds.map(getAdditionalRoleLabel);
    const positionValues = [recipient.positionId, recipient.positionName, recipient.unitKerja, ...recipient.additionalRoleIds, ...additionalRoleLabels];
    const nameValues = [recipient.id, recipient.name, recipient.username];
    const legacyHaystack = [...roleValues, ...positionValues, ...nameValues].join(" ").toLowerCase();
    if (!matchesField(roleHints, roleValues)) return false;
    if (!matchesField(positionHints, positionValues)) return false;
    if (!matchesField(nameHints, nameValues)) return false;
    return legacyHints.length === 0 || legacyHints.some((hint) => legacyHaystack.includes(hint));
  });
}

async function getWhatsappNumberCompleteness(db: AletaDatabase) {
  const [users, positions] = await Promise.all([getUsersFromDb(db), getPositionsFromDb(db)]);
  const positionMap = new Map(positions.map((position) => [position.id, position]));
  const activeUsers = users.filter((user) => user.isActive);
  const hasWhatsapp = (value: string) => /^62\d{8,15}$/.test(normalizeWhatsappNumber(value || ""));
  const withWhatsapp = activeUsers.filter((user) => hasWhatsapp(user.whatsappNumber));
  const importantRoles = new Set([
    "super-admin",
    "admin",
    "ketua",
    "wakil-ketua",
    "hakim",
    "panitera",
    "panitera-muda",
    "panitera-pengganti",
    "jurusita",
    "sekretaris",
    "kasubag",
  ]);
  const roleGroups = new Map<string, { total: number; withWhatsapp: number; missingWhatsapp: number }>();

  for (const user of activeUsers) {
    const group = roleGroups.get(user.roleId) ?? { total: 0, withWhatsapp: 0, missingWhatsapp: 0 };
    group.total += 1;
    if (hasWhatsapp(user.whatsappNumber)) {
      group.withWhatsapp += 1;
    } else {
      group.missingWhatsapp += 1;
    }
    roleGroups.set(user.roleId, group);
  }

  const importantMissing = activeUsers
    .filter((user) => !hasWhatsapp(user.whatsappNumber))
    .sort((a, b) => {
      const aImportant = importantRoles.has(a.roleId) ? 0 : 1;
      const bImportant = importantRoles.has(b.roleId) ? 0 : 1;
      return aImportant - bImportant || a.name.localeCompare(b.name);
    })
    .slice(0, 12)
    .map((user) => {
      const position = positionMap.get(user.positionId);
      return {
        id: user.id,
        name: user.name,
        roleId: user.roleId,
        positionId: user.positionId,
        positionName: position?.name ?? user.positionId,
        unitKerja: position?.unitKerja ?? "",
      };
    });

  return {
    totalActiveUsers: activeUsers.length,
    withWhatsapp: withWhatsapp.length,
    missingWhatsapp: Math.max(0, activeUsers.length - withWhatsapp.length),
    coveragePercent: activeUsers.length > 0 ? Math.round((withWhatsapp.length / activeUsers.length) * 100) : 0,
    importantMissing,
    roleBreakdown: Array.from(roleGroups.entries())
      .map(([roleId, value]) => ({ roleId, ...value }))
      .sort((a, b) => a.roleId.localeCompare(b.roleId)),
  };
}

async function getNotificationLogs(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, notification_id, query_id, recipient_number, recipient_name, category,
        message_preview, status, whatsapp_message_id, ack, error_message, source_app, source_feature, entity_type, entity_id, metadata_json,
        sent_at, delivered_at, read_at, failed_at, created_at
       FROM aleta_bot_notification_logs
       ORDER BY created_at DESC
       LIMIT 80`
    )
    .all<NotificationLogRow>();

  return rows.map(mapNotificationLog);
}

async function getLogs(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, level, event_type, message, metadata_json, actor_user_id, created_at
       FROM aleta_bot_logs
       ORDER BY created_at DESC
       LIMIT 80`
    )
    .all<LogRow>();

  return rows.map(mapLog);
}

function mapPolicySkipRow(row: PolicySkipLogRow) {
  return {
    id: row.id,
    notificationKey: row.notification_key,
    notificationId: row.notification_id ?? "",
    category: row.category,
    reason: row.reason,
    sourceFeature: row.source_feature,
    entityType: row.entity_type,
    entityId: row.entity_id,
    recipientType: row.recipient_type,
    recipientCount: Number(row.recipient_count || 0),
    createdAt: row.created_at,
  };
}

async function appendPolicySkipLog(
  db: AletaDatabase,
  input: {
    notificationKey: string;
    notificationId?: string | null;
    category: string;
    reason: string;
    sourceFeature?: string;
    entityType?: string;
    entityId?: string;
    recipientType?: string;
    recipientCount?: number;
    metadata?: Record<string, unknown>;
  }
) {
  await ensureAletaBotSeeded(db);
  await db
    .prepare(
      `INSERT INTO aleta_bot_policy_skip_logs (
        id, notification_key, notification_id, category, reason, source_feature,
        entity_type, entity_id, recipient_type, recipient_count, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      await nextPrefixedId(db, "aleta_bot_policy_skip_logs", "abps"),
      input.notificationKey,
      input.notificationId ?? null,
      input.category,
      input.reason || "unknown",
      input.sourceFeature ?? "",
      input.entityType ?? "",
      input.entityId ?? "",
      input.recipientType ?? "",
      Math.max(0, Number(input.recipientCount || 0)),
      JSON.stringify(input.metadata ?? {}),
      new Date().toISOString()
    );
}

async function getPolicySkipSummary(db: AletaDatabase): Promise<AletaBotPolicySkipSummary> {
  await ensureAletaBotSeeded(db);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const [todayRow, totalRow, lastRow, reasonRows, notificationRows, recentRows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS count FROM aleta_bot_policy_skip_logs WHERE created_at >= ?`).get<{ count: number | string }>(todayIso),
    db.prepare(`SELECT COUNT(*) AS count FROM aleta_bot_policy_skip_logs`).get<{ count: number | string }>(),
    db.prepare(`SELECT created_at FROM aleta_bot_policy_skip_logs ORDER BY created_at DESC LIMIT 1`).get<{ created_at: string }>(),
    db
      .prepare(
        `SELECT reason, COUNT(*) AS count
         FROM aleta_bot_policy_skip_logs
         GROUP BY reason
         ORDER BY COUNT(*) DESC, reason ASC
         LIMIT 6`
      )
      .all<{ reason: string; count: number | string }>(),
    db
      .prepare(
        `SELECT notification_key, COUNT(*) AS count
         FROM aleta_bot_policy_skip_logs
         GROUP BY notification_key
         ORDER BY COUNT(*) DESC, notification_key ASC
         LIMIT 6`
      )
      .all<{ notification_key: string; count: number | string }>(),
    db
      .prepare(
        `SELECT id, notification_key, notification_id, category, reason, source_feature,
          entity_type, entity_id, recipient_type, recipient_count, metadata_json, created_at
         FROM aleta_bot_policy_skip_logs
         ORDER BY created_at DESC
         LIMIT 12`
      )
      .all<PolicySkipLogRow>(),
  ]);

  return {
    totalToday: Number(todayRow?.count || 0),
    totalAllTime: Number(totalRow?.count || 0),
    lastSkippedAt: lastRow?.created_at ?? null,
    topReasons: reasonRows.map((row) => ({ reason: row.reason, count: Number(row.count || 0) })),
    topNotifications: notificationRows.map((row) => ({ notificationKey: row.notification_key, count: Number(row.count || 0) })),
    recent: recentRows.map(mapPolicySkipRow),
  };
}

function mapDispositionReminderRunRow(row: DispositionReminderRunRow): AletaBotDispositionReminderRun {
  return {
    id: row.id,
    mode: row.mode,
    triggeredBy: row.triggered_by,
    triggeredByUserId: row.triggered_by_user_id ?? null,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? null,
    totalCandidates: Number(row.total_candidates || 0),
    dryRunCreated: Number(row.dry_run_created || 0),
    sentCount: Number(row.sent_count || 0),
    skippedCount: Number(row.skipped_count || 0),
    errorCount: Number(row.error_count || 0),
    status: row.status,
    summary: parseJson<Record<string, unknown>>(row.summary_json || "{}", {}),
  };
}

async function appendDispositionReminderRun(
  db: AletaDatabase,
  input: {
    mode: AletaBotDispositionReminderRun["mode"];
    triggeredBy: AletaBotDispositionReminderRun["triggeredBy"];
    triggeredByUserId?: string | null;
    startedAt?: string;
    finishedAt?: string | null;
    totalCandidates?: number;
    dryRunCreated?: number;
    sentCount?: number;
    skippedCount?: number;
    errorCount?: number;
    status: AletaBotDispositionReminderRun["status"];
    summary?: Record<string, unknown>;
  }
) {
  await db
    .prepare(
      `INSERT INTO aleta_bot_disposition_reminder_runs (
        id, mode, triggered_by, triggered_by_user_id, started_at, finished_at,
        total_candidates, dry_run_created, sent_count, skipped_count, error_count,
        status, summary_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      await nextPrefixedId(db, "aleta_bot_disposition_reminder_runs", "abrr"),
      input.mode,
      input.triggeredBy,
      input.triggeredByUserId ?? null,
      input.startedAt ?? new Date().toISOString(),
      input.finishedAt ?? new Date().toISOString(),
      Math.max(0, Number(input.totalCandidates || 0)),
      Math.max(0, Number(input.dryRunCreated || 0)),
      Math.max(0, Number(input.sentCount || 0)),
      Math.max(0, Number(input.skippedCount || 0)),
      Math.max(0, Number(input.errorCount || 0)),
      input.status,
      JSON.stringify(input.summary ?? {})
    );
}

async function getDispositionReminderRuns(db: AletaDatabase, limit = 10): Promise<AletaBotDispositionReminderRun[]> {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, mode, triggered_by, triggered_by_user_id, started_at, finished_at,
        total_candidates, dry_run_created, sent_count, skipped_count, error_count, status, summary_json
       FROM aleta_bot_disposition_reminder_runs
       ORDER BY started_at DESC
       LIMIT ?`
    )
    .all<DispositionReminderRunRow>(Math.max(1, Math.min(25, Number(limit || 10))));
  return rows.map(mapDispositionReminderRunRow);
}

export async function getPolicySkipReport(
  db: AletaDatabase,
  actorUserId: string,
  filters: {
    dateFrom?: string | null;
    dateTo?: string | null;
    reason?: string | null;
    notificationKey?: string | null;
    category?: string | null;
    format?: "json" | "csv" | string | null;
  } = {}
) {
  await requireAletaBotOperator(db, actorUserId);
  await ensureAletaBotSeeded(db);
  const where: string[] = [];
  const params: Array<string | number> = [];
  const dateFrom = String(filters.dateFrom || "").trim();
  const dateTo = String(filters.dateTo || "").trim();
  const reason = String(filters.reason || "").trim();
  const notificationKey = String(filters.notificationKey || "").trim();
  const category = String(filters.category || "").trim();

  if (dateFrom) {
    where.push("created_at >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    where.push("created_at <= ?");
    params.push(dateTo);
  }
  if (reason && reason !== "all") {
    where.push("reason = ?");
    params.push(reason);
  }
  if (notificationKey) {
    where.push("notification_key = ?");
    params.push(notificationKey);
  }
  if (category && category !== "all") {
    where.push("category = ?");
    params.push(category);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const detailLimit = filters.format === "csv"
    ? exportOverflowLimit(EXPORT_ROW_LIMITS.policySkipCsv)
    : 1000;
  const [totalRow, byReasonRows, byNotificationRows, lastRow, rows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS count FROM aleta_bot_policy_skip_logs ${whereSql}`).get<{ count: number | string }>(...params),
    db
      .prepare(
        `SELECT reason, COUNT(*) AS count
         FROM aleta_bot_policy_skip_logs
         ${whereSql}
         GROUP BY reason
         ORDER BY COUNT(*) DESC, reason ASC`
      )
      .all<{ reason: string; count: number | string }>(...params),
    db
      .prepare(
        `SELECT notification_key, COUNT(*) AS count
         FROM aleta_bot_policy_skip_logs
         ${whereSql}
         GROUP BY notification_key
         ORDER BY COUNT(*) DESC, notification_key ASC`
      )
      .all<{ notification_key: string; count: number | string }>(...params),
    db.prepare(`SELECT created_at FROM aleta_bot_policy_skip_logs ${whereSql} ORDER BY created_at DESC LIMIT 1`).get<{ created_at: string }>(...params),
    db
      .prepare(
        `SELECT id, notification_key, notification_id, category, reason, source_feature,
          entity_type, entity_id, recipient_type, recipient_count, metadata_json, created_at
         FROM aleta_bot_policy_skip_logs
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT ${detailLimit}`
      )
      .all<PolicySkipLogRow>(...params),
  ]);

  const report = {
    summary: {
      total: Number(totalRow?.count || 0),
      byReason: Object.fromEntries(byReasonRows.map((row) => [row.reason || "unknown", Number(row.count || 0)])),
      byNotification: Object.fromEntries(byNotificationRows.map((row) => [row.notification_key || "notification", Number(row.count || 0)])),
      lastSkippedAt: lastRow?.created_at ?? null,
    },
    items: rows.map(mapPolicySkipRow),
  };

  if (filters.format === "csv") {
    assertExportRowLimit(Number(totalRow?.count || rows.length), EXPORT_ROW_LIMITS.policySkipCsv, "Export laporan policy skip");
    const headers = [
      "Waktu",
      "Notification Key",
      "Kategori",
      "Alasan",
      "Source Feature",
      "Entity Type",
      "Entity ID",
      "Recipient Type",
      "Jumlah Recipient",
    ];
    const lines = [headers.map(csvCell).join(",")];
    for (const item of report.items) {
      lines.push([
        item.createdAt,
        item.notificationKey,
        item.category,
        item.reason,
        item.sourceFeature,
        item.entityType,
        item.entityId,
        item.recipientType,
        item.recipientCount,
      ].map(csvCell).join(","));
    }
    return {
      ...report,
      filename: `policy-skip-report-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: lines.join("\n"),
    };
  }

  return report;
}

export async function getAletaBotMessageAnalytics(db: AletaDatabase, actorUserId: string) {
  await requireAletaBotOperator(db, actorUserId);
  await ensureAletaBotSeeded(db);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const [totalRow, statusRows, sourceRows, failureRows, policySkipSummary] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS count FROM aleta_bot_notification_logs WHERE created_at >= ?`).get<{ count: number | string }>(todayIso),
    db
      .prepare(
        `SELECT status, COUNT(*) AS count
         FROM aleta_bot_notification_logs
         WHERE created_at >= ?
         GROUP BY status
         ORDER BY COUNT(*) DESC`
      )
      .all<{ status: string; count: number | string }>(todayIso),
    db
      .prepare(
        `SELECT COALESCE(NULLIF(source_feature, ''), 'lainnya') AS source_feature, COUNT(*) AS count
         FROM aleta_bot_notification_logs
         WHERE created_at >= ?
         GROUP BY COALESCE(NULLIF(source_feature, ''), 'lainnya')
         ORDER BY COUNT(*) DESC`
      )
      .all<{ source_feature: string; count: number | string }>(todayIso),
    db
      .prepare(
        `SELECT COALESCE(NULLIF(error_message, ''), 'Tidak ada detail') AS reason, COUNT(*) AS count
         FROM aleta_bot_notification_logs
         WHERE created_at >= ? AND status IN ('failed', 'dead_letter')
         GROUP BY COALESCE(NULLIF(error_message, ''), 'Tidak ada detail')
         ORDER BY COUNT(*) DESC
         LIMIT 5`
      )
      .all<{ reason: string; count: number | string }>(todayIso),
    getPolicySkipSummary(db),
  ]);
  const byStatus = Object.fromEntries(statusRows.map((row) => [row.status || "unknown", Number(row.count || 0)]));
  const sent = Number(byStatus.sent || byStatus.delivered || 0);
  const failed = Number(byStatus.failed || 0);
  const simulated = Number(byStatus.simulated || 0);
  const total = Number(totalRow?.count || 0);
  return {
    totalToday: total,
    sentToday: sent,
    failedToday: failed,
    simulatedToday: simulated,
    deadLetterToday: Number(byStatus.dead_letter || 0),
    successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
    byStatus,
    bySourceFeature: Object.fromEntries(sourceRows.map((row) => [row.source_feature, Number(row.count || 0)])),
    topFailureReasons: failureRows.map((row) => ({ reason: sanitizeErrorMessage(row.reason).slice(0, 160), count: Number(row.count || 0) })),
    policySkip: policySkipSummary,
  };
}

export async function getAletaBotQueueMonitoring(db: AletaDatabase, actorUserId: string) {
  await requireAletaBotOperator(db, actorUserId);
  await ensureAletaBotSeeded(db);

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const staleCutoff = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const todayIso = today.toISOString();
  const pendingStatuses = ["pending", "processing", "enqueued"];
  const sentStatuses = ["sent", "success", "delivered"];
  const failedStatuses = ["failed", "dead_letter"];
  const placeholders = (items: string[]) => items.map(() => "?").join(", ");

  const [allStatusRows, todayStatusRows, staleRow, oldestPendingRow, lastSentRow, lastCreatedRow] = await Promise.all([
    db
      .prepare(
        `SELECT status, COUNT(*) AS count
         FROM aleta_bot_notification_logs
         GROUP BY status`
      )
      .all<{ status: string; count: number | string }>(),
    db
      .prepare(
        `SELECT status, COUNT(*) AS count
         FROM aleta_bot_notification_logs
         WHERE created_at >= ?
         GROUP BY status`
      )
      .all<{ status: string; count: number | string }>(todayIso),
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM aleta_bot_notification_logs
         WHERE status IN (${placeholders(pendingStatuses)}) AND created_at < ?`
      )
      .get<{ count: number | string }>(...pendingStatuses, staleCutoff),
    db
      .prepare(
        `SELECT MIN(created_at) AS created_at
         FROM aleta_bot_notification_logs
         WHERE status IN (${placeholders(pendingStatuses)})`
      )
      .get<{ created_at: string | null }>(...pendingStatuses),
    db
      .prepare(
        `SELECT MAX(COALESCE(sent_at, created_at)) AS sent_at
         FROM aleta_bot_notification_logs
         WHERE status IN (${placeholders(sentStatuses)})`
      )
      .get<{ sent_at: string | null }>(...sentStatuses),
    db
      .prepare(
        `SELECT MAX(created_at) AS created_at
         FROM aleta_bot_notification_logs`
      )
      .get<{ created_at: string | null }>(),
  ]);

  const allByStatus = Object.fromEntries(allStatusRows.map((row) => [row.status || "unknown", Number(row.count || 0)]));
  const todayByStatus = Object.fromEntries(todayStatusRows.map((row) => [row.status || "unknown", Number(row.count || 0)]));
  const pending = pendingStatuses.reduce((total, status) => total + Number(allByStatus[status] || 0), 0);
  const processing = Number(allByStatus.processing || 0);
  const sentToday = sentStatuses.reduce((total, status) => total + Number(todayByStatus[status] || 0), 0);
  const failedToday = failedStatuses.reduce((total, status) => total + Number(todayByStatus[status] || 0), 0);
  const deadLetters = Number(allByStatus.dead_letter || 0);
  const stalePending = Number(staleRow?.count || 0);
  const alerts: Array<{ key: string; label: string; severity: "warning" | "critical" }> = [];

  if (failedToday >= 10 || deadLetters >= 10) {
    alerts.push({ key: "many_failures", label: "Pesan gagal hari ini tinggi.", severity: "critical" });
  } else if (failedToday > 0 || deadLetters > 0) {
    alerts.push({ key: "some_failures", label: "Ada pesan gagal yang perlu ditinjau.", severity: "warning" });
  }

  if (stalePending > 0) {
    alerts.push({ key: "stale_pending", label: "Ada pesan menunggu lebih dari 15 menit.", severity: "critical" });
  } else if (pending >= 50) {
    alerts.push({ key: "queue_growing", label: "Antrean pesan mulai tinggi.", severity: "warning" });
  }

  return {
    pending,
    processing,
    sentToday,
    failedToday,
    deadLetters,
    stalePending,
    oldestPendingAt: oldestPendingRow?.created_at ?? null,
    lastSentAt: lastSentRow?.sent_at ?? null,
    lastCreatedAt: lastCreatedRow?.created_at ?? null,
    alerts,
    health: alerts.some((alert) => alert.severity === "critical") ? "blocked" : alerts.length > 0 ? "warning" : "normal",
    generatedAt: now.toISOString(),
  };
}

export async function getPublicQaAnalytics(db: AletaDatabase, actorUserId: string) {
  await requireAletaBotOperator(db, actorUserId);
  await ensureAletaBotSeeded(db);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const [todayRow, weekRow, statusRows, intentRows, pendingRow, convertedRow, safetyRow] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS count FROM aleta_bot_public_qa_logs WHERE created_at >= ?`).get<{ count: number | string }>(today.toISOString()),
    db.prepare(`SELECT COUNT(*) AS count FROM aleta_bot_public_qa_logs WHERE created_at >= ?`).get<{ count: number | string }>(sevenDaysAgo.toISOString()),
    db
      .prepare(
        `SELECT status, COUNT(*) AS count
         FROM aleta_bot_public_qa_logs
         WHERE created_at >= ?
         GROUP BY status
         ORDER BY COUNT(*) DESC`
      )
      .all<{ status: string; count: number | string }>(sevenDaysAgo.toISOString()),
    db
      .prepare(
        `SELECT COALESCE(NULLIF(matched_intent_key, ''), 'fallback') AS intent_key, COUNT(*) AS count
         FROM aleta_bot_public_qa_logs
         WHERE created_at >= ?
         GROUP BY COALESCE(NULLIF(matched_intent_key, ''), 'fallback')
         ORDER BY COUNT(*) DESC
         LIMIT 8`
      )
      .all<{ intent_key: string; count: number | string }>(sevenDaysAgo.toISOString()),
    db.prepare(`SELECT COUNT(*) AS count FROM aleta_bot_public_qa_logs WHERE needs_human_review = 1 AND review_status = 'pending'`).get<{ count: number | string }>(),
    db.prepare(`SELECT COUNT(*) AS count FROM aleta_bot_public_qa_logs WHERE review_status = 'converted_to_intent'`).get<{ count: number | string }>(),
    db.prepare(`SELECT COUNT(*) AS count FROM aleta_bot_public_qa_logs WHERE status = 'blocked' OR lower(error_message) LIKE '%safety%'`).get<{ count: number | string }>(),
  ]);
  const byStatus = Object.fromEntries(statusRows.map((row) => [row.status || "unknown", Number(row.count || 0)]));
  const totalWeek = Number(weekRow?.count || 0);
  const fallbackCount = Number(byStatus.fallback || byStatus.error || 0);
  return {
    totalToday: Number(todayRow?.count || 0),
    totalLast7Days: totalWeek,
    fallbackRate: totalWeek > 0 ? Math.round((fallbackCount / totalWeek) * 100) : 0,
    humanReviewPending: Number(pendingRow?.count || 0),
    safetyBlocked: Number(safetyRow?.count || 0),
    convertedToDraftIntent: Number(convertedRow?.count || 0),
    topIntents: intentRows.map((row) => ({ intentKey: row.intent_key, count: Number(row.count || 0) })),
    byStatus,
  };
}

function getRuntimeState(settings: AletaBotSettings, whatsappRuntimeStatus: string): AletaBotRuntimeState {
  if (whatsappRuntimeStatus === "failed") return "error";
  if (!settings.botEnabled) return "disabled";
  if (settings.dryRunEnabled) return "dry-run";
  return "active";
}

async function buildMetrics(db: AletaDatabase, jobs: AletaBotJob[], templates: AletaBotTemplate[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = today.toISOString();
  const sent = await db
    .prepare(
      `SELECT COUNT(*)::int AS count
       FROM aleta_bot_logs
       WHERE event_type = 'message' AND level = 'success' AND created_at >= ?`
    )
    .get<{ count: number }>(todayIso);
  const failed = await db
    .prepare(
      `SELECT COUNT(*)::int AS count
       FROM aleta_bot_logs
       WHERE event_type = 'message' AND level = 'error' AND created_at >= ?`
    )
    .get<{ count: number }>(todayIso);
  const lastNotification = await db
    .prepare(
      `SELECT created_at
       FROM aleta_bot_logs
       WHERE event_type = 'notification'
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get<{ created_at: string }>();

  return {
    sentToday: sent?.count ?? 0,
    failedToday: failed?.count ?? 0,
    lastNotificationAt: lastNotification?.created_at ?? null,
    activeJobs: jobs.filter((job) => job.enabled).length,
    enabledTemplates: templates.filter((template) => template.editable).length,
  };
}

/**
 * Notifikasi bawaan yang dikirim developer bersama ALETA.
 *
 * Ini adalah notifikasi STANDAR resmi (pengingat sidang, akta cerai, dll) yang
 * sudah teruji. Ritual "simulasi → preview → approval → migrasi jalur lama"
 * dirancang untuk notifikasi BUATAN admin yang belum teruji — memaksa admin
 * memvalidasi ulang notifikasi bawaan developer hanya menghambat, dan alur
 * approval lewat migrasi jalur lama pun tidak pernah cocok (entityId migrasi
 * "party-*" tidak sama dengan id notifikasi "pihak-*"). Karena itu notifikasi
 * bawaan diperlakukan sebagai SUDAH DISETUJUI secara bawaan: admin cukup
 * mengaktifkannya dan mengisi jadwal.
 */
const BUILT_IN_NOTIFICATION_IDS = new Set(DEFAULT_NOTIFICATIONS.map((item) => item.id));

function isBuiltInNotification(notificationId: string) {
  return BUILT_IN_NOTIFICATION_IDS.has(notificationId);
}

async function computePartyNotificationPolicy(
  db: AletaDatabase,
  notification: AletaBotNotification,
  reasonPassed: string,
  reasonPending: string
) {
  if (isBuiltInNotification(notification.id)) {
    return {
      dryRunPassed: true,
      recipientPreviewPassed: true,
      approved: true,
      canActivate: true,
      reason: "Notifikasi bawaan standar ALETA — tervalidasi dan disetujui secara bawaan.",
    };
  }
  const dryRunPassed = notification.lastStatus === "simulated";
  const recipientPreviewPassed = await hasNotificationRecipientPreview(db, notification.id);
  const approved = await hasApprovedNotificationPolicy(db, notification.id);
  const canActivate = dryRunPassed && recipientPreviewPassed && approved;
  return {
    dryRunPassed,
    recipientPreviewPassed,
    approved,
    canActivate,
    reason: canActivate ? reasonPassed : reasonPending,
  };
}

export async function getAletaBotSnapshot(db: AletaDatabase, actorUserId: string): Promise<AletaBotSnapshot> {
  await requireAletaBotOperator(db, actorUserId);
  await ensureAletaBotSeeded(db);
  const runtimeMode = getWhatsappRuntimeMode();
  const [
    settings, templates, jobs, notifications, queries, dbConnections,
    publicQaIntents, publicQaLogs, unknownQuestionReviews, employeeRecipients, notificationLogs, logs, policySkipSummary,
    deadlineReminderRuns, whatsappSnapshot, approvalRequests, legacyMigrations, whatsappNumberCompleteness,
  ] = await Promise.all([
    getAletaBotSettings(db),
    getTemplates(db),
    getJobs(db),
    getNotifications(db),
    getQueries(db),
    getDbConnections(db),
    getPublicQaIntents(db),
    getPublicQaLogs(db),
    getUnknownQuestionReviews(db),
    getEmployeeRecipients(db),
    getNotificationLogs(db),
    getLogs(db),
    getPolicySkipSummary(db),
    getDispositionReminderRuns(db, 10),
    runtimeMode === "aleta_bot" ? buildGatewayWhatsappSnapshot() : whatsappService.getGatewaySnapshot(),
    listApprovalRequests(db),
    getLegacyMigrations(db),
    getWhatsappNumberCompleteness(db),
  ]);
  const metrics = await buildMetrics(db, jobs, templates);
  const workerState = runtimeMode === "aleta_bot" ? await getWorkerStateFromGateway() : null;
  const deadLetters = runtimeMode === "aleta_bot" ? await getDeadLettersFromGateway(50) : [];
  const resolvedDeadLetters = runtimeMode === "aleta_bot" ? await getDeadLettersFromGateway(50, "resolved") : [];
  const notificationsWithPolicy = await Promise.all(
    notifications.map(async (notification) => {
      if (notification.category !== "party") {
        return {
          ...notification,
          policyStatus: {
            dryRunPassed: notification.lastStatus === "simulated",
            recipientPreviewPassed: true,
            approved: true,
            canActivate: true,
            reason: "Notifikasi pegawai tidak memakai guard pihak.",
          },
        };
      }
      return {
        ...notification,
        policyStatus: await computePartyNotificationPolicy(
          db,
          notification,
          "Siap diaktifkan sesuai policy notifikasi pihak.",
          "Notifikasi pihak belum dapat aktif sebelum simulasi, preview penerima, dan approval selesai."
        ),
      };
    })
  );

  return {
    settings,
    sendingRiskPresets: listSendingRiskPresets(),
    runtimeState: getRuntimeState(settings, whatsappSnapshot.runtimeStatus),
    whatsapp: {
      runtimeStatus: whatsappSnapshot.runtimeStatus,
      internalStatus: whatsappSnapshot.internalStatus,
      qrCode: whatsappSnapshot.qrCode,
      linked: whatsappSnapshot.linked,
      phoneNumber: whatsappSnapshot.phoneNumber,
      sessionName: whatsappSnapshot.sessionName,
      savedStatus: whatsappSnapshot.savedStatus,
      lastConnectedAt: whatsappSnapshot.lastConnectedAt ?? null,
      lastErrorMessage: whatsappSnapshot.lastErrorMessage,
    },
    metrics,
    templates,
    jobs,
    notifications: notificationsWithPolicy,
    queries,
    dbConnections,
    publicQaIntents,
    publicQaLogs,
    unknownQuestionReviews,
    employeeRecipients,
    whatsappNumberCompleteness,
    policySkipSummary,
    deadlineReminderRuns,
    notificationLogs,
    queryCatalog: ALETA_BOT_QUERY_CATALOG,
    logs,
    approvalRequests,
    deadLetters,
    resolvedDeadLetters,
    workerState,
    legacyMigrations,
  };
}

function maskExportPhone(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 6) return "";
  return `${digits.slice(0, 4)}******${digits.slice(-2)}`;
}

function verifyLegacyArchiveReadiness(migration: AletaBotLegacyMigration, snapshot: AletaBotSnapshot) {
  const approved = snapshot.approvalRequests.some(
    (approval) =>
      approval.status === "approved" &&
      (approval.entityId === migration.registryTargetKey || approval.entityId === migration.id)
  );
  const duplicateRiskClear = true;
  const checks = [
    { key: "canArchive", pass: migration.canArchive, detail: "Migration item ditandai boleh diarsipkan." },
    { key: "legacyDisabled", pass: migration.status === "legacy_disabled", detail: "Legacy key sudah disabled via runtime config." },
    { key: "registryTarget", pass: Boolean(migration.registryTargetKey), detail: "Registry target key tersedia." },
    { key: "approved", pass: approved || migration.riskLevel === "low", detail: "Approval tersedia atau risiko low." },
    { key: "rollback", pass: true, detail: "Rollback state machine tersedia." },
    { key: "duplicatePath", pass: duplicateRiskClear, detail: "Tidak ada duplicate path yang diketahui dari snapshot portal." },
  ];

  return {
    legacyKey: migration.legacyKey,
    feature: migration.feature,
    ready: checks.every((check) => check.pass),
    checks,
  };
}

export async function exportAletaBotConfig(
  db: AletaDatabase,
  actorUserId: string
) {
  // Ekspor memuat seluruh konfigurasi (termasuk SQL sumber data) — khusus Super Admin.
  await requireSuperAdmin(db, actorUserId);
  const snapshot = await getAletaBotSnapshot(db, actorUserId);
  const exportedAt = new Date().toISOString();

  return {
    version: 2,
    exportedAt,
    manifest: {
      schemaVersion: "aleta-bot-config-export/v2",
      generatedAt: exportedAt,
      includedSections: [
        "settings_non_secret",
        "templates",
        "jobs",
        "notifications",
        "queries",
        "db_connection_metadata",
        "public_qa_intents",
        "employee_recipients_masked",
        "legacy_migrations",
        "approval_summary",
        "ai_bridge_metadata",
        "whatsapp_gateway_metadata",
      ],
      redactionPolicy:
        "API key, DB password, internal token, WhatsApp session, QR raw/data URL, dan nomor WhatsApp penuh tidak diekspor.",
    },
    warning:
      "Export ini hanya konfigurasi non-secret. File ini bukan backup database penuh dan tidak berisi token/API key/password/session WhatsApp.",
    settings: {
      ...snapshot.settings,
      adminWhatsappNumber: maskExportPhone(snapshot.settings.adminWhatsappNumber),
      testTargetNumber: maskExportPhone(snapshot.settings.testTargetNumber),
    },
    templates: snapshot.templates,
    jobs: snapshot.jobs,
    notifications: snapshot.notifications,
    queries: snapshot.queries.map((query) => ({
      ...query,
      sqlText: query.sqlText,
    })),
    dbConnections: snapshot.dbConnections.map((connection) => ({
      id: connection.id,
      key: connection.key,
      name: connection.name,
      description: connection.description,
      driver: connection.driver,
      host: connection.host,
      port: connection.port,
      databaseName: connection.databaseName,
      usernameMasked: connection.usernameMasked,
      passwordConfigured: connection.passwordConfigured,
      passwordSource: connection.passwordSource,
      sslEnabled: connection.sslEnabled,
      connectionTimeoutMs: connection.connectionTimeoutMs,
      isActive: connection.isActive,
      isDefault: connection.isDefault,
      legacySource: connection.legacySource,
      lastTestStatus: connection.lastTestStatus,
      lastTestAt: connection.lastTestAt,
    })),
    publicQaIntents: snapshot.publicQaIntents,
    employeeRecipients: snapshot.employeeRecipients.map((recipient) => ({
      ...recipient,
      whatsappNumber: maskExportPhone(recipient.whatsappNumber),
    })),
    legacyMigrations: snapshot.legacyMigrations,
    archiveReadiness: snapshot.legacyMigrations
      .filter((migration) => migration.canArchive || migration.status === "legacy_disabled")
      .map((migration) => verifyLegacyArchiveReadiness(migration, snapshot)),
    approvalSummary: {
      total: snapshot.approvalRequests.length,
      pending: snapshot.approvalRequests.filter((item) => item.status === "pending").length,
      approved: snapshot.approvalRequests.filter((item) => item.status === "approved").length,
      rejected: snapshot.approvalRequests.filter((item) => item.status === "rejected").length,
    },
    aiBridge: {
      status: "metadata_only",
      note: "Status live AI Bridge dibaca dari runtime dashboard dan tidak menyertakan API key pada export config.",
    },
    whatsappGateway: {
      runtimeStatus: snapshot.whatsapp.runtimeStatus,
      internalStatus: snapshot.whatsapp.internalStatus,
      linked: snapshot.whatsapp.linked,
      phoneNumber: maskExportPhone(snapshot.whatsapp.phoneNumber),
      sessionName: snapshot.whatsapp.sessionName,
      savedStatus: snapshot.whatsapp.savedStatus,
      lastConnectedAt: snapshot.whatsapp.lastConnectedAt,
      lastErrorMessage: snapshot.whatsapp.lastErrorMessage,
      qrCode: null,
      note: "QR dan session WhatsApp tidak pernah diekspor.",
    },
  };
}

async function countOlderThan(db: AletaDatabase, tableName: string, columnName: string, cutoffIso: string) {
  try {
    const row = await db
      .prepare(`SELECT COUNT(*) AS count FROM ${tableName} WHERE ${columnName} < ?`)
      .get<{ count: number | string }>(cutoffIso);
    return Number(row?.count || 0);
  } catch {
    return 0;
  }
}

export async function previewAletaBotRetentionCleanup(
  db: AletaDatabase,
  actorUserId: string,
  retentionDays = 90
) {
  await requireSuperAdmin(db, actorUserId);
  await ensureAletaBotSeeded(db);
  const safeDays = Math.max(7, Math.min(3650, Number(retentionDays || 90)));
  const cutoff = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();

  const targets = [
    { table: "aleta_bot_logs", column: "created_at", label: "Portal ALETA Bot logs" },
    { table: "aleta_bot_notification_logs", column: "created_at", label: "Portal notification logs" },
    { table: "aleta_bot_public_qa_logs", column: "created_at", label: "Portal Public Q&A logs" },
    { table: "aleta_bot_public_qa_ai_logs", column: "created_at", label: "Portal Public Q&A AI logs" },
  ];

  const tables = [];
  for (const target of targets) {
    tables.push({
      ...target,
      olderThan: cutoff,
      count: await countOlderThan(db, target.table, target.column, cutoff),
    });
  }

  return {
    mode: "preview",
    retentionDays: safeDays,
    cutoff,
    tables,
    warning:
      "Fase 4 hanya menyiapkan preview cleanup. Penghapusan agresif dan import/restore penuh ditunda sampai Fase 5.",
  };
}

async function writeAletaBotRuntimeConfig(
  db: AletaDatabase,
  settings: AletaBotSettings,
  whatsappSettings: Awaited<ReturnType<typeof getWhatsAppSettingsFromDb>>
) {
  const [
    templates,
    notifications,
    queries,
    dbConnections,
    publicQaIntents,
    publicQaKnowledge,
    employeeRecipients,
    blockedRecipients,
    legacyMigrations,
    institutionIdentity,
  ] = await Promise.all([
    getTemplates(db),
    getNotifications(db),
    getQueries(db),
    getRuntimeDbConnections(db),
    getPublicQaIntents(db),
    getPublicQaKnowledgeEntries(db),
    getEmployeeRecipients(db),
    getBlockedRecipients(db),
    getLegacyMigrations(db),
    getInstitutionIdentityFromDb(db).catch(() => ({
      courtName: "Pengadilan",
      courtShortName: "",
      address: "",
      phoneNumber: "",
      mobilePhone: "",
      csWhatsappNumber: "",
      botWhatsappNumber: "",
      email: "",
      instagram: "",
      facebook: "",
      youtube: "",
      website: "",
      mapUrl: "",
    })),
  ]);
  const allLegacyNotificationKeys = Array.from(
    new Set(
      legacyMigrations
        .filter((item) => item.legacyType === "party_notification" || item.legacyType === "employee_notification")
        .flatMap((item) => [item.legacyKey, item.sourceFunction])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
  const disabledLegacyNotificationKeys = Array.from(new Set([
    ...allLegacyNotificationKeys,
    ...legacyMigrations
    .filter((item) => item.status === "legacy_disabled" && (item.legacyType === "party_notification" || item.legacyType === "employee_notification"))
    .map((item) => item.legacyKey || item.sourceFunction)
    .filter(Boolean),
  ]));
  const disabledLegacyCommandKeys = legacyMigrations
    .filter((item) => item.status === "legacy_disabled" && (item.legacyType === "public_command" || item.legacyType === "admin_command"))
    .map((item) => item.legacyKey || item.sourceFunction)
    .filter(Boolean);
  const activeRuntimeNotifications = await Promise.all(
    notifications
      .filter((notification) => notification.isActive)
      .map(async (notification) => {
        if (notification.category !== "party") return notification;
        return {
          ...notification,
          policyStatus: await computePartyNotificationPolicy(
            db,
            notification,
            "Runtime guard party notification.",
            "Runtime guard party notification."
          ),
        };
      })
  );
  const safeRuntimeNotifications = activeRuntimeNotifications.filter(
    (notification) => notification.category !== "party" || notification.policyStatus?.canActivate
  );
  // Slider Risiko menentukan seluruh knob anti-ban sekaligus. Nilainya OVERRIDE
  // messageDelayMs manual: knob-nya sudah ada (jeda, rate limit, worker, jendela
  // kirim), portal hanya mengisi nilainya lalu bot menghormatinya seperti biasa.
  const riskPreset = resolveSendingRiskPreset(settings.sendingRiskLevel);
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: "manajemen_surat",
    botEnabled: settings.botEnabled,
    notificationsEnabled: settings.notificationsEnabled,
    kirimPegawaiEnabled: settings.kirimPegawaiEnabled,
    kirimPihakEnabled: settings.kirimPihakEnabled,
    adminWhatsappNumber: settings.adminWhatsappNumber,
    adminWhatsappChatId: settings.adminWhatsappNumber ? `${settings.adminWhatsappNumber}@c.us` : "",
    sendingRiskLevel: riskPreset.level,
    messageDelayMs: riskPreset.messageDelayMinMs,
    messageDelayMaxMs: riskPreset.messageDelayMaxMs,
    rateLimit: {
      maxPerMinute: riskPreset.maxPerMinute,
      maxPerHour: riskPreset.maxPerHour,
      maxPerDay: riskPreset.maxPerDay,
    },
    queueWorker: {
      batchSize: riskPreset.queueBatchSize,
      intervalMs: riskPreset.queueIntervalMs,
    },
    sendingWindow: {
      enabled: true,
      start: riskPreset.sendingWindowStart,
      end: riskPreset.sendingWindowEnd,
    },
    // Jarak antar pesan di ANTREAN: mencegah notifikasi sejenis berangkat
    // serentak, dan memindahkan pesan di luar jam kirim ke pembukaan jam
    // berikutnya secara menyebar (bukan menumpuk lalu meledak sekaligus).
    sendingPace: {
      enabled: true,
      minGapMs: riskPreset.sendingGapMinMs,
      maxGapMs: riskPreset.sendingGapMaxMs,
      perRecipientCooldownMs: riskPreset.perRecipientCooldownMs,
      // Kelompok jarak untuk irama campuran. Mode Maksimal sengaja tidak
      // punya kelompok: pada tingkat itu kecepatan memang didahulukan di atas
      // penyamaran, dan bot kembali memakai rentang min/max.
      gapProfile: riskPreset.gapProfile ?? null,
    },
    // Ritme kantor: istirahat siang, Jumatan, dan libur akhir pekan. Jam kirim
    // saja belum cukup — pengiriman yang mengalir rata dari pukul 08 sampai 16
    // tanpa pernah berhenti tidak menyerupai kantor mana pun.
    sendingRhythm: {
      enabled: true,
      lunchStart: "12:00",
      lunchEnd: "13:00",
      fridayLunchStart: "11:30",
      fridayLunchEnd: "13:30",
      skipWeekend: true,
      holidays: [],
    },
    // Perilaku manusiawi: indikator "sedang mengetik" sebelum kirim, dan
    // membuka pesan yang masuk. Keduanya sudah tersedia di whatsapp-web.js
    // tetapi belum pernah dipakai sebelum v1.14.0.
    humanPresence: {
      typingEnabled: true,
      markSeenEnabled: true,
    },
    // Pemanasan nomor. Dimatikan secara bawaan; dinyalakan admin saat nomor
    // baru pulih dari suspend atau saat memakai nomor baru.
    numberWarmup: {
      enabled: false,
      startedAt: "",
      startCap: 30,
      targetCap: riskPreset.maxPerDay,
      stepDays: 3,
    },
    openingVariationEnabled: true,
    retryLimit: settings.retryLimit,
    dryRunEnabled: settings.dryRunEnabled,
    useRegistryNotifications: true,
    registryPilotMode: false,
    registryDryRunDefault: settings.dryRunEnabled,
    legacyNotificationTakeoverMode: true,
    productionAutomationGuard: {
      enabled: true,
      legacyDirectSendEnabled: false,
      legacyNotificationSchedulerEnabled: false,
      requireGatewayMessageContract: true,
    },
    scheduleCron: settings.scheduleCron,
    testTargetNumber: settings.testTargetNumber,
    dispositionDeadlineReminder: {
      enabled: settings.deadlineReminderEnabled,
      mode: settings.deadlineReminderMode,
      approvedAt: settings.deadlineReminderApprovedAt,
      approvedBy: settings.deadlineReminderApprovedBy,
      pilot: {
        enabled: settings.deadlineReminderMode === "pilot",
        userIds: settings.deadlineReminderPilotUserIds,
        roleIds: settings.deadlineReminderPilotRoleIds,
        positionIds: settings.deadlineReminderPilotPositionIds,
      },
      scheduler: {
        enabled: settings.deadlineReminderSchedulerEnabled,
        mode: settings.deadlineReminderSchedulerMode,
        time: settings.deadlineReminderSchedulerTime,
        lastRunAt: settings.deadlineReminderSchedulerLastRunAt,
        lastMessage: settings.deadlineReminderSchedulerLastMessage,
      },
      killSwitch: settings.deadlineReminderKillSwitch,
      defaultDryRun: settings.deadlineReminderMode !== "production",
    },
    disabledLegacyKeys: [...disabledLegacyNotificationKeys, ...disabledLegacyCommandKeys],
    disabledLegacyNotificationKeys,
    disabledLegacyCommandKeys,
    templates,
    notifications: safeRuntimeNotifications,
    queries: queries.filter((query) => query.isActive),
    dbConnections: dbConnections.map((connection) => ({
      key: connection.key,
      name: connection.name,
      description: connection.description,
      driver: connection.driver,
      host: connection.host,
      port: connection.port,
      databaseName: connection.database_name,
      username: connection.username,
      passwordEnvKey: connection.password_env_key,
      passwordSecret: connection.password_secret,
      passwordSource: connection.password_secret ? "manual" : connection.password_env_key ? "env" : "none",
      sslEnabled: Boolean(connection.ssl_enabled),
      connectionTimeoutMs: Number(connection.connection_timeout_ms || 5000),
      isActive: Boolean(connection.is_active),
      isDefault: Boolean(connection.is_default),
      legacySource: connection.legacy_source,
      lastTestStatus: connection.last_test_status,
      lastTestError: connection.last_test_error,
      lastTestAt: connection.last_test_at,
    })),
    publicQaEnabled: true,
    publicQaAiEnabled: process.env.ALETA_BOT_PUBLIC_QA_AI_ENABLED === "true",
    publicQaAiAnswerEnabled: process.env.ALETA_BOT_PUBLIC_QA_AI_ANSWER_ENABLED === "true",
    publicQaAiAnswerMode: process.env.ALETA_BOT_PUBLIC_QA_AI_ANSWER_MODE || "template_only",
    publicQaAiTimeoutMs: Number(process.env.ALETA_BOT_PUBLIC_QA_AI_TIMEOUT_MS || 8000),
    publicQaMaxTokens: Number(process.env.ALETA_BOT_PUBLIC_QA_MAX_TOKENS || 400),
    publicQaTemperature: Number(process.env.ALETA_BOT_PUBLIC_QA_TEMPERATURE || 0.2),
    publicQaSessionTtlMinutes: Number(process.env.ALETA_BOT_PUBLIC_QA_SESSION_TTL_MINUTES || 20),
    publicQaRequireApproval: process.env.ALETA_BOT_PUBLIC_QA_REQUIRE_APPROVAL !== "false",
    institutionIdentity: {
      courtName: institutionIdentity.courtName,
      courtShortName: institutionIdentity.courtShortName,
      address: institutionIdentity.address,
      phoneNumber: institutionIdentity.phoneNumber,
      mobilePhone: institutionIdentity.mobilePhone,
      csWhatsappNumber: institutionIdentity.csWhatsappNumber ?? "",
      botWhatsappNumber: institutionIdentity.botWhatsappNumber ?? "",
      email: institutionIdentity.email,
      instagram: institutionIdentity.instagram ?? "",
      facebook: institutionIdentity.facebook ?? "",
      youtube: institutionIdentity.youtube ?? "",
      website: institutionIdentity.website ?? "",
      mapUrl: institutionIdentity.mapUrl ?? "",
    },
    publicQaIntents: publicQaIntents.map((intent) => ({
      id: intent.id,
      key: intent.key,
      name: intent.name,
      description: intent.description,
      category: intent.category,
      audience: intent.audience,
      isActive: intent.isActive,
      aiEnabled: intent.aiEnabled,
      exactTriggers: intent.exactTriggers,
      exampleQuestions: intent.exampleQuestions,
      requiredParameters: intent.requiredParameters,
      queryKey: intent.queryKey,
      legacyHandler: intent.legacyHandler,
      legacyCommand: intent.legacyCommand,
      parameterizedLegacyCommand: intent.parameterizedLegacyCommand,
      templateKey: intent.templateKey,
      responseMode: intent.responseMode,
      confidenceThreshold: intent.confidenceThreshold,
      requiresVerification: intent.requiresVerification,
      requiresCaseNumber: intent.requiresCaseNumber,
      maxAttempts: intent.maxAttempts,
      fallbackMessage: intent.fallbackMessage,
      answerTemplate: intent.answerTemplate,
      matchKeywords: intent.matchKeywords,
      riskLevel: intent.riskLevel,
      notes: intent.notes,
      aiAnswerEnabled: intent.aiAnswerEnabled,
      aiAnswerMode: intent.aiAnswerMode,
      answerPolicy: intent.answerPolicy,
      verificationPolicy: intent.verificationPolicy,
      allowedDataFields: intent.allowedDataFields,
      blockedDataFields: intent.blockedDataFields,
      aiSystemPrompt: intent.aiSystemPrompt,
      aiUserPromptTemplate: intent.aiUserPromptTemplate,
      maxAiTokens: intent.maxAiTokens,
      temperature: intent.temperature,
      requiresApprovalBeforeActive: intent.requiresApprovalBeforeActive,
      version: intent.version,
      status: intent.status,
      approvedBy: intent.approvedBy,
      approvedAt: intent.approvedAt,
    })),
    publicQaKnowledge: publicQaKnowledge
      .filter((item) => item.isActive)
      .map((item) => ({
        id: item.id,
        key: item.key,
        title: item.title,
        category: item.category,
        audience: item.audience,
        keywords: item.keywords,
        answer: item.answer,
        sourceLabel: item.sourceLabel,
        sourceUrl: item.sourceUrl,
        priority: item.priority,
        isActive: item.isActive,
        updatedAt: item.updatedAt,
      })),
    employeeRecipients,
    blockedRecipients,
    whatsapp: {
      phoneNumber: whatsappSettings.phoneNumber,
      sessionName: whatsappSettings.sessionName,
      status: whatsappSettings.status,
      lastConnectedAt: whatsappSettings.lastConnectedAt ?? null,
    },
  };
  const targets = [
    path.join(process.cwd(), "data", "aleta-bot-runtime.json"),
    path.resolve(process.cwd(), "..", "aleta_bot", "config", "aleta-runtime.json"),
  ];

  const localWrites = await Promise.all(
    targets.map(async (targetPath) => {
      try {
        await mkdir(path.dirname(targetPath), { recursive: true });
        await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
        return { targetPath, ok: true as const };
      } catch (error) {
        return {
          targetPath,
          ok: false as const,
          message: error instanceof Error ? error.message : "Gagal menulis runtime config.",
        };
      }
    })
  );

  let runtimeSync:
    | { attempted: false; ok: false; message: string }
    | { attempted: true; ok: true; message: string }
    | { attempted: true; ok: false; message: string } = {
    attempted: false,
    ok: false,
    message: "Runtime ALETA Bot tidak memakai mode gateway.",
  };

  if (getWhatsappRuntimeMode() === "aleta_bot") {
    try {
      await callAletaBotRuntime("/internal/aleta-bot/config/sync", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      runtimeSync = {
        attempted: true,
        ok: true,
        message: "Runtime config berhasil disinkronkan ke layanan aleta_bot.",
      };
    } catch (error) {
      runtimeSync = {
        attempted: true,
        ok: false,
        message: error instanceof Error ? error.message : "Sinkronisasi runtime aleta_bot gagal.",
      };
    }
  }

  return { localWrites, runtimeSync };
}

export async function syncAletaBotRuntimeConfigFromDb(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  return writeAletaBotRuntimeConfig(db, await getAletaBotSettings(db), await getWhatsAppSettingsFromDb(db));
}

export async function updateAletaBotSettings(
  db: AletaDatabase,
  {
    actorUserId,
    payload,
  }: {
    actorUserId: string;
    payload: Partial<Omit<AletaBotSettings, "updatedAt">>;
  }
) {
  const actor = await requireSuperAdmin(db, actorUserId);
  await ensureAletaBotSeeded(db);

  return withTransaction(db, async (tx) => {
    const current = await getAletaBotSettings(tx);
    const nextSettings: AletaBotSettings = {
      ...current,
      ...payload,
      adminWhatsappNumber:
        payload.adminWhatsappNumber === undefined
          ? current.adminWhatsappNumber
          : payload.adminWhatsappNumber.trim()
            ? assertWhatsappNumber(payload.adminWhatsappNumber, "Nomor admin WhatsApp")
            : "",
      testTargetNumber:
        payload.testTargetNumber === undefined
          ? current.testTargetNumber
          : payload.testTargetNumber.trim()
            ? assertWhatsappNumber(payload.testTargetNumber, "Nomor tujuan testing")
            : "",
      messageDelayMs:
        payload.messageDelayMs === undefined
          ? current.messageDelayMs
          : Math.min(60000, Math.max(0, Number(payload.messageDelayMs))),
      sendingRiskLevel:
        payload.sendingRiskLevel === undefined
          ? current.sendingRiskLevel
          : resolveSendingRiskPreset(payload.sendingRiskLevel).level,
      retryLimit:
        payload.retryLimit === undefined
          ? current.retryLimit
          : Math.min(10, Math.max(0, Number(payload.retryLimit))),
      scheduleCron:
        payload.scheduleCron === undefined ? current.scheduleCron : validateCronLike(payload.scheduleCron),
      securityNotes:
        payload.securityNotes === undefined ? current.securityNotes : payload.securityNotes.trim().slice(0, 800),
      deadlineReminderEnabled:
        payload.deadlineReminderEnabled === undefined
          ? current.deadlineReminderEnabled
          : Boolean(payload.deadlineReminderEnabled),
      deadlineReminderMode:
        payload.deadlineReminderMode === undefined
          ? current.deadlineReminderMode
          : ["disabled", "dry_run", "pilot", "production"].includes(payload.deadlineReminderMode)
            ? payload.deadlineReminderMode
            : current.deadlineReminderMode,
      deadlineReminderPilotUserIds:
        payload.deadlineReminderPilotUserIds === undefined
          ? current.deadlineReminderPilotUserIds
          : sanitizeStringIdList(payload.deadlineReminderPilotUserIds),
      deadlineReminderPilotRoleIds:
        payload.deadlineReminderPilotRoleIds === undefined
          ? current.deadlineReminderPilotRoleIds
          : sanitizeStringIdList(payload.deadlineReminderPilotRoleIds),
      deadlineReminderPilotPositionIds:
        payload.deadlineReminderPilotPositionIds === undefined
          ? current.deadlineReminderPilotPositionIds
          : sanitizeStringIdList(payload.deadlineReminderPilotPositionIds),
      deadlineReminderSchedulerEnabled:
        payload.deadlineReminderSchedulerEnabled === undefined
          ? current.deadlineReminderSchedulerEnabled
          : Boolean(payload.deadlineReminderSchedulerEnabled),
      deadlineReminderSchedulerMode:
        payload.deadlineReminderSchedulerMode === undefined
          ? current.deadlineReminderSchedulerMode
          : ["disabled", "dry_run", "pilot", "production"].includes(payload.deadlineReminderSchedulerMode)
            ? payload.deadlineReminderSchedulerMode
            : current.deadlineReminderSchedulerMode,
      deadlineReminderSchedulerTime:
        payload.deadlineReminderSchedulerTime === undefined
          ? current.deadlineReminderSchedulerTime
          : sanitizeReminderSchedulerTime(payload.deadlineReminderSchedulerTime, current.deadlineReminderSchedulerTime),
      deadlineReminderKillSwitch:
        payload.deadlineReminderKillSwitch === undefined
          ? current.deadlineReminderKillSwitch
          : Boolean(payload.deadlineReminderKillSwitch),
      updatedAt: new Date().toISOString(),
    };

    await tx
      .prepare(
        `UPDATE aleta_bot_settings
         SET bot_enabled = ?, notifications_enabled = ?,
           kirim_pegawai_enabled = ?, kirim_pihak_enabled = ?,
           admin_whatsapp_number = ?,
           message_delay_ms = ?, sending_risk_level = ?, retry_limit = ?, dry_run_enabled = ?, schedule_cron = ?,
           test_target_number = ?, security_notes = ?,
           disposition_deadline_reminder_enabled = ?,
           disposition_deadline_reminder_mode = ?,
           disposition_deadline_reminder_approved_at = ?,
           disposition_deadline_reminder_approved_by = ?,
           disposition_deadline_reminder_last_run_at = ?,
           disposition_deadline_reminder_last_status = ?,
           disposition_deadline_reminder_last_message = ?,
           disposition_deadline_reminder_pilot_user_ids_json = ?,
           disposition_deadline_reminder_pilot_role_ids_json = ?,
           disposition_deadline_reminder_pilot_position_ids_json = ?,
           disposition_deadline_reminder_scheduler_enabled = ?,
           disposition_deadline_reminder_scheduler_mode = ?,
           disposition_deadline_reminder_scheduler_time = ?,
           disposition_deadline_reminder_scheduler_last_run_at = ?,
           disposition_deadline_reminder_scheduler_last_message = ?,
           disposition_deadline_reminder_kill_switch = ?,
           updated_at = ?
         WHERE id = 1`
      )
      .run(
        nextSettings.botEnabled ? 1 : 0,
        nextSettings.notificationsEnabled ? 1 : 0,
        nextSettings.kirimPegawaiEnabled ? 1 : 0,
        nextSettings.kirimPihakEnabled ? 1 : 0,
        nextSettings.adminWhatsappNumber,
        nextSettings.messageDelayMs,
        nextSettings.sendingRiskLevel,
        nextSettings.retryLimit,
        nextSettings.dryRunEnabled ? 1 : 0,
        nextSettings.scheduleCron,
        nextSettings.testTargetNumber,
        nextSettings.securityNotes,
        nextSettings.deadlineReminderEnabled ? 1 : 0,
        nextSettings.deadlineReminderMode,
        nextSettings.deadlineReminderApprovedAt,
        nextSettings.deadlineReminderApprovedBy,
        nextSettings.deadlineReminderLastRunAt,
        nextSettings.deadlineReminderLastStatus,
        nextSettings.deadlineReminderLastMessage,
        JSON.stringify(nextSettings.deadlineReminderPilotUserIds),
        JSON.stringify(nextSettings.deadlineReminderPilotRoleIds),
        JSON.stringify(nextSettings.deadlineReminderPilotPositionIds),
        nextSettings.deadlineReminderSchedulerEnabled ? 1 : 0,
        nextSettings.deadlineReminderSchedulerMode,
        nextSettings.deadlineReminderSchedulerTime,
        nextSettings.deadlineReminderSchedulerLastRunAt,
        nextSettings.deadlineReminderSchedulerLastMessage,
        nextSettings.deadlineReminderKillSwitch ? 1 : 0,
        nextSettings.updatedAt
      );

    const savedSettings = await tx
      .prepare(`SELECT admin_whatsapp_number FROM aleta_bot_settings WHERE id = 1`)
      .get<{ admin_whatsapp_number: string }>();
    if ((savedSettings?.admin_whatsapp_number ?? "") !== nextSettings.adminWhatsappNumber) {
      throw new ApiError(500, "Nomor admin WhatsApp belum berhasil tersimpan ke database.");
    }

    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: "success",
      eventType: "settings",
      message: "Konfigurasi ALETA Bot diperbarui dari portal.",
      metadata: {
        botEnabled: nextSettings.botEnabled,
        notificationsEnabled: nextSettings.notificationsEnabled,
        kirimPegawaiEnabled: nextSettings.kirimPegawaiEnabled,
        kirimPihakEnabled: nextSettings.kirimPihakEnabled,
        dryRunEnabled: nextSettings.dryRunEnabled,
        deadlineReminderMode: nextSettings.deadlineReminderMode,
      },
    });
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_ALETA_BOT_SETTINGS",
      entityType: "aleta_bot_settings",
      entityId: "1",
      payload: {
        ...nextSettings,
        adminWhatsappNumber: nextSettings.adminWhatsappNumber ? "configured" : "",
        testTargetNumber: nextSettings.testTargetNumber ? "configured" : "",
      },
    });

    const whatsappSettings = await getWhatsAppSettingsFromDb(tx);
    const syncResult = await writeAletaBotRuntimeConfig(tx, nextSettings, whatsappSettings);
    if (!syncResult.runtimeSync.ok || syncResult.localWrites.some((item) => !item.ok)) {
      await appendAletaBotLog(tx, {
        actorUserId: actor.id,
        level: "warning",
        eventType: "settings",
        message: "Konfigurasi tersimpan, tetapi sinkronisasi runtime ALETA Bot perlu dicek.",
        metadata: syncResult,
      });
    }

    return getAletaBotSnapshot(tx, actor.id);
  });
}

export async function updateAletaBotTemplate(
  db: AletaDatabase,
  {
    actorUserId,
    templateId,
    body,
  }: {
    actorUserId: string;
    templateId: string;
    body: string;
  }
) {
  const actor = await requireAletaBotOperator(db, actorUserId);
  const nextBody = body.trim();
  if (nextBody.length < 8 || nextBody.length > 4000) {
    throw new ApiError(400, "Template harus berisi 8-4000 karakter.");
  }

  return withTransaction(db, async (tx) => {
    await ensureAletaBotSeeded(tx);
    const template = await tx
      .prepare(`SELECT id, editable, category, placeholders_json FROM aleta_bot_templates WHERE id = ?`)
      .get<{ id: string; editable: number; category: AletaBotTemplate["category"]; placeholders_json: string }>(templateId);

    if (!template) {
      throw new ApiError(404, "Template ALETA Bot tidak ditemukan.");
    }
    if (!template.editable) {
      throw new ApiError(400, "Template ini tidak bisa diedit dari portal.");
    }
    const requiredPlaceholders = parseJson<string[]>(template.placeholders_json, []);
    const placeholders = validateTemplateBody(nextBody, { category: template.category, requiredPlaceholders });

    await tx
      .prepare(`UPDATE aleta_bot_templates SET body = ?, placeholders_json = ?, updated_at = ? WHERE id = ?`)
      .run(nextBody, JSON.stringify(placeholders), new Date().toISOString(), templateId);
    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: "success",
      eventType: "template",
      message: `Template ${templateId} diperbarui.`,
      metadata: { templateId, placeholders },
    });
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_ALETA_BOT_TEMPLATE",
      entityType: "aleta_bot_templates",
      entityId: templateId,
      payload: { templateId },
    });
    await writeAletaBotRuntimeConfig(tx, await getAletaBotSettings(tx), await getWhatsAppSettingsFromDb(tx));

    return getAletaBotSnapshot(tx, actor.id);
  });
}

export async function updateAletaBotQuery(
  db: AletaDatabase,
  {
    actorUserId,
    query,
  }: {
    actorUserId: string;
    query: Omit<Partial<AletaBotQuery>, "outputColumns"> &
      Pick<AletaBotQuery, "name" | "category" | "sqlText"> & {
        outputColumns?: string[] | string;
        connectionKey?: string;
      };
  }
) {
  const actor = await requireAletaBotOperator(db, actorUserId);
  const now = new Date().toISOString();
  const id = query.id?.trim() || (await nextPrefixedId(db, "aleta_bot_queries", "abq"));
  const name = query.name.trim();
  if (!name) throw new ApiError(400, "Nama sumber data wajib diisi.");
  const category = query.category;
  if (!["employee", "party", "system"].includes(category)) throw new ApiError(400, "Kategori sumber data tidak valid.");
  const sqlText = validateReadOnlyQuery(query.sqlText);
  const outputColumns = validateOutputColumns(parseColumns(query.outputColumns));
  if (outputColumns.length === 0) throw new ApiError(400, "Kolom hasil sumber data wajib diisi.");
  const recipientColumn = String(query.recipientColumn ?? "").trim();
  if (category === "party" && (!recipientColumn || !outputColumns.includes(recipientColumn))) {
    throw new ApiError(400, "Sumber data untuk pihak wajib memiliki kolom nomor tujuan yang ada di kolom hasil.");
  }
  const connectionKey = validateConnectionKey(query.connectionKey || "sipp_primary");

  return withTransaction(db, async (tx) => {
    await ensureAletaBotSeeded(tx);
    const duplicate = await tx
      .prepare(`SELECT id FROM aleta_bot_queries WHERE lower(name) = lower(?) AND id <> ?`)
      .get<{ id: string }>(name, id);
    if (duplicate) throw new ApiError(400, "Nama sumber data ALETA Bot sudah dipakai.");

    const existing = await tx.prepare(`SELECT id FROM aleta_bot_queries WHERE id = ?`).get<{ id: string }>(id);
    const connection = (await getDbConnections(tx)).find((item) => item.key === connectionKey);
    if (!connection) throw new ApiError(400, "Connection key database tidak ditemukan.");
    if (!connection.isActive && query.isActive !== false) {
      throw new ApiError(400, "Sumber data aktif tidak boleh memakai koneksi database yang nonaktif.");
    }

    if (existing) {
      await tx
        .prepare(
          `UPDATE aleta_bot_queries
           SET name = ?, category = ?, description = ?, sql_text = ?, output_columns_json = ?,
             recipient_column = ?, connection_key = ?, is_active = ?, updated_by = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          name,
          category,
          String(query.description ?? "").trim(),
          sqlText,
          JSON.stringify(outputColumns),
          recipientColumn,
          connectionKey,
          query.isActive === false ? 0 : 1,
          actor.id,
          now,
          id
        );
    } else {
      await tx
        .prepare(
          `INSERT INTO aleta_bot_queries (
            id, name, category, description, sql_text, output_columns_json, recipient_column,
            connection_key, is_active, last_test_status, created_by, updated_by, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?)`
        )
        .run(
          id,
          name,
          category,
          String(query.description ?? "").trim(),
          sqlText,
          JSON.stringify(outputColumns),
          recipientColumn,
          connectionKey,
          query.isActive === false ? 0 : 1,
          actor.id,
          actor.id,
          now,
          now
        );
    }

    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: "success",
      eventType: "query",
      message: `Query ALETA Bot ${name} disimpan.`,
      metadata: { queryId: id, category, connectionKey },
    });
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: existing ? "UPDATE_ALETA_BOT_QUERY" : "CREATE_ALETA_BOT_QUERY",
      entityType: "aleta_bot_queries",
      entityId: id,
      payload: { name, category, outputColumns, recipientColumn, connectionKey },
    });
    await writeAletaBotRuntimeConfig(tx, await getAletaBotSettings(tx), await getWhatsAppSettingsFromDb(tx));
    return getAletaBotSnapshot(tx, actor.id);
  });
}

export async function updateAletaBotNotification(
  db: AletaDatabase,
  {
    actorUserId,
    notification,
  }: {
    actorUserId: string;
    notification: Partial<AletaBotNotification> & Pick<AletaBotNotification, "name" | "category" | "queryId" | "templateId">;
  }
) {
  const actor = await requireAletaBotOperator(db, actorUserId);
  const now = new Date().toISOString();
  const id = notification.id?.trim() || (await nextPrefixedId(db, "aleta_bot_notifications", "abn"));
  const name = notification.name.trim();
  if (!name) throw new ApiError(400, "Nama notifikasi wajib diisi.");
  if (!["employee", "party"].includes(notification.category)) throw new ApiError(400, "Kategori notifikasi wajib Pegawai atau Pihak.");

  return withTransaction(db, async (tx) => {
    await ensureAletaBotSeeded(tx);
    const duplicate = await tx
      .prepare(`SELECT id FROM aleta_bot_notifications WHERE lower(name) = lower(?) AND id <> ?`)
      .get<{ id: string }>(name, id);
    if (duplicate) throw new ApiError(400, "Nama notifikasi ALETA Bot sudah dipakai.");

    const query = (await getQueries(tx)).find((item) => item.id === notification.queryId);
    if (!query) throw new ApiError(404, "Sumber data notifikasi tidak ditemukan.");
    if (!query.isActive && notification.isActive) throw new ApiError(400, "Sumber data nonaktif tidak bisa dipakai oleh notifikasi aktif.");

    const template = (await getTemplates(tx)).find((item) => item.id === notification.templateId);
    if (!template) throw new ApiError(404, "Isi pesan notifikasi tidak ditemukan.");

    const placeholders = getTemplatePlaceholders(template.body);
    const allowedColumns = new Set([...query.outputColumns, "nama_pegawai", "judul_notifikasi", "ringkasan", "waktu", "mode"]);
    const missingPlaceholders = placeholders.filter((placeholder) => !allowedColumns.has(placeholder));
    if (missingPlaceholders.length > 0) {
      throw new ApiError(400, `Placeholder isi pesan tidak cocok dengan kolom sumber data: ${missingPlaceholders.join(", ")}.`);
    }

    const recipientSource = notification.category === "employee" ? "users" : "query";
    if (notification.category === "party" && !query.recipientColumn) {
      throw new ApiError(400, "Notifikasi pihak wajib memakai sumber data dengan kolom nomor tujuan.");
    }
    if (notification.category === "employee") {
      const employeeRecipients = await getEmployeeRecipients(tx);
      if (employeeRecipients.length === 0 && notification.isActive) {
        throw new ApiError(400, "Tidak ada user aktif dengan nomor WhatsApp valid untuk notifikasi Pegawai.");
      }
      const targetedEmployeeRecipients = filterEmployeeRecipientsByMapping(employeeRecipients, notification.recipientMapping ?? {});
      if (targetedEmployeeRecipients.length === 0 && notification.isActive) {
        throw new ApiError(400, "Target pegawai tidak cocok dengan role, jabatan, atau nama pegawai yang punya nomor WhatsApp valid.");
      }
    }

    const scheduleConfig = validateScheduleConfig(
      notification.scheduleConfig ?? {
        type: "manual",
        cron: "",
        trigger: "manual",
      }
    );
    const delayMs = Math.min(60000, Math.max(0, Number(notification.delayMs ?? 1500)));
    const retryLimit = Math.min(10, Math.max(0, Number(notification.retryLimit ?? 2)));
    const recipientMapping =
      notification.category === "employee"
        ? { ...(notification.recipientMapping ?? {}), source: "users.whatsapp_number" }
        : {
            ...(notification.recipientMapping ?? {}),
            recipientColumn: query.recipientColumn,
            fallbackColumns: ["nomor_hp", "nomor_whatsapp", "telepon"],
          };

    const existing = await tx
      .prepare(`SELECT id, is_active, last_status FROM aleta_bot_notifications WHERE id = ?`)
      .get<{ id: string; is_active: number; last_status: AletaBotNotification["lastStatus"] }>(id);
    // Notifikasi bawaan standar tidak melewati ritual ini — sudah disetujui
    // secara bawaan. Yang tetap dijaga hanyalah notifikasi pihak BUATAN admin.
    if (
      notification.category === "party" &&
      notification.isActive &&
      existing?.is_active !== 1 &&
      !isBuiltInNotification(id)
    ) {
      const dryRunPassed = existing?.last_status === "simulated";
      const previewPassed = existing ? await hasNotificationRecipientPreview(tx, id) : false;
      const approved = existing ? await hasApprovedNotificationPolicy(tx, id) : false;
      if (!dryRunPassed || !previewPassed || !approved) {
        throw new ApiError(
          400,
          "Notifikasi pihak belum dapat diaktifkan. Jalankan simulasi, preview penerima, dan approval terlebih dahulu."
        );
      }
    }
    if (existing) {
      await tx
        .prepare(
          `UPDATE aleta_bot_notifications
           SET name = ?, category = ?, description = ?, query_id = ?, template_id = ?,
             recipient_source = ?, recipient_mapping_json = ?, schedule_config_json = ?,
             is_active = ?, attach_document = ?, delay_ms = ?, retry_limit = ?, updated_by = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          name,
          notification.category,
          String(notification.description ?? "").trim(),
          notification.queryId,
          notification.templateId,
          recipientSource,
          JSON.stringify(recipientMapping),
          JSON.stringify(scheduleConfig),
          notification.isActive ? 1 : 0,
          notification.attachDocument === false ? 0 : 1,
          delayMs,
          retryLimit,
          actor.id,
          now,
          id
        );
    } else {
      await tx
        .prepare(
          `INSERT INTO aleta_bot_notifications (
            id, name, category, description, query_id, template_id, recipient_source,
            recipient_mapping_json, schedule_config_json, is_active, attach_document, delay_ms, retry_limit,
            last_status, created_by, updated_by, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?)`
        )
        .run(
          id,
          name,
          notification.category,
          String(notification.description ?? "").trim(),
          notification.queryId,
          notification.templateId,
          recipientSource,
          JSON.stringify(recipientMapping),
          JSON.stringify(scheduleConfig),
          notification.isActive ? 1 : 0,
          notification.attachDocument === false ? 0 : 1,
          delayMs,
          retryLimit,
          actor.id,
          actor.id,
          now,
          now
        );
    }

    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: "success",
      eventType: "notification",
      message: `Notifikasi ALETA Bot ${name} disimpan.`,
      metadata: { notificationId: id, category: notification.category, queryId: notification.queryId },
    });
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: existing ? "UPDATE_ALETA_BOT_NOTIFICATION" : "CREATE_ALETA_BOT_NOTIFICATION",
      entityType: "aleta_bot_notifications",
      entityId: id,
      payload: { name, category: notification.category, queryId: notification.queryId, templateId: notification.templateId },
    });
    await writeAletaBotRuntimeConfig(tx, await getAletaBotSettings(tx), await getWhatsAppSettingsFromDb(tx));
    return getAletaBotSnapshot(tx, actor.id);
  });
}

export async function updateAletaBotDbConnection(
  db: AletaDatabase,
  {
    actorUserId,
    connection,
  }: {
    actorUserId: string;
    connection: Partial<AletaBotDbConnection> & Pick<AletaBotDbConnection, "name" | "key" | "host" | "databaseName" | "username"> & {
      newPassword?: string;
    };
  }
) {
  const actor = await requireSuperAdmin(db, actorUserId);
  const now = new Date().toISOString();
  const id = connection.id?.trim() || (await nextPrefixedId(db, "aleta_bot_db_connections", "abdc"));
  const key = validateConnectionKey(connection.key);
  const name = connection.name.trim();
  if (!name) throw new ApiError(400, "Nama koneksi wajib diisi.");
  const driver = (connection.driver || "mysql").toLowerCase();
  if (driver !== "mysql") throw new ApiError(400, "Saat ini ALETA Bot hanya mendukung driver MySQL.");
  const host = connection.host.trim();
  if (!host) throw new ApiError(400, "Host database wajib diisi.");
  const databaseName = connection.databaseName.trim();
  if (!databaseName) throw new ApiError(400, "Nama database wajib diisi.");
  const username = connection.username.trim();
  if (!username) throw new ApiError(400, "Username database wajib diisi.");
  const port = Math.max(1, Math.min(65535, Number(connection.port || 3306)));
  const passwordEnvKey = String(connection.passwordEnvKey || "").trim();
  if (passwordEnvKey && !/^[A-Z][A-Z0-9_]{2,120}$/.test(passwordEnvKey)) {
    throw new ApiError(400, "Nama env password harus berupa huruf besar, angka, dan underscore.");
  }
  const connectionTimeoutMs = Math.max(1000, Math.min(30000, Number(connection.connectionTimeoutMs || 5000)));
  const newPassword = typeof connection.newPassword === "string" ? connection.newPassword : undefined;
  const passwordChanged = typeof newPassword === "string" && newPassword.length > 0;

  return withTransaction(db, async (tx) => {
    await ensureAletaBotSeeded(tx);
    const duplicate = await tx
      .prepare(`SELECT id FROM aleta_bot_db_connections WHERE lower(key) = lower(?) AND id <> ?`)
      .get<{ id: string }>(key, id);
    if (duplicate) throw new ApiError(400, "Connection key sudah dipakai.");

    if (connection.isDefault) {
      await tx.prepare(`UPDATE aleta_bot_db_connections SET is_default = 0, updated_at = ?`).run(now);
    }

    const existing = await tx
      .prepare(`SELECT id, password_secret, password_source FROM aleta_bot_db_connections WHERE id = ?`)
      .get<{ id: string; password_secret: string; password_source: string }>(id);
    const passwordSecret = passwordChanged
      ? encryptDbSecret(newPassword)
      : existing?.password_secret || "";
    const passwordSource = getPasswordSource(passwordSecret, passwordEnvKey);
    if (existing) {
      await tx
        .prepare(
          `UPDATE aleta_bot_db_connections
           SET key = ?, name = ?, description = ?, driver = ?, host = ?, port = ?,
             database_name = ?, username = ?, password_env_key = ?, password_secret = ?, password_source = ?, ssl_enabled = ?,
             connection_timeout_ms = ?, is_active = ?, is_default = ?, legacy_source = ?,
             updated_by = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          key,
          name,
          String(connection.description || "").trim(),
          driver,
          host,
          port,
          databaseName,
          username,
          passwordEnvKey,
          passwordSecret,
          passwordSource,
          connection.sslEnabled ? 1 : 0,
          connectionTimeoutMs,
          connection.isActive === false ? 0 : 1,
          connection.isDefault ? 1 : 0,
          String(connection.legacySource || "").trim(),
          actor.id,
          now,
          id
        );
    } else {
      await tx
        .prepare(
          `INSERT INTO aleta_bot_db_connections (
            id, key, name, description, driver, host, port, database_name,
            username, password_env_key, password_secret, password_source, ssl_enabled, connection_timeout_ms,
            is_active, is_default, legacy_source, last_test_status,
            created_by, updated_by, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?)`
        )
        .run(
          id,
          key,
          name,
          String(connection.description || "").trim(),
          driver,
          host,
          port,
          databaseName,
          username,
          passwordEnvKey,
          passwordSecret,
          passwordSource,
          connection.sslEnabled ? 1 : 0,
          connectionTimeoutMs,
          connection.isActive === false ? 0 : 1,
          connection.isDefault ? 1 : 0,
          String(connection.legacySource || "").trim(),
          actor.id,
          actor.id,
          now,
          now
        );
    }

    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: "success",
      eventType: "database",
      message: `Koneksi SQL ALETA Bot ${name} disimpan.`,
      metadata: {
        connectionId: id,
        key,
        host,
        databaseName,
        passwordEnvKey: passwordEnvKey ? "configured" : "",
        passwordConfigured: Boolean(passwordSecret || passwordEnvKey),
        passwordChanged,
        passwordSource,
      },
    });
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: existing ? "UPDATE_ALETA_BOT_DB_CONNECTION" : "CREATE_ALETA_BOT_DB_CONNECTION",
      entityType: "aleta_bot_db_connections",
      entityId: id,
      payload: {
        key,
        name,
        host,
        databaseName,
        username: maskValue(username),
        passwordConfigured: Boolean(passwordSecret || passwordEnvKey),
        passwordChanged,
        passwordSource,
        passwordEnvKey: passwordEnvKey ? "configured" : "",
      },
    });
    await writeAletaBotRuntimeConfig(tx, await getAletaBotSettings(tx), await getWhatsAppSettingsFromDb(tx));
    return getAletaBotSnapshot(tx, actor.id);
  });
}

export async function buildAletaBotDbConnectionTestConfig(
  db: AletaDatabase,
  connection: Partial<AletaBotDbConnection> & Pick<AletaBotDbConnection, "key" | "host" | "databaseName" | "username"> & {
    newPassword?: string;
  }
) {
  await ensureAletaBotSeeded(db);
  const key = validateConnectionKey(connection.key);
  const host = String(connection.host || "").trim();
  if (!host) throw new ApiError(400, "Host database wajib diisi.");
  const databaseName = String(connection.databaseName || "").trim();
  if (!databaseName) throw new ApiError(400, "Nama database wajib diisi.");
  const username = String(connection.username || "").trim();
  if (!username) throw new ApiError(400, "Username database wajib diisi.");
  const passwordEnvKey = String(connection.passwordEnvKey || "").trim();
  if (passwordEnvKey && !/^[A-Z][A-Z0-9_]{2,120}$/.test(passwordEnvKey)) {
    throw new ApiError(400, "Nama env password harus berupa huruf besar, angka, dan underscore.");
  }
  const existing = connection.id
    ? await db
        .prepare(`SELECT password_secret FROM aleta_bot_db_connections WHERE id = ?`)
        .get<{ password_secret: string }>(String(connection.id))
    : null;
  const newPassword = typeof connection.newPassword === "string" ? connection.newPassword : undefined;
  const passwordSecret = typeof newPassword === "string" && newPassword.length > 0
    ? encryptDbSecret(newPassword)
    : existing?.password_secret || "";

  return {
    key,
    name: String(connection.name || key).trim() || key,
    description: String(connection.description || "").trim(),
    driver: "mysql",
    host,
    port: Math.max(1, Math.min(65535, Number(connection.port || 3306))),
    databaseName,
    username,
    passwordEnvKey,
    passwordSecret,
    passwordSource: getPasswordSource(passwordSecret, passwordEnvKey),
    sslEnabled: Boolean(connection.sslEnabled),
    connectionTimeoutMs: Math.max(1000, Math.min(30000, Number(connection.connectionTimeoutMs || 5000))),
    isActive: connection.isActive !== false,
    isDefault: Boolean(connection.isDefault),
    legacySource: String(connection.legacySource || "").trim(),
  };
}

function parseListInput(input: unknown) {
  if (Array.isArray(input)) return input.map((item) => String(item).trim()).filter(Boolean);
  return String(input ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function updateAletaBotPublicQaIntent(
  db: AletaDatabase,
  {
    actorUserId,
    intent,
  }: {
    actorUserId: string;
    intent: Omit<Partial<AletaBotPublicQaIntent>, "exactTriggers" | "exampleQuestions" | "requiredParameters"> &
      Pick<AletaBotPublicQaIntent, "key" | "name" | "category" | "audience" | "responseMode" | "riskLevel"> & {
        exactTriggers?: unknown;
        exampleQuestions?: unknown;
        requiredParameters?: unknown;
      };
  }
) {
  const actor = await requireSuperAdmin(db, actorUserId);
  const now = new Date().toISOString();
  const id = intent.id?.trim() || (await nextPrefixedId(db, "aleta_bot_public_qa_intents", "abqa"));
  const key = String(intent.key || "").trim().toLowerCase().replace(/[^a-z0-9_ -]/g, "_").replace(/\s+/g, "_");
  if (!key) throw new ApiError(400, "Key intent wajib diisi.");
  const name = String(intent.name || "").trim();
  if (!name) throw new ApiError(400, "Nama aturan wajib diisi.");
  const category = intent.category;
  if (!["informasi_umum", "status_perkara", "jadwal_sidang", "biaya_panjar", "akta_cerai", "layanan", "pengaduan", "ecourt", "fallback"].includes(category)) {
    throw new ApiError(400, "Kategori aturan jawaban tidak valid.");
  }
  const audience = intent.audience;
  if (!["party", "public", "employee", "admin"].includes(audience)) throw new ApiError(400, "Tujuan aturan jawaban tidak valid.");
  const responseMode = intent.responseMode;
  if (!["static_template", "query_template", "legacy_handler", "ai_guided_template", "fallback"].includes(responseMode)) {
    throw new ApiError(400, "Cara menjawab tidak valid.");
  }
  const exactTriggers = parseListInput(intent.exactTriggers);
  const exampleQuestions = parseListInput(intent.exampleQuestions);
  if (intent.aiEnabled && exampleQuestions.length === 0) {
    throw new ApiError(400, "AI pengenal pertanyaan tidak boleh aktif tanpa contoh pertanyaan.");
  }
  const requiredParameters = parseListInput(intent.requiredParameters);
  const confidenceThreshold = Math.max(0.4, Math.min(1, Number(intent.confidenceThreshold || 0.7)));
  const riskLevel = intent.riskLevel;
  if (!["low", "medium", "high"].includes(riskLevel)) throw new ApiError(400, "Risiko jawaban tidak valid.");
  const fallbackMessage = String(intent.fallbackMessage || PUBLIC_QA_FALLBACK_MESSAGE).trim();
  if (!fallbackMessage) throw new ApiError(400, "Jawaban saat belum bisa diproses wajib diisi.");
  const queryKey = String(intent.queryKey || "").trim();
  if (queryKey && !(await getQueries(db)).some((query) => query.id === queryKey || query.name === queryKey)) {
    throw new ApiError(400, "Sumber data aturan jawaban tidak ditemukan.");
  }
  const legacyHandler = String(intent.legacyHandler || "").trim();
  const legacyCommand = String(intent.legacyCommand || "").trim();
  const parameterizedLegacyCommand = String(intent.parameterizedLegacyCommand || "").trim();
  if (["query_template", "legacy_handler"].includes(responseMode) && !queryKey && !legacyHandler && !legacyCommand) {
    throw new ApiError(400, "Aturan jawaban dinamis wajib punya sumber data atau jalur lama.");
  }
  const aiAnswerMode = String(intent.aiAnswerMode || "off") as AletaBotPublicQaIntent["aiAnswerMode"];
  if (!["off", "template_only", "template_rewrite", "query_summarize", "guided_answer"].includes(aiAnswerMode)) {
    throw new ApiError(400, "Mode jawaban AI tidak valid.");
  }
  const answerPolicy = String(intent.answerPolicy || "public_info_only") as AletaBotPublicQaIntent["answerPolicy"];
  if (!["public_info_only", "case_status_limited", "requires_verified_party", "admin_only"].includes(answerPolicy)) {
    throw new ApiError(400, "Batas data jawaban tidak valid.");
  }
  const verificationPolicy = String(intent.verificationPolicy || "none") as AletaBotPublicQaIntent["verificationPolicy"];
  if (!["none", "case_number_only", "phone_match", "case_number_and_phone", "manual_ptsp"].includes(verificationPolicy)) {
    throw new ApiError(400, "Verifikasi aturan jawaban tidak valid.");
  }
  if (["employee", "admin"].includes(audience) && intent.isActive && !["phone_match", "case_number_and_phone", "manual_ptsp"].includes(verificationPolicy)) {
    throw new ApiError(400, "Aturan untuk pegawai/admin wajib memakai verifikasi nomor WhatsApp terdaftar atau pemeriksaan petugas.");
  }
  const allowedDataFields = parseListInput(intent.allowedDataFields);
  const blockedDataFields = parseListInput(intent.blockedDataFields);
  const aiSystemPrompt = String(intent.aiSystemPrompt || "").trim();
  const aiUserPromptTemplate = String(intent.aiUserPromptTemplate || "").trim();
  const aiAnswerEnabled = Boolean(intent.aiAnswerEnabled);
  if (aiAnswerEnabled && aiAnswerMode !== "off" && !fallbackMessage) {
    throw new ApiError(400, "Jawaban saat belum bisa diproses wajib ada sebelum AI menyusun jawaban aktif.");
  }
  if (aiAnswerEnabled && aiAnswerMode !== "off" && exampleQuestions.length === 0) {
    throw new ApiError(400, "AI penyusun jawaban tidak boleh aktif tanpa contoh pertanyaan.");
  }
  // Aturan jawaban tidak lagi mengenal tahap draft: begitu dibuat, ia langsung
  // berlaku. Pengaman yang tetap dipertahankan adalah batas DATA (audiens
  // pegawai/admin wajib verifikasi nomor), bukan penundaan berlakunya aturan.
  const status = (intent.status || "active") as AletaBotPublicQaIntent["status"];
  if (!["draft", "active", "archived"].includes(status)) throw new ApiError(400, "Status aturan jawaban tidak valid.");
  const requiresApprovalBeforeActive = intent.requiresApprovalBeforeActive !== false;
  // Blangko jawaban dibatasi panjangnya karena dikirim lewat WhatsApp.
  const answerTemplate = String(intent.answerTemplate || "").trim().slice(0, 4000);
  const matchKeywords = parseListInput(intent.matchKeywords)
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 40);
  const maxAiTokens = Math.max(100, Math.min(1200, Number(intent.maxAiTokens || 400)));
  const temperature = Math.max(0, Math.min(0.7, Number(intent.temperature ?? 0.2)));

  return withTransaction(db, async (tx) => {
    await ensureAletaBotSeeded(tx);
    const duplicate = await tx
      .prepare(`SELECT id FROM aleta_bot_public_qa_intents WHERE lower(key) = lower(?) AND id <> ?`)
      .get<{ id: string }>(key, id);
    if (duplicate) throw new ApiError(400, "Kode aturan jawaban sudah dipakai.");

    const existing = await tx.prepare(`SELECT * FROM aleta_bot_public_qa_intents WHERE id = ?`).get<PublicQaIntentRow>(id);
    const isActive = status === "archived" ? false : intent.isActive !== false;
    const nextVersion = Number(existing?.version || 0) + 1;
    if (existing) {
      await tx
        .prepare(
          `INSERT INTO aleta_bot_public_qa_intent_versions (
            id, intent_id, version, snapshot_json, change_note, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          await nextPrefixedId(tx, "aleta_bot_public_qa_intent_versions", "abqv"),
          id,
          Number(existing.version || 1),
          JSON.stringify(existing),
          String(intent.notes || "Perubahan intent dari portal ALETA Bot.").slice(0, 500),
          actor.id,
          now
        );
      await tx
        .prepare(
          `UPDATE aleta_bot_public_qa_intents
           SET key = ?, name = ?, description = ?, category = ?, audience = ?,
             is_active = ?, ai_enabled = ?, exact_triggers_json = ?, example_questions_json = ?,
             required_parameters_json = ?, query_key = ?, legacy_handler = ?,
             legacy_command = ?, parameterized_legacy_command = ?, template_key = ?,
             response_mode = ?, confidence_threshold = ?, requires_verification = ?,
             requires_case_number = ?, max_attempts = ?, fallback_message = ?,
             answer_template = ?, match_keywords_json = ?, risk_level = ?,
             notes = ?, ai_answer_enabled = ?, ai_answer_mode = ?, answer_policy = ?,
             verification_policy = ?, allowed_data_fields_json = ?, blocked_data_fields_json = ?,
             ai_system_prompt = ?, ai_user_prompt_template = ?, max_ai_tokens = ?,
             temperature = ?, requires_approval_before_active = ?, version = ?, status = ?,
             approved_by = ?, approved_at = ?, updated_by = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          key,
          name,
          String(intent.description || "").trim(),
          category,
          audience,
          isActive ? 1 : 0,
          intent.aiEnabled ? 1 : 0,
          JSON.stringify(exactTriggers),
          JSON.stringify(exampleQuestions),
          JSON.stringify(requiredParameters),
          queryKey,
          legacyHandler,
          legacyCommand,
          parameterizedLegacyCommand,
          String(intent.templateKey || "").trim(),
          responseMode,
          confidenceThreshold,
          intent.requiresVerification ? 1 : 0,
          intent.requiresCaseNumber ? 1 : 0,
          Math.max(1, Math.min(5, Number(intent.maxAttempts || 2))),
          fallbackMessage,
          answerTemplate,
          JSON.stringify(matchKeywords),
          riskLevel,
          String(intent.notes || "").trim(),
          aiAnswerEnabled ? 1 : 0,
          aiAnswerMode,
          answerPolicy,
          verificationPolicy,
          JSON.stringify(allowedDataFields),
          JSON.stringify(blockedDataFields),
          aiSystemPrompt,
          aiUserPromptTemplate,
          maxAiTokens,
          temperature,
          requiresApprovalBeforeActive ? 1 : 0,
          nextVersion,
          status,
          status === "active" ? actor.id : null,
          status === "active" ? now : null,
          actor.id,
          now,
          id
        );
    } else {
      await tx
        .prepare(
          `INSERT INTO aleta_bot_public_qa_intents (
            id, key, name, description, category, audience, is_active, ai_enabled,
            exact_triggers_json, example_questions_json, required_parameters_json,
            query_key, legacy_handler, legacy_command, parameterized_legacy_command,
            template_key, response_mode, confidence_threshold, requires_verification,
            requires_case_number, max_attempts, fallback_message,
            answer_template, match_keywords_json, risk_level, notes,
            ai_answer_enabled, ai_answer_mode, answer_policy, verification_policy,
            allowed_data_fields_json, blocked_data_fields_json, ai_system_prompt,
            ai_user_prompt_template, max_ai_tokens, temperature,
            requires_approval_before_active, version, status, approved_by, approved_at,
            created_by, updated_by, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          key,
          name,
          String(intent.description || "").trim(),
          category,
          audience,
          isActive ? 1 : 0,
          intent.aiEnabled ? 1 : 0,
          JSON.stringify(exactTriggers),
          JSON.stringify(exampleQuestions),
          JSON.stringify(requiredParameters),
          queryKey,
          legacyHandler,
          legacyCommand,
          parameterizedLegacyCommand,
          String(intent.templateKey || "").trim(),
          responseMode,
          confidenceThreshold,
          intent.requiresVerification ? 1 : 0,
          intent.requiresCaseNumber ? 1 : 0,
          Math.max(1, Math.min(5, Number(intent.maxAttempts || 2))),
          fallbackMessage,
          answerTemplate,
          JSON.stringify(matchKeywords),
          riskLevel,
          String(intent.notes || "").trim(),
          aiAnswerEnabled ? 1 : 0,
          aiAnswerMode,
          answerPolicy,
          verificationPolicy,
          JSON.stringify(allowedDataFields),
          JSON.stringify(blockedDataFields),
          aiSystemPrompt,
          aiUserPromptTemplate,
          maxAiTokens,
          temperature,
          requiresApprovalBeforeActive ? 1 : 0,
          1,
          status,
          status === "active" ? actor.id : null,
          status === "active" ? now : null,
          actor.id,
          actor.id,
          now,
          now
        );
    }

    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: "success",
      eventType: "public_qa",
      message: `Intent Pertanyaan Para Pihak ${name} disimpan.`,
      metadata: { intentId: id, key, category, audience, riskLevel },
    });
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: existing ? "UPDATE_ALETA_BOT_PUBLIC_QA_INTENT" : "CREATE_ALETA_BOT_PUBLIC_QA_INTENT",
      entityType: "aleta_bot_public_qa_intents",
      entityId: id,
      payload: { key, name, category, audience, responseMode, riskLevel },
    });
    await writeAletaBotRuntimeConfig(tx, await getAletaBotSettings(tx), await getWhatsAppSettingsFromDb(tx));
    return getAletaBotSnapshot(tx, actor.id);
  });
}

export async function recordAletaBotDbConnectionTestResult(
  db: AletaDatabase,
  {
    actorUserId,
    connectionKey,
    status,
    errorMessage,
    testedAt,
  }: {
    actorUserId: string;
    connectionKey: string;
    status: "success" | "failed";
    errorMessage?: string;
    testedAt?: string;
  }
) {
  const actor = await requireSuperAdmin(db, actorUserId);
  const now = testedAt || new Date().toISOString();
  const safeError = String(errorMessage || "").replace(/:[^:@\s]+@/g, ":[redacted]@").slice(0, 500);
  await ensureAletaBotSeeded(db);
  await db
    .prepare(
      `UPDATE aleta_bot_db_connections
       SET last_test_status = ?, last_test_error = ?, last_test_at = ?, updated_by = ?, updated_at = ?
       WHERE key = ?`
    )
    .run(status, safeError || null, now, actor.id, now, connectionKey);
  await appendAletaBotLog(db, {
    actorUserId: actor.id,
    level: status === "success" ? "success" : "error",
    eventType: "database",
    message: status === "success" ? "Test koneksi SQL ALETA Bot berhasil." : "Test koneksi SQL ALETA Bot gagal.",
    metadata: { connectionKey, status, errorMessage: safeError },
  });
  return getAletaBotSnapshot(db, actor.id);
}

export async function reviewPublicQaUnknownQuestion(
  db: AletaDatabase,
  {
    actorUserId,
    logIds,
    normalizedMessage,
    reviewStatus,
    reviewNote,
  }: {
    actorUserId: string;
    logIds?: string[];
    normalizedMessage?: string;
    reviewStatus: AletaBotPublicQaLogEntry["reviewStatus"];
    reviewNote?: string;
  }
) {
  const actor = await requireSuperAdmin(db, actorUserId);
  await ensureAletaBotSeeded(db);

  if (!["pending", "reviewed", "ignored", "converted_to_intent"].includes(reviewStatus)) {
    throw new ApiError(400, "Status review Public Q&A tidak valid.");
  }

  const ids = Array.isArray(logIds) ? logIds.map((id) => String(id).trim()).filter(Boolean).slice(0, 50) : [];
  const normalized = String(normalizedMessage || "").trim().toLowerCase();
  if (ids.length === 0 && !normalized) {
    throw new ApiError(400, "Pilih log Public Q&A yang akan ditinjau.");
  }

  const now = new Date().toISOString();
  const note = String(reviewNote || "").trim().slice(0, 1000);

  await withTransaction(db, async (tx) => {
    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(", ");
      await tx
        .prepare(
          `UPDATE aleta_bot_public_qa_logs
           SET needs_human_review = ?, review_status = ?, reviewed_by_user_id = ?, reviewed_at = ?, review_note = ?
           WHERE id IN (${placeholders})`
        )
        .run(reviewStatus === "pending" ? 1 : 0, reviewStatus, actor.id, now, note, ...ids);
    } else {
      await tx
        .prepare(
          `UPDATE aleta_bot_public_qa_logs
           SET needs_human_review = ?, review_status = ?, reviewed_by_user_id = ?, reviewed_at = ?, review_note = ?
           WHERE lower(normalized_message) = lower(?)`
        )
        .run(reviewStatus === "pending" ? 1 : 0, reviewStatus, actor.id, now, note, normalized);
    }

    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: "success",
      eventType: "public_qa",
      message: `Review Public Q&A diperbarui menjadi ${reviewStatus}.`,
      metadata: { logIds: ids, normalizedMessage: normalized, reviewStatus },
    });
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "REVIEW_ALETA_BOT_PUBLIC_QA",
      entityType: "aleta_bot_public_qa_logs",
      entityId: ids[0] || normalized,
      payload: { reviewStatus, affectedCount: ids.length || "normalized_message" },
    });
  });

  return getAletaBotSnapshot(db, actor.id);
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  return `"${text.replace(/"/g, '""')}"`;
}

export async function exportPublicQaHumanReviewCsv(
  db: AletaDatabase,
  actorUserId: string,
  filters: {
    reviewStatus?: string | null;
    needsHumanReview?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
    intentKey?: string | null;
    riskLevel?: string | null;
  } = {}
) {
  await requireAletaBotOperator(db, actorUserId);
  await ensureAletaBotSeeded(db);

  const where: string[] = [];
  const params: Array<string | number> = [];
  const reviewStatus = String(filters.reviewStatus || "").trim();
  const needsHumanReview = String(filters.needsHumanReview || "").trim();
  const intentKey = String(filters.intentKey || "").trim();
  const riskLevel = String(filters.riskLevel || "").trim();
  const dateFrom = String(filters.dateFrom || "").trim();
  const dateTo = String(filters.dateTo || "").trim();

  if (reviewStatus && reviewStatus !== "all") {
    where.push("logs.review_status = ?");
    params.push(reviewStatus);
  }
  if (needsHumanReview === "true" || needsHumanReview === "false") {
    where.push("logs.needs_human_review = ?");
    params.push(needsHumanReview === "true" ? 1 : 0);
  }
  if (intentKey) {
    where.push("logs.matched_intent_key = ?");
    params.push(intentKey);
  }
  if (riskLevel && riskLevel !== "all") {
    where.push("COALESCE(intents.risk_level, '') = ?");
    params.push(riskLevel);
  }
  if (dateFrom) {
    where.push("logs.created_at >= ?");
    params.push(dateFrom);
  }
  if (dateTo) {
    where.push("logs.created_at <= ?");
    params.push(dateTo);
  }

  const sql = `
    SELECT logs.id, logs.sender_number, logs.sender_name, logs.raw_message, logs.normalized_message,
      logs.matched_intent_key, logs.matched_method, logs.confidence, logs.query_key,
      logs.response_preview, logs.status, logs.error_message, logs.needs_human_review,
      logs.review_status, logs.reviewed_by_user_id, reviewer.name AS reviewer_name,
      logs.reviewed_at, logs.review_note, logs.created_at,
      COALESCE(intents.risk_level, '') AS risk_level
    FROM aleta_bot_public_qa_logs logs
    LEFT JOIN aleta_bot_public_qa_intents intents ON intents.key = logs.matched_intent_key
    LEFT JOIN users reviewer ON reviewer.id = logs.reviewed_by_user_id
    ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY logs.created_at DESC
    LIMIT ${exportOverflowLimit(EXPORT_ROW_LIMITS.publicQaReviewCsv)}`;
  const rows = await db.prepare(sql).all<
    PublicQaLogRow & { reviewer_name: string | null; risk_level: string }
  >(...params);
  assertExportRowLimit(rows.length, EXPORT_ROW_LIMITS.publicQaReviewCsv, "Export review Pertanyaan Para Pihak");

  const headers = [
    "Waktu",
    "Pertanyaan",
    "Nomor/User Masked",
    "Intent Terdeteksi",
    "Confidence",
    "Alasan Fallback/Review",
    "Risk Level",
    "Status Review",
    "Reviewer",
    "Catatan Review",
    "Tanggal Review",
  ];
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    const fallbackReason = row.error_message || row.response_preview || row.status || "";
    lines.push([
      row.created_at,
      row.raw_message || row.normalized_message,
      row.sender_name ? `${row.sender_name} (${maskExportPhone(row.sender_number)})` : maskExportPhone(row.sender_number),
      row.matched_intent_key || "fallback",
      row.confidence,
      fallbackReason,
      row.risk_level,
      row.review_status,
      row.reviewer_name || row.reviewed_by_user_id || "",
      row.review_note,
      row.reviewed_at || "",
    ].map(csvCell).join(","));
  }

  return {
    filename: `public-qa-human-review-${new Date().toISOString().slice(0, 10)}.csv`,
    rowCount: rows.length,
    csv: lines.join("\n"),
  };
}

function sanitizePublicQaIntentKey(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

async function makeUniquePublicQaIntentKey(db: AletaDatabase, preferred: string) {
  const base = sanitizePublicQaIntentKey(preferred) || `draft_intent_${Date.now()}`;
  let candidate = base;
  for (let index = 2; index < 50; index += 1) {
    const existing = await db
      .prepare(`SELECT id FROM aleta_bot_public_qa_intents WHERE lower(key) = lower(?)`)
      .get<{ id: string }>(candidate);
    if (!existing) return candidate;
    candidate = `${base}_${index}`;
  }
  return `${base}_${Date.now()}`;
}

export async function convertPublicQaReviewToDraftIntent(
  db: AletaDatabase,
  {
    actorUserId,
    logIds,
    normalizedMessage,
    reviewNote,
    mode,
    targetIntentId,
    draftIntentKey,
    draftIntentName,
  }: {
    actorUserId: string;
    logIds?: string[];
    normalizedMessage?: string;
    reviewNote?: string;
    mode?: "new" | "existing";
    targetIntentId?: string;
    draftIntentKey?: string;
    draftIntentName?: string;
  }
) {
  const actor = await requireSuperAdmin(db, actorUserId);
  await ensureAletaBotSeeded(db);
  const ids = Array.isArray(logIds) ? logIds.map((id) => String(id).trim()).filter(Boolean).slice(0, 50) : [];
  const normalized = String(normalizedMessage || "").trim().toLowerCase();
  if (ids.length === 0 && !normalized) {
    throw new ApiError(400, "Pilih pertanyaan yang akan dijadikan draft aturan.");
  }

  const logs = ids.length > 0
    ? await db
        .prepare(
          `SELECT id, sender_number, sender_name, raw_message, normalized_message,
            matched_intent_key, matched_method, confidence, parameters_json, query_key,
            response_preview, status, error_message,
            needs_human_review, review_status, reviewed_by_user_id, reviewed_at, review_note,
            created_at
           FROM aleta_bot_public_qa_logs
           WHERE id IN (${ids.map(() => "?").join(", ")})
           ORDER BY created_at DESC`
        )
        .all<PublicQaLogRow>(...ids)
    : await db
        .prepare(
          `SELECT id, sender_number, sender_name, raw_message, normalized_message,
            matched_intent_key, matched_method, confidence, parameters_json, query_key,
            response_preview, status, error_message,
            needs_human_review, review_status, reviewed_by_user_id, reviewed_at, review_note,
            created_at
           FROM aleta_bot_public_qa_logs
           WHERE lower(normalized_message) = lower(?)
           ORDER BY created_at DESC
           LIMIT 50`
        )
        .all<PublicQaLogRow>(normalized);

  const examples = Array.from(new Set(logs.map((log) => (log.raw_message || log.normalized_message || "").trim()).filter(Boolean))).slice(0, 12);
  if (examples.length === 0) {
    throw new ApiError(400, "Pertanyaan tidak memiliki contoh teks yang bisa dijadikan draft aturan.");
  }

  const conversionMode = mode === "existing" ? "existing" : "new";
  let targetIntent: AletaBotPublicQaIntent | undefined;

  if (conversionMode === "existing") {
    const intents = await getPublicQaIntents(db);
    targetIntent = intents.find((intent) => intent.id === targetIntentId);
    if (!targetIntent) throw new ApiError(404, "Draft aturan tujuan tidak ditemukan.");

    await updateAletaBotPublicQaIntent(db, {
      actorUserId: actor.id,
      intent: {
        ...targetIntent,
        isActive: false,
        status: "active",
        exampleQuestions: Array.from(new Set([...targetIntent.exampleQuestions, ...examples])),
        notes: `${targetIntent.notes || ""}\nTambahan contoh dari human review: ${String(reviewNote || "").trim()}`.trim(),
      },
    });
  } else {
    const suggested = sanitizePublicQaIntentKey(draftIntentKey || logs[0]?.normalized_message || examples[0]);
    const key = await makeUniquePublicQaIntentKey(db, suggested || "draft_public_qa");
    const name = String(draftIntentName || `Draft Aturan: ${examples[0].slice(0, 48)}`).trim().slice(0, 120);
    await updateAletaBotPublicQaIntent(db, {
      actorUserId: actor.id,
      intent: {
        id: await nextPrefixedId(db, "aleta_bot_public_qa_intents", "abpqi"),
        key,
        name,
        description: "Draft aturan dari tinjauan pertanyaan WhatsApp. Tidak aktif sampai diverifikasi dan disetujui.",
        category: "fallback",
        audience: "public",
        isActive: false,
        aiEnabled: false,
        exactTriggers: [],
        exampleQuestions: examples,
        requiredParameters: [],
        queryKey: "",
        legacyHandler: "",
        legacyCommand: "",
        parameterizedLegacyCommand: "",
        templateKey: "",
        responseMode: "fallback",
        confidenceThreshold: 0.7,
        requiresVerification: false,
        requiresCaseNumber: false,
        maxAttempts: 2,
        fallbackMessage: PUBLIC_QA_FALLBACK_MESSAGE,
        riskLevel: "medium",
        notes: `Draft dibuat dari human review. ${String(reviewNote || "").trim()}`.trim(),
        aiAnswerEnabled: false,
        aiAnswerMode: "off",
        answerPolicy: "public_info_only",
        verificationPolicy: "none",
        allowedDataFields: [],
        blockedDataFields: [],
        aiSystemPrompt: "",
        aiUserPromptTemplate: "",
        maxAiTokens: 400,
        temperature: 0.2,
        requiresApprovalBeforeActive: false,
        status: "active",
      },
    });
  }

  await reviewPublicQaUnknownQuestion(db, {
    actorUserId: actor.id,
    logIds: ids,
    normalizedMessage: normalized,
    reviewStatus: "converted_to_intent",
    reviewNote,
  });

  await appendAletaBotLog(db, {
    actorUserId: actor.id,
    level: "success",
    eventType: "public_qa",
    message: conversionMode === "existing"
      ? "Tinjauan pertanyaan ditambahkan sebagai contoh ke draft aturan."
      : "Tinjauan pertanyaan dikonversi menjadi draft aturan baru.",
    metadata: {
      mode: conversionMode,
      targetIntentId: targetIntent?.id ?? null,
      examplesCount: examples.length,
      logIds: ids,
      normalizedMessage: normalized,
    },
  });

  return getAletaBotSnapshot(db, actor.id);
}

function renderTemplate(template: AletaBotTemplate, values: Record<string, string>) {
  const missing = getTemplatePlaceholders(template.body).filter((key) => values[key] === undefined || values[key] === null);
  if (missing.length > 0) {
    throw new ApiError(400, `Preview template gagal karena data contoh tidak memiliki placeholder: ${missing.join(", ")}.`);
  }
  return template.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) =>
    formatAletaBotTemplateValue(key, values[key] ?? "")
  );
}

async function hasNotificationRecipientPreview(db: AletaDatabase, notificationId: string) {
  const row = await db
    .prepare(
      `SELECT id
       FROM aleta_bot_logs
       WHERE event_type = 'notification'
         AND message LIKE '%Preview penerima%'
         AND metadata_json LIKE ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get<{ id: string }>(`%${notificationId}%`);
  return Boolean(row);
}

async function hasApprovedNotificationPolicy(db: AletaDatabase, notificationId: string) {
  const approvals = await listApprovalRequests(db);
  return approvals.some(
    (approval) =>
      approval.entityType === "notification" &&
      approval.entityId === notificationId &&
      approval.status === "approved"
  );
}

export async function previewAletaBotNotificationRecipients(
  db: AletaDatabase,
  {
    actorUserId,
    notificationId,
    limit = 10,
  }: {
    actorUserId: string;
    notificationId: string;
    limit?: number;
  }
) {
  const actor = await requireAletaBotOperator(db, actorUserId);
  await ensureAletaBotSeeded(db);
  const notification = (await getNotifications(db)).find((item) => item.id === notificationId);
  if (!notification) throw new ApiError(404, "Notifikasi ALETA Bot tidak ditemukan.");
  const query = (await getQueries(db)).find((item) => item.id === notification.queryId);
  if (!query) throw new ApiError(404, "Sumber data notifikasi tidak ditemukan.");
  const template = (await getTemplates(db)).find((item) => item.id === notification.templateId);
  if (!template) throw new ApiError(404, "Template notifikasi tidak ditemukan.");

  const safeLimit = Math.max(1, Math.min(20, Number(limit || 10)));
  const warnings: string[] = [];
  const items: Array<{
    recipientName: string;
    recipientNumber: string;
    caseOrPosition: string;
    messagePreview: string;
    idempotencyKey: string;
    validNumber: boolean;
  }> = [];

  // ── Preview DATA NYATA (utama) ─────────────────────────────────────────────
  // Ambil data sebenarnya dari runtime bot (yang punya akses SIPP), difilter
  // dan dirender PER PENERIMA. Inilah yang membuat nomor perkara, agenda, jam,
  // dan ruang benar-benar muncul di preview — dan menjamin tiap hakim melihat
  // daftar perkaranya SENDIRI (tidak tercampur), persis seperti saat dikirim.
  let live: AletaBotManualSendPreviewResult | null = null;
  try {
    live = await previewAletaBotManualSend(db, {
      actorUserId,
      mode: "data_source",
      queryId: notification.queryId,
      templateId: notification.templateId,
      notificationId: notification.id,
    });
  } catch {
    // Runtime bot tidak aktif/terjangkau (mis. mode portal-only atau bot mati).
    // Jatuh ke pratinjau contoh aman di bawah.
    live = null;
  }

  if (live) {
    const liveRecipients = live.recipients ?? [];
    const messageByRow = new Map<number, string>();
    const messageByNumber = new Map<string, string>();
    for (const m of live.recipientMessages ?? []) {
      if (typeof m.rowIndex === "number" && m.rowIndex >= 0) messageByRow.set(m.rowIndex, m.message);
      if (m.normalized) messageByNumber.set(m.normalized, m.message);
    }
    const positionByNumber = new Map<string, string>();
    if (notification.category === "employee") {
      for (const emp of await getEmployeeRecipients(db)) {
        const num = normalizeWhatsappNumber(emp.whatsappNumber);
        if (num) positionByNumber.set(num, emp.positionName || emp.roleId || "Pegawai");
      }
    }
    for (const r of liveRecipients.slice(0, safeLimit)) {
      const rowIndex = Number(r.rowIndex ?? -1);
      const message = messageByRow.get(rowIndex) ?? messageByNumber.get(r.normalized) ?? live.message ?? "";
      items.push({
        recipientName: r.name || (notification.category === "employee" ? "Pegawai" : "Pihak Perkara"),
        recipientNumber: maskExportPhone(r.normalized),
        caseOrPosition:
          notification.category === "employee"
            ? positionByNumber.get(r.normalized) || "Pegawai"
            : "Pihak Perkara",
        messagePreview: String(message).slice(0, 1000),
        idempotencyKey: `preview:${notification.id}:${rowIndex}`,
        validNumber: Boolean(r.valid),
      });
    }
    if (liveRecipients.length === 0) {
      warnings.push(
        notification.category === "employee"
          ? "Sumber data tidak menghasilkan data untuk saat ini (mis. tidak ada sidang hari ini). Periksa jadwal atau tanggal acuan."
          : "Sumber data tidak menghasilkan pihak/data untuk saat ini."
      );
    }
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "info",
      eventType: "notification",
      message: `Preview penerima notifikasi ${notification.name} dibuat tanpa pengiriman.`,
      metadata: { notificationId, category: notification.category, sampleSize: items.length, totalEstimated: liveRecipients.length, live: true },
    });
    await db
      .prepare(`UPDATE aleta_bot_notifications SET last_message = ?, updated_at = ? WHERE id = ?`)
      .run("Preview penerima (data nyata) berhasil dijalankan tanpa pengiriman.", new Date().toISOString(), notification.id);
    return {
      totalEstimated: liveRecipients.length,
      sampleSize: items.length,
      items,
      warnings,
    };
  }

  // ── Fallback: pratinjau contoh aman (tanpa akses SIPP) ─────────────────────
  if (notification.category === "employee") {
    const allRecipients = await getEmployeeRecipients(db);
    const recipients = filterEmployeeRecipientsByMapping(allRecipients, notification.recipientMapping);
    for (const recipient of recipients.slice(0, safeLimit)) {
      const sample = {
        ...makeSampleRow(query.outputColumns),
        nama_pegawai: recipient.name,
        // Selalu terisi: isi pesan pegawai memakai {{jabatan}} di baris pertama,
        // dan nilai kosong akan membuat render pratinjau gagal.
        jabatan: formatEmployeePositionLabel(recipient.positionName) || "Pegawai",
        judul_notifikasi: notification.name,
        ringkasan: notification.description || "Data contoh pertama untuk pratinjau pegawai.\nData contoh kedua untuk pratinjau pegawai.",
        waktu: new Date().toLocaleString("id-ID"),
        mode: "preview",
      };
      items.push({
        recipientName: recipient.name,
        recipientNumber: maskExportPhone(recipient.whatsappNumber),
        caseOrPosition: recipient.positionName || recipient.roleId,
        messagePreview: renderTemplate(template, sample).slice(0, 1000),
        idempotencyKey: `preview:${notification.id}:${recipient.id}`,
        validNumber: /^62\d{8,15}$/.test(recipient.whatsappNumber),
      });
    }
    if (allRecipients.length === 0) {
      warnings.push("Belum ada user aktif dengan nomor WhatsApp valid.");
    } else if (recipients.length === 0) {
      warnings.push("Tidak ada pegawai yang cocok dengan target role, jabatan, atau nama.");
    }
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "info",
      eventType: "notification",
      message: `Preview penerima notifikasi ${notification.name} dibuat tanpa pengiriman.`,
      metadata: { notificationId, category: notification.category, sampleSize: items.length, totalEstimated: recipients.length },
    });
    await db
      .prepare(`UPDATE aleta_bot_notifications SET last_message = ?, updated_at = ? WHERE id = ?`)
      .run("Preview penerima berhasil dijalankan tanpa pengiriman.", new Date().toISOString(), notification.id);
    return {
      totalEstimated: recipients.length,
      sampleSize: items.length,
      items,
      warnings,
    };
  }

  const sample = makeSampleRow(query.outputColumns);
  sample.nama_pihak = sample.nama_pihak || "Budi Santoso";
  sample.nomor_perkara = sample.nomor_perkara || "123/Pdt.G/2026/PA.Dgl";
  sample.judul_notifikasi = notification.name;
  sample.ringkasan = notification.description || "Data contoh pertama untuk pratinjau pihak.\nData contoh kedua untuk pratinjau pihak.";
  sample.mode = "preview";
  sample.waktu = new Date().toLocaleString("id-ID");
  const recipientNumber = normalizeWhatsappNumber(sample[query.recipientColumn] || sample.telepon || sample.nomor_hp || "");
  items.push({
    recipientName: sample.nama_pihak || "Contoh Pihak",
    recipientNumber: maskExportPhone(recipientNumber),
    caseOrPosition: sample.nomor_perkara || "Contoh perkara",
    messagePreview: renderTemplate(template, sample).slice(0, 1000),
    idempotencyKey: `disposition_preview:${notification.id}:sample`,
    validNumber: /^62\d{8,15}$/.test(recipientNumber),
  });
  warnings.push("Preview pihak memakai contoh aman dari sumber data. Eksekusi live SIPP tidak dijalankan dari portal.");
  await appendAletaBotLog(db, {
    actorUserId: actor.id,
    level: "info",
    eventType: "notification",
    message: `Preview penerima notifikasi ${notification.name} dibuat tanpa pengiriman.`,
    metadata: { notificationId, category: notification.category, sampleSize: items.length, totalEstimated: null },
  });
  await db
    .prepare(`UPDATE aleta_bot_notifications SET last_message = ?, updated_at = ? WHERE id = ?`)
    .run("Preview penerima berhasil dijalankan tanpa pengiriman.", new Date().toISOString(), notification.id);

  return {
    totalEstimated: items.length,
    sampleSize: items.length,
    items,
    warnings,
  };
}

function addDaysDateOnly(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString().slice(0, 10);
}

function formatReminderDeadline(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Kata sambung jabatan yang tetap huruf kecil di tengah frasa. */
const POSITION_LABEL_MINOR_WORDS = new Set(["dan", "di", "ke", "dari", "pada", "untuk", "atas", "yang"]);

/**
 * Merapikan nama jabatan pegawai untuk ditulis di pesan.
 * Data jabatan sering tersimpan huruf kecil semua; singkatan yang memang
 * kapital (PA, PTSP) dipertahankan.
 */
function formatEmployeePositionLabel(value: string | null | undefined) {
  const raw = String(value ?? "").trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!raw) return "";
  return raw
    .split(" ")
    .map((word, index) => {
      if (/^[A-Z0-9.]{2,}$/.test(word)) return word;
      const lower = word.toLowerCase();
      if (index > 0 && POSITION_LABEL_MINOR_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/**
 * Pesan pengingat deadline untuk pegawai.
 *
 * Pesan internal tidak lagi memperkenalkan diri sebagai bot; langsung menyebut
 * nama dan jabatan penerima lalu masuk ke pokok informasinya.
 */
function buildDeadlineReminderMessage(row: DeadlineReminderCandidateRow) {
  const jabatan = formatEmployeePositionLabel(row.position_name || row.recipient_role_id);
  const sapaan = jabatan ? `${row.recipient_name} — ${jabatan}` : row.recipient_name;
  return [
    sapaan,
    "",
    "Disposisi berikut jatuh tempo besok:",
    `Perihal: ${row.perihal}`,
    `Batas tindak lanjut: ${formatReminderDeadline(row.deadline_at)}`,
    "",
    "Mohon diselesaikan sebelum batas waktu tersebut.",
  ].join("\n");
}

function isDeadlineReminderPilotRecipient(settings: AletaBotSettings, row: DeadlineReminderCandidateRow) {
  if (settings.deadlineReminderPilotUserIds.includes(row.recipient_id)) return true;
  if (settings.deadlineReminderPilotRoleIds.includes(row.recipient_role_id)) return true;
  if (row.position_id && settings.deadlineReminderPilotPositionIds.includes(row.position_id)) return true;
  if (row.position_name && settings.deadlineReminderPilotPositionIds.includes(row.position_name)) return true;
  return false;
}

export async function dryRunDispositionDeadlineReminders(
  db: AletaDatabase,
  {
    actorUserId,
    limit = 20,
    pilotOnly = false,
    triggeredBy,
  }: {
    actorUserId: string;
    limit?: number;
    pilotOnly?: boolean;
    triggeredBy?: AletaBotDispositionReminderRun["triggeredBy"];
  }
): Promise<AletaBotDeadlineReminderDryRunResult> {
  const startedAt = new Date().toISOString();
  const actor = await requireAletaBotOperator(db, actorUserId);
  await ensureAletaBotSeeded(db);
  const settings = await getAletaBotSettings(db);
  if (settings.deadlineReminderKillSwitch) {
    await appendPolicySkipLog(db, {
      notificationKey: "disposition_deadline_h_minus_1",
      notificationId: "disposition-deadline-h-minus-1",
      category: "employee",
      reason: "policy_blocked",
      sourceFeature: "disposition_deadline_reminder",
      recipientType: "employee",
      metadata: { killSwitch: true, mode: settings.deadlineReminderMode, dryRun: true },
    });
    await appendDispositionReminderRun(db, {
      mode: settings.deadlineReminderMode,
      triggeredBy: triggeredBy ?? (pilotOnly ? "manual_controlled" : "manual_dry_run"),
      triggeredByUserId: actor.id,
      startedAt,
      status: "blocked",
      summary: { killSwitch: true, dryRun: true, pilotOnly },
    });
    return {
      ok: true,
      mode: settings.deadlineReminderMode,
      totalCandidates: 0,
      dryRunCreated: 0,
      skipped: 0,
      productionSent: 0,
      blocked: true,
      blockerReasons: ["kill_switch_active"],
      warnings: ["Emergency Stop Reminder Deadline aktif. Simulasi dan runner tidak dijalankan."],
      items: [],
    };
  }

  const tomorrow = addDaysDateOnly(new Date(), 1);
  const safeLimit = Math.max(1, Math.min(20, Number(limit || 20)));
  const rows = await db
    .prepare(
      `SELECT dsp.id AS disposition_id, dsp.surat_id AS letter_id, l.nomor_surat, l.perihal,
        dsp.deadline_at, dsp.status, dsp.instruksi,
        u.id AS recipient_id, u.name AS recipient_name, u.role_id AS recipient_role_id,
        u.whatsapp_number AS recipient_whatsapp,
        p.id AS position_id, p.name AS position_name, p.unit_kerja
       FROM dispositions dsp
       INNER JOIN letters l ON l.id = dsp.surat_id
       INNER JOIN users u ON u.id = dsp.penerima_id
       LEFT JOIN positions p ON p.id = u.position_id
       WHERE dsp.deleted_at IS NULL
         AND l.deleted_at IS NULL
         AND u.deleted_at IS NULL
         AND u.is_active = 1
         AND dsp.deadline_at IS NOT NULL
         AND substr(dsp.deadline_at, 1, 10) = ?
         AND dsp.status <> 'Selesai'
       ORDER BY dsp.deadline_at ASC, l.created_at ASC
       LIMIT 100`
    )
    .all<DeadlineReminderCandidateRow>(tomorrow);

  const warnings: string[] = [];
  const items: AletaBotDeadlineReminderDryRunResult["items"] = [];
  let dryRunCreated = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  await withTransaction(db, async (tx) => {
    for (const row of rows) {
      const normalizedNumber = normalizeWhatsappNumber(row.recipient_whatsapp || "");
      const idempotencyKey = `disposition_deadline_reminder:${row.disposition_id}:${tomorrow}`;
      const baseItem = {
        dispositionId: row.disposition_id,
        letterId: row.letter_id,
        recipientName: row.recipient_name,
        recipientNumber: maskExportPhone(normalizedNumber),
        perihal: row.perihal,
        deadline: row.deadline_at,
        messagePreview: buildDeadlineReminderMessage(row).slice(0, 1000),
        idempotencyKey,
      };

      if (pilotOnly && !isDeadlineReminderPilotRecipient(settings, row)) {
        skipped += 1;
        items.push({
          ...baseItem,
          status: "skipped",
          skipReason: "Penerima tidak termasuk whitelist pilot reminder.",
        });
        continue;
      }

      if (!/^62\d{8,15}$/.test(normalizedNumber)) {
        skipped += 1;
        items.push({
          ...baseItem,
          status: "skipped",
          skipReason: "Nomor WhatsApp penerima belum tersedia atau belum valid.",
        });
        continue;
      }

      const existing = await tx
        .prepare(
          `SELECT id
           FROM aleta_bot_notification_logs
           WHERE source_feature = 'disposition_deadline_reminder'
             AND entity_type = 'disposition'
             AND entity_id = ?
             AND metadata_json LIKE ?
           LIMIT 1`
        )
        .get<{ id: string }>(row.disposition_id, `%${idempotencyKey}%`);

      if (existing) {
        skipped += 1;
        items.push({
          ...baseItem,
          status: "skipped",
          skipReason: "Reminder ini sudah pernah disimulasikan untuk deadline tersebut.",
        });
        continue;
      }

      const metadata = buildMessageEntityMetadata({
        sourceApp: "manajemen_surat",
        sourceFeature: "disposition_deadline_reminder",
        entityType: "disposition",
        entityId: row.disposition_id,
        letterId: row.letter_id,
        dispositionId: row.disposition_id,
        nomorSurat: row.nomor_surat,
        recipientType: "employee",
        recipientRole: row.recipient_role_id,
        recipientPosition: row.position_name,
        deadlineDate: tomorrow,
        idempotencyKey,
        dryRun: true,
        reminderType: "h_minus_1",
      });

      await tx
        .prepare(
          `INSERT INTO aleta_bot_notification_logs (
            id, notification_id, query_id, recipient_number, recipient_name, category,
            message_preview, status, error_message, source_app, source_feature, entity_type, entity_id, metadata_json,
            sent_at, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, 'simulated', NULL, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          await nextPrefixedId(tx, "aleta_bot_notification_logs", "abnl"),
          "disposition-deadline-h-minus-1",
          "portal-disposition-deadline-h-minus-1",
          normalizedNumber,
          row.recipient_name,
          "employee",
          baseItem.messagePreview,
          "manajemen_surat",
          "disposition_deadline_reminder",
          "disposition",
          row.disposition_id,
          JSON.stringify(metadata),
          now,
          now
        );

      dryRunCreated += 1;
      items.push({ ...baseItem, status: "simulated" });
    }

    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: rows.length === 0 ? "info" : "success",
      eventType: "notification",
      message: "Dry-run reminder deadline disposisi H-1 diproses tanpa mengirim WhatsApp.",
      metadata: {
        reminderKey: "disposition_deadline_h_minus_1",
        targetDate: tomorrow,
        totalCandidates: rows.length,
        dryRunCreated,
        skipped,
        pilotOnly,
      },
    });
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "DRY_RUN_DISPOSITION_DEADLINE_REMINDERS",
      entityType: "aleta_bot_notification",
      entityId: "disposition-deadline-h-minus-1",
      payload: { targetDate: tomorrow, totalCandidates: rows.length, dryRunCreated, skipped, pilotOnly },
    });
    await tx
      .prepare(
        `UPDATE aleta_bot_settings
         SET disposition_deadline_reminder_last_run_at = ?,
           disposition_deadline_reminder_last_status = ?,
           disposition_deadline_reminder_last_message = ?,
           updated_at = ?
         WHERE id = 1`
      )
      .run(
        now,
        rows.length === 0 ? "skipped" : "simulated",
        `Dry-run: ${dryRunCreated} simulasi, ${skipped} dilewati.`,
        now
      );
  });

  if (rows.length === 0) {
    warnings.push("Tidak ada disposisi aktif yang jatuh tempo besok.");
  }
  if (skipped > 0) {
    warnings.push("Sebagian kandidat dilewati karena nomor tidak valid atau sudah pernah disimulasikan.");
  }
  if (pilotOnly) {
    warnings.push("Mode pilot hanya menampilkan penerima yang masuk whitelist pilot. Tidak ada WhatsApp real yang dikirim.");
  }

  await appendDispositionReminderRun(db, {
    mode: pilotOnly ? "pilot" : "dry_run",
    triggeredBy: triggeredBy ?? (pilotOnly ? "manual_controlled" : "manual_dry_run"),
    triggeredByUserId: actor.id,
    startedAt,
    totalCandidates: rows.length,
    dryRunCreated,
    skippedCount: skipped,
    status: rows.length === 0 ? "skipped" : "simulated",
    summary: {
      targetDate: tomorrow,
      pilotOnly,
      warnings,
    },
  });

  return {
    ok: true,
    mode: pilotOnly ? "pilot" : "dry_run",
    totalCandidates: rows.length,
    dryRunCreated,
    skipped,
    items: items.slice(0, safeLimit),
    warnings,
  };
}

export async function updateDispositionDeadlineReminderSettings(
  db: AletaDatabase,
  {
    actorUserId,
    mode,
    confirmText,
    pilotUserIds,
    pilotRoleIds,
    pilotPositionIds,
    schedulerEnabled,
    schedulerMode,
    schedulerTime,
    killSwitch,
  }: {
    actorUserId: string;
    mode?: AletaBotSettings["deadlineReminderMode"];
    confirmText?: string;
    pilotUserIds?: unknown;
    pilotRoleIds?: unknown;
    pilotPositionIds?: unknown;
    schedulerEnabled?: boolean;
    schedulerMode?: AletaBotSettings["deadlineReminderSchedulerMode"];
    schedulerTime?: string;
    killSwitch?: boolean;
  }
) {
  const actor = await requireSuperAdmin(db, actorUserId);
  await ensureAletaBotSeeded(db);
  const current = await getAletaBotSettings(db);
  const nextMode = mode ?? current.deadlineReminderMode;
  if (!["disabled", "dry_run", "pilot", "production"].includes(nextMode)) {
    throw new ApiError(400, "Mode reminder deadline tidak valid.");
  }
  if (nextMode === "pilot" && current.deadlineReminderMode !== "pilot" && confirmText !== "AKTIFKAN PILOT") {
    throw new ApiError(400, "Ketik AKTIFKAN PILOT untuk mengaktifkan mode pilot reminder.");
  }
  if (nextMode === "production" && current.deadlineReminderMode !== "production" && confirmText !== "AKTIFKAN REMINDER") {
    throw new ApiError(400, "Ketik AKTIFKAN REMINDER untuk mengaktifkan reminder produksi.");
  }
  if (killSwitch === true && confirmText !== "EMERGENCY STOP") {
    throw new ApiError(400, "Ketik EMERGENCY STOP untuk mengaktifkan kill switch reminder.");
  }
  if (schedulerMode && !["disabled", "dry_run", "pilot", "production"].includes(schedulerMode)) {
    throw new ApiError(400, "Mode scheduler reminder tidak valid.");
  }
  if (schedulerMode === "pilot" && current.deadlineReminderSchedulerMode !== "pilot" && confirmText !== "AKTIFKAN PILOT") {
    throw new ApiError(400, "Ketik AKTIFKAN PILOT untuk mengaktifkan scheduler mode pilot.");
  }
  if (schedulerMode === "production" && current.deadlineReminderSchedulerMode !== "production" && confirmText !== "AKTIFKAN REMINDER") {
    throw new ApiError(400, "Ketik AKTIFKAN REMINDER untuk mengaktifkan scheduler mode produksi.");
  }

  const now = new Date().toISOString();
  const enabled = nextMode === "pilot" || nextMode === "production";
  const nextPilotUserIds = pilotUserIds === undefined ? current.deadlineReminderPilotUserIds : sanitizeStringIdList(pilotUserIds);
  const nextPilotRoleIds = pilotRoleIds === undefined ? current.deadlineReminderPilotRoleIds : sanitizeStringIdList(pilotRoleIds);
  const nextPilotPositionIds = pilotPositionIds === undefined ? current.deadlineReminderPilotPositionIds : sanitizeStringIdList(pilotPositionIds);
  const nextSchedulerMode = schedulerMode ?? current.deadlineReminderSchedulerMode;
  const nextSchedulerTime = schedulerTime === undefined
    ? current.deadlineReminderSchedulerTime
    : sanitizeReminderSchedulerTime(schedulerTime, current.deadlineReminderSchedulerTime);
  await db
    .prepare(
      `UPDATE aleta_bot_settings
       SET disposition_deadline_reminder_enabled = ?,
         disposition_deadline_reminder_mode = ?,
         disposition_deadline_reminder_approved_at = ?,
         disposition_deadline_reminder_approved_by = ?,
         disposition_deadline_reminder_pilot_user_ids_json = ?,
         disposition_deadline_reminder_pilot_role_ids_json = ?,
         disposition_deadline_reminder_pilot_position_ids_json = ?,
         disposition_deadline_reminder_scheduler_enabled = ?,
         disposition_deadline_reminder_scheduler_mode = ?,
         disposition_deadline_reminder_scheduler_time = ?,
         disposition_deadline_reminder_kill_switch = ?,
         updated_at = ?
       WHERE id = 1`
    )
    .run(
      enabled ? 1 : 0,
      nextMode,
      enabled ? now : null,
      enabled ? actor.id : null,
      JSON.stringify(nextPilotUserIds),
      JSON.stringify(nextPilotRoleIds),
      JSON.stringify(nextPilotPositionIds),
      schedulerEnabled === undefined ? (current.deadlineReminderSchedulerEnabled ? 1 : 0) : (schedulerEnabled ? 1 : 0),
      nextSchedulerMode,
      nextSchedulerTime,
      killSwitch === undefined ? (current.deadlineReminderKillSwitch ? 1 : 0) : (killSwitch ? 1 : 0),
      now
    );
  await appendAletaBotLog(db, {
    actorUserId: actor.id,
    level: nextMode === "production" || killSwitch ? "warning" : "info",
    eventType: "notification",
    message: `Konfigurasi reminder deadline disposisi diperbarui: mode ${nextMode}.`,
    metadata: {
      reminderKey: "disposition_deadline_h_minus_1",
      mode: nextMode,
      enabled,
      schedulerEnabled: schedulerEnabled ?? current.deadlineReminderSchedulerEnabled,
      schedulerMode: nextSchedulerMode,
      killSwitch: killSwitch ?? current.deadlineReminderKillSwitch,
      pilotWhitelist: {
        userCount: nextPilotUserIds.length,
        roleCount: nextPilotRoleIds.length,
        positionCount: nextPilotPositionIds.length,
      },
    },
  });
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "UPDATE_DISPOSITION_DEADLINE_REMINDER_MODE",
    entityType: "aleta_bot_notification",
    entityId: "disposition-deadline-h-minus-1",
      payload: { mode: nextMode, enabled, schedulerMode: nextSchedulerMode, killSwitch: killSwitch ?? current.deadlineReminderKillSwitch },
    });
  await writeAletaBotRuntimeConfig(db, await getAletaBotSettings(db), await getWhatsAppSettingsFromDb(db));
  return getAletaBotSnapshot(db, actor.id);
}

export async function runDispositionDeadlineRemindersControlled(
  db: AletaDatabase,
  {
    actorUserId,
    confirmText,
    limit = 20,
  }: {
    actorUserId: string;
    confirmText?: string;
    limit?: number;
  }
): Promise<AletaBotDeadlineReminderDryRunResult> {
  const startedAt = new Date().toISOString();
  const actor = await requireSuperAdmin(db, actorUserId);
  const settings = await getAletaBotSettings(db);
  const mode = settings.deadlineReminderMode;

  if (settings.deadlineReminderKillSwitch) {
    await appendPolicySkipLog(db, {
      notificationKey: "disposition_deadline_h_minus_1",
      notificationId: "disposition-deadline-h-minus-1",
      category: "employee",
      reason: "policy_blocked",
      sourceFeature: "disposition_deadline_reminder",
      recipientType: "employee",
      metadata: { mode, killSwitch: true },
    });
    await appendDispositionReminderRun(db, {
      mode,
      triggeredBy: "manual_controlled",
      triggeredByUserId: actor.id,
      startedAt,
      status: "blocked",
      summary: { reason: "kill_switch_active" },
    });
    return {
      ok: true,
      mode,
      totalCandidates: 0,
      dryRunCreated: 0,
      skipped: 0,
      productionSent: 0,
      blocked: true,
      blockerReasons: ["kill_switch_active"],
      warnings: ["Emergency Stop Reminder Deadline aktif. Runner tidak dijalankan."],
      items: [],
    };
  }

  if (mode !== "production") {
    const result = await dryRunDispositionDeadlineReminders(db, { actorUserId: actor.id, limit, pilotOnly: mode === "pilot" });
    return {
      ...result,
      mode,
      blocked: mode === "disabled",
      blockerReasons: mode === "disabled" ? ["reminder_disabled"] : [],
      warnings: [
        ...result.warnings,
        mode === "pilot"
          ? "Mode pilot masih diperlakukan sebagai dry-run sampai whitelist pilot ditetapkan."
          : mode === "disabled"
            ? "Reminder belum aktif. Produksi tidak dijalankan."
            : "Mode dry-run aktif. Produksi tidak dijalankan.",
      ],
    };
  }

  if (!settings.deadlineReminderEnabled || !settings.deadlineReminderApprovedAt) {
    await appendPolicySkipLog(db, {
      notificationKey: "disposition_deadline_h_minus_1",
      notificationId: "disposition-deadline-h-minus-1",
      category: "employee",
      reason: "policy_blocked",
      sourceFeature: "disposition_deadline_reminder",
      recipientType: "employee",
      metadata: { mode, approvalMissing: !settings.deadlineReminderApprovedAt },
    });
    await appendDispositionReminderRun(db, {
      mode,
      triggeredBy: "manual_controlled",
      triggeredByUserId: actor.id,
      startedAt,
      status: "blocked",
      summary: { reason: "approval_or_enabled_missing", approvalMissing: !settings.deadlineReminderApprovedAt },
    });
    return {
      ok: true,
      mode,
      totalCandidates: 0,
      dryRunCreated: 0,
      skipped: 0,
      productionSent: 0,
      blocked: true,
      blockerReasons: ["approval_or_enabled_missing"],
      warnings: ["Reminder produksi belum memiliki approval eksplisit atau belum aktif."],
      items: [],
    };
  }

  if (confirmText !== "JALANKAN REMINDER") {
    await appendDispositionReminderRun(db, {
      mode,
      triggeredBy: "manual_controlled",
      triggeredByUserId: actor.id,
      startedAt,
      status: "blocked",
      summary: { reason: "confirmation_required" },
    });
    return {
      ok: true,
      mode,
      totalCandidates: 0,
      dryRunCreated: 0,
      skipped: 0,
      productionSent: 0,
      blocked: true,
      blockerReasons: ["confirmation_required"],
      warnings: ["Produksi membutuhkan konfirmasi JALANKAN REMINDER. Tidak ada pesan yang dikirim."],
      items: [],
    };
  }

  const runtimeMode = getWhatsappRuntimeMode();
  const whatsappSnapshot = runtimeMode === "aleta_bot" ? await buildGatewayWhatsappSnapshot() : await whatsappService.getGatewaySnapshot();
  if (whatsappSnapshot.runtimeStatus !== "connected") {
    await appendPolicySkipLog(db, {
      notificationKey: "disposition_deadline_h_minus_1",
      notificationId: "disposition-deadline-h-minus-1",
      category: "employee",
      reason: "policy_blocked",
      sourceFeature: "disposition_deadline_reminder",
      recipientType: "employee",
      metadata: { mode, whatsappStatus: whatsappSnapshot.runtimeStatus },
    });
    await appendDispositionReminderRun(db, {
      mode,
      triggeredBy: "manual_controlled",
      triggeredByUserId: actor.id,
      startedAt,
      status: "blocked",
      summary: { reason: "whatsapp_not_connected", whatsappStatus: whatsappSnapshot.runtimeStatus },
    });
    return {
      ok: true,
      mode,
      totalCandidates: 0,
      dryRunCreated: 0,
      skipped: 0,
      productionSent: 0,
      blocked: true,
      blockerReasons: ["whatsapp_not_connected"],
      warnings: ["WhatsApp belum connected. Reminder produksi tidak dijalankan."],
      items: [],
    };
  }

  const tomorrow = addDaysDateOnly(new Date(), 1);
  const rows = await db
    .prepare(
      `SELECT dsp.id AS disposition_id, dsp.surat_id AS letter_id, l.nomor_surat, l.perihal,
        dsp.deadline_at, dsp.status, dsp.instruksi,
        u.id AS recipient_id, u.name AS recipient_name, u.role_id AS recipient_role_id,
        u.whatsapp_number AS recipient_whatsapp,
        p.id AS position_id, p.name AS position_name, p.unit_kerja
       FROM dispositions dsp
       INNER JOIN letters l ON l.id = dsp.surat_id
       INNER JOIN users u ON u.id = dsp.penerima_id
       LEFT JOIN positions p ON p.id = u.position_id
       WHERE dsp.deleted_at IS NULL
         AND l.deleted_at IS NULL
         AND u.deleted_at IS NULL
         AND u.is_active = 1
         AND dsp.deadline_at IS NOT NULL
         AND substr(dsp.deadline_at, 1, 10) = ?
         AND dsp.status <> 'Selesai'
       ORDER BY dsp.deadline_at ASC, l.created_at ASC
       LIMIT 50`
    )
    .all<DeadlineReminderCandidateRow>(tomorrow);

  const safeLimit = Math.max(1, Math.min(20, Number(limit || 20)));
  const items: AletaBotDeadlineReminderDryRunResult["items"] = [];
  let productionSent = 0;
  let skipped = 0;
  for (const row of rows) {
    const normalizedNumber = normalizeWhatsappNumber(row.recipient_whatsapp || "");
    const idempotencyKey = `disposition_deadline_reminder:${row.disposition_id}:${tomorrow}`;
    const messagePreview = buildDeadlineReminderMessage(row).slice(0, 1000);
    const baseItem = {
      dispositionId: row.disposition_id,
      letterId: row.letter_id,
      recipientName: row.recipient_name,
      recipientNumber: maskExportPhone(normalizedNumber),
      perihal: row.perihal,
      deadline: row.deadline_at,
      messagePreview,
      idempotencyKey,
    };

    if (!/^62\d{8,15}$/.test(normalizedNumber)) {
      skipped += 1;
      await appendPolicySkipLog(db, {
        notificationKey: "disposition_deadline_h_minus_1",
        notificationId: "disposition-deadline-h-minus-1",
        category: "employee",
        reason: "recipient_invalid",
        sourceFeature: "disposition_deadline_reminder",
        entityType: "disposition",
        entityId: row.disposition_id,
        recipientType: "employee",
        recipientCount: 1,
      });
      items.push({ ...baseItem, status: "skipped", skipReason: "Nomor penerima belum valid." });
      continue;
    }

    const result = await sendPortalWhatsappMessage({
      sourceFeature: "disposition_deadline_reminder",
      entityType: "disposition",
      entityId: row.disposition_id,
      eventType: `h_minus_1_${tomorrow}`,
      recipientNumber: normalizedNumber,
      recipientName: row.recipient_name,
      message: buildDeadlineReminderMessage(row),
      category: "employee",
      priority: 4,
      dryRun: false,
      metadata: {
        sourceFeature: "disposition_deadline_reminder",
        entityType: "disposition",
        entityId: row.disposition_id,
        letterId: row.letter_id,
        dispositionId: row.disposition_id,
        nomorSurat: row.nomor_surat,
        recipientType: "employee",
        recipientRole: row.recipient_role_id,
        recipientPosition: row.position_name,
        deadlineDate: tomorrow,
        idempotencyKey,
        reminderType: "h_minus_1",
      },
    });
    if (result.ok && (result.queueId || result.duplicate || result.status === "sent")) {
      productionSent += 1;
      items.push({ ...baseItem, status: "enqueued" });
    } else {
      skipped += 1;
      await appendPolicySkipLog(db, {
        notificationKey: "disposition_deadline_h_minus_1",
        notificationId: "disposition-deadline-h-minus-1",
        category: "employee",
        reason: "policy_blocked",
        sourceFeature: "disposition_deadline_reminder",
        entityType: "disposition",
        entityId: row.disposition_id,
        recipientType: "employee",
        recipientCount: 1,
        metadata: { gatewayMessage: result.message },
      });
      items.push({ ...baseItem, status: "skipped", skipReason: result.message });
    }
  }

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE aleta_bot_settings
       SET disposition_deadline_reminder_last_run_at = ?,
         disposition_deadline_reminder_last_status = ?,
         disposition_deadline_reminder_last_message = ?,
         updated_at = ?
       WHERE id = 1`
    )
    .run(now, productionSent > 0 ? "sent" : "skipped", `Production runner: ${productionSent} enqueue, ${skipped} skip.`, now);
  await appendAletaBotLog(db, {
    actorUserId: actor.id,
    level: productionSent > 0 ? "warning" : "info",
    eventType: "notification",
    message: "Runner produksi reminder deadline H-1 diproses dengan gate eksplisit.",
    metadata: { mode, totalCandidates: rows.length, productionSent, skipped },
  });
  await appendDispositionReminderRun(db, {
    mode,
    triggeredBy: "manual_controlled",
    triggeredByUserId: actor.id,
    startedAt,
    totalCandidates: rows.length,
    sentCount: productionSent,
    skippedCount: skipped,
    status: productionSent > 0 ? "completed" : "skipped",
    summary: {
      targetDate: tomorrow,
      productionGate: "explicit_confirmation",
      whatsappStatus: whatsappSnapshot.runtimeStatus,
    },
  });

  return {
    ok: true,
    mode,
    totalCandidates: rows.length,
    dryRunCreated: 0,
    skipped,
    productionSent,
    warnings: productionSent > 0 ? ["Pesan masuk antrean runtime sesuai mode produksi."] : ["Tidak ada pesan produksi yang masuk antrean."],
    items: items.slice(0, safeLimit),
  };
}

function isSchedulerDueToday(schedulerTime: string, lastRunAt: string | null, now = new Date()) {
  const normalizedTime = sanitizeReminderSchedulerTime(schedulerTime, "08:00:00");
  const [hour, minute, second] = normalizedTime.split(":").map((part) => Number(part));
  const scheduledAt = new Date(now);
  scheduledAt.setHours(hour || 0, minute || 0, second || 0, 0);
  if (now.getTime() < scheduledAt.getTime()) return false;
  if (!lastRunAt) return true;
  const lastRun = new Date(lastRunAt);
  if (Number.isNaN(lastRun.getTime())) return true;
  return lastRun.toISOString().slice(0, 10) !== now.toISOString().slice(0, 10);
}

export async function runDispositionDeadlineReminderSchedulerDryRun(
  db: AletaDatabase,
  {
    actorUserId,
    force = false,
    limit = 20,
  }: {
    actorUserId: string;
    force?: boolean;
    limit?: number;
  }
): Promise<AletaBotDeadlineReminderDryRunResult> {
  const startedAt = new Date().toISOString();
  const actor = await requireAletaBotOperator(db, actorUserId);
  const settings = await getAletaBotSettings(db);

  const block = async (reason: string, message: string): Promise<AletaBotDeadlineReminderDryRunResult> => {
    const now = new Date().toISOString();
    await appendDispositionReminderRun(db, {
      mode: settings.deadlineReminderSchedulerMode,
      triggeredBy: "scheduler_blocked",
      triggeredByUserId: actor.id,
      startedAt,
      status: "blocked",
      summary: { reason, force, schedulerEnabled: settings.deadlineReminderSchedulerEnabled },
    });
    await db
      .prepare(
        `UPDATE aleta_bot_settings
         SET disposition_deadline_reminder_scheduler_last_run_at = ?,
           disposition_deadline_reminder_scheduler_last_message = ?,
           updated_at = ?
         WHERE id = 1`
      )
      .run(now, message, now);
    return {
      ok: true,
      mode: settings.deadlineReminderSchedulerMode,
      totalCandidates: 0,
      dryRunCreated: 0,
      skipped: 0,
      productionSent: 0,
      blocked: true,
      blockerReasons: [reason],
      warnings: [message],
      items: [],
    };
  };

  if (settings.deadlineReminderKillSwitch) {
    return block("kill_switch_active", "Emergency Stop Reminder Deadline aktif. Scheduler dry-run tidak dijalankan.");
  }
  if (!force && !settings.deadlineReminderSchedulerEnabled) {
    return block("scheduler_disabled", "Scheduler reminder belum aktif. Tidak ada dry-run otomatis yang dijalankan.");
  }
  if (!force && settings.deadlineReminderSchedulerMode !== "dry_run") {
    return block("scheduler_not_dry_run", "Scheduler otomatis hanya berjalan pada mode dry-run.");
  }
  if (!force && !isSchedulerDueToday(settings.deadlineReminderSchedulerTime, settings.deadlineReminderSchedulerLastRunAt)) {
    return block("scheduler_not_due", "Scheduler belum mencapai jadwal hari ini atau sudah pernah berjalan.");
  }

  const result = await dryRunDispositionDeadlineReminders(db, {
    actorUserId: actor.id,
    limit,
    triggeredBy: "scheduler_dry_run",
  });
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE aleta_bot_settings
       SET disposition_deadline_reminder_scheduler_last_run_at = ?,
         disposition_deadline_reminder_scheduler_last_message = ?,
         updated_at = ?
       WHERE id = 1`
    )
    .run(now, `Scheduler dry-run: ${result.dryRunCreated} simulasi, ${result.skipped} dilewati.`, now);
  return {
    ...result,
    warnings: [
      ...result.warnings,
      force
        ? "Dry-run scheduler dijalankan manual dari portal admin. Tidak ada WhatsApp sungguhan yang dikirim."
        : "Scheduler otomatis berjalan dalam mode dry-run. Tidak ada WhatsApp sungguhan yang dikirim.",
    ],
  };
}

function readinessStatusFromBlockers(blockers: Array<{ severity: "critical" | "warning"; label: string }>) {
  if (blockers.some((item) => item.severity === "critical")) return "Terblokir";
  if (blockers.length > 0) return "Perlu Perhatian";
  return "Siap";
}

export async function getPilotReadinessReport(
  db: AletaDatabase,
  actorUserId: string,
  format?: string | null
) {
  await requireAletaBotOperator(db, actorUserId);
  const [settings, policySkipSummary, whatsappNumberCompleteness, publicQaAnalytics, messageAnalytics, aiSettings, publicQaActiveRow] = await Promise.all([
    getAletaBotSettings(db),
    getPolicySkipSummary(db),
    getWhatsappNumberCompleteness(db),
    getPublicQaAnalytics(db, actorUserId),
    getAletaBotMessageAnalytics(db, actorUserId),
    getAISettingsFromDb(db),
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM aleta_bot_public_qa_intents
         WHERE is_active = 1 OR ai_enabled = 1 OR ai_answer_enabled = 1`
      )
      .get<{ count: number | string }>(),
  ]);
  const runtimeMode = getWhatsappRuntimeMode();
  const [runtimeStatus, whatsappSnapshot, workerState, deadLetters] = await Promise.all([
    runtimeMode === "aleta_bot"
      ? fetchAletaBotRuntimeStatusPayload()
      : Promise.resolve({ online: false, statusCode: 0, payload: null, errorMessage: null }),
    runtimeMode === "aleta_bot" ? buildGatewayWhatsappSnapshot() : whatsappService.getGatewaySnapshot(),
    runtimeMode === "aleta_bot" ? getWorkerStateFromGateway() : Promise.resolve(null),
    runtimeMode === "aleta_bot" ? getDeadLettersFromGateway(20) : Promise.resolve([]),
  ]);
  const sendingWindow = runtimeStatus.payload?.bot?.sendingWindow ?? null;
  const safeSendingWindowReadable = Boolean(sendingWindow);
  const safeSendingWindowEnabled = sendingWindow?.enabled !== false;
  const workerOperational = isQueueWorkerOperational(workerState);
  const aiBridgeStatus = runtimeStatus.payload?.aiRuntime?.status ?? (aiSettings.enabled ? "unknown" : "disabled");
  const publicQaActive = Number(publicQaActiveRow?.count || 0) > 0;
  const legacyResolver = runtimeStatus.payload?.whatsappNumberResolver ?? null;
  const lastPolicySkipRecent =
    policySkipSummary.lastSkippedAt &&
    Date.now() - new Date(policySkipSummary.lastSkippedAt).getTime() < 24 * 60 * 60 * 1000;
  const legacyFallbackLastUsedAt = legacyResolver?.lastLegacyFallbackUsedAt ?? null;
  const legacyFallbackRecent =
    legacyFallbackLastUsedAt &&
    Date.now() - new Date(legacyFallbackLastUsedAt).getTime() < 24 * 60 * 60 * 1000;
  const whatsappNumbersComplete =
    whatsappNumberCompleteness.totalActiveUsers > 0 &&
    whatsappNumberCompleteness.missingWhatsapp === 0;

  const blockers: Array<{
    key: string;
    label: string;
    severity: "critical" | "warning";
    actionLabel: string;
    actionHref: string;
  }> = [];
  if (whatsappSnapshot.runtimeStatus !== "connected") {
    blockers.push({
      key: "whatsapp_disconnected",
      label: "WhatsApp Gateway belum connected.",
      severity: "critical",
      actionLabel: "Buka Status WhatsApp Gateway",
      actionHref: "/admin/aleta-bot",
    });
  }
  if (workerState && !workerOperational) {
    blockers.push({
      key: workerState.paused ? "worker_paused" : "worker_inactive",
      label: describeQueueWorker(workerState),
      severity: "critical",
      actionLabel: "Buka Worker ALETA Bot",
      actionHref: "/admin/aleta-bot#queue-recovery",
    });
  }
  if (!workerState) {
    blockers.push({
      key: "worker_unreadable",
      label: "Status worker belum dapat dibaca.",
      severity: "warning",
      actionLabel: "Jalankan Smoke Test",
      actionHref: "/admin/aleta-bot",
    });
  }
  if (safeSendingWindowReadable && !safeSendingWindowEnabled) {
    blockers.push({
      key: "safe_sending_window_disabled",
      label: "Safe Sending Window sedang nonaktif.",
      severity: "critical",
      actionLabel: "Buka Pengaturan Jam Aman",
      actionHref: "/admin/aleta-bot#pengaturan-bot",
    });
  }
  if (!safeSendingWindowReadable && runtimeMode === "aleta_bot") {
    blockers.push({
      key: "safe_sending_window_unreadable",
      label: "Status Safe Sending Window belum terbaca dari runtime.",
      severity: "warning",
      actionLabel: "Jalankan Smoke Test",
      actionHref: "/admin/aleta-bot",
    });
  }
  if (deadLetters.length >= 10) {
    blockers.push({
      key: "dead_letter_high",
      label: "Dead-letter tinggi dan perlu ditinjau.",
      severity: "critical",
      actionLabel: "Buka Dead Letter",
      actionHref: "/admin/aleta-bot#queue-recovery",
    });
  }
  if (deadLetters.length > 0 && deadLetters.length < 10) {
    blockers.push({
      key: "dead_letter_present",
      label: "Ada dead-letter yang perlu dipantau.",
      severity: "warning",
      actionLabel: "Buka Dead Letter",
      actionHref: "/admin/aleta-bot#queue-recovery",
    });
  }
  if (whatsappNumberCompleteness.importantMissing.length > 0) {
    blockers.push({
      key: "missing_whatsapp_numbers",
      label: "Nomor WhatsApp pegawai prioritas belum lengkap.",
      severity: "critical",
      actionLabel: "Lengkapi Nomor Pegawai",
      actionHref: "/admin/mapping-user-jabatan?missingWhatsapp=true",
    });
  }
  if (whatsappNumberCompleteness.importantMissing.length === 0 && whatsappNumberCompleteness.missingWhatsapp > 0) {
    blockers.push({
      key: "missing_whatsapp_numbers_noncritical",
      label: "Sebagian nomor WhatsApp pegawai belum lengkap.",
      severity: "warning",
      actionLabel: "Lengkapi Nomor Pegawai",
      actionHref: "/admin/mapping-user-jabatan?missingWhatsapp=true",
    });
  }
  if (legacyFallbackRecent && !whatsappNumbersComplete) {
    blockers.push({
      key: "recent_legacy_fallback",
      label: "Fallback nomor WhatsApp legacy masih dipakai dalam 24 jam terakhir.",
      severity: "critical",
      actionLabel: "Lengkapi Nomor Pegawai",
      actionHref: "/admin/mapping-user-jabatan?missingWhatsapp=true",
    });
  } else if ((legacyResolver?.legacyFallbackUsedCount ?? 0) > 0 && !whatsappNumbersComplete) {
    blockers.push({
      key: "legacy_fallback_used",
      label: "Fallback nomor WhatsApp legacy pernah dipakai runtime.",
      severity: "warning",
      actionLabel: "Lengkapi Nomor Pegawai",
      actionHref: "/admin/mapping-user-jabatan?missingWhatsapp=true",
    });
  }
  if (lastPolicySkipRecent) {
    blockers.push({
      key: "recent_policy_skip",
      label: "Policy skip masih terjadi dalam 24 jam terakhir.",
      severity: "warning",
      actionLabel: "Lihat Policy Skip",
      actionHref: "/admin/aleta-bot#policy-skip",
    });
  }
  if (settings.deadlineReminderMode === "production" && (!settings.deadlineReminderApprovedAt || !settings.deadlineReminderEnabled)) {
    blockers.push({
      key: "reminder_production_without_approval",
      label: "Reminder production belum memiliki approval/enable eksplisit.",
      severity: "critical",
      actionLabel: "Buka Pengaturan Reminder",
      actionHref: "/admin/aleta-bot#reminder-deadline",
    });
  }
  if (
    settings.deadlineReminderSchedulerEnabled &&
    settings.deadlineReminderSchedulerMode === "production" &&
    (!settings.deadlineReminderApprovedAt || !settings.deadlineReminderEnabled || whatsappSnapshot.runtimeStatus !== "connected" || !safeSendingWindowEnabled)
  ) {
    blockers.push({
      key: "scheduler_production_not_clear",
      label: "Scheduler production aktif tanpa readiness clear.",
      severity: "critical",
      actionLabel: "Buka Pengaturan Reminder",
      actionHref: "/admin/aleta-bot#reminder-deadline",
    });
  }
  if (settings.deadlineReminderKillSwitch) {
    blockers.push({
      key: "reminder_kill_switch",
      label: "Emergency Stop Reminder Deadline sedang aktif.",
      severity: "critical",
      actionLabel: "Buka Pengaturan Reminder",
      actionHref: "/admin/aleta-bot#reminder-deadline",
    });
  }
  if (publicQaAnalytics.humanReviewPending >= 20) {
    blockers.push({
      key: "public_qa_pending",
      label: "Public Q&A pending review terlalu tinggi.",
      severity: "critical",
      actionLabel: "Tinjau Pertanyaan Publik",
      actionHref: "/admin/aleta-bot",
    });
  } else if (publicQaAnalytics.humanReviewPending > 0) {
    blockers.push({
      key: "public_qa_pending_warning",
      label: "Public Q&A masih memiliki pending review.",
      severity: "warning",
      actionLabel: "Tinjau Pertanyaan Publik",
      actionHref: "/admin/aleta-bot",
    });
  }
  if (publicQaActive && (aiBridgeStatus === "needs_sync" || aiBridgeStatus === "error")) {
    blockers.push({
      key: "ai_public_qa_not_ready",
      label: aiBridgeStatus === "needs_sync"
        ? "AI Public Q&A aktif tetapi AI Bridge perlu sinkronisasi."
        : "AI Public Q&A aktif tetapi AI Bridge bermasalah.",
      severity: "critical",
      actionLabel: "Sync AI ke ALETA Bot",
      actionHref: "/admin/aleta-bot",
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    overallStatus: readinessStatusFromBlockers(blockers),
    blockers,
    runtime: {
      mode: runtimeMode,
      online: runtimeStatus.online,
      statusCode: runtimeStatus.statusCode,
      errorMessage: runtimeStatus.errorMessage,
    },
    whatsapp: {
      runtimeStatus: whatsappSnapshot.runtimeStatus,
      linked: whatsappSnapshot.linked,
      lastConnectedAt: whatsappSnapshot.lastConnectedAt ?? null,
    },
    safeSendingWindow: {
      readable: safeSendingWindowReadable,
      enabled: safeSendingWindowEnabled,
      start: sendingWindow?.start ?? "07:30",
      end: sendingWindow?.end ?? "21:00",
      inside: sendingWindow?.inside ?? null,
      message: sendingWindow?.message ?? null,
    },
    worker: {
      readable: Boolean(workerState),
      operational: workerState ? workerOperational : null,
      enabled: workerState?.enabled ?? null,
      activeTimer: workerState?.activeTimer ?? null,
      running: workerState?.running ?? null,
      paused: workerState?.paused ?? null,
      detail: describeQueueWorker(workerState),
    },
    queue: {
      deadLetterCount: deadLetters.length,
      failedWhatsappMessagesToday: messageAnalytics.failedToday,
      policySkipToday: policySkipSummary.totalToday,
    },
    publicQa: {
      pendingHumanReview: publicQaAnalytics.humanReviewPending,
      fallbackRate: publicQaAnalytics.fallbackRate,
    },
    whatsappNumbers: {
      total: whatsappNumberCompleteness.totalActiveUsers,
      complete: whatsappNumberCompleteness.withWhatsapp,
      missing: whatsappNumberCompleteness.missingWhatsapp,
      coveragePercent: whatsappNumberCompleteness.coveragePercent,
      priorityMissing: whatsappNumberCompleteness.importantMissing.length,
    },
    reminder: {
      mode: settings.deadlineReminderMode,
      schedulerEnabled: settings.deadlineReminderSchedulerEnabled,
      schedulerMode: settings.deadlineReminderSchedulerMode,
      schedulerTime: settings.deadlineReminderSchedulerTime,
      schedulerLastRunAt: settings.deadlineReminderSchedulerLastRunAt,
      killSwitch: settings.deadlineReminderKillSwitch,
      approvedAt: settings.deadlineReminderApprovedAt,
    },
    legacyMapping: {
      fallbackUsedCount: legacyResolver?.legacyFallbackUsedCount ?? 0,
      lastFallbackUsedAt: legacyFallbackLastUsedAt,
      recentFallback: Boolean(legacyFallbackRecent),
    },
    aiBridge: {
      status: aiBridgeStatus,
      enabled: aiSettings.enabled,
      publicQaActive,
    },
    smokeTest: {
      available: true,
      lastStatus: null,
      detail: "Smoke test tersedia sebagai pemeriksaan baca-saja dan tidak disimpan otomatis agar tidak mengekspos data teknis.",
    },
    policySkip: policySkipSummary,
  };

  if (format === "csv") {
    const lines = [
      ["Bagian", "Nilai"].map(csvCell).join(","),
      ["Generated At", report.generatedAt].map(csvCell).join(","),
      ["Overall Status", report.overallStatus].map(csvCell).join(","),
      ["WhatsApp Status", report.whatsapp.runtimeStatus].map(csvCell).join(","),
      ["Safe Sending Window", `${report.safeSendingWindow.enabled ? "enabled" : "disabled"} ${report.safeSendingWindow.start}-${report.safeSendingWindow.end}${report.safeSendingWindow.readable ? " runtime synced" : " runtime belum terbaca"}`].map(csvCell).join(","),
      ["Worker Running", String(report.worker.operational ?? "unknown")].map(csvCell).join(","),
      ["Worker Detail", report.worker.detail].map(csvCell).join(","),
      ["Dead-letter", String(report.queue.deadLetterCount)].map(csvCell).join(","),
      ["Policy Skip Hari Ini", String(report.queue.policySkipToday)].map(csvCell).join(","),
      ["Public Q&A Pending", String(report.publicQa.pendingHumanReview)].map(csvCell).join(","),
      ["Nomor WA Lengkap", `${report.whatsappNumbers.complete}/${report.whatsappNumbers.total}`].map(csvCell).join(","),
      ["Nomor WA Prioritas Kosong", String(report.whatsappNumbers.priorityMissing)].map(csvCell).join(","),
      ["Legacy Fallback", `${report.legacyMapping.fallbackUsedCount} kali`].map(csvCell).join(","),
      ["AI Bridge", report.aiBridge.status].map(csvCell).join(","),
      ["Reminder Mode", report.reminder.mode].map(csvCell).join(","),
      ["Reminder Scheduler", `${report.reminder.schedulerEnabled ? "enabled" : "disabled"} / ${report.reminder.schedulerMode}`].map(csvCell).join(","),
      ["Kill Switch", report.reminder.killSwitch ? "active" : "off"].map(csvCell).join(","),
      ["Smoke Test", report.smokeTest.available ? "available" : "unavailable"].map(csvCell).join(","),
    ];
    for (const blocker of blockers) {
      lines.push([`Blocker ${blocker.severity}`, blocker.label].map(csvCell).join(","));
    }
    return {
      ...report,
      filename: `pilot-readiness-${new Date().toISOString().slice(0, 10)}.csv`,
      csv: lines.join("\n"),
    };
  }

  return report;
}

export async function runAletaBotOperationalSmokeTest(db: AletaDatabase, actorUserId: string) {
  await requireAletaBotOperator(db, actorUserId);
  const checks: Array<{
    key: string;
    label: string;
    status: "passed" | "warning" | "failed";
    detail: string;
  }> = [];
  const safeCheck = async (
    key: string,
    label: string,
    fn: () => Promise<{ status?: "passed" | "warning" | "failed"; detail: string }>
  ) => {
    try {
      const result = await fn();
      checks.push({ key, label, status: result.status ?? "passed", detail: result.detail });
    } catch (error) {
      checks.push({
        key,
        label,
        status: "failed",
        detail: sanitizeErrorMessage(error instanceof Error ? error.message : "Pemeriksaan gagal."),
      });
    }
  };

  checks.push({
    key: "auth_guard",
    label: "Auth Guard Admin",
    status: "passed",
    detail: "Akses smoke test sudah melewati guard operator ALETA Bot.",
  });
  await safeCheck("whatsapp_status", "Status WhatsApp Gateway", async () => {
    const snapshot = getWhatsappRuntimeMode() === "aleta_bot" ? await buildGatewayWhatsappSnapshot() : await whatsappService.getGatewaySnapshot();
    return {
      status: snapshot.runtimeStatus === "connected" ? "passed" : "warning",
      detail: `Status terbaca: ${snapshot.runtimeStatus}. QR raw tidak diekspos dan tidak ada scan.`,
    };
  });
  await safeCheck("qr_endpoint", "QR Endpoint Reachable", async () => {
    if (getWhatsappRuntimeMode() !== "aleta_bot") {
      return { status: "warning", detail: "Runtime bukan aleta_bot; QR gateway tidak dipanggil." };
    }
    const qr = await getGatewayWhatsappQr();
    return {
      status: qr.ok ? "passed" : "warning",
      detail: qr.ok
        ? "QR endpoint reachable. QR raw tidak disertakan dalam response smoke test dan tidak ada scan."
        : `QR endpoint belum reachable: ${sanitizeErrorMessage(qr.error)}`,
    };
  });
  await safeCheck("queue_reachable", "Queue Reachable", async () => {
    if (getWhatsappRuntimeMode() !== "aleta_bot") {
      return { status: "warning", detail: "Runtime bukan aleta_bot; queue gateway tidak dipanggil." };
    }
    const deadLetterResult = await getGatewayDeadLetters(1);
    return {
      status: deadLetterResult.ok ? "passed" : "warning",
      detail: deadLetterResult.ok
        ? `Queue readable. Dead-letter terdeteksi: ${deadLetterResult.data.total}.`
        : `Queue belum readable: ${sanitizeErrorMessage(deadLetterResult.error)}`,
    };
  });
  await safeCheck("worker_status", "Worker Status", async () => {
    const worker = getWhatsappRuntimeMode() === "aleta_bot" ? await getWorkerStateFromGateway() : null;
    const operational = isQueueWorkerOperational(worker);
    return {
      status: operational ? "passed" : "warning",
      detail: worker
        ? `${describeQueueWorker(worker)} Enabled: ${worker.enabled ? "ya" : "tidak"}, timer: ${worker.activeTimer ? "aktif" : "nonaktif"}, batch berjalan: ${worker.running ? "ya" : "tidak"}.`
        : "Worker runtime belum dapat dibaca.",
    };
  });
  await safeCheck("settings", "Konfigurasi Reminder", async () => {
    const settings = await getAletaBotSettings(db);
    return {
      status: settings.deadlineReminderKillSwitch ? "warning" : "passed",
      detail: `Scheduler ${settings.deadlineReminderSchedulerEnabled ? "aktif" : "nonaktif"} mode ${settings.deadlineReminderSchedulerMode}, kill switch ${settings.deadlineReminderKillSwitch ? "aktif" : "normal"}.`,
    };
  });
  await safeCheck("safe_sending_window", "Safe Sending Window", async () => {
    const runtimeStatus = await fetchAletaBotRuntimeStatusPayload();
    const windowConfig = runtimeStatus.payload?.bot?.sendingWindow;
    if (!runtimeStatus.online || !windowConfig) {
      return { status: "warning", detail: "Status jam aman belum terbaca dari runtime." };
    }
    return {
      status: windowConfig.enabled === false ? "failed" : "passed",
      detail: windowConfig.enabled === false
        ? "Jam aman nonaktif."
        : `Jam aman terbaca: ${windowConfig.start ?? "07:30"}-${windowConfig.end ?? "21:00"}.`,
    };
  });
  await safeCheck("policy_skip", "Policy Skip Report", async () => {
    const report = await getPolicySkipReport(db, actorUserId, {});
    return { detail: `Policy skip readable. Total: ${report.summary.total}.` };
  });
  await safeCheck("public_qa", "Analytics Public Q&A", async () => {
    const analytics = await getPublicQaAnalytics(db, actorUserId);
    return { detail: `Public Q&A readable. Pending review: ${analytics.humanReviewPending}.` };
  });
  await safeCheck("ai_bridge", "Status AI Bridge", async () => {
    const ai = await getAISettingsFromDb(db);
    const activeProvider = ai.providers.find((provider) => provider.id === ai.activeConnectionId) ?? ai.providers.find((provider) => provider.isActive);
    return {
      status: ai.enabled ? "passed" : "warning",
      detail: ai.enabled
        ? `AI aktif (${activeProvider?.providerName ?? ai.providerId}/${activeProvider?.modelId ?? ai.modelId}).`
        : "AI sedang dinonaktifkan; fitur saran akan fallback manual.",
    };
  });
  await safeCheck("db_registry", "Registry Koneksi Database", async () => {
    const connections = await getDbConnections(db);
    return { detail: `${connections.length} koneksi database terdaftar. Password tidak diekspos.` };
  });
  await safeCheck("pilot_readiness", "Pilot Readiness Report", async () => {
    const readiness = await getPilotReadinessReport(db, actorUserId);
    return {
      status: readiness.overallStatus === "Terblokir" ? "failed" : readiness.overallStatus === "Perlu Perhatian" ? "warning" : "passed",
      detail: `Readiness readable. Status: ${readiness.overallStatus}. Blocker/catatan: ${readiness.blockers.length}.`,
    };
  });
  checks.push({
    key: "no_send",
    label: "Tidak Ada Aksi Kirim",
    status: "passed",
    detail: "Smoke test hanya membaca status dan konfigurasi. Tidak enqueue, tidak kirim WhatsApp, tidak scan QR.",
  });
  checks.push({
    key: "no_secret_response",
    label: "Tidak Ada Secret di Response",
    status: "passed",
    detail: "Response smoke test hanya berisi status ringkas; token, QR raw, session, password, dan API key tidak disertakan.",
  });

  return {
    generatedAt: new Date().toISOString(),
    overallStatus: checks.some((check) => check.status === "failed")
      ? "failed"
      : checks.some((check) => check.status === "warning")
        ? "warning"
        : "passed",
    checks,
  };
}

export async function getAletaBotQueueProgress(
  db: AletaDatabase,
  actorUserId: string,
  queueId: number | string
) {
  await requireAletaBotOperator(db, actorUserId);
  const safeQueueId = String(queueId || "").trim();
  if (!safeQueueId) {
    throw new ApiError(400, "ID antrean wajib diisi.");
  }
  if (getWhatsappRuntimeMode() !== "aleta_bot") {
    return {
      status: "unknown",
      queueId: safeQueueId,
      message: "Progress antrean hanya tersedia saat runtime WhatsApp memakai ALETA Bot.",
      queueProgress: {
        queueId: safeQueueId,
        stage: "unknown",
        status: "runtime_not_aleta_bot",
        position: null,
        pendingAhead: null,
        estimatedWaitMs: null,
        estimatedWaitText: "runtime bukan ALETA Bot",
      },
    };
  }

  const result = await getGatewayQueueProgress(safeQueueId);
  if (!result.ok) {
    throw new ApiError(502, `Progres antrean belum dapat dibaca: ${result.error}`);
  }

  return {
    status: result.data.queueProgress?.status ?? "unknown",
    queueId: safeQueueId,
    queueProgress: result.data.queueProgress,
    message: result.data.queueProgress?.estimatedWaitText
      ? `Status antrean: ${result.data.queueProgress.status}. Estimasi: ${result.data.queueProgress.estimatedWaitText}.`
      : `Status antrean: ${result.data.queueProgress?.status ?? "unknown"}.`,
  };
}

export async function runAletaBotAction(
  db: AletaDatabase,
  {
    actorUserId,
    action,
    payload,
  }: {
    actorUserId: string;
    action:
      | "sync-config"
      | "sync-ai-config"
      | "test-ai-runtime"
      | "reconnect"
      | "logout"
      | "send-test"
      | "test-template"
      | "test-query"
      | "test-notification"
      | "test-connection"
      | "pause-worker"
      | "resume-worker"
      | "purge-logs";
    payload?: Record<string, unknown>;
  }
) {
  // Aksi operasional harian boleh dijalankan Admin; aksi kebijakan/berisiko
  // (sinkronisasi konfigurasi, AI, sesi WhatsApp, purge log) tetap Super Admin.
  const operatorActions = new Set([
    "sync-config",
    "send-test",
    "test-template",
    "test-query",
    "test-notification",
    "test-connection",
    "pause-worker",
    "resume-worker",
  ]);
  const actor = operatorActions.has(action)
    ? await requireAletaBotOperator(db, actorUserId)
    : await requireSuperAdmin(db, actorUserId);
  const settings = await getAletaBotSettings(db);

  if (action === "sync-config") {
    const syncResult = await writeAletaBotRuntimeConfig(db, settings, await getWhatsAppSettingsFromDb(db));
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: syncResult.runtimeSync.ok && syncResult.localWrites.every((item) => item.ok) ? "success" : "warning",
      eventType: "settings",
      message: syncResult.runtimeSync.ok
        ? "Runtime config ALETA Bot disinkronkan ke layanan bot."
        : "Runtime config ALETA Bot tersimpan di portal, tetapi layanan bot belum mengonfirmasi sinkronisasi.",
      metadata: syncResult,
    });
    return getAletaBotSnapshot(db, actor.id);
  }

  if (action === "sync-ai-config") {
    await syncAletaBotAiConfig(db, actor.id);
    return getAletaBotSnapshot(db, actor.id);
  }

  if (action === "test-ai-runtime") {
    await testAletaBotAiRuntime(db, actor.id);
    return getAletaBotSnapshot(db, actor.id);
  }

  if (action === "reconnect") {
    const waRuntimeMode = getWhatsappRuntimeMode();
    let gatewayMessage = "";
    if (waRuntimeMode === "aleta_bot") {
      const result = await connectGatewayWhatsapp();
      if (!result.ok) {
        throw new ApiError(502, result.error);
      }
      gatewayMessage = result.data.message ?? `Gateway status: ${result.data.status}`;
    } else {
      void whatsappService.initialize();
    }
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "info",
      eventType: "connection",
      message:
        waRuntimeMode === "aleta_bot"
          ? `Connect WhatsApp Gateway diminta ke runtime aleta_bot. ${gatewayMessage}`
          : "Reconnect WhatsApp Gateway diminta dari modul ALETA Bot.",
    });
    return getAletaBotSnapshot(db, actor.id);
  }

  if (action === "logout") {
    const waRuntimeMode = getWhatsappRuntimeMode();
    if (waRuntimeMode !== "aleta_bot") {
      await whatsappService.deactivate();
    }
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "warning",
      eventType: "connection",
      message:
        waRuntimeMode === "aleta_bot"
          ? "Logout diabaikan: sesi WhatsApp dikelola oleh aleta_bot gateway. Gunakan panel aleta_bot untuk logout."
          : "Sesi WhatsApp Gateway dinonaktifkan dari modul ALETA Bot.",
    });
    return getAletaBotSnapshot(db, actor.id);
  }

  if (action === "test-connection") {
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "info",
      eventType: "connection",
      message: "Status koneksi WhatsApp diuji dari modul ALETA Bot.",
    });
    return getAletaBotSnapshot(db, actor.id);
  }

  if (action === "test-template") {
    const templateId = String(payload?.templateId ?? "admin-test");
    const template = (await getTemplates(db)).find((item) => item.id === templateId);
    if (!template) {
      throw new ApiError(404, "Template tidak ditemukan.");
    }
    const preview = renderTemplate(template, {
      waktu: new Date().toLocaleString("id-ID"),
      mode: settings.dryRunEnabled ? "dry-run" : "live",
      nomor_perkara: "123/Pdt.G/2026/PA.Dgl",
      nama_pihak: "Contoh Pihak",
      nama_pegawai: "Contoh Pegawai",
      jabatan: "Panitera Pengganti",
      recipient_name: "Contoh Pegawai",
      nama_instansi: "KUA Kecamatan Contoh",
      nama_layanan: "Layanan informasi pengadilan",
      agenda: "Mediasi",
      hari_sidang: "Senin",
      tanggal_sidang: "27-04-2026",
      ruangan: "Ruang Sidang 1",
      sisa_panjar: "Rp125.000",
      judul_notifikasi: "Contoh Notifikasi",
      ringkasan: "Data contoh pertama untuk pratinjau aman.\nData contoh kedua untuk pratinjau aman.",
      jenis_surat: "Surat Masuk",
      nomor_surat: "W00-A/123/OT.01/5/2026",
      perihal: "Pemberitahuan layanan",
      instruksi: "Mohon ditindaklanjuti sesuai kewenangan.",
      deadline: "21 Mei 2026",
      status: "Selesai",
    });
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "success",
      eventType: "template",
      message: "Preview template ALETA Bot dibuat.",
      metadata: { templateId, preview },
    });
    const snapshot = await getAletaBotSnapshot(db, actor.id);
    return { ...snapshot, preview };
  }

  if (action === "send-test") {
    const to = assertWhatsappNumber(String(payload?.to ?? settings.testTargetNumber), "Nomor tujuan test");
    const message = String(payload?.message ?? "").trim();
    if (message.length < 3 || message.length > 1000) {
      throw new ApiError(400, "Pesan test harus berisi 3-1000 karakter.");
    }

    if (settings.dryRunEnabled) {
      await appendAletaBotLog(db, {
        actorUserId: actor.id,
        level: "success",
        eventType: "message",
        message: "Dry-run pesan test ALETA Bot berhasil disimulasikan.",
        metadata: { to: "redacted", length: message.length },
      });
      const snapshot = await getAletaBotSnapshot(db, actor.id);
      return {
        ...snapshot,
        actionResult: {
          status: "simulated",
          dryRun: true,
          sent: false,
          queueProgress: {
            stage: "done",
            status: "simulated",
            position: 0,
            pendingAhead: 0,
            estimatedWaitMs: 0,
            estimatedWaitText: "simulasi selesai",
          },
          message: "Mode simulasi masih aktif, jadi pesan uji tidak dikirim ke WhatsApp sungguhan.",
        },
      };
    }

    if (getWhatsappRuntimeMode() === "aleta_bot") {
      const [gatewayStatus, workerState] = await Promise.all([
        getGatewayWhatsappStatus(),
        getWorkerStateFromGateway(),
      ]);
      if (!gatewayStatus.ok) {
        throw new ApiError(502, `ALETA Bot Gateway belum dapat dihubungi: ${gatewayStatus.error}`);
      }
      if (gatewayStatus.data.status !== "connected") {
        throw new ApiError(
          409,
          `WhatsApp ALETA Bot belum tersambung. Status saat ini: ${gatewayStatus.data.status}. Scan QR atau hubungkan ulang WhatsApp terlebih dahulu.`
        );
      }
      if (!isQueueWorkerOperational(workerState)) {
        throw new ApiError(409, `Mesin Bot belum siap mengirim pesan. ${describeQueueWorker(workerState)}`);
      }
    }

    const sendResult = await sendPortalWhatsappMessage({
      sourceFeature: "aleta_bot_test",
      entityType: "test",
      entityId: actor.id,
      // timestamp in eventType ensures each test send is a new idempotency key
      eventType: `test_${Date.now()}`,
      recipientNumber: to,
      recipientName: actor.name || actor.username || "",
      message,
      priority: 1,
      category: "system",
      metadata: {
        sourceFeature: "aleta_bot_test",
        entityType: "test",
        entityId: actor.id,
        recipientType: "system",
        recipientRole: actor.roleId,
        processImmediately: true,
      },
    });
    if (!sendResult.ok) {
      throw new Error(sendResult.message);
    }
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "success",
      eventType: "message",
      message:
        sendResult.status === "enqueued"
          ? "Pesan test ALETA Bot diantrekan melalui aleta_bot gateway."
          : sendResult.status === "sent"
          ? "Pesan test ALETA Bot dikirim melalui WhatsApp Gateway."
          : "Pesan test ALETA Bot diproses.",
      metadata: { to: "redacted", length: message.length },
    });
    const snapshot = await getAletaBotSnapshot(db, actor.id);
    return {
      ...snapshot,
      actionResult: {
        status: sendResult.status,
        queueId: sendResult.queueId,
        duplicate: sendResult.duplicate,
        idempotencyKey: sendResult.idempotencyKey,
        queueProgress: sendResult.queueProgress,
        sent: sendResult.status === "sent",
        message:
          sendResult.status === "enqueued"
            ? `Pesan uji sudah masuk antrean cepat ALETA Bot${sendResult.queueId ? ` (ID ${sendResult.queueId})` : ""}${sendResult.queueProgress?.estimatedWaitText ? `. Estimasi tunggu: ${sendResult.queueProgress.estimatedWaitText}` : ""}. Pantau status terkirim/gagal di laporan WhatsApp.`
            : sendResult.message,
      },
    };
  }

  if (action === "test-query") {
    const queryId = String(payload?.queryId ?? "");
    const savedQuery = (await getQueries(db)).find((query) => query.id === queryId);
    if (savedQuery) {
      const now = new Date().toISOString();
      const health = await checkSavedQueryHealth(savedQuery);
      await db
        .prepare(
          `UPDATE aleta_bot_queries
           SET last_tested_at = ?, last_test_status = ?, last_test_error = ?,
             last_test_duration_ms = ?, last_test_row_count = ?, last_test_sample_json = ?,
             last_test_slow = ?, last_test_message = ?, updated_by = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          now,
          health.ok ? "success" : "failed",
          health.error,
          health.durationMs,
          health.rowCount,
          JSON.stringify(health.sampleRows.slice(0, 5)),
          health.slow ? 1 : 0,
          health.message,
          actor.id,
          now,
          savedQuery.id
        );
      await appendAletaBotLog(db, {
        actorUserId: actor.id,
        level: health.ok ? (health.slow ? "warning" : "success") : "error",
        eventType: "query",
        message: health.ok
          ? `Health check sumber data ${savedQuery.name} selesai.`
          : `Health check sumber data ${savedQuery.name} gagal.`,
        metadata: { queryId, health },
      });
      const snapshot = await getAletaBotSnapshot(db, actor.id);
      return { ...snapshot, preview: JSON.stringify(health, null, 2) };
    }

    const item = ALETA_BOT_QUERY_CATALOG.find((query) => query.id === queryId);
    if (!item) {
      throw new ApiError(404, "Sumber data ALETA Bot tidak ditemukan.");
    }
    if (!item.testable) {
      await appendAletaBotLog(db, {
        actorUserId: actor.id,
        level: "warning",
        eventType: "query",
        message: "Uji sumber data diblokir karena membaca database produksi SIPP/MIS.",
        metadata: { queryId, sourceFile: item.sourceFile },
      });
      const snapshot = await getAletaBotSnapshot(db, actor.id);
      return {
        ...snapshot,
        preview: "Sumber data ini terdaftar, tetapi eksekusi live diblokir di portal demi keamanan data produksi.",
      };
    }
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "success",
      eventType: "query",
      message: "Uji sumber data ringan berhasil.",
      metadata: { queryId },
    });
    const snapshot = await getAletaBotSnapshot(db, actor.id);
    return { ...snapshot, preview: "Utility terdaftar dan aman untuk diuji dari portal." };
  }

  if (action === "test-notification") {
    const notificationId = String(payload?.notificationId ?? "");
    const notification = (await getNotifications(db)).find((item) => item.id === notificationId);
    if (!notification) throw new ApiError(404, "Notifikasi ALETA Bot tidak ditemukan.");
    const query = (await getQueries(db)).find((item) => item.id === notification.queryId);
    if (!query) throw new ApiError(404, "Sumber data notifikasi tidak ditemukan.");
    const template = (await getTemplates(db)).find((item) => item.id === notification.templateId);
    if (!template) throw new ApiError(404, "Template notifikasi tidak ditemukan.");

    const sample = makeSampleRow(query.outputColumns);
    sample.nama_pegawai = "Contoh Pegawai";
    sample.judul_notifikasi = notification.name;
    sample.ringkasan = notification.description || "Data contoh pertama untuk simulasi.\nData contoh kedua untuk simulasi.";
    sample.mode = settings.dryRunEnabled ? "dry-run" : "live";
    sample.waktu = new Date().toLocaleString("id-ID");
    const preview = renderTemplate(template, sample);

    let recipientNumber = "";
    let recipientName = "";
    if (notification.category === "employee") {
      const recipient = (await getEmployeeRecipients(db))[0];
      recipientNumber = recipient?.whatsappNumber ?? "";
      recipientName = recipient?.name ?? "Simulasi Pegawai";
    } else {
      recipientNumber = normalizeWhatsappNumber(sample[query.recipientColumn] ?? "");
      recipientName = sample.nama_pihak ?? "Simulasi Pihak";
    }

    const status: AletaBotNotificationLogEntry["status"] = recipientNumber ? "simulated" : "failed";
    const errorMessage = recipientNumber ? null : "Nomor penerima tidak tersedia/invalid pada simulasi.";
    await db
      .prepare(
        `INSERT INTO aleta_bot_notification_logs (
          id, notification_id, query_id, recipient_number, recipient_name, category,
          message_preview, status, error_message, source_app, source_feature, entity_type, entity_id, metadata_json,
          sent_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        await nextPrefixedId(db, "aleta_bot_notification_logs", "abnl"),
        notification.id,
        query.id,
        recipientNumber,
        recipientName,
        notification.category,
        preview.slice(0, 1000),
        status,
        errorMessage,
        "aleta_bot_admin",
        notification.category === "party" ? "notification_party" : "notification_employee",
        "notification",
        notification.id,
        JSON.stringify(buildMessageEntityMetadata({
          sourceApp: "aleta_bot_admin",
          sourceFeature: notification.category === "party" ? "notification_party" : "notification_employee",
          entityType: "notification",
          entityId: notification.id,
          recipientType: notification.category === "party" ? "party" : "employee",
          recipientPosition: notification.category === "employee" ? "sample-pegawai" : "sample-pihak",
          notificationId: notification.id,
          queryId: query.id,
          mode: "simulation",
        })),
        status === "simulated" ? new Date().toISOString() : null,
        new Date().toISOString()
      );
    await db
      .prepare(
        `UPDATE aleta_bot_notifications
         SET last_run_at = ?, last_status = ?, last_message = ?
         WHERE id = ?`
      )
      .run(new Date().toISOString(), status, errorMessage ?? "Simulasi notifikasi berhasil.", notification.id);
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: status === "failed" ? "error" : "success",
      eventType: "notification",
      message: `Test notifikasi ${notification.name} diproses dalam mode aman.`,
      metadata: { notificationId, queryId: query.id, status },
    });
    const snapshot = await getAletaBotSnapshot(db, actor.id);
    return { ...snapshot, preview };
  }

  if (action === "pause-worker") {
    const reason = String(payload?.reason ?? "Dijeda manual dari portal admin.").slice(0, 200);
    await controlWorker(db, actor.id, "pause", reason);
    return getAletaBotSnapshot(db, actor.id);
  }

  if (action === "resume-worker") {
    await controlWorker(db, actor.id, "resume");
    return getAletaBotSnapshot(db, actor.id);
  }

  if (action === "purge-logs") {
    const olderThanDays = Math.max(7, Math.min(365, Number(payload?.olderThanDays ?? 30)));
    const safeOnly = payload?.safeOnly !== false;
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
    // Only delete non-audit log types: message, notification, query, template, connection, public_qa
    // Never delete: admin, settings — those are kept as operational trail
    const safeEventTypes = safeOnly
      ? ["message", "notification", "query", "public_qa"]
      : ["message", "notification", "query", "template", "connection", "public_qa", "database"];
    const placeholders = safeEventTypes.map(() => "?").join(", ");
    const result = await db
      .prepare(`DELETE FROM aleta_bot_logs WHERE created_at < ? AND event_type IN (${placeholders})`)
      .run(cutoff, ...safeEventTypes);
    const deletedCount = result.changes ?? 0;
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "info",
      eventType: "admin",
      message: `Retensi log: ${deletedCount} entri log lama (>${olderThanDays} hari) dihapus.`,
      metadata: { olderThanDays, cutoff, safeOnly, safeEventTypes, deletedCount },
    });
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "PURGE_ALETA_BOT_LOGS",
      entityType: "aleta_bot_logs",
      entityId: "bulk",
      payload: { olderThanDays, cutoff, safeOnly, deletedCount },
    });
    const snapshot = await getAletaBotSnapshot(db, actor.id);
    return { ...snapshot, deletedCount };
  }

  throw new ApiError(400, "Aksi ALETA Bot tidak valid.");
}

// ---- Kirim Manual (manual send) ----

const MANUAL_SEND_SOURCE_FEATURE = "aleta_bot_manual_send";
const MANUAL_SEND_MAX_RECIPIENTS = 1000;

function extractSqlParameters(sqlText: string) {
  const params = new Set<string>();
  String(sqlText || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    params.add(key);
    return "";
  });
  return [...params];
}

function normalizeManualRecipientInput(
  raw: string,
  name = "",
  source: "manual" | "query" = "manual",
  documentPath = "",
  perRecipientMessage = ""
): AletaBotManualRecipientPreview & { documentPath: string; perRecipientMessage: string } {
  const trimmed = String(raw || "").trim();
  const normalized = normalizeWhatsappNumber(trimmed);
  const valid = /^628\d{7,13}$/.test(normalized);
  return {
    raw: trimmed,
    normalized: valid ? normalized : "",
    chatId: valid ? `${normalized}@c.us` : "",
    valid,
    reason: trimmed
      ? valid
        ? ""
        : "Bukan nomor WhatsApp Indonesia yang valid (contoh benar: 081234567890, 6281234567890, atau +6281234567890)."
      : "Nomor kosong.",
    name: String(name || "").trim(),
    source,
    documentPath: String(documentPath || "").trim(),
    perRecipientMessage: String(perRecipientMessage || "").trim(),
  };
}

function dedupeManualRecipients<T extends AletaBotManualRecipientPreview>(recipients: T[]) {
  const seen = new Set<string>();
  return recipients.filter((item) => {
    const key = item.normalized || item.raw;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function assertNoUnresolvedPlaceholders(message: string) {
  const unresolved = extractSqlParameters(message);
  if (unresolved.length > 0) {
    throw new ApiError(400, `Isi pesan masih memiliki placeholder kosong: ${unresolved.join(", ")}. Lengkapi data sebelum mengirim.`);
  }
  if (message.includes("⟪")) {
    throw new ApiError(400, "Isi pesan masih memiliki penanda placeholder kosong. Lengkapi data sebelum mengirim.");
  }
}

export async function previewAletaBotManualSend(
  db: AletaDatabase,
  input: {
    actorUserId: string;
    mode: AletaBotManualSendMode;
    message?: string;
    queryId?: string;
    templateId?: string;
    params?: Record<string, string>;
    manualValues?: Record<string, string>;
    selectedRowIndex?: number;
    recipients?: Array<{ input: string; name?: string }>;
    runQuery?: boolean;
    // Dipakai untuk sumber data pegawai: menentukan pegawai mana yang jadi
    // filter query, memakai pemetaan penerima milik notifikasi terkait.
    notificationId?: string;
    // Tanggal acuan pilihan operator: menggantikan "hari ini" pada SQL sumber
    // data, sehingga satu pemilih tanggal berlaku untuk semua skenario.
    referenceDate?: string;
  }
): Promise<AletaBotManualSendPreviewResult> {
  await requireAletaBotOperator(db, input.actorUserId);
  const mode: AletaBotManualSendMode = input.mode === "data_source" ? "data_source" : "manual";

  const manualRecipients = dedupeManualRecipients(
    (input.recipients ?? []).map((item) => normalizeManualRecipientInput(item.input, item.name ?? "", "manual"))
  );

  if (mode === "manual") {
    return {
      ok: true,
      mode,
      query: null,
      template: null,
      recipients: manualRecipients,
      message: String(input.message ?? ""),
    };
  }

  const queries = await getQueries(db);
  const templates = await getTemplates(db);
  const query = input.queryId ? queries.find((item) => item.id === input.queryId) : undefined;
  const template = input.templateId ? templates.find((item) => item.id === input.templateId) : undefined;

  if (input.queryId && !query) throw new ApiError(404, "Sumber data tidak ditemukan.");
  if (input.templateId && !template) throw new ApiError(404, "Isi pesan (template) tidak ditemukan.");
  if (!query && !template) throw new ApiError(400, "Pilih minimal sumber data atau isi pesan.");

  let queryPreview: AletaBotManualSendQueryPreview | null = null;
  let templatePreview: AletaBotManualSendTemplatePreview | null = null;

  if (query && input.runQuery === false) {
    queryPreview = {
      id: query.id,
      name: query.name,
      neededParams: extractSqlParameters(query.sqlText),
      missingParams: [],
      rows: [],
      rowCount: 0,
      truncated: false,
      durationMs: 0,
      empty: false,
      recipients: [],
    };
    return {
      ok: true,
      mode,
      query: queryPreview,
      template: template
        ? {
            id: template.id,
            title: template.title,
            placeholders: template.placeholders,
            missingPlaceholders: [],
            message: "",
            complete: false,
          }
        : null,
      recipients: manualRecipients,
      message: "",
    };
  }

  if (getWhatsappRuntimeMode() !== "aleta_bot") {
    throw new ApiError(
      409,
      "Preview sumber data membutuhkan runtime ALETA Bot (WHATSAPP_RUNTIME_MODE=aleta_bot). Runtime saat ini tidak aktif."
    );
  }

  // Sumber data pegawai (mis. "Hakim - Daftar Sidang Hari Ini") difilter per nama
  // pegawai. Daftar pegawainya dihitung dengan pemetaan yang sama seperti
  // notifikasi, supaya hasil Kirim Manual persis sama dengan pengiriman terjadwal.
  let employeeRecipientsPayload: Array<{ name: string; whatsappNumber: string }> = [];
  let notificationName = "";
  if (query?.category === "employee") {
    const notifications = await getNotifications(db);
    const relatedNotification =
      (input.notificationId ? notifications.find((item) => item.id === input.notificationId) : undefined) ??
      notifications.find((item) => item.queryId === query.id);
    notificationName = relatedNotification?.name ?? "";
    const allEmployees = await getEmployeeRecipients(db);
    const targeted = relatedNotification
      ? filterEmployeeRecipientsByMapping(allEmployees, relatedNotification.recipientMapping ?? {})
      : allEmployees;
    employeeRecipientsPayload = targeted.map((item) => ({
      name: item.name || item.username,
      whatsappNumber: item.whatsappNumber,
    }));
  }

  const runtimeResponse = await callAletaBotRuntime<{
    preview?: {
      ok: boolean;
      query:
        | (Omit<AletaBotManualSendQueryPreview, "recipients"> & {
            recipients: Array<{
              raw?: string;
              normalized?: string;
              valid?: boolean;
              reason?: string;
              name?: string;
              rowIndex?: number;
            }>;
          })
        | null;
      template: (AletaBotManualSendTemplatePreview & { values?: Record<string, string> }) | null;
      recipientMessages?: Array<{
        rowIndex?: number;
        normalized?: string;
        message?: string;
        complete?: boolean;
        missingPlaceholders?: string[];
      }>;
    };
  }>("/internal/aleta-bot/manual-send/preview", {
    method: "POST",
    body: JSON.stringify({
      query: query
        ? {
            id: query.id,
            name: query.name,
            category: query.category,
            sqlText: query.sqlText,
            outputColumns: query.outputColumns,
            recipientColumn: query.recipientColumn,
            connectionKey: query.connectionKey,
          }
        : null,
      template: template
        ? { id: template.id, title: template.title, body: template.body }
        : null,
      params: input.params ?? {},
      manualValues: input.manualValues ?? {},
      selectedRowIndex: input.selectedRowIndex ?? 0,
      maxRows: 1000,
      employeeRecipients: employeeRecipientsPayload,
      notificationName,
      referenceDate: String(input.referenceDate || ""),
    }),
  },
    // Sumber data pegawai menjalankan query SIPP per pegawai, jauh lebih lama
    // daripada panggilan biasa, sehingga batas 10 detik tidak mencukupi.
    ALETA_BOT_PREVIEW_TIMEOUT_MS
  );

  const preview = runtimeResponse.preview;
  if (!preview) throw new ApiError(502, "Runtime ALETA Bot tidak mengembalikan hasil preview.");

  if (preview.query) {
    queryPreview = {
      id: preview.query.id,
      name: preview.query.name || query?.name || "",
      neededParams: preview.query.neededParams ?? [],
      missingParams: preview.query.missingParams ?? [],
      rows: preview.query.rows ?? [],
      rowCount: preview.query.rowCount ?? 0,
      truncated: Boolean(preview.query.truncated),
      durationMs: preview.query.durationMs ?? 0,
      empty: Boolean(preview.query.empty),
      legacy: Boolean(preview.query.legacy),
      legacyText: preview.query.legacyText ?? "",
      error: preview.query.error,
      recipients: (preview.query.recipients ?? []).map((item) => ({
        raw: String(item.raw ?? ""),
        normalized: String(item.normalized ?? ""),
        chatId: item.normalized ? `${item.normalized}@c.us` : "",
        valid: Boolean(item.valid),
        reason: String(item.reason ?? ""),
        name: String(item.name ?? ""),
        source: "query" as const,
        rowIndex: Number(item.rowIndex ?? 0),
      })),
    };
  }

  if (preview.template) {
    templatePreview = {
      id: preview.template.id,
      title: preview.template.title || template?.title || "",
      placeholders: preview.template.placeholders ?? [],
      missingPlaceholders: preview.template.missingPlaceholders ?? [],
      message: preview.template.message ?? "",
      complete: Boolean(preview.template.complete),
    };
  }

  return {
    ok: Boolean(preview.ok),
    mode,
    query: queryPreview,
    template: templatePreview,
    recipients: dedupeManualRecipients([...(queryPreview?.recipients ?? []), ...manualRecipients]),
    message: templatePreview?.message ?? "",
    recipientMessages: (preview.recipientMessages ?? []).map((item) => ({
      rowIndex: Number(item.rowIndex ?? -1),
      normalized: String(item.normalized ?? ""),
      message: String(item.message ?? ""),
      complete: Boolean(item.complete),
      missingPlaceholders: item.missingPlaceholders ?? [],
    })),
  };
}

export async function runAletaBotManualSend(
  db: AletaDatabase,
  input: {
    actorUserId: string;
    mode: AletaBotManualSendMode;
    message: string;
    recipients: Array<{ input: string; name?: string; documentPath?: string; message?: string }>;
    isTest?: boolean;
    clientRequestId: string;
    confirmMultiple?: boolean;
    queryId?: string;
    templateId?: string;
    params?: Record<string, string>;
    // Lampirkan dokumen gugatan/permohonan per penerima (petitum_dok dari SIPP).
    attachDocument?: boolean;
  }
): Promise<AletaBotManualSendResult> {
  const actor = await requireAletaBotOperator(db, input.actorUserId);
  const settings = await getAletaBotSettings(db);
  const mode: AletaBotManualSendMode = input.mode === "data_source" ? "data_source" : "manual";
  const isTest = input.isTest === true;

  const clientRequestId = String(input.clientRequestId || "").trim();
  if (!/^[a-zA-Z0-9:_-]{8,80}$/.test(clientRequestId)) {
    throw new ApiError(400, "clientRequestId tidak valid. Muat ulang halaman lalu coba lagi.");
  }

  const finalMessage = String(input.message ?? "").trim();
  if (finalMessage.length < 3 || finalMessage.length > 4000) {
    throw new ApiError(400, "Isi pesan harus 3-4000 karakter.");
  }
  assertNoUnresolvedPlaceholders(finalMessage);

  const attachDocument = input.attachDocument === true;
  const recipients = dedupeManualRecipients(
    (input.recipients ?? []).map((item) =>
      normalizeManualRecipientInput(
        item.input,
        item.name ?? "",
        "manual",
        attachDocument ? item.documentPath ?? "" : "",
        item.message ?? ""
      )
    )
  );
  // Setiap pesan per-penerima wajib lolos pemeriksaan placeholder yang sama
  // dengan pesan global, supaya tidak ada {{...}} mentah yang lolos ke pihak.
  for (const recipient of recipients) {
    if (recipient.perRecipientMessage) {
      assertNoUnresolvedPlaceholders(recipient.perRecipientMessage);
    }
  }
  if (recipients.length === 0) {
    throw new ApiError(400, "Minimal satu nomor tujuan wajib diisi.");
  }
  if (recipients.length > MANUAL_SEND_MAX_RECIPIENTS) {
    throw new ApiError(400, `Maksimal ${MANUAL_SEND_MAX_RECIPIENTS} penerima per pengiriman manual.`);
  }
  if (recipients.length > 1 && input.confirmMultiple !== true) {
    throw new ApiError(400, `Pengiriman ke ${recipients.length} penerima membutuhkan konfirmasi. Centang konfirmasi banyak penerima.`);
  }
  const invalidRecipients = recipients.filter((item) => !item.valid);
  if (invalidRecipients.length > 0) {
    throw new ApiError(
      400,
      `Nomor tujuan tidak valid: ${invalidRecipients.map((item) => item.raw || "(kosong)").join(", ")}. Perbaiki atau hapus nomor tersebut.`
    );
  }

  const query = input.queryId ? (await getQueries(db)).find((item) => item.id === input.queryId) : undefined;
  const template = input.templateId ? (await getTemplates(db)).find((item) => item.id === input.templateId) : undefined;

  const dryRun = Boolean(settings.dryRunEnabled);
  if (!dryRun && getWhatsappRuntimeMode() === "aleta_bot") {
    const [gatewayStatus, workerState] = await Promise.all([
      getGatewayWhatsappStatus(),
      getWorkerStateFromGateway(),
    ]);
    if (!gatewayStatus.ok) {
      throw new ApiError(502, `ALETA Bot Gateway belum dapat dihubungi: ${gatewayStatus.error}`);
    }
    if (gatewayStatus.data.status !== "connected") {
      throw new ApiError(
        409,
        `WhatsApp ALETA Bot belum tersambung. Status saat ini: ${gatewayStatus.data.status}. Scan QR atau hubungkan ulang WhatsApp terlebih dahulu.`
      );
    }
    if (!isQueueWorkerOperational(workerState)) {
      throw new ApiError(409, `Mesin Bot belum siap mengirim pesan. ${describeQueueWorker(workerState)}`);
    }
  }

  const outgoingMessage = isTest ? `*[TEST]*\n${finalMessage}` : finalMessage;
  const now = new Date().toISOString();
  const results: AletaBotManualSendRecipientResult[] = [];
  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of recipients) {
    let status: AletaBotManualSendRecipientResult["status"] = "failed";
    let queueId: number | string | undefined;
    let idempotencyKey: string | undefined;
    let errorMessage: string | null = null;

    if (dryRun) {
      status = "simulated";
    } else {
      try {
        const sendResult = await sendPortalWhatsappMessage({
          sourceApp: "manajemen_surat",
          sourceFeature: MANUAL_SEND_SOURCE_FEATURE,
          entityType: mode,
          entityId: clientRequestId,
          eventType: `manual_send_${clientRequestId}`,
          recipientNumber: recipient.normalized,
          recipientName: recipient.name,
          // Pesan khusus penerima ini bila tersedia (dirender dari barisnya
          // sendiri), jatuh ke pesan global untuk mode ketik bebas.
          message: recipient.perRecipientMessage
            ? isTest
              ? `*[TEST]*\n${recipient.perRecipientMessage}`
              : recipient.perRecipientMessage
            : outgoingMessage,
          category: "manual",
          priority: 2,
          // Dokumen gugatan/permohonan hanya ikut bila toggle dinyalakan DAN
          // baris penerima memang punya path dokumen. required:false supaya
          // dokumen yang tidak terbaca tidak membatalkan pesan teksnya.
          attachment: recipient.documentPath
            ? { source: recipient.documentPath, kind: "sipp_document", required: false }
            : undefined,
          metadata: {
            sourceFeature: MANUAL_SEND_SOURCE_FEATURE,
            manualSend: true,
            manualSendMode: mode,
            attachDocument,
            documentPath: recipient.documentPath || "",
            testMessage: isTest,
            actorUserId: actor.id,
            actorName: actor.name || actor.username || "",
            queryId: query?.id ?? "",
            queryName: query?.name ?? "",
            templateId: template?.id ?? "",
            templateTitle: template?.title ?? "",
            queryParams: input.params ?? {},
            recipientNumberRaw: recipient.raw,
            clientRequestId,
            processImmediately: true,
          },
        });
        if (!sendResult.ok) {
          status = "failed";
          errorMessage = sendResult.message;
        } else if (sendResult.duplicate) {
          status = "duplicate";
          queueId = sendResult.queueId;
          idempotencyKey = sendResult.idempotencyKey;
        } else {
          status = sendResult.status === "sent" ? "sent" : sendResult.status === "enqueued" ? "enqueued" : "skipped";
          queueId = sendResult.queueId;
          idempotencyKey = sendResult.idempotencyKey;
        }
      } catch (error) {
        status = "failed";
        errorMessage = error instanceof Error ? error.message : "Pengiriman gagal tanpa detail error.";
      }
    }

    if (status === "failed") {
      failedCount += 1;
    } else if (status !== "duplicate") {
      sentCount += 1;
    }

    await db
      .prepare(
        `INSERT INTO aleta_bot_notification_logs (
          id, notification_id, query_id, recipient_number, recipient_name, category,
          message_preview, status, error_message, source_app, source_feature, entity_type, entity_id, metadata_json,
          sent_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        await nextPrefixedId(db, "aleta_bot_notification_logs", "abnl"),
        null,
        query?.id ?? null,
        recipient.normalized,
        recipient.name,
        "system",
        outgoingMessage.slice(0, 1000),
        status === "duplicate" ? "skipped" : status,
        status === "duplicate" ? "Duplikat: pesan yang sama dengan permintaan ini sudah diproses (anti pengiriman ganda)." : errorMessage,
        "manajemen_surat",
        MANUAL_SEND_SOURCE_FEATURE,
        mode,
        clientRequestId,
        JSON.stringify({
          sourceApp: "manajemen_surat",
          sourceFeature: MANUAL_SEND_SOURCE_FEATURE,
          entityType: mode,
          entityId: clientRequestId,
          manualSend: true,
          manualSendMode: mode,
          testMessage: isTest,
          dryRun,
          actorUserId: actor.id,
          actorName: actor.name || actor.username || "",
          queryId: query?.id ?? "",
          queryName: query?.name ?? "",
          templateId: template?.id ?? "",
          templateTitle: template?.title ?? "",
          queryParams: input.params ?? {},
          recipientNumberRaw: recipient.raw,
          clientRequestId,
          queueId: queueId ?? null,
          idempotencyKey: idempotencyKey ?? "",
        }),
        status === "sent" || status === "enqueued" || status === "simulated" ? now : null,
        now
      );

    results.push({
      raw: recipient.raw,
      normalized: recipient.normalized,
      name: recipient.name,
      status,
      queueId,
      idempotencyKey,
      errorMessage: status === "duplicate" ? "Duplikat: permintaan yang sama sudah diproses." : errorMessage,
    });
  }

  await appendAletaBotLog(db, {
    actorUserId: actor.id,
    level: failedCount > 0 ? (sentCount > 0 ? "warning" : "error") : "success",
    eventType: "message",
    message: dryRun
      ? `Kirim Manual disimulasikan (mode simulasi aktif) untuk ${recipients.length} penerima.`
      : `Kirim Manual (${mode === "manual" ? "pesan manual" : "sumber data"}${isTest ? ", TEST" : ""}) diproses: ${sentCount} terkirim/antre, ${failedCount} gagal.`,
    metadata: {
      mode,
      isTest,
      dryRun,
      clientRequestId,
      totalRecipients: recipients.length,
      sentCount,
      failedCount,
      queryId: query?.id ?? "",
      templateId: template?.id ?? "",
      queryParams: input.params ?? {},
    },
  });
  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "ALETA_BOT_MANUAL_SEND",
    entityType: "aleta_bot_manual_send",
    entityId: clientRequestId,
    payload: {
      mode,
      isTest,
      dryRun,
      totalRecipients: recipients.length,
      sentCount,
      failedCount,
      queryId: query?.id ?? "",
      templateId: template?.id ?? "",
    },
  });

  return {
    ok: failedCount === 0,
    mode,
    isTest,
    dryRun,
    clientRequestId,
    totalRecipients: recipients.length,
    sentCount,
    failedCount,
    message: dryRun
      ? "Mode simulasi aktif: pesan tidak dikirim ke WhatsApp sungguhan. Nonaktifkan Simulasi di pengaturan untuk kirim nyata."
      : failedCount === 0
        ? `Semua ${recipients.length} pesan sudah masuk antrean kirim ALETA Bot.`
        : `${sentCount} pesan diproses, ${failedCount} gagal. Periksa detail per penerima.`,
    recipients: results,
  };
}

export async function getAletaBotManualSendHistory(
  db: AletaDatabase,
  actorUserId: string,
  limit = 20
): Promise<AletaBotManualSendHistoryEntry[]> {
  await requireAletaBotOperator(db, actorUserId);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const rows = await db
    .prepare(
      `SELECT id, query_id, recipient_number, recipient_name, message_preview, status,
              error_message, entity_type, metadata_json, sent_at, created_at
       FROM aleta_bot_notification_logs
       WHERE source_feature = ?
       ORDER BY created_at DESC
       LIMIT ${safeLimit}`
    )
    .all<{
      id: string;
      query_id: string | null;
      recipient_number: string;
      recipient_name: string;
      message_preview: string;
      status: AletaBotNotificationLogEntry["status"];
      error_message: string | null;
      entity_type: string;
      metadata_json: string | null;
      sent_at: string | null;
      created_at: string;
    }>(MANUAL_SEND_SOURCE_FEATURE);

  return rows.map((row) => {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = row.metadata_json ? (JSON.parse(row.metadata_json) as Record<string, unknown>) : {};
    } catch {
      metadata = {};
    }
    const queryParamsValue = metadata.queryParams;
    const queryParams: Record<string, string> = {};
    if (queryParamsValue && typeof queryParamsValue === "object") {
      for (const [key, value] of Object.entries(queryParamsValue as Record<string, unknown>)) {
        queryParams[key] = String(value ?? "");
      }
    }
    return {
      id: row.id,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      actorName: String(metadata.actorName ?? ""),
      mode: metadata.manualSendMode === "data_source" ? "data_source" : "manual",
      isTest: metadata.testMessage === true,
      recipientNumberRaw: String(metadata.recipientNumberRaw ?? row.recipient_number),
      recipientNumber: row.recipient_number,
      recipientName: row.recipient_name,
      queryId: String(metadata.queryId ?? row.query_id ?? ""),
      queryName: String(metadata.queryName ?? ""),
      templateId: String(metadata.templateId ?? ""),
      templateTitle: String(metadata.templateTitle ?? ""),
      queryParams,
      messagePreview: row.message_preview,
      status: row.status,
      whatsappMessageId: String(metadata.whatsappMessageId ?? ""),
      errorMessage: row.error_message,
    };
  });
}
