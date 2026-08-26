"use client";

import { CheckCircle2, Database, ExternalLink, LayoutDashboard, LoaderCircle, Settings } from "lucide-react";
import { useMemo, useState } from "react";

import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/lib/app-state";
import { type ExternalAppId, type ExternalAppLaunchSettings, type FooterMode, type PortalCardVisibility } from "@/lib/types";

const footerModeOptions: Array<{
  value: FooterMode;
  label: string;
  description: string;
  preview: string;
}> = [
  {
    value: "auto",
    label: "Otomatis",
    description: "Portal utama memakai footer lengkap, halaman kerja dan admin memakai footer ringkas.",
    preview: "Paling aman untuk penggunaan harian.",
  },
  {
    value: "compact",
    label: "Ringkas",
    description: "Semua halaman memakai footer pendek berisi identitas, kontak penting, dan tautan bantuan.",
    preview: "Cocok untuk layar kecil dan halaman operasional.",
  },
  {
    value: "full",
    label: "Lengkap",
    description: "Semua halaman menampilkan footer besar dengan kontak utama dan kanal digital lengkap.",
    preview: "Cocok untuk portal informasi atau layar publik.",
  },
];

const portalCardOptions: Array<{
  key: keyof PortalCardVisibility;
  label: string;
  description: string;
}> = [
  {
    key: "workSummary",
    label: "Ringkasan Kerja",
    description: "Kartu besar di bagian atas Portal ALETA yang menampilkan tugas, status, dan pintasan cepat.",
  },
  {
    key: "mainMenu",
    label: "Menu ALETA",
    description: "Kartu daftar aplikasi utama yang bisa dibuka oleh user.",
  },
  {
    key: "importantTasks",
    label: "Tugas & Pemberitahuan",
    description: "Kartu daftar tugas penting, disposisi, pesan gagal, dan notifikasi lain.",
  },
];

const externalAppOptions: Array<{ appId: ExternalAppId; label: string; launchUrl: string }> = [
  { appId: "sipp", label: "SIPP", launchUrl: "/api/external-apps/sipp/launch" },
  { appId: "aps-badilag", label: "APS Badilag", launchUrl: "/api/external-apps/aps-badilag/launch" },
];

function externalAppsChanged(
  left: Record<ExternalAppId, ExternalAppLaunchSettings>,
  right: Record<ExternalAppId, ExternalAppLaunchSettings>
) {
  return externalAppOptions.some(({ appId }) => {
    const a = left[appId];
    const b = right[appId];
    return (
      a.enabled !== b.enabled ||
      a.baseUrl !== b.baseUrl ||
      a.loginPath !== b.loginPath ||
      a.usernameField !== b.usernameField ||
      a.passwordField !== b.passwordField ||
      a.passwordMode !== b.passwordMode ||
      a.notes !== b.notes
    );
  });
}

export function PanelSettingsPanel() {
  const { currentUser, panelSettings, updatePanelSettings } = usePortal();
  const isAllowed = currentUser?.roleId === "super-admin" || currentUser?.roleId === "admin";
  const [footerMode, setFooterMode] = useState<FooterMode>(panelSettings.footerMode);
  const [portalCards, setPortalCards] = useState<PortalCardVisibility>(panelSettings.portalCards);
  const [externalApps, setExternalApps] = useState<Record<ExternalAppId, ExternalAppLaunchSettings>>(panelSettings.externalApps);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const activeOption = useMemo(
    () => footerModeOptions.find((option) => option.value === footerMode) ?? footerModeOptions[0],
    [footerMode]
  );
  const hasChanges =
    footerMode !== panelSettings.footerMode ||
    portalCardOptions.some((option) => portalCards[option.key] !== panelSettings.portalCards[option.key]) ||
    externalAppsChanged(externalApps, panelSettings.externalApps);
  const activePortalCardCount = portalCardOptions.filter((option) => portalCards[option.key]).length;

  if (!isAllowed) {
    return (
      <div className="space-y-6">
        <PageIntro
          eyebrow="Portal Pengaturan Global"
          title="Pengaturan Panel"
          description="Pengaturan tampilan panel hanya dapat diubah oleh Admin atau Super Admin."
        />
        <AccessDeniedCard />
      </div>
    );
  }

  const saveSettings = async () => {
    setIsSaving(true);
    setFeedback("");

    const result = await updatePanelSettings({ footerMode, portalCards, externalApps });
    setFeedback(result.message);
    setIsSaving(false);
  };

  const updatePortalCard = (key: keyof PortalCardVisibility, checked: boolean) => {
    setPortalCards((current) => ({ ...current, [key]: checked }));
  };

  const updateExternalApp = (appId: ExternalAppId, patch: Partial<ExternalAppLaunchSettings>) => {
    setExternalApps((current) => ({
      ...current,
      [appId]: {
        ...current[appId],
        ...patch,
      },
    }));
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Portal Pengaturan Global"
        title="Pengaturan Panel"
        description="Atur tampilan global panel ALETA. Untuk saat ini pengaturan berisi mode footer, dan halaman ini disiapkan sebagai pusat pengaturan UI lain berikutnya."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <CardTitle>Mode Footer</CardTitle>
                  <CardDescription>
                    Pilih bagaimana footer tampil di seluruh halaman setelah login.
                  </CardDescription>
                </div>
                <Badge variant={hasChanges ? "warning" : "success"}>
                  {hasChanges ? "Belum Disimpan" : "Tersimpan"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                {footerModeOptions.map((option) => {
                  const selected = option.value === footerMode;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFooterMode(option.value)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-primary/60 bg-primary/10 text-foreground shadow-panel"
                          : "border-border bg-card/70 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{option.label}</p>
                        {selected ? <CheckCircle2 className="h-4 w-4 text-primary" /> : null}
                      </div>
                      <p className="mt-3 text-sm leading-6">{option.description}</p>
                    </button>
                  );
                })}
              </div>

              <label className="block space-y-2 text-sm font-medium text-foreground">
                Mode footer aktif
                <NativeSelect
                  value={footerMode}
                  onChange={(event) => setFooterMode(event.target.value as FooterMode)}
                >
                  {footerModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <CardTitle>Kartu Portal ALETA</CardTitle>
                  <CardDescription>
                    Aktifkan atau sembunyikan kartu yang tampil di halaman Portal ALETA.
                  </CardDescription>
                </div>
                <Badge variant="muted">{activePortalCardCount} aktif</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {portalCardOptions.map((option) => {
                const switchId = `portal-card-${option.key}`;

                return (
                  <div
                    key={option.key}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-card/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <label htmlFor={switchId} className="min-w-0 space-y-1">
                      <p className="font-semibold text-foreground">{option.label}</p>
                      <p className="text-sm leading-6 text-muted-foreground">{option.description}</p>
                    </label>
                    <Switch
                      id={switchId}
                      checked={portalCards[option.key]}
                      onCheckedChange={(checked) => updatePortalCard(option.key, checked)}
                    />
                  </div>
                );
              })}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Perubahan ini berlaku untuk semua user yang membuka Portal ALETA.
                </p>
                <Button onClick={() => void saveSettings()} disabled={isSaving || !hasChanges}>
                  {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                  {isSaving ? "Menyimpan..." : hasChanges ? "Simpan Pengaturan" : "Sudah Tersimpan"}
                </Button>
              </div>

              {feedback ? (
                <div className="rounded-xl border border-border bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
                  {feedback}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <CardTitle>Direct Link SIPP dan APS Badilag</CardTitle>
                  <CardDescription>
                    Atur tujuan kartu di grid Portal. Saat user klik kartu, ALETA membuka sesi login otomatis memakai kredensial yang tersimpan di Manajemen Akun.
                  </CardDescription>
                </div>
                <Badge variant={externalAppsChanged(externalApps, panelSettings.externalApps) ? "warning" : "success"}>
                  {externalAppsChanged(externalApps, panelSettings.externalApps) ? "Belum Disimpan" : "Sinkron"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {externalAppOptions.map((option) => {
                const config = externalApps[option.appId];
                const targetUrl = `${config.baseUrl.replace(/\/+$/, "")}/${config.loginPath.replace(/^\/+/, "")}`;

                return (
                  <div key={option.appId} className="rounded-2xl border border-border bg-card/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-primary/10 p-3 text-primary">
                          <Database className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{option.label}</p>
                          <p className="text-sm leading-6 text-muted-foreground">
                            Grid Portal membuka {option.launchUrl}, lalu ALETA mengirim form login ke URL tujuan di bawah.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={config.enabled ? "success" : "muted"}>{config.enabled ? "Aktif" : "Nonaktif"}</Badge>
                        <Switch
                          checked={config.enabled}
                          onCheckedChange={(checked) => updateExternalApp(option.appId, { enabled: checked })}
                          aria-label={`Aktifkan direct link ${option.label}`}
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="space-y-2 text-sm font-medium text-foreground">
                        URL aplikasi
                        <Input
                          value={config.baseUrl}
                          onChange={(event) => updateExternalApp(option.appId, { baseUrl: event.target.value })}
                          placeholder="https://sipp.pa-xxx.go.id"
                        />
                      </label>
                      <label className="space-y-2 text-sm font-medium text-foreground">
                        Path login
                        <Input
                          value={config.loginPath}
                          onChange={(event) => updateExternalApp(option.appId, { loginPath: event.target.value })}
                          placeholder="index.php/login"
                        />
                      </label>
                      <label className="space-y-2 text-sm font-medium text-foreground">
                        Field username
                        <Input
                          value={config.usernameField}
                          onChange={(event) => updateExternalApp(option.appId, { usernameField: event.target.value })}
                          placeholder="username"
                        />
                      </label>
                      <label className="space-y-2 text-sm font-medium text-foreground">
                        Field password
                        <Input
                          value={config.passwordField}
                          onChange={(event) => updateExternalApp(option.appId, { passwordField: event.target.value })}
                          placeholder="password"
                        />
                      </label>
                      <label className="space-y-2 text-sm font-medium text-foreground">
                        Mode password
                        <NativeSelect
                          value={config.passwordMode}
                          onChange={(event) =>
                            updateExternalApp(option.appId, {
                              passwordMode: event.target.value === "md5" ? "md5" : "plain",
                            })
                          }
                        >
                          <option value="plain">Plaintext ke form login</option>
                          <option value="md5">MD5 lama SIPP</option>
                        </NativeSelect>
                      </label>
                      <label className="space-y-2 text-sm font-medium text-foreground md:row-span-2">
                        Catatan admin
                        <Textarea
                          value={config.notes}
                          onChange={(event) => updateExternalApp(option.appId, { notes: event.target.value })}
                          rows={4}
                          placeholder="Catatan URL, VPN, jaringan internal, atau perubahan field login."
                        />
                      </label>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-muted/25 p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span className="break-all">Target login: {targetUrl}</span>
                      <Button variant="outline" size="sm" asChild>
                        <a href={option.launchUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          Uji dari Grid
                        </a>
                      </Button>
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Kredensial per pegawai tetap diisi dari Manajemen Akun. Pengaturan ini hanya menentukan direct link dan cara submit login.
                </p>
                <Button onClick={() => void saveSettings()} disabled={isSaving || !hasChanges}>
                  {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                  {isSaving ? "Menyimpan..." : hasChanges ? "Simpan Direct Link" : "Sudah Sinkron"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Preview Ringkas</CardTitle>
            <CardDescription>
              {activeOption.preview} Portal menampilkan {activePortalCardCount} kartu aktif.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border bg-background/45 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <LayoutDashboard className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{activeOption.label}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{activeOption.description}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-border bg-muted/25 p-4 text-sm leading-6 text-muted-foreground">
              Pengaturan ini langsung dipakai footer global. Mode otomatis membuat halaman kerja terasa ringan tanpa menghilangkan footer lengkap di portal utama.
            </div>
            <div className="space-y-2 rounded-2xl border border-border bg-background/45 p-4">
              <p className="font-semibold text-foreground">Kartu Portal Aktif</p>
              <div className="space-y-2">
                {portalCardOptions.map((option) => (
                  <div key={option.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{option.label}</span>
                    <Badge variant={portalCards[option.key] ? "success" : "muted"}>
                      {portalCards[option.key] ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
