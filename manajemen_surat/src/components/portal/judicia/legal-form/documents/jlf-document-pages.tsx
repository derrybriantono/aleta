"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArrowLeft, CheckCircle2, Download, FileText, RefreshCw, Save, Search, Send, XCircle } from "lucide-react";

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
import { JLF_CASE_TYPE_OPTIONS } from "@/lib/judicia-legal-form-case-types";
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

type CaseSummary = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara?: string;
  paraPihak?: string;
  tahapan?: string;
  tanggalDaftar?: string;
  statusPerkara?: string;
};

const CASE_SEARCH_MIN_LENGTH = 1;

type CaseBundle = {
  provider: string;
  detail: CaseSummary | null;
  parties: unknown[];
  schedule: unknown[];
  lastHearing: unknown | null;
  nextHearing: unknown | null;
  judges: unknown[];
  panitera: unknown[];
  jurusita: unknown[];
  mediator: unknown[];
  decision: Record<string, unknown> | null;
};

type HearingOption = Record<string, unknown> & {
  sidangKe?: number | string;
  tanggalSidang?: string;
  tanggal_sidang?: string;
  jamSidang?: string;
  jam_sidang?: string;
  agenda?: string;
  agendaSidang?: string;
  agenda_sidang?: string;
};

type TemplateItem = {
  id: string;
  name: string;
  status: string;
  fileType: string;
  requiresValidation: boolean;
};

type VariablePreview = {
  key: string;
  placeholder: string;
  value: unknown;
  source: string;
  confidence?: number;
  warnings?: string[];
  error?: string;
  legacyCode?: string | null;
  label?: string;
  dataType?: string;
  isRequired?: boolean;
};

type DocumentPreview = {
  template: TemplateItem;
  version: { id: string; versionNumber: number; checksum: string };
  variables: VariablePreview[];
  missingRequiredVariables: VariablePreview[];
  unknownPlaceholders: Array<{ placeholder: string; kind: string; count: number }>;
  parserWarnings: string[];
  warnings: string[];
  canRender: boolean;
  supportedOutputFormats: string[];
};

type GeneratedDocument = {
  id: string;
  templateId: string;
  templateName: string;
  templateVersionId?: string | null;
  versionNumber?: number | null;
  nomorPerkara: string;
  sippPerkaraId: string;
  status: string;
  outputFileType: string;
  checksum: string;
  generatedBy?: string | null;
  generatedByName?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  snapshots?: Array<{
    id: string;
    variableKey: string;
    placeholder: string;
    resolvedValue: string;
    sourceType: string;
    warnings: string[];
  }>;
  validationTimeline?: ValidationTimelineItem[];
};

type ValidationTimelineItem = {
  id: string;
  action: string;
  comment: string;
  actorId?: string | null;
  actorName?: string | null;
  createdAt: string;
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Permintaan JLF belum berhasil.");
  }
  return payload?.data as T;
}

function useJlfAccess() {
  const { currentUser, positions } = usePortal();
  const access = resolveJudiciaLegalFormAccess(currentUser, {
    effectiveRoleId: getEffectiveRoleId(currentUser),
    positionLabel: getUserPositionLabel(currentUser, positions),
  });
  return { currentUser, access };
}

function can(access: ReturnType<typeof resolveJudiciaLegalFormAccess>, permission: string) {
  return hasJudiciaLegalFormPermission(access, permission as never);
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getObjectValue(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const found = record[key];
    if (found !== undefined && found !== null && String(found).trim()) return String(found);
  }
  return "";
}

function getHearingLabel(value: unknown, index: number) {
  const sidangKe = getObjectValue(value, ["sidangKe", "sidang_ke", "urutan"]);
  const tanggal = getObjectValue(value, ["tanggalSidang", "tanggal_sidang", "tanggal"]);
  const jam = getObjectValue(value, ["jamSidang", "jam_sidang", "jam"]);
  const agenda = getObjectValue(value, ["agendaSidang", "agenda_sidang", "agenda"]);
  return [`Sidang ${sidangKe || index + 1}`, tanggal, jam, agenda].filter(Boolean).join(" - ");
}

function maskSensitiveText(value: string) {
  return value
    .replace(/\b\d{16}\b/g, (match) => `${match.slice(0, 4)}********${match.slice(-4)}`)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email disamarkan]")
    .replace(/\b(?:\+?62|0)8\d{7,12}\b/g, "[telepon disamarkan]");
}

function displayDocumentValue(value: unknown, canViewSensitive: boolean) {
  const text = stringifyValue(value);
  return canViewSensitive ? text : maskSensitiveText(text);
}

function statusVariant(status: string) {
  if (status === "draft" || status === "generated") return "warning";
  if (status === "approved" || status === "finalized") return "success";
  if (status === "rejected") return "danger";
  if (status === "archived") return "muted";
  return "outline";
}

function renderUnknownItem(item: unknown) {
  if (!item || typeof item !== "object") return stringifyValue(item) || "-";
  const record = item as Record<string, unknown>;
  return stringifyValue(record.nama ?? record.name ?? record.fullname ?? record.tanggal_sidang ?? record.agenda ?? record);
}

function useActiveTemplates(enabled: boolean) {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => {
      void fetch(apiPath("/api/judicia/legal-form/templates?status=active&limit=200"), {
        cache: "no-store",
        credentials: "include",
      })
        .then((response) => readApi<{ items: TemplateItem[] }>(response))
        .then((data) => {
          setTemplates(data.items ?? []);
          setMessage("");
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Gagal memuat template aktif."));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [enabled]);

  return { templates, message };
}

export function JlfCaseSearchPage() {
  const { currentUser, access } = useJlfAccess();
  const canSearch = can(access, JLF_PERMISSION.CASE_SEARCH);
  const [mode, setMode] = useState<"number" | "party">("number");
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [caseType, setCaseType] = useState("");
  const [items, setItems] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function searchCases() {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ limit: "20" });
      params.set(mode === "number" ? "nomorPerkara" : "partyName", query);
      if (year.trim()) params.set("year", year.trim());
      if (caseType.trim()) params.set("caseType", caseType.trim());
      const data = await readApi<{ provider: string; items: CaseSummary[] }>(
        await fetch(apiPath(`/api/judicia/legal-form/cases/search?${params.toString()}`), {
          cache: "no-store",
          credentials: "include",
        })
      );
      setItems(data.items ?? []);
      setMessage(data.items?.length ? "" : `Tidak ada hasil dari provider ${data.provider}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Pencarian perkara gagal.");
    } finally {
      setLoading(false);
    }
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canSearch) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="ALETA Judicia"
        title="Cari Perkara SIPP"
        description="Pencarian perkara dilakukan melalui adapter SIPP read-only yang aman."
        actions={
          <Button asChild variant="outline">
            <Link href={JUDICIA_LEGAL_FORM_ROUTE}>
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        }
      />

      <Card className="border-border/80">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[180px_1fr_120px_180px_auto]">
          <NativeSelect value={mode} onChange={(event) => setMode(event.target.value as "number" | "party")}>
            <option value="number">Nomor perkara</option>
            <option value="party">Nama pihak</option>
          </NativeSelect>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "number" ? "Contoh: 123/Pdt.G/2026/PA..." : "Nama pihak"} />
          <Input value={year} onChange={(event) => setYear(event.target.value)} placeholder="Tahun" />
          <Input list="jlf-case-type-filter-options" value={caseType} onChange={(event) => setCaseType(event.target.value)} placeholder="Jenis perkara" />
          <datalist id="jlf-case-type-filter-options">
            {JLF_CASE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </datalist>
          <Button type="button" disabled={loading || query.trim().length < CASE_SEARCH_MIN_LENGTH} onClick={searchCases}>
            <Search className="h-4 w-4" />
            Cari
          </Button>
        </CardContent>
      </Card>

      {message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent></Card> : null}

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Hasil Pencarian</CardTitle>
          <CardDescription>Hasil dibatasi agar tidak membuka data perkara berlebihan.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <JlfLoadingState />
          ) : items.length === 0 ? (
            <EmptyState title="Belum ada hasil" description="Masukkan nomor perkara atau nama pihak minimal satu karakter." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-medium">Nomor perkara</th>
                    <th className="px-3 py-3 font-medium">Jenis</th>
                    <th className="px-3 py-3 font-medium">Tanggal daftar</th>
                    <th className="px-3 py-3 font-medium">Pihak</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={`${item.perkaraId}-${item.nomorPerkara}`} className="border-b border-border/70">
                      <td className="px-3 py-4 font-medium text-foreground">{item.nomorPerkara}</td>
                      <td className="px-3 py-4 text-muted-foreground">{item.jenisPerkara || "-"}</td>
                      <td className="px-3 py-4 text-muted-foreground">{item.tanggalDaftar || "-"}</td>
                      <td className="px-3 py-4 text-muted-foreground">{item.paraPihak || "-"}</td>
                      <td className="px-3 py-4"><Badge variant="outline">{item.statusPerkara || item.tahapan || "-"}</Badge></td>
                      <td className="px-3 py-4">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/cases/${encodeURIComponent(item.nomorPerkara)}`}>Detail</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function JlfCaseDetailPage({ nomorPerkara }: { nomorPerkara: string }) {
  const { currentUser, access } = useJlfAccess();
  const canView = can(access, JLF_PERMISSION.CASE_VIEW);
  const canGenerate = can(access, JLF_PERMISSION.DOCUMENT_GENERATE);
  const [bundle, setBundle] = useState<CaseBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const templates = useActiveTemplates(canView);

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => {
      void fetch(apiPath(`/api/judicia/legal-form/cases/${encodeURIComponent(nomorPerkara)}`), {
        cache: "no-store",
        credentials: "include",
      })
        .then((response) => readApi<CaseBundle>(response))
        .then((data) => {
          setBundle(data);
          setMessage("");
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Gagal memuat detail perkara."))
        .finally(() => setLoading(false));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [canView, nomorPerkara]);

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  const detail = bundle?.detail;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Detail Perkara"
        title={detail?.nomorPerkara ?? decodeURIComponent(nomorPerkara)}
        description="Data perkara dibaca dari SIPP melalui adapter read-only."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/cases`}>
                <ArrowLeft className="h-4 w-4" />
                Cari Perkara
              </Link>
            </Button>
            {canGenerate ? (
              <Button asChild>
                <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/cases/${encodeURIComponent(decodeURIComponent(nomorPerkara))}/generate`}>
                  <Send className="h-4 w-4" />
                  Generate
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {message || templates.message ? (
        <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message || templates.message}</CardContent></Card>
      ) : null}

      {loading ? (
        <JlfLoadingState />
      ) : detail ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/80"><CardHeader><CardDescription>Jenis Perkara</CardDescription><CardTitle className="text-lg">{detail.jenisPerkara || "-"}</CardTitle></CardHeader></Card>
            <Card className="border-border/80"><CardHeader><CardDescription>Tanggal Daftar</CardDescription><CardTitle className="text-lg">{detail.tanggalDaftar || "-"}</CardTitle></CardHeader></Card>
            <Card className="border-border/80"><CardHeader><CardDescription>Status</CardDescription><CardTitle className="text-lg">{detail.statusPerkara || detail.tahapan || "-"}</CardTitle></CardHeader></Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DetailList title="Pihak-pihak" items={bundle?.parties ?? []} />
            <DetailList title="Jadwal Sidang" items={bundle?.schedule ?? []} />
            <DetailList title="Majelis Hakim" items={bundle?.judges ?? []} />
            <DetailList title="Panitera Pengganti" items={bundle?.panitera ?? []} />
            <DetailList title="Jurusita" items={bundle?.jurusita ?? []} />
            <DetailList title="Mediator" items={bundle?.mediator ?? []} />
          </div>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Template Tersedia</CardTitle>
              <CardDescription>Template aktif dapat dipakai untuk preview variabel dan generate draft dokumen.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {templates.templates.length === 0 ? (
                <EmptyState title="Belum ada template aktif" description="Aktifkan template dari Manajemen Template JLF." />
              ) : templates.templates.map((template) => (
                <div key={template.id} className="rounded-xl border border-border/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-foreground">{template.name}</p>
                    <Badge variant={template.fileType === "rtf" ? "success" : "warning"}>{template.fileType}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{template.requiresValidation ? "Memerlukan validasi" : "Draft administratif"}</p>
                  <Button asChild size="sm" className="mt-4" disabled={!canGenerate}>
                    <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/cases/${encodeURIComponent(detail.nomorPerkara)}/generate?templateId=${encodeURIComponent(template.id)}`}>
                      Generate
                    </Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState title="Perkara tidak ditemukan" description="Adapter SIPP belum mengembalikan detail perkara." />
      )}
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: unknown[] }) {
  return (
    <Card className="border-border/80">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada data.</p>
        ) : items.slice(0, 8).map((item, index) => (
          <div key={`${title}-${index}`} className="rounded-xl border border-border/80 px-4 py-3 text-sm text-muted-foreground">
            {renderUnknownItem(item)}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function JlfGenerateDocumentPage({ nomorPerkara, initialTemplateId }: { nomorPerkara: string; initialTemplateId?: string }) {
  const { currentUser, access } = useJlfAccess();
  const canPreview = can(access, JLF_PERMISSION.DOCUMENT_PREVIEW);
  const canGenerate = can(access, JLF_PERMISSION.DOCUMENT_GENERATE);
  const canManual = can(access, JLF_PERMISSION.MANUAL_DATA_CREATE) || can(access, JLF_PERMISSION.MANUAL_DATA_UPDATE);
  const templates = useActiveTemplates(canPreview);
  const decodedNomor = decodeURIComponent(nomorPerkara);
  const [templateId, setTemplateId] = useState(initialTemplateId ?? "");
  const [bundle, setBundle] = useState<CaseBundle | null>(null);
  const [selectedHearingIndex, setSelectedHearingIndex] = useState("");
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [generated, setGenerated] = useState<GeneratedDocument | null>(null);
  const [manual, setManual] = useState({ variableKey: "", valueText: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (templateId || !initialTemplateId) return;
    const timer = window.setTimeout(() => setTemplateId(initialTemplateId), 0);
    return () => window.clearTimeout(timer);
  }, [initialTemplateId, templateId]);

  useEffect(() => {
    if (templateId || templates.templates.length === 0) return;
    const timer = window.setTimeout(() => setTemplateId(templates.templates[0]?.id ?? ""), 0);
    return () => window.clearTimeout(timer);
  }, [templateId, templates.templates]);

  const selectedTemplate = useMemo(() => templates.templates.find((item) => item.id === templateId), [templateId, templates.templates]);
  const selectedHearing = selectedHearingIndex ? (bundle?.schedule?.[Number(selectedHearingIndex)] as HearingOption | undefined) : undefined;
  const canViewSensitive = access.isAdmin || access.isSuperAdmin;

  useEffect(() => {
    if (!canPreview) return;
    const timer = window.setTimeout(() => {
      void fetch(apiPath(`/api/judicia/legal-form/cases/${encodeURIComponent(decodedNomor)}`), {
        cache: "no-store",
        credentials: "include",
      })
        .then((response) => readApi<CaseBundle>(response))
        .then((data) => setBundle(data))
        .catch(() => setBundle(null));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [canPreview, decodedNomor]);

  async function previewVariables() {
    setBusy(true);
    setMessage("");
    try {
      const data = await readApi<DocumentPreview>(
        await fetch(apiPath("/api/judicia/legal-form/documents/preview"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, nomorPerkara: decodedNomor, selectedHearing }),
        })
      );
      setPreview(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Preview variabel gagal.");
    } finally {
      setBusy(false);
    }
  }

  async function saveManual() {
    setBusy(true);
    setMessage("");
    try {
      await readApi(
        await fetch(apiPath(`/api/judicia/legal-form/cases/${encodeURIComponent(decodedNomor)}/manual-values`), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, variableKey: manual.variableKey, valueText: manual.valueText, valueType: "text" }),
        })
      );
      setMessage("Data manual disimpan. Jalankan preview ulang untuk melihat nilai terbaru.");
      setManual({ variableKey: "", valueText: "" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Data manual gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function generateDraft() {
    setBusy(true);
    setMessage("");
    try {
      const document = await readApi<GeneratedDocument>(
        await fetch(apiPath("/api/judicia/legal-form/documents/generate"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, nomorPerkara: decodedNomor, selectedHearing, mode: "generate_draft" }),
        })
      );
      setGenerated(document);
      setMessage("Draft dokumen berhasil dibuat.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Generate dokumen gagal.");
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canPreview) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Generate Dokumen"
        title={decodedNomor}
        description="Preview variabel terlebih dahulu, lengkapi data manual, lalu generate draft dokumen."
        actions={
          <Button asChild variant="outline">
            <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/cases/${encodeURIComponent(decodedNomor)}`}>
              <ArrowLeft className="h-4 w-4" />
              Detail Perkara
            </Link>
          </Button>
        }
      />

      {message || templates.message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message || templates.message}</CardContent></Card> : null}

      <Card className="border-border/80">
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_1fr_auto_auto_auto]">
          <NativeSelect value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
            <option value="">Pilih template</option>
            {templates.templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name} ({template.fileType})</option>
            ))}
          </NativeSelect>
          <NativeSelect value={selectedHearingIndex} onChange={(event) => setSelectedHearingIndex(event.target.value)}>
            <option value="">Sidang otomatis / tidak dipilih</option>
            {(bundle?.schedule ?? []).map((item, index) => (
              <option key={`hearing-${index}`} value={String(index)}>{getHearingLabel(item, index)}</option>
            ))}
          </NativeSelect>
          <Button asChild variant="outline" disabled={!templateId}>
            <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/cases/${encodeURIComponent(decodedNomor)}/variables?templateId=${encodeURIComponent(templateId)}`}>
              Review Variabel
            </Link>
          </Button>
          <Button type="button" variant="outline" disabled={busy || !templateId} onClick={previewVariables}>
            <RefreshCw className="h-4 w-4" />
            Preview
          </Button>
          <Button type="button" disabled={busy || !canGenerate || !templateId || Boolean(preview?.missingRequiredVariables.length) || selectedTemplate?.fileType !== "rtf"} onClick={generateDraft}>
            <Send className="h-4 w-4" />
            Generate Draft
          </Button>
        </CardContent>
      </Card>

      {preview ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-border/80"><CardHeader><CardDescription>Variabel</CardDescription><CardTitle>{preview.variables.length}</CardTitle></CardHeader></Card>
            <Card className="border-border/80"><CardHeader><CardDescription>Wajib kosong</CardDescription><CardTitle>{preview.missingRequiredVariables.length}</CardTitle></CardHeader></Card>
            <Card className="border-border/80"><CardHeader><CardDescription>Unknown placeholder</CardDescription><CardTitle>{preview.unknownPlaceholders.length}</CardTitle></CardHeader></Card>
            <Card className="border-border/80"><CardHeader><CardDescription>Render</CardDescription><CardTitle className="text-lg">{preview.canRender ? "RTF siap" : "Belum didukung"}</CardTitle></CardHeader></Card>
          </div>

          {preview.warnings.concat(preview.parserWarnings).map((warning) => (
            <Card key={warning} className="border-amber-300/70 bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/70">
              <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-300">{warning}</CardContent>
            </Card>
          ))}

          {canManual ? (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Data Manual</CardTitle>
                <CardDescription>Isi nilai manual untuk variabel yang kosong, lalu preview ulang.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-[240px_1fr_auto]">
                <Input value={manual.variableKey} onChange={(event) => setManual((current) => ({ ...current, variableKey: event.target.value }))} placeholder="variable_key" />
                <Textarea value={manual.valueText} onChange={(event) => setManual((current) => ({ ...current, valueText: event.target.value }))} placeholder="Nilai manual" />
                <Button type="button" disabled={busy || !manual.variableKey || !manual.valueText} onClick={saveManual}>
                  <Save className="h-4 w-4" />
                  Simpan
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Preview Nilai Variabel</CardTitle>
              <CardDescription>Nilai ini akan disimpan sebagai snapshot saat dokumen digenerate.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 font-medium">Placeholder</th>
                      <th className="px-3 py-3 font-medium">Variabel</th>
                      <th className="px-3 py-3 font-medium">Nilai</th>
                      <th className="px-3 py-3 font-medium">Sumber</th>
                      <th className="px-3 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.variables.map((variable) => (
                      <tr key={`${variable.placeholder}-${variable.key}`} className="border-b border-border/70">
                        <td className="px-3 py-4 font-mono text-xs">{variable.placeholder}</td>
                        <td className="px-3 py-4"><p className="font-medium text-foreground">{variable.key}</p><p className="text-xs text-muted-foreground">{variable.label}</p></td>
                        <td className="max-w-[320px] truncate px-3 py-4 text-muted-foreground">{displayDocumentValue(variable.value, canViewSensitive) || "-"}</td>
                        <td className="px-3 py-4"><Badge variant="outline">{variable.source}</Badge></td>
                        <td className="px-3 py-4">{variable.error ? <Badge variant="danger">error</Badge> : variable.warnings?.length ? <Badge variant="warning">warning</Badge> : <Badge variant="success">ok</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {generated ? (
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle>Draft Berhasil Dibuat</CardTitle>
            <CardDescription>Download tetap melalui route terotorisasi, bukan public file path.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={apiPath(`/api/judicia/legal-form/documents/${encodeURIComponent(generated.id)}/download`)}>
                <Download className="h-4 w-4" />
                Download
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/documents/${encodeURIComponent(generated.id)}`}>Detail Dokumen</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function JlfDocumentsListPage() {
  const { currentUser, access } = useJlfAccess();
  const canView = can(access, JLF_PERMISSION.DOCUMENT_PREVIEW);
  const [items, setItems] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({ status: "", templateId: "", nomorPerkara: "", from: "", to: "" });
  const templates = useActiveTemplates(canView);

  const loadDocuments = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "150" });
      for (const [key, value] of Object.entries(filters)) {
        if (value.trim()) params.set(key, value.trim());
      }
      const data = await readApi<{ items: GeneratedDocument[] }>(
        await fetch(apiPath(`/api/judicia/legal-form/documents?${params.toString()}`), {
          cache: "no-store",
          credentials: "include",
        })
      );
      setItems(data.items ?? []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat riwayat dokumen.");
    } finally {
      setLoading(false);
    }
  }, [canView, filters]);

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => {
      void loadDocuments();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canView, loadDocuments]);

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="ALETA Judicia"
        title="Riwayat Dokumen"
        description="Daftar draft dokumen yang digenerate dari template JLF."
        actions={<Button asChild variant="outline"><Link href={JUDICIA_LEGAL_FORM_ROUTE}><ArrowLeft className="h-4 w-4" />Dashboard</Link></Button>}
      />

      {message || templates.message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message || templates.message}</CardContent></Card> : null}

      <Card className="border-border/80">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[160px_1fr_1fr_150px_150px_auto]">
          <NativeSelect value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
            <option value="">Semua status</option>
            <option value="draft">Draft</option>
            <option value="waiting_validation">Menunggu validasi</option>
            <option value="finalized">Final</option>
            <option value="archived">Arsip</option>
          </NativeSelect>
          <NativeSelect value={filters.templateId} onChange={(event) => setFilters((current) => ({ ...current, templateId: event.target.value }))}>
            <option value="">Semua template</option>
            {templates.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </NativeSelect>
          <Input value={filters.nomorPerkara} onChange={(event) => setFilters((current) => ({ ...current, nomorPerkara: event.target.value }))} placeholder="Nomor perkara" />
          <Input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} />
          <Input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} />
          <Button type="button" onClick={loadDocuments} disabled={loading}><RefreshCw className="h-4 w-4" />Terapkan</Button>
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Dokumen</CardTitle>
          <CardDescription>User biasa melihat dokumen sendiri; admin melihat sesuai kewenangan.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <JlfLoadingState />
          ) : items.length === 0 ? (
            <EmptyState title="Belum ada dokumen" description="Generate draft dari detail perkara untuk mengisi riwayat." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-medium">Dokumen</th>
                    <th className="px-3 py-3 font-medium">Perkara</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Output</th>
                    <th className="px-3 py-3 font-medium">Generate</th>
                    <th className="px-3 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-border/70">
                      <td className="px-3 py-4"><p className="font-medium text-foreground">{item.templateName}</p><p className="text-xs text-muted-foreground">{item.id}</p></td>
                      <td className="px-3 py-4 text-muted-foreground">{item.nomorPerkara}</td>
                      <td className="px-3 py-4"><Badge variant={statusVariant(item.status)}>{item.status}</Badge></td>
                      <td className="px-3 py-4"><Badge variant="outline">{item.outputFileType || "-"}</Badge></td>
                      <td className="px-3 py-4 text-muted-foreground">{item.generatedByName || item.generatedBy || "-"}</td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline"><Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/documents/${encodeURIComponent(item.id)}`}>Detail</Link></Button>
                          <Button asChild size="sm" variant="outline"><a href={apiPath(`/api/judicia/legal-form/documents/${encodeURIComponent(item.id)}/download`)}><Download className="h-3.5 w-3.5" />Download</a></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function JlfDocumentDetailPage({ documentId }: { documentId: string }) {
  const { currentUser, access } = useJlfAccess();
  const canView = can(access, JLF_PERMISSION.DOCUMENT_PREVIEW);
  const canDownload = can(access, JLF_PERMISSION.DOCUMENT_DOWNLOAD);
  const canArchive = can(access, JLF_PERMISSION.DOCUMENT_ARCHIVE);
  const canValidate = can(access, JLF_PERMISSION.DOCUMENT_VALIDATE);
  const [document, setDocument] = useState<GeneratedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadDocument = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const data = await readApi<GeneratedDocument>(
        await fetch(apiPath(`/api/judicia/legal-form/documents/${encodeURIComponent(documentId)}`), {
          cache: "no-store",
          credentials: "include",
        })
      );
      setDocument(data);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat detail dokumen.");
    } finally {
      setLoading(false);
    }
  }, [canView, documentId]);

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => {
      void loadDocument();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canView, loadDocument]);

  async function archiveDocument() {
    setMessage("");
    try {
      await readApi(
        await fetch(apiPath(`/api/judicia/legal-form/documents/${encodeURIComponent(documentId)}/archive`), {
          method: "POST",
          credentials: "include",
        })
      );
      setMessage("Dokumen diarsipkan.");
      await loadDocument();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Arsip dokumen gagal.");
    }
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Detail Dokumen"
        title={document?.templateName ?? documentId}
        description="Snapshot variabel disimpan saat generate agar riwayat dokumen dapat diaudit."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/documents`}><ArrowLeft className="h-4 w-4" />Riwayat</Link></Button>
            {canDownload && document ? <Button asChild><a href={apiPath(`/api/judicia/legal-form/documents/${encodeURIComponent(document.id)}/download`)}><Download className="h-4 w-4" />Download</a></Button> : null}
            {document ? <Button asChild variant="outline"><Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/documents/${encodeURIComponent(document.id)}/validate`}><CheckCircle2 className="h-4 w-4" />Validasi</Link></Button> : null}
            {canArchive && document?.status !== "archived" ? <Button type="button" variant="outline" onClick={archiveDocument}><Archive className="h-4 w-4" />Arsipkan</Button> : null}
          </div>
        }
      />

      {message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent></Card> : null}

      {loading ? (
        <JlfLoadingState />
      ) : document ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-border/80"><CardHeader><CardDescription>Status</CardDescription><CardTitle><Badge variant={statusVariant(document.status)}>{document.status}</Badge></CardTitle></CardHeader></Card>
            <Card className="border-border/80"><CardHeader><CardDescription>Perkara</CardDescription><CardTitle className="text-base">{document.nomorPerkara}</CardTitle></CardHeader></Card>
            <Card className="border-border/80"><CardHeader><CardDescription>Versi</CardDescription><CardTitle>{document.versionNumber ?? "-"}</CardTitle></CardHeader></Card>
            <Card className="border-border/80"><CardHeader><CardDescription>Output</CardDescription><CardTitle>{document.outputFileType || "-"}</CardTitle></CardHeader></Card>
          </div>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Snapshot Variabel</CardTitle>
              <CardDescription>Nilai yang dipakai saat dokumen dibuat.</CardDescription>
            </CardHeader>
            <CardContent>
              {document.snapshots?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[840px] text-left text-sm">
                    <thead className="border-b border-border text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3 font-medium">Placeholder</th>
                        <th className="px-3 py-3 font-medium">Variabel</th>
                        <th className="px-3 py-3 font-medium">Nilai</th>
                        <th className="px-3 py-3 font-medium">Sumber</th>
                      </tr>
                    </thead>
                    <tbody>
                      {document.snapshots.map((snapshot) => (
                        <tr key={snapshot.id} className="border-b border-border/70">
                          <td className="px-3 py-4 font-mono text-xs">{snapshot.placeholder}</td>
                          <td className="px-3 py-4 font-medium text-foreground">{snapshot.variableKey}</td>
                          <td className="max-w-[420px] truncate px-3 py-4 text-muted-foreground">{snapshot.resolvedValue || "-"}</td>
                          <td className="px-3 py-4"><Badge variant="outline">{snapshot.sourceType}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="Belum ada snapshot" description="Snapshot tersedia untuk dokumen yang dibuat lewat engine JLF." />
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Validasi</CardTitle>
              <CardDescription>Workflow validasi manusia untuk approve, reject, request change, dan finalisasi.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/documents/${encodeURIComponent(document.id)}/validate`}>
                  <CheckCircle2 className="h-4 w-4" />
                  Buka Validasi
                </Link>
              </Button>
              <Button type="button" variant="outline" disabled={!canValidate}>
                <FileText className="h-4 w-4" />
                Panel Validator
              </Button>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState title="Dokumen tidak ditemukan" description="Dokumen mungkin sudah tidak tersedia atau akses Anda tidak mencakup dokumen ini." />
      )}
    </div>
  );
}

export function JlfDocumentValidationPage({ documentId }: { documentId: string }) {
  const { currentUser, access } = useJlfAccess();
  const canView = can(access, JLF_PERMISSION.DOCUMENT_PREVIEW);
  const canSubmit = can(access, JLF_PERMISSION.DOCUMENT_GENERATE);
  const canValidate = can(access, JLF_PERMISSION.DOCUMENT_VALIDATE);
  const canApprove = can(access, JLF_PERMISSION.DOCUMENT_APPROVE);
  const canReject = can(access, JLF_PERMISSION.DOCUMENT_REJECT);
  const canFinalize = can(access, JLF_PERMISSION.DOCUMENT_FINALIZE);
  const [document, setDocument] = useState<GeneratedDocument | null>(null);
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [qrPayload, setQrPayload] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadDocument = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const data = await readApi<GeneratedDocument>(
        await fetch(apiPath(`/api/judicia/legal-form/documents/${encodeURIComponent(documentId)}`), {
          cache: "no-store",
          credentials: "include",
        })
      );
      setDocument(data);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat validasi dokumen.");
    } finally {
      setLoading(false);
    }
  }, [canView, documentId]);

  useEffect(() => {
    if (!canView) return;
    const timer = window.setTimeout(() => {
      void loadDocument();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [canView, loadDocument]);

  async function runWorkflow(action: string, endpoint: string, requiresComment = false) {
    if (requiresComment && !comment.trim()) {
      setMessage("Komentar wajib diisi untuk aksi ini.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const data = await readApi<{ qrPayload?: Record<string, unknown> | null }>(
        await fetch(apiPath(`/api/judicia/legal-form/documents/${encodeURIComponent(documentId)}/${endpoint}`), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(comment.trim() ? { comment } : {}),
        })
      );
      setQrPayload(data.qrPayload ?? null);
      setComment("");
      setMessage(`${action} berhasil diproses.`);
      await loadDocument();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${action} gagal diproses.`);
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Validasi Dokumen"
        title={document?.templateName ?? documentId}
        description="Workflow human-in-the-loop untuk validasi dokumen/BAS JLF."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/documents/${encodeURIComponent(documentId)}`}>
                <ArrowLeft className="h-4 w-4" />
                Detail Dokumen
              </Link>
            </Button>
            {document ? (
              <Button asChild variant="outline">
                <a href={apiPath(`/api/judicia/legal-form/documents/${encodeURIComponent(document.id)}/download`)}>
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </Button>
            ) : null}
          </div>
        }
      />

      {message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent></Card> : null}

      {loading ? (
        <JlfLoadingState />
      ) : document ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="border-border/80"><CardHeader><CardDescription>Status</CardDescription><CardTitle><Badge variant={statusVariant(document.status)}>{document.status}</Badge></CardTitle></CardHeader></Card>
            <Card className="border-border/80"><CardHeader><CardDescription>Perkara</CardDescription><CardTitle className="text-base">{document.nomorPerkara}</CardTitle></CardHeader></Card>
            <Card className="border-border/80"><CardHeader><CardDescription>Template</CardDescription><CardTitle className="text-base">{document.templateName}</CardTitle></CardHeader></Card>
            <Card className="border-border/80"><CardHeader><CardDescription>Versi</CardDescription><CardTitle>{document.versionNumber ?? "-"}</CardTitle></CardHeader></Card>
          </div>

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Catatan Validasi</CardTitle>
              <CardDescription>Komentar wajib untuk reject dan request change.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Tulis catatan validasi" />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={busy || !canSubmit || !["draft", "generated", "change_requested"].includes(document.status)} onClick={() => runWorkflow("Submit validasi", "submit-validation")}>
                  <Send className="h-4 w-4" />
                  Submit Validasi
                </Button>
                <Button type="button" variant="outline" disabled={busy || !comment.trim()} onClick={() => runWorkflow("Komentar", "comment", true)}>
                  <FileText className="h-4 w-4" />
                  Tambah Komentar
                </Button>
                <Button type="button" variant="outline" disabled={busy || !canValidate || document.status !== "waiting_validation"} onClick={() => runWorkflow("Request change", "request-change", true)}>
                  <RefreshCw className="h-4 w-4" />
                  Request Change
                </Button>
                <Button type="button" disabled={busy || !canApprove || document.status !== "waiting_validation"} onClick={() => runWorkflow("Approve", "approve")}>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
                <Button type="button" variant="outline" disabled={busy || !canReject || document.status !== "waiting_validation"} onClick={() => runWorkflow("Reject", "reject", true)}>
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
                <Button type="button" variant="outline" disabled={busy || !canFinalize || document.status !== "approved"} onClick={() => runWorkflow("Finalize", "finalize")}>
                  <Archive className="h-4 w-4" />
                  Finalize
                </Button>
              </div>
            </CardContent>
          </Card>

          {qrPayload ? (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>QR Verification Payload</CardTitle>
                <CardDescription>Token mentah hanya ditampilkan pada respons finalisasi ini dan tidak disimpan di database.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-xl border border-border/80 bg-muted/30 p-4 text-xs text-muted-foreground">
                  {JSON.stringify(qrPayload, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Timeline Validasi</CardTitle>
              <CardDescription>Semua aksi workflow masuk log validasi dan audit trail.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {document.validationTimeline?.length ? (
                document.validationTimeline.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border/80 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{item.action}</p>
                        <p className="text-sm text-muted-foreground">{item.comment || "Tanpa komentar"}</p>
                      </div>
                      <Badge variant="outline">{item.actorName || item.actorId || "system"}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{item.createdAt}</p>
                  </div>
                ))
              ) : (
                <EmptyState title="Belum ada timeline" description="Submit validasi atau tambahkan komentar untuk memulai timeline." />
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState title="Dokumen tidak ditemukan" description="Dokumen tidak tersedia atau akses Anda tidak mencakup dokumen ini." />
      )}
    </div>
  );
}
