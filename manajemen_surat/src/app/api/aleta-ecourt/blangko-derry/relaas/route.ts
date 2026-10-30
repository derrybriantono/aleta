import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/aleta-ecourt/blangko-derry/relaas?perkaraId= - BACA SAJA (G1, jawaban pengguna 30 Okt malam butir 50)
 *
 * Tanggal relaas panggilan per pihak dari SIPP (aleta_bot/services/relaasPanggilanService.js; aturan sama dengan variabel ABT
 * 11120/11121 paket prodeo-panggilan-29okt) untuk "Periksa sebelum cetak" Blangko Derry: tanggal panggilan di naskah dibandingkan
 * dengan relaas. Tidak menulis apa pun. Gagal dibaca = { ada: false } (panel tidak menampilkan butir relaas).
 */
type Relaas = { ada?: boolean; P?: string[]; T?: string[]; sebab?: string };

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const perkaraId = String(request.nextUrl.searchParams.get("perkaraId") || "").trim();
    if (!/^\d+$/.test(perkaraId)) return ok({ ada: false, P: [], T: [], sebab: "perkara_id bukan angka" });
    const j = await callAletaBotSippBridge<Relaas>("case.relaasPanggilan", { perkaraId }, { timeoutMs: 10000 }).catch(() => null);
    if (!j || !j.ok || !j.data || j.data.ada !== true) return ok({ ada: false, P: [], T: [], sebab: "relaas SIPP tidak terbaca" });
    const bersih = (l: unknown) => (Array.isArray(l) ? l.map(String).filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t)).slice(0, 60) : []);
    return ok({ ada: true, P: bersih(j.data.P), T: bersih(j.data.T) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BLANGKO_DERRY_RELAAS_FAILED",
      feature: "aleta_ecourt",
      entityId: "blangko-derry-relaas",
    });
  }
}
