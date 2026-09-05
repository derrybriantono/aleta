"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Database, FileUp, PlugZap, RefreshCw, Search, ShieldCheck, Wand2 } from "lucide-react";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { message?: string };
};

type AdminSummary = {
  metadataStatus: string;
  counts: {
    tables: number;
    columns: number;
    relations: number;
    queries: number;
    variables: number;
    assessmentIndicators: number;
    importJobs: number;
  };
  datasource: {
    mode: string;
    label: string;
    source: string;
    productionReady: boolean;
    connectionKey: string;
    bridgeBaseUrl: string;
    tokenConfigured: boolean;
    sqlDumpPath: string;
  };
  lastImport?: {
    status: string;
    import_type: string;
    source_path: string;
    finished_at: string | null;
    error_message: string | null;
  } | null;
};

type AnalyzeBatchResult = {
  total: number;
  nextOffset: number;
  processed: number;
  failed: number;
  needsReview: number;
  finished: boolean;
  continueToken: string | null;
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error?.message ?? "Request admin ALETA x SIPP gagal.");
  }
  return payload?.data as T;
}

function statusVariant(status: string) {
  if (["READY", "SUCCESS", "success"].includes(status)) return "success";
  if (["BELUM_IMPORT_METADATA", "RUNNING", "NEEDS_REVIEW", "failed"].includes(status)) return "warning";
  if (["FAILED"].includes(status)) return "danger";
  return "outline";
}

export default function AletaSippAdminPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"import" | "live" | "test" | "analyze" | "refresh" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [analyzeProgress, setAnalyzeProgress] = useState("");

  const loadSummary = useCallback(async () => {
    setAction((current) => current || "refresh");
    try {
      const data = await fetch(apiPath("/api/aleta-sipp/summary"), {
        cache: "no-store",
        credentials: "include",
      }).then((response) => readApi<AdminSummary>(response));
      setSummary(data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memuat status ALETA x SIPP.");
    } finally {
      setLoading(false);
      setAction((current) => (current === "refresh" ? "" : current));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(apiPath("/api/aleta-sipp/summary"), {
      cache: "no-store",
      credentials: "include",
    })
      .then((response) => readApi<AdminSummary>(response))
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setError("");
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Gagal memuat status ALETA x SIPP.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function runImport() {
    setAction("import");
    setMessage("");
    setError("");
    try {
      const result = await fetch(apiPath("/api/aleta-sipp/import/sql-dump"), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }).then((response) => readApi<{ tableCount: number; columnCount: number; relationCount: number; status: string }>(response));
      setMessage(`Import ${result.status}: ${result.tableCount} tabel, ${result.columnCount} kolom, ${result.relationCount} relasi.`);
      await loadSummary();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Import struktur SQL gagal.");
    } finally {
      setAction("");
    }
  }

  async function runLiveSync() {
    setAction("live");
    setMessage("");
    setError("");
    try {
      const result = await fetch(apiPath("/api/aleta-sipp/import/live-schema"), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
      }).then((response) =>
        readApi<{
          jumlahTabel: number;
          jumlahView: number;
          jumlahKolom: number;
          tabelBaru: number;
          tabelDiperbarui: number;
          tabelTidakAktif: string[];
        }>(response)
      );
      const tidakAktif = result.tabelTidakAktif.length
        ? ` ${result.tabelTidakAktif.length} tabel lama ditandai tidak aktif.`
        : "";
      setMessage(
        `Selaras dengan SIPP: ${result.jumlahTabel} tabel, ${result.jumlahView} view, ` +
          `${result.jumlahKolom} kolom (${result.tabelBaru} baru, ${result.tabelDiperbarui} disegarkan).${tidakAktif}`
      );
      await loadSummary();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sinkronisasi struktur SIPP gagal.");
    } finally {
      setAction("");
    }
  }

  async function runDatasourceTest() {
    setAction("test");
    setMessage("");
    setError("");
    try {
      const result = await fetch(apiPath("/api/aleta-sipp/datasource/test"), {
        method: "POST",
        cache: "no-store",
        credentials: "include",
      }).then((response) => readApi<{ status: string; error?: string; durationMs?: number | null }>(response));
      setMessage(result.status === "success" ? `Datasource OK (${result.durationMs ?? 0} ms).` : `Datasource gagal: ${result.error || "tidak diketahui"}`);
      await loadSummary();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Test datasource gagal.");
    } finally {
      setAction("");
    }
  }

  async function runAnalyzeDictionary() {
    setAction("analyze");
    setMessage("");
    setError("");
    setAnalyzeProgress("Menyiapkan analisis kamus database...");
    try {
      let continueToken: string | null = null;
      let finished = false;
      do {
        const result: AnalyzeBatchResult = await fetch(apiPath("/api/aleta-sipp/admin/dictionary/analyze-all"), {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ batchSize: 50, continueToken }),
        }).then((response) =>
          readApi<AnalyzeBatchResult>(response)
        );
        continueToken = result.continueToken;
        finished = result.finished;
        setAnalyzeProgress(
          `Analisis: ${Math.min(result.nextOffset, result.total)} / ${result.total} tabel. Batch terakhir ${result.processed} tabel, ${result.failed} gagal, ${result.needsReview} perlu review.`
        );
      } while (!finished && continueToken);
      setMessage("Analisis semua tabel Kamus Database selesai.");
      await loadSummary();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analisis kamus database gagal.");
    } finally {
      setAction("");
    }
  }

  const busy = Boolean(action);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Admin ALETA x SIPP"
        title="Pengaturan ALETA x SIPP"
        description="Import metadata manual, status datasource, registry aman, dan cache penilaian SIPP."
        actions={
          <Button asChild variant="outline">
            <Link href={apiPath("/aleta-sipp")}>Buka Dashboard</Link>
          </Button>
        }
      />

      {loading ? (
        <Card className="border-border/80">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Memuat status admin ALETA x SIPP.
          </CardContent>
        </Card>
      ) : null}

      {message ? (
        <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <CardContent className="p-4 text-sm text-emerald-800 dark:text-emerald-300">{message}</CardContent>
        </Card>
      ) : null}

      {analyzeProgress ? (
        <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <CardContent className="p-4 text-sm text-emerald-800 dark:text-emerald-300">{analyzeProgress}</CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/30">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      ) : null}

      {summary ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="border-border/80">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <Database className="h-5 w-5 text-primary" />
                <Badge variant={statusVariant(summary.metadataStatus)}>{summary.metadataStatus}</Badge>
              </div>
              <CardTitle className="text-lg">Import Struktur Database</CardTitle>
              <CardDescription>Parser SQL dump local/testing, lalu simpan metadata ke tabel ALETA.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {summary.counts.tables} tabel, {summary.counts.columns} kolom, {summary.counts.relations} relasi.
              </div>
              <Button className="w-full" onClick={runLiveSync} disabled={busy}>
                {action === "live" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                Selaraskan dari SIPP
              </Button>
              <p className="text-xs text-muted-foreground">
                Membaca struktur SIPP yang sedang berjalan lewat ALETA Bot. Hanya nama tabel, kolom,
                tipe, dan komentar &mdash; tidak ada data perkara yang dibaca. Penjelasan yang sudah
                Anda tulis tidak ditimpa.
              </p>
              <Button className="w-full" variant="outline" onClick={runImport} disabled={busy}>
                {action === "import" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                Import dari berkas SQL
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <Wand2 className="h-5 w-5 text-primary" />
                <Badge variant="outline">Batch</Badge>
              </div>
              <CardTitle className="text-lg">Lengkapi Kamus Database</CardTitle>
              <CardDescription>Analisis semua tabel dari metadata ALETA tanpa membaca database SIPP live.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm text-muted-foreground">
                Memproses batch 50 tabel agar request tidak berat.
              </div>
              <Button className="w-full" onClick={runAnalyzeDictionary} disabled={busy}>
                {action === "analyze" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Lengkapi Analisis
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <PlugZap className="h-5 w-5 text-primary" />
                <Badge variant={summary.datasource.productionReady ? "success" : "warning"}>{summary.datasource.mode}</Badge>
              </div>
              <CardTitle className="text-lg">Datasource ALETA Bot</CardTitle>
              <CardDescription>Production memakai bridge ALETA Bot ke koneksi SIPP read-only.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="break-all text-sm text-muted-foreground">{summary.datasource.connectionKey}</p>
              <Button className="w-full" variant="outline" onClick={runDatasourceTest} disabled={busy}>
                {action === "test" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                Test Koneksi
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <Search className="h-5 w-5 text-primary" />
                <Badge variant="success">Read-only</Badge>
              </div>
              <CardTitle className="text-lg">Query Registry</CardTitle>
              <CardDescription>Whitelist SELECT parameterized tanpa endpoint raw SQL client.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{summary.counts.queries} query tersimpan.</p>
              <Button asChild className="w-full" variant="outline">
                <Link href={apiPath("/aleta-sipp?section=query")}>Lihat Registry</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <Badge variant="warning">Review</Badge>
              </div>
              <CardTitle className="text-lg">ABT/Word/PDF Sumber Lama</CardTitle>
              <CardDescription>Import sumber lama dipisah dari dashboard dan tetap masuk review manual.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{summary.counts.variables} variabel, {summary.counts.assessmentIndicators} indikator cache.</p>
              <Button className="w-full" variant="outline" disabled>
                <FileUp className="h-4 w-4" />
                Tahap Review
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
