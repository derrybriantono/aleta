#!/usr/bin/env node
"use strict";

/**
 * Membuktikan giliran adil bagi pegawai yang baru dilantik.
 *
 *   node scripts/verify-bagian-semestinya.js
 *
 * ============================================================================
 * MASALAH YANG DIUJI
 * ============================================================================
 *
 * Giliran yang memilih "paling sedikit perkaranya" MENGHUKUM pegawai baru: ia
 * mulai dari nol, jadi terpilih terus-menerus sampai menyusul rekannya. Pada
 * data PA Donggala yang berjalan, seorang panitera pengganti dilantik akhir
 * Agustus memegang 9 perkara sementara rekannya 46 sampai 111 - menyusulnya
 * berarti puluhan penunjukan beruntun dalam hitungan hari.
 *
 * Angka-angka di bawah ini disalin dari keadaan yang sungguhan, bukan
 * dikarang: Fikrianto (mulai 31 Agustus), Sitti Nurhidayah (29 Juni), dan
 * sembilan rekan yang bertugas sejak Januari.
 *
 * Tidak menyentuh basis data sama sekali.
 */

const { bagianSemestinya } = require("../services/penunjukanService");

let lulus = 0;
let gagal = 0;

function periksa(judul, benar, keterangan = "") {
  if (benar) {
    lulus += 1;
    console.log(`  LULUS  ${judul}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL  ${judul}${keterangan ? ` - ${keterangan}` : ""}`);
  }
}

// Keadaan PA Donggala pada 3 September 2026, disalin apa adanya.
const SEKARANG = "2026-09-03";
const AWAL = "2026-01-01";
const ORANG = [
  { id: 30, nama: "Fikrianto", mulai: "2026-08-31", jumlah: 9 },
  { id: 29, nama: "Sitti Nurhidayah", mulai: "2026-06-29", jumlah: 52 },
  { id: 23, nama: "Asrah Rachman", mulai: "2024-06-03", jumlah: 46 },
  { id: 12, nama: "Nuniek Widriyani", mulai: "2016-10-11", jumlah: 54 },
  { id: 22, nama: "Sri Wahyuni", mulai: "2023-10-23", jumlah: 59 },
  { id: 27, nama: "Mannaria", mulai: "2024-11-04", jumlah: 61 },
  { id: 26, nama: "Sri Susilowati", mulai: "2024-11-04", jumlah: 92 },
  { id: 21, nama: "Andini Puspita Sari", mulai: "2022-08-01", jumlah: 97 },
  { id: 18, nama: "Munifa", mulai: "2020-04-22", jumlah: 102 },
  { id: 28, nama: "Unun Fidiyasari Patangai", mulai: "2025-07-29", jumlah: 106 },
  { id: 20, nama: "Qadariyah", mulai: "2020-11-03", jumlah: 111 },
];

// Tanggal penetapan disebar merata sepanjang tahun sebanyak total perkaranya,
// supaya "berapa yang terjadi selama masa kerja seseorang" masuk akal.
function sebarTanggal(total, awal, akhir) {
  const mulai = new Date(`${awal}T00:00:00`).getTime();
  const habis = new Date(`${akhir}T00:00:00`).getTime();
  const keluar = [];
  for (let i = 0; i < total; i += 1) {
    const saat = new Date(mulai + ((habis - mulai) * i) / Math.max(1, total - 1));
    keluar.push(saat.toISOString().slice(0, 10));
  }
  return keluar;
}

const TOTAL = ORANG.reduce((s, x) => s + x.jumlah, 0);
const TANGGAL = sebarTanggal(TOTAL, AWAL, SEKARANG);

function hitung() {
  const peta = bagianSemestinya({
    orang: ORANG,
    tanggalPenetapan: TANGGAL,
    sekarang: SEKARANG,
    awalTahun: AWAL,
  });
  return ORANG.map((o) => ({ ...o, ...peta.get(o.id) })).sort((a, b) => a.selisih - b.selisih);
}

function utama() {
  console.log("\nBagian yang semestinya - keadaan PA Donggala 3 September 2026\n");
  const urut = hitung();

  console.log("  Urutan giliran (yang paling kurang dari bagiannya lebih dulu):");
  console.log("  " + "-".repeat(78));
  for (const x of urut) {
    console.log(
      "  " +
        String(x.nama).padEnd(26) +
        " punya " + String(x.jumlah).padStart(3) +
        " | semestinya " + String(Math.round(x.semestinya)).padStart(3) +
        " | selisih " + (x.selisih >= 0 ? "+" : "") + String(Math.round(x.selisih)).padStart(4) +
        " | bertugas " + String(x.hariBertugas).padStart(3) + " hari" +
        (x.baruBertugas ? "  (baru)" : "")
    );
  }
  console.log("");

  const fikrianto = urut.find((x) => x.nama === "Fikrianto");
  const sitti = urut.find((x) => x.nama === "Sitti Nurhidayah");
  const asrah = urut.find((x) => x.nama === "Asrah Rachman");
  const qadariyah = urut.find((x) => x.nama === "Qadariyah");

  console.log("Yang harus dipenuhi\n");

  // INI YANG PALING MENENTUKAN. Dengan aturan lama Fikrianto (9 perkara) selalu
  // menang atas Asrah (46) dan akan terpilih puluhan kali beruntun.
  periksa(
    "pegawai baru TIDAK lagi terpilih hanya karena jumlahnya paling sedikit",
    urut[0].nama !== "Fikrianto",
    `yang terpilih ${urut[0].nama}`
  );

  periksa(
    "pegawai baru dengan 9 perkara dalam 3 hari terbaca LEBIH dari bagiannya",
    fikrianto.selisih > 0,
    `selisih ${Math.round(fikrianto.selisih)}`
  );

  periksa(
    "bagian yang semestinya bagi pegawai baru jauh lebih kecil daripada rekan lama",
    fikrianto.semestinya < asrah.semestinya / 5,
    `${Math.round(fikrianto.semestinya)} vs ${Math.round(asrah.semestinya)}`
  );

  periksa(
    "yang paling kurang dari bagiannya didahulukan",
    urut[0].selisih <= urut[1].selisih,
    `${urut[0].nama} ${Math.round(urut[0].selisih)} vs ${urut[1].nama} ${Math.round(urut[1].selisih)}`
  );

  periksa(
    "yang paling banyak bebannya berada di urutan belakang",
    urut.indexOf(qadariyah) > urut.length / 2,
    `Qadariyah di urutan ${urut.indexOf(qadariyah) + 1}`
  );

  // Sitti masuk pertengahan tahun: bebannya TIDAK boleh dibandingkan dengan
  // rekan yang bertugas sejak Januari seolah masa kerjanya sama.
  periksa(
    "pegawai masuk pertengahan tahun dinilai atas masa kerjanya sendiri",
    sitti.semestinya < asrah.semestinya && sitti.hariBertugas < asrah.hariBertugas,
    `Sitti semestinya ${Math.round(sitti.semestinya)} (${sitti.hariBertugas} hari), Asrah ${Math.round(asrah.semestinya)} (${asrah.hariBertugas} hari)`
  );

  periksa(
    "pegawai lama ditandai bukan pegawai baru",
    asrah.baruBertugas === false && qadariyah.baruBertugas === false
  );

  periksa(
    "pegawai baru ditandai sebagai baru",
    fikrianto.baruBertugas === true && sitti.baruBertugas === true
  );

  console.log("\nKeadaan pinggir\n");

  const kosong = bagianSemestinya({ orang: [], tanggalPenetapan: [], sekarang: SEKARANG, awalTahun: AWAL });
  periksa("daftar kosong tidak melempar galat", kosong.size === 0);

  const tanpaMulai = bagianSemestinya({
    orang: [{ id: 1, jumlah: 5 }, { id: 2, mulai: null, jumlah: 5 }],
    tanggalPenetapan: TANGGAL,
    sekarang: SEKARANG,
    awalTahun: AWAL,
  });
  periksa(
    "tanggal mulai yang tidak diketahui diperlakukan sebagai sejak awal tahun",
    tanpaMulai.get(1).mulaiEfektif === AWAL && tanpaMulai.get(2).mulaiEfektif === AWAL
  );

  const barusaja = bagianSemestinya({
    orang: [{ id: 1, mulai: "2020-01-01", jumlah: 100 }, { id: 2, mulai: SEKARANG, jumlah: 0 }],
    tanggalPenetapan: TANGGAL,
    sekarang: SEKARANG,
    awalTahun: AWAL,
  });
  periksa(
    "yang mulai HARI INI tidak membuat pembagian nol",
    Number.isFinite(barusaja.get(2).semestinya) && barusaja.get(2).hariBertugas >= 1
  );

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
}

utama();
