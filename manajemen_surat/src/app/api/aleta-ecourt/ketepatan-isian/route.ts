import { type NextRequest } from "next/server";

import { adalahSuperAdmin } from "@/lib/matriks-peran";
import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaLayarKetepatan,
  cabutKeputusan,
  dorongGerbangKeBot,
  hitungDanTinjau,
  ketepatanAktif,
  putuskanUsulan,
} from "@/server/modules/aleta-ecourt/ketepatan-isian";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * KETEPATAN ISIAN (25 Okt 2026, rantai D butir D1 = U3 + U4)
 * ============================================================================
 *
 *   GET ?bagian=saklar   -> {aktif} (login saja)
 *   GET                  -> layar: angka lapangan, usulan naik/turun, keputusan berlaku, kebenaran
 *                           isi saksi. Super Admin dan Admin. Saklar mati -> {aktif:false}.
 *   POST {aksi:"hitung"}                  -> hitung ulang sekarang (Super Admin/Admin)
 *   POST {aksi:"setujui"|"tolak", id}     -> memutuskan satu usulan (HANYA Super Admin)
 *   POST {aksi:"cabut", id}               -> mencabut keputusan yang berlaku (HANYA Super Admin)
 *
 * KENAIKAN TIDAK PERNAH OTOMATIS: "disetujui" hanya terjadi lewat POST bernama dari Super Admin.
 * Keputusan yang berubah didorong ke bot; bot yang tak terjangkau tidak menggagalkan keputusan.
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const bagian = String(getSearchParam(request, "bagian") ?? "").trim();
    if (bagian === "saklar") {
      await requireActorUser(db, actorUserId);
      return ok({ aktif: await ketepatanAktif(db) });
    }
    await pastikanAdminIstimewa(db, actorUserId, "melihat ketepatan isian");
    return ok(await bacaLayarKetepatan(db));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KETEPATAN_ISIAN_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "ketepatan-isian",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const aksi = String(badan.aksi ?? "").trim();

    if (aksi === "hitung") {
      await pastikanAdminIstimewa(db, actorUserId, "menghitung ulang ketepatan isian");
      const hasil = await hitungDanTinjau(db);
      return ok({ hitung: hasil, layar: await bacaLayarKetepatan(db) });
    }

    if (aksi === "setujui" || aksi === "tolak" || aksi === "cabut") {
      // Menyetujui menaikkan isian menjadi terisi sendiri: HANYA Super Admin (akun Derry termasuk).
      const actor = await requireActorUser(db, actorUserId);
      if (!adalahSuperAdmin(actor)) throw new ApiError(403, "Hanya Super Admin yang dapat memutuskan usulan ketepatan isian.");
      const id = String(badan.id ?? "").trim();
      if (!id) throw new ApiError(400, "Usulan tidak disebutkan.");
      const pelaku = { id: actor.id, name: actor.name };
      const keputusan =
        aksi === "cabut" ? await cabutKeputusan(db, pelaku, id) : await putuskanUsulan(db, pelaku, id, aksi === "setujui" ? "setujui" : "tolak", String(badan.catatan ?? ""));
      const bot = aksi === "tolak" ? null : await dorongGerbangKeBot(db);
      return ok({ keputusan, bot, layar: await bacaLayarKetepatan(db) });
    }

    throw new ApiError(400, "Tindakan tidak dikenal.");
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KETEPATAN_ISIAN_TINDAK_FAILED",
      feature: "aleta_ecourt",
      entityId: "ketepatan-isian",
    });
  }
}
