import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { bacaPetaPenetapan, simpanPetaPenetapan } from "@/server/modules/aleta-ecourt/peta-penetapan";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PETA PENETAPAN (perbaikan 6 Okt 2026, butir 19-20) - layar "Peta penetapan"
 * di Integrasi e-Court dan ekstensi (sesudah penetapan tertulis).
 *
 *   GET  semua pegawai yang masuk
 *        -> { butir: [{ jenis, sebutan, aktif, namaBerkas, kelompok,
 *             otomatisUnggah, pakaiTtd, pakaiCap, penandatangan, ...ukuran,
 *             tempatUnggah, sumber }], bolehMengubah, penandatangan, batasUkuran }
 *   PUT  { butir: [{ jenis, ...pengaturan } | { jenis, kembalikanBawaan: true }] }
 *        Super Admin & Admin saja -> sama dengan GET.
 *
 * Hanya menyentuh ALETA (aleta_pemetaan_blangko, kunci "penetapan|<jenis>").
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    return ok(await bacaPetaPenetapan(db, actor));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PETA_PENETAPAN_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    let badan: Record<string, unknown>;
    try {
      const isi = (await request.json()) as unknown;
      badan = isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    return ok(await simpanPetaPenetapan(db, actorUserId, { butir: badan.butir }));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PETA_PENETAPAN_UPDATE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
