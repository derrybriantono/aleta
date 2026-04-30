"use client";

import Link from "next/link";
import Image from "next/image";
import { Building2, CheckCircle2, Landmark, Link2, LoaderCircle, MessageCircleMore, RefreshCcw, Smartphone, Sparkles, Unplug } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AletaLogo } from "@/components/branding/aleta-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getWhatsAppRuntimeLabel,
  getWhatsAppRuntimeMessage,
  useWhatsAppGateway,
} from "@/components/portal/use-whatsapp-gateway";
import { usePortal } from "@/lib/app-state";
import {
  type InstitutionIdentity,
  type InstitutionIdentityEnrichmentMetadata,
} from "@/lib/types";
import { cn } from "@/lib/utils";

function statusCopy(status: "active" | "inactive" | "failed") {
  if (status === "active") return { label: "Aktif", badge: "success" as const };
  if (status === "failed") return { label: "Gagal", badge: "danger" as const };
  return { label: "Tidak Aktif", badge: "outline" as const };
}

function runtimeBadgeCopy(status: ReturnType<typeof getWhatsAppRuntimeLabel>) {
  if (status === "connected") return { label: "connected", badge: "success" as const };
  if (status === "waiting_qr") return { label: "waiting_qr", badge: "outline" as const };
  if (status === "initializing") return { label: "initializing", badge: "outline" as const };
  if (status === "failed") return { label: "failed", badge: "danger" as const };
  return { label: "disconnected", badge: "outline" as const };
}

function toSafeString(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}

function isNonEmptyText(value: unknown) {
  return toSafeString(value).length > 0;
}

function normalizeInstitutionIdentityDraft(source: Partial<Record<keyof InstitutionIdentity, unknown>> | null | undefined): InstitutionIdentity {
  return {
    courtName: toSafeString(source?.courtName),
    courtShortName: toSafeString(source?.courtShortName),
    address: toSafeString(source?.address),
    phoneNumber: toSafeString(source?.phoneNumber),
    mobilePhone: toSafeString(source?.mobilePhone),
    email: toSafeString(source?.email),
    instagram: toSafeString(source?.instagram),
    facebook: toSafeString(source?.facebook),
    youtube: toSafeString(source?.youtube),
    website: toSafeString(source?.website),
    mapUrl: toSafeString(source?.mapUrl),
  };
}

const INSTITUTION_IDENTITY_FIELDS: Array<keyof InstitutionIdentity> = [
  "courtName",
  "courtShortName",
  "address",
  "phoneNumber",
  "mobilePhone",
  "email",
  "instagram",
  "facebook",
  "youtube",
  "website",
];

const INSTITUTION_IDENTITY_FIELD_LABELS: Record<keyof InstitutionIdentity, string> = {
  courtName: "Nama Pengadilan",
  courtShortName: "Nama Singkat",
  address: "Alamat",
  phoneNumber: "Telepon",
  mobilePhone: "Handphone",
  email: "Email",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  website: "Website",
  mapUrl: "Google Maps",
};

function mergeEnrichedIdentityPreservingManualEdits(
  current: Partial<InstitutionIdentity>,
  baseIdentity: InstitutionIdentity,
  enrichedIdentity: Partial<InstitutionIdentity>
) {
  const normalizedCurrent = normalizeInstitutionIdentityDraft(current);
  const normalizedBase = normalizeInstitutionIdentityDraft(baseIdentity);
  const normalizedEnriched = normalizeInstitutionIdentityDraft(enrichedIdentity);
  const next = { ...normalizedCurrent };

  for (const field of INSTITUTION_IDENTITY_FIELDS) {
    const currentValue = normalizedCurrent[field] ?? "";
    const baseValue = normalizedBase[field] ?? "";
    const enrichedValue = normalizedEnriched[field] ?? "";

    if (!enrichedValue) {
      continue;
    }

    if (currentValue === baseValue) {
      next[field] = enrichedValue;
    }
  }

  return next;
}

function getManualIdentityConflicts(
  current: Partial<InstitutionIdentity>,
  baseIdentity: InstitutionIdentity,
  enrichedIdentity: Partial<InstitutionIdentity>
) {
  const normalizedCurrent = normalizeInstitutionIdentityDraft(current);
  const normalizedBase = normalizeInstitutionIdentityDraft(baseIdentity);
  const normalizedEnriched = normalizeInstitutionIdentityDraft(enrichedIdentity);

  return INSTITUTION_IDENTITY_FIELDS.filter((field) => {
    const currentValue = normalizedCurrent[field] ?? "";
    const baseValue = normalizedBase[field] ?? "";
    const enrichedValue = normalizedEnriched[field] ?? "";

    return Boolean(enrichedValue && currentValue && currentValue !== baseValue && currentValue !== enrichedValue);
  });
}

function countCompletedIdentityFields(identity: InstitutionIdentity) {
  return INSTITUTION_IDENTITY_FIELDS.filter((field) => isNonEmptyText(identity[field])).length;
}

function getIdentityEnrichmentBadge(metadata: InstitutionIdentityEnrichmentMetadata | null) {
  const effectiveStatus = metadata?.fromCache ? "cached" : metadata?.enrichmentStatus;

  if (effectiveStatus === "enriched") {
    return { label: "enriched", badge: "success" as const };
  }
  if (effectiveStatus === "partial") {
    return { label: "partial", badge: "outline" as const };
  }
  if (effectiveStatus === "failed") {
    return { label: "failed", badge: "danger" as const };
  }
  if (effectiveStatus === "cached") {
    return { label: "cached", badge: "outline" as const };
  }

  return { label: "catalog_only", badge: "outline" as const };
}

function buildIdentityEnrichmentFeedback(
  suggestionLabel: string,
  metadata: InstitutionIdentityEnrichmentMetadata,
  identity: InstitutionIdentity
) {
  const coverage = `${countCompletedIdentityFields(identity)}/${INSTITUTION_IDENTITY_FIELDS.length} field`;
  const sources = metadata.sources?.map((source) => source.label).filter(Boolean).join(" + ") ?? "";
  const confidence = metadata.confidence ? ` Confidence: ${metadata.confidence}.` : "";

  if (metadata.enrichmentStatus === "failed") {
    return `Satuan kerja terdeteksi: ${suggestionLabel}. Data dasar katalog tetap dipakai karena enrichment belum berhasil diproses${metadata.lastErrorMessage ? `: ${metadata.lastErrorMessage}` : "."}`;
  }

  if (metadata.enrichmentStatus === "catalog_only") {
    return `Satuan kerja terdeteksi: ${suggestionLabel}. Data dasar katalog sudah diterapkan. Belum ada detail tambahan yang cukup yakin untuk melengkapi identitas (${coverage}).`;
  }

  return `Satuan kerja terdeteksi: ${suggestionLabel}. Identitas berhasil dilengkapi dari ${sources || "sumber terverifikasi"} (${coverage})${metadata.fromCache ? " menggunakan cache ALETA" : ""}.${confidence}`;
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
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [selectedCourtName, setSelectedCourtName] = useState("");
  const [identityEnrichment, setIdentityEnrichment] = useState<InstitutionIdentityEnrichmentMetadata | null>(null);
  const [isEnrichingIdentity, setIsEnrichingIdentity] = useState(false);
  const [pendingEnrichedIdentity, setPendingEnrichedIdentity] = useState<InstitutionIdentity | null>(null);
  const [pendingBaseIdentity, setPendingBaseIdentity] = useState<InstitutionIdentity | null>(null);
  const [manualConflictFields, setManualConflictFields] = useState<Array<keyof InstitutionIdentity>>([]);
  const enrichmentRequestRef = useRef(0);
  const identityForm = normalizeInstitutionIdentityDraft({ ...institutionIdentity, ...identityOverrides });
  const enrichmentBadge = getIdentityEnrichmentBadge(identityEnrichment);
  const canApplyAISuggestion = canEdit && isNonEmptyText(identityForm.courtName) && !isEnrichingIdentity;

  async function applyIdentityEnrichment({ refresh = false }: { refresh?: boolean } = {}) {
    const query = toSafeString(identityForm.courtName);
    if (!query) {
      setFeedback("Nama pengadilan perlu diisi sebelum menerapkan saran AI.");
      return;
    }

    const requestId = enrichmentRequestRef.current + 1;
    enrichmentRequestRef.current = requestId;
    setIsEnrichingIdentity(true);
    setFeedback("ALETA sedang mencari data identitas dari cache, katalog lokal, Google bila dikonfigurasi, dan website resmi.");
    setManualConflictFields([]);

    try {
      const response = await globalThis.fetch("/api/settings/institution/enrich", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          courtId: selectedCourtId && !selectedCourtId.startsWith("ai-") ? selectedCourtId : undefined,
          query,
          localIdentity: pendingBaseIdentity ?? identityForm,
          refresh,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: {
              identity?: InstitutionIdentity;
              suggestedIdentity?: InstitutionIdentity;
              baseIdentity?: InstitutionIdentity;
              metadata?: InstitutionIdentityEnrichmentMetadata;
            };
            error?: {
              message?: string;
            };
          }
        | null;

      if (requestId !== enrichmentRequestRef.current) {
        return;
      }

      if (!response.ok || !payload?.ok || !payload.data?.metadata) {
        const message = "Sebagian sumber eksternal belum dikonfigurasi, tetapi sistem tetap mencoba memakai data lokal dan sumber resmi yang tersedia.";
        const technicalMessage = payload?.error?.message ?? "Enrichment identitas instansi tidak dapat diproses saat ini.";
        globalThis.console.warn("Institution enrichment failed", technicalMessage);
        setIdentityEnrichment({
          courtId: selectedCourtId ?? `query-${query}`,
          courtName: query,
          enrichmentStatus: "failed",
          fromCache: false,
          confidence: "low",
          warnings: [message],
          lastErrorMessage: message,
        });
        setFeedback(message);
        return;
      }

      const resultBaseIdentity = normalizeInstitutionIdentityDraft(payload.data.baseIdentity ?? identityForm);
      const resultIdentity = normalizeInstitutionIdentityDraft(payload.data.suggestedIdentity ?? payload.data.identity ?? resultBaseIdentity);
      const metadata = payload.data.metadata;
      const conflicts = getManualIdentityConflicts(identityForm, resultBaseIdentity, resultIdentity);

      setPendingBaseIdentity(resultBaseIdentity);
      setPendingEnrichedIdentity(resultIdentity);
      setManualConflictFields(conflicts);
      setIdentityEnrichment(metadata);

      if (metadata.confidence === "low") {
        setFeedback(
          `Saran ditemukan tetapi confidence rendah. Field utama tidak diisi otomatis; periksa sumber dan isi manual bila perlu.${metadata.warnings?.length ? ` ${metadata.warnings.map(toSafeString).filter(Boolean).join(" ")}` : ""}`
        );
        return;
      }

      setIdentityOverrides((current) =>
        mergeEnrichedIdentityPreservingManualEdits(current, resultBaseIdentity, resultIdentity)
      );
      setFeedback(buildIdentityEnrichmentFeedback(selectedSatkerLabel || query, metadata, resultIdentity));
    } catch (error) {
      if (requestId !== enrichmentRequestRef.current) {
        return;
      }

      const technicalMessage = error instanceof Error ? error.message : "Enrichment identitas instansi gagal diproses.";
      globalThis.console.warn("Institution enrichment failed", technicalMessage);
      const message = "Sebagian sumber eksternal belum dapat diproses, tetapi data lokal tetap bisa digunakan dan diedit manual.";
      setIdentityEnrichment({
        courtId: selectedCourtId ?? `query-${query}`,
        courtName: query,
        enrichmentStatus: "failed",
        fromCache: false,
        confidence: "low",
        warnings: [message],
        lastErrorMessage: message,
      });
      setFeedback(message);
    } finally {
      if (requestId === enrichmentRequestRef.current) {
        setIsEnrichingIdentity(false);
      }
    }
  }

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
            onChange={(value) => {
              setIdentityOverrides((current) => ({ ...current, courtName: value }));
              if (
                selectedCourtId &&
                toSafeString(value).toLowerCase() !== toSafeString(selectedCourtName).toLowerCase()
              ) {
                enrichmentRequestRef.current += 1;
                setSelectedCourtId(null);
                setSelectedCourtName("");
                setSelectedSatkerLabel("");
                setIdentityEnrichment(null);
                setPendingBaseIdentity(null);
                setPendingEnrichedIdentity(null);
                setManualConflictFields([]);
                setIsEnrichingIdentity(false);
              }
            }}
            onSelectSuggestion={(suggestion) => {
              const baseIdentity = normalizeInstitutionIdentityDraft(suggestion.identity);
              enrichmentRequestRef.current += 1;

              setIdentityOverrides(baseIdentity);
              setSelectedCourtId(suggestion.id);
              setSelectedCourtName(suggestion.courtName);
              setSelectedSatkerLabel(suggestion.satkerLabel);
              setIdentityEnrichment({
                courtId: suggestion.id,
                courtName: suggestion.courtName,
                enrichmentStatus: "catalog_only",
                fromCache: false,
                confidence: "low",
                sources: [{ type: "local", label: "Katalog lokal ALETA" }],
                fieldsFound: INSTITUTION_IDENTITY_FIELDS.filter((field) => isNonEmptyText(baseIdentity[field])),
                fieldsMissing: INSTITUTION_IDENTITY_FIELDS.filter((field) => !isNonEmptyText(baseIdentity[field])),
                warnings: ["Klik Terapkan Saran AI untuk mencari data tambahan dari sumber eksternal yang dikonfigurasi."],
              });
              setPendingBaseIdentity(baseIdentity);
              setPendingEnrichedIdentity(null);
              setManualConflictFields([]);
              setIsEnrichingIdentity(false);
              setFeedback(`Satuan kerja terdeteksi: ${suggestion.satkerLabel}. Data katalog lokal diterapkan. Klik Terapkan Saran AI untuk enrichment eksternal.`);
            }}
          />
          <Field label="Nama Singkat">
            <Input data-testid="institution-short-name-input" value={identityForm.courtShortName} onChange={(event) => setIdentityOverrides((current) => ({ ...current, courtShortName: event.target.value }))} className="h-12 text-base" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={!canApplyAISuggestion}
            data-testid="institution-apply-ai-suggestion-button"
            onClick={() => {
              void applyIdentityEnrichment();
            }}
          >
            {isEnrichingIdentity ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Terapkan Saran AI
          </Button>
          {identityEnrichment ? (
            <Button
              type="button"
              variant="ghost"
              disabled={!canEdit || isEnrichingIdentity || !isNonEmptyText(identityForm.courtName)}
              data-testid="institution-refresh-ai-suggestion-button"
              onClick={() => {
                void applyIdentityEnrichment({ refresh: true });
              }}
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh Saran
            </Button>
          ) : null}
          {manualConflictFields.length > 0 && pendingEnrichedIdentity && pendingBaseIdentity ? (
            <Button
              type="button"
              variant="secondary"
              disabled={!canEdit}
              data-testid="institution-replace-conflicts-button"
              onClick={() => {
                setIdentityOverrides((current) => ({
                  ...normalizeInstitutionIdentityDraft(current),
                  ...manualConflictFields.reduce<Partial<InstitutionIdentity>>((next, field) => {
                    next[field] = toSafeString(pendingEnrichedIdentity[field]);
                    return next;
                  }, {}),
                }));
                setManualConflictFields([]);
                setFeedback("Field yang sebelumnya sudah terisi telah diganti dengan saran enrichment.");
              }}
            >
              Ganti Field Terisi
            </Button>
          ) : null}
        </div>
        {manualConflictFields.length > 0 ? (
          <div className="rounded-[1.2rem] border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            Beberapa field tidak ditimpa karena sudah Anda isi:{" "}
            {manualConflictFields.map((field) => INSTITUTION_IDENTITY_FIELD_LABELS[field]).join(", ")}.
          </div>
        ) : null}
        <Field label="Alamat">
          <Textarea data-testid="institution-address-input" value={identityForm.address} onChange={(event) => setIdentityOverrides((current) => ({ ...current, address: event.target.value }))} className="min-h-[110px] text-base" />
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Telepon">
            <Input data-testid="institution-phone-input" value={identityForm.phoneNumber} onChange={(event) => setIdentityOverrides((current) => ({ ...current, phoneNumber: event.target.value }))} className="h-12 text-base" />
          </Field>
          <Field label="Handphone">
            <Input data-testid="institution-mobile-input" value={identityForm.mobilePhone} onChange={(event) => setIdentityOverrides((current) => ({ ...current, mobilePhone: event.target.value }))} className="h-12 text-base" />
          </Field>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Email">
            <Input data-testid="institution-email-input" value={identityForm.email} onChange={(event) => setIdentityOverrides((current) => ({ ...current, email: event.target.value }))} className="h-12 text-base" />
          </Field>
          <Field label="Website">
            <Input data-testid="institution-website-input" value={identityForm.website ?? ""} onChange={(event) => setIdentityOverrides((current) => ({ ...current, website: event.target.value }))} className="h-12 text-base" />
          </Field>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          <Field label="Instagram">
            <Input data-testid="institution-instagram-input" value={identityForm.instagram ?? ""} onChange={(event) => setIdentityOverrides((current) => ({ ...current, instagram: event.target.value }))} className="h-12 text-base" />
          </Field>
          <Field label="Facebook">
            <Input data-testid="institution-facebook-input" value={identityForm.facebook ?? ""} onChange={(event) => setIdentityOverrides((current) => ({ ...current, facebook: event.target.value }))} className="h-12 text-base" />
          </Field>
          <Field label="YouTube">
            <Input data-testid="institution-youtube-input" value={identityForm.youtube ?? ""} onChange={(event) => setIdentityOverrides((current) => ({ ...current, youtube: event.target.value }))} className="h-12 text-base" />
          </Field>
        </div>
        {selectedSatkerLabel ? (
          <div data-testid="institution-satker-label" className="rounded-[1.2rem] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
            Satuan kerja terpilih: <strong className="text-foreground">{selectedSatkerLabel}</strong>
          </div>
        ) : null}
        {isEnrichingIdentity ? (
          <div
            data-testid="institution-enrichment-loading"
            className="rounded-[1.2rem] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground"
          >
            ALETA sedang memeriksa cache, katalog lokal, Google bila API tersedia, dan website resmi. Form dasar tetap dapat diedit sambil menunggu.
          </div>
        ) : null}
        {identityEnrichment ? (
          <div
            data-testid="institution-enrichment-status"
            className="rounded-[1.2rem] border border-border bg-muted/35 px-4 py-4 text-sm text-muted-foreground"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">Status enrichment identitas instansi</p>
                <p className="mt-1">
                  Satker: <strong className="text-foreground">{identityEnrichment.courtName}</strong>
                </p>
              </div>
              <Badge variant={enrichmentBadge.badge}>{enrichmentBadge.label}</Badge>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <p>
                Website resmi:{" "}
                {isNonEmptyText(identityEnrichment.sourceOfficialWebsite) ? (
                  <a
                    data-testid="institution-enrichment-source-official"
                    href={toSafeString(identityEnrichment.sourceOfficialWebsite)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-4"
                  >
                    {toSafeString(identityEnrichment.sourceOfficialWebsite)}
                  </a>
                ) : (
                  <span>-</span>
                )}
              </p>
              <p>
                Google/Maps/Search:{" "}
                {isNonEmptyText(identityEnrichment.sourceGooglePlace) || isNonEmptyText(identityEnrichment.sourceGoogleSearch) ? (
                  <a
                    data-testid="institution-enrichment-source-google"
                    href={toSafeString(identityEnrichment.sourceGooglePlace || identityEnrichment.sourceGoogleSearch)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline underline-offset-4"
                  >
                    {isNonEmptyText(identityEnrichment.sourceGooglePlace) ? "Google Places/Maps" : "Google Search"}
                  </a>
                ) : (
                  <span>-</span>
                )}
              </p>
              <p>
                Confidence: <strong className="text-foreground">{identityEnrichment.confidence ?? "-"}</strong>
              </p>
              <p>
                Terakhir diperkaya:{" "}
                <strong className="text-foreground">
                  {identityEnrichment.lastEnrichedAt
                    ? new Date(identityEnrichment.lastEnrichedAt).toLocaleString("id-ID")
                    : "-"}
                </strong>
              </p>
              <p>
                Sumber data:{" "}
                <strong className="text-foreground">
                  {identityEnrichment.sources?.map((source) => toSafeString(source.label)).filter(Boolean).join(", ") || (identityEnrichment.fromCache ? "Cache ALETA" : "Katalog lokal")}
                </strong>
              </p>
            </div>
            {identityEnrichment.fieldsFound?.length ? (
              <p className="mt-3 text-xs">
                Field ditemukan:{" "}
                <strong className="text-foreground">
                  {identityEnrichment.fieldsFound.map((field) => INSTITUTION_IDENTITY_FIELD_LABELS[field]).filter(Boolean).join(", ")}
                </strong>
              </p>
            ) : null}
            {identityEnrichment.warnings?.length ? (
              <div className="mt-3 space-y-1 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                {identityEnrichment.warnings.map(toSafeString).filter(Boolean).map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            ) : null}
            {identityEnrichment.lastErrorMessage ? (
              <p className="mt-3 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                {toSafeString(identityEnrichment.lastErrorMessage)}
              </p>
            ) : null}
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
  } = usePortal();
  const canEdit = currentUser?.roleId === "super-admin" || currentUser?.roleId === "admin";
  const [waPhoneNumberDraft, setWaPhoneNumberDraft] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const {
    snapshot,
    feedback: qrFeedback,
    initialize,
    deactivate,
    refresh,
    isInitializing,
    isRefreshing,
    isDeactivating,
  } = useWhatsAppGateway(
    Boolean(canEdit)
  );
  const waPhoneNumber = waPhoneNumberDraft ?? snapshot.phoneNumber;
  const runtimeBadge = runtimeBadgeCopy(getWhatsAppRuntimeLabel(snapshot.runtimeStatus));
  const savedBadge = statusCopy(snapshot.savedStatus);
  const phoneNumberPolicy = snapshot.requiresPhoneNumberBeforeInit
    ? "Nomor resmi wajib diisi sebelum inisialisasi QR dimulai."
    : "Nomor resmi bersifat opsional. Pairing bisa langsung dimulai lewat QR tanpa mengisi nomor terlebih dahulu.";

  return (
    <Card className="border-border/90">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          Koneksi WhatsApp Gateway
        </CardTitle>
        <CardDescription>
          Halaman ini adalah pusat koneksi WhatsApp ALETA. QR, status runtime, dan pengaturan kanal resmi dipusatkan di sini agar tidak ada dua area inisialisasi yang membingungkan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-[1.35rem] border border-border bg-muted/35 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Status gateway runtime</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {getWhatsAppRuntimeMessage(snapshot.runtimeStatus)}
              </p>
            </div>
            <Badge variant={runtimeBadge.badge} data-testid="wa-status-runtime-badge">{runtimeBadge.label}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Status tersimpan: <strong className="text-foreground" data-testid="wa-status-saved-value">{savedBadge.label}</strong>
            </span>
            <span>-</span>
            <span>Sesi: <strong className="text-foreground">{snapshot.sessionName}</strong></span>
            <span>-</span>
            <span>
              {snapshot.lastConnectedAt
                ? `Terakhir terhubung ${new Date(snapshot.lastConnectedAt).toLocaleString("id-ID")}`
                : "Belum pernah terhubung"}
            </span>
          </div>
        </div>
        <Field label="Nomor WhatsApp Resmi">
          <Input value={waPhoneNumber} onChange={(event) => setWaPhoneNumberDraft(event.target.value)} placeholder="62812xxxxxxx" className="h-12 text-base" />
        </Field>
        <div className="rounded-[1.15rem] border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          {phoneNumberPolicy}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            disabled={!canEdit || isConnecting}
            onClick={async () => {
              setIsConnecting(true);
              setFeedback("");
              const result = await updateWhatsAppWeb({
                phoneNumber: waPhoneNumber.trim(),
              });
              setFeedback(result.message);
              if (result.ok) {
                setWaPhoneNumberDraft(null);
                await refresh();
              }
              setIsConnecting(false);
            }}
          >
            {isConnecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Simpan Pengaturan
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit || isInitializing}
            data-testid="wa-init-button"
            onClick={async () => {
              await initialize();
            }}
          >
            {isInitializing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Mulai Inisiasi / Tampilkan QR
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit || isDeactivating}
            data-testid="wa-deactivate-button"
            onClick={async () => {
              await deactivate();
              setWaPhoneNumberDraft(null);
            }}
          >
            {isDeactivating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
            Nonaktifkan
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!canEdit || isRefreshing}
            onClick={async () => {
              await refresh();
            }}
          >
            <RefreshCcw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            Refresh Status
          </Button>
        </div>

        <div className="rounded-[1.3rem] border border-border bg-muted/35 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">QR Pairing WhatsApp Kantor</p>
              <p className="mt-1 text-sm text-muted-foreground">{getWhatsAppRuntimeMessage(snapshot.runtimeStatus)}</p>
            </div>
            <Badge variant={runtimeBadge.badge} data-testid="wa-qr-runtime-badge">
              {runtimeBadge.label}
            </Badge>
          </div>

          <div className="mt-4 rounded-[1.2rem] border border-dashed border-border bg-card/80 p-4">
            {snapshot.qrCode ? (
              <div className="flex flex-col items-center gap-3">
                <Image src={snapshot.qrCode} alt="QR WhatsApp Web ALETA" width={224} height={224} unoptimized data-testid="wa-qr-image" className="h-56 w-56 rounded-2xl border border-border bg-white p-3" />
                <p className="text-center text-sm text-muted-foreground">
                  Buka WhatsApp kantor, pilih <strong className="text-foreground">Perangkat Tertaut</strong>, lalu scan QR ini. QR hanya ditampilkan di area ini sebagai pusat koneksi tunggal.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                QR akan muncul di sini setelah sesi WhatsApp diinisialisasi. Jika belum ada nomor resmi, Anda tetap bisa mulai pairing lewat QR dari panel ini.
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
              snapshot.savedStatus === "failed"
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
              snapshot.runtimeStatus === "failed"
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
  } = usePortal();
  const canEdit = currentUser?.roleId === "super-admin" || currentUser?.roleId === "admin";
  const { snapshot, feedback: gatewayFeedback, refresh, isRefreshing } = useWhatsAppGateway(Boolean(canEdit));
  const savedBadge = statusCopy(snapshot.savedStatus);
  const runtimeBadge = runtimeBadgeCopy(getWhatsAppRuntimeLabel(snapshot.runtimeStatus));
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
                  {snapshot.phoneNumber ? snapshot.phoneNumber : "Nomor resmi belum disetel"}
                </p>
              </div>
              <Badge variant={runtimeBadge.badge}>{runtimeBadge.label}</Badge>
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Pairing QR tidak mewajibkan nomor diisi lebih dulu. Kartu ini hanya menampilkan ringkasan dari backend yang sama dengan halaman <strong className="text-foreground">Status WhatsApp Gateway</strong>.
            </p>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p>Status tersimpan: <strong className="text-foreground">{savedBadge.label}</strong></p>
              <p>Sesi: <strong className="text-foreground">{snapshot.sessionName}</strong></p>
              <p>
                {snapshot.lastConnectedAt
                  ? `Terakhir terhubung ${new Date(snapshot.lastConnectedAt).toLocaleString("id-ID")}`
                  : "Belum pernah terhubung"}
              </p>
            </div>
            {canEdit ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <Button asChild size="sm">
                  <Link href="/admin/status-whatsapp">Buka Pusat Koneksi</Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isRefreshing}
                  onClick={async () => {
                    await refresh();
                  }}
                >
                  <RefreshCcw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                  Refresh Status
                </Button>
              </div>
            ) : null}
            <div className="mt-4 rounded-[1.2rem] border border-dashed border-border bg-card/80 p-3 text-xs leading-5 text-muted-foreground">
              {snapshot.runtimeStatus === "waiting_qr"
                ? "QR sedang menunggu dipindai. Buka halaman Status WhatsApp Gateway untuk melihat dan memindainya."
                : "Panel ringkas ini tidak lagi menampilkan QR atau tombol inisialisasi agar alur koneksi tidak bercabang."}
            </div>
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

          {gatewayFeedback ? (
            <div
              className={cn(
                "xl:col-span-2 rounded-[1.2rem] border px-4 py-3 text-sm",
                snapshot.savedStatus === "failed" || snapshot.runtimeStatus === "failed"
                  ? "border-rose-300/60 bg-rose-500/10 text-rose-700 dark:text-rose-200"
                  : "border-primary/20 bg-primary/5 text-muted-foreground"
              )}
            >
              {gatewayFeedback}
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
  }) => void | Promise<void>;
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
      const normalizedValue = toSafeString(value);
      if (!normalizedValue || normalizedValue.length < 3 || !showDropdown) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await globalThis.fetch(`/api/ai/suggest-court-name?query=${globalThis.encodeURIComponent(normalizedValue)}`);
        if (response.ok) {
          const data = await response.json();
          const nextSuggestions: unknown[] = Array.isArray(data.data?.suggestions) ? data.data.suggestions : [];
          setSuggestions(
            nextSuggestions
              .filter((item: unknown): item is { id?: unknown; courtName?: unknown; satkerLabel?: unknown; identity?: Partial<Record<keyof InstitutionIdentity, unknown>> } =>
                Boolean(item && typeof item === "object")
              )
              .map((item) => ({
                id: toSafeString(item.id) || `suggestion-${toSafeString(item.courtName)}`,
                courtName: toSafeString(item.courtName),
                satkerLabel: toSafeString(item.satkerLabel),
                identity: normalizeInstitutionIdentityDraft(item.identity),
              }))
              .filter((item) => item.courtName)
          );
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        globalThis.console.error("Failed to fetch suggestions:", error);
        setSuggestions([]);
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
          data-testid="institution-court-name-input"
          value={toSafeString(value)}
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
        <Card data-testid="institution-suggestion-list" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto border-border bg-card shadow-lg">
          <div className="p-1">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                data-testid={`institution-suggestion-${suggestion.id}`}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange(toSafeString(suggestion.courtName));
                  onSelectSuggestion({
                    ...suggestion,
                    identity: normalizeInstitutionIdentityDraft(suggestion.identity),
                  });
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
