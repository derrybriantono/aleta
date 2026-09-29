import { type NextRequest } from "next/server";

import { AMBANG_WAJIB, BATAS_SIMPAN, MINIMAL_PERKARA, type HasilUkurBot } from "@/lib/abt-wajib";
import { getDatabase } from "@/server/db/client";
import { bolehMenyuntingAkses } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaWajib,
  daftarWajib,
  simpanWajib,
  terapkanHasilUkur,
  ukurUlangWajib,
} from "@/server/modules/aleta-ecourt/abt-wajib";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Variabel wajib ABT sebelum CETAK (kontrak Tahap 6-7 bagian 3).
 *
 *   GET  ?jenis=<jenis perkara>  -> { jenis, variabel: [...], diukurPada, catatan }   (ekstensi)
 *   GET  (tanpa jenis)           -> { daftar: [...], bolehMenyunting, ambang }         (kartu admin)
 *   PUT  {jenis, variabel: [{kode, aktif}]}                  Super Admin
 *   POST {tindakan: "ukur-ulang"}                            Super Admin - lewat jembatan bot
 *   POST {tindakan: "impor", hasil}                          Super Admin - hasil ukur berbentuk
 *                                                            sama dengan jawaban bot (mis. dari
 *                                                            skrip ukur atas salinan lokal)
 *
 * PERINGATAN SAJA: ekstensi menyebut variabel wajib yang kosong atau berbunyi
 * galat, dan CETAK tetap berjalan. GET dibuka bagi semua pegawai yang masuk,
 * karena yang mencetak di ABT adalah panitera pengganti, bukan admin.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const jenis = getSearchParam(request, "jenis");
    if (jenis) return ok(await bacaWajib(db, jenis));
    return ok({
      daftar: await daftarWajib(db),
      bolehMenyunting: bolehMenyuntingAkses(actor),
      ambang: { wajib: AMBANG_WAJIB, simpan: BATAS_SIMPAN, minimalPerkara: MINIMAL_PERKARA },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ABT_REQUIRED_VARIABLES_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "abt-wajib",
    });
  }
}

async function bacaBadan(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const isi = (await request.json()) as unknown;
    return isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
  } catch {
    throw new ApiError(400, "Badan permintaan harus JSON.");
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const badan = await bacaBadan(request);
    return ok(await simpanWajib(db, actorUserId, { jenis: badan.jenis, variabel: badan.variabel }));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ABT_REQUIRED_VARIABLES_UPDATE_FAILED",
      feature: "aleta_ecourt",
      entityId: "abt-wajib",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const badan = await bacaBadan(request);
    const tindakan = String(badan.tindakan ?? "");

    if (tindakan === "ukur-ulang") {
      const hasil = await ukurUlangWajib(db, actorUserId);
      return ok({ hasil, daftar: await daftarWajib(db) });
    }

    if (tindakan === "impor") {
      const actor = await requireActorUser(db, actorUserId);
      if (!bolehMenyuntingAkses(actor)) throw new ApiError(403, "Hanya Super Admin yang dapat mengimpor hasil ukur.");
      const isi = badan.hasil as HasilUkurBot | undefined;
      if (!isi || typeof isi !== "object" || !Array.isArray(isi.jenis)) {
        throw new ApiError(400, "hasil harus berbentuk jawaban abt.ukurVariabelTerisi: { jenis: [...] }.");
      }
      const hasil = await terapkanHasilUkur(db, String(actor.id), isi);
      return ok({ hasil, daftar: await daftarWajib(db) });
    }

    // Menebak di sini berarti salah ketik dapat menimpa daftar dengan hasil ukur.
    throw new ApiError(400, 'Tindakan tidak dikenali - "ukur-ulang" atau "impor".');
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ABT_REQUIRED_VARIABLES_MEASURE_FAILED",
      feature: "aleta_ecourt",
      entityId: "abt-wajib",
    });
  }
}
