import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { panggilBotPanggil } from "@/server/modules/panggil-petugas/gateway";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Status pertemuan mediasi "sedang berjalan" / "selesai" - butir 35 (5 Okt 2026).
 *
 *   GET  ?dari&sampai   peta tanda yang berlaku (kunci `mediasiId|tanggal`)
 *   POST { mediasiId, perkaraId, tanggal, nomorPerkara, tempat,
 *          keadaan: "berjalan"|"selesai", batal, kering }
 *
 * Disimpan di basis data ALETA (aleta_bot_mediasi_status, dibuat bot lewat
 * CREATE TABLE IF NOT EXISTS - bukan migrasi Drizzle). SIPP tidak disentuh.
 * Kewenangannya "panel", sama dengan Selesai/Berjalan Jadwal Sidang.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const url = new URL(request.url);
    const dari = String(url.searchParams.get("dari") ?? "").slice(0, 10);
    const sampai = String(url.searchParams.get("sampai") ?? "").slice(0, 10);
    const hasil = await panggilBotPanggil(
      `/mediasi-status?dari=${encodeURIComponent(dari)}&sampai=${encodeURIComponent(sampai)}`
    );
    if (!hasil.ok) return ok({ available: false, alasan: hasil.error, peta: {} });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "MEDIASI_STATUS_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    await pastikanAksi(db, actorUserId, "mediasi.catat"); // HAK-PERAN 12 Okt: matriks peran
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const hasil = await panggilBotPanggil("/mediasi-status", {
      method: "POST",
      body: {
        mediasiId: String(badan.mediasiId ?? ""),
        perkaraId: String(badan.perkaraId ?? ""),
        tanggal: String(badan.tanggal ?? "").slice(0, 10),
        nomorPerkara: String(badan.nomorPerkara ?? "").slice(0, 191),
        tempat: String(badan.tempat ?? "").slice(0, 128),
        keadaan: badan.keadaan === "selesai" ? "selesai" : "berjalan",
        batal: badan.batal === true,
        operator: actor?.name || actorUserId || "portal",
        ip: alamatIpPeramban(request),
        kering: badan.kering !== false,
      },
    });
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "MEDIASI_STATUS_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
