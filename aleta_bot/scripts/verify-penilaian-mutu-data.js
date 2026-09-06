"use strict";

/**
 * ============================================================================
 * BAB 2 - PENGAWASAN MUTU DAN INTEGRITAS DATA
 * ============================================================================
 *
 * Yang paling dijaga di sini satu hal yang mudah dikelabui: ruas yang diisi
 * tanda hubung supaya tidak tampak kosong. Bila penilaian menghitungnya
 * sebagai terisi, seluruh penilaian kelengkapan dapat dilulusi dengan satu
 * ketukan papan ketik - dan pengawasan berubah menjadi upacara.
 *
 * Berjalan tanpa basis data.
 */

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, keterangan) {
  if (benar) lulus += 1;
  else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

const kueri = [];
let barisPenadah = [];
const jalurDb = require.resolve("../db_config");
require("../db_config");
require.cache[jalurDb].exports = {
  query: (sql, params, selesai) => {
    kueri.push({ sql: String(sql), params: Array.isArray(params) ? params : [] });
    selesai(null, barisPenadah);
  },
};

const M = require("../services/penilaianMutuDataService");
const K = require("../services/kerangkaPenilaianService");
const C = require("../services/cakupanDataService");

const RENTANG = { mulai: "2026-08-01", selesai: "2026-08-31" };

console.log("");
console.log("== Ruas terisi lawan ruas yang dibuat tampak terisi ==");
{
  periksa("tulisan biasa terisi", M.terisi("putusan.pdf") === true);
  periksa("kosong tidak terisi", M.terisi("") === false);
  periksa("null tidak terisi", M.terisi(null) === false);
  periksa("spasi saja tidak terisi", M.terisi("   ") === false);
  // Inilah yang mudah dikelabui.
  periksa("tanda hubung saja TIDAK terisi", M.terisi("-") === false);
  periksa("beberapa tanda hubung TIDAK terisi", M.terisi("---") === false);
  periksa("titik saja TIDAK terisi", M.terisi(".") === false);
  periksa("garis bawah saja TIDAK terisi", M.terisi("_") === false);
  periksa("campuran tanda baca kosong TIDAK terisi", M.terisi(" - . _ ") === false);
  periksa("tulisan yang memuat tanda hubung tetap terisi", M.terisi("bas-2026-08.pdf") === true);
  periksa("angka nol sebagai tulisan tetap terisi", M.terisi("0") === true);
}

async function utama() {
  console.log("== Kuerinya membaca dan memakai rentangnya ==");
  kueri.length = 0;
  barisPenadah = [];
  await M.barisBeritaAcara(RENTANG);
  await M.barisAmarPutusan(RENTANG);
  await M.barisPertimbanganHukum(RENTANG);

  periksa("tiga kueri dijalankan", kueri.length === 3);
  periksa("seluruhnya diawali SELECT", kueri.every((k) => /^\s*SELECT/i.test(k.sql)));
  periksa(
    "tidak satu pun memuat kata kerja tulis",
    kueri.every((k) => !/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE)\b/i.test(k.sql))
  );
  periksa(
    "rentangnya diserahkan sebagai nilai",
    kueri.every((k) => k.params[0] === RENTANG.mulai && k.params[1] === RENTANG.selesai)
  );
  periksa("seluruhnya berbatas jumlah baris", kueri.every((k) => /LIMIT \d+/.test(k.sql)));

  console.log("== Berita acara sidang ==");
  {
    barisPenadah = [
      { nomorPerkara: "1/Pdt.G/2026", sidangId: 11, tanggalSidang: "2026-08-05", agenda: "Pembuktian", berkas: "bas-1.pdf" },
      { nomorPerkara: "2/Pdt.G/2026", sidangId: 12, tanggalSidang: "2026-08-06", agenda: "Jawaban", berkas: "" },
      { nomorPerkara: "3/Pdt.G/2026", sidangId: 13, tanggalSidang: "2026-08-07", agenda: "Mediasi", berkas: "-" },
    ];
    const baris = await M.barisBeritaAcara(RENTANG);
    periksa("tiga baris", baris.length === 3);
    periksa("yang berberkas memenuhi", baris[0].memenuhi === true);
    periksa("yang kosong tidak memenuhi", baris[1].memenuhi === false);
    periksa("yang berisi tanda hubung TIDAK memenuhi", baris[2].memenuhi === false);
    periksa("kuncinya memuat nomor perkara dan sidang", /^\d+\/Pdt\.G\/2026#\d+$/.test(baris[0].kunci), baris[0].kunci);
    periksa("kuncinya tidak berulang", new Set(baris.map((b) => b.kunci)).size === 3);
    periksa("agendanya ikut terbawa", baris[0].agenda === "Pembuktian");
  }

  console.log("== Amar putusan ==");
  {
    barisPenadah = [
      { nomorPerkara: "10/Pdt.G/2026", tanggalPutusan: "2026-08-11", amar: "<p>Mengabulkan gugatan Penggugat;</p>" },
      { nomorPerkara: "11/Pdt.G/2026", tanggalPutusan: "2026-08-12", amar: null },
    ];
    const baris = await M.barisAmarPutusan(RENTANG);
    periksa("yang beramar memenuhi", baris[0].memenuhi === true);
    periksa("yang kosong tidak memenuhi", baris[1].memenuhi === false);
    periksa("tanggal putusnya dipotong sampai hari", baris[0].tanggalPutusan === "2026-08-11");
  }

  console.log("== Pertimbangan hukum ==");
  {
    barisPenadah = [
      { nomorPerkara: "20/Pdt.G/2026", tanggalPutusan: "2026-08-11", adaPertimbangan: 20 },
      { nomorPerkara: "21/Pdt.G/2026", tanggalPutusan: "2026-08-12", adaPertimbangan: null },
    ];
    const baris = await M.barisPertimbanganHukum(RENTANG);
    periksa("yang berpertimbangan memenuhi", baris[0].memenuhi === true);
    periksa("yang tanpa pertimbangan tidak memenuhi", baris[1].memenuhi === false);
    // Nol adalah perkara_id yang sah; ia tidak boleh dibaca sebagai "tidak ada".
    barisPenadah = [{ nomorPerkara: "22/Pdt.G/2026", tanggalPutusan: "2026-08-13", adaPertimbangan: 0 }];
    const nol = await M.barisPertimbanganHukum(RENTANG);
    periksa("perkara_id nol tetap dibaca sebagai ADA", nol[0].memenuhi === true);
  }

  console.log("== Ketiganya bercakupan berbeda jauh, dan itu disengaja ==");
  {
    // Angka nyata dari pengukuran 6 September 2026.
    const bas = C.cakupan(15187, 20048, "2026-09-06");
    const amar = C.cakupan(9899, 9989, "2026-09-06");
    const pertimbangan = C.cakupan(2224, 9989, "2026-09-06");
    // Angkanya dinyatakan apa adanya, bukan menurut dugaan. Percobaan pertama
    // menegaskan berita acara "sedang" padahal 75,8 persen sudah "memadai" -
    // uji yang menegaskan dugaan, bukan kenyataan, akan menggagalkan kode yang
    // benar dan mengajari orang mengubah angkanya sampai ujinya hijau.
    periksa("berita acara 75,8 persen", bas.persen === 75.8, String(bas.persen));
    periksa("dan itu tepat di ambang memadai", bas.tingkat === "memadai" && bas.rendah === false);
    periksa("amar 99,1 persen", amar.persen === 99.1, String(amar.persen));
    periksa("pertimbangan 22,3 persen", pertimbangan.persen === 22.3, String(pertimbangan.persen));
    periksa("dan hanya pertimbangan yang ditandai rendah",
      pertimbangan.rendah === true && bas.rendah === false && amar.rendah === false);
    periksa("selisih antara yang tertinggi dan terendah lebih dari tujuh puluh poin",
      amar.persen - pertimbangan.persen > 70, String(amar.persen - pertimbangan.persen));
    const banding = C.bandingkanCakupan([
      { kunci: "bas", cakupan: bas },
      { kunci: "amar", cakupan: amar },
      { kunci: "pertimbangan", cakupan: pertimbangan },
    ]);
    periksa("satu dari tiga di bawah ambang", banding.rendah === 1, JSON.stringify(banding.rendah));
    periksa("yang terendah adalah pertimbangan", banding.terendah.kunci === "pertimbangan");
  }

  console.log("== Pendaftaran ke kerangka ==");
  {
    K.lupakanSemua();
    M.lupakan();
    const kunci = M.daftarkanSemua();
    periksa("tiga penilaian terdaftar", kunci.length === 3, kunci.join(","));
    periksa(
      "masing-masing menyebut ruas yang dibaca",
      K.daftar().every((d) => d.caraHitung.ruasSumber.length > 8)
    );
    periksa(
      "yang menyebut ruas kosong dihitung kosong ada pada keterangannya",
      K.daftar().filter((d) => /tanda hubung/i.test(d.caraHitung.dikecualikan)).length === 2
    );

    barisPenadah = [{ nomorPerkara: "1/Pdt.G/2026", sidangId: 11, tanggalSidang: "2026-08-05", agenda: "x", berkas: "a.pdf" }];
    const hasil = await K.jalankan("kelengkapanBeritaAcaraSidang", "mingguan", "2026-09-06");
    periksa("dapat dijalankan lewat kerangka", hasil.ok === true);
    periksa("delapan satuan mingguan", hasil.satuan.length === 8);
    periksa("berlantai harian, jadi mingguan tidak di bawah lantai", hasil.bawahLantai === false);
  }

  console.log("");
  console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
  process.exit(gagal > 0 ? 1 : 0);
}

utama().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
