import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAiBerhak, penggunaAda, wajibSuperAdmin } from "@/server/modules/aleta-ai/akses";
import { koreksiSaldo } from "@/server/modules/aleta-ai/saldo";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - POST /api/aleta-ai/saldo/koreksi {penggunaId, jumlahRp (+/-), alasan, kunci?} - HANYA Super Admin
 * (matriks "aleta-ai.kelola-dompet" + wajibSuperAdmin). Mutasi "koreksi"; alasan wajib; saldo tidak boleh negatif;
 * `kunci` sama = idempoten. -> {saldoRp, mutasiId, sudahAda}.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAiBerhak(db, await resolveActorUserId(request), "aleta-ai.kelola-dompet");
    wajibSuperAdmin(pelaku);
    const badan = (await request.json().catch(() => ({}))) as { penggunaId?: unknown; jumlahRp?: unknown; alasan?: unknown; kunci?: unknown };
    const hasil = await koreksiSaldo(
      db,
      pelaku.id,
      { penggunaId: String(badan.penggunaId ?? ""), jumlahRp: Number(badan.jumlahRp), alasan: String(badan.alasan ?? ""), kunci: String(badan.kunci ?? "") },
      (id) => penggunaAda(db, id)
    );
    return ok(hasil);
  } catch (error) {
    return handleRouteError(error);
  }
}
