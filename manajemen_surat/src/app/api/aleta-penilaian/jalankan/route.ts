import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayJalankanPenilaian } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ketujuh jendela. Ditolak di sini supaya yang salah tidak sampai ke bot. */
const PERIODE_SAH = new Set([
  "harian",
  "mingguan",
  "bulanan",
  "triwulan",
  "semester",
  "tahunan",
  "keseluruhan",
]);

/**
 * Menjalankan satu penilaian pada satu jendela periode.
 *
 * ============================================================================
 * DIHITUNG SAAT DIMINTA, SATU PENILAIAN PER PERMINTAAN
 * ============================================================================
 *
 * Menghitung seluruh penilaian sekaligus akan membuat MEMBUKA layar menunggu
 * puluhan perhitungan yang sebagian besar tidak akan dilihat. Satu permintaan
 * satu penilaian, dan layar meminta yang sedang dibuka saja.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const kunci = String(request.nextUrl.searchParams.get("kunci") || "").trim();
    const periode = String(request.nextUrl.searchParams.get("periode") || "bulanan").trim();
    const acuan = String(request.nextUrl.searchParams.get("acuan") || "").trim();
    const bukti = Number(request.nextUrl.searchParams.get("bukti") || 10);

    if (!kunci) {
      return ok({ available: true, ok: false, alasan: "Penilaian yang dijalankan wajib disebut." });
    }
    if (!PERIODE_SAH.has(periode)) {
      return ok({ available: true, ok: false, alasan: `Jendela periode "${periode}" tidak dikenali.` });
    }
    if (acuan && !/^\d{4}-\d{2}-\d{2}$/.test(acuan)) {
      return ok({ available: true, ok: false, alasan: "Tanggal acuan harus berbentuk YYYY-MM-DD." });
    }

    const hasil = await getGatewayJalankanPenilaian(kunci, periode, acuan || undefined, bukti);
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
      feature: "aleta-penilaian",
      action: "jalankan",
    });
  }
}
