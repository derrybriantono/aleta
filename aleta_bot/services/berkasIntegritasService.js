"use strict";

/**
 * Memeriksa bahwa sebuah berkas benar-benar berkas yang dimaksud.
 *
 * ============================================================================
 * KENAPA TIPE-ISI SAJA TIDAK CUKUP
 * ============================================================================
 *
 * Jembatan sudah menolak jawaban ber-tipe text/html. Itu menutup sebab yang
 * paling sering, tetapi tidak menutup semuanya:
 *
 *   - server dapat menjawab application/pdf dengan tubuh halaman galat,
 *   - jawaban dapat terpotong di tengah jalan dan tetap ber-tipe benar,
 *   - jawaban kosong nol byte lolos setiap pemeriksaan tipe.
 *
 * Ketiganya tersimpan sebagai berkas yang tampak sah - lengkap dengan sidik
 * jari yang benar - lalu perkaranya DILEWATI pada penarikan berikutnya karena
 * tercatat sudah lengkap. Kerusakannya baru ketahuan saat ada yang membukanya,
 * kadang berbulan kemudian.
 *
 * ============================================================================
 * YANG DIPERIKSA: HURUF PERTAMA BERKASNYA
 * ============================================================================
 *
 * Tiap bentuk berkas punya penanda tetap di awal isinya. PDF selalu diawali
 * %PDF-, docx dan seluruh berkas Office modern adalah ZIP yang diawali PK,
 * dan doc lama diawali penanda OLE. Penanda itu tidak dapat dipalsukan oleh
 * halaman galat yang kebetulan ber-tipe benar.
 */

/**
 * Ukuran paling kecil yang masuk akal, PER FORMAT.
 *
 * Satu angka untuk keduanya terlalu longgar bagi docx: wadah ZIP yang sah pun
 * sudah lebih dari 3 kB sebelum satu huruf pun ditulis di dalamnya, sehingga
 * berkas 600 byte yang "lolos" pasti bukan dokumen. PDF satu halaman kosong
 * lazimnya di atas 5 kB.
 *
 * Tetap disebut UKURAN_MINIMUM untuk pemanggil lama; nilainya kini peta.
 */
const UKURAN_MINIMUM = 512;

// 12 Okt (KTP-PIHAK): "gambar" = foto KTP e-Court (JPEG/PNG) - lihat gambarKtp di bawah.
const UKURAN_MINIMUM_FORMAT = { pdf: 5120, word: 3072, gambar: 4096 };

const PENANDA = {
  pdf: [{ nama: "PDF", awalan: Buffer.from("%PDF-", "ascii") }],
  gambar: [
    { nama: "JPEG", awalan: Buffer.from([0xff, 0xd8, 0xff]) },
    { nama: "PNG", awalan: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  ],
  word: [
    // docx, xlsx, pptx - seluruhnya wadah ZIP.
    { nama: "Office XML (docx)", awalan: Buffer.from([0x50, 0x4b, 0x03, 0x04]) },
    { nama: "Office XML (docx, arsip kosong)", awalan: Buffer.from([0x50, 0x4b, 0x05, 0x06]) },
    // doc lama - wadah OLE Compound File.
    { nama: "Word lama (doc)", awalan: Buffer.from([0xd0, 0xcf, 0x11, 0xe0]) },
    // RTF kadang dikirim e-Court dengan nama .doc.
    { nama: "RTF", awalan: Buffer.from("{\\rtf", "ascii") },
  ],
};

/** Awalan yang menandakan isinya halaman web, bukan dokumen. */
const AWALAN_HALAMAN = ["<!doctype", "<html", "<?xml", "<!--", "{", "["];

/**
 * Memeriksa isi satu berkas.
 *
 * @param {Buffer} isi Isi berkas yang baru diunduh atau dibaca dari disk.
 * @param {{ format?: string }} opsi format "pdf" atau "word".
 * @returns {{ ok: boolean, jenis: string, alasan: string }}
 */
/**
 * ============================================================================
 * POTONGAN AWALAN BUKAN BERKAS UTUH - DAN DUA PEMERIKSAAN TIDAK BOLEH BERLAKU
 * ============================================================================
 *
 * ecourtAuditArsipService membaca 1 KB pertama saja untuk berkas yang sangat
 * besar, lalu menyerahkannya ke sini. Dua pemeriksaan yang menuntut berkas
 * UTUH akan menolak seluruhnya:
 *
 *   - ambang ukuran: 1.024 byte selalu di bawah 5.120, sehingga tiap berkas
 *     arsip yang besar dinyatakan "terlalu kecil";
 *   - ekor %%EOF: penutup PDF ada di ujung berkas, bukan di 1 KB pertamanya.
 *
 * Keduanya akan menandai SELURUH berkas besar sebagai rusak - dan penjadwal
 * arsip memakai tanda itu. Karena itu pemanggil yang hanya membawa potongan
 * menyebutnya, dan kedua pemeriksaan itu dilewati.
 */
function periksaIsi(isi, { format = "pdf", potongan = false } = {}) {
  if (!Buffer.isBuffer(isi) || isi.length === 0) {
    return { ok: false, jenis: "", alasan: "berkas_kosong" };
  }

  // ==========================================================================
  // PENANDA BENTUK LEBIH DULU - DAN URUTAN INI PERNAH SALAH DUA KALI
  // ==========================================================================
  //
  // Pertama: ukuran diperiksa sebelum halaman web, sehingga halaman galat
  // e-Court berukuran 2 kB dilaporkan "terlalu_kecil". Petugas yang
  // membacanya akan mengira batas ukurannya terlalu ketat, padahal yang perlu
  // dikerjakan login ulang.
  //
  // Kedua, saat memperbaiki yang pertama: pengendusan halaman web dipindah ke
  // PALING ATAS - dan SELURUH berkas RTF pun dinyatakan halaman web, sebab
  // RTF diawali "{" persis seperti jawaban JSON yang hendak ditangkap.
  //
  // Yang benar: penanda bentuk lebih dulu, sebab ia yang PASTI. Halaman web
  // tidak pernah punya penanda bentuk yang cocok, jadi maksud perbaikan
  // pertama tetap tercapai tanpa mengorbankan RTF.
  const kunciFormat = format === "word" ? "word" : format === "gambar" ? "gambar" : "pdf";
  const daftar = PENANDA[kunciFormat];
  let cocok = null;
  for (const penanda of daftar) {
    if (isi.subarray(0, penanda.awalan.length).equals(penanda.awalan)) {
      cocok = penanda;
      break;
    }
  }

  if (!cocok) {
    const awal = isi.subarray(0, 64).toString("utf8").trim().toLowerCase();
    if (AWALAN_HALAMAN.some((pola) => awal.startsWith(pola))) {
      return { ok: false, jenis: "halaman/teks", alasan: "isinya_halaman_web_bukan_dokumen" };
    }
  }

  const batasUkuran = UKURAN_MINIMUM_FORMAT[kunciFormat] || UKURAN_MINIMUM;
  if (!potongan && isi.length < batasUkuran) {
    // Bukan penolakan karena ukurannya sendiri, melainkan karena dokumen
    // sungguhan tidak pernah sekecil ini - yang sekecil ini selalu halaman
    // galat atau potongan yang gagal.
    return { ok: false, jenis: "", alasan: `terlalu_kecil_${isi.length}_byte` };
  }

  if (cocok) {
    // ========================================================================
    // EKOR PDF - UNDUHAN TERPOTONG YANG SELAMA INI LOLOS SELURUHNYA
    // ========================================================================
    //
    // PDF yang sah selalu diakhiri "%%EOF". Berkas yang awalannya benar
    // tetapi ekornya tidak ada berarti unduhannya putus di tengah - dan itu
    // sebab kegagalan paling sering KEDUA sesudah halaman galat.
    //
    // Sampai sekarang berkas seperti itu dinyatakan SAH: awalannya %PDF-,
    // ukurannya di atas ambang, jadi tidak ada satu pun pemeriksaan yang
    // menyentuhnya. Ia baru ketahuan ketika hakim membukanya.
    if (!potongan && String(format) !== "word" && isi.subarray(0, 5).toString("ascii") === "%PDF-") {
      const ekor = isi.subarray(Math.max(0, isi.length - 2048)).toString("latin1");
      if (!ekor.includes("%%EOF")) {
        return { ok: false, jenis: cocok.nama, alasan: "pdf_terpotong_tanpa_penutup" };
      }
    }
    return { ok: true, jenis: cocok.nama, alasan: "" };
  }

  // Menyebutkan APA yang sebenarnya diterima, bukan sekadar "tidak sah".
  // Petugas yang membaca catatan ini perlu tahu bedanya halaman login dari
  // berkas terpotong - keduanya menuntut tindakan berbeda.

  const cuplikan = isi
    .subarray(0, 16)
    .toString("hex")
    .replace(/(.{2})/g, "$1 ")
    .trim();
  return { ok: false, jenis: "", alasan: `penanda_tidak_dikenali (${cuplikan})` };
}

/**
 * ============================================================================
 * DUGAAN HASIL PINDAI - KIRA-KIRA, DAN DIKATAKAN BEGITU
 * ============================================================================
 *
 * PDF hasil pindai tidak punya lapisan teks: yang membukanya melihat
 * dokumennya, tetapi tidak dapat menyalin satu kata pun, dan pencarian di
 * dalam berkas tidak menemukan apa-apa. Untuk arsip perkara itu persoalan
 * nyata - putusan yang tidak dapat dicari tidak dapat ditelusuri.
 *
 * Jawaban yang JUJUR menuntut mengurai PDF-nya dan menghitung huruf yang
 * benar-benar terurai per halaman; itu ada di portal (pdfjs-dist), bukan di
 * sini. Yang dikerjakan fungsi ini penandaan kasar tanpa pustaka apa pun:
 * kamus objek PDF tidak dipadatkan walaupun aliran isinya dipadatkan, jadi
 * kemunculan /Font dan /DCTDecode dapat dihitung dari byte mentahnya.
 *
 * PDF pindaian lazimnya NOL /Font dengan banyak /DCTDecode atau
 * /CCITTFaxDecode. Karena ini kira-kira, hasilnya TIDAK PERNAH menolak
 * berkasnya - ia hanya menandainya, dan kata "diduga" ikut dalam namanya.
 */
function dugaHasilPindai(isi) {
  if (!Buffer.isBuffer(isi) || isi.length === 0) return { diduga: false, alasan: "" };
  if (isi.subarray(0, 5).toString("ascii") !== "%PDF-") return { diduga: false, alasan: "" };

  const teks = isi.toString("latin1");
  const hitung = (pola) => (teks.match(pola) || []).length;

  const font = hitung(/\/Font\b/g);
  const gambar = hitung(/\/DCTDecode\b/g) + hitung(/\/CCITTFaxDecode\b/g) + hitung(/\/JPXDecode\b/g);

  if (font === 0 && gambar > 0) {
    return {
      diduga: true,
      alasan: `diduga_hasil_pindai (0 font, ${gambar} gambar)`,
    };
  }
  return { diduga: false, alasan: "" };
}

/** Menebak format dari nama berkas - dipakai pemeriksa arsip. */
function formatDariNama(namaBerkas) {
  const nama = String(namaBerkas || "").toLowerCase();
  if (nama.endsWith(".pdf")) return "pdf";
  if (/\.(docx?|rtf|odt)$/.test(nama)) return "word";
  if (/\.(jpe?g|png)$/.test(nama)) return "gambar";
  return "";
}

/* === KTP-PIHAK 12 Okt === */
/** Judul dokumen e-Court yang dianggap KTP (sama dengan ktpPihakService.POLA_JUDUL_KTP). */
const POLA_JUDUL_KTP = /\b(?:e-?ktp|ktp(?:-?el)?|kartu\s+tanda\s+penduduk)\b/i;

/**
 * Foto KTP e-Court (JPEG/PNG) yang diunggah pihak sebagai "KTP". e-Court tidak menyediakan
 * PDF-nya (404, diukur 23 Sep: 145 dari 168 galat) dan yang tersedia kerap gambar aslinya -
 * yang selama ini ditolak penanda PDF ("penanda_tidak_dikenali (ff d8 ff e0 ...)") sehingga
 * KTP-nya tidak pernah masuk arsip. Hanya untuk dokumen berjudul KTP dan hanya bila isinya
 * benar-benar JPEG/PNG utuh; disimpan sebagai format "gambar" (BUKAN pdf), jadi tidak tampil
 * di tempat yang menampilkan PDF dan tidak dilaporkan rusak oleh pemeriksa arsip.
 *
 * @returns {{ ok: boolean, jenis: string, alasan: string }}
 */
function gambarKtp(isi, judul) {
  if (!POLA_JUDUL_KTP.test(String(judul || ""))) return { ok: false, jenis: "", alasan: "bukan_dokumen_ktp" };
  return periksaIsi(isi, { format: "gambar" });
}
/* === AKHIR KTP-PIHAK === */

module.exports = {
  dugaHasilPindai,
  UKURAN_MINIMUM_FORMAT,
  UKURAN_MINIMUM,
  formatDariNama,
  gambarKtp,
  POLA_JUDUL_KTP,
  periksaIsi,
};
