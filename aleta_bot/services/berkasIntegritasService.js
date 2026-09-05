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

/** Ukuran paling kecil yang masuk akal. Di bawah ini pasti bukan dokumen. */
const UKURAN_MINIMUM = 512;

const PENANDA = {
  pdf: [{ nama: "PDF", awalan: Buffer.from("%PDF-", "ascii") }],
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
function periksaIsi(isi, { format = "pdf" } = {}) {
  if (!Buffer.isBuffer(isi) || isi.length === 0) {
    return { ok: false, jenis: "", alasan: "berkas_kosong" };
  }

  if (isi.length < UKURAN_MINIMUM) {
    // Bukan penolakan karena ukurannya sendiri, melainkan karena dokumen
    // sungguhan tidak pernah sekecil ini - yang sekecil ini selalu halaman
    // galat atau potongan yang gagal.
    return { ok: false, jenis: "", alasan: `terlalu_kecil_${isi.length}_byte` };
  }

  const daftar = PENANDA[format === "word" ? "word" : "pdf"];
  for (const penanda of daftar) {
    if (isi.subarray(0, penanda.awalan.length).equals(penanda.awalan)) {
      return { ok: true, jenis: penanda.nama, alasan: "" };
    }
  }

  // Menyebutkan APA yang sebenarnya diterima, bukan sekadar "tidak sah".
  // Petugas yang membaca catatan ini perlu tahu bedanya halaman login dari
  // berkas terpotong - keduanya menuntut tindakan berbeda.
  const awal = isi.subarray(0, 64).toString("utf8").trim().toLowerCase();
  if (AWALAN_HALAMAN.some((pola) => awal.startsWith(pola))) {
    return { ok: false, jenis: "halaman/teks", alasan: "isinya_halaman_web_bukan_dokumen" };
  }

  const cuplikan = isi
    .subarray(0, 16)
    .toString("hex")
    .replace(/(.{2})/g, "$1 ")
    .trim();
  return { ok: false, jenis: "", alasan: `penanda_tidak_dikenali (${cuplikan})` };
}

/** Menebak format dari nama berkas - dipakai pemeriksa arsip. */
function formatDariNama(namaBerkas) {
  const nama = String(namaBerkas || "").toLowerCase();
  if (nama.endsWith(".pdf")) return "pdf";
  if (/\.(docx?|rtf|odt)$/.test(nama)) return "word";
  return "";
}

module.exports = {
  UKURAN_MINIMUM,
  formatDariNama,
  periksaIsi,
};
