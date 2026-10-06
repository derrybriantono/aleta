import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
// Penyusun isinya hidup di modul bersama sejak 30 September 2026 - sinkron
// berkas perkara ke Google Drive memakai penyusun yang SAMA, supaya pohon
// folder di Drive tidak pernah menyimpang dari isi ZIP ini.
import {
  BATAS_SELURUH_ALIR_MS,
  namaBerkasArsipPerkara,
  susunArsipPerkara,
} from "@/server/modules/aleta-ecourt/susun-arsip-perkara";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { nextPrefixedId } from "@/server/shared/ids";
import { buatPenulisZip } from "@/server/shared/zip";

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
 * Perkara dengan berkas sangat besar dapat menghabiskan memori portal dan
 * menjatuhkannya bagi SELURUH pengguna - bukan hanya bagi yang menekan
 * tombolnya. Karena itu ada batas jumlah dan batas ukuran, dan berkas yang
 * tidak masuk DISEBUTKAN di dalam ZIP-nya sendiri lewat berkas KETERANGAN.txt -
 * bukan dihilangkan diam-diam.
 *
 * ============================================================================
 * SEJAK 6 OKTOBER 2026: DIALIRKAN, BUKAN DIKIRIM SEKALIGUS (butir 25)
 * ============================================================================
 *
 * "Unduh seluruh perkara" 445/Pdt.G/2026/PA.Dgl menjawab "Failed to fetch"
 * enam kali berturut-turut. Yang terukur (hanya baca) di peladen:
 *
 *   - jejak audit ECOURT_PERKARA_ZIP_LENGKAP: 51 berkas, 25.818.199 byte,
 *     detikPenyusunan 1 - ZIP-nya TERSUSUN, dalam satu detik;
 *   - access_log Apache: status 200, tetapi yang terkirim hanya 11.547.488,
 *     12.353.536, 11.655.312, 12.923.744, 12.197.888, 11.604.832 byte - selalu
 *     terputus di tengah, di titik yang berbeda-beda;
 *   - error_log Apache dan log container portal/bot: bersih - bukan peladen
 *     yang memutus; 385 (10,6 MB) dan 473 (8,2 MB) pada 29 Sep turun utuh;
 *   - unduhan berkas statis 32 MB lewat Apache yang sama ke komputer yang sama
 *     utuh dalam 9 detik - jaringannya sehat;
 *   - komputer itu menjalankan IDM 6.42 dengan ZIP di daftar tangkapannya dan
 *     ekstensi IDM terpasang di Chrome.
 *
 * Jadi yang memutus adalah sisi peramban: tombol lama mengambil ZIP lewat
 * fetch() lalu menunggu SELURUH badannya sebagai blob, dan jawaban ber-
 * Content-Disposition attachment sebesar itu dipotong di tengah - paling
 * mungkin oleh pengelola unduhan yang menyela permintaan fetch; pemindai
 * jaringan di komputer itu belum dapat dikesampingkan - lalu fetch melempar
 * "Failed to fetch". Perbaikannya dua sisi:
 *
 *   - tombol tidak lagi memakai fetch + blob: ia membuka alamat ini sebagai
 *     UNDUHAN BIASA peramban (lihat src/lib/unduh-alir.ts), yang memang jalur
 *     yang dikenali pengelola unduhan;
 *   - rute ini MENGALIRKAN ZIP-nya: tiap berkas dikirim begitu ditarik dari bot
 *     (buatPenulisZip), sehingga byte pertama keluar dalam hitungan detik, tidak
 *     ada keheningan panjang bagi proksi, dan memori portal tidak menampung
 *     seluruh arsip dua kali.
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


    // Penanda unduhan dari tombol (src/lib/unduh-alir.ts). Peramban tidak
    // memberi tahu halaman kapan unduhan biasa dimulai; cookie bernama token
    // inilah tandanya - dipasang pada kepala jawaban yang BERHASIL saja.
    const tokenMentah = String(request.nextUrl.searchParams.get("token") || "");
    const token = /^[A-Za-z0-9]{6,40}$/.test(tokenMentah) ? tokenMentah : "";

    // ========================================================================
    // ZIP DIALIRKAN: tiap berkas dikirim begitu ditarik dari bot
    // ========================================================================
    const penulis = buatPenulisZip();
    let pengendali: ReadableStreamDefaultController<Uint8Array> | null = null;
    let dibatalkan = false;
    let bangunkan: (() => void) | null = null;
    const bangun = () => {
      const b = bangunkan;
      bangunkan = null;
      b?.();
    };
    const aliran = new ReadableStream<Uint8Array>(
      {
        start(c) {
          pengendali = c;
        },
        pull() {
          bangun();
        },
        cancel() {
          // Peramban menutup unduhan (dibatalkan, atau diambil alih pengelola
          // unduhan): berkas sisanya tidak perlu ditarik dari bot lagi.
          dibatalkan = true;
          bangun();
        },
      },
      // Penahan: paling banyak sekitar 8 MB menunggu di antrian sebelum
      // penarikan berikutnya ditahan sampai peramban mengambilnya.
      new ByteLengthQueuingStrategy({ highWaterMark: 8 * 1024 * 1024 })
    );
    const kirimPotongan = (potongan: Buffer) => {
      if (dibatalkan || !pengendali || potongan.byteLength === 0) return;
      pengendali.enqueue(new Uint8Array(potongan.buffer, potongan.byteOffset, potongan.byteLength));
    };

    let mulaiAlir: () => void = () => {};
    const sudahMulai = new Promise<"mulai">((selesai) => {
      mulaiAlir = () => selesai("mulai");
    });

    const kerja = susunArsipPerkara({
      nomor,
      sumber,
      lengkap,
      sertakanArsip,
      batasSeluruhMs: BATAS_SELURUH_ALIR_MS,
      alir: {
        kirim(berkas) {
          mulaiAlir();
          for (const potongan of penulis.tambah(berkas)) kirimPotongan(potongan);
        },
        async tunggu() {
          while (!dibatalkan && pengendali && (pengendali.desiredSize ?? 1) <= 0) {
            await new Promise<void>((lanjut) => {
              bangunkan = lanjut;
            });
          }
          if (dibatalkan) throw new Error("unduhan ditutup peramban");
        },
      },
    });

    // Kepala jawaban baru dikirim sesudah entri PERTAMA ada - sehingga perkara
    // yang sama sekali tanpa berkas tetap dijawab 404 berpesan, seperti dulu.
    const pertama = await Promise.race([sudahMulai, kerja]);
    if (pertama !== "mulai" && pertama.jumlahIsi === 0) {
      return Response.json(
        { ok: false, alasan: "tidak_ada_berkas_tersimpan", keterangan: pertama.dilewati.slice(0, 20) },
        { status: 404 }
      );
    }

    const namaZip = namaBerkasArsipPerkara(nomor, { lengkap, sumber });
    const dbAudit = db;

    void kerja.then(
      async (hasil) => {
        kirimPotongan(penulis.tutup());
        if (!dibatalkan) pengendali?.close();

        // ====================================================================
        // YANG BERHASIL IKUT DICATAT, BUKAN HANYA YANG GAGAL
        // ====================================================================
        //
        // Satu tekan membawa SELURUH perkara ke luar portal: nama para pihak,
        // alamat pada resi pos, alamat saksi, dan putusan yang belum
        // dianonimkan. handleAdminRouteError hanya mencatat kegagalan,
        // sehingga jejak yang ada sekarang tidak dapat menjawab pertanyaan
        // yang justru akan ditanyakan - siapa yang membawa berkas perkara ini
        // keluar, dan kapan.
        // Salinan yang pasti tidak null - `db` luar bertipe nullable di dalam
        // penutup ini.
        const db = dbAudit;
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
            jumlahBerkas: hasil.daftar.length,
            totalByte: hasil.totalByte,
            // Ukuran ZIP sungguhan yang dialirkan - dan apakah peramban
            // menerimanya sampai habis atau menutupnya di tengah.
            byteZip: penulis.posisi,
            ditutupPeramban: dibatalkan,
            jumlahDilewati: hasil.dilewati.length,
            // Berapa bagian yang tabelnya ikut tetapi TIDAK TERBACA. Tanpa
            // angka ini, jejak audit tidak dapat membedakan ekspor yang
            // lengkap dari ekspor yang tampak lengkap - dan yang kedua yang
            // dikirim ke banding.
            jumlahTakTerbaca: hasil.takTerbaca.length,
            oleh: actor?.name || "",
            detikPenyusunan: Math.round((Date.now() - hasil.mulai) / 1000),
          },
        }).catch(() => {
          // Jejak yang gagal dicatat tidak boleh membatalkan unduhan yang
          // sudah terkirim - yang hilang catatannya, bukan pekerjaannya.
        });
      },
      (galat) => {
        // Gagal SESUDAH kepala terkirim: alirannya diputus dengan galat supaya
        // peramban menandai unduhannya gagal - bukan ZIP terpotong yang tampak
        // utuh.
        if (!dibatalkan) pengendali?.error(galat);
        console.error("[berkas-zip] penyusunan terhenti di tengah aliran:", galat);
      }
    );

    const kepala = new Headers({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(namaZip)}"; filename*=UTF-8''${encodeURIComponent(namaZip)}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      // Proksi nginx (deploy/nginx) tidak boleh menampung aliran ini dulu.
      "X-Accel-Buffering": "no",
    });
    if (token) {
      kepala.append("Set-Cookie", `aleta_unduh_${token}=1; Path=/; Max-Age=300; SameSite=Lax`);
    }
    return new Response(aliran, { status: 200, headers: kepala });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_BERKAS_ZIP_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
