import { type NextRequest } from "next/server";

import type { Tarif } from "@/lib/aleta-ai/biaya";
import type { RuteKelompok } from "@/lib/aleta-ai/rute";
import { getDatabase } from "@/server/db/client";
import { pelakuAi, wajibSuperAdmin } from "@/server/modules/aleta-ai/akses";
import { tampilPengaturan } from "@/server/modules/aleta-ai/layanan";
import { simpanPengaturan, simpanRute, simpanTarif, type PerubahanPengaturan } from "@/server/modules/aleta-ai/pengaturan";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - pengaturan (Super Admin).
 *   GET -> {pengaturan:{aktif, marginPersen, penyanggaKursPersen, minimumRp, pembulatanRp,
 *            batasHarianRp, batasHarianToken, batasLajuPerMenit, kursAwal, faktorTahan, retensiHari},
 *           tarif:[...], rute:[...], kurs:{...}, kunciTerpasang}
 *   PUT {pengaturan?, tarif?, rute?} -> bentuk GET sesudah disimpan (bagian yang tak dikirim tak berubah)
 * Kunci API TIDAK pernah ada di sini: hanya `kunciTerpasang` (ya/tidak).
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    wajibSuperAdmin(await pelakuAi(db, await resolveActorUserId(request)));
    return ok(await tampilPengaturan(db));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    wajibSuperAdmin(pelaku);
    const badan = (await request.json().catch(() => null)) as { pengaturan?: PerubahanPengaturan; tarif?: Tarif[]; rute?: RuteKelompok[] } | null;
    if (!badan || typeof badan !== "object") throw new ApiError(400, "Isi permintaan tidak terbaca.");
    if (badan.pengaturan) await simpanPengaturan(db, pelaku.id, badan.pengaturan);
    if (badan.tarif) await simpanTarif(db, pelaku.id, badan.tarif);
    if (badan.rute) await simpanRute(db, pelaku.id, badan.rute);
    return ok(await tampilPengaturan(db));
  } catch (error) {
    return handleRouteError(error);
  }
}
