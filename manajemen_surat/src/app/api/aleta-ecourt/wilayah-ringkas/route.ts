import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { ambilWilayahRingkas } from "@/server/modules/aleta-ecourt/wilayah-ringkas";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daftar ringkas satu provinsi (kabupaten, kecamatan, desa) untuk pencarian nama
 * desa di ekstensi - diambil SEKALI per 30 hari per PC, lihat wilayah-ringkas.ts.
 *
 *   GET ?provinsi=72
 *
 * Hanya membaca. Kewenangan sama dengan rute wilayah (kapabilitas "panel").
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const provinsi = String(request.nextUrl.searchParams.get("provinsi") || "").trim();
    if (!/^\d{2}$/.test(provinsi)) return ok({ available: true, ok: false, alasan: "Kode provinsi harus dua angka." });

    const hasil = await ambilWilayahRingkas(provinsi);
    if (!hasil) return ok({ available: false, ok: false, alasan: "Data wilayah SIPP belum dapat dibaca." });
    return ok({ available: true, ok: true, ...hasil });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_WILAYAH_RINGKAS_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
