// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  anonimkanAmar,
  SAMARAN_KURUNG,
  SAMARAN_NAMA,
  susunIsianPutusanSipp,
  type PihakPerkara,
} from "@/lib/isian-putusan-sipp";

/**
 * ============================================================================
 * AMAR ANONIM: "bin/binti <Nama>" DAN ISI KURUNG SESUDAH SEBUTAN
 * ============================================================================
 *
 * Diukur atas 105 amar ABT 2026 PA Donggala yang amar anonimnya sudah disimpan
 * petugas di perkara_putusan_anonim: 6 amar anonim ALETA masih memuat
 * "bin/binti <nama>" lebih banyak daripada versi petugas - nama di SIPP
 * ditulis tanpa bin, sehingga yang tersisa "Pemohon (Pemohon bin ...)". Bentuk
 * samaran diambil dari data, bukan dikarang: 317 kurung ditulis "( xxx )".
 *
 * Kalimat di bawah MENIRU BENTUK keenam amar itu; seluruh nama di dalamnya
 * BUATAN ("Fulan", "Contoh", ...), bukan nama pihak sungguhan.
 *
 * Penjaga ini MENJALANKAN anonimkanAmar dan susunIsianPutusanSipp.
 */

/** Pola ukur: "bin/binti" diikuti kata berhuruf besar - termasuk nama satu huruf ("binti I Ketut"). */
const MASIH_BIN = /\bbin(?:ti)?\s+[A-Z]/;

const KASUS: Array<{ judul: string; jenis: string; pihak: PihakPerkara[]; amar: string; harus: string[] }> = [
  {
    judul: "cerai talak: nama SIPP tanpa bin, amar menulis lengkap dalam kurung",
    jenis: "Cerai Talak",
    pihak: [
      { nama: "FULAN", pihakKe: 1, jenis: "pihak" },
      { nama: "FULANAH", pihakKe: 2, jenis: "pihak" },
    ],
    amar:
      "1. Mengabulkan permohonan Pemohon; 2. Memberi izin kepada Pemohon (FULAN bin AHMADI) untuk menjatuhkan talak satu raj'i terhadap Termohon (FULANAH binti HASANUDIN) di hadapan sidang Pengadilan Agama Donggala; 3. Menghukum Pemohon untuk membayar Nafkah iddah selama 3 (tiga) bulan sebesar Rp750.000,00 (tujuh ratus lima puluh ribu rupiah);",
    harus: ["Pemohon ( xxx ) untuk menjatuhkan talak", "terhadap Termohon ( xxx ) di hadapan"],
  },
  {
    judul: "cerai gugat verstek: kurung Tergugat berisi nama bergelar dan bin",
    jenis: "Cerai Gugat",
    pihak: [
      { nama: "Siti Contoh", pihakKe: 1, jenis: "pihak" },
      { nama: "Moh. Contoh", pihakKe: 2, jenis: "pihak" },
    ],
    amar:
      "1. Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir; 2. Mengabulkan gugatan Penggugat secara verstek; 3. Menjatuhkan talak satu ba'in shughra Tergugat (Moh. Contoh bin Fulan) terhadap Penggugat (Siti Contoh binti Fulan); 4. Membebankan kepada Penggugat untuk membayar biaya perkara;",
    harus: ["Tergugat ( xxx ) terhadap Penggugat ( xxx );"],
  },
  {
    judul: "dispensasi kawin: nama anak dan calon ber-bin/binti, termasuk nama Bali 'binti I Ketut'",
    jenis: "Dispensasi Kawin",
    pihak: [
      { nama: "Contoh Satu", pihakKe: 1, jenis: "pihak" },
      { nama: "Contoh Dua", pihakKe: 1, jenis: "pihak" },
    ],
    amar:
      "1. Mengabulkan permohonan para Pemohon; 2. Memberikan dispensasi kawin kepada anak Pemohon I dan Pemohon II yang bernama Budi Contoh bin Sutrisno, umur 17 tahun, untuk melangsungkan perkawinan dengan seorang perempuan bernama Komang Ayu Lestari binti I Ketut Contoh alias I KT Contoh; 3. Membebankan kepada para Pemohon untuk membayar biaya perkara;",
    harus: ["yang bernama xxx, umur 17 tahun", "seorang perempuan bernama xxx;", "anak Pemohon I dan Pemohon II"],
  },
  {
    judul: "nama anak yang ayahnya pihak tersamar: 'binti Pemohon II'",
    jenis: "Asal Usul Anak",
    pihak: [
      { nama: "Contoh Ayah", pihakKe: 1, jenis: "pihak" },
      { nama: "Contoh Ibu", pihakKe: 1, jenis: "pihak" },
    ],
    amar:
      "1. Mengabulkan permohonan para Pemohon; 2. Menetapkan anak bernama Zea binti Pemohon II, lahir di xxx, adalah anak sah para Pemohon; 3. Membebankan biaya perkara kepada para Pemohon;",
    harus: ["Menetapkan anak bernama xxx, lahir di xxx"],
  },
  {
    judul: "hak asuh: nama anak ber-bin di luar kurung",
    jenis: "Cerai Gugat",
    pihak: [
      { nama: "Contoh Ibu", pihakKe: 1, jenis: "pihak" },
      { nama: "Contoh Ayah", pihakKe: 2, jenis: "pihak" },
    ],
    amar:
      "1. Mengabulkan gugatan Penggugat; 2. Menjatuhkan talak satu ba'in sughra Tergugat (Contoh Ayah) terhadap Penggugat (Contoh Ibu); 3. Menetapkan Penggugat sebagai pemegang hak asuh anak bernama Rafa Contoh bin Contoh Ayah, umur 6 tahun;",
    harus: ["hak asuh anak bernama xxx, umur 6 tahun", "Tergugat ( xxx ) terhadap Penggugat ( xxx )"],
  },
  {
    judul: "isbat: nama pihak dalam kurung sesudah sebutan berangka Romawi",
    jenis: "Istbat Nikah",
    pihak: [
      { nama: "Fulan Contoh", pihakKe: 1, jenis: "pihak" },
      { nama: "Fulanah Contoh", pihakKe: 1, jenis: "pihak" },
    ],
    amar:
      "1. Mengabulkan permohonan para Pemohon; 2. Menyatakan sah perkawinan antara Pemohon I (Fulan Contoh bin Ahmad) dengan Pemohon II (Fulanah Contoh binti Hasan) yang dilaksanakan di Desa xxx; 3. Membebankan biaya perkara kepada para Pemohon;",
    harus: ["antara Pemohon I ( xxx ) dengan Pemohon II ( xxx ) yang dilaksanakan"],
  },
];

describe("anonimkanAmar - bin/binti dan isi kurung", () => {
  it.each(KASUS)("$judul", ({ jenis, pihak, amar, harus }) => {
    const { teks, diganti } = anonimkanAmar(amar, pihak, jenis);
    expect(teks).not.toMatch(MASIH_BIN);
    for (const potongan of harus) expect(teks).toContain(potongan);
    // Tidak satu pun nama buatan tersisa.
    expect(teks).not.toMatch(/Fulan|Contoh|AHMADI|HASANUDIN|Budi|Sutrisno|Komang|Ketut|Zea|Rafa/);
    // Yang disamarkan dilaporkan, supaya petugas dapat memeriksanya.
    expect(diganti.length).toBeGreaterThan(0);
  });

  it("memakai bentuk samaran terbanyak satker: '( xxx )' dan 'xxx'", () => {
    expect(SAMARAN_KURUNG).toBe("( xxx )");
    expect(SAMARAN_NAMA).toBe("xxx");
  });

  it("amar tanpa nama tidak diubah sehuruf pun", () => {
    const amar =
      "Dalam Konvensi: Menolak permohonan Pemohon; Dalam Rekonvensi: Menyatakan gugatan Penggugat Rekonvensi tidak dapat diterima; Dalam Konvensi dan Rekonvensi: Membebankan kepada Pemohon Konvensi/Tergugat Rekonvensi untuk membayar biaya perkara sejumlah Rp174.500,00;";
    expect(anonimkanAmar(amar, [], "Cerai Talak").teks).toBe(amar);
  });

  it("isi kurung yang bukan nama - sebutan, nomor, keterangan - dibiarkan", () => {
    const amar =
      "Menjatuhkan talak satu ba'in sughra Tergugat (Tergugat) terhadap Penggugat (selanjutnya disebut Penggugat); Menghukum Tergugat membayar nafkah anak (petitum angka 4) sejumlah Rp500.000,00;";
    expect(anonimkanAmar(amar, [], "Cerai Gugat").teks).toBe(amar);
  });

  it("'bin' di dalam kata lain tidak disentuh", () => {
    const amar = "Menghukum Tergugat untuk membayar biaya pembinaan anak; Menetapkan bingkisan tersebut milik Penggugat;";
    expect(anonimkanAmar(amar, [], "Cerai Gugat").teks).toBe(amar);
  });
});

describe("susunIsianPutusanSipp - catatan jujur", () => {
  const naskah = [
    "PERTIMBANGAN HUKUM",
    "Menimbang, bahwa gugatan Penggugat beralasan hukum;",
    "AMAR PUTUSAN",
    KASUS[1].amar,
  ].join("\n");

  it("menyebut samaran yang dipakai, dan mengatakan apa adanya bahwa Putusan otomatis menekan Simpan", () => {
    const isian = susunIsianPutusanSipp({ naskah, pihak: KASUS[1].pihak, jenisPerkara: "Cerai Gugat" });
    expect(isian.amarAnonim).not.toMatch(MASIH_BIN);
    const catatan = isian.catatan.join("\n");
    expect(catatan).toMatch(/MENEKAN tombol Simpan SIPP sendiri/);
    expect(catatan).toMatch(/praperiksa menahan/);
    // Catatan lama yang keliru sejak Simpan otomatis dibuka tidak boleh kembali.
    expect(catatan).not.toMatch(/Tombol Simpan di SIPP tidak ditekan ALETA/);
    expect(catatan).toContain(SAMARAN_KURUNG);
  });
});
