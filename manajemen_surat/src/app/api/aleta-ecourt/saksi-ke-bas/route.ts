import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaKirimBasPerkara, catatKirimBas, saksiKeBasAktif } from "@/server/modules/aleta-ecourt/saksi-ke-bas";
import { hakUnggahMassal } from "@/server/modules/aleta-ecourt/unggah-massal";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PESAN_TOLAK = "Mengirim BAS ke SIPP hanya untuk Panitera Pengganti, Panitera, Panitera Muda, Admin, dan Super Admin.";

/**
 * Jejak kirim keterangan saksi ke BAS SIPP (25 Okt 2026, C6 = U10).
 *
 *   GET ?bagian=saklar    -> {aktif}  (login saja)
 *   GET ?perkaraId=       -> riwayat percobaan perkara itu (hak yang sama dengan unggah BAS)
 *   POST {perkaraId, nomorPerkara, sidangId, urutanSidang, tahap, hasil, ...} -> mencatat. Saklar mati -> {aktif:false}, tidak menulis.
 *
 * Tidak menulis ke SIPP di sini: unggahnya tetap lewat bas/unggah-sipp (hak, dobel, pemeriksaan isi, penjaga tanda di bot).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    if (String(getSearchParam(request, "bagian") ?? "") === "saklar") {
      await requireActorUser(db, actorUserId);
      return ok({ aktif: await saksiKeBasAktif(db) });
    }
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    if (!hakUnggahMassal(actor).bas) return Response.json({ ok: false, alasan: PESAN_TOLAK }, { status: 403 });
    if (!(await saksiKeBasAktif(db))) return ok({ aktif: false, daftar: [] });
    return ok({ aktif: true, daftar: await bacaKirimBasPerkara(db, String(getSearchParam(request, "perkaraId") ?? "")) });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "SAKSI_KE_BAS_BACA_FAILED", feature: "aleta_ecourt", entityId: "saksi-ke-bas" });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    if (!hakUnggahMassal(actor).bas) return Response.json({ ok: false, alasan: PESAN_TOLAK }, { status: 403 });
    const badan = await request.json().catch(() => ({}));
    return ok(await catatKirimBas(db, { id: actor.id, nama: actor.name }, badan));
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "SAKSI_KE_BAS_CATAT_FAILED", feature: "aleta_ecourt", entityId: "saksi-ke-bas" });
  }
}
