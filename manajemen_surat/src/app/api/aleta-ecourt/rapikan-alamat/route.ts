import { type NextRequest } from "next/server";

import { rapikanAlamat } from "@/lib/alamat-pihak";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATAS_ALAMAT = 40;
const BATAS_PANJANG = 2000;

/**
 * Rapikan identitas para pihak (perbaikan 5 Okt 2026 butir 26).
 *
 *   POST { alamat: string[] } -> { hasil: [{ alamat, perubahan, kurang, berubah }] }
 *
 * Satu-satunya perapi alamat adalah rapikanAlamat (src/lib/alamat-pihak.ts) -
 * panel SIPP memakai yang sama dengan penerbit berkas gugatan, bukan salinan
 * di ekstensi. Hanya MENGHITUNG: tidak ada yang ditulis ke ALETA maupun SIPP,
 * dan alamatnya tidak dicatat. Dikirim lewat badan POST, bukan alamat URL -
 * alamat orang tidak boleh tercatat di log akses.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    let badan: { alamat?: unknown };
    try {
      badan = (await request.json()) as { alamat?: unknown };
    } catch {
      throw new ApiError(400, "Permintaan tidak dapat dibaca.");
    }
    if (!Array.isArray(badan.alamat)) throw new ApiError(400, "Kirim daftar alamat.");
    const daftar = badan.alamat.slice(0, BATAS_ALAMAT).map((x) => String(x ?? "").slice(0, BATAS_PANJANG));
    return ok({ hasil: daftar.map((x) => rapikanAlamat(x)) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "RAPIKAN_ALAMAT_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
