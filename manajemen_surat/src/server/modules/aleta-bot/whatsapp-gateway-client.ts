import type { AletaBotSnapshot, AletaBotDeadLetter, AletaBotWorkerState } from "@/lib/aleta-bot-types";
import { sanitizePublicErrorMessage } from "@/server/shared/error-sanitizer";

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
  | { ok: false; error: string };

async function gatewayFetch<T>(
  path: string,
  options: GatewayOptions = {}
): Promise<GatewayResult<T>> {
  const { timeoutMs, ...permintaan } = options;
  const batas = timeoutMs ?? getGatewayTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), batas);

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
        error: `aleta_bot tidak merespons dalam ${getGatewayTimeoutMs()}ms. Periksa status layanan.`,
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
  format: "pdf" | "word"
): Promise<Response> {
  const params = new URLSearchParams({ documentKey, format });
  const token = getGatewayToken();
  return fetch(`${getGatewayBaseUrl()}/internal/aleta-bot/sipp/berkas?${params.toString()}`, {
    headers: token ? { "x-aleta-internal-token": token } : {},
    cache: "no-store",
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
  id: string
): Promise<Response> {
  const params = new URLSearchParams({ jenis, id });
  const token = getGatewayToken();
  return fetch(
    `${getGatewayBaseUrl()}/internal/aleta-bot/sipp/berkas-perkara?${params.toString()}`,
    {
      headers: token ? { "x-aleta-internal-token": token } : {},
      cache: "no-store",
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
  };
  berjalan: boolean;
  sedangJalan: boolean;
  dalamJamKerja: boolean;
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
};

/** Daftar akun e-Court beserta keadaan sesinya. */
export async function getGatewayEcourtAkun(): Promise<
  GatewayResult<{ ok: boolean; akun: GatewayEcourtAkun[] }>
> {
  return gatewayFetch("/internal/aleta-bot/ecourt/akun");
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
  urutanSidang: number;
  /** 1 semua pihak, 2 penggugat saja, 3 tergugat saja, 4 tidak hadir. */
  dihadiriOleh: number | null;
  adaBas: boolean;
  pihak: { penggugat: string[]; tergugat: string[]; saksi?: string[]; lain?: string[] };
  panggilan: {
    hadirSebelumnya: number | null;
    /** Tergugat/termohon pernah hadir pada sidang mana pun sebelumnya. Sejak bot 2.19.4. */
    tergugatPernahHadir?: boolean;
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
};

export type RincianSidang = {
  ok: boolean;
  alasan: string;
  nomorPerkara: string;
  jenisPerkara: string;
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
    pihak: KeadaanPanggilanPihak[];
    ringkasan: {
      jumlahPihak: number;
      belumDipanggil: number;
      salahSaluran: number;
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
  batas?: number;
};

export type HasilCariPerkara = {
  ok: boolean;
  perkara: Array<Record<string, unknown>>;
  pilihanStatus?: Array<{ kunci: string; label: string }>;
  pilihanRelaas?: Array<{ kunci: string; label: string }>;
  pilihanPutusan?: string[];
  pilihanAlur?: Array<{ id: number; label: string }>;
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

  return gatewayFetch(`/internal/aleta-bot/sipp/status-perkara/cari?${kueri.toString()}`, {
    timeoutMs: TIMEOUT_PERAMBAN_MS,
  });
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

/** Daftar sidang pada rentang tanggal, dibaca dari SIPP. */
export async function getGatewayJadwalSidang(params: {
  dari: string;
  sampai: string;
  cari: string;
  batas: number;
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
      peta: Record<string, Record<string, unknown>>;
    };
  }>
> {
  const kueri = new URLSearchParams({
    dari: params.dari,
    sampai: params.sampai,
    cari: params.cari,
    batas: String(params.batas),
  });
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
  isi: Record<string, unknown>
): Promise<GatewayResult<Record<string, unknown>>> {
  return gatewayFetch(`/internal/aleta-bot/sidang/tunda`, {
    method: "POST",
    body: JSON.stringify(isi),
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
}): Promise<
  GatewayResult<{ ok: boolean; alasan?: string; antrianDiisi: boolean; sebutan: string; sisi: string }>
> {
  return gatewayFetch("/internal/aleta-bot/antrian/hadir", {
    method: "POST",
    body: JSON.stringify({ ...params, sumber: "aleta" }),
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
  tanpaBerkas: number;
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
  ukuranByte: number;
  diberitahukanPada: string | null;
  terakhirTerlihat: string | null;
};

/** Daftar perkara beserta keadaan berkasnya - tabel utama kendali arsip. */
export async function getGatewayArsipPerkara(input: {
  cari?: string;
  belumLengkap?: boolean;
  urutkan?: string;
  batas?: number;
  mulai?: number;
}) {
  const params = new URLSearchParams({
    cari: input.cari ?? "",
    belumLengkap: input.belumLengkap ? "1" : "0",
    urutkan: input.urutkan ?? "terbaru",
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
  putusanBase64: string;
  anonimisasiBase64: string;
  olehUsername: string;
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
    timeoutMs: 60000,
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
  sumber?: "semua" | "sipp" | "saksi" | "itsbat" | "saksi-sdg";
  saksi1?: string;
  saksi2?: string;
  tanggalSidang?: string;
  pelaku?: string;
  lawan?: string;
  /** Sebutan pemohon kedua pada itsbat nikah dua pemohon. */
  pemohon2?: string;
  /** Gugatannya. Dipakai menyaring alasan yang tidak pernah didalilkan. */
  posita?: string;
  /** Templat tanya-jawab ABT, diambil ekstensi lewat halaman penyunting ABT. */
  templat?: Array<{ no: string; tanya: string; jawab: string }>;
  /** Ciri alasan yang didalilkan - menyaring jawaban tentang penyebab. */
  alasan?: string[];
  /**
   * Modus keterangan tiap saksi: sama, sebagian, tidak-tahu, tidak-melihat,
   * dari-cerita - beserta alasan pilihannya dan siapa yang bercerita.
   */
  modus?: {
    saksi1?: { modus?: string; sumber?: string; alasan?: string[] };
    saksi2?: { modus?: string; sumber?: string; alasan?: string[] };
  };
}) {
  return gatewayFetch<{
    sipp: Record<string, unknown> | null;
    saksi: Record<string, unknown> | null;
    itsbat: Record<string, unknown> | null;
    saksiSdg: Record<string, unknown> | null;
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
export async function getGatewayAbtPdf(rtfBase64: string) {
  return gatewayFetch<{ pdfBase64: string; byte: number; versiMesin: string }>(
    "/internal/aleta-bot/abt/pdf",
    {
      method: "POST",
      body: JSON.stringify({ rtfBase64 }),
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
/** Hakim dan panitera aktif di SIPP - untuk mengikat SK ke orangnya. */
export async function gatewayPegawaiPenunjukan() {
  return gatewayFetch<Record<string, unknown>>("/internal/aleta-bot/penunjukan/pegawai", {
    method: "GET",
  });
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
  olehUsername: string;
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
  operator: string;
  kering: boolean;
  ip?: string;
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
  operator: string;
  kering: boolean;
  ip?: string;
}) {
  return gatewayFetch<Record<string, unknown>>("/internal/aleta-bot/penetapan/hapus-semua", {
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
    /**
     * Susunan majelis menurut SK Ketua - kode majelis, kode hakim, dan
     * panitera sidangnya sebagai pasangan kode-orang.
     *
     * Panitera dikirim sebagai id, bukan kode: kode panitera pada SIPP
     * tabrakan - empat orang berbagi kode "D" - sehingga kode tidak dapat
     * menunjuk siapa pun. Lihat migrasi 0044.
     */
    susunanSk?: Record<string, unknown>[];
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
  pihak: { penggugat: string[]; tergugat: string[]; saksi?: string[]; lain?: string[] };
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
