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

const POLA_PERLAWANAN = /perlawanan|verzet|derden/i;
const POLA_BANTAHAN = /bantahan/i;
const NOMOR_PERLAWANAN = /\/Pdt\.Plw\b/i;
const NOMOR_BANTAHAN = /\/Pdt\.Bth\b/i;

const POLA_PERMOHONAN =
  /permohonan|cerai\s*talak|istbat|itsbat|isbat|pengesahan\s*perkawinan|dispensasi|wali\s*adh[oa]l|poligami|asal.?usul|perwalian|pengangkatan|penetapan\s*ahli\s*waris|p3hp|pencegahan\s*perkawinan|penolakan\s*perkawinan|pengesahan\s*anak|izin\s*kawin|perkawinan\s*campuran/i;

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
  // Perlawanan dan bantahan (D5): sebutannya sendiri, sebelum aturan alur gugatan sebab SIPP memberi alur gugatan pada keduanya.
  {
    const namaLawan = bersih(bahan.jenisPerkaraNama);
    const nomorLawan = bersih(bahan.nomorPerkara);
    if (namaLawan && POLA_PERLAWANAN.test(namaLawan)) return { satu: "Pelawan", dua: "Terlawan", surat: "perlawanan", sumber: "kata" };
    if (NOMOR_PERLAWANAN.test(nomorLawan)) return { satu: "Pelawan", dua: "Terlawan", surat: "perlawanan", sumber: "nomor" };
    if (namaLawan && POLA_BANTAHAN.test(namaLawan)) return { satu: "Pembantah", dua: "Terbantah", surat: "bantahan", sumber: "kata" };
    if (NOMOR_BANTAHAN.test(nomorLawan)) return { satu: "Pembantah", dua: "Terbantah", surat: "bantahan", sumber: "nomor" };
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

// ──────────────────────────────────────────────────────────────────────────────
// Pihak jamak dan rekonvensi (D5): kembaran sebutan-pihak.ts
// ──────────────────────────────────────────────────────────────────────────────

const TABEL_ROMAWI = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];

// 1..3999 untuk SEMUA pihak (27 Okt 2026; dulu berhenti di XX lalu angka Arab). Kembaran urutanRomawi di sebutan-pihak.ts.
function urutanRomawi(n) {
  const i = Math.round(Number(n) || 0);
  if (i < 1 || i > 3999) return String(i);
  let sisa = i;
  let hasil = "";
  for (const [nilai, huruf] of TABEL_ROMAWI) {
    while (sisa >= nilai) {
      hasil += huruf;
      sisa -= nilai;
    }
  }
  return hasil;
}

/** "Pemohon" -> "para Pemohon" bila lebih dari satu orang. */
function paraSebutan(sebutan, jumlah) {
  const s = bersih(sebutan);
  return (angka(jumlah) === null ? 1 : angka(jumlah)) > 1 ? `para ${s}` : s;
}

/** "Pemohon" urutan 1 dari 2 -> "Pemohon I"; hanya seorang -> "Pemohon". */
function sebutanBerurut(sebutan, urutan, jumlah) {
  const s = bersih(sebutan);
  return (angka(jumlah) === null ? 1 : angka(jumlah)) > 1 ? `${s} ${urutanRomawi(urutan)}` : s;
}

function daftarSebutanBerurut(sebutan, jumlah) {
  const n = Math.max(1, Math.min(angka(jumlah) === null ? 1 : angka(jumlah), 20));
  return Array.from({ length: n }, (_, i) => sebutanBerurut(sebutan, i + 1, n));
}

/** Sebutan pasangan beserta kedudukan ganda sesudah rekonvensi (hanya di dalam gugatan). */
function sebutanLengkap(bahan = {}) {
  const p = sebutanPihakPerkara(bahan);
  const mengenal = (p.surat === "gugatan" || (p.surat === "permohonan" && (angka(bahan.jenisPerkaraId) === 346 || angka(bahan.jenisPerkaraId) === 341))) && bahan.rekonvensi === true;
  if (!mengenal) return { ...p, rekonvensi: false, satuLengkap: p.satu, duaLengkap: p.dua };
  return { ...p, rekonvensi: true, satuLengkap: `${p.satu} Konvensi/Tergugat Rekonvensi`, duaLengkap: `${p.dua} Konvensi/Penggugat Rekonvensi` };
}

module.exports = {
  ALUR_PERMOHONAN,
  ALUR_JINAYAT,
  JENIS_PERMOHONAN_DALAM_GUGATAN,
  POLA_PERMOHONAN,
  POLA_PERLAWANAN,
  POLA_BANTAHAN,
  urutanRomawi,
  paraSebutan,
  sebutanBerurut,
  daftarSebutanBerurut,
  sebutanLengkap,
  sebutanPihakPerkara,
  sebutanSatuPihak,
  perkaraPermohonan,
};
