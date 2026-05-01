import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  checkRecoveryIdentityInDb,
  cleanupPasswordRecoveryOtpInDb,
  createPasswordRecoveryDraftInDb,
} from "@/server/modules/users/service";
import {
  getWhatsappRuntimeMode,
  getGatewayWhatsappStatus,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { sendPortalWhatsappMessage } from "@/server/modules/whatsapp/portal-whatsapp-sender";
import { isApiError } from "@/server/shared/errors";
import { created, handleRouteError } from "@/server/shared/http";
import { assertRateLimit, clearRateLimit, recordRateLimitFailure } from "@/server/shared/rate-limit";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let rateLimitKey = "";

  try {
    const body = await readJsonBody<{ identifier: string }>(request);
    rateLimitKey = body.identifier?.trim() ?? "";
    assertRateLimit("recovery-request", request, rateLimitKey);

    const db = await getDatabase();
    const runtimeMode = getWhatsappRuntimeMode();

    let waReady = false;

    if (runtimeMode === "aleta_bot") {
      const statusResult = await getGatewayWhatsappStatus();
      waReady = statusResult.ok && statusResult.data.status === "connected";
    } else if (runtimeMode === "legacy_portal") {
      const { whatsappService } = await import("@/server/modules/whatsapp/service");
      waReady = whatsappService.getRuntimeStatus() === "connected";
    }

    if (!waReady) {
      // Validate identity so user gets immediate feedback on bad identifier,
      // but don't generate OTP — there's nowhere to send it.
      await checkRecoveryIdentityInDb(db, { identifier: body.identifier });
      clearRateLimit("recovery-request", request, rateLimitKey);
      return created({ whatsappReady: false, recovery: null });
    }

    const recovery = await createPasswordRecoveryDraftInDb(db, { identifier: body.identifier });

    const otpMessage =
      `*ALETA — Reset Password*\n\n` +
      `Kode OTP Anda: *${recovery.otp}*\n\n` +
      `Berlaku selama *10 menit*. Jangan bagikan kode ini kepada siapa pun termasuk admin ALETA.`;

    try {
      const sendResult = await sendPortalWhatsappMessage({
        sourceFeature: "password_recovery",
        entityType: "user",
        entityId: recovery.userId,
        eventType: "otp_request",
        recipientNumber: recovery.whatsappNumber,
        recipientName: recovery.name,
        message: otpMessage,
        priority: 1,
        category: "employee",
      });
      if (!sendResult.ok || sendResult.status === "skipped") {
        throw new Error(sendResult.message);
      }
    } catch {
      // OTP was committed to DB — clean it up so it can't be used or brute-forced.
      await cleanupPasswordRecoveryOtpInDb(db, recovery.userId);
      throw new Error("WhatsApp gateway gagal mengirim OTP. Gunakan jalur bantuan admin untuk melanjutkan.");
    }

    clearRateLimit("recovery-request", request, rateLimitKey);

    return created({
      whatsappReady: true,
      recovery: {
        userId: recovery.userId,
        username: recovery.username,
        name: recovery.name,
        maskedWhatsapp: recovery.maskedWhatsapp,
      },
    });
  } catch (error) {
    if (rateLimitKey && !(isApiError(error) && error.status === 429)) {
      recordRateLimitFailure("recovery-request", request, rateLimitKey);
    }
    return handleRouteError(error);
  }
}
