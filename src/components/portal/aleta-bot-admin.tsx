"use client";

import {
  Bot,
  CheckCircle2,
  Database,
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type AletaBotApprovalRequest,
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
  notificationLogs: [],
  queryCatalog: [],
  logs: [],
  approvalRequests: [],
  deadLetters: [],
  workerState: null,
  legacyMigrations: [],
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
  | { type: "query"; title: string }
  | { type: "database"; title: string }
  | { type: "publicQa"; title: string };

function statusVariant(status: string) {
  if (["active", "connected", "success", "dry-run"].includes(status)) return "success" as const;
  if (["error", "failed"].includes(status)) return "danger" as const;
  if (["disabled", "disconnected", "waiting_qr", "warning"].includes(status)) return "warning" as const;
  return "outline" as const;
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
  const [runtimeDashboard, setRuntimeDashboard] = useState<RuntimeDashboardSnapshot | null>(null);
  const [activeModal, setActiveModal] = useState<AletaBotModal | null>(null);
  const [modalDirty, setModalDirty] = useState(false);

  const openModal = (modal: AletaBotModal) => {
    setModalDirty(false);
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

  const groupedTemplates = useMemo(() => {
    return snapshot.templates.reduce<Record<string, AletaBotTemplate[]>>((groups, template) => {
      groups[template.category] = [...(groups[template.category] ?? []), template];
      return groups;
    }, {});
  }, [snapshot.templates]);

  const publicQaRuntimeLogs = runtimeDashboard?.payload?.publicQa?.recentLogs ?? [];

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Super Admin Only"
        title="ALETA Bot"
        description="Modul internal untuk mengelola bot WhatsApp notifikasi perkara, koneksi WhatsApp Web, template pesan, query, log, dan pengujian aman dari portal utama ALETA."
        actions={
          <>
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard label="Status Bot" value={snapshot.runtimeState} icon={Bot} />
        <StatusCard label="WhatsApp" value={snapshot.whatsapp.runtimeStatus} icon={Smartphone} />
        <StatusCard label="Terkirim Hari Ini" value={String(snapshot.metrics.sentToday)} icon={Send} />
        <StatusCard label="Gagal Hari Ini" value={String(snapshot.metrics.failedToday)} icon={TerminalSquare} />
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex max-w-full flex-wrap justify-start">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="connection">Koneksi WA</TabsTrigger>
          <TabsTrigger value="settings">Pengaturan</TabsTrigger>
          <TabsTrigger value="templates">Template</TabsTrigger>
          <TabsTrigger value="notifications">Notifikasi</TabsTrigger>
          <TabsTrigger value="queries">Query</TabsTrigger>
          <TabsTrigger value="database">Sumber Data SQL</TabsTrigger>
          <TabsTrigger value="public-qa">Pertanyaan Para Pihak</TabsTrigger>
          <TabsTrigger value="logs">Log</TabsTrigger>
          <TabsTrigger value="manual-test">Manual Test</TabsTrigger>
          <TabsTrigger value="queue-recovery">Queue Recovery</TabsTrigger>
          <TabsTrigger value="approvals">Persetujuan</TabsTrigger>
          <TabsTrigger value="migration">Migrasi Legacy</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <div className="grid gap-4 lg:grid-cols-3">
            <InfoCard title="Nomor Admin" value={snapshot.settings.adminWhatsappNumber || "Belum diatur"} hint="Dipakai sebagai admin/kontrol bot. Disimpan di database portal dan bridge config." />
            <InfoCard title="Nomor Terhubung" value={snapshot.whatsapp.phoneNumber || "Belum disetel"} hint={`Session: ${snapshot.whatsapp.sessionName}`} />
            <InfoCard title="Notifikasi Terakhir" value={snapshot.metrics.lastNotificationAt ? formatDateTime(snapshot.metrics.lastNotificationAt) : "Belum ada"} hint={`${snapshot.metrics.activeJobs} job aktif, ${snapshot.metrics.enabledTemplates} template tersedia.`} />
          </div>
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
                title="Queue DB"
                value={`${runtimeDashboard?.payload?.queue?.pending ?? 0} pending`}
                hint={`${runtimeDashboard?.payload?.queue?.failed ?? 0} failed, ${runtimeDashboard?.payload?.queue?.sent ?? 0} sent.`}
              />
              <InfoCard
                title="Worker"
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
                title="Error Sistem"
                value={`${runtimeDashboard?.payload?.systemStatsToday?.error ?? 0} error`}
                hint={`${runtimeDashboard?.payload?.systemStatsToday?.critical ?? 0} critical hari ini.`}
              />
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>AI Config Bridge</CardTitle>
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
        </TabsContent>

        <TabsContent value="connection">
          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle>Koneksi WhatsApp Web</CardTitle>
                <CardDescription>Memakai WhatsApp Gateway portal sebagai satu pusat koneksi/session.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoCard title="Runtime" value={snapshot.whatsapp.runtimeStatus} hint={snapshot.whatsapp.lastErrorMessage ?? "Tidak ada error runtime tersimpan."} />
                  <InfoCard title="Terakhir Terhubung" value={snapshot.whatsapp.lastConnectedAt ? formatDateTime(snapshot.whatsapp.lastConnectedAt) : "Belum pernah"} hint={snapshot.whatsapp.savedStatus} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void runAction("reconnect")} disabled={isSaving}>
                    <RefreshCcw className="h-4 w-4" />
                    Reconnect
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
                <CardDescription>QR muncul saat gateway berada pada status waiting_qr.</CardDescription>
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
                    QR belum tersedia. Tekan reconnect bila perlu pairing ulang.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings">
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
              <CardContent className="flex flex-wrap gap-2">
                <Button onClick={() => { setNotificationForm(makeEmptyNotificationForm(snapshot, "employee")); openModal({ type: "notification", title: "Tambah Notifikasi Pegawai" }); }} disabled={isSaving}>Tambah Pegawai</Button>
                <Button variant="outline" onClick={() => { setNotificationForm(makeEmptyNotificationForm(snapshot, "party")); openModal({ type: "notification", title: "Tambah Notifikasi Pihak" }); }} disabled={isSaving}>Tambah Pihak</Button>
              </CardContent>
            </Card>

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
              isSaving={isSaving}
            />
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
              isSaving={isSaving}
            />
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
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[1040px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <tr>
                      <th className="py-3 pr-4">Nama</th>
                      <th className="py-3 pr-4">Kategori</th>
                      <th className="py-3 pr-4">Dipakai Oleh</th>
                      <th className="py-3 pr-4">Sumber SQL</th>
                      <th className="py-3 pr-4">SQL Preview</th>
                      <th className="py-3 pr-4">Kolom</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Test</th>
                      <th className="py-3 pr-4">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.queries.map((query) => (
                      <tr key={query.id} className="border-b border-border/70 align-top">
                        <td className="py-4 pr-4">
                          <p className="font-medium text-foreground">{query.name}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{query.description}</p>
                        </td>
                        <td className="py-4 pr-4"><Badge variant="outline">{query.category}</Badge></td>
                        <td className="py-4 pr-4 text-muted-foreground">{query.usedByNotifications.join(", ") || "-"}</td>
                        <td className="py-4 pr-4"><Badge variant="outline">{query.connectionKey}</Badge></td>
                        <td className="py-4 pr-4"><code className="line-clamp-3 text-xs text-muted-foreground">{query.sqlText}</code></td>
                        <td className="py-4 pr-4">
                          <p>{query.outputColumns.length} kolom</p>
                          <p className="text-xs text-muted-foreground">{query.recipientColumn || "tanpa kolom nomor"}</p>
                        </td>
                        <td className="py-4 pr-4"><Badge variant={query.isActive ? "success" : "muted"}>{query.isActive ? "Active" : "Disabled"}</Badge></td>
                        <td className="py-4 pr-4">
                          <p>{query.lastTestedAt ? formatDateTime(query.lastTestedAt) : "Belum dites"}</p>
                          <Badge variant={statusVariant(query.lastTestStatus)}>{query.lastTestStatus}</Badge>
                        </td>
                        <td className="py-4 pr-4">
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
                <CardDescription>Koneksi eksternal untuk query ALETA Bot. Password disimpan sebagai nama env dan tidak pernah ditampilkan ulang.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-4">
                <InfoCard title="Koneksi Aktif" value={String(snapshot.dbConnections.filter((item) => item.isActive).length)} hint={`${snapshot.dbConnections.length} koneksi terdaftar.`} />
                <InfoCard title="Default" value={snapshot.dbConnections.find((item) => item.isDefault)?.key || "-"} hint="Dipakai sebagai fallback query baru." />
                <InfoCard title="Test Gagal" value={String(snapshot.dbConnections.filter((item) => item.lastTestStatus === "failed").length)} hint="Periksa host/env password jika gagal." />
                <InfoCard title="Legacy Fallback" value={String(snapshot.dbConnections.filter((item) => item.legacySource).length)} hint="Masih kompatibel dengan db_config lama." />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Kelola Koneksi</CardTitle>
                <CardDescription>Gunakan env key untuk password, misalnya ALETA_BOT_DB_SIPP_PASSWORD. Field password asli tidak disimpan di database portal.</CardDescription>
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
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <tr>
                      <th className="py-3 pr-4">Nama</th>
                      <th className="py-3 pr-4">Key</th>
                      <th className="py-3 pr-4">Host/DB</th>
                      <th className="py-3 pr-4">User</th>
                      <th className="py-3 pr-4">Password</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Last Test</th>
                      <th className="py-3 pr-4">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.dbConnections.map((connection) => (
                      <tr key={connection.id} className="border-b border-border/70 align-top">
                        <td className="py-4 pr-4">
                          <p className="font-medium text-foreground">{connection.name}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{connection.description || connection.legacySource || "-"}</p>
                        </td>
                        <td className="py-4 pr-4"><Badge variant="outline">{connection.key}</Badge></td>
                        <td className="py-4 pr-4">
                          <p>{connection.host}:{connection.port}</p>
                          <p className="text-xs text-muted-foreground">{connection.databaseName}</p>
                        </td>
                        <td className="py-4 pr-4">{connection.usernameMasked || "***"}</td>
                        <td className="py-4 pr-4">
                          <p className="text-xs text-muted-foreground">{connection.passwordEnvKey || "env belum diatur"}</p>
                          <Badge variant={connection.passwordConfigured ? "success" : "warning"}>{connection.passwordConfigured ? "configured" : "missing"}</Badge>
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={connection.isActive ? "success" : "muted"}>{connection.isActive ? "Active" : "Disabled"}</Badge>
                            {connection.isDefault ? <Badge variant="outline">Default</Badge> : null}
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <Badge variant={statusVariant(connection.lastTestStatus)}>{connection.lastTestStatus}</Badge>
                          <p className="mt-1 text-xs text-muted-foreground">{connection.lastTestAt ? formatDateTime(connection.lastTestAt) : "Belum dites"}</p>
                          {connection.lastTestError ? <p className="mt-1 text-xs text-destructive">{connection.lastTestError}</p> : null}
                        </td>
                        <td className="py-4 pr-4">
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

        <TabsContent value="public-qa">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Pertanyaan Para Pihak</CardTitle>
                <CardDescription>Intent natural language yang aman. AI hanya memilih intent aktif dan tidak membuat jawaban bebas.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-4">
                <InfoCard title="Intent Aktif" value={String(snapshot.publicQaIntents.filter((item) => item.isActive).length)} hint={`${snapshot.publicQaIntents.length} intent terdaftar.`} />
                <InfoCard title="AI Matcher" value={String(snapshot.publicQaIntents.filter((item) => item.aiEnabled).length)} hint="Aktif hanya jika env runtime mengizinkan." />
                <InfoCard title="Butuh Verifikasi" value={String(snapshot.publicQaIntents.filter((item) => item.requiresVerification).length)} hint="Intent perkara/panjar/akta perlu hati-hati." />
                <InfoCard title="Fallback Hari Ini" value={String(runtimeDashboard?.payload?.publicQa?.stats?.fallbackToday ?? 0)} hint={`${runtimeDashboard?.payload?.publicQa?.stats?.totalToday ?? 0} interaksi tercatat hari ini.`} />
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
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <div className="grid gap-4 lg:grid-cols-2">
            <LogCard title="Log Pesan" logs={snapshot.logs.filter((log) => log.eventType === "message" || log.eventType === "notification")} />
            <LogCard title="Log Sistem" logs={snapshot.logs.filter((log) => log.eventType !== "message" && log.eventType !== "notification")} />
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
            <DeadLetterCard deadLetters={snapshot.deadLetters} isSaving={isSaving} onResend={async (id) => {
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
          <LegacyMigrationCard legacyMigrations={snapshot.legacyMigrations} />
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
            <Textarea value={templateDraft[activeModal.template.id] ?? activeModal.template.body} rows={12} onChange={(event) => { markModalDirty(); setTemplateDraft((current) => ({ ...current, [activeModal.template.id]: event.target.value })); }} disabled={!activeModal.template.editable} />
            <ModalActions isSaving={isSaving} onCancel={closeModal} onSave={() => void saveTemplate(activeModal.template)} saveLabel="Simpan Template" />
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
              <SelectField label="Tipe trigger" value={notificationForm.scheduleType} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, scheduleType: value as NotificationForm["scheduleType"] })); }} options={[{ value: "cron", label: "Cron" }, { value: "manual", label: "Manual" }, { value: "event", label: "Event" }]} />
              <Field label="Jadwal/cron" value={notificationForm.scheduleCron} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, scheduleCron: value })); }} placeholder="00 07 * * *" />
              <Field label="Delay (ms)" type="number" value={String(notificationForm.delayMs)} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, delayMs: Number(value) })); }} />
              <Field label="Retry" type="number" value={String(notificationForm.retryLimit)} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, retryLimit: Number(value) })); }} />
            </div>
            <Field label="Deskripsi" value={notificationForm.description} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, description: value })); }} />
            <Field label="Trigger" value={notificationForm.scheduleTrigger} onChange={(value) => { markModalDirty(); setNotificationForm((current) => ({ ...current, scheduleTrigger: value })); }} />
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
              <Field label="Env Password" value={dbConnectionForm.passwordEnvKey} onChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, passwordEnvKey: value })); }} placeholder="ALETA_BOT_DB_SIPP_PASSWORD" />
              <Field label="Timeout (ms)" type="number" value={String(dbConnectionForm.connectionTimeoutMs)} onChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, connectionTimeoutMs: Number(value) })); }} />
              <Field label="Legacy Source" value={dbConnectionForm.legacySource} onChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, legacySource: value })); }} placeholder="db_config.js" />
            </div>
            <Field label="Deskripsi" value={dbConnectionForm.description} onChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, description: value })); }} />
            <div className="grid gap-3 sm:grid-cols-3">
              <ToggleRow label="Aktif" checked={dbConnectionForm.isActive} onCheckedChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, isActive: value })); }} />
              <ToggleRow label="Default" checked={dbConnectionForm.isDefault} onCheckedChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, isDefault: value })); }} />
              <ToggleRow label="SSL" checked={dbConnectionForm.sslEnabled} onCheckedChange={(value) => { markModalDirty(); setDbConnectionForm((current) => ({ ...current, sslEnabled: value })); }} />
            </div>
            <ModalActions isSaving={isSaving} onCancel={closeModal} onSave={() => void saveDbConnection()} saveLabel="Simpan Koneksi" />
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
          <Badge variant={statusVariant(value)}>{value}</Badge>
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

function NotificationSection({
  title,
  description,
  notifications,
  queries,
  templates,
  onEdit,
  onTest,
  isSaving,
}: {
  title: string;
  description: string;
  notifications: AletaBotNotification[];
  queries: AletaBotQuery[];
  templates: AletaBotTemplate[];
  onEdit: (notification: AletaBotNotification) => void;
  onTest: (notification: AletaBotNotification) => void;
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
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="py-3 pr-4">Nama</th>
              <th className="py-3 pr-4">Kategori</th>
              <th className="py-3 pr-4">Sumber Query</th>
              <th className="py-3 pr-4">Template</th>
              <th className="py-3 pr-4">Target</th>
              <th className="py-3 pr-4">Jadwal/Trigger</th>
              <th className="py-3 pr-4">Terakhir</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((notification) => (
              <tr key={notification.id} className="border-b border-border/70 align-top">
                <td className="py-4 pr-4">
                  <p className="font-medium text-foreground">{notification.name}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{notification.description}</p>
                </td>
                <td className="py-4 pr-4"><Badge variant="outline">{notification.category === "employee" ? "Pegawai" : "Pihak"}</Badge></td>
                <td className="py-4 pr-4 text-muted-foreground">{queryTitle(notification.queryId)}</td>
                <td className="py-4 pr-4 text-muted-foreground">{templateTitle(notification.templateId)}</td>
                <td className="py-4 pr-4 text-muted-foreground">{notification.recipientSource === "users" ? "User/pegawai portal" : String(notification.recipientMapping.recipientColumn ?? "query")}</td>
                <td className="py-4 pr-4">
                  <p>{notification.scheduleConfig.cron || notification.scheduleConfig.type}</p>
                  <p className="text-xs text-muted-foreground">{notification.scheduleConfig.trigger || "-"}</p>
                </td>
                <td className="py-4 pr-4">{notification.lastRunAt ? formatDateTime(notification.lastRunAt) : "Belum berjalan"}</td>
                <td className="py-4 pr-4">
                  <div className="space-y-2">
                    <Badge variant={notification.isActive ? "success" : "muted"}>{notification.isActive ? "Active" : "Disabled"}</Badge>
                    <Badge variant={statusVariant(notification.lastStatus)}>{notification.lastStatus}</Badge>
                  </div>
                </td>
                <td className="py-4 pr-4">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(notification)} disabled={isSaving}>Edit</Button>
                    <Button variant="outline" size="sm" onClick={() => onTest(notification)} disabled={isSaving}>Test</Button>
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
            <InfoCard title="Status" value={workerState.paused ? "paused" : workerState.running ? "running" : "stopped"} hint={workerState.pauseReason || (workerState.running ? "Worker aktif memproses queue." : "Worker tidak berjalan.")} />
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

function DeadLetterCard({
  deadLetters,
  isSaving,
  onResend,
}: {
  deadLetters: AletaBotDeadLetter[];
  isSaving: boolean;
  onResend: (id: string) => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dead Letters ({deadLetters.length})</CardTitle>
        <CardDescription>Pesan gagal yang sudah melewati batas retry. Klik Kirim Ulang untuk mengantrikan kembali dengan ID baru.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {deadLetters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Tidak ada dead letter. Semua pesan berhasil terproses.</div>
        ) : (
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
                <tr key={dl.id} className="border-b border-border/70 align-top">
                  <td className="py-4 pr-4">
                    <p className="font-medium text-foreground">{dl.recipientName || dl.recipientNumber}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{dl.recipientNumber}</p>
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
                    <Button variant="outline" size="sm" disabled={isSaving} onClick={() => void onResend(dl.id)}>
                      Kirim Ulang
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
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

function LegacyMigrationCard({ legacyMigrations }: { legacyMigrations: AletaBotLegacyMigration[] }) {
  const [groupBy, setGroupBy] = React.useState<"category" | "legacyType" | "status">("legacyType");

  const statusColor = (status: AletaBotLegacyMigration["status"]) => {
    if (status === "migrated") return "success" as const;
    if (status === "in_progress") return "warning" as const;
    if (status === "skipped") return "outline" as const;
    return "muted" as const;
  };
  const statusLabel = (status: AletaBotLegacyMigration["status"]) => {
    if (status === "migrated") return "Selesai";
    if (status === "in_progress") return "Proses";
    if (status === "skipped") return "Dilewati";
    return "Tertunda";
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

  const migratedCount = legacyMigrations.filter((m) => m.status === "migrated").length;
  const inProgressCount = legacyMigrations.filter((m) => m.status === "in_progress").length;
  const pendingCount = legacyMigrations.filter((m) => m.status === "pending").length;
  const highRiskPending = legacyMigrations.filter((m) => m.riskLevel === "high" && m.status === "pending").length;

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
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-3">Fitur</th>
                      <th className="py-2 pr-3">Fungsi Legacy</th>
                      <th className="py-2 pr-3">Cron</th>
                      <th className="py-2 pr-3">Target Portal</th>
                      <th className="py-2 pr-3">Risiko</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {migrations.map((migration) => (
                      <tr key={migration.id} className="border-b border-border/50 align-top hover:bg-muted/30">
                        <td className="py-3 pr-3">
                          <div className="font-medium text-foreground">{migration.feature}</div>
                          {migration.canArchive && <span className="text-[10px] text-muted-foreground">✓ Dapat diarsip</span>}
                        </td>
                        <td className="py-3 pr-3">
                          <code className="rounded bg-muted px-1 py-0.5 text-xs text-foreground/80">{migration.sourceFunction || migration.legacyKey || "—"}</code>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">{migration.legacySource.split("(")[0]?.trim()}</div>
                        </td>
                        <td className="py-3 pr-3">
                          {migration.cronSchedule
                            ? <code className="text-[10px] text-muted-foreground">{migration.cronSchedule.split(";")[0]?.trim()}</code>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
