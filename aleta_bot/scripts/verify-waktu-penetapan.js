"use strict";

/**
 * ============================================================================
 * JAM YANG DICATAT PADA TIAP LANGKAH PENETAPAN - DIUKUR SAMPAI DETIK
 * ============================================================================
 *
 * Keempat penetapan ditulis oleh satu tekanan tombol, dalam hitungan detik.
 * Dicatat apa adanya, tab Riwayat Perkara memperlihatkan PMH, PPP, PJS, dan
 * PHS terjadi pada detik yang berdempetan - padahal keempatnya empat keputusan
 * yang berbeda.
 *
 * Yang dijaga di sini, dan ketiganya pernah dilanggar oleh rancangan yang
 * mendahuluinya:
 *
 *   1. Tanggalnya SELALU sama untuk keempat langkah.
 *   2. Selisih NYATA antar langkah 60 sampai 659 detik, menaik menurut urutan
 *      langkah. Bentuk sebelumnya hanya menjaga angka MENITNYA: PPP 12:13:34
 *      disusul PJS 12:14:08 lolos sebagai "satu menit" padahal 34 detik.
 *   3. Tidak pernah melampaui jam peladen - SAMPAI DETIKNYA. Sebelumnya PHS
 *      dipatok pada menit peladen dengan detik bebas, sehingga pada 09:00:00
 *      PHS dapat tercatat 09:00:21.
 *   4. Dua perkara pada hari yang sama tidak jatuh pada jam yang sama.
 *   5. Rangkaian yang digeser (pagi hari) DISEBAR antar perkara, bukan
 *      ditumpuk pada menit peladen: delapan dari sepuluh PHS pada menit 09:00
 *      yang sama adalah pola mesin pada penetapan massal.
 *   6. MONOTON terhadap jam peladen: keempat langkah dihitung pada empat
 *      panggilan HTTP yang berselang beberapa detik, dan panggilan yang
 *      belakangan tidak boleh menghasilkan jam yang lebih awal.
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
const JEDA_MIN = 60;
const JEDA_MAKS = 10 * 60 + 59;

function rangkaian(perkaraId, tanggal, server, didaftar) {
  return URUT.map((jenis) =>
    waktuLangkah({ perkaraId, tanggalPenetapan: tanggal, jenis, saatServer: server, didaftar })
  );
}
/** Detik sejak tengah malam. */
const keDetik = (teks) => {
  const m = /(\d{2}):(\d{2}):(\d{2})$/.exec(teks);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
};
function jedaSalah(w) {
  const d = w.map(keDetik);
  let salah = 0;
  for (let i = 1; i < d.length; i += 1) {
    const jeda = d[i] - d[i - 1];
    if (jeda < JEDA_MIN || jeda > JEDA_MAKS) salah += 1;
  }
  return salah;
}

console.log("jam penetapan (detik)");

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
  let salah = 0;
  let mundur = 0;
  let sebelumJamKerja = 0;
  const mulai = [];

  for (let id = 1; id <= 3000; id += 1) {
    const w = rangkaian(id, TANGGAL, SERVER);
    if (new Set(w.map((x) => x.slice(0, 10))).size !== 1) tanggalBeda += 1;
    salah += jedaSalah(w);
    const d = w.map(keDetik);
    for (let i = 1; i < d.length; i += 1) if (d[i] <= d[i - 1]) mundur += 1;
    if (d[0] < 8 * 3600) sebelumJamKerja += 1;
    mulai.push(w[0]);
  }

  periksa("tanggal keempat langkah selalu sama", tanggalBeda === 0, `${tanggalBeda} perkara berbeda`);
  periksa("selisih nyata selalu 60 sampai 659 detik", salah === 0, `${salah} jeda di luar batas`);
  periksa("urutannya tidak pernah mundur, sampai ke detik", mundur === 0, `${mundur} jeda mundur`);
  periksa("tanpa geseran, PMH tidak pernah sebelum 08:00", sebelumJamKerja === 0, `${sebelumJamKerja} perkara`);

  // Jam yang berulang-ulang sama antar perkara justru menjadi pola tersendiri.
  const kembar = mulai.length - new Set(mulai).size;
  periksa("jam mulai jarang kembar antar perkara", kembar < 30, `${kembar} dari ${mulai.length}`);
}

// --------------------------------------------- tidak melampaui jam peladen
{
  for (const jam of ["09:00:00", "10:30:00", "12:00:00", "23:59:00"]) {
    const server = `2026-09-12 ${jam}`;
    let melampaui = 0;
    let salah = 0;
    for (let id = 1; id <= 500; id += 1) {
      const w = rangkaian(id, "2026-09-12", server);
      // Perbandingan teks sah: bentuknya tetap dan tanggalnya sama.
      if (w[3] > server) melampaui += 1;
      salah += jedaSalah(w);
    }
    periksa(`jam peladen ${jam}: tidak ada yang melampaui, sampai detiknya`, melampaui === 0, `${melampaui} perkara`);
    periksa(`jam peladen ${jam}: jedanya tetap 60-659 detik sesudah digeser`, salah === 0, `${salah} jeda`);
  }
}

// ---------------------------------------------- geseran disebar antar perkara
{
  // Dua puluh lima perkara pada jam peladen 09:00 - ukuran satu penetapan
  // massal. Sebelumnya: seluruh PHS pada menit 09:00. Kini tersebar di
  // antara 08:00 dan 09:00, tanpa satu pun sebelum jam kerja.
  const server = "2026-09-12 09:00:00";
  const phs = [];
  let sebelumJamKerja = 0;
  for (let id = 10101; id <= 10125; id += 1) {
    const w = rangkaian(id, "2026-09-12", server);
    phs.push(w[3]);
    if (keDetik(w[0]) < 8 * 3600) sebelumJamKerja += 1;
  }
  const menitPhs = new Set(phs.map((x) => x.slice(11, 16)));
  const padaMenitPeladen = phs.filter((x) => x.slice(11, 16) === "09:00").length;
  periksa("25 perkara pukul 09:00: PHS tersebar pada banyak menit", menitPhs.size >= 12, `${menitPhs.size} menit berbeda`);
  periksa("25 perkara pukul 09:00: tidak semuanya di menit 09:00", padaMenitPeladen <= 5, `${padaMenitPeladen} di 09:00`);
  periksa("25 perkara pukul 09:00: detik PHS tidak ada yang kembar", new Set(phs).size === phs.length);
  periksa("geseran tidak melempar PMH ke sebelum 08:00", sebelumJamKerja === 0, `${sebelumJamKerja} perkara`);
}

// ------------------------------------- monoton terhadap jam peladen per panggilan
{
  // Empat panggilan HTTP, empat detik berselang - persis cara rantainya
  // berjalan. Yang dijaga: jam langkah berikutnya tetap lebih belakangan
  // dari langkah sebelumnya sekurang-kurangnya 60 detik, walau tiap langkah
  // dihitung dengan jam peladen yang berbeda.
  let mundur = 0;
  let sempit = 0;
  for (let id = 1; id <= 500; id += 1) {
    for (const dasar of [9 * 3600, 8 * 3600 + 20 * 60, 11 * 3600 + 30 * 60]) {
      const jam = URUT.map((jenis, i) => {
        const s = dasar + i * 4;
        const server = `2026-09-12 ${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
        return keDetik(waktuLangkah({ perkaraId: id, tanggalPenetapan: "2026-09-12", jenis, saatServer: server }));
      });
      for (let i = 1; i < jam.length; i += 1) {
        if (jam[i] <= jam[i - 1]) mundur += 1;
        else if (jam[i] - jam[i - 1] < JEDA_MIN) sempit += 1;
      }
    }
  }
  periksa("panggilan berselang: tidak pernah mundur", mundur === 0, `${mundur} langkah`);
  periksa("panggilan berselang: selisih tetap sekurang-kurangnya 60 detik", sempit === 0, `${sempit} langkah`);
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

// ------------------------------------------- tidak mendahului pendaftaran
//
// Aturan yang paling dasar dan yang paling lama dilanggar: penetapan majelis
// dikerjakan SESUDAH kasir menyelesaikan Pendaftaran Perkara. Diukur pada 825
// perkara 2026 di peladen, nol yang mendahului; diukur pada sepuluh perkara
// uji ALETA, SATU yang mendahului - perkara 571, didaftarkan 09:34 dan
// penetapannya tercatat 08:27:40.
//
// Ini bukan kejanggalan di dalam basis data: tab Riwayat Perkara mengurut
// menurut tanggal, sehingga barisnya duduk di atas baris pendaftarannya.
{
  const takMendahului = (w, batas) => w.every((x) => x.slice(11) >= batas);
  const menaik = (w) => w.every((x, i) => i === 0 || x >= w[i - 1]);

  // Perkara 571 yang dahulu melanggar.
  const w571 = rangkaian(10123, "2026-09-16", "2026-09-16 13:46:00", "2026-09-16 09:34:00");
  periksa("didaftarkan 09:34: tidak satu pun sebelum 09:34", takMendahului(w571, "09:34:00"), w571.join(" "));
  periksa("didaftarkan 09:34: PMH sekurangnya 09:44", w571[0].slice(11) >= "09:44:00", w571[0]);

  // Perkara 600 di layar SIPP: kasir 13:32:33, penetapan sore itu juga.
  const w600 = rangkaian(10150, "2026-09-16", "2026-09-16 16:00:00", "2026-09-16 13:32:33");
  periksa("didaftarkan 13:32: tidak satu pun sebelum 13:32", takMendahului(w600, "13:32:33"), w600.join(" "));
  periksa("didaftarkan 13:32: urutannya tetap menaik", menaik(w600), w600.join(" "));

  // Didaftarkan sore, jendela lama sudah lewat seluruhnya.
  const wSore = rangkaian(10151, "2026-09-16", "2026-09-16 17:30:00", "2026-09-16 15:30:00");
  periksa("didaftarkan 15:30: tidak satu pun sebelum 15:30", takMendahului(wSore, "15:30:00"), wSore.join(" "));
  periksa("didaftarkan 15:30: tidak melampaui jam peladen", wSore.every((x) => x.slice(11) <= "17:30:00"), wSore.join(" "));

  // Baru saja didaftarkan - selanya tiga menit, rangkaiannya dirapatkan.
  const wSempit = rangkaian(10152, "2026-09-16", "2026-09-16 10:15:00", "2026-09-16 10:00:00");
  periksa("sela tiga menit: tidak satu pun sebelum pendaftaran", takMendahului(wSempit, "10:00:00"), wSempit.join(" "));
  periksa("sela tiga menit: tidak melampaui jam peladen", wSempit.every((x) => x.slice(11) <= "10:15:00"), wSempit.join(" "));
  periksa("sela tiga menit: urutannya tetap menaik", menaik(wSempit), wSempit.join(" "));

  // Didaftarkan kemarin - lantainya tetap 08:00, perilakunya tidak berubah.
  const wKemarin = rangkaian(10153, "2026-09-16", "2026-09-16 13:00:00", "2026-09-15 14:00:00");
  const wTanpa = rangkaian(10153, "2026-09-16", "2026-09-16 13:00:00");
  periksa("didaftarkan kemarin: sama persis dengan tanpa pendaftaran", wKemarin.join() === wTanpa.join(), wKemarin.join(" "));

  // Obyek Date dari penggerak mysql, bukan teks.
  const wDate = rangkaian(10123, "2026-09-16", "2026-09-16 13:46:00", new Date(2026, 8, 16, 9, 34, 0));
  periksa("pendaftaran berbentuk Date ikut menahan", takMendahului(wDate, "09:34:00"), wDate.join(" "));

  // Lima puluh perkara, lima jam pendaftaran - tidak satu pun yang melanggar.
  let melanggar = 0;
  for (const jam of ["07:15:00", "09:34:00", "11:05:00", "13:32:33", "15:30:00"]) {
    for (let id = 10100; id < 10150; id += 1) {
      const w = rangkaian(id, "2026-09-16", "2026-09-16 16:45:00", `2026-09-16 ${jam}`);
      if (!takMendahului(w, jam) || !menaik(w)) melanggar += 1;
    }
  }
  periksa("250 rangkaian: nol yang mendahului pendaftarannya", melanggar === 0, `melanggar ${melanggar}`);
}

console.log("");
console.log(`lulus ${lulus}, gagal ${gagal}`);
process.exit(gagal > 0 ? 1 : 0);
