import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { daftarSalinanBht, tutupSalinanBht } from "@/server/modules/aleta-ecourt/salinan-bht";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * SALINAN PUTUSAN SESUDAH BHT (30 Okt 2026, migrasi 0120)
 * ============================================================================
 *
 *   GET                              perkara yang baru BHT menurut SIPP dan salinannya belum diurus: { perkara:[{perkaraId, nomorPerkara,
 *                                    tanggalPutusan, tanggalBht}], disegarkan }
 *   POST {aksi:"selesai", perkaraIds} menutup perkara yang salinannya sudah dicetak
 *
 * Hanya penunjuk perkara; tidak ada isi putusan dan tidak ada yang ditulis ke SIPP/ABT. Kewenangan "blangko-abt".
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    return ok(await daftarSalinanBht(db), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "SALINAN_BHT_BACA_FAILED", feature: "aleta_ecourt", entityId: "salinan-bht" });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return ok({ ditutup: await tutupSalinanBht(db, actor, badan.perkaraIds) });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "SALINAN_BHT_TUTUP_FAILED", feature: "aleta_ecourt", entityId: "salinan-bht" });
  }
}
