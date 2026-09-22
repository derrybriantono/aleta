import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaRekamAntrian,
  ringkasRekamAntrian,
  riwayatAntrianPerkara,
} from "@/server/modules/aleta-ecourt/rekam-antrian";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * REKAMAN ANTRIAN SIDANG - HANYA DIBACA DARI SINI
 * ============================================================================
 *
 * Penulisannya menumpang rute jadwal sidang, di server, dari data yang baru
 * saja dibaca dari SIPP - lihat catatannya di sana. Rute ini sengaja TIDAK
 * punya POST: rekaman yang dapat ditulis dari luar bukan lagi catatan tentang
 * apa yang sungguh terjadi, melainkan tentang apa yang dikirim seseorang.
 *
 *   ?perkaraId=...       riwayat antrian satu perkara, lintas hari sidangnya
 *   ?dari=&sampai=       rekaman satu rentang tanggal, beserta ringkasannya
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const params = request.nextUrl.searchParams;

    const perkaraId = String(params.get("perkaraId") || "").trim();
    if (perkaraId) {
      return ok({ ada: true, riwayat: await riwayatAntrianPerkara(db, perkaraId) });
    }

    const dari = String(params.get("dari") || "").trim();
    const sampai = String(params.get("sampai") || "").trim() || dari;
    if (!dari) return ok({ ada: false, alasan: "Tanggalnya belum disebut.", baris: [] });

    const baris = await bacaRekamAntrian(db, dari, sampai);
    return ok({ ada: true, dari, sampai, baris, ringkas: ringkasRekamAntrian(baris) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "REKAM_ANTRIAN_BACA_GAGAL",
      feature: "aleta_ecourt",
      entityId: "rekam-antrian",
    });
  }
}
