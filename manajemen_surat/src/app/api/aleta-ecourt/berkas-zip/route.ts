import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
// Penyusun isinya hidup di modul bersama sejak 30 September 2026 - sinkron
// berkas perkara ke Google Drive memakai penyusun yang SAMA, supaya pohon
// folder di Drive tidak pernah menyimpang dari isi ZIP ini.
import {
  namaBerkasArsipPerkara,
  susunArsipPerkara,
} from "@/server/modules/aleta-ecourt/susun-arsip-perkara";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { nextPrefixedId } from "@/server/shared/ids";
import { susunZip } from "@/server/shared/zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Seluruh berkas satu perkara - SIPP dan e-Court - dalam satu ZIP.
 *
 * ============================================================================
 * KENAPA DIPERLUKAN
 * ============================================================================
 *
 * Majelis yang menyiapkan sidang memerlukan SELURUH berkas perkara, bukan satu
 * per satu. Satu perkara dapat memuat belasan dokumen, dan menekan tombol unduh
 * belasan kali - lalu mencari belasan berkas di folder Downloads yang namanya
 * berdekatan - adalah pekerjaan yang tidak perlu ada.
 *
 * ============================================================================
 * DUA SUMBER, DAN SAMPAI 23 SEPTEMBER 2026 HANYA SATU YANG TERBACA
 * ============================================================================
 *
 * Rute ini dulu membaca arsip e-Court saja. Perkara yang tidak pernah lewat
 * e-Court dijawab 404 "tidak_ada_dokumen" - padahal 41 relaas dan 8 berita
 * acara sidangnya tersimpan rapi di cakram SIPP. Terukur di sipp_donggala:
 * gugatan tersimpan pada 10.119 dari 10.120 perkara, relaas 14.212 dari
 * 14.495, resi pos 8.351, BAS 15.248, putusan 9.903 dari 9.993.
 *
 * Sekarang keduanya dikemas, berkelompok menurut jenisnya:
 *
 *   01 Gugatan/     surat gugatan atau permohonan
 *   02 Relaas/      relaas panggilan, urut tanggal; resi pos di subfoldernya
 *   03 BAS/         berita acara sidang, urut sidang keberapa
 *   04 Putusan/     putusan dan salinan anonimnya
 *   05 Lampiran/    dokumen lain yang dicatat SIPP
 *   06 e-Court/     jawaban, replik, duplik, kesimpulan, alat bukti
 *
 * ============================================================================
 * SEJAK 25 SEPTEMBER 2026: DATANYA JUGA, BUKAN HANYA BERKASNYA
 * ============================================================================
 *
 * Dengan isi=lengkap, tiga folder lagi ikut - dan folder 00 berdiri paling
 * atas supaya urutan bacanya benar di penjelajah berkas mana pun:
 *
 *   00 Data SIPP/   perkara.json apa adanya + 26 tabel CSV yang dibuka Excel
 *   07 Penetapan/   PMH, PPP, PJS, PHS, dan penetapan ikrar talak
 *   08 Arsip fisik/ berkas pindaian arsip - hanya bila DIMINTA (2-28 MB sebuah)
 *
 * Penomorannya SENGAJA ditambah di belakang, bukan diurutkan ulang: 01-06
 * sudah terpasang di peladen sejak 23 September dan petugas sudah punya ZIP
 * bernomor itu di cakramnya. Menomori ulang membuat dua arsip perkara yang
 * sama tampak seperti dua hal berbeda.
 *
 * ============================================================================
 * ADA BATASNYA, DAN BATASNYA DISEBUTKAN
 * ============================================================================
 *
 * ZIP disusun di memori. Perkara dengan berkas sangat besar dapat menghabiskan
 * memori portal dan menjatuhkannya bagi SELURUH pengguna - bukan hanya bagi yang
 * menekan tombolnya. Karena itu ada batas jumlah dan batas ukuran, dan berkas
 * yang tidak masuk DISEBUTKAN di dalam ZIP-nya sendiri lewat berkas
 * KETERANGAN.txt - bukan dihilangkan diam-diam.
 *
 * ============================================================================
 * BERKAS DIAMBIL DARI ARSIP, BUKAN DARI e-COURT
 * ============================================================================
 *
 * Yang dikemas adalah berkas yang SUDAH tersimpan di server. Rute ini tidak
 * pernah menyentuh e-Court - menarik belasan berkas dari Mahkamah Agung karena
 * satu orang menekan satu tombol bukan perilaku yang pantas.
 */

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "berkas");

    const nomor = String(request.nextUrl.searchParams.get("nomor") || "").trim();
    if (!nomor) {
      return Response.json({ ok: false, alasan: "nomor_perkara_kosong" }, { status: 400 });
    }

    const sumberMinta = String(request.nextUrl.searchParams.get("sumber") || "semua").toLowerCase();
    const sumber = sumberMinta === "ecourt" || sumberMinta === "sipp" ? sumberMinta : "semua";

    // "berkas" = perilaku lama, persis. "lengkap" = data SIPP + berkas, dan
    // hanya itu yang dipakai layar Status Perkara. Bawaannya tetap "berkas"
    // supaya panel Antrian Sidang dan Arsip berkas tidak berubah sedikit pun.
    const lengkap = String(request.nextUrl.searchParams.get("isi") || "").toLowerCase() === "lengkap";
    // Berkas pindaian arsip fisik ikut hanya bila DIMINTA: terukur 2 MB sampai
    // 28 MB sebuah, dan itu selisih yang menentukan apakah seseorang
    // mengunduhnya sekarang atau menunggu.
    const sertakanArsip = lengkap && request.nextUrl.searchParams.get("arsipFisik") === "1";

    const { isiZip, daftar, dilewati, takTerbaca, totalByte, mulai } = await susunArsipPerkara({
      nomor,
      sumber,
      lengkap,
      sertakanArsip,
    });

    if (isiZip.length === 0) {
      return Response.json(
        { ok: false, alasan: "tidak_ada_berkas_tersimpan", keterangan: dilewati.slice(0, 20) },
        { status: 404 }
      );
    }

    const zip = susunZip(isiZip);
    const namaZip = namaBerkasArsipPerkara(nomor, { lengkap, sumber });

    // ========================================================================
    // YANG BERHASIL IKUT DICATAT, BUKAN HANYA YANG GAGAL
    // ========================================================================
    //
    // Satu tekan membawa SELURUH perkara ke luar portal: nama para pihak,
    // alamat pada resi pos, alamat saksi, dan putusan yang belum dianonimkan.
    // handleAdminRouteError hanya mencatat kegagalan, sehingga jejak yang ada
    // sekarang tidak dapat menjawab pertanyaan yang justru akan ditanyakan -
    // siapa yang membawa berkas perkara ini keluar, dan kapan.
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId,
      action: lengkap ? "ECOURT_PERKARA_ZIP_LENGKAP" : "ECOURT_BERKAS_ZIP",
      entityType: "perkara",
      entityId: nomor,
      payload: {
        nomorPerkara: nomor,
        sumber,
        isi: lengkap ? "lengkap" : "berkas",
        arsipFisik: sertakanArsip,
        jumlahBerkas: daftar.length,
        totalByte,
        jumlahDilewati: dilewati.length,
        // Berapa bagian yang tabelnya ikut tetapi TIDAK TERBACA. Tanpa angka
        // ini, jejak audit tidak dapat membedakan ekspor yang lengkap dari
        // ekspor yang tampak lengkap - dan yang kedua yang dikirim ke banding.
        jumlahTakTerbaca: takTerbaca.length,
        oleh: actor?.name || "",
        detikPenyusunan: Math.round((Date.now() - mulai) / 1000),
      },
    }).catch(() => {
      // Jejak yang gagal dicatat tidak boleh membatalkan unduhan yang sudah
      // tersusun - yang hilang catatannya, bukan pekerjaannya.
    });

    return new Response(new Uint8Array(zip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(namaZip)}"`,
        "Content-Length": String(zip.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_BERKAS_ZIP_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
