import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi, wajibSuperAdmin } from "@/server/modules/aleta-ai/akses";
import { bacaPromo, pemakaianApiPromo, simpanPromo, statusPromo, type PerubahanPromo } from "@/server/modules/aleta-ai/promo";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - program promosi "Gratis pakai ALETA Ai".
 *   GET -> {status, konfig?, terpakaiApiRp?}
 *     status  : keadaan untuk pengguna yang masuk (tampil, berlaku, sisa jatah hari ini, tanggal berakhir); selalu ada
 *     konfig  : pengaturan lengkap - HANYA Super Admin
 *     terpakaiApiRp: biaya API promosi satker sejauh ini - HANYA Super Admin
 *   PUT {aktif?, mulai?, akhir?, judul?, teks?, semuaPeran?, peran?, giliranPerHari?, rupiahPeriode?, batasSatkerRp?}
 *     -> bentuk GET sesudah disimpan (HANYA Super Admin; tercatat di jejak)
 */
async function bentuk(db: Awaited<ReturnType<typeof getDatabase>>, pelaku: Awaited<ReturnType<typeof pelakuAi>>) {
  const status = await statusPromo(db, pelaku);
  if (!pelaku.superAdmin) return { status };
  const konfig = await bacaPromo(db);
  return { status, konfig, terpakaiApiRp: await pemakaianApiPromo(db, konfig) };
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    return ok(await bentuk(db, pelaku));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    wajibSuperAdmin(pelaku);
    const badan = (await request.json().catch(() => null)) as PerubahanPromo | null;
    if (!badan || typeof badan !== "object" || Array.isArray(badan)) throw new ApiError(400, "Isi permintaan tidak terbaca.");
    await simpanPromo(db, pelaku.id, badan);
    return ok(await bentuk(db, pelaku));
  } catch (error) {
    return handleRouteError(error);
  }
}
