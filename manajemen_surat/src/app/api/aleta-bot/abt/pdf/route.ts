import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayAbtPdf } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pilihCap } from "@/server/modules/aleta-ecourt/penetapan-edoc";
import { ukuranTtdCapBerlaku } from "@/server/modules/aleta-ecourt/ukuran-ttd-cap";
import { ukuranUntukBot } from "@/lib/ukuran-ttd-cap";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mengubah RTF putusan menjadi PDF.
 *
 * ============================================================================
 * KENAPA LEWAT PORTAL, BUKAN LANGSUNG KE BOT
 * ============================================================================
 *
 * Ekstensi berjalan di peramban petugas dan tidak memegang token internal bot -
 * kalau dipegangnya, siapa pun yang membuka alat pengembang peramban akan
 * memilikinya juga. Portal yang menyimpan token itu, dan portal pula yang
 * memeriksa sesi serta kewenangan sebelum meneruskan.
 *
 * ============================================================================
 * YANG DILEWATKAN DI SINI HANYALAH BERKAS PUTUSAN
 * ============================================================================
 *
 * Isi putusan memuat nama, alamat, dan NIK para pihak. Rute ini TIDAK
 * menyimpannya - tidak ke basis data, tidak ke disk portal. Ia meneruskan,
 * menerima PDF-nya, lalu melupakannya. Yang menyimpan hanya peramban petugas,
 * sebagai berkas unduhan yang memang dimintanya.
 *
 * Batasnya dijaga di dua tempat - di sini dan di bot - dengan alasan yang
 * sama seperti rute massal: pemanggil yang mengirim berkas raksasa tidak boleh
 * sampai menjalankan LibreOffice.
 */
const BATAS_BASE64 = 28 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");

    const body = await readJsonBody<{ rtfBase64?: unknown; salinan?: unknown }>(request).catch(
      () => ({}) as { rtfBase64?: unknown; salinan?: unknown }
    );
    // 14 Okt: PDF SALINAN - "SALINAN" kanan atas, "ttd", blok Untuk Salinan
    // tampak, dan tanda tangan Panitera yang sudah disahkan (dibubuhkan bot).
    const salinan = body.salinan === true;
    const rtfBase64 = String(body.rtfBase64 || "");
    if (!rtfBase64) {
      return ok({ available: false, message: "Berkas RTF tidak terkirim." });
    }
    if (rtfBase64.length > BATAS_BASE64) {
      return ok({
        available: false,
        message: "Berkas putusan terlalu besar untuk dikonversi.",
      });
    }

    // 20 Okt: salinan memakai ukuran tanda tangan/cap yang sama dengan e-Doc penetapan dan
    // ekstensi, dan Panitera (pengesah salinan) berhak CAP - cap peruntukan Panitera
    // (cadangan: cap Umum) dibubuhkan bot di sisi kiri tanda tangan. Cap tidak ada = tanpa cap.
    let salinanOpsi: { salinan: true; atur: ReturnType<typeof ukuranUntukBot>; cap: { jenis: string; isiBase64: string } | null } | null = null;
    if (salinan) {
      const atur = ukuranUntukBot(await ukuranTtdCapBerlaku(db));
      const c = await pilihCap(db, "ppp", null).catch(() => null);
      salinanOpsi = { salinan: true, atur, cap: c ? { jenis: c.jenisBerkas, isiBase64: c.isi.toString("base64") } : null };
    }
    const hasil = await getGatewayAbtPdf(rtfBase64, salinanOpsi ?? { salinan });
    if (!hasil.ok) {
      return ok({
        available: false,
        // Sebabnya diteruskan apa adanya. Yang paling sering muncul -
        // LibreOffice belum terpasang di container bot - hanya berguna bila
        // disebutkan, bukan diganti "gagal mengonversi".
        message: hasil.error || "ALETA Bot belum dapat dihubungi.",
      });
    }

    return ok({
      available: true,
      message: "",
      pdfBase64: hasil.data?.pdfBase64 ?? "",
      byte: hasil.data?.byte ?? 0,
      versiMesin: hasil.data?.versiMesin ?? "",
      ...(salinan ? { salinan: hasil.data?.salinan ?? null } : {}),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ABT_PDF_FAILED",
      feature: "abt_cetak",
    });
  }
}
