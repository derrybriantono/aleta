import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaButirPerkara, catatButirSaksi, jejakIsianAktif, laporanButirSaksi } from "@/server/modules/aleta-ecourt/jejak-isian";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * BUTIR KETERANGAN SAKSI: USULAN MESIN VS HASIL AKHIR (25 Okt 2026, C1 = U1)
 * ============================================================================
 *
 *   POST {daftar:[butir...]}      -> mencatat satu baris per butir yang disimpan petugas.
 *                                    Kewenangan "blangko-abt" (sama dengan menyimpan saksi).
 *                                    Saklar "jejak-isian" mati -> {aktif:false}, tidak menulis.
 *   GET ?bagian=laporan&sejak=    -> "% butir diterima tanpa diubah" per katalog, varian,
 *                                    jenis perkara, jenis keterangan, jalur, dan pola.
 *                                    Super Admin/Admin.
 *   GET ?perkaraId=               -> butir tercatat satu perkara. Super Admin/Admin
 *                                    (memuat teks keterangan saksi).
 *
 * Teks keterangan saksi memuat nama asli: hanya di Postgres kantor.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAdminIstimewa(db, actorUserId, "melihat butir keterangan saksi");
    const aktif = await jejakIsianAktif(db);
    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    if (perkaraId) return ok({ aktif, daftar: await bacaButirPerkara(db, perkaraId) });
    return ok({ aktif, laporan: await laporanButirSaksi(db, String(getSearchParam(request, "sejak") ?? "")) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SAKSI_BUTIR_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "saksi-butir",
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
    return ok(await catatButirSaksi(db, { id: actor.id, nama: actor.name }, daftar));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SAKSI_BUTIR_CATAT_FAILED",
      feature: "aleta_ecourt",
      entityId: "saksi-butir",
    });
  }
}
