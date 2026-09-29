"use client";

import { Archive, CheckCircle2, ClipboardCopy, Database, History, PackageCheck, Puzzle, RefreshCw, RotateCcw, ServerCog, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CatatanEkstensiDaftar } from "@/components/portal/catatan-ekstensi-daftar";
import { AccessDeniedCard, PageIntro, SectionHint } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { DIRILIS_EKSTENSI_TERBARU, VERSI_EKSTENSI_TERBARU, tulisWaktuRilis } from "@/lib/catatan-ekstensi";
import { getEffectiveRoleId } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type UpdateManifest = {
  version: string;
  title?: string;
  channel?: string;
  releasedAt?: string;
  summary?: string;
  downloadUrl?: string;
  packageName?: string;
  packageSha256?: string;
  minCurrentVersion?: string;
  requiredServices?: string[];
  filesChanged?: string[];
  notes?: string[];
};

type StagedUpdatePackage = {
  fileName: string;
  sizeBytes: number;
  sha256: string;
  hostPath: string;
  uploadedAt: string;
  applyCommand: string;
};

type UpdateHistoryItem = {
  version?: string;
  previousVersion?: string;
  status?: "success" | "failed" | "rolled_back";
  appliedAt?: string;
  backupFile?: string;
  bundleFile?: string;
  message?: string;
};

type KeteranganArsip = {
  alat: { rar: boolean; "7z": boolean; xz: boolean; pg_dump: boolean };
  format: { aplikasi: string; pembaruan: string; database: string };
  rarTersedia: boolean;
  catatan: string;
};

type UpdateStatus = {
  current: {
    version: string;
    label: string;
    installedAt: string | null;
    source: "runtime" | "state-file";
    scriptRecordedVersion?: string | null;
  };
  latest: UpdateManifest | null;
  updateAvailable: boolean;
  checkedAt: string;
  lastCheckError: string | null;
  paths: {
    stateFile: string;
    latestManifestFile: string;
    historyFile: string;
  };
  scripts: {
    makeUpdate: string;
    applyUpdate: string;
    rollback: string;
  };
  commands: {
    apply: string;
    rollback: string;
    makePackage: string;
  };
  history: UpdateHistoryItem[];
};

function statusLabel(status?: UpdateHistoryItem["status"]) {
  if (status === "success") return "Berhasil";
  if (status === "failed") return "Gagal";
  if (status === "rolled_back") return "Rollback";
  return "Dicatat";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function copyToClipboard(text: string) {
  if (!navigator.clipboard) return;
  await navigator.clipboard.writeText(text);
}

function CommandBlock({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            await copyToClipboard(command);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          <ClipboardCopy className="h-4 w-4" />
          {copied ? "Tersalin" : "Salin"}
        </Button>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
        <code>{command}</code>
      </pre>
    </div>
  );
}

export default function SystemUpdatePage() {
  const { currentUser } = usePortal();
  const effectiveRoleId = getEffectiveRoleId(currentUser);
  const isAdmin = effectiveRoleId === "super-admin" || effectiveRoleId === "admin";
  const isSuperAdmin = effectiveRoleId === "super-admin";
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<StagedUpdatePackage | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [arsip, setArsip] = useState<KeteranganArsip | null>(null);
  const [sedangArsip, setSedangArsip] = useState<string | null>(null);
  const [galatArsip, setGalatArsip] = useState<string | null>(null);

  // Format yang akan dihasilkan dibaca lebih dulu, supaya tombolnya menyebut
  // ".7z" atau ".rar" SEBELUM ditekan - bukan sesudah berkasnya tiba dengan
  // nama yang tidak diduga.
  useEffect(() => {
    if (!isAdmin) return;
    let hidup = true;
    void (async () => {
      try {
        const jawaban = await fetch(apiPath("/api/admin/system-update/arsip"), { cache: "no-store" });
        if (!jawaban.ok) return;
        const isi = await jawaban.json();
        if (hidup) setArsip(isi?.data ?? isi);
      } catch {
        /* kartunya tetap tampil tanpa keterangan format */
      }
    })();
    return () => {
      hidup = false;
    };
  }, [isAdmin]);

  const unduhArsip = async (jenis: "aplikasi" | "pembaruan" | "database") => {
    setSedangArsip(jenis);
    setGalatArsip(null);
    try {
      const jawaban = await fetch(apiPath(`/api/admin/system-update/arsip?jenis=${jenis}`), {
        cache: "no-store",
      });
      if (!jawaban.ok) {
        const isi = await jawaban.json().catch(() => null);
        throw new Error(isi?.error?.message ?? `Arsip ${jenis} gagal dibuat (${jawaban.status}).`);
      }
      const nama =
        jawaban.headers.get("content-disposition")?.match(/filename="?([^"]+)"?/i)?.[1] ?? `aleta-${jenis}`;
      const blob = await jawaban.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nama;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (kesalahan) {
      setGalatArsip(kesalahan instanceof Error ? kesalahan.message : "Arsip gagal dibuat.");
    } finally {
      setSedangArsip(null);
    }
  };
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadResult, setDownloadResult] = useState<(StagedUpdatePackage & { version?: string }) | null>(null);

  async function downloadUpdate() {
    setDownloading(true);
    setDownloadError(null);
    setDownloadResult(null);
    try {
      const response = await fetch(apiPath("/api/admin/system-update/download"), {
        method: "POST",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { staged: StagedUpdatePackage & { version?: string } }; error?: { message?: string }; message?: string }
        | null;
      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(payload?.error?.message ?? payload?.message ?? "Paket pembaruan gagal diunduh.");
      }
      setDownloadResult(payload.data.staged);
    } catch (downloadException) {
      setDownloadError(downloadException instanceof Error ? downloadException.message : "Paket pembaruan gagal diunduh.");
    } finally {
      setDownloading(false);
    }
  }

  async function uploadPackage() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);
    try {
      const body = new FormData();
      body.append("file", uploadFile);
      const response = await fetch(apiPath("/api/admin/system-update/upload"), {
        method: "POST",
        credentials: "include",
        body,
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { staged: StagedUpdatePackage }; message?: string }
        | null;
      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(payload?.message ?? "Paket pembaruan gagal diunggah.");
      }
      setUploadResult(payload.data.staged);
      setUploadFile(null);
    } catch (uploadException) {
      setUploadError(uploadException instanceof Error ? uploadException.message : "Paket pembaruan gagal diunggah.");
    } finally {
      setUploading(false);
    }
  }

  const loadStatus = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(apiPath("/api/system/update-status"), {
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as
          | { ok?: boolean; data?: UpdateStatus; error?: { message?: string } }
          | null;

        if (!response.ok || !payload?.ok || !payload.data) {
          throw new Error(payload?.error?.message ?? "Status pembaruan belum dapat dibaca.");
        }

        setStatus(payload.data);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : "Status pembaruan belum dapat dibaca.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isAdmin) return;
    const timer = globalThis.setTimeout(() => {
      void loadStatus();
    }, 0);

    return () => globalThis.clearTimeout(timer);
  }, [isAdmin, loadStatus]);

  if (!isAdmin) {
    return <AccessDeniedCard />;
  }

  const updateAvailable = status?.updateAvailable ?? false;

  return (
    <div className="space-y-8">
      <PageIntro
        eyebrow="Pembaruan Sistem"
        title="Update Manager ALETA"
        description="Kontrol versi rilis, manifest update, paket pembaruan, dan rollback server Docker dalam satu area admin."
        actions={
          <Button type="button" variant="outline" onClick={() => void loadStatus()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
            Cek Ulang
          </Button>
        }
      />

      {error ? (
        <SectionHint icon="security" title="Status update belum terbaca" description={error} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/80">
          <CardHeader>
            <CardDescription>Versi Terpasang</CardDescription>
            <CardTitle className="text-2xl">{status?.current.version ?? "Memeriksa..."}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{status?.current.label ?? "Runtime sedang dibaca."}</p>
            <Badge variant="outline">Dari build aplikasi</Badge>
            {status?.current.scriptRecordedVersion ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Catatan: skrip update terakhir mencatat versi {status.current.scriptRecordedVersion}. Nomor di atas diambil
                dari kode yang benar-benar berjalan, jadi itulah yang berlaku. Perbedaan ini wajar bila update disalin manual
                atau container dibangun ulang tanpa menjalankan skrip update.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className={cn("border-border/80", updateAvailable ? "border-amber-400/60 bg-amber-500/5" : "")}>
          <CardHeader>
            <CardDescription>Update Tersedia</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              {updateAvailable ? "Ada Update" : status?.latest ? "Terbaru" : "Belum Ada Manifest"}
              {updateAvailable ? <PackageCheck className="h-5 w-5 text-amber-500" /> : <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{status?.latest?.title ?? status?.latest?.version ?? "Simpan manifest terbaru agar sistem bisa memberi pemberitahuan update."}</p>
            {status?.latest?.summary ? <p>{status.latest.summary}</p> : null}
            {status?.lastCheckError ? <p className="text-amber-600 dark:text-amber-300">{status.lastCheckError}</p> : null}

            {updateAvailable && status?.latest ? (
              <div className="space-y-2 rounded-lg border border-amber-400/50 bg-amber-500/5 p-3">
                <p className="text-foreground">
                  Versi <span className="font-semibold">{status.latest.version}</span> tersedia. Terpasang saat ini{" "}
                  <span className="font-semibold">{status.current.version}</span>.
                </p>
                <Button
                  onClick={() => void downloadUpdate()}
                  disabled={downloading}
                  data-testid="update-download-submit"
                >
                  {downloading ? "Mengunduh..." : "Unduh Paket Update"}
                </Button>
                <p className="text-xs">
                  Berkas diverifikasi (checksum SHA256) lalu ditampung di server. Penerapannya tetap dijalankan di host
                  demi keamanan — perintahnya muncul setelah unduhan selesai.
                </p>
                {downloadError ? <p className="text-xs text-destructive">{downloadError}</p> : null}
                {downloadResult ? (
                  <div className="space-y-1 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-2 text-xs text-foreground">
                    <p className="font-medium text-emerald-600 dark:text-emerald-300">
                      Paket {downloadResult.version ?? status.latest.version} berhasil diunduh dan ditampung.
                    </p>
                    <p className="break-all text-muted-foreground">{downloadResult.hostPath}</p>
                    <p className="text-muted-foreground">Terapkan di server:</p>
                    <code className="block break-all rounded bg-muted px-2 py-1">
                      cd /var/www/html/aleta &amp;&amp; bash scripts/aleta-apply-uploaded-update.sh {downloadResult.fileName}
                    </code>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardDescription>Status Rollback</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              Siap
              <RotateCcw className="h-5 w-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Backup otomatis dibuat sebelum paket update diterapkan.</p>
            <p>Terakhir dicek: {formatDateTime(status?.checkedAt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Unggah paket pembaruan langsung dari halaman ini, tanpa SSH untuk
          memindahkan berkas. Penerapannya tetap dijalankan di host — lihat
          keterangan di dalam kartu. */}
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            Unggah Paket Pembaruan
          </CardTitle>
          <CardDescription>
            Kirim berkas .tar.gz langsung dari peramban. Berkas diverifikasi lalu ditampung di server, sehingga Anda tidak
            perlu menyalinnya lewat SSH.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".gz,.tar.gz,application/gzip"
              onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-muted/50 file:px-3 file:py-1.5 file:text-sm file:text-foreground"
              data-testid="update-upload-input"
            />
            <Button onClick={() => void uploadPackage()} disabled={!uploadFile || uploading} data-testid="update-upload-submit">
              {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
              {uploading ? "Mengunggah..." : "Unggah Paket"}
            </Button>
          </div>

          {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}

          {uploadResult ? (
            <div className="space-y-2 rounded-xl border border-emerald-400/40 bg-emerald-500/5 p-3">
              <p className="font-medium text-emerald-700 dark:text-emerald-300">
                Paket {uploadResult.fileName} berhasil diunggah ({(uploadResult.sizeBytes / 1024 / 1024).toFixed(1)} MB).
              </p>
              <p className="break-all text-xs text-muted-foreground">SHA256: {uploadResult.sha256}</p>
              <p className="text-xs text-muted-foreground">
                Berkas sudah diverifikasi (tanda pengenal gzip dan checksum) dan disimpan di server. Jalankan perintah berikut
                sekali di host untuk menerapkannya:
              </p>
              <div className="flex items-start gap-2">
                <code className="flex-1 break-all rounded-lg bg-muted/60 p-2 text-xs">
                  cd /var/www/html/aleta &amp;&amp; bash scripts/aleta-apply-uploaded-update.sh {uploadResult.fileName}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void navigator.clipboard.writeText(
                      `cd /var/www/html/aleta && bash scripts/aleta-apply-uploaded-update.sh ${uploadResult.fileName}`
                    )
                  }
                >
                  <ClipboardCopy className="h-4 w-4" />
                  Salin
                </Button>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-amber-300/50 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-200">
            <p className="font-medium">Kenapa penerapannya masih di host?</p>
            <p className="mt-1">
              Portal berjalan di dalam container dan sengaja tidak diberi akses ke folder aplikasi maupun Docker. Bila diberi,
              siapa pun yang menembus portal dapat menguasai seluruh server. Agar penerapan berjalan otomatis tanpa perintah
              manual, jalankan pemantau sekali saja di host:
            </p>
            <code className="mt-2 block break-all rounded-lg bg-muted/60 p-2">
              cd /var/www/html/aleta &amp;&amp; nohup bash scripts/aleta-apply-uploaded-update.sh --watch &amp;
            </code>
          </div>
        </CardContent>
      </Card>

      {/* ==================================================================
          UNDUHAN: SELURUH APLIKASI, PAKET PEMBARUAN, SELURUH BASIS DATA

          Tiga berkas yang dibutuhkan orang yang hendak memasang ALETA di
          tempat lain atau memulihkannya. Formatnya disebut sebelum ditekan,
          dan RAR hanya dijanjikan bila programnya benar-benar ada - lihat
          catatan di server/modules/backups/arsip.ts.
          ================================================================== */}
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" />
            Unduh Aplikasi, Paket Pembaruan, dan Basis Data
          </CardTitle>
          <CardDescription>
            Untuk memasang ALETA di tempat lain atau memulihkannya utuh. Dimampatkan sekuat alat yang
            terpasang di server, tanpa mengurangi satu berkas pun.
            {arsip ? <span className="mt-1 block text-foreground">{arsip.catatan}</span> : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {galatArsip ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{galatArsip}</p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
            {(
              [
                {
                  jenis: "aplikasi" as const,
                  judul: "Seluruh aplikasi",
                  keterangan:
                    "Semua berkas sumber portal dan bot, migrasi, skrip, dan dokumen. node_modules dan hasil build tidak disertakan - keduanya dibangun ulang dari lockfile yang ikut.",
                  ikon: <PackageCheck className="h-4 w-4" />,
                },
                {
                  jenis: "pembaruan" as const,
                  judul: "Paket pembaruan terbaru",
                  keterangan:
                    "Paket .tar.gz yang diterapkan scripts/aleta-update.sh - bentuk yang sama dengan hasil aleta-make-update.sh. Bila di host belum ada, disusun dari daftar isi yang sama.",
                  ikon: <RefreshCw className="h-4 w-4" />,
                },
                {
                  jenis: "database" as const,
                  judul: "Seluruh basis data",
                  keterangan:
                    "SQL polos dan format kustom pg_dump dari PostgreSQL ALETA, beserta petunjuk pemulihan. Tabel bot di MySQL SIPP disebut cara mencadangkannya.",
                  ikon: <Database className="h-4 w-4" />,
                },
              ] as const
            ).map((butir) => (
              <div key={butir.jenis} className="flex flex-col justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-4">
                <div>
                  <p className="flex items-center gap-2 font-semibold text-foreground">
                    {butir.ikon}
                    {butir.judul}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{butir.keterangan}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={sedangArsip !== null || !isSuperAdmin}
                    onClick={() => void unduhArsip(butir.jenis)}
                    data-testid={`unduh-arsip-${butir.jenis}`}
                  >
                    {sedangArsip === butir.jenis ? "Menyusun arsip..." : "Unduh"}
                  </Button>
                  {arsip ? (
                    <Badge variant="outline">.{arsip.format[butir.jenis]}</Badge>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {!isSuperAdmin ? (
            <p className="text-xs text-muted-foreground">
              Hanya Super Admin yang dapat mengunduh ketiganya - masing-masing memuat seluruh kode atau
              seluruh data satuan kerja.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Menyusun arsip basis data dapat memakan beberapa menit. Berkas dialirkan langsung ke peramban dan
              tidak disimpan di server.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ServerCog className="h-5 w-5 text-primary" />
              Perintah Server
            </CardTitle>
            <CardDescription>Pakai SSH di folder aplikasi server.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CommandBlock label="Buat paket update dari folder aplikasi" command={status?.commands.makePackage ?? "Memuat..."} />
            <CommandBlock label="Terapkan paket update di server" command={status?.commands.apply ?? "Memuat..."} />
            <CommandBlock label="Rollback ke backup terakhir" command={status?.commands.rollback ?? "Memuat..."} />
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Manifest
            </CardTitle>
            <CardDescription>Sumber notifikasi update.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              <p className="font-semibold text-foreground">File manifest lokal</p>
              <p className="break-all">{status?.paths.latestManifestFile ?? "-"}</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">State versi server</p>
              <p className="break-all">{status?.paths.stateFile ?? "-"}</p>
            </div>
            {status?.latest?.packageSha256 ? (
              <div>
                <p className="font-semibold text-foreground">SHA256 paket</p>
                <p className="break-all">{status.latest.packageSha256}</p>
              </div>
            ) : null}
            {status?.latest?.summary ? <p className="leading-6">{status.latest.summary}</p> : null}
          </CardContent>
        </Card>
      </div>

      {/* ==================================================================
          EKSTENSI SIPP - DAFTAR YANG SAMA DENGAN PATCH NOTES

          Ekstensi diperbarui terpisah dari portal dan jauh lebih sering.
          Update Manager menunjukkan versi yang tersedia beserta jam rilisnya
          dari sumber yang sama dengan halaman Patch Notes dan Integrasi
          e-Court (lib/catatan-ekstensi.ts), supaya administrator tidak pernah
          membaca dua nomor yang berbeda di dua layar.
          ================================================================== */}
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-primary" />
            Ekstensi SIPP
          </CardTitle>
          <CardDescription>
            Tersedia <span className="font-semibold text-foreground">{VERSI_EKSTENSI_TERBARU}</span>, dirilis{" "}
            {tulisWaktuRilis(DIRILIS_EKSTENSI_TERBARU)}. Berkasnya tertanam di build portal ini, jadi
            memperbarui portal berarti memperbarui ekstensi yang dapat diunduh pegawai.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CatatanEkstensiDaftar batas={5} />
        </CardContent>
      </Card>

      <Card className="border-border/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Riwayat Update
          </CardTitle>
          <CardDescription>Catatan terakhir dari script update dan rollback.</CardDescription>
        </CardHeader>
        <CardContent>
          {status?.history.length ? (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
              {status.history.map((item, index) => (
                <div key={`${item.appliedAt ?? index}-${item.version ?? "unknown"}`} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">
                      {item.previousVersion ? `${item.previousVersion} -> ` : ""}
                      {item.version ?? "Versi tidak diketahui"}
                    </p>
                    <p className="text-sm text-muted-foreground">{item.message ?? item.bundleFile ?? item.backupFile ?? "-"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    <Badge variant={item.status === "failed" ? "danger" : item.status === "success" ? "success" : "outline"}>
                      {statusLabel(item.status)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(item.appliedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Belum ada riwayat update</p>
              <p className="mt-1">Riwayat akan muncul setelah script update atau rollback dijalankan di server.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
