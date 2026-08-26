import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok, unauthorized } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RUNTIME_URL = "http://127.0.0.1:3003";

function getRuntimeStatusUrl() {
  const base = (
    process.env.ALETA_BOT_BASE_URL ||
    process.env.ALETA_BOT_RUNTIME_URL ||
    DEFAULT_RUNTIME_URL
  ).replace(/\/+$/, "");
  return `${base}/internal/aleta-bot/status`;
}

function sanitizeError(msg: string | null | undefined): string | null {
  if (!msg) return null;
  const lower = msg.toLowerCase();
  if (lower.includes("could not find chrome") || lower.includes("puppeteer")) {
    return "Chrome/Puppeteer belum tersedia di server. Admin teknis perlu memasang browser atau mengatur executable path.";
  }
  if (lower.includes("target closed")) {
    return "Browser WhatsApp tertutup. Coba hubungkan ulang WhatsApp Gateway dengan aman.";
  }
  if (lower.includes("session expired")) {
    return "Sesi WhatsApp berakhir. Silakan hubungkan ulang WhatsApp Gateway.";
  }
  if (lower.includes("protocol error")) {
    return "Terjadi gangguan komunikasi dengan browser WhatsApp.";
  }
  if (lower.includes("econnrefused") || lower.includes("failed to connect")) {
    return "Koneksi ke layanan gagal.";
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("aborted")) {
    return "Layanan tidak merespons (timeout).";
  }
  return msg.slice(0, 180);
}

type MetricsRow = {
  sent_today: string | number;
  failed_today: string | number;
};

export async function GET(request: NextRequest) {
  try {
    const actorUserId = await resolveActorUserId(request);
    if (!actorUserId) return unauthorized();

    // Fetch runtime status — best-effort, 3 s timeout
    let runtimePayload: Record<string, unknown> | null = null;
    let runtimeOnline = false;
    try {
      const headers: HeadersInit = {};
      const token =
        process.env.ALETA_BOT_INTERNAL_API_TOKEN ||
        process.env.ALETA_BOT_INTERNAL_TOKEN ||
        "";
      if (token) headers["x-aleta-internal-token"] = token;

      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(getRuntimeStatusUrl(), {
        cache: "no-store",
        headers,
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (res.ok) {
        runtimeOnline = true;
        runtimePayload = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      }
    } catch {
      runtimeOnline = false;
    }

    // DB metrics: today's sent / failed counts from notification logs
    let sentToday = 0;
    let failedToday = 0;
    try {
      const db = await getDatabase();
      const today = new Date().toISOString().slice(0, 10);
      const row = await db.queryOne<MetricsRow>(
        `SELECT
           COUNT(CASE WHEN status = 'success' AND created_at >= ? THEN 1 END) AS sent_today,
           COUNT(CASE WHEN status = 'failed'  AND created_at >= ? THEN 1 END) AS failed_today
         FROM aleta_bot_notification_logs`,
        [today, today]
      );
      sentToday = Number(row?.sent_today ?? 0);
      failedToday = Number(row?.failed_today ?? 0);
    } catch {
      // DB may not be available; fall back to 0
    }

    // Parse safe sub-objects from runtime payload
    const wa = (runtimePayload?.whatsapp ?? {}) as Record<string, unknown>;
    const queue = (runtimePayload?.queue ?? {}) as Record<string, unknown>;
    const worker = (runtimePayload?.worker ?? {}) as Record<string, unknown>;
    const ai = (runtimePayload?.aiRuntime ?? {}) as Record<string, unknown>;
    const msgStats = (runtimePayload?.messageStatsToday ?? {}) as Record<string, unknown>;

    // WhatsApp status label map
    const waLabelMap: Record<string, string> = {
      connected: "Terhubung",
      disconnected: "Tidak Terhubung",
      qr_needed: "Scan QR Diperlukan",
      initializing: "Menyiapkan Koneksi",
      error: "Bermasalah",
    };
    const waRaw = String(wa?.status ?? "");
    const waLabel = !runtimeOnline
      ? "Tidak Terhubung"
      : (waLabelMap[waRaw] ?? "Tidak Diketahui");

    // Worker status
    const workerPaused = Boolean(worker?.paused);
    const workerRunning = Boolean(worker?.running);
    const workerStatus = !runtimeOnline
      ? "unknown"
      : workerPaused
      ? "paused"
      : workerRunning
      ? "active"
      : "unknown";
    const workerLabel = !runtimeOnline
      ? "Tidak Diketahui"
      : workerPaused
      ? "Dijeda"
      : workerRunning
      ? "Aktif"
      : "Tidak Diketahui";

    // AI status
    const aiRaw = String(ai?.status ?? "");
    const aiLabelMap: Record<string, string> = {
      ready: "AI Siap",
      needs_sync: "Perlu Diperbarui",
      disabled: "Nonaktif",
      error: "Bermasalah",
    };
    const aiLabel = !runtimeOnline ? "Tidak Diketahui" : (aiLabelMap[aiRaw] ?? "Tidak Diketahui");

    // Service overall
    const overallStatus = !runtimeOnline ? "needs_attention" : "normal";
    const overallLabel = !runtimeOnline ? "Perlu Perhatian" : "Normal";

    return ok({
      whatsapp: {
        status: runtimeOnline ? (waRaw || "unknown") : "offline",
        statusLabel: waLabel,
        connected: runtimeOnline && waRaw === "connected",
        runtime: "Koneksi WhatsApp",
        lastConnectedAt: (wa?.lastConnectedAt as string | null) ?? null,
        lastErrorMessage: sanitizeError((wa?.lastErrorMessage ?? wa?.lastError) as string | null),
        sessionStartedAt: (wa?.sessionStartedAt as string | null) ?? null,
        lastMessageSentAt: (wa?.lastMessageSentAt as string | null) ?? null,
        sessionAgeHours: typeof wa?.sessionAgeHours === "number" ? wa.sessionAgeHours : null,
        authFailureCount: Number(wa?.authFailureCount ?? 0),
      },
      queue: {
        pending: Number(queue?.pendingCount ?? 0),
        processing: Number(queue?.processingCount ?? 0),
        sentToday: Math.max(sentToday, Number(msgStats?.sent ?? 0)),
        failedToday: Math.max(failedToday, Number(msgStats?.failed ?? 0)),
        deadLetters: Number(queue?.deadLetterCount ?? 0),
      },
      worker: {
        status: workerStatus,
        statusLabel: workerLabel,
        lastHeartbeatAt: (worker?.lastHeartbeatAt as string | null) ?? null,
      },
      ai: {
        status: runtimeOnline ? (aiRaw || "unknown") : "unknown",
        statusLabel: aiLabel,
      },
      service: {
        status: overallStatus,
        statusLabel: overallLabel,
      },
      runtimeOnline,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
