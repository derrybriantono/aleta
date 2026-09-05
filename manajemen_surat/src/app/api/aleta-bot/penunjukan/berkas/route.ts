import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  BATAS_UKURAN_BERKAS,
  bacaBerkas,
  jenisDariNama,
  petikDataUmum,
} from "@/server/modules/aleta-ecourt/berkas-gugatan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Membaca berkas gugatan yang diunggah, dan memetik isian Data Umum darinya.
 *
 * ============================================================================
 * BERKASNYA TIDAK DISIMPAN
 * ============================================================================
 *
 * Ia dibaca di memori, dipetik isinya, lalu dilepas. Yang dikembalikan hanya
 * petikannya beserta kalimat asal tiap petikan.
 *
 * Menyimpannya berarti menyimpan salinan kedua berkas perkara di luar SIPP dan
 * e-Court - dua tempat yang sudah punya aturan penyimpanan, pencadangan, dan
 * pemusnahannya sendiri. Salinan ketiga tanpa aturan itu adalah kewajiban baru
 * yang tidak diminta siapa pun.
 *
 * ============================================================================
 * HASILNYA USULAN, DAN SELALU DIPERIKSA
 * ============================================================================
 *
 * Rute ini TIDAK mengisi apa pun. Ia mengembalikan petikan untuk ditampilkan
 * di papan, diperiksa orang, baru kemudian diisikan ekstensi bila disetujui.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "penunjukan");

    const formulir = await request.formData();
    const berkas = formulir.get("berkas");

    if (!(berkas instanceof File)) {
      return ok({ ok: false, alasan: "berkas_tidak_dikirim" });
    }

    const nama = String(berkas.name || "");
    if (!jenisDariNama(nama)) {
      return ok({
        ok: false,
        alasan: "jenis_berkas_tidak_didukung",
        pesan: "Yang dapat dibaca hanya .docx, .doc, .rtf, .pdf, dan .txt.",
      });
    }

    // Ukurannya diperiksa SEBELUM dibaca ke memori. Memeriksa sesudahnya
    // berarti berkas seukuran apa pun sudah terlanjur masuk memori server.
    if (berkas.size > BATAS_UKURAN_BERKAS) {
      return ok({
        ok: false,
        alasan: "berkas_terlalu_besar",
        pesan: `Ukuran berkas melampaui ${Math.round(BATAS_UKURAN_BERKAS / 1024 / 1024)} MB.`,
      });
    }

    const isi = Buffer.from(await berkas.arrayBuffer());
    const hasil = await bacaBerkas(nama, isi);

    if (!hasil.teks) {
      return ok({ ok: false, alasan: hasil.alasan || "berkas_tidak_terbaca", jenis: hasil.jenis });
    }

    return ok({
      ok: true,
      jenis: hasil.jenis,
      kasar: hasil.kasar,
      nama,
      petikan: petikDataUmum(hasil.teks),
      // Panjang teksnya disebutkan supaya yang membaca tahu seberapa banyak
      // yang terbaca - berkas yang hanya terbaca dua baris hampir pasti gagal
      // dibaca, walau tidak melempar galat.
      panjangTeks: hasil.teks.length,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENUNJUKAN_BERKAS_BACA_FAILED",
      feature: "penunjukan",
      entityId: "berkas",
    });
  }
}
