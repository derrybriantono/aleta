#!/usr/bin/env node
"use strict";

/**
 * Membuktikan pemantauan antrian sidang online melaporkan keadaan APA ADANYA.
 *
 *   node scripts/verify-antrian-online-monitor.js
 *
 * Yang dijaga:
 *   - urutan nomor antrian sama dengan yang dibalas ke pihak,
 *   - perkara yang belum mendaftar tidak diberi nomor antrian,
 *   - basis data antrian putus dilaporkan sebagai putus, bukan "kosong".
 *
 * Yang terakhir itu paling penting: kalau koneksi mati lalu ditampilkan
 * sebagai daftar kosong, petugas akan mengira memang belum ada yang mendaftar
 * dan masalahnya baru ketahuan saat sidang.
 */
const externalDbService = require("../services/externalDbService");

let lulus = 0;
let gagal = 0;

function periksa(label, aktual, harapan) {
  const cocok = JSON.stringify(aktual) === JSON.stringify(harapan);
  if (cocok) {
    lulus += 1;
    console.log(`  OK    ${label}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${label}\n        harapan=${JSON.stringify(harapan)} aktual=${JSON.stringify(aktual)}`);
  }
}

// Jam pendaftaran datang dari SQL sudah berupa TEKS jam dinding WITA
// (DATE_FORMAT '%d/%m/%Y %H:%i'), bukan DATETIME. Mock ini menirunya.
const BARIS = [
  // Sudah mendaftar, paling awal.
  { nomor_perkara: "10/Pdt.G/2026/PA.Dgl", majelis_hakim_kode: "MJL-1", online: 1, pihak_1: "02/08/2026 08:00", pihak_2: null },
  // Sudah mendaftar, menyusul.
  { nomor_perkara: "11/Pdt.G/2026/PA.Dgl", majelis_hakim_kode: "MJL-1", online: 1, pihak_1: null, pihak_2: "02/08/2026 08:05" },
  // Kedua pihak mendaftar.
  { nomor_perkara: "12/Pdt.G/2026/PA.Dgl", majelis_hakim_kode: "MJL-2", online: 1, pihak_1: "02/08/2026 08:10", pihak_2: "02/08/2026 08:12" },
  // Belum ada yang mendaftar.
  { nomor_perkara: "13/Pdt.G/2026/PA.Dgl", majelis_hakim_kode: "MJL-2", online: 0, pihak_1: null, pihak_2: null },
];

const queryAsli = externalDbService.query;

async function jalankan() {
  const antrianOnlineService = require("../services/antrianOnlineService");

  console.log("\n== Basis data antrian terbaca ==");
  externalDbService.query = async () => BARIS;
  const sehat = await antrianOnlineService.getQueueMonitor({ limit: 50 });

  periksa("koneksi dilaporkan terjangkau", sehat.reachable, true);
  periksa("jumlah baris antrian", sehat.totals.sidangHariIni, 4);
  periksa("jumlah yang sudah ambil antrian", sehat.totals.sudahAmbilAntrian, 3);
  periksa("jumlah pihak 1 terdaftar", sehat.totals.pihak1, 2);
  periksa("jumlah pihak 2 terdaftar", sehat.totals.pihak2, 2);

  periksa(
    "nomor antrian berurutan hanya untuk yang sudah mendaftar",
    sehat.items.map((item) => item.nomorAntrian),
    [1, 2, 3, null]
  );
  periksa(
    "nomor perkara terbawa apa adanya",
    sehat.items.map((item) => item.nomorPerkara),
    ["10/Pdt.G/2026/PA.Dgl", "11/Pdt.G/2026/PA.Dgl", "12/Pdt.G/2026/PA.Dgl", "13/Pdt.G/2026/PA.Dgl"]
  );
  periksa("waktu daftar pihak 1 dibaca", Boolean(sehat.items[0].pihak1DaftarPada), true);
  // Inti perbaikan zona waktu: jam ditampilkan APA ADANYA, tidak digeser.
  periksa("jam pendaftaran tidak bergeser zona (apa adanya)", sehat.items[0].pihak1DaftarPada, "02/08/2026 08:00");
  periksa("yang belum daftar tidak diberi waktu", sehat.items[3].pihak1DaftarPada, null);
  periksa("perintah antrian ikut dilaporkan", sehat.commands.includes("daftar antrian"), true);
  periksa("tidak ada pesan galat saat sehat", sehat.error, "");

  console.log("\n== Basis data antrian putus ==");
  externalDbService.query = async () => {
    throw new Error("connect ECONNREFUSED 10.0.0.5:3306");
  };
  const putus = await antrianOnlineService.getQueueMonitor({ limit: 50 });

  // Inti: putus TIDAK BOLEH tampil sebagai "belum ada yang mendaftar".
  periksa("koneksi dilaporkan tidak terjangkau", putus.reachable, false);
  periksa("sebab kegagalan disebutkan", putus.error.includes("ECONNREFUSED"), true);
  periksa("daftar dikosongkan, bukan diisi angka palsu", putus.items.length, 0);
  periksa("ringkasan tidak mengarang jumlah", putus.totals.sidangHariIni, 0);

  console.log("\n== Antrian benar-benar kosong ==");
  externalDbService.query = async () => [];
  const kosong = await antrianOnlineService.getQueueMonitor({ limit: 50 });
  periksa("kosong tetap dilaporkan terjangkau", kosong.reachable, true);
  periksa("kosong tidak dianggap galat", kosong.error, "");
  periksa("jumlahnya nol", kosong.totals.sidangHariIni, 0);

  console.log("\n== Batas jumlah baris ==");
  let limitTerpakai = null;
  externalDbService.query = async (_kunci, _sql, params) => {
    limitTerpakai = params[0];
    return [];
  };
  await antrianOnlineService.getQueueMonitor({ limit: 9999 });
  periksa("limit dibatasi agar tidak membebani basis data", limitTerpakai, 500);
  await antrianOnlineService.getQueueMonitor({ limit: 0 });
  periksa("limit kosong memakai nilai bawaan", limitTerpakai, 100);
  await antrianOnlineService.getQueueMonitor({ limit: 5 });
  periksa("limit wajar dipakai apa adanya", limitTerpakai, 5);
  await antrianOnlineService.getQueueMonitor({ limit: -3 });
  periksa("limit negatif dinaikkan ke minimal 1", limitTerpakai, 1);

  externalDbService.query = queryAsli;

  console.log("\n== Monitor hanya menampilkan sidang HARI INI ==");
  {
    const sumber = require("fs").readFileSync(
      require("path").resolve(__dirname, "..", "services", "antrianOnlineService.js"),
      "utf8"
    );
    const monitor = sumber.slice(sumber.indexOf("async function getQueueMonitor"));
    const kueri = monitor.slice(0, monitor.indexOf("LIMIT ?"));

    // Tanpa penyaringan ini, panel menampilkan sisa antrian hari sebelumnya
    // pada hari yang tidak ada sidangnya - dan judul "PERKARA BERSIDANG"
    // membuat petugas membacanya sebagai jumlah sidang hari ini.
    periksa("monitor menyaring tanggal sidang", /perkara_jadwal_sidang/.test(kueri), true);
    periksa("memakai CURDATE server", /tanggal_sidang = CURDATE\(\)/.test(kueri), true);
    periksa(
      "memakai EXISTS supaya jadwal ganda tidak menggandakan baris",
      /EXISTS\s*\(/.test(kueri) && !/JOIN\s+SIPP\.perkara_jadwal_sidang/.test(kueri),
      true
    );
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
}

jalankan().catch((galat) => {
  externalDbService.query = queryAsli;
  console.error("Verifikasi gagal dijalankan:", galat && galat.message ? galat.message : galat);
  process.exit(2);
});
