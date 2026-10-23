import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAiBerhak, wajibSuperAdmin } from "@/server/modules/aleta-ai/akses";
import { daftarRekonsiliasi, jalankanRekonsiliasi, rekonsiliasiHarianBilaPerlu } from "@/server/modules/aleta-ai/rekonsiliasi";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - rekonsiliasi harian (HANYA Super Admin; matriks "aleta-ai.kelola-dompet").
 *   GET  -> [{tanggal, status: seimbang|selisih|menggantung, jumlahSelisih, tahananMenggantung, pendapatanGiliranRp,
 *            potongMutasiRp, rincian:[...]}] (31 hari terakhir; kemarin dijalankan otomatis bila belum)
 *   POST {tanggal?} -> hasil rekonsiliasi tanggal itu (bawaan hari ini)
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    wajibSuperAdmin(await pelakuAiBerhak(db, await resolveActorUserId(request), "aleta-ai.kelola-dompet"));
    await rekonsiliasiHarianBilaPerlu(db);
    return ok(await daftarRekonsiliasi(db));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAiBerhak(db, await resolveActorUserId(request), "aleta-ai.kelola-dompet");
    wajibSuperAdmin(pelaku);
    const badan = (await request.json().catch(() => ({}))) as { tanggal?: unknown };
    return ok(await jalankanRekonsiliasi(db, { tanggal: String(badan.tanggal ?? "").trim() || undefined, olehId: pelaku.id }));
  } catch (error) {
    return handleRouteError(error);
  }
}
