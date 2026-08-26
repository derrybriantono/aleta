"use client";

import {
  ArrowUpDown,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  MessageCircleMore,
  Play,
  Power,
  RefreshCcw,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
  TerminalSquare,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import React, { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AletaBotAntrianOnlinePanel } from "@/components/portal/aleta-bot-antrian-online";
import { AletaBotEcourtPanel } from "@/components/portal/aleta-bot-ecourt";
import { AletaBotManualSendPanel } from "@/components/portal/aleta-bot-manual-send";
import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreatableMultiSelect } from "@/components/ui/creatable-multi-select";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type AletaBotApprovalRequest,
  type AletaBotDispositionReminderRun,
  type AletaBotDeadlineReminderDryRunResult,
  type AletaBotDeadLetter,
  type AletaBotEmployeeRecipient,
  type AletaBotLegacyMigration,
  type AletaBotNotification,
  type AletaBotNotificationCategory,
  type AletaBotDbConnection,
  type AletaBotPublicQaIntent,
  type AletaBotQuery,
  type AletaBotQueryCategory,
  type AletaBotSendingRiskPreset,
  type AletaBotSnapshot,
  type AletaBotTemplate,
  type AletaBotUnknownQuestionReview,
  type AletaBotWorkerState,
} from "@/lib/aleta-bot-types";
import {
  ALETA_BOT_VARIABLE_CATEGORY_LABELS,
  type AletaBotVariableCategory,
  type AletaBotVariableDoc,
  describeAletaBotVariable,
  isKnownAletaBotVariable,
  listAletaBotVariableDocs,
} from "@/lib/aleta-bot-variable-catalog";
import { findNotificationsOutsideSendingWindow, formatHoursLabel } from "@/lib/aleta-bot-sending-schedule";
import { lintTemplateBody, summarizeWarnings } from "@/lib/aleta-bot-message-linter";
import { apiPath } from "@/lib/base-path";
import { usePortal } from "@/lib/app-state";
import { getEffectiveRoleId } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { humanizeErrorMessage, humanizeStatus } from "@/lib/humanized-labels";
import { getAdditionalRoleLabel } from "@/lib/user-additional-roles";
import { cn } from "@/lib/utils";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  message?: string;
  error?: {
    message?: string;
  };
};

type AletaBotActionResult = {
  status?: string;
  queueId?: number | string;
  duplicate?: boolean;
  idempotencyKey?: string;
  dryRun?: boolean;
  sent?: boolean;
  queueProgress?: {
    queueId?: number | string;
    stage?: "queued" | "sending" | "done" | "failed" | "unknown" | string;
    status?: string;
    position?: number | null;
    pendingAhead?: number | null;
    estimatedWaitMs?: number | null;
    estimatedWaitText?: string | null;
  };
  message?: string;
};

type RuntimeDashboardSnapshot = {
  online: boolean;
  fetchedAt: string;
  statusCode: number;
  errorMessage?: string;
  autoSync?: {
    attempted: boolean;
    ok: boolean;
    message: string;
  } | null;
  queueMonitoring?: {
    pending: number;
    processing: number;
    sentToday: number;
    failedToday: number;
    deadLetters: number;
    stalePending: number;
    oldestPendingAt: string | null;
    lastSentAt: string | null;
    lastCreatedAt: string | null;
    health: "normal" | "warning" | "blocked";
    alerts: Array<{ key: string; label: string; severity: "warning" | "critical" }>;
  };
  payload?: {
    whatsapp?: {
      status?: string;
      lastReadyAt?: string | null;
      lastErrorMessage?: string;
      lastErrorType?: string;
      sessionStartedAt?: string | null;
      lastMessageSentAt?: string | null;
      sessionAgeHours?: number | null;
      authFailureCount?: number;
      lastAuthFailureAt?: string | null;
    };
    bot?: {
      botEnabled?: boolean;
      notificationsEnabled?: boolean;
      dryRunEnabled?: boolean;
      messageDelayMs?: number;
      retryLimit?: number;
      sendingWindow?: {
        enabled?: boolean;
        start?: string;
        end?: string;
        inside?: boolean;
        allowed?: boolean;
        message?: string;
      };
    };
    db?: {
      schemaReady?: boolean;
      lastError?: string;
    };
    worker?: {
      enabled?: boolean;
      activeTimer?: boolean;
      lastHeartbeatAt?: string | null;
      lastBatchProcessed?: number;
      lastError?: string;
    };
    queue?: Record<string, number>;
    registry?: {
      total?: number;
      active?: number;
      dryRun?: number;
      requiresApproval?: number;
      skippedPolicy?: number;
      policySkipStats?: {
        skippedCount?: number;
        totalToday?: number;
        lastSkippedAt?: string | null;
        reasons?: Record<string, number>;
        topNotifications?: Array<{ notificationKey: string; count: number }>;
        recent?: Array<{ notification_key?: string; reason?: string; created_at?: string }>;
      };
    };
    whatsappNumberResolver?: {
      portalRecipientCount?: number;
      legacyFallbackUsedCount?: number;
      lastLegacyFallbackUsedAt?: string | null;
      legacyFallbackLabels?: Record<string, number>;
    };
    publicQa?: {
      total?: number;
      active?: number;
      aiEnabled?: number;
      aiAnswerEnabled?: number;
      mediumOrHighRisk?: number;
      stats?: {
        totalToday?: number;
        fallbackToday?: number;
        errorToday?: number;
      };
      recentLogs?: Array<{
        id: string;
        raw_message?: string;
        matched_intent_key?: string;
        matched_method?: string;
        confidence?: number;
        response_preview?: string;
        status?: string;
        created_at?: string;
      }>;
    };
    aiRuntime?: {
      status?: string;
      message?: string;
      enabled?: boolean;
      publicQaEnabled?: boolean;
      publicQaAiAnswerEnabled?: boolean;
      provider?: string;
      model?: string;
      apiKeyConfigured?: boolean;
      apiKeyMasked?: string;
      apiKeyEnvKey?: string;
      secretPersistence?: string;
      productionRequiresEnvSecret?: boolean;
      configSource?: string;
      syncedAt?: string | null;
      lastSyncStatus?: string;
      lastSyncError?: string;
      lastTestStatus?: string;
      lastTestError?: string;
      lastTestAt?: string | null;
    };
    messageStatsToday?: Record<string, number>;
    systemStatsToday?: Record<string, number>;
  } | null;
  tokenHealth?: {
    status?: string;
    message?: string;
    portalTokenConfigured?: boolean;
    botTokenConfigured?: boolean | null;
    fingerprintMatched?: boolean;
    statusCode?: number;
    checklist?: string[];
  };
};

type WhatsappReportSummary = {
  generatedAt: string;
  range: {
    key: string;
    label: string;
    from: string | null;
    to: string;
  };
  status: string;
  source: {
    key: string;
    label: string;
  };
  availableRanges: Array<{ key: string; label: string; minutes: number | null }>;
  availableSources: Array<{ key: string; label: string }>;
  stats: {
    total: number;
    sent: number;
    failed: number;
    simulated: number;
    pending: number;
    successRate: number;
    byStatus: Array<[string, number]>;
    byApp: Array<[string, number]>;
    byFeature: Array<[string, number]>;
    byCategory: Array<[string, number]>;
    topErrors: Array<[string, number]>;
    dailyTrend: Array<{ date: string; total: number; sent: number; failed: number }>;
  };
  rows: Array<{
    id: string;
    createdAt: string;
    sentAt: string;
    statusLabel: string;
    recipientName: string;
    recipientNumber: string;
    categoryLabel: string;
    sourceAppLabel: string;
    sourceFeatureLabel: string;
    caseOrPosition: string;
    messagePreview: string;
    errorMessage: string;
  }>;
};

type WhatsappReportRow = WhatsappReportSummary["rows"][number];
type ReportTableSortKey =
  | "createdAt"
  | "statusLabel"
  | "recipientName"
  | "recipientNumber"
  | "sourceAppLabel"
  | "sourceFeatureLabel"
  | "caseOrPosition"
  | "messagePreview";
type ReportTableSortDirection = "asc" | "desc";

const REPORT_TABLE_SORT_OPTIONS: Array<{ key: ReportTableSortKey; label: string }> = [
  { key: "createdAt", label: "Waktu" },
  { key: "statusLabel", label: "Status" },
  { key: "recipientName", label: "Penerima" },
  { key: "recipientNumber", label: "Nomor" },
  { key: "sourceAppLabel", label: "Aplikasi" },
  { key: "sourceFeatureLabel", label: "Fitur" },
  { key: "caseOrPosition", label: "Data" },
  { key: "messagePreview", label: "Isi Pesan" },
];

const WHATSAPP_REPORT_RANGE_OPTIONS = [
  ["5m", "5 menit"],
  ["10m", "10 menit"],
  ["30m", "30 menit"],
  ["1h", "1 jam"],
  ["6h", "6 jam"],
  ["12h", "12 jam"],
  ["1d", "1 hari"],
  ["3d", "3 hari"],
  ["7d", "7 hari"],
  ["14d", "2 minggu"],
  ["30d", "1 bulan"],
  ["90d", "3 bulan"],
  ["180d", "6 bulan"],
  ["365d", "1 tahun"],
  ["all", "Seluruh data"],
] as const;

const WHATSAPP_REPORT_STATUS_OPTIONS = [
  ["all", "Semua status"],
  ["sent", "Terkirim"],
  ["failed", "Gagal"],
  ["simulated", "Simulasi"],
  ["pending", "Menunggu/diproses"],
] as const;

const WHATSAPP_REPORT_SOURCE_OPTIONS = [
  ["all", "Semua aplikasi"],
  ["aleta_bot", "Notifikasi Perkara"],
  ["manajemen_surat", "Manajemen Surat"],
  ["e_kepegawaian", "E-Kepegawaian"],
] as const;

const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  notifikasi: "Pihak Perkara",
  balasan: "Balasan",
  error: "Error",
  admin: "Admin",
  pegawai: "Pegawai",
  employee: "Pegawai",
  pihak: "Pihak Perkara",
  party: "Pihak Perkara",
  dokumen_lampiran: "Dokumen / Lampiran",
  dokumen: "Dokumen / Lampiran",
  lampiran: "Dokumen / Lampiran",
  reminder_internal: "Reminder Internal",
  reminder: "Reminder Internal",
  manajemen_surat: "Manajemen Surat",
  publik: "Masyarakat Umum",
  instansi: "Instansi Mitra",
};

const TEMPLATE_CATEGORY_ALIASES: Record<string, string> = {
  employee: "pegawai",
  party: "pihak",
  notifikasi: "pihak",
  dokumen: "dokumen_lampiran",
  lampiran: "dokumen_lampiran",
  reminder: "reminder_internal",
};

const TEMPLATE_CATEGORY_ORDER = [
  "pihak",
  "pegawai",
  "instansi",
  "publik",
  "dokumen_lampiran",
  "reminder_internal",
  "manajemen_surat",
  "balasan",
  "admin",
  "error",
];

function normalizeTemplateCategory(category: string) {
  return TEMPLATE_CATEGORY_ALIASES[category] ?? category;
}

function formatTemplateCategory(category: string) {
  const normalized = normalizeTemplateCategory(category);
  return TEMPLATE_CATEGORY_LABELS[normalized] ?? normalized.replace(/_/g, " ");
}

function manualSendStepClass(state: "done" | "active" | "failed" | "pending") {
  if (state === "failed") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (state === "done") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (state === "active") return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  return "border-border bg-muted/20 text-muted-foreground";
}

function ManualSendProgressCard({ result }: { result: AletaBotActionResult | null }) {
  if (!result) return null;

  const progress = result.queueProgress;
  const stage = progress?.stage || result.status || "unknown";
  const failed = stage === "failed" || result.status === "failed" || result.status === "error";
  const done = stage === "done" || result.status === "sent" || result.status === "simulated" || result.sent === true;
  const sending = stage === "sending" || result.status === "processing";
  const queued = Boolean(progress || result.queueId || result.status === "enqueued" || result.status === "processing" || result.dryRun);
  const steps: Array<{ label: string; state: "done" | "active" | "failed" | "pending"; detail: string }> = [
    {
      label: "Masuk antrean",
      state: queued || done || failed ? "done" : "active",
      detail: progress?.position ? `Posisi ${progress.position}` : result.queueId ? `ID ${result.queueId}` : "Menunggu konfirmasi antrean",
    },
    {
      label: "Sedang dikirim",
      state: failed ? "pending" : done ? "done" : sending ? "active" : "pending",
      detail: progress?.pendingAhead && progress.pendingAhead > 0 ? `${progress.pendingAhead} pesan di depan` : "Diproses oleh Mesin Bot",
    },
    {
      label: "Berhasil / gagal",
      state: failed ? "failed" : done ? "done" : "pending",
      detail: failed ? "Gagal diproses" : done ? "Selesai diproses" : "Menunggu hasil akhir",
    },
  ];

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">Progres uji kirim</p>
          <p className="mt-1 text-xs text-muted-foreground">{result.message || "Status uji kirim sedang diperbarui."}</p>
        </div>
        <Badge variant={failed ? "danger" : done ? "success" : "muted"}>
          {progress?.estimatedWaitText ? `Estimasi ${progress.estimatedWaitText}` : "Estimasi diproses"}
        </Badge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((step) => (
          <div key={step.label} className={cn("rounded-lg border p-3", manualSendStepClass(step.state))}>
            <div className="flex items-center gap-2 font-semibold">
              {step.state === "failed" ? (
                <XCircle className="h-4 w-4" />
              ) : step.state === "active" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : step.state === "done" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <span className="h-4 w-4 rounded-full border border-current opacity-60" />
              )}
              {step.label}
            </div>
            <p className="mt-1 text-xs opacity-80">{step.detail}</p>
          </div>
        ))}
      </div>
      {result.idempotencyKey ? <p className="mt-3 break-all text-xs text-muted-foreground">Kunci kirim: {result.idempotencyKey}</p> : null}
    </div>
  );
}

function reportStatusKeyFromLabel(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("terkirim")) return "sent";
  if (normalized.includes("gagal")) return "failed";
  if (normalized.includes("simulasi")) return "simulated";
  if (normalized.includes("menunggu") || normalized.includes("diproses") || normalized.includes("antrean")) return "pending";
  return "all";
}

function reportSourceKeyFromLabel(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("kepegawaian")) return "e_kepegawaian";
  if (normalized.includes("manajemen surat")) return "manajemen_surat";
  if (normalized.includes("notifikasi perkara") || normalized.includes("aleta bot")) return "aleta_bot";
  return "all";
}

function reportRowSearchText(row: WhatsappReportRow) {
  return [
    row.createdAt,
    row.sentAt,
    row.statusLabel,
    row.recipientName,
    row.recipientNumber,
    row.categoryLabel,
    row.sourceAppLabel,
    row.sourceFeatureLabel,
    row.caseOrPosition,
    row.messagePreview,
    row.errorMessage,
  ].join(" ").toLowerCase();
}

function reportRowSortValue(row: WhatsappReportRow, sortKey: ReportTableSortKey) {
  if (sortKey === "createdAt") {
    const timestamp = new Date(row.createdAt || "").getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
  return String(row[sortKey] || "").toLowerCase();
}

function compareReportRows(a: WhatsappReportRow, b: WhatsappReportRow, sortKey: ReportTableSortKey, direction: ReportTableSortDirection) {
  const left = reportRowSortValue(a, sortKey);
  const right = reportRowSortValue(b, sortKey);
  const result = typeof left === "number" && typeof right === "number"
    ? left - right
    : String(left).localeCompare(String(right), "id-ID", { numeric: true, sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

function parseDownloadFilename(contentDisposition: string | null, fallback: string) {
  const match = contentDisposition?.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  const raw = match?.[1] || match?.[2];
  if (!raw) return fallback;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

type OperationalSmokeTestResult = {
  generatedAt: string;
  overallStatus: "passed" | "warning" | "failed";
  checks: Array<{
    key: string;
    label: string;
    status: "passed" | "warning" | "failed";
    detail: string;
  }>;
};

type NoticeState = {
  tone: "success" | "warning" | "danger" | "info";
  title: string;
  message: string;
  updatedAt: string;
};

type OperationFeedbackState = {
  phase: "loading" | "success" | "error";
  title: string;
  message: string;
  updatedAt: string;
};

const SIMPLE_MODE_TAB_VALUES = new Set(["dashboard", "connection", "public-qa", "antrian-online", "ecourt", "queue-recovery"]);

const emptySnapshot: AletaBotSnapshot = {
  settings: {
    botEnabled: false,
    notificationsEnabled: false,
    adminWhatsappNumber: "",
    messageDelayMs: 1500,
    sendingRiskLevel: 1,
    retryLimit: 2,
    dryRunEnabled: true,
    scheduleCron: "00 07 * * Monday-Friday",
    testTargetNumber: "",
    securityNotes: "",
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
    updatedAt: new Date(0).toISOString(),
  },
  sendingRiskPresets: [],
  runtimeState: "disabled",
  whatsapp: {
    runtimeStatus: "disconnected",
    internalStatus: "inactive",
    qrCode: null,
    linked: false,
    phoneNumber: "",
    sessionName: "aleta-session",
    savedStatus: "inactive",
    lastConnectedAt: null,
    lastErrorMessage: null,
  },
  metrics: {
    sentToday: 0,
    failedToday: 0,
    lastNotificationAt: null,
    activeJobs: 0,
    enabledTemplates: 0,
  },
  templates: [],
  jobs: [],
  notifications: [],
  queries: [],
  dbConnections: [],
  publicQaIntents: [],
  publicQaLogs: [],
  employeeRecipients: [],
  whatsappNumberCompleteness: {
    totalActiveUsers: 0,
    withWhatsapp: 0,
    missingWhatsapp: 0,
    coveragePercent: 0,
    importantMissing: [],
    roleBreakdown: [],
  },
  policySkipSummary: {
    totalToday: 0,
    totalAllTime: 0,
    lastSkippedAt: null,
    topReasons: [],
    topNotifications: [],
    recent: [],
  },
  deadlineReminderRuns: [],
  notificationLogs: [],
  queryCatalog: [],
  logs: [],
  approvalRequests: [],
  deadLetters: [],
  resolvedDeadLetters: [],
  workerState: null,
  legacyMigrations: [],
  unknownQuestionReviews: [],
};

type NotificationForm = {
  id: string;
  name: string;
  category: AletaBotNotificationCategory;
  description: string;
  queryId: string;
  templateId: string;
  recipientMapping: Record<string, unknown>;
  recipientRoleHints: string;
  recipientPositionHints: string;
  recipientNameHints: string;
  scheduleType: "cron" | "manual" | "event";
  scheduleCron: string;
  scheduleTrigger: string;
  isActive: boolean;
  attachDocument: boolean;
  delayMs: number;
  retryLimit: number;
};

type QueryForm = {
  id: string;
  name: string;
  category: AletaBotQueryCategory;
  description: string;
  sqlText: string;
  outputColumns: string;
  recipientColumn: string;
  connectionKey: string;
  isActive: boolean;
};

type DbConnectionForm = {
  id: string;
  key: string;
  name: string;
  description: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  passwordEnvKey: string;
  newPassword: string;
  sslEnabled: boolean;
  connectionTimeoutMs: number;
  isActive: boolean;
  isDefault: boolean;
  legacySource: string;
};

type PublicQaIntentForm = {
  id: string;
  key: string;
  name: string;
  description: string;
  category: AletaBotPublicQaIntent["category"];
  audience: AletaBotPublicQaIntent["audience"];
  isActive: boolean;
  aiEnabled: boolean;
  exactTriggers: string;
  exampleQuestions: string;
  requiredParameters: string;
  queryKey: string;
  legacyHandler: string;
  legacyCommand: string;
  parameterizedLegacyCommand: string;
  templateKey: string;
  responseMode: AletaBotPublicQaIntent["responseMode"];
  confidenceThreshold: number;
  requiresVerification: boolean;
  requiresCaseNumber: boolean;
  maxAttempts: number;
  fallbackMessage: string;
  answerTemplate: string;
  matchKeywords: string[];
  riskLevel: AletaBotPublicQaIntent["riskLevel"];
  notes: string;
  aiAnswerEnabled: boolean;
  aiAnswerMode: AletaBotPublicQaIntent["aiAnswerMode"];
  answerPolicy: AletaBotPublicQaIntent["answerPolicy"];
  verificationPolicy: AletaBotPublicQaIntent["verificationPolicy"];
  allowedDataFields: string;
  blockedDataFields: string;
  aiSystemPrompt: string;
  aiUserPromptTemplate: string;
  maxAiTokens: number;
  temperature: number;
  requiresApprovalBeforeActive: boolean;
  status: AletaBotPublicQaIntent["status"];
};

type AletaBotModal =
  | { type: "settings"; title: string }
  | { type: "template"; title: string; template: AletaBotTemplate }
  | { type: "notification"; title: string }
  | { type: "recipientPreview"; title: string }
  | { type: "deadlineReminderPreview"; title: string }
  | { type: "query"; title: string }
  | { type: "database"; title: string }
  | { type: "publicQa"; title: string }
  | { type: "publicQaReview"; title: string; review: AletaBotUnknownQuestionReview }
  | { type: "publicQaConvert"; title: string; review: AletaBotUnknownQuestionReview }
  | { type: "legacyAction"; title: string; migration: AletaBotLegacyMigration; action: LegacyMigrationAction };

type LegacyMigrationAction = "preview" | "convert" | "dry-run" | "submit-approval" | "activate" | "disable-legacy" | "rollback";
type RecipientPreviewResult = {
  totalEstimated: number;
  sampleSize: number;
  items: Array<{
    recipientName: string;
    recipientNumber: string;
    caseOrPosition: string;
    messagePreview: string;
    idempotencyKey: string;
    validNumber: boolean;
  }>;
  warnings: string[];
};
type ScheduleKind = "manual" | "event" | "daily" | "weekly" | "monthly" | "advanced";
type EmployeeNotificationAudienceGroup = "hakim" | "kepaniteraan" | "kesekretariatan";
type PartyNotificationAudienceGroup = "case_party" | "public_unregistered" | "external_agency";
type NotificationAudienceGroup = EmployeeNotificationAudienceGroup | PartyNotificationAudienceGroup;
type ParsedCronSchedule = {
  valid: boolean;
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  time: string;
};

const EMPLOYEE_NOTIFICATION_GROUP_OPTIONS: Array<{ value: EmployeeNotificationAudienceGroup; label: string; hint: string }> = [
  { value: "hakim", label: "Hakim", hint: "Untuk hakim atau majelis hakim yang terdaftar sebagai user aktif." },
  { value: "kepaniteraan", label: "Kepaniteraan", hint: "Untuk panitera, panitera pengganti, jurusita, kasir perkara, dan petugas teknis kepaniteraan." },
  { value: "kesekretariatan", label: "Kesekretariatan", hint: "Untuk unit umum, kepegawaian, perencanaan, IT, PTSP, dan petugas internal non-perkara." },
];

const PARTY_NOTIFICATION_GROUP_OPTIONS: Array<{ value: PartyNotificationAudienceGroup; label: string; hint: string }> = [
  { value: "case_party", label: "Para pihak berdasarkan perkara", hint: "Penerima diambil dari data perkara, kuasa, turut tergugat, intervensi, atau pihak terkait." },
  { value: "public_unregistered", label: "Pihak yang belum mendaftar", hint: "Untuk masyarakat umum yang bertanya layanan pengadilan tetapi belum terdaftar sebagai pihak perkara." },
  { value: "external_agency", label: "Instansi luar / kerja sama", hint: "Untuk KUA, Dukcapil, Kepolisian, Pemerintah, atau mitra layanan lain." },
];

const DEFAULT_NOTIFICATION_QUERY_BY_GROUP: Record<NotificationAudienceGroup, string> = {
  hakim: "legacy-status-sidang-pegawai",
  kepaniteraan: "legacy-panitera-monitoring-bulanan",
  kesekretariatan: "legacy-kasir-panjar",
  case_party: "legacy-pihak-hari-sidang",
  public_unregistered: "template-publik-belum-terdaftar",
  external_agency: "template-instansi-mitra",
};

const DEFAULT_NOTIFICATION_TEMPLATE_BY_GROUP: Record<NotificationAudienceGroup, string> = {
  hakim: "hakim-jadwal-tugas-sidang",
  kepaniteraan: "kepaniteraan-monitoring-perkara",
  kesekretariatan: "kesekretariatan-info-internal",
  case_party: "pihak-perkara-jadwal-sidang",
  public_unregistered: "masyarakat-info-layanan",
  external_agency: "instansi-koordinasi-layanan",
};

const DAY_OPTIONS = [
  { value: "*", label: "Setiap hari" },
  { value: "1", label: "Senin" },
  { value: "2", label: "Selasa" },
  { value: "3", label: "Rabu" },
  { value: "4", label: "Kamis" },
  { value: "5", label: "Jumat" },
  { value: "6", label: "Sabtu" },
  { value: "0", label: "Minggu" },
  { value: "1-5", label: "Senin-Jumat" },
  { value: "6-0", label: "Sabtu-Minggu" },
];

const MONTH_OPTIONS = [
  { value: "*", label: "Setiap bulan" },
  { value: "1", label: "Januari" },
  { value: "2", label: "Februari" },
  { value: "3", label: "Maret" },
  { value: "4", label: "April" },
  { value: "5", label: "Mei" },
  { value: "6", label: "Juni" },
  { value: "7", label: "Juli" },
  { value: "8", label: "Agustus" },
  { value: "9", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

function statusVariant(status: string) {
  if (["active", "connected", "success", "dry-run"].includes(status)) return "success" as const;
  if (["error", "failed", "browser_locked"].includes(status)) return "danger" as const;
  if (["disabled", "disconnected", "waiting_qr", "warning"].includes(status)) return "warning" as const;
  return "outline" as const;
}

// Mapping display-only: status teknis → Bahasa Indonesia (tidak mengubah nilai DB)
function displayStatus(status: string): string {
  const map: Record<string, string> = {
    active_registry: "Aktif di Daftar Pengiriman",
    legacy_disabled: "Jalur Lama Dinonaktifkan",
    dry_run: "Simulasi",
    pilot: "Pilot",
    production: "Aktif Operasional",
    pending_approval: "Menunggu Persetujuan",
    needs_manual_mapping: "Perlu Pengaturan Manual",
    registry_draft: "Draft Daftar Pengiriman",
    waiting_qr: "Perlu Scan QR",
    qr_needed: "Perlu Scan QR",
    browser_locked: "Sesi WhatsApp sedang dipakai proses lain",
    disconnected: "Tidak Terhubung",
    connected: "Terhubung",
    initializing: "Menyiapkan Koneksi",
    enabled: "Aktif",
    disabled: "Tidak Aktif",
    paused: "Dijeda",
    running: "Berjalan",
    stopped: "Berhenti",
    ok: "OK",
    error: "Bermasalah",
    needs_sync: "Perlu Sinkronisasi",
    env: "Env Server",
    volatile_memory: "Memory Sementara",
    missing_after_restart: "Hilang Setelah Restart",
    local_model: "Model Lokal",
    none: "Tidak Ada",
    active: "Aktif",
    inactive: "Tidak Aktif",
    online: "Online",
    offline: "Offline",
    failed: "Gagal",
    blocked: "Diblokir",
    simulated: "Simulasi",
    skipped: "Dilewati",
    completed: "Selesai",
    manual_dry_run: "Simulasi Manual",
    manual_controlled: "Manual Terkontrol",
    scheduler_dry_run: "Simulasi Penjadwal",
    scheduler_blocked: "Penjadwal Ditahan",
    success: "Berhasil",
    unknown: "Tidak Diketahui",
  };
  return map[status] ?? humanizeStatus(status);
}

function formatRunSummary(summary: Record<string, unknown>) {
  const parts: string[] = [];
  const targetDate = typeof summary.targetDate === "string" ? summary.targetDate : "";
  const reason = typeof summary.reason === "string" ? summary.reason : "";
  const warnings = Array.isArray(summary.warnings)
    ? summary.warnings.filter((item): item is string => typeof item === "string").slice(0, 2)
    : [];
  if (targetDate) parts.push(`Target ${targetDate}`);
  if (reason) parts.push(`Alasan: ${displayStatus(reason)}`);
  if (warnings.length > 0) parts.push(warnings.join(" "));
  return parts.join(" · ").slice(0, 220);
}

function stringListFromUnknown(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return Array.from(new Set(raw.map((item) => String(item ?? "").trim()).filter(Boolean)));
}

function stringListFromText(value: string): string[] {
  return Array.from(new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean)));
}

function textFromStringList(value: unknown): string {
  return stringListFromUnknown(value).join(", ");
}

function defaultAudienceGroup(category: AletaBotNotificationCategory): NotificationAudienceGroup {
  return category === "employee" ? "kepaniteraan" : "case_party";
}

function normalizeAudienceGroup(category: AletaBotNotificationCategory, value: unknown): NotificationAudienceGroup {
  const raw = String(value || "");
  const employeeValues = EMPLOYEE_NOTIFICATION_GROUP_OPTIONS.map((option) => option.value);
  const partyValues = PARTY_NOTIFICATION_GROUP_OPTIONS.map((option) => option.value);
  if (category === "employee" && employeeValues.includes(raw as EmployeeNotificationAudienceGroup)) {
    return raw as EmployeeNotificationAudienceGroup;
  }
  if (category === "party" && partyValues.includes(raw as PartyNotificationAudienceGroup)) {
    return raw as PartyNotificationAudienceGroup;
  }
  return defaultAudienceGroup(category);
}

function notificationAudienceGroup(formOrNotification: { category: AletaBotNotificationCategory; recipientMapping?: Record<string, unknown> }) {
  const mapping = formOrNotification.recipientMapping ?? {};
  return normalizeAudienceGroup(formOrNotification.category, mapping["audienceGroup"] ?? mapping["recipientGroup"]);
}

function audienceGroupLabel(category: AletaBotNotificationCategory, value: unknown) {
  const group = normalizeAudienceGroup(category, value);
  const options = category === "employee" ? EMPLOYEE_NOTIFICATION_GROUP_OPTIONS : PARTY_NOTIFICATION_GROUP_OPTIONS;
  return options.find((option) => option.value === group)?.label ?? "Target notifikasi";
}

function audienceGroupHint(category: AletaBotNotificationCategory, value: unknown) {
  const group = normalizeAudienceGroup(category, value);
  const options = category === "employee" ? EMPLOYEE_NOTIFICATION_GROUP_OPTIONS : PARTY_NOTIFICATION_GROUP_OPTIONS;
  return options.find((option) => option.value === group)?.hint ?? "";
}

function friendlyTechnicalLabel(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^notifikasi\.get/i.test(raw)) {
    return raw
      .replace(/^notifikasi\.get(Total)?(Data)?/i, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
      .replace(/\bBht\b/g, "BHT")
      .replace(/\bEdoc\b/g, "E-Doc")
      .replace(/\bEcourt\b/g, "E-Court")
      .trim();
  }
  return raw;
}

function queryDisplayName(query?: Pick<AletaBotQuery, "name" | "sqlText"> | null) {
  if (!query) return "";
  return friendlyTechnicalLabel(query.name);
}

function templateDisplayName(template?: Pick<AletaBotTemplate, "title" | "category"> | null) {
  if (!template) return "";
  return template.category ? `${template.title}` : template.title;
}

function sourceQueryMatchesNotification(query: AletaBotQuery, category: AletaBotNotificationCategory, group: NotificationAudienceGroup) {
  if (query.category === "system") return true;
  if (query.category !== category) return false;
  const haystack = `${query.id} ${query.name} ${query.description} ${query.sqlText}`.toLowerCase();
  if (category === "employee") return true;
  if (group === "external_agency") return /instansi|mitra|kua|capil|dukcapil|kepolisian|pemerintah/.test(haystack);
  if (group === "public_unregistered") return /publik|masyarakat|belum-terdaftar|belum terdaftar|layanan/.test(haystack);
  return !/template-instansi|template-publik|instansi mitra|masyarakat umum/.test(haystack);
}

function templateMatchesNotification(template: AletaBotTemplate, category: AletaBotNotificationCategory, group: NotificationAudienceGroup) {
  const templateCategory = normalizeTemplateCategory(String(template.category || "").toLowerCase());
  if (category === "employee") return ["pegawai", "manajemen_surat", "admin"].includes(templateCategory);
  if (group === "external_agency") return ["instansi", "pihak"].includes(templateCategory);
  if (group === "public_unregistered") return ["publik", "pihak", "balasan"].includes(templateCategory);
  return templateCategory === "pihak";
}

function defaultNotificationQuery(snapshot: AletaBotSnapshot | undefined, category: AletaBotNotificationCategory, group: NotificationAudienceGroup) {
  const queries = snapshot?.queries ?? [];
  const preferredId = DEFAULT_NOTIFICATION_QUERY_BY_GROUP[group];
  return (
    queries.find((query) => query.id === preferredId) ??
    queries.find((query) => sourceQueryMatchesNotification(query, category, group)) ??
    queries.find((query) => query.category === category) ??
    queries[0]
  );
}

function defaultNotificationTemplate(snapshot: AletaBotSnapshot | undefined, category: AletaBotNotificationCategory, group: NotificationAudienceGroup) {
  const templates = snapshot?.templates ?? [];
  const preferredId = DEFAULT_NOTIFICATION_TEMPLATE_BY_GROUP[group];
  return (
    templates.find((template) => template.id === preferredId) ??
    templates.find((template) => templateMatchesNotification(template, category, group)) ??
    templates[0]
  );
}

function employeeTargetLabel(mapping: Record<string, unknown>): string {
  const hints = [
    ...stringListFromUnknown(mapping["roleHints"]),
    ...stringListFromUnknown(mapping["positionHints"]),
    ...stringListFromUnknown(mapping["nameHints"]),
    ...stringListFromUnknown(mapping["hints"]),
  ];
  return hints.length > 0 ? `Pegawai: ${hints.join(", ")}` : "Semua user/pegawai portal";
}

function notificationTargetLabel(notification: AletaBotNotification): string {
  const group = notificationAudienceGroup(notification);
  if (notification.recipientSource === "users") {
    const target = employeeTargetLabel(notification.recipientMapping);
    return `${audienceGroupLabel("employee", group)} - ${target}`;
  }
  return `${audienceGroupLabel("party", group)} - kolom ${String(notification.recipientMapping["recipientColumn"] ?? "sumber data")}`;
}

function getSimpleAiSummary(status?: string): { label: string; hint: string; level: "ok" | "warning" | "error" } {
  switch (status) {
    case "synced":
      return { label: "AI Siap", hint: "AI siap membantu sesuai pengaturan yang aktif.", level: "ok" };
    case "needs_sync":
      return { label: "AI Perlu Sinkronisasi", hint: "AI perlu disinkronkan ulang oleh admin teknis.", level: "warning" };
    case "disabled":
      return { label: "AI Dinonaktifkan", hint: "AI tidak aktif untuk pertanyaan publik.", level: "warning" };
    case "error":
      return { label: "AI Bermasalah", hint: "Ada kendala pada layanan AI. Minta admin teknis memeriksa Mode Lanjutan.", level: "error" };
    default:
      return { label: "Status AI belum diketahui", hint: "Status AI belum tersedia dari layanan.", level: "warning" };
  }
}

function getSimpleMachineSummary(runtimeDashboard: RuntimeDashboardSnapshot | null): { label: string; hint: string; level: "ok" | "warning" | "error" } {
  if (!runtimeDashboard) {
    return { label: "Status belum diketahui", hint: "Detail teknis tersedia di Mode Lanjutan.", level: "warning" };
  }
  if (!runtimeDashboard.online) {
    return { label: "Bermasalah", hint: "ALETA Bot Gateway tidak dapat dihubungi. Detail teknis tersedia di Mode Lanjutan.", level: "error" };
  }
  return { label: "Aktif", hint: "Layanan bot dapat dihubungi. Detail teknis tersedia di Mode Lanjutan.", level: "ok" };
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value);
}

function splitCronExpressions(value: string) {
  return value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isValidSingleCronExpression(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return parts.every((part) => /^[A-Za-z\d*,/-]+$/.test(part));
}

function isValidCronExpression(value: string) {
  const schedules = splitCronExpressions(value);
  if (schedules.length === 0) return false;
  return schedules.every(isValidSingleCronExpression);
}

function parseCronExpression(cronExpression: string): ParsedCronSchedule {
  const fallback = {
    valid: false,
    minute: "0",
    hour: "8",
    dayOfMonth: "*",
    month: "*",
    dayOfWeek: "*",
    time: "08:00:00",
  };
  const parts = (splitCronExpressions(cronExpression)[0] ?? "").split(/\s+/);
  if (parts.length !== 5) return fallback;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const minuteNumber = Number(minute);
  const hourNumber = Number(hour);
  const time =
    Number.isInteger(minuteNumber) &&
    Number.isInteger(hourNumber) &&
    minuteNumber >= 0 &&
    minuteNumber <= 59 &&
    hourNumber >= 0 &&
    hourNumber <= 23
      ? `${String(hourNumber).padStart(2, "0")}:${String(minuteNumber).padStart(2, "0")}:00`
      : fallback.time;
  return {
    valid: isValidCronExpression(cronExpression),
    minute,
    hour,
    dayOfMonth,
    month,
    dayOfWeek,
    time,
  };
}

function scheduleKindFromCron(scheduleType: NotificationForm["scheduleType"], cronExpression: string): ScheduleKind {
  if (scheduleType === "manual") return "manual";
  if (scheduleType === "event") return "event";
  const parsed = parseCronExpression(cronExpression);
  if (!parsed.valid || !/^\d+$/.test(parsed.minute) || !/^\d+$/.test(parsed.hour)) return "advanced";
  if (parsed.dayOfMonth !== "*") return "monthly";
  if (parsed.dayOfWeek !== "*") return "weekly";
  return "daily";
}

function scheduleFormToCron({
  time,
  dayOfMonth = "*",
  month = "*",
  dayOfWeek = "*",
}: {
  time: string;
  dayOfMonth?: string;
  month?: string;
  dayOfWeek?: string;
}) {
  if (!isValidTime(time)) return "";
  const [hour, minute] = time.split(":");
  return `${Number(minute)} ${Number(hour)} ${dayOfMonth} ${month} ${dayOfWeek}`;
}

function getSchedulePartLabel(options: Array<{ value: string; label: string }>, value: string, fallbackPrefix: string) {
  return options.find((option) => option.value === value)?.label ?? `${fallbackPrefix} ${value}`;
}

function humanizeSchedule(scheduleType: NotificationForm["scheduleType"], cronExpression: string, trigger?: string) {
  if (scheduleType === "manual") return "Dipicu manual";
  if (scheduleType === "event") return trigger ? `Dipicu event: ${trigger}` : "Berdasarkan event";
  if (!cronExpression.trim()) return "Belum ada jadwal";
  const parsed = parseCronExpression(cronExpression);
  if (!parsed.valid || !/^\d+$/.test(parsed.minute) || !/^\d+$/.test(parsed.hour)) {
    return "Format jadwal lama tidak dikenali";
  }
  const monthLabel = parsed.month === "*" ? "" : ` pada ${getSchedulePartLabel(MONTH_OPTIONS, parsed.month, "bulan")}`;
  if (parsed.dayOfMonth !== "*") {
    return `Setiap tanggal ${parsed.dayOfMonth}${monthLabel} pukul ${parsed.time}`;
  }
  if (parsed.dayOfWeek !== "*") {
    return `${getSchedulePartLabel(DAY_OPTIONS, parsed.dayOfWeek, "Hari")} pukul ${parsed.time}${monthLabel}`;
  }
  return `Setiap hari${monthLabel} pukul ${parsed.time}`;
}

function humanizeLegacyCron(cronSchedule: string) {
  const firstCron = cronSchedule.split(";")[0]?.trim() ?? "";
  if (!firstCron) return "Tidak terjadwal";
  return humanizeSchedule("cron", firstCron);
}

function extractTemplatePlaceholders(body: string) {
  return Array.from(new Set(Array.from(body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)).map((match) => match[1])));
}

function looksLikePreviewListKey(key: string) {
  return /(ringkasan|detail|daftar|data|hasil|items?|list|informasi)/i.test(key);
}

function normalizePreviewListItem(value: string) {
  return value
    .replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikePreviewFieldDetailLines(lines: string[]) {
  if (lines.length <= 1) return false;
  const fieldLikeCount = lines
    .map(normalizePreviewListItem)
    .filter((line) => /^[A-Za-z_ /().-]{2,45}:\s+\S/.test(line)).length;
  return fieldLikeCount >= Math.ceil(lines.length * 0.6);
}

function formatTemplatePreviewValue(key: string, value: unknown) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) {
    const items = value.map((item) => normalizePreviewListItem(String(item))).filter(Boolean);
    return items.length > 1 ? items.map((item, index) => `${index + 1}. ${item}`).join("\n") : (items[0] ?? "");
  }

  const text = String(value).replace(/\r\n/g, "\n").trim();
  if (!text || !looksLikePreviewListKey(key)) return text;
  if (/^\s*\d+[.)]\s+/m.test(text)) return text;

  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const separator = text.includes("\n\n")
    ? /\n{2,}/
    : text.includes(" | ")
      ? /\s+\|\s+/
      : text.includes("\n") && !looksLikePreviewFieldDetailLines(lines)
        ? /\n+/
        : null;
  if (!separator) return text;

  const items = text.split(separator).map(normalizePreviewListItem).filter(Boolean);
  return items.length > 1 ? items.map((item, index) => `${index + 1}. ${item}`).join("\n") : text;
}

function renderAletaBotTemplatePreview(body: string, overrides: Record<string, string> = {}) {
  const sample: Record<string, string> = {
    waktu: new Date().toLocaleString("id-ID"),
    mode: "dry-run",
    nomor_perkara: "123/Pdt.G/2026/PA.Dgl",
    nama_pihak: "Budi Santoso",
    nama_pegawai: "Contoh Pegawai",
    jabatan: "Panitera Pengganti",
    recipient_name: "Contoh Pegawai",
    recipient_role: "Panitera Pengganti",
    nama_instansi: "KUA Kecamatan Contoh",
    nama_layanan: "Layanan informasi pengadilan",
    agenda: "Mediasi",
    hari_sidang: "Senin",
    tanggal_sidang: "12 Januari 2026",
    ruang_sidang: "Ruang Sidang 1",
    ruangan: "Ruang Sidang 1",
    sisa_panjar: "Rp125.000",
    judul_notifikasi: "Contoh Notifikasi",
    ringkasan: "Data contoh pertama untuk pratinjau aman.\nData contoh kedua untuk pratinjau aman.",
    jenis_surat: "Surat Masuk",
    nomor_surat: "W00-A/123/OT.01/5/2026",
    perihal: "Pemberitahuan layanan",
    instruksi: "Mohon ditindaklanjuti sesuai kewenangan.",
    deadline: "21 Mei 2026",
    status: "Menunggu tindak lanjut",
    file_name: "panggilan-perkara.pdf",
    file_type: "PDF",
    file_path: "/var/www/html/SIPP/doc/panggilan-perkara.pdf",
    attachment_name: "panggilan-perkara.pdf",
    ...overrides,
  };

  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) =>
    sample[key] === undefined ? `{{${key}}}` : formatTemplatePreviewValue(key, sample[key])
  );
}

function formatTargetOptionLabel(value: string) {
  return displayStatus(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeHint(value: string) {
  return String(value || "").trim().toLowerCase();
}

function matchesAnyHint(hints: string[], values: string[]) {
  if (hints.length === 0) return true;
  const normalizedValues = values.map(normalizeHint).filter(Boolean);
  return hints.some((hint) => normalizedValues.some((value) => value.includes(hint)));
}

function employeeMatchesTargetHints(recipient: AletaBotEmployeeRecipient, roleHints: string[], positionHints: string[], nameHints: string[]) {
  const additionalRoleLabels = recipient.additionalRoleIds.map(getAdditionalRoleLabel);
  return (
    matchesAnyHint(roleHints, [recipient.roleId]) &&
    matchesAnyHint(positionHints, [recipient.positionId, recipient.positionName, recipient.unitKerja, ...recipient.additionalRoleIds, ...additionalRoleLabels]) &&
    matchesAnyHint(nameHints, [recipient.id, recipient.name, recipient.username])
  );
}

function getTargetedEmployeeRecipients(recipients: AletaBotEmployeeRecipient[], form: NotificationForm) {
  const roleHints = stringListFromText(form.recipientRoleHints).map(normalizeHint);
  const positionHints = stringListFromText(form.recipientPositionHints).map(normalizeHint);
  const nameHints = stringListFromText(form.recipientNameHints).map(normalizeHint);
  return recipients.filter((recipient) => employeeMatchesTargetHints(recipient, roleHints, positionHints, nameHints));
}

function makeCountedOptions<T>(
  items: T[],
  getValue: (item: T) => string,
  getLabel: (item: T) => string
) {
  const grouped = new Map<string, { value: string; label: string; count: number }>();
  for (const item of items) {
    const value = getValue(item).trim();
    if (!value) continue;
    const existing = grouped.get(value);
    if (existing) {
      existing.count += 1;
      continue;
    }
    grouped.set(value, { value, label: getLabel(item), count: 1 });
  }
  return Array.from(grouped.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((item) => ({ value: item.value, label: `${item.label} (${item.count})` }));
}

function makeEmployeePositionOptions(recipients: AletaBotEmployeeRecipient[]) {
  const grouped = new Map<string, { value: string; label: string; count: number }>();
  const add = (value: string, label: string) => {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) return;
    const existing = grouped.get(normalizedValue);
    if (existing) {
      existing.count += 1;
      return;
    }
    grouped.set(normalizedValue, { value: normalizedValue, label, count: 1 });
  };
  for (const recipient of recipients) {
    add(
      recipient.positionId || recipient.positionName,
      [recipient.positionName || recipient.positionId, recipient.unitKerja].filter(Boolean).join(" - ")
    );
    for (const additionalRoleId of recipient.additionalRoleIds) {
      add(additionalRoleId, `${getAdditionalRoleLabel(additionalRoleId)} - Tugas tambahan`);
    }
  }
  return Array.from(grouped.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((item) => ({ value: item.value, label: `${item.label} (${item.count})` }));
}

function getEmployeeTargetOptionLabels(recipients: AletaBotEmployeeRecipient[], form: NotificationForm) {
  const roles = stringListFromText(form.recipientRoleHints);
  const positions = stringListFromText(form.recipientPositionHints);
  const names = stringListFromText(form.recipientNameHints);
  const findLabel = (value: string, values: Array<{ value: string; label: string }>) => values.find((item) => item.value === value)?.label ?? value;
  const roleOptions = makeCountedOptions(recipients, (recipient) => recipient.roleId, (recipient) => formatTargetOptionLabel(recipient.roleId));
  const positionOptions = makeEmployeePositionOptions(recipients);
  const employeeOptions = recipients.map((recipient) => ({
    value: recipient.id,
    label: [recipient.name || recipient.username, recipient.username ? `@${recipient.username}` : "", recipient.positionName].filter(Boolean).join(" - "),
  }));
  const labels = [
    ...roles.map((value) => `Role: ${findLabel(value, roleOptions)}`),
    ...positions.map((value) => `Jabatan/unit: ${findLabel(value, positionOptions)}`),
    ...names.map((value) => `Pegawai: ${findLabel(value, employeeOptions)}`),
  ];
  return labels;
}

function sampleValueForColumn(column: string) {
  const key = column.toLowerCase();
  if (key.includes("nama_pegawai")) return "Contoh Pegawai";
  if (key.includes("nama_instansi")) return "KUA Kecamatan Contoh";
  if (key.includes("nama_layanan")) return "Layanan informasi pengadilan";
  if (key.includes("nama_pihak") || key === "nama") return "Budi Santoso";
  if (key.includes("nomor_perkara")) return "123/Pdt.G/2026/PA.Dgl";
  if (key.includes("telepon") || key.includes("whatsapp") || key.includes("nomor_hp")) return "6281234567890";
  if (key.includes("tanggal")) return "20 Mei 2026";
  if (key.includes("hari")) return "Rabu";
  if (key.includes("ruang")) return "Ruang Sidang 1";
  if (key.includes("agenda")) return "Sidang pertama";
  if (key.includes("perihal")) return "Pemberitahuan layanan";
  if (key.includes("deadline")) return "21 Mei 2026";
  if (key.includes("sisa") || key.includes("panjar")) return "Rp125.000";
  if (key.includes("status")) return "Perlu tindak lanjut";
  return `[contoh ${column}]`;
}

function makeNotificationPreviewSample(
  form: NotificationForm,
  snapshot: AletaBotSnapshot,
  query?: AletaBotQuery
) {
  const targetedEmployees = form.category === "employee" ? getTargetedEmployeeRecipients(snapshot.employeeRecipients, form) : [];
  const employee = targetedEmployees[0] ?? snapshot.employeeRecipients[0];
  const sample: Record<string, string> = {
    waktu: new Date().toLocaleString("id-ID"),
    mode: form.isActive ? "aktif" : "simulasi",
    nama_pegawai: employee?.name || "Contoh Pegawai",
    jabatan: employee?.additionalRoleIds?.[0] ? getAdditionalRoleLabel(employee.additionalRoleIds[0]) : employee?.positionName || employee?.unitKerja || "Contoh Jabatan",
    judul_notifikasi: form.name || "Contoh Notifikasi",
    ringkasan: form.description || query?.description || "Ringkasan isi notifikasi.",
    recipient_name: form.category === "employee" ? employee?.name || "Contoh Pegawai" : "Budi Santoso",
    nama_pihak: "Budi Santoso",
    nama_instansi: "KUA Kecamatan Contoh",
    nama_layanan: "Layanan informasi pengadilan",
    kontak_pengadilan: "0822-7111-5021",
    alamat_pengadilan: "Alamat kantor pengadilan",
    nomor_perkara: "123/Pdt.G/2026/PA.Dgl",
    agenda: "Sidang pertama",
    hari_sidang: "Rabu",
    tanggal_sidang: "20 Mei 2026",
    ruang_sidang: "Ruang Sidang 1",
    ruangan: "Ruang Sidang 1",
    sisa_panjar: "Rp125.000",
    jenis_surat: "Surat Masuk",
    nomor_surat: "W00-A/123/OT.01/5/2026",
    perihal: "Pemberitahuan layanan",
    instruksi: "Mohon ditindaklanjuti sesuai kewenangan.",
    deadline: "21 Mei 2026",
    status: "Selesai",
  };
  sample.ringkasan =
    form.description ||
    query?.description ||
    "Data contoh pertama untuk pratinjau aman.\nData contoh kedua untuk pratinjau aman.";
  for (const column of query?.outputColumns ?? []) {
    sample[column] = sample[column] || sampleValueForColumn(column);
  }
  return sample;
}

function makePublicQaDraftKey(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function migrationActionTitle(action: LegacyMigrationAction) {
  const labels: Record<LegacyMigrationAction, string> = {
    preview: "Lihat Pratinjau",
    convert: "Ubah ke Draft",
    "dry-run": "Jalankan Simulasi",
    "submit-approval": "Ajukan Persetujuan",
    activate: "Aktifkan",
    "disable-legacy": "Nonaktifkan",
    rollback: "Kembalikan",
  };
  return labels[action];
}

function getSuggestedMigrationAction(status: AletaBotLegacyMigration["status"]): {
  action: LegacyMigrationAction;
  label: string;
  step: string;
  isHighRisk: boolean;
} | null {
  const map: Record<string, { action: LegacyMigrationAction; label: string; step: string; isHighRisk: boolean }> = {
    mapped: { action: "convert", label: "Ubah ke Draft", step: "Tahap 1/5", isHighRisk: false },
    registry_draft: { action: "dry-run", label: "Jalankan Simulasi", step: "Tahap 2/5", isHighRisk: false },
    dry_run: { action: "submit-approval", label: "Ajukan Persetujuan", step: "Tahap 3/5", isHighRisk: false },
    active_registry: { action: "disable-legacy", label: "Nonaktifkan Jalur Lama", step: "Tahap 5/5", isHighRisk: true },
  };
  return map[status] ?? null;
}

async function requestBot<T>(url: string, init?: RequestInit) {
  const response = await fetch(apiPath(url), {
    credentials: "include",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(humanizeErrorMessage(payload?.message ?? payload?.error?.message, "Permintaan ke ALETA Bot belum berhasil diproses."));
  }
  return payload.data;
}

function makeEmptyNotificationForm(snapshot?: AletaBotSnapshot, category: AletaBotNotificationCategory = "employee"): NotificationForm {
  const audienceGroup = defaultAudienceGroup(category);
  const query = defaultNotificationQuery(snapshot, category, audienceGroup);
  const template = defaultNotificationTemplate(snapshot, category, audienceGroup);
  const recipientMapping =
    category === "employee"
      ? { source: "users.whatsapp_number", audienceGroup }
      : { audienceGroup, recipientColumn: query?.recipientColumn || "telepon", fallbackColumns: ["nomor_hp", "nomor_whatsapp", "telepon"] };
  return {
    id: "",
    name: "",
    category,
    description: "",
    queryId: query?.id ?? "",
    templateId: template?.id ?? "",
    recipientMapping,
    recipientRoleHints: "",
    recipientPositionHints: "",
    recipientNameHints: "",
    scheduleType: "manual",
    scheduleCron: "",
    scheduleTrigger: "manual",
    isActive: false,
    attachDocument: true,
    delayMs: 1500,
    retryLimit: 2,
  };
}

function notificationToForm(notification: AletaBotNotification): NotificationForm {
  return {
    id: notification.id,
    name: notification.name,
    category: notification.category,
    description: notification.description,
    queryId: notification.queryId,
    templateId: notification.templateId,
    recipientMapping: notification.recipientMapping ?? {},
    recipientRoleHints: textFromStringList(notification.recipientMapping?.["roleHints"]),
    recipientPositionHints: textFromStringList(notification.recipientMapping?.["positionHints"]),
    recipientNameHints: textFromStringList(notification.recipientMapping?.["nameHints"]),
    scheduleType: notification.scheduleConfig.type,
    scheduleCron: notification.scheduleConfig.cron,
    scheduleTrigger: notification.scheduleConfig.trigger,
    isActive: notification.isActive,
    attachDocument: notification.attachDocument !== false,
    delayMs: notification.delayMs,
    retryLimit: notification.retryLimit,
  };
}

function buildNotificationRecipientMapping(form: NotificationForm, query?: AletaBotQuery): Record<string, unknown> {
  const audienceGroup = notificationAudienceGroup(form);
  if (form.category === "employee") {
    const mapping: Record<string, unknown> = {
      ...form.recipientMapping,
      audienceGroup,
      source: "users.whatsapp_number",
    };
    const roleHints = stringListFromText(form.recipientRoleHints);
    const positionHints = stringListFromText(form.recipientPositionHints);
    const nameHints = stringListFromText(form.recipientNameHints);
    if (roleHints.length > 0) mapping["roleHints"] = roleHints;
    else delete mapping["roleHints"];
    if (positionHints.length > 0) mapping["positionHints"] = positionHints;
    else delete mapping["positionHints"];
    if (nameHints.length > 0) mapping["nameHints"] = nameHints;
    else delete mapping["nameHints"];
    return mapping;
  }
  return {
    ...form.recipientMapping,
    audienceGroup,
    recipientColumn: query?.recipientColumn || form.recipientMapping["recipientColumn"] || "telepon",
    fallbackColumns: ["nomor_hp", "nomor_whatsapp", "telepon"],
  };
}

function makeEmptyQueryForm(category: AletaBotQueryCategory = "employee"): QueryForm {
  return {
    id: "",
    name: "",
    category,
    description: "",
    sqlText: "SELECT nama AS nama_pihak, nomor_perkara, telepon, 'Ringkasan notifikasi' AS ringkasan FROM sumber_data LIMIT 5",
    outputColumns: category === "party" ? "nama_pihak, nomor_perkara, telepon, ringkasan" : "nama_pegawai, judul_notifikasi, ringkasan",
    recipientColumn: category === "party" ? "telepon" : "",
    connectionKey: "sipp_primary",
    isActive: true,
  };
}

function queryToForm(query: AletaBotQuery): QueryForm {
  return {
    id: query.id,
    name: query.name,
    category: query.category,
    description: query.description,
    sqlText: query.sqlText,
    outputColumns: query.outputColumns.join(", "),
    recipientColumn: query.recipientColumn,
    connectionKey: query.connectionKey,
    isActive: query.isActive,
  };
}

function makeEmptyDbConnectionForm(): DbConnectionForm {
  return {
    id: "",
    key: "",
    name: "",
    description: "",
    host: "localhost",
    port: 3306,
    databaseName: "",
    username: "root",
    passwordEnvKey: "",
    newPassword: "",
    sslEnabled: false,
    connectionTimeoutMs: 5000,
    isActive: true,
    isDefault: false,
    legacySource: "",
  };
}

function dbConnectionToForm(connection: AletaBotDbConnection): DbConnectionForm {
  return {
    id: connection.id,
    key: connection.key,
    name: connection.name,
    description: connection.description,
    host: connection.host,
    port: connection.port,
    databaseName: connection.databaseName,
    username: connection.username,
    passwordEnvKey: connection.passwordEnvKey,
    newPassword: "",
    sslEnabled: connection.sslEnabled,
    connectionTimeoutMs: connection.connectionTimeoutMs,
    isActive: connection.isActive,
    isDefault: connection.isDefault,
    legacySource: connection.legacySource,
  };
}

function makeEmptyPublicQaIntentForm(): PublicQaIntentForm {
  return {
    id: "",
    key: "",
    name: "",
    description: "",
    category: "informasi_umum",
    audience: "party",
    isActive: false,
    aiEnabled: false,
    exactTriggers: "",
    exampleQuestions: "",
    requiredParameters: "",
    queryKey: "",
    legacyHandler: "",
    legacyCommand: "",
    parameterizedLegacyCommand: "",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.7,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: "Maaf, saya belum memahami pertanyaan Bapak/Ibu. Silakan ketik info lengkap untuk melihat daftar layanan.",
    answerTemplate: "",
    matchKeywords: [],
    riskLevel: "low",
    notes: "",
    aiAnswerEnabled: false,
    aiAnswerMode: "off",
    answerPolicy: "public_info_only",
    verificationPolicy: "none",
    allowedDataFields: "",
    blockedDataFields: "nik, alamat, telepon, nomor_hp, catatan_internal",
    aiSystemPrompt: "",
    aiUserPromptTemplate: "",
    maxAiTokens: 400,
    temperature: 0.2,
    requiresApprovalBeforeActive: true,
    status: "draft",
  };
}

function publicQaIntentToForm(intent: AletaBotPublicQaIntent): PublicQaIntentForm {
  return {
    id: intent.id,
    key: intent.key,
    name: intent.name,
    description: intent.description,
    category: intent.category,
    audience: intent.audience,
    isActive: intent.isActive,
    aiEnabled: intent.aiEnabled,
    exactTriggers: intent.exactTriggers.join("\n"),
    exampleQuestions: intent.exampleQuestions.join("\n"),
    requiredParameters: intent.requiredParameters.join(", "),
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
    answerTemplate: intent.answerTemplate ?? "",
    matchKeywords: intent.matchKeywords ?? [],
    riskLevel: intent.riskLevel,
    notes: intent.notes,
    aiAnswerEnabled: intent.aiAnswerEnabled,
    aiAnswerMode: intent.aiAnswerMode,
    answerPolicy: intent.answerPolicy,
    verificationPolicy: intent.verificationPolicy,
    allowedDataFields: intent.allowedDataFields.join(", "),
    blockedDataFields: intent.blockedDataFields.join(", "),
    aiSystemPrompt: intent.aiSystemPrompt,
    aiUserPromptTemplate: intent.aiUserPromptTemplate,
    maxAiTokens: intent.maxAiTokens,
    temperature: intent.temperature,
    requiresApprovalBeforeActive: intent.requiresApprovalBeforeActive,
    status: intent.status,
  };
}

const HORIZONTAL_SCROLLBAR_CLASS =
  "[scrollbar-color:hsl(var(--primary))_hsl(var(--muted))] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-3 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/70 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-muted/40";

// Placeholder yang SELALU disuntikkan runtime bot (lihat commonPlaceholders pada
// aleta_bot/services/dynamicNotificationSchedulerService.js), jadi tetap tersedia
// walau tidak muncul sebagai kolom output sumber data.
const RUNTIME_PLACEHOLDERS = [
  "recipient_number",
  "recipient_name",
  "recipient_role",
  "nomor_perkara",
  "event_key",
  "event_date",
  "ringkasan",
  "source_updated_at",
  "file_path",
  "file_name",
  "file_type",
  "nama_pegawai",
  "nama_pihak",
  "judul_notifikasi",
  "waktu",
  "mode",
];

/**
 * Menilai seberapa cocok sebuah sumber data dengan isi pesan yang sedang disunting:
 * berapa banyak placeholder pada isi pesan yang benar-benar dipasok kolom output query.
 */
export function scoreQueryForTemplate(query: Pick<AletaBotQuery, "outputColumns">, placeholders: string[]) {
  const available = new Set([...query.outputColumns, ...RUNTIME_PLACEHOLDERS]);
  const covered = placeholders.filter((placeholder) => available.has(placeholder));
  const missing = placeholders.filter((placeholder) => !available.has(placeholder));
  return { covered, missing, score: covered.length };
}

/**
 * Daftar pilihan variabel isi pesan, lengkap dengan penjelasannya.
 *
 * Sebelumnya editor hanya menampilkan nama variabel mentah seperti
 * `{{ringkasan}}` sehingga admin harus menebak isinya. Di sini tiap variabel
 * tampil dengan label dan keterangan singkat; saat diklik, terbuka keterangan
 * panjang, asal datanya, sumber data yang benar-benar memasoknya, dan contoh
 * hasilnya seperti yang akan dibaca penerima.
 */
/**
 * Peringatan keamanan isi pesan.
 *
 * Sengaja hanya MEMBERI TAHU. Tidak ada tombol simpan yang dikunci dan tidak
 * ada isi pesan yang ditolak: yang menulis adalah pegawai pengadilan yang tahu
 * apa yang perlu disampaikan, sedangkan pemeriksa ini hanya menebak dari bentuk
 * kalimat dan tebakannya bisa salah. Pemeriksa yang keliru tidak boleh
 * menghalangi pemberitahuan yang sah.
 */
/**
 * Penanda ringkas di daftar isi pesan.
 *
 * Tanpa ini, peringatan hanya terlihat oleh admin yang kebetulan membuka isi
 * pesannya - padahal isi pesan yang bermasalah justru yang jarang dibuka lagi
 * setelah sekali disunting.
 *
 * Sengaja tidak menampilkan apa pun ketika isi pesan bersih: penanda hijau di
 * setiap kartu hanya menambah ramai tanpa memberi tahu apa-apa.
 */
function TemplateSafetyBadge({ body }: { body: string }) {
  const ringkas = useMemo(() => summarizeWarnings(lintTemplateBody(body)), [body]);
  if (ringkas.total === 0) return null;
  const berat = ringkas.tinggi > 0;
  return (
    <Badge variant={berat ? "danger" : "warning"}>
      {berat ? `${ringkas.tinggi} risiko tinggi` : `${ringkas.total} catatan`}
    </Badge>
  );
}

function TemplateSafetyWarnings({ body }: { body: string }) {
  const warnings = useMemo(() => lintTemplateBody(body), [body]);
  if (warnings.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
        <p className="font-semibold text-emerald-700 dark:text-emerald-300">Isi pesan aman</p>
        <p className="mt-1 text-muted-foreground">
          Tidak ditemukan hal yang biasanya memicu pemblokiran WhatsApp.
        </p>
      </div>
    );
  }

  const warna: Record<string, string> = {
    tinggi: "border-destructive/50 bg-destructive/5",
    sedang: "border-amber-500/50 bg-amber-500/5",
    rendah: "border-border bg-muted/30",
  };
  const labelTingkat: Record<string, string> = {
    tinggi: "Risiko tinggi",
    sedang: "Perlu diperhatikan",
    rendah: "Saran kecil",
  };
  const ringkas = summarizeWarnings(warnings);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-foreground">Pemeriksaan keamanan isi pesan</p>
        <span className="text-xs text-muted-foreground">
          {ringkas.tinggi > 0 ? `${ringkas.tinggi} berisiko tinggi` : `${ringkas.total} catatan`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Ini peringatan, bukan larangan. Isi pesan tetap dapat disimpan — keputusannya di tangan Anda.
      </p>
      {warnings.map((warning) => (
        <div key={warning.code} className={`rounded-xl border p-3 text-sm ${warna[warning.severity]}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-foreground">{warning.label}</p>
            <span className="text-xs text-muted-foreground">{labelTingkat[warning.severity]}</span>
          </div>
          <p className="mt-1 text-muted-foreground">{warning.detail}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {warning.samples.map((sample) => (
              <code key={sample} className="rounded bg-muted px-1.5 py-0.5 text-xs break-all">
                {sample}
              </code>
            ))}
          </div>
          <p className="mt-2 text-xs text-foreground">
            <span className="font-medium">Saran:</span> {warning.fix}
          </p>
        </div>
      ))}
    </div>
  );
}

function TemplateVariablePicker({
  templateId,
  editable,
  requiredPlaceholders,
  detectedPlaceholders,
  queries,
  notifications,
  onInsertPlaceholder,
}: {
  templateId: string;
  editable: boolean;
  requiredPlaceholders: string[];
  detectedPlaceholders: string[];
  queries: AletaBotQuery[];
  notifications: AletaBotNotification[];
  onInsertPlaceholder: (placeholder: string) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  // Sumber data yang benar-benar dipasangkan ke isi pesan ini — dipakai untuk
  // menunjukkan variabel mana yang sudah pasti terpasok datanya.
  const linkedQueries = useMemo(() => {
    const linkedIds = new Set(
      notifications.filter((notification) => notification.templateId === templateId).map((notification) => notification.queryId)
    );
    return queries.filter((query) => linkedIds.has(query.id));
  }, [notifications, queries, templateId]);

  const suppliedBy = useCallback(
    (key: string) => linkedQueries.filter((query) => (query.outputColumns || []).includes(key)),
    [linkedQueries]
  );

  // Gabungan: variabel bawaan ALETA + kolom dari sumber data terpasang +
  // variabel yang sudah dipakai di badan pesan.
  const entries = useMemo(() => {
    const keys = new Set<string>();
    for (const doc of listAletaBotVariableDocs()) keys.add(doc.key);
    for (const query of linkedQueries) for (const column of query.outputColumns || []) keys.add(column);
    for (const key of requiredPlaceholders) keys.add(key);
    for (const key of detectedPlaceholders) keys.add(key);
    return [...keys].map((key) => describeAletaBotVariable(key));
  }, [detectedPlaceholders, linkedQueries, requiredPlaceholders]);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const matched = needle
      ? entries.filter((doc) =>
          `${doc.key} ${doc.label} ${doc.shortDescription}`.toLowerCase().includes(needle)
        )
      : entries;
    // Yang dipakai isi pesan ini didahulukan supaya mudah ditinjau.
    return [...matched].sort((a, b) => {
      const aUsed = detectedPlaceholders.includes(a.key) ? 0 : 1;
      const bUsed = detectedPlaceholders.includes(b.key) ? 0 : 1;
      if (aUsed !== bUsed) return aUsed - bUsed;
      return a.label.localeCompare(b.label, "id");
    });
  }, [detectedPlaceholders, entries, filter]);

  const grouped = useMemo(() => {
    const map = new Map<AletaBotVariableCategory, AletaBotVariableDoc[]>();
    for (const doc of visible) {
      const list = map.get(doc.category) ?? [];
      list.push(doc);
      map.set(doc.category, list);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <p className="text-sm font-semibold text-foreground">Pilihan Variabel &amp; Artinya</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Klik nama variabel untuk membuka penjelasan lengkap, asal data, dan contoh hasilnya. Tombol Sisipkan menaruh variabel itu ke isi pesan.
      </p>

      <input
        type="search"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        placeholder="Cari variabel, mis. sidang atau panjar"
        className="mt-3 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="mt-3 max-h-96 space-y-4 overflow-y-auto pr-1">
        {grouped.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
            Tidak ada variabel yang cocok dengan pencarian itu.
          </p>
        ) : null}

        {grouped.map(([category, docs]) => (
          <div key={category} className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {ALETA_BOT_VARIABLE_CATEGORY_LABELS[category]}
            </p>
            {docs.map((doc) => {
              const isOpen = openKey === doc.key;
              const used = detectedPlaceholders.includes(doc.key);
              const required = requiredPlaceholders.includes(doc.key);
              const sources = suppliedBy(doc.key);
              return (
                <div key={doc.key} className="rounded-lg border border-border bg-background">
                  <div className="flex items-start gap-2 p-2.5">
                    <button
                      type="button"
                      onClick={() => setOpenKey(isOpen ? null : doc.key)}
                      aria-expanded={isOpen}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-foreground">{doc.label}</span>
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-muted-foreground">{`{{${doc.key}}}`}</code>
                        {required ? <Badge variant="warning" className="text-[9px]">wajib</Badge> : null}
                        {used ? <Badge variant="success" className="text-[9px]">dipakai</Badge> : null}
                        {!isKnownAletaBotVariable(doc.key) ? <Badge className="text-[9px]">kolom sumber data</Badge> : null}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{doc.shortDescription}</span>
                      <span className="mt-1 block text-[11px] font-semibold text-primary">
                        {isOpen ? "Tutup penjelasan" : "Lihat penjelasan lengkap"}
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => onInsertPlaceholder(doc.key)}
                      className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-foreground transition hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Sisipkan
                    </button>
                  </div>

                  {isOpen ? (
                    <div className="space-y-3 border-t border-border px-2.5 py-3 text-xs">
                      <div>
                        <p className="font-semibold text-foreground">Penjelasan</p>
                        <p className="mt-1 leading-relaxed text-muted-foreground">{doc.description}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Sumber data</p>
                        <p className="mt-1 leading-relaxed text-muted-foreground">{doc.source}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Dipasok sumber data yang terpasang</p>
                        {sources.length > 0 ? (
                          <ul className="mt-1 space-y-0.5">
                            {sources.map((query) => (
                              <li key={query.id} className="text-muted-foreground">
                                • {queryDisplayName(query)}
                              </li>
                            ))}
                          </ul>
                        ) : linkedQueries.length > 0 ? (
                          <p className="mt-1 text-amber-700 dark:text-amber-300">
                            Belum ada sumber data terpasang yang mengeluarkan kolom ini. Bila dipakai, pesan bisa gagal disusun.
                          </p>
                        ) : (
                          <p className="mt-1 text-muted-foreground">
                            Isi pesan ini belum dipasangkan ke notifikasi mana pun, jadi sumber datanya belum dapat dipastikan.
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Contoh hasil di pesan penerima</p>
                        <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted/60 p-2 font-sans leading-relaxed text-foreground">
                          {doc.example}
                        </pre>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateQuerySuggestions({
  template,
  queries,
  notifications,
  placeholders,
  onInsertPlaceholder,
  onOpenQuery,
}: {
  template: AletaBotTemplate;
  queries: AletaBotQuery[];
  notifications: AletaBotNotification[];
  placeholders: string[];
  onInsertPlaceholder: (placeholder: string) => void;
  onOpenQuery: (query: AletaBotQuery) => void;
}) {
  const linkedQueryIds = new Set(
    notifications.filter((notification) => notification.templateId === template.id).map((notification) => notification.queryId)
  );
  const linked = queries.filter((query) => linkedQueryIds.has(query.id));
  const recommended = queries
    .filter((query) => !linkedQueryIds.has(query.id) && query.isActive)
    .map((query) => ({ query, ...scoreQueryForTemplate(query, placeholders) }))
    .filter((item) => item.score > 0 || item.query.category === template.category)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aSameCategory = a.query.category === template.category ? 0 : 1;
      const bSameCategory = b.query.category === template.category ? 0 : 1;
      return aSameCategory - bSameCategory;
    })
    .slice(0, 6);

  const renderQueryCard = (query: AletaBotQuery, isLinked: boolean) => {
    const { missing } = scoreQueryForTemplate(query, placeholders);
    return (
      <div key={query.id} className="rounded-xl border border-border bg-background p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{queryDisplayName(query)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{query.description || "Tanpa deskripsi."}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={isLinked ? "success" : "outline"}>{isLinked ? "Terpakai" : formatTemplateCategory(query.category)}</Badge>
            <Button size="sm" variant="ghost" onClick={() => onOpenQuery(query)}>
              Lihat
            </Button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {query.outputColumns.length > 0 ? (
            query.outputColumns.map((column) => (
              <button
                key={column}
                type="button"
                onClick={() => onInsertPlaceholder(column)}
                title={`${describeAletaBotVariable(column).label} — ${describeAletaBotVariable(column).shortDescription} Klik untuk menyisipkan {{${column}}}.`}
                className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-foreground transition-colors hover:border-primary hover:bg-primary/10"
              >
                {describeAletaBotVariable(column).label}
              </button>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Sumber data ini tidak mendeklarasikan kolom output.</span>
          )}
        </div>
        {missing.length > 0 ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            Tidak dipasok sumber data ini: {missing.join(", ")}.
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <p className="text-sm font-semibold text-foreground">Sumber Data Terkait</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Klik placeholder untuk menyisipkannya ke isi pesan. Kolom yang tidak dipasok akan tampil kosong saat pesan dikirim.
      </p>

      <div className="mt-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dipakai notifikasi yang memakai isi pesan ini
        </p>
        {linked.length > 0 ? (
          linked.map((query) => renderQueryCard(query, true))
        ) : (
          <p className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            Belum ada notifikasi yang memasangkan isi pesan ini dengan sumber data.
          </p>
        )}
      </div>

      {recommended.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rekomendasi sumber data lain</p>
          {recommended.map((item) => renderQueryCard(item.query, false))}
        </div>
      ) : null}
    </div>
  );
}

export function AletaBotAdminPanel() {
  const { currentUser } = usePortal();
  // Super Admin: semua fitur. Admin: operasional saja — tab/tombol kebijakan
  // disembunyikan (dan tetap ditolak backend bila dipanggil langsung).
  const isSuperAdmin = getEffectiveRoleId(currentUser) === "super-admin";
  const [snapshot, setSnapshot] = useState<AletaBotSnapshot>(emptySnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingRisk, setSavingRisk] = useState(false);
  const [pendingRisk, setPendingRisk] = useState(1);
  const [notice, setNoticeState] = useState<NoticeState | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [recipientPreview, setRecipientPreview] = useState<RecipientPreviewResult | null>(null);
  const [settingsDraft, setSettingsDraft] = useState(emptySnapshot.settings);
  const [templateDraft, setTemplateDraft] = useState<Record<string, string>>({});
  const [testMessage, setTestMessage] = useState("Tes ALETA Bot dari portal berhasil.");
  const [manualSendProgress, setManualSendProgress] = useState<AletaBotActionResult | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("admin-test");
  const [selectedQueryId, setSelectedQueryId] = useState("formatter-phone-number");
  const [selectedNotificationId, setSelectedNotificationId] = useState("");
  const [notificationForm, setNotificationForm] = useState<NotificationForm>(() => makeEmptyNotificationForm());
  const [queryForm, setQueryForm] = useState<QueryForm>(() => makeEmptyQueryForm());
  const [dbConnectionForm, setDbConnectionForm] = useState<DbConnectionForm>(() => makeEmptyDbConnectionForm());
  const [publicQaIntentForm, setPublicQaIntentForm] = useState<PublicQaIntentForm>(() => makeEmptyPublicQaIntentForm());
  const [publicQaQuestion, setPublicQaQuestion] = useState("Saya mau tahu jadwal sidang saya");
  const [publicQaTestResult, setPublicQaTestResult] = useState<string | null>(null);
  const [publicQaReviewFilter, setPublicQaReviewFilter] = useState<"all" | "needs_review" | "reviewed" | "ignored" | "converted_to_intent">("needs_review");
  const [publicQaReviewNote, setPublicQaReviewNote] = useState("");
  const [publicQaConvertMode, setPublicQaConvertMode] = useState<"new" | "existing">("new");
  const [publicQaConvertIntentId, setPublicQaConvertIntentId] = useState("");
  const [publicQaDraftIntentKey, setPublicQaDraftIntentKey] = useState("");
  const [publicQaDraftIntentName, setPublicQaDraftIntentName] = useState("");
  const [deadlineReminderPreview, setDeadlineReminderPreview] = useState<AletaBotDeadlineReminderDryRunResult | null>(null);
  const [deadlineConfirmText, setDeadlineConfirmText] = useState("");
  const [deadlinePilotUserIdsText, setDeadlinePilotUserIdsText] = useState("");
  const [deadlinePilotRoleIdsText, setDeadlinePilotRoleIdsText] = useState("");
  const [deadlinePilotPositionIdsText, setDeadlinePilotPositionIdsText] = useState("");
  const [deadlineSchedulerTime, setDeadlineSchedulerTime] = useState("08:00:00");
  const [policySkipReasonFilter, setPolicySkipReasonFilter] = useState("all");
  const [smokeTestResult, setSmokeTestResult] = useState<OperationalSmokeTestResult | null>(null);
  const [runtimeDashboard, setRuntimeDashboard] = useState<RuntimeDashboardSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeModal, setActiveModal] = useState<AletaBotModal | null>(null);
  const [modalDirty, setModalDirty] = useState(false);
  const [legacyActionNotes, setLegacyActionNotes] = useState("");
  const [legacyActionResult, setLegacyActionResult] = useState<string | null>(null);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [showDbPassword, setShowDbPassword] = useState(false);
  const [showAdvancedMode, setShowAdvancedMode] = useState<boolean>(() => {
    try { return localStorage.getItem("aleta-bot-admin-advanced") === "true"; } catch { return false; }
  });
  const setAdvancedModePreference = (next: boolean) => {
    try { localStorage.setItem("aleta-bot-admin-advanced", String(next)); } catch { /* ignore */ }
    setShowAdvancedMode(next);
  };
  const toggleAdvancedMode = () => {
    const next = !showAdvancedMode;
    setAdvancedModePreference(next);
    if (!next && !SIMPLE_MODE_TAB_VALUES.has(activeTab)) {
      setActiveTab("dashboard");
    }
  };
  const [notifCategoryFilter, setNotifCategoryFilter] = useState<"all" | "employee" | "party">("all");
  const [logFilter, setLogFilter] = useState<"all" | "error" | "whatsapp" | "ai" | "queue" | "approval" | "migration">("all");
  const [whatsappReportRange, setWhatsappReportRange] = useState("7d");
  const [whatsappReportStatus, setWhatsappReportStatus] = useState("all");
  const [whatsappReportSource, setWhatsappReportSource] = useState("all");
  const [whatsappReport, setWhatsappReport] = useState<WhatsappReportSummary | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [isReportExporting, setIsReportExporting] = useState(false);
  const [isLatestReportExporting, setIsLatestReportExporting] = useState(false);
  const [whatsappReportExportInfo, setWhatsappReportExportInfo] = useState<{
    filename: string;
    rowCount: number;
    sizeKb: number;
    exportedAt: string;
  } | null>(null);
  const [latestReportExportInfo, setLatestReportExportInfo] = useState<{
    filename: string;
    rowCount: number;
    sizeKb: number;
    exportedAt: string;
  } | null>(null);
  const [reportTableSearch, setReportTableSearch] = useState("");
  const [reportTableStatusFilter, setReportTableStatusFilter] = useState("all");
  const [reportTableAppFilter, setReportTableAppFilter] = useState("all");
  const [reportTableFeatureFilter, setReportTableFeatureFilter] = useState("all");
  const [reportTableSortKey, setReportTableSortKey] = useState<ReportTableSortKey>("createdAt");
  const [reportTableSortDirection, setReportTableSortDirection] = useState<ReportTableSortDirection>("desc");
  const [operationFeedback, setOperationFeedback] = useState<OperationFeedbackState | null>(null);
  const operationFeedbackTimerRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const sourceDataTopScrollRef = useRef<HTMLDivElement | null>(null);
  const sourceDataTableScrollRef = useRef<HTMLDivElement | null>(null);
  const sourceDataIsSyncingScrollRef = useRef(false);

  const syncSourceDataHorizontalScroll = (source: "top" | "table") => {
    if (sourceDataIsSyncingScrollRef.current) return;
    const from = source === "top" ? sourceDataTopScrollRef.current : sourceDataTableScrollRef.current;
    const to = source === "top" ? sourceDataTableScrollRef.current : sourceDataTopScrollRef.current;
    if (!from || !to) return;
    sourceDataIsSyncingScrollRef.current = true;
    to.scrollLeft = from.scrollLeft;
    window.requestAnimationFrame(() => {
      sourceDataIsSyncingScrollRef.current = false;
    });
  };

  const scrollSourceDataTable = (direction: "left" | "right") => {
    const target = sourceDataTableScrollRef.current;
    if (!target) return;
    target.scrollBy({
      left: direction === "left" ? -520 : 520,
      behavior: "smooth",
    });
  };

  const clearOperationFeedbackTimer = useCallback(() => {
    if (!operationFeedbackTimerRef.current) return;
    globalThis.clearTimeout(operationFeedbackTimerRef.current);
    operationFeedbackTimerRef.current = null;
  }, []);

  const showOperationResult = useCallback(
    (phase: "success" | "error", title: string, message: string) => {
      clearOperationFeedbackTimer();
      setOperationFeedback({
        phase,
        title,
        message,
        updatedAt: new Date().toISOString(),
      });
      operationFeedbackTimerRef.current = globalThis.setTimeout(() => {
        setOperationFeedback(null);
        operationFeedbackTimerRef.current = null;
      }, phase === "success" ? 2200 : 3600);
    },
    [clearOperationFeedbackTimer]
  );

  const setNotice = useCallback((nextNotice: Omit<NoticeState, "updatedAt"> | string | null) => {
    if (!nextNotice) {
      setNoticeState(null);
      clearOperationFeedbackTimer();
      setOperationFeedback(null);
      return;
    }

    if (typeof nextNotice === "string") {
      setNoticeState({
        tone: "info",
        title: "Informasi ALETA Bot",
        message: nextNotice,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const updatedNotice = {
      ...nextNotice,
      updatedAt: new Date().toISOString(),
    };
    setNoticeState(updatedNotice);
    if (nextNotice.tone === "success") {
      showOperationResult("success", nextNotice.title, nextNotice.message);
    } else if (nextNotice.tone === "danger") {
      showOperationResult("error", nextNotice.title, nextNotice.message);
    }
  }, [clearOperationFeedbackTimer, showOperationResult]);

  const notifySuccess = useCallback(
    (title: string, message: string) => setNotice({ tone: "success", title, message }),
    [setNotice]
  );
  const notifyWarning = useCallback(
    (title: string, message: string) => setNotice({ tone: "warning", title, message }),
    [setNotice]
  );
  const notifyError = useCallback(
    (title: string, message: string) => setNotice({ tone: "danger", title, message }),
    [setNotice]
  );
  const isActionBusy = isSaving || isReportLoading || isReportExporting || isLatestReportExporting;
  const operationFeedbackPhase = operationFeedback?.phase;
  const shouldShowBusyFeedback = isActionBusy && (!operationFeedback || operationFeedbackPhase === "loading");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (shouldShowBusyFeedback) {
        clearOperationFeedbackTimer();
        setOperationFeedback({
          phase: "loading",
          title: "ALETA Sedang Memproses",
          message: "Mohon tunggu, permintaan sedang diproses.",
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      if (!isActionBusy && operationFeedbackPhase === "loading") {
        setOperationFeedback(null);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [clearOperationFeedbackTimer, isActionBusy, operationFeedbackPhase, shouldShowBusyFeedback]);

  useEffect(() => () => clearOperationFeedbackTimer(), [clearOperationFeedbackTimer]);

  const navigateAdminAction = (href: string) => {
    if (!href.startsWith("#")) {
      window.location.assign(href.startsWith("/") ? apiPath(href) : href);
      return;
    }
    const targetId = href.slice(1);
    const tabByAnchor: Record<string, string> = {
      "status-whatsapp": "connection",
      "status-bot": "settings",
      "pengaturan-bot": "settings",
      "notifikasi": "notifications",
      "logs": "logs",
      "reports": "reports",
      "database": "database",
      "ai-bridge": "dashboard",
      "public-qa": "public-qa",
      "queue-recovery": "queue-recovery",
      "approvals": "approvals",
      "templates": "templates",
      "policy-skip": "dashboard",
      "reminder-deadline": "dashboard",
    };
    const nextTab = tabByAnchor[targetId] ?? "dashboard";
    if (
      ["templates", "queries", "migration", "manual-test"].includes(nextTab) ||
      targetId === "ai-bridge" ||
      (!showAdvancedMode && !SIMPLE_MODE_TAB_VALUES.has(nextTab))
    ) {
      setAdvancedModePreference(true);
    }
    setActiveTab(nextTab);
    window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      window.setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    });
  };

  const openModal = (modal: AletaBotModal) => {
    setModalDirty(false);
    if (modal.type === "database") {
      setShowDbPassword(false);
    }
    if (modal.type === "legacyAction") {
      setLegacyActionNotes("");
      setLegacyActionResult(null);
    }
    if (modal.type === "publicQaConvert") {
      const key = makePublicQaDraftKey(modal.review.suggestedIntentKey || modal.review.rawMessage);
      setPublicQaConvertMode("new");
      setPublicQaConvertIntentId(snapshot.publicQaIntents.find((intent) => intent.status !== "archived")?.id ?? "");
      setPublicQaDraftIntentKey(key || "aturan_publik_baru");
      setPublicQaDraftIntentName(`Draft Aturan: ${modal.review.rawMessage.slice(0, 48)}`);
      setPublicQaReviewNote(modal.review.reviewNote || "");
    }
    setActiveModal(modal);
  };

  const closeModal = () => {
    if (modalDirty && !window.confirm("Tutup modal tanpa menyimpan perubahan?")) return;
    setActiveModal(null);
    setModalDirty(false);
  };

  const markModalDirty = () => setModalDirty(true);

  const loadRuntimeDashboard = useCallback(async () => {
    try {
      const data = await requestBot<RuntimeDashboardSnapshot>("/api/admin/aleta-bot/runtime-dashboard");
      setRuntimeDashboard(data);
      return data;
    } catch {
      setRuntimeDashboard(null);
      return null;
    }
  }, []);

  const loadSnapshot = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await requestBot<AletaBotSnapshot>("/api/admin/aleta-bot");
      setSnapshot(data);
      setSettingsDraft(data.settings);
      setDeadlinePilotUserIdsText(data.settings.deadlineReminderPilotUserIds.join(", "));
      setDeadlinePilotRoleIdsText(data.settings.deadlineReminderPilotRoleIds.join(", "));
      setDeadlinePilotPositionIdsText(data.settings.deadlineReminderPilotPositionIds.join(", "));
      setDeadlineSchedulerTime(data.settings.deadlineReminderSchedulerTime);
      setTemplateDraft(Object.fromEntries(data.templates.map((template) => [template.id, template.body])));
      setSelectedTemplateId(data.templates.find((template) => template.id === "admin-test")?.id ?? data.templates[0]?.id ?? "");
      setSelectedQueryId(data.queries[0]?.id ?? data.queryCatalog[0]?.id ?? "");
      setSelectedNotificationId(data.notifications[0]?.id ?? "");
      setNotificationForm(makeEmptyNotificationForm(data));
      setQueryForm(makeEmptyQueryForm());
      setDbConnectionForm(data.dbConnections[0] ? dbConnectionToForm(data.dbConnections[0]) : makeEmptyDbConnectionForm());
      setPublicQaIntentForm(data.publicQaIntents[0] ? publicQaIntentToForm(data.publicQaIntents[0]) : makeEmptyPublicQaIntentForm());
      await loadRuntimeDashboard();
      return true;
    } catch (error) {
      notifyError("Gagal Memuat ALETA Bot", error instanceof Error ? error.message : "Data ALETA Bot belum bisa dimuat.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadRuntimeDashboard, notifyError]);

  const loadWhatsappReport = useCallback(async (
    overrides?: Partial<{ range: string; status: string; sourceApp: string }>,
    options: { silent?: boolean } = {}
  ) => {
    const nextRange = overrides?.range ?? whatsappReportRange;
    const nextStatus = overrides?.status ?? whatsappReportStatus;
    const nextSource = overrides?.sourceApp ?? whatsappReportSource;
    if (!options.silent) setIsReportLoading(true);
    try {
      const params = new URLSearchParams({
        range: nextRange,
        status: nextStatus,
        sourceApp: nextSource,
        limit: "200",
      });
      const data = await requestBot<WhatsappReportSummary>(`/api/admin/aleta-bot/whatsapp-report?${params.toString()}`);
      setWhatsappReport(data);
      return data;
    } catch (error) {
      if (!options.silent) {
        notifyError("Laporan WhatsApp Gagal Dimuat", error instanceof Error ? error.message : "Data laporan belum bisa dimuat.");
      }
      return null;
    } finally {
      if (!options.silent) setIsReportLoading(false);
    }
  }, [notifyError, whatsappReportRange, whatsappReportSource, whatsappReportStatus]);

  const applyWhatsappReportFilters = useCallback(
    (filters: Partial<{ range: string; status: string; sourceApp: string }>) => {
      const nextRange = filters.range ?? whatsappReportRange;
      const nextStatus = filters.status ?? whatsappReportStatus;
      const nextSource = filters.sourceApp ?? whatsappReportSource;
      setWhatsappReportRange(nextRange);
      setWhatsappReportStatus(nextStatus);
      setWhatsappReportSource(nextSource);
      void loadWhatsappReport({ range: nextRange, status: nextStatus, sourceApp: nextSource });
    },
    [loadWhatsappReport, whatsappReportRange, whatsappReportSource, whatsappReportStatus]
  );

  const exportWhatsappReportExcel = async () => {
    setIsReportExporting(true);
    const params = new URLSearchParams({
      format: "xlsx",
      range: whatsappReportRange,
      status: whatsappReportStatus,
      sourceApp: whatsappReportSource,
    });
    try {
      const response = await fetch(apiPath(`/api/admin/aleta-bot/whatsapp-report?${params.toString()}`), {
        credentials: "include",
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Excel belum bisa dibuat.");
      }
      const blob = await response.blob();
      const filename = parseDownloadFilename(
        response.headers.get("content-disposition"),
        `laporan-whatsapp-${whatsappReportSource}-${whatsappReportRange}.xlsx`
      );
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      const rowCount = Number(response.headers.get("x-aleta-export-row-count") || 0);
      setWhatsappReportExportInfo({
        filename,
        rowCount,
        sizeKb: Math.max(1, Math.round(blob.size / 1024)),
        exportedAt: new Date().toISOString(),
      });
      notifySuccess("Excel Berhasil Dibuat", `${filename} berisi ${rowCount} baris data.`);
    } catch (error) {
      notifyError("Cetak Excel Gagal", error instanceof Error ? error.message : "File Excel belum berhasil dibuat.");
    } finally {
      setIsReportExporting(false);
    }
  };

  const exportLatestWhatsappRowsExcel = async () => {
    setIsLatestReportExporting(true);
    const params = new URLSearchParams({
      format: "latest-xlsx",
      range: whatsappReportRange,
      status: whatsappReportStatus,
      sourceApp: whatsappReportSource,
      tableSearch: reportTableSearch,
      tableStatus: reportTableStatusFilter,
      tableApp: reportTableAppFilter,
      tableFeature: reportTableFeatureFilter,
      sortKey: reportTableSortKey,
      sortDirection: reportTableSortDirection,
    });
    try {
      const response = await fetch(apiPath(`/api/admin/aleta-bot/whatsapp-report?${params.toString()}`), {
        credentials: "include",
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Excel Data Terbaru belum bisa dibuat.");
      }
      const blob = await response.blob();
      const filename = parseDownloadFilename(
        response.headers.get("content-disposition"),
        `data-terbaru-whatsapp-${whatsappReportSource}-${whatsappReportRange}.xlsx`
      );
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      const rowCount = Number(response.headers.get("x-aleta-export-row-count") || 0);
      setLatestReportExportInfo({
        filename,
        rowCount,
        sizeKb: Math.max(1, Math.round(blob.size / 1024)),
        exportedAt: new Date().toISOString(),
      });
      notifySuccess("Excel Data Terbaru Dibuat", `${filename} berisi ${rowCount} baris sesuai filter tabel.`);
    } catch (error) {
      notifyError("Cetak Excel Data Terbaru Gagal", error instanceof Error ? error.message : "File Excel Data Terbaru belum berhasil dibuat.");
    } finally {
      setIsLatestReportExporting(false);
    }
  };

  const refreshSnapshot = useCallback(
    async (scope: "panel" | "whatsapp" = "panel") => {
      setNotice(null);
      const refreshed = await loadSnapshot();
      if (!refreshed) return;
      notifySuccess(
        scope === "whatsapp" ? "Status WhatsApp Diperbarui" : "Data ALETA Bot Diperbarui",
        scope === "whatsapp"
          ? "QR dan status koneksi WhatsApp sudah dimuat ulang dari runtime ALETA Bot."
          : "Data panel ALETA Bot sudah dimuat ulang dari database dan runtime."
      );
    },
    [loadSnapshot, notifySuccess, setNotice]
  );

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      void loadSnapshot();
    }, 0);

    return () => globalThis.clearTimeout(timer);
  }, [loadSnapshot]);

  useEffect(() => {
    setPendingRisk(snapshot.settings.sendingRiskLevel);
  }, [snapshot.settings.sendingRiskLevel]);

  useEffect(() => {
    if (!["initializing", "waiting_qr"].includes(snapshot.whatsapp.runtimeStatus)) return;

    const timer = globalThis.setInterval(() => {
      void loadSnapshot();
    }, 2500);

    return () => globalThis.clearInterval(timer);
  }, [loadSnapshot, snapshot.whatsapp.runtimeStatus]);

  useEffect(() => {
    if (activeTab !== "reports") return;
    const initialTimer = globalThis.setTimeout(() => {
      void loadWhatsappReport();
    }, 0);
    const refreshTimer = globalThis.setInterval(() => {
      void loadWhatsappReport(undefined, { silent: true });
    }, 7000);

    return () => {
      globalThis.clearTimeout(initialTimer);
      globalThis.clearInterval(refreshTimer);
    };
  }, [activeTab, loadWhatsappReport]);

  const settingsDraftChanged = useMemo(
    () =>
      settingsDraft.botEnabled !== snapshot.settings.botEnabled ||
      settingsDraft.notificationsEnabled !== snapshot.settings.notificationsEnabled ||
      settingsDraft.dryRunEnabled !== snapshot.settings.dryRunEnabled ||
      settingsDraft.adminWhatsappNumber !== snapshot.settings.adminWhatsappNumber ||
      settingsDraft.testTargetNumber !== snapshot.settings.testTargetNumber ||
      Number(settingsDraft.messageDelayMs) !== Number(snapshot.settings.messageDelayMs) ||
      Number(settingsDraft.retryLimit) !== Number(snapshot.settings.retryLimit) ||
      settingsDraft.scheduleCron !== snapshot.settings.scheduleCron ||
      settingsDraft.securityNotes !== snapshot.settings.securityNotes,
    [settingsDraft, snapshot.settings]
  );

  const saveSettings = async (
    draft = settingsDraft,
    options: { closeModal?: boolean; successMessage?: string } = {}
  ) => {
    setIsSaving(true);
    setNotice(null);
    try {
      const settingsPayload = {
        botEnabled: draft.botEnabled,
        notificationsEnabled: draft.notificationsEnabled,
        dryRunEnabled: draft.dryRunEnabled,
        adminWhatsappNumber: draft.adminWhatsappNumber,
        testTargetNumber: draft.testTargetNumber,
        messageDelayMs: draft.messageDelayMs,
        sendingRiskLevel: draft.sendingRiskLevel,
        retryLimit: draft.retryLimit,
        scheduleCron: draft.scheduleCron,
        securityNotes: draft.securityNotes,
      };
      const data = await requestBot<AletaBotSnapshot>("/api/admin/aleta-bot", {
        method: "PUT",
        body: JSON.stringify({ settings: settingsPayload }),
      });
      setSnapshot(data);
      setSettingsDraft(data.settings);
      setModalDirty(false);
      const dashboard = await loadRuntimeDashboard();
      if (options.closeModal !== false) {
        setActiveModal(null);
      }
      const runtimeBot = dashboard?.payload?.bot;
      const runtimeOutOfSync = Boolean(
        dashboard?.online &&
        runtimeBot &&
        (
          (typeof runtimeBot.botEnabled === "boolean" && runtimeBot.botEnabled !== data.settings.botEnabled) ||
          (typeof runtimeBot.notificationsEnabled === "boolean" && runtimeBot.notificationsEnabled !== data.settings.notificationsEnabled) ||
          (typeof runtimeBot.dryRunEnabled === "boolean" && runtimeBot.dryRunEnabled !== data.settings.dryRunEnabled)
        )
      );
      if (!dashboard?.online) {
        notifyWarning(
          "Pengaturan Tersimpan, Layanan Bot Belum Terkonfirmasi",
          "Perubahan sudah masuk database portal. Layanan ALETA Bot belum dapat dibaca, jadi sinkronkan pengaturan setelah layanan aktif."
        );
      } else if (runtimeOutOfSync) {
        notifyWarning(
          "Pengaturan Tersimpan, Layanan Bot Perlu Sinkron",
          "Data portal sudah berubah, tetapi layanan bot masih menampilkan pengaturan lama. Klik Sinkronkan Pengaturan atau cek layanan ALETA Bot."
        );
      } else {
        notifySuccess(
          "Pengaturan ALETA Bot Berhasil Diubah",
          options.successMessage ?? "Bot aktif, notifikasi, simulasi, nomor admin, dan pengaturan utama sudah tersimpan serta dashboard layanan diperbarui."
        );
      }
    } catch (error) {
      notifyError("Pengaturan Gagal Disimpan", error instanceof Error ? error.message : "Perubahan pengaturan ALETA Bot belum berhasil disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const applyRiskLevel = async (level: number) => {
    const target = Math.min(5, Math.max(1, Math.round(Number(level) || 1)));
    if (target === snapshot.settings.sendingRiskLevel) {
      return;
    }
    const preset = snapshot.sendingRiskPresets.find((item) => item.level === target);
    setSavingRisk(true);
    setNotice(null);
    try {
      const data = await requestBot<AletaBotSnapshot>("/api/admin/aleta-bot", {
        method: "PUT",
        body: JSON.stringify({ settings: { sendingRiskLevel: target } }),
      });
      setSnapshot(data);
      setSettingsDraft(data.settings);
      const dashboard = await loadRuntimeDashboard();
      const label = preset?.label ?? `Level ${target}`;
      const suspend = preset?.suspendRisk ?? "";
      if (!dashboard?.online) {
        notifyWarning(
          `Mode Risiko Diubah ke ${label}, Layanan Bot Belum Terkonfirmasi`,
          "Perubahan sudah masuk database portal. Sinkronkan setelah layanan ALETA Bot aktif agar batas kirim baru dipakai."
        );
      } else {
        const jarak = preset
          ? `${Math.round(preset.sendingGapMinMs / 1000)}–${Math.round(preset.sendingGapMaxMs / 1000)} dtk`
          : "";
        notifySuccess(
          `Mode Risiko: ${label}`,
          `Seluruh sistem kirim kini memakai preset ${label}${suspend ? ` (risiko suspend/banned ${suspend.toLowerCase()})` : ""}.` +
            (jarak ? ` Pesan berikutnya dijadwalkan berjarak ${jarak} satu sama lain.` : "") +
            " Jam kirim, jeda per nomor, batas pengaman, dan batch antrean ikut menyesuaikan."
        );
      }
    } catch (error) {
      notifyError("Mode Risiko Gagal Diubah", error instanceof Error ? error.message : "Preset risiko pengiriman belum berhasil diterapkan.");
    } finally {
      setSavingRisk(false);
    }
  };

  const saveTemplate = async (template: AletaBotTemplate) => {
    setIsSaving(true);
    setNotice(null);
    try {
      const data = await requestBot<AletaBotSnapshot>("/api/admin/aleta-bot", {
        method: "PUT",
        body: JSON.stringify({
          template: {
            id: template.id,
          body: templateDraft[template.id] ?? template.body,
          },
        }),
      });
      setSnapshot(data);
      setTemplateDraft(Object.fromEntries(data.templates.map((item) => [item.id, item.body])));
      await loadRuntimeDashboard();
      setActiveModal(null);
      setModalDirty(false);
      notifySuccess("Isi Pesan Berhasil Diubah", `Isi pesan "${template.title}" sudah tersimpan dan data panel diperbarui.`);
    } catch (error) {
      notifyError("Isi Pesan Gagal Disimpan", error instanceof Error ? error.message : "Perubahan isi pesan belum berhasil disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveNotification = async () => {
    if (notificationForm.scheduleType === "cron" && notificationForm.scheduleCron && !isValidCronExpression(notificationForm.scheduleCron)) {
      notifyWarning("Jadwal Notifikasi Belum Valid", "Format cron belum valid. Perbaiki jadwal sebelum menyimpan notifikasi.");
      return;
    }
    setIsSaving(true);
    setNotice(null);
    try {
      const selectedQuery = snapshot.queries.find((query) => query.id === notificationForm.queryId);
      const data = await requestBot<AletaBotSnapshot>("/api/admin/aleta-bot", {
        method: "PUT",
        body: JSON.stringify({
          notification: {
            id: notificationForm.id || undefined,
            name: notificationForm.name,
            category: notificationForm.category,
            description: notificationForm.description,
            queryId: notificationForm.queryId,
            templateId: notificationForm.templateId,
            recipientMapping: buildNotificationRecipientMapping(notificationForm, selectedQuery),
            scheduleConfig: {
              type: notificationForm.scheduleType,
              cron: notificationForm.scheduleCron,
              trigger: notificationForm.scheduleTrigger,
            },
            isActive: notificationForm.isActive,
            attachDocument: notificationForm.attachDocument,
            delayMs: notificationForm.delayMs,
            retryLimit: notificationForm.retryLimit,
          },
        }),
      });
      setSnapshot(data);
      setNotificationForm(makeEmptyNotificationForm(data, notificationForm.category));
      await loadRuntimeDashboard();
      setActiveModal(null);
      setModalDirty(false);
      notifySuccess("Notifikasi Berhasil Diubah", `Notifikasi "${notificationForm.name || "ALETA Bot"}" sudah tersimpan dan data layanan diperbarui.`);
    } catch (error) {
      notifyError("Notifikasi Gagal Disimpan", error instanceof Error ? error.message : "Perubahan notifikasi belum berhasil disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveQuery = async () => {
    setIsSaving(true);
    setNotice(null);
    try {
      const data = await requestBot<AletaBotSnapshot>("/api/admin/aleta-bot", {
        method: "PUT",
        body: JSON.stringify({
          query: {
            id: queryForm.id || undefined,
            name: queryForm.name,
            category: queryForm.category,
            description: queryForm.description,
            sqlText: queryForm.sqlText,
            outputColumns: queryForm.outputColumns,
            recipientColumn: queryForm.recipientColumn,
            connectionKey: queryForm.connectionKey,
            isActive: queryForm.isActive,
          },
        }),
      });
      setSnapshot(data);
      setQueryForm(makeEmptyQueryForm(queryForm.category));
      await loadRuntimeDashboard();
      setActiveModal(null);
      setModalDirty(false);
      notifySuccess("Sumber Data Berhasil Diubah", `Sumber data "${queryForm.name || "ALETA Bot"}" sudah tersimpan dan data panel diperbarui.`);
    } catch (error) {
      notifyError("Sumber Data Gagal Disimpan", error instanceof Error ? error.message : "Perubahan sumber data belum berhasil disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveDbConnection = async () => {
    setIsSaving(true);
    setNotice(null);
    try {
      const data = await requestBot<AletaBotSnapshot>("/api/admin/aleta-bot", {
        method: "PUT",
        body: JSON.stringify({
          dbConnection: {
            ...dbConnectionForm,
            driver: "mysql",
          },
        }),
      });
      setSnapshot(data);
      setDbConnectionForm(data.dbConnections.find((item) => item.key === dbConnectionForm.key) ? dbConnectionToForm(data.dbConnections.find((item) => item.key === dbConnectionForm.key)!) : makeEmptyDbConnectionForm());
      await loadRuntimeDashboard();
      setActiveModal(null);
      setModalDirty(false);
      notifySuccess("Koneksi Database Berhasil Diubah", `Koneksi "${dbConnectionForm.name || dbConnectionForm.key}" sudah tersimpan dan daftar koneksi diperbarui.`);
    } catch (error) {
      notifyError("Koneksi Database Gagal Disimpan", error instanceof Error ? error.message : "Perubahan koneksi SQL belum berhasil disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const testDbConnection = async (connectionKey: string) => {
    setIsSaving(true);
    setNotice(null);
    try {
      const data = await requestBot<{ snapshot: AletaBotSnapshot; result: { status: string; error?: string } }>("/api/admin/aleta-bot/db-connections", {
        method: "POST",
        body: JSON.stringify({ action: "test", connectionKey }),
      });
      setSnapshot(data.snapshot);
      await loadRuntimeDashboard();
      if (data.result.status === "success") {
        notifySuccess("Uji Koneksi SQL Berhasil", "Koneksi database aktif berhasil diuji dan status panel sudah diperbarui.");
      } else {
        notifyWarning("Uji Koneksi SQL Belum Berhasil", data.result.error || "Periksa host, user, password, dan nama database.");
      }
    } catch (error) {
      notifyError("Uji Koneksi SQL Gagal", error instanceof Error ? error.message : "Uji koneksi SQL belum berhasil diproses.");
    } finally {
      setIsSaving(false);
    }
  };

  const testDbConnectionDraft = async () => {
    setIsSaving(true);
    setNotice(null);
    try {
      const data = await requestBot<{ snapshot: AletaBotSnapshot; result: { status: string; error?: string } }>("/api/admin/aleta-bot/db-connections", {
        method: "POST",
        body: JSON.stringify({
          action: "test-draft",
          connectionKey: dbConnectionForm.key,
          connection: {
            ...dbConnectionForm,
            driver: "mysql",
          },
        }),
      });
      setSnapshot(data.snapshot);
      await loadRuntimeDashboard();
      if (data.result.status === "success") {
        notifySuccess("Uji Koneksi Form Berhasil", "Data koneksi pada form berhasil diuji. Panel koneksi sudah diperbarui.");
      } else {
        notifyWarning("Uji Koneksi Form Belum Berhasil", data.result.error || "Periksa host, port, username, password, dan nama database.");
      }
    } catch (error) {
      notifyError("Uji Koneksi Form Gagal", error instanceof Error ? error.message : "Uji koneksi SQL belum berhasil diproses.");
    } finally {
      setIsSaving(false);
    }
  };

  const savePublicQaIntent = async () => {
    setIsSaving(true);
    setNotice(null);
    try {
      const data = await requestBot<AletaBotSnapshot>("/api/admin/aleta-bot", {
        method: "PUT",
        body: JSON.stringify({
          publicQaIntent: {
            ...publicQaIntentForm,
            exactTriggers: publicQaIntentForm.exactTriggers,
            exampleQuestions: publicQaIntentForm.exampleQuestions,
            requiredParameters: publicQaIntentForm.requiredParameters,
          },
        }),
      });
      setSnapshot(data);
      const saved = data.publicQaIntents.find((item) => item.key === publicQaIntentForm.key);
      setPublicQaIntentForm(saved ? publicQaIntentToForm(saved) : makeEmptyPublicQaIntentForm());
      await loadRuntimeDashboard();
      setActiveModal(null);
      setModalDirty(false);
      notifySuccess("Aturan Jawaban Berhasil Diubah", `Aturan "${publicQaIntentForm.name || publicQaIntentForm.key}" sudah tersimpan dan dashboard diperbarui.`);
    } catch (error) {
      notifyError("Aturan Jawaban Gagal Disimpan", error instanceof Error ? error.message : "Perubahan aturan jawaban belum berhasil disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const testPublicQaIntent = async () => {
    setIsSaving(true);
    setNotice(null);
    setPublicQaTestResult(null);
    try {
      const data = await requestBot<{ result: unknown }>("/api/admin/aleta-bot/public-qa", {
        method: "POST",
        body: JSON.stringify({ action: "test", question: publicQaQuestion }),
      });
      setPublicQaTestResult(JSON.stringify(data.result, null, 2));
      notifySuccess("Uji Pertanyaan Berhasil", "Pertanyaan diproses untuk pratinjau tanpa mengirim WhatsApp.");
    } catch (error) {
      notifyError("Uji Pertanyaan Gagal", error instanceof Error ? error.message : "Uji aturan jawaban belum berhasil.");
    } finally {
      setIsSaving(false);
    }
  };

  const submitPublicQaReview = async (reviewStatus: AletaBotUnknownQuestionReview["reviewStatus"]) => {
    if (activeModal?.type !== "publicQaReview") return;
    setIsSaving(true);
    setNotice(null);
    try {
      const data = await requestBot<AletaBotSnapshot>("/api/admin/aleta-bot/public-qa", {
        method: "POST",
        body: JSON.stringify({
          action: "review",
          logIds: activeModal.review.logIds,
          normalizedMessage: activeModal.review.normalizedMessage,
          reviewStatus,
          reviewNote: publicQaReviewNote,
        }),
      });
      setSnapshot(data);
      await loadRuntimeDashboard();
      setPublicQaReviewNote("");
      setActiveModal(null);
      setModalDirty(false);
      notifySuccess("Tinjauan Pertanyaan Berhasil Diubah", `Status tinjauan diubah menjadi ${displayStatus(reviewStatus)} tanpa mengirim WhatsApp.`);
    } catch (error) {
      notifyError("Tinjauan Pertanyaan Gagal Disimpan", error instanceof Error ? error.message : "Status tinjauan belum berhasil disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const convertPublicQaReview = async () => {
    if (activeModal?.type !== "publicQaConvert") return;
    setIsSaving(true);
    setNotice(null);
    try {
      const data = await requestBot<AletaBotSnapshot>("/api/admin/aleta-bot/public-qa", {
        method: "POST",
        body: JSON.stringify({
          action: "convert-to-intent",
          logIds: activeModal.review.logIds,
          normalizedMessage: activeModal.review.normalizedMessage,
          reviewNote: publicQaReviewNote,
          mode: publicQaConvertMode,
          targetIntentId: publicQaConvertMode === "existing" ? publicQaConvertIntentId : undefined,
          draftIntentKey: publicQaConvertMode === "new" ? publicQaDraftIntentKey : undefined,
          draftIntentName: publicQaConvertMode === "new" ? publicQaDraftIntentName : undefined,
        }),
      });
      setSnapshot(data);
      await loadRuntimeDashboard();
      setPublicQaReviewNote("");
      setActiveModal(null);
      setModalDirty(false);
      notifySuccess("Aturan Jawaban Dibuat", "Pertanyaan sudah menjadi aturan jawaban yang langsung berlaku. Periksa blangko jawabannya bila perlu disesuaikan.");
    } catch (error) {
      notifyError("Aturan Jawaban Gagal Dibuat", error instanceof Error ? error.message : "Pertanyaan belum berhasil dijadikan aturan jawaban.");
    } finally {
      setIsSaving(false);
    }
  };

  const runDeadlineReminderDryRun = async () => {
    setIsSaving(true);
    setNotice(null);
    setDeadlineReminderPreview(null);
    try {
      const data = await requestBot<AletaBotDeadlineReminderDryRunResult>(
        "/api/admin/aleta-bot/disposition-deadline-reminders/dry-run?limit=20",
        { method: "POST" }
      );
      setDeadlineReminderPreview(data);
      openModal({ type: "deadlineReminderPreview", title: "Simulasi Pengingat Tenggat H-1" });
      await loadSnapshot();
      notifySuccess("Simulasi Pengingat Tenggat Selesai", "Simulasi H-1 selesai, data panel sudah diperbarui, dan tidak ada WhatsApp sungguhan yang dikirim.");
    } catch (error) {
      notifyError("Simulasi Pengingat Tenggat Gagal", error instanceof Error ? error.message : "Simulasi pengingat tenggat belum berhasil.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateDeadlineReminderMode = async (mode: AletaBotSnapshot["settings"]["deadlineReminderMode"]) => {
    setIsSaving(true);
    setNotice(null);
    try {
      const data = await requestBot<AletaBotSnapshot>("/api/admin/aleta-bot/disposition-deadline-reminders/settings", {
        method: "PATCH",
        body: JSON.stringify({
          mode,
          confirmText: deadlineConfirmText,
        }),
      });
      setSnapshot(data);
      setSettingsDraft(data.settings);
      setDeadlineConfirmText("");
      await loadRuntimeDashboard();
      notifySuccess("Mode Pengingat Tenggat Berhasil Diubah", `Mode pengingat tenggat sekarang ${displayStatus(mode)} dan data panel sudah diperbarui.`);
    } catch (error) {
      notifyError("Mode Pengingat Tenggat Gagal Diubah", error instanceof Error ? error.message : "Mode pengingat tenggat belum berhasil diperbarui.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateDeadlineReminderAdvancedSettings = async (overrides: Partial<{
    schedulerEnabled: boolean;
    schedulerMode: AletaBotSnapshot["settings"]["deadlineReminderSchedulerMode"];
    killSwitch: boolean;
    confirmText: string;
  }> = {}) => {
    setIsSaving(true);
    setNotice(null);
    try {
      const data = await requestBot<AletaBotSnapshot>("/api/admin/aleta-bot/disposition-deadline-reminders/settings", {
        method: "PATCH",
        body: JSON.stringify({
          confirmText: overrides.confirmText ?? deadlineConfirmText,
          pilotUserIds: deadlinePilotUserIdsText,
          pilotRoleIds: deadlinePilotRoleIdsText,
          pilotPositionIds: deadlinePilotPositionIdsText,
          schedulerTime: deadlineSchedulerTime,
          schedulerEnabled: overrides.schedulerEnabled,
          schedulerMode: overrides.schedulerMode,
          killSwitch: overrides.killSwitch,
        }),
      });
      setSnapshot(data);
      setSettingsDraft(data.settings);
      setDeadlinePilotUserIdsText(data.settings.deadlineReminderPilotUserIds.join(", "));
      setDeadlinePilotRoleIdsText(data.settings.deadlineReminderPilotRoleIds.join(", "));
      setDeadlinePilotPositionIdsText(data.settings.deadlineReminderPilotPositionIds.join(", "));
      setDeadlineSchedulerTime(data.settings.deadlineReminderSchedulerTime);
      setDeadlineConfirmText("");
      await loadRuntimeDashboard();
      notifySuccess("Kontrol Pengingat Berhasil Diubah", "Daftar pilot, jadwal, penjadwal, atau tombol darurat pengingat sudah diperbarui.");
    } catch (error) {
      notifyError("Kontrol Pengingat Gagal Diubah", error instanceof Error ? error.message : "Kontrol pengingat belum berhasil diperbarui.");
    } finally {
      setIsSaving(false);
    }
  };

  const exportPolicySkipCsv = () => {
    const params = new URLSearchParams({ format: "csv" });
    if (policySkipReasonFilter !== "all") params.set("reason", policySkipReasonFilter);
    window.location.href = apiPath(`/api/admin/aleta-bot/policy-skip-report?${params.toString()}`);
  };

  const exportPilotReadinessCsv = () => {
    window.open(apiPath("/api/admin/aleta-bot/pilot-readiness?format=csv"), "_blank", "noopener,noreferrer");
  };

  const runOperationalSmokeTest = async () => {
    setIsSaving(true);
    setNotice(null);
    setSmokeTestResult(null);
    try {
      const data = await requestBot<OperationalSmokeTestResult>("/api/admin/aleta-bot/operational-smoke-test");
      setSmokeTestResult(data);
      await loadRuntimeDashboard();
      (data.overallStatus === "passed" ? notifySuccess : notifyWarning)(
        data.overallStatus === "passed" ? "Pemeriksaan Operasional Lulus" : "Pemeriksaan Operasional Selesai Dengan Catatan",
        data.overallStatus === "passed"
          ? "Pemeriksaan operasional lulus tanpa mengirim WhatsApp."
          : "Pemeriksaan selesai dengan catatan. Tidak ada WhatsApp yang dikirim."
      );
    } catch (error) {
      notifyError("Pemeriksaan Operasional Gagal", error instanceof Error ? error.message : "Pemeriksaan operasional belum berhasil.");
    } finally {
      setIsSaving(false);
    }
  };

  const runDeadlineReminderSchedulerDryRun = async () => {
    setIsSaving(true);
    setNotice(null);
    setDeadlineReminderPreview(null);
    try {
      const data = await requestBot<AletaBotDeadlineReminderDryRunResult>(
        "/api/admin/aleta-bot/disposition-deadline-reminders/scheduler-run",
        {
          method: "POST",
          body: JSON.stringify({ force: true, limit: 20 }),
        }
      );
      setDeadlineReminderPreview(data);
      openModal({ type: "deadlineReminderPreview", title: "Hasil Simulasi Penjadwal Pengingat H-1" });
      await loadSnapshot();
      notifySuccess("Simulasi Penjadwal Berhasil", "Simulasi penjadwal dijalankan manual, data terbaru dimuat, dan tidak ada WhatsApp sungguhan yang dikirim.");
    } catch (error) {
      notifyError("Simulasi Penjadwal Gagal", error instanceof Error ? error.message : "Simulasi penjadwal pengingat belum berhasil.");
    } finally {
      setIsSaving(false);
    }
  };

  const runDeadlineReminderControlled = async () => {
    setIsSaving(true);
    setNotice(null);
    setDeadlineReminderPreview(null);
    try {
      const data = await requestBot<AletaBotDeadlineReminderDryRunResult>(
        "/api/admin/aleta-bot/disposition-deadline-reminders/run",
        {
          method: "POST",
          body: JSON.stringify({ confirmText: deadlineConfirmText, limit: 20 }),
        }
      );
      setDeadlineReminderPreview(data);
      openModal({ type: "deadlineReminderPreview", title: "Hasil Pengingat Tenggat H-1" });
      await loadSnapshot();
      setDeadlineConfirmText("");
      notifySuccess(
        data.productionSent ? "Pengingat Operasional Diproses" : "Pengingat Tenggat Selesai",
        data.productionSent
          ? "Pengingat aktif operasional memproses antrean sesuai persetujuan dan panel sudah diperbarui."
          : "Pengingat selesai tanpa pengiriman aktif operasional dan panel sudah diperbarui."
      );
    } catch (error) {
      notifyError("Pengingat Tenggat Gagal Dijalankan", error instanceof Error ? error.message : "Pengingat tenggat belum berhasil dijalankan.");
    } finally {
      setIsSaving(false);
    }
  };

  const exportPublicQaHumanReview = () => {
    const params = new URLSearchParams({ format: "csv" });
    if (publicQaReviewFilter === "needs_review") {
      params.set("needsHumanReview", "true");
      params.set("reviewStatus", "pending");
    } else if (publicQaReviewFilter !== "all") {
      params.set("reviewStatus", publicQaReviewFilter);
    }
    window.open(apiPath(`/api/admin/aleta-bot/public-qa?${params.toString()}`), "_blank", "noopener,noreferrer");
  };

  const previewNotificationRecipients = async (notification: AletaBotNotification) => {
    setIsSaving(true);
    setNotice(null);
    setRecipientPreview(null);
    try {
      const data = await requestBot<RecipientPreviewResult>(
        `/api/admin/aleta-bot/notifications/${encodeURIComponent(notification.id)}/preview-recipients?limit=10`
      );
      setRecipientPreview(data);
      openModal({ type: "recipientPreview", title: `Preview Penerima ${notification.name}` });
      await loadSnapshot();
      notifySuccess("Preview Penerima Berhasil Dibuat", `Preview penerima untuk "${notification.name}" sudah diperbarui tanpa mengirim atau mengantrekan pesan.`);
    } catch (error) {
      notifyError("Preview Penerima Gagal Dibuat", error instanceof Error ? error.message : "Preview penerima belum berhasil dibuat.");
    } finally {
      setIsSaving(false);
    }
  };

  const purgeLogs = async () => {
    if (purgeConfirmText !== "HAPUS LOG LAMA") return;
    setIsSaving(true);
    setNotice(null);
    try {
      await requestBot<{ deletedCount: number }>("/api/admin/aleta-bot/actions", {
        method: "POST",
        body: JSON.stringify({ action: "purge-logs", payload: { olderThanDays: 30, safeOnly: true } }),
      });
      await loadSnapshot();
      notifySuccess("Retensi Log Berhasil Diproses", "Log lama non-audit berhasil dihapus dan daftar log sudah dimuat ulang.");
    } catch (error) {
      notifyError("Retensi Log Gagal Diproses", error instanceof Error ? error.message : "Hapus log lama belum berhasil.");
    } finally {
      setIsSaving(false);
      setShowPurgeConfirm(false);
      setPurgeConfirmText("");
    }
  };

  const pollManualSendProgress = useCallback(function poll(queueId: number | string, attempt = 0) {
    const safeQueueId = String(queueId || "").trim();
    if (!safeQueueId) return;
    const delayMs = attempt === 0 ? 1200 : 2500;
    globalThis.setTimeout(() => {
      void (async () => {
        try {
          const data = await requestBot<AletaBotActionResult>(`/api/admin/aleta-bot/queue-progress?id=${encodeURIComponent(safeQueueId)}`);
          setManualSendProgress((current) => ({
            ...(current ?? {}),
            ...data,
            queueId: data.queueId ?? safeQueueId,
            queueProgress: data.queueProgress ?? current?.queueProgress,
          }));
          const stage = data.queueProgress?.stage || data.status || "";
          const finalStage = ["done", "failed", "sent", "delivered", "read", "dry_run", "simulated"].includes(String(stage));
          if (!finalStage && attempt < 6) {
            poll(safeQueueId, attempt + 1);
          }
        } catch {
          if (attempt < 2) {
            poll(safeQueueId, attempt + 1);
          }
        }
      })();
    }, delayMs);
  }, []);

  const runAction = async (
    action: "sync-config" | "sync-ai-config" | "test-ai-runtime" | "reconnect" | "logout" | "send-test" | "test-template" | "test-query" | "test-notification" | "test-connection" | "pause-worker" | "resume-worker",
    payload?: Record<string, unknown>
  ) => {
    setIsSaving(true);
    setNotice(null);
    setPreview(null);
    if (action === "send-test") {
      setManualSendProgress({
        status: "processing",
        message: "Pesan uji sedang dimasukkan ke antrean.",
        queueProgress: {
          stage: "queued",
          status: "processing",
          position: null,
          pendingAhead: null,
          estimatedWaitMs: null,
          estimatedWaitText: "menghitung antrean",
        },
      });
    }
    try {
      const data = await requestBot<AletaBotSnapshot & { preview?: string; actionResult?: AletaBotActionResult }>("/api/admin/aleta-bot/actions", {
        method: "POST",
        body: JSON.stringify({ action, payload }),
      });
      setSnapshot(data);
      if (data.preview) setPreview(data.preview);
      if (action === "send-test") {
        setManualSendProgress(data.actionResult ?? null);
        const queueId = data.actionResult?.queueId ?? data.actionResult?.queueProgress?.queueId;
        const stage = data.actionResult?.queueProgress?.stage || data.actionResult?.status || "";
        if (queueId && !["done", "failed", "sent", "delivered", "read", "dry_run", "simulated"].includes(String(stage))) {
          pollManualSendProgress(queueId);
        }
      }
      await loadRuntimeDashboard();
      if (["send-test", "test-notification", "pause-worker", "resume-worker", "sync-config"].includes(action)) {
        void loadWhatsappReport(undefined, { silent: true });
        globalThis.setTimeout(() => {
          void loadWhatsappReport(undefined, { silent: true });
        }, 2500);
      }
      const actionMessages: Record<string, { title: string; message: string }> = {
        "sync-config": {
          title: "Pengaturan Bot Berhasil Disinkronkan",
          message: "Pengaturan portal sudah dikirim ulang ke layanan ALETA Bot dan dashboard diperbarui.",
        },
        "sync-ai-config": {
          title: "Pengaturan AI Berhasil Disinkronkan",
          message: "Provider dan model AI aktif sudah dikirim ulang ke layanan ALETA Bot.",
        },
        "test-ai-runtime": {
          title: "Uji AI Berhasil Diproses",
          message: "Status uji AI sudah diperbarui pada dashboard.",
        },
        reconnect: {
          title: "Koneksi WhatsApp Diminta",
          message: "Permintaan hubungkan WhatsApp Gateway sudah diproses dan status terbaru sedang dibaca.",
        },
        logout: {
          title: "Kontrol Session WhatsApp Diproses",
          message: "Permintaan logout/nonaktif session diproses dan status panel sudah diperbarui.",
        },
        "send-test": {
          title: "Pesan Uji Berhasil Diproses",
          message: "Pesan uji diproses sesuai mode aktif. Jika simulasi aktif, tidak ada WhatsApp sungguhan yang dikirim.",
        },
        "test-template": {
          title: "Preview Isi Pesan Berhasil Dibuat",
          message: "Isi pesan diuji dan hasil preview sudah diperbarui.",
        },
        "test-query": {
          title: "Uji Sumber Data Berhasil Diproses",
          message: "Sumber data diuji dan status panel sudah diperbarui.",
        },
        "test-notification": {
          title: "Uji Notifikasi Berhasil Diproses",
          message: "Notifikasi diuji dalam mode aman dan hasil panel sudah diperbarui.",
        },
        "test-connection": {
          title: "Uji Koneksi WhatsApp Diproses",
          message: "Status koneksi WhatsApp sudah diminta ulang dari runtime.",
        },
        "pause-worker": {
          title: "Mesin Bot Dijeda",
          message: "Pemroses antrean dijeda dan status mesin bot sudah diperbarui.",
        },
        "resume-worker": {
          title: "Mesin Bot Dilanjutkan",
          message: "Pemroses antrean dilanjutkan dan status mesin bot sudah diperbarui.",
        },
      };
      const success = actionMessages[action] ?? {
        title: "Aksi ALETA Bot Berhasil Diproses",
        message: "Aksi selesai dan data panel sudah diperbarui.",
      };
      notifySuccess(success.title, data.actionResult?.message || success.message);
    } catch (error) {
      if (action === "send-test") {
        setManualSendProgress({
          status: "failed",
          sent: false,
          message: error instanceof Error ? error.message : "Pesan uji gagal diproses.",
          queueProgress: {
            stage: "failed",
            status: "failed",
            position: 0,
            pendingAhead: 0,
            estimatedWaitMs: 0,
            estimatedWaitText: "gagal",
          },
        });
      }
      notifyError("Aksi ALETA Bot Gagal Diproses", error instanceof Error ? error.message : "Aksi belum berhasil diproses.");
    } finally {
      setIsSaving(false);
    }
  };

  const runLegacyMigrationAction = async (action: LegacyMigrationAction, migration: AletaBotLegacyMigration) => {
    setIsSaving(true);
    setNotice(null);
    setPreview(null);
    try {
      const data = await requestBot<Record<string, unknown>>("/api/admin/aleta-bot/legacy-migration", {
        method: "POST",
        body: JSON.stringify({ action, migrationId: migration.id, notes: legacyActionNotes }),
      });
      const nextSnapshot = (data.snapshot || data) as AletaBotSnapshot;
      if (nextSnapshot?.settings && nextSnapshot?.legacyMigrations) {
        setSnapshot(nextSnapshot);
        await loadRuntimeDashboard();
      } else {
        await loadSnapshot();
      }
      if (typeof data.preview === "string") setPreview(data.preview);
      setLegacyActionResult(JSON.stringify({
        migration: data.migration,
        draft: data.draft,
        validation: data.validation,
        approval: data.approval,
        preview: data.preview,
      }, null, 2));
      if (!["preview", "dry-run"].includes(action)) {
        setActiveModal(null);
        setModalDirty(false);
      }
      notifySuccess("Migrasi Jalur Lama Berhasil Diproses", `Aksi ${displayStatus(action)} untuk "${migration.feature}" selesai dan data panel diperbarui.`);
    } catch (error) {
      notifyError("Migrasi Jalur Lama Gagal Diproses", error instanceof Error ? error.message : "Aksi migrasi jalur lama belum berhasil diproses.");
    } finally {
      setIsSaving(false);
    }
  };

  const groupedTemplates = useMemo(() => {
    const groups = new Map<string, AletaBotTemplate[]>();
    for (const template of snapshot.templates) {
      const category = normalizeTemplateCategory(template.category);
      groups.set(category, [...(groups.get(category) ?? []), template]);
    }

    return Array.from(groups.entries())
      .map(([category, templates]) => ({
        category,
        templates: [...templates].sort((left, right) => left.title.localeCompare(right.title)),
      }))
      .sort((left, right) => {
        const leftIndex = TEMPLATE_CATEGORY_ORDER.indexOf(left.category);
        const rightIndex = TEMPLATE_CATEGORY_ORDER.indexOf(right.category);
        if (leftIndex !== -1 || rightIndex !== -1) {
          return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
        }
        return formatTemplateCategory(left.category).localeCompare(formatTemplateCategory(right.category));
      });
  }, [snapshot.templates]);

  const publicQaRuntimeLogs = runtimeDashboard?.payload?.publicQa?.recentLogs ?? [];
  const publicQaNeedsReviewCount = snapshot.unknownQuestionReviews.filter(
    (item) => item.needsHumanReview && item.reviewStatus === "pending"
  ).length;
  const filteredUnknownQuestionReviews = useMemo(() => {
    return snapshot.unknownQuestionReviews.filter((item) => {
      if (publicQaReviewFilter === "all") return true;
      if (publicQaReviewFilter === "needs_review") return item.needsHumanReview && item.reviewStatus === "pending";
      return item.reviewStatus === publicQaReviewFilter;
    });
  }, [snapshot.unknownQuestionReviews, publicQaReviewFilter]);
  const employeeWhatsappReadyCount = snapshot.whatsappNumberCompleteness.withWhatsapp;
  const employeeWhatsappCoverage = snapshot.whatsappNumberCompleteness.coveragePercent / 100;
  const employeeWhatsappTotal = snapshot.whatsappNumberCompleteness.totalActiveUsers;
  const employeeWhatsappMissing = snapshot.whatsappNumberCompleteness.missingWhatsapp;
  const employeeWhatsappComplete = employeeWhatsappTotal > 0 && employeeWhatsappMissing === 0;
  const legacyFallbackUsedCount = runtimeDashboard?.payload?.whatsappNumberResolver?.legacyFallbackUsedCount ?? 0;
  const legacyFallbackLastUsedAt = runtimeDashboard?.payload?.whatsappNumberResolver?.lastLegacyFallbackUsedAt ?? null;
  const runtimeDashboardFetchedAtMs = runtimeDashboard?.fetchedAt ? new Date(runtimeDashboard.fetchedAt).getTime() : null;
  const legacyFallbackLastUsedAtMs = legacyFallbackLastUsedAt ? new Date(legacyFallbackLastUsedAt).getTime() : null;
  const legacyFallbackRecent = Boolean(
    runtimeDashboardFetchedAtMs &&
    legacyFallbackLastUsedAtMs &&
    runtimeDashboardFetchedAtMs - legacyFallbackLastUsedAtMs < 24 * 60 * 60 * 1000
  );
  const legacyFallbackStillBlocking = legacyFallbackRecent && !employeeWhatsappComplete;
  const runtimePolicySkipStats = runtimeDashboard?.payload?.registry?.policySkipStats;
  const policySkipToday = runtimePolicySkipStats?.totalToday ?? snapshot.policySkipSummary.totalToday;
  const policySkipAllTime = runtimePolicySkipStats?.skippedCount ?? snapshot.policySkipSummary.totalAllTime;
  const reminderMode = snapshot.settings.deadlineReminderMode;
  const messageAnalytics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const todayLogs = snapshot.notificationLogs.filter((item) => new Date(item.createdAt).getTime() >= todayMs);
    const sent = todayLogs.filter((item) => item.status === "success").length;
    const failed = todayLogs.filter((item) => item.status === "failed").length;
    const simulated = todayLogs.filter((item) => item.status === "simulated").length;
    const bySource = todayLogs.reduce<Record<string, number>>((acc, item) => {
      const key = item.sourceFeature || "lainnya";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    return {
      totalToday: todayLogs.length,
      sent,
      failed,
      simulated,
      successRate: todayLogs.length > 0 ? Math.round((sent / todayLogs.length) * 100) : 0,
      topSource: Object.entries(bySource).sort((a, b) => b[1] - a[1])[0],
    };
  }, [snapshot.notificationLogs]);
  const publicQaAnalytics = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sinceMs = sevenDaysAgo.getTime();
    const logs = snapshot.publicQaLogs.filter((item) => new Date(item.createdAt).getTime() >= sinceMs);
    const fallback = logs.filter((item) => item.status === "fallback" || item.status === "error").length;
    const pending = snapshot.unknownQuestionReviews.filter((item) => item.needsHumanReview && item.reviewStatus === "pending").length;
    const converted = snapshot.publicQaLogs.filter((item) => item.reviewStatus === "converted_to_intent").length;
    return {
      totalLast7Days: logs.length,
      fallbackRate: logs.length > 0 ? Math.round((fallback / logs.length) * 100) : 0,
      pending,
      converted,
    };
  }, [snapshot.publicQaLogs, snapshot.unknownQuestionReviews]);
  const reminderProductionWithoutApproval =
    snapshot.settings.deadlineReminderMode === "production" &&
    (!snapshot.settings.deadlineReminderEnabled || !snapshot.settings.deadlineReminderApprovedAt);
  const releaseChecks = useMemo(() => {
    const archiveReadyCount = snapshot.legacyMigrations.filter((item) => item.canArchive && item.status === "legacy_disabled").length;
    return [
      {
        name: "Penghubung WhatsApp",
        status: runtimeDashboard?.online ? "ready" : "blocked",
        detail: runtimeDashboard?.errorMessage ?? `HTTP ${runtimeDashboard?.statusCode ?? "-"}`,
      },
      {
        name: "Token Internal",
        status: runtimeDashboard?.tokenHealth?.status === "ok" ? "ready" : "blocked",
        detail: runtimeDashboard?.tokenHealth?.message ?? "Token health belum terbaca.",
      },
      {
        name: "Status WhatsApp",
        status: snapshot.whatsapp.runtimeStatus === "failed" ? "blocked" : "ready",
        detail: displayStatus(snapshot.whatsapp.runtimeStatus),
      },
      {
        name: "Koneksi QR",
        status: ["connected", "waiting_qr", "initializing", "disconnected"].includes(snapshot.whatsapp.runtimeStatus) ? "ready" : "warning",
        detail: snapshot.whatsapp.qrCode ? "QR tersedia dari gateway" : "QR belum tersedia atau tidak diperlukan",
      },
      {
        name: "Pemroses Antrean",
        status: runtimeDashboard?.payload?.worker?.enabled ? "ready" : "warning",
        detail: runtimeDashboard?.payload?.worker?.lastHeartbeatAt ? `Sinyal terakhir ${formatDateTime(runtimeDashboard.payload.worker.lastHeartbeatAt)}` : "Belum ada sinyal pemroses",
      },
      {
        name: "Jembatan AI",
        status: runtimeDashboard?.payload?.aiRuntime?.status === "error" ? "blocked" : runtimeDashboard?.payload?.aiRuntime?.status === "needs_sync" ? "warning" : "ready",
        detail: displayStatus(runtimeDashboard?.payload?.aiRuntime?.status ?? "unknown"),
      },
      {
        // Nama lama "Kesiapan Arsip" terbaca seperti urusan arsip surat atau
        // berkas perkara, padahal yang dimaksud adalah pemensiunan jalur
        // notifikasi lama (notifikasi.js) yang sedang digantikan jalur registry.
        name: "Migrasi Jalur Lama",
        status: archiveReadyCount > 0 ? "ready" : "warning",
        detail:
          archiveReadyCount > 0
            ? `${archiveReadyCount} jalur lama sudah dimatikan dan siap diarsipkan`
            : "Belum ada jalur lama yang dimatikan. Buka tab Migrasi Jalur Lama untuk meninjau.",
      },
      {
        name: "Mode aman tersedia",
        status: "ready",
        detail: "Alur kembali ke mode aman tersedia untuk migrasi jalur lama.",
      },
      {
        name: "Runbook",
        status: "ready",
        detail: "Panduan Pilot Terbatas tersedia di halaman Panduan Penggunaan.",
      },
    ];
  }, [runtimeDashboard, snapshot.legacyMigrations, snapshot.whatsapp]);
  const releaseStatus = releaseChecks.some((item) => item.status === "blocked")
    ? "blocked"
    : releaseChecks.some((item) => item.status === "warning")
      ? "warning"
      : "ready";
  const aiSummary = getSimpleAiSummary(runtimeDashboard?.payload?.aiRuntime?.status);
  const machineSummary = getSimpleMachineSummary(runtimeDashboard);

  const filteredLogs = useMemo(() => {
    return snapshot.logs.filter((log) => {
      if (logFilter === "all") return true;
      if (logFilter === "error") return ["error", "warning"].includes(log.level);
      if (logFilter === "whatsapp") return ["message", "notification"].includes(log.eventType);
      if (logFilter === "ai") return log.eventType === "public_qa";
      if (logFilter === "queue") return log.eventType === "notification";
      if (logFilter === "approval") return (log.eventType ?? "").includes("approval");
      if (logFilter === "migration") return (log.eventType ?? "").includes("migration") || (log.message ?? "").toLowerCase().includes("legacy");
      return true;
    }).slice(0, 50);
  }, [snapshot.logs, logFilter]);
  const whatsappDisconnected =
    !["connected", "ready"].includes(runtimeDashboard?.payload?.whatsapp?.status ?? snapshot.whatsapp.runtimeStatus);
  const whatsappBrowserLocked =
    (runtimeDashboard?.payload?.whatsapp?.status ?? snapshot.whatsapp.runtimeStatus) === "browser_locked" ||
    runtimeDashboard?.payload?.whatsapp?.lastErrorType === "browser_locked";
  const runtimeBotConfig = runtimeDashboard?.payload?.bot;
  const runtimeBotSettingsOutOfSync = Boolean(
    runtimeDashboard?.online &&
    runtimeBotConfig &&
    (
      (typeof runtimeBotConfig.botEnabled === "boolean" && runtimeBotConfig.botEnabled !== snapshot.settings.botEnabled) ||
      (typeof runtimeBotConfig.notificationsEnabled === "boolean" && runtimeBotConfig.notificationsEnabled !== snapshot.settings.notificationsEnabled) ||
      (typeof runtimeBotConfig.dryRunEnabled === "boolean" && runtimeBotConfig.dryRunEnabled !== snapshot.settings.dryRunEnabled)
    )
  );
  const setupChecks = useMemo(() => {
    const workerReady = Boolean(runtimeDashboard?.payload?.worker?.enabled && runtimeDashboard.payload.worker.activeTimer);
    const safeWindow = runtimeDashboard?.payload?.bot?.sendingWindow;
    return [
      {
        label: "WhatsApp Gateway terhubung",
        ok: !whatsappDisconnected,
        href: "#status-whatsapp",
        detail: displayStatus(runtimeDashboard?.payload?.whatsapp?.status ?? snapshot.whatsapp.runtimeStatus),
      },
      {
        label: "Jembatan AI tersinkron",
        ok: runtimeDashboard?.payload?.aiRuntime?.status === "synced",
        href: "#ai-bridge",
        detail: displayStatus(runtimeDashboard?.payload?.aiRuntime?.status ?? "unknown"),
      },
      {
        label: "Koneksi database utama berhasil",
        ok: snapshot.dbConnections.some((item) => item.isActive && item.lastTestStatus === "success"),
        href: "#database",
        detail: `${snapshot.dbConnections.filter((item) => item.isActive).length} koneksi aktif`,
      },
      {
        label: "Pemroses antrean aktif",
        ok: workerReady,
        href: "#queue-recovery",
        detail: runtimeDashboard?.payload?.worker?.lastHeartbeatAt
          ? `Sinyal terakhir ${formatDateTime(runtimeDashboard.payload.worker.lastHeartbeatAt)}`
          : "Belum ada sinyal pemroses",
      },
      {
        label: "Template aktif tersedia",
        ok: snapshot.templates.some((template) => template.editable),
        href: "#templates",
        detail: `${snapshot.metrics.enabledTemplates} template tersedia`,
      },
      {
        label: "Notifikasi pegawai siap simulasi/aktif",
        ok: snapshot.notifications.some((item) => item.category === "employee" && (item.isActive || item.lastStatus === "simulated")),
        href: "#notifikasi",
        detail: "Mulai pilot dari notifikasi internal pegawai.",
      },
      {
        label: "Nomor WhatsApp pegawai memakai data Manajemen Akun",
        ok: employeeWhatsappComplete,
        href: "/admin/mapping-user-jabatan?missingWhatsapp=true",
        detail: employeeWhatsappTotal > 0
          ? `${employeeWhatsappReadyCount}/${employeeWhatsappTotal} pegawai punya nomor WhatsApp. ${employeeWhatsappMissing} belum lengkap.`
          : "Belum ada nomor pegawai dari database. Layanan masih dapat memakai data lama.",
      },
      {
        label: "Jam aman pengiriman aktif",
        ok: safeWindow?.enabled !== false,
        href: "#pengaturan-bot",
        detail: safeWindow?.enabled === false ? "Belum aktif" : `${safeWindow?.start ?? "07:30"}-${safeWindow?.end ?? "21:00"}`,
      },
      {
        label: "Tidak ada pesan gagal kritis",
        ok: snapshot.deadLetters.length === 0,
        href: "#queue-recovery",
        detail: `${snapshot.deadLetters.length} pesan gagal permanen`,
      },
    ];
  }, [employeeWhatsappComplete, employeeWhatsappMissing, employeeWhatsappReadyCount, employeeWhatsappTotal, runtimeDashboard, snapshot, whatsappDisconnected]);

  const pilotReadinessChecks = useMemo(() => {
    const safeWindow = runtimeDashboard?.payload?.bot?.sendingWindow;
    const queuePending = runtimeDashboard?.payload?.queue?.pending ?? 0;
    const skippedPolicy = runtimeDashboard?.payload?.registry?.skippedPolicy ?? 0;
    const partyPolicyBlocked = snapshot.notifications.some((item) => item.category === "party" && item.isActive && item.policyStatus && !item.policyStatus.canActivate);
    const publicQaActive = snapshot.publicQaIntents.some((item) => item.isActive || item.aiEnabled || item.aiAnswerEnabled);
    return [
      {
        group: "WhatsApp",
        name: "Gateway dapat dihubungi dan status jelas",
        status: runtimeDashboard?.online ? (whatsappDisconnected ? "blocked" : "ready") : "blocked",
        detail: runtimeDashboard?.online ? displayStatus(snapshot.whatsapp.runtimeStatus) : runtimeDashboard?.errorMessage ?? "Layanan tidak dapat dihubungi.",
        actionLabel: "Buka Status WhatsApp",
        actionHref: "#status-whatsapp",
      },
      {
        group: "WhatsApp",
        name: "Jam Aman Pengiriman aktif",
        status: safeWindow?.enabled === false ? "blocked" : "ready",
        detail: safeWindow?.enabled === false ? "Jam aman nonaktif" : `${safeWindow?.start ?? "07:30"}-${safeWindow?.end ?? "21:00"}`,
        actionLabel: "Buka Pengaturan Jam Aman",
        actionHref: "#pengaturan-bot",
      },
      {
        group: "Antrean Pesan",
        name: "Pemroses pesan dan antrean terkendali",
        status: runtimeDashboard?.payload?.worker?.enabled ? (queuePending > 50 ? "warning" : "ready") : "blocked",
        detail: `${queuePending} menunggu, ${snapshot.deadLetters.length} pesan gagal.`,
      },
      {
        group: "Data",
        name: "Nomor WhatsApp pegawai lengkap",
        status: employeeWhatsappComplete ? "ready" : employeeWhatsappCoverage >= 0.7 ? "warning" : "blocked",
        detail: employeeWhatsappComplete
          ? `${employeeWhatsappReadyCount}/${employeeWhatsappTotal} pegawai punya nomor. Data Manajemen Akun sudah lengkap.`
          : legacyFallbackStillBlocking
            ? `${employeeWhatsappReadyCount}/${employeeWhatsappTotal} pegawai punya nomor. ${employeeWhatsappMissing} belum lengkap dan runtime masih sempat memakai fallback lama.`
            : `${employeeWhatsappReadyCount}/${employeeWhatsappTotal} pegawai punya nomor. ${employeeWhatsappMissing} belum lengkap.`,
        actionLabel: "Lengkapi Nomor Pegawai",
        actionHref: "/admin/mapping-user-jabatan?missingWhatsapp=true",
      },
      {
        group: "Kebijakan",
        name: "Notifikasi pihak luar wajib persetujuan",
        status: partyPolicyBlocked || skippedPolicy > 0 ? "warning" : "ready",
        detail: skippedPolicy > 0
          ? `${skippedPolicy} notifikasi ditahan oleh kebijakan layanan.`
          : "Pengiriman ke pihak luar hanya berjalan setelah pratinjau, batas pengiriman, dan persetujuan.",
        actionLabel: "Lihat Notifikasi yang Ditahan",
        actionHref: "#policy-skip",
      },
      {
        group: "Kebijakan",
        name: "Pengingat tenggat terkendali",
        status: reminderProductionWithoutApproval ? "blocked" : "ready",
        detail: reminderMode === "production"
          ? "Aktif dengan pengamanan. Pantau persetujuan, batas pengiriman, dan Jam Aman Pengiriman."
          : `Mode ${displayStatus(reminderMode)}. Aman secara default dan tidak mengirim otomatis tanpa syarat.`,
        actionLabel: "Buka Pengaturan Pengingat",
        actionHref: "#reminder-deadline",
      },
      {
        group: "Aturan Jawaban",
        name: "Tinjauan admin terpantau",
        status: publicQaNeedsReviewCount > 20 ? "blocked" : publicQaNeedsReviewCount > 0 ? "warning" : runtimeDashboard?.payload?.aiRuntime?.status === "needs_sync" && publicQaActive ? "blocked" : "ready",
        detail: publicQaNeedsReviewCount > 0
          ? `${publicQaNeedsReviewCount} pertanyaan perlu ditinjau.`
          : runtimeDashboard?.payload?.aiRuntime?.status === "needs_sync" && publicQaActive
            ? "AI aturan jawaban perlu sinkronisasi."
            : "Tidak ada pertanyaan publik yang menunggu tinjauan.",
        actionLabel: "Tinjau Pertanyaan",
        actionHref: "#public-qa",
      },
    ] as const;
  }, [
    employeeWhatsappCoverage,
    employeeWhatsappComplete,
    employeeWhatsappMissing,
    employeeWhatsappReadyCount,
    employeeWhatsappTotal,
    legacyFallbackStillBlocking,
    publicQaNeedsReviewCount,
    reminderMode,
    reminderProductionWithoutApproval,
    runtimeDashboard,
    snapshot.deadLetters.length,
    snapshot.notifications,
    snapshot.publicQaIntents,
    snapshot.whatsapp.runtimeStatus,
    whatsappDisconnected,
  ]);
  const pilotReadinessStatus = pilotReadinessChecks.some((item) => item.status === "blocked")
    ? "blocked"
    : pilotReadinessChecks.some((item) => item.status === "warning")
      ? "warning"
      : "ready";

  const operationalAlerts = useMemo(() => {
    const alerts: Array<{ title: string; detail: string; tone: "warning" | "danger" | "muted" }> = [];
    if (whatsappBrowserLocked) {
      alerts.push({
        title: "Sesi WhatsApp sedang dipakai proses lain",
        detail: "Tutup proses browser lama atau restart ALETA Bot dengan aman, lalu perbarui status. Jangan hapus sesi WhatsApp kecuali benar-benar diperlukan.",
        tone: "danger",
      });
    } else if (whatsappDisconnected) {
      alerts.push({
        title: "WhatsApp Gateway belum terhubung",
        detail: "Pesan akan menunggu di antrean sampai gateway aktif kembali.",
        tone: "danger",
      });
    }
    if (runtimeDashboard?.payload?.aiRuntime?.status === "needs_sync") {
      alerts.push({
        title: "AI perlu sinkronisasi",
        detail: "Sinkronkan AI ke ALETA Bot dari Mode Lanjutan sebelum memakai aturan jawaban.",
        tone: "warning",
      });
    }
    if (snapshot.deadLetters.length > 0) {
      alerts.push({
        title: "Ada pesan gagal permanen",
        detail: `${snapshot.deadLetters.length} pesan perlu ditinjau sebelum dikirim ulang.`,
        tone: "warning",
      });
    }
    if (publicQaNeedsReviewCount > 0) {
      alerts.push({
        title: "Pertanyaan publik perlu tinjauan",
        detail: `${publicQaNeedsReviewCount} pertanyaan masuk antrean tinjauan admin.`,
        tone: "warning",
      });
    }
    if (!employeeWhatsappComplete && (employeeWhatsappCoverage < 0.8 || legacyFallbackUsedCount > 0)) {
      alerts.push({
        title: "Nomor pegawai belum lengkap",
        detail: legacyFallbackUsedCount > 0
          ? `Layanan memakai data lama ${legacyFallbackUsedCount} kali. Lengkapi nomor di Manajemen Akun.`
          : "Sebagian pemetaan WhatsApp masih dapat memakai data lama. Lengkapi nomor pegawai prioritas sebelum pilot WhatsApp.",
        tone: "warning",
      });
    }
    if (runtimeDashboard?.payload?.bot?.sendingWindow?.enabled === false) {
      alerts.push({
        title: "Jam aman pengiriman nonaktif",
        detail: "Aktifkan Jam Aman Pengiriman agar pesan tidak terkirim di luar jam kerja.",
        tone: "muted",
      });
    }
    if ((runtimeDashboard?.payload?.registry?.skippedPolicy ?? 0) > 0 || policySkipToday > 0) {
      const reasons = runtimeDashboard?.payload?.registry?.policySkipStats?.reasons ?? Object.fromEntries(snapshot.policySkipSummary.topReasons.map((item) => [item.reason, item.count]));
      const reasonText = Object.entries(reasons).slice(0, 3).map(([key, count]) => `${key}: ${count}`).join(", ");
      alerts.push({
        title: "Notifikasi pihak luar ditahan kebijakan",
        detail: `${runtimeDashboard?.payload?.registry?.skippedPolicy ?? policySkipToday} notifikasi pihak luar ditahan karena belum memenuhi syarat.${reasonText ? ` Alasan: ${reasonText}.` : ""}`,
        tone: "warning",
      });
    }
    if (snapshot.settings.deadlineReminderLastRunAt && snapshot.settings.deadlineReminderMode !== "production") {
      alerts.push({
        title: "Pengingat tenggat masih aman",
        detail: `Jalankan terakhir ${formatDateTime(snapshot.settings.deadlineReminderLastRunAt)} berstatus ${displayStatus(snapshot.settings.deadlineReminderLastStatus)} dalam mode ${displayStatus(snapshot.settings.deadlineReminderMode)}.`,
        tone: "warning",
      });
    }
    return alerts.slice(0, 6);
  }, [employeeWhatsappComplete, employeeWhatsappCoverage, legacyFallbackUsedCount, policySkipToday, publicQaNeedsReviewCount, runtimeDashboard, snapshot, whatsappBrowserLocked, whatsappDisconnected]);

  const reportRows = useMemo(() => whatsappReport?.rows ?? [], [whatsappReport]);
  const reportTableStatusOptions = useMemo(
    () => Array.from(new Set(reportRows.map((row) => row.statusLabel).filter(Boolean))).sort((a, b) => a.localeCompare(b, "id-ID")),
    [reportRows]
  );
  const reportTableAppOptions = useMemo(
    () => Array.from(new Set(reportRows.map((row) => row.sourceAppLabel).filter(Boolean))).sort((a, b) => a.localeCompare(b, "id-ID")),
    [reportRows]
  );
  const reportTableFeatureOptions = useMemo(
    () => Array.from(new Set(reportRows.map((row) => row.sourceFeatureLabel).filter(Boolean))).sort((a, b) => a.localeCompare(b, "id-ID")),
    [reportRows]
  );
  const filteredReportRows = useMemo(() => {
    const search = reportTableSearch.trim().toLowerCase();
    return reportRows
      .filter((row) => {
        if (reportTableStatusFilter !== "all" && row.statusLabel !== reportTableStatusFilter) return false;
        if (reportTableAppFilter !== "all" && row.sourceAppLabel !== reportTableAppFilter) return false;
        if (reportTableFeatureFilter !== "all" && row.sourceFeatureLabel !== reportTableFeatureFilter) return false;
        if (search && !reportRowSearchText(row).includes(search)) return false;
        return true;
      })
      .sort((a, b) => compareReportRows(a, b, reportTableSortKey, reportTableSortDirection));
  }, [
    reportRows,
    reportTableAppFilter,
    reportTableFeatureFilter,
    reportTableSearch,
    reportTableSortDirection,
    reportTableSortKey,
    reportTableStatusFilter,
  ]);
  const displayedReportRows = filteredReportRows.slice(0, 30);
  const reportTableHasFilter =
    reportTableSearch.trim() !== "" ||
    reportTableStatusFilter !== "all" ||
    reportTableAppFilter !== "all" ||
    reportTableFeatureFilter !== "all";
  const resetReportTableFilters = () => {
    setReportTableSearch("");
    setReportTableStatusFilter("all");
    setReportTableAppFilter("all");
    setReportTableFeatureFilter("all");
  };
  const focusReportTable = () => {
    window.requestAnimationFrame(() => document.getElementById("report-data-table")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const toggleReportTableSort = (sortKey: ReportTableSortKey) => {
    setReportTableSortKey((current) => {
      if (current === sortKey) {
        setReportTableSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
        return current;
      }
      setReportTableSortDirection(sortKey === "createdAt" ? "desc" : "asc");
      return sortKey;
    });
  };
  const renderReportSortHeader = (sortKey: ReportTableSortKey, label: string) => (
    <button
      type="button"
      onClick={() => toggleReportTableSort(sortKey)}
      className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.12em] transition hover:text-foreground"
    >
      {label}
      <ArrowUpDown className={cn("h-3.5 w-3.5", reportTableSortKey === sortKey ? "text-primary" : "text-muted-foreground")} />
      {reportTableSortKey === sortKey ? <span className="sr-only">{reportTableSortDirection === "asc" ? "naik" : "turun"}</span> : null}
    </button>
  );

  return (
    <div className="space-y-6">
      {operationFeedback ? <ActionFeedbackOverlay feedback={operationFeedback} /> : null}

      <PageIntro
        eyebrow={isSuperAdmin ? "Khusus Super Admin" : "Mode Operasional Admin"}
        title="ALETA Bot"
        description="Panel untuk mengatur pengiriman WhatsApp lewat dua cara: notifikasi terjadwal dan jawaban dari pertanyaan yang diketik user."
        actions={
          <>
            <Button variant={showAdvancedMode ? "default" : "outline"} size="sm" onClick={toggleAdvancedMode}>
              {showAdvancedMode ? "Kembali ke Mode Sederhana" : "Buka Mode Lanjutan"}
            </Button>
            <Button variant="outline" onClick={() => void refreshSnapshot("panel")} disabled={isLoading || isSaving}>
              <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              Perbarui
            </Button>
            <Button onClick={() => void runAction("sync-config")} disabled={isSaving}>
              <CheckCircle2 className="h-4 w-4" />
              Sinkronkan Pengaturan
            </Button>
          </>
        }
      />

      {notice ? (
        <NoticeCard notice={notice} onClose={() => setNotice(null)} />
      ) : null}

      {showAdvancedMode ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <span className="text-amber-600">⚠</span>
          <span className="text-amber-900 dark:text-amber-200">
            <strong>Mode Lanjutan aktif</strong> — fitur teknis dan aksi berisiko ditampilkan. Gunakan dengan hati-hati.
          </span>
        </div>
      ) : null}

      {whatsappBrowserLocked ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="space-y-1 p-4 text-sm text-destructive">
            <p className="font-semibold">Sesi WhatsApp sedang dipakai proses browser lain.</p>
            <p>
              Tutup proses browser lama atau restart ALETA Bot dengan aman, lalu perbarui status.
              Jangan hapus sesi WhatsApp kecuali benar-benar diperlukan.
            </p>
          </CardContent>
        </Card>
      ) : whatsappDisconnected ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="space-y-1 p-4 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-semibold">WhatsApp Gateway belum terhubung.</p>
            <p>
              Pesan akan menunggu di antrean sampai koneksi aktif kembali.
              {snapshot.whatsapp.lastConnectedAt ? ` Terakhir terhubung: ${formatDateTime(snapshot.whatsapp.lastConnectedAt)}.` : ""}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {operationalAlerts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Perlu Perhatian</CardTitle>
            <CardDescription>Peringatan operasional ringan. Panel ini tidak mengirim WhatsApp dan hanya membantu admin menentukan prioritas pengecekan.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {operationalAlerts.map((alert) => (
              <div key={alert.title} className="rounded-xl border border-border p-3 text-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground">{alert.title}</p>
                  <Badge variant={alert.tone}>{alert.tone === "danger" ? "Penting" : alert.tone === "warning" ? "Cek" : "Info"}</Badge>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">{alert.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard label="Status Bot" value={snapshot.runtimeState} icon={Bot} onClick={() => navigateAdminAction("#pengaturan-bot")} actionLabel="Buka Pengaturan Bot" />
        <StatusCard label="WhatsApp" value={snapshot.whatsapp.runtimeStatus} icon={Smartphone} onClick={() => navigateAdminAction("#status-whatsapp")} actionLabel="Buka Status WhatsApp" />
        <StatusCard label="Terkirim Hari Ini" value={String(snapshot.metrics.sentToday)} icon={Send} onClick={() => navigateAdminAction("#logs")} actionLabel="Buka Log Aktivitas" />
        <StatusCard label="Gagal Hari Ini" value={String(snapshot.metrics.failedToday)} icon={TerminalSquare} onClick={() => navigateAdminAction("#queue-recovery")} actionLabel="Buka Pesan Gagal" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex max-w-full flex-wrap items-center justify-start gap-x-1 gap-y-1">
          {/* Utama — selalu tampil */}
          <TabsTrigger value="dashboard">Ringkasan</TabsTrigger>
          <TabsTrigger value="connection">WhatsApp</TabsTrigger>
          <TabsTrigger value="public-qa">{showAdvancedMode ? "Aturan Jawaban" : "Pertanyaan"}</TabsTrigger>
          <TabsTrigger value="antrian-online">Antrian Online</TabsTrigger>
          <TabsTrigger value="ecourt">e-Court</TabsTrigger>
          <TabsTrigger value="queue-recovery">Pesan Gagal</TabsTrigger>
          {showAdvancedMode ? (
            <>
              <span role="presentation" className="mx-1 self-center text-[10px] font-semibold text-muted-foreground/40 select-none">|</span>
              <TabsTrigger value="queries">Sumber Data</TabsTrigger>
              <TabsTrigger value="templates">Isi Pesan</TabsTrigger>
              <TabsTrigger value="notifications">Notifikasi</TabsTrigger>
              <TabsTrigger value="manual-test">Kirim Manual</TabsTrigger>
              <TabsTrigger value="logs">Riwayat</TabsTrigger>
              <TabsTrigger value="reports">Laporan</TabsTrigger>
              <TabsTrigger value="approvals">Persetujuan</TabsTrigger>
              {isSuperAdmin ? (
                <>
                  <span role="presentation" className="mx-1 self-center text-[10px] font-semibold text-muted-foreground/40 select-none">|</span>
                  <TabsTrigger value="settings">Pengaturan</TabsTrigger>
                  <TabsTrigger value="migration">Migrasi Jalur Lama</TabsTrigger>
                  <TabsTrigger value="database">Koneksi Data</TabsTrigger>
                </>
              ) : null}
            </>
          ) : null}
          {/* Konten Bot — hanya Mode Lanjutan */}
          {showAdvancedMode ? (
            <span role="presentation" className="mx-1 self-center text-[10px] font-semibold text-muted-foreground/40 select-none">│</span>
          ) : null}
          {/* Konfigurasi — hanya Mode Lanjutan */}
          {showAdvancedMode ? (
            <span role="presentation" className="mx-1 self-center text-[10px] font-semibold text-muted-foreground/40 select-none">│</span>
          ) : null}
          {/* Mode lanjutan hanya menambah detail migrasi dan status teknis. */}
          {/* Developer — hanya Mode Lanjutan */}
        </TabsList>

        <TabsContent value="dashboard">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <HealthSummaryCard
              label="WhatsApp"
              status={snapshot.whatsapp.runtimeStatus === "connected" ? "ok" : ["waiting_qr", "initializing", "qr_needed"].includes(snapshot.whatsapp.runtimeStatus) ? "warning" : "error"}
              value={displayStatus(snapshot.whatsapp.runtimeStatus)}
              onClick={() => navigateAdminAction("#status-whatsapp")}
            />
            <HealthSummaryCard
              label="Pemroses / Antrean"
              status={runtimeDashboard?.payload?.worker?.enabled ? (runtimeDashboard.payload.worker.activeTimer ? "ok" : "warning") : "error"}
              value={runtimeDashboard?.payload?.worker?.enabled ? `${runtimeDashboard?.payload?.queue?.pending ?? 0} menunggu` : "Tidak Aktif"}
              onClick={() => navigateAdminAction("#queue-recovery")}
            />
            <HealthSummaryCard
              label="AI"
              status={aiSummary.level}
              value={aiSummary.label}
              onClick={() => navigateAdminAction("#ai-bridge")}
            />
            <HealthSummaryCard
              label="Persetujuan Menunggu"
              status={snapshot.approvalRequests.filter((r) => r.status === "pending").length > 0 ? "warning" : "ok"}
              value={`${snapshot.approvalRequests.filter((r) => r.status === "pending").length} tertunda`}
              onClick={() => navigateAdminAction("#approvals")}
            />
            <HealthSummaryCard
              label="Pesan Gagal"
              status={snapshot.deadLetters.length > 0 ? "warning" : "ok"}
              value={`${snapshot.deadLetters.length} pesan gagal`}
              onClick={() => navigateAdminAction("#queue-recovery")}
            />
          </div>
          <SendingRiskSlider
            presets={snapshot.sendingRiskPresets}
            currentLevel={snapshot.settings.sendingRiskLevel}
            pendingLevel={pendingRisk}
            saving={savingRisk}
            notifications={snapshot.notifications}
            onPreview={setPendingRisk}
            onCommit={applyRiskLevel}
          />
          {!showAdvancedMode ? (
            <div className="mb-4 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Mode sederhana hanya menampilkan panel pantau cepat: Ringkasan, WhatsApp, Pertanyaan, dan Pesan Gagal. Pengaturan detail tersedia di Mode Lanjutan.
            </div>
          ) : null}
          {!showAdvancedMode && isSuperAdmin ? (
            <Card id="pengaturan-bot-cepat" className="mb-4">
              <CardHeader>
                <CardTitle>Kontrol Cepat Bot</CardTitle>
                <CardDescription>Pengaturan utama tersedia di Mode Sederhana. Klik simpan agar status aktif bot ikut disinkronkan ke runtime.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-3">
                  <ToggleRow
                    label="Bot aktif"
                    checked={settingsDraft.botEnabled}
                    onCheckedChange={(value) => setSettingsDraft((current) => ({ ...current, botEnabled: value }))}
                  />
                  <ToggleRow
                    label="Notifikasi otomatis"
                    checked={settingsDraft.notificationsEnabled}
                    onCheckedChange={(value) => setSettingsDraft((current) => ({ ...current, notificationsEnabled: value }))}
                  />
                  <ToggleRow
                    label="Mode simulasi"
                    checked={settingsDraft.dryRunEnabled}
                    onCheckedChange={(value) => setSettingsDraft((current) => ({ ...current, dryRunEnabled: value }))}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <Field
                    label="Nomor Admin WhatsApp"
                    value={settingsDraft.adminWhatsappNumber}
                    onChange={(value) => setSettingsDraft((current) => ({ ...current, adminWhatsappNumber: value }))}
                    placeholder="628123456789"
                  />
                  <Button
                    onClick={() => void saveSettings(settingsDraft, { closeModal: false, successMessage: "Kontrol cepat ALETA Bot tersimpan dan runtime diperbarui." })}
                    disabled={isSaving || !settingsDraftChanged}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isSaving ? "Menyimpan..." : settingsDraftChanged ? "Simpan Kontrol Bot" : "Sudah Tersimpan"}
                  </Button>
                </div>
                {settingsDraftChanged ? (
                  <p className="text-xs text-amber-700 dark:text-amber-300">Ada perubahan kontrol bot yang belum disimpan.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Status kontrol bot sudah sama dengan data tersimpan.</p>
                )}
              </CardContent>
            </Card>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-3">
            <InfoCard title="Nomor Admin" value={snapshot.settings.adminWhatsappNumber || "Belum diatur"} hint="Dipakai sebagai nomor kontrol bot. Disimpan di Portal ALETA dan konfigurasi penghubung." onClick={() => navigateAdminAction("#pengaturan-bot")} actionLabel="Atur Nomor Admin" />
            <InfoCard
              title="Nomor Terhubung"
              value={snapshot.whatsapp.phoneNumber || "Belum disetel"}
              hint={showAdvancedMode ? `Sesi: ${snapshot.whatsapp.sessionName}` : "Nomor WhatsApp yang sedang atau akan dipakai bot."}
              onClick={() => navigateAdminAction("#status-whatsapp")}
              actionLabel="Buka WhatsApp"
            />
            <InfoCard title="Notifikasi Terakhir" value={snapshot.metrics.lastNotificationAt ? formatDateTime(snapshot.metrics.lastNotificationAt) : "Belum ada"} hint={`${snapshot.metrics.activeJobs} job aktif, ${snapshot.metrics.enabledTemplates} template tersedia.`} onClick={() => navigateAdminAction("#notifikasi")} actionLabel="Buka Notifikasi" />
          </div>
          {showAdvancedMode ? (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Layanan `aleta_bot`</CardTitle>
              <CardDescription>Status baca-saja dari pemroses, antrean database, daftar pilot, dan koneksi WhatsApp.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-4">
              <InfoCard
                title="Layanan"
                value={runtimeDashboard?.online ? "Terhubung" : "Tidak Terhubung"}
                hint={runtimeDashboard?.errorMessage ?? `HTTP ${runtimeDashboard?.statusCode ?? "-"}`}
              />
              <InfoCard
                title="Token Internal"
                value={runtimeDashboard?.tokenHealth?.status === "ok" ? "Sesuai" : "Perlu Cek"}
                hint={runtimeDashboard?.tokenHealth?.message ?? "Samakan token portal dan aleta_bot sebelum deploy."}
              />
              <InfoCard
                title="Layanan WhatsApp"
                value={displayStatus(runtimeDashboard?.payload?.whatsapp?.status ?? "unknown")}
                hint={runtimeDashboard?.payload?.whatsapp?.lastReadyAt ? `Siap: ${formatDateTime(runtimeDashboard.payload.whatsapp.lastReadyAt)}` : runtimeDashboard?.payload?.whatsapp?.lastErrorMessage ?? "Belum ada status layanan."}
              />
              <InfoCard
                title="Umur Sesi WA"
                value={runtimeDashboard?.payload?.whatsapp?.sessionAgeHours != null ? `${runtimeDashboard.payload.whatsapp.sessionAgeHours} jam` : "Belum aktif"}
                hint={runtimeDashboard?.payload?.whatsapp?.sessionStartedAt ? `Aktif sejak ${formatDateTime(runtimeDashboard.payload.whatsapp.sessionStartedAt)}` : "Sesi aktif dihitung sejak WhatsApp siap."}
              />
              <InfoCard
                title="Kirim Terakhir"
                value={runtimeDashboard?.payload?.whatsapp?.lastMessageSentAt ? formatDateTime(runtimeDashboard.payload.whatsapp.lastMessageSentAt) : "Belum ada"}
                hint={`Gagal autentikasi: ${runtimeDashboard?.payload?.whatsapp?.authFailureCount ?? 0}`}
              />
              <InfoCard
                title="Antrean Pesan"
                value={`${runtimeDashboard?.payload?.queue?.pending ?? runtimeDashboard?.queueMonitoring?.pending ?? 0} menunggu`}
                hint={`${runtimeDashboard?.payload?.queue?.processing ?? runtimeDashboard?.queueMonitoring?.processing ?? 0} diproses, ${runtimeDashboard?.queueMonitoring?.stalePending ?? 0} tertahan.`}
              />
              <InfoCard
                title="Pemroses Antrean"
                value={runtimeDashboard?.payload?.worker?.enabled ? "Aktif" : "Tidak Aktif"}
                hint={runtimeDashboard?.payload?.worker?.lastHeartbeatAt ? `Sinyal terakhir: ${formatDateTime(runtimeDashboard.payload.worker.lastHeartbeatAt)}` : runtimeDashboard?.queueMonitoring?.alerts[0]?.label ?? runtimeDashboard?.payload?.worker?.lastError ?? "Belum ada sinyal pemroses."}
              />
              <InfoCard
                title="Skema Database"
                value={runtimeDashboard?.payload?.db?.schemaReady ? "Siap" : "Belum Siap"}
                hint={runtimeDashboard?.payload?.db?.lastError || "Status skema database ALETA Bot."}
              />
              <InfoCard
                title="Daftar Pilot"
                value={`${runtimeDashboard?.payload?.registry?.total ?? 0} notifikasi`}
                hint={`${runtimeDashboard?.payload?.registry?.dryRun ?? 0} simulasi, ${runtimeDashboard?.payload?.registry?.requiresApproval ?? 0} butuh persetujuan.`}
              />
              <InfoCard
                title="Sumber Data SQL"
                value={`${snapshot.dbConnections.filter((item) => item.isActive).length} aktif`}
                hint={`${snapshot.dbConnections.filter((item) => item.lastTestStatus === "failed").length} gagal uji, ${snapshot.dbConnections.filter((item) => item.legacySource).length} memakai data lama.`}
              />
              <InfoCard
                title="Aturan Jawaban"
                value={`${snapshot.publicQaIntents.filter((item) => item.isActive).length} aktif`}
                hint={`${snapshot.publicQaIntents.filter((item) => item.aiEnabled).length} aturan AI, ${runtimeDashboard?.payload?.publicQa?.stats?.fallbackToday ?? 0} perlu tinjauan hari ini.`}
              />
              <InfoCard
                title="Pesan Hari Ini"
                value={`${runtimeDashboard?.payload?.messageStatsToday?.sent ?? runtimeDashboard?.queueMonitoring?.sentToday ?? 0} terkirim`}
                hint={`${runtimeDashboard?.payload?.messageStatsToday?.failed ?? runtimeDashboard?.queueMonitoring?.failedToday ?? 0} gagal, ${runtimeDashboard?.queueMonitoring?.deadLetters ?? 0} dead letter.`}
              />
              <InfoCard
                title="Kesehatan Antrean"
                value={runtimeDashboard?.queueMonitoring?.health === "blocked" ? "Macet" : runtimeDashboard?.queueMonitoring?.health === "warning" ? "Perlu Cek" : "Normal"}
                hint={runtimeDashboard?.queueMonitoring?.lastSentAt ? `Kirim terakhir: ${formatDateTime(runtimeDashboard.queueMonitoring.lastSentAt)}` : runtimeDashboard?.queueMonitoring?.lastCreatedAt ? `Log terakhir: ${formatDateTime(runtimeDashboard.queueMonitoring.lastCreatedAt)}` : "Belum ada log pengiriman."}
              />
              <InfoCard
                title="Jam Aman Kirim"
                value={runtimeDashboard?.payload?.bot?.sendingWindow?.enabled === false ? "nonaktif" : runtimeDashboard?.payload?.bot?.sendingWindow?.inside === false ? "di luar jam" : "aktif"}
                hint={runtimeDashboard?.payload?.bot?.sendingWindow?.message ?? `${runtimeDashboard?.payload?.bot?.sendingWindow?.start ?? "07:30"}-${runtimeDashboard?.payload?.bot?.sendingWindow?.end ?? "21:00"}`}
              />
              <InfoCard
                title="Kendala Sistem"
                value={`${runtimeDashboard?.payload?.systemStatsToday?.error ?? 0} kendala`}
                hint={`${runtimeDashboard?.payload?.systemStatsToday?.critical ?? 0} kritis hari ini.`}
              />
            </CardContent>
          </Card>
          ) : (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Status Operasional</CardTitle>
              <CardDescription>Ringkasan sederhana untuk memantau bot tanpa detail teknis runtime.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              <InfoCard title="Mesin Bot" value={machineSummary.label} hint={machineSummary.hint} />
              <InfoCard title="AI" value={aiSummary.label} hint={aiSummary.hint} />
              <InfoCard
                title="Antrean Pesan"
                value={`${runtimeDashboard?.payload?.queue?.pending ?? 0} menunggu`}
                hint="Pesan akan diproses oleh mesin bot. Detail teknis tersedia di Mode Lanjutan."
              />
            </CardContent>
          </Card>
          )}
          {showAdvancedMode ? (
          <Card id="ai-bridge" className="mt-4">
            <CardHeader>
              <CardTitle>Konfigurasi Jembatan AI</CardTitle>
              <CardDescription>Provider, model, aturan jawaban, dan hasil sinkronisasi dari portal ke layanan `aleta_bot`.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-4">
                <InfoCard
                  title="Jembatan AI"
                  value={displayStatus(runtimeDashboard?.payload?.aiRuntime?.status ?? runtimeDashboard?.payload?.aiRuntime?.lastSyncStatus ?? "unknown")}
                  hint={runtimeDashboard?.payload?.aiRuntime?.message || runtimeDashboard?.payload?.aiRuntime?.lastSyncError || `Sumber: ${runtimeDashboard?.payload?.aiRuntime?.configSource ?? "-"}`}
                />
                <InfoCard
                  title="Provider"
                  value={runtimeDashboard?.payload?.aiRuntime?.provider ?? "belum sinkron"}
                  hint={`Model: ${runtimeDashboard?.payload?.aiRuntime?.model ?? "-"}`}
                />
                <InfoCard
                  title="AI Aturan Jawaban"
                  value={runtimeDashboard?.payload?.aiRuntime?.publicQaEnabled ? "Aktif" : "Tidak Aktif"}
                  hint={runtimeDashboard?.payload?.aiRuntime?.publicQaAiAnswerEnabled ? "Jawaban AI aktif sesuai konfigurasi layanan." : "Jawaban AI otomatis tidak aktif."}
                />
                <InfoCard
                  title="API Key"
                  value={runtimeDashboard?.payload?.aiRuntime?.apiKeyConfigured ? "Sudah Diatur" : "Belum Diatur"}
                  hint={
                    runtimeDashboard?.payload?.aiRuntime?.secretPersistence
                      ? `Secret: ${displayStatus(runtimeDashboard.payload.aiRuntime.secretPersistence)}${runtimeDashboard.payload.aiRuntime.apiKeyEnvKey ? `, env: ${runtimeDashboard.payload.aiRuntime.apiKeyEnvKey}` : ""}`
                      : runtimeDashboard?.payload?.aiRuntime?.apiKeyMasked
                        ? `Masked: ${runtimeDashboard.payload.aiRuntime.apiKeyMasked}`
                        : "Nilai key tidak pernah ditampilkan."
                  }
                />
                <InfoCard
                  title="Sinkronisasi Terakhir"
                  value={runtimeDashboard?.payload?.aiRuntime?.syncedAt ? formatDateTime(runtimeDashboard.payload.aiRuntime.syncedAt) : "Belum pernah"}
                  hint="Sinkronisasi mengambil provider aktif dari Pengaturan AI portal."
                />
                <InfoCard
                  title="Uji Terakhir"
                  value={displayStatus(runtimeDashboard?.payload?.aiRuntime?.lastTestStatus ?? "idle")}
                  hint={runtimeDashboard?.payload?.aiRuntime?.lastTestAt ? formatDateTime(runtimeDashboard.payload.aiRuntime.lastTestAt) : runtimeDashboard?.payload?.aiRuntime?.lastTestError || "Belum diuji."}
                />
              </div>
              {runtimeDashboard?.autoSync?.attempted ? (
                <div className={cn(
                  "rounded-xl border p-4 text-sm",
                  runtimeDashboard.autoSync.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                )}>
                  {runtimeDashboard.autoSync.message}
                </div>
              ) : null}
              {isSuperAdmin ? (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void runAction("sync-ai-config")} disabled={isSaving}>
                    <RefreshCcw className="h-4 w-4" />
                    Sinkronkan AI ke ALETA Bot
                  </Button>
                  <Button variant="outline" onClick={() => void runAction("test-ai-runtime")} disabled={isSaving}>
                    <Play className="h-4 w-4" />
                    Uji Layanan AI
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sinkronisasi dan uji layanan AI hanya dapat dilakukan Super Admin.</p>
              )}
            </CardContent>
          </Card>
          ) : null}
          {showAdvancedMode ? (
          <>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Langkah Menyiapkan ALETA Bot</CardTitle>
              <CardDescription>Checklist operasional untuk memastikan pilot berjalan aman tanpa aksi berisiko langsung dari kartu ini.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {setupChecks.map((check) => (
                <button
                  key={check.label}
                  type="button"
                  onClick={() => navigateAdminAction(check.href)}
                  className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{check.label}</p>
                    <Badge variant={check.ok ? "success" : "warning"}>{check.ok ? "Selesai" : "Perlu dicek"}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{check.detail}</p>
                  <p className="mt-3 text-xs font-semibold text-primary">Buka pengaturan terkait</p>
                </button>
              ))}
            </CardContent>
          </Card>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Kesiapan Pilot</CardTitle>
                    <CardDescription>
                      Checklist lintas WhatsApp, antrean, data, kebijakan, dan aturan jawaban. Status Siap tidak muncul jika ada hambatan penting.
                    </CardDescription>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Terakhir diperbarui: {runtimeDashboard?.fetchedAt ? formatDateTime(runtimeDashboard.fetchedAt) : formatDateTime(snapshot.settings.updatedAt)}
                    </p>
                  </div>
                  <Badge variant={pilotReadinessStatus === "ready" ? "success" : pilotReadinessStatus === "warning" ? "warning" : "danger"}>
                    {pilotReadinessStatus === "ready" ? "Siap" : pilotReadinessStatus === "warning" ? "Perlu Perhatian" : "Terblokir"}
                  </Badge>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void runOperationalSmokeTest()} disabled={isSaving}>
                      <Play className="h-4 w-4" />
                      Jalankan Pemeriksaan Aman
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={exportPilotReadinessCsv}>
                      <Download className="h-4 w-4" />
                      Ekspor Kesiapan
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {pilotReadinessChecks.map((check) => (
                  <div key={`${check.group}-${check.name}`} className="rounded-xl border border-border bg-card p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">{check.group}</p>
                        <p className="font-semibold text-foreground">{check.name}</p>
                      </div>
                      <Badge variant={check.status === "ready" ? "success" : check.status === "warning" ? "warning" : "danger"}>
                        {check.status === "ready" ? "Siap" : check.status === "warning" ? "Perhatian" : "Blokir"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{check.detail}</p>
                    {"actionHref" in check && check.actionHref ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          navigateAdminAction(check.actionHref);
                        }}
                      >
                        {check.actionLabel}
                      </Button>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Kelengkapan Nomor WhatsApp Pegawai</CardTitle>
            <CardDescription>Dipakai untuk mengurangi ketergantungan pada pemetaan lama di layanan.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{employeeWhatsappReadyCount} dari {employeeWhatsappTotal} pegawai punya nomor</p>
                    <Badge variant={employeeWhatsappComplete ? "success" : employeeWhatsappCoverage >= 0.7 ? "warning" : "danger"}>
                      {snapshot.whatsappNumberCompleteness.coveragePercent}%
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {employeeWhatsappComplete
                      ? "Semua pegawai aktif sudah memiliki nomor WhatsApp valid dari Manajemen Akun."
                      : `${employeeWhatsappMissing} pegawai belum memiliki nomor. Lengkapi dari Manajemen Akun agar data lama bisa dihentikan bertahap.`}
                  </p>
                </div>
                {snapshot.whatsappNumberCompleteness.importantMissing.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Prioritas nomor belum lengkap</p>
                    {snapshot.whatsappNumberCompleteness.importantMissing.slice(0, 6).map((user) => (
                      <div key={user.id} className="rounded border border-border p-2 text-xs">
                        <p className="font-medium text-foreground">{user.name}</p>
                        <p className="text-muted-foreground">{user.positionName} · {user.unitKerja || user.roleId}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Tidak ada pegawai prioritas yang kosong nomornya.</p>
                )}
                <Button variant="outline" onClick={() => void runDeadlineReminderDryRun()} disabled={isSaving}>
                  <Play className="h-4 w-4" />
                  Simulasikan Pengingat Tenggat H-1
                </Button>
                <Button variant="outline" onClick={() => { window.location.href = apiPath("/admin/mapping-user-jabatan?missingWhatsapp=true"); }}>
                  Lengkapi Nomor di Manajemen Akun
                </Button>
                <p className="text-xs leading-5 text-muted-foreground">
                  Simulasi ini hanya membuat catatan dan pratinjau. Tidak ada WhatsApp sungguhan yang dikirim.
                </p>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-4">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Pemeriksaan Operasional Aman</CardTitle>
                  <CardDescription>Pemeriksaan baca-saja untuk status WhatsApp, pemroses pesan, kebijakan, AI, dan daftar database. Tidak scan QR, tidak mengantrekan pesan, dan tidak mengirim WhatsApp.</CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={() => void runOperationalSmokeTest()} disabled={isSaving}>
                  <Play className="h-4 w-4" />
                  Jalankan Pemeriksaan Aman
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {smokeTestResult ? (
                <>
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <Badge variant={smokeTestResult.overallStatus === "passed" ? "success" : smokeTestResult.overallStatus === "warning" ? "warning" : "danger"}>
                      {smokeTestResult.overallStatus === "passed" ? "Lulus" : smokeTestResult.overallStatus === "warning" ? "Perlu Perhatian" : "Gagal"}
                    </Badge>
                    <span className="text-muted-foreground">Dijalankan {formatDateTime(smokeTestResult.generatedAt)}</span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {smokeTestResult.checks.map((check) => (
                      <div key={check.key} className="rounded-xl border border-border p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-foreground">{check.label}</p>
                          <Badge variant={check.status === "passed" ? "success" : check.status === "warning" ? "warning" : "danger"}>
                            {check.status === "passed" ? "Lulus" : check.status === "warning" ? "Perhatian" : "Gagal"}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{check.detail}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada pemeriksaan aman pada sesi ini. Jalankan saat ingin memeriksa kesiapan operasional tanpa aksi berisiko.</p>
              )}
            </CardContent>
          </Card>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Analitik Pengiriman</CardTitle>
                <CardDescription>Ringkasan ringan dari riwayat pengiriman hari ini. Nomor dan metadata sensitif tidak ditampilkan.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <InfoCard title="Total Hari Ini" value={String(messageAnalytics.totalToday)} hint={`${messageAnalytics.sent} terkirim, ${messageAnalytics.failed} gagal`} />
                <InfoCard title="Tingkat Berhasil" value={`${messageAnalytics.successRate}%`} hint={`${messageAnalytics.simulated} simulasi tercatat`} />
                <InfoCard title="Sumber Teratas" value={messageAnalytics.topSource?.[0] ? displayStatus(messageAnalytics.topSource[0]) : "-"} hint={messageAnalytics.topSource ? `${messageAnalytics.topSource[1]} pesan` : "Belum ada data hari ini"} />
                <InfoCard title="Notifikasi Ditahan" value={String(policySkipToday)} hint="Notifikasi yang ditahan tidak dianggap gagal dan tidak mengirim WhatsApp." />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Analitik Aturan Jawaban</CardTitle>
                <CardDescription>Tren ringkas pertanyaan publik dan tindak lanjut manusia.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <InfoCard title="7 Hari Terakhir" value={String(publicQaAnalytics.totalLast7Days)} hint="Jumlah pertanyaan/log Public Q&A." />
                <InfoCard title="Perlu Tinjauan" value={`${publicQaAnalytics.fallbackRate}%`} hint="Pantau pertanyaan yang belum cocok agar aturan makin matang." />
                <InfoCard title="Perlu Ditinjau" value={String(publicQaAnalytics.pending)} hint="Masuk antrean tinjauan admin." />
                <InfoCard title="Aturan Dari Pertanyaan" value={String(publicQaAnalytics.converted)} hint="Pertanyaan yang sudah dikonversi menjadi aturan jawaban aktif." />
              </CardContent>
            </Card>
            <Card id="policy-skip">
              <CardHeader>
                <CardTitle>Notifikasi yang Ditahan</CardTitle>
                <CardDescription>Notifikasi yang ditahan disimpan dalam catatan terstruktur agar tetap bisa ditinjau setelah layanan dimulai ulang.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <InfoCard title="Hari Ini" value={String(policySkipToday)} hint="Dibaca dari catatan notifikasi yang ditahan." />
                  <InfoCard title="Total" value={String(policySkipAllTime)} hint={runtimePolicySkipStats?.lastSkippedAt || snapshot.policySkipSummary.lastSkippedAt ? `Terakhir ${formatDateTime(runtimePolicySkipStats?.lastSkippedAt || snapshot.policySkipSummary.lastSkippedAt || "")}` : "Belum ada dilewati."} />
                  <InfoCard title="Alasan Utama" value={(runtimePolicySkipStats?.reasons && Object.keys(runtimePolicySkipStats.reasons)[0]) || snapshot.policySkipSummary.topReasons[0]?.reason || "-"} hint="Contoh: belum_dry_run, belum_preview, belum_approval." />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <NativeSelect value={policySkipReasonFilter} onChange={(event) => setPolicySkipReasonFilter(event.target.value)} className="max-w-xs">
                    <option value="all">Semua alasan</option>
                    <option value="belum_dry_run">Belum simulasi</option>
                    <option value="belum_preview">Belum pratinjau</option>
                    <option value="belum_approval">Belum persetujuan</option>
                    <option value="safe_sending_window">Di luar jam aman</option>
                    <option value="recipient_invalid">Penerima tidak valid</option>
                    <option value="policy_blocked">Ditahan kebijakan</option>
                  </NativeSelect>
                  <Button variant="outline" onClick={exportPolicySkipCsv}>
                    <Download className="h-4 w-4" />
                    Ekspor CSV Notifikasi Ditahan
                  </Button>
                </div>
                <div className="space-y-2">
                  {(runtimePolicySkipStats?.topNotifications ?? snapshot.policySkipSummary.topNotifications).slice(0, 4).map((item) => (
                    <div key={item.notificationKey} className="flex items-center justify-between rounded border border-border p-2 text-xs">
                      <span className="font-medium text-foreground">{item.notificationKey || "notifikasi"}</span>
                      <Badge variant="warning">{item.count} ditahan</Badge>
                    </div>
                  ))}
                  {(runtimePolicySkipStats?.topNotifications ?? snapshot.policySkipSummary.topNotifications).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada notifikasi ditahan yang tercatat.</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            <Card id="reminder-deadline">
              <CardHeader>
                <CardTitle>Pengingat Tenggat Disposisi</CardTitle>
                <CardDescription>Jalur aktif operasional tersedia, tetapi default tetap aman dan membutuhkan persetujuan/konfirmasi eksplisit.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoCard title="Mode" value={displayStatus(snapshot.settings.deadlineReminderMode)} hint={snapshot.settings.deadlineReminderEnabled ? "Aktif" : "Belum aktif operasional."} />
                  <InfoCard title="Persetujuan" value={snapshot.settings.deadlineReminderApprovedAt ? "Ada" : "Belum ada"} hint={snapshot.settings.deadlineReminderApprovedAt ? formatDateTime(snapshot.settings.deadlineReminderApprovedAt) : "Aktif operasional/pilot butuh Super Admin."} />
                  <InfoCard title="Jalankan Terakhir" value={snapshot.settings.deadlineReminderLastRunAt ? formatDateTime(snapshot.settings.deadlineReminderLastRunAt) : "Belum pernah"} hint={snapshot.settings.deadlineReminderLastMessage || "Belum ada hasil pemrosesan."} />
                  <InfoCard title="Status Terakhir" value={displayStatus(snapshot.settings.deadlineReminderLastStatus)} hint="Simulasi tidak mengirim WhatsApp sungguhan." />
                  <InfoCard title="Penjadwal" value={snapshot.settings.deadlineReminderSchedulerEnabled ? "Aktif" : "Nonaktif"} hint={`${displayStatus(snapshot.settings.deadlineReminderSchedulerMode)} pukul ${snapshot.settings.deadlineReminderSchedulerTime}`} />
                  <InfoCard title="Tombol Darurat" value={snapshot.settings.deadlineReminderKillSwitch ? "Aktif" : "Normal"} hint={snapshot.settings.deadlineReminderKillSwitch ? "Semua pemroses pengingat diblokir." : "Pemroses mengikuti mode dan persetujuan."} />
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Daftar User ID Pilot" value={deadlinePilotUserIdsText} onChange={setDeadlinePilotUserIdsText} placeholder="user-a, user-b" />
                    <Field label="Daftar Peran Pilot" value={deadlinePilotRoleIdsText} onChange={setDeadlinePilotRoleIdsText} placeholder="hakim, panitera" />
                    <Field label="Daftar Jabatan Pilot" value={deadlinePilotPositionIdsText} onChange={setDeadlinePilotPositionIdsText} placeholder="position-id atau nama jabatan" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Mode pilot hanya memproses penerima internal yang cocok dengan daftar izin. Pihak eksternal tidak masuk daftar pengingat ini.</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                    <NativeSelect
                      value={snapshot.settings.deadlineReminderSchedulerMode}
                      onChange={(event) => void updateDeadlineReminderAdvancedSettings({ schedulerMode: event.target.value as AletaBotSnapshot["settings"]["deadlineReminderSchedulerMode"] })}
                    >
                      <option value="dry_run">Penjadwal Simulasi</option>
                      <option value="pilot">Penjadwal Pilot</option>
                      <option value="production">Penjadwal Aktif Operasional</option>
                      <option value="disabled">Penjadwal Nonaktif</option>
                    </NativeSelect>
                    <Input value={deadlineSchedulerTime} onChange={(event) => setDeadlineSchedulerTime(event.target.value)} placeholder="08:00:00" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void updateDeadlineReminderAdvancedSettings()} disabled={isSaving}>
                      Simpan Daftar/Jadwal
                    </Button>
                    <Button variant="outline" onClick={() => void updateDeadlineReminderAdvancedSettings({ schedulerEnabled: true, schedulerMode: "dry_run" })} disabled={isSaving}>
                      Aktifkan Penjadwal Simulasi
                    </Button>
                    <Button variant="outline" onClick={() => void updateDeadlineReminderAdvancedSettings({ schedulerEnabled: false, schedulerMode: "disabled" })} disabled={isSaving}>
                      Nonaktifkan Penjadwal
                    </Button>
                    <Button
                      variant={snapshot.settings.deadlineReminderKillSwitch ? "outline" : "destructive"}
                      onClick={() => void updateDeadlineReminderAdvancedSettings({ killSwitch: !snapshot.settings.deadlineReminderKillSwitch, confirmText: snapshot.settings.deadlineReminderKillSwitch ? deadlineConfirmText : "EMERGENCY STOP" })}
                      disabled={isSaving || (!snapshot.settings.deadlineReminderKillSwitch && deadlineConfirmText !== "EMERGENCY STOP")}
                    >
                      {snapshot.settings.deadlineReminderKillSwitch ? "Matikan Tombol Darurat" : "Tombol Darurat Pengingat"}
                    </Button>
                  </div>
                </div>
                <Input
                  value={deadlineConfirmText}
                  onChange={(event) => setDeadlineConfirmText(event.target.value)}
                  placeholder="AKTIFKAN PILOT / AKTIFKAN REMINDER / JALANKAN REMINDER / EMERGENCY STOP"
                  className="font-mono text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void runDeadlineReminderDryRun()} disabled={isSaving}>
                    Simulasikan
                  </Button>
                  <Button variant="outline" onClick={() => void runDeadlineReminderSchedulerDryRun()} disabled={isSaving}>
                    Jalankan Simulasi Sekarang
                  </Button>
                  <Button variant="outline" onClick={() => void updateDeadlineReminderMode("dry_run")} disabled={isSaving}>
                    Mode Simulasi
                  </Button>
                  <Button variant="outline" onClick={() => void updateDeadlineReminderMode("pilot")} disabled={isSaving || deadlineConfirmText !== "AKTIFKAN PILOT"}>
                    Aktifkan Pilot
                  </Button>
                  <Button variant="outline" onClick={() => void updateDeadlineReminderMode("production")} disabled={isSaving || deadlineConfirmText !== "AKTIFKAN REMINDER"}>
                    Aktifkan Operasional
                  </Button>
                  <Button variant="destructive" onClick={() => void updateDeadlineReminderMode("disabled")} disabled={isSaving}>
                    Nonaktifkan
                  </Button>
                  <Button onClick={() => void runDeadlineReminderControlled()} disabled={isSaving || deadlineConfirmText !== "JALANKAN REMINDER"}>
                    Jalankan Pengingat Terkontrol
                  </Button>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Tombol aktif operasional tetap dibatasi hak akses. Selama konfirmasi belum sesuai, pemroses hanya melaporkan hambatan dan tidak mengirim WhatsApp.
                </p>
                <div className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Riwayat Pengingat</p>
                      <p className="text-xs text-muted-foreground">5 proses terakhir, termasuk simulasi penjadwal dan hambatan. Nomor/isi pesan penuh tidak disimpan.</p>
                    </div>
                    <Badge variant="muted">{snapshot.deadlineReminderRuns.length} log</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {snapshot.deadlineReminderRuns.slice(0, 5).map((run: AletaBotDispositionReminderRun) => (
                      <div key={run.id} className="rounded-lg border border-border bg-muted/20 p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-foreground">{displayStatus(run.mode)} · {displayStatus(run.triggeredBy)}</span>
                          <Badge variant={run.status === "completed" || run.status === "simulated" ? "success" : run.status === "blocked" || run.status === "failed" ? "danger" : "warning"}>
                            {displayStatus(run.status)}
                          </Badge>
                        </div>
                        {formatRunSummary(run.summary) ? (
                          <p className="mt-1 text-muted-foreground">{formatRunSummary(run.summary)}</p>
                        ) : null}
                        <p className="mt-1 text-muted-foreground">
                          {formatDateTime(run.startedAt)} · kandidat {run.totalCandidates} · simulasi {run.dryRunCreated} · terkirim {run.sentCount} · dilewati {run.skippedCount} · kendala {run.errorCount}
                        </p>
                      </div>
                    ))}
                    {snapshot.deadlineReminderRuns.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada riwayat pengingat.</p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Kesiapan Pilot</CardTitle>
              <CardDescription>Checklist terakhir sebelum pilot aktif operasional terbatas. Status Siap hanya diberikan jika tidak ada hambatan layanan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={releaseStatus === "ready" ? "success" : releaseStatus === "warning" ? "warning" : "danger"}>
                  {releaseStatus === "ready" ? "Siap" : releaseStatus === "warning" ? "Perlu Perhatian" : "Terblokir"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {releaseStatus === "ready"
                    ? "Fondasi siap untuk pilot terbatas."
                    : releaseStatus === "warning"
                      ? "Ada catatan operasional yang perlu dipantau."
                    : "Ada hambatan yang harus diperbaiki sebelum pilot."}
                </span>
              </div>
              {releaseStatus === "blocked" ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  <strong>Terblokir:</strong>{" "}
                  {releaseChecks.filter((c) => c.status === "blocked").map((c) => c.name).join(", ")} harus diselesaikan sebelum pilot dapat dilanjutkan.
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {releaseChecks.map((check) => (
                  <div key={check.name} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{check.name}</p>
                      <Badge variant={check.status === "ready" ? "success" : check.status === "warning" ? "warning" : "danger"}>
                        {check.status === "ready" ? "Siap" : check.status === "warning" ? "Perhatian" : "Terblokir"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{check.detail}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          </>
          ) : null}
        </TabsContent>

        <TabsContent value="connection" id="status-whatsapp">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Koneksi WhatsApp Web</CardTitle>
                <CardDescription>Layanan WhatsApp berjalan melalui ALETA Bot. Portal hanya menjadi panel kontrol, bukan klien WhatsApp kedua.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoCard title="Layanan" value={displayStatus(snapshot.whatsapp.runtimeStatus)} hint={snapshot.whatsapp.lastErrorMessage ?? "Tidak ada kendala layanan yang tersimpan."} />
                  <InfoCard title="Terakhir Terhubung" value={snapshot.whatsapp.lastConnectedAt ? formatDateTime(snapshot.whatsapp.lastConnectedAt) : "Belum pernah"} hint={snapshot.whatsapp.savedStatus} />
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
                  {snapshot.whatsapp.runtimeStatus === "connected" ? (
                    <span className="text-emerald-700 dark:text-emerald-400">✓ WhatsApp sudah terhubung. QR tidak diperlukan.</span>
                  ) : snapshot.whatsapp.runtimeStatus === "waiting_qr" || snapshot.whatsapp.runtimeStatus === "qr_needed" ? (
                    <div className="space-y-1 text-amber-700 dark:text-amber-400">
                      <p className="font-medium">Scan QR Diperlukan</p>
                      <p>Buka <strong>WhatsApp</strong> di HP kantor → <strong>Perangkat Tertaut</strong> → <strong>Hubungkan Perangkat</strong> → Scan QR di bawah.</p>
                    </div>
                  ) : snapshot.whatsapp.runtimeStatus === "browser_locked" ? (
                    <div className="space-y-1 text-destructive">
                      <p className="font-medium">Sesi WhatsApp sedang dipakai proses browser lain.</p>
                      <p>Tutup proses browser lama atau mulai ulang ALETA Bot dengan aman, lalu klik Perbarui Status. Jangan hapus sesi WhatsApp.</p>
                    </div>
                  ) : snapshot.whatsapp.runtimeStatus === "initializing" ? (
                    <span className="text-muted-foreground">Menyiapkan Koneksi — menunggu QR dari ALETA Bot Gateway...</span>
                  ) : (
                    <span className="text-muted-foreground">Tidak Terhubung. Klik <strong>Hubungkan WhatsApp Gateway</strong> untuk memulai sesi tanpa reset.</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {isSuperAdmin ? (
                    <Button onClick={() => void runAction("reconnect")} disabled={isSaving}>
                      <RefreshCcw className="h-4 w-4" />
                      Hubungkan WhatsApp Gateway
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => void refreshSnapshot("whatsapp")} disabled={isSaving || isLoading}>
                    <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    Perbarui QR WhatsApp
                  </Button>
                  <Button variant="outline" onClick={() => void runAction("test-connection")} disabled={isSaving}>
                    <Play className="h-4 w-4" />
                    Uji Koneksi
                  </Button>
                  {isSuperAdmin ? (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (window.confirm("Nonaktifkan sesi WhatsApp Gateway sekarang?")) {
                          void runAction("logout");
                        }
                      }}
                      disabled={isSaving}
                    >
                      <Power className="h-4 w-4" />
                      Logout Session
                    </Button>
                  ) : null}
                </div>
                {!isSuperAdmin ? (
                  <p className="text-xs text-muted-foreground">Menghubungkan dan me-logout sesi WhatsApp hanya dapat dilakukan Super Admin.</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>QR Code</CardTitle>
                <CardDescription>QR berasal dari event QR runtime `aleta_bot`, bukan dari client portal.</CardDescription>
              </CardHeader>
              <CardContent>
                {snapshot.whatsapp.qrCode ? (
                  <Image
                    src={snapshot.whatsapp.qrCode}
                    alt="QR WhatsApp Web"
                    width={280}
                    height={280}
                    unoptimized
                    className="mx-auto aspect-square w-full max-w-[280px] rounded-xl border border-border bg-white p-3"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                    {snapshot.whatsapp.runtimeStatus === "connected"
                      ? "WhatsApp sudah terhubung. QR tidak diperlukan."
                      : snapshot.whatsapp.runtimeStatus === "browser_locked"
                        ? "Sesi WhatsApp sedang dipakai proses lain. Tutup proses lama atau restart layanan dengan aman, lalu refresh status."
                      : snapshot.whatsapp.runtimeStatus === "initializing"
                        ? "Menunggu QR dari ALETA Bot Gateway..."
                        : "QR belum tersedia. Klik Hubungkan WhatsApp Gateway, lalu tunggu beberapa detik."}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {isSuperAdmin ? <TabsContent value="settings" id="pengaturan-bot">
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Bot</CardTitle>
              <CardDescription>Perubahan disimpan di database portal dan diteruskan ke layanan ALETA Bot.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <InfoCard title="Pengiriman Bot" value={snapshot.settings.botEnabled ? "Aktif dengan pengamanan" : "Nonaktif"} hint={snapshot.settings.dryRunEnabled ? "Simulasi aktif" : "Pengiriman berjalan dengan batas dan persetujuan wajib"} onClick={() => openModal({ type: "settings", title: "Edit Pengiriman Bot" })} actionLabel="Edit Bot Aktif" />
                <InfoCard title="Notifikasi" value={snapshot.settings.notificationsEnabled ? "Aktif" : "Nonaktif"} hint={`Jeda ${snapshot.settings.messageDelayMs} ms, coba ulang ${snapshot.settings.retryLimit}x`} onClick={() => navigateAdminAction("#notifikasi")} actionLabel="Buka Notifikasi" />
                <InfoCard title="Admin" value={snapshot.settings.adminWhatsappNumber || "Belum diatur"} hint={`Updated: ${formatDateTime(snapshot.settings.updatedAt)}`} onClick={() => openModal({ type: "settings", title: "Edit Nomor Admin Bot" })} actionLabel="Edit Nomor Admin" />
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Kontrol Utama</p>
                    <p className="text-xs text-muted-foreground">Tersedia juga di Mode Sederhana. Simpan agar runtime ikut menerima status terbaru.</p>
                  </div>
                  <Badge variant={settingsDraftChanged ? "warning" : "success"}>
                    {settingsDraftChanged ? "Belum Disimpan" : "Tersimpan"}
                  </Badge>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  <ToggleRow
                    label="Bot aktif"
                    checked={settingsDraft.botEnabled}
                    onCheckedChange={(value) => setSettingsDraft((current) => ({ ...current, botEnabled: value }))}
                  />
                  <ToggleRow
                    label="Notifikasi otomatis"
                    checked={settingsDraft.notificationsEnabled}
                    onCheckedChange={(value) => setSettingsDraft((current) => ({ ...current, notificationsEnabled: value }))}
                  />
                  <ToggleRow
                    label="Mode simulasi"
                    checked={settingsDraft.dryRunEnabled}
                    onCheckedChange={(value) => setSettingsDraft((current) => ({ ...current, dryRunEnabled: value }))}
                  />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <Field
                    label="Nomor Admin WhatsApp"
                    value={settingsDraft.adminWhatsappNumber}
                    onChange={(value) => setSettingsDraft((current) => ({ ...current, adminWhatsappNumber: value }))}
                    placeholder="628123456789"
                  />
                  <Button
                    onClick={() => void saveSettings(settingsDraft, { closeModal: false, successMessage: "Pengaturan utama ALETA Bot tersimpan dan runtime diperbarui." })}
                    disabled={isSaving || !settingsDraftChanged}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isSaving ? "Menyimpan..." : settingsDraftChanged ? "Simpan Pengaturan Utama" : "Sudah Tersimpan"}
                  </Button>
                </div>
              </div>
              {runtimeDashboard && !runtimeDashboard.online ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-900 dark:text-amber-200">
                  Runtime ALETA Bot belum dapat dibaca. Pengaturan tetap tersimpan di portal, lalu akan dipakai runtime saat layanan bot bisa menerima sinkronisasi.
                </div>
              ) : runtimeBotSettingsOutOfSync ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-900 dark:text-amber-200">
                  Pengaturan portal belum sama dengan layanan bot. Klik Simpan Pengaturan atau Sinkronkan Pengaturan agar status bot di layanan ALETA Bot ikut berubah.
                </div>
              ) : null}
              <Button onClick={() => openModal({ type: "settings", title: "Edit Pengaturan Bot" })} disabled={isSaving}>
                <Settings2 className="h-4 w-4" />
                Edit Pengaturan
              </Button>
            </CardContent>
          </Card>
        </TabsContent> : null}

        <TabsContent value="templates" id="templates">
          <div className="grid gap-4">
            {groupedTemplates.map(({ category, templates }) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>Isi Pesan {formatTemplateCategory(category)}</CardTitle>
                  <CardDescription>Isi pesan dipakai saat notifikasi dikirim atau saat aturan jawaban membutuhkan format pesan tertentu.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-2">
                  {templates.map((template) => (
                    <div key={template.id} className="space-y-3 rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{template.title}</p>
                          <p className="text-xs text-muted-foreground">Placeholder wajib: {template.placeholders.join(", ") || "tidak ada"}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <TemplateSafetyBadge body={templateDraft[template.id] ?? template.body} />
                          <Badge variant={template.editable ? "success" : "muted"}>{template.editable ? "Bisa diedit" : "Dikunci"}</Badge>
                        </div>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/30 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview final</p>
                        <pre className="max-h-52 overflow-auto text-xs leading-5 whitespace-pre-wrap">{renderAletaBotTemplatePreview(templateDraft[template.id] ?? template.body)}</pre>
                      </div>
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => openModal({ type: "template", title: `Edit Isi Pesan ${template.title}`, template })} disabled={isSaving || !template.editable}>
                          Edit Isi Pesan
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="notifications" id="notifikasi">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Notifikasi Terjadwal</CardTitle>
                <CardDescription>Pilih tujuan, sumber data, isi pesan, jadwal, lalu cek penerima sebelum pengiriman diaktifkan.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-6">
                  {["Pilih tujuan", "Pilih sumber data", "Pilih isi pesan", "Atur jadwal", "Preview penerima", "Simulasi / aktifkan"].map((step, index) => (
                    <div key={step} className="rounded-lg border border-border bg-muted/20 p-3">
                      <span className="font-semibold text-foreground">{index + 1}. </span>{step}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => { setNotificationForm(makeEmptyNotificationForm(snapshot, "employee")); openModal({ type: "notification", title: "Tambah Notifikasi Pegawai" }); }} disabled={isSaving}>Tambah Notifikasi Pegawai</Button>
                  <Button variant="outline" onClick={() => { setNotificationForm(makeEmptyNotificationForm(snapshot, "party")); openModal({ type: "notification", title: "Tambah Notifikasi Pihak" }); }} disabled={isSaving}>Tambah Notifikasi Pihak</Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Tampilkan:</span>
                  {(["all", "employee", "party"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setNotifCategoryFilter(f)}
                      className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${notifCategoryFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                      {f === "all" ? "Semua" : f === "employee" ? "Pegawai" : "Pihak"}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {(notifCategoryFilter === "all" || notifCategoryFilter === "employee") ? (
              <NotificationSection
                title="Notifikasi Pegawai"
                description={`${snapshot.employeeRecipients.length} user aktif memiliki nomor WhatsApp valid dari data manajemen_surat.`}
                notifications={snapshot.notifications.filter((item) => item.category === "employee")}
                queries={snapshot.queries}
                templates={snapshot.templates}
                onEdit={(notification) => {
                  setNotificationForm(notificationToForm(notification));
                  openModal({ type: "notification", title: `Edit Notifikasi ${notification.name}` });
                }}
                onTest={(notification) => void runAction("test-notification", { notificationId: notification.id })}
                onPreviewRecipients={(notification) => void previewNotificationRecipients(notification)}
                isSaving={isSaving}
              />
            ) : null}
            {(notifCategoryFilter === "all" || notifCategoryFilter === "party") ? (
              <NotificationSection
                title="Notifikasi Pihak"
                description="Nomor tujuan berasal dari kolom hasil query perkara/SIPP, misalnya telepon, nomor_hp, atau nomor_whatsapp."
                notifications={snapshot.notifications.filter((item) => item.category === "party")}
                queries={snapshot.queries}
                templates={snapshot.templates}
                onEdit={(notification) => {
                  setNotificationForm(notificationToForm(notification));
                  openModal({ type: "notification", title: `Edit Notifikasi ${notification.name}` });
                }}
                onTest={(notification) => void runAction("test-notification", { notificationId: notification.id })}
                onPreviewRecipients={(notification) => void previewNotificationRecipients(notification)}
                isSaving={isSaving}
              />
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="queries" id="queries">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Sumber Data SQL</CardTitle>
                <CardDescription>Satu sumber data bisa dipakai untuk notifikasi terjadwal dan aturan jawaban WhatsApp.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button onClick={() => { setQueryForm(makeEmptyQueryForm("employee")); openModal({ type: "query", title: "Tambah Sumber Data Pegawai" }); }} disabled={isSaving}>Tambah Sumber Data Pegawai</Button>
                <Button variant="outline" onClick={() => { setQueryForm(makeEmptyQueryForm("party")); openModal({ type: "query", title: "Tambah Sumber Data Pihak" }); }} disabled={isSaving}>Tambah Sumber Data Pihak</Button>
                <Button variant="outline" onClick={() => { setQueryForm(makeEmptyQueryForm("system")); openModal({ type: "query", title: "Tambah Sumber Data Umum" }); }} disabled={isSaving}>Tambah Sumber Data Umum</Button>
              </CardContent>
            </Card>

            <Card className="max-w-full min-w-0 overflow-hidden">
              <CardHeader>
                <CardTitle>Daftar Sumber Data</CardTitle>
                <CardDescription>Dipetakan dari query.js, notifikasi.js, app.js, dan sumber data baru yang disimpan di database ALETA Bot.</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 max-w-full overflow-hidden">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/20 p-2">
                  <p className="text-xs text-muted-foreground">Geser tabel ke kiri/kanan untuk melihat Contoh SQL, Health Check, dan Aksi.</p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => scrollSourceDataTable("left")}
                      aria-label="Geser daftar sumber data ke kiri"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => scrollSourceDataTable("right")}
                      aria-label="Geser daftar sumber data ke kanan"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div
                  ref={sourceDataTopScrollRef}
                  className={cn(
                    "mb-3 h-5 w-full max-w-full overflow-x-scroll overflow-y-hidden overscroll-x-contain rounded bg-muted/30",
                    HORIZONTAL_SCROLLBAR_CLASS
                  )}
                  onScroll={() => syncSourceDataHorizontalScroll("top")}
                >
                  <div className="h-4 w-[2240px]" />
                </div>
                <div
                  ref={sourceDataTableScrollRef}
                  className={cn(
                    "max-w-full overflow-x-scroll overflow-y-hidden overscroll-x-contain pb-3",
                    HORIZONTAL_SCROLLBAR_CLASS
                  )}
                  onScroll={() => syncSourceDataHorizontalScroll("table")}
                >
                  <table className="w-[2240px] table-fixed text-left text-sm">
                    <thead className="border-b border-border text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      <tr>
                        <th className="w-[320px] py-3 pr-4">Nama</th>
                        <th className="w-[140px] py-3 pr-4">Kategori</th>
                        <th className="w-[260px] py-3 pr-4">Dipakai Notifikasi</th>
                        <th className="w-[170px] py-3 pr-4">Sumber SQL</th>
                        <th className="w-[440px] py-3 pr-4">Contoh SQL</th>
                        <th className="w-[180px] py-3 pr-4">Kolom</th>
                        <th className="w-[140px] py-3 pr-4">Status</th>
                        <th className="w-[380px] py-3 pr-4">Health Check</th>
                        <th className="w-[210px] py-3 pr-4">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.queries.map((query) => (
                        <tr key={query.id} className="border-b border-border/70 align-top">
                          <td className="break-words py-4 pr-4">
                            <p className="font-medium text-foreground">{queryDisplayName(query)}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{query.description}</p>
                          </td>
                          <td className="break-words py-4 pr-4"><Badge variant="outline">{query.category}</Badge></td>
                          <td className="break-words py-4 pr-4 text-muted-foreground">{query.usedByNotifications.join(", ") || "-"}</td>
                          <td className="break-words py-4 pr-4"><Badge variant="outline">{query.connectionKey}</Badge></td>
                          <td className="break-words py-4 pr-4"><code className="line-clamp-4 break-words text-xs text-muted-foreground">{query.sqlText}</code></td>
                          <td className="break-words py-4 pr-4">
                            <p>{query.outputColumns.length} kolom</p>
                            <p className="text-xs text-muted-foreground">{query.recipientColumn || "tanpa kolom nomor"}</p>
                          </td>
                          <td className="break-words py-4 pr-4"><Badge variant={query.isActive ? "success" : "muted"}>{query.isActive ? "Aktif" : "Nonaktif"}</Badge></td>
                          <td className="break-words py-4 pr-4">
                            <p>{query.lastTestedAt ? formatDateTime(query.lastTestedAt) : "Belum dites"}</p>
                            <Badge variant={statusVariant(query.lastTestStatus)}>{query.lastTestStatus}</Badge>
                            {query.lastTestedAt ? (
                              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                <p>{query.lastTestRowCount ?? 0} data · {query.lastTestDurationMs ?? 0}ms</p>
                                {query.lastTestSlow ? <Badge variant="warning">Query lambat</Badge> : null}
                                {query.lastTestMessage ? <p>{query.lastTestMessage}</p> : null}
                                {query.lastTestError ? <p className="text-destructive">{query.lastTestError}</p> : null}
                                {(query.lastTestSampleRows ?? []).length > 0 ? (
                                  <details className="rounded-lg border border-border/70 bg-background/60 p-2">
                                    <summary className="cursor-pointer text-foreground">Contoh data</summary>
                                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] leading-5">
                                      {JSON.stringify((query.lastTestSampleRows ?? []).slice(0, 3), null, 2)}
                                    </pre>
                                  </details>
                                ) : null}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-4 pr-4">
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" size="sm" onClick={() => { setQueryForm(queryToForm(query)); openModal({ type: "query", title: `Edit Sumber Data ${queryDisplayName(query)}` }); }} disabled={isSaving}>Edit</Button>
                              <Button variant="outline" size="sm" onClick={() => void runAction("test-query", { queryId: query.id })} disabled={isSaving}>Uji</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {isSuperAdmin ? <TabsContent value="database" id="database">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Sumber Data SQL</CardTitle>
              <CardDescription>Atur sumber data yang dipakai ALETA Bot untuk membaca informasi perkara, antrean, dan data pendukung. Password lama tidak pernah ditampilkan ulang; isi password hanya jika ingin mengganti.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-4">
                <InfoCard title="Koneksi Aktif" value={String(snapshot.dbConnections.filter((item) => item.isActive).length)} hint={`${snapshot.dbConnections.length} koneksi terdaftar.`} />
                <InfoCard title="Default" value={snapshot.dbConnections.find((item) => item.isDefault)?.key || "-"} hint="Dipakai sebagai fallback query baru." />
                <InfoCard title="Test Gagal" value={String(snapshot.dbConnections.filter((item) => item.lastTestStatus === "failed").length)} hint="Periksa host, user, password, atau nama database jika gagal." />
                <InfoCard title="Legacy Fallback" value={String(snapshot.dbConnections.filter((item) => item.legacySource).length)} hint="Masih kompatibel dengan db_config lama." />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Kelola Koneksi</CardTitle>
                <CardDescription>Gunakan password manual atau env key. Password manual tidak pernah dikirim balik ke browser dan tidak masuk export config.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => { setDbConnectionForm(makeEmptyDbConnectionForm()); openModal({ type: "database", title: "Tambah Koneksi SQL" }); }} disabled={isSaving}>Tambah Koneksi SQL</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daftar Koneksi</CardTitle>
                <CardDescription>Test connection menjalankan SELECT 1 dari runtime ALETA Bot. Error disanitasi sebelum masuk log.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="min-w-[1040px] table-fixed text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <tr>
                      <th className="w-[18%] py-3 pr-3">Nama</th>
                      <th className="w-[12%] py-3 pr-3">Key</th>
                      <th className="w-[16%] py-3 pr-3">Host/DB</th>
                      <th className="w-[11%] py-3 pr-3">User</th>
                      <th className="w-[14%] py-3 pr-3">Password</th>
                      <th className="w-[10%] py-3 pr-3">Status</th>
                      <th className="w-[11%] py-3 pr-3">Last Test</th>
                      <th className="w-[8%] py-3 pr-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.dbConnections.map((connection) => (
                      <tr key={connection.id} className="border-b border-border/70 align-top">
                        <td className="min-w-0 break-words py-4 pr-3">
                          <p className="font-medium text-foreground">{connection.name}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{connection.description || connection.legacySource || "-"}</p>
                        </td>
                        <td className="min-w-0 break-words py-4 pr-3"><Badge variant="outline">{connection.key}</Badge></td>
                        <td className="min-w-0 break-words py-4 pr-3">
                          <p>{connection.host}:{connection.port}</p>
                          <p className="text-xs text-muted-foreground">{connection.databaseName}</p>
                        </td>
                        <td className="min-w-0 break-words py-4 pr-3">{connection.usernameMasked || "***"}</td>
                        <td className="min-w-0 break-words py-4 pr-3">
                          <p className="text-xs text-muted-foreground">
                            {connection.passwordSource === "manual" ? "manual password" : connection.passwordEnvKey || "env belum diatur"}
                          </p>
                          <Badge variant={connection.passwordConfigured ? "success" : "warning"}>{connection.passwordConfigured ? "configured" : "missing"}</Badge>
                        </td>
                        <td className="min-w-0 break-words py-4 pr-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={connection.isActive ? "success" : "muted"}>{connection.isActive ? "Active" : "Disabled"}</Badge>
                            {connection.isDefault ? <Badge variant="outline">Default</Badge> : null}
                          </div>
                        </td>
                        <td className="min-w-0 break-words py-4 pr-3">
                          <Badge variant={statusVariant(connection.lastTestStatus)}>{connection.lastTestStatus}</Badge>
                          <p className="mt-1 text-xs text-muted-foreground">{connection.lastTestAt ? formatDateTime(connection.lastTestAt) : "Belum dites"}</p>
                          {connection.lastTestError ? <p className="mt-1 text-xs text-destructive">{connection.lastTestError}</p> : null}
                        </td>
                        <td className="min-w-0 py-4 pr-3">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setDbConnectionForm(dbConnectionToForm(connection)); openModal({ type: "database", title: `Edit Koneksi ${connection.name}` }); }} disabled={isSaving}>Edit</Button>
                            <Button variant="outline" size="sm" onClick={() => void testDbConnection(connection.key)} disabled={isSaving}>Test</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent> : null}

        <TabsContent value="public-qa" id="public-qa">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Aturan Jawaban WhatsApp</CardTitle>
                <CardDescription>Atur jawaban untuk pertanyaan yang diketik ke WhatsApp admin, baik untuk para pihak maupun pegawai terdaftar.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-5">
                <InfoCard title="Aturan Aktif" value={String(snapshot.publicQaIntents.filter((item) => item.isActive).length)} hint={`${snapshot.publicQaIntents.length} aturan terdaftar.`} />
                <InfoCard title="AI Pengenal" value={String(snapshot.publicQaIntents.filter((item) => item.aiEnabled).length)} hint="AI membantu mengenali maksud pertanyaan." />
                <InfoCard title="Butuh Verifikasi" value={String(snapshot.publicQaIntents.filter((item) => item.requiresVerification).length)} hint="Intent perkara/panjar/akta perlu hati-hati." />
                <InfoCard title="Fallback Hari Ini" value={String(runtimeDashboard?.payload?.publicQa?.stats?.fallbackToday ?? 0)} hint={`${runtimeDashboard?.payload?.publicQa?.stats?.totalToday ?? 0} interaksi tercatat hari ini.`} />
                <InfoCard title="Perlu Tinjauan" value={String(publicQaNeedsReviewCount)} hint={publicQaNeedsReviewCount > 0 ? "Butuh tindak lanjut petugas." : "Tidak ada pertanyaan publik yang perlu ditinjau."} />
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Daftar Aturan Jawaban</CardTitle>
                      <CardDescription>Kata kunci lama tetap bisa dipakai, sementara contoh pertanyaan membantu AI mengenali kalimat yang lebih natural.</CardDescription>
                    </div>
                    {isSuperAdmin ? <Button onClick={() => { setPublicQaIntentForm(makeEmptyPublicQaIntentForm()); openModal({ type: "publicQa", title: "Tambah Aturan Jawaban" }); }} disabled={isSaving}>Tambah Aturan</Button> : <p className="text-xs text-muted-foreground">Menambah/mengubah aturan jawaban hanya dapat dilakukan Super Admin.</p>}
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[1120px] text-left text-sm">
                    <thead className="border-b border-border text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      <tr>
                        <th className="py-3 pr-4">Aturan</th>
                        <th className="py-3 pr-4">Kategori</th>
                        <th className="py-3 pr-4">Pertanyaan</th>
                        <th className="py-3 pr-4">Jawaban</th>
                        <th className="py-3 pr-4">Risiko</th>
                        <th className="py-3 pr-4">Status</th>
                        <th className="py-3 pr-4">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.publicQaIntents.map((intent) => (
                        <tr key={intent.id} className="border-b border-border/70 align-top">
                          <td className="py-4 pr-4">
                            <p className="font-medium text-foreground">{intent.name}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{intent.key}</p>
                          </td>
                          <td className="py-4 pr-4">
                            <Badge variant="outline">{intent.category}</Badge>
                            <p className="mt-2 text-xs text-muted-foreground">{intent.audience}</p>
                          </td>
                          <td className="py-4 pr-4 text-muted-foreground">
                            <p>{intent.exactTriggers.slice(0, 4).join(", ") || "-"}</p>
                            <p className="mt-1 text-xs">{intent.exampleQuestions.slice(0, 2).join(" / ")}</p>
                          </td>
                          <td className="py-4 pr-4">
                            <Badge variant="outline">{intent.responseMode}</Badge>
                            <p className="mt-2 text-xs text-muted-foreground">{intent.aiAnswerMode} / {intent.verificationPolicy}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{intent.queryKey || intent.legacyCommand || "-"}</p>
                          </td>
                          <td className="py-4 pr-4"><Badge variant={statusVariant(intent.riskLevel === "high" ? "failed" : intent.riskLevel)}>{intent.riskLevel}</Badge></td>
                          <td className="py-4 pr-4">
                            <div className="space-y-2">
                            <Badge variant={intent.isActive ? "success" : "muted"}>{intent.isActive ? "Aktif" : "Nonaktif"}</Badge>
                            <Badge variant={intent.aiEnabled ? "success" : "outline"}>{intent.aiEnabled ? "AI mengenali" : "Tanpa AI"}</Badge>
                            <Badge variant={intent.aiAnswerEnabled ? "success" : "outline"}>{intent.aiAnswerEnabled ? "AI menjawab" : "Jawaban biasa"}</Badge>
                            <Badge variant={intent.status === "active" ? "success" : "warning"}>{displayStatus(intent.status)}</Badge>
                            </div>
                          </td>
                          <td className="py-4 pr-4">
                            {isSuperAdmin ? <Button variant="outline" size="sm" onClick={() => { setPublicQaIntentForm(publicQaIntentToForm(intent)); openModal({ type: "publicQa", title: `Edit Aturan ${intent.name}` }); }} disabled={isSaving}>Edit</Button> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Uji Pertanyaan</CardTitle>
                  <CardDescription>Coba pertanyaan tanpa mengirim pesan WhatsApp.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field label="Pertanyaan" value={publicQaQuestion} onChange={setPublicQaQuestion} />
                  <Button variant="outline" onClick={() => void testPublicQaIntent()} disabled={isSaving}>
                    <Play className="h-4 w-4" />
                    Uji Pertanyaan
                  </Button>
                  {publicQaTestResult ? <pre className="max-h-80 overflow-auto rounded-xl border border-border bg-muted/40 p-4 text-xs leading-5 text-foreground whitespace-pre-wrap">{publicQaTestResult}</pre> : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Log Pertanyaan</CardTitle>
                  <CardDescription>Riwayat terbaru pertanyaan, aturan jawaban, dan fallback.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {snapshot.publicQaLogs.length === 0 && publicQaRuntimeLogs.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Belum ada log pertanyaan.</div>
                  ) : (
                    publicQaRuntimeLogs.length > 0 ? publicQaRuntimeLogs.slice(0, 12).map((log) => (
                      <div key={log.id} className="rounded-xl border border-border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={statusVariant(log.status || "fallback")}>{log.status || "fallback"}</Badge>
                            <Badge variant="outline">{log.matched_intent_key || "fallback"}</Badge>
                            <Badge variant="outline">{log.matched_method || "-"}</Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">{log.created_at ? formatDateTime(log.created_at) : "-"}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-foreground">{log.raw_message || "-"}</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{log.response_preview || "-"}</p>
                      </div>
                    )) : snapshot.publicQaLogs.slice(0, 12).map((log) => (
                      <div key={log.id} className="rounded-xl border border-border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                            <Badge variant="outline">{log.matchedIntentKey || "fallback"}</Badge>
                            <Badge variant="outline">{log.matchedMethod}</Badge>
                            {log.needsHumanReview ? <Badge variant="warning">Perlu Tinjauan</Badge> : null}
                          </div>
                          <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-foreground">{log.rawMessage}</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{log.responsePreview}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Tinjauan Pertanyaan WhatsApp</CardTitle>
                    <CardDescription>Fallback/unknown yang perlu tindak lanjut manusia. Aksi di sini tidak membalas WhatsApp.</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={publicQaNeedsReviewCount > 0 ? "warning" : "success"}>
                      {publicQaNeedsReviewCount > 0 ? `${publicQaNeedsReviewCount} menunggu` : "Tidak ada pending"}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={exportPublicQaHumanReview}>
                      Export CSV
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {([
                    ["all", "Semua"],
                    ["needs_review", "Perlu Tindak Lanjut"],
                    ["reviewed", "Sudah Ditinjau"],
                    ["ignored", "Diabaikan"],
                    ["converted_to_intent", "Sudah Jadi Aturan"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPublicQaReviewFilter(value)}
                      className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${publicQaReviewFilter === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {filteredUnknownQuestionReviews.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Tidak ada pertanyaan untuk filter ini.
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {filteredUnknownQuestionReviews.slice(0, 12).map((item) => (
                      <div key={item.id || item.normalizedMessage} className="rounded-xl border border-border p-4 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words font-medium text-foreground">{item.rawMessage}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Frekuensi {item.frequency}x, terakhir {formatDateTime(item.lastAskedAt)}, pengirim {item.senderMasked || "masked"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={item.needsHumanReview && item.reviewStatus === "pending" ? "warning" : "muted"}>
                              {item.reviewStatus === "pending" ? "Menunggu Tinjauan" : item.reviewStatus === "reviewed" ? "Sudah Ditinjau" : item.reviewStatus === "ignored" ? "Diabaikan" : "Sudah Jadi Intent"}
                            </Badge>
                            <Badge variant={item.safetyRisk === "high" ? "danger" : item.safetyRisk === "medium" ? "warning" : "muted"}>{item.safetyRisk}</Badge>
                          </div>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-muted-foreground">
                          Saran aturan: <code>{item.suggestedIntentKey}</code> ({Math.round(item.confidence * 100)}%) - {item.suggestedAction}
                        </p>
                        {item.reviewNote ? <p className="mt-2 text-xs text-muted-foreground">Catatan: {item.reviewNote}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isSaving}
                            onClick={() => {
                              setPublicQaReviewNote(item.reviewNote || "");
                              openModal({ type: "publicQaReview", title: "Tinjau Pertanyaan WhatsApp", review: item });
                            }}
                          >
                            Review
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="logs" id="logs">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Filter:</span>
                {(["all", "error", "whatsapp", "ai", "queue", "approval", "migration"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setLogFilter(f)}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${logFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                    {f === "all" ? "Semua" : f === "error" ? "Kendala" : f === "whatsapp" ? "WhatsApp" : f === "ai" ? "AI" : f === "queue" ? "Antrean" : f === "approval" ? "Persetujuan" : "Migrasi"}
                </button>
              ))}
              <span className="ml-2 text-xs text-muted-foreground">{filteredLogs.length} entri ditampilkan</span>
            </div>
            <LogCard title="Log Aktivitas" logs={filteredLogs} />
            <Card>
              <CardHeader>
                <CardTitle>Retensi Log</CardTitle>
                <CardDescription>Hapus log lama yang bukan audit trail. Hanya log non-kritis (&gt;30 hari) yang akan dihapus. Audit trail tidak pernah dihapus.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {!showPurgeConfirm ? (
                  <Button
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => { setShowPurgeConfirm(true); setPurgeConfirmText(""); }}
                  >
                    Bersihkan Log Lama
                  </Button>
                ) : (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                    <p className="text-sm font-semibold text-foreground">Konfirmasi Hapus Log Lama</p>
                    <p className="text-xs text-muted-foreground">
                      Aksi ini akan menghapus log pesan, log sistem, dan log notifikasi yang berusia lebih dari 30 hari.
                      Log audit trail dan riwayat approval <strong>tidak</strong> akan dihapus.
                      Untuk melanjutkan, ketik <code className="rounded bg-muted px-1 py-0.5 font-bold">HAPUS LOG LAMA</code> di bawah ini.
                    </p>
                    <Input
                      value={purgeConfirmText}
                      onChange={(event) => setPurgeConfirmText(event.target.value)}
                      placeholder="HAPUS LOG LAMA"
                      className="max-w-xs font-mono"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isSaving || purgeConfirmText !== "HAPUS LOG LAMA"}
                        onClick={() => void purgeLogs()}
                      >
                        Hapus Sekarang
                      </Button>
                      <Button size="sm" variant="outline" disabled={isSaving} onClick={() => { setShowPurgeConfirm(false); setPurgeConfirmText(""); }}>
                        Batal
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" id="reports">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Laporan WhatsApp</CardTitle>
                    <CardDescription>Cetak data pesan yang diproses bot dalam format Excel rapi dengan filter dan sheet statistik.</CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => void loadWhatsappReport()} disabled={isReportLoading}>
                      <RefreshCcw className="h-4 w-4" />
                      {isReportLoading ? "Memuat..." : "Muat Data"}
                    </Button>
                    <Button type="button" onClick={() => void exportWhatsappReportExcel()} disabled={isReportExporting}>
                      <Download className="h-4 w-4" />
                      {isReportExporting ? "Membuat..." : "Cetak Excel"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,220px)_minmax(0,220px)_minmax(0,240px)_1fr]">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Rentang Data</p>
                    <NativeSelect value={whatsappReportRange} onChange={(event) => setWhatsappReportRange(event.target.value)}>
                      {WHATSAPP_REPORT_RANGE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                    <NativeSelect value={whatsappReportStatus} onChange={(event) => setWhatsappReportStatus(event.target.value)}>
                      {WHATSAPP_REPORT_STATUS_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Aplikasi</p>
                    <NativeSelect value={whatsappReportSource} onChange={(event) => setWhatsappReportSource(event.target.value)}>
                      {WHATSAPP_REPORT_SOURCE_OPTIONS.map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                    {whatsappReport
                      ? `Data ${whatsappReport.range.label} untuk ${whatsappReport.source.label}, dibuat ${formatDateTime(whatsappReport.generatedAt)}. Excel berisi sheet Ringkasan, Pesan WhatsApp, Per Status, Per Aplikasi, Per Fitur, Error, Tren Harian, dan Log Sistem.`
                      : "Pilih rentang lalu muat data untuk melihat statistik. Tombol Cetak Excel tetap bisa langsung dipakai."}
                    {whatsappReportExportInfo ? (
                      <p className="mt-2 text-xs font-medium text-foreground">
                        Excel terakhir: {whatsappReportExportInfo.filename} ({whatsappReportExportInfo.rowCount} baris, {whatsappReportExportInfo.sizeKb} KB), dibuat {formatDateTime(whatsappReportExportInfo.exportedAt)}.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <InfoCard title="Total Diproses" value={String(whatsappReport?.stats.total ?? 0)} hint="Jumlah log pada rentang dan status yang dipilih." onClick={() => applyWhatsappReportFilters({ status: "all" })} actionLabel="Tampilkan semua status" />
                  <InfoCard title="Terkirim" value={String(whatsappReport?.stats.sent ?? 0)} hint="Status sent, success, atau delivered." onClick={() => applyWhatsappReportFilters({ status: "sent" })} actionLabel="Filter terkirim" />
                  <InfoCard title="Gagal" value={String(whatsappReport?.stats.failed ?? 0)} hint="Status failed atau dead letter." onClick={() => applyWhatsappReportFilters({ status: "failed" })} actionLabel="Filter gagal" />
                  <InfoCard title="Simulasi" value={String(whatsappReport?.stats.simulated ?? 0)} hint="Pesan simulasi/dry run." onClick={() => applyWhatsappReportFilters({ status: "simulated" })} actionLabel="Filter simulasi" />
                  <InfoCard title="Berhasil" value={`${whatsappReport?.stats.successRate ?? 0}%`} hint="Rasio terkirim dari total diproses." onClick={() => applyWhatsappReportFilters({ status: "sent" })} actionLabel="Lihat pesan berhasil" />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle>Per Status</CardTitle>
                  <CardDescription>Ringkasan status pengiriman pada rentang terpilih.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(whatsappReport?.stats.byStatus ?? []).slice(0, 8).map(([label, count]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => applyWhatsappReportFilters({ status: reportStatusKeyFromLabel(label) })}
                      className="flex w-full items-center justify-between rounded border border-border p-2 text-left text-sm transition hover:border-primary/50 hover:bg-primary/5"
                    >
                      <span className="font-medium text-foreground">{label}</span>
                      <Badge variant={label.toLowerCase().includes("gagal") ? "danger" : label.toLowerCase().includes("terkirim") ? "success" : "muted"}>{count}</Badge>
                    </button>
                  ))}
                  {!whatsappReport?.stats.byStatus.length ? <p className="text-sm text-muted-foreground">Belum ada data pada filter ini.</p> : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Per Aplikasi</CardTitle>
                  <CardDescription>Pemisah Notifikasi Perkara, Manajemen Surat, dan E-Kepegawaian.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(whatsappReport?.stats.byApp ?? []).slice(0, 8).map(([label, count]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        const sourceKey = reportSourceKeyFromLabel(label);
                        if (sourceKey === "all") {
                          setReportTableAppFilter(label);
                          focusReportTable();
                          return;
                        }
                        applyWhatsappReportFilters({ sourceApp: sourceKey });
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded border border-border p-2 text-left text-sm transition hover:border-primary/50 hover:bg-primary/5"
                    >
                      <span className="break-words font-medium text-foreground">{label}</span>
                      <Badge variant="muted">{count}</Badge>
                    </button>
                  ))}
                  {!whatsappReport?.stats.byApp.length ? <p className="text-sm text-muted-foreground">Belum ada aplikasi yang tercatat.</p> : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Per Fitur</CardTitle>
                  <CardDescription>Fitur yang paling banyak memproses WhatsApp.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(whatsappReport?.stats.byFeature ?? []).slice(0, 8).map(([label, count]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setReportTableFeatureFilter(label);
                        focusReportTable();
                      }}
                      className="flex w-full items-center justify-between rounded border border-border p-2 text-left text-sm transition hover:border-primary/50 hover:bg-primary/5"
                    >
                      <span className="break-words font-medium text-foreground">{label}</span>
                      <Badge variant="muted">{count}</Badge>
                    </button>
                  ))}
                  {!whatsappReport?.stats.byFeature.length ? <p className="text-sm text-muted-foreground">Belum ada fitur yang tercatat.</p> : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Error Teratas</CardTitle>
                  <CardDescription>Alasan gagal yang paling sering muncul.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(whatsappReport?.stats.topErrors ?? []).slice(0, 6).map(([label, count]) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setReportTableSearch(label);
                        applyWhatsappReportFilters({ status: "failed" });
                        focusReportTable();
                      }}
                      className="w-full rounded border border-border p-2 text-left text-sm transition hover:border-primary/50 hover:bg-primary/5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">Error</span>
                        <Badge variant="danger">{count}</Badge>
                      </div>
                      <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{label}</p>
                    </button>
                  ))}
                  {!whatsappReport?.stats.topErrors.length ? <p className="text-sm text-muted-foreground">Tidak ada error pada filter ini.</p> : null}
                </CardContent>
              </Card>
            </div>

            <Card id="report-data-table">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>Data Terbaru</CardTitle>
                    <CardDescription>Cuplikan data. File Excel berisi data lengkap sesuai rentang yang dipilih.</CardDescription>
                  </div>
                  <Button type="button" variant="outline" onClick={() => void exportLatestWhatsappRowsExcel()} disabled={isLatestReportExporting}>
                    <Download className="h-4 w-4" />
                    {isLatestReportExporting ? "Membuat..." : "Cetak Excel Data Terbaru"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(0,180px)_minmax(0,200px)_minmax(0,220px)_minmax(0,180px)_auto_auto]">
                  <Input
                    value={reportTableSearch}
                    onChange={(event) => setReportTableSearch(event.target.value)}
                    placeholder="Cari penerima, nomor, fitur, data, atau isi pesan"
                    aria-label="Cari data terbaru"
                  />
                  <NativeSelect value={reportTableStatusFilter} onChange={(event) => setReportTableStatusFilter(event.target.value)} aria-label="Filter status tabel">
                    <option value="all">Semua status</option>
                    {reportTableStatusOptions.map((label) => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </NativeSelect>
                  <NativeSelect value={reportTableAppFilter} onChange={(event) => setReportTableAppFilter(event.target.value)} aria-label="Filter aplikasi tabel">
                    <option value="all">Semua aplikasi</option>
                    {reportTableAppOptions.map((label) => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </NativeSelect>
                  <NativeSelect value={reportTableFeatureFilter} onChange={(event) => setReportTableFeatureFilter(event.target.value)} aria-label="Filter fitur tabel">
                    <option value="all">Semua fitur</option>
                    {reportTableFeatureOptions.map((label) => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </NativeSelect>
                  <NativeSelect value={reportTableSortKey} onChange={(event) => setReportTableSortKey(event.target.value as ReportTableSortKey)} aria-label="Urutkan tabel">
                    {REPORT_TABLE_SORT_OPTIONS.map((item) => (
                      <option key={item.key} value={item.key}>Urutkan: {item.label}</option>
                    ))}
                  </NativeSelect>
                  <Button type="button" variant="outline" onClick={() => setReportTableSortDirection((direction) => (direction === "asc" ? "desc" : "asc"))}>
                    <ArrowUpDown className="h-4 w-4" />
                    {reportTableSortDirection === "asc" ? "Naik" : "Turun"}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetReportTableFilters} disabled={!reportTableHasFilter}>
                    <X className="h-4 w-4" />
                    Reset
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Menampilkan {displayedReportRows.length} dari {filteredReportRows.length} data yang cocok. Data dimuat: {reportRows.length} baris.
                </p>
                {latestReportExportInfo ? (
                  <p className="text-sm text-muted-foreground">
                    Excel Data Terbaru terakhir: <span className="font-medium text-foreground">{latestReportExportInfo.filename}</span> ({latestReportExportInfo.rowCount} baris, {latestReportExportInfo.sizeKb} KB), dibuat {formatDateTime(latestReportExportInfo.exportedAt)}.
                  </p>
                ) : null}
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="min-w-[1040px] w-full text-left text-sm">
                    <thead className="bg-muted text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3">{renderReportSortHeader("createdAt", "Waktu")}</th>
                        <th className="px-3 py-3">{renderReportSortHeader("statusLabel", "Status")}</th>
                        <th className="px-3 py-3">{renderReportSortHeader("recipientName", "Penerima")}</th>
                        <th className="px-3 py-3">{renderReportSortHeader("recipientNumber", "Nomor")}</th>
                        <th className="px-3 py-3">{renderReportSortHeader("sourceAppLabel", "Aplikasi")}</th>
                        <th className="px-3 py-3">{renderReportSortHeader("sourceFeatureLabel", "Fitur")}</th>
                        <th className="px-3 py-3">{renderReportSortHeader("caseOrPosition", "Data")}</th>
                        <th className="px-3 py-3">{renderReportSortHeader("messagePreview", "Isi Pesan")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedReportRows.map((row) => (
                        <tr key={row.id} className="border-t border-border align-top">
                          <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{formatDateTime(row.createdAt)}</td>
                          <td className="px-3 py-3"><Badge variant={row.statusLabel.toLowerCase().includes("gagal") ? "danger" : row.statusLabel.toLowerCase().includes("terkirim") ? "success" : "muted"}>{row.statusLabel}</Badge></td>
                          <td className="px-3 py-3 font-medium text-foreground">{row.recipientName || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{row.recipientNumber || "-"}</td>
                          <td className="px-3 py-3 text-muted-foreground">{row.sourceAppLabel || "-"}</td>
                          <td className="px-3 py-3 text-muted-foreground">{row.sourceFeatureLabel || row.categoryLabel || "-"}</td>
                          <td className="px-3 py-3 text-muted-foreground">{row.caseOrPosition || "-"}</td>
                          <td className="max-w-sm px-3 py-3 text-muted-foreground">
                            <p className="line-clamp-3 break-words">{row.messagePreview || row.errorMessage || "-"}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filteredReportRows.length ? (
                  <p className="mt-3 text-sm text-muted-foreground">{isReportLoading ? "Memuat laporan..." : "Belum ada data pada filter ini."}</p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="manual-test" id="manual-test">
          <div className="space-y-4">
            <AletaBotManualSendPanel
              queries={snapshot.queries}
              templates={snapshot.templates}
              notifications={snapshot.notifications}
              employeeRecipients={snapshot.employeeRecipients}
              dryRunEnabled={settingsDraft.dryRunEnabled}
              testTargetNumber={settingsDraft.testTargetNumber}
              onAfterSend={() => {
                void loadWhatsappReport(undefined, { silent: true });
              }}
            />
            <ManualSendProgressCard result={manualSendProgress} />
            <Card>
              <CardHeader>
                <CardTitle>Uji Sumber Data & Isi Pesan (Simulasi Aman)</CardTitle>
                <CardDescription>Cek database, isi pesan, dan notifikasi memakai data contoh tanpa pengiriman.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <select className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                  {snapshot.templates.map((template) => <option key={template.id} value={template.id}>{templateDisplayName(template)}</option>)}
                </select>
                <Button variant="outline" onClick={() => void runAction("test-template", { templateId: selectedTemplateId })} disabled={isSaving || !selectedTemplateId}>
                  <FileText className="h-4 w-4" />
                  Preview Isi Pesan
                </Button>
                <select className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={selectedQueryId} onChange={(event) => setSelectedQueryId(event.target.value)}>
                  {snapshot.queries.map((item) => <option key={item.id} value={item.id}>{queryDisplayName(item)}</option>)}
                </select>
                <Button variant="outline" onClick={() => void runAction("test-query", { queryId: selectedQueryId })} disabled={isSaving || !selectedQueryId}>
                  <Database className="h-4 w-4" />
                  Uji Sumber Data
                </Button>
                <select className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={selectedNotificationId} onChange={(event) => setSelectedNotificationId(event.target.value)}>
                  {snapshot.notifications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <Button variant="outline" onClick={() => void runAction("test-notification", { notificationId: selectedNotificationId })} disabled={isSaving || !selectedNotificationId}>
                  <MessageCircleMore className="h-4 w-4" />
                  Simulasi Notifikasi
                </Button>
                {preview ? <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-muted/40 p-4 text-xs leading-5 text-foreground whitespace-pre-wrap">{preview}</pre> : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="antrian-online" id="antrian-online">
          <AletaBotAntrianOnlinePanel />
        </TabsContent>

        <TabsContent value="ecourt" id="ecourt">
          <AletaBotEcourtPanel />
        </TabsContent>

        <TabsContent value="queue-recovery" id="queue-recovery">
          <div className="space-y-4">
            <WorkerControlCard workerState={snapshot.workerState} isSaving={isSaving} onPause={(reason) => void runAction("pause-worker", { reason })} onResume={() => void runAction("resume-worker")} />
            <DeadLetterCard deadLetters={snapshot.deadLetters} resolvedDeadLetters={snapshot.resolvedDeadLetters ?? []} isSaving={isSaving} onResend={async (id) => {
              setIsSaving(true);
              setNotice(null);
              try {
                await requestBot<{ originalId: string; newId: string; status: string }>("/api/admin/aleta-bot/queue-recovery", {
                  method: "POST",
                  body: JSON.stringify({ id }),
                });
                await loadSnapshot();
                void loadWhatsappReport(undefined, { silent: true });
                globalThis.setTimeout(() => {
                  void loadWhatsappReport(undefined, { silent: true });
                }, 2500);
                notifySuccess("Pesan Gagal Berhasil Dikirim Ulang", `Dead letter ${id} sudah diproses ulang dan antrean dimuat ulang.`);
              } catch (error) {
                notifyError("Kirim Ulang Pesan Gagal", error instanceof Error ? error.message : "Resend dead letter belum berhasil.");
              } finally {
                setIsSaving(false);
              }
            }} onResolve={async (id, note) => {
              setIsSaving(true);
              setNotice(null);
              try {
                await requestBot<{ originalId: string; status: string }>("/api/admin/aleta-bot/queue-recovery", {
                  method: "POST",
                  body: JSON.stringify({ id, action: "resolve", note }),
                });
                await loadSnapshot();
                notifySuccess("Pesan Gagal Ditandai Ditangani", `Dead letter ${id} ditandai selesai tanpa resend dan daftar antrean diperbarui.`);
              } catch (error) {
                notifyError("Tandai Pesan Gagal Belum Berhasil", error instanceof Error ? error.message : "Dead letter belum berhasil ditandai selesai.");
              } finally {
                setIsSaving(false);
              }
            }} />
          </div>
        </TabsContent>

        <TabsContent value="approvals" id="approvals">
          <ApprovalRequestsCard
            approvalRequests={snapshot.approvalRequests}
            isSaving={isSaving}
            canReview={isSuperAdmin}
            onReview={async (approvalId, decision, notes) => {
              setIsSaving(true);
              setNotice(null);
              try {
                await requestBot<AletaBotApprovalRequest>("/api/admin/aleta-bot/approvals", {
                  method: "POST",
                  body: JSON.stringify({ mode: "review", approvalId, decision, notes }),
                });
                await loadSnapshot();
                notifySuccess(
                  decision === "approved" ? "Persetujuan Diterima" : "Persetujuan Ditolak",
                  `Permintaan approval sudah ${decision === "approved" ? "diterima" : "ditolak"} dan daftar persetujuan diperbarui.`
                );
              } catch (error) {
                notifyError("Proses Approval Gagal", error instanceof Error ? error.message : "Keputusan approval belum berhasil disimpan.");
              } finally {
                setIsSaving(false);
              }
            }}
          />
        </TabsContent>

        {isSuperAdmin ? <TabsContent value="migration" id="migration">
          <LegacyMigrationCard
            legacyMigrations={snapshot.legacyMigrations}
            unknownQuestionReviews={snapshot.unknownQuestionReviews}
            isSaving={isSaving}
            onAction={(action, migration) => openModal({ type: "legacyAction", title: migrationActionTitle(action), migration, action })}
            showAdvanced={showAdvancedMode}
          />
        </TabsContent> : null}
      </Tabs>

      <ModalShell modal={activeModal} isSaving={isSaving} onClose={closeModal}>
        {activeModal?.type === "settings" ? (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <ToggleRow label="Bot aktif" checked={settingsDraft.botEnabled} onCheckedChange={(value) => { markModalDirty(); setSettingsDraft((current) => ({ ...current, botEnabled: value })); }} />
              <ToggleRow label="Notifikasi otomatis" checked={settingsDraft.notificationsEnabled} onCheckedChange={(value) => { markModalDirty(); setSettingsDraft((current) => ({ ...current, notificationsEnabled: value })); }} />
              <ToggleRow label="Simulasi" checked={settingsDraft.dryRunEnabled} onCheckedChange={(value) => { markModalDirty(); setSettingsDraft((current) => ({ ...current, dryRunEnabled: value })); }} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nomor Admin WhatsApp" value={settingsDraft.adminWhatsappNumber} onChange={(value) => { markModalDirty(); setSettingsDraft((current) => ({ ...current, adminWhatsappNumber: value })); }} placeholder="628123456789" />
              <Field label="Nomor tujuan testing" value={settingsDraft.testTargetNumber} onChange={(value) => { markModalDirty(); setSettingsDraft((current) => ({ ...current, testTargetNumber: value })); }} placeholder="628123456789" />
              <Field label="Delay antar pesan (ms)" value={String(settingsDraft.messageDelayMs)} type="number" onChange={(value) => { markModalDirty(); setSettingsDraft((current) => ({ ...current, messageDelayMs: Number(value) })); }} />
              <Field label="Batas retry" value={String(settingsDraft.retryLimit)} type="number" onChange={(value) => { markModalDirty(); setSettingsDraft((current) => ({ ...current, retryLimit: Number(value) })); }} />
              <Field label="Jadwal default" value={settingsDraft.scheduleCron} onChange={(value) => { markModalDirty(); setSettingsDraft((current) => ({ ...current, scheduleCron: value })); }} />
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Catatan keamanan</span>
              <Textarea value={settingsDraft.securityNotes} onChange={(event) => { markModalDirty(); setSettingsDraft((current) => ({ ...current, securityNotes: event.target.value })); }} rows={3} />
            </label>
            <ModalActions isSaving={isSaving} onCancel={closeModal} onSave={() => void saveSettings()} saveLabel="Simpan Pengaturan" />
          </div>
        ) : null}

        {activeModal?.type === "template" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Variabel wajib pada isi pesan ini:{" "}
              {activeModal.template.placeholders.length > 0
                ? activeModal.template.placeholders.map((key) => describeAletaBotVariable(key).label).join(", ")
                : "tidak ada"}
              . Penjelasan tiap variabel ada di panel <span className="font-medium text-foreground">Pilihan Variabel &amp; Artinya</span>.
            </p>
            {(() => {
        const body = templateDraft[activeModal.template.id] ?? activeModal.template.body;
              const detected = extractTemplatePlaceholders(body);
              const unknown = detected.filter((placeholder) => !activeModal.template.placeholders.includes(placeholder));
              const missingRequired = activeModal.template.placeholders.filter((placeholder) => !detected.includes(placeholder));

              return (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <Textarea value={body} rows={14} onChange={(event) => { markModalDirty(); setTemplateDraft((current) => ({ ...current, [activeModal.template.id]: event.target.value })); }} disabled={!activeModal.template.editable} />
                    <div className="rounded-xl border border-border p-3 text-sm">
                      <p className="font-semibold text-foreground">Variabel yang dipakai isi pesan ini</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {detected.length > 0 ? detected.map((placeholder) => {
                          const doc = describeAletaBotVariable(placeholder);
                          return (
                            <Badge
                              key={placeholder}
                              variant={unknown.includes(placeholder) ? "danger" : "success"}
                              title={doc.shortDescription}
                            >
                              {doc.label}
                            </Badge>
                          );
                        }) : <span className="text-muted-foreground">Belum ada variabel dipakai.</span>}
                      </div>
                      {unknown.length > 0 ? (
                        <p className="mt-2 text-destructive">
                          Di luar daftar wajib: {unknown.map((key) => describeAletaBotVariable(key).label).join(", ")}. Pastikan sumber data memasoknya.
                        </p>
                      ) : null}
                      {missingRequired.length > 0 ? (
                        <p className="mt-2 text-amber-700 dark:text-amber-300">
                          Variabel wajib belum dipakai: {missingRequired.map((key) => describeAletaBotVariable(key).label).join(", ")}.
                        </p>
                      ) : null}
                    </div>
                    <TemplateSafetyWarnings body={body} />
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <p className="text-sm font-semibold text-foreground">Pratinjau Pesan</p>
                      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {renderAletaBotTemplatePreview(body)}
                      </pre>
                    </div>
                    <TemplateVariablePicker
                      templateId={activeModal.template.id}
                      editable={activeModal.template.editable}
                      requiredPlaceholders={activeModal.template.placeholders}
                      detectedPlaceholders={detected}
                      queries={snapshot.queries}
                      notifications={snapshot.notifications}
                      onInsertPlaceholder={(placeholder) => {
                        if (!activeModal.template.editable) return;
                        markModalDirty();
                        setTemplateDraft((current) => {
                          const currentBody = current[activeModal.template.id] ?? activeModal.template.body;
                          return { ...current, [activeModal.template.id]: `${currentBody}{{${placeholder}}}` };
                        });
                      }}
                    />
                    {snapshot ? (
                      <TemplateQuerySuggestions
                        template={activeModal.template}
                        queries={snapshot.queries}
                        notifications={snapshot.notifications}
                        placeholders={[...new Set([...activeModal.template.placeholders, ...detected])]}
                        onInsertPlaceholder={(placeholder) => {
                          if (!activeModal.template.editable) return;
                          markModalDirty();
                          setTemplateDraft((current) => {
                            const currentBody = current[activeModal.template.id] ?? activeModal.template.body;
                            return { ...current, [activeModal.template.id]: `${currentBody}{{${placeholder}}}` };
                          });
                        }}
                        onOpenQuery={(query) => {
                          setQueryForm(queryToForm(query));
                          openModal({ type: "query", title: `Edit Sumber Data ${queryDisplayName(query)}` });
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })()}
            <ModalActions isSaving={isSaving} onCancel={closeModal} onSave={() => void saveTemplate(activeModal.template)} saveLabel="Simpan Isi Pesan" />
          </div>
        ) : null}

        {activeModal?.type === "recipientPreview" ? (
          <div className="space-y-4">
            {recipientPreview ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <InfoCard title="Estimasi" value={String(recipientPreview.totalEstimated)} hint="Tidak ada pesan yang dikirim." />
                  <InfoCard title="Sample" value={String(recipientPreview.sampleSize)} hint="Maksimal 10 penerima di modal ini." />
                  <InfoCard title="Nomor Invalid" value={String(recipientPreview.items.filter((item) => !item.validNumber).length)} hint="Perbaiki data nomor sebelum aktivasi." />
                </div>
                {recipientPreview.warnings.length > 0 ? (
                  <div className="rounded-xl border border-amber-300/60 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                    {recipientPreview.warnings.join(" ")}
                  </div>
                ) : null}
                <div className="grid gap-3">
                  {recipientPreview.items.map((item) => (
                    <div key={item.idempotencyKey} className="rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{item.recipientName}</p>
                          <p className="text-xs text-muted-foreground">{item.caseOrPosition} · {item.recipientNumber || "nomor belum tersedia"}</p>
                        </div>
                        <Badge variant={item.validNumber ? "success" : "danger"}>{item.validNumber ? "Nomor valid" : "Nomor invalid"}</Badge>
                      </div>
                      <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap rounded-xl bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">{item.messagePreview}</pre>
                      <p className="mt-2 break-all text-xs text-muted-foreground">Idempotency sample: {item.idempotencyKey}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada hasil preview penerima.</p>
            )}
            <ModalActions isSaving={isSaving} onCancel={closeModal} onSave={closeModal} saveLabel="Tutup Preview" />
          </div>
        ) : null}

        {activeModal?.type === "notification" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              Alur: pilih tujuan, sumber data, isi pesan, jadwal kirim, lalu lakukan preview penerima dan simulasi sebelum aktif.
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nama notifikasi" value={notificationForm.name} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, name: value })); }} />
              <SelectField
                label={notificationForm.category === "employee" ? "Kelompok pegawai" : "Kelompok penerima pihak/eksternal"}
                value={notificationAudienceGroup(notificationForm)}
                onChange={(value) => {
                  const audienceGroup = normalizeAudienceGroup(notificationForm.category, value);
                  const nextQuery = defaultNotificationQuery(snapshot, notificationForm.category, audienceGroup);
                  const nextTemplate = defaultNotificationTemplate(snapshot, notificationForm.category, audienceGroup);
                  markModalDirty();
                  setNotificationForm((current) => ({
                    ...current,
                    queryId: nextQuery?.id ?? current.queryId,
                    templateId: nextTemplate?.id ?? current.templateId,
                    recipientMapping: { ...current.recipientMapping, audienceGroup },
                  }));
                }}
                options={(notificationForm.category === "employee" ? EMPLOYEE_NOTIFICATION_GROUP_OPTIONS : PARTY_NOTIFICATION_GROUP_OPTIONS).map((option) => ({ value: option.value, label: option.label }))}
              />
              {notificationForm.category === "employee" ? (
                <EmployeeTargetPicker
                  form={notificationForm}
                  recipients={snapshot.employeeRecipients}
                  onChange={(next) => { markModalDirty(); setNotificationForm((current) => ({ ...current, ...next })); }}
                />
              ) : (
                <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4 md:col-span-2">
                  <p className="text-sm font-semibold text-foreground">{audienceGroupLabel("party", notificationAudienceGroup(notificationForm))}</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {audienceGroupHint("party", notificationAudienceGroup(notificationForm))} Nomor WhatsApp dibaca dari kolom nomor tujuan pada sumber data yang dipilih.
                  </p>
                </div>
              )}
              <SelectField
                label="Sumber data"
                value={notificationForm.queryId}
                onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, queryId: value })); }}
                options={snapshot.queries
                  .filter((query) => sourceQueryMatchesNotification(query, notificationForm.category, notificationAudienceGroup(notificationForm)) || query.id === notificationForm.queryId)
                  .map((query) => ({ value: query.id, label: queryDisplayName(query) || query.id }))}
              />
              <SelectField
                label="Isi pesan"
                value={notificationForm.templateId}
                onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, templateId: value })); }}
                options={snapshot.templates
                  .filter((template) => templateMatchesNotification(template, notificationForm.category, notificationAudienceGroup(notificationForm)) || template.id === notificationForm.templateId)
                  .map((template) => ({ value: template.id, label: templateDisplayName(template) || template.id }))}
              />
              {showAdvancedMode ? (
                <>
                  <Field label="Jeda antar pesan (ms)" type="number" value={String(notificationForm.delayMs)} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, delayMs: Number(value) })); }} />
                  <Field label="Coba ulang jika gagal" type="number" value={String(notificationForm.retryLimit)} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, retryLimit: Number(value) })); }} />
                </>
              ) : null}
            </div>
            <Field label="Deskripsi" value={notificationForm.description} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, description: value })); }} />
            <ScheduleBuilder
              form={notificationForm}
              showAdvancedMode={showAdvancedMode}
              onChange={(next) => { markModalDirty(); setNotificationForm((current) => ({ ...current, ...next })); }}
            />
            <NotificationMessagePreview form={notificationForm} snapshot={snapshot} />
            <ToggleRow
              label="Kirim dokumen gugatan/permohonan (PDF/Word)"
              description="Lampirkan berkas gugatan/permohonan dari SIPP (petitum_dok) bila sumber data menyediakannya. Matikan untuk mengirim pesan teks saja."
              checked={notificationForm.attachDocument}
              onCheckedChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, attachDocument: value })); }}
            />
            <ToggleRow label="Aktifkan notifikasi" checked={notificationForm.isActive} onCheckedChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, isActive: value })); }} />
            <ModalActions isSaving={isSaving} onCancel={closeModal} onSave={() => void saveNotification()} saveLabel={notificationForm.category === "party" ? "Simpan sebagai Draft Aman" : "Simpan Notifikasi"} />
          </div>
        ) : null}

        {activeModal?.type === "query" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nama sumber data" value={queryForm.name} onChange={(value) => { markModalDirty(); setQueryForm((current) => ({ ...current, name: value })); }} placeholder="Data Tunda Jadwal Sidang" />
              <SelectField label="Dipakai untuk" value={queryForm.category} onChange={(value) => { const category = value as AletaBotQueryCategory; markModalDirty(); setQueryForm((current) => ({ ...current, category, recipientColumn: category === "party" ? current.recipientColumn || "telepon" : "" })); }} options={[{ value: "employee", label: "Pegawai kantor / kesekretariatan" }, { value: "party", label: "Para pihak" }, { value: "system", label: "Umum / dipakai bersama" }]} />
              <Field label="Kolom hasil" value={queryForm.outputColumns} onChange={(value) => { markModalDirty(); setQueryForm((current) => ({ ...current, outputColumns: value })); }} placeholder="tanggal_terakhir, nomor_perkara, panitera_nama" />
              {queryForm.category === "party" || showAdvancedMode ? (
                <Field label={queryForm.category === "party" ? "Kolom nomor tujuan pihak" : "Kolom nomor tujuan (opsional)"} value={queryForm.recipientColumn} onChange={(value) => { markModalDirty(); setQueryForm((current) => ({ ...current, recipientColumn: value })); }} placeholder="telepon / nomor_hp / nomor_whatsapp" />
              ) : null}
              <SelectField label="Database yang dibaca" value={queryForm.connectionKey} onChange={(value) => { markModalDirty(); setQueryForm((current) => ({ ...current, connectionKey: value })); }} options={snapshot.dbConnections.map((connection) => ({ value: connection.key, label: `${connection.name} (${connection.key})` }))} />
            </div>
            <Field label="Deskripsi" value={queryForm.description} onChange={(value) => { markModalDirty(); setQueryForm((current) => ({ ...current, description: value })); }} />
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">SQL SELECT</span>
              <Textarea
                value={queryForm.sqlText}
                onChange={(event) => { markModalDirty(); setQueryForm((current) => ({ ...current, sqlText: event.target.value })); }}
                rows={8}
                placeholder="SELECT tanggal_terakhir, nomor_perkara, panitera_nama FROM ..."
              />
            </label>
            <ToggleRow label="Sumber data aktif" checked={queryForm.isActive} onCheckedChange={(value) => { markModalDirty(); setQueryForm((current) => ({ ...current, isActive: value })); }} />
            <ModalActions isSaving={isSaving} onCancel={closeModal} onSave={() => void saveQuery()} saveLabel="Simpan Sumber Data" />
          </div>
        ) : null}

        {activeModal?.type === "database" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nama" value={dbConnectionForm.name} onChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, name: value })); }} />
              <Field label="Key" value={dbConnectionForm.key} onChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, key: value })); }} placeholder="sipp_primary" />
              <Field label="Host" value={dbConnectionForm.host} onChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, host: value })); }} />
              <Field label="Port" type="number" value={String(dbConnectionForm.port)} onChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, port: Number(value) })); }} />
              <Field label="Database" value={dbConnectionForm.databaseName} onChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, databaseName: value })); }} />
              <Field label="Username" value={dbConnectionForm.username} onChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, username: value })); }} />
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-foreground">Password Database</span>
                <div className="flex gap-2">
                  <Input
                    type={showDbPassword ? "text" : "password"}
                    value={dbConnectionForm.newPassword}
                    onChange={(event) => {
                      markModalDirty();
                      setDbConnectionForm((current) => ({ ...current, newPassword: event.target.value }));
                    }}
                    placeholder={dbConnectionForm.id ? "Password tersimpan. Isi hanya jika ingin mengganti." : "Isi password database jika diperlukan."}
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={showDbPassword ? "Sembunyikan password" : "Lihat password"}
                    onClick={() => setShowDbPassword((value) => !value)}
                  >
                    {showDbPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">
                  Demi keamanan, password lama tidak ditampilkan. Kosongkan saat edit untuk mempertahankan password lama.
                </span>
              </label>
              <Field label="Env Password (opsional)" value={dbConnectionForm.passwordEnvKey} onChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, passwordEnvKey: value })); }} placeholder="ALETA_BOT_DB_SIPP_PASSWORD" />
              <Field label="Timeout (ms)" type="number" value={String(dbConnectionForm.connectionTimeoutMs)} onChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, connectionTimeoutMs: Number(value) })); }} />
              <Field label="Legacy Source" value={dbConnectionForm.legacySource} onChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, legacySource: value })); }} placeholder="db_config.js" />
            </div>
            <Field label="Deskripsi" value={dbConnectionForm.description} onChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, description: value })); }} />
            <div className="grid gap-3 sm:grid-cols-3">
              <ToggleRow label="Aktif" checked={dbConnectionForm.isActive} onCheckedChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, isActive: value })); }} />
              <ToggleRow label="Default" checked={dbConnectionForm.isDefault} onCheckedChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, isDefault: value })); }} />
              <ToggleRow label="SSL" checked={dbConnectionForm.sslEnabled} onCheckedChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, sslEnabled: value })); }} />
            </div>
            <div className="flex flex-wrap justify-between gap-3">
              <Button variant="outline" onClick={() => void testDbConnectionDraft()} disabled={isSaving}>
                <Play className="h-4 w-4" />
                Uji Koneksi Form Ini
              </Button>
              <ModalActions isSaving={isSaving} onCancel={closeModal} onSave={() => void saveDbConnection()} saveLabel="Simpan Koneksi" />
            </div>
          </div>
        ) : null}

        {activeModal?.type === "publicQa" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {showAdvancedMode ? (
                <Field label="Kode aturan" value={publicQaIntentForm.key} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, key: value })); }} placeholder="cek_jadwal_sidang" />
              ) : null}
              <Field
                label="Nama aturan"
                value={publicQaIntentForm.name}
                onChange={(value) => {
                  markModalDirty();
                  setPublicQaIntentForm((current) => {
                    const currentAutoKey = makePublicQaDraftKey(current.name);
                    const nextKey = !current.key || current.key === currentAutoKey ? makePublicQaDraftKey(value) : current.key;
                    return { ...current, name: value, key: nextKey };
                  });
                }}
                placeholder="Cek biaya perkara"
              />
              <SelectField label="Kategori" value={publicQaIntentForm.category} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, category: value as PublicQaIntentForm["category"] })); }} options={[
                { value: "informasi_umum", label: "Informasi umum" },
                { value: "status_perkara", label: "Status perkara" },
                { value: "jadwal_sidang", label: "Jadwal sidang" },
                { value: "biaya_panjar", label: "Biaya perkara / panjar" },
                { value: "akta_cerai", label: "Akta cerai" },
                { value: "layanan", label: "Layanan kantor" },
                { value: "pengaduan", label: "Pengaduan" },
                { value: "ecourt", label: "E-Court" },
                { value: "fallback", label: "Pertanyaan belum dikenali" },
              ]} />
              <SelectField label="Untuk siapa" value={publicQaIntentForm.audience} onChange={(value) => {
                markModalDirty();
                setPublicQaIntentForm((current) => ({
                  ...current,
                  audience: value as PublicQaIntentForm["audience"],
                  verificationPolicy: ["employee", "admin"].includes(value) && current.verificationPolicy === "none" ? "phone_match" : current.verificationPolicy,
                  answerPolicy: value === "employee" || value === "admin" ? "admin_only" : current.answerPolicy,
                }));
              }} options={[
                { value: "party", label: "Para pihak berperkara" },
                { value: "public", label: "Masyarakat umum" },
                { value: "employee", label: "Pegawai terdaftar" },
                { value: "admin", label: "Admin / petugas internal" },
              ]} />
              <SelectField label="Cara menjawab" value={publicQaIntentForm.responseMode} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, responseMode: value as PublicQaIntentForm["responseMode"] })); }} options={[
                { value: "query_template", label: "Ambil dari sumber data" },
                { value: "static_template", label: "Jawaban tetap" },
                { value: "legacy_handler", label: "Pakai jalur lama" },
                { value: "ai_guided_template", label: "AI merapikan jawaban" },
                { value: "fallback", label: "Jawaban fallback" },
              ]} />
              <SelectField label="Sumber data yang dipakai" value={publicQaIntentForm.queryKey} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, queryKey: value, responseMode: value ? "query_template" : current.responseMode })); }} options={[{ value: "", label: "Tidak pakai sumber data" }, ...snapshot.queries.map((query) => ({ value: query.id, label: queryDisplayName(query) || query.id }))]} />
              <SelectField label="Isi pesan yang dipakai" value={publicQaIntentForm.templateKey} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, templateKey: value })); }} options={[{ value: "", label: "Tidak pakai isi pesan khusus" }, ...snapshot.templates.map((template) => ({ value: template.id, label: templateDisplayName(template) || template.id }))]} />
              <Field label="Data wajib dari pertanyaan" value={publicQaIntentForm.requiredParameters} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, requiredParameters: value })); }} placeholder="nomor_perkara" />
              <SelectField label="Verifikasi" value={publicQaIntentForm.verificationPolicy} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, verificationPolicy: value as PublicQaIntentForm["verificationPolicy"] })); }} options={[
                { value: "none", label: "Tidak perlu verifikasi" },
                { value: "case_number_only", label: "Wajib nomor perkara" },
                { value: "phone_match", label: "Nomor WA harus terdaftar" },
                { value: "case_number_and_phone", label: "Nomor perkara + WA terdaftar" },
                { value: "manual_ptsp", label: "Diarahkan ke petugas" },
              ]} />
              <SelectField label="Risiko jawaban" value={publicQaIntentForm.riskLevel} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, riskLevel: value as PublicQaIntentForm["riskLevel"] })); }} options={[{ value: "low", label: "Rendah" }, { value: "medium", label: "Sedang" }, { value: "high", label: "Tinggi" }]} />
              <SelectField label="Status" value={publicQaIntentForm.status} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, status: value as PublicQaIntentForm["status"] })); }} options={[{ value: "draft", label: "Draft" }, { value: "active", label: "Aktif" }, { value: "archived", label: "Diarsipkan" }]} />
              {showAdvancedMode ? (
                <>
                  <SelectField label="Mode jawaban AI" value={publicQaIntentForm.aiAnswerMode} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, aiAnswerMode: value as PublicQaIntentForm["aiAnswerMode"] })); }} options={["off", "template_only", "template_rewrite", "query_summarize", "guided_answer"].map((value) => ({ value, label: displayStatus(value) }))} />
                  <SelectField label="Batas data jawaban" value={publicQaIntentForm.answerPolicy} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, answerPolicy: value as PublicQaIntentForm["answerPolicy"] })); }} options={[
                    { value: "public_info_only", label: "Informasi umum saja" },
                    { value: "case_status_limited", label: "Status perkara terbatas" },
                    { value: "requires_verified_party", label: "Wajib pihak terverifikasi" },
                    { value: "admin_only", label: "Hanya pegawai/admin" },
                  ]} />
                  <Field label="Perintah jalur lama" value={publicQaIntentForm.legacyCommand} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, legacyCommand: value })); }} placeholder="jadwal" />
                  <Field label="Perintah jalur lama berparameter" value={publicQaIntentForm.parameterizedLegacyCommand} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, parameterizedLegacyCommand: value })); }} placeholder="jadwal" />
                  <Field label="Confidence AI" type="number" value={String(publicQaIntentForm.confidenceThreshold)} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, confidenceThreshold: Number(value) })); }} />
                  <Field label="Maksimal token AI" type="number" value={String(publicQaIntentForm.maxAiTokens)} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, maxAiTokens: Number(value) })); }} />
                  <Field label="Temperature AI" type="number" value={String(publicQaIntentForm.temperature)} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, temperature: Number(value) })); }} />
                </>
              ) : null}
            </div>
            <Field label="Deskripsi" value={publicQaIntentForm.description} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, description: value })); }} />
            {showAdvancedMode ? (
              <Field label="Handler jalur lama" value={publicQaIntentForm.legacyHandler} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, legacyHandler: value })); }} placeholder="query.getData:jadwal" />
            ) : null}
            <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Kata kunci dari WhatsApp</span><Textarea value={publicQaIntentForm.exactTriggers} onChange={(event) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, exactTriggers: event.target.value })); }} rows={3} /></label>
            <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Contoh pertanyaan</span><Textarea value={publicQaIntentForm.exampleQuestions} onChange={(event) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, exampleQuestions: event.target.value })); }} rows={4} /></label>
            {showAdvancedMode ? (
              <>
                <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Data yang boleh dipakai</span><Textarea value={publicQaIntentForm.allowedDataFields} onChange={(event) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, allowedDataFields: event.target.value })); }} rows={2} /></label>
                <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Data yang tidak boleh dikirim</span><Textarea value={publicQaIntentForm.blockedDataFields} onChange={(event) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, blockedDataFields: event.target.value })); }} rows={2} /></label>
                <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">System prompt</span><Textarea value={publicQaIntentForm.aiSystemPrompt} onChange={(event) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, aiSystemPrompt: event.target.value })); }} rows={4} /></label>
                <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">User prompt template</span><Textarea value={publicQaIntentForm.aiUserPromptTemplate} onChange={(event) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, aiUserPromptTemplate: event.target.value })); }} rows={4} /></label>
              </>
            ) : null}
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Blangko Jawaban</span>
              <span className="block text-xs text-muted-foreground">
                Isi kalimat yang ingin dikirim ALETA Bot. Bila diisi, inilah yang dipakai menjawab - bukan kalimat
                bawaan sistem. Kosongkan bila jawabannya harus diambil dari data perkara.
              </span>
              <Textarea
                value={publicQaIntentForm.answerTemplate}
                onChange={(event) => {
                  markModalDirty();
                  setPublicQaIntentForm((current) => ({ ...current, answerTemplate: event.target.value }));
                }}
                rows={5}
                placeholder="Contoh: Akta cerai dapat diambil 14 hari setelah putusan berkekuatan hukum tetap. Bawa KTP asli ke PTSP pada jam kerja."
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Kata Kunci Pengenal</span>
              <span className="block text-xs text-muted-foreground">
                Kata yang menandai pertanyaan ini walau kalimatnya berbeda, misalnya panjar, tagihan, bayar. Salah
                ketik satu-dua huruf sudah dimaafkan otomatis.
              </span>
              <CreatableMultiSelect
                value={publicQaIntentForm.matchKeywords}
                onChange={(value) => {
                  markModalDirty();
                  setPublicQaIntentForm((current) => ({ ...current, matchKeywords: value }));
                }}
                options={[]}
                placeholder="Ketik kata kunci lalu Enter"
              />
            </label>
            <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Jawaban saat belum bisa diproses</span><Textarea value={publicQaIntentForm.fallbackMessage} onChange={(event) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, fallbackMessage: event.target.value })); }} rows={3} /></label>
            <div className="grid gap-3 sm:grid-cols-3">
              <ToggleRow label="Aktif" checked={publicQaIntentForm.isActive} onCheckedChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, isActive: value })); }} />
              <ToggleRow label="AI mengenali pertanyaan" checked={publicQaIntentForm.aiEnabled} onCheckedChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, aiEnabled: value })); }} />
              <ToggleRow label="AI menyusun jawaban" checked={publicQaIntentForm.aiAnswerEnabled} onCheckedChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, aiAnswerEnabled: value, aiAnswerMode: value && current.aiAnswerMode === "off" ? "template_rewrite" : current.aiAnswerMode })); }} />
              <ToggleRow label="Butuh verifikasi" checked={publicQaIntentForm.requiresVerification} onCheckedChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, requiresVerification: value })); }} />
              <ToggleRow label="Butuh nomor perkara" checked={publicQaIntentForm.requiresCaseNumber} onCheckedChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, requiresCaseNumber: value })); }} />
              <ToggleRow label="Butuh approval" checked={publicQaIntentForm.requiresApprovalBeforeActive} onCheckedChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, requiresApprovalBeforeActive: value })); }} />
            </div>
            <ModalActions isSaving={isSaving} onCancel={closeModal} onSave={() => {
              if (publicQaIntentForm.riskLevel === "high" || publicQaIntentForm.aiAnswerEnabled) {
                if (!window.confirm("Simpan perubahan aturan AI? Perubahan berisiko harus tetap melalui status draft/approval bila belum siap.")) return;
              }
              void savePublicQaIntent();
            }} saveLabel="Simpan & Berlakukan" />
          </div>
        ) : null}

        {activeModal?.type === "publicQaReview" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <p className="font-semibold text-foreground">Pertanyaan</p>
              <p className="mt-2 leading-6 text-muted-foreground">{activeModal.review.rawMessage}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={activeModal.review.safetyRisk === "high" ? "danger" : activeModal.review.safetyRisk === "medium" ? "warning" : "muted"}>
                  Risiko {activeModal.review.safetyRisk}
                </Badge>
                <Badge variant="outline">Frekuensi {activeModal.review.frequency}x</Badge>
                <Badge variant="outline">{activeModal.review.suggestedAction}</Badge>
              </div>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Catatan Review</span>
              <Textarea
                value={publicQaReviewNote}
                onChange={(event) => setPublicQaReviewNote(event.target.value)}
                rows={4}
                placeholder="Tuliskan tindak lanjut singkat. Jangan masukkan data sensitif."
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={closeModal} disabled={isSaving}>Batal</Button>
              <Button variant="outline" onClick={() => void submitPublicQaReview("ignored")} disabled={isSaving}>Abaikan</Button>
              <Button
                variant="outline"
                onClick={() => openModal({ type: "publicQaConvert", title: "Jadikan Draft Aturan", review: activeModal.review })}
                disabled={isSaving}
              >
                Jadikan Draft Aturan
              </Button>
              <Button onClick={() => void submitPublicQaReview("reviewed")} disabled={isSaving}>Tandai Sudah Ditinjau</Button>
            </div>
          </div>
        ) : null}

        {activeModal?.type === "publicQaConvert" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <p className="font-semibold text-foreground">Pertanyaan asli</p>
              <p className="mt-2 leading-6 text-muted-foreground">{activeModal.review.rawMessage}</p>
              <p className="mt-2 text-xs text-muted-foreground">Draft tidak langsung aktif dan tetap perlu dicek/approval sebelum digunakan.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm">
                <input
                  type="radio"
                  checked={publicQaConvertMode === "new"}
                  onChange={() => setPublicQaConvertMode("new")}
                />
                Buat aturan draft baru
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm">
                <input
                  type="radio"
                  checked={publicQaConvertMode === "existing"}
                  onChange={() => setPublicQaConvertMode("existing")}
                />
                Tambahkan ke draft yang sudah ada
              </label>
            </div>
            {publicQaConvertMode === "new" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Kode draft aturan" value={publicQaDraftIntentKey} onChange={setPublicQaDraftIntentKey} placeholder="cek_status_layanan" />
                <Field label="Nama draft aturan" value={publicQaDraftIntentName} onChange={setPublicQaDraftIntentName} placeholder="Draft Aturan Baru" />
              </div>
            ) : (
              <SelectField
                label="Draft aturan tujuan"
                value={publicQaConvertIntentId}
                onChange={setPublicQaConvertIntentId}
                options={snapshot.publicQaIntents
                  .filter((intent) => intent.status === "draft" && !intent.isActive)
                  .map((intent) => ({ value: intent.id, label: `${intent.name} (${intent.key})` }))}
              />
            )}
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Catatan konversi</span>
              <Textarea
                value={publicQaReviewNote}
                onChange={(event) => setPublicQaReviewNote(event.target.value)}
                rows={3}
                placeholder="Opsional: alasan intent dibuat, batasan jawaban, atau catatan petugas."
              />
            </label>
            <ModalActions
              isSaving={isSaving}
              onCancel={closeModal}
              onSave={() => void convertPublicQaReview()}
              saveLabel="Simpan sebagai Draft"
            />
          </div>
        ) : null}

        {activeModal?.type === "deadlineReminderPreview" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <InfoCard title="Kandidat" value={String(deadlineReminderPreview?.totalCandidates ?? 0)} hint="Disposisi aktif yang jatuh tempo besok." />
              <InfoCard title={deadlineReminderPreview?.productionSent ? "Masuk Antrean" : "Simulasi dibuat"} value={String(deadlineReminderPreview?.productionSent ?? deadlineReminderPreview?.dryRunCreated ?? 0)} hint={deadlineReminderPreview?.productionSent ? "Terkonfirmasi oleh gateway dengan gate eksplisit." : "Tercatat sebagai simulasi, bukan kirim WA."} />
              <InfoCard title="Dilewati" value={String(deadlineReminderPreview?.skipped ?? 0)} hint="Nomor kosong/invalid atau sudah pernah simulasi." />
            </div>
            {(deadlineReminderPreview?.warnings ?? []).length > 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-900 dark:text-amber-200">
                {(deadlineReminderPreview?.warnings ?? []).map((warning) => <p key={warning}>{warning}</p>)}
              </div>
            ) : null}
            <div className="space-y-3">
              {(deadlineReminderPreview?.items ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Tidak ada item preview.
                </div>
              ) : (
                deadlineReminderPreview?.items.map((item) => (
                  <div key={`${item.dispositionId}-${item.idempotencyKey}`} className="rounded-xl border border-border p-4 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{item.recipientName}</p>
                        <p className="text-xs text-muted-foreground">{item.recipientNumber || "Nomor masked"} · deadline {formatDateTime(item.deadline)}</p>
                      </div>
                      <Badge variant={item.status === "simulated" || item.status === "enqueued" ? "success" : "warning"}>
                        {item.status === "enqueued" ? "Antrean" : item.status === "simulated" ? "Simulasi" : "Dilewati"}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">{item.messagePreview}</p>
                    <p className="mt-2 break-all text-[11px] text-muted-foreground">Idempotency: {item.idempotencyKey}</p>
                    {item.skipReason ? <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{item.skipReason}</p> : null}
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={closeModal} disabled={isSaving}>Tutup</Button>
            </div>
          </div>
        ) : null}

        {activeModal?.type === "legacyAction" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <p className="font-semibold text-foreground">{activeModal.migration.feature}</p>
              <p className="mt-1 text-muted-foreground">
                Legacy key: <code>{activeModal.migration.legacyKey || activeModal.migration.sourceFunction || "-"}</code>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={activeModal.migration.riskLevel === "high" ? "danger" : activeModal.migration.riskLevel === "medium" ? "warning" : "muted"}>{activeModal.migration.riskLevel}</Badge>
                <Badge variant="outline">{displayStatus(activeModal.migration.status)}</Badge>
                <Badge variant="outline">{activeModal.migration.registryTargetType || "registry"}</Badge>
              </div>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-foreground">
              {activeModal.action === "disable-legacy"
                ? "Aksi ini tidak menghapus kode legacy, tetapi menulis flag disabled ke runtime config agar adapter membaca legacy key sebagai nonaktif. Pastikan registry sudah aktif dan teruji."
                : activeModal.action === "activate"
                  ? "Aktivasi registry hanya tersedia setelah simulasi dan approval. Guard duplikasi jalur aktif: legacy key harus sudah di-disable lebih dulu untuk notifikasi."
                  : activeModal.action === "rollback"
                    ? (() => {
                        const s = activeModal.migration.status;
                        const transitions: Record<string, string> = {
                          legacy_disabled: "Dinonaktifkan (Migrasi) → Aktif di Registry — legacy key diaktifkan kembali sebagai fallback, registry tetap berjalan.",
                          active_registry: "Aktif di Registry → Mode Simulasi — registry di-deactivate, ulangi approval sebelum aktifkan ulang.",
                          pending_approval: "Menunggu Persetujuan → Draft Registry — approval dibatalkan, kembali ke draft.",
                        };
                        return transitions[s] ?? `${displayStatus(s)} → Terpetakan (rollback penuh, legacy kembali aktif).`;
                      })()
                    : activeModal.action === "convert"
                      ? "Konversi membuat draft query/template/notifikasi atau intent. Draft tidak langsung aktif."
                      : "Aksi ini berjalan aman dan tidak mengirim pesan WhatsApp sungguhan."}
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Catatan aksi</span>
              <Textarea
                value={legacyActionNotes}
                onChange={(event) => { markModalDirty(); setLegacyActionNotes(event.target.value); }}
                rows={3}
                placeholder="Opsional: alasan, hasil pengecekan, atau catatan approval."
              />
            </label>
            {legacyActionResult ? (
              <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-muted/30 p-3 text-xs leading-5 whitespace-pre-wrap">{legacyActionResult}</pre>
            ) : null}
            <ModalActions
              isSaving={isSaving}
              onCancel={closeModal}
              onSave={() => {
                if (["activate", "disable-legacy", "rollback"].includes(activeModal.action)) {
                  if (!window.confirm(`${migrationActionTitle(activeModal.action)} untuk ${activeModal.migration.feature}?`)) return;
                }
                void runLegacyMigrationAction(activeModal.action, activeModal.migration);
              }}
              saveLabel={migrationActionTitle(activeModal.action)}
            />
          </div>
        ) : null}
      </ModalShell>

      {isLoading ? (
        <div className="fixed bottom-6 right-6 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-panel">
          Memuat ALETA Bot...
        </div>
      ) : null}
    </div>
  );
}

function ModalShell({
  modal,
  children,
  isSaving,
  onClose,
}: {
  modal: AletaBotModal | null;
  children: ReactNode;
  isSaving: boolean;
  onClose: () => void;
}) {
  if (!modal) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{modal.title}</h2>
            <p className="text-xs text-muted-foreground">Edit ALETA Bot dibuka dalam modal agar tidak menggeser layout halaman.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving} aria-label="Tutup modal">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  isSaving,
  onCancel,
  onSave,
  saveLabel,
}: {
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
}) {
  return (
    <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap justify-end gap-2 border-t border-border bg-card px-5 py-4">
      <Button variant="outline" onClick={onCancel} disabled={isSaving}>Batal</Button>
      <Button onClick={onSave} disabled={isSaving}>
        <CheckCircle2 className="h-4 w-4" />
        {isSaving ? "Menyimpan..." : saveLabel}
      </Button>
    </div>
  );
}

function NoticeCard({ notice, onClose }: { notice: NoticeState; onClose: () => void }) {
  const classes = {
    success: "border-emerald-300/60 bg-emerald-50 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100",
    warning: "border-amber-300/70 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100",
    danger: "border-destructive/40 bg-destructive/10 text-destructive",
    info: "border-primary/25 bg-primary/5 text-foreground",
  } satisfies Record<NoticeState["tone"], string>;
  const badgeVariant = notice.tone === "success" ? "success" : notice.tone === "warning" ? "warning" : notice.tone === "danger" ? "danger" : "outline";
  const label = notice.tone === "success" ? "Berhasil" : notice.tone === "warning" ? "Perhatian" : notice.tone === "danger" ? "Gagal" : "Info";

  return (
    <Card className={cn("border shadow-none", classes[notice.tone])}>
      <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariant}>{label}</Badge>
            <p className="font-semibold">{notice.title}</p>
          </div>
          <p className="text-sm leading-6 opacity-90">{notice.message}</p>
          <p className="text-xs opacity-70">Diperbarui {formatDateTime(notice.updatedAt)}</p>
        </div>
        <Button type="button" variant="outline" size="icon" onClick={onClose} aria-label="Tutup pemberitahuan">
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function ActionFeedbackOverlay({ feedback }: { feedback: OperationFeedbackState }) {
  const isLoading = feedback.phase === "loading";
  const isSuccess = feedback.phase === "success";
  const iconClassName = "h-5 w-5";
  return (
    <div className="pointer-events-none fixed inset-x-3 top-4 z-[90] flex justify-center sm:inset-x-auto sm:right-4 sm:top-5 sm:justify-end" aria-live="polite">
      <div className="flex w-full max-w-sm items-center gap-3 rounded-xl border border-border bg-card/95 p-4 text-card-foreground shadow-xl backdrop-blur animate-in fade-in slide-in-from-top-2">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            isLoading
              ? "bg-primary/10 text-primary"
              : isSuccess
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-destructive/10 text-destructive"
          )}
        >
          {isLoading ? (
            <Loader2 className={cn(iconClassName, "animate-spin")} />
          ) : isSuccess ? (
            <CheckCircle2 className={cn(iconClassName, "animate-pulse")} />
          ) : (
            <XCircle className={cn(iconClassName, "animate-pulse")} />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold leading-5 text-foreground">{feedback.title}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{feedback.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(feedback.updatedAt)}</p>
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  label,
  value,
  icon: Icon,
  onClick,
  actionLabel,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  onClick?: () => void;
  actionLabel?: string;
}) {
  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(onClick && "cursor-pointer transition hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
    >
      <CardContent className="flex items-center justify-between gap-4 p-5 !pt-5 sm:p-6 sm:!pt-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <Badge variant={statusVariant(value)}>{displayStatus(value)}</Badge>
          {onClick ? <p className="text-xs font-semibold text-primary">{actionLabel ?? "Buka detail"}</p> : null}
        </div>
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoCard({
  title,
  value,
  hint,
  onClick,
  actionLabel,
}: {
  title: string;
  value: string;
  hint: string;
  onClick?: () => void;
  actionLabel?: string;
}) {
  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(onClick && "cursor-pointer transition hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
    >
      <CardContent className="p-5 !pt-5 sm:p-6 sm:!pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        <p className="mt-2 break-words text-lg font-semibold text-foreground">{value}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p>
        {onClick ? <p className="mt-3 text-xs font-semibold text-primary">{actionLabel ?? "Buka pengaturan terkait"}</p> : null}
      </CardContent>
    </Card>
  );
}

const RISK_LEVEL_META: Record<number, { accent: string; track: string; badge: "success" | "warning" | "danger"; ring: string }> = {
  1: { accent: "text-emerald-600", track: "accent-emerald-500", badge: "success", ring: "ring-emerald-500/40" },
  2: { accent: "text-lime-600", track: "accent-lime-500", badge: "success", ring: "ring-lime-500/40" },
  3: { accent: "text-amber-600", track: "accent-amber-500", badge: "warning", ring: "ring-amber-500/40" },
  4: { accent: "text-orange-600", track: "accent-orange-500", badge: "warning", ring: "ring-orange-500/40" },
  5: { accent: "text-red-600", track: "accent-red-500", badge: "danger", ring: "ring-red-500/40" },
};

function SendingRiskSlider({
  presets,
  currentLevel,
  pendingLevel,
  saving,
  notifications,
  onPreview,
  onCommit,
}: {
  presets: AletaBotSendingRiskPreset[];
  currentLevel: number;
  pendingLevel: number;
  saving: boolean;
  notifications: AletaBotNotification[];
  onPreview: (level: number) => void;
  onCommit: (level: number) => void;
}) {
  if (!presets || presets.length === 0) {
    return null;
  }
  const ordered = [...presets].sort((a, b) => a.level - b.level);
  const minLevel = ordered[0]?.level ?? 1;
  const maxLevel = ordered[ordered.length - 1]?.level ?? 5;
  const preview = ordered.find((item) => item.level === pendingLevel) ?? ordered.find((item) => item.level === currentLevel) ?? ordered[0];
  const meta = RISK_LEVEL_META[preview.level] ?? RISK_LEVEL_META[1];
  const uncommitted = pendingLevel !== currentLevel;
  const fmtDelay = (min: number, max: number) => {
    const lo = (min / 1000).toFixed(min % 1000 === 0 ? 0 : 1);
    if (max > min) {
      const hi = (max / 1000).toFixed(max % 1000 === 0 ? 0 : 1);
      return `${lo}–${hi} dtk (acak)`;
    }
    return `${lo} dtk`;
  };
  const fmtCooldown = (ms: number) => {
    if (ms <= 0) return "tanpa jeda";
    const minutes = Math.round(ms / 60000);
    return minutes >= 1 ? `${minutes} menit` : `${Math.round(ms / 1000)} dtk`;
  };
  // Peringatan dini: notifikasi yang dijadwalkan di luar jam kirim tingkat ini
  // tetap terkirim, tetapi baru pada pembukaan jam kirim berikutnya.
  const scheduleWarnings = findNotificationsOutsideSendingWindow(
    notifications,
    preview.sendingWindowStart,
    preview.sendingWindowEnd
  );
  return (
    <Card className={cn("mb-4 border-2 transition", meta.ring, "ring-1")}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Mode Risiko Suspend / Banned</CardTitle>
            <CardDescription>
              Geser ke <span className="font-semibold text-emerald-600">Minimal</span> agar seluruh sistem kirim paling aman dari suspend/banned, atau ke{" "}
              <span className="font-semibold text-red-600">Maksimal</span> untuk kecepatan penuh dengan risiko besar.{" "}
              Setiap pesan dijadwalkan pada waktunya sendiri, jadi notifikasi sejenis tidak pernah berangkat serentak walau dibuat dalam satu kali jalan.
              Pesan yang jatuh di luar jam kirim otomatis dipindah ke pembukaan jam berikutnya, bukan dikirim tengah malam.
            </CardDescription>
          </div>
          <Badge variant={meta.badge} className="shrink-0">
            Level {preview.level} · {preview.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className={cn("text-lg font-bold", meta.accent)}>{preview.label}</p>
            <p className="text-sm text-muted-foreground">
              Risiko suspend/banned: <span className={cn("font-semibold", meta.accent)}>{preview.suspendRisk}</span>
            </p>
          </div>
          <input
            type="range"
            min={minLevel}
            max={maxLevel}
            step={1}
            value={pendingLevel}
            disabled={saving}
            aria-label="Mode risiko pengiriman"
            className={cn("mt-3 w-full cursor-pointer", meta.track)}
            onChange={(event) => onPreview(Number(event.target.value))}
            onMouseUp={(event) => onCommit(Number((event.target as HTMLInputElement).value))}
            onTouchEnd={(event) => onCommit(Number((event.target as HTMLInputElement).value))}
            onKeyUp={(event) => onCommit(Number((event.target as HTMLInputElement).value))}
          />
          <div className="mt-1 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className="text-emerald-600">Minimal</span>
            {ordered.length > 2 ? <span>Sedang</span> : null}
            <span className="text-red-600">Maksimal</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <RiskKnob
            label="Jarak antar pesan"
            value={fmtDelay(preview.sendingGapMinMs, preview.sendingGapMaxMs)}
            hint="Pengendali utama. Tiap pesan dijadwalkan sendiri, jadi notifikasi sejenis tidak berangkat serentak."
          />
          <RiskKnob
            label="Jeda per nomor sama"
            value={fmtCooldown(preview.perRecipientCooldownMs)}
            hint="Satu nomor tidak diberondong beberapa pesan berdekatan."
          />
          <RiskKnob label="Jeda saat kirim" value={fmtDelay(preview.messageDelayMinMs, preview.messageDelayMaxMs)} hint="Jeda tambahan tepat sebelum pesan dilepas, diacak agar tidak berpola." />
          <RiskKnob label="Jam kirim" value={`${preview.sendingWindowStart}–${preview.sendingWindowEnd}`} hint="Di luar jam ini pesan dipindahkan ke pembukaan jam kirim berikutnya, bukan dikirim malam hari." />
          <RiskKnob label="Rem darurat" value={`${preview.maxPerMinute}/mnt · ${preview.maxPerHour}/jam · ${preview.maxPerDay}/hari`} hint="Batas pengaman di atas laju normal. Normalnya tidak pernah tersentuh." />
          <RiskKnob label="Batch antrean" value={`${preview.queueBatchSize} / ${(preview.queueIntervalMs / 1000).toFixed(0)} dtk`} hint="Seberapa sering antrean diperiksa. Pesan tetap hanya dikirim bila jadwalnya sudah tiba." />
        </div>

        {scheduleWarnings.length > 0 ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
              {scheduleWarnings.length} notifikasi dijadwalkan di luar jam kirim {preview.sendingWindowStart}–{preview.sendingWindowEnd}
            </p>
            <ul className="mt-1.5 space-y-0.5 text-xs text-amber-800/90 dark:text-amber-200/90">
              {scheduleWarnings.slice(0, 5).map((warning) => (
                <li key={warning.notificationId}>
                  • {warning.notificationName} — jadwal {formatHoursLabel(warning.outsideHours)}
                </li>
              ))}
              {scheduleWarnings.length > 5 ? <li>• dan {scheduleWarnings.length - 5} lainnya</li> : null}
            </ul>
            <p className="mt-2 text-[11px] leading-snug text-amber-800/80 dark:text-amber-200/80">
              Pesannya tidak hilang: ALETA memindahkannya ke pembukaan jam kirim berikutnya secara menyebar. Namun pengirimannya jadi tertunda lama.
              Geser jadwal notifikasi ke dalam jam kirim, atau naikkan Mode Risiko agar jam kirimnya lebih lebar.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Broadcast massal: {preview.broadcastRequiresApproval ? "wajib disetujui admin dulu" : "boleh langsung dikirim"}.
          </p>
          {saving ? (
            <span className="text-xs font-semibold text-primary">Menerapkan mode…</span>
          ) : uncommitted ? (
            <button
              type="button"
              onClick={() => onCommit(pendingLevel)}
              className={cn("rounded-md px-3 py-1.5 text-xs font-semibold text-white transition", "bg-primary hover:bg-primary/90")}
            >
              Terapkan Level {pendingLevel}
            </button>
          ) : (
            <span className="text-xs font-semibold text-emerald-600">Mode aktif tersimpan</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RiskKnob({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3" title={hint}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function HealthSummaryCard({
  label,
  status,
  value,
  onClick,
}: {
  label: string;
  status: "ok" | "warning" | "error";
  value: string;
  onClick?: () => void;
}) {
  const variant = status === "ok" ? "success" as const : status === "warning" ? "warning" as const : "danger" as const;
  const dot = status === "ok" ? "bg-emerald-500" : status === "warning" ? "bg-amber-500" : "bg-destructive";
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "rounded-xl border border-border bg-card p-4",
        onClick && "cursor-pointer transition hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        <span className={cn("h-2 w-2 rounded-full", dot)} />
      </div>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
      <Badge variant={variant} className="mt-2 text-[10px]">{status === "ok" ? "Normal" : status === "warning" ? "Perhatian" : "Masalah"}</Badge>
      {onClick ? <p className="mt-3 text-xs font-semibold text-primary">Buka pengaturan terkait</p> : null}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <Input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <select className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.length === 0 ? <option value="">Tidak ada opsi</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function EmployeeTargetPicker({
  form,
  recipients,
  onChange,
}: {
  form: NotificationForm;
  recipients: AletaBotEmployeeRecipient[];
  onChange: (next: Partial<NotificationForm>) => void;
}) {
  const roleValues = stringListFromText(form.recipientRoleHints);
  const positionValues = stringListFromText(form.recipientPositionHints);
  const nameValues = stringListFromText(form.recipientNameHints);
  const roleHints = roleValues.map(normalizeHint);
  const positionHints = positionValues.map(normalizeHint);
  const roleScopedRecipients = useMemo(
    () => recipients.filter((recipient) => matchesAnyHint(roleHints, [recipient.roleId])),
    [recipients, roleHints]
  );
  const employeeScopedRecipients = useMemo(
    () =>
      roleScopedRecipients.filter((recipient) =>
        matchesAnyHint(positionHints, [
          recipient.positionId,
          recipient.positionName,
          recipient.unitKerja,
          ...recipient.additionalRoleIds,
          ...recipient.additionalRoleIds.map(getAdditionalRoleLabel),
        ])
      ),
    [roleScopedRecipients, positionHints]
  );
  const targetedRecipients = useMemo(() => getTargetedEmployeeRecipients(recipients, form), [recipients, form]);
  const roleOptions = useMemo(
    () => makeCountedOptions(recipients, (recipient) => recipient.roleId, (recipient) => formatTargetOptionLabel(recipient.roleId)),
    [recipients]
  );
  const positionOptions = useMemo(
    () => makeEmployeePositionOptions(roleScopedRecipients),
    [roleScopedRecipients]
  );
  const employeeOptions = useMemo(
    () =>
      employeeScopedRecipients
        .map((recipient) => ({
          value: recipient.id,
          label: [recipient.name || recipient.username, recipient.username ? `@${recipient.username}` : "", recipient.positionName || recipient.unitKerja].filter(Boolean).join(" - "),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [employeeScopedRecipients]
  );

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4 md:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Target pegawai</p>
          <p className="text-xs text-muted-foreground">Pilih role, jabatan/unit, lalu nama pegawai jika ingin target spesifik. Kosongkan semua untuk semua pegawai aktif yang punya WhatsApp.</p>
        </div>
        <Badge variant={targetedRecipients.length > 0 ? "success" : "warning"}>{targetedRecipients.length} penerima cocok</Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-foreground">Role</span>
          <CreatableMultiSelect
            value={roleValues}
            onChange={(value) => onChange({ recipientRoleHints: value.join(", ") })}
            options={roleOptions}
            placeholder="Pilih role dari database"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-foreground">Jabatan/unit</span>
          <CreatableMultiSelect
            value={positionValues}
            onChange={(value) => onChange({ recipientPositionHints: value.join(", ") })}
            options={positionOptions}
            placeholder="Pilih jabatan/unit"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-foreground">Nama pegawai</span>
          <CreatableMultiSelect
            value={nameValues}
            onChange={(value) => onChange({ recipientNameHints: value.join(", ") })}
            options={employeeOptions}
            placeholder="Pilih pegawai terdaftar"
            allowCreate={false}
          />
        </label>
      </div>
      {recipients.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Belum ada pegawai aktif dengan nomor WhatsApp valid.</p>
      ) : targetedRecipients.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Pilihan target belum cocok dengan pegawai yang punya nomor WhatsApp valid.</p>
      ) : null}
    </div>
  );
}

function NotificationMessagePreview({ form, snapshot }: { form: NotificationForm; snapshot: AletaBotSnapshot }) {
  const query = snapshot.queries.find((item) => item.id === form.queryId);
  const template = snapshot.templates.find((item) => item.id === form.templateId);
  const audienceGroup = notificationAudienceGroup(form);
  const targetedEmployees = form.category === "employee" ? getTargetedEmployeeRecipients(snapshot.employeeRecipients, form) : [];
  const selectedLabels = getEmployeeTargetOptionLabels(snapshot.employeeRecipients, form);
  const targetSummary =
    form.category === "employee"
      ? selectedLabels.length > 0
        ? `${audienceGroupLabel("employee", audienceGroup)} - ${targetedEmployees.length} pegawai cocok - ${selectedLabels.join("; ")}`
        : `${audienceGroupLabel("employee", audienceGroup)} - ${targetedEmployees.length} pegawai aktif dengan WhatsApp valid`
      : `${audienceGroupLabel("party", audienceGroup)} dari sumber data ${queryDisplayName(query) || "yang dipilih"}; nomor tujuan dari kolom ${query?.recipientColumn || "telepon"}`;
  const sample = makeNotificationPreviewSample(form, snapshot, query);
  const preview = template ? renderAletaBotTemplatePreview(template.body, sample).trim() : "Pilih isi pesan untuk melihat contoh full pesan.";

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Contoh full pesan pengiriman</p>
          <p className="mt-1 text-xs text-muted-foreground">Preview ini memakai data contoh aman dan mengikuti isi pesan yang dipilih.</p>
        </div>
        <Badge variant={template ? "success" : "warning"}>{templateDisplayName(template) || "Belum pilih isi pesan"}</Badge>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
        <div className="rounded-lg border border-border bg-background/70 p-3">
          <p className="font-semibold text-foreground">Target</p>
          <p className="mt-1 leading-5">{targetSummary}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/70 p-3">
          <p className="font-semibold text-foreground">Jadwal</p>
          <p className="mt-1 leading-5">{humanizeSchedule(form.scheduleType, form.scheduleCron, form.scheduleTrigger)}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/70 p-3">
          <p className="font-semibold text-foreground">Sumber data</p>
          <p className="mt-1 leading-5">{queryDisplayName(query) || "Belum pilih sumber data"}</p>
        </div>
      </div>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-background/80 p-4 text-sm leading-6 text-foreground">{preview}</pre>
    </div>
  );
}

function ScheduleBuilder({
  form,
  showAdvancedMode,
  onChange,
}: {
  form: NotificationForm;
  showAdvancedMode: boolean;
  onChange: (next: Partial<NotificationForm>) => void;
}) {
  const parsed = parseCronExpression(form.scheduleCron);
  const kind = scheduleKindFromCron(form.scheduleType, form.scheduleCron);
  const selectedKind = showAdvancedMode ? kind : kind === "advanced" ? "daily" : kind;
  const dayOfMonth = parsed.dayOfMonth !== "*" && /^\d+$/.test(parsed.dayOfMonth) ? parsed.dayOfMonth : "1";
  const month = MONTH_OPTIONS.some((option) => option.value === parsed.month) ? parsed.month : "*";
  const dayOfWeek = DAY_OPTIONS.some((option) => option.value === parsed.dayOfWeek) ? parsed.dayOfWeek : "1-5";
  const time = parsed.valid ? parsed.time : "08:00:00";

  const updateCronSchedule = (next: { time?: string; dayOfMonth?: string; month?: string; dayOfWeek?: string }) => {
    const cron = scheduleFormToCron({
      time: next.time ?? time,
      dayOfMonth: next.dayOfMonth ?? (selectedKind === "monthly" ? dayOfMonth : "*"),
      month: next.month ?? month,
      dayOfWeek: next.dayOfWeek ?? (selectedKind === "weekly" ? dayOfWeek : "*"),
    });
    onChange({ scheduleType: "cron", scheduleCron: cron, scheduleTrigger: "schedule" });
  };

  const changeKind = (nextKind: ScheduleKind) => {
    if (nextKind === "manual") {
      onChange({ scheduleType: "manual", scheduleCron: "", scheduleTrigger: "manual" });
      return;
    }
    if (nextKind === "event") {
      onChange({ scheduleType: "event", scheduleCron: "", scheduleTrigger: form.scheduleTrigger || "event" });
      return;
    }
    if (nextKind === "advanced") {
      onChange({ scheduleType: "cron", scheduleCron: form.scheduleCron || "0 8 * * *", scheduleTrigger: "schedule" });
      return;
    }
    const cron = scheduleFormToCron({
      time,
      dayOfMonth: nextKind === "monthly" ? dayOfMonth : "*",
      month,
      dayOfWeek: nextKind === "weekly" ? dayOfWeek : "*",
    });
    onChange({ scheduleType: "cron", scheduleCron: cron, scheduleTrigger: "schedule" });
  };

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-4">
        <p className="text-sm font-semibold text-foreground">Jadwal Pengiriman</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Atur dengan jam, hari, tanggal, dan bulan. Cron tetap disimpan untuk kompatibilitas backend.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SelectField
          label="Tipe jadwal"
          value={selectedKind}
          onChange={(value) => changeKind(value as ScheduleKind)}
          options={[
            { value: "manual", label: "Tidak terjadwal / manual" },
            { value: "daily", label: "Berulang harian" },
            { value: "weekly", label: "Berulang mingguan" },
            { value: "monthly", label: "Berulang bulanan" },
            { value: "event", label: "Berdasarkan event" },
            ...(showAdvancedMode ? [{ value: "advanced", label: "Cron lanjutan" }] : []),
          ]}
        />
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ringkasan Jadwal</p>
          <p className="mt-2 text-sm font-semibold text-foreground">{humanizeSchedule(form.scheduleType, form.scheduleCron, form.scheduleTrigger)}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Ringkasan ini yang ditampilkan kepada admin.</p>
        </div>
        {["daily", "weekly", "monthly"].includes(selectedKind) ? (
          <>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Jam</span>
              <Input type="time" step={1} value={time} onChange={(event) => updateCronSchedule({ time: event.target.value.length === 5 ? `${event.target.value}:00` : event.target.value })} />
              <span className="block text-xs text-muted-foreground">Format HH:mm:ss, contoh 08:00:00. Detik disimpan sebagai metadata tampilan; cron backend memakai menit.</span>
            </label>
            {selectedKind === "monthly" ? (
              <SelectField
                label="Tanggal bulan"
                value={dayOfMonth}
                onChange={(value) => updateCronSchedule({ dayOfMonth: value })}
                options={Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1), label: `Tanggal ${index + 1}` }))}
              />
            ) : null}
            {selectedKind === "weekly" ? (
              <SelectField label="Hari minggu" value={dayOfWeek} onChange={(value) => updateCronSchedule({ dayOfWeek: value })} options={DAY_OPTIONS} />
            ) : null}
            <SelectField label="Bulan" value={month} onChange={(value) => updateCronSchedule({ month: value })} options={MONTH_OPTIONS} />
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Tahun</span>
              <Input value="Setiap tahun" disabled />
              <span className="block text-xs text-muted-foreground">Tahun belum dipakai oleh cron 5-field dan diperlakukan sebagai metadata.</span>
            </label>
          </>
        ) : null}
        {selectedKind === "event" ? (
          <Field label="Nama event / trigger" value={form.scheduleTrigger} onChange={(value) => onChange({ scheduleTrigger: value })} placeholder="case_created, manual_approval, dll." />
        ) : null}
      </div>
      {selectedKind === "advanced" && showAdvancedMode ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-4">
          <p className="text-sm font-semibold text-foreground">Lanjutan - hanya untuk admin teknis</p>
          <div className="mt-3">
            <Field label="Cron Expression" value={form.scheduleCron} onChange={(value) => onChange({ scheduleType: "cron", scheduleCron: value, scheduleTrigger: "schedule" })} placeholder="0 8 * * *" />
          </div>
          {form.scheduleCron && !isValidCronExpression(form.scheduleCron) ? (
            <p className="mt-2 text-xs text-destructive">Format cron tidak valid.</p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Cron mentah hanya ditampilkan di Mode Lanjutan.</p>
          )}
        </div>
      ) : null}
      {kind === "advanced" && !showAdvancedMode ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Format jadwal lama tidak dikenali. Aktifkan Mode Lanjutan atau atur ulang jadwal melalui form.
        </p>
      ) : null}
    </div>
  );
}

function NotificationSection({
  title,
  description,
  notifications,
  queries,
  templates,
  onEdit,
  onTest,
  onPreviewRecipients,
  isSaving,
}: {
  title: string;
  description: string;
  notifications: AletaBotNotification[];
  queries: AletaBotQuery[];
  templates: AletaBotTemplate[];
  onEdit?: (notification: AletaBotNotification) => void;
  onTest: (notification: AletaBotNotification) => void;
  onPreviewRecipients: (notification: AletaBotNotification) => void;
  isSaving: boolean;
}) {
  const queryTitle = (id: string) => queryDisplayName(queries.find((query) => query.id === id)) || id;
  const templateTitle = (id: string) => templateDisplayName(templates.find((template) => template.id === id)) || id;
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef(false);
  const notificationTableWidthClass = "min-w-[1720px] w-[1720px]";
  const syncHorizontalScroll = (source: "top" | "table") => {
    if (isSyncingScrollRef.current) return;
    const from = source === "top" ? topScrollRef.current : tableScrollRef.current;
    const to = source === "top" ? tableScrollRef.current : topScrollRef.current;
    if (!from || !to) return;
    isSyncingScrollRef.current = true;
    to.scrollLeft = from.scrollLeft;
    window.requestAnimationFrame(() => {
      isSyncingScrollRef.current = false;
    });
  };

  return (
    <Card className="max-w-full min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 max-w-full overflow-hidden space-y-3">
        <div className="grid gap-3 overflow-x-auto pb-2 md:hidden">
          {notifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Belum ada notifikasi.</div>
          ) : notifications.map((notification) => (
            <div key={notification.id} className="min-w-[560px] rounded-xl border border-border p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-foreground">{notification.name}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{notification.description || "-"}</p>
                </div>
                <Badge variant={notification.isActive ? "success" : "muted"}>{notification.isActive ? "Aktif" : "Nonaktif"}</Badge>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                <p><span className="font-semibold text-foreground">Sumber data:</span> {queryTitle(notification.queryId)}</p>
                <p><span className="font-semibold text-foreground">Isi pesan:</span> {templateTitle(notification.templateId)}</p>
                <p><span className="font-semibold text-foreground">Target:</span> {notificationTargetLabel(notification)}</p>
                <p><span className="font-semibold text-foreground">Jadwal:</span> {humanizeSchedule(notification.scheduleConfig.type, notification.scheduleConfig.cron, notification.scheduleConfig.trigger)}</p>
                <p><span className="font-semibold text-foreground">Terakhir:</span> {notification.lastRunAt ? formatDateTime(notification.lastRunAt) : "Belum berjalan"}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant={statusVariant(notification.lastStatus)}>{displayStatus(notification.lastStatus)}</Badge>
                {notification.category === "party" && notification.policyStatus ? (
                  <>
                    <Badge variant={notification.policyStatus.dryRunPassed ? "success" : "warning"}>Simulasi {notification.policyStatus.dryRunPassed ? "Selesai" : "Belum"}</Badge>
                    <Badge variant={notification.policyStatus.recipientPreviewPassed ? "success" : "warning"}>Preview {notification.policyStatus.recipientPreviewPassed ? "Selesai" : "Belum"}</Badge>
                    <Badge variant={notification.policyStatus.approved ? "success" : "warning"}>Approval {notification.policyStatus.approved ? "Selesai" : "Belum"}</Badge>
                  </>
                ) : null}
              </div>
              <div className="mt-3 flex flex-nowrap gap-2">
                {onEdit ? <Button className="whitespace-nowrap" variant="outline" size="sm" onClick={() => onEdit(notification)} disabled={isSaving}>Edit</Button> : null}
                <Button className="whitespace-nowrap" variant="outline" size="sm" onClick={() => onTest(notification)} disabled={isSaving}>Simulasi</Button>
                <Button className="whitespace-nowrap" variant="outline" size="sm" onClick={() => onPreviewRecipients(notification)} disabled={isSaving}>Preview Penerima</Button>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden min-w-0 max-w-full md:block">
          <div
            ref={topScrollRef}
            className={cn(
              "mb-3 h-5 w-full max-w-full overflow-x-scroll overflow-y-hidden overscroll-x-contain rounded bg-muted/30",
              HORIZONTAL_SCROLLBAR_CLASS
            )}
            onScroll={() => syncHorizontalScroll("top")}
          >
            <div className={cn("h-1", notificationTableWidthClass)} />
          </div>
          <div
            ref={tableScrollRef}
            className={cn(
              "max-w-full overflow-x-scroll overflow-y-hidden overscroll-x-contain pb-3",
              HORIZONTAL_SCROLLBAR_CLASS
            )}
            onScroll={() => syncHorizontalScroll("table")}
          >
        <table className={cn(notificationTableWidthClass, "text-left text-sm")}>
          <thead className="border-b border-border text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="w-[310px] py-3 pr-4">Nama</th>
              <th className="w-[120px] py-3 pr-4">Kategori</th>
              <th className="w-[280px] py-3 pr-4">Sumber Data</th>
              <th className="w-[240px] py-3 pr-4">Isi Pesan</th>
              <th className="w-[190px] py-3 pr-4">Target</th>
              <th className="w-[240px] py-3 pr-4">Jadwal</th>
              <th className="w-[170px] py-3 pr-4">Terakhir</th>
              <th className="w-[190px] py-3 pr-4">Status</th>
              <th className="w-[270px] py-3 pr-4">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((notification) => (
              <tr key={notification.id} className="border-b border-border/70 align-top">
                <td className="break-words py-4 pr-4">
                  <p className="font-medium text-foreground">{notification.name}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{notification.description}</p>
                </td>
                <td className="break-words py-4 pr-4"><Badge variant="outline">{notification.category === "employee" ? "Pegawai" : "Pihak"}</Badge></td>
                <td className="break-words py-4 pr-4 text-muted-foreground">{queryTitle(notification.queryId)}</td>
                <td className="break-words py-4 pr-4 text-muted-foreground">{templateTitle(notification.templateId)}</td>
                <td className="break-words py-4 pr-4 text-muted-foreground">{notificationTargetLabel(notification)}</td>
                <td className="break-words py-4 pr-4">
                  <p>{humanizeSchedule(notification.scheduleConfig.type, notification.scheduleConfig.cron, notification.scheduleConfig.trigger)}</p>
                  <p className="text-xs text-muted-foreground">{notification.scheduleConfig.trigger || "-"}</p>
                </td>
                <td className="break-words py-4 pr-4">{notification.lastRunAt ? formatDateTime(notification.lastRunAt) : "Belum berjalan"}</td>
                <td className="break-words py-4 pr-4">
                  <div className="space-y-2">
                    <Badge variant={notification.isActive ? "success" : "muted"}>{notification.isActive ? "Aktif" : "Nonaktif"}</Badge>
                    <Badge variant={statusVariant(notification.lastStatus)}>{displayStatus(notification.lastStatus)}</Badge>
                    {notification.category === "party" && notification.policyStatus ? (
                      <div className="mt-2 space-y-1 text-[10px] leading-4 text-muted-foreground">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={notification.policyStatus.dryRunPassed ? "success" : "warning"}>Simulasi {notification.policyStatus.dryRunPassed ? "Selesai" : "Belum"}</Badge>
                          <Badge variant={notification.policyStatus.recipientPreviewPassed ? "success" : "warning"}>Preview {notification.policyStatus.recipientPreviewPassed ? "Selesai" : "Belum"}</Badge>
                          <Badge variant={notification.policyStatus.approved ? "success" : "warning"}>Approval {notification.policyStatus.approved ? "Disetujui" : "Belum"}</Badge>
                        </div>
                        <p>{notification.policyStatus.canActivate ? "Bisa aktif sesuai policy." : "Belum bisa aktif."}</p>
                      </div>
                    ) : null}
                  </div>
                </td>
                <td className="py-4 pr-4">
                  <div className="flex flex-nowrap gap-1.5">
                    {onEdit ? <Button className="whitespace-nowrap" variant="outline" size="sm" onClick={() => onEdit(notification)} disabled={isSaving}>Edit</Button> : null}
                    <Button className="whitespace-nowrap" variant="outline" size="sm" onClick={() => onTest(notification)} disabled={isSaving}>Simulasi</Button>
                    <Button className="whitespace-nowrap" variant="outline" size="sm" onClick={() => onPreviewRecipients(notification)} disabled={isSaving}>Preview Penerima</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LogCard({ title, logs }: { title: string; logs: AletaBotSnapshot["logs"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Riwayat terbaru aktivitas modul bot.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Belum ada log.</div>
        ) : (
          logs.slice(0, 25).map((log) => (
            <div key={log.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(log.level)}>{log.level}</Badge>
                  <Badge variant="outline">{log.eventType}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-foreground">{log.message}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function WorkerControlCard({
  workerState,
  isSaving,
  onPause,
  onResume,
}: {
  workerState: AletaBotWorkerState | null;
  isSaving: boolean;
  onPause: (reason: string) => void;
  onResume: () => void;
}) {
  const [pauseReason, setPauseReason] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontrol Mesin Bot</CardTitle>
        <CardDescription>Jeda atau lanjutkan mesin pemroses pesan. Saat dijeda, pesan menunggu di antrean.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {workerState ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoCard
              title="Status"
              value={workerState.paused ? "paused" : workerState.enabled && workerState.activeTimer ? "aktif" : "stopped"}
              hint={
                workerState.pauseReason ||
                (workerState.enabled && workerState.activeTimer
                  ? workerState.running
                  ? "Mesin bot sedang memproses pesan."
                    : "Mesin bot aktif dan menunggu jadwal berikutnya."
                  : "Mesin bot tidak aktif.")
              }
            />
            <InfoCard title="Heartbeat Terakhir" value={workerState.lastHeartbeatAt ? formatDateTime(workerState.lastHeartbeatAt) : "Belum ada"} hint={`Batch terakhir: ${workerState.lastBatchProcessed} pesan.`} />
            <InfoCard title="Interval" value={`${workerState.intervalMs}ms`} hint={`Batch size: ${workerState.batchSize}`} />
            <InfoCard title="Kendala Terakhir" value={workerState.lastError || "Tidak ada"} hint={workerState.pausedAt ? `Dijeda: ${formatDateTime(workerState.pausedAt)}` : "Tidak sedang dijeda."} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Status mesin bot belum tersedia.</div>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-foreground">Alasan jeda</label>
            <Input value={pauseReason} onChange={(event) => setPauseReason(event.target.value)} placeholder="Maintenance jadwal, atau biarkan kosong..." />
          </div>
          <Button
            variant="outline"
            onClick={() => onPause(pauseReason || "Dijeda manual dari portal admin.")}
            disabled={isSaving || (workerState?.paused ?? false)}
          >
            <Power className="h-4 w-4" />
            Jeda Mesin Bot
          </Button>
          <Button
            onClick={() => onResume()}
            disabled={isSaving || !(workerState?.paused ?? false)}
          >
            <Play className="h-4 w-4" />
            Lanjutkan Mesin Bot
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function maskNumber(n: string) {
  const digits = n.replace(/\D/g, "");
  if (digits.length <= 5) return "****";
  return `${digits.slice(0, 3)}****${digits.slice(-2)}`;
}

function DeadLetterCard({
  deadLetters,
  resolvedDeadLetters,
  isSaving,
  onResend,
  onResolve,
}: {
  deadLetters: AletaBotDeadLetter[];
  resolvedDeadLetters: AletaBotDeadLetter[];
  isSaving: boolean;
  onResend: (id: string) => Promise<void>;
  onResolve: (id: string, note: string) => Promise<void>;
}) {
  const [pendingResend, setPendingResend] = React.useState<AletaBotDeadLetter | null>(null);
  const [pendingResolve, setPendingResolve] = React.useState<AletaBotDeadLetter | null>(null);
  const [resolveNote, setResolveNote] = React.useState("");

  const handleConfirmResend = async () => {
    if (!pendingResend) return;
    await onResend(pendingResend.id);
    setPendingResend(null);
  };

  const openResolveConfirm = (deadLetter: AletaBotDeadLetter) => {
    const isSame = pendingResolve?.id === deadLetter.id;
    setPendingResend(null);
    setPendingResolve(isSame ? null : deadLetter);
    setResolveNote(isSame ? "" : getDefaultDeadLetterResolveNote(deadLetter));
  };

  const handleConfirmResolve = async () => {
    if (!pendingResolve) return;
    await onResolve(pendingResolve.id, resolveNote.trim());
    setPendingResolve(null);
    setResolveNote("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Antrian & Pesan Gagal</CardTitle>
        <CardDescription>Pesan gagal aktif bisa dikirim ulang jika aman, atau ditandai ditangani tanpa mengirim WhatsApp.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant={deadLetters.length > 0 ? "warning" : "success"}>Pesan gagal aktif: {deadLetters.length}</Badge>
          <Badge variant="outline">Sudah ditangani: {resolvedDeadLetters.length}</Badge>
        </div>
        <div className="mb-3">
          <p className="text-sm font-semibold text-foreground">Pesan gagal aktif</p>
          <p className="text-xs text-muted-foreground">Item di bagian ini masih dihitung sebagai dead-letter aktif sampai dikirim ulang atau ditandai ditangani.</p>
        </div>
        {deadLetters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Tidak ada pesan gagal aktif. Riwayat yang sudah ditangani tetap tersimpan di bawah.</div>
        ) : (
          <>
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4">Penerima</th>
                  <th className="py-3 pr-4">Pratinjau Pesan</th>
                  <th className="py-3 pr-4">Kategori</th>
                  <th className="py-3 pr-4">Retry</th>
                  <th className="py-3 pr-4">Error</th>
                  <th className="py-3 pr-4">Dibuat</th>
                  <th className="py-3 pr-4">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {deadLetters.map((dl) => (
                  <tr key={dl.id} className={cn("border-b border-border/70 align-top", (pendingResend?.id === dl.id || pendingResolve?.id === dl.id) && "bg-amber-500/5")}>
                    <td className="py-4 pr-4">
                      <p className="font-medium text-foreground">{dl.recipientName || maskNumber(dl.recipientNumber)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{maskNumber(dl.recipientNumber)}</p>
                    </td>
                    <td className="py-4 pr-4 max-w-[240px]">
                      <p className="text-muted-foreground line-clamp-2 text-xs">{dl.messagePreview}</p>
                    </td>
                    <td className="py-4 pr-4"><Badge variant="outline">{dl.category}</Badge></td>
                    <td className="py-4 pr-4 text-center text-muted-foreground">{dl.retryCount}/{dl.maxRetries}</td>
                    <td className="py-4 pr-4 max-w-[180px]">
                      <p className="text-xs text-destructive line-clamp-2">{dl.lastError || "—"}</p>
                    </td>
                    <td className="py-4 pr-4 text-xs text-muted-foreground">{formatDateTime(dl.createdAt)}</td>
                    <td className="py-4 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isSaving || isValidationOnlyDeadLetter(dl)}
                          title={isValidationOnlyDeadLetter(dl) ? "Artefak validasi tidak boleh dikirim ulang." : undefined}
                          onClick={() => {
                            setPendingResolve(null);
                            setResolveNote("");
                            setPendingResend(pendingResend?.id === dl.id ? null : dl);
                          }}
                        >
                          {isValidationOnlyDeadLetter(dl) ? "Jangan Kirim" : pendingResend?.id === dl.id ? "Batal" : "Kirim Ulang"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isSaving}
                          onClick={() => openResolveConfirm(dl)}
                        >
                          {pendingResolve?.id === dl.id ? "Batal" : "Tandai Ditangani"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {pendingResolve ? (
              <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Tandai pesan gagal sebagai ditangani?</p>
                <p className="text-xs text-muted-foreground">Aksi ini tidak akan mengirim ulang WhatsApp. Pesan tetap tersimpan sebagai riwayat, tetapi tidak lagi dihitung sebagai pesan gagal aktif.</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><span className="font-medium">Penerima:</span> {maskNumber(pendingResolve.recipientNumber)} ({pendingResolve.recipientName || "-"})</p>
                  <p><span className="font-medium">Kategori:</span> {pendingResolve.category} / {pendingResolve.notificationKey || "-"}</p>
                  <p><span className="font-medium">Pratinjau:</span> {pendingResolve.messagePreview?.slice(0, 120)}{pendingResolve.messagePreview?.length > 120 ? "..." : ""}</p>
                </div>
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-foreground">Catatan penanganan</span>
                  <Textarea
                    value={resolveNote}
                    onChange={(event) => setResolveNote(event.target.value)}
                    rows={3}
                    placeholder="Alasan pesan ditandai ditangani..."
                  />
                </label>
                <div className="flex gap-2">
                  <Button size="sm" disabled={isSaving} onClick={() => void handleConfirmResolve()}>
                    Tandai Ditangani
                  </Button>
                  <Button size="sm" variant="outline" disabled={isSaving} onClick={() => { setPendingResolve(null); setResolveNote(""); }}>
                    Batal
                  </Button>
                </div>
              </div>
            ) : null}

            {pendingResend ? (
              <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground">Konfirmasi Kirim Ulang Dead Letter</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><span className="font-medium">Penerima:</span> {maskNumber(pendingResend.recipientNumber)} ({pendingResend.recipientName || "—"})</p>
                  <p><span className="font-medium">Kategori:</span> {pendingResend.category} / {pendingResend.notificationKey || "—"}</p>
                  <p><span className="font-medium">Pratinjau:</span> {pendingResend.messagePreview?.slice(0, 120)}{pendingResend.messagePreview?.length > 120 ? "…" : ""}</p>
                  <p><span className="font-medium">Retry sebelumnya:</span> {pendingResend.retryCount}/{pendingResend.maxRetries}</p>
                  <p className="text-amber-700">Pesan baru akan diantrikan ulang dengan ID baru dan priority reset. Nomor penerima hanya ditampilkan dalam bentuk masked.</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={isSaving} onClick={() => void handleConfirmResend()}>
                    Konfirmasi Kirim Ulang
                  </Button>
                  <Button size="sm" variant="outline" disabled={isSaving} onClick={() => setPendingResend(null)}>
                    Batal
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}

        <div className="mt-6 border-t border-border pt-4">
          <div className="mb-3">
            <p className="text-sm font-semibold text-foreground">Pesan gagal sudah ditangani</p>
            <p className="text-xs text-muted-foreground">Riwayat ini tidak dihitung sebagai pesan gagal aktif dan tidak memicu readiness blocker.</p>
          </div>
          {resolvedDeadLetters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Belum ada pesan gagal yang ditandai ditangani.</div>
          ) : (
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4">Penerima</th>
                  <th className="py-3 pr-4">Pratinjau Pesan</th>
                  <th className="py-3 pr-4">Kategori</th>
                  <th className="py-3 pr-4">Ditangani</th>
                  <th className="py-3 pr-4">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {resolvedDeadLetters.map((dl) => (
                  <tr key={dl.id} className="border-b border-border/70 align-top">
                    <td className="py-4 pr-4">
                      <p className="font-medium text-foreground">{dl.recipientName || maskNumber(dl.recipientNumber)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{maskNumber(dl.recipientNumber)}</p>
                    </td>
                    <td className="py-4 pr-4 max-w-[240px]">
                      <p className="text-muted-foreground line-clamp-2 text-xs">{dl.messagePreview}</p>
                    </td>
                    <td className="py-4 pr-4"><Badge variant="outline">{dl.category}</Badge></td>
                    <td className="py-4 pr-4 text-xs text-muted-foreground">
                <p>{formatDateTime(dl.resolvedAt ?? dl.updatedAt)}</p>
                      {dl.resolvedBy ? <p className="mt-1">oleh {dl.resolvedBy}</p> : null}
                    </td>
                    <td className="py-4 pr-4 max-w-[240px]">
                      <p className="text-xs text-muted-foreground line-clamp-2">{dl.resolvedNote || "-"}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const PHASE_4_DEAD_LETTER_RESOLVE_NOTE = "Artefak validasi Phase 4. Simulated failure only. Do not send.";

function getDefaultDeadLetterResolveNote(deadLetter: AletaBotDeadLetter) {
  const text = `${deadLetter.messagePreview} ${deadLetter.lastError} ${deadLetter.notificationKey} ${deadLetter.sourceFeature}`.toLowerCase();
  if (text.includes("phase 4") || text.includes("do not send") || text.includes("simulated failure")) {
    return PHASE_4_DEAD_LETTER_RESOLVE_NOTE;
  }
  return "";
}

function isValidationOnlyDeadLetter(deadLetter: AletaBotDeadLetter) {
  return getDefaultDeadLetterResolveNote(deadLetter) === PHASE_4_DEAD_LETTER_RESOLVE_NOTE;
}

function ApprovalRequestsCard({
  approvalRequests,
  isSaving,
  onReview,
  canReview = true,
}: {
  approvalRequests: AletaBotApprovalRequest[];
  isSaving: boolean;
  onReview: (approvalId: string, decision: "approved" | "rejected", notes?: string) => Promise<void>;
  canReview?: boolean;
}) {
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const pending = approvalRequests.filter((r) => r.status === "pending");
  const reviewed = approvalRequests.filter((r) => r.status !== "pending");
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Permintaan Persetujuan ({pending.length} tertunda)</CardTitle>
          <CardDescription>Intent, template, dan notifikasi dengan requiresApprovalBeforeActive yang belum disetujui.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pending.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Tidak ada permintaan yang menunggu persetujuan.</div>
          ) : (
            pending.map((req) => (
              <div key={req.id} className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">{req.entityName}</p>
                    <p className="text-xs text-muted-foreground mt-1">{req.entityType} / {req.entityId}</p>
                    <p className="text-xs text-muted-foreground">Diminta: {formatDateTime(req.requestedAt)} oleh {req.requestedBy}</p>
                  </div>
                  <Badge variant="warning">pending</Badge>
                </div>
                {req.notes ? <p className="text-sm text-muted-foreground">{req.notes}</p> : null}
                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1">
                    {!canReview ? <p className="text-xs text-muted-foreground">Keputusan approval hanya dapat dilakukan Super Admin.</p> : null}
                    {canReview ? <Input
                      placeholder="Catatan reviewer (opsional)..."
                      value={reviewNotes[req.id] ?? ""}
                      onChange={(event) => setReviewNotes((current) => ({ ...current, [req.id]: event.target.value }))}
                    /> : null}
                  </div>
                  {canReview ? <Button
                    size="sm"
                    onClick={() => void onReview(req.id, "approved", reviewNotes[req.id])}
                    disabled={isSaving}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Setujui
                  </Button> : null}
                  {canReview ? <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void onReview(req.id, "rejected", reviewNotes[req.id])}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4" />
                    Tolak
                  </Button> : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      {reviewed.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Riwayat Persetujuan</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4">Entitas</th>
                  <th className="py-3 pr-4">Tipe</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Direview Oleh</th>
                  <th className="py-3 pr-4">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {reviewed.slice(0, 20).map((req) => (
                  <tr key={req.id} className="border-b border-border/70 align-top">
                    <td className="py-4 pr-4">
                      <p className="font-medium text-foreground">{req.entityName}</p>
                      <p className="text-xs text-muted-foreground">{req.entityId}</p>
                    </td>
                    <td className="py-4 pr-4 text-muted-foreground">{req.entityType}</td>
                    <td className="py-4 pr-4"><Badge variant={req.status === "approved" ? "success" : "danger"}>{req.status}</Badge></td>
                    <td className="py-4 pr-4 text-muted-foreground">{req.reviewedBy ?? "—"}</td>
                    <td className="py-4 pr-4 text-xs text-muted-foreground">{req.reviewedAt ? formatDateTime(req.reviewedAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function LegacyMigrationCard({
  legacyMigrations,
  unknownQuestionReviews,
  isSaving,
  onAction,
  showAdvanced,
}: {
  legacyMigrations: AletaBotLegacyMigration[];
  unknownQuestionReviews: AletaBotSnapshot["unknownQuestionReviews"];
  isSaving: boolean;
  onAction: (action: LegacyMigrationAction, migration: AletaBotLegacyMigration) => void;
  showAdvanced: boolean;
}) {
  const [groupBy, setGroupBy] = React.useState<"category" | "legacyType" | "status">("legacyType");

  const statusColor = (status: AletaBotLegacyMigration["status"]) => {
    if (["migrated", "active_registry", "legacy_disabled", "archivable"].includes(status)) return "success" as const;
    if (["in_progress", "registry_draft", "needs_manual_mapping", "dry_run", "pending_approval", "mapped"].includes(status)) return "warning" as const;
    if (status === "skipped") return "outline" as const;
    return "muted" as const;
  };
  const statusLabel = (status: AletaBotLegacyMigration["status"]) => {
    const labels: Record<string, string> = {
      migrated: "Selesai",
      in_progress: "Sedang Proses",
      skipped: "Dilewati",
      not_migrated: "Belum Migrasi",
      mapped: "Terpetakan",
      registry_draft: "Draft Registry",
      needs_manual_mapping: "Perlu Konfigurasi Manual",
      dry_run: "Mode Simulasi",
      pending_approval: "Menunggu Persetujuan",
      active_registry: "Aktif di Registry",
      legacy_disabled: "Dinonaktifkan (Migrasi)",
      archivable: "Siap Diarsipkan",
    };
    return labels[status] ?? "Tertunda";
  };
  const riskColor = (risk: AletaBotLegacyMigration["riskLevel"]) => {
    if (risk === "high") return "danger" as const;
    if (risk === "medium") return "warning" as const;
    return "muted" as const;
  };
  const typeLabel = (type: AletaBotLegacyMigration["legacyType"]) => {
    const labels: Record<string, string> = {
      party_notification: "Notif Pihak",
      employee_notification: "Notif Pegawai",
      public_command: "Perintah Publik",
      admin_command: "Perintah Admin",
      infrastructure: "Infrastruktur",
      ai_service: "AI/QA",
      other: "Lainnya",
    };
    return labels[type] ?? type;
  };

  const grouped = React.useMemo(() => {
    const groups: Record<string, AletaBotLegacyMigration[]> = {};
    for (const m of legacyMigrations) {
      const key = groupBy === "legacyType" ? typeLabel(m.legacyType)
        : groupBy === "category" ? (m.category || "Tanpa Kategori")
        : statusLabel(m.status);
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }
    return groups;
  }, [legacyMigrations, groupBy]);

  const migratedCount = legacyMigrations.filter((m) => ["migrated", "active_registry", "legacy_disabled", "archivable"].includes(m.status)).length;
  const inProgressCount = legacyMigrations.filter((m) => ["in_progress", "registry_draft", "dry_run", "pending_approval", "mapped", "needs_manual_mapping"].includes(m.status)).length;
  const pendingCount = legacyMigrations.filter((m) => ["pending", "not_migrated"].includes(m.status)).length;
  const highRiskPending = legacyMigrations.filter((m) => m.riskLevel === "high" && ["pending", "not_migrated", "needs_manual_mapping"].includes(m.status)).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Tracker Migrasi Legacy</CardTitle>
            <CardDescription className="mt-1">
              Inventaris lengkap 25+ fungsi legacy (app.js, notifikasi.js, query.js) yang perlu dimigrasikan ke portal.
            </CardDescription>
          </div>
          <div className="flex gap-2 text-xs">
            <Badge variant="success">{migratedCount} Selesai</Badge>
            <Badge variant="warning">{inProgressCount} Proses</Badge>
            <Badge variant="muted">{pendingCount} Tertunda</Badge>
            {highRiskPending > 0 && <Badge variant="danger">{highRiskPending} Risiko Tinggi</Badge>}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Kelompokkan:</span>
          {(["legacyType", "category", "status"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupBy(g)}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${groupBy === g ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {g === "legacyType" ? "Tipe" : g === "category" ? "Kategori" : "Status"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {legacyMigrations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Data migrasi belum tersedia.</div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([groupKey, migrations]) => (
              <div key={groupKey}>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {groupKey} <span className="text-foreground/40">({migrations.length})</span>
                </h4>
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Fitur</th>
                      <th className="py-2 pr-3">Fungsi Legacy</th>
                      <th className="py-2 pr-3">Jadwal</th>
                      <th className="py-2 pr-3">Target Portal</th>
                      <th className="py-2 pr-3">Risiko</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Catatan</th>
                      <th className="py-2 pr-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {migrations.map((migration) => (
                      <tr key={migration.id} className="border-b border-border/50 align-top hover:bg-muted/30">
                        <td className="py-3 pr-3">
                          <div className="font-medium text-foreground">{migration.feature}</div>
                          {migration.canArchive && migration.status === "legacy_disabled" && (
                            <Badge variant="success" className="mt-1 text-[10px]">Siap Diarsipkan</Badge>
                          )}
                          {migration.canArchive && migration.status !== "legacy_disabled" && (
                            <span className="text-[10px] text-muted-foreground">Dapat diarsip setelah dinonaktifkan</span>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground/80">{migration.sourceFunction || migration.legacyKey || "—"}</code>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">{migration.legacySource.split("(")[0]?.trim()}</div>
                        </td>
                        <td className="py-3 pr-3">
                          {migration.cronSchedule
                            ? <span className="text-xs text-muted-foreground">{humanizeLegacyCron(migration.cronSchedule)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-3 pr-3 text-xs">
                          <div className="text-muted-foreground">{migration.registryTargetType || "—"}</div>
                          {migration.registryTargetKey && <div className="text-[10px] text-muted-foreground/60">{migration.registryTargetKey}</div>}
                        </td>
                        <td className="py-3 pr-3"><Badge variant={riskColor(migration.riskLevel)} className="text-[10px]">{migration.riskLevel}</Badge></td>
                        <td className="py-3 pr-3"><Badge variant={statusColor(migration.status)} className="text-[10px]">{statusLabel(migration.status)}</Badge></td>
                        <td className="py-3 pr-3 max-w-[200px]">
                          <p className="text-[11px] text-muted-foreground line-clamp-2">{migration.notes || "—"}</p>
                          {migration.migratedAt && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{formatDateTime(migration.migratedAt)}</p>}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex max-w-[220px] flex-col gap-1.5">
                            {/* Langkah Berikutnya */}
                            {(() => {
                              const suggested = getSuggestedMigrationAction(migration.status);
                              if (!suggested) {
                                if (migration.status === "pending_approval") {
                                  return <p className="text-[10px] text-amber-600 font-medium">⏳ Tahap 4/5 — Menunggu persetujuan</p>;
                                }
                                if (migration.status === "legacy_disabled") {
                                  return <p className="text-[10px] text-emerald-600 font-medium">✓ Selesai — Siap diarsipkan</p>;
                                }
                                return null;
                              }
                              return (
                                <div className={`rounded border px-2 py-1 text-[10px] font-medium ${suggested.isHighRisk ? "border-destructive/30 text-destructive" : "border-primary/30 text-primary"}`}>
                                  {suggested.step}: {suggested.label}
                                </div>
                              );
                            })()}
                            {/* Aksi Aman */}
                            <div className="flex flex-wrap gap-1">
                              <Button size="sm" variant="outline" disabled={isSaving} onClick={() => onAction("preview", migration)}>Lihat Pratinjau</Button>
        <Button size="sm" variant="outline" disabled={isSaving || !["registry_draft", "needs_manual_mapping", "mapped", "in_progress"].includes(migration.status)} onClick={() => onAction("dry-run", migration)}>Simulasi</Button>
                            </div>
                            {/* Alur Kerja */}
                            <div className="flex flex-wrap gap-1">
                              <Button size="sm" variant="outline" disabled={isSaving || ["active_registry", "legacy_disabled", "archivable"].includes(migration.status)} onClick={() => onAction("convert", migration)}>Ubah ke Draft</Button>
                              <Button size="sm" variant="outline" disabled={isSaving || !["dry_run", "registry_draft"].includes(migration.status)} onClick={() => onAction("submit-approval", migration)}>Ajukan</Button>
                              <Button size="sm" variant="outline" disabled={isSaving || !["pending_approval", "dry_run", "registry_draft"].includes(migration.status)} onClick={() => onAction("activate", migration)}>Aktifkan</Button>
                            </div>
                            {/* Risiko Tinggi — hanya Mode Lanjutan */}
                            {showAdvanced ? (
                              <div className="flex flex-wrap gap-1 border-t border-destructive/20 pt-1">
                                <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" disabled={isSaving || !["active_registry", "migrated", "archivable"].includes(migration.status)} onClick={() => onAction("disable-legacy", migration)}>Nonaktifkan</Button>
                                <Button size="sm" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" disabled={isSaving || ["pending", "not_migrated"].includes(migration.status)} onClick={() => onAction("rollback", migration)}>Kembalikan</Button>
                              </div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {unknownQuestionReviews.length > 0 ? (
        <CardContent className="border-t border-border">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-foreground">AI Review Pertanyaan Tidak Dikenali</h4>
            <p className="text-xs text-muted-foreground">Saran intent/alias berbasis log fallback. Pembuatan intent tetap harus via modal dan approval.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {unknownQuestionReviews.slice(0, 8).map((item) => (
              <div key={item.normalizedMessage} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{item.rawMessage}</p>
                  <Badge variant={item.safetyRisk === "high" ? "danger" : item.safetyRisk === "medium" ? "warning" : "muted"}>{item.safetyRisk}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Frekuensi {item.frequency}x, terakhir {formatDateTime(item.lastAskedAt)}, pengirim {item.senderMasked || "masked"}</p>
                <p className="mt-2 text-xs text-muted-foreground">Saran: <code>{item.suggestedIntentKey}</code> ({Math.round(item.confidence * 100)}%) - {item.suggestedAction}</p>
                {item.suggestedAction === "human_handoff" ? <p className="mt-2 text-xs text-amber-600">Human handoff disarankan untuk keamanan jawaban.</p> : null}
              </div>
            ))}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
