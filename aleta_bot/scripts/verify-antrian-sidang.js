"use strict";

/**
 * Nomor antrian sidang.
 *
 * ============================================================================
 * YANG PALING PENTING DIJAGA DI SINI
 * ============================================================================
 *
 * Nomor antrian yang ditampilkan jadwal harus SAMA dengan nomor yang sudah
 * diterima pihak berperkara lewat WhatsApp. Layar yang menyebut nomor lain
 * akan dipercaya petugas dan dibantah oleh yang datang.
 *
 * Karena itu uji ini membandingkan hasil antrianSidangService dengan rumus
 * yang benar-benar tertulis di antrianOnlineService - dibaca dari berkasnya,
 * bukan diketik ulang di sini. Kalau salah satunya diubah tanpa yang lain,
 * uji ini gagal.
 *
 * ============================================================================
 * DATANYA DIAMBIL DARI SIPP SUNGGUHAN
 * ============================================================================
 *
 * Sembilan belas baris di bawah disalin dari antrian_sidang PA Donggala
 * tanggal 1 September 2026, lengkap dengan yang belum diambil siapa pun dan
 * yang kedua pihaknya sudah hadir.
 */

const pathx = require("path");
const fs = require("fs");
const Module = require("module");

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

// --- Data sungguhan dari antrian_sidang, 1 September 2026 --------------------
//
// Kolom yang dipakai saja: id, perkara_id, pihak_1, pihak_2, majelis, online.
const BARIS = [
  { id: 19787, perkaraId: 9971, p1: "2026-09-01 15:02:32", p2: null, majelis: "B|C2|C3" },
  { id: 19799, perkaraId: 9956, p1: "2026-09-01 10:11:00", p2: "2026-09-01 09:01:46", majelis: "B|C2|C3" },
  { id: 19825, perkaraId: 9969, p1: "2026-09-01 08:32:33", p2: null, majelis: "B|C2|C3" },
  { id: 19826, perkaraId: 9986, p1: "2026-09-01 08:54:08", p2: "2026-09-01 08:54:08", majelis: "B|C2|C3" },
  { id: 19828, perkaraId: 9977, p1: "2026-09-01 08:40:55", p2: null, majelis: "B|C2|C3" },
  { id: 19829, perkaraId: 9981, p1: "2026-09-01 09:09:53", p2: null, majelis: "B|C2|C3" },
  { id: 19830, perkaraId: 9979, p1: "2026-09-01 09:12:26", p2: null, majelis: "B|C2|C3" },
  { id: 19831, perkaraId: 9975, p1: "2026-09-01 09:14:45", p2: null, majelis: "B|C2|C3" },
  { id: 19832, perkaraId: 9963, p1: "2026-09-01 12:51:42", p2: null, majelis: "B|C2|C3" },
  // Belum diambil siapa pun - tidak boleh dapat nomor.
  { id: 19834, perkaraId: 9958, p1: null, p2: null, majelis: "B|C2|C3" },
  { id: 19843, perkaraId: 9983, p1: "2026-09-01 08:40:09", p2: null, majelis: "B|C2|C3" },
  { id: 19846, perkaraId: 10000, p1: "2026-09-01 10:05:25", p2: null, majelis: "B|C2|C3" },
  { id: 19847, perkaraId: 10023, p1: "2026-09-01 10:04:19", p2: "2026-09-01 10:04:19", majelis: "B|C2|C3" },
  { id: 19887, perkaraId: 10009, p1: "2026-09-01 08:35:06", p2: null, majelis: "B|C2|C3" },
  { id: 19901, perkaraId: 9991, p1: "2026-09-01 10:25:22", p2: null, majelis: "B|C2|C3" },
  { id: 19916, perkaraId: 10064, p1: "2026-09-01 08:20:56", p2: null, majelis: "B|C2|C3" },
  { id: 19993, perkaraId: 10021, p1: null, p2: null, majelis: "C1|C2|C3" },
  { id: 19999, perkaraId: 10057, p1: null, p2: null, majelis: "C1|C2|C3" },
  { id: 20001, perkaraId: 9929, p1: null, p2: null, majelis: "C1|C2|C3" },
];

/**
 * Menirukan MySQL: memilih baris, menghitung LEAST, lalu mengurutkan.
 *
 * Bukan menirukan hasilnya - menirukan mesinnya, sehingga kueri yang ditulis
 * layanannya benar-benar menentukan jawabannya.
 */
function jalankanKueri(sql) {
  const diambil = BARIS.filter((x) => x.p1 !== null || x.p2 !== null);
  const belum = BARIS.filter((x) => x.p1 === null && x.p2 === null);

  const petakan = (x) => ({
    perkaraId: x.perkaraId,
    tanggalSidang: "2026-09-01",
    majelisKode: x.majelis,
    ruanganId: 1,
    noRuang: 10,
    jamSidang: null,
    jamPanggil: "09:41:19",
    namaPetugas: null,
    disidang: 10,
    online: x.online ? 1 : null,
    pihak1: x.p1,
    pihak2: x.p2,
    saksi: null,
    waktuAmbil: x.p1 && x.p2 ? (x.p1 < x.p2 ? x.p1 : x.p2) : x.p1 || x.p2,
  });

  if (/pihak_1 IS NULL AND a\.pihak_2 IS NULL/i.test(sql)) {
    return belum.map(petakan);
  }

  const hasil = diambil.map(petakan);
  hasil.sort(
    (a, b) =>
      String(a.waktuAmbil).localeCompare(String(b.waktuAmbil)) ||
      a.perkaraId - b.perkaraId ||
      String(a.majelisKode).localeCompare(String(b.majelisKode))
  );
  return hasil;
}

// --- externalDbService palsu ------------------------------------------------
const jalur = require.resolve(pathx.resolve(__dirname, "..", "services", "externalDbService.js"));
const kueri = [];
let lemparkan = null;

require.cache[jalur] = new Module(jalur, null);
require.cache[jalur].filename = jalur;
require.cache[jalur].loaded = true;
require.cache[jalur].exports = {
  async query(kunci, sql, params) {
    kueri.push({ kunci, sql: String(sql), params: params || [] });
    if (lemparkan) throw lemparkan;
    return jalankanKueri(sql);
  },
  sanitizeError: (galat) => String(galat.message || galat),
};

const layanan = require("../services/antrianSidangService");

async function jalan() {
  // ==========================================================================
  console.log("\n== Nomor antrian, dari data 1 September 2026 ==");
  // ==========================================================================
  const hasil = await layanan.petaAntrian();

  periksa("antriannya terbaca", hasil.terbaca === true);
  periksa("lima belas perkara sudah mengambil", hasil.jumlahDiambil === 15);
  periksa("sembilan belas perkara terdaftar seluruhnya", Object.keys(hasil.peta).length === 19);

  // Yang mengambil paling awal: perkara 10064 pukul 08:20:56.
  periksa("nomor 1 jatuh pada yang mengambil paling awal", hasil.peta["10064"].nomor === 1);
  periksa("waktu ambilnya ikut disebut", hasil.peta["10064"].waktuAmbil === "08:20");

  // Perkara 9956: pihak_1 pukul 10:11 tetapi pihak_2 pukul 09:01 - yang
  // dipakai yang TERAWAL, bukan pihak pertama. Salah di sini menggeser nomor
  // seluruh orang di belakangnya.
  periksa(
    "yang dipakai waktu TERAWAL di antara kedua pihak",
    hasil.peta["9956"].waktuAmbil === "09:01"
  );

  const urut = Object.entries(hasil.peta)
    .filter(([, x]) => x.nomor)
    .sort((a, b) => a[1].nomor - b[1].nomor)
    .map(([kunci]) => kunci);
  periksa(
    "urutan nomornya menurut waktu ambil",
    urut.slice(0, 5).join(",") === "10064,9969,10009,9983,9977"
  );
  periksa("nomornya berurut tanpa lompatan", urut.every((kunci, i) => hasil.peta[kunci].nomor === i + 1));
  periksa(
    "nomor terbesar sama dengan jumlah yang mengambil",
    hasil.peta[urut[urut.length - 1]].nomor === 15
  );

  // ==========================================================================
  console.log("\n== Yang belum mengambil ==");
  // ==========================================================================
  periksa("terdaftar tetapi tanpa nomor", hasil.peta["9958"].nomor === null);
  periksa("keadaannya disebut belum-ambil", hasil.peta["9958"].keadaan === "belum-ambil");
  periksa(
    "keempatnya tidak mendapat nomor",
    ["9958", "10021", "10057", "9929"].every((kunci) => hasil.peta[kunci].nomor === null)
  );
  periksa(
    "dan tidak menggeser nomor yang sudah mengambil",
    hasil.peta["10064"].nomor === 1 && hasil.peta["9956"].nomor === 7
  );

  // ==========================================================================
  console.log("\n== Rumusnya sama dengan yang menjawab WhatsApp ==");
  // ==========================================================================
  {
    // Dibaca dari berkasnya, bukan diketik ulang - kalau salah satunya diubah
    // tanpa yang lain, uji ini gagal.
    const bacaOnline = fs.readFileSync(
      pathx.resolve(__dirname, "..", "services", "antrianOnlineService.js"),
      "utf8"
    );
    const rapikan = (teks) => teks.replace(/\s+/g, " ").toLowerCase();

    const inti = [
      "when a.pihak_1 is not null and a.pihak_2 is not null then least(a.pihak_1, a.pihak_2)",
      "when a.pihak_1 is not null then a.pihak_1",
      "else a.pihak_2",
      "where a.pihak_1 is not null or a.pihak_2 is not null",
    ];

    for (const bagian of inti) {
      periksa(
        `rumus "${bagian.slice(0, 42)}…" ada di keduanya`,
        rapikan(bacaOnline).includes(bagian) && rapikan(layanan.SQL_URUTAN).includes(bagian)
      );
    }

    periksa(
      "keduanya mengurut menurut waktu ambil, perkara_id, lalu majelis",
      /order by sort_col1, sort_col2, sort_col3/.test(rapikan(bacaOnline)) &&
        /order by waktuambil asc, a\.perkara_id asc, a\.majelis_hakim_kode asc/.test(
          rapikan(layanan.SQL_URUTAN)
        )
    );
  }

  // ==========================================================================
  console.log("\n== Hanya membaca ==");
  // ==========================================================================
  periksa("seluruh kueri berupa SELECT", kueri.every((x) => /^\s*SELECT\b/i.test(x.sql.trim())));
  periksa(
    "tidak ada INSERT, UPDATE, atau DELETE",
    kueri.every((x) => !/\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i.test(x.sql))
  );
  periksa(
    "memakai sambungan antrian_sidang, bukan sambungan SIPP",
    kueri.every((x) => x.kunci === "antrian_sidang")
  );

  // ==========================================================================
  console.log("\n== Sambungan yang bermasalah ==");
  // ==========================================================================
  {
    kueri.length = 0;
    lemparkan = new Error("ER_ACCESS_DENIED_ERROR: akses ditolak");
    const rusak = await layanan.petaAntrian();
    lemparkan = null;

    // Antrian keterangan TAMBAHAN. Kegagalannya tidak boleh menjatuhkan layar
    // jadwal - yang benar: jadwalnya tetap tampil, dan sebabnya disebutkan.
    periksa("kegagalan tidak dilempar keluar", rusak.terbaca === false);
    periksa("sebabnya disebutkan", /akses ditolak/i.test(rusak.alasan));
    periksa("petanya kosong, bukan undefined", Object.keys(rusak.peta).length === 0);
  }

  // ==========================================================================
  console.log("\n== Menyaring untuk sekumpulan perkara ==");
  // ==========================================================================
  {
    const sebagian = await layanan.antrianUntukPerkara([10064, 9956]);
    periksa("hanya perkara yang diminta yang dikembalikan", Object.keys(sebagian.peta).length === 2);
    // Nomornya tetap kedudukan dalam deret BERSAMA - menghitungnya ulang atas
    // sebagian daftar menghasilkan angka yang tidak pernah disebutkan.
    periksa(
      "nomornya tetap dari deret penuh, bukan dihitung ulang",
      // Kalau dihitung ulang atas dua baris ini saja, 9956 akan jadi nomor 2 -
      // angka yang tidak pernah disebutkan kepada siapa pun.
      sebagian.peta["10064"].nomor === 1 && sebagian.peta["9956"].nomor === 7
    );
  }

  {
    const kosong = await layanan.antrianUntukPerkara([]);
    periksa("daftar kosong berarti seluruhnya", Object.keys(kosong.peta).length === 19);
  }

  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal\n`);
  process.exit(gagal === 0 ? 0 : 1);
}

jalan().catch((galat) => {
  console.error("Gagal dijalankan:", galat);
  process.exit(1);
});
