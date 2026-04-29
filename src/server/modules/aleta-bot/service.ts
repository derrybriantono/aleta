import { mkdir, writeFile } from "node:fs/promises";
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
} from "@/lib/aleta-bot-types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { getAISettingsFromDb } from "@/server/modules/ai/service";
import { getWhatsAppSettingsFromDb } from "@/server/modules/settings/service";
import { whatsappService } from "@/server/modules/whatsapp/service";
import {
  getWhatsappRuntimeMode,
  buildGatewayWhatsappSnapshot,
  controlGatewayWorker,
  getGatewayDeadLetters,
  resendGatewayDeadLetter,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { sendPortalWhatsappMessage } from "@/server/modules/whatsapp/portal-whatsapp-sender";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import {
  convertLegacyToDraft,
  validateConvertedDraft,
  type ConvertedLegacyDraft,
} from "@/server/modules/aleta-bot/legacy-conversion";
import { buildSafeFallback, suggestIntentForQuestion } from "@/server/modules/aleta-bot/public-qa-safety";

const DEFAULT_ALETA_BOT_RUNTIME_URL = "http://127.0.0.1:3003";

type SettingsRow = {
  bot_enabled: number;
  notifications_enabled: number;
  admin_whatsapp_number: string;
  message_delay_ms: number;
  retry_limit: number;
  dry_run_enabled: number;
  schedule_cron: string;
  test_target_number: string;
  security_notes: string;
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
  error_message: string | null;
  sent_at: string | null;
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
  created_at: string;
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

const DEFAULT_SETTINGS: Omit<AletaBotSettings, "updatedAt"> = {
  botEnabled: false,
  notificationsEnabled: false,
  adminWhatsappNumber: "",
  messageDelayMs: 1500,
  retryLimit: 2,
  dryRunEnabled: true,
  scheduleCron: "00 07 * * Monday-Friday",
  testTargetNumber: "",
  securityNotes: "Modul ALETA Bot hanya aktif untuk Super Admin. Gunakan dry-run sebelum pengiriman produksi.",
};

const DEFAULT_DB_CONNECTIONS: Array<
  Omit<AletaBotDbConnection, "usernameMasked" | "passwordConfigured" | "lastTestStatus" | "lastTestError" | "lastTestAt" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt">
> = [
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
      requiresApprovalBeforeActive: true,
      version: 1,
      status: "active",
      approvedBy: null,
      approvedAt: null,
    };
  }
  if (key === "cek_jadwal_sidang") {
    return {
      aiAnswerEnabled: true,
      aiAnswerMode: "guided_answer",
      answerPolicy: "case_status_limited",
      verificationPolicy: "case_number_only",
      allowedDataFields: ["nomor_perkara", "tanggal_sidang", "agenda", "ruangan", "status_umum", "keterangan"],
      blockedDataFields: ["nik", "alamat", "telepon", "nomor_hp", "catatan_internal"],
      aiSystemPrompt: "",
      aiUserPromptTemplate: "",
      maxAiTokens: 350,
      temperature: 0.2,
      requiresApprovalBeforeActive: true,
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
      requiresApprovalBeforeActive: true,
      version: 1,
      status: "draft",
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
    requiresApprovalBeforeActive: true,
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
    queryKey: "public_hearing_schedule",
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
    queryKey: "public_divorce_certificate",
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
    queryKey: "public_case_fee",
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
    category: "notifikasi",
    title: "Notifikasi Perkara Baru",
    body:
      "Assalamu'alaikum.\n\nHalo, saya ALETA Bot. Perkara {{nomor_perkara}} atas nama {{nama_pihak}} telah terdaftar dengan agenda {{agenda}}.\n\nPesan ini adalah notifikasi otomatis.",
    placeholders: ["nomor_perkara", "nama_pihak", "agenda"],
    editable: true,
  },
  {
    id: "jadwal-sidang",
    category: "notifikasi",
    title: "Notifikasi Jadwal Sidang",
    body:
      "Assalamu'alaikum.\n\nPerkara {{nomor_perkara}} dijadwalkan sidang pada {{hari_sidang}}, {{tanggal_sidang}} di ruang {{ruangan}} dengan agenda {{agenda}}.",
    placeholders: ["nomor_perkara", "hari_sidang", "tanggal_sidang", "ruangan", "agenda"],
    editable: true,
  },
  {
    id: "akta-cerai",
    category: "notifikasi",
    title: "Notifikasi Akta Cerai",
    body:
      "Akta cerai untuk perkara {{nomor_perkara}} telah tersedia. Silakan mengikuti prosedur pengambilan pada layanan PTSP.",
    placeholders: ["nomor_perkara"],
    editable: true,
  },
  {
    id: "sisa-panjar",
    category: "notifikasi",
    title: "Notifikasi Sisa Panjar",
    body:
      "Informasi biaya perkara {{nomor_perkara}}: sisa panjar saat ini {{sisa_panjar}}. Mohon hubungi petugas bila memerlukan rincian.",
    placeholders: ["nomor_perkara", "sisa_panjar"],
    editable: true,
  },
  {
    id: "balasan-otomatis",
    category: "balasan",
    title: "Balasan Otomatis",
    body:
      "Halo, saya ALETA Bot. Ketik info lengkap, perkara, sidang hari ini, atau akta#nomor perkara untuk layanan informasi.",
    placeholders: [],
    editable: true,
  },
  {
    id: "fallback-error",
    category: "error",
    title: "Fallback Error",
    body: "Maaf, ALETA Bot belum dapat memproses permintaan tersebut. Silakan coba beberapa saat lagi.",
    placeholders: [],
    editable: true,
  },
  {
    id: "admin-test",
    category: "admin",
    title: "Pesan Admin Test",
    body: "Tes ALETA Bot berhasil pada {{waktu}}. Mode: {{mode}}.",
    placeholders: ["waktu", "mode"],
    editable: true,
  },
  {
    id: "pegawai-monitoring",
    category: "pegawai",
    title: "Notifikasi Pegawai / Monitoring",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\n{{judul_notifikasi}}\n\n{{ringkasan}}\n\nSumber: ALETA Bot.",
    placeholders: ["nama_pegawai", "judul_notifikasi", "ringkasan"],
    editable: true,
  },
  {
    id: "pihak-layanan",
    category: "pihak",
    title: "Notifikasi Pihak / Layanan Perkara",
    body:
      "Assalamu'alaikum {{nama_pihak}}.\n\nInformasi perkara {{nomor_perkara}}:\n{{ringkasan}}\n\nPesan otomatis ALETA Bot.",
    placeholders: ["nama_pihak", "nomor_perkara", "ringkasan"],
    editable: true,
  },
];

const DEFAULT_JOBS: Array<Omit<AletaBotJob, "lastRunAt" | "lastStatus" | "lastMessage" | "updatedAt">> = [
  {
    id: "ketua-penerimaan-perkara",
    name: "Rekap Penerimaan Perkara Ketua",
    description: "Diambil dari app.js sendKetuaPenerimaanPerkara dan notifikasi.getTotalPenerimaanPerkaraSemuaHakimLengkap.",
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
    description: "Diambil dari app.js sendPenjagaSidangHariIni dan notifikasi.getDataJadwalSidangPerdata.",
    enabled: false,
    scheduleCron: "10 07 * * Monday-Friday",
  },
  {
    id: "penjaga-sidang-besok",
    name: "Penjaga Sidang Besok",
    description: "Diambil dari app.js sendPenjagaSidangBesok dan notifikasi.getDataJadwalBesok.",
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
    description: "Diambil dari app.js sendMessageHariSidang dan notifikasi.getDataPihakHariSidang.",
    enabled: false,
    scheduleCron: "00 07 * * *",
  },
  {
    id: "pihak-sebelum-sidang",
    name: "Notifikasi Pihak Sebelum Sidang",
    description: "Diambil dari app.js sendMessageSebelumHariSidang dan notifikasi.getDataPihakSebelumHariSidang.",
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
    name: "legacy.notifikasi.ketuaPenerimaanPerkara",
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
    name: "legacy.notifikasi.paniteraMonitoringBulanan",
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
    name: "legacy.notifikasi.jadwalSidangInternal",
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
    name: "legacy.notifikasi.kasirPanjar",
    category: "employee",
    description: "Pengingat sisa panjar, meterai/redaksi, dan penetapan untuk kasir/PTSP.",
    sqlText: "legacy:notifikasi.getDataSisaPanjarPn,getDataMeteraiRedaksiPsp,getDataDaftarPenetapan",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan", "nomor_perkara", "sisa_panjar"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "legacy-status-sidang-pegawai",
    name: "legacy.notifikasi.statusSidangPegawai",
    category: "employee",
    description: "Status minutasi, upload putusan, antrian sidang, relaas, delegasi, dan panggilan untuk Hakim/Panitera/Jurusita.",
    sqlText:
      "legacy:notifikasi.getDataPutusanBelumMinutHakim,getDataUploadPutusanHakim,getDataLupaTundaHakim,getDataPutusanBelumMinutPanitera,getDataTundaMediasiPanitera,getDataAntrianSidangHakim,getDataAntrianSidangPanitera,getDataPutusJurusitaNew,getDataTundaJurusitaNew,getBelumPanggilanJurusita,getDataBelumDelegasiJurusita,getDataPemberitahuanPutusanBelumJurusita",
    outputColumns: ["nama_pegawai", "judul_notifikasi", "ringkasan", "nomor_perkara"],
    recipientColumn: "",
    isActive: true,
  },
  {
    id: "legacy-pihak-baru",
    name: "legacy.notifikasi.pihakBaru",
    category: "party",
    description: "Data pihak, kuasa, turut tergugat, dan intervensi untuk notifikasi perkara baru.",
    sqlText: "legacy:notifikasi.getDataPihakBaru",
    outputColumns: ["nama_pihak", "nomor_perkara", "ringkasan", "telepon", "nomor_hp", "perkara_id"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-hari-sidang",
    name: "legacy.notifikasi.pihakHariSidang",
    category: "party",
    description: "Pengingat hari sidang untuk pihak/kuasa/turut/intervensi.",
    sqlText: "legacy:notifikasi.getDataPihakHariSidang",
    outputColumns: ["nama_pihak", "nomor_perkara", "tanggal_sidang", "agenda", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-sebelum-sidang",
    name: "legacy.notifikasi.pihakSebelumHariSidang",
    category: "party",
    description: "Pengingat sebelum hari sidang untuk pihak perkara.",
    sqlText: "legacy:notifikasi.getDataPihakSebelumHariSidang",
    outputColumns: ["nama_pihak", "nomor_perkara", "tanggal_sidang", "agenda", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-tunda-cuti",
    name: "legacy.notifikasi.pihakTundaCuti",
    category: "party",
    description: "Notifikasi penundaan sidang/cuti.",
    sqlText: "legacy:notifikasi.getDataPihakTundaCuti",
    outputColumns: ["nama_pihak", "nomor_perkara", "tanggal_sidang", "agenda", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-akta-cerai",
    name: "legacy.notifikasi.pihakAktaCerai",
    category: "party",
    description: "Notifikasi akta cerai untuk Penggugat/Pemohon dan Tergugat/Termohon.",
    sqlText: "legacy:notifikasi.getDataPihakAktaCerai",
    outputColumns: ["nama_pihak", "nomor_perkara", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-sisa-panjar",
    name: "legacy.notifikasi.pihakSisaPanjar",
    category: "party",
    description: "Notifikasi sisa panjar atau kekurangan biaya perkara.",
    sqlText: "legacy:notifikasi.getDataPihakSisaPanjar,getDataHabisBiaya",
    outputColumns: ["nama_pihak", "nomor_perkara", "sisa_panjar", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-pihak-putusan",
    name: "legacy.notifikasi.pihakPutusan",
    category: "party",
    description: "Notifikasi putusan kepada pihak/kuasa/turut/intervensi.",
    sqlText: "legacy:notifikasi.getDataPutusanPihak",
    outputColumns: ["nama_pihak", "nomor_perkara", "ringkasan", "telepon", "nomor_hp"],
    recipientColumn: "telepon",
    isActive: true,
  },
  {
    id: "legacy-query-command-router",
    name: "legacy.query.commandRouter",
    category: "system",
    description: "Router command chat publik dari query.js, dipakai untuk balasan otomatis.",
    sqlText: "legacy:query.getData",
    outputColumns: ["command", "nomor_perkara", "response_text"],
    recipientColumn: "",
    isActive: true,
  },
];

const DEFAULT_NOTIFICATIONS: Array<
  Omit<AletaBotNotification, "lastRunAt" | "lastStatus" | "lastMessage" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt">
> = [
  {
    id: "ketua-penerimaan-perkara",
    name: "Rekap Penerimaan Perkara Ketua",
    category: "employee",
    description: "Notifikasi internal Ketua dari sendKetuaPenerimaanPerkara pada app.js.",
    queryId: "legacy-ketua-penerimaan-perkara",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { roleHints: ["ketua"], source: "users.whatsapp_number" },
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
    recipientMapping: { roleHints: ["panitera"], source: "users.whatsapp_number" },
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
    recipientMapping: { positionHints: ["sidang", "ptsp"], source: "users.whatsapp_number" },
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
    recipientMapping: { positionHints: ["sidang", "ptsp"], source: "users.whatsapp_number" },
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
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { positionHints: ["kasir", "ptsp"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "30 14 * * Monday-Thursday", trigger: "cron siang" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "hakim-jadwal-sidang",
    name: "Pengingat Hakim",
    category: "employee",
    description: "Jadwal sidang/mediasi dan status minutasi/upload putusan untuk Hakim.",
    queryId: "legacy-status-sidang-pegawai",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { roleHints: ["hakim"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "15 07 * * Monday-Friday; 00 20 * * Sunday-Thursday", trigger: "cron pagi dan malam" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "panitera-jadwal-sidang",
    name: "Pengingat Panitera Sidang",
    category: "employee",
    description: "Jadwal sidang, tunda mediasi, BAS, dan minutasi untuk Panitera/Panitera Pengganti.",
    queryId: "legacy-status-sidang-pegawai",
    templateId: "pegawai-monitoring",
    recipientSource: "users",
    recipientMapping: { roleHints: ["panitera"], source: "users.whatsapp_number" },
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
    recipientMapping: { roleHints: ["jurusita"], source: "users.whatsapp_number" },
    scheduleConfig: { type: "cron", cron: "00 12 * * Monday-Friday; 15 16 * * Monday-Friday; 00 09 * * Friday", trigger: "cron status dan relaas" },
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
    recipientMapping: { recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
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
    recipientMapping: { recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "cron", cron: "00 07 * * *", trigger: "cron pagi" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-sebelum-sidang",
    name: "Notifikasi Pihak Sebelum Sidang",
    category: "party",
    description: "Pengingat kepada pihak perkara sebelum jadwal sidang.",
    queryId: "legacy-pihak-sebelum-sidang",
    templateId: "jadwal-sidang",
    recipientSource: "query",
    recipientMapping: { recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "cron", cron: "00 09 * * *", trigger: "cron pagi" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
  {
    id: "pihak-tunda-cuti",
    name: "Notifikasi Tunda/Cuti",
    category: "party",
    description: "Notifikasi penundaan sidang karena cuti atau jadwal khusus.",
    queryId: "legacy-pihak-tunda-cuti",
    templateId: "pihak-layanan",
    recipientSource: "query",
    recipientMapping: { recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "cron", cron: "00 12 24 11 *", trigger: "cron khusus" },
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
    recipientMapping: { recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
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
    recipientMapping: { recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "cron", cron: "00 19 * * *; 30 15 * * *", trigger: "cron sore" },
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
    recipientMapping: { recipientColumn: "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp"] },
    scheduleConfig: { type: "manual", cron: "", trigger: "manual/legacy app.js" },
    isActive: false,
    delayMs: 1500,
    retryLimit: 2,
  },
];

export const ALETA_BOT_QUERY_CATALOG: AletaBotQueryCatalogItem[] = [
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

function normalizeWhatsappNumber(input: string) {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
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

function defaultConnectionKeyForQuery(query: Pick<AletaBotQuery, "id" | "sqlText"> | { id: string; sqlText: string }) {
  const text = `${query.id} ${query.sqlText}`.toLowerCase();
  if (text.includes("antrian")) return "antrian_sidang";
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
    throw new ApiError(400, "SQL/query tidak boleh kosong.");
  }
  if (trimmed.startsWith("legacy:")) return trimmed;

  if (/;/.test(trimmed)) {
    throw new ApiError(400, "Query dari UI tidak boleh memakai multiple statement atau tanda titik koma.");
  }
  if (/(--|#|\/\*|\*\/)/.test(trimmed)) {
    throw new ApiError(400, "Query dari UI tidak boleh memakai komentar SQL.");
  }

  const normalized = trimmed.replace(/\s+/g, " ").trim();
  if (!/^select\b/i.test(normalized)) {
    throw new ApiError(400, "Query dari UI hanya boleh berupa SELECT atau referensi legacy:.");
  }
  if (/\b(insert|update|delete|drop|alter|truncate|create|replace|grant|revoke|exec|execute|call|copy)\b/i.test(normalized)) {
    throw new ApiError(400, "Query mengandung perintah berbahaya dan diblokir.");
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

function mapSettings(row: SettingsRow): AletaBotSettings {
  return {
    botEnabled: Boolean(row.bot_enabled),
    notificationsEnabled: Boolean(row.notifications_enabled),
    adminWhatsappNumber: row.admin_whatsapp_number,
    messageDelayMs: row.message_delay_ms,
    retryLimit: row.retry_limit,
    dryRunEnabled: Boolean(row.dry_run_enabled),
    scheduleCron: row.schedule_cron,
    testTargetNumber: row.test_target_number,
    securityNotes: row.security_notes,
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
    passwordConfigured: Boolean(row.password_env_key && process.env[row.password_env_key]),
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
    errorMessage: row.error_message,
    sentAt: row.sent_at,
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
    createdAt: row.created_at,
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

async function buildAletaBotAiConfigPayload(db: AletaDatabase) {
  const aiConfig = await getAISettingsFromDb(db, { includeSecrets: true });
  const activeConnection = resolveActiveAiConnection(aiConfig);
  const providerId = activeConnection?.providerId ?? aiConfig.providerId;
  const modelId = activeConnection?.modelId ?? aiConfig.modelId;
  const apiKey = activeConnection?.apiKey ?? "";
  const enabled = Boolean(aiConfig.enabled && activeConnection);

  return {
    enabled,
    publicQaEnabled: enabled,
    publicQaAiAnswerEnabled: enabled,
    provider: mapPortalProviderToBot(providerId),
    providerId,
    model: modelId,
    modelId,
    endpointUrl: activeConnection?.endpointUrl ?? "",
    apiKey,
    apiKeyConfigured: Boolean(apiKey),
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
    syncedAt: new Date().toISOString(),
  };
}

async function callAletaBotRuntime<T>(pathname: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(getAletaBotRuntimeUrl(pathname), {
      cache: "no-store",
      ...init,
      headers: {
        ...getAletaBotInternalHeaders(),
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
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

async function ensureAletaBotSeeded(db: AletaDatabase) {
  const now = new Date().toISOString();
  await db.exec(`CREATE TABLE IF NOT EXISTS aleta_bot_db_connections (
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
  await db.exec(`ALTER TABLE aleta_bot_queries ADD COLUMN IF NOT EXISTS connection_key TEXT NOT NULL DEFAULT 'sipp_primary'`);
  await db.exec(`CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_intents (
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
  await db.exec(`CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_logs (
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
    created_at TEXT NOT NULL
  )`);
  await db.exec(`CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_examples (
    id TEXT PRIMARY KEY,
    intent_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    normalized_question TEXT NOT NULL DEFAULT '',
    is_active SMALLINT NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  await db.exec(`CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_sessions (
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
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS requires_approval_before_active SMALLINT NOT NULL DEFAULT 1`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS approved_by TEXT`);
  await db.exec(`ALTER TABLE aleta_bot_public_qa_intents ADD COLUMN IF NOT EXISTS approved_at TEXT`);
  await db.exec(`CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_intent_versions (
    id TEXT PRIMARY KEY,
    intent_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    snapshot_json TEXT NOT NULL DEFAULT '{}',
    change_note TEXT NOT NULL DEFAULT '',
    created_by TEXT,
    created_at TEXT NOT NULL
  )`);
  await db.exec(`CREATE TABLE IF NOT EXISTS aleta_bot_public_qa_ai_logs (
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
  await db.exec(`CREATE TABLE IF NOT EXISTS aleta_bot_approval_requests (
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
  await db.exec(`CREATE TABLE IF NOT EXISTS aleta_bot_legacy_migrations (
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
    try { await db.exec(`ALTER TABLE aleta_bot_legacy_migrations ADD COLUMN ${col}`); } catch { /* column already exists */ }
  }

  const settings = await db.prepare(`SELECT id FROM aleta_bot_settings WHERE id = 1`).get<{ id: number }>();
  if (!settings) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_settings (
          id, bot_enabled, notifications_enabled, admin_whatsapp_number, message_delay_ms,
          retry_limit, dry_run_enabled, schedule_cron, test_target_number, security_notes, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  }

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
        query.name,
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
  }

  for (const connection of DEFAULT_DB_CONNECTIONS) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_db_connections (
          id, key, name, description, driver, host, port, database_name, username,
          password_env_key, ssl_enabled, connection_timeout_ms, is_active, is_default,
          legacy_source, last_test_status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?)
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

  for (const notification of DEFAULT_NOTIFICATIONS) {
    await db
      .prepare(
        `INSERT INTO aleta_bot_notifications (
          id, name, category, description, query_id, template_id, recipient_source,
          recipient_mapping_json, schedule_config_json, is_active, delay_ms, retry_limit,
          last_status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?)
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
        notification.delayMs,
        notification.retryLimit,
        now,
        now
      );
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
  await requireSuperAdmin(db, actorUserId);
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
  if (!key) throw new ApiError(400, "Key intent wajib diisi.");
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
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 'draft', NULL, NULL, ?, ?, ?, ?)
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

    // ── Duplicate-path guard ─────────────────────────────────────────────────
    // For notification types: block activation if the same legacy key is still
    // live (i.e., NOT yet disabled in another legacy_disabled migration row).
    if (migration.legacyType === "party_notification" || migration.legacyType === "employee_notification") {
      const alreadyDisabledRow = await tx
        .prepare(
          `SELECT id FROM aleta_bot_legacy_migrations
           WHERE legacy_key = ? AND status = 'legacy_disabled' AND id != ? LIMIT 1`
        )
        .get<{ id: string }>(migration.legacyKey, migration.id);
      // There is no separate "disabled" row for this key — meaning the same key
      // is still live as legacy. Block to prevent dual-path delivery.
      if (!alreadyDisabledRow && migration.legacyKey) {
        throw new ApiError(
          400,
          `Duplicate path guard: legacy key "${migration.legacyKey}" masih aktif. ` +
          `Jalankan aksi "Disable Legacy" pada migrasi yang sama sebelum mengaktifkan registry.`
        );
      }
    }

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

export async function controlWorker(
  db: AletaDatabase,
  actorUserId: string,
  action: "pause" | "resume" | "status",
  reason?: string
): Promise<{ worker: AletaBotWorkerState | null; message: string }> {
  const actor = await requireSuperAdmin(db, actorUserId);
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
    message: result.data.worker.paused
      ? "Worker queue sedang dijeda."
      : result.data.worker.running
      ? "Worker queue sedang berjalan."
      : "Worker queue tidak aktif.",
  };
}

async function getDeadLettersFromGateway(limit = 50): Promise<AletaBotDeadLetter[]> {
  const result = await getGatewayDeadLetters(limit);
  if (!result.ok) return [];
  return result.data.items;
}

export async function resendDeadLetter(
  db: AletaDatabase,
  actorUserId: string,
  id: string
): Promise<{ originalId: string; newId: string; status: string }> {
  const actor = await requireSuperAdmin(db, actorUserId);
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
        retry_limit, dry_run_enabled, schedule_cron, test_target_number, security_notes, updated_at
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
        recipient_mapping_json, schedule_config_json, is_active, delay_ms, retry_limit,
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
          connection_key, is_active, last_tested_at, last_test_status, last_test_error, created_by, updated_by, created_at, updated_at
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
        password_env_key, ssl_enabled, connection_timeout_ms, is_active, is_default,
        legacy_source, last_test_status, last_test_error, last_test_at,
        created_by, updated_by, created_at, updated_at
       FROM aleta_bot_db_connections
       ORDER BY is_default DESC, name ASC`
    )
    .all<DbConnectionRow>();

  return rows.map(mapDbConnection);
}

async function getPublicQaIntents(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, key, name, description, category, audience, is_active, ai_enabled,
        exact_triggers_json, example_questions_json, required_parameters_json,
        query_key, legacy_handler, legacy_command, parameterized_legacy_command,
        template_key, response_mode, confidence_threshold, requires_verification,
        requires_case_number, max_attempts, fallback_message, risk_level, notes,
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
        response_preview, status, error_message, created_at
       FROM aleta_bot_public_qa_logs
       ORDER BY created_at DESC
       LIMIT 80`
    )
    .all<PublicQaLogRow>();
  return rows.map(mapPublicQaLog);
}

async function getUnknownQuestionReviews(db: AletaDatabase): Promise<AletaBotUnknownQuestionReview[]> {
  await ensureAletaBotSeeded(db);
  const logs = await getPublicQaLogs(db);
  const grouped = new Map<string, AletaBotUnknownQuestionReview>();
  for (const log of logs) {
    if (log.status !== "fallback" && log.status !== "error" && log.matchedMethod !== "fallback") continue;
    const normalized = (log.normalizedMessage || log.rawMessage || "").trim().toLowerCase();
    if (!normalized) continue;
    const suggestion = suggestIntentForQuestion(log.rawMessage || normalized);
    const existing = grouped.get(normalized);
    const senderMasked = maskExportPhone(log.senderNumber || "");
    if (existing) {
      existing.frequency += 1;
      if (log.createdAt > existing.lastAskedAt) {
        existing.lastAskedAt = log.createdAt;
        existing.rawMessage = log.rawMessage;
        existing.senderMasked = senderMasked;
        existing.fallbackReason = log.errorMessage || log.responsePreview || existing.fallbackReason;
      }
    } else {
      grouped.set(normalized, {
        normalizedMessage: normalized,
        rawMessage: log.rawMessage,
        frequency: 1,
        lastAskedAt: log.createdAt,
        senderMasked,
        fallbackReason: log.errorMessage || log.responsePreview || "Fallback / tidak dikenali.",
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
        positions.name AS position_name, users.whatsapp_number
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

async function getNotificationLogs(db: AletaDatabase) {
  await ensureAletaBotSeeded(db);
  const rows = await db
    .prepare(
      `SELECT id, notification_id, query_id, recipient_number, recipient_name, category,
        message_preview, status, error_message, sent_at, created_at
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

export async function getAletaBotSnapshot(db: AletaDatabase, actorUserId: string): Promise<AletaBotSnapshot> {
  await requireSuperAdmin(db, actorUserId);
  await ensureAletaBotSeeded(db);
  const runtimeMode = getWhatsappRuntimeMode();
  const [
    settings, templates, jobs, notifications, queries, dbConnections,
    publicQaIntents, publicQaLogs, unknownQuestionReviews, employeeRecipients, notificationLogs, logs,
    whatsappSnapshot, approvalRequests, legacyMigrations,
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
    runtimeMode === "aleta_bot" ? buildGatewayWhatsappSnapshot() : whatsappService.getGatewaySnapshot(),
    listApprovalRequests(db),
    getLegacyMigrations(db),
  ]);
  const metrics = await buildMetrics(db, jobs, templates);
  const workerState = runtimeMode === "aleta_bot" ? await getWorkerStateFromGateway() : null;
  const deadLetters = runtimeMode === "aleta_bot" ? await getDeadLettersFromGateway(50) : [];

  return {
    settings,
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
    notifications,
    queries,
    dbConnections,
    publicQaIntents,
    publicQaLogs,
    unknownQuestionReviews,
    employeeRecipients,
    notificationLogs,
    queryCatalog: ALETA_BOT_QUERY_CATALOG,
    logs,
    approvalRequests,
    deadLetters,
    workerState,
    legacyMigrations,
  };
}

function maskExportPhone(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 6) return "";
  return `${digits.slice(0, 4)}******${digits.slice(-2)}`;
}

export async function exportAletaBotConfig(
  db: AletaDatabase,
  actorUserId: string
) {
  const snapshot = await getAletaBotSnapshot(db, actorUserId);
  const exportedAt = new Date().toISOString();

  return {
    version: 1,
    exportedAt,
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
    approvalSummary: {
      total: snapshot.approvalRequests.length,
      pending: snapshot.approvalRequests.filter((item) => item.status === "pending").length,
      approved: snapshot.approvalRequests.filter((item) => item.status === "approved").length,
      rejected: snapshot.approvalRequests.filter((item) => item.status === "rejected").length,
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
  const [templates, notifications, queries, dbConnections, publicQaIntents, employeeRecipients, legacyMigrations] = await Promise.all([
    getTemplates(db),
    getNotifications(db),
    getQueries(db),
    getDbConnections(db),
    getPublicQaIntents(db),
    getEmployeeRecipients(db),
    getLegacyMigrations(db),
  ]);
  const disabledLegacyNotificationKeys = legacyMigrations
    .filter((item) => item.status === "legacy_disabled" && (item.legacyType === "party_notification" || item.legacyType === "employee_notification"))
    .map((item) => item.legacyKey || item.sourceFunction)
    .filter(Boolean);
  const disabledLegacyCommandKeys = legacyMigrations
    .filter((item) => item.status === "legacy_disabled" && (item.legacyType === "public_command" || item.legacyType === "admin_command"))
    .map((item) => item.legacyKey || item.sourceFunction)
    .filter(Boolean);
  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: "manajemen_surat",
    botEnabled: settings.botEnabled,
    notificationsEnabled: settings.notificationsEnabled,
    adminWhatsappNumber: settings.adminWhatsappNumber,
    adminWhatsappChatId: settings.adminWhatsappNumber ? `${settings.adminWhatsappNumber}@c.us` : "",
    messageDelayMs: settings.messageDelayMs,
    retryLimit: settings.retryLimit,
    dryRunEnabled: settings.dryRunEnabled,
    scheduleCron: settings.scheduleCron,
    testTargetNumber: settings.testTargetNumber,
    disabledLegacyKeys: [...disabledLegacyNotificationKeys, ...disabledLegacyCommandKeys],
    disabledLegacyNotificationKeys,
    disabledLegacyCommandKeys,
    templates,
    notifications: notifications.filter((notification) => notification.isActive),
    queries: queries.filter((query) => query.isActive),
    dbConnections: dbConnections.map((connection) => ({
      key: connection.key,
      name: connection.name,
      description: connection.description,
      driver: connection.driver,
      host: connection.host,
      port: connection.port,
      databaseName: connection.databaseName,
      username: connection.username,
      passwordEnvKey: connection.passwordEnvKey,
      sslEnabled: connection.sslEnabled,
      connectionTimeoutMs: connection.connectionTimeoutMs,
      isActive: connection.isActive,
      isDefault: connection.isDefault,
      legacySource: connection.legacySource,
      lastTestStatus: connection.lastTestStatus,
      lastTestError: connection.lastTestError,
      lastTestAt: connection.lastTestAt,
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
    employeeRecipients,
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

  await Promise.all(
    targets.map(async (targetPath) => {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    })
  );
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
      retryLimit:
        payload.retryLimit === undefined
          ? current.retryLimit
          : Math.min(10, Math.max(0, Number(payload.retryLimit))),
      scheduleCron:
        payload.scheduleCron === undefined ? current.scheduleCron : validateCronLike(payload.scheduleCron),
      securityNotes:
        payload.securityNotes === undefined ? current.securityNotes : payload.securityNotes.trim().slice(0, 800),
      updatedAt: new Date().toISOString(),
    };

    await tx
      .prepare(
        `UPDATE aleta_bot_settings
         SET bot_enabled = ?, notifications_enabled = ?, admin_whatsapp_number = ?,
           message_delay_ms = ?, retry_limit = ?, dry_run_enabled = ?, schedule_cron = ?,
           test_target_number = ?, security_notes = ?, updated_at = ?
         WHERE id = 1`
      )
      .run(
        nextSettings.botEnabled ? 1 : 0,
        nextSettings.notificationsEnabled ? 1 : 0,
        nextSettings.adminWhatsappNumber,
        nextSettings.messageDelayMs,
        nextSettings.retryLimit,
        nextSettings.dryRunEnabled ? 1 : 0,
        nextSettings.scheduleCron,
        nextSettings.testTargetNumber,
        nextSettings.securityNotes,
        nextSettings.updatedAt
      );

    await appendAletaBotLog(tx, {
      actorUserId: actor.id,
      level: "success",
      eventType: "settings",
      message: "Konfigurasi ALETA Bot diperbarui dari portal.",
      metadata: {
        botEnabled: nextSettings.botEnabled,
        notificationsEnabled: nextSettings.notificationsEnabled,
        dryRunEnabled: nextSettings.dryRunEnabled,
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
    await writeAletaBotRuntimeConfig(tx, nextSettings, whatsappSettings);

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
  const actor = await requireSuperAdmin(db, actorUserId);
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
  const actor = await requireSuperAdmin(db, actorUserId);
  const now = new Date().toISOString();
  const id = query.id?.trim() || (await nextPrefixedId(db, "aleta_bot_queries", "abq"));
  const name = query.name.trim();
  if (!name) throw new ApiError(400, "Nama query wajib diisi.");
  const category = query.category;
  if (!["employee", "party", "system"].includes(category)) throw new ApiError(400, "Kategori query tidak valid.");
  const sqlText = validateReadOnlyQuery(query.sqlText);
  const outputColumns = validateOutputColumns(parseColumns(query.outputColumns));
  if (outputColumns.length === 0) throw new ApiError(400, "Mapping kolom hasil query wajib diisi.");
  const recipientColumn = String(query.recipientColumn ?? "").trim();
  if (category === "party" && (!recipientColumn || !outputColumns.includes(recipientColumn))) {
    throw new ApiError(400, "Query kategori Pihak wajib memiliki kolom nomor tujuan yang ada di mapping kolom.");
  }
  const connectionKey = validateConnectionKey(query.connectionKey || "sipp_primary");

  return withTransaction(db, async (tx) => {
    await ensureAletaBotSeeded(tx);
    const duplicate = await tx
      .prepare(`SELECT id FROM aleta_bot_queries WHERE lower(name) = lower(?) AND id <> ?`)
      .get<{ id: string }>(name, id);
    if (duplicate) throw new ApiError(400, "Nama query ALETA Bot sudah dipakai.");

    const existing = await tx.prepare(`SELECT id FROM aleta_bot_queries WHERE id = ?`).get<{ id: string }>(id);
    const connection = (await getDbConnections(tx)).find((item) => item.key === connectionKey);
    if (!connection) throw new ApiError(400, "Connection key database tidak ditemukan.");
    if (!connection.isActive && query.isActive !== false) {
      throw new ApiError(400, "Query aktif tidak boleh memakai koneksi database yang nonaktif.");
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
  const actor = await requireSuperAdmin(db, actorUserId);
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
    if (!query) throw new ApiError(404, "Sumber query notifikasi tidak ditemukan.");
    if (!query.isActive && notification.isActive) throw new ApiError(400, "Query nonaktif tidak bisa dipakai oleh notifikasi aktif.");

    const template = (await getTemplates(tx)).find((item) => item.id === notification.templateId);
    if (!template) throw new ApiError(404, "Template notifikasi tidak ditemukan.");

    const placeholders = getTemplatePlaceholders(template.body);
    const allowedColumns = new Set([...query.outputColumns, "nama_pegawai", "judul_notifikasi", "ringkasan", "waktu", "mode"]);
    const missingPlaceholders = placeholders.filter((placeholder) => !allowedColumns.has(placeholder));
    if (missingPlaceholders.length > 0) {
      throw new ApiError(400, `Placeholder template tidak cocok dengan kolom query: ${missingPlaceholders.join(", ")}.`);
    }

    const recipientSource = notification.category === "employee" ? "users" : "query";
    if (notification.category === "party" && !query.recipientColumn) {
      throw new ApiError(400, "Notifikasi Pihak wajib memakai query dengan kolom nomor tujuan.");
    }
    if (notification.category === "employee") {
      const employeeRecipients = await getEmployeeRecipients(tx);
      if (employeeRecipients.length === 0 && notification.isActive) {
        throw new ApiError(400, "Tidak ada user aktif dengan nomor WhatsApp valid untuk notifikasi Pegawai.");
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

    const existing = await tx.prepare(`SELECT id FROM aleta_bot_notifications WHERE id = ?`).get<{ id: string }>(id);
    if (existing) {
      await tx
        .prepare(
          `UPDATE aleta_bot_notifications
           SET name = ?, category = ?, description = ?, query_id = ?, template_id = ?,
             recipient_source = ?, recipient_mapping_json = ?, schedule_config_json = ?,
             is_active = ?, delay_ms = ?, retry_limit = ?, updated_by = ?, updated_at = ?
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
            recipient_mapping_json, schedule_config_json, is_active, delay_ms, retry_limit,
            last_status, created_by, updated_by, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?)`
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
    connection: Partial<AletaBotDbConnection> & Pick<AletaBotDbConnection, "name" | "key" | "host" | "databaseName" | "username">;
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

  return withTransaction(db, async (tx) => {
    await ensureAletaBotSeeded(tx);
    const duplicate = await tx
      .prepare(`SELECT id FROM aleta_bot_db_connections WHERE lower(key) = lower(?) AND id <> ?`)
      .get<{ id: string }>(key, id);
    if (duplicate) throw new ApiError(400, "Connection key sudah dipakai.");

    if (connection.isDefault) {
      await tx.prepare(`UPDATE aleta_bot_db_connections SET is_default = 0, updated_at = ?`).run(now);
    }

    const existing = await tx.prepare(`SELECT id FROM aleta_bot_db_connections WHERE id = ?`).get<{ id: string }>(id);
    if (existing) {
      await tx
        .prepare(
          `UPDATE aleta_bot_db_connections
           SET key = ?, name = ?, description = ?, driver = ?, host = ?, port = ?,
             database_name = ?, username = ?, password_env_key = ?, ssl_enabled = ?,
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
            username, password_env_key, ssl_enabled, connection_timeout_ms,
            is_active, is_default, legacy_source, last_test_status,
            created_by, updated_by, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?, ?)`
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
      metadata: { connectionId: id, key, host, databaseName, passwordEnvKey: passwordEnvKey ? "configured" : "" },
    });
    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: existing ? "UPDATE_ALETA_BOT_DB_CONNECTION" : "CREATE_ALETA_BOT_DB_CONNECTION",
      entityType: "aleta_bot_db_connections",
      entityId: id,
      payload: { key, name, host, databaseName, username: maskValue(username), passwordEnvKey: passwordEnvKey ? "configured" : "" },
    });
    await writeAletaBotRuntimeConfig(tx, await getAletaBotSettings(tx), await getWhatsAppSettingsFromDb(tx));
    return getAletaBotSnapshot(tx, actor.id);
  });
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
  if (!name) throw new ApiError(400, "Nama intent wajib diisi.");
  const category = intent.category;
  if (!["informasi_umum", "status_perkara", "jadwal_sidang", "biaya_panjar", "akta_cerai", "layanan", "pengaduan", "ecourt", "fallback"].includes(category)) {
    throw new ApiError(400, "Kategori intent Pertanyaan Para Pihak tidak valid.");
  }
  const audience = intent.audience;
  if (!["party", "public", "employee", "admin"].includes(audience)) throw new ApiError(400, "Audience intent tidak valid.");
  const responseMode = intent.responseMode;
  if (!["static_template", "query_template", "legacy_handler", "ai_guided_template", "fallback"].includes(responseMode)) {
    throw new ApiError(400, "Response mode intent tidak valid.");
  }
  if (["employee", "admin"].includes(audience) && intent.isActive) {
    throw new ApiError(400, "Tab Pertanyaan Para Pihak tidak boleh mengaktifkan intent internal pegawai/admin.");
  }
  const exactTriggers = parseListInput(intent.exactTriggers);
  const exampleQuestions = parseListInput(intent.exampleQuestions);
  if (intent.aiEnabled && exampleQuestions.length === 0) {
    throw new ApiError(400, "AI matcher tidak boleh aktif tanpa contoh pertanyaan.");
  }
  const requiredParameters = parseListInput(intent.requiredParameters);
  const confidenceThreshold = Math.max(0.4, Math.min(1, Number(intent.confidenceThreshold || 0.7)));
  const riskLevel = intent.riskLevel;
  if (!["low", "medium", "high"].includes(riskLevel)) throw new ApiError(400, "Risk level intent tidak valid.");
  const fallbackMessage = String(intent.fallbackMessage || PUBLIC_QA_FALLBACK_MESSAGE).trim();
  if (!fallbackMessage) throw new ApiError(400, "Fallback message wajib diisi.");
  const queryKey = String(intent.queryKey || "").trim();
  if (queryKey && !(await getQueries(db)).some((query) => query.id === queryKey || query.name === queryKey)) {
    throw new ApiError(400, "Query mapping intent tidak ditemukan di registry query.");
  }
  const legacyHandler = String(intent.legacyHandler || "").trim();
  const legacyCommand = String(intent.legacyCommand || "").trim();
  const parameterizedLegacyCommand = String(intent.parameterizedLegacyCommand || "").trim();
  if (["query_template", "legacy_handler"].includes(responseMode) && !queryKey && !legacyHandler && !legacyCommand) {
    throw new ApiError(400, "Intent dinamis wajib punya query mapping atau legacy handler.");
  }
  const aiAnswerMode = String(intent.aiAnswerMode || "off") as AletaBotPublicQaIntent["aiAnswerMode"];
  if (!["off", "template_only", "template_rewrite", "query_summarize", "guided_answer"].includes(aiAnswerMode)) {
    throw new ApiError(400, "AI answer mode tidak valid.");
  }
  const answerPolicy = String(intent.answerPolicy || "public_info_only") as AletaBotPublicQaIntent["answerPolicy"];
  if (!["public_info_only", "case_status_limited", "requires_verified_party", "admin_only"].includes(answerPolicy)) {
    throw new ApiError(400, "Answer policy tidak valid.");
  }
  const verificationPolicy = String(intent.verificationPolicy || "none") as AletaBotPublicQaIntent["verificationPolicy"];
  if (!["none", "case_number_only", "phone_match", "case_number_and_phone", "manual_ptsp"].includes(verificationPolicy)) {
    throw new ApiError(400, "Verification policy tidak valid.");
  }
  const allowedDataFields = parseListInput(intent.allowedDataFields);
  const blockedDataFields = parseListInput(intent.blockedDataFields);
  const aiSystemPrompt = String(intent.aiSystemPrompt || "").trim();
  const aiUserPromptTemplate = String(intent.aiUserPromptTemplate || "").trim();
  const aiAnswerEnabled = Boolean(intent.aiAnswerEnabled);
  if (aiAnswerEnabled && aiAnswerMode !== "off" && !fallbackMessage) {
    throw new ApiError(400, "Fallback message wajib ada sebelum AI answer aktif.");
  }
  if (aiAnswerEnabled && aiAnswerMode !== "off" && exampleQuestions.length === 0) {
    throw new ApiError(400, "AI answer tidak boleh aktif tanpa contoh pertanyaan.");
  }
  const status = (intent.status || (riskLevel === "high" ? "draft" : "active")) as AletaBotPublicQaIntent["status"];
  if (!["draft", "active", "archived"].includes(status)) throw new ApiError(400, "Status intent tidak valid.");
  const requiresApprovalBeforeActive = intent.requiresApprovalBeforeActive !== false;
  const maxAiTokens = Math.max(100, Math.min(1200, Number(intent.maxAiTokens || 400)));
  const temperature = Math.max(0, Math.min(0.7, Number(intent.temperature ?? 0.2)));

  return withTransaction(db, async (tx) => {
    await ensureAletaBotSeeded(tx);
    const duplicate = await tx
      .prepare(`SELECT id FROM aleta_bot_public_qa_intents WHERE lower(key) = lower(?) AND id <> ?`)
      .get<{ id: string }>(key, id);
    if (duplicate) throw new ApiError(400, "Key intent Pertanyaan Para Pihak sudah dipakai.");

    const existing = await tx.prepare(`SELECT * FROM aleta_bot_public_qa_intents WHERE id = ?`).get<PublicQaIntentRow>(id);
    const isActive = riskLevel === "high" || status !== "active" ? false : intent.isActive !== false;
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
             requires_case_number = ?, max_attempts = ?, fallback_message = ?, risk_level = ?,
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
            requires_case_number, max_attempts, fallback_message, risk_level, notes,
            ai_answer_enabled, ai_answer_mode, answer_policy, verification_policy,
            allowed_data_fields_json, blocked_data_fields_json, ai_system_prompt,
            ai_user_prompt_template, max_ai_tokens, temperature,
            requires_approval_before_active, version, status, approved_by, approved_at,
            created_by, updated_by, created_at, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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

function renderTemplate(template: AletaBotTemplate, values: Record<string, string>) {
  const missing = getTemplatePlaceholders(template.body).filter((key) => values[key] === undefined || values[key] === null);
  if (missing.length > 0) {
    throw new ApiError(400, `Preview template gagal karena data contoh tidak memiliki placeholder: ${missing.join(", ")}.`);
  }
  return template.body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => values[key] ?? "");
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
  const actor = await requireSuperAdmin(db, actorUserId);
  const settings = await getAletaBotSettings(db);

  if (action === "sync-config") {
    await writeAletaBotRuntimeConfig(db, settings, await getWhatsAppSettingsFromDb(db));
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "success",
      eventType: "settings",
      message: "Runtime config ALETA Bot disinkronkan ke file bridge.",
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
    if (waRuntimeMode !== "aleta_bot") {
      void whatsappService.initialize();
    }
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "info",
      eventType: "connection",
      message:
        waRuntimeMode === "aleta_bot"
          ? "Reconnect diabaikan: sesi WhatsApp dikelola oleh aleta_bot gateway."
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
      agenda: "Mediasi",
      hari_sidang: "Senin",
      tanggal_sidang: "27-04-2026",
      ruangan: "Ruang Sidang 1",
      sisa_panjar: "Rp125.000",
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
      return getAletaBotSnapshot(db, actor.id);
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
      priority: 5,
      category: "employee",
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
    return getAletaBotSnapshot(db, actor.id);
  }

  if (action === "test-query") {
    const queryId = String(payload?.queryId ?? "");
    const savedQuery = (await getQueries(db)).find((query) => query.id === queryId);
    if (savedQuery) {
      const now = new Date().toISOString();
      const previewPayload = summarizeQueryPreview(savedQuery);
      await db
        .prepare(
          `UPDATE aleta_bot_queries
           SET last_tested_at = ?, last_test_status = 'success', last_test_error = NULL
           WHERE id = ?`
        )
        .run(now, savedQuery.id);
      await appendAletaBotLog(db, {
        actorUserId: actor.id,
        level: "success",
        eventType: "query",
        message: `Test query ${savedQuery.name} berhasil secara terbatas.`,
        metadata: { queryId, preview: previewPayload },
      });
      const snapshot = await getAletaBotSnapshot(db, actor.id);
      return { ...snapshot, preview: JSON.stringify(previewPayload, null, 2) };
    }

    const item = ALETA_BOT_QUERY_CATALOG.find((query) => query.id === queryId);
    if (!item) {
      throw new ApiError(404, "Query ALETA Bot tidak ditemukan.");
    }
    if (!item.testable) {
      await appendAletaBotLog(db, {
        actorUserId: actor.id,
        level: "warning",
        eventType: "query",
        message: "Test query diblokir karena query membaca database produksi SIPP/MIS.",
        metadata: { queryId, sourceFile: item.sourceFile },
      });
      const snapshot = await getAletaBotSnapshot(db, actor.id);
      return {
        ...snapshot,
        preview: "Query ini terdaftar, tetapi eksekusi live diblokir di portal demi keamanan data produksi.",
      };
    }
    await appendAletaBotLog(db, {
      actorUserId: actor.id,
      level: "success",
      eventType: "query",
      message: "Test query/utility ringan berhasil.",
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
    if (!query) throw new ApiError(404, "Query notifikasi tidak ditemukan.");
    const template = (await getTemplates(db)).find((item) => item.id === notification.templateId);
    if (!template) throw new ApiError(404, "Template notifikasi tidak ditemukan.");

    const sample = makeSampleRow(query.outputColumns);
    sample.nama_pegawai = "Contoh Pegawai";
    sample.judul_notifikasi = notification.name;
    sample.ringkasan = notification.description || "Simulasi notifikasi ALETA Bot";
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
          message_preview, status, error_message, sent_at, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
