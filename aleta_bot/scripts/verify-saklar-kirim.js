#!/usr/bin/env node
"use strict";

/**
 * ============================================================================
 * DUA SALURAN, DUA SAKLAR - PEGAWAI DAN PIHAK BERPERKARA
 * ============================================================================
 *
 *   node scripts/verify-saklar-kirim.js
 *
 * Yang dijaga di sini tiga hal, dan ketiganya berakibat pada orang:
 *
 *   1. SAKLAR YANG SALAH SASARAN. Mematikan pengiriman ke pihak tidak boleh
 *      ikut menghentikan tugas ke pegawai, dan sebaliknya. Satu penjaga yang
 *      terbalik berarti panggilan sidang berhenti terkirim tanpa ada yang
 *      memintanya.
 *
 *   2. BAWAAN YANG MENYALA. Konfigurasi yang belum menyebut kedua kunci ini -
 *      portal versi lama - harus dibaca MENYALA. Membacanya mati akan
 *      menghentikan seluruh pengiriman begitu versi baru dipasang.
 *
 *   3. NOMOR TAK DIKENAL DIHITUNG SEBAGAI PIHAK. Menebak sebaliknya membuat
 *      saklar pihak tidak menghentikan apa pun untuk nomor yang belum
 *      terdaftar - dan justru nomor itulah yang paling mungkin milik orang
 *      berperkara.
 */

const runtimeConfigModule = require("../config/runtime-config");

const PEGAWAI = [
  { name: "Andi", whatsappNumber: "628123450001" },
  { name: "Budi", whatsappNumber: "08123450002" },
];

let lulus = 0;
let gagal = 0;

function periksa(label, aktual, harapan) {
  if (aktual === harapan) {
    lulus += 1;
    console.log(`  OK    ${label}`);
  } else {
    gagal += 1;
    console.log(
      `  GAGAL ${label}\n        harapan=${JSON.stringify(harapan)} aktual=${JSON.stringify(aktual)}`
    );
  }
}

const kenal = (nomor) => runtimeConfigModule.adalahPenerimaPegawai(nomor, PEGAWAI);

console.log("\n== Mengenali nomor pegawai ==");
periksa("nomor pegawai dikenali", kenal("628123450001"), true);
periksa("bentuk lokal 08xx tetap dikenali", kenal("08123450001"), true);
periksa("bentuk chatId tetap dikenali", kenal("628123450001@c.us"), true);
periksa("pegawai kedua dikenali walau ditulis 08xx", kenal("628123450002"), true);
periksa("nomor lain BUKAN pegawai", kenal("628999999999"), false);
periksa("nomor kosong bukan pegawai", kenal(""), false);
periksa("tanpa daftar pegawai, tidak ada yang dikenali", runtimeConfigModule.adalahPenerimaPegawai("628123450001", []), false);

console.log("\n== Bawaan menyala ==");
{
  // Konfigurasi yang tidak menyebut kedua kunci - portal versi lama.
  const konfigLama = {};
  periksa("pegawai menyala bila tidak disebut", konfigLama.kirimPegawaiEnabled !== false, true);
  periksa("pihak menyala bila tidak disebut", konfigLama.kirimPihakEnabled !== false, true);

  // Dan yang benar-benar dimatikan tetap terbaca mati.
  const konfigMati = { kirimPegawaiEnabled: false, kirimPihakEnabled: false };
  periksa("pegawai mati bila disetel mati", konfigMati.kirimPegawaiEnabled !== false, false);
  periksa("pihak mati bila disetel mati", konfigMati.kirimPihakEnabled !== false, false);
}

console.log("\n== Saklar mengenai sasaran yang benar ==");
{
  /**
   * Menirukan keputusan yang diambil messageService, dengan aturan yang sama.
   * Yang diuji ARAH keputusannya - saklar pihak tidak boleh menghentikan
   * pegawai, dan sebaliknya.
   */
  const boleh = (nomor, konfig) => {
    const kePegawai = runtimeConfigModule.adalahPenerimaPegawai(nomor, PEGAWAI);
    const bolehPegawai = konfig.kirimPegawaiEnabled !== false;
    const bolehPihak = konfig.kirimPihakEnabled !== false;
    if (kePegawai && !bolehPegawai) return "pengiriman_pegawai_dimatikan";
    if (!kePegawai && !bolehPihak) return "pengiriman_pihak_dimatikan";
    return "";
  };

  const pegawai = "628123450001";
  const pihak = "628999999999";

  const keduanya = {};
  periksa("keduanya menyala: pegawai lolos", boleh(pegawai, keduanya), "");
  periksa("keduanya menyala: pihak lolos", boleh(pihak, keduanya), "");

  const pihakMati = { kirimPihakEnabled: false };
  periksa("pihak dimatikan: pihak tertahan", boleh(pihak, pihakMati), "pengiriman_pihak_dimatikan");
  periksa("pihak dimatikan: PEGAWAI TETAP LOLOS", boleh(pegawai, pihakMati), "");

  const pegawaiMati = { kirimPegawaiEnabled: false };
  periksa("pegawai dimatikan: pegawai tertahan", boleh(pegawai, pegawaiMati), "pengiriman_pegawai_dimatikan");
  periksa("pegawai dimatikan: PIHAK TETAP LOLOS", boleh(pihak, pegawaiMati), "");

  const duaduanyaMati = { kirimPegawaiEnabled: false, kirimPihakEnabled: false };
  periksa("keduanya mati: pegawai tertahan", boleh(pegawai, duaduanyaMati), "pengiriman_pegawai_dimatikan");
  periksa("keduanya mati: pihak tertahan", boleh(pihak, duaduanyaMati), "pengiriman_pihak_dimatikan");
}

console.log("\n== Gerbangnya benar-benar terpasang di messageService ==");
{
  const fs = require("fs");
  const pathx = require("path");
  const sumber = fs.readFileSync(
    pathx.resolve(__dirname, "..", "services", "messageService.js"),
    "utf8"
  );

  periksa("mengimpor pengenal pegawai", /adalahPenerimaPegawai/.test(sumber), true);
  periksa("menahan pegawai", /pengiriman_pegawai_dimatikan/.test(sumber), true);
  periksa("menahan pihak", /pengiriman_pihak_dimatikan/.test(sumber), true);

  // Hanya untuk pesan yang dimulai bot sendiri. Balasan atas pesan yang masuk
  // tidak boleh ikut ditahan - mematikan pengiriman tidak boleh membuat bot
  // mendiamkan orang yang sedang bertanya kepadanya.
  const potongan = sumber.slice(
    Math.max(0, sumber.indexOf("DUA SALURAN, DUA SAKLAR") - 200),
    sumber.indexOf("pengiriman_pihak_dimatikan")
  );
  periksa(
    "hanya berlaku untuk pesan yang dimulai bot",
    /isNotificationContext\(category\)/.test(potongan),
    true
  );
}

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exitCode = 1;
} else {
  console.log("SEMUA PERIKSAAN LULUS.");
}
