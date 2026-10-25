import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaIsianSidang, isianSidangAktif, simpanIsianSidang } from "@/server/modules/aleta-ecourt/isian-sidang";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * ISIAN BAS PER SIDANG (25 Okt 2026, rantai D butir D6 = U12)
 * ============================================================================
 *
 *   GET ?bagian=saklar              -> {aktif} (login saja; tidak membuka data perkara)
 *   GET ?perkaraId=&sidang=         -> isian BAS yang tersimpan untuk sidang itu (kewenangan "blangko-abt")
 *   POST {perkaraId, nomorPerkara, sidang, kode, nilai} -> menyimpan satu isian untuk sidang itu (kewenangan "blangko-abt")
 *
 * Saklar Fitur Satker "isian-per-sidang" bawaan MATI: mati -> {aktif:false}, tidak menulis, tidak mengembalikan apa pun.
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court di sini.
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
      return ok({ aktif: await isianSidangAktif(db) });
    }
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    const sidang = Number(getSearchParam(request, "sidang")) || 0;
    if (!perkaraId || sidang < 1) return ok({ aktif: await isianSidangAktif(db), isian: [], sebab: "Perkara atau sidang tidak disebutkan." });
    if (!(await isianSidangAktif(db))) return ok({ aktif: false, isian: [] });
    return ok({ aktif: true, isian: await bacaIsianSidang(db, perkaraId, sidang) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ISIAN_SIDANG_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "isian-sidang",
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
    return ok(await simpanIsianSidang(db, { id: actor.id, nama: actor.name }, badan));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ISIAN_SIDANG_SIMPAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "isian-sidang",
    });
  }
}
