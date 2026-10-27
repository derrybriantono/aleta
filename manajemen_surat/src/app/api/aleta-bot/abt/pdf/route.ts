import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getGatewayAbtPdf } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pilihCap } from "@/server/modules/aleta-ecourt/penetapan-edoc";
import { ukuranTtdCapBerlaku } from "@/server/modules/aleta-ecourt/ukuran-ttd-cap";
import { ukuranUntukBot } from "@/lib/ukuran-ttd-cap";
import { bubuhkanTtdPdf, type TtdMasuk } from "@/server/modules/aleta-ecourt/pdf-bubuh-ttd";
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
/** Tanda tangan yang dibubuhkan di PDF biasa (27 Okt): paling banyak enam penanda tangan, gambar masing-masing paling besar 4 MB. */
const BATAS_TTD_PDF = 6;
const BATAS_GAMBAR_TTD_BASE64 = 6 * 1024 * 1024;

function bacaTtdMasuk(mentah: unknown): TtdMasuk[] {
  if (!Array.isArray(mentah)) return [];
  const hasil: TtdMasuk[] = [];
  for (const butir of mentah.slice(0, BATAS_TTD_PDF)) {
    const b = (butir ?? {}) as { nama?: unknown; pngBase64?: unknown };
    const nama = String(b.nama ?? "").trim().slice(0, 200);
    const base64 = String(b.pngBase64 ?? "");
    if (!nama || !base64 || base64.length > BATAS_GAMBAR_TTD_BASE64) continue;
    hasil.push({ nama, gambar: new Uint8Array(Buffer.from(base64, "base64")) });
  }
  return hasil;
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");

    const body = await readJsonBody<{ rtfBase64?: unknown; salinan?: unknown; ttd?: unknown }>(request).catch(
      () => ({}) as { rtfBase64?: unknown; salinan?: unknown; ttd?: unknown }
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
    //
    // 27 Okt: gambar tanda tangan (dan cap) TIDAK lagi ditebak posisinya di RTF. Bot hanya menyediakan ruang dan mengembalikan gambar
    // Panitera (ttdDiPdf); portal membubuhkannya di PDF hasil konversi, di atas nama, dari koordinat baris nama di PDF.
    let salinanOpsi: { salinan: true; atur: ReturnType<typeof ukuranUntukBot>; cap: { jenis: string; isiBase64: string } | null; ttdDiPdf: true } | null = null;
    let atur: ReturnType<typeof ukuranUntukBot> | null = null;
    let capKantor: { jenisBerkas: string; isi: Buffer } | null = null;
    if (salinan) {
      atur = ukuranUntukBot(await ukuranTtdCapBerlaku(db));
      const c = await pilihCap(db, "ppp", null).catch(() => null);
      capKantor = c ? { jenisBerkas: c.jenisBerkas, isi: c.isi } : null;
      salinanOpsi = { salinan: true, atur, cap: c ? { jenis: c.jenisBerkas, isiBase64: c.isi.toString("base64") } : null, ttdDiPdf: true };
    }
    const ttdMasuk = salinan ? [] : bacaTtdMasuk(body.ttd);
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

    let pdfBase64 = hasil.data?.pdfBase64 ?? "";
    let ttdPdf: { dipasang: string[]; tidakDitemukan: string[]; galat?: string } | undefined;
    let keteranganSalinan = hasil.data?.salinan ?? null;

    if (ttdMasuk.length && pdfBase64) {
      // PDF biasa + "Tambah tanda tangan": tiap gambar di atas nama pemiliknya (blok "Untuk Salinan" yang tersembunyi tidak dibubuhi).
      const aturBiasa = ukuranUntukBot(await ukuranTtdCapBerlaku(db));
      const r = await bubuhkanTtdPdf(new Uint8Array(Buffer.from(pdfBase64, "base64")), ttdMasuk, { atur: aturBiasa, sebelumPenanda: true });
      pdfBase64 = Buffer.from(r.pdf).toString("base64");
      ttdPdf = { dipasang: r.dipasang, tidakDitemukan: r.tidakDitemukan, ...(r.galat ? { galat: r.galat } : {}) };
    }

    if (salinan && pdfBase64 && hasil.data?.ttdPanitera) {
      // PDF SALINAN: satu-satunya gambar tanda tangan adalah Panitera pengesah di blok "Untuk Salinan" (+ cap kantor bila ada).
      const t = hasil.data.ttdPanitera;
      const gambar = new Uint8Array(Buffer.from(t.isiBase64, "base64"));
      const r = await bubuhkanTtdPdf(
        new Uint8Array(Buffer.from(pdfBase64, "base64")),
        [{ nama: t.nama, gambar, cap: capKantor ? new Uint8Array(capKantor.isi) : null }],
        { atur: atur ?? undefined, sesudahPenanda: true }
      );
      if (r.dipasang.length) pdfBase64 = Buffer.from(r.pdf).toString("base64");
      if (keteranganSalinan) {
        keteranganSalinan = r.dipasang.length
          ? { ...keteranganSalinan, gambarTtdPanitera: true, alasanTanpaGambar: "" }
          : { ...keteranganSalinan, gambarTtdPanitera: false, alasanTanpaGambar: r.galat || "nama_panitera_tidak_ditemukan_di_pdf" };
      }
    }

    return ok({
      available: true,
      message: "",
      pdfBase64,
      byte: ttdPdf?.dipasang.length || (salinan && hasil.data?.ttdPanitera) ? Buffer.byteLength(pdfBase64, "base64") : (hasil.data?.byte ?? 0),
      versiMesin: hasil.data?.versiMesin ?? "",
      ...(salinan ? { salinan: keteranganSalinan } : {}),
      ...(ttdPdf ? { ttdPdf } : {}),
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
