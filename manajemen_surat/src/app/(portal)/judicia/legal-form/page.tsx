"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, Bot, Database, FileText, RefreshCw, Scale, Settings, ShieldCheck, Sparkles, UsersRound } from "lucide-react";

import {
  JlfFeatureGrid,
  JlfLoadingState,
  JlfRoleWorkspace,
  JlfSelectedSection,
  JlfStatusPanel,
} from "@/components/portal/judicia/legal-form/jlf-foundation";
import { JlfQuickBlankoWorkbench } from "@/components/portal/judicia/legal-form/jlf-quick-workbench";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import {
  getJudiciaLegalFormFeatureCards,
  getJudiciaLegalFormSidebarItems,
  hasJudiciaLegalFormPermission,
  JLF_PERMISSION,
  JUDICIA_LEGAL_FORM_ADMIN_ROUTE,
  JUDICIA_LEGAL_FORM_MODULE_ID,
  JUDICIA_LEGAL_FORM_ROUTE,
  resolveJudiciaLegalFormAccess,
} from "@/lib/judicia-legal-form-types";
import { getEffectiveRoleId, getUserPositionLabel } from "@/lib/permissions";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string };
};

type JlfDashboardSummary = {
  roleView: "superadmin" | "admin" | "user";
  visibility: {
    isSuperAdmin: boolean;
    isAdmin: boolean;
    isValidator: boolean;
    canManageSettings: boolean;
    canViewAudit: boolean;
    canUseAi: boolean;
    canManageAccountSync: boolean;
    canManageWhatsapp: boolean;
  };
  metrics: {
    templateActive: number;
    variableActive: number;
    documentsToday: number;
    pendingValidation: number;
    verifiedRegulations: number;
    needsReviewRegulations: number;
    accountSyncLinked: number;
    accountSyncPending: number;
  };
  statuses: {
    sipp: { provider: string; enabled: boolean; ok: boolean; status: string; message: string; readOnly: boolean; rawSqlEndpoint: boolean };
    aiGlobal: { enabled: boolean; providerId: string; modelId: string; activeConnectionStatus: string };
    aiJlf: { enabled: boolean; legalAnalysisEnabled: boolean; requireVerifiedRegulations: boolean };
    whatsappGlobal: { runtimeMode: string; connected: boolean; status: string; botEnabled: boolean };
    whatsappJlf: { enabled: boolean; validationNotifications: boolean; documentReadyNotifications: boolean };
    accountSync: { enabled: boolean };
  };
  topTemplates: Array<{ id: string; label: string; count: number }>;
  activity: Array<{ id: string; action: string; entityType: string; nomorPerkara?: string; createdAt: string; userName?: string }>;
  reports: {
    aiUsageByFeature: Array<{ id: string; label: string; count: number }>;
    whatsappByStatus: Array<{ id: string; label: string; count: number }>;
    accountLinksByStatus: Array<{ id: string; label: string; count: number }>;
    templatesNeedingRegulationReview: number;
  };
  secretsExposed: boolean;
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Permintaan dashboard JLF belum berhasil.");
  }
  return payload?.data as T;
}

function hrefSection(href: string) {
  const [, queryString] = href.split("?");
  if (!queryString) return "dashboard";
  return new URLSearchParams(queryString).get("section") ?? "dashboard";
}

export default function JudiciaLegalFormPage() {
  const searchParams = useSearchParams();
  const { accessibleModules, currentUser, positions } = usePortal();
  const [summary, setSummary] = useState<JlfDashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const effectiveRoleId = getEffectiveRoleId(currentUser);
  const currentPositionLabel = getUserPositionLabel(currentUser, positions);
  const access = resolveJudiciaLegalFormAccess(currentUser, {
    effectiveRoleId,
    positionLabel: currentPositionLabel,
  });
  const hasVisibleModule = accessibleModules.some((module) => module.id === JUDICIA_LEGAL_FORM_MODULE_ID);
  const canOpenAdmin = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.SETTINGS_MANAGE);
  const canSearchCase = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.CASE_SEARCH);
  const canPreviewDocument = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.DOCUMENT_PREVIEW);
  const canGenerateDocument = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.DOCUMENT_GENERATE);
  const canDownloadDocument = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.DOCUMENT_DOWNLOAD);
  const canManageVariables = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.VARIABLE_UPDATE);
  const canEditManualData =
    hasJudiciaLegalFormPermission(access, JLF_PERMISSION.MANUAL_DATA_CREATE) ||
    hasJudiciaLegalFormPermission(access, JLF_PERMISSION.MANUAL_DATA_UPDATE);
  const showManagementDashboard = access.roleView !== "user";
  const featureCards = getJudiciaLegalFormFeatureCards(access);
  const sidebarItems = getJudiciaLegalFormSidebarItems(access);
  const selectedSectionId = searchParams.get("section") ?? "dashboard";
  const selectedItem =
    selectedSectionId === "dashboard"
      ? null
      : [...sidebarItems, ...featureCards].find((item) => hrefSection(item.href) === selectedSectionId);
  const selectedItemLabel = selectedItem ? ("label" in selectedItem ? selectedItem.label : selectedItem.title) : "";

  useEffect(() => {
    if (!currentUser || !access.canView || !showManagementDashboard) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSummaryLoading(true);
      void fetch(apiPath("/api/judicia/legal-form/dashboard/summary"), {
          cache: "no-store",
          credentials: "include",
        })
        .then((response) => readApi<JlfDashboardSummary>(response))
        .then((data) => {
          if (cancelled) return;
          setSummary(data);
          setSummaryError("");
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setSummaryError(error instanceof Error ? error.message : "Gagal memuat dashboard JLF.");
        })
        .finally(() => {
          if (!cancelled) setSummaryLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentUser, access.canView, showManagementDashboard]);

  if (!currentUser) {
    return <JlfLoadingState />;
  }

  if (!hasVisibleModule || !access.canView) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Mode Kerja"
        title="Buat Blangko Cepat"
        description="Pilih blangko, masukkan nomor perkara, cek variabel seperti ABT, isi data manual yang kosong, lalu generate draft dokumen JLF."
        actions={
          canOpenAdmin ? (
            <Button asChild variant="outline">
              <Link href={JUDICIA_LEGAL_FORM_ADMIN_ROUTE}>
                <Settings className="h-4 w-4" />
                Pengaturan JLF
              </Link>
            </Button>
          ) : null
        }
      />

      <JlfQuickBlankoWorkbench
        canSearch={canSearchCase}
        canPreview={canPreviewDocument}
        canGenerate={canGenerateDocument}
        canDownload={canDownloadDocument}
        canSubmitValidation={canGenerateDocument}
        canManual={canEditManualData}
        canViewSensitive={access.isAdmin || access.isSuperAdmin}
        canManageVariables={canManageVariables}
      />

      {showManagementDashboard ? (
        <>
          <JlfStatusPanel access={access} />
          <JlfRoleWorkspace access={access} />
        </>
      ) : null}

      {showManagementDashboard ? (
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Dashboard Operasional</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Ringkasan yang tampil disesuaikan dengan role: Superadmin melihat status teknis, Admin melihat pengelolaan, user melihat tugas kerja.
            </p>
          </div>
          <Badge variant={summary?.secretsExposed ? "danger" : "outline"}>
            {summary?.secretsExposed ? "Secret terbuka" : "Secret aman"}
          </Badge>
        </div>

        {summaryLoading && !summary ? <JlfLoadingState /> : null}
        {summaryError ? (
          <Card className="border-border/80">
            <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4" />
              {summaryError}
            </CardContent>
          </Card>
        ) : null}
        {summary ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Template aktif", value: summary.metrics.templateActive, icon: FileText, href: "/templates" },
                { label: "Variabel aktif", value: summary.metrics.variableActive, icon: Database, href: "/variables" },
                { label: "Generate hari ini", value: summary.metrics.documentsToday, icon: Activity, href: "/documents" },
                { label: "Menunggu validasi", value: summary.metrics.pendingValidation, icon: ShieldCheck, href: "/documents" },
                { label: "Peraturan verified", value: summary.metrics.verifiedRegulations, icon: Scale, href: "/regulations" },
                { label: "Perlu review", value: summary.metrics.needsReviewRegulations, icon: Scale, href: "/regulations/verification" },
                { label: "Account linked", value: summary.metrics.accountSyncLinked, icon: UsersRound, href: `${JUDICIA_LEGAL_FORM_ROUTE}/account-sync` },
                { label: "Account pending", value: summary.metrics.accountSyncPending, icon: UsersRound, href: `${JUDICIA_LEGAL_FORM_ROUTE}/account-sync` },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <Link key={metric.label} href={`${JUDICIA_LEGAL_FORM_ROUTE}${metric.href}`} className="group block">
                    <Card className="h-full border-border/80 transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-panel">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <CardDescription className="uppercase tracking-[0.16em]">{metric.label}</CardDescription>
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <CardTitle className="text-3xl">{metric.value}</CardTitle>
                      </CardHeader>
                    </Card>
                  </Link>
                );
              })}
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="border-border/80">
                <CardHeader>
                  <CardTitle>Status Integrasi</CardTitle>
                  <CardDescription>SIPP, AI global ALETA, AI JLF, WhatsApp, dan account sync.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 p-3">
                    <span>SIPP {summary.statuses.sipp.provider}</span>
                    <Badge variant={summary.statuses.sipp.ok ? "success" : "warning"}>{summary.statuses.sipp.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 p-3">
                    <span>AI Global {summary.statuses.aiGlobal.providerId || "-"}</span>
                    <Badge variant={summary.statuses.aiGlobal.enabled ? "success" : "warning"}>{summary.statuses.aiGlobal.activeConnectionStatus}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 p-3">
                    <span>AI JLF</span>
                    <Badge variant={summary.statuses.aiJlf.enabled ? "success" : "warning"}>{summary.statuses.aiJlf.enabled ? "Aktif" : "Nonaktif"}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 p-3">
                    <span>WhatsApp Global</span>
                    <Badge variant={summary.statuses.whatsappGlobal.connected ? "success" : "warning"}>{summary.statuses.whatsappGlobal.status}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 p-3">
                    <span>Notifikasi JLF</span>
                    <Badge variant={summary.statuses.whatsappJlf.enabled ? "success" : "outline"}>{summary.statuses.whatsappJlf.enabled ? "Aktif" : "Nonaktif"}</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardHeader>
                  <CardTitle>Template Paling Sering Digunakan</CardTitle>
                  <CardDescription>{summary.roleView === "user" ? "Berdasarkan dokumen Anda." : "Berdasarkan seluruh dokumen yang dapat dimonitor."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {summary.topTemplates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada data penggunaan template.</p>
                  ) : summary.topTemplates.map((template) => (
                    <div key={template.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/80 p-3">
                      <span className="text-sm font-medium text-foreground">{template.label}</span>
                      <Badge variant="outline">{template.count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardHeader>
                  <CardTitle>Aktivitas Terakhir</CardTitle>
                  <CardDescription>Metadata sensitif disaring oleh service audit.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {summary.activity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada aktivitas JLF.</p>
                  ) : summary.activity.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{item.action}</p>
                        <Badge variant="outline">{item.entityType}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.userName || "User"} - {item.createdAt}{item.nomorPerkara ? ` - ${item.nomorPerkara}` : ""}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {(summary.visibility.isSuperAdmin || summary.visibility.isAdmin) ? (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      AI Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {summary.reports.aiUsageByFeature.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-xl border border-border/80 p-3 text-sm">
                        <span>{item.label}</span>
                        <Badge variant="outline">{item.count}</Badge>
                      </div>
                    ))}
                    {summary.reports.aiUsageByFeature.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada penggunaan AI.</p> : null}
                  </CardContent>
                </Card>
                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-primary" />
                      WhatsApp
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {summary.reports.whatsappByStatus.slice(0, 5).map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-xl border border-border/80 p-3 text-sm">
                        <span>{item.label}</span>
                        <Badge variant="outline">{item.count}</Badge>
                      </div>
                    ))}
                    {summary.reports.whatsappByStatus.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada log WhatsApp JLF.</p> : null}
                  </CardContent>
                </Card>
                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle>Template Perlu Review</CardTitle>
                    <CardDescription>Relasi template dengan peraturan revoked/superseded/needs review.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-semibold text-foreground">{summary.reports.templatesNeedingRegulationReview}</p>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
      ) : null}

      {selectedItem ? (
        <JlfSelectedSection
          label={selectedItemLabel}
          description={selectedItem.description}
          canOpenAdmin={canOpenAdmin}
        />
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {showManagementDashboard ? "Studio Template & Variabel" : "Shortcut Kerja"}
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              {showManagementDashboard
                ? "Area pengelolaan JLF untuk template, variabel, BAS, Legal KB, integrasi, dan audit sesuai permission."
                : "Menu harian yang tampil dibuat ringkas: blangko, perkara, dokumen, validasi, BAS, QR, dan anonimisasi bila diizinkan."}
            </p>
          </div>
        </div>
        <JlfFeatureGrid cards={featureCards} />
      </section>
    </div>
  );
}
