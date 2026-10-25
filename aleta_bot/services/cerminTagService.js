"use strict";

/**
 * Cermin Perkara (A5, 25 Okt 2026) - SISI BOT, bagian PENANDA STATUS PERKARA.
 *
 * Anggota tiap tag (perkara x tag) untuk SELURUH register dikirim ke portal,
 * yang menyimpannya di aleta_cermin_tag. Sesudah itu klik tag / hitungan tag
 * cukup sekali baca Postgres - tanpa sembilan belas kueri penyisir SIPP per klik.
 *
 * Definisi tag TETAP satu-satunya di tagPerkaraService.js: berkas ini hanya
 * memanggil idPerkaraTag (syarat yang sama dengan hitungSemua) dan tidak
 * menyalin satu pun syarat SQL. Hanya membaca; tidak ada tulisan ke SIPP.
 */

const tagPerkaraService = require("./tagPerkaraService");

/** Katalog tag (kunci, label, kelompok, nada, apakah tag "ketiadaan") + dasar tanggal. */
function katalogTag() {
  return {
    tag: Object.entries(tagPerkaraService.TAG).map(([kunci, x]) => ({
      kunci,
      label: x.label,
      kelompok: x.kelompok,
      nada: x.nada,
      judul: x.judul,
      balik: Boolean(x.balik),
    })),
    kelompok: tagPerkaraService.KELOMPOK_TAG,
    dasar: Object.entries(tagPerkaraService.DASAR_TANGGAL).map(([kunci, x]) => ({ kunci, label: x.label })),
    batasId: tagPerkaraService.BATAS_ID,
  };
}

/**
 * Seluruh perkara_id yang memenuhi satu tag, atas SELURUH register (lingkup
 * "seluruhnya", tanpa saringan tanggal). `terpotong` bila daftar mencapai
 * BATAS_ID: pemanggil tidak boleh memakainya sebagai himpunan lengkap.
 */
async function perkaraUntukTag(kunci) {
  const nama = String(kunci || "");
  if (!Object.prototype.hasOwnProperty.call(tagPerkaraService.TAG, nama)) {
    return { ok: false, error: "tag_tidak_dikenal", message: `Tag "${nama}" tidak dikenal.` };
  }
  const id = await tagPerkaraService.idPerkaraTag(nama, { periode: "total" });
  return {
    ok: true,
    kunci: nama,
    perkaraId: id.map(String),
    terpotong: id.length >= tagPerkaraService.BATAS_ID,
  };
}

module.exports = { katalogTag, perkaraUntukTag };
