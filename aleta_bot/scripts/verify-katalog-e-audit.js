"use strict";

/**
 * ============================================================================
 * PENJAGA KATALOG ALETA e-AUDIT
 * ============================================================================
 *
 * Katalog adalah daftar seratus delapan puluh lima butir yang hendak dinilai.
 * Ia tidak menghitung apa pun, dan justru karena itu kerusakannya diam:
 * sebuah butir yang salah lantai, salah huruf bentuk, atau salah tanda sumber
 * angkanya tidak menggagalkan apa pun - ia hanya membuat butir itu menilai hal
 * yang berbeda dari yang dimaksudkan, atau dikerjakan pada urutan yang keliru.
 *
 * ============================================================================
 * YANG PALING PENTING DIJAGA: ANGKA KEMAJUAN
 * ============================================================================
 *
 * "Berapa yang sudah selesai" adalah angka yang paling mudah menyesatkan pada
 * aplikasi yang sedang dibangun, dan paling menggoda untuk dibulatkan ke atas.
 *
 * Karena itu angka itu tidak disimpan di mana pun. Ia dihitung dari selisih
 * antara katalog dan penilaian yang benar-benar terdaftar di mesin. Penjaga
 * ini memastikan hitungan itu benar-benar bekerja - termasuk memastikan ia
 * MENGENALI sambungan yang putus, bukan diam-diam menganggapnya "belum".
 */

const path = require("path");
const fs = require("fs");

const K = require("../services/katalogEAuditService");
const kerangka = require("../services/kerangkaPenilaianService");

let lulus = 0;
let gagal = 0;

function cek(nama, syarat, keterangan) {
  if (syarat) {
    lulus += 1;
    return;
  }
  gagal += 1;
  console.log(`  GAGAL  ${nama}${keterangan ? ` - ${keterangan}` : ""}`);
}

console.log("Katalog ALETA e-Audit\n");

/* --------------------------------------------------------------------------
 * Bentuk katalognya sendiri
 * ------------------------------------------------------------------------ */

console.log("== Katalog memeriksa dirinya ==");

const cela = K.celaKatalog();
cek("tidak ada cela pada katalog", cela.length === 0, cela.join("; "));

cek("dua belas bab", K.BAB.length === 12, `ada ${K.BAB.length}`);
cek("seratus delapan puluh lima butir", K.KATALOG.length === 185, `ada ${K.KATALOG.length}`);

// Jumlah per bab dikunci. Butir yang hilang saat penyuntingan tidak akan
// terlihat dari jumlah keseluruhan bila ada butir lain yang bertambah.
const HARAPAN_BAB = { 1: 6, 2: 14, 3: 20, 4: 26, 5: 14, 6: 10, 7: 14, 8: 16, 9: 22, 10: 16, 11: 12, 12: 15 };
Object.entries(HARAPAN_BAB).forEach(([no, jml]) => {
  const nyata = K.KATALOG.filter((b) => b.bab === Number(no)).length;
  cek(`bab ${no} berisi ${jml} butir`, nyata === jml, `ada ${nyata}`);
});

// Sebaran sumber angka menentukan URUTAN pengerjaan seluruh rencana. Bergeser
// diam-diam berarti gelombang pengerjaan disusun di atas angka yang salah.
const HARAPAN_MUTU = { kode: 100, hitung: 67, bebas: 18 };
Object.entries(HARAPAN_MUTU).forEach(([m, jml]) => {
  const nyata = K.KATALOG.filter((b) => b.mutuRuas === m).length;
  cek(`${jml} butir bersumber "${m}"`, nyata === jml, `ada ${nyata}`);
});

cek(
  "tiap bab pada daftar membawa jumlah butirnya",
  K.daftarBab().every((b) => b.jumlah === K.KATALOG.filter((x) => x.bab === b.no).length)
);

/* --------------------------------------------------------------------------
 * Pembacaan
 * ------------------------------------------------------------------------ */

console.log("== Pembacaan butir ==");

cek("butir dikenali dari kodenya", K.butir("KT06") !== null);
cek("huruf kecil tetap dikenali", K.butir("kt06") !== null);
cek("kode karangan dijawab null", K.butir("ZZ99") === null);
cek("teks kosong dijawab null", K.butir("") === null);
cek("null dijawab null", K.butir(null) === null);

// Kunci bawaan prototipe pernah menembus dua daftar lain di ALETA.
["constructor", "toString", "__proto__", "valueOf"].forEach((k) => {
  cek(`kunci prototipe "${k}" dijawab null`, K.butir(k) === null);
});

cek(
  "daftar per bab menyaring dengan benar",
  K.daftarButir(3).length === 20 && K.daftarButir(3).every((b) => b.bab === 3)
);
cek("tanpa bab memulangkan seluruhnya", K.daftarButir().length === 185);
// Bab yang tidak ada dijawab KOSONG, bukan seluruhnya. Memulangkan seluruh
// katalog untuk bab karangan akan membuat pemanggil menampilkan 185 butir
// seolah itu isi bab 99 - keliru tanpa satu pun tanda bahwa ia keliru.
cek("bab yang tidak ada dijawab kosong", K.daftarButir(99).length === 0);
cek("bab nol dijawab seluruhnya, sebab nol berarti tanpa saringan", K.daftarButir(0).length === 185);

const bt = K.bentukTerbaca("NTBGR");
cek(
  "huruf bentuk diterjemahkan",
  bt.length === 5 && bt.every((x) => typeof x.arti === "string" && x.arti.length > 3),
  JSON.stringify(bt)
);
cek("huruf tak dikenal dipulangkan sebagai null, bukan ditebak", K.bentukTerbaca("Z")[0].arti === null);

/* --------------------------------------------------------------------------
 * Hitungan kemajuan
 * ------------------------------------------------------------------------ */

console.log("== Kemajuan dihitung, bukan disimpan ==");

require("../services/penilaianKetaatanService").daftarkanSemua();
require("../services/penilaianMutuDataService").daftarkanSemua();
require("../services/penilaianKeuanganService").daftarkanSemua();
require("../services/penilaianTahapanService").daftarkanSemua();

const terdaftar = kerangka.daftar().map((d) => d.kunci);
const keadaan = K.keadaan(terdaftar);

cek("seluruh butir punya keadaan", keadaan.perButir.length === 185);
cek(
  "jumlah keempat keadaan sama dengan jumlah butir",
  keadaan.penuh + keadaan.sebagian + keadaan.belum + keadaan.putus === 185,
  `${keadaan.penuh}+${keadaan.sebagian}+${keadaan.belum}+${keadaan.putus}`
);
cek("tidak ada sambungan yang putus", keadaan.putus === 0, JSON.stringify(keadaan.perButir.filter((x) => x.keadaan === "putus")));
cek(
  "tidak ada penilaian terdaftar tanpa tempat",
  keadaan.tanpaTempat.length === 0,
  keadaan.tanpaTempat.join(", ")
);
cek("ada yang sudah tersambung penuh", keadaan.penuh >= 1, `${keadaan.penuh}`);
cek("ada yang baru tersambung sebagian", keadaan.sebagian >= 1, `${keadaan.sebagian}`);

// Tiap sambungan harus menunjuk penilaian yang benar-benar terdaftar.
const adaKunci = new Set(terdaftar);
const menggantung = Object.entries(K.SAMBUNGAN).filter(([, s]) => !adaKunci.has(s.kunci));
cek(
  "tiap sambungan menunjuk penilaian yang terdaftar",
  menggantung.length === 0,
  menggantung.map(([k, s]) => `${k} -> ${s.kunci}`).join(", ")
);

// Dan tiap penilaian yang terdaftar harus punya tempat: pada katalog, atau
// pada daftar di luar katalog beserta alasannya.
const disebut = new Set([
  ...Object.values(K.SAMBUNGAN).map((s) => s.kunci),
  ...Object.keys(K.DI_LUAR_KATALOG),
]);
const yatim = terdaftar.filter((k) => !disebut.has(k));
cek("tiap penilaian terdaftar punya tempat", yatim.length === 0, yatim.join(", "));

/* --------------------------------------------------------------------------
 * Hitungannya benar-benar mengenali kerusakan
 * ------------------------------------------------------------------------ */

console.log("== Hitungannya diuji dengan keadaan rusak ==");

// Sambungan yang menunjuk penilaian tidak terdaftar HARUS terbaca "putus",
// bukan diam-diam menjadi "belum". Perbedaannya menentukan: "belum" berarti
// pekerjaannya memang belum dimulai, "putus" berarti ada yang rusak.
const tanpaSatuPun = K.keadaan([]);
cek(
  "sambungan yang menunjuk penilaian hilang terbaca putus",
  tanpaSatuPun.putus === Object.keys(K.SAMBUNGAN).length,
  `putus=${tanpaSatuPun.putus}, sambungan=${Object.keys(K.SAMBUNGAN).length}`
);
cek("dan tidak satu pun terbaca penuh", tanpaSatuPun.penuh === 0);
cek(
  "keadaan putus menyebutkan penilaian yang dicarinya",
  tanpaSatuPun.perButir
    .filter((x) => x.keadaan === "putus")
    .every((x) => typeof x.catatan === "string" && x.catatan.includes("tidak terdaftar")),
);

// Penilaian yang berjalan tanpa tercatat di mana pun harus ketahuan.
const denganPenyusup = K.keadaan([...terdaftar, "penilaianKarangan"]);
cek(
  "penilaian tanpa tempat ketahuan",
  denganPenyusup.tanpaTempat.includes("penilaianKarangan"),
  JSON.stringify(denganPenyusup.tanpaTempat)
);

// Masukan yang aneh tidak boleh meledak.
cek("daftar kosong tidak meledak", K.keadaan([]).jumlahButir === 185);
cek("tanpa argumen tidak meledak", K.keadaan().jumlahButir === 185);

/* --------------------------------------------------------------------------
 * Rutenya terdaftar
 * ------------------------------------------------------------------------ */

console.log("== Rute terdaftar di gerbang internal ==");

const RUTE = fs.readFileSync(path.join(__dirname, "..", "routes", "internalGatewayRoutes.js"), "utf8");
['router.get("/e-audit/katalog"', 'router.get("/e-audit/butir"'].forEach((r) => {
  cek(`rute ${r.slice(12, -1)} terdaftar`, RUTE.includes(r));
});
cek(
  "katalog disambungkan pada gerbang",
  RUTE.includes('require("../services/katalogEAuditService")')
);

console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal === 0 ? 0 : 1);
