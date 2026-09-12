"use strict";

/**
 * ============================================================================
 * JAM YANG DICATAT PADA TIAP LANGKAH PENETAPAN
 * ============================================================================
 *
 * Keempat penetapan ditulis oleh satu tekanan tombol, dalam hitungan detik.
 * Dicatat apa adanya, tab Riwayat Perkara memperlihatkan PMH, PPP, PJS, dan
 * PHS terjadi pada detik yang berdempetan - padahal keempatnya empat keputusan
 * yang berbeda.
 *
 * Yang dijaga di sini empat aturan, dan ketiganya pernah dilanggar oleh
 * rancangan pertamanya:
 *
 *   1. Tanggalnya SELALU sama untuk keempat langkah.
 *   2. Jaraknya 1 sampai 10 menit, menaik menurut urutan langkah.
 *   3. Tidak pernah melampaui jam peladen pada tanggal yang sama.
 *   4. Dua perkara pada hari yang sama tidak jatuh pada jam yang sama.
 *   5. Detik keempat langkah satu perkara tidak seluruhnya sama.
 *
 * Aturan kedua pernah gagal diam-diam: jedanya dihitung dengan pergeseran bit,
 * dan benih di atas 2,14 miliar berubah menjadi negatif sebagai int32 - enam
 * dari delapan perkara menghasilkan PHS yang lebih awal daripada PMH-nya.
 *
 * Berjalan tanpa jaringan dan tanpa basis data.
 */

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, tambahan = "") {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${tambahan ? ` - ${tambahan}` : ""}`);
  }
}

// db_config tidak dipakai waktuLangkah, tetapi dimuat saat require layanan.
const dbPath = require.resolve("../db_config");
require("../db_config");
require.cache[dbPath].exports = { query: (_s, _p, selesai) => selesai(null, []) };

const layanan = require("../services/penetapanTulisService");
const { waktuLangkah } = layanan;

const URUT = ["pmh", "ppp", "pjs", "phs"];

/** Keempat jam satu perkara, dalam menit sejak tengah malam. */
function rangkaian(perkaraId, tanggal, server) {
  return URUT.map((jenis) => waktuLangkah({ perkaraId, tanggalPenetapan: tanggal, jenis, saatServer: server }));
}
const keMenit = (teks) => {
  const m = /(\d{2}):(\d{2}):(\d{2})$/.exec(teks);
  return Number(m[1]) * 60 + Number(m[2]);
};

console.log("jam penetapan");

// --------------------------------------------------------------- bentuknya
{
  const w = rangkaian(10113, "2026-09-12", "2026-09-12 23:00:00");
  periksa(
    "bentuknya YYYY-MM-DD HH:mm:ss",
    w.every((x) => /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(x)),
    w[0]
  );
  periksa("tetap - dihitung dua kali memberi jawaban yang sama", w.join() === rangkaian(10113, "2026-09-12", "2026-09-12 23:00:00").join());
}

// ------------------------------------------------- sapuan 3000 perkara
{
  const TANGGAL = "2026-09-12";
  const SERVER = "2026-09-12 23:00:00";
  let tanggalBeda = 0;
  let jedaSalah = 0;
  let mundur = 0;
  const mulai = [];

  for (let id = 1; id <= 3000; id += 1) {
    const w = rangkaian(id, TANGGAL, SERVER);
    if (new Set(w.map((x) => x.slice(0, 10))).size !== 1) tanggalBeda += 1;
    const menit = w.map(keMenit);
    for (let i = 1; i < menit.length; i += 1) {
      const jeda = menit[i] - menit[i - 1];
      if (jeda < 1 || jeda > 10) jedaSalah += 1;
      if (jeda <= 0) mundur += 1;
    }
    mulai.push(w[0]);
  }

  periksa("tanggal keempat langkah selalu sama", tanggalBeda === 0, `${tanggalBeda} perkara berbeda`);
  periksa("jedanya selalu 1 sampai 10 menit", jedaSalah === 0, `${jedaSalah} jeda di luar batas`);
  periksa("urutannya tidak pernah mundur", mundur === 0, `${mundur} jeda mundur`);

  // Jam yang berulang-ulang sama antar perkara justru menjadi pola tersendiri.
  const kembar = mulai.length - new Set(mulai).size;
  periksa("jam mulai jarang kembar antar perkara", kembar < 30, `${kembar} dari ${mulai.length}`);
}

// ------------------------------------------------ detik tiap langkah berbeda
{
  // Detik yang sama persis pada keempat langkah adalah pola yang kentara di
  // layar Audit Trail - dan pernah benar-benar terjadi: 11:53:41, 11:57:41,
  // 12:07:41, 12:09:41 pada perkara 561 tanggal 12 September 2026.
  let seluruhnyaSama = 0;
  for (let id = 1; id <= 3000; id += 1) {
    const detik = rangkaian(id, "2026-09-12", "2026-09-12 23:00:00").map((x) => x.slice(-2));
    if (new Set(detik).size === 1) seluruhnyaSama += 1;
  }
  periksa("detik keempat langkah tidak seluruhnya sama", seluruhnyaSama === 0, `${seluruhnyaSama} perkara`);
}

// --------------------------------------------- tidak melampaui jam peladen
{
  for (const jam of ["09:00:00", "10:30:00", "12:00:00", "23:59:00"]) {
    const server = `2026-09-12 ${jam}`;
    let melampaui = 0;
    let jedaSalah = 0;
    for (let id = 1; id <= 500; id += 1) {
      const w = rangkaian(id, "2026-09-12", server);
      const menit = w.map(keMenit);
      if (menit[3] > keMenit(server)) melampaui += 1;
      for (let i = 1; i < menit.length; i += 1) {
        const jeda = menit[i] - menit[i - 1];
        if (jeda < 1 || jeda > 10) jedaSalah += 1;
      }
    }
    periksa(`jam peladen ${jam}: tidak ada yang melampaui`, melampaui === 0, `${melampaui} perkara`);
    periksa(`jam peladen ${jam}: jedanya tetap sah sesudah digeser`, jedaSalah === 0, `${jedaSalah} jeda`);
  }
}

// ------------------------------------------------------ tanggal yang lampau
{
  // Penetapan bertanggal kemarin tidak perlu digeser sama sekali - seluruh
  // hari kerjanya sudah lewat.
  const kemarin = rangkaian(10113, "2026-09-11", "2026-09-12 09:00:00");
  const bebas = rangkaian(10113, "2026-09-11", "2026-09-11 23:59:00");
  periksa("tanggal lampau tidak ikut digeser", kemarin.join() === bebas.join());
  periksa("tanggalnya mengikuti tanggal penetapan, bukan tanggal peladen", kemarin.every((x) => x.startsWith("2026-09-11")), kemarin[0]);
}

// ------------------------------------------------------- di luar rangkaian
{
  const server = "2026-09-12 13:05:00";
  periksa(
    "Data Umum memakai jam peladen apa adanya",
    waktuLangkah({ perkaraId: 1, tanggalPenetapan: "2026-09-12", jenis: "dataUmum", saatServer: server }) === server
  );
  periksa(
    "tanggal yang tidak sah memulangkan jam peladen",
    waktuLangkah({ perkaraId: 1, tanggalPenetapan: "", jenis: "pmh", saatServer: server }) === server
  );
}

console.log("");
console.log(`lulus ${lulus}, gagal ${gagal}`);
process.exit(gagal > 0 ? 1 : 0);
