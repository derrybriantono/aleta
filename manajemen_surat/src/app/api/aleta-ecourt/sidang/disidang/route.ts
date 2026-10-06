import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Keadaan `disidang` aplikasi antrian HARI INI - bacaan ringan Jadwal Sidang
 * (6 Okt 2026). Satu kueri kecil di bot, dibagi seluruh tab (lihat
 * aleta_bot/services/disidangLangsungService.js); ditanyakan layar tiap 5 detik
 * hanya untuk hari ini dan hanya saat tabnya terlihat - lihat
 * @/lib/disidang-langsung. Kewenangannya "panel", sama dengan jadwalnya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const hasil = await panggilBotJadwalSidang("/disidang", { timeoutMs: 4000 });
    if (!hasil.ok) return ok({ available: false, terbaca: false, alasan: hasil.error, baris: [] });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIDANG_DISIDANG_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
