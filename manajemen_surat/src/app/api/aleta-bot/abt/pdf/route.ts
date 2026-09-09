import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayAbtPdf } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
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
    await pastikanKapabilitas(db, actorUserId, "panel");

    const body = await readJsonBody<{ rtfBase64?: unknown }>(request).catch(
      () => ({}) as { rtfBase64?: unknown }
    );
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

    const hasil = await getGatewayAbtPdf(rtfBase64);
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
