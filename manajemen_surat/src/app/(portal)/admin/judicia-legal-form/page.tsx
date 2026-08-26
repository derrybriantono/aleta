"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Bot, Database, MessageSquare, QrCode, RefreshCw, Scale, ShieldCheck, Sparkles, UsersRound } from "lucide-react";

import {
  JlfAdminTabPanel,
  JlfLoadingState,
} from "@/components/portal/judicia/legal-form/jlf-foundation";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { listJlfSippQueryPreviewDefinitions } from "@/lib/judicia-legal-form-query-preview";
import {
  getJudiciaLegalFormAdminTabs,
  hasJudiciaLegalFormPermission,
  JLF_PERMISSION,
  JUDICIA_LEGAL_FORM_ROUTE,
  resolveJudiciaLegalFormAccess,
} from "@/lib/judicia-legal-form-types";
import { getEffectiveRoleId, getUserPositionLabel } from "@/lib/permissions";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string };
};

type JlfSettingsSummary = {
  general: {
    enabled: boolean;
    defaultLanding: string;
    retentionPolicyDays: number;
    storeGeneratedFiles: boolean;
    qrVerificationEnabled: boolean;
    uploadMaxFileSizeMb: number;
  };
  template: {
    allowedTemplateTypes: string[];
    allowedAnonymizerTypes: string[];
    maxUploadSizeMb: number;
    legacyPlaceholderSupportEnabled: boolean;
    modernPlaceholderSupportEnabled: boolean;
    defaultRequiresValidation: boolean;
  };
  sipp: {
    provider: string;
    enabled: boolean;
    providerMode: string;
    searchLimit: number;
    queryTimeoutMs: number;
    readOnly: boolean;
    rawSqlEndpoint: boolean;
    directMysqlDependencyInstalled: boolean;
    health: { ok: boolean; status: string; message: string; latencyMs?: number };
  };
  ai: {
    enabled: boolean;
    useGlobalAletaAiSettings: boolean;
    redactionEnabled: boolean;
    logInputs: boolean;
    logOutputs: boolean;
    maxInputChars: number;
    legalAnalysisEnabled: boolean;
    requireVerifiedRegulations: boolean;
    global: {
      status: {
        enabled: boolean;
        providerId: string;
        modelId: string;
        activeConnectionLabel: string | null;
        activeConnectionStatus: string;
        providersCount: number;
        liveProvidersCount: number;
      };
      policy: {
        usesGlobalAletaAiSettings: boolean;
        createsSeparateProvider: boolean;
        exposesApiKey: boolean;
        callsProviderInThisStage: boolean;
      };
    };
  };
  whatsapp: {
    enabled: boolean;
    useGlobalAletaBotGateway: boolean;
    sendValidationNotifications: boolean;
    sendDocumentReadyNotifications: boolean;
    sendRegulationReviewNotifications: boolean;
    gateway: {
      runtimeMode: string;
      connected: boolean;
      status: string;
      sessionName: string;
      lastConnectedAt: string | null;
      exposesToken: boolean;
    };
    aletaBot: {
      botEnabled: boolean;
      notificationsEnabled: boolean;
      dryRunEnabled: boolean;
      exposesToken: boolean;
    };
  };
  accountSync: {
    enabled: boolean;
    autoSuggestionEnabled: boolean;
    selfClaimEnabled: boolean;
    conflictHandling: string;
    snapshotPolicy: string;
  };
  roleMapping: {
    autoApplyDefault: boolean;
    approvalRequired: boolean;
  };
  legalKnowledgeBase: {
    requireVerification: boolean;
    verifiedOnlyAiMode: boolean;
    ingestionPolicy: string;
  };
  qrVerification: {
    enabled: boolean;
    publicVerificationMode: string;
    tokenExpiryDays: number;
    publicVisibleFields: string[];
  };
  legacyImport: { enabled: boolean; dryRunOnly: boolean; lastReportStatus: string; legacyOnly: boolean };
  retention: {
    auditLogDays: number;
    documentDays: number;
    aiLogDays: number;
    whatsappLogDays: number;
  };
  secretsExposed: boolean;
};

type JlfWhatsappTemplate = {
  id: string;
  key: string;
  name: string;
  eventType: string;
  messageTemplate: string;
  isActive: boolean;
};

type JlfWhatsappLog = {
  id: string;
  eventType: string;
  recipientPhoneMasked: string;
  relatedEntityId: string;
  messagePreview: string;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Permintaan pengaturan JLF belum berhasil.");
  }
  return payload?.data as T;
}

async function fetchJlfSettingsSummary() {
  return readApi<JlfSettingsSummary>(
    await fetch(apiPath("/api/judicia/legal-form/settings/summary"), {
      cache: "no-store",
      credentials: "include",
    })
  );
}

function SettingSwitch({
  checked,
  disabled,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

function SettingInput({
  label,
  description,
  initialValue,
  disabled,
  onSave,
}: {
  label: string;
  description: string;
  initialValue: string;
  disabled?: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <div className="grid gap-3 rounded-xl border border-border/80 bg-muted/30 p-4 md:grid-cols-[1fr_auto]">
      <div className="space-y-2">
        <div>
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <Input value={value} onChange={(event) => setValue(event.target.value)} disabled={disabled} />
      </div>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => onSave(value)} className="self-end">
        Simpan
      </Button>
    </div>
  );
}

function StatusLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/80 bg-muted/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function JlfQrVerificationAdminPanel({
  busy,
  summary,
  updateSetting,
}: {
  busy: boolean;
  summary: JlfSettingsSummary;
  updateSetting: (key: string, value: unknown) => void;
}) {
  return (
    <Card className="mt-4 border-border/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          QR & Verifikasi Dokumen
        </CardTitle>
        <CardDescription>Token verifikasi disimpan sebagai hash. Public verify hanya menampilkan data minimal.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <SettingSwitch
          checked={summary.general.qrVerificationEnabled}
          disabled={busy}
          label="Aktifkan QR verification"
          description="QR payload memakai token sulit ditebak, tanpa file path dan tanpa isi perkara sensitif."
          onChange={(checked) => updateSetting("jlf.document.qr_verification_enabled", checked)}
        />
        <SettingInput
          label="Public verification mode"
          description="Mode data publik, misalnya minimal_masked."
          initialValue={summary.qrVerification.publicVerificationMode}
          disabled={busy}
          onSave={(value) => updateSetting("jlf.qr.public_verification_mode", value || "minimal_masked")}
        />
        <SettingInput
          label="Token expiry days"
          description="0 berarti belum memakai expiry otomatis."
          initialValue={String(summary.qrVerification.tokenExpiryDays)}
          disabled={busy}
          onSave={(value) => updateSetting("jlf.qr.token_expiry_days", Number(value) || 0)}
        />
        <SettingInput
          label="Public visible fields"
          description="Daftar field publik ter-mask, pisahkan dengan koma."
          initialValue={summary.qrVerification.publicVisibleFields.join(", ")}
          disabled={busy}
          onSave={(value) => updateSetting("jlf.qr.public_visible_fields", value.split(",").map((item) => item.trim()).filter(Boolean))}
        />
        <SettingSwitch
          checked={summary.general.storeGeneratedFiles}
          disabled={busy}
          label="Simpan file hasil generate"
          description="File hasil generate tetap berada di storage private dan hanya dapat diunduh via route authorized."
          onChange={(checked) => updateSetting("jlf.document.store_generated_files", checked)}
        />
        <div className="grid gap-3 md:grid-cols-3">
          <StatusLine label="Public verify route" value="/judicia/legal-form/verify/[token]" />
          <StatusLine label="Token storage" value="SHA-256 hash" />
          <StatusLine label="Public data" value="Minimal dan masked" />
        </div>
      </CardContent>
    </Card>
  );
}

function JlfWhatsappAdminPanel({
  busy,
  summary,
  updateSetting,
}: {
  busy: boolean;
  summary: JlfSettingsSummary;
  updateSetting: (key: string, value: unknown) => void;
}) {
  const [templates, setTemplates] = useState<JlfWhatsappTemplate[]>([]);
  const [logs, setLogs] = useState<JlfWhatsappLog[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadWhatsappData() {
    setLoading(true);
    try {
      const [templateData, logData] = await Promise.all([
        readApi<{ items: JlfWhatsappTemplate[] }>(
          await fetch(apiPath("/api/judicia/legal-form/whatsapp/templates"), {
            cache: "no-store",
            credentials: "include",
          })
        ),
        readApi<{ items: JlfWhatsappLog[] }>(
          await fetch(apiPath("/api/judicia/legal-form/whatsapp/logs?limit=20"), {
            cache: "no-store",
            credentials: "include",
          })
        ),
      ]);
      setTemplates(templateData.items ?? []);
      setLogs(logData.items ?? []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat template/log WhatsApp JLF.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadWhatsappData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!selectedTemplate) return;
    const template = templates.find((item) => item.id === selectedTemplate);
    const timer = window.setTimeout(() => {
      setMessageTemplate(template?.messageTemplate ?? "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedTemplate, templates]);

  async function saveTemplate() {
    if (!selectedTemplate || !messageTemplate.trim()) return;
    setLoading(true);
    try {
      await readApi(
        await fetch(apiPath("/api/judicia/legal-form/whatsapp/templates"), {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedTemplate, messageTemplate }),
        })
      );
      setMessage("Template pesan WhatsApp JLF diperbarui.");
      await loadWhatsappData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan template pesan.");
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    if (!testPhone.trim()) return;
    setLoading(true);
    try {
      await readApi(
        await fetch(apiPath("/api/judicia/legal-form/whatsapp/test-safe"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientPhone: testPhone, eventType: "document_ready" }),
        })
      );
      setMessage("Test-safe WhatsApp diproses sebagai pesan aman/dry-run.");
      await loadWhatsappData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Test-safe WhatsApp gagal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-4 border-border/80">
      <CardHeader>
        <CardTitle>Status ALETA Bot/WhatsApp</CardTitle>
        <CardDescription>JLF memakai gateway global. Token gateway tidak disimpan di tabel JLF.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <StatusLine label="Runtime" value={summary.whatsapp.gateway.runtimeMode} />
        <StatusLine label="Gateway" value={summary.whatsapp.gateway.status} />
        <StatusLine label="ALETA Bot" value={summary.whatsapp.aletaBot.botEnabled ? "Aktif" : "Nonaktif"} />
        <StatusLine label="Secret" value={summary.whatsapp.gateway.exposesToken ? "Terbuka" : "Tidak ditampilkan"} />
        <div className="grid gap-3 md:col-span-2">
          <SettingSwitch
            checked={summary.whatsapp.enabled}
            disabled={busy}
            label="Notifikasi WhatsApp JLF"
            description="Notifikasi ringkas melalui gateway global, link dokumen tetap butuh login."
            onChange={(checked) => updateSetting("jlf.whatsapp.enabled", checked)}
          />
          <SettingSwitch
            checked={summary.whatsapp.sendValidationNotifications}
            disabled={busy}
            label="Event validasi"
            description="document_waiting_validation dan document_change_requested."
            onChange={(checked) => updateSetting("jlf.whatsapp.send_validation_notifications", checked)}
          />
          <SettingSwitch
            checked={summary.whatsapp.sendDocumentReadyNotifications}
            disabled={busy}
            label="Event dokumen siap"
            description="document_approved, document_rejected, document_finalized, dan document_ready."
            onChange={(checked) => updateSetting("jlf.whatsapp.send_document_ready_notifications", checked)}
          />
          <SettingSwitch
            checked={summary.whatsapp.sendRegulationReviewNotifications}
            disabled={busy}
            label="Event review peraturan"
            description="regulation_needs_review untuk Legal Knowledge Base."
            onChange={(checked) => updateSetting("jlf.whatsapp.send_regulation_review_notifications", checked)}
          />
        </div>
      </CardContent>
      <CardContent className="grid gap-4 border-t border-border/80 pt-4">
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        <div className="grid gap-3 md:grid-cols-[280px_1fr_auto]">
          <NativeSelect
            value={selectedTemplate}
            onChange={(event) => setSelectedTemplate(event.target.value)}
          >
            <option value="">Pilih template pesan</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.eventType}
              </option>
            ))}
          </NativeSelect>
          <Input
            value={messageTemplate}
            onChange={(event) => setMessageTemplate(event.target.value)}
            placeholder="Template pesan aman"
          />
          <Button type="button" variant="outline" disabled={loading || !selectedTemplate || !messageTemplate.trim()} onClick={saveTemplate}>
            Simpan
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <Input value={testPhone} onChange={(event) => setTestPhone(event.target.value)} placeholder="Nomor WhatsApp test-safe" />
          <Button type="button" variant="outline" disabled={loading || !testPhone.trim()} onClick={sendTest}>
            <MessageSquare className="h-4 w-4" />
            Test-safe
          </Button>
          <Button type="button" variant="outline" disabled={loading} onClick={loadWhatsappData}>
            <RefreshCw className="h-4 w-4" />
            Refresh Log
          </Button>
        </div>
        <div className="grid gap-2">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada log WhatsApp JLF.</p>
          ) : logs.slice(0, 8).map((log) => (
            <div key={log.id} className="rounded-xl border border-border/80 p-3 text-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <p className="font-medium text-foreground">{log.eventType}</p>
                <Badge variant={log.status === "error" || log.status === "failed" ? "danger" : log.status === "skipped" ? "warning" : "success"}>
                  {log.status}
                </Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{log.messagePreview}</p>
              <p className="mt-1 text-xs text-muted-foreground">{log.recipientPhoneMasked || "-"} - {log.createdAt}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function JlfAdminFunctionalPanel({
  busy,
  summary,
  tabId,
  updateSetting,
}: {
  busy: boolean;
  summary: JlfSettingsSummary | null;
  tabId: string;
  updateSetting: (key: string, value: unknown) => void;
}) {
  if (!summary) {
    return (
      <Card className="mt-4 border-border/80">
        <CardContent className="p-4 text-sm text-muted-foreground">Summary pengaturan JLF belum tersedia.</CardContent>
      </Card>
    );
  }

  if (tabId === "umum") {
    return (
      <Card className="mt-4 border-border/80">
        <CardHeader>
          <CardTitle>Toggle Umum</CardTitle>
          <CardDescription>Pengaturan dasar modul disimpan sebagai setting JLF, tanpa secret.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <SettingSwitch
            checked={summary.general.enabled}
            disabled={busy}
            label="Aktifkan modul JLF"
            description="Mengontrol status operasional fondasi ALETA Judicia Legal Form."
            onChange={(checked) => updateSetting("jlf.enabled", checked)}
          />
          <SettingSwitch
            checked={summary.general.qrVerificationEnabled}
            disabled={busy}
            label="QR verifikasi dokumen"
            description="Mengaktifkan rencana verifikasi dokumen final melalui token aman."
            onChange={(checked) => updateSetting("jlf.document.qr_verification_enabled", checked)}
          />
          <SettingSwitch
            checked={summary.accountSync.enabled}
            disabled={busy}
            label="Sinergi akun ALETA-SIPP"
            description="Mengizinkan workflow account linking tanpa menyimpan password SIPP."
            onChange={(checked) => updateSetting("jlf.account_sync.enabled", checked)}
          />
          <SettingInput
            label="Default landing"
            description="Route default saat user membuka modul JLF."
            initialValue={summary.general.defaultLanding}
            disabled={busy}
            onSave={(value) => updateSetting("jlf.default_landing", value || "/judicia/legal-form")}
          />
          <SettingInput
            label="Retention policy dasar"
            description="Jumlah hari default retensi data operasional JLF sebelum ditinjau."
            initialValue={String(summary.general.retentionPolicyDays)}
            disabled={busy}
            onSave={(value) => updateSetting("jlf.retention.default_days", Number(value) || 365)}
          />
          <div className="grid gap-3 md:grid-cols-3">
            <StatusLine label="Superadmin" value="Status teknis, semua pengaturan, audit lintas JLF" />
            <StatusLine label="Admin" value="Pengelolaan template, KB, account sync sesuai permission" />
            <StatusLine label="User" value="Tugas kerja, dokumen saya, validasi saya jika diberi izin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tabId === "template-dokumen" || tabId === "variabel-placeholder") {
    return (
      <Card className="mt-4 border-border/80">
        <CardHeader>
          <CardTitle>{tabId === "template-dokumen" ? "Studio Template Dokumen" : "Studio Variabel & Placeholder"}</CardTitle>
          <CardDescription>
            {tabId === "template-dokumen"
              ? "Upload template tetap dibatasi ke format aman dan storage private JLF."
              : "Legacy code, placeholder modern, source type, dan needs review dikelola di registry variabel."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <SettingInput
            label="Allowed template types"
            description="Pisahkan dengan koma. Upload service hanya menerima DOCX dan RTF sebagai template utama."
            initialValue={summary.template.allowedTemplateTypes.join(", ")}
            disabled={busy}
            onSave={(value) => updateSetting("jlf.upload.allowed_template_types", value.split(",").map((item) => item.trim()).filter(Boolean))}
          />
          <SettingInput
            label="Allowed anonymizer types"
            description="TXT/RTF dapat diproses langsung. DOCX/PDF menunggu worker/sandbox, bukan eksekusi langsung."
            initialValue={summary.template.allowedAnonymizerTypes.join(", ")}
            disabled={busy}
            onSave={(value) => updateSetting("jlf.upload.allowed_anonymizer_types", value.split(",").map((item) => item.trim()).filter(Boolean))}
          />
          <SettingInput
            label="Max upload size"
            description="Batas ukuran upload template dalam MB."
            initialValue={String(summary.template.maxUploadSizeMb)}
            disabled={busy}
            onSave={(value) => updateSetting("jlf.upload.max_file_size_mb", Number(value) || 25)}
          />
          <SettingSwitch
            checked={summary.template.legacyPlaceholderSupportEnabled}
            disabled={busy}
            label="Legacy placeholder"
            description="Dukung placeholder lama seperti #0001# untuk importer legacy."
            onChange={(checked) => updateSetting("jlf.template.legacy_placeholder_support_enabled", checked)}
          />
          <SettingSwitch
            checked={summary.template.modernPlaceholderSupportEnabled}
            disabled={busy}
            label="Modern placeholder"
            description="Dukung placeholder modern seperti {{nomor_perkara}}."
            onChange={(checked) => updateSetting("jlf.template.modern_placeholder_support_enabled", checked)}
          />
          <SettingSwitch
            checked={summary.template.defaultRequiresValidation}
            disabled={busy}
            label="Default perlu validasi"
            description="Template baru default masuk workflow validasi manusia."
            onChange={(checked) => updateSetting("jlf.template.default_requires_validation", checked)}
          />
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline">
              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/templates`}>Kelola Template</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/variables`}>Kelola Variabel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tabId === "bas-qa") {
    return (
      <Card className="mt-4 border-border/80">
        <CardHeader>
          <CardTitle>Template Tanya Jawab/BAS</CardTitle>
          <CardDescription>Admin mengelola kode, jenis perkara, pertanyaan, jawaban, dan urutan BAS. User harian hanya memakai template yang aktif.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/bas-qa`}>Buka Template BAS</Link>
          </Button>
          <Badge variant="outline">source_type: jlf_bas_qa</Badge>
          <Badge variant="success">Tanpa raw SQL client</Badge>
        </CardContent>
      </Card>
    );
  }

  if (tabId === "query-registry") {
    const queryDefinitions = listJlfSippQueryPreviewDefinitions();
    return (
      <Card className="mt-4 border-border/80">
        <CardHeader>
          <CardTitle>Query Registry SIPP</CardTitle>
          <CardDescription>Query yang boleh dipakai JLF harus terdaftar, parameterized, read-only, dan dipanggil melalui adapter SIPP aman.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <StatusLine label="Raw SQL dari client" value="Tidak diizinkan" />
          <StatusLine label="Mode query" value="Registered key + parameterized" />
          <StatusLine label="SIPP write" value="Tidak ada" />
          <div className="rounded-xl border border-border/80 bg-muted/30 p-4 text-sm leading-6 text-muted-foreground md:col-span-3">
            Preview query hanya untuk admin/superadmin sebagai bahan cek manual. Query legacy ABT tetap needs_review dan tidak otomatis menjadi query aktif.
          </div>
          <div className="md:col-span-3 overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 font-medium">Query key</th>
                  <th className="px-3 py-3 font-medium">Output path</th>
                  <th className="px-3 py-3 font-medium">Parameter</th>
                  <th className="px-3 py-3 font-medium">Guard</th>
                  <th className="px-3 py-3 font-medium">Preview SQL</th>
                </tr>
              </thead>
              <tbody>
                {queryDefinitions.map((item) => (
                  <tr key={item.queryKey} className="border-b border-border/70 align-top">
                    <td className="px-3 py-3 font-mono text-xs text-foreground">{item.queryKey}</td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{item.outputPath}</td>
                    <td className="px-3 py-3 text-muted-foreground">{item.allowedParams.join(", ") || "-"}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={item.selectOnly ? "success" : "danger"}>{item.selectOnly ? "SELECT-only" : "blocked"}</Badge>
                        <Badge variant={item.readOnly ? "success" : "warning"}>{item.readOnly ? "read-only" : "review"}</Badge>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <pre className="max-h-24 overflow-auto rounded-lg border border-border/70 bg-slate-950 p-2 text-xs text-slate-100">
                        {item.sqlPreview ?? "-"}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tabId === "koneksi-sipp") {
    return (
      <Card className="mt-4 border-border/80">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Status Adapter SIPP</CardTitle>
              <CardDescription>Adapter tetap read-only dan tidak menyediakan raw SQL endpoint.</CardDescription>
            </div>
            <Badge variant={summary.sipp.health.ok ? "success" : "warning"}>{summary.sipp.health.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <StatusLine label="Provider" value={summary.sipp.provider} />
          <StatusLine label="Provider mode" value={summary.sipp.providerMode} />
          <StatusLine label="Latency" value={summary.sipp.health.latencyMs ? `${summary.sipp.health.latencyMs} ms` : "-"} />
          <StatusLine label="Read-only" value={summary.sipp.readOnly ? "Ya" : "Tidak"} />
          <StatusLine label="Raw SQL Endpoint" value={summary.sipp.rawSqlEndpoint ? "Ada" : "Tidak ada"} />
          <StatusLine label="MySQL Dependency" value={summary.sipp.directMysqlDependencyInstalled ? "Terpasang" : "Tidak terpasang"} />
          <div className="md:col-span-2 rounded-xl border border-border/80 bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
            {summary.sipp.health.message}
          </div>
          <div className="grid gap-3 md:col-span-2">
            <SettingSwitch
              checked={summary.sipp.enabled}
              disabled={busy}
              label="Aktifkan adapter SIPP"
              description="Tetap read-only. Jika bridge belum tersedia, provider aman akan menjadi disabled/stub."
              onChange={(checked) => updateSetting("jlf.sipp.enabled", checked)}
            />
            <SettingInput
              label="Provider mode"
              description="disabled, aleta_bot_bridge, atau direct_mysql placeholder. Direct MySQL belum dipakai tanpa instruksi dependency."
              initialValue={summary.sipp.providerMode}
              disabled={busy}
              onSave={(value) => updateSetting("jlf.sipp.provider_mode", value || "disabled")}
            />
            <SettingInput
              label="Search limit"
              description="Batas hasil pencarian SIPP agar tidak mengambil data berlebihan."
              initialValue={String(summary.sipp.searchLimit)}
              disabled={busy}
              onSave={(value) => updateSetting("jlf.sipp.search_limit", Number(value) || 20)}
            />
            <SettingInput
              label="Query timeout"
              description="Timeout query/bridge dalam milidetik."
              initialValue={String(summary.sipp.queryTimeoutMs)}
              disabled={busy}
              onSave={(value) => updateSetting("jlf.sipp.query_timeout_ms", Number(value) || 8000)}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tabId === "sinergi-akun" || tabId === "mapping-role") {
    return (
      <Card className="mt-4 border-border/80">
        <CardHeader>
          <CardTitle>{tabId === "mapping-role" ? "Mapping Role SIPP ke ALETA" : "Sinergi Akun SIPP"}</CardTitle>
          <CardDescription>Password/hash SIPP tidak disimpan. Auto-apply role default tetap nonaktif.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {tabId === "sinergi-akun" ? (
            <>
              <SettingSwitch
                checked={summary.accountSync.enabled}
                disabled={busy}
                label="Aktifkan account sync"
                description="Mengaktifkan workflow link akun ALETA-SIPP secara aman."
                onChange={(checked) => updateSetting("jlf.account_sync.enabled", checked)}
              />
              <SettingSwitch
                checked={summary.accountSync.autoSuggestionEnabled}
                disabled={busy}
                label="Auto suggestion"
                description="Sistem boleh menyarankan kandidat link, tetapi tidak auto-link jika konflik."
                onChange={(checked) => updateSetting("jlf.account_sync.auto_suggestion_enabled", checked)}
              />
              <SettingSwitch
                checked={summary.accountSync.selfClaimEnabled}
                disabled={busy}
                label="Self-claim"
                description="User dapat mengajukan klaim link akun, tetap perlu approval sesuai kebijakan."
                onChange={(checked) => updateSetting("jlf.account_sync.self_claim_enabled", checked)}
              />
              <SettingInput
                label="Conflict handling"
                description="Kebijakan saat lebih dari satu kandidat kuat ditemukan."
                initialValue={summary.accountSync.conflictHandling}
                disabled={busy}
                onSave={(value) => updateSetting("jlf.account_sync.conflict_handling", value || "admin_review")}
              />
              <SettingInput
                label="Snapshot policy"
                description="Kapan snapshot user SIPP disimpan untuk audit account sync."
                initialValue={summary.accountSync.snapshotPolicy}
                disabled={busy}
                onSave={(value) => updateSetting("jlf.account_sync.snapshot_policy", value || "on_search_and_link")}
              />
            </>
          ) : (
            <>
              <SettingSwitch
                checked={summary.roleMapping.approvalRequired}
                disabled={busy}
                label="Approval required"
                description="Mapping role SIPP ke ALETA harus ditinjau admin sebelum diterapkan."
                onChange={(checked) => updateSetting("jlf.sipp_role_mapping.approval_required", checked)}
              />
              <SettingSwitch
                checked={summary.roleMapping.autoApplyDefault}
                disabled={busy}
                label="Auto apply default"
                description="Default nonaktif agar rekomendasi mapping tidak langsung mengubah kewenangan user."
                onChange={(checked) => updateSetting("jlf.sipp_role_mapping.auto_apply_default", checked)}
              />
            </>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline">
              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/account-sync`}>
                <UsersRound className="h-4 w-4" />
                Buka Sinergi Akun
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/account-sync/role-mapping`}>
                <ShieldCheck className="h-4 w-4" />
                Buka Mapping Role
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tabId === "ai") {
    return (
      <Card className="mt-4 border-border/80">
        <CardHeader>
          <CardTitle>Status AI Global ALETA</CardTitle>
          <CardDescription>JLF membaca konfigurasi global dan tidak membuat provider/model terpisah.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <StatusLine label="Provider aktif" value={`${summary.ai.global.status.providerId} / ${summary.ai.global.status.modelId}`} />
          <StatusLine label="Koneksi" value={summary.ai.global.status.activeConnectionStatus} />
          <StatusLine label="Provider tersedia" value={`${summary.ai.global.status.providersCount} total, ${summary.ai.global.status.liveProvidersCount} connected`} />
          <StatusLine label="Secret" value={summary.ai.global.policy.exposesApiKey ? "Terbuka" : "Tidak ditampilkan"} />
          <div className="grid gap-3 md:col-span-2">
            <SettingSwitch
              checked={summary.ai.enabled}
              disabled={busy}
              label="AI JLF"
              description="Toggle modul JLF di atas konfigurasi AI global ALETA."
              onChange={(checked) => updateSetting("jlf.ai.enabled", checked)}
            />
            <SettingSwitch
              checked={summary.ai.legalAnalysisEnabled}
              disabled={busy}
              label="Legal analysis JLF"
              description="Analisis hukum tetap wajib memakai peraturan terverifikasi dan validasi manusia."
              onChange={(checked) => updateSetting("jlf.ai.legal_analysis.enabled", checked)}
            />
            <SettingSwitch
              checked={summary.ai.requireVerifiedRegulations}
              disabled={busy}
              label="Wajib peraturan verified"
              description="Dalam mode production, AI legal analysis hanya memakai peraturan yang sudah diverifikasi."
              onChange={(checked) => updateSetting("jlf.ai.require_verified_regulations", checked)}
            />
            <SettingSwitch
              checked={summary.ai.redactionEnabled}
              disabled={busy}
              label="Redaction input AI"
              description="Redaksi NIK, nomor telepon, email, dan secret sebelum dikirim/log."
              onChange={(checked) => updateSetting("jlf.ai.redaction.enabled", checked)}
            />
            <SettingSwitch
              checked={summary.ai.logInputs}
              disabled={busy}
              label="Log input AI"
              description="Jika aktif, input tetap disimpan dalam bentuk redacted; default nonaktif."
              onChange={(checked) => updateSetting("jlf.ai.log_inputs", checked)}
            />
            <SettingSwitch
              checked={summary.ai.logOutputs}
              disabled={busy}
              label="Log output AI"
              description="Menyimpan output AI JLF untuk audit sesuai permission."
              onChange={(checked) => updateSetting("jlf.ai.log_outputs", checked)}
            />
            <SettingInput
              label="Max input chars"
              description="Batas panjang input AI JLF untuk mencegah prompt berlebihan dan data sensitif."
              initialValue={String(summary.ai.maxInputChars)}
              disabled={busy}
              onSave={(value) => updateSetting("jlf.ai.max_input_chars", Number(value) || 12000)}
            />
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/ai`}>
                  <Sparkles className="h-4 w-4" />
                  Buka AI JLF
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/analysis`}>
                  <Scale className="h-4 w-4" />
                  Legal Analysis
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tabId === "whatsapp") {
    return <JlfWhatsappAdminPanel busy={busy} summary={summary} updateSetting={updateSetting} />;
  }

  if (tabId === "qr-verifikasi") {
    return <JlfQrVerificationAdminPanel busy={busy} summary={summary} updateSetting={updateSetting} />;
  }

  if (tabId === "legal-kb") {
    return (
      <Card className="mt-4 border-border/80">
        <CardHeader>
          <CardTitle>Legal Knowledge Base</CardTitle>
          <CardDescription>Kelola jenis peraturan, topik, pasal/bagian, dan verifikasi sumber hukum JLF.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <SettingSwitch
            checked={summary.legalKnowledgeBase.requireVerification}
            disabled={busy}
            label="Require verification"
            description="Peraturan baru harus diverifikasi manusia sebelum dipakai sebagai dasar AI production."
            onChange={(checked) => updateSetting("jlf.legal_kb.require_verification", checked)}
          />
          <SettingSwitch
            checked={summary.legalKnowledgeBase.verifiedOnlyAiMode}
            disabled={busy}
            label="Verified-only AI mode"
            description="AI legal analysis hanya memakai sumber berstatus verified."
            onChange={(checked) => updateSetting("jlf.ai.require_verified_regulations", checked)}
          />
          <SettingInput
            label="Regulation ingestion policy"
            description="Kebijakan input peraturan, misalnya manual_review_required."
            initialValue={summary.legalKnowledgeBase.ingestionPolicy}
            disabled={busy}
            onSave={(value) => updateSetting("jlf.legal_kb.ingestion_policy", value || "manual_review_required")}
          />
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline">
              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations`}>
                <Scale className="h-4 w-4" />
                Database Peraturan
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations/types`}>
                Master Jenis
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations/topics`}>
                Topik Hukum
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations/verification`}>
                <ShieldCheck className="h-4 w-4" />
                Verifikasi
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tabId === "legacy-abt") {
    return (
      <Card className="mt-4 border-border/80">
        <CardHeader>
          <CardTitle>Import Legacy ABT</CardTitle>
          <CardDescription>ABT hanya legacy/importer. Dry-run tetap default dan query legacy berisiko harus review manual.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <SettingSwitch
            checked={summary.legacyImport.enabled}
            disabled={busy}
            label="Aktifkan importer legacy"
            description="Membuka akses importer legacy ABT jika permission mengizinkan."
            onChange={(checked) => updateSetting("jlf.legacy_import.enabled", checked)}
          />
          <SettingSwitch
            checked={summary.legacyImport.dryRunOnly}
            disabled={busy}
            label="Dry-run only"
            description="Importer hanya menghasilkan laporan sampai admin memberi instruksi eksplisit untuk import."
            onChange={(checked) => updateSetting("jlf.legacy_import.dry_run_only", checked)}
          />
          <div className="grid gap-3 md:grid-cols-3">
            <StatusLine label="Status report" value={summary.legacyImport.lastReportStatus} />
            <StatusLine label="Prefix baru" value="jlf_" />
            <StatusLine label="Prefix legacy" value="abt_ hanya sebagai sumber importer" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tabId === "audit-retensi") {
    return (
      <Card className="mt-4 border-border/80">
        <CardHeader>
          <CardTitle>Audit & Retensi Data</CardTitle>
          <CardDescription>Retensi dasar untuk audit, dokumen, AI log, dan WhatsApp log. Secret tidak ditampilkan.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <SettingInput
            label="Audit retention"
            description="Retensi audit log JLF dalam hari."
            initialValue={String(summary.retention.auditLogDays)}
            disabled={busy}
            onSave={(value) => updateSetting("jlf.retention.audit_log_days", Number(value) || 365)}
          />
          <SettingInput
            label="Document retention"
            description="Retensi metadata dan file dokumen JLF dalam hari."
            initialValue={String(summary.retention.documentDays)}
            disabled={busy}
            onSave={(value) => updateSetting("jlf.retention.document_days", Number(value) || 365)}
          />
          <SettingInput
            label="AI log retention"
            description="Retensi log AI JLF dalam hari."
            initialValue={String(summary.retention.aiLogDays)}
            disabled={busy}
            onSave={(value) => updateSetting("jlf.retention.ai_log_days", Number(value) || 180)}
          />
          <SettingInput
            label="WhatsApp log retention"
            description="Retensi log notifikasi WhatsApp JLF dalam hari."
            initialValue={String(summary.retention.whatsappLogDays)}
            disabled={busy}
            onSave={(value) => updateSetting("jlf.retention.whatsapp_log_days", Number(value) || 180)}
          />
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild variant="outline">
              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/audit`}>
                <ShieldCheck className="h-4 w-4" />
                Buka Audit Trail
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

export default function JudiciaLegalFormAdminPage() {
  const { aiConfig, currentUser, positions } = usePortal();
  const [summary, setSummary] = useState<JlfSettingsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const effectiveRoleId = getEffectiveRoleId(currentUser);
  const currentPositionLabel = getUserPositionLabel(currentUser, positions);
  const access = resolveJudiciaLegalFormAccess(currentUser, {
    effectiveRoleId,
    positionLabel: currentPositionLabel,
  });
  const canManageSettings = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.SETTINGS_MANAGE);
  const visibleTabs = getJudiciaLegalFormAdminTabs(access);
  const aiStatusLabel = aiConfig.enabled
    ? `AI global ALETA tersedia: ${aiConfig.providerId} / ${aiConfig.modelId}.`
    : "AI global ALETA sedang nonaktif; JLF tidak membuat provider terpisah.";

  async function loadSummary() {
    if (!canManageSettings) return;
    setSummaryLoading(true);
    try {
      const data = await fetchJlfSettingsSummary();
      setSummary(data);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat summary pengaturan JLF.");
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    if (!canManageSettings) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSummaryLoading(true);
      void fetchJlfSettingsSummary()
        .then((data) => {
          if (cancelled) return;
          setSummary(data);
          setMessage("");
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setMessage(error instanceof Error ? error.message : "Gagal memuat summary pengaturan JLF.");
        })
        .finally(() => {
          if (!cancelled) setSummaryLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canManageSettings]);

  async function updateSetting(key: string, value: unknown) {
    setBusy(true);
    setMessage("");
    try {
      await readApi(
        await fetch(apiPath("/api/judicia/legal-form/settings"), {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        })
      );
      await loadSummary();
      setMessage("Pengaturan JLF diperbarui.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memperbarui pengaturan JLF.");
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) {
    return <JlfLoadingState />;
  }

  if (!canManageSettings || visibleTabs.length === 0) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Pengaturan Admin"
        title="ALETA Judicia (Legal Form)"
        description="Shell pengaturan JLF untuk template, variabel, SIPP, account sync, AI, ALETA Bot, Legal Knowledge Base, QR, importer legacy ABT, audit, dan retensi data."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Admin
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={JUDICIA_LEGAL_FORM_ROUTE}>
                <Scale className="h-4 w-4" />
                Buka JLF
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/80">
          <CardHeader>
            <div className="rounded-2xl bg-primary/10 p-3 text-primary w-fit">
              <Database className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">SIPP Read-only</CardTitle>
            <CardDescription>
              Provider: {summary?.sipp.provider ?? "memuat"}. Raw SQL endpoint: {summary?.sipp.rawSqlEndpoint ? "ada" : "tidak ada"}.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200 w-fit">
              <Sparkles className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">AI Global ALETA</CardTitle>
            <CardDescription>
              {summary?.ai.global.status.enabled ? "AI global aktif" : "AI global nonaktif"}. Provider JLF terpisah tidak dibuat.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200 w-fit">
              <Bot className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">ALETA Bot Gateway</CardTitle>
            <CardDescription>
              Gateway: {summary?.whatsapp.gateway.status ?? "memuat"}. Token WhatsApp baru tidak disimpan di modul JLF.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {message ? (
        <Card className="border-border/80">
          <CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent>
        </Card>
      ) : null}

      <Card className="border-border/80">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle>Tab Pengaturan JLF</CardTitle>
              <CardDescription>
                Tab yang tampil disaring berdasarkan permission. Superadmin melihat pengaturan teknis penuh, Admin melihat area pengelolaan yang diizinkan.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={access.isSuperAdmin ? "default" : "outline"}>
                {access.isSuperAdmin ? "Superadmin" : "Admin"}
              </Badge>
              <Badge variant="success">Fondasi aktif</Badge>
              {summary?.secretsExposed ? <Badge variant="danger">Secret terbuka</Badge> : <Badge variant="outline">Secret aman</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              Summary service membaca setting JLF, status SIPP adapter, AI global ALETA, dan ALETA Bot tanpa menampilkan secret.
            </p>
            <Button type="button" variant="outline" onClick={loadSummary} disabled={summaryLoading || busy}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
          <Tabs defaultValue={visibleTabs[0]?.id} className="w-full">
            <TabsList className="flex h-auto w-full max-w-full flex-wrap justify-start gap-1 overflow-x-auto">
              {visibleTabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="shrink-0">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {visibleTabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id}>
                <JlfAdminTabPanel tab={tab} aiStatusLabel={aiStatusLabel} />
                {summaryLoading ? (
                  <div className="mt-4">
                    <JlfLoadingState />
                  </div>
                ) : (
                  <JlfAdminFunctionalPanel
                    busy={busy}
                    summary={summary}
                    tabId={tab.id}
                    updateSetting={updateSetting}
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
