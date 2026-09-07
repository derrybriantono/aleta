"use strict";

/**
 * ============================================================================
 * PENJAGA DUA PULUH ALAT DI DALAM PENILAIAN
 * ============================================================================
 *
 * Alat penilaian punya dua sisi - mesin yang menghitung, dan layar yang
 * menggambar - dan keduanya harus ada sebelum alat itu berguna bagi siapa pun.
 *
 * Sisi yang timpang adalah keadaan yang paling mudah dianggap selesai. Sisi
 * mesin selesai terasa seperti pekerjaan yang tuntas: angkanya benar-benar
 * terhitung, ujinya hijau, tidak ada yang menuduh. Padahal tidak seorang pun
 * di pengadilan dapat melihatnya.
 *
 * Karena itu penjaga ini menuntut keadaan tiap alat DIHITUNG dari berkas yang
 * benar-benar ada, dan menuntut yang belum lengkap menyebutkan apa yang
 * menghalanginya - bukan "belum sempat".
 */

const path = require("path");
const fs = require("fs");

const A = require("../services/alatPenilaianService");

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

console.log("Dua puluh alat di dalam penilaian\n");

/* -------------------------------------------------------------- bentuknya */

console.log("== Daftar alat memeriksa dirinya ==");

const cela = A.celaAlat();
cek("tidak ada cela pada daftar alat", cela.length === 0, cela.join("; "));
cek("dua puluh alat", A.ALAT.length === 20, `ada ${A.ALAT.length}`);

const kode = A.ALAT.map((x) => x.kode);
cek("kodenya D01 sampai D20 tanpa lompatan", kode.join(",") === Array.from({ length: 20 }, (_, i) => `D${String(i + 1).padStart(2, "0")}`).join(","), kode.join(","));

/* ------------------------------------------------------------- keadaannya */

console.log("== Keadaan dihitung dari berkas yang benar-benar ada ==");

const daftar = A.daftar();
const ringkas = A.ringkas();

cek("seluruh alat punya keadaan", daftar.length === 20);
cek(
  "ketiga keadaan berjumlah dua puluh",
  ringkas.siap + ringkas.sebelah + ringkas.belum === 20,
  JSON.stringify(ringkas)
);
cek("ada alat yang sudah siap", ringkas.siap >= 1, `${ringkas.siap}`);

// Tiap berkas yang disebut harus benar-benar ada. Menyebut berkas yang tidak
// ada lalu menandainya "belum" akan menyembunyikan salah ketik jalur.
const AKAR_BOT = path.resolve(__dirname, "..");
const AKAR_PORTAL = path.resolve(__dirname, "..", "..", "manajemen_surat");

const jalurHilang = [];
A.ALAT.forEach((a) => {
  if (a.mesin && !fs.existsSync(path.join(AKAR_BOT, a.mesin))) jalurHilang.push(`${a.kode} mesin: ${a.mesin}`);
  if (a.layar && !fs.existsSync(path.join(AKAR_PORTAL, a.layar))) jalurHilang.push(`${a.kode} layar: ${a.layar}`);
});
cek("tiap berkas yang disebut benar-benar ada", jalurHilang.length === 0, jalurHilang.join("; "));

// Alat yang menyebut berkas layar WAJIB menyebut petunjuk isinya. Berkas yang
// kebetulan ada bukan bukti bahwa alatnya tergambar di sana.
const tanpaPetunjuk = A.ALAT.filter((a) => a.layar && !a.petunjuk).map((a) => a.kode);
cek("tiap berkas layar disertai petunjuk isinya", tanpaPetunjuk.length === 0, tanpaPetunjuk.join(", "));

// Dan petunjuk itu harus benar-benar ditemukan.
const petunjukHilang = A.ALAT.filter((a) => {
  if (!a.layar || !a.petunjuk) return false;
  const p = path.join(AKAR_PORTAL, a.layar);
  return fs.existsSync(p) && !fs.readFileSync(p, "utf8").includes(a.petunjuk);
}).map((a) => `${a.kode} mencari "${a.petunjuk}" di ${a.layar}`);
cek("tiap petunjuk ditemukan pada berkasnya", petunjukHilang.length === 0, petunjukHilang.join("; "));

/* ---------------------------------------------------------- kejujurannya */

console.log("== Yang belum lengkap menyebutkan sebabnya ==");

const bisu = daftar.filter((a) => a.keadaan !== "siap" && (!a.sebab || a.sebab.length < 40)).map((a) => a.kode);
cek("tiap alat yang belum lengkap menyebutkan penghalangnya", bisu.length === 0, bisu.join(", "));

const berlebih = daftar.filter((a) => a.keadaan === "siap" && a.sebab).map((a) => a.kode);
cek("alat yang siap tidak lagi membawa penghalang", berlebih.length === 0, berlebih.join(", "));

// Sebab yang hanya berbunyi "belum sempat" atau sejenisnya bukan sebab.
const KOSONG_MAKNA = /belum sempat|nanti|menyusul|akan dikerjakan/i;
const hampa = daftar.filter((a) => a.sebab && KOSONG_MAKNA.test(a.sebab)).map((a) => a.kode);
cek("tidak ada sebab yang hampa maknanya", hampa.length === 0, hampa.join(", "));

/* ------------------------------------------------------------ pembacaan */

console.log("== Pembacaan alat ==");

cek("alat dikenali dari kodenya", A.alat("D03") !== null);
cek("huruf kecil tetap dikenali", A.alat("d03") !== null);
cek("kode karangan dijawab null", A.alat("D99") === null);
cek("teks kosong dijawab null", A.alat("") === null);
cek("null dijawab null", A.alat(null) === null);
["constructor", "toString", "__proto__"].forEach((k) => {
  cek(`kunci prototipe "${k}" dijawab null`, A.alat(k) === null);
});

/* ------------------------------------------------------------ rutenya */

console.log("== Rute terdaftar ==");

const RUTE = fs.readFileSync(path.join(__dirname, "..", "routes", "internalGatewayRoutes.js"), "utf8");
cek("rute /e-audit/alat terdaftar", RUTE.includes('router.get("/e-audit/alat"'));
cek("layanan alat disambungkan", RUTE.includes('require("../services/alatPenilaianService")'));

console.log(`\n${ringkas.siap} siap, ${ringkas.sebelah} sebelah, ${ringkas.belum} belum.`);
console.log(`Hasil: ${lulus} lulus, ${gagal} gagal`);
process.exit(gagal === 0 ? 0 : 1);
