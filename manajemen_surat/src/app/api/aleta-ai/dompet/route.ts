import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAiBerhak } from "@/server/modules/aleta-ai/akses";
import { tampilDompet } from "@/server/modules/aleta-ai/dompet";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - GET /api/aleta-ai/dompet (milik sendiri; matriks "aleta-ai.dompet").
 * {saldoRp, gratis, saldoMenipis, ambangSaldoMenipisRp, pemberitahuan?, hariIni:{terpakaiRp, batasRp, token, batasToken},
 *  isiBerbayarAktif:false, caraIsi, mutasi:[...], giliran:[{pesanId, waktu, mode, status, token, kurs, kursTanggal, kursSumber,
 *  perkiraanRp, biayaRp, gratis}]}. Tanpa isi pesan; nama model hanya untuk Super Admin.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAiBerhak(db, await resolveActorUserId(request), "aleta-ai.dompet");
    return ok(await tampilDompet(db, pelaku));
  } catch (error) {
    return handleRouteError(error);
  }
}
