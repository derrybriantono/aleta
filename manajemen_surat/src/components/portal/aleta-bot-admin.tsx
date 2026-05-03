"use client";

import {
  Bot,
  CheckCircle2,
  Database,
  Download,
  Eye,
  EyeOff,
  FileText,
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
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import React, { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  type AletaBotLegacyMigration,
  type AletaBotNotification,
  type AletaBotNotificationCategory,
  type AletaBotDbConnection,
  type AletaBotPublicQaIntent,
  type AletaBotQuery,
  type AletaBotQueryCategory,
  type AletaBotSnapshot,
  type AletaBotTemplate,
  type AletaBotUnknownQuestionReview,
  type AletaBotWorkerState,
} from "@/lib/aleta-bot-types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
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
};

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

const emptySnapshot: AletaBotSnapshot = {
  settings: {
    botEnabled: false,
    notificationsEnabled: false,
    adminWhatsappNumber: "",
    messageDelayMs: 1500,
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
  scheduleType: "cron" | "manual" | "event";
  scheduleCron: string;
  scheduleTrigger: string;
  isActive: boolean;
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
type ParsedCronSchedule = {
  valid: boolean;
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  time: string;
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
    active_registry: "Aktif di Registry",
    legacy_disabled: "Dinonaktifkan (Migrasi)",
    dry_run: "Mode Simulasi",
    pilot: "Pilot",
    production: "Produksi",
    pending_approval: "Menunggu Persetujuan",
    needs_manual_mapping: "Perlu Konfigurasi Manual",
    registry_draft: "Draft Registry",
    waiting_qr: "Scan QR Diperlukan",
    qr_needed: "Scan QR Diperlukan",
    browser_locked: "Session WhatsApp Terkunci",
    disconnected: "Tidak Terhubung",
    connected: "Terhubung",
    initializing: "Menyiapkan Koneksi",
    enabled: "Aktif",
    disabled: "Nonaktif",
    paused: "Dijeda",
    running: "Berjalan",
    stopped: "Berhenti",
    ok: "OK",
    error: "Error",
    needs_sync: "Perlu Sinkronisasi",
    active: "Aktif",
    inactive: "Nonaktif",
    online: "Online",
    offline: "Offline",
    failed: "Gagal",
    blocked: "Terblokir",
    simulated: "Simulasi",
    skipped: "Dilewati",
    completed: "Selesai",
    manual_dry_run: "Manual Dry-run",
    manual_controlled: "Manual Terkontrol",
    scheduler_dry_run: "Scheduler Dry-run",
    scheduler_blocked: "Scheduler Diblokir",
    success: "Berhasil",
    unknown: "Tidak Diketahui",
  };
  return map[status] ?? status;
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
      return { label: "Status AI belum diketahui", hint: "Status AI belum tersedia dari runtime.", level: "warning" };
  }
}

function getSimpleMachineSummary(runtimeDashboard: RuntimeDashboardSnapshot | null): { label: string; hint: string; level: "ok" | "warning" | "error" } {
  if (!runtimeDashboard) {
    return { label: "Status belum diketahui", hint: "Detail teknis tersedia di Mode Lanjutan.", level: "warning" };
  }
  if (!runtimeDashboard.online) {
    return { label: "Bermasalah", hint: "ALETA Bot Gateway tidak dapat dihubungi. Detail teknis tersedia di Mode Lanjutan.", level: "error" };
  }
  return { label: "Aktif", hint: "Mesin bot dapat dihubungi. Detail teknis tersedia di Mode Lanjutan.", level: "ok" };
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value);
}

function isValidCronExpression(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return parts.every((part) => /^[\d*,/-]+$/.test(part));
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
  const parts = cronExpression.trim().split(/\s+/);
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

function renderAletaBotTemplatePreview(body: string) {
  const sample: Record<string, string> = {
    waktu: new Date().toLocaleString("id-ID"),
    mode: "dry-run",
    nomor_perkara: "123/Pdt.G/2026/PA.Dgl",
    nama_pihak: "Budi Santoso",
    nama_pegawai: "Contoh Pegawai",
    agenda: "Mediasi",
    hari_sidang: "Senin",
    tanggal_sidang: "12 Januari 2026",
    ruang_sidang: "Ruang Sidang 1",
    ruangan: "Ruang Sidang 1",
    sisa_panjar: "Rp125.000",
    judul_notifikasi: "Contoh Notifikasi",
    ringkasan: "Data contoh untuk pratinjau aman.",
  };

  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => sample[key] ?? `{{${key}}}`);
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
    active_registry: { action: "disable-legacy", label: "Nonaktifkan Legacy", step: "Tahap 5/5", isHighRisk: true },
  };
  return map[status] ?? null;
}

async function requestBot<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
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
    throw new Error(payload?.message ?? "Request ALETA Bot gagal diproses.");
  }
  return payload.data;
}

function makeEmptyNotificationForm(snapshot?: AletaBotSnapshot, category: AletaBotNotificationCategory = "employee"): NotificationForm {
  const query = snapshot?.queries.find((item) => item.category === category) ?? snapshot?.queries[0];
  const template =
    snapshot?.templates.find((item) => (category === "employee" ? item.id === "pegawai-monitoring" : item.id === "pihak-layanan")) ??
    snapshot?.templates[0];
  return {
    id: "",
    name: "",
    category,
    description: "",
    queryId: query?.id ?? "",
    templateId: template?.id ?? "",
    scheduleType: "manual",
    scheduleCron: "",
    scheduleTrigger: "manual",
    isActive: false,
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
    scheduleType: notification.scheduleConfig.type,
    scheduleCron: notification.scheduleConfig.cron,
    scheduleTrigger: notification.scheduleConfig.trigger,
    isActive: notification.isActive,
    delayMs: notification.delayMs,
    retryLimit: notification.retryLimit,
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

export function AletaBotAdminPanel() {
  const [snapshot, setSnapshot] = useState<AletaBotSnapshot>(emptySnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [recipientPreview, setRecipientPreview] = useState<RecipientPreviewResult | null>(null);
  const [settingsDraft, setSettingsDraft] = useState(emptySnapshot.settings);
  const [templateDraft, setTemplateDraft] = useState<Record<string, string>>({});
  const [testMessage, setTestMessage] = useState("Tes ALETA Bot dari portal berhasil.");
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
  const toggleAdvancedMode = () => {
    setShowAdvancedMode((prev) => {
      const next = !prev;
      try { localStorage.setItem("aleta-bot-admin-advanced", String(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const [notifCategoryFilter, setNotifCategoryFilter] = useState<"all" | "employee" | "party">("all");
  const [logFilter, setLogFilter] = useState<"all" | "error" | "whatsapp" | "ai" | "queue" | "approval" | "migration">("all");

  const navigateAdminAction = (href: string) => {
    if (!href.startsWith("#")) {
      window.location.href = href;
      return;
    }
    const targetId = href.slice(1);
    const tabByAnchor: Record<string, string> = {
      "status-whatsapp": "connection",
      "pengaturan-bot": "settings",
      "public-qa": "public-qa",
      "queue-recovery": "queue-recovery",
      "policy-skip": "dashboard",
      "reminder-deadline": "dashboard",
    };
    setActiveTab(tabByAnchor[targetId] ?? "dashboard");
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      setPublicQaConvertIntentId(snapshot.publicQaIntents.find((intent) => intent.status === "draft" && !intent.isActive)?.id ?? "");
      setPublicQaDraftIntentKey(key || "draft_public_qa");
      setPublicQaDraftIntentName(`Draft Intent: ${modal.review.rawMessage.slice(0, 48)}`);
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
    } catch {
      setRuntimeDashboard(null);
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
      void loadRuntimeDashboard();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Gagal memuat ALETA Bot.");
    } finally {
      setIsLoading(false);
    }
  }, [loadRuntimeDashboard]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    if (!["initializing", "waiting_qr"].includes(snapshot.whatsapp.runtimeStatus)) return;

    const timer = globalThis.setInterval(() => {
      void loadSnapshot();
    }, 2500);

    return () => globalThis.clearInterval(timer);
  }, [loadSnapshot, snapshot.whatsapp.runtimeStatus]);

  const saveSettings = async () => {
    setIsSaving(true);
    setNotice(null);
    try {
      const data = await requestBot<AletaBotSnapshot>("/api/admin/aleta-bot", {
        method: "PUT",
        body: JSON.stringify({ settings: settingsDraft }),
      });
      setSnapshot(data);
      setSettingsDraft(data.settings);
      setActiveModal(null);
      setModalDirty(false);
      setNotice("Pengaturan ALETA Bot berhasil disimpan dan disinkronkan.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Pengaturan gagal disimpan.");
    } finally {
      setIsSaving(false);
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
      setActiveModal(null);
      setModalDirty(false);
      setNotice(`Template ${template.title} berhasil disimpan.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Template gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveNotification = async () => {
    if (notificationForm.scheduleType === "cron" && notificationForm.scheduleCron && !isValidCronExpression(notificationForm.scheduleCron)) {
      setNotice("Format cron tidak valid.");
      return;
    }
    setIsSaving(true);
    setNotice(null);
    try {
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
            scheduleConfig: {
              type: notificationForm.scheduleType,
              cron: notificationForm.scheduleCron,
              trigger: notificationForm.scheduleTrigger,
            },
            isActive: notificationForm.isActive,
            delayMs: notificationForm.delayMs,
            retryLimit: notificationForm.retryLimit,
          },
        }),
      });
      setSnapshot(data);
      setNotificationForm(makeEmptyNotificationForm(data, notificationForm.category));
      setActiveModal(null);
      setModalDirty(false);
      setNotice("Notifikasi ALETA Bot berhasil disimpan dan disinkronkan ke runtime.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Notifikasi gagal disimpan.");
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
      setActiveModal(null);
      setModalDirty(false);
      setNotice("Query ALETA Bot berhasil disimpan dan disinkronkan ke runtime.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Query gagal disimpan.");
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
      setActiveModal(null);
      setModalDirty(false);
      setNotice("Koneksi SQL ALETA Bot berhasil disimpan dan disinkronkan.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Koneksi SQL gagal disimpan.");
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
      setNotice(data.result.status === "success" ? "Test koneksi SQL berhasil." : `Test koneksi SQL gagal: ${data.result.error || "unknown error"}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Test koneksi SQL gagal.");
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
      setNotice(data.result.status === "success" ? "Test koneksi SQL berhasil dengan data form saat ini." : `Test koneksi SQL gagal: ${data.result.error || "Periksa host, port, username, password, dan nama database."}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Test koneksi SQL gagal.");
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
      setActiveModal(null);
      setModalDirty(false);
      setNotice("Intent Pertanyaan Para Pihak berhasil disimpan dan disinkronkan.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Intent Pertanyaan Para Pihak gagal disimpan.");
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
      setNotice("Test intent Pertanyaan Para Pihak berhasil diproses tanpa mengirim WhatsApp.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Test intent Pertanyaan Para Pihak gagal.");
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
      setPublicQaReviewNote("");
      setActiveModal(null);
      setModalDirty(false);
      setNotice("Status human review Public Q&A berhasil diperbarui tanpa mengirim WhatsApp.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Review Public Q&A gagal disimpan.");
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
      setPublicQaReviewNote("");
      setActiveModal(null);
      setModalDirty(false);
      setNotice("Pertanyaan Public Q&A berhasil disimpan sebagai draft intent tanpa mengaktifkan jawaban otomatis.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Konversi Public Q&A ke draft intent gagal.");
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
      openModal({ type: "deadlineReminderPreview", title: "Simulasi Reminder Deadline H-1" });
      await loadSnapshot();
      setNotice("Simulasi reminder deadline H-1 selesai. Tidak ada WhatsApp sungguhan yang dikirim.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Simulasi reminder deadline gagal.");
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
      setNotice(`Mode reminder deadline diperbarui menjadi ${displayStatus(mode)}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Mode reminder deadline gagal diperbarui.");
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
      setNotice("Kontrol pilot/scheduler reminder diperbarui.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Kontrol reminder gagal diperbarui.");
    } finally {
      setIsSaving(false);
    }
  };

  const exportPolicySkipCsv = () => {
    const params = new URLSearchParams({ format: "csv" });
    if (policySkipReasonFilter !== "all") params.set("reason", policySkipReasonFilter);
    window.location.href = `/api/admin/aleta-bot/policy-skip-report?${params.toString()}`;
  };

  const exportPilotReadinessCsv = () => {
    window.open("/api/admin/aleta-bot/pilot-readiness?format=csv", "_blank", "noopener,noreferrer");
  };

  const runOperationalSmokeTest = async () => {
    setIsSaving(true);
    setNotice(null);
    setSmokeTestResult(null);
    try {
      const data = await requestBot<OperationalSmokeTestResult>("/api/admin/aleta-bot/operational-smoke-test");
      setSmokeTestResult(data);
      setNotice(
        data.overallStatus === "passed"
          ? "Smoke test operasional lulus tanpa mengirim WhatsApp."
          : "Smoke test selesai dengan catatan. Tidak ada WhatsApp yang dikirim."
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Smoke test operasional gagal.");
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
      openModal({ type: "deadlineReminderPreview", title: "Hasil Scheduler Dry-run Reminder H-1" });
      await loadSnapshot();
      setNotice("Scheduler dry-run dijalankan manual. Tidak ada WhatsApp sungguhan yang dikirim.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Scheduler dry-run reminder gagal.");
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
      openModal({ type: "deadlineReminderPreview", title: "Hasil Runner Reminder Deadline H-1" });
      await loadSnapshot();
      setDeadlineConfirmText("");
      setNotice(data.productionSent ? "Runner produksi memproses antrean sesuai gate eksplisit." : "Runner reminder selesai tanpa pengiriman produksi.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Runner reminder deadline gagal.");
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
    window.open(`/api/admin/aleta-bot/public-qa?${params.toString()}`, "_blank", "noopener,noreferrer");
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
      setNotice("Preview penerima berhasil dibuat tanpa mengirim atau mengantrekan pesan.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Preview penerima gagal dibuat.");
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
      setNotice("Log lama berhasil dihapus. Hanya log aman (non-audit) yang dihapus.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Hapus log gagal.");
    } finally {
      setIsSaving(false);
      setShowPurgeConfirm(false);
      setPurgeConfirmText("");
    }
  };

  const runAction = async (
    action: "sync-config" | "sync-ai-config" | "test-ai-runtime" | "reconnect" | "logout" | "send-test" | "test-template" | "test-query" | "test-notification" | "test-connection" | "pause-worker" | "resume-worker",
    payload?: Record<string, unknown>
  ) => {
    setIsSaving(true);
    setNotice(null);
    setPreview(null);
    try {
      const data = await requestBot<AletaBotSnapshot & { preview?: string }>("/api/admin/aleta-bot/actions", {
        method: "POST",
        body: JSON.stringify({ action, payload }),
      });
      setSnapshot(data);
      if (data.preview) setPreview(data.preview);
      void loadRuntimeDashboard();
      setNotice("Aksi ALETA Bot berhasil diproses.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Aksi gagal diproses.");
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
      setNotice("Aksi migrasi legacy berhasil diproses.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Aksi migrasi legacy gagal.");
    } finally {
      setIsSaving(false);
    }
  };

  const groupedTemplates = useMemo(() => {
    return snapshot.templates.reduce<Record<string, AletaBotTemplate[]>>((groups, template) => {
      groups[template.category] = [...(groups[template.category] ?? []), template];
      return groups;
    }, {});
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
  const legacyFallbackUsedCount = runtimeDashboard?.payload?.whatsappNumberResolver?.legacyFallbackUsedCount ?? 0;
  const legacyFallbackLastUsedAt = runtimeDashboard?.payload?.whatsappNumberResolver?.lastLegacyFallbackUsedAt ?? null;
  const legacyFallbackRecent = legacyFallbackLastUsedAt
    ? Date.now() - new Date(legacyFallbackLastUsedAt).getTime() < 24 * 60 * 60 * 1000
    : false;
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
        detail: runtimeDashboard?.payload?.worker?.lastHeartbeatAt ? `Heartbeat ${formatDateTime(runtimeDashboard.payload.worker.lastHeartbeatAt)}` : "Belum ada heartbeat",
      },
      {
        name: "AI Bridge",
        status: runtimeDashboard?.payload?.aiRuntime?.status === "error" ? "blocked" : runtimeDashboard?.payload?.aiRuntime?.status === "needs_sync" ? "warning" : "ready",
        detail: displayStatus(runtimeDashboard?.payload?.aiRuntime?.status ?? "unknown"),
      },
      {
        name: "Kesiapan Arsip",
        status: archiveReadyCount > 0 ? "ready" : "warning",
        detail: `${archiveReadyCount} legacy siap arsip`,
      },
      {
        name: "Rollback tersedia",
        status: "ready",
        detail: "State machine rollback aktif untuk migrasi legacy",
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
  const setupChecks = useMemo(() => {
    const workerReady = Boolean(runtimeDashboard?.payload?.worker?.enabled && runtimeDashboard.payload.worker.activeTimer);
    const safeWindow = runtimeDashboard?.payload?.bot?.sendingWindow;
    return [
      {
        label: "WhatsApp Gateway terhubung",
        ok: !whatsappDisconnected,
        href: "#",
        detail: displayStatus(runtimeDashboard?.payload?.whatsapp?.status ?? snapshot.whatsapp.runtimeStatus),
      },
      {
        label: "AI Bridge tersinkron",
        ok: runtimeDashboard?.payload?.aiRuntime?.status === "synced",
        href: "#",
        detail: displayStatus(runtimeDashboard?.payload?.aiRuntime?.status ?? "unknown"),
      },
      {
        label: "Koneksi database utama berhasil",
        ok: snapshot.dbConnections.some((item) => item.isActive && item.lastTestStatus === "success"),
        href: "#",
        detail: `${snapshot.dbConnections.filter((item) => item.isActive).length} koneksi aktif`,
      },
      {
        label: "Worker antrean aktif",
        ok: workerReady,
        href: "#",
        detail: runtimeDashboard?.payload?.worker?.lastHeartbeatAt
          ? `Heartbeat ${formatDateTime(runtimeDashboard.payload.worker.lastHeartbeatAt)}`
          : "Belum ada heartbeat",
      },
      {
        label: "Template aktif tersedia",
        ok: snapshot.templates.some((template) => template.editable),
        href: "#",
        detail: `${snapshot.metrics.enabledTemplates} template tersedia`,
      },
      {
        label: "Notifikasi pegawai siap simulasi/aktif",
        ok: snapshot.notifications.some((item) => item.category === "employee" && (item.isActive || item.lastStatus === "simulated")),
        href: "#",
        detail: "Mulai pilot dari notifikasi internal pegawai.",
      },
      {
        label: "Nomor WhatsApp pegawai memakai data Manajemen Akun",
        ok: employeeWhatsappTotal > 0 && employeeWhatsappMissing === 0,
        href: "#",
        detail: employeeWhatsappTotal > 0
          ? `${employeeWhatsappReadyCount}/${employeeWhatsappTotal} pegawai punya nomor WhatsApp. ${employeeWhatsappMissing} belum lengkap.`
          : "Belum ada nomor pegawai dari database. Runtime masih dapat memakai fallback legacy.",
      },
      {
        label: "Jam aman pengiriman aktif",
        ok: safeWindow?.enabled !== false,
        href: "#",
        detail: safeWindow?.enabled === false ? "Belum aktif" : `${safeWindow?.start ?? "07:30"}-${safeWindow?.end ?? "21:00"}`,
      },
      {
        label: "Tidak ada pesan gagal kritis",
        ok: snapshot.deadLetters.length === 0,
        href: "#",
        detail: `${snapshot.deadLetters.length} pesan gagal permanen`,
      },
    ];
  }, [employeeWhatsappMissing, employeeWhatsappReadyCount, employeeWhatsappTotal, runtimeDashboard, snapshot, whatsappDisconnected]);

  const pilotReadinessChecks = useMemo(() => {
    const safeWindow = runtimeDashboard?.payload?.bot?.sendingWindow;
    const queuePending = runtimeDashboard?.payload?.queue?.pending ?? 0;
    const skippedPolicy = runtimeDashboard?.payload?.registry?.skippedPolicy ?? 0;
    const partyPolicyBlocked = snapshot.notifications.some((item) => item.category === "party" && item.isActive && item.policyStatus && !item.policyStatus.canActivate);
    const publicQaActive = snapshot.publicQaIntents.some((item) => item.isActive || item.aiEnabled || item.aiAnswerEnabled);
    return [
      {
        group: "WhatsApp",
        name: "Gateway reachable dan status jelas",
        status: runtimeDashboard?.online ? (whatsappDisconnected ? "blocked" : "ready") : "blocked",
        detail: runtimeDashboard?.online ? displayStatus(snapshot.whatsapp.runtimeStatus) : runtimeDashboard?.errorMessage ?? "Runtime tidak reachable.",
        actionLabel: "Buka Status WhatsApp Gateway",
        actionHref: "#status-whatsapp",
      },
      {
        group: "WhatsApp",
        name: "Safe Sending Window aktif",
        status: safeWindow?.enabled === false ? "blocked" : "ready",
        detail: safeWindow?.enabled === false ? "Jam aman nonaktif" : `${safeWindow?.start ?? "07:30"}-${safeWindow?.end ?? "21:00"}`,
        actionLabel: "Buka Pengaturan Jam Aman",
        actionHref: "#pengaturan-bot",
      },
      {
        group: "Queue",
        name: "Worker dan antrean terkendali",
        status: runtimeDashboard?.payload?.worker?.enabled ? (queuePending > 50 ? "warning" : "ready") : "blocked",
        detail: `${queuePending} pending, ${snapshot.deadLetters.length} dead-letter.`,
      },
      {
        group: "Data",
        name: "Nomor WhatsApp pegawai lengkap",
        status: employeeWhatsappCoverage >= 0.9 && !legacyFallbackRecent ? "ready" : employeeWhatsappCoverage >= 0.7 ? "warning" : "blocked",
        detail: `${employeeWhatsappReadyCount}/${employeeWhatsappTotal} pegawai punya nomor. ${employeeWhatsappMissing} belum lengkap.`,
        actionLabel: "Lengkapi Nomor Pegawai",
        actionHref: "/admin/mapping-user-jabatan?missingWhatsapp=true",
      },
      {
        group: "Policy",
        name: "Notifikasi pihak terkunci policy",
        status: partyPolicyBlocked || skippedPolicy > 0 ? "warning" : "ready",
        detail: skippedPolicy > 0
          ? `${skippedPolicy} notifikasi dilewati runtime policy.`
          : "Simulasi, preview, dan approval menjadi syarat aktivasi pihak.",
        actionLabel: "Lihat Policy Skip",
        actionHref: "#policy-skip",
      },
      {
        group: "Policy",
        name: "Reminder deadline terkendali",
        status: reminderProductionWithoutApproval ? "blocked" : reminderMode === "production" ? "warning" : "ready",
        detail: reminderMode === "production"
          ? "Mode production aktif; pastikan approval dan blocker dipantau."
          : `Mode ${displayStatus(reminderMode)}. Default aman dan tidak mengirim produksi tanpa gate.`,
        actionLabel: "Buka Pengaturan Reminder",
        actionHref: "#reminder-deadline",
      },
      {
        group: "Public Q&A",
        name: "Human review terpantau",
        status: publicQaNeedsReviewCount > 20 ? "blocked" : publicQaNeedsReviewCount > 0 ? "warning" : runtimeDashboard?.payload?.aiRuntime?.status === "needs_sync" && publicQaActive ? "blocked" : "ready",
        detail: publicQaNeedsReviewCount > 0
          ? `${publicQaNeedsReviewCount} pertanyaan perlu ditinjau.`
          : runtimeDashboard?.payload?.aiRuntime?.status === "needs_sync" && publicQaActive
            ? "AI Public Q&A perlu sinkronisasi."
            : "Tidak ada pertanyaan publik pending review.",
        actionLabel: "Tinjau Pertanyaan Publik",
        actionHref: "#public-qa",
      },
    ] as const;
  }, [
    employeeWhatsappCoverage,
    employeeWhatsappMissing,
    employeeWhatsappReadyCount,
    employeeWhatsappTotal,
    publicQaNeedsReviewCount,
    reminderMode,
    reminderProductionWithoutApproval,
    runtimeDashboard,
    legacyFallbackRecent,
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
        title: "Session WhatsApp sedang dipakai proses lain",
        detail: "Tutup proses Chrome/Puppeteer lama atau restart backend ALETA Bot, lalu klik Refresh Status. Jangan hapus session WhatsApp kecuali benar-benar diperlukan.",
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
        detail: "Sync AI ke ALETA Bot dari Mode Lanjutan sebelum mengandalkan Public Q&A.",
        tone: "warning",
      });
    }
    if (snapshot.deadLetters.length > 0) {
      alerts.push({
        title: "Ada pesan gagal permanen",
        detail: `${snapshot.deadLetters.length} pesan perlu ditinjau sebelum retry.`,
        tone: "warning",
      });
    }
    if (publicQaNeedsReviewCount > 0) {
      alerts.push({
        title: "Pertanyaan publik perlu tinjauan",
        detail: `${publicQaNeedsReviewCount} pertanyaan masuk antrean human review.`,
        tone: "warning",
      });
    }
    if (employeeWhatsappCoverage < 0.8 || legacyFallbackUsedCount > 0) {
      alerts.push({
        title: "Nomor pegawai belum lengkap",
        detail: legacyFallbackUsedCount > 0
          ? `Runtime memakai fallback legacy ${legacyFallbackUsedCount} kali. Lengkapi nomor di Manajemen Akun.`
          : "Sebagian mapping WhatsApp masih bisa jatuh ke fallback legacy. Lengkapi nomor WhatsApp pegawai prioritas sebelum pilot WhatsApp.",
        tone: "warning",
      });
    }
    if (runtimeDashboard?.payload?.bot?.sendingWindow?.enabled === false) {
      alerts.push({
        title: "Jam aman pengiriman nonaktif",
        detail: "Aktifkan safe sending window agar pesan normal tidak terkirim di luar jam kerja.",
        tone: "muted",
      });
    }
    if ((runtimeDashboard?.payload?.registry?.skippedPolicy ?? 0) > 0 || policySkipToday > 0) {
      const reasons = runtimeDashboard?.payload?.registry?.policySkipStats?.reasons ?? Object.fromEntries(snapshot.policySkipSummary.topReasons.map((item) => [item.reason, item.count]));
      const reasonText = Object.entries(reasons).slice(0, 3).map(([key, count]) => `${key}: ${count}`).join(", ");
      alerts.push({
        title: "Notifikasi pihak ditahan policy",
        detail: `${runtimeDashboard?.payload?.registry?.skippedPolicy ?? policySkipToday} notifikasi pihak dilewati runtime/log karena belum memenuhi policy.${reasonText ? ` Alasan: ${reasonText}.` : ""}`,
        tone: "warning",
      });
    }
    if (snapshot.settings.deadlineReminderLastRunAt && snapshot.settings.deadlineReminderMode !== "production") {
      alerts.push({
        title: "Reminder deadline masih aman",
        detail: `Run terakhir ${formatDateTime(snapshot.settings.deadlineReminderLastRunAt)} berstatus ${displayStatus(snapshot.settings.deadlineReminderLastStatus)} dalam mode ${displayStatus(snapshot.settings.deadlineReminderMode)}.`,
        tone: "warning",
      });
    }
    return alerts.slice(0, 6);
  }, [employeeWhatsappCoverage, legacyFallbackUsedCount, policySkipToday, publicQaNeedsReviewCount, runtimeDashboard, snapshot, whatsappBrowserLocked, whatsappDisconnected]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Super Admin Only"
        title="ALETA Bot"
        description="Modul internal untuk mengelola bot WhatsApp notifikasi perkara, koneksi WhatsApp Web, template pesan, query, log, dan pengujian aman dari portal utama ALETA."
        actions={
          <>
            <Button variant={showAdvancedMode ? "default" : "outline"} size="sm" onClick={toggleAdvancedMode}>
              {showAdvancedMode ? "Mode Lanjutan" : "Mode Sederhana"}
            </Button>
            <Button variant="outline" onClick={() => void loadSnapshot()} disabled={isLoading || isSaving}>
              <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button onClick={() => void runAction("sync-config")} disabled={isSaving}>
              <CheckCircle2 className="h-4 w-4" />
              Sync Config
            </Button>
          </>
        }
      />

      {notice ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-sm text-foreground">{notice}</CardContent>
        </Card>
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
            <p className="font-semibold">Session WhatsApp sedang dipakai proses browser lain.</p>
            <p>
              Tutup proses Chrome/Puppeteer lama atau restart backend ALETA Bot, lalu klik Refresh Status.
              Jangan hapus session WhatsApp kecuali benar-benar diperlukan.
            </p>
          </CardContent>
        </Card>
      ) : whatsappDisconnected ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="space-y-1 p-4 text-sm text-amber-900 dark:text-amber-200">
            <p className="font-semibold">WhatsApp Bot belum terhubung.</p>
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
            <CardDescription>Alert operasional ringan. Panel ini tidak mengirim WhatsApp dan hanya membantu admin menentukan prioritas pengecekan.</CardDescription>
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
        <StatusCard label="Status Bot" value={snapshot.runtimeState} icon={Bot} />
        <StatusCard label="WhatsApp" value={snapshot.whatsapp.runtimeStatus} icon={Smartphone} />
        <StatusCard label="Terkirim Hari Ini" value={String(snapshot.metrics.sentToday)} icon={Send} />
        <StatusCard label="Gagal Hari Ini" value={String(snapshot.metrics.failedToday)} icon={TerminalSquare} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex max-w-full flex-wrap items-center justify-start gap-x-1 gap-y-1">
          {/* Utama — selalu tampil */}
          <TabsTrigger value="dashboard">Ringkasan</TabsTrigger>
          <TabsTrigger value="connection">WhatsApp</TabsTrigger>
          <TabsTrigger value="notifications">Notifikasi</TabsTrigger>
          <TabsTrigger value="queue-recovery">Antrian & Pesan Gagal</TabsTrigger>
          <TabsTrigger value="logs">Log Aktivitas</TabsTrigger>
          <TabsTrigger value="public-qa">Pertanyaan Publik</TabsTrigger>
          <TabsTrigger value="approvals">Persetujuan</TabsTrigger>
          {/* Konten Bot — hanya Mode Lanjutan */}
          {showAdvancedMode ? (
            <span role="presentation" className="mx-1 self-center text-[10px] font-semibold text-muted-foreground/40 select-none">│</span>
          ) : null}
          {showAdvancedMode ? <TabsTrigger value="settings">Pengaturan</TabsTrigger> : null}
          {showAdvancedMode ? <TabsTrigger value="templates">Template</TabsTrigger> : null}
          {showAdvancedMode ? <TabsTrigger value="migration">Migrasi Legacy</TabsTrigger> : null}
          {/* Konfigurasi — hanya Mode Lanjutan */}
          {showAdvancedMode ? (
            <span role="presentation" className="mx-1 self-center text-[10px] font-semibold text-muted-foreground/40 select-none">│</span>
          ) : null}
          <TabsTrigger value="database">Koneksi Database</TabsTrigger>
          {showAdvancedMode ? <TabsTrigger value="queries">Kueri Terdaftar</TabsTrigger> : null}
          {/* Developer — hanya Mode Lanjutan */}
          {showAdvancedMode ? <TabsTrigger value="manual-test">Uji Coba</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="dashboard">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <HealthSummaryCard
              label="WhatsApp"
              status={snapshot.whatsapp.runtimeStatus === "connected" ? "ok" : ["waiting_qr", "initializing", "qr_needed"].includes(snapshot.whatsapp.runtimeStatus) ? "warning" : "error"}
              value={displayStatus(snapshot.whatsapp.runtimeStatus)}
            />
            <HealthSummaryCard
              label="Worker / Antrean"
              status={runtimeDashboard?.payload?.worker?.enabled ? (runtimeDashboard.payload.worker.activeTimer ? "ok" : "warning") : "error"}
              value={runtimeDashboard?.payload?.worker?.enabled ? `${runtimeDashboard?.payload?.queue?.pending ?? 0} pending` : "Nonaktif"}
            />
            <HealthSummaryCard
              label="AI"
              status={aiSummary.level}
              value={aiSummary.label}
            />
            <HealthSummaryCard
              label="Persetujuan Pending"
              status={snapshot.approvalRequests.filter((r) => r.status === "pending").length > 0 ? "warning" : "ok"}
              value={`${snapshot.approvalRequests.filter((r) => r.status === "pending").length} tertunda`}
            />
            <HealthSummaryCard
              label="Pesan Gagal"
              status={snapshot.deadLetters.length > 0 ? "warning" : "ok"}
              value={`${snapshot.deadLetters.length} dead letter`}
            />
          </div>
          {!showAdvancedMode ? (
            <div className="mb-4 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              Beberapa pengaturan teknis disembunyikan. Aktifkan Mode Lanjutan untuk mengelola AI, kueri, migrasi, dan uji coba manual.
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-3">
            <InfoCard title="Nomor Admin" value={snapshot.settings.adminWhatsappNumber || "Belum diatur"} hint="Dipakai sebagai admin/kontrol bot. Disimpan di database portal dan bridge config." />
            <InfoCard
              title="Nomor Terhubung"
              value={snapshot.whatsapp.phoneNumber || "Belum disetel"}
              hint={showAdvancedMode ? `Session: ${snapshot.whatsapp.sessionName}` : "Nomor WhatsApp yang sedang atau akan dipakai bot."}
            />
            <InfoCard title="Notifikasi Terakhir" value={snapshot.metrics.lastNotificationAt ? formatDateTime(snapshot.metrics.lastNotificationAt) : "Belum ada"} hint={`${snapshot.metrics.activeJobs} job aktif, ${snapshot.metrics.enabledTemplates} template tersedia.`} />
          </div>
          {showAdvancedMode ? (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Runtime `aleta_bot`</CardTitle>
              <CardDescription>Status read-only dari worker, queue DB, registry pilot, dan koneksi WhatsApp runtime Node.js.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-4">
              <InfoCard
                title="Runtime"
                value={runtimeDashboard?.online ? "online" : "offline"}
                hint={runtimeDashboard?.errorMessage ?? `HTTP ${runtimeDashboard?.statusCode ?? "-"}`}
              />
              <InfoCard
                title="WhatsApp Runtime"
                value={runtimeDashboard?.payload?.whatsapp?.status ?? "unknown"}
                hint={runtimeDashboard?.payload?.whatsapp?.lastReadyAt ? `Ready: ${formatDateTime(runtimeDashboard.payload.whatsapp.lastReadyAt)}` : runtimeDashboard?.payload?.whatsapp?.lastErrorMessage ?? "Belum ada status runtime."}
              />
              <InfoCard
                title="Umur Sesi WA"
                value={runtimeDashboard?.payload?.whatsapp?.sessionAgeHours != null ? `${runtimeDashboard.payload.whatsapp.sessionAgeHours} jam` : "Belum aktif"}
                hint={runtimeDashboard?.payload?.whatsapp?.sessionStartedAt ? `Aktif sejak ${formatDateTime(runtimeDashboard.payload.whatsapp.sessionStartedAt)}` : "Sesi aktif dihitung sejak WhatsApp ready."}
              />
              <InfoCard
                title="Kirim Terakhir"
                value={runtimeDashboard?.payload?.whatsapp?.lastMessageSentAt ? formatDateTime(runtimeDashboard.payload.whatsapp.lastMessageSentAt) : "Belum ada"}
                hint={`Auth failure: ${runtimeDashboard?.payload?.whatsapp?.authFailureCount ?? 0}`}
              />
              <InfoCard
                title="Antrean Pesan"
                value={`${runtimeDashboard?.payload?.queue?.pending ?? 0} pending`}
                hint={`${runtimeDashboard?.payload?.queue?.failed ?? 0} failed, ${runtimeDashboard?.payload?.queue?.sent ?? 0} sent.`}
              />
              <InfoCard
                title="Pemroses Antrean"
                value={runtimeDashboard?.payload?.worker?.enabled ? "enabled" : "disabled"}
                hint={runtimeDashboard?.payload?.worker?.lastHeartbeatAt ? `Heartbeat: ${formatDateTime(runtimeDashboard.payload.worker.lastHeartbeatAt)}` : runtimeDashboard?.payload?.worker?.lastError ?? "Belum ada heartbeat."}
              />
              <InfoCard
                title="DB Schema"
                value={runtimeDashboard?.payload?.db?.schemaReady ? "ready" : "not ready"}
                hint={runtimeDashboard?.payload?.db?.lastError || "Status schema runtime ALETA Bot."}
              />
              <InfoCard
                title="Registry Pilot"
                value={`${runtimeDashboard?.payload?.registry?.total ?? 0} notifikasi`}
                hint={`${runtimeDashboard?.payload?.registry?.dryRun ?? 0} dry-run, ${runtimeDashboard?.payload?.registry?.requiresApproval ?? 0} butuh approval.`}
              />
              <InfoCard
                title="Sumber Data SQL"
                value={`${snapshot.dbConnections.filter((item) => item.isActive).length} aktif`}
                hint={`${snapshot.dbConnections.filter((item) => item.lastTestStatus === "failed").length} gagal test, ${snapshot.dbConnections.filter((item) => item.legacySource).length} legacy fallback.`}
              />
              <InfoCard
                title="Pertanyaan Pihak"
                value={`${snapshot.publicQaIntents.filter((item) => item.isActive).length} aktif`}
                hint={`${snapshot.publicQaIntents.filter((item) => item.aiEnabled).length} AI matcher, ${runtimeDashboard?.payload?.publicQa?.stats?.fallbackToday ?? 0} fallback hari ini.`}
              />
              <InfoCard
                title="Pesan Hari Ini"
                value={`${runtimeDashboard?.payload?.messageStatsToday?.sent ?? 0} sent`}
                hint={`${runtimeDashboard?.payload?.messageStatsToday?.failed ?? 0} failed, ${runtimeDashboard?.payload?.messageStatsToday?.skipped ?? 0} skipped.`}
              />
              <InfoCard
                title="Jam Aman Kirim"
                value={runtimeDashboard?.payload?.bot?.sendingWindow?.enabled === false ? "nonaktif" : runtimeDashboard?.payload?.bot?.sendingWindow?.inside === false ? "di luar jam" : "aktif"}
                hint={runtimeDashboard?.payload?.bot?.sendingWindow?.message ?? `${runtimeDashboard?.payload?.bot?.sendingWindow?.start ?? "07:30"}-${runtimeDashboard?.payload?.bot?.sendingWindow?.end ?? "21:00"}`}
              />
              <InfoCard
                title="Error Sistem"
                value={`${runtimeDashboard?.payload?.systemStatsToday?.error ?? 0} error`}
                hint={`${runtimeDashboard?.payload?.systemStatsToday?.critical ?? 0} critical hari ini.`}
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
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Konfigurasi AI Bridge</CardTitle>
              <CardDescription>Provider, model, toggle Public Q&A, dan hasil sync dari modul AI portal ke runtime `aleta_bot`.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-4">
                <InfoCard
                  title="Bridge"
                  value={runtimeDashboard?.payload?.aiRuntime?.status ?? runtimeDashboard?.payload?.aiRuntime?.lastSyncStatus ?? "unknown"}
                  hint={runtimeDashboard?.payload?.aiRuntime?.message || runtimeDashboard?.payload?.aiRuntime?.lastSyncError || `Source: ${runtimeDashboard?.payload?.aiRuntime?.configSource ?? "-"}`}
                />
                <InfoCard
                  title="Provider"
                  value={runtimeDashboard?.payload?.aiRuntime?.provider ?? "belum sinkron"}
                  hint={`Model: ${runtimeDashboard?.payload?.aiRuntime?.model ?? "-"}`}
                />
                <InfoCard
                  title="Public Q&A AI"
                  value={runtimeDashboard?.payload?.aiRuntime?.publicQaEnabled ? "enabled" : "disabled"}
                  hint={runtimeDashboard?.payload?.aiRuntime?.publicQaAiAnswerEnabled ? "AI answer aktif sesuai runtime config." : "AI answer runtime nonaktif."}
                />
                <InfoCard
                  title="API Key"
                  value={runtimeDashboard?.payload?.aiRuntime?.apiKeyConfigured ? "configured" : "not configured"}
                  hint={runtimeDashboard?.payload?.aiRuntime?.apiKeyMasked ? `Masked: ${runtimeDashboard.payload.aiRuntime.apiKeyMasked}` : "Nilai key tidak pernah ditampilkan."}
                />
                <InfoCard
                  title="Last Sync"
                  value={runtimeDashboard?.payload?.aiRuntime?.syncedAt ? formatDateTime(runtimeDashboard.payload.aiRuntime.syncedAt) : "Belum pernah"}
                  hint="Sync mengambil provider aktif dari Pengaturan AI portal."
                />
                <InfoCard
                  title="Last Test"
                  value={runtimeDashboard?.payload?.aiRuntime?.lastTestStatus ?? "idle"}
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
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void runAction("sync-ai-config")} disabled={isSaving}>
                  <RefreshCcw className="h-4 w-4" />
                  Sync AI ke ALETA Bot
                </Button>
                <Button variant="outline" onClick={() => void runAction("test-ai-runtime")} disabled={isSaving}>
                  <Play className="h-4 w-4" />
                  Test AI Runtime
                </Button>
              </div>
            </CardContent>
          </Card>
          ) : null}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Langkah Setup ALETA Bot</CardTitle>
              <CardDescription>Checklist operasional untuk memastikan pilot berjalan aman tanpa aksi berisiko langsung dari kartu ini.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {setupChecks.map((check) => (
                <div key={check.label} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{check.label}</p>
                    <Badge variant={check.ok ? "success" : "warning"}>{check.ok ? "Selesai" : "Perlu dicek"}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{check.detail}</p>
                </div>
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
                      Checklist lintas WhatsApp, antrean, data, policy, dan Public Q&A. Status Siap tidak muncul jika ada blocker kritis.
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
                      Jalankan Smoke Test
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={exportPilotReadinessCsv}>
                      <Download className="h-4 w-4" />
                      Export Readiness
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
                <CardDescription>Dipakai untuk mengurangi ketergantungan pada mapping legacy di runtime.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{employeeWhatsappReadyCount} dari {employeeWhatsappTotal} pegawai punya nomor</p>
                    <Badge variant={employeeWhatsappCoverage >= 0.9 ? "success" : employeeWhatsappCoverage >= 0.7 ? "warning" : "danger"}>
                      {snapshot.whatsappNumberCompleteness.coveragePercent}%
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {employeeWhatsappMissing} pegawai belum memiliki nomor. Lengkapi dari Manajemen Akun agar fallback legacy bisa dihapus bertahap.
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
                  Simulasikan Reminder Deadline H-1
                </Button>
                <Button variant="outline" onClick={() => { window.location.href = "/admin/mapping-user-jabatan?missingWhatsapp=true"; }}>
                  Lengkapi Nomor di Manajemen Akun
                </Button>
                <p className="text-xs leading-5 text-muted-foreground">
                  Simulasi ini hanya membuat log dry-run dan preview. Tidak ada WhatsApp sungguhan yang dikirim.
                </p>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-4">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Operational Smoke Test</CardTitle>
                  <CardDescription>Pemeriksaan baca-saja untuk status WhatsApp, worker, policy, AI, dan registry database. Tidak scan QR, tidak enqueue, dan tidak kirim WhatsApp.</CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={() => void runOperationalSmokeTest()} disabled={isSaving}>
                  <Play className="h-4 w-4" />
                  Jalankan Smoke Test
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
                <p className="text-sm text-muted-foreground">Belum ada smoke test pada sesi ini. Jalankan saat ingin memeriksa kesiapan operasional tanpa aksi berisiko.</p>
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
                <InfoCard title="Success Rate" value={`${messageAnalytics.successRate}%`} hint={`${messageAnalytics.simulated} simulasi tercatat`} />
                <InfoCard title="Sumber Teratas" value={messageAnalytics.topSource?.[0] ? displayStatus(messageAnalytics.topSource[0]) : "-"} hint={messageAnalytics.topSource ? `${messageAnalytics.topSource[1]} pesan` : "Belum ada data hari ini"} />
                <InfoCard title="Policy Skip" value={String(policySkipToday)} hint="Skip tidak dianggap failed dan tidak mengirim WhatsApp." />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Analitik Public Q&A</CardTitle>
                <CardDescription>Tren ringkas pertanyaan publik dan tindak lanjut manusia.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <InfoCard title="7 Hari Terakhir" value={String(publicQaAnalytics.totalLast7Days)} hint="Jumlah pertanyaan/log Public Q&A." />
                <InfoCard title="Fallback Rate" value={`${publicQaAnalytics.fallbackRate}%`} hint="Fallback perlu dipantau agar intent makin matang." />
                <InfoCard title="Perlu Review" value={String(publicQaAnalytics.pending)} hint="Masuk antrean human review admin." />
                <InfoCard title="Draft Intent" value={String(publicQaAnalytics.converted)} hint="Pertanyaan yang sudah dikonversi menjadi draft intent." />
              </CardContent>
            </Card>
            <Card id="policy-skip">
              <CardHeader>
                <CardTitle>Policy Skip</CardTitle>
                <CardDescription>Skip policy tersimpan di log terstruktur agar insight tidak hilang setelah runtime restart.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <InfoCard title="Hari Ini" value={String(policySkipToday)} hint="Dibaca dari runtime/log policy skip." />
                  <InfoCard title="Total" value={String(policySkipAllTime)} hint={runtimePolicySkipStats?.lastSkippedAt || snapshot.policySkipSummary.lastSkippedAt ? `Terakhir ${formatDateTime(runtimePolicySkipStats?.lastSkippedAt || snapshot.policySkipSummary.lastSkippedAt || "")}` : "Belum ada skip."} />
                  <InfoCard title="Alasan Utama" value={(runtimePolicySkipStats?.reasons && Object.keys(runtimePolicySkipStats.reasons)[0]) || snapshot.policySkipSummary.topReasons[0]?.reason || "-"} hint="Contoh: belum_dry_run, belum_preview, belum_approval." />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <NativeSelect value={policySkipReasonFilter} onChange={(event) => setPolicySkipReasonFilter(event.target.value)} className="max-w-xs">
                    <option value="all">Semua alasan</option>
                    <option value="belum_dry_run">Belum dry-run</option>
                    <option value="belum_preview">Belum preview</option>
                    <option value="belum_approval">Belum approval</option>
                    <option value="safe_sending_window">Safe sending window</option>
                    <option value="recipient_invalid">Recipient invalid</option>
                    <option value="policy_blocked">Policy blocked</option>
                  </NativeSelect>
                  <Button variant="outline" onClick={exportPolicySkipCsv}>
                    <Download className="h-4 w-4" />
                    Export CSV Policy Skip
                  </Button>
                </div>
                <div className="space-y-2">
                  {(runtimePolicySkipStats?.topNotifications ?? snapshot.policySkipSummary.topNotifications).slice(0, 4).map((item) => (
                    <div key={item.notificationKey} className="flex items-center justify-between rounded border border-border p-2 text-xs">
                      <span className="font-medium text-foreground">{item.notificationKey || "notification"}</span>
                      <Badge variant="warning">{item.count} skip</Badge>
                    </div>
                  ))}
                  {(runtimePolicySkipStats?.topNotifications ?? snapshot.policySkipSummary.topNotifications).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada policy skip tercatat.</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            <Card id="reminder-deadline">
              <CardHeader>
                <CardTitle>Reminder Deadline Disposisi</CardTitle>
                <CardDescription>Jalur produksi tersedia, tetapi default tetap aman dan membutuhkan approval/konfirmasi eksplisit.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoCard title="Mode" value={displayStatus(snapshot.settings.deadlineReminderMode)} hint={snapshot.settings.deadlineReminderEnabled ? "Enabled" : "Tidak aktif produksi."} />
                  <InfoCard title="Approval" value={snapshot.settings.deadlineReminderApprovedAt ? "Ada" : "Belum ada"} hint={snapshot.settings.deadlineReminderApprovedAt ? formatDateTime(snapshot.settings.deadlineReminderApprovedAt) : "Production/pilot butuh Super Admin."} />
                  <InfoCard title="Run Terakhir" value={snapshot.settings.deadlineReminderLastRunAt ? formatDateTime(snapshot.settings.deadlineReminderLastRunAt) : "Belum pernah"} hint={snapshot.settings.deadlineReminderLastMessage || "Belum ada hasil runner."} />
                  <InfoCard title="Status Terakhir" value={displayStatus(snapshot.settings.deadlineReminderLastStatus)} hint="Dry-run tidak mengirim WhatsApp real." />
                  <InfoCard title="Scheduler" value={snapshot.settings.deadlineReminderSchedulerEnabled ? "Aktif" : "Nonaktif"} hint={`${displayStatus(snapshot.settings.deadlineReminderSchedulerMode)} pukul ${snapshot.settings.deadlineReminderSchedulerTime}`} />
                  <InfoCard title="Kill Switch" value={snapshot.settings.deadlineReminderKillSwitch ? "Aktif" : "Normal"} hint={snapshot.settings.deadlineReminderKillSwitch ? "Semua runner reminder diblokir." : "Runner mengikuti mode dan approval."} />
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Whitelist User ID Pilot" value={deadlinePilotUserIdsText} onChange={setDeadlinePilotUserIdsText} placeholder="user-a, user-b" />
                    <Field label="Whitelist Role Pilot" value={deadlinePilotRoleIdsText} onChange={setDeadlinePilotRoleIdsText} placeholder="hakim, panitera" />
                    <Field label="Whitelist Jabatan/Posisi Pilot" value={deadlinePilotPositionIdsText} onChange={setDeadlinePilotPositionIdsText} placeholder="position-id atau nama jabatan" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Mode pilot hanya memproses penerima internal yang cocok dengan whitelist. Pihak eksternal tidak masuk whitelist reminder ini.</p>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_180px]">
                    <NativeSelect
                      value={snapshot.settings.deadlineReminderSchedulerMode}
                      onChange={(event) => void updateDeadlineReminderAdvancedSettings({ schedulerMode: event.target.value as AletaBotSnapshot["settings"]["deadlineReminderSchedulerMode"] })}
                    >
                      <option value="dry_run">Scheduler Dry-run</option>
                      <option value="pilot">Scheduler Pilot</option>
                      <option value="production">Scheduler Produksi</option>
                      <option value="disabled">Scheduler Disabled</option>
                    </NativeSelect>
                    <Input value={deadlineSchedulerTime} onChange={(event) => setDeadlineSchedulerTime(event.target.value)} placeholder="08:00:00" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void updateDeadlineReminderAdvancedSettings()} disabled={isSaving}>
                      Simpan Whitelist/Jadwal
                    </Button>
                    <Button variant="outline" onClick={() => void updateDeadlineReminderAdvancedSettings({ schedulerEnabled: true, schedulerMode: "dry_run" })} disabled={isSaving}>
                      Aktifkan Scheduler Dry-run
                    </Button>
                    <Button variant="outline" onClick={() => void updateDeadlineReminderAdvancedSettings({ schedulerEnabled: false, schedulerMode: "disabled" })} disabled={isSaving}>
                      Nonaktifkan Scheduler
                    </Button>
                    <Button
                      variant={snapshot.settings.deadlineReminderKillSwitch ? "outline" : "destructive"}
                      onClick={() => void updateDeadlineReminderAdvancedSettings({ killSwitch: !snapshot.settings.deadlineReminderKillSwitch, confirmText: snapshot.settings.deadlineReminderKillSwitch ? deadlineConfirmText : "EMERGENCY STOP" })}
                      disabled={isSaving || (!snapshot.settings.deadlineReminderKillSwitch && deadlineConfirmText !== "EMERGENCY STOP")}
                    >
                      {snapshot.settings.deadlineReminderKillSwitch ? "Matikan Emergency Stop" : "Emergency Stop Reminder"}
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
                    Jalankan Dry-run Sekarang
                  </Button>
                  <Button variant="outline" onClick={() => void updateDeadlineReminderMode("dry_run")} disabled={isSaving}>
                    Mode Dry-run
                  </Button>
                  <Button variant="outline" onClick={() => void updateDeadlineReminderMode("pilot")} disabled={isSaving || deadlineConfirmText !== "AKTIFKAN PILOT"}>
                    Aktifkan Pilot
                  </Button>
                  <Button variant="outline" onClick={() => void updateDeadlineReminderMode("production")} disabled={isSaving || deadlineConfirmText !== "AKTIFKAN REMINDER"}>
                    Aktifkan Produksi
                  </Button>
                  <Button variant="destructive" onClick={() => void updateDeadlineReminderMode("disabled")} disabled={isSaving}>
                    Nonaktifkan
                  </Button>
                  <Button onClick={() => void runDeadlineReminderControlled()} disabled={isSaving || deadlineConfirmText !== "JALANKAN REMINDER"}>
                    Jalankan Runner Terkontrol
                  </Button>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Tombol produksi tetap role-guarded. Selama tidak mengetik konfirmasi, runner hanya melaporkan blocker dan tidak mengirim WhatsApp.
                </p>
                <div className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Run History Reminder</p>
                      <p className="text-xs text-muted-foreground">5 run terakhir, termasuk dry-run scheduler dan blocker. Nomor/isi pesan penuh tidak disimpan.</p>
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
                          {formatDateTime(run.startedAt)} · kandidat {run.totalCandidates} · dry-run {run.dryRunCreated} · terkirim {run.sentCount} · skip {run.skippedCount} · error {run.errorCount}
                        </p>
                      </div>
                    ))}
                    {snapshot.deadlineReminderRuns.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada run history reminder.</p>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Kesiapan Pilot</CardTitle>
              <CardDescription>Checklist terakhir sebelum pilot produksi terbatas. Status Siap hanya diberikan jika tidak ada blocker runtime.</CardDescription>
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
                      : "Ada blocker yang harus diperbaiki sebelum pilot."}
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
        </TabsContent>

        <TabsContent value="connection" id="status-whatsapp">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Koneksi WhatsApp Web</CardTitle>
                <CardDescription>WhatsApp Runtime: ALETA Bot Gateway. Portal hanya menjadi control panel, bukan client WhatsApp kedua.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoCard title="Runtime" value={displayStatus(snapshot.whatsapp.runtimeStatus)} hint={snapshot.whatsapp.lastErrorMessage ?? "Tidak ada error runtime tersimpan."} />
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
                      <p className="font-medium">Session WhatsApp sedang dipakai proses browser lain.</p>
                      <p>Tutup proses Chrome/Puppeteer lama atau restart backend ALETA Bot, lalu klik Refresh Status. Jangan hapus folder session.</p>
                    </div>
                  ) : snapshot.whatsapp.runtimeStatus === "initializing" ? (
                    <span className="text-muted-foreground">Menyiapkan Koneksi — menunggu QR dari ALETA Bot Gateway...</span>
                  ) : (
                    <span className="text-muted-foreground">Tidak Terhubung. Klik <strong>Connect WhatsApp Gateway</strong> untuk memulai sesi tanpa reset.</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void runAction("reconnect")} disabled={isSaving}>
                    <RefreshCcw className="h-4 w-4" />
                    Connect WhatsApp Gateway
                  </Button>
                  <Button variant="outline" onClick={() => void loadSnapshot()} disabled={isSaving || isLoading}>
                    <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    Refresh QR WhatsApp
                  </Button>
                  <Button variant="outline" onClick={() => void runAction("test-connection")} disabled={isSaving}>
                    <Play className="h-4 w-4" />
                    Test Koneksi
                  </Button>
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
                </div>
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
                      ? "WhatsApp sudah connected. QR tidak diperlukan."
                      : snapshot.whatsapp.runtimeStatus === "browser_locked"
                        ? "Session WhatsApp terkunci oleh proses browser lain. Tutup proses lama atau restart backend, lalu refresh status."
                      : snapshot.whatsapp.runtimeStatus === "initializing"
                        ? "Menunggu QR dari ALETA Bot Gateway..."
                        : "QR belum tersedia. Klik Connect WhatsApp Gateway, lalu tunggu beberapa detik."}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" id="pengaturan-bot">
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Bot</CardTitle>
              <CardDescription>Perubahan disimpan di database portal dan ditulis ke file bridge untuk runtime `aleta_bot`.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-3">
                <InfoCard title="Bot" value={snapshot.settings.botEnabled ? "aktif" : "nonaktif"} hint={snapshot.settings.dryRunEnabled ? "Dry-run aktif" : "Mode kirim produksi"} />
                <InfoCard title="Notifikasi" value={snapshot.settings.notificationsEnabled ? "aktif" : "nonaktif"} hint={`Delay ${snapshot.settings.messageDelayMs} ms, retry ${snapshot.settings.retryLimit}x`} />
                <InfoCard title="Admin" value={snapshot.settings.adminWhatsappNumber || "Belum diatur"} hint={`Updated: ${formatDateTime(snapshot.settings.updatedAt)}`} />
              </div>
              <Button onClick={() => openModal({ type: "settings", title: "Edit Pengaturan Bot" })} disabled={isSaving}>
                <Settings2 className="h-4 w-4" />
                Edit Pengaturan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid gap-4">
            {Object.entries(groupedTemplates).map(([category, templates]) => (
              <Card key={category}>
                <CardHeader>
                  <CardTitle className="capitalize">{category}</CardTitle>
                  <CardDescription>Template berasal dari pola pesan di `app.js`, `notifikasi.js`, dan `formatter.js`.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-2">
                  {templates.map((template) => (
                    <div key={template.id} className="space-y-3 rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{template.title}</p>
                          <p className="text-xs text-muted-foreground">{template.placeholders.join(", ") || "Tanpa placeholder"}</p>
                        </div>
                        <Badge variant={template.editable ? "success" : "muted"}>{template.editable ? "Editable" : "Locked"}</Badge>
                      </div>
                      <pre className="max-h-52 overflow-auto rounded-xl border border-border bg-muted/30 p-3 text-xs leading-5 whitespace-pre-wrap">{templateDraft[template.id] ?? template.body}</pre>
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => openModal({ type: "template", title: `Edit Template ${template.title}`, template })} disabled={isSaving || !template.editable}>
                          Edit Template
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Manajemen Notifikasi</CardTitle>
                <CardDescription>Notifikasi Pegawai mengambil nomor dari user portal. Notifikasi Pihak mengambil nomor dari kolom hasil query perkara/SIPP.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => { setNotificationForm(makeEmptyNotificationForm(snapshot, "employee")); openModal({ type: "notification", title: "Tambah Notifikasi Pegawai" }); }} disabled={isSaving}>Tambah Pegawai</Button>
                  <Button variant="outline" onClick={() => { setNotificationForm(makeEmptyNotificationForm(snapshot, "party")); openModal({ type: "notification", title: "Tambah Notifikasi Pihak" }); }} disabled={isSaving}>Tambah Pihak</Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Tampilkan:</span>
                  {(["all", "employee", "party"] as const).map((f) => (
                    <button
                      key={f}
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

        <TabsContent value="queries">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Query & Data Source</CardTitle>
                <CardDescription>Query baru dari UI hanya mengizinkan SELECT atau referensi legacy. Test query dibatasi preview aman.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button onClick={() => { setQueryForm(makeEmptyQueryForm("employee")); openModal({ type: "query", title: "Tambah Query Pegawai" }); }} disabled={isSaving}>Tambah Query Pegawai</Button>
                <Button variant="outline" onClick={() => { setQueryForm(makeEmptyQueryForm("party")); openModal({ type: "query", title: "Tambah Query Pihak" }); }} disabled={isSaving}>Tambah Query Pihak</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daftar Query ALETA Bot</CardTitle>
                <CardDescription>Dipetakan dari query.js, notifikasi.js, dan app.js. Query produksi legacy tidak dieksekusi langsung dari UI.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-hidden">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <tr>
                      <th className="w-[17%] py-3 pr-3">Nama</th>
                      <th className="w-[8%] py-3 pr-3">Kategori</th>
                      <th className="w-[12%] py-3 pr-3">Dipakai Oleh</th>
                      <th className="w-[10%] py-3 pr-3">Sumber SQL</th>
                      <th className="w-[18%] py-3 pr-3">SQL Preview</th>
                      <th className="w-[9%] py-3 pr-3">Kolom</th>
                      <th className="w-[8%] py-3 pr-3">Status</th>
                      <th className="w-[8%] py-3 pr-3">Test</th>
                      <th className="w-[10%] py-3 pr-3">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.queries.map((query) => (
                      <tr key={query.id} className="border-b border-border/70 align-top">
                        <td className="min-w-0 break-words py-4 pr-3">
                          <p className="font-medium text-foreground">{query.name}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{query.description}</p>
                        </td>
                        <td className="min-w-0 break-words py-4 pr-3"><Badge variant="outline">{query.category}</Badge></td>
                        <td className="min-w-0 break-words py-4 pr-3 text-muted-foreground">{query.usedByNotifications.join(", ") || "-"}</td>
                        <td className="min-w-0 break-words py-4 pr-3"><Badge variant="outline">{query.connectionKey}</Badge></td>
                        <td className="min-w-0 break-words py-4 pr-3"><code className="line-clamp-3 break-words text-xs text-muted-foreground">{query.sqlText}</code></td>
                        <td className="min-w-0 break-words py-4 pr-3">
                          <p>{query.outputColumns.length} kolom</p>
                          <p className="text-xs text-muted-foreground">{query.recipientColumn || "tanpa kolom nomor"}</p>
                        </td>
                        <td className="min-w-0 break-words py-4 pr-3"><Badge variant={query.isActive ? "success" : "muted"}>{query.isActive ? "Active" : "Disabled"}</Badge></td>
                        <td className="min-w-0 break-words py-4 pr-3">
                          <p>{query.lastTestedAt ? formatDateTime(query.lastTestedAt) : "Belum dites"}</p>
                          <Badge variant={statusVariant(query.lastTestStatus)}>{query.lastTestStatus}</Badge>
                        </td>
                        <td className="min-w-0 py-4 pr-3">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => { setQueryForm(queryToForm(query)); openModal({ type: "query", title: `Edit Query ${query.name}` }); }} disabled={isSaving}>Edit</Button>
                            <Button variant="outline" size="sm" onClick={() => void runAction("test-query", { queryId: query.id })} disabled={isSaving}>Test</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="database">
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
              <CardContent className="overflow-hidden">
                <table className="w-full table-fixed text-left text-sm">
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
        </TabsContent>

        <TabsContent value="public-qa" id="public-qa">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Pertanyaan Para Pihak</CardTitle>
                <CardDescription>Intent natural language yang aman. AI hanya memilih intent aktif dan tidak membuat jawaban bebas.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-5">
                <InfoCard title="Intent Aktif" value={String(snapshot.publicQaIntents.filter((item) => item.isActive).length)} hint={`${snapshot.publicQaIntents.length} intent terdaftar.`} />
                <InfoCard title="AI Matcher" value={String(snapshot.publicQaIntents.filter((item) => item.aiEnabled).length)} hint="Aktif hanya jika env runtime mengizinkan." />
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
                      <CardTitle>Daftar Intent / Trigger</CardTitle>
                      <CardDescription>Trigger legacy tetap tersimpan sebagai fallback, sementara contoh pertanyaan dipakai untuk matcher natural.</CardDescription>
                    </div>
                    <Button onClick={() => { setPublicQaIntentForm(makeEmptyPublicQaIntentForm()); openModal({ type: "publicQa", title: "Tambah Intent Pertanyaan" }); }} disabled={isSaving}>Tambah Intent</Button>
                  </div>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full min-w-[1120px] text-left text-sm">
                    <thead className="border-b border-border text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      <tr>
                        <th className="py-3 pr-4">Intent</th>
                        <th className="py-3 pr-4">Kategori</th>
                        <th className="py-3 pr-4">Trigger</th>
                        <th className="py-3 pr-4">Mode</th>
                        <th className="py-3 pr-4">Risk</th>
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
                              <Badge variant={intent.isActive ? "success" : "muted"}>{intent.isActive ? "Active" : "Disabled"}</Badge>
                              <Badge variant={intent.aiEnabled ? "success" : "outline"}>{intent.aiEnabled ? "AI Match" : "No AI"}</Badge>
                              <Badge variant={intent.aiAnswerEnabled ? "success" : "outline"}>{intent.aiAnswerEnabled ? "AI Answer" : "Answer Off"}</Badge>
                              <Badge variant={intent.status === "active" ? "success" : "warning"}>{intent.status}</Badge>
                            </div>
                          </td>
                          <td className="py-4 pr-4">
                            <Button variant="outline" size="sm" onClick={() => { setPublicQaIntentForm(publicQaIntentToForm(intent)); openModal({ type: "publicQa", title: `Edit Intent ${intent.name}` }); }} disabled={isSaving}>Edit</Button>
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
                  <CardTitle>Test Intent</CardTitle>
                  <CardDescription>Preview classifier, confidence, parameter, dan legacy command tanpa kirim pesan WhatsApp.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Field label="Pertanyaan" value={publicQaQuestion} onChange={setPublicQaQuestion} />
                  <Button variant="outline" onClick={() => void testPublicQaIntent()} disabled={isSaving}>
                    <Play className="h-4 w-4" />
                    Test Intent
                  </Button>
                  {publicQaTestResult ? <pre className="max-h-80 overflow-auto rounded-xl border border-border bg-muted/40 p-4 text-xs leading-5 text-foreground whitespace-pre-wrap">{publicQaTestResult}</pre> : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Log Pertanyaan</CardTitle>
                  <CardDescription>Riwayat terbaru pertanyaan pihak, intent, confidence, dan fallback.</CardDescription>
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
                    <CardTitle>Human Review Pertanyaan Publik</CardTitle>
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
                    ["converted_to_intent", "Sudah Jadi Intent"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
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
                          Saran: <code>{item.suggestedIntentKey}</code> ({Math.round(item.confidence * 100)}%) - {item.suggestedAction}
                        </p>
                        {item.reviewNote ? <p className="mt-2 text-xs text-muted-foreground">Catatan: {item.reviewNote}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isSaving}
                            onClick={() => {
                              setPublicQaReviewNote(item.reviewNote || "");
                              openModal({ type: "publicQaReview", title: "Review Pertanyaan Publik", review: item });
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

        <TabsContent value="logs">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Filter:</span>
              {(["all", "error", "whatsapp", "ai", "queue", "approval", "migration"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setLogFilter(f)}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${logFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  {f === "all" ? "Semua" : f === "error" ? "Error" : f === "whatsapp" ? "WhatsApp" : f === "ai" ? "AI" : f === "queue" ? "Antrean" : f === "approval" ? "Persetujuan" : "Migrasi"}
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

        <TabsContent value="manual-test">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Kirim Pesan Test</CardTitle>
                <CardDescription>Dry-run tidak mengirim pesan sungguhan, tetapi tetap mencatat audit log.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Nomor tujuan" value={settingsDraft.testTargetNumber} onChange={(value) => setSettingsDraft((current) => ({ ...current, testTargetNumber: value }))} placeholder="628123456789" />
                <Textarea value={testMessage} onChange={(event) => setTestMessage(event.target.value)} rows={4} />
                <Button onClick={() => void runAction("send-test", { to: settingsDraft.testTargetNumber, message: testMessage })} disabled={isSaving}>
                  <Send className="h-4 w-4" />
                  Kirim / Simulasikan
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Test Template & Query</CardTitle>
                <CardDescription>Preview template aman tanpa blast pesan massal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <select className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
                  {snapshot.templates.map((template) => <option key={template.id} value={template.id}>{template.title}</option>)}
                </select>
                <Button variant="outline" onClick={() => void runAction("test-template", { templateId: selectedTemplateId })} disabled={isSaving}>
                  <FileText className="h-4 w-4" />
                  Preview Template
                </Button>
                <select className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={selectedQueryId} onChange={(event) => setSelectedQueryId(event.target.value)}>
                  {snapshot.queries.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <Button variant="outline" onClick={() => void runAction("test-query", { queryId: selectedQueryId })} disabled={isSaving}>
                  <Database className="h-4 w-4" />
                  Test Query Terbatas
                </Button>
                <select className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={selectedNotificationId} onChange={(event) => setSelectedNotificationId(event.target.value)}>
                  {snapshot.notifications.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <Button variant="outline" onClick={() => void runAction("test-notification", { notificationId: selectedNotificationId })} disabled={isSaving}>
                  <MessageCircleMore className="h-4 w-4" />
                  Test Notifikasi
                </Button>
                {preview ? <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-muted/40 p-4 text-xs leading-5 text-foreground whitespace-pre-wrap">{preview}</pre> : null}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="queue-recovery">
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
                setNotice(`Dead letter ${id} berhasil dikirim ulang.`);
              } catch (error) {
                setNotice(error instanceof Error ? error.message : "Resend dead letter gagal.");
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
                setNotice(`Dead letter ${id} ditandai ditangani tanpa resend.`);
              } catch (error) {
                setNotice(error instanceof Error ? error.message : "Tandai dead letter ditangani gagal.");
              } finally {
                setIsSaving(false);
              }
            }} />
          </div>
        </TabsContent>

        <TabsContent value="approvals">
          <ApprovalRequestsCard
            approvalRequests={snapshot.approvalRequests}
            isSaving={isSaving}
            onReview={async (approvalId, decision, notes) => {
              setIsSaving(true);
              setNotice(null);
              try {
                await requestBot<AletaBotApprovalRequest>("/api/admin/aleta-bot/approvals", {
                  method: "POST",
                  body: JSON.stringify({ mode: "review", approvalId, decision, notes }),
                });
                await loadSnapshot();
                setNotice(`Persetujuan ${decision === "approved" ? "diterima" : "ditolak"}.`);
              } catch (error) {
                setNotice(error instanceof Error ? error.message : "Proses approval gagal.");
              } finally {
                setIsSaving(false);
              }
            }}
          />
        </TabsContent>

        <TabsContent value="migration">
          <LegacyMigrationCard
            legacyMigrations={snapshot.legacyMigrations}
            unknownQuestionReviews={snapshot.unknownQuestionReviews}
            isSaving={isSaving}
            onAction={(action, migration) => openModal({ type: "legacyAction", title: migrationActionTitle(action), migration, action })}
            showAdvanced={showAdvancedMode}
          />
        </TabsContent>
      </Tabs>

      <ModalShell modal={activeModal} isSaving={isSaving} onClose={closeModal}>
        {activeModal?.type === "settings" ? (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-3">
              <ToggleRow label="Bot aktif" checked={settingsDraft.botEnabled} onCheckedChange={(value) => { markModalDirty(); setSettingsDraft((current) => ({ ...current, botEnabled: value })); }} />
              <ToggleRow label="Notifikasi otomatis" checked={settingsDraft.notificationsEnabled} onCheckedChange={(value) => { markModalDirty(); setSettingsDraft((current) => ({ ...current, notificationsEnabled: value })); }} />
              <ToggleRow label="Dry-run" checked={settingsDraft.dryRunEnabled} onCheckedChange={(value) => { markModalDirty(); setSettingsDraft((current) => ({ ...current, dryRunEnabled: value })); }} />
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
            <p className="text-sm text-muted-foreground">Placeholder: {activeModal.template.placeholders.join(", ") || "tanpa placeholder"}</p>
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
                      <p className="font-semibold text-foreground">Placeholder terdeteksi</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {detected.length > 0 ? detected.map((placeholder) => (
                          <Badge key={placeholder} variant={unknown.includes(placeholder) ? "danger" : "success"}>{placeholder}</Badge>
                        )) : <span className="text-muted-foreground">Belum ada placeholder.</span>}
                      </div>
                      {unknown.length > 0 ? <p className="mt-2 text-destructive">Placeholder tidak dikenal: {unknown.join(", ")}.</p> : null}
                      {missingRequired.length > 0 ? <p className="mt-2 text-amber-700 dark:text-amber-300">Placeholder wajib belum dipakai: {missingRequired.join(", ")}.</p> : null}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-4">
                    <p className="text-sm font-semibold text-foreground">Pratinjau Pesan</p>
                    <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-6 text-foreground">
                      {renderAletaBotTemplatePreview(body)}
                    </pre>
                  </div>
                </div>
              );
            })()}
            <ModalActions isSaving={isSaving} onCancel={closeModal} onSave={() => void saveTemplate(activeModal.template)} saveLabel="Simpan Template" />
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
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nama notifikasi" value={notificationForm.name} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, name: value })); }} />
              <SelectField
                label="Kategori"
                value={notificationForm.category}
                onChange={(value) => { const category = value as AletaBotNotificationCategory; markModalDirty(); setNotificationForm((current) => ({ ...makeEmptyNotificationForm(snapshot, category), id: current.id, name: current.name, description: current.description, isActive: current.isActive })); }}
                options={[{ value: "employee", label: "Notifikasi Pegawai" }, { value: "party", label: "Notifikasi Pihak" }]}
              />
              <SelectField label="Sumber query" value={notificationForm.queryId} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, queryId: value })); }} options={snapshot.queries.filter((query) => query.category === notificationForm.category || query.category === "system").map((query) => ({ value: query.id, label: query.name }))} />
              <SelectField label="Template pesan" value={notificationForm.templateId} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, templateId: value })); }} options={snapshot.templates.map((template) => ({ value: template.id, label: template.title }))} />
              <Field label="Delay (ms)" type="number" value={String(notificationForm.delayMs)} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, delayMs: Number(value) })); }} />
              <Field label="Retry" type="number" value={String(notificationForm.retryLimit)} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, retryLimit: Number(value) })); }} />
            </div>
            <Field label="Deskripsi" value={notificationForm.description} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, description: value })); }} />
            <ScheduleBuilder
              form={notificationForm}
              showAdvancedMode={showAdvancedMode}
              onChange={(next) => { markModalDirty(); setNotificationForm((current) => ({ ...current, ...next })); }}
            />
            <ToggleRow label="Status aktif" checked={notificationForm.isActive} onCheckedChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, isActive: value })); }} />
            <ModalActions isSaving={isSaving} onCancel={closeModal} onSave={() => void saveNotification()} saveLabel={notificationForm.category === "party" ? "Simpan sebagai Draft Aman" : "Simpan Notifikasi"} />
          </div>
        ) : null}

        {activeModal?.type === "query" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nama query" value={queryForm.name} onChange={(value) => { markModalDirty(); setQueryForm((current) => ({ ...current, name: value })); }} />
              <SelectField label="Kategori" value={queryForm.category} onChange={(value) => { const category = value as AletaBotQueryCategory; markModalDirty(); setQueryForm((current) => ({ ...current, category, recipientColumn: category === "party" ? current.recipientColumn || "telepon" : "" })); }} options={[{ value: "employee", label: "Pegawai" }, { value: "party", label: "Pihak" }, { value: "system", label: "Sistem" }]} />
              <Field label="Kolom hasil" value={queryForm.outputColumns} onChange={(value) => { markModalDirty(); setQueryForm((current) => ({ ...current, outputColumns: value })); }} placeholder="nama_pihak, nomor_perkara, telepon" />
              <Field label="Kolom nomor pihak" value={queryForm.recipientColumn} onChange={(value) => { markModalDirty(); setQueryForm((current) => ({ ...current, recipientColumn: value })); }} placeholder="telepon" />
              <SelectField label="Sumber SQL" value={queryForm.connectionKey} onChange={(value) => { markModalDirty(); setQueryForm((current) => ({ ...current, connectionKey: value })); }} options={snapshot.dbConnections.map((connection) => ({ value: connection.key, label: `${connection.name} (${connection.key})` }))} />
            </div>
            <Field label="Deskripsi" value={queryForm.description} onChange={(value) => { markModalDirty(); setQueryForm((current) => ({ ...current, description: value })); }} />
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">SQL / referensi legacy</span>
              <Textarea value={queryForm.sqlText} onChange={(event) => { markModalDirty(); setQueryForm((current) => ({ ...current, sqlText: event.target.value })); }} rows={8} />
            </label>
            <ToggleRow label="Query aktif" checked={queryForm.isActive} onCheckedChange={(value) => { markModalDirty(); setQueryForm((current) => ({ ...current, isActive: value })); }} />
            <ModalActions isSaving={isSaving} onCancel={closeModal} onSave={() => void saveQuery()} saveLabel="Simpan Query" />
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
                Test Koneksi Form Ini
              </Button>
              <ModalActions isSaving={isSaving} onCancel={closeModal} onSave={() => void saveDbConnection()} saveLabel="Simpan Koneksi" />
            </div>
          </div>
        ) : null}

        {activeModal?.type === "publicQa" ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Key" value={publicQaIntentForm.key} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, key: value })); }} placeholder="cek_jadwal_sidang" />
              <Field label="Nama" value={publicQaIntentForm.name} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, name: value })); }} />
              <SelectField label="Kategori" value={publicQaIntentForm.category} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, category: value as PublicQaIntentForm["category"] })); }} options={["informasi_umum", "status_perkara", "jadwal_sidang", "biaya_panjar", "akta_cerai", "layanan", "pengaduan", "ecourt", "fallback"].map((value) => ({ value, label: value }))} />
              <SelectField label="Audience" value={publicQaIntentForm.audience} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, audience: value as PublicQaIntentForm["audience"] })); }} options={["party", "public", "employee", "admin"].map((value) => ({ value, label: value }))} />
              <SelectField label="Response mode" value={publicQaIntentForm.responseMode} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, responseMode: value as PublicQaIntentForm["responseMode"] })); }} options={["legacy_handler", "query_template", "static_template", "ai_guided_template", "fallback"].map((value) => ({ value, label: value }))} />
              <SelectField label="AI answer mode" value={publicQaIntentForm.aiAnswerMode} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, aiAnswerMode: value as PublicQaIntentForm["aiAnswerMode"] })); }} options={["off", "template_only", "template_rewrite", "query_summarize", "guided_answer"].map((value) => ({ value, label: value }))} />
              <SelectField label="Verification policy" value={publicQaIntentForm.verificationPolicy} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, verificationPolicy: value as PublicQaIntentForm["verificationPolicy"] })); }} options={["none", "case_number_only", "phone_match", "case_number_and_phone", "manual_ptsp"].map((value) => ({ value, label: value }))} />
              <SelectField label="Answer policy" value={publicQaIntentForm.answerPolicy} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, answerPolicy: value as PublicQaIntentForm["answerPolicy"] })); }} options={["public_info_only", "case_status_limited", "requires_verified_party", "admin_only"].map((value) => ({ value, label: value }))} />
              <SelectField label="Risk level" value={publicQaIntentForm.riskLevel} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, riskLevel: value as PublicQaIntentForm["riskLevel"] })); }} options={["low", "medium", "high"].map((value) => ({ value, label: value }))} />
              <SelectField label="Status" value={publicQaIntentForm.status} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, status: value as PublicQaIntentForm["status"] })); }} options={["draft", "active", "archived"].map((value) => ({ value, label: value }))} />
              <Field label="Legacy command" value={publicQaIntentForm.legacyCommand} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, legacyCommand: value })); }} placeholder="jadwal" />
              <Field label="Parameterized command" value={publicQaIntentForm.parameterizedLegacyCommand} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, parameterizedLegacyCommand: value })); }} placeholder="jadwal" />
              <SelectField label="Query mapping" value={publicQaIntentForm.queryKey} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, queryKey: value })); }} options={[{ value: "", label: "Tidak pakai query registry" }, ...snapshot.queries.map((query) => ({ value: query.id, label: query.name }))]} />
              <Field label="Template key" value={publicQaIntentForm.templateKey} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, templateKey: value })); }} />
              <Field label="Required parameters" value={publicQaIntentForm.requiredParameters} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, requiredParameters: value })); }} placeholder="nomor_perkara" />
              <Field label="Confidence threshold" type="number" value={String(publicQaIntentForm.confidenceThreshold)} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, confidenceThreshold: Number(value) })); }} />
              <Field label="Max AI tokens" type="number" value={String(publicQaIntentForm.maxAiTokens)} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, maxAiTokens: Number(value) })); }} />
              <Field label="Temperature" type="number" value={String(publicQaIntentForm.temperature)} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, temperature: Number(value) })); }} />
            </div>
            <Field label="Deskripsi" value={publicQaIntentForm.description} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, description: value })); }} />
            <Field label="Legacy handler" value={publicQaIntentForm.legacyHandler} onChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, legacyHandler: value })); }} placeholder="query.getData:jadwal" />
            <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Exact triggers</span><Textarea value={publicQaIntentForm.exactTriggers} onChange={(event) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, exactTriggers: event.target.value })); }} rows={3} /></label>
            <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Contoh pertanyaan</span><Textarea value={publicQaIntentForm.exampleQuestions} onChange={(event) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, exampleQuestions: event.target.value })); }} rows={4} /></label>
            <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Allowed data fields</span><Textarea value={publicQaIntentForm.allowedDataFields} onChange={(event) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, allowedDataFields: event.target.value })); }} rows={2} /></label>
            <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Blocked data fields</span><Textarea value={publicQaIntentForm.blockedDataFields} onChange={(event) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, blockedDataFields: event.target.value })); }} rows={2} /></label>
            <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">System prompt</span><Textarea value={publicQaIntentForm.aiSystemPrompt} onChange={(event) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, aiSystemPrompt: event.target.value })); }} rows={4} /></label>
            <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">User prompt template</span><Textarea value={publicQaIntentForm.aiUserPromptTemplate} onChange={(event) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, aiUserPromptTemplate: event.target.value })); }} rows={4} /></label>
            <label className="block space-y-2"><span className="text-sm font-semibold text-foreground">Fallback message</span><Textarea value={publicQaIntentForm.fallbackMessage} onChange={(event) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, fallbackMessage: event.target.value })); }} rows={3} /></label>
            <div className="grid gap-3 sm:grid-cols-3">
              <ToggleRow label="Aktif" checked={publicQaIntentForm.isActive} onCheckedChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, isActive: value })); }} />
              <ToggleRow label="AI matcher" checked={publicQaIntentForm.aiEnabled} onCheckedChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, aiEnabled: value })); }} />
              <ToggleRow label="AI answer" checked={publicQaIntentForm.aiAnswerEnabled} onCheckedChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, aiAnswerEnabled: value })); }} />
              <ToggleRow label="Butuh verifikasi" checked={publicQaIntentForm.requiresVerification} onCheckedChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, requiresVerification: value })); }} />
              <ToggleRow label="Butuh nomor perkara" checked={publicQaIntentForm.requiresCaseNumber} onCheckedChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, requiresCaseNumber: value })); }} />
              <ToggleRow label="Butuh approval" checked={publicQaIntentForm.requiresApprovalBeforeActive} onCheckedChange={(value) => { markModalDirty(); setPublicQaIntentForm((current) => ({ ...current, requiresApprovalBeforeActive: value })); }} />
            </div>
            <ModalActions isSaving={isSaving} onCancel={closeModal} onSave={() => {
              if (publicQaIntentForm.riskLevel === "high" || publicQaIntentForm.aiAnswerEnabled) {
                if (!window.confirm("Simpan perubahan intent AI? Perubahan berisiko harus tetap melalui status draft/approval bila belum siap.")) return;
              }
              void savePublicQaIntent();
            }} saveLabel={publicQaIntentForm.status === "active" ? "Simpan & Aktifkan" : "Simpan sebagai Draft"} />
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
                onClick={() => openModal({ type: "publicQaConvert", title: "Jadikan Draft Intent", review: activeModal.review })}
                disabled={isSaving}
              >
                Jadikan Draft Intent
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
                Buat intent draft baru
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm">
                <input
                  type="radio"
                  checked={publicQaConvertMode === "existing"}
                  onChange={() => setPublicQaConvertMode("existing")}
                />
                Tambahkan ke intent draft existing
              </label>
            </div>
            {publicQaConvertMode === "new" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Key draft intent" value={publicQaDraftIntentKey} onChange={setPublicQaDraftIntentKey} placeholder="cek_status_layanan" />
                <Field label="Nama draft intent" value={publicQaDraftIntentName} onChange={setPublicQaDraftIntentName} placeholder="Draft Intent Baru" />
              </div>
            ) : (
              <SelectField
                label="Intent draft tujuan"
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
              <InfoCard title={deadlineReminderPreview?.productionSent ? "Masuk Antrean" : "Dry-run dibuat"} value={String(deadlineReminderPreview?.productionSent ?? deadlineReminderPreview?.dryRunCreated ?? 0)} hint={deadlineReminderPreview?.productionSent ? "Terkonfirmasi oleh gateway dengan gate eksplisit." : "Tercatat sebagai simulasi, bukan kirim WA."} />
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
                  ? "Aktivasi registry hanya tersedia setelah dry-run dan approval. Guard duplikasi jalur aktif: legacy key harus sudah di-disable lebih dulu untuk notifikasi."
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

function StatusCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <Badge variant={statusVariant(value)}>{displayStatus(value)}</Badge>
        </div>
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
        <p className="mt-2 break-words text-lg font-semibold text-foreground">{value}</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function HealthSummaryCard({ label, status, value }: { label: string; status: "ok" | "warning" | "error"; value: string }) {
  const variant = status === "ok" ? "success" as const : status === "warning" ? "warning" as const : "danger" as const;
  const dot = status === "ok" ? "bg-emerald-500" : status === "warning" ? "bg-amber-500" : "bg-destructive";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        <span className={cn("h-2 w-2 rounded-full", dot)} />
      </div>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
      <Badge variant={variant} className="mt-2 text-[10px]">{status === "ok" ? "Normal" : status === "warning" ? "Perhatian" : "Masalah"}</Badge>
    </div>
  );
}

function ToggleRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">{label}</span>
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
  onEdit: (notification: AletaBotNotification) => void;
  onTest: (notification: AletaBotNotification) => void;
  onPreviewRecipients: (notification: AletaBotNotification) => void;
  isSaving: boolean;
}) {
  const queryTitle = (id: string) => queries.find((query) => query.id === id)?.name ?? id;
  const templateTitle = (id: string) => templates.find((template) => template.id === id)?.title ?? id;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-hidden">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="w-[18%] py-3 pr-3">Nama</th>
              <th className="w-[8%] py-3 pr-3">Kategori</th>
              <th className="w-[13%] py-3 pr-3">Sumber Query</th>
              <th className="w-[11%] py-3 pr-3">Template</th>
              <th className="w-[10%] py-3 pr-3">Target</th>
              <th className="w-[13%] py-3 pr-3">Jadwal</th>
              <th className="w-[9%] py-3 pr-3">Terakhir</th>
              <th className="w-[8%] py-3 pr-3">Status</th>
              <th className="w-[10%] py-3 pr-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((notification) => (
              <tr key={notification.id} className="border-b border-border/70 align-top">
                <td className="min-w-0 break-words py-4 pr-3">
                  <p className="font-medium text-foreground">{notification.name}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{notification.description}</p>
                </td>
                <td className="min-w-0 break-words py-4 pr-3"><Badge variant="outline">{notification.category === "employee" ? "Pegawai" : "Pihak"}</Badge></td>
                <td className="min-w-0 break-words py-4 pr-3 text-muted-foreground">{queryTitle(notification.queryId)}</td>
                <td className="min-w-0 break-words py-4 pr-3 text-muted-foreground">{templateTitle(notification.templateId)}</td>
                <td className="min-w-0 break-words py-4 pr-3 text-muted-foreground">{notification.recipientSource === "users" ? "User/pegawai portal" : String(notification.recipientMapping.recipientColumn ?? "query")}</td>
                <td className="min-w-0 break-words py-4 pr-3">
                  <p>{humanizeSchedule(notification.scheduleConfig.type, notification.scheduleConfig.cron, notification.scheduleConfig.trigger)}</p>
                  <p className="text-xs text-muted-foreground">{notification.scheduleConfig.trigger || "-"}</p>
                </td>
                <td className="min-w-0 break-words py-4 pr-3">{notification.lastRunAt ? formatDateTime(notification.lastRunAt) : "Belum berjalan"}</td>
                <td className="min-w-0 break-words py-4 pr-3">
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
                <td className="min-w-0 py-4 pr-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => onEdit(notification)} disabled={isSaving}>Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => onTest(notification)} disabled={isSaving}>Test</Button>
                    <Button variant="outline" size="sm" onClick={() => onPreviewRecipients(notification)} disabled={isSaving}>Preview Penerima</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
        <CardTitle>Kontrol Worker Queue</CardTitle>
        <CardDescription>Jeda atau lanjutkan worker pemrosesan antrian pesan. Worker tetap berjalan saat dijeda tetapi melewati pemrosesan batch.</CardDescription>
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
                    ? "Worker sedang memproses batch."
                    : "Worker aktif dan menunggu jadwal batch berikutnya."
                  : "Timer worker tidak aktif.")
              }
            />
            <InfoCard title="Heartbeat Terakhir" value={workerState.lastHeartbeatAt ? formatDateTime(workerState.lastHeartbeatAt) : "Belum ada"} hint={`Batch terakhir: ${workerState.lastBatchProcessed} pesan.`} />
            <InfoCard title="Interval" value={`${workerState.intervalMs}ms`} hint={`Batch size: ${workerState.batchSize}`} />
            <InfoCard title="Error Terakhir" value={workerState.lastError || "Tidak ada"} hint={workerState.pausedAt ? `Dijeda: ${formatDateTime(workerState.pausedAt)}` : "Tidak sedang dijeda."} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Worker state tidak tersedia (aleta_bot gateway tidak aktif atau tidak dalam mode aleta_bot).</div>
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
            Jeda Worker
          </Button>
          <Button
            onClick={() => onResume()}
            disabled={isSaving || !(workerState?.paused ?? false)}
          >
            <Play className="h-4 w-4" />
            Lanjutkan Worker
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
}: {
  approvalRequests: AletaBotApprovalRequest[];
  isSaving: boolean;
  onReview: (approvalId: string, decision: "approved" | "rejected", notes?: string) => Promise<void>;
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
                    <Input
                      placeholder="Catatan reviewer (opsional)..."
                      value={reviewNotes[req.id] ?? ""}
                      onChange={(event) => setReviewNotes((current) => ({ ...current, [req.id]: event.target.value }))}
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => void onReview(req.id, "approved", reviewNotes[req.id])}
                    disabled={isSaving}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Setujui
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void onReview(req.id, "rejected", reviewNotes[req.id])}
                    disabled={isSaving}
                  >
                    <X className="h-4 w-4" />
                    Tolak
                  </Button>
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
