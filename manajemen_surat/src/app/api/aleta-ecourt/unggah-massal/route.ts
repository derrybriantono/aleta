import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayUnggahMassalDaftar } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { BATAS_TUGAS_BAS_HARI } from "@/server/modules/aleta-ecourt/penyatu";
import { hakUnggahMassal, susunDaftarUnggahMassal } from "@/server/modules/aleta-ecourt/unggah-massal";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * UNGGAH MASSAL - DAFTAR e-DOC YANG MENUNGGU (F4.1, 17 OKT 2026) - BACA SAJA
 * ============================================================================
 *
 *   GET ?putusan=saya|semua&bas=saya|semua
 *     -> { hariIni, sejak, hak, saringan, putusan[], bas[], tertahan[], jumlah, galat[] }
 *
 * Hakim: putusan majelisnya; PP: BAS sidangnya; Admin: keduanya. Jenis yang
 * bukan haknya dikosongkan di sini (hakUnggahMassal), bukan hanya disembunyikan
 * di ekstensi. Jendelanya BATAS_TUGAS_BAS_HARI hari - sama dengan penyatu M2.
 * Tidak menulis apa pun.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "panel");
    const hak = hakUnggahMassal(actor);
    if (!hak.putusan && !hak.bas) {
      return Response.json(
        {
          ok: false,
          alasan:
            "Unggah massal hanya untuk Hakim (putusan), Panitera Pengganti/Panitera/Panitera Muda (BAS), Admin, dan Super Admin.",
        },
        { status: 403 }
      );
    }

    const jawab = await getGatewayUnggahMassalDaftar(BATAS_TUGAS_BAS_HARI);
    if (!jawab.ok) {
      return Response.json({ ok: false, alasan: jawab.error || "Daftar belum dapat dibaca dari ALETA Bot." }, { status: 502 });
    }
    const q = request.nextUrl.searchParams;
    return ok(
      susunDaftarUnggahMassal({
        data: jawab.data,
        hak,
        namaAkun: String(actor?.name || ""),
        saringanDiminta: { putusan: q.get("putusan"), bas: q.get("bas") },
      })
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "UNGGAH_MASSAL_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "unggah-massal",
    });
  }
}
