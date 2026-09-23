"use strict";

/**
 * ============================================================================
 * TIAP DOKUMEN e-COURT MILIK SIDANG YANG MANA
 * ============================================================================
 *
 * Diminta pengguna 23 September 2026: "tanggal sidang tiap dokumen e-Court".
 *
 * Sebelumnya seluruh dokumen satu perkara menerima agenda yang SAMA - agenda
 * terakhir perkara itu - dan tanggal sidangnya tidak pernah terisi sama
 * sekali. Penyebabnya bukan data yang hilang: halaman e-Court menuliskan
 * tanggal sidang tiap blok agenda dengan jelas. Yang hilang penyambungnya.
 *
 * Yang dijaga di sini tiga hal, dan semuanya dapat gagal DIAM-DIAM:
 *
 *   1. dokumen membawa agenda BLOKNYA SENDIRI, bukan agenda terakhir perkara;
 *   2. dokumen yang berdiri sebelum blok agenda pertama tetap terbaca, dengan
 *      agenda KOSONG - bukan meminjam agenda blok sesudahnya;
 *   3. dua dokumen dalam satu blok beragenda sama - inilah penjaga atas batas
 *      blok yang menelan agenda berikutnya.
 */

const path = require("path");

const scraper = require(path.join(__dirname, "..", "tools", "ecourt-bridge", "scraper.js"));

let lulus = 0;
let gagal = 0;

function periksa(label, kondisi) {
  if (kondisi) {
    lulus += 1;
    console.log(`  OK    ${label}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${label}`);
  }
}

/**
 * Disalin dari tangkapan nyata perkara 620/Pdt.G/2025/PA.Dgl, lalu ditambah
 * satu dokumen kedua di blok pertama supaya batas blok ikut teruji.
 */
const HTML_DUA_BLOK = `
<div class="timeline">
  <p>Agenda Sidang : <b>Jawaban Tergugat</b> Silahkan Mengupload Berkas Persidangan Sebelum : Selasa, 09 Desember 2025 Pukul : 15:00:00 WIB</p>
  <p>Alasan di Tunda : <b>Replik Penggugat</b></p>
  <ol>
    <li>
      Dokumen diupload oleh : <b>Tergugat - rusman.rusli73@gmail.com</b><br />
      Upload pada : Selasa, 09 Desember 2025 Jam : 11:30 WIB<br />
      Status Dokumen: Sudah diverifikasi Majelis/Hakim (Dokumen Valid)<br />
      Jenis : Jawaban<br />
      Judul Dokumen : Jawaban Tergugat Sri Astuti Ningsih<br />
      Dokumen : <a href="download/abc">Lihat Dokumen</a>
    </li>
    <li>
      Dokumen diupload oleh : <b>Tergugat - rusman.rusli73@gmail.com</b><br />
      Upload pada : Selasa, 09 Desember 2025 Jam : 11:35 WIB<br />
      Status Dokumen: Sudah diverifikasi Majelis/Hakim (Dokumen Valid)<br />
      Jenis : Jawaban<br />
      Judul Dokumen : Lampiran Jawaban<br />
      Dokumen : <a href="download/abc2">Lihat Dokumen</a>
    </li>
  </ol>
  <p>Agenda Sidang : <b>Replik Penggugat</b> Silahkan Mengupload Berkas Persidangan Sebelum : Selasa, 16 Desember 2025 Pukul : 15:00:00 WIB</p>
  <ol>
    <li>
      Dokumen diupload oleh : <b>Penggugat - vebrylawoffice@gmail.com</b><br />
      Upload pada : Selasa, 16 Desember 2025 Jam : 09:32 WIB<br />
      Status Dokumen: Sudah diverifikasi Majelis/Hakim (Dokumen Valid)<br />
      Jenis : Replik<br />
      Judul Dokumen : replik<br />
      Dokumen : <a href="download/def">Lihat Dokumen</a>
    </li>
  </ol>
</div>
`;

/** Dokumen yang berdiri sebelum blok agenda mana pun. */
const HTML_TANPA_AGENDA = `
<li>
  Dokumen diupload oleh : <b>Penggugat - a@b.com</b><br />
  Judul Dokumen : Surat Kuasa<br />
</li>
<p>Agenda Sidang : <b>Jawaban Tergugat</b> Silahkan Mengupload Berkas Persidangan Sebelum : Selasa, 09 Desember 2025 Pukul : 15:00:00 WIB</p>
<li>
  Dokumen diupload oleh : <b>Tergugat - c@d.com</b><br />
  Judul Dokumen : Jawaban<br />
</li>
`;

function hari(nilai) {
  if (!nilai) return "";
  const bulan = String(nilai.getMonth() + 1).padStart(2, "0");
  const tanggal = String(nilai.getDate()).padStart(2, "0");
  return `${nilai.getFullYear()}-${bulan}-${tanggal}`;
}

function utama() {
  console.log("\n== Tiap dokumen membawa agenda bloknya sendiri ==");
  {
    const hasil = scraper.extractHearingDocuments(HTML_DUA_BLOK);
    periksa(`tiga dokumen terbaca (${hasil.length})`, hasil.length === 3);

    periksa("dokumen pertama beragenda Jawaban Tergugat", hasil[0].agendaBlok === "Jawaban Tergugat");
    periksa("dokumen ketiga beragenda Replik Penggugat", hasil[2].agendaBlok === "Replik Penggugat");

    // Inilah penjaga yang sesungguhnya. Dulu ketiganya beragenda SAMA - agenda
    // terakhir perkara - dan tidak ada satu pun galat yang menandainya.
    periksa(
      "agenda dokumen pertama BERBEDA dari yang ketiga",
      hasil[0].agendaBlok !== hasil[2].agendaBlok
    );
  }

  console.log("\n== Tanggal sidang terbaca dari baris 'Sebelum' ==");
  {
    const hasil = scraper.extractHearingDocuments(HTML_DUA_BLOK);
    periksa("dokumen pertama bertanggal 9 Desember 2025", hari(hasil[0].tanggalSidang) === "2025-12-09");
    periksa("dokumen ketiga bertanggal 16 Desember 2025", hari(hasil[2].tanggalSidang) === "2025-12-16");

    // Jam ikut terbaca. Tanpa jam, dua sidang pada hari yang sama tidak dapat
    // dibedakan - dan jam 15:00 hanya dipakai 111 dari 20.109 baris jadwal,
    // jadi justru jamnya yang membuktikan pencocokannya bukan kebetulan.
    periksa("jamnya ikut terbaca (15:00)", hasil[0].tanggalSidang.getHours() === 15);
  }

  console.log("\n== Batas blok tidak menelan agenda berikutnya ==");
  {
    const hasil = scraper.extractHearingDocuments(HTML_DUA_BLOK);
    // Dua dokumen dalam SATU blok. Dokumen terakhir tiap blok berakhir tepat
    // di ambang blok berikutnya; bila potongannya meleset satu langkah, ia
    // akan menerima agenda blok SESUDAHNYA - dan salahnya diam.
    periksa("dua dokumen sebelok beragenda sama", hasil[0].agendaBlok === hasil[1].agendaBlok);
    periksa(
      "dan bertanggal sidang sama",
      hari(hasil[0].tanggalSidang) === hari(hasil[1].tanggalSidang)
    );
  }

  console.log("\n== Dokumen sebelum agenda pertama tidak hilang, dan tidak meminjam ==");
  {
    const hasil = scraper.extractHearingDocuments(HTML_TANPA_AGENDA);
    periksa(`dua dokumen terbaca (${hasil.length})`, hasil.length === 2);
    periksa("Surat Kuasa tetap terbaca", hasil[0] && hasil[0].judul === "Surat Kuasa");
    // Memberinya agenda blok pertama berarti menempelkannya pada sidang yang
    // keliru. Kosong itu jawaban yang benar, bukan kekurangan.
    periksa("agendanya KOSONG, bukan meminjam blok sesudahnya", hasil[0] && hasil[0].agendaBlok === "");
    periksa("tanggal sidangnya null", hasil[0] && hasil[0].tanggalSidang === null);
    periksa("dokumen di dalam blok tetap beragenda", hasil[1] && hasil[1].agendaBlok === "Jawaban Tergugat");
  }

  console.log("\n== Halaman tanpa blok agenda sama sekali tidak membuat galat ==");
  {
    const hasil = scraper.extractHearingDocuments(
      "<li>Dokumen diupload oleh : <b>Tergugat - a@b.com</b><br />Judul Dokumen : Tanpa Berkas<br /></li>"
    );
    periksa("tetap terbaca", hasil.length === 1);
    periksa("agenda kosong", hasil[0].agendaBlok === "");
    periksa("tanggal sidang null", hasil[0].tanggalSidang === null);
  }

  console.log("\n== run.js mengirim milik dokumen, bukan milik perkara ==");
  {
    const fs = require("fs");
    const teks = fs.readFileSync(path.join(__dirname, "..", "tools", "ecourt-bridge", "run.js"), "utf8");
    periksa("agenda diambil dari bloknya dulu", teks.includes("agenda: dokumen.agendaBlok || agendaTerakhir"));
    periksa("tanggal sidang dikirim", teks.includes("tanggalSidang: dokumen.tanggalSidang || null"));
    // Cadangannya TETAP ada. Menghapusnya membuat dokumen tanpa blok agenda
    // kehilangan keterangan yang tadinya masih ia punya.
    periksa("agenda terakhir perkara tetap jadi cadangan", teks.includes("const agendaTerakhir ="));
  }

  console.log("\n== Sinkronisasi tidak lagi mengosongkan yang sudah benar ==");
  {
    const fs = require("fs");
    const teks = fs.readFileSync(path.join(__dirname, "..", "services", "ecourtStoreService.js"), "utf8");
    // Tanpa ini, satu penarikan yang gagal mengurai kepala blok MENGHAPUS
    // tanggal yang sudah benar - dan menghapusnya tanpa satu galat pun.
    periksa(
      "tanggal_sidang dijaga COALESCE",
      teks.includes("tanggal_sidang = COALESCE(?, tanggal_sidang)")
    );
    periksa(
      "agenda tidak ditimpa nilai kosong",
      teks.includes("agenda = CASE WHEN ? = '' THEN agenda ELSE ? END")
    );
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
}

utama();
