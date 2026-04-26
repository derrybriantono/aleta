"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  LoaderCircle,
  PencilLine,
  Plus,
  Power,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wifi,
} from "lucide-react";

import { AletaAIMark } from "@/components/branding/aleta-ai-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { regulationsKnowledgeBase } from "@/core/knowledge/regulations-db";
import { hybridModuleRegistry } from "@/core/platform/module-registry";
import { type PartialAIFeatureFlags } from "@/lib/ai-feature-flags";
import { popularAIProviderCatalog } from "@/lib/ai-catalog";
import { usePortal } from "@/lib/app-state";
import { readJsonResponseSafe, summarizePlainTextError } from "@/lib/http-response";
import { canManageGlobalAI } from "@/lib/permissions";
import { type AIFeatureFlags } from "@/lib/types";
import { cn } from "@/lib/utils";

type ConnectionTestStatus = "idle" | "connected" | "failed";

type ConnectionFormState = {
  providerId: string;
  modelId: string;
  label: string;
  apiKey: string;
  endpointUrl: string;
};

const LIVE_PROVIDER_IDS = ["gemini", "chatgpt", "claude", "llama"] as const;

const AI_FEATURE_MODULE_GROUPS: Array<{
  key: keyof AIFeatureFlags;
  label: string;
  desc: string;
  subfeatures: Array<{ key: string; label: string; desc: string }>;
}> = [
  {
    key: "oneStopDisposition",
    label: "One Stop Disposition",
    desc: "Kontrol AI untuk rekomendasi disposisi, prioritas, tujuan, instruksi, dan autofill.",
    subfeatures: [
      { key: "recommendation", label: "Analisis rekomendasi disposisi", desc: "Menjalankan analisis inti untuk saran disposisi." },
      { key: "priorityDetection", label: "Deteksi prioritas/urgensi", desc: "Mengisi tingkat prioritas dan alasannya." },
      { key: "targetSuggestion", label: "Saran tujuan disposisi", desc: "Menyarankan target jabatan dari opsi yang valid." },
      { key: "instructionSuggestion", label: "Saran instruksi disposisi", desc: "Menyusun redaksi instruksi yang bisa diedit." },
      { key: "autofill", label: "Autofill form disposisi", desc: "Mengaktifkan tombol pengisian otomatis dari hasil AI." },
      { key: "rationale", label: "Alasan/rationale AI", desc: "Menampilkan dasar pertimbangan hasil AI." },
      { key: "diagnostics", label: "Confidence/diagnostic admin", desc: "Menampilkan skor dan metadata khusus admin." },
    ],
  },
  {
    key: "mailIntelligence",
    label: "ALETA Intelligence Service",
    desc: "Kontrol AI untuk ringkasan, temuan, tindak lanjut, regulasi, dan risiko surat.",
    subfeatures: [
      { key: "summary", label: "Ringkasan AI", desc: "Menampilkan ringkasan surat dari AI." },
      { key: "findings", label: "Temuan utama", desc: "Menampilkan poin temuan utama." },
      { key: "recommendedActions", label: "Rekomendasi tindak lanjut", desc: "Menampilkan saran langkah berikutnya." },
      { key: "relatedRegulations", label: "Regulasi/rujukan terkait", desc: "Menampilkan rujukan knowledge base yang relevan." },
      { key: "riskNotes", label: "Analisis risiko/perhatian", desc: "Menampilkan prioritas dan catatan perhatian." },
      { key: "diagnostics", label: "Confidence/diagnostic admin", desc: "Menampilkan skor dan metadata khusus admin." },
    ],
  },
  {
    key: "draftMetadata",
    label: "Deteksi Metadata Draft Surat",
    desc: "Kontrol AI untuk ekstraksi metadata draft surat dari PDF.",
    subfeatures: [
      { key: "nomorSurat", label: "Deteksi nomor surat", desc: "Mengisi nomor surat dari naskah." },
      { key: "tanggalSurat", label: "Deteksi tanggal surat", desc: "Mengisi tanggal pada naskah surat." },
      { key: "tanggalTerima", label: "Deteksi tanggal terima/administratif", desc: "Mengisi tanggal terima atau kirim bila terbukti." },
      { key: "asalSurat", label: "Deteksi asal surat", desc: "Mengisi asal/pengirim surat." },
      { key: "perihal", label: "Deteksi perihal", desc: "Mengisi pokok/perihal surat." },
      { key: "kodeKlasifikasi", label: "Deteksi kode klasifikasi", desc: "Mengisi kode klasifikasi bila yakin." },
      { key: "klasifikasiSurat", label: "Deteksi klasifikasi surat", desc: "Mengisi label klasifikasi." },
      { key: "tagSurat", label: "Deteksi tag surat", desc: "Mengisi tag kontekstual surat." },
      { key: "tagAsalSurat", label: "Deteksi tag asal surat", desc: "Mengisi tag asal/instansi dari konteks." },
      { key: "ocrCheck", label: "Pemeriksaan OCR/text-layer PDF", desc: "Memeriksa apakah PDF memiliki teks yang bisa diproses." },
      { key: "aiReviewNote", label: "Review/catatan AI admin", desc: "Menampilkan catatan verifikasi khusus admin." },
    ],
  },
  {
    key: "institutionIdentity",
    label: "Identitas Instansi",
    desc: "Kontrol AI untuk saran nama pengadilan dan normalisasi enrichment identitas.",
    subfeatures: [
      { key: "courtNameSuggestion", label: "Saran nama pengadilan", desc: "Mengizinkan AI fallback untuk autocomplete nama pengadilan." },
      { key: "identityEnrichment", label: "Enrichment identitas", desc: "Mengizinkan alur enrichment identitas instansi." },
      { key: "googleDiscovery", label: "Discovery Google", desc: "Mengizinkan discovery eksternal jika API key tersedia." },
      { key: "officialWebsiteExtraction", label: "Ekstraksi website resmi", desc: "Mengizinkan pembacaan kontak dari website resmi." },
      { key: "aiNormalization", label: "Normalisasi/ekstraksi AI", desc: "Mengizinkan AI menormalisasi data yang sudah bersumber." },
      { key: "diagnostics", label: "Confidence/diagnostic admin", desc: "Menampilkan metadata keyakinan khusus admin." },
    ],
  },
];

function statusMeta(status: ConnectionTestStatus) {
  if (status === "connected") return { label: "Berhasil terhubung", variant: "success" as const };
  if (status === "failed") return { label: "Gagal terhubung", variant: "danger" as const };
  return { label: "Belum diuji", variant: "outline" as const };
}

function formatLastTested(value?: string) {
  if (!value) return "Belum pernah diuji";
  return new Date(value).toLocaleString("id-ID");
}

function buildInitialForm(providerId: string, modelId: string): ConnectionFormState {
  return {
    providerId,
    modelId,
    label: "",
    apiKey: "",
    endpointUrl: "",
  };
}

export function AIControlPanel() {
  const { aiConfig, currentUser, refreshAIConfig, setAIConfig } = usePortal();
  const canManage = canManageGlobalAI(currentUser);

  const liveProviders = useMemo(
    () => popularAIProviderCatalog.filter((provider) => LIVE_PROVIDER_IDS.includes(provider.id as (typeof LIVE_PROVIDER_IDS)[number])),
    []
  );
  const defaultProvider = liveProviders.find((provider) => provider.id === "gemini") ?? liveProviders[0];
  const defaultModel = defaultProvider?.models[1] ?? defaultProvider?.models[0] ?? "Gemini 2.5 Flash";
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [form, setForm] = useState<ConnectionFormState>(() =>
    buildInitialForm(defaultProvider?.id ?? "gemini", defaultModel)
  );
  const [formFeedback, setFormFeedback] = useState("");
  const [panelFeedback, setPanelFeedback] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSavingConnection, setIsSavingConnection] = useState(false);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);
  const [pendingConnectionActionId, setPendingConnectionActionId] = useState<string | null>(null);
  const [lastTestStatus, setLastTestStatus] = useState<ConnectionTestStatus>("idle");
  const [lastTestedAt, setLastTestedAt] = useState<string | null>(null);
  const [lastTestMessage, setLastTestMessage] = useState("");

  const intelligenceReadyModules = hybridModuleRegistry.filter((module) => module.intelligenceReady);
  const activeConnection =
    aiConfig.providers.find((provider) => provider.id === aiConfig.activeConnectionId) ??
    aiConfig.providers.find((provider) => provider.isActive) ??
    null;
  const activeBadge = !aiConfig.enabled
    ? { label: "AI Tidak Aktif", variant: "outline" as const }
    : !activeConnection
      ? { label: "AI Aktif (Tanpa Koneksi)", variant: "warning" as const }
      : { label: "AI Aktif", variant: "success" as const };
  const selectedProvider =
    liveProviders.find((provider) => provider.id === form.providerId) ?? defaultProvider;
  const selectedModels = selectedProvider?.models ?? [];
  const editingConnection =
    aiConfig.providers.find((provider) => provider.id === editingConnectionId) ?? null;

  useEffect(() => {
    if (!selectedProvider) return;
    if (selectedModels.length === 0) return;
    if (selectedModels.includes(form.modelId)) return;

    setForm((current) => ({
      ...current,
      modelId: selectedModels[0] ?? current.modelId,
    }));
  }, [form.modelId, selectedModels, selectedProvider]);

  if (!canManage) {
    return null;
  }

  function resetForm() {
    setEditingConnectionId(null);
    setForm(buildInitialForm(defaultProvider?.id ?? "gemini", defaultModel));
    setLastTestStatus("idle");
    setLastTestedAt(null);
    setLastTestMessage("");
    setFormFeedback("");
  }

  function loadConnectionToForm(connectionId: string) {
    const connection = aiConfig.providers.find((provider) => provider.id === connectionId);
    if (!connection) return;

    setEditingConnectionId(connection.id);
    setForm({
      providerId: connection.providerId ?? defaultProvider?.id ?? "gemini",
      modelId: connection.modelId ?? connection.models[0] ?? defaultModel,
      label: connection.name,
      apiKey: "",
      endpointUrl: connection.endpointUrl ?? "",
    });
    setLastTestStatus(connection.connectionStatus ?? "idle");
    setLastTestedAt(connection.lastTestedAt ?? null);
    setLastTestMessage(connection.lastConnectionMessage ?? "");
    setFormFeedback(
      `Sedang mengedit koneksi ${connection.name}. API key tetap dimasked; isi ulang hanya jika ingin mengganti key.`
    );
    setPanelFeedback("");
  }

  async function syncConfigFromBackend() {
    try {
      await refreshAIConfig();
    } catch {
      // Ignore refresh-only failures because action feedback already shown elsewhere.
    }
  }

  async function handleTestConnection(useSavedConnection = false, connectionId?: string) {
    if (!currentUser) return;

    if (!useSavedConnection && !form.apiKey.trim()) {
      setLastTestStatus("failed");
      setLastTestMessage("API key wajib diisi sebelum uji koneksi koneksi baru atau perubahan key.");
      setFormFeedback("API key wajib diisi sebelum uji koneksi koneksi baru atau perubahan key.");
      return;
    }

    setIsTestingConnection(true);
    setFormFeedback("");

    try {
      const response = await fetch("/api/ai/providers/test-connection", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(
          useSavedConnection && connectionId
            ? {
                actorUserId: currentUser.id,
                connectionId,
              }
            : {
                actorUserId: currentUser.id,
                providerId: form.providerId,
                modelId: form.modelId,
                apiKey: form.apiKey.trim(),
              }
        ),
      });
      const { payload, rawText } = await readJsonResponseSafe<{
        ok?: boolean;
        data?: {
          connectionId?: string | null;
          status?: ConnectionTestStatus;
          message?: string;
          testedAt?: string;
        };
        error?: { message?: string };
      }>(response);

      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(
          payload?.error?.message ??
            summarizePlainTextError(rawText, "Uji koneksi AI gagal diproses.")
        );
      }

      setLastTestStatus(payload.data.status ?? "failed");
      setLastTestedAt(payload.data.testedAt ?? new Date().toISOString());
      setLastTestMessage(payload.data.message ?? "Uji koneksi AI selesai.");
      setFormFeedback(payload.data.message ?? "Uji koneksi AI selesai.");
      if (useSavedConnection && connectionId) {
        await syncConfigFromBackend();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Uji koneksi AI gagal diproses.";
      setLastTestStatus("failed");
      setLastTestMessage(message);
      setFormFeedback(message);
    } finally {
      setIsTestingConnection(false);
    }
  }

  async function handleSaveConnection() {
    if (!selectedProvider) {
      setFormFeedback("Provider AI belum tersedia.");
      return;
    }

    if (!form.modelId.trim()) {
      setFormFeedback("Model AI wajib dipilih.");
      return;
    }

    if (!editingConnection && !form.apiKey.trim()) {
      setFormFeedback("API key wajib diisi saat menambahkan koneksi AI baru.");
      return;
    }

    setIsSavingConnection(true);
    setFormFeedback("");

    const result = await setAIConfig({
      connection: {
        id: editingConnectionId ?? undefined,
        providerId: form.providerId,
        label: form.label.trim(),
        modelId: form.modelId,
        apiKey: form.apiKey.trim() || undefined,
        endpointUrl: form.endpointUrl.trim() || undefined,
        connectionStatus: lastTestStatus,
        lastTestedAt: lastTestedAt ?? undefined,
        lastConnectionMessage: lastTestMessage || undefined,
      },
    });

    if (result.ok) {
      setPanelFeedback(
        editingConnectionId
          ? "Koneksi AI berhasil diperbarui dan disimpan ke backend ALETA."
          : "Koneksi AI baru berhasil disimpan ke backend ALETA."
      );
      resetForm();
      await syncConfigFromBackend();
    } else {
      setFormFeedback(result.message);
    }

    setIsSavingConnection(false);
  }

  async function handleActivateConnection(connectionId: string) {
    setPendingConnectionActionId(connectionId);
    setPanelFeedback("");
    const result = await setAIConfig({
      activeConnectionId: connectionId,
    });

    if (result.ok) {
      setPanelFeedback("Koneksi AI aktif berhasil diganti. ALETA akan memakai koneksi ini pada request AI berikutnya.");
      await syncConfigFromBackend();
    } else {
      setPanelFeedback(result.message);
    }

    setPendingConnectionActionId(null);
  }

  async function handleDeleteConnection(connectionId: string) {
    setPendingConnectionActionId(connectionId);
    setPanelFeedback("");
    const result = await setAIConfig({
      deleteConnectionId: connectionId,
    });

    if (result.ok) {
      if (editingConnectionId === connectionId) {
        resetForm();
      }
      setPanelFeedback("Koneksi AI berhasil dihapus dari daftar aktif ALETA.");
      await syncConfigFromBackend();
    } else {
      setPanelFeedback(result.message);
    }

    setPendingConnectionActionId(null);
  }

  function buildLegacyModulePayload(moduleKey: keyof AIFeatureFlags, checked: boolean) {
    if (moduleKey === "oneStopDisposition") {
      return { featureDispositionAi: checked, featureDisposisiAi: checked };
    }
    if (moduleKey === "mailIntelligence") {
      return { featureMailIntelligence: checked };
    }
    if (moduleKey === "draftMetadata") {
      return { featureDraftMetadata: checked };
    }
    return {};
  }

  async function handleSaveGlobal(
    payload: Partial<
      Pick<
        typeof aiConfig,
        | "enabled"
        | "primaryLanguage"
        | "featureDispositionAi"
        | "featureMailIntelligence"
        | "featureDraftMetadata"
        | "featureManajemenSuratAi"
        | "featureDisposisiAi"
      >
    > & { featureFlags?: PartialAIFeatureFlags }
  ) {
    setIsSavingGlobal(true);
    const result = await setAIConfig(payload);
    setPanelFeedback(result.message);
    if (result.ok) {
      await syncConfigFromBackend();
    }
    setIsSavingGlobal(false);
  }

  return (
    <Card className="border-border/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <AletaAIMark compact />
          ALETA Intelligence Service
        </CardTitle>
        <CardDescription>
          Pengaturan AI kini dipisah antara <strong className="text-foreground">form tambah/edit koneksi</strong> dan
          <strong className="text-foreground"> daftar koneksi AI tersimpan</strong>. ALETA hanya memakai koneksi aktif dari backend.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
        <div className="space-y-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-10rem)] xl:overflow-y-auto">
          <div className="rounded-[1.4rem] border border-border bg-muted/30 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-border bg-card/80 p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Status AI Global</p>
                <p className="text-sm text-muted-foreground">
                  Toggle ini mengatur apakah seluruh fitur AI ALETA aktif atau disembunyikan.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={activeBadge.variant}>{activeBadge.label}</Badge>
                <Switch
                  checked={aiConfig.enabled}
                  disabled={isSavingGlobal}
                  onCheckedChange={(checked) => {
                    void handleSaveGlobal({ enabled: checked });
                  }}
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Fitur AI Per-Modul</p>
              {AI_FEATURE_MODULE_GROUPS.map((module) => {
                const moduleFlags = aiConfig.featureFlags[module.key] as unknown as Record<string, boolean>;
                const moduleEnabled = Boolean(moduleFlags.enabled);
                const subfeaturesEnabled = module.subfeatures.filter((item) => moduleFlags[item.key]).length;

                return (
                  <div key={module.key} className="rounded-[1.2rem] border border-border bg-card/80 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium text-foreground">{module.label}</p>
                        <p className="text-xs text-muted-foreground">{module.desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={moduleEnabled ? "success" : "muted"}>
                          {moduleEnabled ? "Aktif" : "Nonaktif"}
                        </Badge>
                        <Switch
                          checked={moduleEnabled}
                          disabled={isSavingGlobal}
                          onCheckedChange={(checked) => {
                            void handleSaveGlobal({
                              ...buildLegacyModulePayload(module.key, checked),
                              featureFlags: {
                                [module.key]: {
                                  ...moduleFlags,
                                  enabled: checked,
                                },
                              } as PartialAIFeatureFlags,
                            });
                          }}
                        />
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl border border-border/70 bg-muted/25 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Subfitur
                        </p>
                        <Badge variant="outline">
                          {subfeaturesEnabled}/{module.subfeatures.length} aktif
                        </Badge>
                      </div>
                      <div className="grid gap-2">
                        {module.subfeatures.map((subfeature) => (
                          <div
                            key={subfeature.key}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card/70 px-3 py-2"
                          >
                            <div className="space-y-0.5">
                              <p className="text-xs font-medium text-foreground">{subfeature.label}</p>
                              <p className="text-xs text-muted-foreground">{subfeature.desc}</p>
                            </div>
                            <Switch
                              checked={Boolean(moduleFlags[subfeature.key])}
                              disabled={isSavingGlobal || !aiConfig.enabled || !moduleEnabled}
                              onCheckedChange={(checked) => {
                                void handleSaveGlobal({
                                  featureFlags: {
                                    [module.key]: {
                                      ...moduleFlags,
                                      [subfeature.key]: checked,
                                    },
                                  } as PartialAIFeatureFlags,
                                });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Bahasa Utama ALETA">
                <NativeSelect
                  value={aiConfig.primaryLanguage}
                  disabled={isSavingGlobal}
                  onChange={(event) => {
                    void handleSaveGlobal({
                      primaryLanguage: event.target.value as "id" | "en",
                    });
                  }}
                  className="h-11 text-base"
                >
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </NativeSelect>
              </Field>
              <div className="rounded-[1.2rem] border border-primary/20 bg-primary/5 px-4 py-3">
                <p className="text-sm font-semibold text-foreground">Koneksi aktif yang dipakai ALETA</p>
                {activeConnection ? (
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    <p>
                      <strong className="text-foreground">{activeConnection.name}</strong>
                    </p>
                    <p>
                      {activeConnection.providerName} • {activeConnection.modelId}
                    </p>
                    <p>API key: {activeConnection.maskedApiKey || "Tersimpan"}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Belum ada koneksi AI aktif. Simpan koneksi lalu pilih salah satunya agar ALETA memakai koneksi tersebut.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-border bg-card/80 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {editingConnection ? "Edit koneksi AI" : "Tambah koneksi AI"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Provider dan model di form ini menentukan koneksi mana yang nantinya bisa diuji, disimpan, dan dipilih aktif.
                </p>
              </div>
              {editingConnection ? (
                <Button type="button" variant="outline" onClick={resetForm}>
                  <Plus className="h-4 w-4" />
                  Koneksi Baru
                </Button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Provider">
                <NativeSelect
                  value={form.providerId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      providerId: event.target.value,
                    }))
                  }
                  className="h-11 text-base"
                >
                  {liveProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Model">
                <NativeSelect
                  value={form.modelId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      modelId: event.target.value,
                    }))
                  }
                  className="h-11 text-base"
                >
                  {selectedModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Label / Nama Koneksi">
                <Input
                  value={form.label}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      label: event.target.value,
                    }))
                  }
                  placeholder={`${selectedProvider?.name ?? "Provider"} - ${form.modelId}`}
                  className="h-11 text-base"
                />
              </Field>
              <Field label="API Key">
                <Input
                  type="password"
                  value={form.apiKey}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      apiKey: event.target.value,
                    }))
                  }
                  placeholder={editingConnection ? "Kosongkan jika tidak ingin mengganti API key" : "Tempel API key di sini"}
                  className="h-11 text-base"
                />
                {editingConnection?.maskedApiKey ? (
                  <p className="text-xs text-muted-foreground">
                    API key tersimpan saat ini: <strong className="text-foreground">{editingConnection.maskedApiKey}</strong>
                  </p>
                ) : null}
              </Field>
            </div>

            <Field label="Endpoint Override (opsional)">
              <Input
                value={form.endpointUrl}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    endpointUrl: event.target.value,
                  }))
                }
                placeholder="Biarkan kosong untuk memakai endpoint bawaan provider"
                className="h-11 text-base"
              />
            </Field>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Badge variant={statusMeta(lastTestStatus).variant}>{statusMeta(lastTestStatus).label}</Badge>
              <span className="text-xs text-muted-foreground">{formatLastTested(lastTestedAt ?? undefined)}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={isTestingConnection}
                onClick={() => void handleTestConnection(Boolean(editingConnection && !form.apiKey.trim()), editingConnectionId ?? undefined)}
              >
                {isTestingConnection ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
                Uji Koneksi
              </Button>
              <Button
                type="button"
                disabled={isSavingConnection}
                onClick={() => void handleSaveConnection()}
              >
                {isSavingConnection ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {editingConnection ? "Simpan Perubahan" : "Simpan Koneksi"}
              </Button>
            </div>

            {formFeedback ? (
              <div
                className={cn(
                  "mt-4 rounded-[1.2rem] border px-4 py-3 text-sm",
                  lastTestStatus === "failed"
                    ? "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                    : "border-primary/20 bg-primary/5 text-muted-foreground"
                )}
              >
                {formFeedback}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-10rem)] xl:overflow-y-auto">
          <div className="rounded-[1.4rem] border border-border bg-card/80 p-5">
            <div className="flex items-center gap-2 text-primary">
              <ServerCog className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">Koneksi Tersimpan</p>
            </div>
            <p className="mt-4 text-3xl font-semibold text-foreground">{aiConfig.providers.length}</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Daftar koneksi AI yang benar-benar tersimpan di backend ALETA. Setelah disimpan, API key hanya ditampilkan dalam bentuk masked.
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-border bg-card/80 p-5">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">Cakupan AI</p>
            </div>
            <p className="mt-4 text-3xl font-semibold text-foreground">{intelligenceReadyModules.length}</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Modul lintas ALETA yang siap memakai koneksi aktif dari pengaturan ini.
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-border bg-card/80 p-5">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">Knowledge Base</p>
            </div>
            <p className="mt-4 text-3xl font-semibold text-foreground">{regulationsKnowledgeBase.length}</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Basis rujukan ALETA yang bekerja bersama koneksi AI aktif.
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-border bg-muted/30 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Daftar koneksi AI tersimpan</p>
              {activeConnection ? <Badge variant="success">Dipakai ALETA: {activeConnection.name}</Badge> : null}
            </div>

            <div className="mt-4 space-y-3">
              {aiConfig.providers.length === 0 ? (
                <div className="rounded-[1.2rem] border border-dashed border-border bg-card/80 px-4 py-5 text-sm text-muted-foreground">
                  Belum ada koneksi AI tersimpan. Tambahkan koneksi pertama dari form di sebelah kiri.
                </div>
              ) : (
                aiConfig.providers.map((connection) => {
                  const connectionStatus = statusMeta(connection.connectionStatus ?? "idle");
                  const isBusy = pendingConnectionActionId === connection.id;

                  return (
                    <div key={connection.id} className="rounded-[1.2rem] border border-border bg-card/90 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{connection.name}</p>
                            {connection.isActive ? (
                              aiConfig.enabled ? (
                                <Badge>Aktif</Badge>
                              ) : (
                                <Badge variant="warning">Aktif (AI mati)</Badge>
                              )
                            ) : (
                              <Badge variant="outline">Tidak aktif</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {connection.providerName} • {connection.modelId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            API key: <strong className="text-foreground">{connection.maskedApiKey || "Tidak tersedia"}</strong>
                          </p>
                        </div>
                        <Badge variant={connectionStatus.variant}>{connectionStatus.label}</Badge>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                        <p>Terakhir diuji: {formatLastTested(connection.lastTestedAt)}</p>
                        <p>
                          Status terakhir:{" "}
                          <strong className="text-foreground">
                            {connection.lastConnectionMessage || "Belum ada catatan hasil uji koneksi."}
                          </strong>
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {!connection.isActive ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleActivateConnection(connection.id)}
                            disabled={isBusy}
                          >
                            {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                            Pakai di ALETA
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => loadConnectionToForm(connection.id)}
                        >
                          <PencilLine className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isTestingConnection}
                          onClick={() => void handleTestConnection(true, connection.id)}
                        >
                          {isTestingConnection && editingConnectionId !== connection.id ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wifi className="h-4 w-4" />
                          )}
                          Uji Lagi
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={() => void handleDeleteConnection(connection.id)}
                        >
                          {isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Hapus
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {panelFeedback ? (
            <div className="rounded-[1.2rem] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              {panelFeedback}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}
