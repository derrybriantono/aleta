"use client";

import Link from "next/link";
import { Building2, CheckCircle2, Landmark, Link2, LoaderCircle, MessageCircleMore, Smartphone, Sparkles, Unplug } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AletaLogo } from "@/components/branding/aleta-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/lib/app-state";
import { type InstitutionIdentity } from "@/lib/types";
import { cn } from "@/lib/utils";

function statusCopy(status: "active" | "inactive" | "failed") {
  if (status === "active") return { label: "Aktif", badge: "success" as const };
  if (status === "failed") return { label: "Gagal", badge: "danger" as const };
  return { label: "Tidak Aktif", badge: "outline" as const };
}

function scannerStatusCopy(status: "inactive" | "initializing" | "qr" | "authenticated" | "ready" | "failed") {
  if (status === "qr") return "QR siap dipindai";
  if (status === "initializing") return "Menyiapkan sesi WhatsApp Web";
  if (status === "authenticated") return "Sesi sudah terautentikasi, menunggu siap";
  if (status === "ready") return "WhatsApp kantor sudah tertaut";
  if (status === "failed") return "Inisialisasi WhatsApp gagal";
  return "Sesi WhatsApp belum diinisialisasi";
}

function useWhatsAppQr(canEdit: boolean) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [scannerStatus, setScannerStatus] = useState<
    "inactive" | "initializing" | "qr" | "authenticated" | "ready" | "failed"
  >("inactive");
  const [isFetchingQr, setIsFetchingQr] = useState(false);
  const [qrFeedback, setQrFeedback] = useState("");

  const refreshQrStatus = async () => {
    if (!canEdit) return;

    const response = await globalThis.fetch("/api/whatsapp/qr", {
      credentials: "include",
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | {
          ok?: boolean;
          data?: {
            qr?: string | null;
            status?: "inactive" | "initializing" | "qr" | "authenticated" | "ready" | "failed";
            linked?: boolean;
          };
          error?: { message?: string };
        }
      | null;

    if (!response.ok || !payload?.ok || !payload.data) {
      throw new Error(payload?.error?.message ?? "Status QR WhatsApp tidak dapat dibaca.");
    }

    setQrCode(payload.data.qr ?? null);
    setScannerStatus(payload.data.status ?? "inactive");
    if (payload.data.linked) {
      setQrFeedback("WhatsApp kantor sudah tertaut dan siap digunakan untuk notifikasi.");
    }
  };

  const initializeQrLink = async () => {
    if (!canEdit) return;

    setIsFetchingQr(true);
    setQrFeedback("");

    try {
      const response = await globalThis.fetch("/api/whatsapp/init", {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: { message?: string };
            error?: { message?: string };
          }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "Inisialisasi WhatsApp gagal diproses.");
      }

      setScannerStatus("initializing");
      setQrFeedback(payload.data?.message ?? "Menyiapkan QR WhatsApp...");
      await refreshQrStatus();
    } catch (error) {
      setScannerStatus("failed");
      setQrFeedback(error instanceof Error ? error.message : "Inisialisasi WhatsApp gagal diproses.");
    } finally {
      setIsFetchingQr(false);
    }
  };

  useEffect(() => {
    if (!canEdit) return;
    if (!["initializing", "qr", "authenticated"].includes(scannerStatus)) return;

    const timer = globalThis.setInterval(() => {
      void refreshQrStatus().catch(() => undefined);
    }, 2500);

    return () => globalThis.clearInterval(timer);
  }, [canEdit, scannerStatus]);

  return {
    qrCode,
    qrFeedback,
    scannerStatus,
    isFetchingQr,
    initializeQrLink,
    refreshQrStatus,
  };
}

export function IdentitySettingsForm() {
  const {
    currentUser,
    institutionIdentity,
    updateInstitutionIdentity,
  } = usePortal();
  const canEdit = currentUser?.roleId === "super-admin" || currentUser?.roleId === "admin";
  const [identityOverrides, setIdentityOverrides] = useState<Partial<typeof institutionIdentity>>({});
  const [feedback, setFeedback] = useState("");
  const [selectedSatkerLabel, setSelectedSatkerLabel] = useState("");
  const identityForm = { ...institutionIdentity, ...identityOverrides };

  return (
    <Card className="border-border/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          Pengaturan Identitas Instansi
        </CardTitle>
        <CardDescription>Data ini dipakai oleh footer, login branding, dan identitas instansi di seluruh ALETA.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <SmartCourtNameInput
            value={identityForm.courtName}
            onChange={(value) => setIdentityOverrides((current) => ({ ...current, courtName: value }))}
            onSelectSuggestion={(suggestion) => {
              setIdentityOverrides(suggestion.identity);
              setSelectedSatkerLabel(suggestion.satkerLabel);
              setFeedback(`Satuan kerja terdeteksi: ${suggestion.satkerLabel}. Identitas instansi diisi otomatis, silakan verifikasi sebelum menyimpan.`);
            }}
          />
          <Field label="Nama Singkat">
            <Input value={identityForm.courtShortName} onChange={(event) => setIdentityOverrides((current) => ({ ...current, courtShortName: event.target.value }))} className="h-12 text-base" />
          </Field>
        </div>
        <Field label="Alamat">
          <Textarea value={identityForm.address} onChange={(event) => setIdentityOverrides((current) => ({ ...current, address: event.target.value }))} className="min-h-[110px] text-base" />
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Telepon">
            <Input value={identityForm.phoneNumber} onChange={(event) => setIdentityOverrides((current) => ({ ...current, phoneNumber: event.target.value }))} className="h-12 text-base" />
          </Field>
          <Field label="Handphone">
            <Input value={identityForm.mobilePhone} onChange={(event) => setIdentityOverrides((current) => ({ ...current, mobilePhone: event.target.value }))} className="h-12 text-base" />
          </Field>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Email">
            <Input value={identityForm.email} onChange={(event) => setIdentityOverrides((current) => ({ ...current, email: event.target.value }))} className="h-12 text-base" />
          </Field>
          <Field label="Website">
            <Input value={identityForm.website ?? ""} onChange={(event) => setIdentityOverrides((current) => ({ ...current, website: event.target.value }))} className="h-12 text-base" />
          </Field>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Instagram">
            <Input value={identityForm.instagram ?? ""} onChange={(event) => setIdentityOverrides((current) => ({ ...current, instagram: event.target.value }))} className="h-12 text-base" />
          </Field>
          <Field label="Facebook">
            <Input value={identityForm.facebook ?? ""} onChange={(event) => setIdentityOverrides((current) => ({ ...current, facebook: event.target.value }))} className="h-12 text-base" />
          </Field>
          <Field label="YouTube">
            <Input value={identityForm.youtube ?? ""} onChange={(event) => setIdentityOverrides((current) => ({ ...current, youtube: event.target.value }))} className="h-12 text-base" />
          </Field>
        </div>
        {selectedSatkerLabel ? (
          <div className="rounded-[1.2rem] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
            Satuan kerja terpilih: <strong className="text-foreground">{selectedSatkerLabel}</strong>
          </div>
        ) : null}
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            disabled={!canEdit}
            onClick={async () => {
              const result = await updateInstitutionIdentity(identityForm);
              setFeedback(result.message);
              if (result.ok) {
                setIdentityOverrides({});
                setSelectedSatkerLabel("");
              }
            }}
          >
            <Building2 className="h-4 w-4" />
            Simpan Identitas
          </Button>
          {feedback ? (
            <div className="rounded-[1.2rem] border border-emerald-300/60 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
              {feedback}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function WhatsAppStatusPanel() {
  const {
    currentUser,
    institutionIdentity,
    updateWhatsAppWeb,
    whatsAppWeb,
  } = usePortal();
  const canEdit = currentUser?.roleId === "super-admin" || currentUser?.roleId === "admin";
  const [waPhoneNumberDraft, setWaPhoneNumberDraft] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const waStatus = statusCopy(whatsAppWeb.status);
  const waPhoneNumber = waPhoneNumberDraft ?? whatsAppWeb.phoneNumber;
  const {
    qrCode,
    qrFeedback,
    scannerStatus,
    isFetchingQr,
    initializeQrLink,
  } = useWhatsAppQr(Boolean(canEdit));

  return (
    <Card className="border-border/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          WhatsApp Web
        </CardTitle>
        <CardDescription>Masukkan nomor yang dipakai pada sesi WhatsApp Web ALETA dan cek status koneksinya.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-[1.35rem] border border-border bg-muted/35 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Status koneksi</p>
              <p className="mt-1 text-sm text-muted-foreground">{whatsAppWeb.lastConnectedAt ? `Terakhir dicek ${new Date(whatsAppWeb.lastConnectedAt).toLocaleString("id-ID")}` : "Belum pernah diuji."}</p>
            </div>
            <Badge variant={waStatus.badge}>{waStatus.label}</Badge>
          </div>
        </div>
        <Field label="Nomor WhatsApp Web">
          <Input value={waPhoneNumber} onChange={(event) => setWaPhoneNumberDraft(event.target.value)} placeholder="62812xxxxxxx" className="h-12 text-base" />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={!canEdit || isConnecting}
            onClick={async () => {
              setIsConnecting(true);
              setFeedback("");
              const result = await updateWhatsAppWeb({
                phoneNumber: waPhoneNumber.trim(),
                status:
                  waPhoneNumber.replace(/\D/g, "").length >= 10
                    ? whatsAppWeb.status
                    : "failed",
              });
              setFeedback(result.message);
              if (result.ok) {
                setWaPhoneNumberDraft(null);
              }
              setIsConnecting(false);
            }}
          >
            {isConnecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Uji Koneksi
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit || isFetchingQr || !waPhoneNumber.trim()}
            onClick={async () => {
              await initializeQrLink();
            }}
          >
            {isFetchingQr ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Tampilkan QR
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit}
            onClick={async () => {
              const result = await updateWhatsAppWeb({
                phoneNumber: waPhoneNumber.trim(),
                status: "inactive",
              });
              setFeedback(result.message);
              if (result.ok) {
                setWaPhoneNumberDraft(null);
              }
            }}
          >
            <Unplug className="h-4 w-4" />
            Nonaktifkan
          </Button>
        </div>

        <div className="rounded-[1.3rem] border border-border bg-muted/35 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Scanner WhatsApp Kantor</p>
              <p className="mt-1 text-sm text-muted-foreground">{scannerStatusCopy(scannerStatus)}</p>
            </div>
            <Badge variant={scannerStatus === "ready" ? "success" : scannerStatus === "failed" ? "danger" : "outline"}>
              {scannerStatus === "ready" ? "Tertaut" : scannerStatus === "qr" ? "Scan QR" : "Siaga"}
            </Badge>
          </div>

          <div className="mt-4 rounded-[1.2rem] border border-dashed border-border bg-card/80 p-4">
            {qrCode ? (
              <div className="flex flex-col items-center gap-3">
                <img src={qrCode} alt="QR WhatsApp Web ALETA" className="h-56 w-56 rounded-2xl border border-border bg-white p-3" />
                <p className="text-center text-sm text-muted-foreground">
                  Buka WhatsApp kantor, pilih <strong className="text-foreground">Perangkat Tertaut</strong>, lalu scan QR ini.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                QR akan muncul di sini setelah sesi WhatsApp diinisialisasi.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[1.3rem] border border-border bg-card/80 p-4">
          <AletaLogo title="Identitas Footer" subtitle="Preview sinkron di seluruh aplikasi" size="sm" />
          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
            <p>{institutionIdentity.courtName}</p>
            <p>{institutionIdentity.address}</p>
            <p>
              {institutionIdentity.phoneNumber} | {institutionIdentity.mobilePhone}
            </p>
            <p>{institutionIdentity.email}</p>
          </div>
        </div>

        {feedback ? (
          <div
            className={cn(
              "rounded-[1.2rem] border px-4 py-3 text-sm",
              whatsAppWeb.status === "failed"
                ? "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                : "border-emerald-300/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
            )}
          >
            {feedback}
          </div>
        ) : null}
        {qrFeedback ? (
          <div
            className={cn(
              "rounded-[1.2rem] border px-4 py-3 text-sm",
              scannerStatus === "failed"
                ? "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                : "border-primary/20 bg-primary/5 text-muted-foreground"
            )}
          >
            {qrFeedback}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function InstitutionSettingsPanel({ compact }: { compact?: boolean }) {
  const {
    currentUser,
    institutionIdentity,
    updateInstitutionIdentity,
    updateWhatsAppWeb,
    whatsAppWeb,
  } = usePortal();
  const canEdit = currentUser?.roleId === "super-admin" || currentUser?.roleId === "admin";
  const [waPhoneNumberDraft, setWaPhoneNumberDraft] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const waStatus = statusCopy(whatsAppWeb.status);
  const {
    qrCode,
    qrFeedback,
    scannerStatus,
    isFetchingQr,
    initializeQrLink,
  } = useWhatsAppQr(Boolean(canEdit));
  const visibleIdentityItems = useMemo(
    () =>
      [
        institutionIdentity.address,
        institutionIdentity.phoneNumber,
        institutionIdentity.mobilePhone,
        institutionIdentity.email,
      ].filter(Boolean),
    [institutionIdentity]
  );

  const waPhoneNumber = waPhoneNumberDraft ?? whatsAppWeb.phoneNumber;

  if (compact) {
    return (
      <Card className="border-border/90">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircleMore className="h-5 w-5 text-primary" />
            WhatsApp Web & Identitas Instansi
          </CardTitle>
          <CardDescription>Status gateway WhatsApp dan identitas instansi utama ALETA.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
          <div className="rounded-[1.35rem] border border-border bg-muted/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">WhatsApp Web</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {whatsAppWeb.phoneNumber ? whatsAppWeb.phoneNumber : "Nomor belum disetel"}
                </p>
              </div>
              <Badge variant={waStatus.badge}>{waStatus.label}</Badge>
            </div>
            {canEdit ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <Input
                  value={waPhoneNumber}
                  onChange={(event) => setWaPhoneNumberDraft(event.target.value)}
                  placeholder="Masukkan nomor WhatsApp Web"
                  className="h-11 text-base"
                />
                <Button
                  type="button"
                  onClick={async () => {
                    setIsConnecting(true);
                    setFeedback("");
                    const result = await updateWhatsAppWeb({
                      phoneNumber: waPhoneNumber.trim(),
                      status:
                        waPhoneNumber.replace(/\D/g, "").length >= 10
                          ? whatsAppWeb.status
                          : "failed",
                    });
                    setFeedback(result.message);
                    if (result.ok) {
                      setWaPhoneNumberDraft(null);
                    }
                    setIsConnecting(false);
                  }}
                >
                  {isConnecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Hubungkan
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!waPhoneNumber.trim() || isFetchingQr}
                  onClick={async () => {
                    await initializeQrLink();
                  }}
                >
                  {isFetchingQr ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                  QR Scan
                </Button>
              </div>
            ) : null}
            {qrCode ? (
              <div className="mt-4 rounded-[1.2rem] border border-border bg-card/80 p-3">
                <img src={qrCode} alt="QR WhatsApp Web ALETA" className="mx-auto h-36 w-36 rounded-xl border border-border bg-white p-2" />
                <p className="mt-3 text-center text-xs text-muted-foreground">{scannerStatusCopy(scannerStatus)}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.35rem] border border-border bg-card/80 p-4">
            <AletaLogo
              title={institutionIdentity.courtShortName}
              subtitle={institutionIdentity.courtName}
              size="sm"
            />
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              {visibleIdentityItems.map((item) => (
                <p key={item} className="leading-6">
                  {item}
                </p>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {canEdit ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/identitas-instansi">Kelola Identitas</Link>
                </Button>
              ) : null}
              <Badge variant="outline">Footer sinkron otomatis</Badge>
            </div>
          </div>

          {feedback ? (
            <div
              className={cn(
                "xl:col-span-2 rounded-[1.2rem] border px-4 py-3 text-sm",
                whatsAppWeb.status === "failed"
                  ? "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                  : "border-emerald-300/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              )}
            >
              {feedback}
            </div>
          ) : null}
          {qrFeedback ? (
            <div className="xl:col-span-2 rounded-[1.2rem] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
              {qrFeedback}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <IdentitySettingsForm />
      <WhatsAppStatusPanel />
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}

function SmartCourtNameInput({
  value,
  onChange,
  onSelectSuggestion,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelectSuggestion: (suggestion: {
    id: string;
    courtName: string;
    satkerLabel: string;
    identity: InstitutionIdentity;
  }) => void;
}) {
  const [suggestions, setSuggestions] = useState<
    Array<{
      id: string;
      courtName: string;
      satkerLabel: string;
      identity: InstitutionIdentity;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const handler = globalThis.setTimeout(async () => {
      if (!value || value.length < 3 || !showDropdown) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await globalThis.fetch(`/api/ai/suggest-court-name?query=${globalThis.encodeURIComponent(value)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.data?.suggestions ?? []);
        }
      } catch (error) {
        globalThis.console.error("Failed to fetch suggestions:", error);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => globalThis.clearTimeout(handler);
  }, [value, showDropdown]);

  return (
    <Field label="Nama Pengadilan" className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => {
            // Delay to allow clicking on suggestions
            globalThis.setTimeout(() => setShowDropdown(false), 200);
          }}
          placeholder="Ketik nama pengadilan..."
          className="h-12 pr-10 text-base"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary/60" />
          )}
        </div>
      </div>

      {showDropdown && suggestions.length > 0 && (
        <Card className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto border-border bg-card shadow-lg">
          <div className="p-1">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange(suggestion.courtName);
                  onSelectSuggestion(suggestion);
                  setSuggestions([]);
                  setShowDropdown(false);
                }}
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/10">
                  <Sparkles className="h-3 w-3 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{suggestion.courtName}</p>
                  <p className="text-xs text-muted-foreground">{suggestion.satkerLabel}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </Field>
  );
}
