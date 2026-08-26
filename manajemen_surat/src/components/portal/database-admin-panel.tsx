"use client";

import {
  CheckCircle2,
  Database,
  DatabaseZap,
  Edit3,
  Eye,
  LoaderCircle,
  Play,
  RefreshCcw,
  Search,
  ShieldAlert,
  Table2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";
import { cn } from "@/lib/utils";

type DatabaseAdminColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
  protected: boolean;
};

type DatabaseAdminTable = {
  name: string;
  rowCount: number;
  primaryKeyColumns: string[];
  columns: DatabaseAdminColumn[];
};

type DatabaseAdminSnapshot = {
  database: {
    name: string | null;
    host: string | null;
    activeMode: string;
    reachable: boolean;
    checkedAt: string;
  };
  tables: DatabaseAdminTable[];
  selectedTable: DatabaseAdminTable | null;
  rows: Array<Record<string, unknown>>;
  page: number;
  pageSize: number;
  totalRows: number;
};

type QueryResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  sql: string;
  executedAt: string;
};

type EditFieldState = {
  column: DatabaseAdminColumn;
  isPrimaryKey: boolean;
  originalValue: unknown;
  value: string;
  isNull: boolean;
};

type EditState = {
  primaryKey: Record<string, unknown>;
  fields: EditFieldState[];
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function renderCellValue(value: unknown) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">NULL</span>;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function stringifyEditorValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function getValueKind(column: DatabaseAdminColumn, value: unknown) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number" || /int|numeric|decimal|double|real|float|serial|money/i.test(column.dataType)) {
    return "number";
  }
  if (value && typeof value === "object") return "json";
  if (/json|array/i.test(column.dataType)) return "json";
  if (/text/i.test(column.dataType)) return "text";
  return "string";
}

function getTableDisplayName(table: DatabaseAdminTable | null) {
  return table?.name ?? "Pilih tabel";
}

function getPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-end", totalPages] as const;
  }

  if (currentPage >= totalPages - 3) {
    return [1, "ellipsis-start", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  }

  return [1, "ellipsis-start", currentPage - 1, currentPage, currentPage + 1, "ellipsis-end", totalPages] as const;
}

function makeEditFields(table: DatabaseAdminTable, row: Record<string, unknown>): EditFieldState[] {
  return table.columns.map((column) => ({
    column,
    isPrimaryKey: table.primaryKeyColumns.includes(column.name),
    originalValue: row[column.name] ?? null,
    value: stringifyEditorValue(row[column.name]),
    isNull: row[column.name] === null || row[column.name] === undefined,
  }));
}

function normalizeComparableValue(value: unknown) {
  return JSON.stringify(value ?? null);
}

function parseEditedField(field: EditFieldState) {
  if (field.isNull) return null;

  const kind = getValueKind(field.column, field.originalValue);
  const rawValue = field.value;
  const trimmedValue = rawValue.trim();

  if (kind === "boolean") return trimmedValue === "true";
  if (kind === "number") {
    if (!trimmedValue) return null;
    const parsed = Number(trimmedValue);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Nilai kolom ${field.column.name} harus berupa angka.`);
    }
    return parsed;
  }
  if (kind === "json") {
    if (!trimmedValue) return null;
    try {
      return JSON.parse(trimmedValue) as unknown;
    } catch {
      throw new Error(`Nilai kolom ${field.column.name} harus berupa JSON yang valid.`);
    }
  }

  return rawValue;
}

function buildPatchFromEditState(editState: EditState) {
  const patch: Record<string, unknown> = {};

  for (const field of editState.fields) {
    if (field.isPrimaryKey) continue;
    const nextValue = parseEditedField(field);
    if (normalizeComparableValue(nextValue) !== normalizeComparableValue(field.originalValue)) {
      patch[field.column.name] = nextValue;
    }
  }

  return patch;
}

export function DatabaseAdminPanel() {
  const [snapshot, setSnapshot] = useState<DatabaseAdminSnapshot | null>(null);
  const [selectedTable, setSelectedTable] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [rowSearch, setRowSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [sqlText, setSqlText] = useState("SELECT * FROM users LIMIT 20");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isRunningQuery, setIsRunningQuery] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);

  const activeTableName = selectedTable || snapshot?.selectedTable?.name || "";
  const activeTable = snapshot?.selectedTable ?? null;
  const totalPages = Math.max(1, Math.ceil((snapshot?.totalRows ?? 0) / pageSize));
  const paginationItems = getPaginationItems(page, totalPages);
  const filteredTables = useMemo(() => {
    const normalized = tableSearch.trim().toLowerCase();
    const tables = snapshot?.tables ?? [];
    if (!normalized) return tables;
    return tables.filter((table) => table.name.toLowerCase().includes(normalized));
  }, [snapshot?.tables, tableSearch]);

  async function loadSnapshot(next?: {
    table?: string;
    page?: number;
    pageSize?: number;
    search?: string;
  }) {
    setIsLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      const table = next?.table ?? activeTableName;
      if (table) params.set("table", table);
      params.set("page", String(next?.page ?? page));
      params.set("pageSize", String(next?.pageSize ?? pageSize));
      const search = next?.search ?? rowSearch;
      if (search.trim()) params.set("search", search.trim());

      const response = await fetch(apiPath(`/api/admin/database?${params.toString()}`), {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: DatabaseAdminSnapshot; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(payload?.error?.message ?? "Data PostgreSQL belum dapat dibaca.");
      }

      setSnapshot(payload.data);
      setSelectedTable(payload.data.selectedTable?.name ?? "");
      setPage(payload.data.page);
      setPageSize(payload.data.pageSize);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Data PostgreSQL belum dapat dibaca.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loadInitialSnapshot = async () => {
        setIsLoading(true);
        setError("");

        try {
          const response = await fetch(apiPath("/api/admin/database?page=1&pageSize=25"), {
            credentials: "include",
            cache: "no-store",
          });
          const payload = (await response.json().catch(() => null)) as
            | { ok?: boolean; data?: DatabaseAdminSnapshot; error?: { message?: string } }
            | null;

          if (!response.ok || !payload?.ok || !payload.data) {
            throw new Error(payload?.error?.message ?? "Data PostgreSQL belum dapat dibaca.");
          }

          setSnapshot(payload.data);
          setSelectedTable(payload.data.selectedTable?.name ?? "");
          setPage(payload.data.page);
          setPageSize(payload.data.pageSize);
        } catch (loadError) {
          setError(loadError instanceof Error ? loadError.message : "Data PostgreSQL belum dapat dibaca.");
        } finally {
          setIsLoading(false);
        }
      };

      void loadInitialSnapshot();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function runQuery() {
    setIsRunningQuery(true);
    setError("");
    setFeedback("");

    try {
      const response = await fetch(apiPath("/api/admin/database"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-aleta-loading-label": "ALETA sedang menjalankan query baca...",
          "x-aleta-loading-detail": "Query dibatasi hanya SELECT dan hasil maksimal 100 baris.",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "run-query",
          sql: sqlText,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: QueryResult; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(payload?.error?.message ?? "Query belum berhasil dijalankan.");
      }

      setQueryResult(payload.data);
      setFeedback(`Query berhasil dijalankan. ${payload.data.rowCount} baris ditampilkan.`);
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Query belum berhasil dijalankan.");
    } finally {
      setIsRunningQuery(false);
    }
  }

  function openEdit(row: Record<string, unknown>) {
    if (!activeTable || activeTable.primaryKeyColumns.length === 0) return;
    const primaryKey = Object.fromEntries(activeTable.primaryKeyColumns.map((column) => [column, row[column]]));
    setEditState({
      primaryKey,
      fields: makeEditFields(activeTable, row),
    });
    setFeedback("");
    setError("");
  }

  function updateEditField(columnName: string, next: Partial<Pick<EditFieldState, "value" | "isNull">>) {
    setEditState((current) =>
      current
        ? {
            ...current,
            fields: current.fields.map((field) =>
              field.column.name === columnName
                ? {
                    ...field,
                    ...next,
                  }
                : field
            ),
          }
        : current
    );
  }

  async function saveEdit() {
    if (!activeTable || !editState) return;

    let patch: Record<string, unknown>;
    try {
      patch = buildPatchFromEditState(editState);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "Nilai edit belum valid.");
      return;
    }

    if (Object.keys(patch).length === 0) {
      setError("Belum ada nilai yang berubah.");
      return;
    }

    const confirmed = window.confirm(
      `Simpan perubahan ke tabel ${activeTable.name}? Perubahan ini langsung mengubah database PostgreSQL aktif.`
    );
    if (!confirmed) return;

    setIsSaving(true);
    setError("");
    setFeedback("");

    try {
      const response = await fetch(apiPath("/api/admin/database"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-aleta-loading-label": "ALETA sedang menyimpan perubahan database...",
          "x-aleta-loading-detail": "Perubahan baris akan dicatat di Audit Trail.",
        },
        credentials: "include",
        body: JSON.stringify({
          action: "update-row",
          tableName: activeTable.name,
          primaryKey: editState.primaryKey,
          patch,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { changes?: number; updatedColumns?: string[] }; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? "Perubahan belum berhasil disimpan.");
      }

      setEditState(null);
      setFeedback(`Perubahan tersimpan. ${payload.data?.changes ?? 0} baris diperbarui.`);
      await loadSnapshot();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Perubahan belum berhasil disimpan.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-w-0 space-y-8">
      <PageIntro
        eyebrow="Database"
        title="Database PostgreSQL"
        description="Lihat tabel PostgreSQL aktif, cek isi data, jalankan query baca, dan edit baris tertentu dari area Super Admin."
      />

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <InfoCard
          title="Nama Database"
          value={snapshot?.database.name ?? "Memeriksa..."}
          hint={snapshot?.database.host ? `Host: ${snapshot.database.host}` : "Mengikuti DATABASE_URL server aktif."}
          icon={<Database className="h-5 w-5" />}
        />
        <InfoCard
          title="Mode"
          value={snapshot?.database.activeMode === "postgres" ? "PostgreSQL utama" : "Penyimpanan cadangan"}
          hint={snapshot?.database.reachable ? "Koneksi database terjangkau." : "Koneksi utama belum terjangkau atau memakai fallback."}
          icon={<DatabaseZap className="h-5 w-5" />}
        />
        <InfoCard
          title="Jumlah Tabel"
          value={formatNumber(snapshot?.tables.length ?? 0)}
          hint="Tabel publik aplikasi ALETA."
          icon={<Table2 className="h-5 w-5" />}
        />
        <InfoCard
          title="Waktu Cek"
          value={formatDateTime(snapshot?.database.checkedAt)}
          hint="Waktu status database dibaca."
          icon={<Eye className="h-5 w-5" />}
        />
      </div>

      <Card className="border-amber-300/60 bg-amber-500/10">
        <CardContent className="flex items-start gap-3 p-4 pt-4 text-sm leading-6 text-amber-900 sm:p-5 sm:pt-5 dark:text-amber-100">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Panel ini membaca database asli.</p>
            <p>
              Query bebas hanya menerima SELECT/WITH. Edit baris hanya aktif pada tabel yang punya primary key,
              dan data yang tampil adalah data asli dari PostgreSQL untuk Super Admin.
            </p>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-rose-300/60 bg-rose-500/10">
          <CardContent className="p-4 text-sm text-rose-700 dark:text-rose-200">{error}</CardContent>
        </Card>
      ) : null}

      {feedback ? (
        <Card className="border-emerald-300/60 bg-emerald-500/10">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-emerald-800 dark:text-emerald-100">
            <CheckCircle2 className="h-5 w-5" />
            {feedback}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]">
        <Card className="flex h-[780px] min-w-0 overflow-hidden border-border/80 md:h-[840px] xl:sticky xl:top-6 xl:h-[900px] xl:max-h-[calc(100vh-96px)]">
          <div className="flex min-h-0 w-full flex-col">
            <CardHeader className="shrink-0">
              <CardTitle>Daftar Tabel</CardTitle>
              <CardDescription>Pilih tabel untuk melihat data real PostgreSQL.</CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="relative shrink-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                  placeholder="Cari nama tabel..."
                  className="pl-9"
                />
              </div>
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {filteredTables.map((table) => (
                  <button
                    key={table.name}
                    type="button"
                    onClick={() => {
                      setSelectedTable(table.name);
                      setPage(1);
                      void loadSnapshot({ table: table.name, page: 1 });
                    }}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-left transition hover:border-primary/40 hover:bg-primary/5",
                      activeTableName === table.name ? "border-primary/50 bg-primary/10" : "border-border bg-card"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{table.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatNumber(table.rowCount)} baris - {table.columns.length} kolom
                        </p>
                      </div>
                      <Badge variant={table.primaryKeyColumns.length > 0 ? "success" : "outline"}>
                        {table.primaryKeyColumns.length > 0 ? "PK" : "View"}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </div>
        </Card>

        <div className="min-w-0 space-y-6">
          <Card className="min-w-0 overflow-hidden border-border/80">
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle>{getTableDisplayName(activeTable)}</CardTitle>
                  <CardDescription>
                    {activeTable
                      ? `${formatNumber(snapshot?.totalRows ?? activeTable.rowCount)} baris pada filter saat ini.`
                      : "Pilih tabel dari daftar."}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeTable?.primaryKeyColumns.length ? (
                    <Badge variant="success">Primary key: {activeTable.primaryKeyColumns.join(", ")}</Badge>
                  ) : (
                    <Badge variant="outline">Edit mati tanpa primary key</Badge>
                  )}
                  <Button type="button" variant="outline" size="sm" disabled={isLoading} onClick={() => void loadSnapshot()}>
                    <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    Muat Ulang
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4">
              <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <Input
                  value={rowSearch}
                  onChange={(event) => setRowSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setPage(1);
                      void loadSnapshot({ page: 1, search: rowSearch });
                    }
                  }}
                  placeholder="Cari isi baris pada tabel aktif..."
                  className="min-w-0"
                />
                <select
                  value={pageSize}
                  onChange={(event) => {
                    const nextSize = Number(event.target.value);
                    setPageSize(nextSize);
                    setPage(1);
                    void loadSnapshot({ page: 1, pageSize: nextSize });
                  }}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size} baris
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => {
                    setPage(1);
                    void loadSnapshot({ page: 1, search: rowSearch });
                  }}
                >
                  {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Cari
                </Button>
              </div>

              <DataTable
                table={activeTable}
                rows={snapshot?.rows ?? []}
                onEdit={openEdit}
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Halaman {formatNumber(page)} dari {formatNumber(totalPages)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1 || isLoading}
                    onClick={() => {
                      const nextPage = Math.max(1, page - 1);
                      setPage(nextPage);
                      void loadSnapshot({ page: nextPage });
                    }}
                  >
                    Sebelumnya
                  </Button>
                  {paginationItems.map((item) =>
                    typeof item === "number" ? (
                      <Button
                        key={item}
                        type="button"
                        variant={item === page ? "default" : "outline"}
                        size="sm"
                        className="h-9 min-w-9 px-3"
                        disabled={isLoading || item === page}
                        onClick={() => {
                          setPage(item);
                          void loadSnapshot({ page: item });
                        }}
                      >
                        {formatNumber(item)}
                      </Button>
                    ) : (
                      <span key={item} className="px-1 text-sm text-muted-foreground">
                        ...
                      </span>
                    )
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages || isLoading}
                    onClick={() => {
                      const nextPage = Math.min(totalPages, page + 1);
                      setPage(nextPage);
                      void loadSnapshot({ page: nextPage });
                    }}
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden border-border/80">
            <CardHeader>
              <CardTitle>Query Baca SQL</CardTitle>
              <CardDescription>
                Untuk inspeksi cepat. Hanya SELECT/WITH, hasil maksimal 100 baris, dan dicatat di Audit Trail.
              </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4">
              <Textarea
                value={sqlText}
                onChange={(event) => setSqlText(event.target.value)}
                className="min-h-[140px] w-full font-mono text-sm"
                spellCheck={false}
              />
              <Button type="button" disabled={isRunningQuery} onClick={() => void runQuery()}>
                {isRunningQuery ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Jalankan SELECT
              </Button>
              {queryResult ? (
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline">{queryResult.rowCount} baris</Badge>
                    <Badge variant="outline">{formatDateTime(queryResult.executedAt)}</Badge>
                  </div>
                  <DataTable table={null} rows={queryResult.rows} />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      {editState && activeTable ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur">
          <Card className="w-full max-w-6xl border-border shadow-2xl">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Edit Baris: {activeTable.name}</CardTitle>
                  <CardDescription>
                    Primary key: {JSON.stringify(editState.primaryKey)}. Ubah nilai per kolom seperti editor database.
                  </CardDescription>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setEditState(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="min-w-0 space-y-4">
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="max-h-[62vh] overflow-auto">
                  <table className="w-max min-w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      <tr>
                        <th className="whitespace-nowrap px-4 py-3">Kolom</th>
                        <th className="whitespace-nowrap px-4 py-3">Tipe</th>
                        <th className="whitespace-nowrap px-4 py-3">Nilai Saat Ini</th>
                        <th className="whitespace-nowrap px-4 py-3">Nilai Baru</th>
                        <th className="whitespace-nowrap px-4 py-3">NULL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editState.fields.map((field) => (
                        <tr key={field.column.name} className="border-t border-border/70 align-top">
                          <td className="min-w-[180px] px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-foreground">{field.column.name}</span>
                              {field.isPrimaryKey ? <Badge variant="outline">PK</Badge> : null}
                            </div>
                          </td>
                          <td className="min-w-[150px] px-4 py-3 text-muted-foreground">
                            <div>{field.column.dataType}</div>
                            <div className="mt-1 text-xs">{field.column.nullable ? "Boleh NULL" : "Wajib isi"}</div>
                          </td>
                          <td className="min-w-[220px] max-w-[360px] px-4 py-3">
                            <code className="block max-h-24 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-2 text-xs text-foreground/90">
                              {renderCellValue(field.originalValue)}
                            </code>
                          </td>
                          <td className="min-w-[260px] px-4 py-3">
                            <EditValueControl
                              field={field}
                              onChange={(value) => updateEditField(field.column.name, { value })}
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                              <input
                                type="checkbox"
                                checked={field.isNull}
                                disabled={field.isPrimaryKey || !field.column.nullable}
                                onChange={(event) => updateEditField(field.column.name, { isNull: event.target.checked })}
                                className="h-4 w-4 rounded border-border accent-primary"
                              />
                              NULL
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" disabled={isSaving} onClick={() => setEditState(null)}>
                  Batal
                </Button>
                <Button type="button" disabled={isSaving} onClick={() => void saveEdit()}>
                  {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Simpan ke Database
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function InfoCard({
  title,
  value,
  hint,
  icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="border-border/80">
      <CardContent className="flex min-h-[132px] items-start gap-4 p-5 pt-5 sm:min-h-[140px] sm:p-6 sm:pt-6">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">{icon}</div>
        <div className="min-w-0 self-center py-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className="mt-2 break-words text-lg font-semibold leading-6 text-foreground">{value}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EditValueControl({
  field,
  onChange,
}: {
  field: EditFieldState;
  onChange: (value: string) => void;
}) {
  const kind = getValueKind(field.column, field.originalValue);
  const disabled = field.isPrimaryKey || field.isNull;
  const shouldUseTextarea = kind === "json" || field.value.length > 160;

  if (field.isPrimaryKey) {
    return (
      <Input
        value={field.value}
        disabled
        className="min-w-[220px] font-mono text-xs"
        aria-label={`Nilai primary key ${field.column.name}`}
      />
    );
  }

  if (kind === "boolean") {
    return (
      <select
        value={field.value === "true" ? "true" : "false"}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-[180px] rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
        aria-label={`Nilai baru ${field.column.name}`}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  if (shouldUseTextarea) {
    return (
      <Textarea
        value={field.value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 min-w-[320px] font-mono text-xs disabled:opacity-60"
        spellCheck={false}
        aria-label={`Nilai baru ${field.column.name}`}
      />
    );
  }

  return (
    <Input
      value={field.value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      inputMode={kind === "number" ? "decimal" : undefined}
      className="min-w-[240px] font-mono text-xs disabled:opacity-60"
      aria-label={`Nilai baru ${field.column.name}`}
    />
  );
}

function DataTable({
  table,
  rows,
  onEdit,
}: {
  table: DatabaseAdminTable | null;
  rows: Array<Record<string, unknown>>;
  onEdit?: (row: Record<string, unknown>) => void;
}) {
  const columns = table?.columns.map((column) => column.name) ?? (rows[0] ? Object.keys(rows[0]) : []);
  const hasEditableColumns = Boolean(
    table?.columns.some((column) => !table.primaryKeyColumns.includes(column.name))
  );
  const canEdit = Boolean(table && table.primaryKeyColumns.length > 0 && hasEditableColumns && onEdit);

  if (columns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
        Belum ada data untuk ditampilkan.
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-auto rounded-xl border border-border">
      <table className="w-max min-w-full text-left text-sm">
        <thead className="bg-muted/60 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          <tr>
            {canEdit ? <th className="whitespace-nowrap px-4 py-3">Aksi</th> : null}
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-4 py-3">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (canEdit ? 1 : 0)} className="px-4 py-6 text-muted-foreground">
                Belum ada baris pada filter ini.
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-border/70 align-top">
                {canEdit ? (
                  <td className="whitespace-nowrap px-4 py-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => onEdit?.(row)}>
                      <Edit3 className="h-4 w-4" />
                      Edit
                    </Button>
                  </td>
                ) : null}
                {columns.map((column) => (
                  <td key={column} className="min-w-[140px] max-w-[360px] px-4 py-3">
                    <code className="block max-h-24 overflow-auto whitespace-pre-wrap break-words text-xs text-foreground/90">
                      {renderCellValue(row[column])}
                    </code>
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
