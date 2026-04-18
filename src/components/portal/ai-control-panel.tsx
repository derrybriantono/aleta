"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Link2, Plus, ShieldCheck, Sparkles } from "lucide-react";

import { AletaAIMark } from "@/components/branding/aleta-ai-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { regulationsKnowledgeBase } from "@/core/knowledge/regulations-db";
import { hybridModuleRegistry } from "@/core/platform/module-registry";
import { popularAIProviderCatalog } from "@/lib/ai-catalog";
import { usePortal } from "@/lib/app-state";
import { readJsonResponseSafe, summarizePlainTextError } from "@/lib/http-response";
import { canManageGlobalAI } from "@/lib/permissions";

function statusMeta(status: "idle" | "connected" | "failed") {
  if (status === "connected") return { label: "Berhasil terhubung", variant: "success" as const };
  if (status === "failed") return { label: "Gagal terhubung", variant: "danger" as const };
  return { label: "Belum diuji", variant: "outline" as const };
}

const recommendedFreeProvider =
  popularAIProviderCatalog.find((provider) => provider.id === "gemini") ?? popularAIProviderCatalog[0];

export function AIControlPanel() {
  const { aiConfig, currentUser, setAIConfig } = usePortal();
  const [customProviderOpen, setCustomProviderOpen] = useState(false);
  const [catalogProviderId, setCatalogProviderId] = useState(recommendedFreeProvider?.id ?? "gemini");
  const [catalogModel, setCatalogModel] = useState(recommendedFreeProvider?.models.at(-1) ?? "Gemini 2.0 Flash");
  const [apiKey, setApiKey] = useState("");
  const [customStatus, setCustomStatus] = useState<"idle" | "connected" | "failed">("idle");
  const [feedback, setFeedback] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSavingProvider, setIsSavingProvider] = useState(false);

  if (!canManageGlobalAI(currentUser)) {
    return null;
  }

  const intelligenceReadyModules = hybridModuleRegistry.filter((module) => module.intelligenceReady);
  const selectedProvider =
    aiConfig.providers.find((provider) => provider.id === aiConfig.providerId) ?? aiConfig.providers[0] ?? null;
  const providerStatus = statusMeta(selectedProvider?.connectionStatus ?? "idle");
  const templateProvider =
    popularAIProviderCatalog.find((provider) => provider.id === catalogProviderId) ?? popularAIProviderCatalog[0];
  const templateModels = templateProvider?.models ?? [];
  const aiStatus = aiConfig.enabled ? { label: "AI Aktif", variant: "success" as const } : { label: "AI Tidak Aktif", variant: "outline" as const };
  const customCandidates = popularAIProviderCatalog.filter(
    (provider) => !aiConfig.providers.some((existingProvider) => existingProvider.id === provider.id)
  );

  return (
    <Card className="border-border/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <AletaAIMark compact />
          ALETA Intelligence Service
        </CardTitle>
        <CardDescription>
          Kontrol pusat AI lintas modul. Saat AI dimatikan, seluruh elemen AI di halaman lain akan otomatis disembunyikan.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4 rounded-[1.4rem] border border-border bg-muted/30 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-border bg-card/80 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Status AI Global</p>
              <p className="text-sm text-muted-foreground">Toggle ini mengatur visibilitas seluruh fitur AI di ALETA.</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={aiStatus.variant}>{aiStatus.label}</Badge>
              <Switch checked={aiConfig.enabled} onCheckedChange={(checked) => setAIConfig({ enabled: checked })} />
            </div>
          </div>

          {aiConfig.enabled ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Provider AI">
                  <NativeSelect
                    value={aiConfig.providerId}
                    onChange={(event) => {
                      const providerId = event.target.value;
                      const provider = aiConfig.providers.find((item) => item.id === providerId);
                      setAIConfig({
                        providerId,
                        modelId: provider?.models[0] ?? aiConfig.modelId,
                      });
                    }}
                    className="h-11 text-base"
                  >
                    {aiConfig.providers.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Model AI">
                  <NativeSelect
                    value={aiConfig.modelId}
                    onChange={(event) => setAIConfig({ modelId: event.target.value })}
                    className="h-11 text-base"
                  >
                    {(selectedProvider?.models ?? []).map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Bahasa Utama">
                  <NativeSelect
                    value={aiConfig.primaryLanguage}
                    onChange={(event) =>
                      setAIConfig({ primaryLanguage: event.target.value as typeof aiConfig.primaryLanguage })
                    }
                    className="h-11 text-base"
                  >
                    <option value="id">Bahasa Indonesia</option>
                    <option value="en">English</option>
                  </NativeSelect>
                </Field>
              </div>

              <div className="rounded-[1.3rem] border border-border bg-card/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Tambah AI Kustom</p>
                    <p className="text-sm text-muted-foreground">
                      Tambahkan provider AI populer berikut model versinya hanya saat memang diperlukan. Untuk token gratis,
                      mulai dari <strong className="text-foreground">Gemini Flash</strong>.
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => setCustomProviderOpen((value) => !value)}>
                    {customProviderOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {customProviderOpen ? "Tutup" : "Buka"}
                  </Button>
                </div>

                {customProviderOpen ? (
                  <div className="mt-4 space-y-4 rounded-[1.2rem] border border-border bg-muted/35 p-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Jenis AI">
                        <NativeSelect
                          value={catalogProviderId}
                          onChange={(event) => {
                            const nextProviderId = event.target.value;
                            const nextProvider = popularAIProviderCatalog.find((provider) => provider.id === nextProviderId);
                            setCatalogProviderId(nextProviderId);
                            setCatalogModel(nextProvider?.models[0] ?? "");
                            setCustomStatus("idle");
                          }}
                          className="h-11 text-base"
                        >
                          {customCandidates.concat(aiConfig.providers).map((provider) => (
                            <option key={provider.id} value={provider.id}>
                              {provider.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Field label="Model / Version">
                        <NativeSelect
                          value={catalogModel}
                          onChange={(event) => setCatalogModel(event.target.value)}
                          className="h-11 text-base"
                        >
                          {templateModels.map((model) => (
                            <option key={model} value={model}>
                              {model}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                      <Field label="API Key">
                        <Input
                          value={apiKey}
                          onChange={(event) => {
                            setApiKey(event.target.value);
                            setCustomStatus("idle");
                          }}
                          placeholder="Tempel API key di sini"
                          className="h-11 text-base"
                        />
                      </Field>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant={statusMeta(customStatus).variant}>{statusMeta(customStatus).label}</Badge>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isTestingConnection}
                        onClick={async () => {
                          if (!currentUser) return;
                          if (!apiKey.trim()) {
                            setCustomStatus("failed");
                            setFeedback("API key wajib diisi sebelum uji koneksi.");
                            return;
                          }

                          setIsTestingConnection(true);
                          setFeedback("");

                          try {
                            const response = await fetch("/api/ai/providers/test-connection", {
                              method: "POST",
                              headers: {
                                "content-type": "application/json",
                              },
                              body: JSON.stringify({
                                providerId: catalogProviderId,
                                apiKey: apiKey.trim(),
                              }),
                            });
                            const { payload, rawText } = await readJsonResponseSafe<{
                              ok?: boolean;
                              data?: { status?: "connected" | "failed"; message?: string };
                              error?: { message?: string };
                            }>(response);

                            const connectionData = payload?.data;

                            if (!response.ok || !payload?.ok || !connectionData) {
                              throw new Error(
                                payload?.error?.message ??
                                  summarizePlainTextError(rawText, "Uji koneksi AI gagal diproses.")
                              );
                            }

                            setCustomStatus(connectionData.status ?? "failed");
                            setFeedback(connectionData.message ?? "Uji koneksi AI selesai.");
                          } catch (error) {
                            setCustomStatus("failed");
                            setFeedback(error instanceof Error ? error.message : "Uji koneksi AI gagal diproses.");
                          } finally {
                            setIsTestingConnection(false);
                          }
                        }}
                      >
                        <Link2 className="h-4 w-4" />
                        {isTestingConnection ? "Menguji..." : "Uji Koneksi"}
                      </Button>
                      <Button
                        type="button"
                        disabled={isSavingProvider}
                        onClick={async () => {
                          if (!templateProvider || !catalogModel.trim()) {
                            setFeedback("Pilih jenis AI dan model terlebih dahulu.");
                            return;
                          }

                          if (!apiKey.trim()) {
                            setCustomStatus("failed");
                            setFeedback("API key wajib diisi sebelum provider disimpan.");
                            return;
                          }

                          const nextProvider = {
                            id: templateProvider.id,
                            name: templateProvider.name,
                            apiKey: apiKey.trim(),
                            endpointUrl: templateProvider.endpointUrl,
                            models: Array.from(new Set([catalogModel, ...templateProvider.models])),
                            builtin: false,
                          };
                          setIsSavingProvider(true);

                          const result = await setAIConfig({
                            providerId: nextProvider.id,
                            modelId: catalogModel,
                            provider: nextProvider,
                          });

                          setFeedback(
                            result.ok
                              ? `${nextProvider.name} dengan model ${catalogModel} berhasil disimpan ke backend ALETA.`
                              : result.message
                          );
                          setCustomStatus(result.ok ? (customStatus === "idle" ? "connected" : customStatus) : "failed");
                          setIsSavingProvider(false);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        {isSavingProvider ? "Menyimpan..." : "Tambah AI Kustom"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {feedback ? (
            <div className="rounded-[1.2rem] border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              {feedback}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4">
          <div className="rounded-[1.4rem] border border-border bg-card/80 p-5">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">Cakupan AI</p>
            </div>
            <p className="mt-4 text-3xl font-semibold text-foreground">{intelligenceReadyModules.length}</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Modul lintas ALETA yang sudah siap memakai ALETA Intelligence Service yang sama.
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-border bg-card/80 p-5">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-xs font-semibold uppercase tracking-[0.2em]">Knowledge Base</p>
            </div>
            <p className="mt-4 text-3xl font-semibold text-foreground">{regulationsKnowledgeBase.length}</p>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              Regulasi internal dan eksternal yang dipakai untuk contextual search lintas modul ALETA.
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-border bg-card/80 p-5">
            <AletaAIMark label="Status provider aktif" />
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={aiStatus.variant}>{aiStatus.label}</Badge>
              <Badge variant={providerStatus.variant}>{providerStatus.label}</Badge>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Provider aktif: <strong className="text-foreground">{selectedProvider?.name ?? "-"}</strong>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Model aktif: <strong className="text-foreground">{aiConfig.modelId}</strong>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {aiConfig.providers.map((provider) => (
                <Badge key={provider.id} variant={provider.id === aiConfig.providerId ? "default" : "outline"}>
                  {provider.name}
                </Badge>
              ))}
            </div>
          </div>
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
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}
