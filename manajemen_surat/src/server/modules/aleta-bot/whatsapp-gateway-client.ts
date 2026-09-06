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

/** Batas waktu untuk pemanggilan yang menyentuh banyak berkas di disk. */
const TIMEOUT_BERKAS_MS = Number(process.env.ALETA_BOT_GATEWAY_TIMEOUT_BERKAS_MS || 120_000);

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
  urutanSidang: number;
  /** 1 semua pihak, 2 penggugat saja, 3 tergugat saja, 4 tidak hadir. */
  dihadiriOleh: number | null;
  adaBas: boolean;
  pihak: { penggugat: string[]; tergugat: string[] };
  panggilan: {
    hadirSebelumnya: number | null;
    wajibDipanggil: number[];
    belumDipanggil: number;
    retur: number;
    aman: boolean;
  };
  majelisKode: string;
  majelisNama: string;
  paniteraNama: string;
  jurusitaNama: string;
};

export type RincianSidang = {
  ok: boolean;
  alasan: string;
  nomorPerkara: string;
  jenisPerkara: string;
  majelis: Array<{ kode: string; nama: string; jabatan: string }>;
  panitera: Array<{ kode: string; nama: string }>;
  jurusita: Array<{ kode: string; nama: string }>;
  saksi: { ada: boolean; jumlahSaksi: number; jumlahKeterangan: number };
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
export async function getGatewayAnalisaPerkara(
  nomorPerkara: string,
  jenis: string
): Promise<GatewayResult<Record<string, unknown>>> {
  const kueri = new URLSearchParams({ nomor: nomorPerkara, jenis });
  return gatewayFetch(`/internal/aleta-bot/sipp/analisa?${kueri.toString()}`);
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
  }>("/internal/aleta-bot/sipp/ringkasan-massal", {
    method: "POST",
    body: JSON.stringify({ nomorPerkara }),
  });
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

/**
 * Usulan penunjukan PMH, PPP, PJS, dan PHS untuk satu perkara.
 *
 * Aturannya dikirim bersama permintaan, tidak disimpan di bot: hari sidang
 * tiap majelis dan kode panitera penggantinya ada di basis data portal, yang
 * juga menyediakan menu penyuntingnya. Bot hanya tahu SIPP.
 */
export async function getGatewayPenunjukanUsulan(payload: {
  nomorPerkara: string;
  pengaturan: {
    aturan: Record<string, unknown>;
    hariSidang: Record<string, number>;
    paniteraMajelis: Record<string, string[]>;
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
  pihak: { penggugat: string[]; tergugat: string[] };
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
