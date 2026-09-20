import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayBebanKonseptor } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Beban kinerja konseptor putusan.
 *
 * ============================================================================
 * LAYAR INI MENYEBUT NAMA ORANG
 * ============================================================================
 *
 * Yang dipulangkan rute ini bukan angka perkara, melainkan angka ORANG - dan
 * angka orang yang salah berakhir sebagai tuduhan, bukan sebagai laporan.
 * Karena itu tiga hal dijaga sampai ke sini:
 *
 *   1. dasarnya ikut - "konseptor", "ketua-majelis", "penginput" atau
 *      "panitera" - sebab keempatnya menghitung pekerjaan yang berbeda dan
 *      hanya salah satunya yang sedang dilihat
 *   2. bacaan ikut - termasuk peringatan bahwa satu nama tertulis beberapa
 *      cara di SIPP, atau bahwa naskah pertimbangannya tidak pernah tersimpan
 *   3. rincian per perkara ikut selama rentangnya cukup sempit, supaya angka
 *      siapa pun dapat dibuka dan dibantah
 *
 * Kewenangannya sama dengan layar ALETA e-Court lainnya: isinya keterangan
 * perkara satker yang sama, hanya dijumlahkan menurut siapa yang mengerjakan.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const cari = request.nextUrl.searchParams;
    const periode = String(cari.get("periode") || "bulan").trim();
    const dari = String(cari.get("dari") || "").trim();
    const sampai = String(cari.get("sampai") || "").trim();

    if (periode === "rentang" && (!dari || !sampai)) {
      return ok({
        available: true,
        ok: false,
        alasan: "Rentang tanggal wajib diisi dari dan sampai.",
      });
    }

    const hasil = await getGatewayBebanKonseptor({
      periode,
      acuan: String(cari.get("acuan") || "").trim(),
      dari,
      sampai,
      // Bawaannya konseptor - yang MENGERJAKAN putusannya, sama dengan yang
      // disebut layar Status Perkara. Bukan ketua majelis, yang bertanggung
      // jawab atas konsepnya tetapi belum tentu menulisnya.
      dasar: String(cari.get("dasar") || "konseptor").trim(),
      rinci: String(cari.get("rinci") || "") !== "0",
      usulBobot: String(cari.get("usulBobot") || "") === "1",
    });
    if (!hasil.ok) {
      return ok({
        available: false,
        ok: false,
        alasan: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_BEBAN_KONSEPTOR_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
