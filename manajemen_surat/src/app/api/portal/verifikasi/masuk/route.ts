import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { idPerangkatDariHeader } from "@/server/modules/perangkat/jaringan";
import { infoTantangan, kirimKodeWhatsapp, periksaTantangan, PESAN_TANTANGAN, selesaikanTantangan, type MetodeVerifikasi } from "@/server/modules/verifikasi/layanan";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * KODE VERIFIKASI DI LAYAR MASUK - TANPA SESI, DENGAN TIKET (E5)
 * ============================================================================
 *
 * Tiket diterbitkan kait sesi HANYA sesudah password terbukti benar dan aturan
 * verifikasi menuntut kode: 10 menit, terikat akun DAN kuki perangkat peminta,
 * lima kesalahan menghanguskannya. Rute ini tidak pernah membuat sesi; ia hanya
 * mencatat "lolos" lalu layar masuk mengulang masuk seperti biasa.
 *
 *   aksi "info"   -> cara yang tersedia + nomor WhatsApp tersamar
 *   aksi "kirim"  -> kirim kode WhatsApp (jeda 60 detik, paling banyak 5 kali)
 *   aksi "periksa"-> {metode, kode, percayai}
 */
export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const badan = await readJsonBody<Record<string, unknown>>(request).catch(() => ({}) as Record<string, unknown>);
    const tiket = String(badan.tiket ?? "");
    const perangkatId = idPerangkatDariHeader(request.headers);
    const aksi = String(badan.aksi ?? "");

    if (aksi === "info") return ok(await infoTantangan(db, tiket, perangkatId));

    if (aksi === "kirim") {
      const t = await periksaTantangan(db, tiket, perangkatId);
      if (!t.sah) throw new ApiError(400, PESAN_TANTANGAN[t.sebab], { kode: `VERIFIKASI_${t.sebab.toUpperCase().replace(/-/g, "_")}` });
      return ok(await kirimKodeWhatsapp(db, t.baris));
    }

    if (aksi === "periksa") {
      const hasil = await selesaikanTantangan(db, {
        tiket,
        perangkatId,
        metode: String(badan.metode ?? "") as MetodeVerifikasi,
        kode: String(badan.kode ?? ""),
        percayai: badan.percayai === true,
      });
      return ok({ lolos: hasil.lolos, lanjutkanMasuk: true });
    }

    throw new ApiError(400, "Aksi tidak dikenal.");
  } catch (error) {
    return handleRouteError(error);
  }
}
