/**
 * Cara penyampaian satu relaas, dari sandi ket_temu milik SIPP.
 *
 * `sampai` bukan sama dengan `bertemu`: panggilan elektronik dan relaas yang
 * diterima orang serumah SAMPAI tanpa pertemuan langsung, dan keduanya sah.
 * null berarti sandinya tidak dikenali - tidak ditebak ke salah satu sisi.
 *
 * `terbaca` false berarti artinya dibaca dari keterangan relaasnya sendiri,
 * bukan dari daftar pilihan SIPP. Dugaan yang beralasan, bukan kepastian.
 */
export type CaraRelaas = {
  sandi: string;
  cara: string;
  sampai: boolean | null;
  terbaca: boolean;
};

import type { AletaBotSnapshot, AletaBotDeadLetter, AletaBotWorkerState } from "@/lib/aleta-bot-types";
import type { DataEvidenSkp, PeranEvidenSkp } from "@/lib/eviden-skp-tipe";
import type { DataSkpJabatan, JabatanSkp, KunciPeriodeSkpJabatan } from "@/lib/skp-jabatan-tipe";
import type { PermintaanRekap, RekapPetugas } from "@/lib/rekap-petugas";
import type { WaktuAntrian } from "@/lib/tiga-jarak-sidang";
import type { PembebananIkrar } from "@/lib/pembebanan-ikrar";
import { sanitizePublicErrorMessage } from "@/server/shared/error-sanitizer";
import { singgahSingkat, tandaiTulisan, ttlDariEnv } from "@/server/shared/singgah-singkat";

export type WhatsappRuntimeMode = "aleta_bot" | "legacy_portal" | "disabled";

function normalizeWhatsappRuntimeMode(value: string | undefined | null): WhatsappRuntimeMode {
  const raw = (value ?? "aleta_bot").trim().toLowerCase();
  if (raw === "legacy_portal" || raw === "disabled") return raw as WhatsappRuntimeMode;
  return "aleta_bot";
}

export function getConfiguredWhatsappRuntimeMode(): WhatsappRuntimeMode {
  return normalizeWhatsappRuntimeMode(process.env.WHATSAPP_RUNTIME_MODE);
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

export function getWhatsappRuntimeMode(): WhatsappRuntimeMode {
  const configuredMode = getConfiguredWhatsappRuntimeMode();
  if (configuredMode === "legacy_portal") return "aleta_bot";
  return configuredMode;
}

export function getWhatsappRuntimeModeDiagnostics() {
  const configuredMode = getConfiguredWhatsappRuntimeMode();
  const effectiveMode = getWhatsappRuntimeMode();
  const legacyBlocked = configuredMode === "legacy_portal" && effectiveMode !== "legacy_portal";
  return {
    configuredMode,
    effectiveMode,
    production: isProductionRuntime(),
    legacyBlocked,
    blockerMessage: legacyBlocked
      ? "WHATSAPP_RUNTIME_MODE=legacy_portal diblokir. Gunakan hanya aleta_bot sebagai gateway WhatsApp aktif."
      : "",
  };
}

function getGatewayBaseUrl(): string {
  return (
    process.env.ALETA_BOT_BASE_URL ||
    process.env.ALETA_BOT_RUNTIME_URL ||
    "http://127.0.0.1:3003"
  ).replace(/\/$/, "");
}

function getGatewayToken(): string {
  return (
    process.env.ALETA_BOT_INTERNAL_API_TOKEN ||
    process.env.ALETA_BOT_INTERNAL_TOKEN ||
    ""
  );
}

function getGatewayTimeoutMs(): number {
  return Number(process.env.ALETA_BOT_GATEWAY_TIMEOUT_MS || 8000);
}

/**
 * Batas waktu untuk pemanggilan yang MELUNCURKAN PERAMBAN di sisi bot.
 *
 * Batas bawaan 8 detik pas untuk pemanggilan yang sekadar membaca database.
 * Login e-Court bukan itu: bot menjalankan Puppeteer, membuka halaman login
 * Mahkamah Agung, menunggu jaringan tenang, lalu memotret captchanya - dan
 * batas navigasinya sendiri di sisi bot 60 detik.
 *
 * Selama portal menyerah di detik ke-8, login TIDAK PERNAH bisa berhasil,
 * berapa kali pun dicoba. Yang terlihat operator hanyalah "aleta bot tidak
 * merespons dalam 8000ms" - padahal botnya sehat dan sedang bekerja.
 */
const TIMEOUT_PERAMBAN_MS = Number(process.env.ALETA_BOT_GATEWAY_TIMEOUT_PERAMBAN_MS || 90_000);

/**
 * Batas waktu untuk konversi RTF menjadi PDF di sisi bot.
 *
 * Sedikit lebih longgar daripada batas soffice sendiri (90 detik), supaya yang
 * menyerah lebih dulu adalah soffice - dan sebabnya yang tersampaikan ke
 * petugas adalah sebab yang sesungguhnya, bukan "bot tidak menjawab".
 */
const TIMEOUT_KONVERSI_MS = Number(process.env.ALETA_BOT_GATEWAY_TIMEOUT_KONVERSI_MS || 120_000);

/** Batas waktu untuk pemanggilan yang menyentuh banyak berkas di disk. */
const TIMEOUT_BERKAS_MS = Number(process.env.ALETA_BOT_GATEWAY_TIMEOUT_BERKAS_MS || 120_000);

/**
 * Batas waktu untuk MENJALANKAN satu penilaian e-Audit.
 *
 * Batas bawaan 8 detik cocok untuk pemanggilan yang membaca satu baris. Satu
 * penilaian bukan itu: ia membaca ribuan baris SIPP, menggabung tiga sampai
 * lima tabel, lalu menyusun daftar buktinya satu per satu.
 *
 * Diukur pada satu basis data SIPP sungguhan berisi 5.554 perkara - jauh lebih
 * kecil daripada satuan kerja yang sesungguhnya:
 *
 *   BK03 beban pemanggilan jurusita   12 detik   1.298 pelaksanaan relaas
 *   LY11 papan nilai pelayanan        11 detik   sepuluh angka, sepuluh kueri
 *   MP09 pelaksanaan mediasi           8 detik
 *   MP16 kronologi perkara             7 detik   tujuh tonggak per perkara
 *
 * Dengan batas 8 detik, tiga di antaranya TIDAK PERNAH dapat berhasil -
 * berapa kali pun dicoba - dan yang terlihat pengawas hanya "aleta bot tidak
 * merespons dalam 8000ms", padahal botnya sehat dan sedang menghitung. Persis
 * kekeliruan yang sudah terjadi sekali pada login e-Court di atas.
 *
 * Enam puluh detik dipilih supaya yang menyerah lebih dulu adalah batas waktu
 * kueri di sisi bot, sehingga sebab yang sampai ke pengawas adalah sebab yang
 * sesungguhnya - kueri mana yang lambat - bukan "bot tidak menjawab".
 */
const TIMEOUT_PENILAIAN_MS = Number(process.env.ALETA_BOT_GATEWAY_TIMEOUT_PENILAIAN_MS || 60_000);

type GatewayOptions = RequestInit & {
  /** Menimpa batas waktu bawaan untuk pemanggilan ini saja. */
  timeoutMs?: number;
};

export type GatewayResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      /**
       * Status HTTP jawaban bot, bila bot SEMPAT menjawab. Tidak ada = bot
       * tidak terjangkau (koneksi ditolak, habis waktu, galat jaringan).
       */
      status?: number;
      /**
       * `kode` dari badan JSON penolakan bot (mis. "perkara_tidak_ada") - hanya
       * ada bila bot menolak dengan JSON. Halaman HTML 404 (rute belum ada di
       * bot versi lama) tidak membawanya. Pemanggil yang perlu membedakan
       * "ditolak" dari "tidak terjangkau" membaca ini, bukan teks galatnya.
       */
      kode?: string;
      /**
       * Badan JSON penolakan bot apa adanya (rincian per langkah penetapan,
       * pemegang kunci, dan sejenisnya). Tambahan: pemanggil lama mengabaikannya.
       */
      badan?: Record<string, unknown>;
    };

/**
 * POST ke bot yang HANYA membaca - tidak membatalkan singgahan singkat. Daftar
 * sengaja pendek: POST lain dianggap tulisan, sebab membatalkan tanpa perlu
 * hanya membuang satu singgahan berumur detik, sedangkan tidak membatalkan
 * tulisan yang sungguhan membuat petugas melihat data basi.
 */
const POST_BACA_SAJA = new Set(["/internal/aleta-bot/sipp/jadwal-sidang/kesiapan"]);

/** Permintaan ke bot ini tulisan? (bukan GET/HEAD dan bukan POST baca-saja) */
export function permintaanMenulis(path: string, method: string | undefined) {
  const m = String(method || "GET").toUpperCase();
  if (m === "GET" || m === "HEAD") return false;
  return !POST_BACA_SAJA.has(path.split("?")[0]);
}

async function gatewayFetch<T>(
  path: string,
  options: GatewayOptions = {}
): Promise<GatewayResult<T>> {
  const { timeoutMs, ...permintaan } = options;
  const batas = timeoutMs ?? getGatewayTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), batas);
  // Performa muat 19 Okt: tulisan lewat bot (tunda, putus, kehadiran, ...)
  // membuang singgahan jadwal SEBELUM dikirim dan SESUDAH dijawab - bacaan
  // yang berjalan di antaranya tidak disimpan (lihat singgah-singkat.ts).
  const menulis = permintaanMenulis(path, permintaan.method);
  if (menulis) tandaiTulisan();

  try {
    const url = `${getGatewayBaseUrl()}${path}`;
    const token = getGatewayToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(permintaan.headers as Record<string, string> | undefined),
    };
    if (token) headers["x-aleta-internal-token"] = token;

    const response = await fetch(url, {
      ...permintaan,
      headers,
      signal: controller.signal,
    });

    // Jawaban dibaca sebagai TEKS lebih dulu, bukan langsung JSON.
    //
    // Bila aleta_bot belum punya rute yang diminta - misalnya karena
    // containernya belum dibangun ulang setelah pembaruan - yang kembali
    // adalah halaman HTML 404, bukan JSON. response.json() akan melempar
    // "Unexpected token '<'", dan pesan itulah yang sampai ke petugas:
    // tidak menjelaskan apa pun tentang apa yang sebenarnya salah.
    const teks = await response.text();
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(teks) as Record<string, unknown>;
    } catch {
      const potongan = teks.trim().slice(0, 80).replace(/\s+/g, " ");
      const jalurBersih = path.split("?")[0];
      return {
        ok: false,
        // Tanpa `kode`: yang menjawab bukan rute bot yang dituju.
        status: response.status,
        error:
          `aleta_bot menjawab dengan ${response.status === 404 ? "halaman 404" : `HTTP ${response.status}`}, ` +
          `bukan data pada ${jalurBersih}.` +
          // Pesan lama hanya menyebut "rute belum ada, bangun ulang containernya".
          // Itu menyesatkan: penyebab yang sebenarnya terjadi justru alamat yang
          // salah tulis di portal, dan operator sempat membangun ulang container
          // berkali-kali tanpa hasil. Dua kemungkinan itu kini disebut keduanya,
          // dengan yang lebih sering lebih dulu.
          (response.status === 404
            ? ` Dua kemungkinan: (1) alamatnya salah tulis di portal — semua jalur harus diawali /internal/aleta-bot, atau (2) aleta_bot masih versi lama sehingga rutenya belum ada. Membangun ulang container hanya menolong untuk sebab kedua.`
            : "") +
          ` Jawaban: ${potongan}`,
      };
    }

    if (!response.ok || json.ok === false) {
      return {
        ok: false,
        // "alasan" ikut dibaca, bukan hanya "error"/"message".
        //
        // Rute e-Court di aleta_bot menjawab kegagalan dengan { ok:false,
        // alasan:"..." } - tanpa "error" maupun "message". Selama alasan itu
        // tidak dibaca di sini, seluruhnya dibuang dan yang sampai ke petugas
        // hanyalah "HTTP 400": tidak menjelaskan apa pun, dan tidak dapat
        // ditindaklanjuti. Sebabnya sudah dikirim bot, hanya tidak diambil.
        error: String(json.error ?? json.message ?? json.alasan ?? `HTTP ${response.status}`),
        // Status dan kode penolakan ikut dipulangkan. Tanpa keduanya, "perkara
        // tidak ada" (bot sehat, menolak) tidak dapat dibedakan pemanggil dari
        // "bot tidak dapat dihubungi" - dan petugas memeriksa bot yang sehat.
        status: response.status,
        ...(typeof json.kode === "string" && json.kode ? { kode: json.kode } : {}),
        badan: json,
      };
    }

    return { ok: true, data: json as T };
  } catch (err) {
    const errCode =
      (err as { cause?: { code?: string } })?.cause?.code ??
      (err as { code?: string })?.code;

    if (errCode === "ECONNREFUSED") {
      return {
        ok: false,
        error:
          "aleta_bot tidak dapat dihubungi (koneksi ditolak). Pastikan layanan aleta_bot berjalan.",
      };
    }

    if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
      return {
        ok: false,
        // Batas yang SUNGGUH dipakai pemanggilan ini - bukan batas bawaan.
        // Dulu selalu menyebut bawaan (8000 ms), padahal penilaian menunggu 60
        // detik dan riwayat pihak 20 detik: angka di layar tidak pernah terjadi.
        error: `aleta_bot tidak merespons dalam ${batas}ms. Periksa status layanan.`,
      };
    }

    return {
      ok: false,
      error: sanitizePublicErrorMessage(
        err instanceof Error ? err.message : "",
        "Gateway error tidak diketahui."
      ),
    };
  } finally {
    clearTimeout(timeout);
    if (menulis) tandaiTulisan();
  }
}

// ---- Response types ----

export type GatewayStatusResponse = {
  ok: boolean;
  status: string;
  sessionName: string;
  displayName: string;
  phoneNumber: string;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastError: string | null;
  lastErrorType?: string;
  qrAvailable: boolean;
  runtime: string;
  gatewayMode: string;
};

export type GatewayQrResponse = {
  ok: boolean;
  status: string;
  qr: string | null;
  generatedAt: string | null;
  message?: string;
};

export type GatewayConnectResponse = {
  ok: boolean;
  status: string;
  started?: boolean;
  qrAvailable?: boolean;
  message?: string;
};

export type GatewayEnqueueRequest = {
  sourceApp: string;
  sourceFeature: string;
  entityType?: string;
  entityId?: string;
  recipientNumber: string;
  recipientName?: string;
  message?: string;
  category?: string;
  priority?: number;
  dryRun?: boolean;
  processImmediately?: boolean;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  messageContract?: Record<string, unknown>;
  attachment?: {
    source: string;
    name?: string;
    mimeType?: string;
    kind?: string;
    required?: boolean;
    size?: number | null;
    checksum?: string;
  };
};

export type GatewayQueueProgress = {
  queueId?: number | string;
  stage?: "queued" | "sending" | "done" | "failed" | "unknown" | string;
  status?: string;
  position?: number | null;
  pendingAhead?: number | null;
  estimatedWaitMs?: number | null;
  estimatedWaitText?: string | null;
  whatsappMessageId?: string | null;
  ack?: number | string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  failedAt?: string | null;
  processedAt?: string | null;
  lastError?: string | null;
  updatedAt?: string | null;
};

export type GatewayEnqueueResponse = {
  ok: boolean;
  queueId?: number | string;
  existingQueueId?: number | string;
  duplicate?: boolean;
  status?: string;
  idempotencyKey?: string;
  queueProgress?: GatewayQueueProgress;
  error?: string;
};

export type GatewayTestRequest = {
  recipientNumber: string;
  message: string;
  dryRun?: boolean;
};

export type GatewayTestResponse = {
  ok: boolean;
  dryRun?: boolean;
  preview?: unknown;
  queueId?: number | string;
  status?: string;
  processTriggered?: boolean;
  queueProgress?: GatewayQueueProgress;
  error?: string;
};

export type GatewayQueueProgressResponse = {
  ok: boolean;
  queueProgress: GatewayQueueProgress;
  error?: string;
};

export type GatewayMessageLog = {
  id: string;
  queue_id?: string | number | null;
  idempotency_key?: string | null;
  notification_key?: string | null;
  category?: string | null;
  recipient_number?: string | null;
  recipient_name?: string | null;
  message_preview?: string | null;
  status?: string | null;
  whatsapp_message_id?: string | null;
  ack?: number | string | null;
  retry_count?: number | string | null;
  error_message?: string | null;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
  failed_at?: string | null;
  metadata_json?: string | null;
  created_at?: string | null;
};

export type GatewayMessageLogsResponse = {
  ok: boolean;
  total: number;
  logs: GatewayMessageLog[];
};

export type GatewayOnlineQueueItem = {
  nomorPerkara: string;
  majelisHakimKode: string;
  online: boolean;
  pihak1DaftarPada: string | null;
  pihak2DaftarPada: string | null;
  nomorAntrian: number | null;
};

export type GatewayOnlineQueueLog = {
  id: number | string;
  createdAt: string;
  severity: string;
  message: string;
  status: string;
  nomorPerkara: string;
  partySlot: string;
  nomorAntrian: number | null;
  resolvedBy: string;
};

export type GatewayOnlineQueueMonitorResponse = {
  ok: boolean;
  monitor: {
    connectionKey: string;
    commands: string[];
    reachable: boolean;
    error: string;
    checkedAt: string;
    totals: { sidangHariIni: number; sudahAmbilAntrian: number; pihak1: number; pihak2: number };
    items: GatewayOnlineQueueItem[];
  };
  logs: GatewayOnlineQueueLog[];
  totalLogs: number;
};

export type GatewaySippBridgeResponse<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
};

// ---- Public API ----

export async function getGatewayWhatsappStatus(): Promise<GatewayResult<GatewayStatusResponse>> {
  return gatewayFetch<GatewayStatusResponse>("/internal/aleta-bot/whatsapp/status");
}

export async function getGatewayWhatsappQr(): Promise<GatewayResult<GatewayQrResponse>> {
  return gatewayFetch<GatewayQrResponse>("/internal/aleta-bot/whatsapp/qr");
}

export async function connectGatewayWhatsapp(): Promise<GatewayResult<GatewayConnectResponse>> {
  return gatewayFetch<GatewayConnectResponse>("/internal/aleta-bot/whatsapp/connect", {
    method: "POST",
    body: JSON.stringify({ source: "manajemen_surat" }),
  });
}

export type GatewayResetResponse = {
  ok: boolean;
  status: string;
  hardReset?: boolean;
  sessionCleared?: boolean;
  qrAvailable?: boolean;
  message?: string;
};

export async function resetGatewayWhatsapp(hardReset = false): Promise<GatewayResult<GatewayResetResponse>> {
  return gatewayFetch<GatewayResetResponse>("/internal/aleta-bot/whatsapp/reset", {
    method: "POST",
    body: JSON.stringify({ hardReset }),
  });
}

export async function enqueueGatewayMessage(
  req: GatewayEnqueueRequest
): Promise<GatewayResult<GatewayEnqueueResponse>> {
  return gatewayFetch<GatewayEnqueueResponse>("/internal/aleta-bot/messages/enqueue", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function testGatewayMessage(
  req: GatewayTestRequest
): Promise<GatewayResult<GatewayTestResponse>> {
  return gatewayFetch<GatewayTestResponse>("/internal/aleta-bot/messages/test", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getGatewayQueueProgress(
  queueId: number | string
): Promise<GatewayResult<GatewayQueueProgressResponse>> {
  return gatewayFetch<GatewayQueueProgressResponse>(`/internal/aleta-bot/messages/progress/${encodeURIComponent(String(queueId))}`);
}

export async function getGatewayMessageLogs(
  options: { limit?: number } = {}
): Promise<GatewayResult<GatewayMessageLogsResponse>> {
  const params = new URLSearchParams({
    limit: String(Math.max(1, Math.min(5001, Number(options.limit || 200)))),
  });
  return gatewayFetch<GatewayMessageLogsResponse>(`/internal/aleta-bot/messages/recent?${params.toString()}`);
}

export async function getGatewayOnlineQueueMonitor(
  options: { limit?: number; logLimit?: number } = {}
): Promise<GatewayResult<GatewayOnlineQueueMonitorResponse>> {
  const params = new URLSearchParams({
    limit: String(Math.max(1, Math.min(500, Number(options.limit || 100)))),
    logLimit: String(Math.max(1, Math.min(200, Number(options.logLimit || 50)))),
  });
  return gatewayFetch<GatewayOnlineQueueMonitorResponse>(
    `/internal/aleta-bot/antrian-online/monitor?${params.toString()}`
  );
}

export type GatewayPaniteraDokumen = {
  documentKey: string;
  nomorPerkara: string;
  judulDokumen: string;
  peranPengunggah: string;
  diunggahPada: string | null;
  agenda: string;
  batasUnggah: string | null;
  batasUnggahTeks: string;
  sisaHari: number | null;
  mendesak: boolean;
};

export type GatewayPaniteraTenggat = {
  nomorPerkara: string;
  judulDokumen: string;
  agenda: string;
  batasUnggah: string | null;
  batasUnggahTeks: string;
  statusVerifikasi: string;
  sudahDiberitahukan: boolean;
  sisaHari: number | null;
};

export type GatewayPaniteraNomor = {
  nomor: string;
  namaPihak: string;
  dijawabPada?: string | null;
  ditanyaPada?: string | null;
  jumlahDitanya?: number;
};

export type GatewayPaniteraDashboard = {
  ambangMendesakHari: number;
  dibuatPada: string;
  ringkasan: {
    menungguVerifikasi: number;
    tenggatMendesak: number;
    tenggatLewat: number;
    nomorSalahAlamat: number;
    nomorBelumMenjawab: number;
  };
  menungguVerifikasi: GatewayPaniteraDokumen[];
  tenggat: GatewayPaniteraTenggat[];
  nomorSalahAlamat: GatewayPaniteraNomor[];
  nomorBelumMenjawab: GatewayPaniteraNomor[];
};

export type GatewayVerifikasiDokumen = {
  documentKey: string;
  nomorPerkara: string;
  judulDokumen: string;
  peranPengunggah: string;
  diunggahPada: string | null;
  agenda: string;
  batasUnggahTeks: string;
  adaBerkas: boolean;
  sumberUrl: string | null;
};

export type GatewayVerifikasiDaftar = {
  ok: boolean;
  alasan: string;
  hakim: { nama: string; jabatan: string } | null;
  dokumen: GatewayVerifikasiDokumen[];
};

export type GatewayVerifikasiHasil = {
  ok: boolean;
  alasan: string;
  keputusan?: string;
  nomorPerkara?: string;
  judulDokumen?: string;
};

/** Dokumen menunggu verifikasi untuk hakim yang sedang membuka portal. */
export async function getGatewayVerifikasiList(
  nama: string,
  options: { limit?: number } = {}
): Promise<GatewayResult<GatewayVerifikasiDaftar>> {
  const params = new URLSearchParams({
    nama,
    limit: String(Math.max(1, Math.min(200, Number(options.limit || 50)))),
  });
  return gatewayFetch<GatewayVerifikasiDaftar>(`/internal/aleta-bot/ecourt/verifikasi?${params.toString()}`);
}

/** Menyimpan keputusan verifikasi dari portal. */
export async function postGatewayVerifikasiDecision(payload: {
  nama: string;
  documentKey: string;
  keputusan: "valid" | "tidak_valid";
  konfirmasi: boolean;
  keterangan?: string;
}): Promise<GatewayResult<GatewayVerifikasiHasil>> {
  return gatewayFetch<GatewayVerifikasiHasil>("/internal/aleta-bot/ecourt/verifikasi", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type GatewayEcourtAturan = {
  key: string;
  label: string;
  patterns: string[];
  notify: boolean;
  audience: string;
  tenggatBerlaku: boolean;
  ringkasan: string;
  tindakan: string;
};

export type GatewayEcourtSelisih = {
  documentKey: string;
  nomorPerkara: string;
  judulDokumen: string;
  jenis: string;
  kegentingan: string;
  penjelasan: string;
  statusEcourt: string;
  statusAleta: string | null;
  namaHakim: string;
};

export type GatewayEcourtDokumen = {
  documentKey: string;
  nomorPerkara: string;
  judulDokumen: string;
  peranPengunggah: string;
  statusVerifikasi: string;
  diunggahPada: string | null;
  batasUnggahTeks: string;
  sudahDiberitahukan: boolean;
  alasanTidakDiberitahukan: string;
};

export type GatewayEcourtStatus = {
  diperiksaPada: string;
  aktif: boolean;
  sinkronisasiTerakhir: {
    dimulaiPada: string | null;
    selesaiPada: string | null;
    status: string;
    perkaraDiperiksa: number;
    dokumenTerlihat: number;
    dokumenBaru: number;
    berkasTerunduh: number;
    jumlahGalat: number;
    galatTerakhir: string;
  } | null;
  dokumen: {
    total: number;
    belumVerifikasi: number;
    sudahValid: number;
    belumDiberitahukan: number;
    sudahDiberitahukan: number;
  };
  verifikasi: {
    keputusanTersimpan: number;
    belumDiteruskan: number;
    /**
     * Keputusan tertua yang masih menunggu diteruskan ke e-Court, beserta
     * umurnya. null berarti antreannya kosong; tidak ada sama sekali berarti
     * bot versi lama yang belum mengirimkannya.
     */
    tertua?: {
      nomorPerkara: string;
      judulDokumen: string;
      namaHakim: string;
      keputusan: string;
      diputuskanPada: string;
      umurHari: number | null;
    } | null;
  };
  nomor: { terverifikasi: number; menunggu: number; ditolak: number };
  rekonsiliasi: {
    ringkasan: {
      bertentangan: number;
      penerusanGagal: number;
      diverifikasiDiLuar: number;
      belumDiteruskan: number;
    };
    selisih: GatewayEcourtSelisih[];
  } | null;
  aturan: GatewayEcourtAturan[];
};

export type GatewayEcourtRule = {
  key: string;
  label: string;
  patterns: string[];
  notify: boolean;
  audience: string;
  tenggatBerlaku: boolean;
  ringkasan: string;
  tindakan: string;
  bawaan: boolean;
};

export type GatewayEcourtSettings = {
  aktif: boolean;
  ambangMendesakHari: number;
  tanyaUlangHari: number;
  aturan: GatewayEcourtRule[];
};

type HasilSederhana = { ok: boolean; alasan?: string; kembaliKeBawaan?: boolean };

export type GatewayAgendaRule = {
  key: string;
  label: string;
  patterns: string[];
  persiapan: string[];
  h3: boolean;
  h1: boolean;
  bawaan: boolean;
};

/** Padanan agenda sidang yang dapat disunting panitera. */
export async function getGatewayAgendaSettings(): Promise<
  GatewayResult<{ ok: boolean; agenda: GatewayAgendaRule[] }>
> {
  return gatewayFetch("/internal/aleta-bot/agenda/pengaturan");
}

/** Menyimpan satu padanan agenda. */
export async function saveGatewayAgendaRule(payload: {
  key: string;
  patterns: string[];
  persiapan: string[];
  h3?: boolean;
  h1?: boolean;
  olehSiapa: string;
}): Promise<GatewayResult<{ ok: boolean; alasan?: string }>> {
  return gatewayFetch("/internal/aleta-bot/agenda/pengaturan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Menghapus padanan tambahan, atau mengembalikan agenda bawaan ke asalnya. */
export async function deleteGatewayAgendaRule(payload: {
  key: string;
  olehSiapa: string;
}): Promise<GatewayResult<{ ok: boolean; alasan?: string; kembaliKeBawaan?: boolean }>> {
  return gatewayFetch("/internal/aleta-bot/agenda/pengaturan/hapus", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type GatewayEcourtSesi = {
  sesi: { tersimpan: boolean; berlaku: boolean | null; alasan: string };
  menunggu: boolean;
};

export type GatewayEcourtMulaiLogin = {
  ok: boolean;
  alasan: string;
  captcha: string;
  formulir: {
    adaEmail: boolean;
    adaSandi: boolean;
    adaCaptcha: boolean;
    adaTombol: boolean;
    jumlahIsian: number;
  } | null;
};

/** Keadaan sesi e-Court. */
export async function getGatewayEcourtSesi(
  periksaPenuh = false,
  slot = ""
): Promise<GatewayResult<GatewayEcourtSesi & { ok: boolean }>> {
  const params = new URLSearchParams({ periksa: periksaPenuh ? "penuh" : "cepat", slot });
  // Mode "cepat" hanya membaca berkas sesi di disk. Mode "penuh" meluncurkan
  // peramban dan benar-benar membuka e-Court untuk menguji sesinya masih hidup
  // atau tidak - jadi batas waktunya harus mengikuti, bukan 8 detik.
  return gatewayFetch(`/internal/aleta-bot/ecourt/login/status?${params.toString()}`, {
    timeoutMs: periksaPenuh ? TIMEOUT_PERAMBAN_MS : undefined,
  });
}

/** Membuka halaman login e-Court dan mengambil gambar captchanya. */
export async function mulaiGatewayEcourtLogin(
  slot = ""
): Promise<GatewayResult<GatewayEcourtMulaiLogin>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/login/mulai", {
    method: "POST",
    body: JSON.stringify({ slot }),
    timeoutMs: TIMEOUT_PERAMBAN_MS,
  });
}

/**
 * Mengirimkan kredensial e-Court ke bot.
 *
 * Nilai-nilai ini TIDAK boleh dicatat di mana pun sepanjang jalurnya.
 */
export async function kirimGatewayEcourtLogin(payload: {
  email: string;
  sandi: string;
  captcha: string;
}): Promise<GatewayResult<{ ok: boolean; alasan?: string }>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/login/kirim", {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: TIMEOUT_PERAMBAN_MS,
});
}

/** Menghapus sesi e-Court tersimpan. */
export async function keluarGatewayEcourt(
  slot = ""
): Promise<GatewayResult<{ ok: boolean; alasan?: string }>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/login/keluar", {
    method: "POST",
    body: JSON.stringify({ slot }),
  });
}

export type GatewaySippKonteks = {
  ok: boolean;
  alasan: string;
  nomorPerkara: string;
  diperiksaPada: string;
  ambangMendesakHari: number;
  dokumen: Array<{
    documentKey: string;
    judulDokumen: string;
    jenisDokumen: string;
    peranPengunggah: string;
    statusVerifikasi: string;
    agenda: string;
    diunggahPada: string | null;
    batasUnggahTeks: string;
    sisaHari: number | null;
    adaPdf: boolean;
    adaWord: boolean;
    sudahDiberitahukan: boolean;
    alasanTidakDiberitahukan: string;
  }>;
  nomorPihak: Array<{
    nama: string;
    pihakKe: number | null;
    jenis: string;
    adaNomor: boolean;
    nomorSamar: string;
    statusVerifikasi: string;
  }>;
  hakim: { bolehVerifikasi: boolean; alasan: string; nama?: string };
  /**
   * Jenis perkara, kumulasi, dan kuasa hukum - dibaca dari SIPP.
   *
   * Boleh null: keterangan ini gagal-terbuka di sisi bot. Bila SIPP tidak
   * terbaca, sisa konteksnya tetap dikirim, dan penandanya sekadar tidak
   * muncul - bukan berubah menjadi "tanpa kuasa", yang keliru.
   */
  identitas: {
    nomorPerkara: string;
    ditemukan: boolean;
    jenisPerkara: string;
    jenisPerkaraLengkap: string;
    kumulasi: string[];
    adaKumulasi: boolean;
    kuasa: Array<{ nama: string; pihakKe: number; pihak: string }>;
    adaKuasa: boolean;
    kuasaPenggugat: boolean;
    kuasaTergugat: boolean;
  } | null;
  selisih: Array<{
    judulDokumen: string;
    jenis: string;
    kegentingan: string;
    penjelasan: string;
    statusAleta: string | null;
    statusEcourt: string;
  }>;
  /**
   * Penanda yang TIDAK ADA di halaman SIPP dan mengubah cara perkara ditangani.
   *
   * Boleh null: menuntut perkara_id, dan itu hanya ada bila identitasnya
   * terbaca. Gagal-terbuka - penanda adalah tambahan, dan kehilangannya tidak
   * boleh menghilangkan dokumen serta tenggat yang justru dicari petugas.
   *
   * `ghaib` bernilai null berarti BELUM DAPAT DINILAI - tidak satu pun
   * sumbernya terbaca. Itu berbeda dari false, dan membedakannya menghindari
   * menyatakan "tidak ghaib" atas perkara yang sebenarnya belum diperiksa.
   */
  penanda: {
    ghaib: boolean | null;
    sumberGhaib: string[];
    instansi: Array<{ kunci: string; label: string }>;
    perluIzinAtasan: boolean;
    mafqud: boolean;
    tundaanPanjang: number;
  } | null;
  /**
   * Sembilan keadaan lain yang SIPP simpan tetapi tidak tampilkan.
   *
   * Tiap kunci HANYA ada bila keadaannya memang berlaku - amplop yang penuh
   * kunci bernilai null memaksa tiap pembacanya memeriksa null satu per satu,
   * dan yang lupa memeriksanya akan menggambar penanda kosong.
   */
  penandaLain: {
    panjar?: { sisa: number; tanggal: string; habis: boolean; menipis: boolean };
    aktaCerai?: { tertunggak: boolean; bht: string; hari: number | null };
    /**
     * Perlawanan atas putusan verstek.
     *
     * `jumlah` hampir selalu 1. Yang lebih dari itu jarang - dan justru
     * karena jarang, ia dulu tidak pernah ketahuan: pembacanya mengambil satu
     * baris tanpa urutan, sehingga tanggal yang tergambar dapat berpindah
     * antar-pembacaan pada perkara yang sama. `sebelumnya` memuat perlawanan
     * yang lebih tua, terbaru lebih dahulu, dan kosong pada hampir seluruh
     * perkara.
     */
    verzet?: {
      ada: boolean;
      jumlah: number;
      tanggalDaftar: string;
      sidangPertama: string;
      sudahPutus: boolean;
      sebelumnya: Array<{ tanggalDaftar: string; sidangPertama: string; sudahPutus: boolean }>;
    };
    berjalanLama?: { hari: number; tanggalDaftar: string; ambang: number };
    mediasi?: { tertunda: boolean; tanggalPenunjukan: string; mediator: string; hari: number | null };
    prodeo?: { prodeo: boolean };
    delegasi?: { jumlah: number; asal: string; jenis: string; tanggalTerima: string; hari: number | null };
    rekonvensi?: { ada: boolean; tanggalDaftar: string; pihak: string };
    upayaHukum?: Array<{ kunci: string; label: string; tanggalMohon: string; hari: number | null }>;
  };
  ringkasan: {
    dokumen: number;
    menungguVerifikasi: number;
    tenggatMendesak: number;
    tenggatLewat: number;
    nomorBermasalah: number;
    selisihGenting: number;
  };
};

/**
 * Mengambil berkas dokumen dari bot sebagai data mentah.
 *
 * Dipisahkan dari gatewayFetch karena gatewayFetch mengurai jawabannya sebagai
 * JSON. Yang datang di sini adalah isi berkas PDF atau Word, dan menguraikannya
 * sebagai JSON akan merusaknya.
 */
export async function ambilBerkasGateway(
  documentKey: string,
  format: "pdf" | "word",
  /**
   * Sinyal pembatal dari pemanggil - sama seperti ambilBerkasSippGateway.
   *
   * Dulu hanya sisi SIPP yang punya, dan akibatnya penyusun ZIP tidak dapat
   * memberi batas waktu pada satu pun berkas e-Court: lingkaran e-Courtnya
   * memanggil fungsi ini tanpa AbortController karena memang tidak ada
   * tempatnya. Satu berkas e-Court yang menggantung karena itu menggantungkan
   * SELURUH permintaan melewati batas 120 detik nginx, dan yang dilihat
   * petugas bukan pesan galat melainkan unduhan yang gagal tanpa sebab.
   *
   * Sumber bawaan tombol Status Perkara adalah "semua", jadi jalur e-Court itu
   * dilewati setiap kali tombolnya ditekan - bukan jalur yang jarang.
   *
   * Pemanggil yang tidak menyebutnya kini mendapat batas bawaan 30 detik
   * (U5 9 Okt 2026): sebelumnya tanpa batas
   * sama sekali, sehingga bot yang menggantung membuat tombol Unduh menunggu
   * sampai batas nginx tanpa keterangan.
   */
  signal?: AbortSignal
): Promise<Response> {
  const params = new URLSearchParams({ documentKey, format });
  const token = getGatewayToken();
  return fetch(`${getGatewayBaseUrl()}/internal/aleta-bot/sipp/berkas?${params.toString()}`, {
    headers: token ? { "x-aleta-internal-token": token } : {},
    cache: "no-store",
    // Batas bawaan 30 detik hanya bila pemanggil tidak membawa sinyal sendiri
    // (penyusun ZIP mengatur batasnya sendiri).
    signal: signal ?? AbortSignal.timeout(30_000),
  });
}

// ---------------------------------------------------------------------------
// PENANDA EKSEPSI & REKONVENSI (butir 4, 6 Okt 2026) - lihat
// modules/aleta-ecourt/penanda-jawaban.ts dan aleta_bot penandaJawabanService.
// ---------------------------------------------------------------------------

export type BerkasJawabanAntri = {
  fileId: string;
  documentKey: string;
  format: string;
  ukuran: number;
  nomorPerkara: string;
  judul: string;
  jenis: string;
};

export type HasilBacaJawaban = {
  fileId: string;
  terbaca: boolean;
  sumber: "teks" | "ocr" | "";
  panjang: number;
  eksepsi: "ada" | "tidak" | "";
  kalimatEksepsi: string;
  rekonvensi: "ada" | "tidak" | "";
  kalimatRekonvensi: string;
  sebab: string;
  versi: number;
};

/** Berkas jawaban/duplik Tergugat yang belum dibaca; perkara `nomor` lebih dulu. */
export async function getGatewayAntrianJawaban(params: {
  nomor: string[];
  batas: number;
  versi: number;
}): Promise<GatewayResult<{ ok: boolean; berkas: BerkasJawabanAntri[] }>> {
  const kueri = new URLSearchParams({
    nomor: params.nomor.join("|"),
    batas: String(params.batas),
    versi: String(params.versi),
  });
  return gatewayFetch(`/internal/aleta-bot/sipp/penanda-jawaban/antrian?${kueri.toString()}`);
}

/** Isi satu berkas jawaban/duplik - Response mentah, sama seperti ambilBerkasGateway. */
export async function ambilBerkasJawabanGateway(fileId: string, signal?: AbortSignal): Promise<Response> {
  const token = getGatewayToken();
  return fetch(
    `${getGatewayBaseUrl()}/internal/aleta-bot/sipp/penanda-jawaban/berkas?${new URLSearchParams({ fileId }).toString()}`,
    { headers: token ? { "x-aleta-internal-token": token } : {}, cache: "no-store", signal }
  );
}

/** Hasil pembacaan, per berkas, untuk disinggahkan bot. */
export async function kirimHasilJawabanGateway(
  hasil: HasilBacaJawaban[]
): Promise<GatewayResult<{ ok: boolean; tersimpan: number }>> {
  return gatewayFetch(`/internal/aleta-bot/sipp/penanda-jawaban`, {
    method: "POST",
    body: JSON.stringify({ hasil }),
  });
}

/**
 * Mengambil berkas SIPP - dokumen perkara, relaas, atau resi pos.
 *
 * Seperti ambilBerkasGateway, mengembalikan Response mentah: isinya berkas,
 * bukan JSON, dan menguraikannya akan merusaknya.
 */
/** Jenis berkas SIPP yang dapat diunduh lewat jembatan. */
export type JenisBerkasSipp =
  | "dokumen"
  | "relaas"
  | "resi"
  | "bas"
  | "putusan"
  | "putusan-anonim"
  | "penetapan"
  | "ikrar-talak"
  | "arsip"
  | "petitum";

export async function ambilBerkasSippGateway(
  jenis: JenisBerkasSipp,
  id: string,
  /**
   * Sinyal pembatal dari pemanggil.
   *
   * Dulu tidak ada sama sekali, dan fetch tanpa batas waktu berarti satu
   * berkas yang menggantung menggantungkan SELURUH permintaan - termasuk
   * penyusunan ZIP yang menarik puluhan berkas berurutan. Di peladen ini ada
   * satu inode XFS rusak (berita acara sidang 2018) yang membuat pembacaan
   * gagal dengan EUCLEAN sesudah menggantung, jadi keadaan itu bukan
   * kemungkinan teoretis.
   *
   * Pemanggil yang tidak menyebutnya tetap berjalan seperti sebelumnya.
   */
  signal?: AbortSignal
): Promise<Response> {
  const params = new URLSearchParams({ jenis, id });
  const token = getGatewayToken();
  return fetch(
    `${getGatewayBaseUrl()}/internal/aleta-bot/sipp/berkas-perkara?${params.toString()}`,
    {
      headers: token ? { "x-aleta-internal-token": token } : {},
      cache: "no-store",
      signal,
    }
  );
}

export type GatewayEcourtJadwal = {
  pengaturan: {
    aktif: boolean;
    jarakJam: number;
    jamMulai: number;
    jamSelesai: number;
    maksPerkara: number;
    /** Butir 11: saklar yang dipilih orang, dan apakah akun utama menyalakannya. */
    aktifTersimpan?: boolean;
    selaluAktif?: boolean;
    akunUtama?: GatewayAkunUtama | null;
    /** 13 Okt 10.05: selang acak putaran berkala dan tarikan pagi. */
    selangMinMenit?: number;
    selangMaksMenit?: number;
    pagiAktif?: boolean;
    jamPagi?: number;
    menitPagi?: number;
  };
  pagi?: GatewayTarikanPagi;
  berjalan: boolean;
  sedangJalan: boolean;
  dalamJamKerja: boolean;
  /** Butir 12: putaran berkala berikutnya (ISO), null bila tidak menyala. */
  berikutnya?: string | null;
  terakhirMulai: string | null;
  terakhirSelesai: string | null;
  terakhirKode: number | null;
  terakhirCatatan: string;
  jumlahPutaran: number;
};

export type GatewayEcourtArsip = {
  pengaturan: { minRuangGb: number; maksBerkasMb: number; simpanBulan: number };
  ruang: { ok: boolean; bebasGb: number | null; totalGb: number | null; alasan?: string };
  arsip: { jumlahBerkas: number; totalMb: number };
  kedaluwarsa: { aktif: boolean; jumlah: number; totalMb: number };
  ruangMenipis: boolean | null;
};

/** Keadaan ruang dan masa simpan arsip. */
export async function getGatewayEcourtArsip(): Promise<
  GatewayResult<{ ok: boolean; arsip: GatewayEcourtArsip }>
> {
  return gatewayFetch("/internal/aleta-bot/ecourt/arsip");
}

/** Menyimpan pengaturan ruang dan masa simpan. */
export async function saveGatewayEcourtArsip(payload: {
  minRuangGb: number;
  maksBerkasMb: number;
  simpanBulan: number;
  olehSiapa: string;
}): Promise<GatewayResult<{ ok: boolean; alasan?: string }>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/arsip", { method: "POST", body: JSON.stringify(payload) });
}

/** Membersihkan berkas yang melewati masa simpan. */
export async function bersihkanGatewayEcourtArsip(payload: {
  hapus: boolean;
  olehSiapa: string;
}): Promise<
  GatewayResult<{ ok: boolean; aktif?: boolean; jumlah?: number; totalMb?: number; terhapus?: number; gagal?: number; alasan?: string }>
> {
  return gatewayFetch("/internal/aleta-bot/ecourt/arsip/bersihkan", {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: TIMEOUT_BERKAS_MS,
  });
}

/** Keadaan penjadwal penarikan e-Court. */
export async function getGatewayEcourtJadwal(): Promise<
  GatewayResult<{ ok: boolean; jadwal: GatewayEcourtJadwal }>
> {
  return gatewayFetch("/internal/aleta-bot/ecourt/jadwal");
}

/** Menyimpan pengaturan penjadwal. */
export async function saveGatewayEcourtJadwal(payload: {
  aktif: boolean;
  jarakJam: number;
  jamMulai: number;
  jamSelesai: number;
  maksPerkara: number;
  selangMinMenit?: number;
  selangMaksMenit?: number;
  pagiAktif?: boolean;
  jamPagi?: number;
  menitPagi?: number;
  olehSiapa: string;
}): Promise<GatewayResult<{ ok: boolean; alasan?: string }>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/jadwal", { method: "POST", body: JSON.stringify(payload) });
}

/** Menjalankan satu putaran sekarang, di luar jadwal. */
export async function jalankanGatewayEcourtSekarang(): Promise<
  GatewayResult<{ ok: boolean; dilewati?: boolean; kode?: number; catatan?: string; alasan?: string }>
> {
  return gatewayFetch("/internal/aleta-bot/ecourt/jadwal/jalankan", { method: "POST", body: "{}" });
}

export type HasilPenarikan = {
  ok: boolean;
  alasan?: string;
  berkasLog?: string;
  /** Hanya pada penarikan "yang belum ada": jatah perkara putaran ini. */
  maksPerkara?: number;
};

/**
 * Menarik SELURUH berkas e-Court yang belum lengkap.
 *
 * Padanan aleta-ecourt-unduh-latar.sh tanpa batas jumlah perkara. Menjawab
 * seketika - penarikannya berjalan di latar belakang, dan kemajuannya diikuti
 * lewat berkas log.
 */
export async function mulaiGatewayPenarikanMenyeluruh(
  olehSiapa: string
): Promise<GatewayResult<HasilPenarikan>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/penarikan/menyeluruh", {
    method: "POST",
    body: JSON.stringify({ olehSiapa }),
  });
}

/** Menarik satu perkara sekarang juga, tanpa menunggu detak penjadwal. */
export async function mulaiGatewayPenarikanPerkara(
  nomorPerkara: string,
  olehSiapa: string
): Promise<GatewayResult<HasilPenarikan>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/penarikan/perkara", {
    method: "POST",
    body: JSON.stringify({ nomorPerkara, olehSiapa }),
  });
}

/**
 * Sasaran penarikan - dihitung TANPA menyentuh e-Court.
 *
 * Hanya membaca SIPP dan basis data bot, jadi boleh dipanggil sesering apa pun,
 * termasuk ketika sesi e-Court sedang habis. Tidak memulai apa pun.
 */
export type GatewaySasaranPenarikan = {
  diperiksaPada: string;
  totalEcourtSipp: number;
  belumPernahDitarik: number;
  berkasKurang: number;
  lengkap: number;
  dokumenKurang: number;
  dokumenTidakTersedia: number;
  jumlahSasaran: number;
  /** Nol berarti tiap perkara masuk tepat satu golongan; selain nol itu cacat. */
  selisihGolongan: number;
  /**
   * Batas BAWAH rentang taksiran. Namanya dipertahankan supaya pembaca lain
   * tidak patah, tetapi artinya kini tegas: istirahat dihitung pada panjang
   * terpendeknya, bukan tidak dihitung sama sekali.
   */
  perkiraanMenit: number;
  perkiraanMenitMin?: number;
  perkiraanMenitMaks?: number;
  /**
   * Bagian dari belumPernahDitarik yang halamannya SUDAH pernah dibuka dan
   * ternyata memang nol dokumen. Angka ini TIDAK akan berkurang berapa kali pun
   * tombolnya ditekan - tanpa menyebutkannya, petugas menekan berulang-ulang
   * untuk sisa yang mustahil dikerjakan lalu menyimpulkan panelnya rusak.
   */
  dikunjungiTetapiKosong?: number;
  /**
   * Jatah satu penekanan, dibaca di tempat env-nya memang hidup: proses bot.
   * Sebelum ada ruas ini, angkanya ditulis keras di layar sehingga menaikkan
   * ALETA_BOT_ECOURT_MAKS_BELUM_ADA di peladen tidak mengubah apa pun.
   */
  maksSekaliTarik?: number;
  /**
   * Bahan taksirannya, supaya angkanya dapat DIPERIKSA, bukan dipercaya.
   * rerataTerukur salah berarti rata-rata dokumen per perkara belum pernah
   * dapat diukur dan angka cadangan yang dipakai - layar wajib mengatakannya.
   */
  taksiran?: {
    menitKerja: number;
    menitHalaman: number;
    menitBerkas: number;
    jumlahIstirahat: number;
    istirahatMenitMin: number;
    istirahatMenitMaks: number;
    istirahatTiapPerkara: number;
    dokumenDitaksir: number;
    rerataDokumenPerPerkara: number;
    rerataTerukur: boolean;
    perkaraTerukur: number;
  };
  contoh: Array<{ nomorPerkara: string; sebab: string; kurang: number }>;
};

export async function getGatewaySasaranPenarikan(
  contoh = 20
): Promise<GatewayResult<GatewaySasaranPenarikan>> {
  return gatewayFetch(
    `/internal/aleta-bot/ecourt/penarikan/sasaran?contoh=${encodeURIComponent(String(contoh))}`
  );
}

/**
 * Menarik HANYA perkara yang berkasnya belum ada.
 *
 * maksPerkara BOLEH tidak disebut - dan bila tidak disebut, BOT yang memutuskan
 * dari ALETA_BOT_ECOURT_MAKS_BELUM_ADA. Sebelumnya portal memasang angkanya
 * sendiri (120) sebagai nilai ganti, sehingga menaikkan env di peladen tidak
 * mengubah apa pun dan yang menyetelnya menyangka jatahnya naik.
 */
export async function mulaiGatewayPenarikanBelumAda(
  maksPerkara: number | null,
  olehSiapa: string
): Promise<GatewayResult<HasilPenarikan>> {
  const isi: Record<string, unknown> = { olehSiapa };
  if (typeof maksPerkara === "number" && Number.isFinite(maksPerkara) && maksPerkara > 0) {
    isi.maksPerkara = maksPerkara;
  }
  return gatewayFetch("/internal/aleta-bot/ecourt/penarikan/belum-ada", {
    method: "POST",
    body: JSON.stringify(isi),
  });
}

/** Melupakan penanda "tidak tersedia" supaya ditanyakan sekali lagi. */
export async function cobaLagiGatewayTidakTersedia(muatan: {
  documentKey?: string;
  semua?: boolean;
}): Promise<GatewayResult<{ ok: boolean; diubah: number }>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/penarikan/coba-tidak-tersedia", {
    method: "POST",
    body: JSON.stringify(muatan),
  });
}

/** Menghentikan penarikan yang dimulai dari portal. */
export async function hentikanGatewayPenarikan(
  olehSiapa: string
): Promise<GatewayResult<HasilPenarikan>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/penarikan/hentikan", {
    method: "POST",
    body: JSON.stringify({ olehSiapa }),
  });
}

export type GatewayEcourtAkun = {
  slot: string;
  label: string;
  aktif: boolean;
  adaSesi: boolean;
  istirahat: boolean;
  gagalTerakhir: string | null;
  alasanGagal: string;
  terakhirDipakai: boolean;
  /** Butir 11 (13 Okt 2026): akun utama - penarikannya selalu jalan. */
  utama?: boolean;
};

/** Keadaan akun utama penarikan (butir 11). */
export type GatewayAkunUtama = {
  slot: string;
  label: string;
  dipilih: boolean;
  sah: boolean;
  bawaan: boolean;
  alasan: string;
  pesan: string;
};

/** Daftar akun e-Court beserta keadaan sesinya. */
export async function getGatewayEcourtAkun(): Promise<
  GatewayResult<{ ok: boolean; akun: GatewayEcourtAkun[]; akunUtama?: GatewayAkunUtama }>
> {
  return gatewayFetch("/internal/aleta-bot/ecourt/akun");
}

/** Memilih akun utama, atau melepasnya (wajib kata penegas). */
export async function simpanGatewayAkunUtama(payload: {
  tindakan: "pilih" | "lepas";
  slot?: string;
  konfirmasi?: string;
  olehSiapa: string;
}): Promise<GatewayResult<{ ok: boolean; alasan?: string; akunUtama?: GatewayAkunUtama }>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/akun/utama", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Tarikan pagi (13 Okt 10.05): jam tetap, susulan bila bot baru menyala. */
export type GatewayTarikanPagi = {
  aktif: boolean;
  jam: string;
  berikutnya: string | null;
  susulan: boolean;
  terakhir: {
    tanggal: string;
    mulai: string;
    kode?: number | null;
    catatan?: string;
    jumlahPerkara?: number;
    susulan?: boolean;
  } | null;
};

/** Satu penarikan menurut log-nya (butir 12). */
export type GatewayRingkasPenarikan = {
  nama: string;
  mulai: string;
  selesai: string;
  sumber: string;
  labelSumber: string;
  otomatis: boolean;
  jenis: "berkala" | "perkara" | "pagi";
  sidangDiutamakan?: number;
  perkara: string;
  akun: string;
  labelAkun: string;
  hasil: "berhasil" | "gagal" | "sesi-habis" | "berjalan" | "terputus";
  sebab: string;
  perkaraDiperiksa: number | null;
  dokumenTerlihat: number | null;
  dokumenBaru: number | null;
  berkasTerunduh: number | null;
  galat: number | null;
};

/** Status penarikan data e-Court untuk dasbor (butir 12). */
export type GatewayStatusPenarikan = {
  ok: boolean;
  dibaca: string;
  akunUtama: GatewayAkunUtama;
  penjadwal: {
    aktif: boolean;
    aktifTersimpan: boolean;
    selaluAktif: boolean;
    jarakJam: number | null;
    jamMulai: number | null;
    jamSelesai: number | null;
    dalamJamKerja: boolean;
    sedangJalan: boolean;
    sumberBerjalan: string;
    perkaraBerjalan: string;
    akunBerjalan: string;
    berikutnya: string | null;
    zonaWaktu: string;
    selangMinMenit?: number | null;
    selangMaksMenit?: number | null;
    pagi?: GatewayTarikanPagi | null;
  };
  verifikasiHarian: {
    menyala: boolean;
    detakBerikutnya: string | null;
    terakhirPutaran: string;
    tersambung: boolean;
    alasan: string;
    jumlahTarik: number;
  } | null;
  terakhirBerkala: GatewayRingkasPenarikan | null;
  terakhirPerkara: GatewayRingkasPenarikan | null;
  terakhirPagi?: GatewayRingkasPenarikan | null;
  riwayat: GatewayRingkasPenarikan[];
  sesi: { berlaku: boolean | null; pada: string; sumber: string };
};

export async function getGatewayStatusPenarikan(): Promise<GatewayResult<GatewayStatusPenarikan>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/penarikan/status");
}

/** Menambah atau menyunting satu akun e-Court. */
export async function simpanGatewayEcourtAkun(payload: {
  slot: string;
  label: string;
  aktif: boolean;
  olehSiapa: string;
}): Promise<GatewayResult<{ ok: boolean; alasan?: string; akun?: GatewayEcourtAkun[] }>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/akun", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Menghapus satu akun e-Court beserta sesinya. */
export async function hapusGatewayEcourtAkun(payload: {
  slot: string;
  olehSiapa: string;
}): Promise<GatewayResult<{ ok: boolean; alasan?: string; akun?: GatewayEcourtAkun[] }>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/akun/hapus", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type GatewayPantauSesi = {
  pengaturan: { aktif: boolean; jedaMenit: number; jedaPeringatanJam: number };
  berjalan: boolean;
  sedangDetak: boolean;
  berlaku: boolean | null;
  terakhirDetak: string | null;
  terakhirHasil: string;
  terakhirPeringatan: string | null;
  jumlahDetak: number;
  jumlahDilewati: number;
  nomorAdminTerisi: boolean;
};

/** Keadaan pemantau sesi e-Court. */
export async function getGatewayPantauSesi(): Promise<
  GatewayResult<{ ok: boolean; pantau: GatewayPantauSesi }>
> {
  return gatewayFetch("/internal/aleta-bot/ecourt/pantau-sesi");
}

/** Menyimpan pengaturan pemantau sesi. */
export async function saveGatewayPantauSesi(payload: {
  aktif: boolean;
  jedaMenit: number;
  jedaPeringatanJam: number;
  olehSiapa: string;
}): Promise<GatewayResult<{ ok: boolean; alasan?: string; pantau: GatewayPantauSesi }>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/pantau-sesi", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Satu detak pemantau sekarang juga. */
export async function detakGatewayPantauSesi(): Promise<
  GatewayResult<{ ok: boolean; dilewati?: boolean; berlaku?: boolean | null; alasan?: string; pantau: GatewayPantauSesi }>
> {
  return gatewayFetch("/internal/aleta-bot/ecourt/pantau-sesi/detak", { method: "POST", body: "{}" });
}

export type HasilAuditArsip = {
  ok: boolean;
  diperiksa: number;
  utuh: number;
  bermasalah: number;
  dibuang: number;
  perbaiki: boolean;
  diperiksaPada: string;
  masalah: Array<{
    id: string;
    documentKey: string;
    nomorPerkara: string;
    format: string;
    jalurBerkas: string;
    alasan: string;
  }>;
};

/** Memeriksa keutuhan arsip. perbaiki=true membuang berkas rusak. */
export async function jalankanGatewayAuditArsip(payload: {
  batas?: number;
  perbaiki: boolean;
  olehSiapa: string;
}): Promise<GatewayResult<HasilAuditArsip>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/audit-arsip", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type SidangBaris = {
  sidangId: string;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  alurPerkaraId: number;
  sudahPutus: boolean;
  tanggalPutusan: string;
  statusPutusan: string;
  tanggalMinutasi: string;
  tanggalBht: string;
  tanggalSidang: string;
  jamSidang: string;
  agenda: string;
  ruangan: string;
  ditunda: boolean;
  alasanDitunda: string;
  /**
   * Sidang penyaksian ikrar talak, menurut kolom `ikrar_talak` milik SIPP.
   *
   * Bukan diambil dari tulisan agendanya. Diukur atas 20.092 baris jadwal di
   * PA Donggala: 1.024 baris berbendera 'Y', sebagian beragenda "Panggil
   * Termohon" atau "tunda 6 bulan", sementara ada pula baris beragenda
   * "Sidang Ikrar Talak" yang benderanya 'T'. Menebak dari agendanya salah
   * pada dua arah sekaligus.
   *
   * Wajib, bukan opsional - lihat lewatEcourt di bawah: ruas opsional yang
   * lupa dikirim bot membuat penandanya mati selamanya tanpa satu pun galat.
   */
  sidangIkrarTalak: boolean;
  /**
   * Sidang ikrar yang ikrarnya SUDAH tercatat di perkara_ikrar_talak pada
   * tanggal sidang ini (tgl_ikrar_talak sama dengan tanggal sidangnya) - hasil
   * sidangnya ada walau alasan_ditunda kosong atau "0". Diukur di PA Donggala,
   * Jan 2025 - 10 Sep 2026: 26 dari 33 sidang ikrar beralasan kosong.
   *
   * Sejak tinjauan 24 September 2026 tidak lagi bersyarat bendera ikrar_talak:
   * ikrar yang diucapkan pada tanggal sidang ini berarti sidang itulah sidang
   * ikrarnya, apa pun benderanya.
   */
  ikrarTercatat?: boolean;
  /**
   * Peta putusan dan peta ikrar di bot TERBACA untuk daftar ini. Peta yang
   * gagal dibaca kosong, dan peta kosong terbaca "tidak ada yang putus" - yang
   * membuat tanda merah "Belum ditunda" menuduh sidang yang sudah diputus.
   * Portal menyalakan tanda merah hanya bila keduanya true; bot lama yang
   * tidak mengirimnya membuat tanda merah diam (gagal-tertutup).
   */
  putusanTerbaca?: boolean;
  ikrarTerbaca?: boolean;
  /**
   * Tanggal penetapan hari sidang ikrar (PHS ikrar) perkara cerai talak,
   * YYYY-MM-DD, atau kosong bila belum ditetapkan / bukan cerai talak /
   * tidak terbaca. Titik awal batas enam bulan ikrar (Pasal 70 ayat (6) UU 7/1989).
   */
  tanggalPenetapanSidangIkrar?: string;
  /** false = kueri PHS ikrar gagal: kosongnya ruas di atas BUKAN "belum ditetapkan". */
  tanggalPenetapanSidangIkrarTerbaca?: boolean;
  /**
   * Pembebanan yang dibayar saat ikrar talak, diurai bot dari amar putusan
   * (pembebananIkrarService) - HANYA pada sidang ikrar; null bila tidak ada.
   * Bentuknya di lib/pembebanan-ikrar. pembebananTerbaca false = kuerinya
   * gagal, bukan "tanpa pembebanan". Opsional: bot lama tidak mengirimnya.
   */
  pembebanan?: PembebananIkrar | null;
  pembebananTerbaca?: boolean;
  urutanSidang: number;
  /** 1 semua pihak, 2 penggugat saja, 3 tergugat saja, 4 tidak hadir. */
  dihadiriOleh: number | null;
  adaBas: boolean;
  pihak: { penggugat: string[]; tergugat: string[]; saksi?: string[]; lain?: string[] };
  panggilan: {
    hadirSebelumnya: number | null;
    /** Tergugat/termohon pernah hadir pada sidang mana pun sebelumnya. Sejak bot 2.19.4. */
    tergugatPernahHadir?: boolean;
    /**
     * Pihak pertama pernah hadir sebelumnya: true / false / null (ada sidang
     * sebelumnya yang kehadirannya kosong). Sejak 9 Okt 2026 - BAS massal
     * "gugur atau tunda panggil para pihak". Bot lama tidak mengirimnya.
     */
    penggugatPernahHadir?: boolean | null;
    wajibDipanggil: number[];
    belumDipanggil: number;
    retur: number;
    aman: boolean;
  };
  majelisKode: string;
  majelisNama: string;
  paniteraNama: string;
  jurusitaNama: string;
  /** Putusan tanpa hadirnya tergugat. Bukan verzet - itu perlawanan TERHADAPnya. */
  verstekPutusan: boolean;
  /**
   * Naskah putusan sudah diunggah ke SIPP. Bersama tanggalMinutasi yang masih
   * kosong, inilah keadaan yang menagih panitera pengganti - dan sebelumnya
   * hanya terlihat sesudah membuka rincian perkara satu per satu.
   */
  adaBerkasPutusan: boolean;
  /** Saksi yang DIAJUKAN tiap sisi - belum tentu sudah diperiksa. */
  saksiPihak1: number;
  saksiPihak2: number;
  /**
   * Nama saksi tiap sisi, urut sesuai urutan pengajuannya di SIPP.
   *
   * Dipecah dari GROUP_CONCAT berpemisah PIPA, bukan koma: 573 nama saksi di
   * PA Donggala memuat koma pada gelarnya, dan koma sebagai pemisah memecah
   * satu saksi menjadi dua.
   */
  saksiNamaPihak1: string[];
  saksiNamaPihak2: string[];
  /**
   * Perkaranya terdaftar lewat e-Court (perkara_efiling_id).
   *
   * Syarat PERTAMA penanda e-Litigasi; syarat keduanya - agendanya tahapan
   * yang dipertukarkan elektronik - diperiksa di layar. Tanpa ruas ini di tipe
   * daftar, penandanya selalu mati tanpa satu pun galat: fungsi
   * pemeriksanya menerima ruas opsional, sehingga undefined lolos begitu saja.
   */
  lewatEcourt: boolean;
  /* === 12OKT-B: penanda perkara & pihak (butir 5) - ruas opsional, bot lama tidak mengirimnya === */
  /** Peta e-Court terbaca; tanpanya "non e-Court" tidak ditandai (peta gagal = kosong). */
  ecourtTerbaca?: boolean;
  /** ghaib/prodeo - lihat aleta_bot/services/penandaPerkaraPihakService.js. */
  penandaPerkara?: { ghaib: boolean; ghaibSumber?: string[]; prodeo: boolean } | null;
  /** Pihak berlencana pekerjaan (PNS, PPPK, POLRI, TNI, BUMN, BUMD) menurut penggolongan ABT. */
  penandaPihak?: Array<{ sisi: number; nama: string; kunci: string; label: string; ragu?: boolean; kalimat?: string }> | null;
  penandaProdeoTerbaca?: boolean;
  penandaPekerjaanTerbaca?: boolean;
  /** 14 Okt 2026: izin cerai PNS/ASN (PPPK)/TNI/POLRI - aleta_bot/services/izinCeraiService.js; "ada" tanpa lencana. */
  izinCerai?: {
    keadaan: "ada" | "belum-dicatat" | "belum-ada" | "belum-terbaca";
    label?: string;
    judul?: string;
    sumber?: string;
  } | null;
  /* === AKHIR 12OKT-B === */
};

export type RincianSidang = {
  ok: boolean;
  alasan: string;
  nomorPerkara: string;
  /**
   * perkara_id pada SIPP.
   *
   * Bot sudah memulangkannya sejak lama (sippJadwalSidangService.rincianSidang),
   * tetapi tipenya tidak pernah menyebutnya - jadi tidak satu pun pemanggil
   * TypeScript dapat memakainya, dan setiap yang membutuhkannya terpaksa
   * memintanya dari peramban. Jalur berkas tidak boleh datang dari peramban.
   */
  perkaraId: string;
  jenisPerkara: string;
  /** Gugatan atau permohonan - kolom perkara.petitum_dok, bukan perkara_dokumen. */
  petitum?: { ada: boolean; berkas: string };
  majelis: Array<{ kode: string; nama: string; jabatan: string }>;
  panitera: Array<{ kode: string; nama: string }>;
  jurusita: Array<{ kode: string; nama: string }>;
  saksi: {
    ada: boolean;
    jumlahSaksi: number;
    jumlahKeterangan: number;
    /**
     * Saksi yang diajukan tiap sisi, dari perkara_pihak5.saksi_pihak_ke.
     * Berbeda dari jumlahSaksi di atas, yang menghitung saksi yang sudah
     * DIPERIKSA - saksi dapat diajukan tanpa pernah diperiksa.
     */
    diajukanPihak1: number;
    diajukanPihak2: number;
    adaDiajukan: boolean;
  };
  relaas: Array<{
    id: string;
    namaPihak: string;
    peran: string;
    tanggalRelaas: string;
    tanggalKirimPos: string;
    statusPos: number | null;
    retur: boolean;
    bertemu: boolean;
    caraRelaas?: CaraRelaas;
    noResiPos: string;
    jurusitaNama: string;
    adaDokumen: boolean;
    adaResi: boolean;
  }>;
  dokumenSipp: Array<{
    id: string;
    namaDokumen: string;
    namaFile: string;
    ukuranByte: number;
    keterangan: string;
  }>;
  /** Keadaan putusan, minutasi, BHT, akta cerai, dan upaya hukum. */
  putusan: {
    sudahPutus: boolean;
    tanggalPutusan: string;
    statusPutusan: string;
    verstek: boolean;
    tanggalCabut: string;
    tanggalGugur: string;
    tanggalMinutasi: string;
    tanggalBht: string;
    amarRingkas: string;
    adaBerkasPutusan: boolean;
    adaBerkasAnonim: boolean;
    aktaCerai: {
      nomor: string;
      tanggal: string;
      nomorSeri: string;
      diserahkanPihak1: string;
      diserahkanPihak2: string;
      adaBerkas: boolean;
    } | null;
    upayaHukum: Array<{ jenis: string; tanggal: string }>;
  } | null;
  lewatEcourt: boolean;

  /** Seluruh sidang perkara ini - kalender perkaranya sendiri. */
  jadwalPerkara: Array<{
    sidangId: string;
    tanggalSidang: string;
    jamSidang: string;
    agenda: string;
    ruangan: string;
    ditunda: boolean;
    alasanDitunda: string;
    urutanSidang: number;
    dihadiriOleh: number | null;
    adaBas: boolean;
  }>;
};

export type Penghambat = {
  tingkat: "berat" | "sedang" | "ringan";
  kunci: string;
  pesan: string;
  sumber: string;
};

export type KesiapanRingkas = {
  skor: number;
  keadaan: "siap" | "perhatian" | "bermasalah";
  penghambat: Penghambat[];
};

export type KeadaanPanggilanPihak = {
  nama: string;
  peran: string;
  persetujuan: "setuju" | "tidak_setuju" | "belum";
  seharusnya: "elektronik" | "surat_tercatat" | "biasa";
  terlaksana: string;
  sudahDikirim: boolean;
  belumDipanggil: boolean;
  tidakPerluDipanggil?: boolean;
  salahSaluran: boolean;
  /**
   * Sandi relaas SIPP (ket_temu) yang dinilai untuk sidang ini, dan apakah
   * e-Court mencatat e-Summons kepada pihak ini untuk sidang ini. Sandi 'E'
   * tanpa e-Summons tidak lagi menjadi salah saluran - salurannya
   * dikosongkan dan catatanSaluran menjelaskan sebabnya (perkara
   * 385/Pdt.G/2026/PA.Dgl). Opsional: bot lama tidak mengirimnya.
   */
  sandiRelaas?: string;
  eSummonsTerkirim?: boolean;
  /** Pihak ini terbaca di tabel persetujuan e-Court. */
  terbacaEcourt?: boolean;
  catatanSaluran?: string;
  tanggalPanggilan: string | null;
  diterima: boolean | null;
  buktiPenerimaan: string;
  noResiPos: string;
  tanggalPelaksanaanRelaas: string | null;
  kepatutan: {
    dinilai: boolean;
    patut: boolean | null;
    selisih: number | null;
    ambang: number;
    hariKerja: boolean;
    dasarHukum: string;
    jalur: string;
    perluDiterima: boolean;
    alasan: string;
  };
};

export type KesiapanLengkap = KesiapanRingkas & {
  panggilan: {
    pengaturan: PengaturanPanggilan;
    jalur: JalurPanggilan;
    lewatEcourt: boolean;
    /** Sidang yang dinilai. Opsional: bot lama tidak mengirimnya. */
    sidangId?: string | null;
    tanggalSidang?: string | null;
    pihak: KeadaanPanggilanPihak[];
    ringkasan: {
      jumlahPihak: number;
      belumDipanggil: number;
      salahSaluran: number;
      /** Relaas bersandi 'E' tanpa e-Summons tercatat - bukan salah saluran. */
      saluranBelumPasti?: number;
      tidakPatut: number;
      penerimaanBelumTerbukti: number;
      patut: number;
    };
  };
};

/** Skor kesiapan untuk sekumpulan sidang sekaligus. */
export async function getGatewayKesiapanBanyak(
  sidang: Array<{
    nomorPerkara: string;
    sidangId: string;
    // Dipakai bot untuk membaca keadaan panggilan seluruh sidang sekaligus.
    perkaraId?: string;
    tanggalSidang: string;
    agenda: string;
  }>,
  batas = 50
): Promise<
  GatewayResult<{ ok: boolean; dinilai: number; total: number; kesiapan: Record<string, KesiapanRingkas> }>
> {
  return gatewayFetch("/internal/aleta-bot/sipp/jadwal-sidang/kesiapan", {
    method: "POST",
    body: JSON.stringify({ sidang, batas }),
    timeoutMs: TIMEOUT_PERAMBAN_MS,
  });
}

/** Kesiapan satu sidang, lengkap dengan keadaan panggilan tiap pihak. */
export async function getGatewayKesiapanSatu(params: {
  nomor: string;
  sidangId: string;
  tanggalSidang: string;
  agenda: string;
}): Promise<GatewayResult<{ ok: boolean; kesiapan: KesiapanLengkap | null }>> {
  const kueri = new URLSearchParams(params);
  return gatewayFetch(`/internal/aleta-bot/sipp/jadwal-sidang/kesiapan?${kueri.toString()}`);
}

export type PengaturanPanggilan = {
  hariElektronik: number;
  hariSuratTercatat: number;
  hariBiasa: number;
};

/** Keterangan tiap jalur panggilan beserta dasar hukumnya. */
export type JalurPanggilan = Record<
  "elektronik" | "surat_tercatat" | "biasa",
  { label: string; dasar: string; bawaan: number; hariKerja: boolean; perluDiterima: boolean }
>;

/** Tenggang waktu kepatutan panggilan. */
export async function getGatewayPengaturanPanggilan(): Promise<
  GatewayResult<{ ok: boolean; pengaturan: PengaturanPanggilan; jalur: JalurPanggilan }>
> {
  return gatewayFetch("/internal/aleta-bot/ecourt/panggilan/pengaturan");
}

export async function simpanGatewayPengaturanPanggilan(
  payload: PengaturanPanggilan & { olehSiapa: string }
): Promise<
  GatewayResult<{ ok: boolean; alasan?: string; pengaturan: PengaturanPanggilan; jalur: JalurPanggilan }>
> {
  return gatewayFetch("/internal/aleta-bot/ecourt/panggilan/pengaturan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type PerkaraDitemukan = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalDaftar: string;
  sudahPutus: boolean;
  tanggalPutusan: string;
};

/** Mencari perkara dari potongan nomor - menerima angka saja. */
/** Saringan pencarian perkara. Seluruhnya boleh kosong kecuali salah satunya. */
export type SaringanCariPerkara = {
  cari?: string;
  jenisPerkara?: string;
  status?: string;
  tahun?: string;
  alurPerkaraId?: number;
  sejak?: string;
  sampai?: string;
  namaPihak?: string;
  petugas?: string;
  hakim?: string;
  panitera?: string;
  jurusita?: string;
  statusPutusan?: string;
  pertimbangan?: string;
  amar?: string;
  verstek?: string;
  alamatPihak?: string;
  kua?: string;
  relaas?: string;
  putusSejak?: string;
  putusSampai?: string;
  umur?: string;
  ecourt?: string;
  /** Baris per halaman. Bawaan bot 25, pagunya 500. */
  batas?: number;
  /** Mulai dari baris ke berapa - halaman berikutnya = lewati + batas. */
  lewati?: number;
  // --- tag dan rentang waktu (diminta pengguna 25 September 2026) ---
  // Beberapa kunci tag dipisah koma; bot menggabungkannya dengan DAN, dan
  // membuang kunci yang tidak ada di katalognya.
  tag?: string;
  dasarTanggal?: string;
  periode?: string;
  acuan?: string;
  // DIBERI AWALAN tag: `sampai` di atas sudah dipakai saringan tanggal
  // PENDAFTARAN. Dua medan bernama sama akan membuat tanggal panel tag
  // ikut memotong pendaftaran tanpa satu pun galat.
  tagDari?: string;
  tagSampai?: string;
};

/**
 * Satu baris hasil pencarian perkara.
 *
 * Ruas di bawah garis "ruas rinci" ditambahkan 25 September 2026 untuk
 * tampilan daftar/rinci. Seluruhnya OPSIONAL: bot versi lama tidak
 * mengirimnya, dan layar harus tetap dapat menggambar hasil darinya.
 * Tanggal berbentuk "YYYY-MM-DD" atau "" - tampilkan lewat tanggal-indonesia.
 */
export type BarisCariPerkara = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalDaftar: string;
  sudahPutus: boolean;
  tanggalPutusan: string;
  tanggalMinutasi?: string;
  tanggalBht?: string;
  statusPutusan?: string;
  cocok?: Array<{ medan: string; nilai: string }>;
  // --- ruas rinci ---
  /** Nama pihak pertama dipisah "; ", apa adanya dari SIPP. */
  pihak1?: string;
  /** Nama pihak kedua (Tergugat/Termohon) dipisah "; ". */
  pihak2?: string;
  /** "Penggugat"/"Pemohon"/"Penuntut Umum" menurut alur & jenis perkara. */
  sebutanPihak1?: string;
  /** "Tergugat"/"Termohon"/"Terdakwa". */
  sebutanPihak2?: string;
  /** Butir 24 (6 Okt 2026): turut tergugat (perkara_pihak4), "; ". */
  turutTergugat?: string;
  /** Butir 24: intervensi (perkara_pihak3), "; ". */
  intervensi?: string;
  /** Kuasa hukum yang aktif, "" bila tidak ada. */
  kuasa?: string;
  hakimKetua?: string;
  paniteraPengganti?: string;
  jurusita?: string;
  /** perkara.tahapan_terakhir_text - yang dibaca daftar SIPP sendiri. */
  tahapan?: string;
  /** perkara.proses_terakhir_text. */
  proses?: string;
  /** Sidang yang tanggalnya sebelum hari ini. */
  jumlahSidang?: number;
  sidangTerakhir?: string;
  /** Sidang terdekat mulai hari ini. */
  sidangBerikut?: string;
  /** Hari kalender sejak daftar sampai putus atau sampai hari ini. */
  umurHari?: number | null;
  /** null = tidak terbaca. */
  ecourt?: boolean | null;
  nomorAktaCerai?: string;
  tanggalAktaCerai?: string;
  alurPerkaraId?: number;
  jenisPerkaraId?: number;
};

export type HasilCariPerkara = {
  ok: boolean;
  perkara: BarisCariPerkara[];
  /** Masih ada baris sesudah halaman ini. */
  adaLagi?: boolean;
  /** Halaman yang benar-benar dipakai bot (sesudah dipagari). */
  lewati?: number;
  batas?: number;
  /** "cepat"/"dalam" untuk kata bebas teks, "" selain itu. */
  lapis?: string;
  /** Bagian yang gagal dibaca dari SIPP - kolomnya belum tentu kosong. */
  ruasTakTerbaca?: string[];
  pilihanStatus?: Array<{ kunci: string; label: string }>;
  pilihanRelaas?: Array<{ kunci: string; label: string }>;
  pilihanPutusan?: string[];
  pilihanAlur?: Array<{ id: number; label: string }>;
  tagDipakai?: string[];
  /** Perkara yang sungguh cocok dengan tagnya, terlepas dari batas baris. */
  jumlahTag?: number | null;
  /** Tag yang daftar idnya mentok, jadi perkara tertua tidak ikut terbawa. */
  tagDipotong?: string[];
  /** Pagu daftar id yang berlaku di bot - supaya layar tidak menebaknya. */
  batasId?: number;
};

export async function cariGatewayPerkara(
  saringan: string | SaringanCariPerkara
): Promise<GatewayResult<HasilCariPerkara>> {
  // Bentuk lama - satu kata cari - tetap diterima supaya pemanggil yang sudah
  // ada tidak perlu ikut disunting.
  const isi: SaringanCariPerkara = typeof saringan === "string" ? { cari: saringan } : saringan || {};

  const kueri = new URLSearchParams();
  const pasang = (nama: string, nilai: unknown) => {
    const teks = String(nilai ?? "").trim();
    if (teks) kueri.set(nama, teks);
  };

  pasang("cari", isi.cari);
  pasang("jenisPerkara", isi.jenisPerkara);
  pasang("status", isi.status);
  pasang("tahun", isi.tahun);
  pasang("alurPerkaraId", isi.alurPerkaraId ? String(isi.alurPerkaraId) : "");
  pasang("sejak", isi.sejak);
  pasang("sampai", isi.sampai);
  pasang("namaPihak", isi.namaPihak);
  pasang("petugas", isi.petugas);
  pasang("hakim", isi.hakim);
  pasang("panitera", isi.panitera);
  pasang("jurusita", isi.jurusita);
  pasang("statusPutusan", isi.statusPutusan);
  pasang("pertimbangan", isi.pertimbangan);
  pasang("amar", isi.amar);
  pasang("verstek", isi.verstek);
  pasang("alamatPihak", isi.alamatPihak);
  pasang("kua", isi.kua);
  pasang("relaas", isi.relaas);
  pasang("putusSejak", isi.putusSejak);
  pasang("putusSampai", isi.putusSampai);
  pasang("umur", isi.umur);
  pasang("ecourt", isi.ecourt);
  pasang("batas", isi.batas ? String(isi.batas) : "");
  pasang("lewati", isi.lewati ? String(isi.lewati) : "");
  pasang("tag", isi.tag);
  pasang("dasarTanggal", isi.dasarTanggal);
  pasang("periode", isi.periode);
  pasang("acuan", isi.acuan);
  pasang("tagDari", isi.tagDari);
  pasang("tagSampai", isi.tagSampai);

  return gatewayFetch(`/internal/aleta-bot/sipp/status-perkara/cari?${kueri.toString()}`, {
    timeoutMs: TIMEOUT_PERAMBAN_MS,
  });
}

/**
 * Jumlah tiap tag pada layar awal Status Perkara.
 *
 * Angkanya dihitung atas LINGKUP RENTANG WAKTU saja, tidak pernah atas hasil
 * yang sudah tersaring tag lain - kalau ikut menyusut, menyalakan satu tag
 * membuat tag lain tampak nol dan mustahil dilepas kembali.
 */
export async function getGatewayTagPerkara(params: {
  dasarTanggal?: string;
  periode?: string;
  acuan?: string;
  tagDari?: string;
  tagSampai?: string;
  /**
   * "1" memulangkan KATALOGNYA saja, tanpa menyentuh SIPP sama sekali.
   *
   * Dipakai layar untuk menggambar panelnya seketika: menghitung jumlah 88 tag
   * memakan 6,6 detik pada lingkup "Seluruhnya" (terukur), dan panel yang diam
   * selama itu akan dianggap rusak sebelum satu angka pun terlihat.
   */
  katalogSaja?: string;
}): Promise<
  GatewayResult<{
    ok: boolean;
    katalogSaja?: boolean;
    jumlah: Record<string, number> | null;
    lingkup: { dari: string; sampai: string; perkara: number } | null;
    tag: Array<{ kunci: string; label: string; kelompok: string; nada: string; judul: string }>;
    kelompok: Array<{ kunci: string; label: string }>;
    dasar: Array<{ kunci: string; label: string }>;
    /** Pagu daftar id; layar memakainya untuk menyebut angka yang dipotong. */
    batasId?: number;
  }>
> {
  const kueri = new URLSearchParams();
  for (const [nama, nilai] of Object.entries(params || {})) {
    const teks = String(nilai ?? "").trim();
    if (teks) kueri.set(nama, teks);
  }
  // Performa muat 19 Okt 2026: menghitung jumlah tag = ±19 kueri penyisir
  // (terukur di server 1,2-2,3 detik). Hitungan yang sama disinggahkan 30
  // detik (ALETA_SINGGAH_TAG_MS; mati di lingkungan uji) dan dibuang seketika
  // oleh tulisan apa pun lewat bot. Katalog saja tidak menyentuh SIPP - tidak
  // perlu disinggahkan.
  const jalur = `/internal/aleta-bot/sipp/status-perkara/tag?${kueri.toString()}`;
  const ttl = kueri.get("katalogSaja") === "1" ? 0 : ttlDariEnv("ALETA_SINGGAH_TAG_MS", process.env.NODE_ENV === "test" ? 0 : 30_000);
  return singgahSingkat(
    "tag-perkara",
    kueri.toString(),
    ttl,
    () =>
      gatewayFetch<{
        ok: boolean;
        katalogSaja?: boolean;
        jumlah: Record<string, number> | null;
        lingkup: { dari: string; sampai: string; perkara: number } | null;
        tag: Array<{ kunci: string; label: string; kelompok: string; nada: string; judul: string }>;
        kelompok: Array<{ kunci: string; label: string }>;
        dasar: Array<{ kunci: string; label: string }>;
        batasId?: number;
      }>(jalur, {
        timeoutMs: TIMEOUT_PERAMBAN_MS,
      }),
    { simpanBila: (hasil) => hasil.ok === true }
  );
}

/**
 * Seluruh keadaan satu perkara.
 *
 * Bentuknya sengaja longgar: isinya menggabungkan banyak sumber, dan mengunci
 * tiap medannya di sini berarti tipe ini harus disunting tiap kali salah satu
 * sumber bertambah. Komponennya menyempitkan sendiri apa yang dipakainya.
 */
export async function getGatewayStatusPerkara(
  nomor: string
): Promise<GatewayResult<Record<string, unknown> & { ok: boolean; alasan?: string }>> {
  const kueri = new URLSearchParams({ nomor });
  return gatewayFetch(`/internal/aleta-bot/sipp/status-perkara?${kueri.toString()}`, {
    timeoutMs: TIMEOUT_PERAMBAN_MS,
  });
}

/**
 * Rekap satu petugas - dibuka dari nama hakim, panitera pengganti, juru sita,
 * atau mediator pada layar Status Perkara. Orangnya dikenali lewat peran dan
 * ID SIPP, tidak lewat nama; lihat src/lib/rekap-petugas.ts.
 *
 * Batas waktu penilaian (60 detik), bukan bawaan delapan detik. Terukur atas
 * sipp_donggala lokal (buffer InnoDB 16 MB), lewat HTTP: hitungan pertama
 * seorang juru sita 1,3 detik, panitera 0,8, hakim 0,3 - tetapi sebelum bot
 * membaca tabel perkara lewat indeksnya, angka yang sama 6-10 detik saat mesin
 * sedang sibuk, dan ruang itulah yang dijaga batas ini. Hitungan berikutnya
 * dua menit sesudahnya dari singgahan bot, di bawah 10 milidetik.
 */
export async function getGatewayRekapPetugas(
  permintaan: PermintaanRekap
): Promise<GatewayResult<RekapPetugas>> {
  const kueri = new URLSearchParams({ peran: permintaan.peran, id: String(permintaan.id) });
  if (permintaan.tahun) kueri.set("tahun", permintaan.tahun);
  if (permintaan.keadaan) kueri.set("keadaan", permintaan.keadaan);
  if (permintaan.kedudukan) kueri.set("kedudukan", permintaan.kedudukan);
  if (permintaan.lewati) kueri.set("lewati", String(permintaan.lewati));
  if (permintaan.batas) kueri.set("batas", String(permintaan.batas));
  return gatewayFetch(`/internal/aleta-bot/sipp/rekap-petugas?${kueri.toString()}`, {
    timeoutMs: TIMEOUT_PENILAIAN_MS,
  });
}

/**
 * Fakta eviden SKP satu petugas untuk satu periode - lihat
 * aleta_bot/services/evidenSkpService.js dan src/lib/eviden-skp-tipe.ts.
 *
 * Batas waktu penilaian (60 detik), bukan bawaan delapan detik. Terukur atas
 * sipp_donggala lokal (buffer InnoDB 16 MB) 27 September 2026, hakim_id 31:
 * hitungan pertama Triwulan I 2,2-9 detik (242 perkara), Triwulan II 1,7-7
 * detik (329), Tahun 2026 2,3-8 detik (715) - lebarnya menurut sibuknya mesin.
 * Hitungan berikutnya dalam dua menit dari singgahan bot, seketika: menu
 * unduhan membaca daftar dokumen lalu tiap format diunduh terpisah.
 */
export async function getGatewayEvidenSkp(p: {
  peran: PeranEvidenSkp;
  id: string;
  tahun: number;
  /** tw1..tw4|tahun (jalur lama) atau b01..b12 (SKP bulanan, 17 Okt 2026). */
  periode: KunciPeriodeSkpJabatan;
}): Promise<GatewayResult<DataEvidenSkp>> {
  const kueri = new URLSearchParams({ peran: p.peran, id: String(p.id), tahun: String(p.tahun), periode: p.periode });
  return gatewayFetch(`/internal/aleta-bot/sipp/eviden-skp?${kueri.toString()}`, {
    timeoutMs: TIMEOUT_PENILAIAN_MS,
  });
}

/**
 * Fakta SKP jabatan perkara (Panitera, Panmud, PP, Jurusita, Kasir, Meja,
 * Operator, Ketua/Wakil) untuk satu periode - rute bot GET /sipp/skp-jabatan,
 * bentuk jawaban DataSkpJabatan (lib/skp-jabatan-tipe.ts). Hanya SELECT di
 * sisi bot.
 *
 * `username` DIULANG per akun (?username=a&username=b), tidak digabung dengan
 * koma: nama akun SIPP boleh memuat koma (mis. "munifa,SH."). `jabatan` memberi
 * tahu bot indikator mana yang dibaca untuk akun tanpa grup SIPP (Meja,
 * Operator). Batas waktu penilaian sama dengan eviden SKP hakim.
 */
export async function getGatewaySkpJabatan(p: {
  tahun: number;
  periode: KunciPeriodeSkpJabatan;
  jabatan: JabatanSkp | null;
  username: readonly string[];
}): Promise<GatewayResult<DataSkpJabatan>> {
  const kueri = new URLSearchParams({ tahun: String(p.tahun), periode: p.periode });
  if (p.jabatan) kueri.set("jabatan", p.jabatan);
  for (const u of p.username) kueri.append("username", u);
  return gatewayFetch(`/internal/aleta-bot/sipp/skp-jabatan?${kueri.toString()}`, {
    timeoutMs: TIMEOUT_PENILAIAN_MS,
  });
}

/** Akun SIPP beserta tautannya ke panitera, jurusita, hakim, dan mediator (rute bot GET /sipp/skp-akun). */
export type AkunSippSkp = {
  username: string;
  userIdSipp: string;
  nama: string;
  aktif: boolean;
  jabatanDugaan: string | null;
  paniteraId: number | null;
  jurusitaId: number | null;
  hakimId: number | null;
  mediatorIds: number[];
};

/**
 * Daftar akun SIPP untuk menautkan halaman Rekap Petugas (id panitera/jurusita/
 * mediator) ke akunnya, lalu ke pegawai lewat Pemetaan. Hanya SELECT di bot.
 */
export async function getGatewaySkpAkun(p: { semua?: boolean } = {}): Promise<GatewayResult<{ ok: boolean; akun: AkunSippSkp[] }>> {
  const kueri = new URLSearchParams();
  if (p.semua) kueri.set("semua", "1");
  return gatewayFetch(`/internal/aleta-bot/sipp/skp-akun?${kueri.toString()}`, { timeoutMs: TIMEOUT_PENILAIAN_MS });
}

/**
 * Jalur halaman satu perkara di SIPP - "perkara_detil_agama/<enc>" - untuk
 * tombol "Buka SIPP" dan "Salin tautan" di Status Perkara.
 *
 * Bot menjawab jalur RELATIF; alamat mutlaknya disusun portal dari
 * ALETA_SIPP_BASE_URL (lihat modules/aleta-ecourt/sipp-tautan.ts), karena hanya
 * portal yang tahu alamat SIPP menurut peramban petugas. Kunci SIPP yang
 * dipakai menyusun <enc> tidak pernah meninggalkan bot.
 *
 * Batas waktu bawaan cukup: bot hanya membaca satu baris perkara dan satu
 * baris sys_config, lalu menyandikan dua blok.
 */
export async function getGatewaySippTautanPerkara(params: {
  perkaraId?: string;
  nomor?: string;
}): Promise<
  GatewayResult<{ ok: boolean; jalur: string; pintu: string; perkaraId: string; nomorPerkara: string }>
> {
  const kueri = new URLSearchParams();
  const perkaraId = String(params.perkaraId ?? "").trim();
  const nomor = String(params.nomor ?? "").trim();
  if (perkaraId) kueri.set("perkaraId", perkaraId);
  if (nomor) kueri.set("nomor", nomor);
  return gatewayFetch(`/internal/aleta-bot/sipp/tautan-perkara?${kueri.toString()}`);
}

/** Daftar sidang pada rentang tanggal, dibaca dari SIPP. */
export async function getGatewayJadwalSidang(params: {
  dari: string;
  sampai: string;
  cari: string;
  batas: number;
  /**
   * Meminta waktuAntrian ikut disusun (?waktu=1). Bawaannya TIDAK: menyusunnya
   * menembak basis data antrian dan basis data bot, dan pemanggil yang tidak
   * memakainya - layar publik yang memuat ulang berkala - tidak boleh ikut
   * menanggungnya. Hanya rute jadwal sidang yang memintanya.
   */
  waktu?: boolean;
}): Promise<
  GatewayResult<{
    ok: boolean;
    dari: string;
    sampai: string;
    diperiksaPada: string;
    sidang: SidangBaris[];
    // Antrian datang dari basis data lain lewat sambungan tersendiri, dan
    // kegagalannya ditelan di bot - jadwalnya tetap terkirim. Karena itu
    // bentuknya selalu ada, dengan terbaca yang menyatakan berhasil tidaknya.
    antrian?: {
      terbaca: boolean;
      alasan: string;
      tanggal: string[];
      jumlahDiambil?: number;
      /**
       * Berkunci perkara_id, BUKAN sidang_id - itu bentuk tabel antriannya.
       * Yang memakainya wajib memeriksa tanggalSidang tiap baris: perkara yang
       * bersidang dua kali dalam rentang yang dibuka akan mendapat baris
       * antrian hari lain kalau tidak diperiksa.
       *
       * Ditulis dengan bentuk yang sesungguhnya, bukan Record<string, unknown>.
       * Bentuk longgar di sini pernah membuat rute hakim membaca ruas yang
       * tidak pernah ada tanpa satu pun peringatan dari TypeScript.
       */
      peta: Record<string, AntrianBarisGateway>;
      /** F3.2: kehadiran rinci per orang, kunci "perkaraId|YYYY-MM-DD" (hanya ?waktu=1). */
      kehadiran?: Record<string, { hadir: KehadiranBaris[] }>;
    };
    /**
     * Waktu antrian berdetik untuk SELURUH perkara pada tanggal-tanggal yang
     * tampil - dari buku waktu bot (hari lampau) dan aplikasi antrian (hari
     * ini) - beserta "sekarang" menurut jam aplikasi antrian. Bahan tiga jarak
     * waktu sidang; lihat lib/tiga-jarak-sidang.ts.
     *
     * Opsional: bot sebelum 27 September 2026 tidak mengirimnya, dan layar
     * jadwal tetap berjalan tanpanya.
     */
    waktuAntrian?: WaktuAntrian;
  }>
> {
  const kueri = new URLSearchParams({
    dari: params.dari,
    sampai: params.sampai,
    cari: params.cari,
    batas: String(params.batas),
  });
  if (params.waktu === true) kueri.set("waktu", "1");
  return gatewayFetch(`/internal/aleta-bot/sipp/jadwal-sidang?${kueri.toString()}`);
}

export type AntrianBarisGateway = {
  nomor: number | null;
  tanggalSidang: string;
  waktuAmbil: string;
  /** true = diambil lewat WhatsApp, false = diambil di mesin ruang tunggu. */
  online: boolean;
  pihak1: string;
  pihak2: string;
  saksi: string;
  keadaan: "menunggu" | "dipanggil" | "belum-ambil";
  /**
   * Sudah berapa menit menunggu giliran - dihitung basis data mesin antrian
   * sendiri, bukan oleh Node maupun peramban.
   *
   * null berarti TIDAK dihitung: sudah dipanggil masuk, atau belum ada yang
   * mengambil nomor. Nol berarti baru saja mengambil - keadaan yang sungguh
   * terjadi, dan berbeda sama sekali dari null.
   */
  menitMenunggu?: number | null;
  jamPanggil: string;
  noRuang: number | null;
  ruanganId: number | null;
  namaPetugas: string;
  majelisKode: string;
};

export type AntrianSidangGateway = {
  ok: boolean;
  terbaca: boolean;
  alasan: string;
  tanggal: string[];
  jumlahDiambil?: number;
  peta: Record<string, AntrianBarisGateway>;
  /**
   * Siapa yang hadir dan siapa yang lebih dulu - dari basis data ALETA, bukan
   * dari aplikasi antrian yang hanya mengenal dua sisi dan saksi.
   */
  kehadiran?: Record<string, { hadir: KehadiranBaris[]; pertama: KehadiranBaris | null }>;
  /**
   * Berapa kali tiap perkara sudah dipanggil hari ini. Tabel aplikasi antrian
   * hanya menyimpan SATU jam panggil dan tidak dapat menjawab ini - padahal
   * hitungan ketiga yang menentukan apakah perkara patut ditunda.
   */
  panggilan?: Record<
    string,
    {
      jumlah: number;
      batas: number;
      sudahBatas: boolean;
      panggilan: Array<{ urutan: number; jam: string; oleh: string }>;
    }
  >;
};

/** Memanggil satu nomor antrian - menulis penanda yang sama dengan mesin antrian. */
export async function panggilAntrian(params: {
  perkaraId: string;
  nomorPerkara: string;
  nomorAntrian: number | null;
  noRuang: number | null;
  oleh: string;
}): Promise<
  GatewayResult<{
    ok: boolean;
    alasan?: string;
    urutan: number;
    batas: number;
    sudahBatas: boolean;
    keterangan: string;
  }>
> {
  return gatewayFetch("/internal/aleta-bot/antrian/panggil", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * Seluruh antrian sidang hari berjalan beserta nomornya.
 *
 * Nomornya dihitung dengan rumus yang sama persis dengan yang dipakai menjawab
 * WhatsApp, sehingga nomor di layar tidak pernah berselisih dengan nomor yang
 * sudah diterima para pihak.
 */
/**
 * Satu analisis lanjutan atas satu perkara.
 *
 * Sepuluh jenis analisis, satu per permintaan - dan hanya saat tombolnya
 * ditekan. Menyatukannya ke dalam status perkara akan membuat membuka
 * perkara menunggu perhitungan yang belum tentu dilihat.
 */
/* ==========================================================================
 * PENILAIAN DAN PENGAWASAN
 * ========================================================================== */

/** Daftar penilaian yang terdaftar pada kerangka, beserta cara hitungnya. */
export async function getGatewayDaftarPenilaian(): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/penilaian/daftar`);
}

/**
 * ============================================================================
 * RUBRIK PENILAIAN PERKARA - BOBOT DAN AMBANG PREDIKATNYA
 * ============================================================================
 *
 * Rutenya sudah lama ada di bot, tetapi TIDAK ADA satu pun jalan dari portal
 * menuju ke sana. Akibatnya "bobot dapat diubah pengadilan" benar di mesin dan
 * tidak benar bagi orang yang memakainya: tidak ada layar yang dapat dibuka,
 * dan satu-satunya cara mengubah bobot adalah menyunting berkas pengaturan di
 * dalam container.
 *
 * Rute bot yang tidak punya pemanggil tidak ketahuan dari mana pun - penjaga
 * keselarasan gerbang memeriksa portal yang meminta alamat tidak ada, bukan
 * bot yang melayani alamat yang tidak pernah diminta.
 */
export async function getGatewayRubrikPengaturan(): Promise<
  GatewayResult<Record<string, unknown>>
> {
  return gatewayFetch(`/internal/aleta-bot/sipp/penilaian/pengaturan`);
}

/**
 * Kosakata tambahan pemeriksa pesan.
 *
 * Yang dipulangkan TAMBAHAN saja - daftar bawaannya tetap di dalam kode
 * portal. Menggabungkannya di sisi bot akan membuat pemeriksa kalimat mati
 * ketika botnya mati, padahal pesannya tetap dapat diketik dan disimpan.
 */
export async function getGatewayKosakata(): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/kosakata`);
}

/** Menyimpan kosakata tambahan. Menerima daftar penuh, bukan selisihnya. */
export async function simpanGatewayKosakata(muatan: {
  tambahan: { promosi: string[]; phishing: string[]; pemendek: string[] };
  olehSiapa: string;
}): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/kosakata`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(muatan),
  });
}

/**
 * Menyimpan rubrik penilaian perkara.
 *
 * `olehSiapa` ikut dikirim dan ikut tercatat. Bobot dan ambang menentukan
 * perkara siapa yang disebut "kurang"; perubahan sebesar itu tidak boleh
 * terjadi tanpa nama di belakangnya.
 */
export async function simpanGatewayRubrikPengaturan(muatan: {
  bulanPenuh: number;
  bulanNol: number;
  hariMinutasi: number;
  ambangBaik: number;
  ambangPerhatian: number;
  bobot: Record<string, number>;
  olehSiapa: string;
}): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/sipp/penilaian/pengaturan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(muatan),
  });
}

/**
 * Menjalankan satu penilaian pada satu jendela periode.
 *
 * `bukti` membatasi berapa baris bukti yang ikut per satuan. Batas itu ada
 * karena satu satuan dapat berisi puluhan ribu baris, dan mengirimkannya
 * seluruhnya membuat layar menunggu sesuatu yang tidak akan dibaca sekaligus.
 */
export async function getGatewayJalankanPenilaian(
  kunci: string,
  periode: string,
  acuan?: string,
  bukti = 10
): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams({ kunci, periode, bukti: String(bukti) });
  if (acuan) kueri.set("acuan", acuan);
  return gatewayFetch(`/internal/aleta-bot/penilaian/jalankan?${kueri.toString()}`, {
    timeoutMs: TIMEOUT_PENILAIAN_MS,
  });
}

/**
 * Katalog ALETA e-Audit beserta keadaan pengerjaan tiap butirnya.
 *
 * Keadaannya dihitung di sisi bot dari selisih antara katalog dan penilaian
 * yang benar-benar terdaftar. Menghitungnya di portal berarti portal harus
 * tahu penilaian apa saja yang terdaftar di mesin - dan itu pengetahuan yang
 * perlahan menyimpang.
 */
export async function getGatewayKatalogEAudit(): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/e-audit/katalog`);
}

/** Dua puluh alat di dalam penilaian beserta keadaan kedua sisinya. */
export async function getGatewayAlatEAudit(): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/e-audit/alat`);
}

/** Satu butir katalog beserta definisi penilaiannya bila sudah tersambung. */
export async function getGatewayButirEAudit(
  kode: string
): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams({ kode });
  return gatewayFetch(`/internal/aleta-bot/e-audit/butir?${kueri.toString()}`);
}

/** Kedua puluh dua laporan perkara, untuk mengisi menu pilihan. */
export async function getGatewayDaftarLaporanPerkara(): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/laporan-perkara/daftar`);
}

/** Blangko nilai satu laporan beserta catatan pengirimannya. */
export async function getGatewayBlangkoLaporanPerkara(
  lipa: number,
  bulan = 12,
  acuan?: string
): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams({ lipa: String(lipa), bulan: String(bulan) });
  if (acuan) kueri.set("acuan", acuan);
  return gatewayFetch(`/internal/aleta-bot/laporan-perkara/blangko?${kueri.toString()}`);
}

/**
 * Mencatat tanggal kirim dan angka laporan.
 *
 * Fakta yang hanya diketahui orang yang mengirimkannya - tidak ada di SIPP, dan
 * menebaknya akan menghasilkan angka karangan.
 */
export async function postGatewayCatatLaporanPerkara(
  isi: Record<string, unknown>
): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/laporan-perkara/catat`, {
    method: "POST",
    body: JSON.stringify(isi),
  });
}

export async function getGatewayAnalisaPerkara(
  nomorPerkara: string,
  jenis: string
): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams({ nomor: nomorPerkara, jenis });
  return gatewayFetch(`/internal/aleta-bot/sipp/analisa?${kueri.toString()}`);
}

/**
 * Beban kinerja konseptor putusan pada satu rentang.
 *
 * Diukur di salinan satker: setahun 2,1 detik, seluruh basis data (9.993
 * putusan) 5,4 detik. Gerbang menyerah pada 8 detik - muat, tetapi tidak
 * dengan margin yang longgar, jadi rentang lebar memulangkan angkanya tanpa
 * daftar rincian per perkara.
 */
/**
 * Keadaan satu baris jadwal sidang.
 *
 * Dibaca sebelum borang penundaan ditawarkan: yang pertama dibutuhkan panitera
 * sidang bukan borang, melainkan jawaban - sidang ini sudah ditunda atau belum.
 */
/**
 * Penanda verifikasi majelis e-Litigasi satu tanggal (butir 30, 5 Okt 2026) -
 * simpanan bot, tanpa menarik e-Court.
 */
export async function getGatewayVerifikasiHariIni(tanggal: string): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams({ tanggal: String(tanggal || "") });
  return gatewayFetch(`/internal/aleta-bot/ecourt/verifikasi-hari-ini?${kueri.toString()}`);
}

export async function getGatewayKeadaanSidang(
  jadwalId: number | string
): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams({ jadwalId: String(jadwalId) });
  return gatewayFetch(`/internal/aleta-bot/sidang/keadaan?${kueri.toString()}`);
}

/**
 * Menunda satu sidang - menulis ke SIPP dan menggerakkan antriannya.
 *
 * KERING sebagai bawaan. Menulis sungguhan menuntut `kering: false` yang tegas,
 * sebab yang ditulis ini `perkara_jadwal_sidang` dan `perkara` pada basis data
 * SIPP yang sedang dipakai petugas.
 */
export async function postGatewayTundaSidang(
  isi: Record<string, unknown>,
  opsi: { timeoutMs?: number } = {}
): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/sidang/tunda`, {
    method: "POST",
    body: JSON.stringify(isi),
    ...(opsi.timeoutMs ? { timeoutMs: opsi.timeoutMs } : {}),
  });
}

/**
 * Memutus satu sidang - panitera sidang mencatat bahwa hari ini perkaranya
 * diputus.
 *
 * BUKAN borang hakim: amar dan pertimbangan hukumnya tidak ditanyakan, sebab
 * aplikasi antrian sidang satker sendiri mengisi amar dengan "BELUM DIINPUT".
 */
export async function postGatewayPutusSidang(
  isi: Record<string, unknown>
): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/sidang/putus-sidang`, {
    method: "POST",
    body: JSON.stringify(isi),
  });
}

/**
 * Mengisi form "Penetapan Ikrar Talak" SIPP sesudah ikrar terlaksana (18 Okt
 * 2026). Kering sebagai bawaan; ditolak bot bila keterangan jadwal sidang belum
 * menyatakan ikrar terlaksana.
 */
export async function postGatewayIsiIkrar(
  isi: Record<string, unknown>
): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/sidang/isi-ikrar`, {
    method: "POST",
    body: JSON.stringify(isi),
  });
}

/**
 * Isian borang "Data Penetapan Ikrar Talak" SIPP untuk ekstensi (31, 18 Okt 2026).
 * MEMBACA saja; ok:false + alasan bila borang belum perlu/boleh diisi.
 */
export async function postGatewayIsianBorangIkrar(isi: {
  nomorPerkara?: string;
  perkaraId?: number | string;
}): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/sidang/ikrar-borang`, {
    method: "POST",
    body: JSON.stringify(isi),
  });
}

/**
 * Mengubah naskah (RTF/DOC/DOCX) ke bentuk lain lewat soffice di bot - kontrak
 * K1 (30 Sep 2026). Hanya menghitung; tidak menyimpan apa pun. Batasnya di
 * bawah batas ekstensi 150 dtk dan di atas batas soffice bot 90 dtk.
 */
export async function postGatewayKonversiNaskah(isi: {
  berkasBase64: string;
  ke: string;
}): Promise<
  GatewayResult<{ ok: boolean; berkasBase64?: string; bentukAsal?: string; ke?: string; byte?: number; error?: string; kode?: string }>
> {
  return gatewayFetch("/internal/aleta-bot/naskah/konversi", {
    method: "POST",
    body: JSON.stringify(isi),
    timeoutMs: 120000,
  });
}

/**
 * Status putusan yang sungguh dipakai satker - dibaca dari data, bukan daftar.
 */
export async function getGatewayStatusPutusan(): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/sidang/status-putusan`);
}

/**
 * Menulis putusan akhir ke SIPP.
 *
 * KERING sebagai bawaan, sama tegasnya seperti penetapan dan penundaan. Yang
 * dicatat di sini dibaca pengadilan tingkat banding, dipakai menyusun akta
 * cerai, dan dikirim ke Direktori Putusan.
 */
export async function postGatewayTulisPutusan(
  isi: Record<string, unknown>
): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/sidang/putus`, {
    method: "POST",
    body: JSON.stringify(isi),
  });
}

/**
 * Peta perkara - sebaran wilayah, faktor perceraian, dan siapa yang datang.
 *
 * Batas waktu penilaian, bukan bawaan delapan detik: rentang seluruh basis
 * data diukur 4,8 detik pada mesin yang tidak dibebani, dan angka itu melewati
 * batas bawaan begitu mesinnya mengerjakan hal lain.
 */
export async function getGatewayPetaPerkara(pilihan: {
  kelompok: string;
  tingkat?: string;
  induk?: string;
  periode?: string;
  acuan?: string;
  dari?: string;
  sampai?: string;
}): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams({ kelompok: pilihan.kelompok });
  if (pilihan.tingkat) kueri.set("tingkat", pilihan.tingkat);
  if (pilihan.induk) kueri.set("induk", pilihan.induk);
  if (pilihan.periode) kueri.set("periode", pilihan.periode);
  if (pilihan.acuan) kueri.set("acuan", pilihan.acuan);
  if (pilihan.dari) kueri.set("dari", pilihan.dari);
  if (pilihan.sampai) kueri.set("sampai", pilihan.sampai);
  return gatewayFetch(`/internal/aleta-bot/sipp/peta-perkara?${kueri.toString()}`, {
    timeoutMs: TIMEOUT_PENILAIAN_MS,
  });
}

/**
 * Identitas para pihak satu perkara - dibaca hanya ketika satu nama diketuk.
 *
 * Batas waktu bawaan, bukan batas penilaian: kuerinya satu, berindeks nomor
 * perkara, dan memulangkan paling banyak belasan baris.
 */
export async function getGatewayIdentitasPihak(
  nomorPerkara: string
): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams({ nomorPerkara });
  return gatewayFetch(`/internal/aleta-bot/sipp/identitas-pihak?${kueri.toString()}`);
}

/**
 * 16OKT-F43: data pribadi satu perkara (pihak, saksi, anak, nama pelindung) untuk
 * anonimisasi mandiri. Nilainya UTUH - hanya dipakai di sisi server portal, tidak
 * pernah diteruskan ke peramban.
 */
export type GatewayEntitasAnonim = import("@/lib/anonimisasi-putusan").EntitasAnonim & {
  ok: boolean;
  perkara?: { nomor: string; jenis: string };
};
export async function getGatewaySippEntitasAnonim(nomorPerkara: string): Promise<GatewayResult<GatewayEntitasAnonim>> {
  const kueri = new URLSearchParams({ nomorPerkara });
  return gatewayFetch(`/internal/aleta-bot/sipp/entitas-anonim?${kueri.toString()}`);
}

/**
 * 17OKT-F44: putusan BHT hakim ketua yang sama, jenis sama (Putusan Advance).
 * `nama` hanya untuk disamarkan di portal - tidak pernah diteruskan ke peramban.
 */
export type GatewayPutusanSerupa = {
  ok: boolean;
  perkara?: { id?: string; nomor: string; jenis: string };
  /** Konseptor SIPP (jejak tahapan putusan) - 17 Okt, hak Putusan Advance; bot lama tidak mengirimnya. */
  konseptor?: Array<{ pengguna?: string; nama?: string }>;
  hakim?: { nama: string } | null;
  sebab?: string;
  kandidat?: Array<{
    nomor: string;
    tanggalPutusan: string;
    tanggalBht: string;
    verstek: boolean;
    pertimbangan: string;
    amar: string;
    nama: string[];
  }>;
};
export async function getGatewaySippPutusanSerupa(nomorPerkara: string): Promise<GatewayResult<GatewayPutusanSerupa>> {
  const kueri = new URLSearchParams({ nomorPerkara });
  return gatewayFetch(`/internal/aleta-bot/sipp/putusan-serupa?${kueri.toString()}`, { timeoutMs: 20000 });
}

/**
 * Wilayah SIPP bertingkat (perbaikan 2 Okt 2026 butir 16): `induk` = anak
 * satu wilayah (kosong = provinsi), `kode` = rantai sampai kode itu. Hanya
 * membaca - lihat sippWilayahService di bot.
 */
export async function getGatewayWilayahSipp(pilihan: {
  induk?: string;
  kode?: string;
}): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams();
  if (pilihan.kode) kueri.set("kode", pilihan.kode);
  else if (pilihan.induk) kueri.set("induk", pilihan.induk);
  const tambahan = kueri.toString();
  return gatewayFetch(`/internal/aleta-bot/sipp/wilayah${tambahan ? `?${tambahan}` : ""}`);
}

/**
 * Bantu data saksi (1.189.x butir 10-12): sebutan para pihak menurut jenis
 * perkara, para pihak, dan saksi yang sudah ada pada satu perkara. Hanya
 * membaca - lihat saksiBantuService di bot.
 */
export async function getGatewaySaksiKonteks(
  nomorPerkara: string
): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams({ nomorPerkara });
  return gatewayFetch(`/internal/aleta-bot/sipp/saksi-bantu/konteks?${kueri.toString()}`);
}

/**
 * Orang yang SUDAH ADA di tabel pihak SIPP dan cocok dengan isian saksi baru
 * (NIK sama, atau nama + tanggal lahir sama). POST: nama dan NIK tidak masuk
 * alamat permintaan. Batas 20 detik - kolom NIK SIPP tidak berindeks.
 */
export async function postGatewaySaksiGanda(isian: {
  nama: string;
  nik?: string;
  tanggalLahir?: string;
  nomorPerkara?: string;
  kecualiPihakId?: string;
}): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/sipp/saksi-bantu/ganda`, {
    method: "POST",
    body: JSON.stringify(isian),
    timeoutMs: 20_000,
  });
}

/**
 * Riwayat para pihak satu perkara - cerai berakta dan perkara lain orang yang
 * sama. Dibaca hanya ketika bagian Para pihak di Status Perkara dibuka.
 *
 * Batas 20 detik, bukan bawaan 8: pencarian NIK memindai tabel `pihak` yang
 * kolom NIK-nya tidak berindeks. Terukur 160-390 ms dalam keadaan tunak atas
 * sipp_donggala, tetapi sampai 4,5 detik pada mesin yang sedang dibebani -
 * dan yang harus menyerah lebih dulu adalah batas kueri di sisi bot (15
 * detik), supaya sebab yang sampai ke petugas adalah sebab sesungguhnya.
 */
export async function getGatewayRiwayatPihak(pilihan: {
  perkaraId?: string;
  nomorPerkara?: string;
}): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams();
  if (pilihan.perkaraId) kueri.set("perkaraId", pilihan.perkaraId);
  if (pilihan.nomorPerkara) kueri.set("nomorPerkara", pilihan.nomorPerkara);
  return gatewayFetch(`/internal/aleta-bot/sipp/riwayat-pihak?${kueri.toString()}`, { timeoutMs: 20_000 });
}

/**
 * Lapisan panggilan tidak bertemu per desa.
 *
 * Batas waktu penilaian: kuerinya menyisir seluruh relaas pada rentangnya, dan
 * terukur 884 milidetik untuk delapan tahun pada mesin yang tidak dibebani.
 */
export async function getGatewayPetaRelaas(pilihan: {
  periode?: string;
  acuan?: string;
  dari?: string;
  sampai?: string;
}): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams();
  if (pilihan.periode) kueri.set("periode", pilihan.periode);
  if (pilihan.acuan) kueri.set("acuan", pilihan.acuan);
  if (pilihan.dari) kueri.set("dari", pilihan.dari);
  if (pilihan.sampai) kueri.set("sampai", pilihan.sampai);
  return gatewayFetch(`/internal/aleta-bot/sipp/peta-perkara/relaas?${kueri.toString()}`, {
    timeoutMs: TIMEOUT_PENILAIAN_MS,
  });
}

/**
 * Satu lapisan peta - biaya, faktor, kehadiran, berulang, perubahan, jurusita,
 * sidang keliling, atau desa tanpa perkara.
 *
 * Batas waktu penilaian: lapisan biaya menyisir seluruh transaksi pada
 * rentangnya, terukur 938 milidetik untuk delapan tahun.
 */
export async function getGatewayLapisanPeta(pilihan: {
  apa: string;
  induk?: string;
  periode?: string;
  acuan?: string;
  dari?: string;
  sampai?: string;
}): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams({ apa: pilihan.apa });
  if (pilihan.induk) kueri.set("induk", pilihan.induk);
  if (pilihan.periode) kueri.set("periode", pilihan.periode);
  if (pilihan.acuan) kueri.set("acuan", pilihan.acuan);
  if (pilihan.dari) kueri.set("dari", pilihan.dari);
  if (pilihan.sampai) kueri.set("sampai", pilihan.sampai);
  return gatewayFetch(`/internal/aleta-bot/sipp/peta-perkara/lapisan?${kueri.toString()}`, {
    timeoutMs: TIMEOUT_PENILAIAN_MS,
  });
}

/** Satu jurusita beserta sebaran pekerjaannya. */
export type SebaranJurusita = {
  nama: string;
  relaas: number;
  retur: number;
  /** Disusun di bot, bukan di layar - dua layar yang menghitungnya sendiri akan berselisih pembulatan. */
  persenRetur: number;
  jumlahDesa: number;
  desa: Array<{ kode: string; relaas: number; retur: number }>;
};

export type SebaranJurusitaGateway = {
  ok: boolean;
  dari: string;
  sampai: string;
  total: number;
  /** Relaas yang nama jurusitanya tidak terbaca - disebut apa adanya. */
  tanpaNama: number;
  jurusita: SebaranJurusita[];
};

/**
 * Sebaran relaas per jurusita - siapa mengerjakan berapa, di berapa desa, dan
 * berapa yang kembali.
 *
 * Berdiri di atas sambungan nama yang dibetulkan 23 September 2026. Sebelum
 * itu, 61,6% baris yang bernama menyebut ORANG LAIN - daftar beban yang
 * disusun di atasnya bukan sekadar tidak berguna, ia menuduh yang salah.
 */
export async function getGatewaySebaranJurusita(pilihan: {
  periode?: string;
  acuan?: string;
  dari?: string;
  sampai?: string;
}): Promise<GatewayResult<SebaranJurusitaGateway>> {
  const kueri = new URLSearchParams();
  if (pilihan.periode) kueri.set("periode", pilihan.periode);
  if (pilihan.acuan) kueri.set("acuan", pilihan.acuan);
  if (pilihan.dari) kueri.set("dari", pilihan.dari);
  if (pilihan.sampai) kueri.set("sampai", pilihan.sampai);
  return gatewayFetch(`/internal/aleta-bot/sipp/sebaran-jurusita?${kueri.toString()}`, {
    timeoutMs: TIMEOUT_PENILAIAN_MS,
  });
}

/**
 * Satu baris pekerjaan juru sita pada tanggal yang diminta - sepucuk relaas
 * panggilan sidang, atau sepucuk pemberitahuan putusan.
 */
export type BarisRelaasMassal = {
  jenis: "panggilan" | "pemberitahuan";
  perkaraId: number;
  nomorPerkara: string;
  jenisPerkara: string;
  pihak: string;
  sebutanPihak: string;
  /** Panggilan; kosong pada pemberitahuan. */
  tanggalSidang: string;
  /** Pemberitahuan; kosong pada panggilan. */
  tanggalPutusan: string;
  agenda: string;
  /** ket_temu / ket_ketemu apa adanya - termasuk sandi yang tidak dikenal. */
  caraSandi: string;
  /** Arti sandinya menurut komentar kolom SIPP, disusun di bot. */
  caraLabel: string;
  resi: string;
  /**
   * Diketik string, BUKAN union "terkirim" | "kembali" | "belum".
   *
   * Isi tabel status_pos di SIPP bukan hanya 1 dan 2: terukur pada
   * sipp_donggala ada baris NULL juga. Menyatakan tipenya union berarti
   * berjanji kepada tsc bahwa nilai keempat mustahil, dan tsc lalu MENGHAPUS
   * cabang "sandi tidak dikenal" di layar sebagai tak terjangkau - persis
   * cabang yang dibutuhkan ketika nilai keempat sungguh datang.
   */
  statusPos: string;
  /** doc_relaas / edoc_pbt terisi. */
  adaBerkas: boolean;
  /** "panggilan" | "penunjukan" | "tidak tercatat" - alasan yang sama seperti statusPos. */
  sumberJurusita: string;
  berselisih: boolean;
  /** Diisi HANYA bila berselisih true - nama yang MEMANGGIL perkara itu. */
  namaPanggilan: string;
};

export type JurusitaRelaasMassal = {
  nama: string;
  /** "" bila tidak ada. */
  nip: string;
  relaas: number;
  pemberitahuan: number;
  baris: BarisRelaasMassal[];
};

export type RelaasMassalGateway = {
  ok: boolean;
  tanggal: string;
  diperiksaPada: string;
  ringkas: {
    relaas: number;
    pemberitahuan: number;
    perkara: number;
    jurusita: number;
    /** Baris yang juru sitanya tidak dapat ditentukan - dikumpulkan, bukan dibuang. */
    tanpaJurusita: number;
    /** Baris pemberitahuan yang penunjukannya berbeda dari yang memanggil. */
    berselisih: number;
  };
  jurusita: JurusitaRelaasMassal[];
  /** Kalimat tentang yang dipotong atau tidak terbaca - digambar apa adanya. */
  catatan: string[];
};

/**
 * Relaas panggilan sidang dan pemberitahuan putusan pada SATU tanggal,
 * dikelompokkan per juru sita - bahan cetak massal.
 *
 * ============================================================================
 * DUA TABEL, DAN HANYA SALAH SATUNYA PUNYA KOLOM JURU SITA
 * ============================================================================
 *
 * perkara_pelaksanaan_relaas menyebut jurusita_id - dan itu sys_users.userid,
 * bukan jurusita.id (dibetulkan 2.33.0; disambungkan lewat jurusita.id NOL
 * baris menunjuk juru sita aktif, jadi sambungan itu mustahil benar).
 * perkara_putusan_pemberitahuan_putusan TIDAK punya kolom juru sita sama
 * sekali, sehingga namanya harus disimpulkan dari penunjukan aktif pada
 * perkaranya - aturan yang pengguna nyatakan 25 September 2026 dan yang
 * terukur cocok 3.082 dari 3.123 baris (98,7%).
 *
 * Sisa 1,3% yang berselisih tidak didiamkan: di antaranya penunjukan bernama
 * "jsp5" dan pemanggil bernama "Super Administrator" - nama login, bukan nama
 * orang. Menampilkannya sebagai juru sita berarti menugaskan orang yang tidak
 * ada, jadi kedua namanya dibawa ke layar sekaligus.
 *
 * Batas waktu penilaian: kedua tabelnya besar (14.342 dan 4.786 baris) dan
 * disilangkan lewat nama yang harus dinormalkan, bukan lewat id.
 */
export async function getGatewayRelaasMassal(pilihan: {
  /** YYYY-MM-DD. Kosong berarti HARI INI menurut zona pengadilan, diputuskan di bot. */
  tanggal?: string;
}): Promise<GatewayResult<RelaasMassalGateway>> {
  const kueri = new URLSearchParams();
  if (pilihan.tanggal) kueri.set("tanggal", pilihan.tanggal);
  const ruas = kueri.toString();
  return gatewayFetch(
    `/internal/aleta-bot/sipp/relaas-massal${ruas ? `?${ruas}` : ""}`,
    { timeoutMs: TIMEOUT_PENILAIAN_MS }
  );
}

/**
 * ============================================================================
 * CETAK RELAAS HARIAN - DOKUMEN YANG LAHIR PADA HARI MENCETAK
 * ============================================================================
 *
 * Berbeda dari RelaasMassalGateway di atas, yang merekap relaas yang SUDAH
 * tercatat di SIPP. Yang ini daftar PEKERJAAN: panggilan dan pemberitahuan
 * yang lahir pada tanggal T - perkara yang didaftarkan atau ditetapkan hari
 * sidangnya pada T, sidang bertanggal T yang punya sidang berikutnya, jadwal
 * yang diinput pada T, dan putusan bertanggal T. "Hari itu" adalah hari
 * MENCETAK, bukan hari sidangnya.
 *
 * golongan, sebabMasuk, dan pihakDipanggil diketik string, BUKAN union -
 * alasan yang sama dengan statusPos di atas: menyatakannya union membuat tsc
 * menganggap cabang "tidak dikenal" di layar tak terjangkau, persis cabang
 * yang dibutuhkan ketika bot suatu hari mengirim nilai kelima.
 */
export type DokumenRelaasCetakGateway = {
  /** `${golongan}:${perkaraId}:${d ?? 0}:${pihakKe ?? 0}` - unik dan stabil. */
  kunci: string;
  perkaraId: number;
  nomorPerkara: string;
  jenisPerkara: string;
  alurPerkaraId: number | null;
  jenisPerkaraId: number | null;
  /** "sidang-pertama" | "sidang-ditunda" | "ikrar-talak" | "pemberitahuan-putusan" */
  golongan: string;
  /** "didaftarkan" | "ditunda" | "jadwal-baru" | "diputus" */
  sebabMasuk: string;
  /** Urutan sidang YANG DIPANGGIL - parameter d pratinjau ABT; null untuk pemberitahuan. */
  d: number | null;
  sidangId: number | string | null;
  /** YYYY-MM-DD atau "". */
  tanggalSidangTujuan: string;
  /** Sidang bertanggal T yang melahirkan dokumen ini; null bila tidak ada. */
  sidangAsalId: number | string | null;
  /** Sandi kehadiran mentah sidang asal - kosongnya berarti. */
  dihadiriOleh: string | number | null;
  /** "keduanya" | "pertama" | "kedua" | "tidak-diketahui" */
  pihakDipanggil: string;
  /** Pemberitahuan: 1/2; null bila satu dokumen per perkara. */
  pihakKe: number | null;
  jurusita: {
    nama: string;
    nip: string;
    /** false berarti tidak ada penunjukan aktif - nama "tidak tercatat". */
    dariPenunjukan: boolean;
  };
  /** true bila sudah tercatat di SIPP; null bila tidak dapat dinilai. */
  sudahAdaRelaas: boolean | null;
  // ---- Ruas tambahan bot sesudah telaah 25 Sep 2026 (di luar kontrak K1;
  // opsional supaya bot lama tetap terbaca) ----
  /** Kalimat keadaan khusus: PHS ulang, sandi 1 yang menyebut panggilan, sidang sesudah putusan. */
  keterangan?: string[];
  /** perkara.proses_terakhir_* SAAT INI - yang diperiksa ABT ketika mencetak. */
  prosesTerakhirId?: number | null;
  prosesTerakhirNama?: string;
  /** Pemberitahuan saja; lewat JOIN status_putusan. */
  statusPutusanId?: number | null;
  statusPutusanNama?: string;
  /** Jumlah baris pihak per sisi; lain = intervensi + turut tergugat. */
  jumlahPihak?: { pertama: number; kedua: number; lain: number } | null;
  /** Baris pihak pada sisi yang DIPANGGIL; null bila pihaknya belum diketahui. */
  jumlahPihakSasaran?: number | null;
  sebutanPihak?: { pertama: string; kedua: string } | null;
  /**
   * Q3 16 Okt: perkara terdaftar lewat e-Court (perkara_efiling_id); null = tidak terbaca, bot lama tidak mengirimnya.
   * Menentukan set blangko relaas e-Court ([JS] 5.1, 5.2, 6.2, 7) di pohon-blangko.ts.
   */
  lewatEcourt?: boolean | null;
  /** Q3 16 Okt: putusan verstek (perkara_putusan.putusan_verstek = 'Y'); pemberitahuan putusan saja. Memilih [JS] 6.2 untuk T e-Court. */
  verstekPutusan?: boolean;
};

export type TidakPerluRelaasCetak = {
  perkaraId: number;
  nomorPerkara: string;
  golongan: string;
  sidangAsalId: number | string | null;
  /** "semua-pihak-hadir" | "sidang-tujuan-tidak-sesudah-hari-cetak" | lainnya - digambar apa adanya bila tak dikenal. */
  sebab: string;
  /** Tambahan: alasan penundaan / agenda / status putusan yang tercatat - supaya dapat diperiksa orang. */
  keterangan?: string;
};

export type TertundaRelaasCetak = {
  perkaraId: number;
  nomorPerkara: string;
  /** "jadwal-pertama-belum-ada" | "hasil-sidang-belum-dicatat" | lainnya yang terukur. */
  sebab: string;
  keterangan: string;
};

export type RelaasCetakGateway = {
  ok: boolean;
  tanggal: string;
  dokumen: DokumenRelaasCetakGateway[];
  tidakPerlu: TidakPerluRelaasCetak[];
  tertunda: TertundaRelaasCetak[];
  /**
   * Tambahan di luar K1: jalan "ditunda" dari tanggal sidang terakhir sebelum
   * T - kelompok tersendiri, TIDAK termasuk `dokumen` maupun ringkas. Tidak ada
   * pada bot lama.
   */
  hariKerjaSebelumnya?: { tanggal: string; dokumen: DokumenRelaasCetakGateway[] };
  ringkas: {
    dokumen: number;
    /** Keempat golongan selalu ada, walau nol. */
    perGolongan: Record<string, number>;
    perJurusita: Record<string, number>;
    tidakPerlu: number;
    tertunda: number;
    sudahAdaRelaas: number;
  };
  catatan: string[];
};

/**
 * Tambahan rute portal atas tiap dokumen - dihitung dari pohon-blangko.ts,
 * satu-satunya tempat nama berkas blangko ditulis.
 */
export type PenilaianCetakRelaas = {
  blangko: { berkas: string; label: string } | null;
  bisaDicetak: boolean;
  /** "" bila bisaDicetak. */
  sebabTidakBisa: string;
  /** Tambahan di luar K2: dapat dicetak tetapi perlu dilihat dulu (lihat nilai-cetak.ts). */
  peringatan?: Array<{ jenis: string; teks: string; tahanPilihSemua: boolean }>;
  ikutPilihSemua?: boolean;
};

export type DokumenRelaasCetakPortal = DokumenRelaasCetakGateway & PenilaianCetakRelaas;

export type RelaasCetakPortal = Omit<RelaasCetakGateway, "dokumen" | "hariKerjaSebelumnya"> & {
  dokumen: DokumenRelaasCetakPortal[];
  hariKerjaSebelumnya?: { tanggal: string; dokumen: DokumenRelaasCetakPortal[] };
};

/**
 * Dokumen relaas yang lahir pada SATU tanggal - bahan tombol Cetak relaas di
 * Antrian Sidang.
 *
 * Batas waktu penilaian, sama dengan rekapnya: jadwal sidang, penetapan hari
 * sidang, putusan, dan penunjukan juru sita disilangkan sekaligus.
 */
export async function getGatewayRelaasCetak(pilihan: {
  /** YYYY-MM-DD. Kosong berarti HARI INI menurut zona pengadilan, diputuskan di bot. */
  tanggal?: string;
}): Promise<GatewayResult<RelaasCetakGateway>> {
  const kueri = new URLSearchParams();
  if (pilihan.tanggal) kueri.set("tanggal", pilihan.tanggal);
  const ruas = kueri.toString();
  return gatewayFetch(
    `/internal/aleta-bot/sipp/relaas-cetak${ruas ? `?${ruas}` : ""}`,
    { timeoutMs: TIMEOUT_PENILAIAN_MS }
  );
}

/** Daftar perkara satu desa - dibaca ketika lingkaran peta diketuk. */
export async function getGatewayPerkaraDesa(pilihan: {
  kelompok: string;
  kode: string;
  /** Golongan bulatan yang diketuk (semua/cerai/dispensasi/itsbat/lainnya) - menggantikan kelompok. */
  golongan?: string;
  periode?: string;
  acuan?: string;
  dari?: string;
  sampai?: string;
}): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams({ kelompok: pilihan.kelompok, kode: pilihan.kode });
  if (pilihan.golongan) kueri.set("golongan", pilihan.golongan);
  if (pilihan.periode) kueri.set("periode", pilihan.periode);
  if (pilihan.acuan) kueri.set("acuan", pilihan.acuan);
  if (pilihan.dari) kueri.set("dari", pilihan.dari);
  if (pilihan.sampai) kueri.set("sampai", pilihan.sampai);
  return gatewayFetch(`/internal/aleta-bot/sipp/peta-perkara/desa?${kueri.toString()}`, {
    timeoutMs: TIMEOUT_PENILAIAN_MS,
  });
}

/** Menu jenis perkara - disusun dari yang sungguh diputus. */
export async function getGatewayPetaPerkaraMenu(): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/sipp/peta-perkara/menu`, {
    timeoutMs: TIMEOUT_PENILAIAN_MS,
  });
}

export async function getGatewayBebanKonseptor(pilihan: {
  periode: string;
  acuan?: string;
  dari?: string;
  sampai?: string;
  dasar?: string;
  rinci?: boolean;
  usulBobot?: boolean;
}): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams({ periode: pilihan.periode });
  if (pilihan.usulBobot) kueri.set("usulBobot", "1");
  if (pilihan.acuan) kueri.set("acuan", pilihan.acuan);
  if (pilihan.dari) kueri.set("dari", pilihan.dari);
  if (pilihan.sampai) kueri.set("sampai", pilihan.sampai);
  if (pilihan.dasar) kueri.set("dasar", pilihan.dasar);
  if (pilihan.rinci === false) kueri.set("rinci", "0");
  // Batas waktu penilaian, bukan batas waktu bawaan delapan detik.
  //
  // Diukur di salinan satker pada mesin yang tidak sedang dibebani: rentang
  // seluruh basis data (9.993 putusan) 7,9 detik, setahun 2,5 detik, sebulan
  // 1,2 detik. Angka pertama itu MELEWATI batas bawaan begitu mesinnya
  // mengerjakan hal lain - dan yang sampai ke petugas bukan "lambat"
  // melainkan "tidak berhasil", persis kekeliruan yang sudah diperbaiki pada
  // penilaian lanjutan.
  //
  // Enam puluh detik dipilih dengan alasan yang sama seperti penilaian
  // lanjutan: yang menyerah lebih dulu harus batas waktu kueri di sisi bot,
  // supaya sebab yang sampai ke pengawas adalah kueri mana yang lambat, bukan
  // "bot tidak menjawab".
  return gatewayFetch(`/internal/aleta-bot/sipp/konseptor?${kueri.toString()}`, {
    timeoutMs: TIMEOUT_PENILAIAN_MS,
  });
}

/**
 * Bahan penyusun perintah putusan.
 *
 * Hanya bahannya; perangkaiannya di layar, supaya penyusun melihat
 * hasilnya berubah tiap kali ia mengubah pilihan.
 */
export async function getGatewayPromptPutusan(
  nomorPerkara: string
): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams({ nomor: nomorPerkara });
  return gatewayFetch(`/internal/aleta-bot/sipp/prompt-putusan?${kueri.toString()}`);
}

export async function getGatewayAntrianSidang(): Promise<GatewayResult<AntrianSidangGateway>> {
  return gatewayFetch("/internal/aleta-bot/antrian/sidang");
}

export type KehadiranBaris = {
  peran: string;
  urutanPihak: string;
  sebagaiKuasa: boolean;
  nama: string;
  sisi: string;
  sumber: string;
  waktuHadir: string;
  jam: string;
  /** "Kuasa Penggugat II", "Turut Tergugat I" - disusun bot, dipakai apa adanya. */
  sebutan: string;
  /** F3.2 (bot 17 Okt 2026 ke atas): kunci baris, saksi siapa, jam pulang, jam diperiksa. */
  id?: string;
  saksiUntuk?: string;
  pulangJam?: string;
  diperiksaJam?: string;
};

export type PeranAntrian = { kunci: string; label: string; sisi: string };

/** Peran yang dapat hadir, untuk menyusun pilihan di layar pengambilan. */
export async function getGatewayPeranAntrian(): Promise<
  GatewayResult<{ ok: boolean; peran: PeranAntrian[] }>
> {
  return gatewayFetch("/internal/aleta-bot/antrian/peran");
}

/**
 * Mencatat satu kehadiran, lalu mengisi waktu ambil bila masih kosong.
 *
 * Inilah yang melahirkan nomor antrian. Kedatangan kedua pada sisi yang sama
 * tetap tercatat tetapi TIDAK mengubah nomornya.
 */
export async function catatKehadiranAntrian(params: {
  perkaraId: string;
  nomorPerkara: string;
  peran: string;
  urutanPihak: string;
  sebagaiKuasa: boolean;
  nama: string;
  sisi?: string;
  waChatId?: string;
  dicatatOleh: string;
  /** F3.2: saksi siapa - pihak_1 / pihak_2. */
  saksiUntuk?: string;
}): Promise<
  GatewayResult<{ ok: boolean; alasan?: string; antrianDiisi: boolean; sebutan: string; sisi: string }>
> {
  return gatewayFetch("/internal/aleta-bot/antrian/hadir", {
    method: "POST",
    body: JSON.stringify({ ...params, sumber: "aleta" }),
  });
}

/**
 * F3.2: kehadiran rinci per orang untuk satu/lebih perkara pada satu tanggal
 * (bawaan hari ini). Hanya membaca.
 */
export async function getGatewayKehadiranRinci(params: {
  perkaraId: string[];
  tanggal?: string;
}): Promise<
  GatewayResult<{ ok: boolean; kehadiran: Record<string, { hadir: KehadiranBaris[]; pertama: KehadiranBaris | null }> }>
> {
  const kueri = new URLSearchParams({ perkaraId: params.perkaraId.join(",") });
  if (params.tanggal) kueri.set("tanggal", params.tanggal);
  return gatewayFetch(`/internal/aleta-bot/antrian/kehadiran?${kueri.toString()}`);
}

/** F3.2: menandai satu orang pulang / kembali / saksi diperiksa. Nomor antrian tidak bergeser. */
export async function ubahKeadaanKehadiran(params: {
  perkaraId: string;
  id: string;
  keadaan: "pulang" | "kembali" | "diperiksa" | "belum-diperiksa";
  oleh: string;
}): Promise<GatewayResult<{ ok: boolean; alasan?: string; keadaan?: string }>> {
  return gatewayFetch("/internal/aleta-bot/antrian/kehadiran/keadaan", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/**
 * MEMBATALKAN kehadiran satu sisi, lalu mengosongkan waktu ambilnya.
 *
 * Urutan antrian menyusul dengan sendirinya - waktuAmbil diturunkan dari kolom
 * yang dikosongkan itu. Penggugat 08:00 dan tergugat 09:00, lalu penggugat
 * dibatalkan, membuat perkara itu bergeser mengikuti 09:00.
 *
 * `antrianDikosongkan` false berarti kolomnya memang sudah kosong - bukan
 * kegagalan.
 */
export async function batalkanKehadiranAntrian(params: {
  perkaraId: string;
  nomorPerkara: string;
  sisi: string;
  alasan?: string;
  dibatalkanOleh: string;
}): Promise<
  GatewayResult<{
    ok: boolean;
    alasan?: string;
    pesan?: string;
    antrianDikosongkan: boolean;
    sisi: string;
  }>
> {
  return gatewayFetch("/internal/aleta-bot/antrian/batal-hadir", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/** Memberitahu yang tinggal satu atau dua antrian lagi. */
export async function kirimPemberitahuanAntrian(params: {
  jarak: number;
  terapkan: boolean;
}): Promise<
  GatewayResult<{
    ok: boolean;
    ujiKering: boolean;
    dikirim: number;
    akanDikirim: Array<{ nomorAntrian: number; didepan: number; nama: string; teks: string }>;
  }>
> {
  return gatewayFetch("/internal/aleta-bot/antrian/pemberitahuan", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export type SinkronAntrianGateway = {
  ok: boolean;
  ujiKering: boolean;
  alasan?: string;
  tanggal?: string;
  ditambahkan: number;
  akanDitambah: Array<{ perkaraId: string; nomorPerkara: string; jamSidang: string; majelisKode: string }>;
  dilewati: Array<{ perkaraId: string; nomorPerkara: string; sebab: string }>;
  gagal: Array<{ perkaraId: string; nomorPerkara: string; sebab: string }>;
};

/**
 * Mendaftarkan jadwal sidang satu tanggal ke aplikasi antrian.
 *
 * Jadwalnya diambil bot langsung dari SIPP - portal hanya menyebutkan
 * tanggalnya. Tanpa `terapkan`, yang dijawab hanya daftar apa yang AKAN
 * didaftarkan.
 */
export async function sinkronkanAntrianSidang(params: {
  tanggal: string;
  terapkan: boolean;
  olehSiapa: string;
}): Promise<GatewayResult<SinkronAntrianGateway>> {
  return gatewayFetch("/internal/aleta-bot/antrian/sinkron", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export type RekapBulanSidang = {
  ok: boolean;
  bulan: string;
  awal?: string;
  akhir?: string;
  hari: Array<{ tanggal: string; jumlah: number; jumlahDitunda: number }>;
};

/** Jumlah sidang per hari dalam satu bulan - isi kalender sidang. */
export async function getGatewayKalenderSidang(
  bulan: string
): Promise<GatewayResult<RekapBulanSidang>> {
  const kueri = new URLSearchParams({ bulan });
  return gatewayFetch(`/internal/aleta-bot/sipp/jadwal-sidang/kalender?${kueri.toString()}`);
}

/** Seluruh keterangan satu sidang. */
export async function getGatewayRincianSidang(
  nomor: string,
  sidangId: string
): Promise<GatewayResult<RincianSidang>> {
  const kueri = new URLSearchParams({ nomor, sidangId });
  return gatewayFetch(`/internal/aleta-bot/sipp/jadwal-sidang/rincian?${kueri.toString()}`);
}

/** Konteks ALETA untuk satu perkara, dipakai ekstensi peramban di halaman SIPP. */
export type ArsipPerkaraBaris = {
  nomorPerkara: string;
  perkaraId: string;
  nomorRegister: string;
  dokumen: number;
  adaPdf: number;
  adaWord: number;
  /** adaPdf + adaWord, dihitung peladen supaya yang digambar = yang diurut. */
  berkasAda: number;
  tanpaBerkas: number;
  /** Dokumen yang e-Court sendiri menjawab 404 - tidak dihitung "belum ada". */
  tidakTersedia: number;
  /** Berkas yang benar-benar terbaca di cakram, bukan sekadar tercatat. */
  adaPdfCakram: number;
  adaWordCakram: number;
  /** Tercatat pernah diunduh tetapi lenyap dari cakram - perlu ditarik ulang. */
  berkasHilang: number;
  menungguMajelis: number;
  sudahValid: number;
  berkasPendaftaran: number;
  dihapusRetensi: number;
  terakhirTerlihat: string | null;
};

export type ArsipDokumenBaris = {
  documentKey: string;
  judulDokumen: string;
  jenisDokumen: string;
  peranPengunggah: string;
  statusVerifikasi: string;
  diunggahPada: string | null;
  tanggalSidang: string | null;
  agenda: string;
  adaPdf: boolean;
  adaWord: boolean;
  /**
   * Nama berkas yang sebenarnya - tersimpan pada jalur berkas, bukan pada tabel
   * dokumen. Kosong bila berkasnya tidak terbaca.
   *
   * Tipe lama tidak menyebutnya, sehingga ruas yang SUDAH melintasi jaringan
   * berhenti di gerbang ini dan tidak pernah dapat digambar.
   */
  namaBerkasPdf: string;
  namaBerkasWord: string;
  /** Jumlah berkas yang tercatat tetapi lenyap dari cakram - ANGKA, bukan boolean. */
  berkasHilang: number;
  /** Berkas dokumen ini sengaja dihapus karena masa simpan. */
  dihapusRetensi: boolean;
  /** Kapan e-Court menjawab 404 untuk dokumen ini; null berarti tidak pernah. */
  tidakTersediaPada: string | null;
  tidakTersediaSebab: string;
  ukuranByte: number;
  diberitahukanPada: string | null;
  terakhirTerlihat: string | null;
};

/** Daftar perkara beserta keadaan berkasnya - tabel utama kendali arsip. */
export async function getGatewayArsipPerkara(input: {
  cari?: string;
  belumLengkap?: boolean;
  /** Kunci kolom - lihat KOLOM_URUT_ARSIP di ecourtStoreService bot. */
  urutkan?: string;
  arah?: "naik" | "turun";
  batas?: number;
  mulai?: number;
}) {
  const params = new URLSearchParams({
    cari: input.cari ?? "",
    belumLengkap: input.belumLengkap ? "1" : "0",
    urutkan: input.urutkan ?? "terakhir",
    arah: input.arah ?? "turun",
    batas: String(input.batas ?? 100),
    mulai: String(input.mulai ?? 0),
  });
  return gatewayFetch<{ diperiksaPada: string; total: number; perkara: ArsipPerkaraBaris[] }>(
    `/internal/aleta-bot/ecourt/arsip/perkara?${params.toString()}`
  );
}

/**
 * Mengunggah putusan akhir dan anonimisasinya ke SIPP.
 *
 * Bitanya dikirim base64 - gerbang tidak menerima multipart, dan menambahkan
 * penguraiannya berarti menambah satu pustaka di jalur yang sudah bekerja.
 * Batas badan JSON untuk rute ini dinaikkan tersendiri di app.js bot.
 */
export async function gatewayUnggahPutusanSipp(muatan: {
  perkaraId: string;
  nomorPerkara: string;
  /** Satu slot saja sah: putusan saja, atau anonimisasi saja. */
  putusanBase64?: string;
  anonimisasiBase64?: string;
  olehUsername: string;
  /**
   * Pengguna ALETA yang menekan tombolnya - hanya untuk jejak ALETA
   * (aleta_bot_jejak_penetapan.operator), tidak pernah ditulis ke SIPP.
   */
  operator?: string;
  /**
   * IPv4 peramban petugas (alamatIpPeramban), untuk kolom ipaddress baris
   * audit SIPP. Rute bot membaca badan.ip; kosong berarti tidak diketahui.
   */
  ip?: string;
  /**
   * Peran yang memberi hak unggah putusan (keputusan 9 Okt 2026:
   * super-admin/admin/hakim/ketua/wakil-ketua). Gerbang bot menolak 403 bila
   * kosong atau di luar daftar itu - lapis kedua di belakang rute portal.
   */
  peranPenekan?: string;
}) {
  return gatewayFetch<{
    ok: boolean;
    alasan?: string;
    antrean?: boolean;
    tanggalPutusan?: string;
    berkas?: Array<{
      jenis: string;
      ok: boolean;
      alasan?: string;
      pesan?: string;
      jalur?: string;
      published?: number;
    }>;
  }>("/internal/aleta-bot/sipp/putusan-unggah", {
    method: "POST",
    body: JSON.stringify(muatan),
    // Menulis berkas ke cakram lalu empat baris ke SIPP - lebih lama daripada
    // satu bacaan, dan membatalkannya di tengah meninggalkan berkas yang sudah
    // tertulis tanpa barisnya.
    //
    // Urutan batas MENAIK dari dalam ke luar (kontrak K6): bot 90 dtk per
    // konversi soffice (dua konversi sejajar, periksa mesin 20 dtk) < gerbang
    // 120 dtk < ekstensi 150 dtk. Dahulu 60 dtk - lebih pendek daripada satu
    // konversi bot, jadi gerbang dapat menyerah sementara bot masih menulis.
    timeoutMs: 120000,
  });
}

/** Rincian dokumen satu perkara. */
export async function getGatewayArsipRincian(nomorPerkara: string) {
  const params = new URLSearchParams({ nomor: nomorPerkara });
  return gatewayFetch<{ nomorPerkara: string; dokumen: ArsipDokumenBaris[] }>(
    `/internal/aleta-bot/ecourt/arsip/rincian?${params.toString()}`
  );
}

/** Ringkasan singkat untuk banyak perkara sekaligus - penanda baris di halaman daftar SIPP. */
export async function getGatewaySippRingkasanMassal(nomorPerkara: string[]) {
  return gatewayFetch<{
    diperiksaPada: string;
    ambangMendesakHari: number;
    perkara: Record<string, unknown>;
    // Keadaan perkara yang tidak punya kolomnya sendiri di SIPP - ghaib, izin
    // atasan, verzet, prodeo, kuasa. Inilah yang digambar penanda daftar.
    identitas: Record<string, unknown>;
    // Tabel atau kolom yang tidak terbaca saat menyusun identitas. Kosong
    // berarti seluruh pembacaan berhasil; berisi berarti penanda yang diam
    // BUKAN berarti perkaranya bersih.
    identitasGagal: unknown[];
  }>("/internal/aleta-bot/sipp/ringkasan-massal", {
    method: "POST",
    body: JSON.stringify({ nomorPerkara }),
  });
}

/**
 * Usulan isian blangko ABT.
 *
 * Bentuk jawabannya sengaja longgar - `unknown` untuk isinya - karena yang
 * menyusun daftar variabelnya adalah bot, dan rute portal meneruskannya utuh.
 * Mengetiknya rapat di sini berarti tiap variabel baru menuntut perubahan di
 * tiga tempat sekaligus.
 */
export async function getGatewayAbtUsulan(muatan: {
  nomorPerkara: string;
  /** Nilai variabel ABT 1268 (Upaya Damai Keluarga) - butir 28. */
  upayaDamai?: string;
  /** Keadaan mediasi bila diketahui ekstensi - butir 28. */
  mediasi?: { selesai: boolean; berhasil: boolean };
  sumber?: "semua" | "sipp" | "saksi" | "itsbat" | "saksi-sdg" | "posita-lain" | "alasan-posita" | "pertanyaan-saksi" | "isi-jawaban";
  /** Isian blangko perkara itu (kode -> {nilai, keyakinan}) dan baris yang diisi (sumber isi-jawaban), 20 Okt 2026. */
  isian?: Record<string, { nilai: string; keyakinan?: string }>;
  saksiIsi?: Array<{ kunci: string; ke: number; modus: string; sumberNama: string; baris: Array<{ kunci: string; tanya: string; jawab: string }> }>;
  /** Minta fakta perkara apa adanya (isi-jawaban), 20 Okt 2026. */
  mintaFakta?: boolean;
  /** Sumber 'pertanyaan-saksi' (12 Okt 2026): aksi daftar/ambil set pertanyaan saksi baku, huruf alasan, tambahan. */
  pertanyaanSaksi?: { aksi?: "daftar" | "ambil"; namaSet?: string; pihak?: string; huruf?: string[]; tambahan?: string[] };
  saksi1?: string;
  saksi2?: string;
  tanggalSidang?: string;
  pelaku?: string;
  lawan?: string;
  /** Sebutan pemohon (variabel 0046) - label itsbat dan perkara lain. */
  pemohon?: string;
  /** Sebutan pemohon kedua pada itsbat nikah dua pemohon. */
  pemohon2?: string;
  /** Kode kumpulan blangko tanya jawab ABT - ikut menentukan varian kalimat. */
  kodeKumpulan?: string;
  /**
   * Jenis perkara (id SIPP atau nama): sumber 'posita-lain', dan syarat bentuk
   * bergender keterangan saksi (data.syarat.jenisPerkaraId).
   */
  jenisPerkara?: string;
  /** Alur perkara - syarat bentuk bergender (data.syarat.alur) dan 'posita-lain'. */
  alur?: string;
  /** Saksi N (K6): sampai enam, berpihak P atau T. */
  saksi?: Array<{
    ke: number;
    pihak: string;
    modus: string;
    sumber: string;
    sumberNama: string;
    alasan: string[];
  }>;
  /** Pengaturan tipe keluaran efektif dari portal (K6). Tanpa ini bot memakai konstanta tertanam. */
  tipeKeluaran?: { versi: string; daftar: Record<string, unknown> };
  /** Gugatannya. Dipakai menyaring alasan yang tidak pernah didalilkan. */
  posita?: string;
  /**
   * Blangko tanya jawab ABT, diambil ekstensi lewat halaman penyunting ABT.
   * jawabMentah = jawaban templat SEBELUM variabelnya diganti ABT
   * ("#1241# / #1242#"): hanya dari situ hubungan dua saksi dipecah dengan
   * pasti, bukan ditebak dari teks yang sudah terganti.
   */
  templat?: Array<{ no: string; tanya: string; jawab: string; jawabMentah?: string }>;
  /** Ciri alasan yang didalilkan - menyaring jawaban tentang penyebab. */
  alasan?: string[];
  /**
   * Modus keterangan tiap saksi: sama, sebagian, tidak-tahu, tidak-melihat,
   * dari-cerita - beserta alasan pilihannya dan siapa yang bercerita.
   */
  modus?: {
    saksi1?: { modus?: string; sumber?: string; sumberNama?: string; alasan?: string[] };
    saksi2?: { modus?: string; sumber?: string; sumberNama?: string; alasan?: string[] };
  };
}) {
  return gatewayFetch<{
    sipp: Record<string, unknown> | null;
    saksi: Record<string, unknown> | null;
    itsbat: Record<string, unknown> | null;
    saksiSdg: Record<string, unknown> | null;
    /** Jawaban yang diisi dari data (sumber 'isi-jawaban'): kunci -> {teks, yakin, sumber, ket}. */
    isiJawaban?: Record<string, { teks: string; yakin: string; sumber: string; ket: string }> | null;
    /** Fakta perkara apa adanya (hanya bila mintaFakta): kunci -> {nilai, yakin, sumber, ket}. */
    faktaPerkara?: Record<string, { nilai: string; yakin: string; sumber: string; ket: string }> | null;
    /** Usulan perkara lain dari posita (sumber 'posita-lain'). */
    positaLain?: Record<string, unknown> | null;
    /**
     * Alasan yang terbaca dari posita (sumber 'alasan-posita', butir 12):
     * { ok, alasan: kunci ciri[], asalPosita: 'ekstensi'|'sipp'|'' }.
     */
    alasanPosita?: { ok: boolean; alasan: string[]; asalPosita: string } | null;
    /** Set pertanyaan saksi baku (sumber 'pertanyaan-saksi'): daftar set atau baris pertanyaan satu set. */
    pertanyaanSaksi?: Record<string, unknown> | null;
    /** Bot sungguh menerima tipeKeluaran; bot lama tidak mengirim ruas ini. */
    tipeKeluaranDiterima?: boolean;
    /** Entri pengaturan yang ditolak penyaring bot atau penyusunnya. */
    tipeKeluaranDitolak?: Array<{ daftar: string; kunci: string; alasan: string; jumlah?: number }>;
    /** Saksi N yang ditolak penyaring bot. */
    saksiDitolak?: Array<{ indeks: number; alasan: string }>;
  }>("/internal/aleta-bot/abt/usulan", {
    method: "POST",
    body: JSON.stringify(muatan),
  });
}

/**
 * Mengubah RTF putusan menjadi PDF lewat LibreOffice di container bot.
 *
 * Isinya dikirim base64 dan tidak disimpan di mana pun di jalur ini.
 */
/**
 * Merapikan posita satu perkara di SIPP.
 *
 * SATU-SATUNYA jalur di ALETA yang menulis ke kolom posita, dan pagarnya di
 * sisi bot: isi tanpa ruang kosong harus persis sama sebelum dan sesudah,
 * sehingga perapian tidak dapat mengubah satu huruf pun dalil gugatan.
 *
 * Posita lama ikut kembali supaya penyimpannya punya yang dapat dikembalikan.
 */
/**
 * Menyambung satu pecahan kata yang ragu pada posita.
 *
 * Yang dikirim hanya perkara dan URUTAN temuannya. Bot yang membaca
 * positanya, menghitung ulang temuannya, dan memutuskan mana yang disambung.
 */
export async function getGatewaySippPositaSambung(perkaraId: string, indeks: number) {
  return gatewayFetch<{ tersentuh: number; disambung: string; sisa: number }>(
    "/internal/aleta-bot/sipp/posita/sambung",
    {
      method: "POST",
      body: JSON.stringify({ perkaraId, indeks }),
    }
  );
}
export async function getGatewaySippPositaRapikan(perkaraId: string, ujiKering: boolean) {
  return gatewayFetch<{
    tersentuh: number;
    berubah: boolean;
    /** Pecahan kata yang disambung kembali - kerusakan data, bukan penataan. */
    disambung: number;
    /** Pecahan berhuruf a-f yang tidak dapat diputuskan mesin. */
    ragu: Array<{ huruf: string; sambungan: string; konteks: string }>;
    sebelum: string;
    sesudah: string;
    alasan: string;
  }>("/internal/aleta-bot/sipp/posita/rapikan", {
    method: "POST",
    body: JSON.stringify({ perkaraId, ujiKering }),
  });
}
/** Keterangan PDF SALINAN dari bot (14 Okt 2026) - lihat salinanPutusanService. */
export type KeteranganSalinanPdf = {
  salinan: string;
  untukSalinan: boolean;
  ttdDitambah: number;
  ttdSudahAda: number;
  namaPanitera: string;
  gambarTtdPanitera: boolean;
  alasanTanpaGambar: string;
  ttdTerdaftar: boolean;
  galatTtd: string;
};

export async function getGatewayAbtPdf(
  rtfBase64: string,
  opsi: { salinan?: boolean; atur?: Record<string, number>; cap?: { jenis: string; isiBase64: string } | null } = {}
) {
  return gatewayFetch<{ pdfBase64: string; byte: number; versiMesin: string; salinan?: KeteranganSalinanPdf }>(
    "/internal/aleta-bot/abt/pdf",
    {
      method: "POST",
      body: JSON.stringify(
        opsi.salinan ? { rtfBase64, salinan: true, ...(opsi.atur ? { atur: opsi.atur } : {}), ...(opsi.cap ? { cap: opsi.cap } : {}) } : { rtfBase64 }
      ),
      // ======================================================================
      // BATAS 8 DETIK TERLALU PENDEK UNTUK MENJALANKAN LibreOffice
      // ======================================================================
      //
      // Batas bawaan pas untuk pemanggilan yang sekadar membaca basis data.
      // Konversi ini bukan itu: soffice yang baru pertama dijalankan sesudah
      // container hidup harus menyiapkan profilnya lebih dulu, dan itu saja
      // dapat sepuluh sampai dua puluh detik. Pemanggilan berikutnya jauh
      // lebih cepat.
      //
      // Dengan batas bawaan, konversi PERTAMA tiap hari akan selalu gagal
      // dengan sebab yang menyesatkan - "bot tidak dapat dihubungi" - padahal
      // botnya sedang bekerja dan hasilnya sebentar lagi datang.
      timeoutMs: TIMEOUT_KONVERSI_MS,
    }
  );
}

/** Menitipkan permintaan penarikan satu perkara dari e-Court. */
export async function titipGatewayEcourtPermintaan(nomorPerkara: string, dimintaOleh: string) {
  return gatewayFetch<{ ok: boolean; alasan: string; keadaan?: Record<string, unknown> }>(
    "/internal/aleta-bot/ecourt/permintaan",
    { method: "POST", body: JSON.stringify({ nomorPerkara, dimintaOleh }) }
  );
}

/** Keadaan permintaan penarikan terakhir untuk satu perkara. */
export async function getGatewayEcourtPermintaan(nomorPerkara: string) {
  const params = new URLSearchParams({ nomor: nomorPerkara });
  return gatewayFetch<{ keadaan: Record<string, unknown> | null }>(
    `/internal/aleta-bot/ecourt/permintaan?${params.toString()}`
  );
}

/**
 * Tarik data SATU perkara dari kepala halaman perkara SIPP (21 Okt 2026).
 * Antrean di sela penarikan utama dan batas laju per perkara dijaga di bot.
 * `paksa` hanya boleh true bila PORTAL sudah memastikan peminta Admin/Super Admin.
 */
export type GatewayTarikSatu = {
  ok?: boolean;
  hasil?: "dimulai" | "diantrekan" | "bergabung" | "segar" | "bukan_ecourt";
  alasan?: string;
  pesan?: string;
  terakhirDetik?: number | null;
  terakhirTeks?: string;
  sisaSegarDetik?: number;
  antrean?: number;
  ada?: boolean;
  tarikan?: Record<string, unknown> | null;
};

export async function mintaGatewayTarikSatu(nomorPerkara: string, olehSiapa: string, paksa: boolean) {
  return gatewayFetch<GatewayTarikSatu>("/internal/aleta-bot/ecourt/tarik-satu", {
    method: "POST",
    body: JSON.stringify({ nomorPerkara, olehSiapa, paksa }),
    timeoutMs: 20000,
  });
}

export async function getGatewayTarikSatu(nomorPerkara: string) {
  const params = new URLSearchParams({ nomor: nomorPerkara });
  return gatewayFetch<GatewayTarikSatu>(`/internal/aleta-bot/ecourt/tarik-satu?${params.toString()}`, { timeoutMs: 8000 });
}

export async function getGatewaySippKonteks(
  nomor: string,
  nama = ""
): Promise<GatewayResult<GatewaySippKonteks>> {
  const params = new URLSearchParams({ nomor, nama });
  return gatewayFetch(`/internal/aleta-bot/sipp/konteks?${params.toString()}`);
}

/** Ejaan Obyek Sengketa yang pernah ditulis satker untuk jenis perkara yang sama. */
export type GatewaySippObyekSengketa = {
  perkaraId: number;
  jenisPerkaraId: number;
  jenisPerkara: string;
  baris: Array<{ obyek: string; jumlah: number }>;
};

/**
 * Kebiasaan satker menulis Obyek Sengketa - dihitung bot dari SIPP, baca saja.
 *
 * Ejaan dipulangkan apa adanya beserta jumlahnya; yang menggabungkan
 * variannya adalah portal (obyek-sengketa-sipp.ts), di tempat yang dapat
 * diuji.
 */
export async function getGatewaySippObyekSengketa(
  nomor: string
): Promise<GatewayResult<GatewaySippObyekSengketa>> {
  const params = new URLSearchParams({ nomor });
  return gatewayFetch(`/internal/aleta-bot/sipp/obyek-sengketa/kebiasaan?${params.toString()}`);
}

/**
 * Fakta SIPP untuk praperiksa putusan - Tahap 2 rencana agen.
 *
 * Bot hanya membaca dan memulangkan apa adanya; yang menimbangnya terhadap
 * draf adalah src/lib/praperiksa-putusan.ts, di tempat yang dapat diuji tanpa
 * basis data.
 */
export type GatewayPraperiksaFakta = {
  ok: boolean;
  alasan: string;
  nomorPerkara: string;
  perkaraId: number;
  jenisPerkara: string;
  jenisPerkaraLengkap: string;
  tanggalDaftar: string;
  /** HTML CKEditor apa adanya. */
  petitum: string;
  pihak: Array<{ nama: string; pihakKe: number | null; peran: string }>;
  anak: string[];
  majelis: Array<{ nama: string; jabatan: string; urutan: number }>;
  panitera: string[];
  jadwal: Array<{ tanggalSidang: string; agenda: string; ditunda: boolean; urutan: number }>;
  putusan: { ada: boolean; tanggalPutusan: string; statusPutusan: string; verstek: string };
  ecourt: { terdaftar: boolean | null; pihak: Array<{ nama: string; peran: string }> };
  libur: { tanggal: string; nama: string } | null;
  hariIni: string;
  tidakTerbaca: string[];
};

export async function getGatewayPraperiksaFakta(
  nomor: string,
  tanggal = ""
): Promise<GatewayResult<GatewayPraperiksaFakta>> {
  const params = new URLSearchParams({ nomor, tanggal });
  return gatewayFetch(`/internal/aleta-bot/sipp/praperiksa-putusan/fakta?${params.toString()}`);
}

/**
 * Daftar ruangan sidang yang dapat dipilih pada penetapan hari sidang,
 * beserta bendera sidang keliling milik SIPP.
 */
/** Satu orang pada daftar pegawai penunjukan - bentuknya sama untuk keduanya. */
export type PegawaiPenunjukan = {
  id: number;
  kode: string;
  nama: string;
};

/**
 * Hakim dan panitera aktif di SIPP - untuk mengikat SK ke orangnya.
 *
 * ============================================================================
 * BENTUKNYA DISEBUTKAN, BUKAN Record<string, unknown>
 * ============================================================================
 *
 * Dahulu bertipe Record<string, unknown>. Itu tampak aman - tidak ada yang
 * dijanjikan - tetapi akibatnya justru sebaliknya: pemanggilnya harus menebak
 * bentuknya, dan tebakan yang ditulis sebagai cast MEMBUNGKAM pemeriksa tipe.
 *
 * Yang terjadi pada rute /api/aleta-ecourt/hakim: ia membaca
 *
 *     (pegawai as { hakim?: unknown })?.hakim
 *
 * padahal gatewayFetch memulangkan { ok, data } - sehingga nilainya SELALU
 * undefined dan daftar hakimnya selalu kosong. Tidak ada galat, tidak ada
 * kalimat di layar; kotak isiannya memang dirancang tetap dapat dipakai tanpa
 * daftar, jadi tidak ada satu pun tanda bahwa ada yang rusak.
 *
 * Bentuknya sekarang disebutkan supaya pemanggil tidak perlu menebak - dan
 * supaya yang menebak keliru ditolak tsc di tempat, bukan berbulan kemudian
 * oleh orang yang mengetik kode hakim dan tidak mendapat apa-apa.
 *
 * Ruasnya dibaca dari sumbernya, penunjukanService.pegawaiPenunjukan:
 *   return { ok: true, hakim: rapikan(hakim), panitera: rapikan(panitera) };
 */
/**
 * Daftar hakim, panitera, dan SK tetap - jarang berubah, dibaca tiap kali
 * layar Jadwal Sidang dan SK Majelis dibuka. Disinggahkan 60 detik
 * (ALETA_SINGGAH_PEGAWAI_MS; mati di lingkungan uji) dan dibuang seketika oleh
 * tulisan apa pun lewat bot - termasuk penyimpanan SK/penunjukan.
 */
export async function gatewayPegawaiPenunjukan() {
  const ttl = ttlDariEnv("ALETA_SINGGAH_PEGAWAI_MS", process.env.NODE_ENV === "test" ? 0 : 60_000);
  return singgahSingkat(
    "pegawai-penunjukan",
    "semua",
    ttl,
    () =>
      gatewayFetch<{
        ok?: boolean;
        hakim?: PegawaiPenunjukan[];
        panitera?: PegawaiPenunjukan[];
        skTetap?: Array<{ nomor: string; tanggal: string }>;
      }>("/internal/aleta-bot/penunjukan/pegawai", {
        method: "GET",
      }),
    { simpanBila: (hasil) => hasil.ok === true }
  );
}

export async function gatewayDaftarRuangan(): Promise<
  GatewayResult<{
    ruangan: {
      id: number;
      kode: string;
      nama: string;
      benderaKeliling: boolean | null;
      aktif: boolean;
    }[];
  }>
> {
  return gatewayFetch("/internal/aleta-bot/penetapan/ruangan");
}

/**
 * Pencocokan arsip e-Court untuk Agen Arsip Bertindak (Tahap 5).
 *
 * Bot membaca catatan arsip dan memeriksa cakram; yang MEMUTUSKAN apakah
 * pantas menarik ulang adalah src/lib/arsip-ecourt-bertindak.ts.
 */
export async function gatewayCocokkanArsip(): Promise<GatewayResult<{ fakta: unknown }>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/arsip/cocokkan");
}

/**
 * Fakta alat bukti untuk Agen Penyusun Pertimbangan (Tahap 4).
 *
 * Bot membaca pihak dan data pernikahan dari SIPP; yang MENYUSUN kalimatnya
 * src/lib/penyusun-pertimbangan.ts, dan yang menyetujuinya petugas.
 */
export async function gatewayFaktaBuktiPertimbangan(nomor: string): Promise<
  GatewayResult<{ fakta: unknown }>
> {
  const params = new URLSearchParams({ nomor });
  return gatewayFetch(`/internal/aleta-bot/sipp/pertimbangan/bukti?${params.toString()}`);
}

/**
 * Fakta tenggat untuk Agen Penjaga Tenggat (Tahap 3).
 *
 * Bot hanya membaca; yang menilai terlampaui atau tidak adalah
 * src/lib/penjaga-tenggat.ts. Tiap pembaca fakta gagal sendiri-sendiri, jadi
 * `gagal` dapat berisi sebagian kode aturan tanpa membuat seluruhnya gagal.
 */
export async function getGatewayPenjagaTenggat(acuan = ""): Promise<
  GatewayResult<{
    acuan: string;
    fakta: Record<string, unknown[]>;
    gagal: Record<string, string>;
  }>
> {
  const params = new URLSearchParams({ acuan });
  return gatewayFetch(`/internal/aleta-bot/sipp/penjaga-tenggat?${params.toString()}`);
}

/**
 * Fakta checklist milestone untuk satu peran - dibatasi bot pada perkara yang
 * menyebut id pejabat pengguna. Yang menilai portal (lib/checklist-milestone).
 */
export async function getGatewayChecklistMilestone(masukan: {
  peran: string;
  acuan: string;
  hakim?: string[];
  panitera?: string[];
  jurusita?: string[];
  perkara?: string[];
}): Promise<
  GatewayResult<{
    acuan: string;
    peran: string;
    fakta: Record<string, unknown>;
    /** Koleksi yang gagal ("putusan") dan peta pelengkap yang gagal di dalamnya ("sidang.panggilan"). */
    gagal: Record<string, string>;
    /** Koleksi yang terpotong batas barisnya - kalimat siap tampil. Bot lama tidak mengirimnya. */
    catatan?: string[];
  }>
> {
  const params = new URLSearchParams({
    peran: masukan.peran,
    acuan: masukan.acuan,
    hakim: (masukan.hakim ?? []).join(","),
    panitera: (masukan.panitera ?? []).join(","),
    jurusita: (masukan.jurusita ?? []).join(","),
    perkara: (masukan.perkara ?? []).join(","),
  });
  // Peran satker membaca belasan ribu baris dalam jendelanya (diukur 4,4
  // detik untuk panitera atas sipp_donggala); batas bawaan 8 detik terlalu
  // rapat untuk peladen yang sedang sibuk.
  return gatewayFetch(`/internal/aleta-bot/sipp/checklist-milestone?${params.toString()}`, {
    timeoutMs: TIMEOUT_PENILAIAN_MS,
  });
}

/**
 * Pendapat AI atas amar vs petitum. Bot menyamarkan nama dengan kamus pihak
 * yang DIKETAHUI SIPP lalu mengirim lewat jalur "perkara"; bila jalurnya
 * belum disetel, jawabannya { ok: false, alasan } - dan itu bukan galat.
 */
export type GatewayPraperiksaPendapat = {
  ok: boolean;
  alasan?: string;
  temuan?: Array<{ judul: string; rincian: string }>;
  catatan?: string[];
  provider?: string;
  model?: string;
  durationMs?: number;
  penyamaran?: { jumlahPenggantian: number; jumlahKamus: number; bersih: boolean };
};

export async function mintaGatewayPraperiksaPendapat(isi: {
  nomorPerkara: string;
  petitum: string;
  amar: string;
  pihak: Array<{ nama: string; pihakKe: number | null; peran?: string }>;
  anak: string[];
}): Promise<GatewayResult<GatewayPraperiksaPendapat>> {
  return gatewayFetch("/internal/aleta-bot/sipp/praperiksa-putusan/pendapat", {
    method: "POST",
    body: JSON.stringify(isi),
    // Satu panggilan model, bukan satu kueri: batas waktu bot untuk penyedia
    // AI sendiri sudah membatasinya; di sini hanya perlu tidak menyerah lebih
    // dulu daripada bot.
    timeoutMs: 45_000,
  });
}

/**
 * Usulan penunjukan PMH, PPP, PJS, dan PHS untuk satu perkara.
 *
 * Aturannya dikirim bersama permintaan, tidak disimpan di bot: hari sidang
 * tiap majelis dan kode panitera penggantinya ada di basis data portal, yang
 * juga menyediakan menu penyuntingnya. Bot hanya tahu SIPP.
 */
/**
 * Menulis satu penetapan ke SIPP atas nama pejabatnya.
 *
 * KERING sebagai bawaan - bot tidak menulis apa pun kecuali `kering: false`
 * dikirim tegas. Nama operator TIDAK boleh datang dari peramban; pemanggil di
 * portal mengisinya dari sesi ALETA yang sedang masuk.
 */
export async function kirimPenetapanTulisGateway(payload: {
  jenis: string;
  perkaraId: number;
  tanggalPenetapan: string;
  hakimId?: number[];
  petugasId?: number;
  tanggalSidang?: string;
  ruanganId?: number;
  jamSidang?: string;
  /** Isian Data Umum - hanya dipakai jenis dataUmum. */
  dataUmum?: Record<string, unknown>;
  /** Akun SIPP petugas yang sedang masuk (nama pada kepala halaman SIPP). */
  olehUsername: string;
  /** Pejabat penanda tangan - hanya untuk jejak ALETA, tidak ditulis ke SIPP. */
  pejabatUsername?: string;
  operator: string;
  kering: boolean;
  /**
   * Jenis penetapan yang ditulis LEBIH DAHULU pada rantai yang sama.
   *
   * Hanya berpengaruh pada uji kering, dan hanya untuk PHS: hari sidang
   * menuntut majelisnya sudah tersimpan, sedangkan uji kering dijalankan
   * sebelum satu baris pun ditulis. Pada penulisan sungguhan ruas ini tidak
   * mengubah apa pun - pagarnya tetap penuh.
   */
  rantaiSebelum?: string[];
  /** Alamat peramban operator, untuk kolom ipaddress sys_audittrail. */
  ip?: string;
}) {
  return gatewayFetch<Record<string, unknown>>("/internal/aleta-bot/penetapan/tulis", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Menulis SISA penetapan satu perkara dalam SATU transaksi (uji rilis U1,
 * 9 Okt 2026): seluruh langkah tertulis, atau tidak satu pun. Hanya penulisan
 * sungguhan. Bot menjalani jeda manusia per langkah, jadi batasnya lebih
 * panjang daripada satu langkah (K6: bot < gerbang 120 dtk < ekstensi 150 dtk).
 */
export async function kirimPenetapanTulisRantaiGateway(payload: {
  perkaraId: number;
  tanggalPenetapan: string;
  olehUsername: string;
  operator: string;
  ip?: string;
  langkah: Array<{
    jenis: string;
    hakimId?: number[];
    petugasId?: number;
    tanggalSidang?: string;
    ruanganId?: number;
    jamSidang?: string;
    pejabatUsername?: string;
  }>;
  /** Keputusan 104: tanya dulu bila di luar jam kerja / pilihan petugas. */
  tanyaJamKerja?: boolean;
  jamKerja?: "antrekan" | "sekarang";
  /** Token kunci perkara yang sudah dipegang pemanggil (kerjakan penetapan); bot memperpanjangnya. */
  kunciToken?: string;
}) {
  return gatewayFetch<Record<string, unknown>>("/internal/aleta-bot/penetapan/tulis-rantai", {
    method: "POST",
    body: JSON.stringify({ ...payload, kering: false }),
    timeoutMs: 120000,
  });
}

/**
 * Membongkar satu penetapan yang sudah tertulis.
 *
 * KERING sebagai bawaan, sama seperti menulis - bot tidak menghapus apa pun
 * kecuali `kering: false` dikirim tegas. Nama operator TIDAK boleh datang dari
 * peramban; pemanggil di portal mengisinya dari sesi ALETA yang sedang masuk.
 */
export async function kirimPenetapanHapusGateway(payload: {
  jenis: string;
  perkaraId: number;
  olehUsername: string;
  akunSippMasuk?: string;
  operator: string;
  kering: boolean;
  ip?: string;
  /** "bongkar" - hanya dikirim tombol Bongkar yang ditekan pengguna; tanpanya bot menolak membongkar sungguhan. */
  perintahPengguna?: string;
}) {
  return gatewayFetch<Record<string, unknown>>("/internal/aleta-bot/penetapan/hapus", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * ============================================================================
 * TANDA TANGAN PEJABAT DAN PENERBITAN DOKUMEN PENETAPAN
 * ============================================================================
 *
 * Tanda tangan disimpan di basis data ALETA, bukan SIPP: ia milik satuan
 * kerja, dipakai lintas perkara, dan tidak punya tempat di skema SIPP.
 */
export async function getGatewayTandaTangan(hanyaSah = false) {
  return gatewayFetch<Record<string, unknown>>(
    `/internal/aleta-bot/tanda-tangan${hanyaSah ? "?hanyaSah=1" : ""}`,
    { method: "GET" }
  );
}

/** Gambarnya mentah - bukan JSON, jadi tidak lewat gatewayFetch. */
export async function ambilGambarTandaTangan(id: number): Promise<Response> {
  const token = getGatewayToken();
  return fetch(`${getGatewayBaseUrl()}/internal/aleta-bot/tanda-tangan/${id}/gambar`, {
    headers: token ? { "x-aleta-internal-token": token } : {},
    cache: "no-store",
  });
}

/**
 * Mengunggah satu tanda tangan baru dari layar.
 *
 * Gambarnya base64 di dalam JSON, dan bot memberi alamat ini batas badan
 * tersendiri (12 MB) - batas umum 1 MB akan menolaknya dengan kalimat yang
 * tidak menyebut gambar mana pun.
 *
 * Yang diunggah TETAP menunggu pengesahan orang kedua.
 */
export async function kirimTandaTanganTambah(payload: {
  isiBase64: string;
  jenisBerkas?: string;
  namaPejabat: string;
  jabatan?: string;
  penggunaId?: string;
  peran?: string;
  subPeran?: string;
  asal?: string;
  oleh: string;
}) {
  return gatewayFetch<Record<string, unknown>>(`/internal/aleta-bot/tanda-tangan/tambah`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function kirimTandaTanganNama(id: number, payload: {
  namaPejabat: string;
  jabatan?: string;
  penggunaId?: string;
  peran?: string;
  subPeran?: string;
  oleh: string;
}) {
  return gatewayFetch<Record<string, unknown>>(`/internal/aleta-bot/tanda-tangan/${id}/nama`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Tautan otomatis berkas tanda tangan bernama ke akun pemiliknya (14 Okt 2026). */
export async function kirimTandaTanganTautkanAkun(id: number, payload: {
  penggunaId: string;
  peran?: string;
  subPeran?: string;
  namaPejabat: string;
}) {
  return gatewayFetch<Record<string, unknown>>(`/internal/aleta-bot/tanda-tangan/${id}/tautkan-akun`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Status sambungan TTE BSrE di bot (19 Okt 2026): hanya {tersambung}; tanpa alamat/rahasia penyedia. */
export async function getGatewayTteStatus() {
  return gatewayFetch<Record<string, unknown>>(`/internal/aleta-bot/tanda-tangan-tte/status`, { method: "GET" });
}

/**
 * Cara tanda tangan + identitas sertifikat (NIK/ID BSrE) satu pejabat.
 * SENGAJA tanpa passphrase di tipe ini: passphrase tidak pernah disimpan atau dikirim.
 */
export async function kirimTandaTanganTte(id: number, payload: { caraTtd: string; nikBsre: string }) {
  return gatewayFetch<Record<string, unknown>>(`/internal/aleta-bot/tanda-tangan/${id}/tte`, {
    method: "POST",
    body: JSON.stringify({ caraTtd: payload.caraTtd, nikBsre: payload.nikBsre }),
  });
}

export async function kirimTandaTanganSahkan(id: number, oleh: string) {
  return gatewayFetch<Record<string, unknown>>(`/internal/aleta-bot/tanda-tangan/${id}/sahkan`, {
    method: "POST",
    body: JSON.stringify({ oleh }),
  });
}

export async function kirimTandaTanganHapus(id: number) {
  return gatewayFetch<Record<string, unknown>>(`/internal/aleta-bot/tanda-tangan/${id}/hapus`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function getGatewayBlangkoPenetapan() {
  return gatewayFetch<Record<string, unknown>>("/internal/aleta-bot/blangko-penetapan/pengaturan", {
    method: "GET",
  });
}

export async function simpanBlangkoPenetapan(payload: Record<string, unknown>) {
  return gatewayFetch<Record<string, unknown>>("/internal/aleta-bot/blangko-penetapan/pengaturan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function terbitkanDokumenPenetapan(payload: {
  perkaraId: number;
  nomorPerkara: string;
  jenis: string;
  namaPenandatangan: string;
  olehUsername: string;
  kering: boolean;
}) {
  return gatewayFetch<Record<string, unknown>>("/internal/aleta-bot/dokumen-penetapan/terbitkan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Membongkar SELURUH rantai penetapan satu perkara dalam satu permintaan.
 *
 * Rantainya diurus bot, bukan di sini: urutannya tidak boleh keliru, dan
 * empat permintaan terpisah dari peramban adalah empat kesempatan berhenti di
 * tengah - perkara yang separuh terbongkar justru yang paling sukar dibereskan.
 */
export async function kirimPenetapanHapusSemuaGateway(payload: {
  perkaraId: number;
  akunPerJenis: Record<string, string>;
  akunSippMasuk?: string;
  operator: string;
  kering: boolean;
  ip?: string;
  /** Lihat kirimPenetapanHapusGateway. */
  perintahPengguna?: string;
}) {
  return gatewayFetch<Record<string, unknown>>("/internal/aleta-bot/penetapan/hapus-semua", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Keadaan penetapan satu perkara - SATU sumber (bot: penetapanKeadaanService)
 * untuk kartu Penetapan, tombol halaman SIPP, dan penanda baris daftar.
 */
export async function bacaKeadaanPenetapanGateway(payload: { perkaraId?: number; nomorPerkara?: string }) {
  return gatewayFetch<Record<string, unknown>>("/internal/aleta-bot/penetapan/keadaan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Mengambil / memperpanjang kunci penetapan satu perkara (masa berlaku di bot). */
export async function ambilKunciPenetapanGateway(payload: {
  perkaraId: number;
  operator: string;
  tujuan?: string;
  ttlDetik?: number;
  /** Token lama yang masih dipegang - diperpanjang, tidak ditolak oleh dirinya sendiri. */
  token?: string;
}) {
  return gatewayFetch<Record<string, unknown>>("/internal/aleta-bot/penetapan/kunci", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function lepasKunciPenetapanGateway(payload: { perkaraId: number; token: string }) {
  return gatewayFetch<Record<string, unknown>>("/internal/aleta-bot/penetapan/kunci/lepas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Riwayat perbuatan ALETA pada penetapan - dari basis data ALETA sendiri.
 *
 * Bukan dari sys_audittrail SIPP. Sejak 1.106.0 tidak ada satu kata pun
 * tentang ALETA yang ditulis ke sana, dan penelusurannya justru menjadi
 * lebih lengkap di sini: percobaan yang DITOLAK ikut tercatat, sedangkan
 * sys_audittrail hanya memuat yang berhasil.
 */
export async function getGatewayJejakPenetapan(payload: {
  perkaraId?: number;
  nomorPerkara?: string;
  batas?: number;
}) {
  const ruas = new URLSearchParams();
  if (payload.perkaraId) ruas.set("perkaraId", String(payload.perkaraId));
  if (payload.nomorPerkara) ruas.set("nomorPerkara", payload.nomorPerkara);
  if (payload.batas) ruas.set("batas", String(payload.batas));
  const tanya = ruas.toString();
  return gatewayFetch<Record<string, unknown>>(
    `/internal/aleta-bot/penetapan/riwayat${tanya ? `?${tanya}` : ""}`,
    { method: "GET" }
  );
}

export async function getGatewayPenunjukanUsulan(payload: {
  nomorPerkara: string;
  pengaturan: {
    aturan: Record<string, unknown>;
    hariSidang: Record<string, number>;
    paniteraMajelis: Record<string, string[]>;
    /** Nama (tanpa gelar) petugas dengan akun portal nonaktif/mutasi - tidak diusulkan sebagai panitera pengganti/juru sita. */
    petugasNonaktif?: string[];
    /**
     * Susunan majelis menurut SK Ketua - kode majelis, kode hakim, dan
     * panitera sidangnya sebagai pasangan kode-orang.
     *
     * Panitera dikirim sebagai id, bukan kode: kode panitera pada SIPP
     * tabrakan - empat orang berbagi kode "D" - sehingga kode tidak dapat
     * menunjuk siapa pun. Lihat migrasi 0044.
     */
    susunanSk?: Record<string, unknown>[];
    /** SK majelis yang berlaku (nomor + tanggal ISO) - tampil di papan dan dipakai memeriksa kesesuaian. */
    sk?: { nomor: string; tanggal: string; berlaku?: string; peringatan?: Array<{ majelisKode: string; kode: string; nama: string; alasan: string }> };
    /** Majelis yang dipilih petugas di papan - id hakim_pn, ketua di depan. */
    pilihanMajelis?: number[];
    /**
     * Perkara di antrean massal yang dianggap sudah tertulis - lihat
     * @/lib/andaian-penunjukan. Paling banyak 25.
     */
    andaian?: Array<{
      perkaraId: number;
      hakimId: number[];
      paniteraId: number;
      jurusitaId: number;
      tanggalSidang: string;
    }>;
  };
}) {
  return gatewayFetch<Record<string, unknown>>("/internal/aleta-bot/penunjukan/usulan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Memeriksa apakah penetapan yang diisikan benar-benar tercatat di SIPP.
 *
 * Dipanggil sesudah Simpan ditekan. Tanpa ini, catatan pengisian hanya
 * membuktikan ALETA mengetik - bukan bahwa pengadilan mencatat.
 */
export async function getGatewayPenunjukanPeriksa(payload: {
  nomorPerkara: string;
  harapan: Record<string, string>;
}) {
  return gatewayFetch<{
    ok: boolean;
    mendarat: string;
    alasan?: string;
    tercatat?: string;
    rinci?: Array<{ jenis: string; diharap: string; tercatat: string; cocok: boolean }>;
  }>("/internal/aleta-bot/penunjukan/periksa", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Kirim saat data lengkap
// ---------------------------------------------------------------------------

export type GatewayKelengkapanDefinisi = {
  key: string;
  saluran: "pegawai" | "pihak";
  kategori: string;
  nama: string;
  keterangan: string;
  syarat: string[];
  boleh: boolean;
  alasan: string;
};

export type GatewayKelengkapanRingkasDefinisi = {
  key: string;
  nama: string;
  saluran: "pegawai" | "pihak";
  boleh: boolean;
  alasan: string;
  perkaraLengkap: number;
  calon: number;
  sudahPernah: number;
  diantrekan: number;
  dilewati: { tanpaNomor: number; tidakCocok: number };
  contoh: Array<{ nomorPerkara: string; nama: string; nomor: string; peran: string; pesan: string }>;
};

export type GatewayKelengkapanHasil = {
  ok: boolean;
  alasan?: string;
  pratinjau: boolean;
  pemicu?: string;
  dijalankanPada?: string;
  lamaMs?: number;
  jendelaHari?: number;
  sippTerbaca?: boolean | null;
  alasanSipp?: string;
  definisi: GatewayKelengkapanRingkasDefinisi[];
};

export type GatewayKelengkapanStatus = {
  ok: boolean;
  aktif: boolean;
  sedangJalan: boolean;
  pengaturan: { enabled: boolean; pegawai: boolean; pihak: boolean; jendelaHari: number; intervalMenit: number };
  terakhirJalan: string | null;
  terakhirPemicu: string;
  terakhirHasil: GatewayKelengkapanHasil | null;
  terakhirGalat: string;
  definisi: GatewayKelengkapanDefinisi[];
};

/** Keadaan pemantau kelengkapan pada bot. */
export async function getGatewayKelengkapanStatus(): Promise<GatewayResult<GatewayKelengkapanStatus>> {
  return gatewayFetch("/internal/aleta-bot/kelengkapan/status");
}

/**
 * Menjalankan pemantau kelengkapan. Pratinjau hanya menyusun daftar; yang
 * sungguhan mengantrekan pesan. Membaca SIPP untuk puluhan perkara, jadi
 * batas waktunya lebih lapang dari panggilan biasa.
 */
export async function runGatewayKelengkapan(payload: {
  pratinjau: boolean;
  olehSiapa: string;
}): Promise<GatewayResult<{ ok: boolean; hasil: GatewayKelengkapanHasil }>> {
  return gatewayFetch("/internal/aleta-bot/kelengkapan/jalankan", {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: 120_000,
  });
}

/** Pengaturan e-Court yang dapat disunting. */
export async function getGatewayEcourtSettings(): Promise<
  GatewayResult<{ ok: boolean; pengaturan: GatewayEcourtSettings }>
> {
  return gatewayFetch("/internal/aleta-bot/ecourt/pengaturan");
}

/** Menyimpan satu aturan pemberitahuan. */
export async function saveGatewayEcourtRule(payload: {
  key: string;
  patterns: string[];
  ringkasan?: string;
  tindakan?: string;
  audience?: string;
  notify?: boolean;
  olehSiapa: string;
}): Promise<GatewayResult<HasilSederhana>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/pengaturan/aturan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Libur tambahan Pengaturan ke bot (salinan; sumbernya simpanan portal). */
export async function gatewayHariLiburTambahan(tambahan: unknown[]): Promise<GatewayResult<{ ok?: boolean; jumlah?: number }>> {
  return gatewayFetch("/internal/aleta-bot/hari-libur/tambahan", {
    method: "POST",
    body: JSON.stringify({ tambahan }),
  });
}

/** Menghapus aturan tambahan, atau mengembalikan kelas bawaan ke bentuk asalnya. */
export async function deleteGatewayEcourtRule(payload: {
  key: string;
  olehSiapa: string;
}): Promise<GatewayResult<HasilSederhana>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/pengaturan/aturan/hapus", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Menyimpan ambang hari. */
export async function saveGatewayEcourtThresholds(payload: {
  ambangMendesakHari: number;
  tanyaUlangHari: number;
  olehSiapa: string;
}): Promise<GatewayResult<HasilSederhana>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/pengaturan/ambang", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Melepas nomor yang pernah dijawab BUKAN agar ditanya ulang. */
export async function resetGatewayNomor(payload: {
  nomor: string;
  namaPihak: string;
  olehSiapa: string;
}): Promise<GatewayResult<HasilSederhana>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/nomor/tanya-ulang", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Keadaan e-Court untuk tab pengelolaan. Hanya membaca. */
export async function getGatewayEcourtStatus(
  options: { limit?: number; dokumenLimit?: number } = {}
): Promise<GatewayResult<{ ok: boolean; status: GatewayEcourtStatus; dokumen: GatewayEcourtDokumen[] }>> {
  const params = new URLSearchParams({
    limit: String(Math.max(1, Math.min(500, Number(options.limit || 100)))),
    dokumenLimit: String(Math.max(1, Math.min(200, Number(options.dokumenLimit || 25)))),
  });
  return gatewayFetch(`/internal/aleta-bot/ecourt/status?${params.toString()}`);
}

/** Menyalakan atau mematikan pemberitahuan e-Court. */
export async function setGatewayEcourtAktif(
  aktif: boolean
): Promise<GatewayResult<{ ok: boolean; aktif: boolean }>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/aktif", {
    method: "POST",
    body: JSON.stringify({ aktif }),
  });
}

/** Ringkasan kerja panitera pengganti. Hanya membaca. */
export async function getGatewayPaniteraDashboard(
  options: { limit?: number } = {}
): Promise<GatewayResult<{ ok: boolean; dashboard: GatewayPaniteraDashboard }>> {
  const params = new URLSearchParams({
    limit: String(Math.max(1, Math.min(500, Number(options.limit || 100)))),
  });
  return gatewayFetch<{ ok: boolean; dashboard: GatewayPaniteraDashboard }>(
    `/internal/aleta-bot/ecourt/panitera?${params.toString()}`
  );
}

export async function queryGatewaySippBridge<T>(
  operation: string,
  params: Record<string, unknown> = {}
): Promise<GatewayResult<GatewaySippBridgeResponse<T>>> {
  return gatewayFetch<GatewaySippBridgeResponse<T>>("/internal/aleta-bot/jlf/sipp/query", {
    method: "POST",
    body: JSON.stringify({ operation, params }),
  });
}

// ---- Worker Control ----

export type GatewayWorkerControlRequest = {
  action: "pause" | "resume" | "status";
  reason?: string;
};

export type GatewayWorkerControlResponse = {
  ok: boolean;
  action: string;
  worker: AletaBotWorkerState;
};

export async function controlGatewayWorker(
  req: GatewayWorkerControlRequest
): Promise<GatewayResult<GatewayWorkerControlResponse>> {
  return gatewayFetch<GatewayWorkerControlResponse>("/internal/aleta-bot/worker/control", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

// ---- Dead Letters ----

export type GatewayDeadLettersResponse = {
  ok: boolean;
  status?: string;
  total: number;
  items: AletaBotDeadLetter[];
};

export type GatewayResendDeadLetterResponse = {
  ok: boolean;
  originalId: string;
  newId: string;
  status: string;
};

export type GatewayResolveDeadLetterResponse = {
  ok: boolean;
  originalId: string;
  status: string;
  item: AletaBotDeadLetter;
};

export async function getGatewayDeadLetters(
  limit = 50,
  status: "active" | "resolved" | "all" = "active"
): Promise<GatewayResult<GatewayDeadLettersResponse>> {
  return gatewayFetch<GatewayDeadLettersResponse>(
    `/internal/aleta-bot/queue/dead-letters?limit=${limit}&status=${encodeURIComponent(status)}`
  );
}

export async function resendGatewayDeadLetter(
  id: string
): Promise<GatewayResult<GatewayResendDeadLetterResponse>> {
  return gatewayFetch<GatewayResendDeadLetterResponse>("/internal/aleta-bot/queue/dead-letters/resend", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}

export async function resolveGatewayDeadLetter(
  id: string,
  note: string,
  resolvedBy: string
): Promise<GatewayResult<GatewayResolveDeadLetterResponse>> {
  return gatewayFetch<GatewayResolveDeadLetterResponse>("/internal/aleta-bot/queue/dead-letters/resolve", {
    method: "POST",
    body: JSON.stringify({ id, note, resolvedBy }),
  });
}

// ---- Phase 5: Legacy migration endpoints ----

export type LegacyNotificationEntry = {
  legacyKey: string;
  feature: string;
  legacyType: string;
  cronSchedule: string;
  riskLevel: string;
  getDataFn: string;
  recipientType: string;
  requiresApproval: boolean;
  canDryRun: boolean;
  status: string;
};

export type LegacyCommandEntry = {
  keywords: string[];
  feature: string;
  type: string;
  hasParam: boolean;
  paramExample?: string;
  migrationTarget: string;
  migrationStatus: string;
  notes?: string;
};

export async function getGatewayLegacyNotifications(): Promise<GatewayResult<{ total: number; notifications: LegacyNotificationEntry[] }>> {
  return gatewayFetch<{ total: number; notifications: LegacyNotificationEntry[] }>("/internal/aleta-bot/legacy/notifications");
}

export async function previewGatewayLegacyNotification(
  legacyKey: string
): Promise<GatewayResult<{ ok: boolean; legacyKey: string; feature: string; dataFn: string; rowCount: number; preview: unknown }>> {
  return gatewayFetch(`/internal/aleta-bot/legacy/notifications/${encodeURIComponent(legacyKey)}/preview`);
}

export async function getGatewayLegacyCommands(): Promise<GatewayResult<{ total: number; totalKeywords: number; entries: LegacyCommandEntry[]; duplicates: unknown[]; duplicateCount: number }>> {
  return gatewayFetch("/internal/aleta-bot/legacy/commands");
}

// ---- Snapshot builder ----

function mapGatewayStatusToRuntime(gatewayStatus: string): string {
  if (gatewayStatus === "connected") return "connected";
  if (gatewayStatus === "qr_needed") return "waiting_qr";
  if (gatewayStatus === "initializing") return "initializing";
  if (gatewayStatus === "browser_locked") return "browser_locked";
  if (gatewayStatus === "auth_failure") return "failed";
  return "disconnected";
}

function mapGatewayStatusToInternal(gatewayStatus: string): string {
  if (gatewayStatus === "connected") return "ready";
  if (gatewayStatus === "qr_needed") return "qr";
  if (gatewayStatus === "initializing") return "initializing";
  if (gatewayStatus === "browser_locked") return "failed";
  if (gatewayStatus === "auth_failure") return "failed";
  return "inactive";
}

export async function buildGatewayWhatsappSnapshot(): Promise<AletaBotSnapshot["whatsapp"]> {
  const [statusResult, qrResult] = await Promise.allSettled([
    getGatewayWhatsappStatus(),
    getGatewayWhatsappQr(),
  ]);

  const statusValue =
    statusResult.status === "fulfilled" ? statusResult.value : { ok: false as const, error: "Gagal menghubungi aleta_bot gateway." };
  const qrValue =
    qrResult.status === "fulfilled" ? qrResult.value : { ok: false as const, error: "Gagal mengambil QR dari aleta_bot." };

  const statusData = statusValue.ok ? (statusValue as { ok: true; data: GatewayStatusResponse }).data : null;
  const qrData = qrValue.ok ? (qrValue as { ok: true; data: GatewayQrResponse }).data : null;

  const gatewayStatus = statusData?.status ?? "disconnected";

  const lastErrorMessage = statusData?.lastError
    ? sanitizePublicErrorMessage(statusData.lastError, statusData.lastError)
    : (!statusValue.ok ? (statusValue as { ok: false; error: string }).error : null);

  return {
    runtimeStatus: mapGatewayStatusToRuntime(gatewayStatus),
    internalStatus: mapGatewayStatusToInternal(gatewayStatus),
    qrCode: qrData?.qr ?? null,
    linked: gatewayStatus === "connected",
    phoneNumber: statusData?.phoneNumber ?? "",
    sessionName: statusData?.sessionName ?? "aleta-whatsapp-main",
    savedStatus: gatewayStatus === "connected" ? "active" : "inactive",
    lastConnectedAt: statusData?.lastConnectedAt ?? null,
    lastErrorMessage,
  };
}

/**
 * ============================================================================
 * KENDALI BERKAS
 * ============================================================================
 *
 * Menyandingkan berkas yang seharusnya ada menurut SIPP dengan arsip e-Court
 * ALETA.
 */

export type GatewayKendaliRun = {
  id: string;
  dimulaiPada: string;
  selesaiPada: string;
  detakPada: string;
  keadaan: string;
  sumber: string;
  target: number;
  diperiksa: number;
  kurang: number;
  gagal: number;
  pesan: string;
};

export type GatewayKendaliRingkasan = {
  ok: boolean;
  perkara: { lengkap?: number; kurang?: number; belum_diperiksa?: number };
  totalPerkara: number;
  totalKurang: number;
  sedangBerjalan: GatewayKendaliRun | null;
  riwayat: GatewayKendaliRun[];
};

export type GatewayKendaliPerkara = {
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalDaftar: string;
  keadaan: string;
  jumlahKurang: number;
  belumTerunduh: number;
  sippTerbaca: boolean;
  alasanTidakTerbaca: string;
  disinkronPada: string;
  rincianKurang: Array<{ jenis: string; jumlah: number; keterangan: string }>;
};

export async function getGatewayKendaliRingkasan(): Promise<GatewayResult<GatewayKendaliRingkasan>> {
  return gatewayFetch<GatewayKendaliRingkasan>("/internal/aleta-bot/kendali-berkas/ringkasan");
}

export async function getGatewayKendaliKurang(
  batas = 100
): Promise<GatewayResult<{ ok: boolean; perkara: GatewayKendaliPerkara[] }>> {
  const kueri = new URLSearchParams({ batas: String(batas) });
  return gatewayFetch(`/internal/aleta-bot/kendali-berkas/kurang?${kueri.toString()}`);
}

/** Satu pertemuan mediasi pada jadwal. */
export type GatewayJadwalMediasi = {
  mediasiId: string;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  tanggal: string;
  jam: string;
  sampaiJam: string;
  tempat: string;
  dihadiri: string;
  ditunda: boolean;
  mediator: string;
  statusMediator: string;
  jenisMediasi: string;
  nomorSk: string;
  penetapanMediator: string;
  laporanMediator: string;
  selesai: boolean;
  hasil: string;
  hasilTeks: string;
  lamaHari: number | null;
  tenggatPerma: string;
  sisaHariTenggat: number | null;
  lewatTenggang: boolean;
  /**
   * Bahan sebutan Penggugat/Pemohon (sebutanPihakPerkara). Opsional: bot
   * yang belum diperbarui tidak mengirimnya, dan layar lalu turun ke nama
   * jenis perkara.
   */
  alurPerkaraId?: number | null;
  jenisPerkaraId?: number | null;
  /** turutTergugat hanya dikirim bot yang memisahkannya (pihak_ke 4). */
  pihak: {
    penggugat: string[];
    tergugat: string[];
    turutTergugat?: string[];
    saksi?: string[];
    lain?: string[];
  };
};

export async function getGatewayJadwalMediasi(params: {
  dari?: string;
  sampai?: string;
  cari?: string;
  batas?: number;
}): Promise<
  GatewayResult<{
    ok: boolean;
    dari: string;
    sampai: string;
    terbaca: boolean;
    alasan: string;
    mediasi: GatewayJadwalMediasi[];
  }>
> {
  const kueri = new URLSearchParams();
  if (params.dari) kueri.set("dari", params.dari);
  if (params.sampai) kueri.set("sampai", params.sampai);
  if (params.cari) kueri.set("cari", params.cari);
  if (params.batas) kueri.set("batas", String(params.batas));
  return gatewayFetch(`/internal/aleta-bot/sipp/jadwal-mediasi?${kueri.toString()}`);
}

/** Satu perkara yang putusannya belum terbit utuh di e-Court. */
export type GatewayPutusanBermasalah = {
  nomorPerkara: string;
  adaBaris: boolean;
  dokumenAda: boolean;
  paniteraTte: boolean;
  nomorPutusan: string;
  diunggahOleh: string;
  tanggalUnggahTeks: string;
  paniteraNama: string;
  diperiksaPada: string;
};

export async function getGatewayPutusanBermasalah(
  batas = 100
): Promise<GatewayResult<{ ok: boolean; perkara: GatewayPutusanBermasalah[] }>> {
  const kueri = new URLSearchParams({ batas: String(batas) });
  return gatewayFetch(`/internal/aleta-bot/kendali-berkas/putusan?${kueri.toString()}`);
}

/**
 * Memulai sinkronisasi kendali berkas.
 *
 * Jawabannya datang seketika - sinkronisasinya sendiri berjalan berjam-jam di
 * dalam bot. Kemajuannya dibaca dari getGatewayKendaliRingkasan, bukan dari
 * jawaban permintaan ini.
 */
export async function mulaiGatewayKendaliSinkron(pilihan: {
  sejak?: string;
  sampai?: string;
  maks?: number;
  hanyaEcourt?: boolean;
  olehSiapa?: string;
}): Promise<GatewayResult<{ ok: boolean; pesan?: string; alasan?: string }>> {
  return gatewayFetch("/internal/aleta-bot/kendali-berkas/sinkron", {
    method: "POST",
    body: JSON.stringify(pilihan),
  });
}

/**
 * ============================================================================
 * KEADAAN AKUN e-COURT DAN SIMPANAN SANDINYA
 * ============================================================================
 *
 * Sandi TIDAK PERNAH melintas di sini. Yang naik ke bot hanya saat menyimpan;
 * yang turun tidak pernah memuatnya, bahkan tidak dalam bentuk tersandi.
 */

export type GatewayKeadaanAkun = {
  slot: string;
  label: string;
  aktif: boolean;
  keadaan: "berlaku" | "kedaluwarsa" | "gerbang" | "belum_pasti" | "belum_pernah";
  labelKeadaan: string;
  berlaku: boolean;
  tersimpan: boolean;
  namaPengguna: string;
  alasan: string;
  diperiksaPada: string;
  dariSimpanan: boolean;
  umurDetik: number | null;
  emailTersimpan: string;
  isiOtomatis: boolean;
  kredensialDiperbaruiPada: string;
};

export async function getGatewayKeadaanAkun(
  penuh = false
): Promise<GatewayResult<{ ok: boolean; akun: GatewayKeadaanAkun[]; segarDetik: number }>> {
  const kueri = penuh ? "?periksa=penuh" : "";
  return gatewayFetch(`/internal/aleta-bot/ecourt/akun/keadaan${kueri}`, {
    // Pemeriksaan sungguhan menyalakan Chrome untuk tiap akun, berurutan.
    timeoutMs: penuh ? TIMEOUT_PERAMBAN_MS : undefined,
  });
}

export async function simpanGatewayKredensial(isi: {
  slot: string;
  email: string;
  sandi: string;
  olehSiapa: string;
}): Promise<GatewayResult<{ ok: boolean; alasan?: string }>> {
  return gatewayFetch("/internal/aleta-bot/ecourt/kredensial", {
    method: "POST",
    body: JSON.stringify(isi),
  });
}

export async function hapusGatewayKredensial(
  slot: string,
  olehSiapa: string
): Promise<GatewayResult<{ ok: boolean; alasan?: string }>> {
  const kueri = new URLSearchParams({ slot });
  return gatewayFetch(`/internal/aleta-bot/ecourt/kredensial?${kueri.toString()}`, {
    method: "DELETE",
    body: JSON.stringify({ olehSiapa }),
  });
}

/**
 * Gerbang ukur daftar deteksi tipe keluaran (K13) - bot hanya MEMBACA SIPP.
 *
 *   ciri     {n, tangkapanTanpa, tangkapanCalon, tangkapanBaru, kalimatCocok, benih, contoh[]}
 *   sebutan  {n, pilihan[], sampel[{perkaraId, pertimbangan, sumberHukumId}]}
 *   padanan  {nama, adaDiSipp, jumlahPerkara, namaSipp[]}
 *
 * Batas waktunya batas penilaian (60 detik): ukur ciri menjalankan pencocok
 * dua kali atas sekitar 1.820 posita, dan sampel sumber hukum memuat 300
 * pertimbangan utuh.
 */
export async function gatewayUkurTipe(muatan: {
  jenis: "ciri" | "sebutan" | "padanan";
  calon?: Array<{ kunci: string; nilai: string; data?: Record<string, unknown> }>;
  dasar?: Array<{ kunci: string; nilai: string; data?: Record<string, unknown> }>;
  benih?: string;
  batas?: number;
  nama?: string;
}) {
  return gatewayFetch<{
    ok: boolean;
    jenis: string;
    alasan?: string;
    n?: number;
    tangkapanTanpa?: number;
    tangkapanCalon?: number;
    tangkapanBaru?: number;
    kalimatCocok?: number;
    /** Kalimat cocok yang tertangkap BARU karena calon, dan berapa di antaranya jadi contoh (didahulukan). */
    kalimatBaru?: number;
    contohBaru?: number;
    benih?: string;
    contoh?: Array<{ id: string; perkaraId: string; kalimat: string; baru: boolean }>;
    dasarAsal?: string;
    ditolak?: Array<{ daftar: string; kunci: string; alasan: string }>;
    pilihan?: Array<{ nilai: string; label: string }>;
    sampel?: Array<{ perkaraId: string; pertimbangan: string; sumberHukumId: string }>;
    nama?: string;
    adaDiSipp?: boolean;
    jumlahPerkara?: number;
    namaSipp?: string[];
  }>("/internal/aleta-bot/sipp/ukur-tipe", {
    method: "POST",
    body: JSON.stringify(muatan),
    timeoutMs: TIMEOUT_PENILAIAN_MS,
  });
}

/* === P4P7B2 10 Okt === */
/**
 * B2/P4/P7 (10 Okt 2026): teks berkas gugatan/jawaban e-Court -> tuntutan,
 * anak, jawab-menjawab, usulan variabel ABT, dan kalimat hakim. Hanya membaca.
 */
export async function postGatewayIsiGugatan(muatan: {
  nomorPerkara: string;
  sebutan: { lawan: string; pelaku: string };
  majelis?: string;
  dokumen: Array<{ judul: string; peran: string; teks: string; baca: "teks" | "ocr"; penuntutKode: string; jenis?: string; pengunggah?: string; diunggah?: string }>;
}) {
  return gatewayFetch<Record<string, unknown>>("/internal/aleta-bot/abt/isi-gugatan", {
    method: "POST",
    body: JSON.stringify(muatan),
    timeoutMs: 30_000,
  });
}
/* === AKHIR P4P7B2 === */

/* === KONTAK-EC 11 Okt === */
/**
 * KONTAK-EC (11 Okt 2026): email & nomor HP/WA pihak dan kuasa dari e-Court
 * (akun e-Court + teks berkas) dibanding isian SIPP. Bot menulis ringkasannya
 * ke aleta_bot_ecourt_ringkasan (dibaca variabel ABT 8800-8811); SIPP/ABT
 * tidak ditulis.
 */
export async function postGatewayKontakEcourt(muatan: {
  nomorPerkara?: string;
  nama?: string;
  dokumen?: Array<{ judul: string; peran: string; teks: string; penuntutKode: string }>;
}) {
  return gatewayFetch<Record<string, unknown>>("/internal/aleta-bot/abt/kontak-ecourt", {
    method: "POST",
    body: JSON.stringify(muatan),
    timeoutMs: 30_000,
  });
}
/* === AKHIR KONTAK-EC === */

/* === STATUS-ZIP 12 Okt === */
export type KontakNilaiPihak = {
  nilai: string;
  lazim: boolean;
  sumber: "sipp" | "ecourt" | "";
  label: string;
  keyakinan?: string;
  lain: Array<{ nilai: string; sumber: string; label: string }>;
};
export type KontakParaPihakBaris = {
  jenis: "pihak" | "kuasa";
  pihakKe: number;
  urutan: number;
  nama: string;
  email: KontakNilaiPihak;
  hp: KontakNilaiPihak & { jenis: string; bisaWhatsApp: boolean };
  elitigasi: {
    status: "ya" | "tidak" | "belum" | "tidak-diketahui" | "tidak-berlaku";
    sumber: string;
    label: string;
    terakhirTerlihat: string | null;
  };
};
export type KontakParaPihak = {
  ok: boolean;
  ada: boolean;
  sebab?: string;
  nomorPerkara?: string;
  lewatEcourt?: boolean;
  ecourtTerbaca?: boolean;
  jumlahPersetujuanEcourt?: number;
  orang: KontakParaPihakBaris[];
};

/** Kontak para pihak layar Status Perkara (butir 12, 12 Okt 2026). Hanya baca. */
export async function getGatewayKontakParaPihak(nomorPerkara: string) {
  const kueri = new URLSearchParams({ nomor: nomorPerkara });
  return gatewayFetch<KontakParaPihak>(`/internal/aleta-bot/sipp/kontak-para-pihak?${kueri.toString()}`, {
    timeoutMs: 20_000,
  });
}
/* === AKHIR STATUS-ZIP === */

/* === PEKERJAAN 11 Okt === */
/**
 * PEKERJAAN (11 Okt 2026): kategori pekerjaan pihak (PNS/TNI/POLRI/BUMN/BUMD/desa; PPPK -> PNS) dari teks
 * bebas SIPP, dibaca bot dengan kamus pekerjaan.json. Baca saja.
 */
export type PekerjaanTerbaca = {
  teks: string;
  kunci: string;
  label: string;
  asal: string;
  kodePola: string;
  yakin: string;
  golongan: string;
  dasar: string;
  pilihanSipp: boolean;
  teksBaku: string;
  kalimat: string;
};

export async function postGatewayPekerjaanTerbaca(muatan: { teks: string[]; perkaraId?: number }) {
  return gatewayFetch<{ ok: boolean; hasil: PekerjaanTerbaca[]; pihak?: unknown[] }>("/internal/aleta-bot/abt/pekerjaan-terbaca", {
    method: "POST",
    body: JSON.stringify(muatan),
    timeoutMs: 15_000,
  });
}
/* === AKHIR PEKERJAAN === */

/* === KTP-PIHAK 12 Okt === */
/**
 * KTP-PIHAK (12 Okt 2026): tanggal KTP pihak dari berkas KTP e-Court. Portal
 * membaca (pdfjs + tesseract), bot mencocokkan ke pihak SIPP dan menyimpan di
 * aleta_bot_ktp_pihak (dibaca variabel ABT 8870-8872). Lihat
 * modules/aleta-ecourt/ktp-pihak.ts dan aleta_bot ktpPihakService.
 */
export type BerkasKtpAntri = {
  fileId: string;
  documentKey: string;
  format: string;
  ukuran: number;
  nomorPerkara: string;
  judul: string;
  /** 13 Okt 2026: berkas bukan berjudul KTP ("Dokumen Bukti") - dibaca ketat, hanya halaman berciri KTP. */
  ketat?: boolean;
};

export type KtpTerbaca = {
  nik: string;
  nikSah: boolean;
  nama: string;
  /** dd/mm/yyyy */
  tanggalLahir: string;
  /** dd/mm/yyyy - tanggal KTP dikeluarkan */
  tanggalTerbit: string;
  kotaTerbit: string;
  /** 12OKT-M: "Berlaku Hingga" - "seumur_hidup" | "dd/mm/yyyy" | "" (tidak terbaca). */
  berlakuHingga?: string;
  sumber?: string;
};

export type HasilBacaKtpPihak = {
  fileId: string;
  status: "terbaca" | "tidak_terbaca" | "bukan_ktp";
  sebab: string;
  sumber: string;
  versi: number;
  ktp: KtpTerbaca[];
  /** Siapa yang memicu bacaan ini (catatan histori): penyapu latar, panel ABT, atau tombol Admin. */
  pemicu?: "latar" | "panel" | "manual";
};

export type KtpPihakPerkara = {
  ok: boolean;
  ada: boolean;
  perkaraId: number | null;
  nomorPerkara: string;
  pihak: Array<{
    cabang: number;
    urutan: number;
    peran: string;
    nama: string;
    /** Nama pihak di SIPP (bot 12 Okt ke atas); dipakai Status Perkara mencocokkan per pihak. */
    namaSipp?: string;
    tanggalKtp: string;
    tanggalKtpIso: string;
    kota: string;
    /** 12OKT-M: "seumur_hidup" | "dd/mm/yyyy" | "" (tidak terbaca) - penanda KTP Elektronik (ABT 11114). */
    berlakuHingga?: string;
    yakin: "pasti" | "cukup" | "ragu" | "";
    cocok: string;
    sebab: string;
    sumberBaca: string;
    fileId: string;
  }>;
  dokumenKtp: number;
  belumDibaca: number;
  tidakTerbaca: number;
  takBertuan: number;
};

export async function getGatewayAntrianKtp(params: { nomor: string[]; batas: number; versi?: number }) {
  const kueri = new URLSearchParams({ nomor: params.nomor.join("|"), batas: String(params.batas) });
  if (params.versi) kueri.set("versi", String(params.versi));
  return gatewayFetch<{ ok: boolean; berkas: BerkasKtpAntri[]; versi: number }>(
    `/internal/aleta-bot/sipp/ktp-pihak/antrian?${kueri.toString()}`,
    { timeoutMs: 20_000 }
  );
}

export async function ambilBerkasKtpGateway(fileId: string, signal?: AbortSignal): Promise<Response> {
  const token = getGatewayToken();
  return fetch(`${getGatewayBaseUrl()}/internal/aleta-bot/sipp/ktp-pihak/berkas?${new URLSearchParams({ fileId }).toString()}`, {
    headers: token ? { "x-aleta-internal-token": token } : {},
    cache: "no-store",
    signal: signal ?? AbortSignal.timeout(30_000),
  });
}

export async function kirimHasilKtpGateway(hasil: HasilBacaKtpPihak[]) {
  return gatewayFetch<{ ok: boolean; tersimpan: number; kembaran: number }>("/internal/aleta-bot/sipp/ktp-pihak", {
    method: "POST",
    body: JSON.stringify({ hasil }),
    timeoutMs: 60_000,
  });
}

export async function getGatewayKtpPerkara(nomorPerkara: string) {
  const kueri = new URLSearchParams({ nomor: nomorPerkara });
  return gatewayFetch<KtpPihakPerkara>(`/internal/aleta-bot/sipp/ktp-pihak/perkara?${kueri.toString()}`, { timeoutMs: 20_000 });
}
/* === AKHIR KTP-PIHAK === */

/* === OCR-ECOURT 19 Okt === lampiran e-Court (KK, akta, surat keterangan, surat kuasa) - lihat modules/aleta-ecourt/lampiran-ecourt.ts */
export type BerkasLampiranAntri = { fileId: string; format: string; ukuran: number; nomorPerkara: string; judul: string };

export type HasilBacaLampiran = {
  fileId: string;
  status: "terbaca" | "tidak_terbaca";
  sebab: string;
  versi: number;
  /** Teks per halaman; bot mengurai medannya lalu membuang teksnya (tidak disimpan). */
  halaman: Array<{ teks: string; sumber: "teks-pdf" | "ocr" }>;
  lamaMs: number;
};

export async function getGatewayAntrianLampiran(params: { nomor: string[]; batas: number }) {
  const kueri = new URLSearchParams({ nomor: params.nomor.join("|"), batas: String(params.batas) });
  return gatewayFetch<{ ok: boolean; berkas: BerkasLampiranAntri[]; versi: number }>(`/internal/aleta-bot/sipp/lampiran-ecourt/antrian?${kueri.toString()}`, {
    timeoutMs: 20_000,
  });
}

export async function ambilBerkasLampiranGateway(fileId: string, signal?: AbortSignal): Promise<Response> {
  const token = getGatewayToken();
  return fetch(`${getGatewayBaseUrl()}/internal/aleta-bot/sipp/lampiran-ecourt/berkas?${new URLSearchParams({ fileId }).toString()}`, {
    headers: token ? { "x-aleta-internal-token": token } : {},
    cache: "no-store",
    signal: signal ?? AbortSignal.timeout(30_000),
  });
}

export async function kirimHasilLampiranGateway(hasil: HasilBacaLampiran[]) {
  return gatewayFetch<{ ok: boolean; tersimpan: number; halamanBermedan: number }>("/internal/aleta-bot/sipp/lampiran-ecourt", {
    method: "POST",
    body: JSON.stringify({ hasil }),
    timeoutMs: 60_000,
  });
}
/* === AKHIR OCR-ECOURT === */

/* === TAHAP L2 16 Okt: SIPP DENGAN IDE ALETA - SEPULUH PENANDA === */
/** Satu penanda dari bot (aleta_bot/services/sippIdeL2Service.js) - teks dan dasarnya dari bot. */
export type PenandaIdeL2 = {
  kode: string;
  tingkat: "merah" | "oranye" | "kuning" | "biru" | "abu" | "hijau";
  label: string;
  jelas: string;
  dasar: string;
  sumber: string;
  perluDicek: boolean;
  angka?: number;
  hanyaDetil?: boolean;
};

export type PenandaIdeL2Jawaban = {
  ok: boolean;
  kini: { tanggal: string; menit: number } | null;
  perkara: Record<string, { perkaraId: number; penanda: PenandaIdeL2[] }>;
  terbaca: Record<string, boolean>;
  tidakDikenal: string[];
};

/** Penanda L2 untuk nomor-nomor perkara di halaman SIPP. SIPP hanya dibaca. */
export async function postGatewayPenandaIdeL2(nomorPerkara: string[]) {
  return gatewayFetch<PenandaIdeL2Jawaban>("/internal/aleta-bot/sipp/ide-l2/penanda", {
    method: "POST",
    body: JSON.stringify({ nomorPerkara }),
    timeoutMs: 25_000,
  });
}

/** Perkara belum putus yang lewat 5 bulan (SEMA 2/2014), seluruh satker. */
export async function getGatewayLimaBulanIdeL2() {
  return gatewayFetch<{ ok: boolean; jumlah: number; daftar: Array<{ nomor: string; hari: number; lewat: number }>; dasar: string }>(
    "/internal/aleta-bot/sipp/ide-l2/lima-bulan",
    { timeoutMs: 25_000 }
  );
}
/* === AKHIR TAHAP L2 === */

/* === 17OKT-F41: UNGGAH MASSAL e-DOC (putusan & BAS) === */
export type UnggahMassalPutusanBot = {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  alurPerkaraId: number;
  tanggalPutusan: string;
  statusPutusan: string;
  verstek: boolean;
  adaPutusan: boolean;
  adaAnonim: boolean;
  majelis: string[];
  panitera: string[];
  /** Bahan pemilih blangko putusan (audit D3). Bot lama tidak mengirimnya - semuanya opsional. */
  kumulasi?: { daftar?: Array<{ kode?: string }> | string[] } | null;
  kumulasiTerbaca?: boolean;
  dihadiriOleh?: number | null;
  panggilan?: { hadirSebelumnya?: number | null; tergugatPernahHadir?: boolean; penggugatPernahHadir?: boolean | null } | null;
  mediasi?: { hasil?: string } | null;
  mediasiTerbaca?: boolean;
  /** I7 17 Okt: bahan varian blangko putusan (hak asuh: Tergugat ibu; HB: potongan amar "Dalam Rekonvensi"). */
  tergugatPerempuan?: boolean | null;
  amarRekonvensi?: string;
  /** I20 18 Okt: dikabulkan untuk sebagian menurut amar (hak asuh, penguasaan anak, nafkah anak); null = tidak diketahui. */
  dikabulkanSebagian?: boolean | null;
  /** I22 18 Okt: petitum memohon pencairan dana (PAW, itsbat kontensius) / nafkah istri (cerai gugat); null = tidak diketahui. */
  pencairanDana?: boolean | null;
  kumulasiNafkahIstri?: boolean | null;
  /** I23 18 Okt: petitum hak asuh juga memuat nafkah (anak); null = tidak diketahui. */
  plusNafkahAnak?: boolean | null;
  /** I28 18 Okt: Lain-Lain Pdt.P yang petitum/posita-nya menyebut mafqud / orang hilang (penetapan mafqud); null = tidak diketahui. */
  mafqud?: boolean | null;
};
export type UnggahMassalTertahanBot = { perkaraId: string; nomorPerkara: string; tanggalSidang: string; majelis: string[] };
export type UnggahMassalBasBot = {
  sidangId: string;
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  alurPerkaraId: number;
  urutan: number;
  tanggalSidang: string;
  agenda: string;
  ditunda: boolean;
  alasanDitunda: string;
  ikrar: boolean;
  /** Butir 43 (17 Okt): hanya terisi bila diminta basAda - e-Doc BAS sudah ada (tombol Ganti). */
  adaBas?: boolean;
  jalurBas?: string;
  panitera: string[];
  majelis: string[];
  saksiAbt: { saksi: number; tanyaJawab: number } | null;
};
export type UnggahMassalDaftarBot = {
  ok: true;
  hariIni: string;
  sejak: string;
  putusan: UnggahMassalPutusanBot[] | null;
  tertahan: UnggahMassalTertahanBot[] | null;
  bas: UnggahMassalBasBot[] | null;
  abtTerbaca: boolean;
  galat: Array<{ sumber: string; langkah: string; sebab: string }>;
};

/** e-Doc putusan/BAS yang menunggu diunggah, seluruh satker (SELECT saja). */
export async function getGatewayUnggahMassalDaftar(sejakHari?: number, basAda = false) {
  const kueri = new URLSearchParams();
  if (sejakHari) kueri.set("sejak", String(sejakHari));
  if (basAda) kueri.set("basAda", "1"); // butir 43: BAS yang sudah ada ikut (tombol Ganti)
  const q = kueri.toString() ? `?${kueri.toString()}` : "";
  return gatewayFetch<UnggahMassalDaftarBot>(`/internal/aleta-bot/sipp/unggah-massal/daftar${q}`, { timeoutMs: 30_000 });
}

/** Keadaan satu e-Doc saat ini - cek dobel tepat sebelum unggah (SELECT saja). */
export async function getGatewayUnggahMassalCek(p: { jenis: "putusan" | "bas"; perkaraId: string; sidangId?: string }) {
  const q = new URLSearchParams({ jenis: p.jenis, perkaraId: p.perkaraId, sidangId: p.sidangId ?? "" });
  return gatewayFetch<Record<string, unknown> & { ok: true }>(`/internal/aleta-bot/sipp/unggah-massal/cek?${q.toString()}`, {
    timeoutMs: 15_000,
  });
}

/**
 * Unggah e-Doc BAS satu sidang (MENULIS: berkas + perkara_jadwal_sidang.edoc_bas).
 * peranPenekan = golongan yang memberi hak (admin/panitera/panmud/pp/analis); bot menolak 403 selain itu.
 */
export async function gatewayUnggahBasSipp(muatan: {
  perkaraId: string;
  sidangId: string;
  nomorPerkara: string;
  basBase64: string;
  olehUsername: string;
  operator?: string;
  ip?: string;
  peranPenekan: string;
  /** 17 Okt (audit A4): portal sudah memastikan akun ini petugas perkara itu (PP). */
  milikPerkara?: boolean;
  ganti?: boolean;
}) {
  return gatewayFetch<{ ok: true; jalur: string; nama: string; urutan: number; bentuk: string; diganti: boolean; jalurLama: string }>(
    "/internal/aleta-bot/sipp/bas-unggah",
    { method: "POST", body: JSON.stringify(muatan), timeoutMs: 60_000 }
  );
}
/* === AKHIR 17OKT-F41 === */

/* === 17OKT-F16: keadaan perkara untuk checklist konseptor (SELECT saja) === */
export type KeadaanKonseptorBot = {
  nomorPerkara: string;
  eksepsi: boolean;
  rekonvensi: boolean;
  sela: boolean;
  majelis: Array<{ nama: string; jabatan: string }>;
  konseptor: Array<{ pengguna: string; nama: string }>;
};
export async function getGatewayKonseptorKeadaan(perkaraId: string[]) {
  const q = new URLSearchParams({ perkaraId: perkaraId.slice(0, 500).join(",") });
  return gatewayFetch<{ ok: true; perkara: Record<string, KeadaanKonseptorBot>; gagal: Array<{ bagian: string; sebab: string }> }>(
    `/internal/aleta-bot/sipp/konseptor-keadaan?${q.toString()}`,
    { timeoutMs: 15_000 }
  );
}
/* === AKHIR 17OKT-F16 === */

