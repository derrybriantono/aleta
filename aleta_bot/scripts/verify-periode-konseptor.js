"use strict";

/**
 * Memeriksa batas periode beban konseptor - tanpa menyentuh basis data.
 *
 * Batas periode kelihatan sepele sampai ia salah: satu hari terlewat pada akhir
 * bulan berarti satu putusan tercatat pada bulan orang lain. Dan salahnya tidak
 * berbunyi - angkanya tetap keluar, hanya milik bulan yang keliru.
 *
 * Yang diperiksa hal-hal yang memang dapat salah:
 *   - akhir bulan pada bulan 28, 30 dan 31 hari, termasuk Februari kabisat
 *   - triwulan dan semester pada tanggal PERBATASANNYA, bukan di tengahnya
 *   - pekan yang dihitung Senin-Minggu, termasuk ketika acuannya hari Minggu
 *   - acuan yang tidak sah jatuh ke hari ini, bukan ke tahun 1970
 *
 * Jalankan: node scripts/verify-periode-konseptor.js
 */

const { rentangPeriode } = require("../services/penilaianKonseptorService");

let lulus = 0;
const gagal = [];

function periksa(nama, periode, acuan, dariHarap, sampaiHarap) {
  const hasil = rentangPeriode(periode, acuan);
  if (hasil.dari === dariHarap && hasil.sampai === sampaiHarap) {
    lulus += 1;
    return;
  }
  gagal.push(`${nama}\n     harap ${dariHarap} .. ${sampaiHarap}\n     dapat ${hasil.dari} .. ${hasil.sampai}`);
}

// ---------------------------------------------------------------- bulan
periksa("bulan 31 hari", "bulan", "2026-01-15", "2026-01-01", "2026-01-31");
periksa("bulan 30 hari", "bulan", "2026-04-07", "2026-04-01", "2026-04-30");
periksa("Februari biasa", "bulan", "2026-02-20", "2026-02-01", "2026-02-28");
periksa("Februari kabisat", "bulan", "2024-02-20", "2024-02-01", "2024-02-29");
periksa("hari pertama bulan", "bulan", "2026-08-01", "2026-08-01", "2026-08-31");
periksa("hari terakhir bulan", "bulan", "2026-08-31", "2026-08-01", "2026-08-31");

// ------------------------------------------------------------- triwulan
periksa("triwulan I awal", "triwulan", "2026-01-01", "2026-01-01", "2026-03-31");
periksa("triwulan I akhir", "triwulan", "2026-03-31", "2026-01-01", "2026-03-31");
periksa("triwulan II", "triwulan", "2026-04-01", "2026-04-01", "2026-06-30");
periksa("triwulan III", "triwulan", "2026-09-30", "2026-07-01", "2026-09-30");
periksa("triwulan IV", "triwulan", "2026-12-31", "2026-10-01", "2026-12-31");

// ------------------------------------------------------------- semester
periksa("semester I awal", "semester", "2026-01-01", "2026-01-01", "2026-06-30");
periksa("semester I akhir", "semester", "2026-06-30", "2026-01-01", "2026-06-30");
periksa("semester II awal", "semester", "2026-07-01", "2026-07-01", "2026-12-31");
periksa("semester II akhir", "semester", "2026-12-31", "2026-07-01", "2026-12-31");

// ---------------------------------------------------------------- tahun
periksa("tahun", "tahun", "2026-05-17", "2026-01-01", "2026-12-31");
periksa("tahun kabisat tetap 31 Des", "tahun", "2024-02-29", "2024-01-01", "2024-12-31");

// --------------------------------------------------------------- minggu
// 2026-09-17 jatuh Kamis; pekannya Senin 14 sampai Minggu 20.
periksa("pekan dari hari Kamis", "minggu", "2026-09-17", "2026-09-14", "2026-09-20");
periksa("pekan dari hari Senin", "minggu", "2026-09-14", "2026-09-14", "2026-09-20");
// Hari Minggu milik pekan yang BARU LEWAT, bukan pekan yang baru mulai -
// inilah yang paling sering keliru ketika Minggu diberi nomor nol.
periksa("pekan dari hari Minggu", "minggu", "2026-09-20", "2026-09-14", "2026-09-20");
periksa("pekan melintasi bulan", "minggu", "2026-10-01", "2026-09-28", "2026-10-04");
periksa("pekan melintasi tahun", "minggu", "2027-01-01", "2026-12-28", "2027-01-03");

// ---------------------------------------------------------------- total
periksa("total meliputi segalanya", "total", "2026-05-17", "1900-01-01", "2999-12-31");

// --------------------------------------------------------------- rentang
const bebas = rentangPeriode("rentang", "", "2026-03-04", "2026-05-06");
if (bebas.dari === "2026-03-04" && bebas.sampai === "2026-05-06") lulus += 1;
else gagal.push(`rentang bebas dipakai apa adanya - dapat ${bebas.dari} .. ${bebas.sampai}`);

// Acuan yang tidak sah harus jatuh ke HARI INI, bukan ke 1 Januari 1970.
const sekarang = new Date();
const tahunIni = sekarang.getFullYear();
const rusak = rentangPeriode("tahun", "bukan-tanggal");
if (rusak.dari === `${tahunIni}-01-01`) lulus += 1;
else gagal.push(`acuan rusak jatuh ke hari ini - dapat ${rusak.dari}`);

console.log(`\nperiode beban konseptor: ${lulus} lulus, ${gagal.length} gagal`);
for (const g of gagal) console.log(`  GAGAL ${g}`);
process.exit(gagal.length === 0 ? 0 : 1);
