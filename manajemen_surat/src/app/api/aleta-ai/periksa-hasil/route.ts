import { type NextRequest } from "next/server";

import { bersihBarisPenilaian, periksaHasilC5, periksaHasilC6 } from "@/lib/aleta-ai/periksa-hasil-fitur";
import { bolehDisarankan, periksaNaskah } from "@/lib/rak-peraturan/indeks";
import { getDatabase } from "@/server/db/client";
import { pastikanAplikasiAktor } from "@/server/modules/akses/hak-peran";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - POST /api/aleta-ai/periksa-hasil   { fitur: "C5" | "C6", teks, baris? }
 * Hasil fitur bantu panel Blangko Derry diperiksa terhadap rak peraturan SEBELUM ditampilkan (lib/aleta-ai/periksa-hasil-fitur.ts):
 *   C5 rujukan di luar rak terverifikasi ditandai; C6 jawaban diurai (id dalil & status sah, pasal tersaring), baris = tabel penilaian.
 * Masuk ALETA dan aplikasi ALETA Ai terbuka untuk peran. Murni membaca rak; tidak ada yang ditulis.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pengguna = await requireActorUser(db, await resolveActorUserId(request));
    await pastikanAplikasiAktor(db, pengguna, "aleta-ai");
    const b = (await request.json().catch(() => ({}))) as { fitur?: unknown; teks?: unknown; baris?: unknown };
    const fitur = String(b.fitur ?? "").trim().toUpperCase();
    const teks = String(b.teks ?? "").slice(0, 60_000);
    if (!teks.trim()) throw new ApiError(400, "Hasil yang diperiksa kosong.");
    if (fitur === "C5") return ok(periksaHasilC5(teks, { boleh: bolehDisarankan, periksaNaskah }));
    if (fitur === "C6") return ok(periksaHasilC6(teks, bersihBarisPenilaian(b.baris)));
    throw new ApiError(400, "Fitur ini tidak memerlukan pemeriksaan rak.");
  } catch (error) {
    return handleRouteError(error);
  }
}
