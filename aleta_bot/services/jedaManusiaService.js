"use strict";

/**
 * ============================================================================
 * JEDA SEPERTI MANUSIA UNTUK AKSI TULIS BOT (perbaikan 2 Okt 2026, butir 14, K4)
 * ============================================================================
 *
 * Keputusan pengguna 2 Oktober 2026 (membalik sebagian keputusan 26 Sep):
 * jeda seperti manusia DIPERTAHANKAN untuk tulisan yang dikerjakan lewat
 * HALAMAN sistem luar (peramban e-Court atas nama pengguna) - menekan tombol,
 * mengetik, mengunggah berkas tidak terjadi dalam satu milidetik. Rentangnya
 * SAMA dengan alatJedaManusia di ekstensi (panel-alat.js), supaya bot dan
 * ekstensi bernapas dengan irama yang sama:
 *
 *   jenis   rentang (ms)
 *   klik     350 -   900   menekan tombol / memilih di halaman
 *   isi      500 -  1400   mengisi satu isian
 *   simpan   900 -  2200   sebelum mengirim satu simpanan - BAWAAN
 *   unggah  1500 -  3500   sebelum mengunggah berkas
 *   pindah   800 -  1800   berpindah halaman/langkah
 *   perkara 2000 -  4500   antar dua perkara dalam pekerjaan massal
 *
 * 17 Okt 2026 (keputusan pengguna): pengisian borang di layar - termasuk
 * halaman e-Court yang dikemudikan bot - kini LANGSUNG dan tidak lagi memakai
 * layanan ini (lihat isiBorangLangsung). Layanan ini tinggal untuk TULISAN ke
 * database SIPP oleh bot (penetapan, jadwal/tunda, putusan, kasir, e-Doc),
 * supaya riwayatnya tetap tampak seperti kerja petugas.
 *
 * Yang TIDAK diubah oleh jeda ini: siapa pelakunya dan kapan. Jejak jujur
 * (siapa + waktu + IP + "lewat ALETA") tetap ditulis ke tabel aleta_* milik
 * ALETA - lihat jejakAletaService dan aleta_ecourt_aksi_jejak.
 *
 * TANPA JEDA (seketika 0): mode kering ({ kering: true }), atau skala 0 lewat
 * ALETA_BOT_JEDA_MANUSIA_SKALA=0 / setelSkala(0) - dipakai uji. Bukan untuk
 * GET/baca, dan bukan pengganti batas beban yang sudah ada (batas aksi per
 * jam, peramban serentak).
 */

const RENTANG = Object.freeze({
  klik: [350, 900],
  isi: [500, 1400],
  simpan: [900, 2200],
  unggah: [1500, 3500],
  pindah: [800, 1800],
  perkara: [2000, 4500],
});

function skalaLingkungan() {
  const mentah = process.env.ALETA_BOT_JEDA_MANUSIA_SKALA;
  if (mentah === undefined || mentah === "") return 1;
  const x = Number(mentah);
  return Number.isFinite(x) && x >= 0 ? Math.min(x, 5) : 1;
}

let skalaUmum = null;

/** Pengali seluruh jeda (0 = tanpa jeda). Pulang skala yang berlaku. */
function setelSkala(n) {
  const x = Number(n);
  skalaUmum = Number.isFinite(x) && x >= 0 ? Math.min(x, 5) : null;
  return skala();
}

function skala() {
  return skalaUmum === null ? skalaLingkungan() : skalaUmum;
}

/** Rentang [min, maks] jenis itu (jenis tak dikenal = simpan). */
function rentang(jenis) {
  const r = RENTANG[String(jenis || "").toLowerCase()] || RENTANG.simpan;
  return [r[0], r[1]];
}

/**
 * Lama jeda (ms) - condong ke pendek (hasil kali dua acakan), seperti orang
 * yang bekerja cepat; tidak pernah di luar rentangnya.
 */
function hitung(jenis, { acak = Math.random } = {}) {
  const [min, maks] = rentang(jenis);
  const s = skala();
  if (s <= 0) return 0;
  const condong = acak() * acak();
  return Math.round((min + condong * (maks - min)) * s);
}

/**
 * Menunggu sejenak sebelum satu aksi tulis.
 *
 * @returns {Promise<number>} milidetik yang dijalani (0 bila dilewati).
 */
function jeda(jenis = "simpan", { kering = false, acak } = {}) {
  if (kering) return Promise.resolve(0);
  const ms = hitung(jenis, { acak });
  if (ms <= 0) return Promise.resolve(0);
  return new Promise((selesai) => setTimeout(() => selesai(ms), ms));
}

module.exports = { RENTANG, rentang, hitung, jeda, setelSkala, skala };
