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

export type GatewayResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function gatewayFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<GatewayResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getGatewayTimeoutMs());

  try {
    const url = `${getGatewayBaseUrl()}${path}`;
    const token = getGatewayToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };
    if (token) headers["x-aleta-internal-token"] = token;

    const response = await fetch(url, {
      ...options,
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
      return {
        ok: false,
        error:
          `aleta_bot menjawab dengan ${response.status === 404 ? "halaman 404" : `HTTP ${response.status}`}, ` +
          `bukan data. Rute ${path.split("?")[0]} kemungkinan belum ada di aleta_bot — ` +
          `bangun ulang containernya setelah pembaruan. Jawaban: ${potongan}`,
      };
    }

    if (!response.ok || json.ok === false) {
      return {
        ok: false,
        error: String(json.error ?? json.message ?? `HTTP ${response.status}`),
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
  return gatewayFetch<GatewayVerifikasiDaftar>(`/internal/ecourt/verifikasi?${params.toString()}`);
}

/** Menyimpan keputusan verifikasi dari portal. */
export async function postGatewayVerifikasiDecision(payload: {
  nama: string;
  documentKey: string;
  keputusan: "valid" | "tidak_valid";
  konfirmasi: boolean;
  keterangan?: string;
}): Promise<GatewayResult<GatewayVerifikasiHasil>> {
  return gatewayFetch<GatewayVerifikasiHasil>("/internal/ecourt/verifikasi", {
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
  verifikasi: { keputusanTersimpan: number; belumDiteruskan: number };
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
  return gatewayFetch("/internal/agenda/pengaturan");
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
  return gatewayFetch("/internal/agenda/pengaturan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Menghapus padanan tambahan, atau mengembalikan agenda bawaan ke asalnya. */
export async function deleteGatewayAgendaRule(payload: {
  key: string;
  olehSiapa: string;
}): Promise<GatewayResult<{ ok: boolean; alasan?: string; kembaliKeBawaan?: boolean }>> {
  return gatewayFetch("/internal/agenda/pengaturan/hapus", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Pengaturan e-Court yang dapat disunting. */
export async function getGatewayEcourtSettings(): Promise<
  GatewayResult<{ ok: boolean; pengaturan: GatewayEcourtSettings }>
> {
  return gatewayFetch("/internal/ecourt/pengaturan");
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
  return gatewayFetch("/internal/ecourt/pengaturan/aturan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Menghapus aturan tambahan, atau mengembalikan kelas bawaan ke bentuk asalnya. */
export async function deleteGatewayEcourtRule(payload: {
  key: string;
  olehSiapa: string;
}): Promise<GatewayResult<HasilSederhana>> {
  return gatewayFetch("/internal/ecourt/pengaturan/aturan/hapus", {
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
  return gatewayFetch("/internal/ecourt/pengaturan/ambang", {
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
  return gatewayFetch("/internal/ecourt/nomor/tanya-ulang", {
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
  return gatewayFetch(`/internal/ecourt/status?${params.toString()}`);
}

/** Menyalakan atau mematikan pemberitahuan e-Court. */
export async function setGatewayEcourtAktif(
  aktif: boolean
): Promise<GatewayResult<{ ok: boolean; aktif: boolean }>> {
  return gatewayFetch("/internal/ecourt/aktif", {
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
    `/internal/ecourt/panitera?${params.toString()}`
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
