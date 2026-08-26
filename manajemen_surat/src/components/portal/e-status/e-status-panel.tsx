"use client";

import { useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Database,
  Download,
  Eye,
  FileLock2,
  FileJson,
  FileSpreadsheet,
  GitBranch,
  ListChecks,
  LockKeyhole,
  RefreshCw,
  ScrollText,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  XCircle,
} from "lucide-react";

import { AccessDeniedCard, EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import {
  E_STATUS_MODULE_ID,
  E_STATUS_PERMISSION,
  hasEStatusPermission,
  resolveEStatusAccess,
} from "@/lib/e-status-types";
import { getEffectiveRoleId } from "@/lib/permissions";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string };
};

type EStatusSummary = {
  roleView: string;
  visibility: {
    canManageSettings: boolean;
    canRunSync: boolean;
    canCreateBatch: boolean;
    canApproveBatch: boolean;
    canViewAudit: boolean;
    canViewFullNik: boolean;
  };
  metrics: {
    divorceDetected: number;
    itsbatDetected: number;
    readyReview: number;
    needsReview: number;
    invalid: number;
    duplicate: number;
    waitingApproval: number;
    sent: number;
    rejected: number;
    activeAgencies: number;
    activeRules: number;
  };
  lastSync: {
    status: string;
    sync_scope: string;
    started_at: string;
    total_scanned: number;
    total_candidates: number;
    error_message: string | null;
  } | null;
  charts: {
    byAgency: Array<{ label: string; count: number }>;
    byCaseType: Array<{ label: string; count: number }>;
    rejectionReasons: Array<{ label: string; count: number }>;
    rejectionByAgency: Array<{ label: string; count: number }>;
  };
  sla: {
    averageDays: number;
    maxDays: number;
    transmittedBatches: number;
    overdueNotSent: number;
  };
  readiness: {
    sippConfigured: boolean;
    sippConnectionSource?: string;
    sippConnectionKey?: string;
    sippConnectionName?: string;
    hasPartnerAgency: boolean;
    hasValidationRules: boolean;
    hasPendingData: boolean;
  };
};

type EStatusRecord = {
  id: string;
  nomorPerkara: string;
  jenisPerkara: string;
  kategoriPerubahan: string;
  tanggalPutusan: string | null;
  tanggalBht: string | null;
  readinessScore: number;
  readinessReasons: Array<{ code: string; label: string; penalty: number; severity: string }>;
  duplicateStatus: string;
  duplicateReason: string;
  validationStatus: string;
  workflowStatus: string;
  destinationAgencyName: string | null;
  updatedAt: string;
};

type EStatusBatch = {
  id: string;
  batchNumber: string;
  batchType: string;
  destinationAgencyName: string | null;
  status: string;
  totalRecords: number;
  approvedAt: string | null;
  lockedAt: string | null;
  revisionOfBatchId: string | null;
  revisionReason: string;
  cancellationReason: string;
  cancelledAt: string | null;
  revisionCount: number;
  createdAt: string;
};

type EStatusAgency = {
  id: string;
  agencyType: string;
  agencyName: string;
  wilayah: string;
  deliveryMethod: string;
  cooperationStatus: string;
  mouNumber: string;
  mouDate: string | null;
  mouValidUntil: string | null;
  cooperationPicName: string;
  agreedDataFormat: string;
  isActive: boolean;
};

type EStatusSyncLog = {
  id: string;
  connection_key?: string;
  sync_type: string;
  sync_scope: string;
  status: string;
  total_scanned: number;
  total_candidates: number;
  total_errors: number;
  error_message: string | null;
  started_at: string;
};

type EStatusAudit = {
  id: string;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
};

type EStatusMappingPayload = {
  mappings: EStatusMapping[];
  latestSnapshot: {
    id: string;
    sourceSqlPath: string;
    schemaHash: string;
    detectedTables: Array<{ tableName: string; columns: Array<{ name: string; definition: string }> }>;
    suggestedMappings: Array<{ entityKey: string; tableName: string; columnName: string; confidenceScore: number; note: string }>;
    dangerousSqlFindings: Array<{ queryType: string; finding: string }>;
    createdAt: string;
  } | null;
};

type EStatusMapping = {
  id: string;
  entityKey: string;
  tableName: string;
  columnName: string;
  confidenceScore: number;
  detectedFromSqlSample: boolean;
  sourceSqlPath: string;
  queryPreview: string;
  queryPreviewHash: string;
  lastDryRunStatus: string;
  updatedAt: string;
};

type EStatusTemplate = {
  id: string;
  agencyName: string | null;
  templateName: string;
  templateType: string;
  changeType: string;
  format: string;
  requiredFields: unknown[];
  columns: unknown[];
  isActive: boolean;
  updatedAt: string;
};

type EStatusTracking = {
  id: string;
  batchId: string;
  batchNumber: string;
  agencyName: string | null;
  agencyType: string | null;
  method: string;
  status: string;
  sentAt: string | null;
  receivedAt: string | null;
  processedAt: string | null;
  completedAt: string | null;
  rejectedAt: string | null;
  lastStatusAt: string | null;
  receiptNumber: string;
  feedbackNote: string;
  rejectionReason: string;
  slaDays: number;
  resendCount: number;
};

type EStatusPayloadPreview = {
  batchNumber: string;
  batchType: string;
  status: string;
  generatedAt: string;
  destinationAgency: { name: string | null; type: string | null; wilayah: string | null };
  privacy: { identityMode: string; excludes: string[] };
  records: Array<{
    recordId: string;
    case: {
      caseNumber: string;
      caseType: string;
      changeType: string;
      decisionDate: string | null;
      finalLegalDate: string | null;
    };
    parties: Array<{ role: string; name: string; nik: string; city: string; newMaritalStatus: string }>;
  }>;
};

type EStatusAdvancedControls = {
  fileExchanges: Array<{
    id: string;
    batchId: string;
    batchNumber: string;
    exchangeMethod: string;
    encryptionStatus: string;
    encryptionAlgorithm: string;
    packageHash: string;
    sftpHost: string;
    destinationPath: string;
    downloadCount: number;
    status: string;
    createdAt: string;
  }>;
  integrations: Array<{
    id: string;
    agencyName: string | null;
    integrationName: string;
    apiBaseUrl: string;
    authType: string;
    rateLimitPerMinute: number;
    isActive: boolean;
    lastTestStatus: string;
  }>;
  apiRequests: Array<{
    id: string;
    batchNumber: string | null;
    agencyName: string | null;
    endpointPath: string;
    status: string;
    idempotencyKey: string;
    requestHash: string;
    attemptCount: number;
    callbackStatus: string;
    nextRetryAt: string | null;
  }>;
  incidents: Array<{
    id: string;
    incidentType: string;
    severity: string;
    status: string;
    batchNumber: string | null;
    agencyName: string | null;
    title: string;
    containmentAction: string;
    createdAt: string;
  }>;
  minimizationFindings: Array<{
    id: string;
    entityType: string;
    entityId: string;
    fieldName: string;
    findingLevel: string;
    findingCode: string;
    message: string;
    createdAt: string;
  }>;
};

async function readApi<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? fallbackMessage);
  }
  return payload?.data as T;
}

function statusVariant(status: string) {
  if (["VALID", "APPROVED", "LOCKED", "SENT", "COMPLETED", "connected", "success"].includes(status)) return "success";
  if (["NEEDS_REVIEW", "WAITING_APPROVAL", "WAITING_REVIEW", "REVISION_REQUIRED", "REVISION_DRAFT", "skipped", "simulated"].includes(status)) return "warning";
  if (["INVALID", "DUPLICATE", "REJECTED", "FAILED", "CANCELLED", "failed"].includes(status)) return "danger";
  return "outline";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function MetricTile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: ElementType;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const color =
    tone === "danger"
      ? "text-rose-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "success"
          ? "text-emerald-700"
          : "text-primary";

  return (
    <Card className="border-border/80">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardDescription className="uppercase tracking-[0.16em]">{label}</CardDescription>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  return <Badge variant={statusVariant(status)}>{status.replaceAll("_", " ")}</Badge>;
}

export function EStatusPanel() {
  const { accessibleModules, currentUser } = usePortal();
  const [section, setSection] = useState("dashboard");
  const [summary, setSummary] = useState<EStatusSummary | null>(null);
  const [records, setRecords] = useState<EStatusRecord[]>([]);
  const [batches, setBatches] = useState<EStatusBatch[]>([]);
  const [agencies, setAgencies] = useState<EStatusAgency[]>([]);
  const [syncLogs, setSyncLogs] = useState<EStatusSyncLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<EStatusAudit[]>([]);
  const [mappingData, setMappingData] = useState<EStatusMappingPayload | null>(null);
  const [templates, setTemplates] = useState<EStatusTemplate[]>([]);
  const [trackingLogs, setTrackingLogs] = useState<EStatusTracking[]>([]);
  const [payloadPreview, setPayloadPreview] = useState<EStatusPayloadPreview | null>(null);
  const [advancedControls, setAdvancedControls] = useState<EStatusAdvancedControls | null>(null);
  const [aiAssist, setAiAssist] = useState<{ outputText: string; guardrails: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const access = useMemo(() => resolveEStatusAccess(currentUser, {
    effectiveRoleId: getEffectiveRoleId(currentUser),
  }), [currentUser]);
  const hasVisibleModule = accessibleModules.some((module) => module.id === E_STATUS_MODULE_ID);

  const loadData = async () => {
    if (!currentUser || !access.canView) return;
    setLoading(true);
    setError("");
    try {
      const [summaryData, recordData, batchData, agencyData, syncData, trackingData] = await Promise.all([
        fetch(apiPath("/api/e-status/dashboard/summary"), { cache: "no-store", credentials: "include" })
          .then((response) => readApi<EStatusSummary>(response, "Gagal memuat dashboard E-Status.")),
        fetch(apiPath("/api/e-status/records?limit=20"), { cache: "no-store", credentials: "include" })
          .then((response) => readApi<EStatusRecord[]>(response, "Gagal memuat kandidat E-Status.")),
        fetch(apiPath("/api/e-status/batches"), { cache: "no-store", credentials: "include" })
          .then((response) => readApi<EStatusBatch[]>(response, "Gagal memuat batch E-Status.")),
        fetch(apiPath("/api/e-status/agencies"), { cache: "no-store", credentials: "include" })
          .then((response) => readApi<EStatusAgency[]>(response, "Gagal memuat instansi mitra.")),
        hasEStatusPermission(access, E_STATUS_PERMISSION.SIPP_SYNC_RUN)
          ? fetch(apiPath("/api/e-status/sync/logs"), { cache: "no-store", credentials: "include" })
            .then((response) => readApi<EStatusSyncLog[]>(response, "Gagal memuat log sinkronisasi."))
          : Promise.resolve([]),
        fetch(apiPath("/api/e-status/tracking"), { cache: "no-store", credentials: "include" })
          .then((response) => readApi<EStatusTracking[]>(response, "Gagal memuat tracking pengiriman.")),
      ]);
      setSummary(summaryData);
      setRecords(recordData);
      setBatches(batchData);
      setAgencies(agencyData);
      setSyncLogs(syncData);
      setTrackingLogs(trackingData);
      if (summaryData.visibility.canViewAudit) {
        const auditData = await fetch(apiPath("/api/e-status/audit"), { cache: "no-store", credentials: "include" })
          .then((response) => readApi<EStatusAudit[]>(response, "Gagal memuat audit E-Status."));
        setAuditLogs(auditData);
      }
      if (hasEStatusPermission(access, E_STATUS_PERMISSION.SIPP_MAPPING_MANAGE)) {
        const mappingPayload = await fetch(apiPath("/api/e-status/sipp/mappings"), { cache: "no-store", credentials: "include" })
          .then((response) => readApi<EStatusMappingPayload>(response, "Gagal memuat mapping SIPP."));
        setMappingData(mappingPayload);
      }
      if (hasEStatusPermission(access, E_STATUS_PERMISSION.ACCESS)) {
        const templateData = await fetch(apiPath("/api/e-status/templates"), { cache: "no-store", credentials: "include" })
          .then((response) => readApi<EStatusTemplate[]>(response, "Gagal memuat template instansi."));
        setTemplates(templateData);
      }
      if (
        hasEStatusPermission(access, E_STATUS_PERMISSION.EXCHANGE_MANAGE) ||
        hasEStatusPermission(access, E_STATUS_PERMISSION.INTEGRATION_MANAGE) ||
        hasEStatusPermission(access, E_STATUS_PERMISSION.INCIDENT_MANAGE) ||
        hasEStatusPermission(access, E_STATUS_PERMISSION.MINIMIZATION_CHECK)
      ) {
        const advancedData = await fetch(apiPath("/api/e-status/advanced"), { cache: "no-store", credentials: "include" })
          .then((response) => readApi<EStatusAdvancedControls>(response, "Gagal memuat kontrol lanjutan E-Status."));
        setAdvancedControls(advancedData);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat E-Status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, access.canView]);

  const runSync = async () => {
    setBusy("sync");
    setError("");
    try {
      await fetch(apiPath("/api/e-status/sync/run"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "ALL", mode: "dry_run" }),
      }).then((response) => readApi(response, "Sinkronisasi belum berhasil."));
      await loadData();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Sinkronisasi belum berhasil.");
    } finally {
      setBusy("");
    }
  };

  const analyzeSippSql = async () => {
    setBusy("mapping");
    setError("");
    try {
      const result = await fetch(apiPath("/api/e-status/sipp/mappings"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceSqlPath: "D:/Download File/backup_structure_data_db_2026-05-24.sql", connectionKey: "sipp_primary" }),
      }).then((response) => readApi<unknown>(response, "Analisis struktur SQL SIPP belum berhasil."));
      void result;
      await loadData();
      setSection("mapping");
    } catch (mappingError) {
      setError(mappingError instanceof Error ? mappingError.message : "Analisis struktur SQL SIPP belum berhasil.");
    } finally {
      setBusy("");
    }
  };

  const createDefaultTemplate = async () => {
    setBusy("template");
    setError("");
    try {
      await fetch(apiPath("/api/e-status/templates"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName: "Lampiran Data Perubahan Status",
          templateType: "lampiran",
          changeType: "ALL",
          format: "xlsx",
          requiredFields: ["nomor_perkara", "nama", "nik", "tanggal_putusan", "tanggal_bht", "status_baru"],
          columns: ["nomor_perkara", "jenis_perkara", "nama", "nik_masked", "status_kawin_baru", "instansi_tujuan"],
        }),
      }).then((response) => readApi(response, "Template dasar belum berhasil dibuat."));
      await loadData();
      setSection("template");
    } catch (templateError) {
      setError(templateError instanceof Error ? templateError.message : "Template dasar belum berhasil dibuat.");
    } finally {
      setBusy("");
    }
  };

  const transitionBatch = async (batchId: string, action: "submit_review" | "approve" | "lock" | "reject" | "cancel" | "create_revision") => {
    const reason = ["cancel", "create_revision", "reject"].includes(action)
      ? window.prompt("Tulis alasan resmi untuk audit trail:")?.trim()
      : "";
    if (["cancel", "create_revision", "reject"].includes(action) && !reason) return;

    setBusy(`${action}:${batchId}`);
    setError("");
    try {
      await fetch(apiPath(`/api/e-status/batches/${batchId}/transition`), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      }).then((response) => readApi(response, "Status batch belum berhasil diubah."));
      await loadData();
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : "Status batch belum berhasil diubah.");
    } finally {
      setBusy("");
    }
  };

  const openPayloadPreview = async (batchId: string) => {
    setBusy(`payload:${batchId}`);
    setError("");
    try {
      const preview = await fetch(apiPath(`/api/e-status/batches/${batchId}/payload-preview`), {
        cache: "no-store",
        credentials: "include",
      }).then((response) => readApi<EStatusPayloadPreview>(response, "Payload preview belum berhasil dimuat."));
      setPayloadPreview(preview);
      setSection("batch");
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Payload preview belum berhasil dimuat.");
    } finally {
      setBusy("");
    }
  };

  const downloadBatchExport = (batchId: string, format: "csv" | "json" = "csv") => {
    window.open(apiPath(`/api/e-status/batches/${batchId}/export?format=${format}`), "_blank", "noopener,noreferrer");
  };

  const updateTracking = async (batchId: string, status: "SENT" | "RECEIVED" | "IN_PROCESS" | "COMPLETED" | "REJECTED" | "RESENT") => {
    const needsNote = ["REJECTED", "RESENT"].includes(status);
    const note = needsNote ? window.prompt(status === "REJECTED" ? "Alasan penolakan dari instansi:" : "Alasan kirim ulang:")?.trim() : "";
    if (needsNote && !note) return;
    const receiptNumber = status === "RECEIVED" ? window.prompt("Nomor tanda terima jika ada:")?.trim() ?? "" : "";

    setBusy(`tracking:${status}:${batchId}`);
    setError("");
    try {
      await fetch(apiPath("/api/e-status/tracking"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId,
          status,
          method: "manual",
          receiptNumber,
          rejectionReason: status === "REJECTED" ? note : "",
          feedbackNote: status === "REJECTED" || status === "RESENT" ? note : "",
        }),
      }).then((response) => readApi(response, "Tracking pengiriman belum berhasil diperbarui."));
      await loadData();
    } catch (trackingError) {
      setError(trackingError instanceof Error ? trackingError.message : "Tracking pengiriman belum berhasil diperbarui.");
    } finally {
      setBusy("");
    }
  };

  const postAdvancedAction = async (body: Record<string, unknown>, fallback: string) => {
    await fetch(apiPath("/api/e-status/advanced"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((response) => readApi(response, fallback));
    await loadData();
  };

  const prepareSecureExchange = async (batchId: string) => {
    setBusy(`exchange:${batchId}`);
    setError("");
    try {
      await postAdvancedAction({
        action: "prepare_file_exchange",
        batchId,
        exchangeMethod: "manual_encrypted_file",
        encryptionAlgorithm: "AES-256",
      }, "Secure file exchange belum berhasil disiapkan.");
      setSection("advanced");
    } catch (advancedError) {
      setError(advancedError instanceof Error ? advancedError.message : "Secure file exchange belum berhasil disiapkan.");
    } finally {
      setBusy("");
    }
  };

  const prepareApiRequest = async (batchId: string) => {
    setBusy(`api:${batchId}`);
    setError("");
    try {
      await postAdvancedAction({
        action: "prepare_api_request",
        batchId,
        endpointPath: "/estatus/batches",
        method: "POST",
      }, "API request belum berhasil disiapkan.");
      setSection("advanced");
    } catch (advancedError) {
      setError(advancedError instanceof Error ? advancedError.message : "API request belum berhasil disiapkan.");
    } finally {
      setBusy("");
    }
  };

  const runAiAssist = async (feature: "batch_summary" | "draft_letter" | "sipp_mapping" | "error_analysis") => {
    setBusy(`ai:${feature}`);
    setError("");
    try {
      const result = await fetch(apiPath("/api/e-status/advanced"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ai_assist", feature, entityType: "estatus_dashboard", inputText: "Bantu operator dengan ringkasan administratif non-keputusan." }),
      }).then((response) => readApi<{ outputText: string; guardrails: string[] }>(response, "AI assist belum berhasil dibuat."));
      setAiAssist(result);
      await loadData();
      setSection("advanced");
    } catch (advancedError) {
      setError(advancedError instanceof Error ? advancedError.message : "AI assist belum berhasil dibuat.");
    } finally {
      setBusy("");
    }
  };

  const runMinimizationCheck = async () => {
    setBusy("minimization");
    setError("");
    try {
      await postAdvancedAction({
        action: "minimization_check",
        entityType: "estatus_ui_check",
        payload: {
          exportTemplateColumns: templates.flatMap((template) => template.columns),
          templateNames: templates.map((template) => template.templateName),
        },
      }, "Data minimization check belum berhasil.");
      setSection("advanced");
    } catch (advancedError) {
      setError(advancedError instanceof Error ? advancedError.message : "Data minimization check belum berhasil.");
    } finally {
      setBusy("");
    }
  };

  if (!currentUser) {
    return <EmptyState title="Memuat E-Status" description="Sesi ALETA sedang dibaca." />;
  }

  if (!hasVisibleModule || !access.canView) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="ALETA"
        title="E-Status"
        description="Elektronik Sinkronisasi Status Perkawinan untuk perkara cerai BHT dan itsbat nikah dikabulkan."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void loadData()} variant="outline" disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              Muat Ulang
            </Button>
            {summary?.visibility.canRunSync ? (
              <Button onClick={() => void runSync()} disabled={busy === "sync"}>
                <Database className="h-4 w-4" />
                Sinkronisasi
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <Card className="border-amber-200/80 bg-amber-50/70">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[260px_1fr]">
        <div className="space-y-3">
          <NativeSelect value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="dashboard">Dashboard</option>
            <option value="kandidat">Kandidat Data</option>
            <option value="batch">Batch Pengiriman</option>
            <option value="tracking">Tracking & SLA</option>
            <option value="instansi">Instansi Mitra</option>
            <option value="sinkronisasi">Sinkronisasi SIPP</option>
            {hasEStatusPermission(access, E_STATUS_PERMISSION.SIPP_MAPPING_MANAGE) ? <option value="mapping">Mapping SIPP</option> : null}
            {hasEStatusPermission(access, E_STATUS_PERMISSION.ACCESS) ? <option value="template">Template Instansi</option> : null}
            {advancedControls ? <option value="advanced">Kontrol Lanjutan</option> : null}
            {summary?.visibility.canViewAudit ? <option value="audit">Audit Trail</option> : null}
          </NativeSelect>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle className="text-base">Kesiapan Modul</CardTitle>
              <CardDescription>Ringkas status konfigurasi inti.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                [summary?.readiness.sippConnectionName ?? "Koneksi SIPP", summary?.readiness.sippConfigured],
                ["Instansi mitra", summary?.readiness.hasPartnerAgency],
                ["Rule validasi", summary?.readiness.hasValidationRules],
                ["Mapping SIPP", (mappingData?.mappings.length ?? 0) > 0],
                ["Template instansi", templates.length > 0],
                ["Kontrol lanjutan", Boolean(advancedControls)],
                ["Data pending", summary?.readiness.hasPendingData],
              ].map(([label, ok]) => (
                <div key={String(label)} className="flex items-center justify-between gap-3 rounded-lg border border-border/80 p-2 text-sm">
                  <span>{label}</span>
                  <Badge variant={ok ? "success" : "warning"}>{ok ? "Siap" : "Perlu cek"}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {section === "dashboard" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile label="Cerai BHT" value={summary?.metrics.divorceDetected ?? 0} icon={ShieldCheck} />
                <MetricTile label="Itsbat Dikabulkan" value={summary?.metrics.itsbatDetected ?? 0} icon={CheckCircle2} />
                <MetricTile label="Siap Review" value={summary?.metrics.readyReview ?? 0} icon={FileSpreadsheet} tone="success" />
                <MetricTile label="Perlu Review" value={summary?.metrics.needsReview ?? 0} icon={AlertTriangle} tone="warning" />
                <MetricTile label="Bermasalah" value={summary?.metrics.invalid ?? 0} icon={AlertTriangle} tone="danger" />
                <MetricTile label="Menunggu Approval" value={summary?.metrics.waitingApproval ?? 0} icon={LockKeyhole} tone="warning" />
                <MetricTile label="Batch Dikirim" value={summary?.metrics.sent ?? 0} icon={FileSpreadsheet} />
                <MetricTile label="Ditolak/Gagal" value={summary?.metrics.rejected ?? 0} icon={AlertTriangle} tone="danger" />
                <MetricTile label="Rata-Rata SLA" value={summary?.sla.averageDays ?? 0} icon={Timer} />
                <MetricTile label="Belum Terkirim >7 Hari" value={summary?.sla.overdueNotSent ?? 0} icon={AlertTriangle} tone="warning" />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle>Status Sinkronisasi</CardTitle>
                    <CardDescription>Log terakhir dari provider SIPP read-only.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {summary?.lastSync ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span>{formatDate(summary.lastSync.started_at)}</span>
                          <StatusPill status={summary.lastSync.status} />
                        </div>
                        <p className="text-muted-foreground">{summary.lastSync.error_message ?? "Sinkronisasi selesai tanpa pesan error."}</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Belum ada log sinkronisasi.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle>Sebaran Instansi</CardTitle>
                    <CardDescription>Data kandidat menurut instansi tujuan.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(summary?.charts.byAgency.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada data instansi tujuan.</p>
                    ) : summary?.charts.byAgency.map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-lg border border-border/80 p-3 text-sm">
                        <span>{item.label}</span>
                        <Badge variant="outline">{item.count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle>Dashboard Penolakan</CardTitle>
                    <CardDescription>Alasan penolakan terbanyak dari instansi mitra.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(summary?.charts.rejectionReasons.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada data penolakan.</p>
                    ) : summary?.charts.rejectionReasons.map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-lg border border-border/80 p-3 text-sm">
                        <span>{item.label}</span>
                        <Badge variant="danger">{item.count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle>Instansi Sering Reject</CardTitle>
                    <CardDescription>Distribusi penolakan berdasarkan instansi tujuan.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {(summary?.charts.rejectionByAgency.length ?? 0) === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada data instansi yang menolak.</p>
                    ) : summary?.charts.rejectionByAgency.map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-lg border border-border/80 p-3 text-sm">
                        <span>{item.label}</span>
                        <Badge variant="outline">{item.count}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}

          {section === "kandidat" ? (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Kandidat Data</CardTitle>
                <CardDescription>Data kandidat dari SIPP yang tersimpan di E-Status.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {records.length === 0 ? (
                  <EmptyState title="Belum ada kandidat" description="Sinkronisasi belum menghasilkan kandidat E-Status." />
                ) : records.map((record) => (
                  <div key={record.id} className="rounded-lg border border-border/80 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{record.nomorPerkara}</p>
                        <p className="text-sm text-muted-foreground">{record.jenisPerkara} - {record.kategoriPerubahan}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Putus {record.tanggalPutusan ?? "-"} - BHT {record.tanggalBht ?? "-"}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          <Badge variant={record.readinessScore >= 85 ? "success" : record.readinessScore >= 60 ? "warning" : "danger"}>
                            Readiness {record.readinessScore}%
                          </Badge>
                          {record.duplicateStatus !== "none" ? <Badge variant="danger">Duplikat</Badge> : null}
                          {record.destinationAgencyName ? <Badge variant="outline">{record.destinationAgencyName}</Badge> : null}
                        </div>
                        {(record.readinessReasons?.length ?? 0) > 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {record.readinessReasons.slice(0, 2).map((reason) => reason.label).join("; ")}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill status={record.validationStatus} />
                        <StatusPill status={record.workflowStatus} />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {section === "batch" ? (
            <>
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Batch Pengiriman</CardTitle>
                <CardDescription>Batch yang dibuat, disetujui, dikunci, dan dikirim.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {batches.length === 0 ? (
                  <EmptyState title="Belum ada batch" description="Batch akan muncul setelah operator memilih data kandidat." />
                ) : batches.map((batch) => (
                  <div key={batch.id} className="flex flex-col gap-3 rounded-lg border border-border/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{batch.batchNumber}</p>
                      <p className="text-sm text-muted-foreground">{batch.batchType} - {batch.destinationAgencyName ?? "Instansi belum dipilih"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{batch.totalRecords} data - {formatDate(batch.createdAt)}</p>
                      {batch.revisionOfBatchId ? (
                        <p className="mt-1 text-xs text-muted-foreground">Revisi dari batch {batch.revisionOfBatchId}</p>
                      ) : null}
                      {batch.revisionReason || batch.cancellationReason ? (
                        <p className="mt-1 text-xs text-muted-foreground">{batch.revisionReason || batch.cancellationReason}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={batch.status} />
                      {batch.revisionCount > 0 ? <Badge variant="warning">{batch.revisionCount} revisi</Badge> : null}
                      {hasEStatusPermission(access, E_STATUS_PERMISSION.BATCH_REVIEW) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `payload:${batch.id}`}
                          onClick={() => void openPayloadPreview(batch.id)}
                        >
                          <Eye className="h-4 w-4" />
                          Payload
                        </Button>
                      ) : null}
                      {hasEStatusPermission(access, E_STATUS_PERMISSION.BATCH_EXPORT) ? (
                        <Button size="sm" variant="outline" onClick={() => downloadBatchExport(batch.id)}>
                          <Download className="h-4 w-4" />
                          Export
                        </Button>
                      ) : null}
                      {hasEStatusPermission(access, E_STATUS_PERMISSION.EXCHANGE_MANAGE) && ["LOCKED", "SENT", "RECEIVED", "IN_PROCESS", "COMPLETED"].includes(batch.status) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `exchange:${batch.id}`}
                          onClick={() => void prepareSecureExchange(batch.id)}
                        >
                          <FileLock2 className="h-4 w-4" />
                          Secure File
                        </Button>
                      ) : null}
                      {hasEStatusPermission(access, E_STATUS_PERMISSION.INTEGRATION_MANAGE) && ["LOCKED", "SENT"].includes(batch.status) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `api:${batch.id}`}
                          onClick={() => void prepareApiRequest(batch.id)}
                        >
                          <FileJson className="h-4 w-4" />
                          API Prep
                        </Button>
                      ) : null}
                      {summary?.visibility.canCreateBatch && batch.status === "DRAFT" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `submit_review:${batch.id}`}
                          onClick={() => void transitionBatch(batch.id, "submit_review")}
                        >
                          <ListChecks className="h-4 w-4" />
                          Review
                        </Button>
                      ) : null}
                      {summary?.visibility.canApproveBatch && ["DRAFT", "WAITING_APPROVAL"].includes(batch.status) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `approve:${batch.id}`}
                          onClick={() => void transitionBatch(batch.id, "approve")}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Setujui
                        </Button>
                      ) : null}
                      {hasEStatusPermission(access, E_STATUS_PERMISSION.BATCH_LOCK) && batch.status === "APPROVED" ? (
                        <Button
                          size="sm"
                          disabled={busy === `lock:${batch.id}`}
                          onClick={() => void transitionBatch(batch.id, "lock")}
                        >
                          <LockKeyhole className="h-4 w-4" />
                          Kunci
                        </Button>
                      ) : null}
                      {hasEStatusPermission(access, E_STATUS_PERMISSION.TRANSMISSION_SEND) && ["LOCKED", "APPROVED"].includes(batch.status) ? (
                        <Button
                          size="sm"
                          disabled={busy === `tracking:SENT:${batch.id}`}
                          onClick={() => void updateTracking(batch.id, "SENT")}
                        >
                          <Send className="h-4 w-4" />
                          Dikirim
                        </Button>
                      ) : null}
                      {hasEStatusPermission(access, E_STATUS_PERMISSION.BATCH_REVISION) && ["LOCKED", "SENT", "RECEIVED", "IN_PROCESS", "COMPLETED", "REJECTED", "REVISION_REQUIRED"].includes(batch.status) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `create_revision:${batch.id}`}
                          onClick={() => void transitionBatch(batch.id, "create_revision")}
                        >
                          <GitBranch className="h-4 w-4" />
                          Revisi
                        </Button>
                      ) : null}
                      {hasEStatusPermission(access, E_STATUS_PERMISSION.BATCH_REVISION) && ["LOCKED", "APPROVED", "WAITING_APPROVAL"].includes(batch.status) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === `cancel:${batch.id}`}
                          onClick={() => void transitionBatch(batch.id, "cancel")}
                        >
                          <XCircle className="h-4 w-4" />
                          Batalkan
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            {payloadPreview ? (
              <Card className="border-border/80">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Payload Preview Minimal</CardTitle>
                      <CardDescription>
                        {payloadPreview.batchNumber} - {payloadPreview.destinationAgency.name ?? "Instansi belum dipilih"}
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{payloadPreview.privacy.identityMode}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {payloadPreview.records.slice(0, 5).map((record) => (
                    <div key={record.recordId} className="rounded-lg border border-border/80 p-4">
                      <p className="font-semibold text-foreground">{record.case.caseNumber}</p>
                      <p className="text-sm text-muted-foreground">{record.case.caseType} - {record.case.changeType}</p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {record.parties.map((party) => (
                          <div key={`${record.recordId}-${party.role}-${party.name}`} className="rounded-lg bg-muted/50 p-3 text-sm">
                            <p className="font-medium text-foreground">{party.role}: {party.name}</p>
                            <p className="text-xs text-muted-foreground">NIK {party.nik || "-"} - {party.city || "-"}</p>
                            <p className="text-xs text-muted-foreground">Status baru {party.newMaritalStatus || "-"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {payloadPreview.records.length > 5 ? (
                    <p className="text-xs text-muted-foreground">Menampilkan 5 dari {payloadPreview.records.length} perkara. Export tetap memuat seluruh data minimal.</p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
            </>
          ) : null}

          {section === "tracking" ? (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Tracking Pengiriman & SLA</CardTitle>
                <CardDescription>Status diterima, diproses, selesai, ditolak, dan kirim ulang ke instansi mitra.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {trackingLogs.length === 0 ? (
                  <EmptyState title="Belum ada tracking" description="Tandai batch sebagai dikirim untuk memulai pelacakan SLA." />
                ) : trackingLogs.map((tracking) => (
                  <div key={tracking.id} className="rounded-lg border border-border/80 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{tracking.batchNumber}</p>
                        <p className="text-sm text-muted-foreground">
                          {tracking.agencyName ?? "Instansi belum dipilih"} - {tracking.method}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          SLA {tracking.slaDays} hari - terakhir {formatDate(tracking.lastStatusAt ?? tracking.sentAt)}
                        </p>
                        {tracking.rejectionReason ? (
                          <p className="mt-2 text-xs text-rose-700">Ditolak: {tracking.rejectionReason}</p>
                        ) : tracking.feedbackNote ? (
                          <p className="mt-2 text-xs text-muted-foreground">{tracking.feedbackNote}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusPill status={tracking.status} />
                        {tracking.receiptNumber ? <Badge variant="outline">TT {tracking.receiptNumber}</Badge> : null}
                        {hasEStatusPermission(access, E_STATUS_PERMISSION.TRANSMISSION_FOLLOWUP) ? (
                          <>
                            {tracking.status === "SENT" ? (
                              <Button size="sm" variant="outline" onClick={() => void updateTracking(tracking.batchId, "RECEIVED")}>Diterima</Button>
                            ) : null}
                            {["SENT", "RECEIVED"].includes(tracking.status) ? (
                              <Button size="sm" variant="outline" onClick={() => void updateTracking(tracking.batchId, "IN_PROCESS")}>Diproses</Button>
                            ) : null}
                            {["SENT", "RECEIVED", "IN_PROCESS"].includes(tracking.status) ? (
                              <Button size="sm" variant="outline" onClick={() => void updateTracking(tracking.batchId, "COMPLETED")}>Selesai</Button>
                            ) : null}
                            {tracking.status !== "COMPLETED" ? (
                              <Button size="sm" variant="outline" onClick={() => void updateTracking(tracking.batchId, "REJECTED")}>Ditolak</Button>
                            ) : null}
                            {["REJECTED", "FAILED"].includes(tracking.status) ? (
                              <Button size="sm" variant="outline" onClick={() => void updateTracking(tracking.batchId, "RESENT")}>Kirim Ulang</Button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {section === "instansi" ? (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Instansi Mitra</CardTitle>
                <CardDescription>Master Dukcapil, KUA, dan Kemenag.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-2">
                {agencies.length === 0 ? (
                  <div className="lg:col-span-2">
                    <EmptyState title="Instansi mitra belum diisi" description="Data instansi mitra akan menjadi tujuan batch pengiriman." />
                  </div>
                ) : agencies.map((agency) => (
                  <div key={agency.id} className="rounded-lg border border-border/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{agency.agencyName}</p>
                        <p className="text-sm text-muted-foreground">{agency.agencyType} - {agency.wilayah || "-"}</p>
                      </div>
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">{agency.deliveryMethod}</Badge>
                      <Badge variant={agency.cooperationStatus === "active" ? "success" : "warning"}>
                        {agency.cooperationStatus}
                      </Badge>
                      {agency.mouNumber ? <Badge variant="muted">{agency.mouNumber}</Badge> : null}
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <p>MoU/PKS: {agency.mouNumber || "-"} {agency.mouValidUntil ? `(berlaku sampai ${agency.mouValidUntil})` : ""}</p>
                      <p>PIC: {agency.cooperationPicName || "-"}</p>
                      <p>Format data: {agency.agreedDataFormat || "Belum disepakati"}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {section === "sinkronisasi" ? (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Log Sinkronisasi SIPP</CardTitle>
                <CardDescription>Semua sinkronisasi dicatat sebagai operasi read-only.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {syncLogs.length === 0 ? (
                  <EmptyState title="Belum ada log" description="Belum ada sinkronisasi manual atau terjadwal." />
                ) : syncLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-border/80 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{log.sync_scope} - {log.sync_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {log.connection_key ?? "sipp_primary"} - Scan {log.total_scanned}, kandidat {log.total_candidates}, error {log.total_errors}
                        </p>
                        {log.error_message ? <p className="mt-1 text-xs text-muted-foreground">{log.error_message}</p> : null}
                      </div>
                      <StatusPill status={log.status} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {section === "mapping" && hasEStatusPermission(access, E_STATUS_PERMISSION.SIPP_MAPPING_MANAGE) ? (
            <div className="space-y-4">
              <Card className="border-border/80">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Mapping SIPP</CardTitle>
                      <CardDescription>Deteksi struktur dari backup_structure_data_db_2026-05-24.sql dan simpan versi mapping.</CardDescription>
                    </div>
                    <Button onClick={() => void analyzeSippSql()} disabled={busy === "mapping"}>
                      <FileJson className="h-4 w-4" />
                      Analisis SQL
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mappingData?.latestSnapshot ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-border/80 p-3 text-sm">
                        <p className="text-muted-foreground">Tabel terdeteksi</p>
                        <p className="mt-1 text-2xl font-semibold">{mappingData.latestSnapshot.detectedTables.length}</p>
                      </div>
                      <div className="rounded-lg border border-border/80 p-3 text-sm">
                        <p className="text-muted-foreground">Usulan mapping</p>
                        <p className="mt-1 text-2xl font-semibold">{mappingData.latestSnapshot.suggestedMappings.length}</p>
                      </div>
                      <div className="rounded-lg border border-border/80 p-3 text-sm">
                        <p className="text-muted-foreground">Temuan query</p>
                        <p className="mt-1 text-2xl font-semibold">{mappingData.latestSnapshot.dangerousSqlFindings.length}</p>
                      </div>
                    </div>
                  ) : (
                    <EmptyState title="Belum ada snapshot SIPP" description="Jalankan analisis SQL untuk membuat mapping awal." />
                  )}

                  {mappingData?.mappings.length ? (
                    <div className="space-y-3">
                      {mappingData.mappings.slice(0, 12).map((mapping) => (
                        <div key={mapping.id} className="rounded-lg border border-border/80 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold text-foreground">{mapping.entityKey}</p>
                              <p className="text-sm text-muted-foreground">{mapping.tableName}.{mapping.columnName}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{Math.round(mapping.confidenceScore * 100)}%</Badge>
                              {mapping.detectedFromSqlSample ? <Badge variant="success">SQL sample</Badge> : null}
                            </div>
                          </div>
                          {mapping.queryPreview ? (
                            <pre className="mt-3 max-h-36 overflow-auto rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                              {mapping.queryPreview}
                            </pre>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {section === "template" ? (
            <Card className="border-border/80">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Template Instansi</CardTitle>
                    <CardDescription>Format lampiran, surat, dan payload bisa dibedakan per Dukcapil, KUA, atau Kemenag.</CardDescription>
                  </div>
                  {hasEStatusPermission(access, E_STATUS_PERMISSION.TEMPLATES_MANAGE) ? (
                    <Button onClick={() => void createDefaultTemplate()} disabled={busy === "template"}>
                      <ScrollText className="h-4 w-4" />
                      Template Dasar
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {templates.length === 0 ? (
                  <EmptyState title="Template belum tersedia" description="Buat template dasar atau tambahkan format sesuai permintaan instansi mitra." />
                ) : templates.map((template) => (
                  <div key={template.id} className="rounded-lg border border-border/80 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{template.templateName}</p>
                        <p className="text-sm text-muted-foreground">
                          {template.agencyName ?? "Semua instansi"} - {template.changeType}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {template.requiredFields.length} field wajib - {template.columns.length} kolom ekspor
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{template.templateType}</Badge>
                        <Badge variant="outline">{template.format}</Badge>
                        <Badge variant={template.isActive ? "success" : "warning"}>{template.isActive ? "Aktif" : "Nonaktif"}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {section === "advanced" && advancedControls ? (
            <div className="space-y-4">
              <Card className="border-border/80">
                <CardHeader>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <CardTitle>Kontrol Lanjutan</CardTitle>
                      <CardDescription>Secure file exchange, API integration, AI assist terbatas, incident log, dan data minimization guard.</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {hasEStatusPermission(access, E_STATUS_PERMISSION.AI_ASSIST_USE) ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => void runAiAssist("batch_summary")}>
                            <Sparkles className="h-4 w-4" />
                            Ringkas Batch
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void runAiAssist("draft_letter")}>
                            <ScrollText className="h-4 w-4" />
                            Draft Surat
                          </Button>
                        </>
                      ) : null}
                      {hasEStatusPermission(access, E_STATUS_PERMISSION.MINIMIZATION_CHECK) ? (
                        <Button size="sm" onClick={() => void runMinimizationCheck()} disabled={busy === "minimization"}>
                          <ShieldCheck className="h-4 w-4" />
                          Cek Minimalisasi
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-border/80 p-3">
                    <p className="text-sm text-muted-foreground">Secure exchange</p>
                    <p className="mt-1 text-2xl font-semibold">{advancedControls.fileExchanges.length}</p>
                  </div>
                  <div className="rounded-lg border border-border/80 p-3">
                    <p className="text-sm text-muted-foreground">API request</p>
                    <p className="mt-1 text-2xl font-semibold">{advancedControls.apiRequests.length}</p>
                  </div>
                  <div className="rounded-lg border border-border/80 p-3">
                    <p className="text-sm text-muted-foreground">Insiden terbuka</p>
                    <p className="mt-1 text-2xl font-semibold">{advancedControls.incidents.filter((item) => item.status !== "closed").length}</p>
                  </div>
                  <div className="rounded-lg border border-border/80 p-3">
                    <p className="text-sm text-muted-foreground">Temuan minimalisasi</p>
                    <p className="mt-1 text-2xl font-semibold">{advancedControls.minimizationFindings.length}</p>
                  </div>
                </CardContent>
              </Card>

              {aiAssist ? (
                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle>AI Assist Terbatas</CardTitle>
                    <CardDescription>Output ini wajib direview manusia dan tidak menentukan status hukum.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="rounded-lg bg-muted/60 p-3">{aiAssist.outputText}</p>
                    <div className="flex flex-wrap gap-2">
                      {aiAssist.guardrails.map((guardrail) => (
                        <Badge key={guardrail} variant="outline">{guardrail}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle>Secure File Exchange</CardTitle>
                    <CardDescription>Enkripsi file, password per batch, SFTP, download log, dan bukti penerimaan.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {advancedControls.fileExchanges.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada paket file aman yang disiapkan.</p>
                    ) : advancedControls.fileExchanges.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border/80 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{item.batchNumber}</p>
                            <p className="text-muted-foreground">{item.exchangeMethod} - {item.encryptionAlgorithm}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{item.packageHash}</p>
                          </div>
                          <StatusPill status={item.status} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle>API Integration</CardTitle>
                    <CardDescription>Token, signature, timestamp, idempotency key, callback, retry, dan rate limit.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {advancedControls.apiRequests.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada API request yang disiapkan.</p>
                    ) : advancedControls.apiRequests.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border/80 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{item.batchNumber ?? "Batch"}</p>
                            <p className="text-muted-foreground">{item.endpointPath} - attempt {item.attemptCount}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{item.idempotencyKey}</p>
                          </div>
                          <StatusPill status={item.status} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle>Incident Log</CardTitle>
                    <CardDescription>Salah kirim, data bocor, gagal integrasi, batch salah tujuan, dan komplain instansi.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {advancedControls.incidents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada insiden E-Status.</p>
                    ) : advancedControls.incidents.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border/80 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{item.title}</p>
                            <p className="text-muted-foreground">{item.incidentType} - {item.agencyName ?? item.batchNumber ?? "-"}</p>
                            {item.containmentAction ? <p className="mt-1 text-xs text-muted-foreground">{item.containmentAction}</p> : null}
                          </div>
                          <Badge variant={item.severity === "critical" ? "danger" : "warning"}>{item.severity}</Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle>Data Minimization Guard</CardTitle>
                    <CardDescription>Peringatan jika template/payload mencoba memuat data yang tidak perlu.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {advancedControls.minimizationFindings.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Tidak ada temuan aktif.</p>
                    ) : advancedControls.minimizationFindings.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border/80 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{item.findingCode}</p>
                            <p className="text-muted-foreground">{item.message}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{item.entityType} - {item.fieldName}</p>
                          </div>
                          <Badge variant={item.findingLevel === "critical" ? "danger" : "warning"}>{item.findingLevel}</Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}

          {section === "audit" && summary?.visibility.canViewAudit ? (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Audit Trail E-Status</CardTitle>
                <CardDescription>Aktivitas penting modul E-Status.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {auditLogs.length === 0 ? (
                  <EmptyState title="Audit masih kosong" description="Aktivitas E-Status akan tercatat di sini." />
                ) : auditLogs.map((item) => (
                  <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-border/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{item.action}</p>
                      <p className="text-sm text-muted-foreground">{item.entity_type} - {item.user_name ?? "User"}</p>
                    </div>
                    <Badge variant="outline">{formatDate(item.created_at)}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
