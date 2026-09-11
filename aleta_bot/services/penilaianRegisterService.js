"use strict";

/**
 * ============================================================================
 * REGISTER KEPANITERAAN - KELENGKAPAN BARIS YANG SEHARUSNYA TERCATAT
 * ============================================================================
 *
 * Bab 5 katalog meminta empat belas register: induk gugatan, induk permohonan,
 * banding, kasasi, peninjauan kembali, mediasi, eksekusi, penyitaan,
 * konsinyasi, akta cerai, pembebasan biaya, gugatan sederhana, ekonomi
 * syariah, dan arsip berkas.
 *
 * Katalognya menyebut satu batas dengan tegas - "bentuk register tidak
 * diubah". Yang dinilai karena itu BUKAN susunan kolomnya, melainkan apakah
 * baris yang seharusnya tercatat memang tercatat lengkap. Register yang
 * bentuknya sempurna tetapi separuh kolomnya kosong tetap register yang tidak
 * dapat dipakai memeriksa apa pun.
 *
 * ============================================================================
 * SIPP TIDAK PUNYA TABEL REGISTER
 * ============================================================================
 *
 * Diperiksa pada basis data SIPP yang ada di tangan: tidak ada satu pun tabel
 * bernama register_*. Register di SIPP adalah TURUNAN - ia dicetak dari tabel
 * perkara dan tabel-tabel tahapannya.
 *
 * Karena itu tiap register di sini dipetakan ke tabel sumbernya, dan
 * kolom-kolom wajibnya diambil dari skema yang benar-benar ada, bukan dari
 * bentuk register di atas kertas.
 *
 * ============================================================================
 * REGISTER YANG TABELNYA TIDAK ADA TIDAK DINILAI NOL
 * ============================================================================
 *
 * Penyitaan dan konsinyasi tidak punya tabelnya sendiri pada SIPP ini. Menilai
 * keduanya nol berarti menuduh pengadilan tidak mencatat sesuatu yang memang
 * tidak pernah ada tempatnya - dan angka nol yang tidak dapat diperbaiki
 * dengan cara apa pun akan membuat seluruh papan berhenti dibaca.
 *
 * Yang dipulangkan pada keadaan itu daftar KOSONG: penilaian tanpa baris tidak
 * punya penyebut, sehingga ia tidak menghasilkan angka sama sekali.
 */

const kerangka = require("./kerangkaPenilaianService");
const kelengkapan = require("./kelengkapanBarisPenilaian");

/**
 * ============================================================================
 * EMPAT BELAS REGISTER
 * ============================================================================
 *
 * tabel      tabel SIPP yang menjadi sumber register ini
 * kunciPerkara  kolom penyambung ke perkara; kosong berarti tabelnya sendiri
 *               yang memuat nomor perkaranya
 * saring     syarat tambahan atas tabel perkara, bila registernya hanya
 *            memuat sebagian jenis
 * wajib      kolom yang harus terisi supaya barisnya berguna sebagai register
 */
const REGISTER = [
  {
    kode: "RG01",
    kunci: "registerIndukGugatan",
    judul: "Register Induk Perkara Gugatan",
    tabel: "perkara",
    saring: "p.nomor_perkara LIKE '%Pdt.G%'",
    wajib: ["nomor_perkara", "tanggal_pendaftaran", "jenis_perkara_nama"],
  },
  {
    kode: "RG02",
    kunci: "registerIndukPermohonan",
    judul: "Register Induk Perkara Permohonan",
    tabel: "perkara",
    saring: "p.nomor_perkara LIKE '%Pdt.P%'",
    wajib: ["nomor_perkara", "tanggal_pendaftaran", "jenis_perkara_nama"],
  },
  {
    kode: "RG03",
    kunci: "registerBanding",
    judul: "Register Permohonan Banding",
    tabel: "perkara_banding",
    wajib: ["nomor_perkara_pn", "permohonan_banding", "pemohon_banding"],
  },
  {
    kode: "RG04",
    kunci: "registerKasasi",
    judul: "Register Permohonan Kasasi",
    tabel: "perkara_kasasi",
    wajib: ["nomor_perkara_pn", "permohonan_kasasi", "pemohon_kasasi"],
  },
  {
    kode: "RG05",
    kunci: "registerPeninjauanKembali",
    judul: "Register Permohonan Peninjauan Kembali",
    tabel: "perkara_pk",
    wajib: ["nomor_perkara_pn", "permohonan_pk", "pemohon_pk", "alasan_pk"],
  },
  {
    kode: "RG06",
    kunci: "registerMediasi",
    judul: "Register Mediasi",
    tabel: "perkara_mediasi",
    // mediator_text ikut wajib: mediator_id kosong pada mediator non-hakim,
    // dan register mediasi tanpa nama mediator tidak dapat dipakai memeriksa
    // apa pun.
    wajib: ["penetapan_penunjukan_mediator", "mediator_text"],
  },
  {
    kode: "RG07",
    kunci: "registerEksekusi",
    judul: "Register Eksekusi",
    tabel: "perkara_eksekusi",
    wajib: ["nomor_perkara_pn", "eksekusi_putusan"],
  },
  {
    kode: "RG08",
    kunci: "registerPenyitaan",
    judul: "Register Penyitaan",
    tabel: "perkara_sita",
    wajib: ["perkara_id"],
  },
  {
    kode: "RG09",
    kunci: "registerKonsinyasi",
    judul: "Register Konsinyasi",
    tabel: "perkara_konsinyasi",
    wajib: ["perkara_id"],
  },
  {
    kode: "RG10",
    kunci: "registerAktaCerai",
    judul: "Register Akta Cerai",
    tabel: "perkara_akta_cerai",
    wajib: ["nomor_akta_cerai", "tgl_akta_cerai", "jenis_cerai"],
  },
  {
    kode: "RG11",
    kunci: "registerPembebasanBiaya",
    judul: "Register Pembebasan Biaya Perkara",
    tabel: "perkara",
    saring: "p.prodeo = 1",
    wajib: ["nomor_perkara", "tanggal_pendaftaran"],
  },
  {
    kode: "RG12",
    kunci: "registerGugatanSederhana",
    judul: "Register Gugatan Sederhana",
    tabel: "perkara",
    saring: "p.nomor_perkara LIKE '%Pdt.G.S%'",
    wajib: ["nomor_perkara", "tanggal_pendaftaran", "jenis_perkara_nama"],
  },
  {
    kode: "RG13",
    kunci: "registerEkonomiSyariah",
    judul: "Register Ekonomi Syariah",
    tabel: "perkara",
    saring: "p.jenis_perkara_nama LIKE '%konomi%'",
    wajib: ["nomor_perkara", "tanggal_pendaftaran", "jenis_perkara_nama"],
  },
  {
    kode: "RG14",
    kunci: "registerArsipBerkas",
    judul: "Register Arsip Berkas Perkara",
    tabel: "arsip",
    // Tabel arsip menautkan perkaranya lewat NOMOR, bukan perkara_id - nol
    // pada hampir seluruh barisnya - dan nomornya berekor titik yang tidak
    // ada pada tabel perkara. Tautan bawaan hanya menemukan 4 dari 279.
    sambung: "p.nomor_perkara = TRIM(TRAILING '.' FROM TRIM(x.nomor_perkara))",
    wajib: ["nomor_arsip", "tanggal_masuk_arsip", "no_ruang", "no_lemari", "no_rak"],
  },
];

let sudahDidaftar = false;

function daftarkanSemua() {
  if (sudahDidaftar) return REGISTER.map((r) => r.kunci);

  REGISTER.forEach((r) => {
    if (kerangka.ambil(r.kunci)) return;
    kerangka.daftarkan(
      kelengkapan.definisi({
        ...r,
        versiRumus: "register-v1",
        keterangan: `Kelengkapan baris ${r.judul.toLowerCase()} pada SIPP. Bentuk registernya tidak diubah; yang dinilai apakah kolom yang membuat barisnya berguna memang terisi.`,
      })
    );
  });

  sudahDidaftar = true;
  return REGISTER.map((r) => r.kunci);
}

function lupakanSemua() {
  sudahDidaftar = false;
}

function sambungan() {
  const peta = {};
  REGISTER.forEach((r) => {
    peta[r.kode] = r.kunci;
  });
  return peta;
}

module.exports = {
  REGISTER,
  daftarkanSemua,
  lupakanSemua,
  sambungan,
};
