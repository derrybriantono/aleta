"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, RotateCcw, Save, X } from "lucide-react";

import { JlfLoadingState } from "@/components/portal/judicia/legal-form/jlf-foundation";
import { AccessDeniedCard, EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { getJlfFieldModeLabel, getLegacyAbtTypeLabel } from "@/lib/judicia-legal-form-abt";
import {
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

type TemplateItem = {
  id: string;
  name: string;
  fileType: string;
};

type VariablePreview = {
  key: string;
  placeholder: string;
  value: unknown;
  source: string;
  warnings?: string[];
  error?: string;
  legacyCode?: string | null;
  label?: string;
  dataType?: string;
  sourceType?: string;
  isRequired?: boolean;
  legacyAbtType?: string;
  fieldMode?: string;
  manualOverride?: boolean;
  aiEnabled?: boolean;
  manualOverrideAllowed?: boolean;
};

type DocumentPreview = {
  variables: VariablePreview[];
  missingRequiredVariables: VariablePreview[];
  unknownPlaceholders: Array<{ placeholder: string; kind: string; count: number }>;
  warnings: string[];
  parserWarnings: string[];
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Permintaan JLF belum berhasil.");
  }
  return payload?.data as T;
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function maskSensitiveText(value: string) {
  return value
    .replace(/\b\d{16}\b/g, (match) => `${match.slice(0, 4)}********${match.slice(-4)}`)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email disamarkan]")
    .replace(/\b(?:\+?62|0)8\d{7,12}\b/g, "[telepon disamarkan]");
}

type JlfReviewStatus = "sipp" | "manual" | "empty" | "needs_review" | "computed";

const REVIEW_STATUS_OPTIONS: Array<{ value: "all" | JlfReviewStatus; label: string }> = [
  { value: "all", label: "Semua status" },
  { value: "empty", label: "Kosong" },
  { value: "needs_review", label: "Needs Review" },
  { value: "manual", label: "Manual" },
  { value: "sipp", label: "SIPP" },
  { value: "computed", label: "Computed/Static" },
];

function isEmptyResolvedValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function humanizeResolverWarning(value: string) {
  const normalized = value.toLowerCase();
  if (!value.trim()) return "";
  if (normalized.includes("resolver returned null") || normalized.includes("resolved null")) {
    return "Data belum ditemukan dari sumber yang dipilih.";
  }
  if (normalized.includes("source_key") || normalized.includes("undefined")) {
    return "Sumber data variabel ini belum lengkap dan perlu dicek admin.";
  }
  if (normalized.includes("query failed") || normalized.includes("database") || normalized.includes("sql")) {
    return "Data belum dapat dibaca dari sumber SIPP. Coba lagi atau minta admin memeriksa mapping.";
  }
  if (normalized.includes("needs_review") || normalized.includes("review")) {
    return "Variabel ini perlu dicek admin sebelum dipakai sebagai final.";
  }
  if (normalized.includes("unknown")) {
    return "Placeholder belum dikenal atau belum dimapping.";
  }
  return value;
}

function getVariableStatus(variable: VariablePreview): JlfReviewStatus {
  const source = `${variable.sourceType ?? ""} ${variable.source ?? ""}`.toLowerCase();
  const warnings = `${variable.error ?? ""} ${(variable.warnings ?? []).join(" ")}`.toLowerCase();

  if (isEmptyResolvedValue(variable.value)) return "empty";
  if (variable.error || warnings.includes("needs_review") || warnings.includes("review") || warnings.includes("unknown")) {
    return "needs_review";
  }
  if (source.includes("manual") || source.includes("jlf_manual")) return "manual";
  if (source.includes("sipp")) return "sipp";
  return "computed";
}

function statusBadgeMeta(status: JlfReviewStatus) {
  switch (status) {
    case "sipp":
      return { label: "SIPP", variant: "success" as const };
    case "manual":
      return { label: "Manual", variant: "default" as const };
    case "empty":
      return { label: "Kosong", variant: "danger" as const };
    case "needs_review":
      return { label: "Needs Review", variant: "warning" as const };
    case "computed":
      return { label: "Computed/Static", variant: "outline" as const };
  }
}

function sourceLabel(variable: VariablePreview) {
  const source = variable.sourceType || variable.source || "";
  if (source.includes("sipp_perkara")) return "SIPP Perkara";
  if (source.includes("sipp_pihak")) return "SIPP Pihak";
  if (source.includes("sipp_jadwal_sidang")) return "SIPP Sidang";
  if (source.includes("sipp_hakim")) return "SIPP Hakim";
  if (source.includes("sipp_panitera")) return "SIPP Panitera";
  if (source.includes("sipp_jurusita")) return "SIPP Jurusita";
  if (source.includes("sipp_putusan")) return "SIPP Putusan";
  if (source.includes("sipp_keuangan")) return "SIPP Biaya";
  if (source.includes("jlf_manual")) return "Data Manual";
  if (source.includes("jlf_bas_qa")) return "Tanya Jawab/BAS";
  if (source.includes("function")) return "Function";
  if (source.includes("computed")) return "Computed";
  if (source.includes("static")) return "Static";
  if (source.includes("qrcode")) return "QR";
  return source || "-";
}

function warningLabel(variable: VariablePreview) {
  if (variable.error) return humanizeResolverWarning(variable.error);
  if (isEmptyResolvedValue(variable.value)) {
    return variable.warnings?.length
      ? variable.warnings.map(humanizeResolverWarning).join("; ")
      : "Data kosong, isi manual bila diperlukan.";
  }
  if (variable.warnings?.length) return variable.warnings.map(humanizeResolverWarning).join("; ");
  return "-";
}

function useJlfAccess() {
  const { currentUser, positions } = usePortal();
  const access = resolveJudiciaLegalFormAccess(currentUser, {
    effectiveRoleId: getEffectiveRoleId(currentUser),
    positionLabel: getUserPositionLabel(currentUser, positions),
  });
  return { currentUser, access };
}

export function JlfVariableReviewPage({ nomorPerkara, initialTemplateId }: { nomorPerkara: string; initialTemplateId?: string }) {
  const decodedNomor = decodeURIComponent(nomorPerkara);
  const { currentUser, access } = useJlfAccess();
  const canPreview = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.DOCUMENT_PREVIEW);
  const canManual = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.MANUAL_DATA_CREATE) || hasJudiciaLegalFormPermission(access, JLF_PERMISSION.MANUAL_DATA_UPDATE);
  const canResetManual = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.MANUAL_DATA_DELETE);
  const canManageVariables = hasJudiciaLegalFormPermission(access, JLF_PERMISSION.VARIABLE_UPDATE);
  const canViewSensitive = access.isAdmin || access.isSuperAdmin;
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templateId, setTemplateId] = useState(initialTemplateId ?? "");
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | JlfReviewStatus>("all");
  const [variableSearch, setVariableSearch] = useState("");
  const [editing, setEditing] = useState<VariablePreview | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!canPreview) return;
    const timer = window.setTimeout(() => {
      void fetch(apiPath("/api/judicia/legal-form/templates?status=active&limit=200"), {
        cache: "no-store",
        credentials: "include",
      })
        .then((response) => readApi<{ items: TemplateItem[] }>(response))
        .then((data) => {
          setTemplates(data.items ?? []);
          setTemplateId((current) => current || initialTemplateId || data.items?.[0]?.id || "");
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Template aktif belum dapat dimuat."));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [canPreview, initialTemplateId]);

  const selectedTemplate = useMemo(() => templates.find((item) => item.id === templateId), [templateId, templates]);
  const filteredVariables = useMemo(() => {
    const query = variableSearch.trim().toLowerCase();
    return (preview?.variables ?? []).filter((variable) => {
      const status = getVariableStatus(variable);
      const statusOk = statusFilter === "all" || status === statusFilter;
      const text = [
        variable.legacyCode,
        variable.key,
        variable.label,
        variable.placeholder,
        sourceLabel(variable),
        getLegacyAbtTypeLabel(variable.legacyAbtType),
        getJlfFieldModeLabel(variable.fieldMode),
        stringifyValue(variable.value),
        warningLabel(variable),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return statusOk && (!query || text.includes(query));
    });
  }, [preview, statusFilter, variableSearch]);
  const reviewStatusCounts = useMemo(() => {
    const counts: Record<JlfReviewStatus, number> = { sipp: 0, manual: 0, empty: 0, needs_review: 0, computed: 0 };
    for (const variable of preview?.variables ?? []) {
      counts[getVariableStatus(variable)] += 1;
    }
    return counts;
  }, [preview]);

  async function loadPreview() {
    setBusy(true);
    setMessage("");
    try {
      const data = await readApi<DocumentPreview>(
        await fetch(apiPath("/api/judicia/legal-form/documents/preview"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, nomorPerkara: decodedNomor }),
        })
      );
      setPreview(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Preview variabel belum berhasil.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(variable: VariablePreview) {
    setEditing(variable);
    setManualValue(stringifyValue(variable.value));
  }

  async function saveManualValue() {
    if (!editing) return;
    setBusy(true);
    setMessage("");
    try {
      await readApi(
        await fetch(apiPath(`/api/judicia/legal-form/cases/${encodeURIComponent(decodedNomor)}/manual-values`), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId,
            variableKey: editing.key,
            valueText: manualValue,
            valueType: editing.dataType || "text",
          }),
        })
      );
      setMessage("Nilai manual disimpan dan tercatat di audit.");
      setEditing(null);
      setManualValue("");
      await loadPreview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nilai manual belum dapat disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function resetManualValue(variable: VariablePreview) {
    setBusy(true);
    setMessage("");
    try {
      await readApi(
        await fetch(apiPath(`/api/judicia/legal-form/cases/${encodeURIComponent(decodedNomor)}/manual-values`), {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId,
            variableKey: variable.key,
          }),
        })
      );
      setMessage("Override manual dihapus. Nilai akan diambil ulang dari SIPP/fungsi saat preview berikutnya.");
      await loadPreview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Override manual belum dapat dihapus.");
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canPreview) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Review Variabel"
        title={decodedNomor}
        description="Tampilan padat untuk memeriksa kode legacy, key, sumber data, nilai resolve, warning, dan data manual."
        actions={
          <Button asChild variant="outline">
            <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/cases/${encodeURIComponent(decodedNomor)}/generate${templateId ? `?templateId=${encodeURIComponent(templateId)}` : ""}`}>
              <ArrowLeft className="h-4 w-4" />
              Generate
            </Link>
          </Button>
        }
      />

      {message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent></Card> : null}

      <Card className="border-border/80">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_auto]">
          <NativeSelect value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">Pilih template aktif</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name} ({template.fileType})</option>
            ))}
          </NativeSelect>
          <Button type="button" disabled={busy || !templateId} onClick={loadPreview}>
            <RefreshCw className="h-4 w-4" />
            Muat Preview
          </Button>
        </CardContent>
      </Card>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-panel">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Edit Manual</p>
                <CardTitle className="mt-1">{editing.key}</CardTitle>
                <CardDescription className="mt-1">
                  Nilai manual menjadi override untuk perkara dan template ini. Perubahan dicatat sebagai audit manual data.
                </CardDescription>
              </div>
              <Button type="button" size="icon" variant="outline" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Textarea className="mt-4 min-h-36" value={manualValue} onChange={(event) => setManualValue(event.target.value)} />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Batal</Button>
              <Button type="button" disabled={busy} onClick={saveManualValue}>
                <Save className="h-4 w-4" />
                Simpan Manual
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Card className="border-border/80">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Daftar Variabel Dokumen</CardTitle>
              <CardDescription>
                {selectedTemplate ? selectedTemplate.name : "Pilih template untuk mulai review."}
              </CardDescription>
            </div>
            {preview ? (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{preview.variables.length} variabel</Badge>
                <Badge variant={preview.missingRequiredVariables.length ? "danger" : "success"}>{preview.missingRequiredVariables.length} wajib kosong</Badge>
                <Badge variant={preview.unknownPlaceholders.length ? "warning" : "outline"}>{preview.unknownPlaceholders.length} unknown</Badge>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="overflow-hidden">
          {!preview ? (
            <EmptyState title="Preview belum dimuat" description="Pilih template lalu muat preview untuk melihat variabel seperti daftar ABT." />
          ) : (
            <div className="space-y-3">
              {(reviewStatusCounts.empty || reviewStatusCounts.needs_review || preview.unknownPlaceholders.length) ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-100">
                  <p className="font-semibold">Periksa sebelum generate.</p>
                  <p className="mt-1">
                    {reviewStatusCounts.empty} variabel kosong, {reviewStatusCounts.needs_review} perlu review admin,
                    dan {preview.unknownPlaceholders.length} placeholder belum dikenal. Isi manual jika diperlukan sebelum dokumen dijadikan final.
                  </p>
                </div>
              ) : null}
              <div className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-3 md:grid-cols-[1fr_180px_auto]">
                <Input
                  value={variableSearch}
                  onChange={(event) => setVariableSearch(event.target.value)}
                  placeholder="Cari kode, key, label, nilai, atau warning"
                />
                <NativeSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | JlfReviewStatus)}>
                  {REVIEW_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </NativeSelect>
                <Button type="button" variant="outline" onClick={() => {
                  setStatusFilter("all");
                  setVariableSearch("");
                }}>
                  Reset
                </Button>
              </div>
              <div className="max-w-full overflow-x-auto rounded-xl border border-border/80">
                <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="w-[26%] px-3 py-3 font-medium">Variabel</th>
                      <th className="w-[13%] px-3 py-3 font-medium">Placeholder</th>
                      <th className="w-[28%] px-3 py-3 font-medium">Nilai Resolved</th>
                      <th className="w-[22%] px-3 py-3 font-medium">Catatan</th>
                      <th className="w-[11%] px-3 py-3 font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVariables.map((variable) => {
                      const value = stringifyValue(variable.value);
                      const displayValue = canViewSensitive ? value : maskSensitiveText(value || "-");
                      const status = getVariableStatus(variable);
                      const statusMeta = statusBadgeMeta(status);
                      return (
                        <tr key={`${variable.key}-${variable.placeholder}`} className="border-b border-border/70 align-top">
                          <td className="px-3 py-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1.5">
                                {variable.legacyCode ? <Badge variant="outline">#{variable.legacyCode}#</Badge> : null}
                                <Badge variant="outline">{getLegacyAbtTypeLabel(variable.legacyAbtType)}</Badge>
                                <Badge variant="outline">{getJlfFieldModeLabel(variable.fieldMode)}</Badge>
                                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                                {variable.manualOverride ? <Badge variant="default">Override manual</Badge> : null}
                                {variable.aiEnabled ? <Badge variant="warning">AI ON</Badge> : null}
                              </div>
                              <p className="break-words font-medium text-foreground">{variable.label || variable.key}</p>
                              <p className="break-all font-mono text-xs text-muted-foreground">{variable.key}</p>
                            </div>
                          </td>
                          <td className="break-all px-3 py-3 font-mono text-xs text-muted-foreground">{variable.placeholder}</td>
                          <td className="px-3 py-3 text-muted-foreground">
                            <div className="max-h-24 overflow-auto whitespace-pre-wrap break-words">{displayValue || "-"}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="space-y-2">
                              <Badge variant="outline">{sourceLabel(variable)}</Badge>
                              <p className="break-all font-mono text-xs text-muted-foreground">
                                {variable.sourceType || variable.source || "-"}{variable.dataType ? ` / ${variable.dataType}` : ""}
                              </p>
                              <div className="max-h-24 overflow-auto whitespace-pre-wrap break-words text-xs text-amber-700 dark:text-amber-300">
                                {warningLabel(variable)}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col gap-2">
                              <Button type="button" size="sm" variant="outline" disabled={!canManual || variable.manualOverrideAllowed === false} onClick={() => startEdit(variable)}>
                                Edit
                              </Button>
                              {status === "manual" ? (
                                <Button type="button" size="sm" variant="outline" disabled={!canResetManual || busy} onClick={() => void resetManualValue(variable)}>
                                  <RotateCcw className="h-3.5 w-3.5" />
                                  Reset
                                </Button>
                              ) : null}
                              {canManageVariables ? (
                                <Button asChild size="sm" variant="ghost">
                                  <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/variables?search=${encodeURIComponent(variable.key)}`}>
                                    Lihat Detail
                                  </Link>
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredVariables.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                          Tidak ada variabel sesuai filter.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
