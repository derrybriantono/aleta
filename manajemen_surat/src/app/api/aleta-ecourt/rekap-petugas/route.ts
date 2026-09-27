import { type NextRequest } from "next/server";

import { bacaPermintaanRekap } from "@/lib/rekap-petugas";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { getGatewayRekapPetugas } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rekap satu petugas: hakim, panitera pengganti, juru sita, atau mediator.
 *
 *   ?peran=hakim&id=26[&tahun=2026][&keadaan=proses][&kedudukan=ketua][&lewati=0][&batas=100]
 *
 * ============================================================================
 * KEWENANGANNYA SAMA DENGAN STATUS PERKARA
 * ============================================================================
 *
 * Halaman ini dibuka dari nama pada layar Status Perkara, dan isinya
 * keterangan perkara satker yang sama - hanya dikumpulkan menurut orangnya.
 * Karena itu kemampuannya kemampuan panel, persis seperti rute status-perkara:
 * yang boleh membaca perkaranya boleh membaca siapa yang menanganinya.
 *
 * Urutannya disengaja: kewenangan diperiksa LEBIH DAHULU, baru alamatnya.
 * Yang tidak berwenang tidak perlu diberi tahu bentuk alamat yang benar.
 *
 * ============================================================================
 * ALAMAT YANG SALAH DITOLAK DI SINI, TIDAK DITERUSKAN
 * ============================================================================
 *
 * Peran yang tidak dikenal atau id yang bukan bilangan bulat dijawab 400
 * beserta kalimatnya, tanpa memanggil bot. Bot memeriksa ulang dengan aturan
 * yang sama - ia juga dipanggil jalur lain - tetapi pintu ini tidak
 * menyerahkan pekerjaan menolak kepada bot yang mungkin sedang mati.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const permintaan = bacaPermintaanRekap(request.nextUrl.searchParams);
    if (!permintaan.ok) throw new ApiError(400, permintaan.pesan);

    const hasil = await getGatewayRekapPetugas(permintaan.nilai);
    if (!hasil.ok) {
      // Kalimat bot diteruskan apa adanya - "Tidak ada hakim dengan ID SIPP
      // 999." atau "aleta_bot tidak dapat dihubungi" - sebab keduanya sudah
      // ditulis untuk dibaca petugas, dan menggantinya dengan kalimat umum
      // menghapus satu-satunya petunjuk apa yang harus dilakukan.
      return ok({ available: false, rekap: null, pesan: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }
    return ok({ available: true, rekap: hasil.data, pesan: "" });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_REKAP_PETUGAS_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
