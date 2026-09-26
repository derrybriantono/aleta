// @vitest-environment node
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * PENJAGA USULAN ITSBAT: NAMA HURUF BESAR-KECIL, SAKSI NIKAH 2, DAN MAHAR
 * ============================================================================
 *
 * Menjalankan dariPositaItsbat (aleta_bot/services/abtUsulanService.js) atas
 * posita contoh berbentuk templat satker PA Donggala: wali, yang menikahkan,
 * saksi, dan mahar ditulis dalam SATU kalimat panjang.
 *
 * Yang dijaga, dengan angkanya sebelum perubahan (395 posita, 373 perkara
 * bervariabel - ukur-itsbat-t1.js di folder kerja t1-deteksi-saksi-bot):
 *   - nama berhuruf besar-kecil ("Xxxa") dahulu terpotong menjadi satu huruf
 *     (392 nama wali), dan wali/yang menikahkan/saksi sama persis 0;
 *   - saksi nikah 2 diambil SESUDAH 'dan' (dahulu 0 dari 363);
 *   - mahar tidak berhenti pada titik di dalam 'Rp.11.000' (dahulu 167 dari
 *     395 terpotong menjadi "uang sebesar Rp").
 *
 * Nama di contoh adalah pengganti ('Xxxa', 'Yyyb'), bukan nama orang.
 */

type Usulan = { kode: string; nilai: string; keyakinan: string };
type Layanan = {
  dariPositaItsbat: (posita: string, pihak?: { pemohon?: string; pemohon2?: string }) => { usulan: Usulan[] };
  namaSesudah: (kalimat: string, pemicu: string) => string;
};

const require_ = createRequire(import.meta.url);
const layanan = require_(path.resolve(process.cwd(), "../aleta_bot/services/abtUsulanService.js")) as Layanan;

const PEMBUKA =
  "Bahwa pada Hari Kamis, tanggal 07 Oktober 2010 di Desa Xxxz di wilayah hukum Kantor Urusan Agama Kecamatan Yyyz, Kabupaten Donggala; " +
  "Bahwa pada saat pernikahan tersebut Pemohon I berstatus Perjaka dalam usia 25 tahun, dan Pemohon II berstatus Perawan dalam usia 20 tahun. ";
const PENUTUP = "; Bahwa antara Pemohon I dan Pemohon II tidak ada pertalian nasab;";

const nilaiDari = (posita: string) => {
  const hasil = layanan.dariPositaItsbat(posita, { pemohon: "Pemohon I", pemohon2: "Pemohon II" });
  return Object.fromEntries(hasil.usulan.map((u) => [u.kode, u.nilai])) as Record<string, string>;
};

const KASUS: { judul: string; kalimat: string; harapan: Record<string, string> }[] = [
  {
    judul: "bentuk satker: nama dalam kurung jabatan, dua saksi, mahar Rp bertitik",
    kalimat:
      "Pernikahan dilangsungkan dengan wali nikah yaitu Xxxa (Ayah Kandung Pemohon II) dan yang menikahkan adalah Xxxb (Imam Masjid Desa Yyya), " +
      "dan dihadiri 2 (dua) orang saksi nikah yang masing-masing bernama Xxxc Yyyc dan Xxxd M., " +
      "dengan mas kawin berupa uang sebesar Rp.11.000 (sebelas ribu rupiah) dibayar tunai",
    harapan: {
      "1217": "Xxxa",
      "8087": "Imam Masjid Desa Yyya bernama Xxxb",
      "0650": "Xxxc Yyyc",
      "0651": "Xxxd M.",
      "1001": "uang sebesar Rp.11.000 (sebelas ribu rupiah) dibayar tunai",
    },
  },
  {
    judul: "wali tanpa kurung berhenti pada kata bukan-nama; yang menikahkan berjabatan 'bernama'",
    kalimat:
      "Pernikahan dilangsungkan dengan wali nikah yaitu Xxxa Ayah Kandung Pemohon II dan yang menikahkan adalah Imam Masjid bernama Xxxb, " +
      "disaksikan oleh dua orang saksi nikah bernama Xxxc dan Xxxd, dengan mahar berupa uang Rp. 100.000,- (Seratus Ribu Rupiah) dibayar tunai",
    harapan: {
      "1217": "Xxxa",
      "8087": "Imam Masjid bernama Xxxb",
      "0650": "Xxxc",
      "0651": "Xxxd",
      "1001": "uang Rp. 100.000,- (Seratus Ribu Rupiah) dibayar tunai",
    },
  },
  {
    judul: "Alm. di depan nama dibuang; gelar sesudah koma disalin",
    kalimat:
      "Pernikahan dilangsungkan dengan wali nikah yaitu Alm. Xxxa (Ayah Kandung Pemohon II) dan yang menikahkan adalah Xxxb, S.Pd.I (Kepala KUA Yyya), " +
      "dan dihadiri saksi nikah bernama Xxxc Yyyc dan Xxxd Yyyd, dengan mas kawin berupa seperangkat alat sholat dibayar tunai",
    harapan: {
      "1217": "Xxxa",
      "8087": "Kepala KUA Yyya bernama Xxxb, S.Pd.I",
      "0650": "Xxxc Yyyc",
      "0651": "Xxxd Yyyd",
      "1001": "seperangkat alat sholat dibayar tunai",
    },
  },
  {
    judul: "mahar berakhir pada titik penutup kalimat, bukan titik ribuan",
    kalimat:
      "Pernikahan dilangsungkan dengan wali nikah yaitu Xxxa bin Yyya (Kakak Kandung Pemohon II) dan yang menikahkan adalah Xxxb (P3N Desa Yyyb), " +
      "dan dihadiri saksi nikah bernama Xxxc dan Xxxd, dengan mahar berupa uang Rp.50.000. Pernikahan itu tidak dicatat",
    harapan: {
      "1217": "Xxxa bin Yyya",
      "8087": "P3N Desa Yyyb bernama Xxxb",
      "0650": "Xxxc",
      "0651": "Xxxd",
      "1001": "uang Rp.50.000",
    },
  },
  {
    // Bentuk 2/Pdt.P/2024/PA.Buk (verify-abt-usulan-itsbat-sdg.js). Sempat
    // lolos menjadi mahar "... yang diberikan secara tunai oleh Pemohon I
    // kepada Pemohon II" ketika penghenti bentuk lamanya ikut dibuang.
    judul: "anak kalimat sesudah mahar ('yang diberikan secara tunai oleh ...') bukan bagian mahar",
    kalimat:
      "Pernikahan dilangsungkan dengan wali nikah yaitu Xxxa (Saudara Kandung Pemohon II) dan yang menikahkan adalah Xxxb (Imam Masjid Desa Yyyb), " +
      "dan dihadiri saksi nikah bernama Xxxc dan Xxxd, dengan mahar berupa uang sejumlah Rp166,000 (seratus enam puluh enam ribu rupiah), " +
      "emas seberat 1 gram dan seperangkat alat sholat yang diberikan secara tunai oleh Pemohon I kepada Pemohon II",
    harapan: {
      "1217": "Xxxa",
      "8087": "Imam Masjid Desa Yyyb bernama Xxxb",
      "0650": "Xxxc",
      "0651": "Xxxd",
      "1001": "uang sejumlah Rp166,000 (seratus enam puluh enam ribu rupiah), emas seberat 1 gram dan seperangkat alat sholat",
    },
  },
  {
    judul: "'dibayar secara tunai' tetap ikut; yang sesudahnya tidak",
    kalimat:
      "Pernikahan dilangsungkan dengan wali nikah yaitu Xxxa (Ayah Kandung Pemohon II) dan yang menikahkan adalah Xxxb (Imam Masjid Desa Yyyb), " +
      "dan dihadiri saksi nikah bernama Xxxc dan Xxxd, dengan mahar berupa seperangkat alat sholat dibayar secara tunai oleh Pemohon I",
    harapan: {
      "1217": "Xxxa",
      "8087": "Imam Masjid Desa Yyyb bernama Xxxb",
      "0650": "Xxxc",
      "0651": "Xxxd",
      "1001": "seperangkat alat sholat dibayar secara tunai",
    },
  },
];

describe("dariPositaItsbat - nama, saksi nikah 2, dan mahar", () => {
  it.each(KASUS)("$judul", ({ kalimat, harapan }) => {
    const nilai = nilaiDari(PEMBUKA + kalimat + PENUTUP);
    for (const [kode, harap] of Object.entries(harapan)) expect({ kode, nilai: nilai[kode] }).toEqual({ kode, nilai: harap });
  });

  it("tidak satu pun nama berpanjang 1-2 huruf (dahulu 'X' dari 'Xxxa')", () => {
    for (const { kalimat } of KASUS) {
      const nilai = nilaiDari(PEMBUKA + kalimat + PENUTUP);
      for (const kode of ["1217", "8087", "0650", "0651"]) {
        const nama = kode === "8087" ? nilai[kode].replace(/^.*\bbernama\s+/i, "") : nilai[kode];
        expect(nama.replace(/[\s.]/g, "").length, `${kode}: ${nilai[kode]}`).toBeGreaterThan(2);
      }
    }
  });

  it("mahar tidak pernah berakhir pada 'Rp'", () => {
    for (const { kalimat } of KASUS) expect(nilaiDari(PEMBUKA + kalimat + PENUTUP)["1001"]).not.toMatch(/rp\.?$/i);
  });
});

describe("namaSesudah - Title Case, berhenti pada kata sambung atau tanda baca", () => {
  it.each([
    ["saksi nikah bernama Xxxc Yyyc dan Xxxd", "Xxxc Yyyc"],
    ["saksi nikah bernama XXXC YYYC dengan mahar", "XXXC YYYC"],
    ["saksi nikah bernama Xxxc, Xxxd", "Xxxc"],
    ["saksi nikah bernama Xxxc (Tokoh Agama)", "Xxxc"],
    ["saksi nikah bernama Moh. Xxxc bin Yyyc; mahar", "Moh. Xxxc bin Yyyc"],
    ["saksi nikah bernama: Xxxc Yyyc yang hadir", "Xxxc Yyyc"],
    ["saksi nikah bernama Xxxc bin, lalu", "Xxxc"],
  ])("%s", (kalimat, harapan) => {
    expect(layanan.namaSesudah(kalimat, "bernama")).toBe(harapan);
  });
});
