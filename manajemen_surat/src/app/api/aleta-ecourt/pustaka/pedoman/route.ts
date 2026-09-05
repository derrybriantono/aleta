import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { PEDOMAN, bacaPedoman, cariPedoman } from "@/server/modules/aleta-ecourt/pustaka-pedoman";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pustaka pedoman Badilag - dicari, dikutip, disebut halamannya.
 *
 *   GET                          daftar pedoman yang tersedia
 *   GET ?cari=verstek            temuan di seluruh pedoman
 *   GET ?cari=...&pedoman=<id>   temuan di satu pedoman saja
 *   GET ?pedoman=<id>&halaman=7  satu halaman utuh
 *
 * Yang dikembalikan KUTIPAN, bukan kesimpulan. Rute ini tidak menafsirkan
 * pedoman dan tidak menyatakan sesuatu sesuai atau tidak sesuai - menyatakan
 * "sesuai pedoman" menuntut pemahaman atas maksudnya, dan pernyataan semacam
 * itu yang keliru membuat yang membacanya berhenti memeriksa.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const cari = String(getSearchParam(request, "cari") ?? "").trim();
    const pedomanId = String(getSearchParam(request, "pedoman") ?? "").trim();
    const halaman = Number(getSearchParam(request, "halaman") ?? "0") || 0;

    if (pedomanId && halaman > 0) {
      const isi = await bacaPedoman(pedomanId);
      const satu = isi.halaman.find((item) => item.nomor === halaman);
      return ok({
        ada: Boolean(satu),
        sebab: isi.ada ? (satu ? "" : "Halaman itu tidak ada.") : isi.sebab,
        berkas: isi.berkas,
        jumlahHalaman: isi.jumlahHalaman,
        halaman: satu ?? null,
      });
    }

    if (cari) return ok({ ada: true, cari, temuan: await cariPedoman(cari, pedomanId) });

    return ok({ ada: true, pedoman: PEDOMAN });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUSTAKA_PEDOMAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "pustaka-pedoman",
    });
  }
}
