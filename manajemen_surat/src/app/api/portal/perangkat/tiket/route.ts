import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { PESAN_TIKET, pakaiTiket, periksaTiket, ringkasPerangkat } from "@/server/modules/perangkat/batas";
import { idPerangkatDariHeader } from "@/server/modules/perangkat/jaringan";
import { cabutSesiAkun, daftarSesiAktif, kelompokkanPerPerangkat } from "@/server/modules/perangkat/sesi";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * "PILIH PERANGKAT YANG DIKELUARKAN" - TANPA SESI, DENGAN TIKET
 * ============================================================================
 *
 * Tiket diterbitkan kait sesi (kait-auth.ts) HANYA sesudah password terbukti
 * benar dan batas perangkat penuh: sekali pakai, 5 menit, terikat akun DAN
 * kuki perangkat peminta. Tanpa perangkatId = melihat daftar (tiket tidak
 * terpakai); dengan perangkatId = mencabut perangkat itu (tiket terpakai),
 * lalu layar masuk mengulang masuk seperti biasa - password diperiksa lagi.
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const body = await readJsonBody<{ tiket?: string; perangkatId?: string }>(request).catch(() => ({}) as { tiket?: string; perangkatId?: string });
    const perangkatPeminta = idPerangkatDariHeader(request.headers);
    const periksa = await periksaTiket(db, String(body.tiket ?? ""), perangkatPeminta);
    if (!periksa.sah) throw new ApiError(400, PESAN_TIKET[periksa.sebab], { kode: `TIKET_${periksa.sebab.toUpperCase().replace(/-/g, "_")}` });

    const kelompok = kelompokkanPerPerangkat(await daftarSesiAktif(db, periksa.userId)).filter((p) => p.perangkatId !== perangkatPeminta);
    if (!body.perangkatId) {
      return ok({ perangkat: await ringkasPerangkat(db, periksa.userId, kelompok) });
    }
    if (!kelompok.some((p) => p.perangkatId === body.perangkatId)) throw new ApiError(404, "Perangkat itu sudah tidak masuk. Silakan masuk lagi.");
    if (!(await pakaiTiket(db, String(body.tiket)))) throw new ApiError(400, PESAN_TIKET["sudah-dipakai"]);
    const dicabut = await cabutSesiAkun(db, {
      userId: periksa.userId,
      alasan: "pilih-perangkat",
      pelaku: { id: periksa.userId, nama: "Pemilik akun (layar masuk)" },
      perangkatId: String(body.perangkatId),
    });
    return ok({ dicabut, lanjutkanMasuk: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
