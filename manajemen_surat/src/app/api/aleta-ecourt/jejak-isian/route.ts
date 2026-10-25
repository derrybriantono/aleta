import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaJejakPerkara, catatJejakIsian, jejakIsianAktif, ringkasJejakIsian } from "@/server/modules/aleta-ecourt/jejak-isian";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * JEJAK ISIAN ABT (25 Okt 2026, rantai C butir C1 = U2 + U6)
 * ============================================================================
 *
 *   GET ?bagian=saklar        -> {aktif}: ekstensi menanyakannya sebelum mencatat atau
 *                                membaca ulang isian (login saja; tidak membuka apa pun)
 *   GET ?perkaraId=           -> jejak satu perkara, LENGKAP (nilai sebelum utuh) untuk
 *                                Urungkan dari PC mana pun. Kewenangan "blangko-abt".
 *   GET ?bagian=ringkasan     -> angka lapangan per kode (dasar U3). Super Admin/Admin.
 *   POST {daftar:[...]} atau satu objek -> mencatat. Kewenangan "blangko-abt", sama dengan
 *                                yang menyunting isian. Saklar mati -> {aktif:false}, tidak
 *                                menulis.
 *
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court di sini; jejak adalah catatan ALETA.
 * Urungkan itu sendiri dijalankan peramban petugas ke ABT (tulisan ke ABT tetap dari
 * sesi petugas), lalu dicatat kembali lewat POST dengan cara "diurungkan".
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
      return ok({ aktif: await jejakIsianAktif(db) });
    }

    if (bagian === "ringkasan") {
      await pastikanAdminIstimewa(db, actorUserId, "melihat angka jejak isian");
      return ok({ aktif: await jejakIsianAktif(db), ringkasan: await ringkasJejakIsian(db, String(getSearchParam(request, "sejak") ?? "")) });
    }

    await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    if (!perkaraId) return ok({ aktif: await jejakIsianAktif(db), ada: false, daftar: [], sebab: "Perkara tidak disebutkan." });
    if (!(await jejakIsianAktif(db))) return ok({ aktif: false, ada: false, daftar: [] });
    const daftar = await bacaJejakPerkara(db, perkaraId, Number(getSearchParam(request, "batas")) || 100);
    return ok({ aktif: true, ada: daftar.length > 0, daftar });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "JEJAK_ISIAN_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "jejak-isian",
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
    const daftar = Array.isArray(badan.daftar) ? badan.daftar : [badan];
    const hasil = await catatJejakIsian(db, { id: actor.id, nama: actor.name }, daftar);
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "JEJAK_ISIAN_CATAT_FAILED",
      feature: "aleta_ecourt",
      entityId: "jejak-isian",
    });
  }
}
