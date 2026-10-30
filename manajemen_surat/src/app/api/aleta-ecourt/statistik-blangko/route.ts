import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaStatistik, catatCetak } from "@/server/modules/aleta-ecourt/statistik-blangko";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Statistik pemakaian blangko (30 Okt 2026, G6 butir 6.4).
 *
 *   POST {aksi:"cetak", perkaraId, nomorPerkara, kelompok, berkas, jenisBlangko, jenisPerkara}
 *        -> satu cetakan dari panel Blangko ABT by Derry (kewenangan "blangko-abt"); tanpa isi naskah.
 *   GET  [?segarkan=1] -> ringkasan untuk Pusat Kendali (Super Admin dan Admin, baca saja).
 *
 * Hanya informasi: tidak ada yang ditulis ke SIPP/ABT, tidak ada blangko yang dipindah atau dihapus.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    await pastikanAdminIstimewa(db, await resolveActorUserId(request), "melihat statistik pemakaian blangko");
    return ok(await bacaStatistik(db, { segarkan: String(getSearchParam(request, "segarkan") ?? "") === "1" }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanKapabilitas(db, await resolveActorUserId(request), "blangko-abt");
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (String(badan.aksi ?? "") !== "cetak") throw new ApiError(400, "Tindakan tidak dikenal.");
    return ok(await catatCetak(db, { id: actor.id }, badan));
  } catch (error) {
    return handleRouteError(error);
  }
}
