import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { periksaCocokPutusan, type BahanPutusanBot, type DepsCocokPutusan } from "@/server/modules/aleta-ecourt/cocok-putusan";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { ambilBerkasSippGateway } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Putusan SIPP vs dokumen putusan yang diunggah (G4 4.3, 30 Okt 2026) - HANYA MEMBACA.
 *   GET ?perkaraId -> { keadaan: cocok|beda|tidak-terbaca|tanpa-dokumen|belum-putus, beda[] }
 * Beda = peringatan pasif di panel cetak Blangko Derry dan di Pusat Kesehatan; tidak ada tombol, tidak menulis ke SIPP.
 */
export const depsCocokPutusan: DepsCocokPutusan = {
  bahan: async (perkaraId) => {
    const h = await panggilBotJadwalSidang<BahanPutusanBot>(`/putusan-dokumen?perkaraId=${encodeURIComponent(perkaraId)}`);
    return h.ok ? { ok: true, data: h.data } : { ok: false, error: h.error };
  },
  berkas: async (perkaraId) => {
    const pembatal = new AbortController();
    const pewaktu = setTimeout(() => pembatal.abort(), 20_000);
    try {
      const r = await ambilBerkasSippGateway("putusan", perkaraId, pembatal.signal);
      if (!r.ok) return null;
      return new Uint8Array(await r.arrayBuffer());
    } catch {
      return null;
    } finally {
      clearTimeout(pewaktu);
    }
  },
};

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    const perkaraId = String(request.nextUrl.searchParams.get("perkaraId") || "").trim();
    if (!/^\d{1,12}$/.test(perkaraId)) return ok({ keadaan: "tidak-terbaca", beda: [], catatan: "Perkara tidak dikenali." });
    return ok(await periksaCocokPutusan(db, perkaraId, depsCocokPutusan));
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "COCOK_PUTUSAN_READ_FAILED", feature: "aleta_ecourt" });
  }
}
