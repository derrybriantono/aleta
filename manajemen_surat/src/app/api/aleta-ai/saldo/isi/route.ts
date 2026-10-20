import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi, penggunaAda, wajibSuperAdmin } from "@/server/modules/aleta-ai/akses";
import { isiSaldo } from "@/server/modules/aleta-ai/saldo";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ALETA Ai - POST /api/aleta-ai/saldo/isi {penggunaId, jumlahRp, catatan} - Super Admin; tercatat sebagai mutasi "isi". */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    wajibSuperAdmin(pelaku);
    const badan = (await request.json().catch(() => ({}))) as { penggunaId?: unknown; jumlahRp?: unknown; catatan?: unknown };
    const hasil = await isiSaldo(
      db,
      pelaku.id,
      { penggunaId: String(badan.penggunaId ?? ""), jumlahRp: Number(badan.jumlahRp), catatan: String(badan.catatan ?? "") },
      (id) => penggunaAda(db, id)
    );
    return ok(hasil);
  } catch (error) {
    return handleRouteError(error);
  }
}
