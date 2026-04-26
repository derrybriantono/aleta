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
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type AletaBotNotification,
  type AletaBotNotificationCategory,
  type AletaBotQuery,
  type AletaBotQueryCategory,
  type AletaBotSnapshot,
  type AletaBotTemplate,
} from "@/lib/aleta-bot-types";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type ApiEnvelope<T> = {
  ok: boolean;
  data: T;
  message?: string;
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
  employeeRecipients: [],
  notificationLogs: [],
  queryCatalog: [],
  logs: [],
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
  isActive: boolean;
};

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
    isActive: query.isActive,
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

  const loadSnapshot = async () => {
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Gagal memuat ALETA Bot.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSnapshot();
  }, []);

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
            isActive: queryForm.isActive,
          },
        }),
      });
      setSnapshot(data);
      setQueryForm(makeEmptyQueryForm(queryForm.category));
      setNotice("Query ALETA Bot berhasil disimpan dan disinkronkan ke runtime.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Query gagal disimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const runAction = async (
    action: "sync-config" | "reconnect" | "logout" | "send-test" | "test-template" | "test-query" | "test-notification" | "test-connection",
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
          <TabsTrigger value="logs">Log</TabsTrigger>
          <TabsTrigger value="manual-test">Manual Test</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <div className="grid gap-4 lg:grid-cols-3">
            <InfoCard title="Nomor Admin" value={snapshot.settings.adminWhatsappNumber || "Belum diatur"} hint="Dipakai sebagai admin/kontrol bot. Disimpan di database portal dan bridge config." />
            <InfoCard title="Nomor Terhubung" value={snapshot.whatsapp.phoneNumber || "Belum disetel"} hint={`Session: ${snapshot.whatsapp.sessionName}`} />
            <InfoCard title="Notifikasi Terakhir" value={snapshot.metrics.lastNotificationAt ? formatDateTime(snapshot.metrics.lastNotificationAt) : "Belum ada"} hint={`${snapshot.metrics.activeJobs} job aktif, ${snapshot.metrics.enabledTemplates} template tersedia.`} />
          </div>
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
                <ToggleRow label="Bot aktif" checked={settingsDraft.botEnabled} onCheckedChange={(value) => setSettingsDraft((current) => ({ ...current, botEnabled: value }))} />
                <ToggleRow label="Notifikasi otomatis" checked={settingsDraft.notificationsEnabled} onCheckedChange={(value) => setSettingsDraft((current) => ({ ...current, notificationsEnabled: value }))} />
                <ToggleRow label="Dry-run" checked={settingsDraft.dryRunEnabled} onCheckedChange={(value) => setSettingsDraft((current) => ({ ...current, dryRunEnabled: value }))} />
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Nomor Admin WhatsApp" value={settingsDraft.adminWhatsappNumber} onChange={(value) => setSettingsDraft((current) => ({ ...current, adminWhatsappNumber: value }))} placeholder="628123456789" />
                <Field label="Delay antar pesan (ms)" value={String(settingsDraft.messageDelayMs)} type="number" onChange={(value) => setSettingsDraft((current) => ({ ...current, messageDelayMs: Number(value) }))} />
                <Field label="Batas retry" value={String(settingsDraft.retryLimit)} type="number" onChange={(value) => setSettingsDraft((current) => ({ ...current, retryLimit: Number(value) }))} />
                <Field label="Jadwal default" value={settingsDraft.scheduleCron} onChange={(value) => setSettingsDraft((current) => ({ ...current, scheduleCron: value }))} />
              </div>
              <Field label="Nomor tujuan testing" value={settingsDraft.testTargetNumber} onChange={(value) => setSettingsDraft((current) => ({ ...current, testTargetNumber: value }))} placeholder="628123456789" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Catatan keamanan</p>
                <Textarea value={settingsDraft.securityNotes} onChange={(event) => setSettingsDraft((current) => ({ ...current, securityNotes: event.target.value }))} rows={3} />
              </div>
              <Button onClick={() => void saveSettings()} disabled={isSaving}>
                <Settings2 className="h-4 w-4" />
                Simpan Pengaturan
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
                      <Textarea value={templateDraft[template.id] ?? template.body} rows={7} onChange={(event) => setTemplateDraft((current) => ({ ...current, [template.id]: event.target.value }))} disabled={!template.editable} />
                      <div className="flex justify-end">
                        <Button size="sm" onClick={() => void saveTemplate(template)} disabled={isSaving || !template.editable}>
                          Simpan Template
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
                <CardTitle>Tambah / Edit Notifikasi</CardTitle>
                <CardDescription>Notifikasi Pegawai mengambil nomor dari user portal. Notifikasi Pihak mengambil nomor dari kolom hasil query perkara/SIPP.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Nama notifikasi" value={notificationForm.name} onChange={(value) => setNotificationForm((current) => ({ ...current, name: value }))} />
                  <SelectField
                    label="Kategori"
                    value={notificationForm.category}
                    onChange={(value) => {
                      const category = value as AletaBotNotificationCategory;
                      setNotificationForm((current) => ({ ...makeEmptyNotificationForm(snapshot, category), id: current.id, name: current.name, description: current.description, isActive: current.isActive }));
                    }}
                    options={[
                      { value: "employee", label: "Notifikasi Pegawai" },
                      { value: "party", label: "Notifikasi Pihak" },
                    ]}
                  />
                  <SelectField
                    label="Sumber query"
                    value={notificationForm.queryId}
                    onChange={(value) => setNotificationForm((current) => ({ ...current, queryId: value }))}
                    options={snapshot.queries
                      .filter((query) => query.category === notificationForm.category || query.category === "system")
                      .map((query) => ({ value: query.id, label: query.name }))}
                  />
                  <SelectField
                    label="Template pesan"
                    value={notificationForm.templateId}
                    onChange={(value) => setNotificationForm((current) => ({ ...current, templateId: value }))}
                    options={snapshot.templates.map((template) => ({ value: template.id, label: template.title }))}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <SelectField
                    label="Tipe trigger"
                    value={notificationForm.scheduleType}
                    onChange={(value) => setNotificationForm((current) => ({ ...current, scheduleType: value as NotificationForm["scheduleType"] }))}
                    options={[
                      { value: "cron", label: "Cron" },
                      { value: "manual", label: "Manual" },
                      { value: "event", label: "Event" },
                    ]}
                  />
                  <Field label="Jadwal/cron" value={notificationForm.scheduleCron} onChange={(value) => setNotificationForm((current) => ({ ...current, scheduleCron: value }))} placeholder="00 07 * * *" />
                  <Field label="Delay (ms)" type="number" value={String(notificationForm.delayMs)} onChange={(value) => setNotificationForm((current) => ({ ...current, delayMs: Number(value) }))} />
                  <Field label="Retry" type="number" value={String(notificationForm.retryLimit)} onChange={(value) => setNotificationForm((current) => ({ ...current, retryLimit: Number(value) }))} />
                </div>
                <Field label="Deskripsi" value={notificationForm.description} onChange={(value) => setNotificationForm((current) => ({ ...current, description: value }))} />
                <Field label="Trigger" value={notificationForm.scheduleTrigger} onChange={(value) => setNotificationForm((current) => ({ ...current, scheduleTrigger: value }))} />
                <div className="flex flex-wrap items-center gap-3">
                  <ToggleRow label="Status aktif" checked={notificationForm.isActive} onCheckedChange={(value) => setNotificationForm((current) => ({ ...current, isActive: value }))} />
                  <Button onClick={() => void saveNotification()} disabled={isSaving}>
                    <CheckCircle2 className="h-4 w-4" />
                    Simpan Notifikasi
                  </Button>
                  <Button variant="outline" onClick={() => setNotificationForm(makeEmptyNotificationForm(snapshot, notificationForm.category))} disabled={isSaving}>
                    Baru
                  </Button>
                </div>
              </CardContent>
            </Card>

            <NotificationSection
              title="Notifikasi Pegawai"
              description={`${snapshot.employeeRecipients.length} user aktif memiliki nomor WhatsApp valid dari data manajemen_surat.`}
              notifications={snapshot.notifications.filter((item) => item.category === "employee")}
              queries={snapshot.queries}
              templates={snapshot.templates}
              onEdit={(notification) => setNotificationForm(notificationToForm(notification))}
              onTest={(notification) => void runAction("test-notification", { notificationId: notification.id })}
              isSaving={isSaving}
            />
            <NotificationSection
              title="Notifikasi Pihak"
              description="Nomor tujuan berasal dari kolom hasil query perkara/SIPP, misalnya telepon, nomor_hp, atau nomor_whatsapp."
              notifications={snapshot.notifications.filter((item) => item.category === "party")}
              queries={snapshot.queries}
              templates={snapshot.templates}
              onEdit={(notification) => setNotificationForm(notificationToForm(notification))}
              onTest={(notification) => void runAction("test-notification", { notificationId: notification.id })}
              isSaving={isSaving}
            />
          </div>
        </TabsContent>

        <TabsContent value="queries">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Tambah / Edit Query</CardTitle>
                <CardDescription>Query baru dari UI hanya mengizinkan SELECT atau referensi legacy. Test query dibatasi preview aman.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Nama query" value={queryForm.name} onChange={(value) => setQueryForm((current) => ({ ...current, name: value }))} />
                  <SelectField
                    label="Kategori"
                    value={queryForm.category}
                    onChange={(value) => {
                      const category = value as AletaBotQueryCategory;
                      setQueryForm((current) => ({ ...current, category, recipientColumn: category === "party" ? current.recipientColumn || "telepon" : "" }));
                    }}
                    options={[
                      { value: "employee", label: "Pegawai" },
                      { value: "party", label: "Pihak" },
                      { value: "system", label: "Sistem" },
                    ]}
                  />
                  <Field label="Kolom hasil" value={queryForm.outputColumns} onChange={(value) => setQueryForm((current) => ({ ...current, outputColumns: value }))} placeholder="nama_pihak, nomor_perkara, telepon" />
                  <Field label="Kolom nomor pihak" value={queryForm.recipientColumn} onChange={(value) => setQueryForm((current) => ({ ...current, recipientColumn: value }))} placeholder="telepon" />
                </div>
                <Field label="Deskripsi" value={queryForm.description} onChange={(value) => setQueryForm((current) => ({ ...current, description: value }))} />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-foreground">SQL / referensi legacy</p>
                  <Textarea value={queryForm.sqlText} onChange={(event) => setQueryForm((current) => ({ ...current, sqlText: event.target.value }))} rows={6} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <ToggleRow label="Query aktif" checked={queryForm.isActive} onCheckedChange={(value) => setQueryForm((current) => ({ ...current, isActive: value }))} />
                  <Button onClick={() => void saveQuery()} disabled={isSaving}>
                    <CheckCircle2 className="h-4 w-4" />
                    Simpan Query
                  </Button>
                  <Button variant="outline" onClick={() => setQueryForm(makeEmptyQueryForm(queryForm.category))} disabled={isSaving}>
                    Baru
                  </Button>
                </div>
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
                            <Button variant="outline" size="sm" onClick={() => setQueryForm(queryToForm(query))} disabled={isSaving}>Edit</Button>
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
      </Tabs>

      {isLoading ? (
        <div className="fixed bottom-6 right-6 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-panel">
          Memuat ALETA Bot...
        </div>
      ) : null}
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
