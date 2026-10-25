import { type NextRequest } from "next/server";

import { daftarKodeSekali } from "@/lib/isian-sekali";
import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaIsianSekali, isianSekaliAktif, laporanBebanSekali, simpanIsianSekali } from "@/server/modules/aleta-ecourt/isian-sekali";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * ISIAN SEKALI PER PERKARA (25 Okt 2026, rantai D butir D2 = U11)
 * ============================================================================
 *
 *   GET ?bagian=saklar    -> {aktif, kode:[...]}: ekstensi menanyakannya sebelum mengingat atau memberi saran;
 *                            kode = isian yang diingat per perkara (login saja; tidak membuka data perkara)
 *   GET ?bagian=beban     -> urutan kerja menutup isian manual (Super Admin/Admin)
 *   GET ?perkaraId=       -> nilai yang diingat untuk perkara itu (kewenangan "blangko-abt")
 *   POST {perkaraId, nomorPerkara, kode, nilai} -> mengingat satu isian (kewenangan "blangko-abt", sama
 *                            dengan yang menyunting isian). Saklar mati -> {aktif:false}, tidak menulis.
 *
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court di sini: ingatan ini adalah catatan ALETA, dan saran darinya
 * hanya muncul di layar petugas.
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
      const aktif = await isianSekaliAktif(db);
      return ok({ aktif, kode: aktif ? daftarKodeSekali() : [] });
    }

    if (bagian === "beban") {
      await pastikanAdminIstimewa(db, actorUserId, "melihat urutan isian manual");
      return ok(await laporanBebanSekali(db));
    }

    await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    if (!perkaraId) return ok({ aktif: await isianSekaliAktif(db), isian: [], sebab: "Perkara tidak disebutkan." });
    if (!(await isianSekaliAktif(db))) return ok({ aktif: false, isian: [] });
    return ok({ aktif: true, isian: await bacaIsianSekali(db, perkaraId) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ISIAN_SEKALI_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "isian-sekali",
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
    return ok(await simpanIsianSekali(db, { id: actor.id, nama: actor.name }, badan));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ISIAN_SEKALI_SIMPAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "isian-sekali",
    });
  }
}
