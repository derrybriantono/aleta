import { NextRequest } from "next/server";
import { createHash } from "node:crypto";

import { getDatabase } from "@/server/db/client";
import { getAletaBotQueueMonitoring, getAletaBotSnapshot, runAletaBotAction } from "@/server/modules/aleta-bot/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_RUNTIME_URL = "http://127.0.0.1:3003";

function getRuntimeBaseUrl() {
  return (
    process.env.ALETA_BOT_BASE_URL ||
    process.env.ALETA_BOT_RUNTIME_URL ||
    DEFAULT_RUNTIME_URL
  ).replace(/\/+$/, "");
}

function getRuntimeStatusUrl() {
  const baseUrl = getRuntimeBaseUrl();
  return `${baseUrl}/internal/aleta-bot/status`;
}

function getRuntimeTokenHealthUrl() {
  return `${getRuntimeBaseUrl()}/internal/aleta-bot/security/token-health`;
}

function getPortalInternalToken() {
  return (
    process.env.ALETA_BOT_INTERNAL_API_TOKEN ||
    process.env.ALETA_BOT_INTERNAL_TOKEN ||
    ""
  );
}

function tokenFingerprint(token: string) {
  if (!token) return "";
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

async function getInternalTokenHealth(headers: HeadersInit, internalToken: string) {
  const portalFingerprint = tokenFingerprint(internalToken);

  if (!internalToken) {
    return {
      status: "missing_portal_token",
      message: "Token internal belum diset di container portal.",
      portalTokenConfigured: false,
      botTokenConfigured: null,
      fingerprintMatched: false,
      checklist: [
        "Set ALETA_BOT_INTERNAL_API_TOKEN di service portal.",
        "Set nilai yang sama di service aleta_bot.",
        "Restart kedua container setelah env diubah.",
      ],
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(getRuntimeTokenHealthUrl(), {
        cache: "no-store",
        headers,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        status?: string;
        tokenConfigured?: boolean;
        tokenFingerprint?: string;
        message?: string;
      } | null;
      const botFingerprint = String(payload?.tokenFingerprint || "");
      const botTokenConfigured = Boolean(payload?.tokenConfigured);
      const fingerprintMatched = Boolean(botTokenConfigured && botFingerprint && botFingerprint === portalFingerprint);

      if (!response.ok) {
        return {
          status: response.status === 403 ? "mismatch" : response.status === 401 ? "missing_or_rejected" : "unreachable",
          message:
            payload?.message ||
            (response.status === 403
              ? "Token internal portal tidak sama dengan token ALETA Bot."
              : `Token health merespons HTTP ${response.status}.`),
          portalTokenConfigured: true,
          botTokenConfigured: null,
          fingerprintMatched: false,
          statusCode: response.status,
          checklist: [
            "Samakan ALETA_BOT_INTERNAL_API_TOKEN di portal dan aleta_bot.",
            "Hindari token kosong di production.",
            "Restart portal dan aleta_bot setelah env diperbarui.",
          ],
        };
      }

      return {
        status: fingerprintMatched ? "ok" : "mismatch",
        message: fingerprintMatched
          ? "Token internal portal dan ALETA Bot konsisten."
          : "Token health terbaca, tetapi fingerprint portal dan bot tidak cocok.",
        portalTokenConfigured: true,
        botTokenConfigured,
        fingerprintMatched,
        statusCode: response.status,
        checklist: [
          "ALETA_BOT_INTERNAL_API_TOKEN portal dan aleta_bot harus sama.",
          "Gunakan header x-aleta-internal-token untuk semua gateway internal.",
          "Jalankan ulang dashboard setelah restart untuk memastikan fingerprint cocok.",
        ],
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return {
      status: "unreachable",
      message: error instanceof Error ? error.message : "Token health ALETA Bot tidak dapat dihubungi.",
      portalTokenConfigured: true,
      botTokenConfigured: null,
      fingerprintMatched: false,
      checklist: [
        "Pastikan service aleta_bot hidup.",
        "Pastikan ALETA_BOT_BASE_URL/ALETA_BOT_RUNTIME_URL benar.",
        "Pastikan token internal sama di kedua service.",
      ],
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);

    await getAletaBotSnapshot(db, actorUserId);
    const queueMonitoring = await getAletaBotQueueMonitoring(db, actorUserId);

    const headers: HeadersInit = {};
    const internalToken = getPortalInternalToken();
    if (internalToken) {
      headers["x-aleta-internal-token"] = internalToken;
    }
    const tokenHealth = await getInternalTokenHealth(headers, internalToken);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(getRuntimeStatusUrl(), {
        cache: "no-store",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      let payload = await response.json().catch(() => null);
      let autoSync: { attempted: boolean; ok: boolean; message: string } | null = null;

      if (
        response.ok &&
        payload?.aiRuntime?.status === "needs_sync" &&
        String(process.env.ALETA_BOT_AI_AUTO_SYNC_ON_DASHBOARD || "true") !== "false"
      ) {
        try {
          await runAletaBotAction(db, {
            actorUserId,
            action: "sync-ai-config",
          });
          const retryResponse = await fetch(getRuntimeStatusUrl(), {
            cache: "no-store",
            headers,
          });
          payload = await retryResponse.json().catch(() => payload);
          autoSync = {
            attempted: true,
            ok: retryResponse.ok,
            message: retryResponse.ok
              ? "AI config bridge disinkronkan ulang otomatis karena status needs_sync."
              : `Auto sync selesai, tetapi runtime status gagal dibaca ulang: HTTP ${retryResponse.status}.`,
          };
        } catch (error) {
          autoSync = {
            attempted: true,
            ok: false,
            message: error instanceof Error ? error.message : "Auto sync AI config gagal.",
          };
        }
      }

      return ok({
        online: response.ok,
        fetchedAt: new Date().toISOString(),
        statusCode: response.status,
        runtimeUrlConfigured: Boolean(process.env.ALETA_BOT_RUNTIME_URL),
        tokenHealth,
        autoSync,
        queueMonitoring,
        payload,
      });
    } catch (error) {
      return ok({
        online: false,
        fetchedAt: new Date().toISOString(),
        statusCode: 0,
        runtimeUrlConfigured: Boolean(process.env.ALETA_BOT_RUNTIME_URL),
        tokenHealth,
        errorMessage: error instanceof Error ? error.message : "Runtime ALETA Bot tidak dapat dihubungi.",
        queueMonitoring,
        payload: null,
      });
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
