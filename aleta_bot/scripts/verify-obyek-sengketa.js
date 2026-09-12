"use strict";

/**
 * ============================================================================
 * OBYEK SENGKETA - KEBIASAAN SATKER PER JENIS PERKARA
 * ============================================================================
 *
 * Yang dijaga di sini bukan "apakah kuerinya jalan" melainkan tiga hal yang
 * diam-diam salah tanpa ada yang menyadarinya:
 *
 *   1. NOMOR PERKARA DARI PERAMBAN MASUK KE TEKS KUERI. Nomor itu datang
 *      lewat portal dari halaman SIPP. Ia hanya boleh menjadi PARAMETER.
 *
 *   2. HITUNGANNYA MENYEBERANG JENIS PERKARA. Kebiasaan cerai gugat
 *      ("Pernikahan/Perceraian") tidak boleh ikut dihitung untuk dispensasi
 *      kawin. Kueri kedua wajib menyaring pada jenis_perkara_id perkara ini.
 *
 *   3. TABEL YANG TIDAK TERDAFTAR DIJAWAB "TIDAK ADA" TANPA GALAT. Layanan
 *      skema hanya mengenali tabel yang tercantum di daftarnya; yang tidak
 *      tercantum selalu dijawab tidak ada. perkara_obyek_sengketa dan
 *      jenis_perkara harus ada di daftar itu, atau layanan ini mati diam.
 *
 * Berjalan tanpa jaringan dan tanpa basis data - db_config diganti penadah.
 */

let lulus = 0;
let gagal = 0;

function periksa(nama, benar) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}`);
  }
}

// ---------------------------------------------------------------- penadah
const kueri = [];
let barisPerkara = [];
let barisObyek = [];
let barisJenis = [];

const dbPath = require.resolve("../db_config");
require("../db_config");
require.cache[dbPath].exports = {
  query: (sql, params, selesai) => {
    kueri.push({ sql: String(sql), params: Array.isArray(params) ? params : [] });
    if (/FROM perkara\s+WHERE nomor_perkara/.test(sql)) return selesai(null, barisPerkara);
    if (/FROM perkara_obyek_sengketa/.test(sql)) return selesai(null, barisObyek);
    if (/FROM jenis_perkara/.test(sql)) return selesai(null, barisJenis);
    return selesai(null, []);
  },
};

// Layanan skema tidak dipanggil ke basis data: yang diuji di sini adalah
// DAFTAR-nya, bukan information_schema.
const skemaPath = require.resolve("../services/sippSkemaService");
const skemaAsli = require("../services/sippSkemaService");
require.cache[skemaPath].exports = {
  ...skemaAsli,
  tabelAda: async (tabel) => skemaAsli.TABEL.includes(tabel),
};

const layanan = require("../services/obyekSengketaService");

(async () => {
  console.log("obyek sengketa - kebiasaan satker");

  // ---- 3. daftar tabel skema
  periksa("perkara_obyek_sengketa terdaftar di layanan skema", skemaAsli.TABEL.includes("perkara_obyek_sengketa"));
  periksa("jenis_perkara terdaftar di layanan skema", skemaAsli.TABEL.includes("jenis_perkara"));

  // ---- jalur wajar: cerai gugat, empat ejaan satu maksud
  barisPerkara = [{ perkara_id: 10116, jenis_perkara_id: 347 }];
  barisObyek = [
    { obyek: "Pernikahan/Perceraian", jumlah: 895 },
    { obyek: "Pernikahan / Perceraian", jumlah: 273 },
    { obyek: "Pernikahan atau Perceraian", jumlah: 128 },
    { obyek: "Perkawinan/Perceraian", jumlah: 9 },
  ];
  barisJenis = [{ nama: "Cerai Gugat" }];
  kueri.length = 0;

  const nomor = "564/Pdt.G/2026/PA.Dgl'; DROP TABLE perkara; --";
  const hasil = await layanan.kebiasaan(nomor);

  periksa("jawaban ok", hasil.ok === true);
  periksa("perkaraId dan jenisPerkaraId ikut", hasil.perkaraId === 10116 && hasil.jenisPerkaraId === 347);
  periksa("nama jenis perkara disebut", hasil.jenisPerkara === "Cerai Gugat");
  periksa("ejaan dipulangkan APA ADANYA, tidak digabung di bot", hasil.baris.length === 4 && hasil.baris[1].obyek === "Pernikahan / Perceraian");
  periksa("jumlah tiap ejaan berupa angka", hasil.baris.every((x) => typeof x.jumlah === "number"));

  // ---- 1. nomor perkara tidak pernah masuk teks kueri
  const kueriPerkara = kueri.find((k) => /FROM perkara\s+WHERE nomor_perkara/.test(k.sql));
  periksa("nomor perkara menjadi PARAMETER kueri", Boolean(kueriPerkara) && kueriPerkara.params[0] === nomor);
  periksa("nomor perkara TIDAK disambung ke teks kueri", kueri.every((k) => !k.sql.includes("DROP TABLE") && !k.sql.includes("564/Pdt.G")));

  // ---- 2. hitungan disaring pada jenis perkara ini
  const kueriObyek = kueri.find((k) => /FROM perkara_obyek_sengketa/.test(k.sql));
  periksa("kueri kebiasaan menyaring jenis_perkara_id", Boolean(kueriObyek) && /jenis_perkara_id\s*=\s*\?/.test(kueriObyek.sql));
  periksa("jenis_perkara_id yang dipakai adalah milik perkara ini", Boolean(kueriObyek) && kueriObyek.params[0] === 347);
  periksa("obyek kosong disingkirkan di kueri", Boolean(kueriObyek) && /TRIM\(o\.obyek_gugatan\)\s*<>\s*''/.test(kueriObyek.sql));
  periksa("diurutkan dari yang terbanyak", Boolean(kueriObyek) && /ORDER BY jumlah DESC/.test(kueriObyek.sql));
  periksa("dibatasi, bukan seluruh ejaan sampah", Boolean(kueriObyek) && new RegExp(`LIMIT ${layanan.BATAS_EJAAN}`).test(kueriObyek.sql));

  // ---- tepi: perkara tidak ketemu
  barisPerkara = [];
  const tidakAda = await layanan.kebiasaan("999/Pdt.G/2099/PA.Dgl");
  periksa("perkara tidak ketemu dijawab terang", tidakAda.ok === false && tidakAda.error === "perkara_tidak_ketemu");

  // ---- tepi: nomor kosong tidak menyentuh basis data
  kueri.length = 0;
  const kosong = await layanan.kebiasaan("   ");
  periksa("nomor kosong ditolak tanpa satu pun kueri", kosong.ok === false && kosong.error === "nomor_kosong" && kueri.length === 0);

  // ---- tepi: jenis perkara kosong pada perkara
  barisPerkara = [{ perkara_id: 1, jenis_perkara_id: 0 }];
  const tanpaJenis = await layanan.kebiasaan("1/Pdt.G/2026/PA.Dgl");
  periksa("perkara tanpa jenis dijawab terang", tanpaJenis.ok === false && tanpaJenis.error === "jenis_perkara_kosong");

  // ---- tepi: tabel tidak terdaftar -> jawaban terang, bukan galat MySQL
  require.cache[skemaPath].exports.tabelAda = async () => false;
  const tanpaTabel = await layanan.kebiasaan("1/Pdt.G/2026/PA.Dgl");
  periksa("SIPP tanpa tabelnya dijawab tabel_tidak_ada", tanpaTabel.ok === false && tanpaTabel.error === "tabel_tidak_ada");

  console.log("");
  console.log(`lulus ${lulus}, gagal ${gagal}`);
  process.exit(gagal > 0 ? 1 : 0);
})().catch((galat) => {
  console.error("GALAT:", galat && galat.stack ? galat.stack : galat);
  process.exit(1);
});
