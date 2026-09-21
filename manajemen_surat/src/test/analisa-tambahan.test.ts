/**
 * ============================================================================
 * SEPULUH ANALISIS TAMBAHAN DAN SEPULUH ALAT BARU
 * ============================================================================
 *
 * Dua hal yang dijaga di sini, dan keduanya gagal DIAM-DIAM kalau lepas:
 *
 *   1. KUNCI analisis di layar harus sama persis dengan kunci di peladen.
 *      Kunci yang berbeda tidak melahirkan galat build, tidak melahirkan
 *      peringatan tipe, dan tidak terlihat sampai seseorang menekan tombolnya
 *      dan dijawab "jenis analisa tidak dikenali".
 *
 *   2. SYARAT YANG MEMBUNGKUS KOLOM TANGGAL. `DATE_FORMAT(tgl,'%Y-%m') = ?`
 *      dan `YEARWEEK(tgl,1) = ?` memaksa MySQL menghitung fungsinya untuk
 *      SETIAP baris lebih dahulu - indeksnya tidak terpakai. Terukur pada
 *      sipp_donggala: beban majelis 17.952 ms menjadi 94 ms, rombongan sepekan
 *      4.345 ms menjadi 46 ms. Keduanya tetap menjawab benar sebelum
 *      diperbaiki, jadi tidak ada yang akan menangkapnya selain penjaga ini.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const baca = (jalur: string) => readFileSync(path.join(AKAR, jalur), "utf8").replace(/\r\n/g, "\n");

const layanan = baca("aleta_bot/services/analisaTambahanService.js");
const penyalur = baca("aleta_bot/services/analisaLanjutService.js");
const layar = baca("manajemen_surat/src/components/portal/aleta-analisa-perkara.tsx");

/** Kode saja - supaya tuntutan tidak lulus atas keterangannya sendiri. */
const kode = layanan
  .split("\n")
  .filter((b) => !/^\s*(\*|\/\/|\/\*)/.test(b))
  .join("\n");

const KUNCI_BARU = [
  "jedaTahapan",
  "hariSidang",
  "kecepatanRelaas",
  "kehadiranPihak",
  "desaPihak",
  "bebanMajelisBulan",
  "jedaSesudahPutus",
  "jamSidang",
  "ruangSidang",
  "rombonganSepekan",
];

describe("kunci analisis sama di peladen dan di layar", () => {
  it("kesepuluhnya terdaftar di peladen", () => {
    for (const kunci of KUNCI_BARU) {
      expect(layanan, kunci).toContain(`kunci: "${kunci}"`);
    }
  });

  it("kesepuluhnya terdaftar di layar dengan kunci yang PERSIS sama", () => {
    for (const kunci of KUNCI_BARU) {
      expect(layar, kunci).toContain(`kunci: "${kunci}"`);
    }
  });

  it("tiap kunci punya pengerjanya", () => {
    const blok = kode.slice(kode.indexOf("const PENGERJA_TAMBAHAN"));
    for (const kunci of KUNCI_BARU) {
      expect(blok, kunci).toContain(kunci);
    }
  });

  it("penyalurnya menyambung daftar dan pengerja, bukan menyalinnya", () => {
    expect(penyalur).toContain("...analisaTambahan.DAFTAR_TAMBAHAN,");
    expect(penyalur).toContain("Object.entries(analisaTambahan.PENGERJA_TAMBAHAN)");
  });

  it("alatnya DISUNTIKKAN, bukan disalin ke berkas sebelah", () => {
    // Dua median yang membulatkan berbeda akan berselisih pada angka yang
    // sudah tercetak di laporan, dan selisihnya tidak akan tertangkap apa pun.
    expect(penyalur).toContain("{ runQuery, cleanText, median, selisihHari, tanggalIso: tanggalAnalisa }");
    expect(kode).not.toContain("require(");
  });
});

describe("kuerinya tidak membungkus kolom tanggal", () => {
  it("bulan dan pekan dihitung di Node, lalu dibanding dengan BETWEEN", () => {
    expect(kode).toContain("function rentangBulan(bulan)");
    expect(kode).toContain("function rentangPekan(iso)");
    expect(kode).toContain("p.tanggal_pendaftaran BETWEEN ? AND ?");
    expect(kode).toContain("pk.tanggal_pendaftaran BETWEEN ? AND ?");
  });

  it("bentuk lambatnya tidak kembali", () => {
    expect(kode).not.toContain("DATE_FORMAT(p.tanggal_pendaftaran");
    expect(kode).not.toContain("YEARWEEK(pk.tanggal_pendaftaran");
  });

  it("angka pengukurannya tercatat di sumbernya", () => {
    expect(layanan).toContain("17.952 ms");
    expect(layanan).toContain("4.345 ms");
  });
});

describe("yang tidak dapat dipercaya disebut apa adanya", () => {
  it("jeda minutasi diberi peringatan, bukan dipuji", () => {
    // tanggal_minutasi terisi sendiri sama dengan tanggal putusan pada seluruh
    // 683 putusan 2026. Nol hari di sana berarti kolomnya mati.
    expect(layanan).toContain("JEDA MINUTASI TIDAK DAPAT DIPERCAYA");
    expect(layanan).toContain("683");
  });

  it("dua ejaan satu ruang sidang disebut di analisis ruangannya", () => {
    expect(layanan).toContain("SATU RUANGAN KADANG PUNYA DUA EJAAN");
    expect(layanan).toContain("1.353");
  });

  it("desa ditelusuri lewat KODE, bukan nama", () => {
    expect(kode).toContain("WHERE kelurahan = ?");
    expect(layanan).toContain('nama berulang - \\"Labuan\\" ada');
  });
});

describe("sepuluh alat baru di Status Perkara", () => {
  const alat = baca("manajemen_surat/src/components/portal/alat-status-perkara.tsx");
  const bagian = baca("manajemen_surat/src/lib/alat-bagian.ts");
  const riwayat = baca("manajemen_surat/src/lib/riwayat-perkara.ts");
  const status = baca("manajemen_surat/src/components/portal/aleta-ecourt-status-perkara.tsx");
  const ciut = baca("manajemen_surat/src/components/portal/bagian-ciut.tsx");

  it("kesepuluhnya ada", () => {
    for (const tanda of [
      "Salin ringkasan",
      "Salin tautan",
      "Cetak",
      "Buka semua",
      "Tutup semua",
      "Sematkan",
      "Cari bagian",
      "Buka SIPP",
    ]) {
      expect(alat, tanda).toContain(tanda);
    }
    // Riwayat dan pintasan loncat tidak punya tulisan tetap - dijaga lewat
    // fungsinya.
    expect(alat).toContain("bacaRiwayat()");
    expect(alat).toContain("const loncat = useCallback");
  });

  it("riwayat dan sematan hanya di peramban", () => {
    // Disimpan di peladen, keduanya menjadi catatan siapa memeriksa perkara
    // siapa - keterangan yang tidak diminta siapa pun.
    expect(riwayat).toContain("window.localStorage");
    expect(riwayat).not.toContain("fetch(");
    expect(alat).not.toContain("fetch(");
  });

  it("keadaan ciut TETAP milik tiap bagian - yang disiarkan hanya aba-aba", () => {
    // Menaikkannya ke induk membuat seluruh layar digambar ulang tiap kali
    // satu bagian dibuka, dan sebagian bagian memuat tabel beratus baris.
    expect(bagian).toContain("export function siarkanAba");
    // Komponen Bagian DIPINDAHKAN ke bagian-ciut.tsx supaya layar Antrian
    // Sidang memakai komponen yang SAMA, bukan salinannya. Yang dijaga tetap
    // sama - hanya berkas yang memuatnya yang berpindah.
    expect(ciut).toContain("const lepasAba = langgananAba((aba) => {");
    expect(ciut).toContain("if (aba.jenis === \"buka-semua\") setCiut(false);");
    // Dan layar status memang MEMAKAINYA, tidak menyimpan salinannya sendiri.
    expect(status).toContain('from "@/components/portal/bagian-ciut"');
    expect(status).not.toContain("function Bagian({");
  });

  it("bentuk kunci penyimpanan hanya punya SATU definisi", () => {
    expect(bagian).toContain("export function kunciCiut(kunci: string)");
    expect(ciut).toContain("kunci ? kunciCiut(kunci) : \"\"");
    // Satu definisi saja: layar yang menyusun bentuk kuncinya sendiri akan
    // menyimpang diam-diam, dan yang menyimpang justru keadaan yang diingat
    // peramban.
    expect(status).not.toContain("kunciCiut(kunci)");
    // Dua tempat yang menyusunnya sendiri akan menyimpang diam-diam.
    expect(status).not.toContain("`aleta.status-perkara.ciut.${kunci}`");
  });

  it("aba-aba menuliskan keadaannya lebih dahulu, baru menyiarkan", () => {
    // Bagian yang sedang tidak tergambar tidak akan mendengar aba-abanya; yang
    // membuatnya tetap terbuka adalah tulisan di peramban.
    const isi = bagian.slice(bagian.indexOf("export function siarkanAba"));
    expect(isi.indexOf("window.localStorage.setItem")).toBeLessThan(
      isi.indexOf("for (const f of pendengarAba)")
    );
  });

  it("bilah alat tidak ikut tercetak", () => {
    expect(alat).toContain("print:hidden");
  });
});
