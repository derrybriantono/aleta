import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { ambilBerkasGateway } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
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
 * ============================================================================
 * DATA UMUM DARI BERKAS e-COURT YANG SUDAH ADA DI ARSIP ALETA
 * ============================================================================
 *
 * Rute /penunjukan/berkas sudah lama memetik Data Umum dari berkas gugatan -
 * tetapi berkas itu harus DICARI dan DIPILIH petugas dari cakramnya sendiri.
 * Padahal berkas yang sama sudah ditarik ALETA dari e-Court dan tersimpan di
 * arsipnya sejak hari perkara itu didaftarkan.
 *
 * Jadi yang dikerjakan petugas selama ini: membuka e-Court, mengunduh
 * gugatannya sekali lagi, menyimpannya entah di mana, lalu memilihnya di
 * panel. Tiga langkah untuk berkas yang sudah ada di tangan ALETA.
 *
 * Rute ini menghapus ketiganya. Yang dikirim hanya document_key-nya; berkasnya
 * diambil dari arsip, dibaca di memori, dipetik, lalu dilepas.
 *
 * ============================================================================
 * TIDAK ADA SALINAN BARU, DAN TIDAK ADA YANG DIISI SENDIRI
 * ============================================================================
 *
 * Sama dengan rute unggahan di sebelahnya: berkasnya tidak disimpan ulang di
 * mana pun, dan hasilnya USULAN yang digambar di papan untuk diperiksa orang -
 * bukan isian yang langsung masuk ke SIPP.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "penunjukan");

    const badan = (await request.json()) as Record<string, unknown>;

    const documentKey = String(badan.documentKey ?? "").trim();
    if (!documentKey) {
      return ok({ ok: false, alasan: "document_key_kosong" });
    }

    // Hanya dua bentuk yang dikenal arsipnya. Meneruskan apa pun yang dikirim
    // peramban berarti meneruskannya ke kueri bot.
    const format = String(badan.format ?? "pdf") === "word" ? "word" : "pdf";

    const respons = await ambilBerkasGateway(documentKey, format);
    if (!respons.ok) {
      return ok({
        ok: false,
        alasan: respons.status === 404 ? "berkas_tidak_ada_di_arsip" : "berkas_tidak_terambil",
        pesan:
          respons.status === 404
            ? "Berkas ini belum tersimpan di arsip ALETA. Tarik dahulu dari e-Court, atau pilih berkasnya sendiri."
            : `Arsip menjawab ${respons.status}.`,
      });
    }

    // Nama berkasnya dari Content-Disposition - itulah yang menentukan cara
    // membacanya. Tanpa nama, .docx dan .pdf tidak dapat dibedakan sama sekali.
    const disposisi = respons.headers.get("content-disposition") || "";
    const cocok = /filename="([^"]*)"/.exec(disposisi);
    let nama = cocok ? cocok[1] : "";
    try {
      nama = decodeURIComponent(nama);
    } catch {
      /* nama yang tidak dapat diurai dipakai apa adanya */
    }
    if (!nama) nama = format === "word" ? "gugatan.docx" : "gugatan.pdf";

    if (!jenisDariNama(nama)) {
      return ok({
        ok: false,
        alasan: "jenis_berkas_tidak_didukung",
        pesan: `Berkas arsip "${nama}" bukan jenis yang dapat dibaca.`,
      });
    }

    const isi = Buffer.from(await respons.arrayBuffer());
    if (isi.length > BATAS_UKURAN_BERKAS) {
      return ok({
        ok: false,
        alasan: "berkas_terlalu_besar",
        pesan: `Ukuran berkas melampaui ${Math.round(BATAS_UKURAN_BERKAS / 1024 / 1024)} MB.`,
      });
    }

    const hasil = await bacaBerkas(nama, isi);
    if (!hasil.teks) {
      return ok({ ok: false, alasan: hasil.alasan || "berkas_tidak_terbaca", jenis: hasil.jenis });
    }

    return ok({
      ok: true,
      jenis: hasil.jenis,
      kasar: hasil.kasar,
      nama,
      dariArsip: true,
      petikan: petikDataUmum(hasil.teks),
      panjangTeks: hasil.teks.length,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PENUNJUKAN_BERKAS_ARSIP_BACA_FAILED",
      feature: "penunjukan",
      entityId: "berkas-arsip",
    });
  }
}
