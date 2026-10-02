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
 * Court Calendar satu perkara - perbaikan 2 Oktober 2026 malam, butir 1.
 *
 *   GET  ?perkaraId   rencana majelis (perkara_court_calendar) perkara itu,
 *                     urut tanggal. HANYA membaca.
 *
 * Bahan tanggal sidang berikutnya di borang tunda (Jadwal Sidang dan Hasil
 * Sidang): bila kedua pihak pernah hadir, tanggalnya mengikuti rencana ini -
 * aturannya di @/lib/bawaan-tunda, satu tempat untuk kedua layar.
 *
 *   kalender: null   tidak terbaca (tabel tak terjangkau) - layar jatuh ke dua pekan
 *   kalender: []     terbaca, memang tidak ada rencana (lazim, bukan cacat)
 *
 * Kewenangannya "panel", sama dengan keadaan sidang yang dibaca bersamanya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const perkaraId = String(request.nextUrl.searchParams.get("perkaraId") || "").trim();
    if (!/^\d{1,20}$/.test(perkaraId)) {
      return ok({ available: true, ok: false, alasan: "Nomor perkara wajib diisi.", kalender: null });
    }
    const hasil = await panggilBotJadwalSidang(`/kalender?${new URLSearchParams({ perkaraId }).toString()}`);
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error, kalender: null });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIDANG_KALENDER_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
