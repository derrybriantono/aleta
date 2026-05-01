import type { AletaBotSnapshot, AletaBotDeadLetter, AletaBotWorkerState } from "@/lib/aleta-bot-types";

export type WhatsappRuntimeMode = "aleta_bot" | "legacy_portal" | "disabled";

export function getWhatsappRuntimeMode(): WhatsappRuntimeMode {
  const raw = (process.env.WHATSAPP_RUNTIME_MODE ?? "aleta_bot").trim().toLowerCase();
  if (raw === "legacy_portal" || raw === "disabled") return raw as WhatsappRuntimeMode;
  return "aleta_bot";
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

    const json = (await response.json()) as Record<string, unknown>;

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
      error: err instanceof Error ? err.message : "Gateway error tidak diketahui.",
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
  message: string;
  category?: string;
  priority?: number;
  dryRun?: boolean;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

export type GatewayEnqueueResponse = {
  ok: boolean;
  queueId?: number | string;
  existingQueueId?: number | string;
  duplicate?: boolean;
  status?: string;
  idempotencyKey?: string;
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
  error?: string;
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
  total: number;
  items: AletaBotDeadLetter[];
};

export type GatewayResendDeadLetterResponse = {
  ok: boolean;
  originalId: string;
  newId: string;
  status: string;
};

export async function getGatewayDeadLetters(limit = 50): Promise<GatewayResult<GatewayDeadLettersResponse>> {
  return gatewayFetch<GatewayDeadLettersResponse>(`/internal/aleta-bot/queue/dead-letters?limit=${limit}`);
}

export async function resendGatewayDeadLetter(
  id: string
): Promise<GatewayResult<GatewayResendDeadLetterResponse>> {
  return gatewayFetch<GatewayResendDeadLetterResponse>("/internal/aleta-bot/queue/dead-letters/resend", {
    method: "POST",
    body: JSON.stringify({ id }),
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
  if (gatewayStatus === "auth_failure") return "failed";
  return "disconnected";
}

function mapGatewayStatusToInternal(gatewayStatus: string): string {
  if (gatewayStatus === "connected") return "ready";
  if (gatewayStatus === "qr_needed") return "qr";
  if (gatewayStatus === "initializing") return "initializing";
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

  const lastErrorMessage = statusData?.lastError ??
    (!statusValue.ok ? (statusValue as { ok: false; error: string }).error : null);

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
