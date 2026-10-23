import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAiBerhak } from "@/server/modules/aleta-ai/akses";
import { perkirakanPesan } from "@/server/modules/aleta-ai/mesin";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - POST /api/aleta-ai/perkiraan {percakapanId?, teks?, pemicu?}: perkiraan biaya SEBELUM pesan dikirim.
 * -> {label, perkiraanRp, tahanRp, saldoRp, kursDipakai, gratis, bolehJalan, alasan?}. Tidak menahan dana, tidak
 * memanggil model (hanya hitung token), tidak memakai jatah batas laju. Matriks "aleta-ai.dompet".
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAiBerhak(db, await resolveActorUserId(request), "aleta-ai.dompet");
    const badan = (await request.json().catch(() => ({}))) as { percakapanId?: unknown; teks?: unknown; pemicu?: unknown };
    const p = await perkirakanPesan(db, pelaku, String(badan.percakapanId ?? ""), { teks: String(badan.teks ?? ""), pemicu: String(badan.pemicu ?? "") });
    // Kelompok internal dan nama model tidak dikirim ke layar pengguna.
    return ok({
      label: p.label,
      perkiraanRp: p.perkiraanRp,
      tahanRp: p.tahanRp,
      saldoRp: p.saldoRp,
      kursDipakai: p.kursDipakai,
      gratis: p.gratis,
      bolehJalan: p.bolehJalan,
      ...(p.alasan ? { alasan: p.alasan } : {}),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
