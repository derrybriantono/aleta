import { type NextRequest } from "next/server";

import { PETA_ALAT } from "@/lib/aleta-ai/alat-data";
import { getDatabase } from "@/server/db/client";
import { pelakuAi } from "@/server/modules/aleta-ai/akses";
import { jalankanAlat } from "@/server/modules/aleta-ai/alat";
import { bacaTimpaanKemampuan } from "@/server/modules/aleta-ai/kemampuan";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai tahap 2a - GET /api/aleta-ai/rekap?alat=rekap_relaas_retur&dari=YYYY-MM-DD&sampai=YYYY-MM-DD
 *                     GET /api/aleta-ai/rekap?alat=data_perkara&nomor=...&bagian=ringkas,relaas
 *
 * "Buka daftar perkara" dari jawaban rekap (rencana v2 10.2): angka dan nomor
 * perkara yang SAMA dengan yang dihitung alat, untuk PENGGUNA (data asli,
 * tidak dikirim ke layanan AI). Penjaga di server, bukan di tombol:
 *   - masuk ALETA wajib; hak peran = matriks-peran.ts AKSES_DATA_AI (403);
 *   - lingkup "milik" disaring sama persis dengan alat di mesin;
 *   - fitur mati (akun SIPP baca-saja belum ada) = 503 dengan kalimat biasa.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    const q = request.nextUrl.searchParams;
    const nama = String(q.get("alat") ?? "");
    if (!PETA_ALAT.has(nama)) throw new ApiError(400, "Alat rekap tidak dikenal.");
    const masukan: Record<string, unknown> = {};
    for (const k of ["dari", "sampai", "per", "nomor", "minimal_hari"]) {
      const v = q.get(k);
      if (v !== null && v !== "") masukan[k] = v;
    }
    const bagian = q.get("bagian");
    if (bagian) masukan.bagian = bagian.split(",").map((x) => x.trim()).filter(Boolean);

    const hasil = await jalankanAlat({ db, pelaku, timpaan: await bacaTimpaanKemampuan(db), sekarang: new Date(), penyamar: null }, nama, masukan);
    const pesan = String((hasil.isi as { galat?: unknown }).galat ?? "");
    if (hasil.status === "tolak") throw new ApiError(403, pesan || "Peran Anda tidak diberi hak membaca data ini.");
    if (hasil.status === "mati") throw new ApiError(503, "Data SIPP untuk ALETA Ai belum diaktifkan di server.");
    if (hasil.status === "galat") throw new ApiError(pesan.startsWith("Parameter") || pesan.includes("tanggal") || pesan.includes("Nomor") ? 400 : 502, pesan || "Data SIPP belum dapat dibaca.");
    return ok(hasil.rekap ?? hasil.isi);
  } catch (error) {
    return handleRouteError(error);
  }
}
