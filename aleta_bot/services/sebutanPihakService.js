"use strict";

/**
 * ============================================================================
 * SEBUTAN PARA PIHAK - SISI BOT
 * ============================================================================
 *
 * Kembaran CommonJS dari manajemen_surat/src/lib/sebutan-pihak.ts. Aturannya
 * SAMA PERSIS dan dijaga satu uji yang membandingkan keduanya baris demi
 * baris; sebabnya, bot tidak dapat memuat TypeScript dan portal tidak dapat
 * memuat berkas ini.
 *
 * Kalau salah satunya disunting, sunting keduanya. Uji sebutan-pihak-sama.test.ts
 * yang menagihnya.
 *
 * Sebab lengkap - termasuk angka yang mengukur betapa salahnya aturan lama -
 * ada di kepala berkas TypeScript-nya. Ringkasnya:
 *
 *   5.581 dari 10.120 perkara satker bersebutan Pemohon/Termohon, dan lima
 *   penurun sebutan yang berbeda salah pada 21% sampai 100% di antaranya,
 *   sebagian hanya karena SIPP menulis "Istbat" sedangkan polanya "itsbat".
 */

const ALUR_PERMOHONAN = 16;
const ALUR_JINAYAT = [122, 123];
const JENIS_PERMOHONAN_DALAM_GUGATAN = [346, 341];

const POLA_PERMOHONAN =
  /permohonan|cerai\s*talak|istbat|itsbat|isbat|pengesahan\s*perkawinan|dispensasi|wali\s*adh[oa]l|poligami|asal.?usul|perwalian|pengangkatan|penetapan\s*ahli\s*waris|p3hp|pencegahan\s*perkawinan|penolakan\s*perkawinan/i;

function angka(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const n = Number(nilai);
  return Number.isFinite(n) ? n : null;
}

function bersih(teks) {
  return String(teks === null || teks === undefined ? "" : teks).replace(/\s+/g, " ").trim();
}

function permohonan(sumber) {
  return { satu: "Pemohon", dua: "Termohon", surat: "permohonan", sumber };
}

/** Sebutan para pihak untuk satu perkara. Berjenjang, nomor sebelum kata. */
function sebutanPihakPerkara(bahan = {}) {
  const alur = angka(bahan.alurPerkaraId);
  const jenisId = angka(bahan.jenisPerkaraId);

  if (alur !== null && ALUR_JINAYAT.includes(alur)) {
    return { satu: "Penuntut Umum", dua: "Terdakwa", surat: "dakwaan", sumber: "alur" };
  }
  if (alur === ALUR_PERMOHONAN) return permohonan("alur");
  if (jenisId !== null && JENIS_PERMOHONAN_DALAM_GUGATAN.includes(jenisId)) {
    return permohonan("jenis");
  }
  if (alur !== null && alur !== ALUR_PERMOHONAN) {
    return { satu: "Penggugat", dua: "Tergugat", surat: "gugatan", sumber: "alur" };
  }

  const nama = bersih(bahan.jenisPerkaraNama);
  if (nama) {
    return POLA_PERMOHONAN.test(nama)
      ? permohonan("kata")
      : { satu: "Penggugat", dua: "Tergugat", surat: "gugatan", sumber: "kata" };
  }

  const nomor = bersih(bahan.nomorPerkara);
  if (/\/Pdt\.P\//i.test(nomor)) return permohonan("nomor");
  if (/\/Pdt\.G\//i.test(nomor)) {
    return { satu: "Penggugat", dua: "Tergugat", surat: "gugatan", sumber: "nomor" };
  }

  return { satu: "Penggugat", dua: "Tergugat", surat: "gugatan", sumber: "bawaan" };
}

/** Sebutan satu pihak menurut kedudukannya. 1 = pertama, 2 = kedua. */
function sebutanSatuPihak(pihakKe, bahan = {}, jenisPeran) {
  const pasangan = sebutanPihakPerkara(bahan);
  const ke = String(pihakKe === null || pihakKe === undefined ? "" : pihakKe).toLowerCase();
  const kedua = ke === "2" || ke === "t";
  const pokok = kedua ? pasangan.dua : pasangan.satu;
  return bersih(jenisPeran).toLowerCase() === "kuasa" ? `Kuasa ${pokok}` : pokok;
}

/** Apakah perkara ini permohonan? */
function perkaraPermohonan(bahan = {}) {
  return sebutanPihakPerkara(bahan).satu === "Pemohon";
}

module.exports = {
  ALUR_PERMOHONAN,
  ALUR_JINAYAT,
  JENIS_PERMOHONAN_DALAM_GUGATAN,
  POLA_PERMOHONAN,
  sebutanPihakPerkara,
  sebutanSatuPihak,
  perkaraPermohonan,
};
