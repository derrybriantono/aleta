import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaBelajar, hurufBelajarAktif, ringkasHurufBelajar } from "@/server/modules/aleta-ecourt/huruf-alasan-belajar";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * HURUF ALASAN YANG BELAJAR DARI HAKIM (25 Okt 2026, rantai D butir D4 = U14)
 * ============================================================================
 *
 *   GET ?bagian=saklar     -> {aktif} (login saja)
 *   GET ?bagian=ringkasan  -> kecocokan usulan mesin dengan pilihan akhir per pola (Super Admin/Admin; tanpa nama hakim)
 *   POST {jenisPerkara, hurufMesin, majelis:[nama...]} -> pertimbangan untuk hakim yang membuka perkara (kewenangan
 *                             "blangko-abt"): kebiasaan hakim itu sendiri, anggota majelis lain (tanpa nama), kecocokan
 *                             pola, dan saran dasar hukum per huruf dari pustaka pertimbangan.
 *
 * TETAP USULAN: tidak ada yang ditulis ke ABT/SIPP/e-Court. Saklar Fitur Satker "huruf-alasan-belajar" bawaan MATI.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const bagian = String(getSearchParam(request, "bagian") ?? "").trim();
    if (bagian === "ringkasan") {
      await pastikanAdminIstimewa(db, actorUserId, "melihat kecocokan huruf alasan");
      return ok(await ringkasHurufBelajar(db));
    }
    await requireActorUser(db, actorUserId);
    return ok({ aktif: await hurufBelajarAktif(db) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "HURUF_ALASAN_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "huruf-alasan",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return ok(await bacaBelajar(db, { hakimId: actor.id, jenisPerkara: badan.jenisPerkara, hurufMesin: badan.hurufMesin, majelis: badan.majelis }));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "HURUF_ALASAN_BELAJAR_FAILED",
      feature: "aleta_ecourt",
      entityId: "huruf-alasan",
    });
  }
}
