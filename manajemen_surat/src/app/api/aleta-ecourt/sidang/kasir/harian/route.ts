import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { akunSippPengguna } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { pastikanHakKasir, tanggalAtauHariIni } from "@/server/modules/aleta-ecourt/kasir-otomatis";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kasir otomatis massal satu hari (1.189.x butir 2).
 *
 *   GET ?tanggal=YYYY-MM-DD   perkara yang bergerak hari itu (sidang, putusan,
 *                             ikrar, PHS, surat ke Pos) dan usulan jurnal
 *                             tiap perkara menurut KEADAANNYA. Hanya membaca.
 *
 * Penyimpanannya lewat POST /api/aleta-ecourt/sidang/kasir satu perkara satu
 * permintaan (massal: true) - layar yang mengurutkan dan memberi jeda, supaya
 * satu perkara yang gagal tidak menghentikan yang lain dan laporannya per
 * perkara.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanHakKasir(db, actorUserId);
    const tanggal = tanggalAtauHariIni(request.nextUrl.searchParams.get("tanggal"));
    const [hasil, akun] = await Promise.all([
      panggilBotJadwalSidang(`/kasir/harian?${new URLSearchParams({ tanggal }).toString()}`, { timeoutMs: 60_000 }),
      akunSippPengguna(db, aktor.id),
    ]);
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error, tanggal });
    return ok({ available: true, ...hasil.data, akun });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_KASIR_HARIAN_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
