"use client";

import { Archive, CheckCircle2, Clock3, DatabaseBackup, Download, FileArchive, PackageCheck, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { PageIntro } from "@/components/portal/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";

type BackupType = "database" | "application";

type BackupStatus = {
  type: BackupType;
  filename: string;
  sizeLabel: string;
  createdAt: string;
  appVersion: string;
  databaseCapturedAt?: string;
  databaseMode?: string;
  databaseName?: string;
};

type BackupSystemSnapshot = {
  appVersion: string;
  checkedAt: string;
  database: {
    capturedAt: string;
    activeMode: string;
    source: string;
    name: string | null;
    host: string | null;
    reachable: boolean;
  };
  permissions?: {
    canCreateDatabaseBackup: boolean;
    canCreateApplicationBackup: boolean;
  };
};

function getFilenameFromDisposition(value: string | null, fallback: string) {
  const match = value?.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? fallback;
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Belum terbaca";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Belum terbaca";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function backupCopy(type: BackupType) {
  if (type === "database") {
    return {
      label: "Backup Database",
      detail: "Membuat file SQL terkompresi berisi data ALETA dari database aktif.",
      loadingLabel: "ALETA sedang membuat backup database...",
      fallbackName: "aleta-database-backup.sql.gz",
    };
  }

  return {
    label: "Backup Aplikasi",
    detail: "Membuat arsip source aplikasi tanpa file rahasia, runtime, session, cache, dan data upload.",
    loadingLabel: "ALETA sedang membuat backup aplikasi...",
    fallbackName: "aleta-application-backup.tar.gz",
  };
}

export function BackupAdminPanel() {
  const [activeType, setActiveType] = useState<BackupType | null>(null);
  const [error, setError] = useState("");
  const [lastBackup, setLastBackup] = useState<BackupStatus | null>(null);
  const [systemSnapshot, setSystemSnapshot] = useState<BackupSystemSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      try {
        const response = await fetch(apiPath("/api/admin/backup"), {
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; data?: BackupSystemSnapshot; error?: { message?: string } }
          | null;

        if (cancelled) return;

        if (!response.ok || !payload?.ok || !payload.data) {
          throw new Error(payload?.error?.message ?? "Status backup belum dapat dibaca.");
        }

        setSystemSnapshot(payload.data);
        setSnapshotError("");
      } catch (snapshotLoadError) {
        if (!cancelled) {
          setSnapshotError(
            snapshotLoadError instanceof Error
              ? snapshotLoadError.message
              : "Status backup belum dapat dibaca."
          );
        }
      }
    };

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  const downloadBackup = async (type: BackupType) => {
    const copy = backupCopy(type);
    setActiveType(type);
    setError("");

    try {
      const response = await fetch(apiPath("/api/admin/backup"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-aleta-loading-label": copy.loadingLabel,
          "x-aleta-loading-detail": "File backup sedang disiapkan. Jangan tutup halaman sampai unduhan dimulai.",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ type }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "Backup belum berhasil dibuat.");
      }

      const blob = await response.blob();
      const filename = getFilenameFromDisposition(response.headers.get("content-disposition"), copy.fallbackName);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);

      const generatedAt = response.headers.get("x-aleta-backup-generated-at");
      const databaseCapturedAt = response.headers.get("x-aleta-database-captured-at");
      setLastBackup({
        type,
        filename,
        sizeLabel: formatBytes(blob.size),
        createdAt: formatDateTime(generatedAt ?? new Date().toISOString()),
        appVersion: response.headers.get("x-aleta-app-version") ?? systemSnapshot?.appVersion ?? "-",
        databaseCapturedAt: databaseCapturedAt ? formatDateTime(databaseCapturedAt) : undefined,
        databaseMode: response.headers.get("x-aleta-database-mode") ?? undefined,
        databaseName: response.headers.get("x-aleta-database-name") ?? undefined,
      });
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : "Backup belum berhasil dibuat.");
    } finally {
      setActiveType(null);
    }
  };

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Backup Sistem"
        title="Backup Database dan Aplikasi"
        description="Unduh salinan data dan source ALETA sebelum update, migrasi server, atau perawatan besar."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <InfoCard
          title="Versi Aplikasi"
          value={systemSnapshot ? `v${systemSnapshot.appVersion}` : "Memeriksa..."}
          hint="Versi source ALETA yang sedang aktif saat backup dibuat."
          icon={<PackageCheck className="h-5 w-5" />}
        />
        <InfoCard
          title="Tanggal Database"
          value={systemSnapshot ? formatDateTime(systemSnapshot.database.capturedAt) : "Memeriksa..."}
          hint="Waktu dari database aktif. Ini menjadi acuan tanggal data saat backup database dibuat."
          icon={<Clock3 className="h-5 w-5" />}
        />
        <InfoCard
          title="Mode Database"
          value={systemSnapshot?.database.source ?? "Memeriksa..."}
          hint={
            systemSnapshot?.database.name
              ? `${systemSnapshot.database.host ?? "host"} / ${systemSnapshot.database.name}`
              : "Menampilkan apakah memakai PostgreSQL utama atau penyimpanan cadangan."
          }
          icon={<DatabaseBackup className="h-5 w-5" />}
        />
      </div>

      {snapshotError ? (
        <Card className="border-amber-300/60 bg-amber-500/10">
          <CardContent className="p-4 text-sm text-amber-900 dark:text-amber-100">{snapshotError}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <BackupCard
          type="database"
          title="Backup Database"
          description="Berisi data pengguna, surat, disposisi, audit trail, ALETA Bot, pengaturan, OTP hash, dan data operasional lain di database aktif."
          fileLabel=".sql.gz"
          icon={<DatabaseBackup className="h-6 w-6" />}
          activeType={activeType}
          disabled={systemSnapshot?.permissions?.canCreateDatabaseBackup === false}
          disabledReason="Khusus Super Admin"
          onDownload={downloadBackup}
        />
        <BackupCard
          type="application"
          title="Backup Aplikasi"
          description="Berisi source aplikasi dan aset bawaan. File rahasia, cache build, session WhatsApp, database, upload, PDF, dan node_modules tidak dimasukkan."
          fileLabel=".tar.gz"
          icon={<FileArchive className="h-6 w-6" />}
          activeType={activeType}
          disabled={systemSnapshot?.permissions?.canCreateApplicationBackup === false}
          onDownload={downloadBackup}
        />
      </div>

      {error ? (
        <Card className="border-rose-300/60 bg-rose-500/10">
          <CardContent className="p-5 text-sm text-rose-700 dark:text-rose-200">{error}</CardContent>
        </Card>
      ) : null}

      {lastBackup ? (
        <Card className="border-emerald-300/60 bg-emerald-500/10">
          <CardContent className="flex flex-col gap-3 p-5 text-sm text-emerald-800 dark:text-emerald-100 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Backup berhasil dibuat.</p>
                <p className="mt-1">
                  {lastBackup.filename} - {lastBackup.sizeLabel} - {lastBackup.createdAt}
                </p>
                <p className="mt-1">
                  Versi aplikasi: v{lastBackup.appVersion}
                  {lastBackup.databaseCapturedAt
                    ? ` - Tanggal database: ${lastBackup.databaseCapturedAt}`
                    : ""}
                  {lastBackup.databaseMode ? ` - Mode: ${lastBackup.databaseMode}` : ""}
                  {lastBackup.databaseName ? ` - Database: ${lastBackup.databaseName}` : ""}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-amber-300/50 bg-amber-500/10">
        <CardContent className="flex items-start gap-4 p-5 text-sm leading-6 text-amber-900 dark:text-amber-100">
          <ShieldCheck className="mt-1 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Simpan backup di tempat aman.</p>
            <p className="mt-1">
              Backup database berisi data sensitif kantor. Jangan kirim file backup lewat grup umum,
              dan hapus file dari komputer bersama setelah selesai dipindahkan ke media aman.
            </p>
          </div>
        </CardContent>
      </Card>
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
  icon: ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-border/80">
      <CardContent className="flex min-h-[130px] items-start gap-5 p-6">
        <div className="mt-0.5 shrink-0 rounded-2xl bg-primary/10 p-3 text-primary">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
          <p className="mt-2 break-words text-lg font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function BackupCard({
  type,
  title,
  description,
  fileLabel,
  icon,
  activeType,
  disabled = false,
  disabledReason,
  onDownload,
}: {
  type: BackupType;
  title: string;
  description: string;
  fileLabel: string;
  icon: ReactNode;
  activeType: BackupType | null;
  disabled?: boolean;
  disabledReason?: string;
  onDownload: (type: BackupType) => Promise<void>;
}) {
  const isBusy = activeType === type;

  return (
    <Card className="border-border/80">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">{icon}</div>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
            {fileLabel}
          </span>
        </div>
        <CardTitle className="pt-4">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-7 text-muted-foreground">{description}</p>
        <Button
          type="button"
          className="w-full"
          disabled={Boolean(activeType) || disabled}
          onClick={() => void onDownload(type)}
          aria-busy={isBusy}
        >
          {isBusy ? <Archive className="h-4 w-4 animate-pulse" /> : <Download className="h-4 w-4" />}
          {isBusy ? "Membuat backup..." : disabled ? disabledReason ?? "Tidak tersedia" : `Unduh ${title}`}
        </Button>
      </CardContent>
    </Card>
  );
}
