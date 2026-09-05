import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Katalog blangko BAS dan putusan dari APS Badilag.
 *
 * Dua bentuk pemakaian:
 *
 *   ?folder=derry_briantono/1 Perceraian CG          daftar blangko di folder itu
 *   ?folder=...&berkas=[01] ... .rtf                 isi satu blangko untuk dibaca
 *
 * ============================================================================
 * FOLDERNYA DIBATASI DI SISI BOT, BUKAN DI SINI
 * ============================================================================
 *
 * Nama folder diteruskan apa adanya; yang menolak jalur di luar akar blangko
 * adalah bot, tempat akar itu benar-benar berada. Menaruh penjagaan di dua
 * tempat terdengar lebih aman, tetapi yang terjadi biasanya sebaliknya: dua
 * penjagaan yang sedikit berbeda meninggalkan celah di antaranya, dan
 * masing-masing mengira yang lain sudah menutupnya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const folder = String(getSearchParam(request, "folder") ?? "").trim();
    const berkas = String(getSearchParam(request, "berkas") ?? "").trim();

    if (berkas) {
      const isi = await callAletaBotSippBridge("blangko.baca", { folder, berkas });
      return ok(isi.ok ? isi.data : { ada: false, sebab: isi.error ?? "Blangko tidak terbaca.", penanda: [], teks: "" });
    }

    const katalog = await callAletaBotSippBridge("blangko.katalog", { folder });

    return ok(
      katalog.ok
        ? katalog.data
        : { ada: false, sebab: katalog.error ?? "Katalog blangko tidak terbaca.", set: [], blangko: [] }
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BAS_BLANGKO_FAILED",
      feature: "aleta_ecourt",
      entityId: "bas-blangko",
    });
  }
}
