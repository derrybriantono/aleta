"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Database, Plus, RefreshCw, Save, Scale } from "lucide-react";

import { JlfLoadingState } from "@/components/portal/judicia/legal-form/jlf-foundation";
import { AccessDeniedCard, EmptyState, PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import {
  getJlfFieldModeLabel,
  getLegacyAbtTypeLabel,
  JLF_FIELD_MODE_OPTIONS,
  JLF_LEGACY_ABT_TYPE_OPTIONS,
  resolveJlfFieldMode,
  resolveLegacyAbtType,
} from "@/lib/judicia-legal-form-abt";
import {
  hasJudiciaLegalFormPermission,
  JLF_PERMISSION,
  JUDICIA_LEGAL_FORM_ROUTE,
  resolveJudiciaLegalFormAccess,
} from "@/lib/judicia-legal-form-types";
import {
  listJlfSippQueryPreviewDefinitions,
  resolveJlfVariableQueryPreview,
  type JlfVariableQueryPreview,
} from "@/lib/judicia-legal-form-query-preview";
import { JLF_CASE_TYPE_GROUPS } from "@/lib/judicia-legal-form-case-types";
import { getEffectiveRoleId, getUserPositionLabel } from "@/lib/permissions";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string };
};

type VariableItem = {
  id: string;
  legacyCode: string | null;
  key: string;
  label: string;
  description: string;
  dataType: string;
  sourceType: string;
  sourceKey: string;
  transformKey: string;
  fallbackValue: string;
  legacyAbtType: string;
  fieldMode: string;
  aiEnabled: boolean;
  manualOverrideAllowed: boolean;
  isRequired: boolean;
  isActive: boolean;
  exampleValue: string;
  adminNote: string;
  sippQueryPreview?: string;
  sippQueryPreviewStatus?: string;
  sippQueryPreviewKey?: string;
  sippQueryPreviewGeneratedAt?: string | null;
  queryPreview?: JlfVariableQueryPreview;
};

type VariablesResponse = {
  items: VariableItem[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    pageCount: number;
  };
};

type SourcePreviewResult = {
  provider: string;
  queryKey: string;
  selectOnly: boolean;
  rawSqlEndpoint: boolean;
  rows: unknown[];
  mappedValues: unknown[];
  rowCount: number;
  sqlValue?: unknown;
  queryHash?: string;
  message: string;
};

type SortDirection = "asc" | "desc";

const dataTypes = [
  "text",
  "number",
  "date",
  "datetime",
  "currency",
  "boolean",
  "long_text",
  "json",
  "list",
  "table",
  "qrcode",
  "image",
  "ai_generated_text",
  "manual_text",
  "manual_date",
];

const sourceTypes = [
  "sipp_perkara",
  "sipp_pihak",
  "sipp_jadwal_sidang",
  "sipp_hakim",
  "sipp_panitera",
  "sipp_jurusita",
  "sipp_putusan",
  "sipp_keuangan",
  "jlf_manual",
  "jlf_temp",
  "jlf_bas_qa",
  "function",
  "qrcode",
  "ai",
  "static",
  "computed",
  "abt_sql",
];

const SILENT_JLF_HEADERS = { "x-aleta-silent-loading": "1" };
const JSON_SILENT_JLF_HEADERS = { "Content-Type": "application/json", "x-aleta-silent-loading": "1" };

function sourceTypeFromQueryKey(queryKey: string) {
  if (queryKey.includes(".pihak") || queryKey.includes(".saksi")) return "sipp_pihak";
  if (queryKey.includes(".sidang")) return "sipp_jadwal_sidang";
  if (queryKey.includes(".hakim")) return "sipp_hakim";
  if (queryKey.includes(".panitera")) return "sipp_panitera";
  if (queryKey.includes(".jurusita")) return "sipp_jurusita";
  if (queryKey.includes(".putusan")) return "sipp_putusan";
  if (queryKey.includes(".biaya")) return "sipp_keuangan";
  return "sipp_perkara";
}

function stringifyPreviewValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Permintaan variabel JLF belum berhasil.");
  }
  return payload?.data as T;
}

function useJlfVariableAccess() {
  const { currentUser, positions } = usePortal();
  const access = resolveJudiciaLegalFormAccess(currentUser, {
    effectiveRoleId: getEffectiveRoleId(currentUser),
    positionLabel: getUserPositionLabel(currentUser, positions),
  });
  return { currentUser, access };
}

function hasAccess(access: ReturnType<typeof resolveJudiciaLegalFormAccess>, permission: string) {
  return hasJudiciaLegalFormPermission(access, permission as never);
}

export function JlfVariablesListPage() {
  const searchParams = useSearchParams();
  const urlSearchQuery = searchParams.get("search") ?? "";
  const { currentUser, access } = useJlfVariableAccess();
  const canView = hasAccess(access, JLF_PERMISSION.VARIABLE_VIEW);
  const canCreate = hasAccess(access, JLF_PERMISSION.VARIABLE_CREATE);
  const canUpdate = hasAccess(access, JLF_PERMISSION.VARIABLE_UPDATE);
  const [items, setItems] = useState<VariableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({ query: urlSearchQuery, dataType: "", sourceType: "" });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [pageSize, setPageSize] = useState("100");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [sortBy, setSortBy] = useState("key");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [reloadKey, setReloadKey] = useState(0);
  const pageSizeNumber = pageSize === "all" ? 20000 : Number(pageSize) || 100;
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(totalItems / pageSizeNumber));
  const currentOffset = pageSize === "all" ? 0 : Math.max(0, (currentPage - 1) * pageSizeNumber);
  const visiblePages = useMemo(() => {
    const maxButtons = 7;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    const start = Math.max(1, Math.min(currentPage - 3, totalPages - maxButtons + 1));
    return Array.from({ length: maxButtons }, (_, index) => start + index);
  }, [currentPage, totalPages]);
  const firstVisibleRow = totalItems === 0 ? 0 : currentOffset + 1;
  const lastVisibleRow = Math.min(totalItems, currentOffset + items.length);

  const loadVariables = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: pageSize, sortBy, sortDir });
      if (pageSize !== "all") params.set("offset", String(currentOffset));
      if (appliedFilters.query.trim()) params.set("query", appliedFilters.query.trim());
      if (appliedFilters.dataType) params.set("dataType", appliedFilters.dataType);
      if (appliedFilters.sourceType) params.set("sourceType", appliedFilters.sourceType);
      const data = await readApi<VariablesResponse>(
        await fetch(apiPath(`/api/judicia/legal-form/variables?${params.toString()}`), {
          cache: "no-store",
          credentials: "include",
          headers: SILENT_JLF_HEADERS,
        })
      );
      setItems(data.items ?? []);
      setTotalItems(data.pagination?.total ?? data.items?.length ?? 0);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal memuat variabel JLF.");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, canView, currentOffset, pageSize, sortBy, sortDir]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadVariables(), 0);
    return () => window.clearTimeout(timer);
  }, [loadVariables, reloadKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((current) => current.query === urlSearchQuery ? current : { ...current, query: urlSearchQuery });
      setAppliedFilters((current) => current.query === urlSearchQuery ? current : { ...current, query: urlSearchQuery });
      setCurrentPage(1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [urlSearchQuery]);

  function applyFilters(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setAppliedFilters(filters);
    setCurrentPage(1);
    setReloadKey((current) => current + 1);
  }

  function handleSort(field: string) {
    setCurrentPage(1);
    if (sortBy === field) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(field);
    setSortDir("asc");
  }

  function goToPage(page: number) {
    setCurrentPage(Math.max(1, Math.min(totalPages, page)));
  }

  function renderSortButton(label: string, field: string) {
    const active = sortBy === field;
    const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-left font-medium text-muted-foreground transition hover:text-foreground"
      >
        {label}
        <Icon className="h-3.5 w-3.5" />
      </button>
    );
  }

  function renderPaginationControls(position: "top" | "bottom") {
    if (pageSize === "all" || totalItems <= pageSizeNumber) return null;

    return (
      <div className={`flex flex-col gap-3 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between ${position === "top" ? "mb-4" : "mt-4 border-t border-border/70 pt-4"}`}>
        <p>
          Menampilkan {firstVisibleRow}-{lastVisibleRow} dari {totalItems} variabel.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={loading || currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          {visiblePages[0] > 1 ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => goToPage(1)} disabled={loading}>
                1
              </Button>
              <span className="px-1">...</span>
            </>
          ) : null}
          {visiblePages.map((page) => (
            <Button
              key={`${position}-${page}`}
              type="button"
              variant={page === currentPage ? "default" : "outline"}
              size="sm"
              onClick={() => goToPage(page)}
              disabled={loading || page === currentPage}
            >
              {page}
            </Button>
          ))}
          {visiblePages[visiblePages.length - 1] < totalPages ? (
            <>
              <span className="px-1">...</span>
              <Button type="button" variant="outline" size="sm" onClick={() => goToPage(totalPages)} disabled={loading}>
                {totalPages}
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={loading || currentPage >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!canView) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="ALETA Judicia"
        title="Variabel Dokumen"
        description="Registry variabel JLF untuk placeholder legacy dan modern, data SIPP read-only, data manual, fungsi, computed value, dan AI draft."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={JUDICIA_LEGAL_FORM_ROUTE}>
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            {canCreate ? (
              <Button asChild>
                <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/variables/new`}>
                  <Plus className="h-4 w-4" />
                  Tambah Variabel
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent></Card> : null}

      <Card className="border-border/80 bg-card/85 shadow-sm">
        <form onSubmit={applyFilters}>
          <CardContent className="grid gap-4 p-5 md:grid-cols-[minmax(280px,1fr)_180px_210px_150px_auto] md:items-center">
          <Input
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            placeholder="Cari key, legacy code, atau label"
            className="min-w-0"
          />
          <NativeSelect value={filters.dataType} onChange={(event) => setFilters((current) => ({ ...current, dataType: event.target.value }))}>
            <option value="">Semua data type</option>
            {dataTypes.map((item) => <option key={item} value={item}>{item}</option>)}
          </NativeSelect>
          <NativeSelect value={filters.sourceType} onChange={(event) => setFilters((current) => ({ ...current, sourceType: event.target.value }))}>
            <option value="">Semua source type</option>
            {sourceTypes.map((item) => <option key={item} value={item}>{item}</option>)}
          </NativeSelect>
          <NativeSelect
            value={pageSize}
            onChange={(event) => {
              setPageSize(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="25">25/baris</option>
            <option value="50">50/baris</option>
            <option value="100">100/baris</option>
            <option value="500">500/baris</option>
            <option value="1000">1000/baris</option>
            <option value="all">Semua</option>
          </NativeSelect>
          <Button type="submit" disabled={loading} className="min-w-[112px]">
            <RefreshCw className="h-4 w-4" />
            Terapkan
          </Button>
          </CardContent>
        </form>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Daftar Variabel</CardTitle>
          <CardDescription>
            Legacy code tetap didukung, semantic key menjadi identitas utama JLF. Menampilkan {firstVisibleRow}-{lastVisibleRow} dari {totalItems} variabel
            {pageSize === "all" ? " (mode semua, dibatasi aman oleh API)" : `, halaman ${currentPage} dari ${totalPages}`}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <JlfLoadingState />
          ) : items.length === 0 ? (
            <EmptyState title="Belum ada variabel" description="Tambahkan variabel untuk mulai memetakan placeholder template." />
          ) : (
            <div className="overflow-x-auto">
              {renderPaginationControls("top")}
              <table className="w-full min-w-[1360px] text-left text-sm">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className="w-16 px-3 py-3 font-medium">No</th>
                    <th className="w-32 px-3 py-3">{renderSortButton("No. variabel", "legacyCode")}</th>
                    <th className="px-3 py-3">{renderSortButton("Key", "key")}</th>
                    <th className="px-3 py-3">{renderSortButton("Label", "label")}</th>
                    <th className="px-3 py-3 font-medium">Mode ALETA</th>
                    <th className="px-3 py-3 font-medium">Tipe ABT</th>
                    <th className="px-3 py-3">{renderSortButton("Data type", "dataType")}</th>
                    <th className="px-3 py-3">{renderSortButton("Source type", "sourceType")}</th>
                    <th className="px-3 py-3">{renderSortButton("Data/source key", "sourceKey")}</th>
                    <th className="px-3 py-3">{renderSortButton("Status", "status")}</th>
                    <th className="px-3 py-3 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.id} className="border-b border-border/70">
                      <td className="px-3 py-4 text-muted-foreground">{currentOffset + index + 1}</td>
                      <td className="px-3 py-4">{item.legacyCode ? <Badge variant="outline">#{item.legacyCode}#</Badge> : "-"}</td>
                      <td className="px-3 py-4">
                        <p className="font-mono font-semibold text-foreground">{item.key}</p>
                        {item.queryPreview?.queryKey ? (
                          <p className="text-xs text-muted-foreground">{item.queryPreview.queryKey}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-4 text-muted-foreground">{item.label}</td>
                      <td className="px-3 py-4">
                        <Badge variant="outline">{getJlfFieldModeLabel(item.fieldMode)}</Badge>
                      </td>
                      <td className="px-3 py-4 text-muted-foreground">{getLegacyAbtTypeLabel(item.legacyAbtType)}</td>
                      <td className="px-3 py-4 text-muted-foreground">{item.dataType}</td>
                      <td className="px-3 py-4 text-muted-foreground">{item.sourceType}</td>
                      <td className="px-3 py-4">
                        <p className="font-mono text-xs text-muted-foreground">{item.sourceKey || item.queryPreview?.outputPath || "-"}</p>
                      </td>
                      <td className="px-3 py-4"><Badge variant={item.isActive ? "success" : "muted"}>{item.isActive ? "Aktif" : "Nonaktif"}</Badge></td>
                      <td className="px-3 py-4">
                        {canUpdate ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/variables/${encodeURIComponent(item.id)}/edit`}>Edit</Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Read-only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {renderPaginationControls("bottom")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VariableForm({ mode, variableId }: { mode: "new" | "edit"; variableId?: string }) {
  const { currentUser, access } = useJlfVariableAccess();
  const allowed = mode === "new"
    ? hasAccess(access, JLF_PERMISSION.VARIABLE_CREATE)
    : hasAccess(access, JLF_PERMISSION.VARIABLE_UPDATE);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [storedQueryPreview, setStoredQueryPreview] = useState<JlfVariableQueryPreview | null>(null);
  const [storedQueryFingerprint, setStoredQueryFingerprint] = useState("");
  const [sourcePreview, setSourcePreview] = useState<SourcePreviewResult | null>(null);
  const [sourcePreviewParams, setSourcePreviewParams] = useState({
    nomorPerkara: "",
    perkaraId: "",
    sidangId: "",
    sidangUrutan: "",
    caseType: "",
    limit: "5",
  });
  const [form, setForm] = useState({
    legacyCode: "",
    key: "",
    label: "",
    description: "",
    dataType: "text",
    sourceType: "jlf_manual",
    sourceKey: "",
    transformKey: "",
    fallbackValue: "",
    legacyAbtType: "",
    fieldMode: "",
    aiEnabled: false,
    manualOverrideAllowed: true,
    isRequired: "false",
    isActive: "true",
    exampleValue: "",
    adminNote: "",
  });
  const queryDefinitions = useMemo(() => listJlfSippQueryPreviewDefinitions(), []);
  const currentQueryFingerprint = `${form.sourceType}||${form.sourceKey}||${form.key}||${form.adminNote}`;
  const computedQueryPreview = useMemo(
    () =>
      resolveJlfVariableQueryPreview({
        sourceType: form.sourceType,
        sourceKey: form.sourceKey,
        key: form.key,
        adminNote: form.adminNote,
      }),
    [form.adminNote, form.key, form.sourceKey, form.sourceType]
  );
  const queryPreview =
    storedQueryPreview?.sqlPreview && storedQueryFingerprint === currentQueryFingerprint
      ? storedQueryPreview
      : computedQueryPreview;
  const resolvedLegacyAbtType = resolveLegacyAbtType({
    legacyAbtType: form.legacyAbtType,
    dataType: form.dataType,
    sourceType: form.sourceType,
    sourceKey: form.sourceKey,
    transformKey: form.transformKey,
    legacyCode: form.legacyCode,
    aiEnabled: form.aiEnabled,
  });
  const resolvedFieldMode = resolveJlfFieldMode({
    fieldMode: form.fieldMode,
    legacyAbtType: resolvedLegacyAbtType,
    dataType: form.dataType,
    sourceType: form.sourceType,
    sourceKey: form.sourceKey,
    transformKey: form.transformKey,
    legacyCode: form.legacyCode,
    aiEnabled: form.aiEnabled,
  });
  const previewBadgeVariant: "success" | "warning" | "muted" =
    queryPreview.status === "registered" ? "success" : queryPreview.status === "needs_review" ? "warning" : "muted";
  const canPreviewSource =
    queryPreview.selectOnly &&
    (Boolean(queryPreview.queryKey) ||
      (Boolean(queryPreview.sqlPreview?.trim()) && (form.sourceType === "abt_sql" || resolvedLegacyAbtType === "data_sql")));

  useEffect(() => {
    if (mode !== "edit" || !variableId || !allowed) return;
    const timer = window.setTimeout(() => {
      void fetch(apiPath(`/api/judicia/legal-form/variables/${encodeURIComponent(variableId)}`), {
        cache: "no-store",
        credentials: "include",
        headers: SILENT_JLF_HEADERS,
      })
        .then((response) => readApi<VariableItem>(response))
        .then((variable) => {
          setStoredQueryPreview(variable.queryPreview ?? null);
          setStoredQueryFingerprint(`${variable.sourceType}||${variable.sourceKey}||${variable.key}||${variable.adminNote}`);
          setForm({
            legacyCode: variable.legacyCode ?? "",
            key: variable.key,
            label: variable.label,
            description: variable.description,
            dataType: variable.dataType,
            sourceType: variable.sourceType,
            sourceKey: variable.sourceKey,
            transformKey: variable.transformKey,
            fallbackValue: variable.fallbackValue,
            legacyAbtType: variable.legacyAbtType,
            fieldMode: variable.fieldMode,
            aiEnabled: variable.aiEnabled,
            manualOverrideAllowed: variable.manualOverrideAllowed,
            isRequired: String(variable.isRequired),
            isActive: String(variable.isActive),
            exampleValue: variable.exampleValue,
            adminNote: variable.adminNote,
          });
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Gagal memuat variabel."));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [allowed, mode, variableId]);

  async function submit() {
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        ...form,
        isRequired: form.isRequired === "true",
        isActive: form.isActive === "true",
      };
      const result = mode === "new"
        ? await readApi<VariableItem>(
            await fetch(apiPath("/api/judicia/legal-form/variables"), {
              method: "POST",
              credentials: "include",
              headers: JSON_SILENT_JLF_HEADERS,
              body: JSON.stringify(payload),
            })
          )
        : await readApi<VariableItem>(
            await fetch(apiPath(`/api/judicia/legal-form/variables/${encodeURIComponent(variableId ?? "")}`), {
              method: "PATCH",
              credentials: "include",
              headers: JSON_SILENT_JLF_HEADERS,
              body: JSON.stringify(payload),
            })
          );

      setMessage("Variabel JLF berhasil disimpan.");
      setStoredQueryPreview(result.queryPreview ?? null);
      setStoredQueryFingerprint(`${result.sourceType}||${result.sourceKey}||${result.key}||${result.adminNote}`);
      if (mode === "new") {
        window.location.assign(apiPath(`${JUDICIA_LEGAL_FORM_ROUTE}/variables/${encodeURIComponent(result.id)}/edit`));
      } else {
        window.location.assign(apiPath(`${JUDICIA_LEGAL_FORM_ROUTE}/variables`));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan variabel JLF.");
    } finally {
      setBusy(false);
    }
  }

  function applyRegisteredQuery(queryKey: string) {
    const definition = queryDefinitions.find((item) => item.queryKey === queryKey);
    if (!definition) return;
    setSourcePreview(null);
    setForm((current) => ({
      ...current,
      sourceType: sourceTypeFromQueryKey(queryKey),
      sourceKey: definition.outputPath,
    }));
  }

  async function previewSourceData() {
    if (!canPreviewSource) {
      setMessage("Pilih query key terdaftar atau variabel ABT SQL tersimpan sebelum preview hasil.");
      return;
    }
    setBusy(true);
    setMessage("");
    setSourcePreview(null);
    try {
      const result = await readApi<SourcePreviewResult>(
        await fetch(apiPath("/api/judicia/legal-form/source-preview"), {
          method: "POST",
          credentials: "include",
          headers: JSON_SILENT_JLF_HEADERS,
          body: JSON.stringify({
            variableId,
            queryKey: queryPreview.queryKey ?? undefined,
            sourceType: form.sourceType,
            sourceKey: form.sourceKey,
            legacyAbtType: resolvedLegacyAbtType,
            variableKey: form.key,
            adminNote: form.adminNote,
            sqlPreview: mode === "new" && form.sourceType === "abt_sql" ? queryPreview.sqlPreview : undefined,
            limit: Number(sourcePreviewParams.limit) || 5,
            params: {
              nomorPerkara: sourcePreviewParams.nomorPerkara,
              perkaraId: sourcePreviewParams.perkaraId,
              sidangId: sourcePreviewParams.sidangId,
              sidangUrutan: sourcePreviewParams.sidangUrutan,
              sidang_urutan: sourcePreviewParams.sidangUrutan,
              urutan: sourcePreviewParams.sidangUrutan,
              caseType: sourcePreviewParams.caseType,
              jenisPerkara: sourcePreviewParams.caseType,
              alurPerkara: sourcePreviewParams.caseType,
            },
          }),
        })
      );
      setSourcePreview(result);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Preview hasil sumber data belum berhasil.");
    } finally {
      setBusy(false);
    }
  }

  if (!currentUser) return <JlfLoadingState />;
  if (!allowed) return <AccessDeniedCard />;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Variabel Dokumen"
        title={mode === "new" ? "Tambah Variabel" : "Edit Variabel"}
        description="Registry variabel menjadi sumber mapping untuk placeholder legacy dan modern."
        actions={
          <Button asChild variant="outline">
            <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/variables`}>
              <ArrowLeft className="h-4 w-4" />
              Variabel
            </Link>
          </Button>
        }
      />

      {message ? <Card className="border-border/80"><CardContent className="p-4 text-sm text-muted-foreground">{message}</CardContent></Card> : null}

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Data Variabel</CardTitle>
          <CardDescription>Jangan masukkan raw SQL. Source key hanya metadata resolver yang akan diikat ke adapter aman.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Input value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))} placeholder="semantic_key" />
          <Input value={form.legacyCode} onChange={(event) => setForm((current) => ({ ...current, legacyCode: event.target.value }))} placeholder="Legacy code, contoh 0001" />
          <Input value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="Label variabel" />
          <NativeSelect value={form.dataType} onChange={(event) => setForm((current) => ({ ...current, dataType: event.target.value }))}>
            {dataTypes.map((item) => <option key={item} value={item}>{item}</option>)}
          </NativeSelect>
          <NativeSelect value={form.sourceType} onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value }))}>
            {sourceTypes.map((item) => <option key={item} value={item}>{item}</option>)}
          </NativeSelect>
          <Input value={form.sourceKey} onChange={(event) => setForm((current) => ({ ...current, sourceKey: event.target.value }))} placeholder="Source key aman" />
          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-medium text-foreground">Query key terdaftar</span>
            <NativeSelect value={queryPreview.queryKey ?? ""} onChange={(event) => applyRegisteredQuery(event.target.value)}>
              <option value="">Deteksi otomatis dari source type/source key</option>
              {queryDefinitions.filter((item) => item.queryKey).map((item) => (
                <option key={item.queryKey ?? item.title} value={item.queryKey ?? ""}>
                  {item.queryKey} - {item.title}
                </option>
              ))}
            </NativeSelect>
          </label>
          <Input value={form.transformKey} onChange={(event) => setForm((current) => ({ ...current, transformKey: event.target.value }))} placeholder="Transform key opsional" />
          <Input value={form.fallbackValue} onChange={(event) => setForm((current) => ({ ...current, fallbackValue: event.target.value }))} placeholder="Fallback value" />
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Tipe ABT</span>
            <NativeSelect value={form.legacyAbtType} onChange={(event) => setForm((current) => ({ ...current, legacyAbtType: event.target.value }))}>
              <option value="">Otomatis: {getLegacyAbtTypeLabel(resolvedLegacyAbtType)}</option>
              {JLF_LEGACY_ABT_TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </NativeSelect>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-foreground">Mode Field ALETA</span>
            <NativeSelect value={form.fieldMode} onChange={(event) => setForm((current) => ({ ...current, fieldMode: event.target.value }))}>
              <option value="">Otomatis: {getJlfFieldModeLabel(resolvedFieldMode)}</option>
              {JLF_FIELD_MODE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </NativeSelect>
          </label>
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">AI Assist Field</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Default mati. AI hanya memberi saran, nilai final tetap diedit manusia.</p>
              </div>
              <Switch checked={form.aiEnabled} onCheckedChange={(checked) => setForm((current) => ({ ...current, aiEnabled: checked }))} />
            </div>
          </div>
          <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Edit Manual Final</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Aktif agar hasil otomatis dari SIPP/fungsi tetap bisa dioverride per perkara.</p>
              </div>
              <Switch checked={form.manualOverrideAllowed} onCheckedChange={(checked) => setForm((current) => ({ ...current, manualOverrideAllowed: checked }))} />
            </div>
          </div>
          <NativeSelect value={form.isRequired} onChange={(event) => setForm((current) => ({ ...current, isRequired: event.target.value }))}>
            <option value="false">Opsional</option>
            <option value="true">Wajib</option>
          </NativeSelect>
          <NativeSelect value={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value }))}>
            <option value="true">Aktif</option>
            <option value="false">Nonaktif</option>
          </NativeSelect>
          <Input value={form.exampleValue} onChange={(event) => setForm((current) => ({ ...current, exampleValue: event.target.value }))} placeholder="Contoh nilai" />
          <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Deskripsi" />
          <Textarea value={form.adminNote} onChange={(event) => setForm((current) => ({ ...current, adminNote: event.target.value }))} placeholder="Catatan admin" className="md:col-span-2" />
          <div className="md:col-span-2 rounded-2xl border border-border/80 bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <p className="font-semibold text-foreground">Preview Query / Resolver</p>
                </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  SQL di bawah adalah preview tersimpan/generator query registry read-only. Client tetap tidak boleh mengirim raw SQL, dan eksekusi SIPP hanya lewat adapter aman.
                </p>
              </div>
              <Badge variant={previewBadgeVariant}>{queryPreview.status}</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Query key</p>
                <p className="mt-1 break-all font-mono text-sm text-foreground">{queryPreview.queryKey ?? "-"}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Data/output path</p>
                <p className="mt-1 break-all font-mono text-sm text-foreground">{queryPreview.outputPath}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/60 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Parameter</p>
                <p className="mt-1 break-all font-mono text-sm text-foreground">
                  {queryPreview.allowedParams.length ? queryPreview.allowedParams.join(", ") : "-"}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-6">
              <Input
                value={sourcePreviewParams.nomorPerkara}
                onChange={(event) => setSourcePreviewParams((current) => ({ ...current, nomorPerkara: event.target.value }))}
                placeholder="Nomor perkara sampel"
              />
              <NativeSelect
                value={sourcePreviewParams.caseType}
                onChange={(event) => setSourcePreviewParams((current) => ({ ...current, caseType: event.target.value }))}
              >
                <option value="">Jenis/alur perkara</option>
                {JLF_CASE_TYPE_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => (
                      <option key={`${group.label}-${option.value}`} value={option.value}>{option.label}</option>
                    ))}
                  </optgroup>
                ))}
              </NativeSelect>
              <Input
                value={sourcePreviewParams.perkaraId}
                onChange={(event) => setSourcePreviewParams((current) => ({ ...current, perkaraId: event.target.value }))}
                placeholder="Perkara ID opsional"
              />
              <Input
                value={sourcePreviewParams.sidangId}
                onChange={(event) => setSourcePreviewParams((current) => ({ ...current, sidangId: event.target.value }))}
                placeholder="Sidang ID opsional"
              />
              <Input
                value={sourcePreviewParams.sidangUrutan}
                onChange={(event) => setSourcePreviewParams((current) => ({ ...current, sidangUrutan: event.target.value }))}
                placeholder="Urutan sidang"
              />
              <Button type="button" variant="outline" disabled={busy || !canPreviewSource} onClick={previewSourceData}>
                <RefreshCw className="h-4 w-4" />
                Preview Hasil
              </Button>
            </div>
            <div className="mt-4 rounded-xl border border-border/70 bg-background/60 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{queryPreview.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{queryPreview.description}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant={queryPreview.selectOnly ? "success" : "danger"}>
                  {queryPreview.selectOnly ? "SELECT-only" : "Diblokir"}
                </Badge>
                <Badge variant={queryPreview.readOnly ? "success" : "warning"}>
                  {queryPreview.readOnly ? "Read-only" : "Perlu review"}
                </Badge>
              </div>
              {storedQueryPreview?.sqlPreview && storedQueryFingerprint === currentQueryFingerprint ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Menggunakan preview SQL yang tersimpan di database untuk variabel ini. Ubah source type/source key lalu simpan untuk membuat ulang preview.
                </p>
              ) : null}
              {queryPreview.sqlPreview ? (
                <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-border/70 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                  <code>{queryPreview.sqlPreview}</code>
                </pre>
              ) : (
                <p className="mt-3 rounded-lg border border-border/70 bg-muted/30 p-3 text-sm text-muted-foreground">
                  Tidak ada SQL SIPP untuk source type ini. Resolver akan memakai data manual, BAS, QR, static, computed, atau AI sesuai konfigurasi.
                </p>
              )}
            </div>
            {sourcePreview ? (
              <div className="mt-4 rounded-xl border border-border/70 bg-card/60 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview hasil adapter</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Provider {sourcePreview.provider}, {sourcePreview.rowCount} baris, raw SQL endpoint {sourcePreview.rawSqlEndpoint ? "ada" : "tidak ada"}.
                      {sourcePreview.queryHash ? ` Hash ${sourcePreview.queryHash.slice(0, 12)}.` : ""}
                    </p>
                  </div>
                  <Badge variant={sourcePreview.selectOnly ? "success" : "danger"}>{sourcePreview.selectOnly ? "Aman" : "Diblokir"}</Badge>
                </div>
                {sourcePreview.mappedValues.length || Object.prototype.hasOwnProperty.call(sourcePreview, "sqlValue") ? (
                  <div className="mt-3 rounded-lg border border-border/70 bg-muted/40 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contoh hasil variabel</p>
                    <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap text-xs">
                      {sourcePreview.mappedValues.length
                        ? sourcePreview.mappedValues.map(stringifyPreviewValue).join("\n")
                        : stringifyPreviewValue(sourcePreview.sqlValue) || "-"}
                    </pre>
                  </div>
                ) : null}
                <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-border/70 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                  {stringifyPreviewValue(sourcePreview.rows)}
                </pre>
              </div>
            ) : null}
            <ul className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground">
              {queryPreview.safetyNotes.map((note) => (
                <li key={note}>- {note}</li>
              ))}
            </ul>
          </div>
          <Button type="button" disabled={busy || !form.key.trim() || !form.label.trim()} onClick={submit} className="md:col-span-2">
            <Save className="h-4 w-4" />
            Simpan Variabel
          </Button>
        </CardContent>
      </Card>

      {mode === "edit" ? (
        <Card className="border-border/80">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Dasar Hukum Variabel</CardTitle>
                <CardDescription>Relasikan variabel dengan peraturan/pasal untuk validasi kelengkapan dan audit AI.</CardDescription>
              </div>
              <Button asChild variant="outline">
                <Link href={`${JUDICIA_LEGAL_FORM_ROUTE}/regulations`}>
                  <Scale className="h-4 w-4" />
                  Buka Legal KB
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            API relasi variabel-peraturan tersedia untuk variabel ini. Mapping tidak disimpan otomatis oleh AI tanpa persetujuan admin.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export function JlfVariableNewPage() {
  return <VariableForm mode="new" />;
}

export function JlfVariableEditPage({ variableId }: { variableId: string }) {
  return <VariableForm mode="edit" variableId={variableId} />;
}
