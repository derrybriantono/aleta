import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { APP_VERSION, APP_VERSION_LABEL } from "@/lib/patch-notes";
import { ApiError } from "@/server/shared/errors";
import { describeNetworkError, outboundFetch } from "@/server/shared/outbound-http";

export type AletaUpdateManifest = {
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

export type AletaUpdateHistoryItem = {
  version?: string;
  previousVersion?: string;
  status?: "success" | "failed" | "rolled_back";
  appliedAt?: string;
  backupFile?: string;
  bundleFile?: string;
  message?: string;
};

export type AletaUpdateState = {
  currentVersion?: string;
  currentLabel?: string;
  previousVersion?: string;
  installedAt?: string;
  lastUpdateStatus?: "success" | "failed" | "rolled_back";
  lastUpdateMessage?: string;
  backupFile?: string;
  bundleFile?: string;
  history?: AletaUpdateHistoryItem[];
};

export type AletaUpdateStatus = {
  current: {
    version: string;
    label: string;
    installedAt: string | null;
    source: "runtime" | "state-file";
    /** Versi yang tercatat skrip update, hanya diisi bila BERBEDA dari kode berjalan. */
    scriptRecordedVersion?: string | null;
  };
  latest: AletaUpdateManifest | null;
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
  history: AletaUpdateHistoryItem[];
};

const DEFAULT_REPORT_DIR = path.join(process.cwd(), "reports");

function getStatePath() {
  return path.join(DEFAULT_REPORT_DIR, "aleta-update-state.json");
}

function getLatestManifestPath() {
  return path.join(DEFAULT_REPORT_DIR, "aleta-update-latest.json");
}

function getHistoryPath() {
  return path.join(DEFAULT_REPORT_DIR, "updates", "history.jsonl");
}

/**
 * Folder tempat paket update yang diunggah lewat web ditampung.
 *
 * Folder reports SUDAH dimount ke host (/var/www/html/aleta-data/reports),
 * jadi berkas yang ditulis di sini langsung terlihat oleh host tanpa perlu
 * memberi container akses ke folder aplikasi maupun socket Docker — keduanya
 * akan menjadikan portal jalur pengambilalihan server bila suatu saat jebol.
 */
function getUploadInboxDir() {
  return path.join(DEFAULT_REPORT_DIR, "updates", "inbox");
}

/** Batas ukuran paket. Installer penuh ~33 MB; 300 MB memberi ruang longgar. */
const MAX_UPDATE_PACKAGE_BYTES = 300 * 1024 * 1024;

export type StagedUpdatePackage = {
  fileName: string;
  sizeBytes: number;
  sha256: string;
  stagedPath: string;
  hostPath: string;
  uploadedAt: string;
  applyCommand: string;
};

/**
 * Nama berkas dibersihkan total: hanya pola nama paket resmi yang diterima.
 * Ini menutup path traversal dan nama aneh sebelum berkas menyentuh disk.
 */
function sanitizeUpdateFileName(rawName: string) {
  const nama = String(rawName || "").trim();
  if (!nama) return "";

  // Nama yang memuat pemisah folder DITOLAK, bukan dipangkas diam-diam.
  // Memangkas memang aman, tetapi "../../etc/x.tar.gz" bukan salah ketik —
  // itu percobaan keluar folder, dan lebih baik gagal terang-terangan agar
  // terlihat di log daripada diam-diam diperbaiki.
  if (nama !== path.basename(nama)) return "";
  if (/[\\/]/.test(nama)) return "";
  if (nama === "." || nama === "..") return "";

  if (!/^[A-Za-z0-9._-]+$/.test(nama)) return "";
  if (!/\.tar\.gz$/i.test(nama)) return "";
  if (nama.length > 120) return "";
  return nama;
}

export async function stageAletaUpdatePackage(input: {
  fileName: string;
  bytes: Buffer;
  expectedSha256?: string;
  actorLabel: string;
}): Promise<StagedUpdatePackage> {
  const fileName = sanitizeUpdateFileName(input.fileName);
  if (!fileName) {
    throw new ApiError(
      400,
      "Nama berkas tidak valid. Unggah paket resmi berekstensi .tar.gz tanpa spasi atau karakter khusus."
    );
  }

  const bytes = input.bytes;
  if (!bytes?.length) throw new ApiError(400, "Berkas kosong.");
  if (bytes.length > MAX_UPDATE_PACKAGE_BYTES) {
    throw new ApiError(
      413,
      `Ukuran paket ${(bytes.length / 1024 / 1024).toFixed(1)} MB melebihi batas ${MAX_UPDATE_PACKAGE_BYTES / 1024 / 1024} MB.`
    );
  }

  // Berkas gzip selalu diawali 0x1f 0x8b. Memeriksa isi, bukan sekadar nama,
  // sehingga berkas lain yang diganti namanya jadi .tar.gz langsung ditolak.
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    throw new ApiError(400, "Berkas bukan arsip .tar.gz yang sah (tanda pengenal gzip tidak ditemukan).");
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const diminta = String(input.expectedSha256 || "").trim().toLowerCase();
  if (diminta && diminta !== sha256) {
    throw new ApiError(
      400,
      "Checksum SHA256 tidak cocok. Berkas kemungkinan rusak saat diunggah atau bukan paket yang dimaksud."
    );
  }

  const inbox = getUploadInboxDir();
  await fs.mkdir(inbox, { recursive: true });
  const stagedPath = path.join(inbox, fileName);
  await fs.writeFile(stagedPath, bytes);
  await fs.writeFile(`${stagedPath}.sha256`, `${sha256}  ${fileName}\n`, "utf8");

  const uploadedAt = new Date().toISOString();
  await fs.appendFile(
    path.join(inbox, "uploads.jsonl"),
    `${JSON.stringify({ fileName, sizeBytes: bytes.length, sha256, uploadedAt, by: input.actorLabel })}\n`,
    "utf8"
  );

  const hostPath = `/var/www/html/aleta-data/reports/updates/inbox/${fileName}`;
  return {
    fileName,
    sizeBytes: bytes.length,
    sha256,
    stagedPath,
    hostPath,
    uploadedAt,
    applyCommand: `cd /var/www/html/aleta && bash scripts/aleta-update.sh ${hostPath}`,
  };
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readHistory(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AletaUpdateHistoryItem)
      .slice(-10)
      .reverse();
  } catch {
    return [];
  }
}

function parseVersionParts(version: string) {
  const [main, preRelease = ""] = version.replace(/^v/i, "").split("-", 2);
  const numbers = main.split(".").map((part) => Number.parseInt(part, 10) || 0);
  return {
    numbers: [numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0],
    preRelease,
  };
}

function compareVersions(left: string, right: string) {
  const a = parseVersionParts(left);
  const b = parseVersionParts(right);

  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) {
      return a.numbers[index] - b.numbers[index];
    }
  }

  if (a.preRelease === b.preRelease) return 0;
  if (!a.preRelease) return 1;
  if (!b.preRelease) return -1;
  return a.preRelease.localeCompare(b.preRelease, undefined, { numeric: true });
}

function isValidManifest(value: unknown): value is AletaUpdateManifest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { version?: unknown };
  return typeof candidate.version === "string" && candidate.version.trim().length > 0;
}

function getUpdateCheckTimeoutMs() {
  const timeoutMs = Number.parseInt(process.env.ALETA_UPDATE_CHECK_TIMEOUT_MS ?? "8000", 10);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000;
}

async function fetchRemoteManifest(url: string): Promise<AletaUpdateManifest | null> {
  // outboundFetch sadar proxy: server satker yang hanya boleh keluar lewat
  // proxy kantor tetap bisa mengecek update. describeNetworkError menggali
  // sebab asli di balik "fetch failed" sehingga pesan di layar berguna.
  try {
    const response = await outboundFetch(url, { cache: "no-store" }, getUpdateCheckTimeoutMs());
    if (!response.ok) {
      throw new Error(`Manifest update merespons HTTP ${response.status}.`);
    }
    const payload = (await response.json()) as unknown;
    return isValidManifest(payload) ? payload : null;
  } catch (error) {
    throw new Error(describeNetworkError(error) || (error instanceof Error ? error.message : "Manifest update gagal dibaca."));
  }
}

async function loadLatestManifest() {
  const manifestUrl = process.env.ALETA_UPDATE_MANIFEST_URL?.trim();

  if (manifestUrl && /^https?:\/\//i.test(manifestUrl)) {
    return fetchRemoteManifest(manifestUrl);
  }

  return readJsonFile<AletaUpdateManifest>(getLatestManifestPath());
}

export async function getAletaUpdateStatus(): Promise<AletaUpdateStatus> {
  const statePath = getStatePath();
  const latestManifestPath = getLatestManifestPath();
  const historyPath = getHistoryPath();
  const state = await readJsonFile<AletaUpdateState>(statePath);
  const stateHistory = Array.isArray(state?.history) ? state.history : [];
  const fileHistory = await readHistory(historyPath);
  let latest: AletaUpdateManifest | null = null;
  let lastCheckError: string | null = null;

  try {
    latest = await loadLatestManifest();
  } catch (error) {
    lastCheckError = error instanceof Error ? error.message : "Manifest update belum dapat dibaca.";
  }

  // APP_VERSION adalah kode yang BENAR-BENAR sedang berjalan, jadi itulah versi
  // terpasang yang sebenarnya. Berkas state hanya mencatat apa yang terakhir
  // dijalankan skrip update, dan bisa tertinggal (mis. update disalin manual
  // atau container dibangun ulang tanpa menjalankan skrip). Dulu state
  // didahulukan sehingga halaman menampilkan versi lama berdampingan dengan
  // label versi baru — nomor dan keterangannya tidak sinkron.
  const currentVersion = APP_VERSION;
  const stateVersion = state?.currentVersion?.trim() || "";
  const stateVersionStale = Boolean(stateVersion && stateVersion !== currentVersion);
  const latestVersion = latest?.version?.trim();
  const updateAvailable = latestVersion ? compareVersions(latestVersion, currentVersion) > 0 : false;
  const packageName = latest?.packageName || `aleta-update-${latestVersion || "VERSI"}.tar.gz`;

  return {
    current: {
      version: currentVersion,
      label: APP_VERSION_LABEL,
      installedAt: state?.installedAt ?? null,
      source: "runtime",
      // Ditampilkan hanya bila catatan skrip berbeda dari kode yang berjalan,
      // supaya operator tahu skrip update belum pernah dijalankan untuk versi ini.
      scriptRecordedVersion: stateVersionStale ? stateVersion : null,
    },
    latest,
    updateAvailable,
    checkedAt: new Date().toISOString(),
    lastCheckError,
    paths: {
      stateFile: statePath,
      latestManifestFile: latestManifestPath,
      historyFile: historyPath,
    },
    scripts: {
      makeUpdate: "scripts/aleta-make-update.sh",
      applyUpdate: "scripts/aleta-update.sh",
      rollback: "scripts/aleta-rollback.sh",
    },
    commands: {
      apply: `cd /var/www/html/aleta && bash scripts/aleta-update.sh /root/${packageName}`,
      rollback: "cd /var/www/html/aleta && bash scripts/aleta-rollback.sh",
      makePackage: `cd /var/www/html/aleta && bash scripts/aleta-make-update.sh ${APP_VERSION}`,
    },
    history: [...fileHistory, ...stateHistory].slice(0, 10),
  };
}

export type DownloadedUpdatePackage = StagedUpdatePackage & {
  version: string;
  fromUrl: string;
};

/**
 * Mengunduh paket rilis baru yang diumumkan manifest, lalu menampungnya di
 * inbox agar diterapkan lewat jalur host yang sudah ada.
 *
 * Dipakai satker yang punya akses internet: begitu ada versi lebih baru, admin
 * cukup menekan "Unduh" tanpa perlu menyalin berkas lewat SSH. Penerapannya
 * TETAP di host (skrip aleta-apply-uploaded-update.sh) dengan pemeriksaan
 * ulang — portal sengaja tidak diberi akses ke folder aplikasi maupun Docker.
 *
 * Pengaman yang tidak boleh dilewati:
 *   - checksum WAJIB ada di manifest. Kode yang akan berjalan di server tidak
 *     boleh diunduh tanpa cara memverifikasi keasliannya.
 *   - hanya diunduh bila versinya benar-benar lebih baru.
 *   - ukuran dibatasi, dan isi diperiksa (gzip), bukan sekadar namanya.
 */
export async function downloadAndStageUpdateFromManifest(input: {
  actorLabel: string;
}): Promise<DownloadedUpdatePackage> {
  let manifest: AletaUpdateManifest | null = null;
  try {
    manifest = await loadLatestManifest();
  } catch (error) {
    throw new ApiError(
      502,
      `Tidak dapat membaca informasi update: ${error instanceof Error ? error.message : "sumber update tidak terjangkau."}`
    );
  }

  if (!manifest?.version) {
    throw new ApiError(404, "Belum ada informasi update. Pastikan alamat sumber update sudah diatur.");
  }

  if (compareVersions(manifest.version, APP_VERSION) <= 0) {
    throw new ApiError(409, `Versi terpasang (${APP_VERSION}) sudah sama atau lebih baru dari ${manifest.version}.`);
  }

  const downloadUrl = String(manifest.downloadUrl || "").trim();
  if (!/^https?:\/\//i.test(downloadUrl)) {
    throw new ApiError(400, "Manifest update tidak memuat alamat unduhan (downloadUrl) yang sah.");
  }

  const expectedSha256 = String(manifest.packageSha256 || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
    // Tanpa checksum, tidak ada cara memastikan yang diunduh benar-benar rilis
    // resmi. Untuk kode yang akan dijalankan di server, itu tidak bisa ditawar.
    throw new ApiError(400, "Manifest update tidak memuat checksum SHA256 paket. Unduhan otomatis dibatalkan demi keamanan.");
  }

  const fileName = sanitizeUpdateFileName(manifest.packageName || `aleta-installer-${manifest.version}.tar.gz`);
  if (!fileName) {
    throw new ApiError(400, "Nama paket pada manifest tidak valid.");
  }

  let response: Response;
  try {
    response = await outboundFetch(downloadUrl, { cache: "no-store" }, getUpdateDownloadTimeoutMs());
  } catch (error) {
    throw new ApiError(502, `Unduhan gagal: ${describeNetworkError(error) || "sumber tidak terjangkau."}`);
  }
  if (!response.ok) {
    throw new ApiError(502, `Server unduhan merespons HTTP ${response.status}.`);
  }

  // Tolak lebih awal bila ukuran yang dilaporkan sudah melampaui batas.
  const dilaporkan = Number(response.headers.get("content-length") || 0);
  if (dilaporkan && dilaporkan > MAX_UPDATE_PACKAGE_BYTES) {
    throw new ApiError(413, `Ukuran paket ${(dilaporkan / 1024 / 1024).toFixed(1)} MB melebihi batas.`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_UPDATE_PACKAGE_BYTES) {
    throw new ApiError(413, `Ukuran paket ${(bytes.length / 1024 / 1024).toFixed(1)} MB melebihi batas.`);
  }

  // stageAletaUpdatePackage memeriksa ulang gzip + checksum sebelum menulis.
  const staged = await stageAletaUpdatePackage({
    fileName,
    bytes,
    expectedSha256,
    actorLabel: input.actorLabel,
  });

  return { ...staged, version: manifest.version, fromUrl: downloadUrl };
}

function getUpdateDownloadTimeoutMs() {
  const timeoutMs = Number.parseInt(process.env.ALETA_UPDATE_DOWNLOAD_TIMEOUT_MS ?? "120000", 10);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120000;
}
