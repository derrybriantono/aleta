#!/usr/bin/env node
"use strict";

/**
 * Membuktikan sidik sandi SIPP kita sama persis dengan milik SIPP sendiri.
 *
 *   node scripts/verify-sidik-sandi.js
 *
 * ============================================================================
 * DARI MANA ANGKA-ANGKA DI BAWAH INI BERASAL
 * ============================================================================
 *
 * Bukan dari hitungan sendiri. Kelimanya keluaran arr2md5() milik SIPP yang
 * SUNGGUHAN, dijalankan dengan PHP 5.6 di server pengadilan atas berkas
 * application/models/Login/validation_user.php yang sedang dipakai.
 *
 * Itu yang membuat pemeriksaan ini berarti: ia mengunci tiruan kita pada
 * perilaku aplikasi aslinya, bukan pada tafsiran kita atas rumusnya.
 *
 * ============================================================================
 * MENGAPA HARUS PERSIS
 * ============================================================================
 *
 * Sidik ini dipakai untuk menyatakan sebuah sandi SIPP masih berlaku atau
 * sudah basi, TANPA memasukinya. Tiruan yang meleset sedikit saja akan
 * menyatakan SELURUH sandi salah - dan pemakainya akan mengetik ulang sandi
 * yang sebenarnya sudah benar, berkali-kali, tanpa pernah berhasil. Kegagalan
 * seperti itu tidak menuduh dirinya sendiri; ia menuduh orang.
 *
 * Tidak menyentuh basis data sama sekali.
 */

const { sidikSandiSipp } = require("../services/sippReadOnlyBridgeService");

// [kode_aktivasi, sandi, hasil arr2md5() PHP SIPP di server]
const DARI_PHP_SIPP = [
  ["KODEAKTIF123", "rahasia", "2810c67ab2b67f4e9d351010f1014f3a"],
  ["", "sandi-tanpa-kode", "fff873524d7cd3a64ea771d71e03de1f"],
  ["9f8e7d6c5b4a3928", "P@ssw0rd!#$%", "c817605a77c0e2cb7a1d9a7ad3fdbd5e"],
  [
    "AbCdEf",
    "sandi panjang sekali dengan spasi dan simbol ~!@",
    "3994ac1f6bf54928f7122a50391e1dc8",
  ],
  ["0123456789abcdef0123456789abcdef", "x", "777aabb87d65e428fe7dfac979432fd3"],
];

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

function utama() {
  console.log("\nSidik sandi SIPP diadu dengan PHP aslinya\n");

  for (const [kode, sandi, diharap] of DARI_PHP_SIPP) {
    const dapat = sidikSandiSipp(kode, sandi);
    periksa(
      `kode ${JSON.stringify(kode)} sandi ${JSON.stringify(sandi)}`,
      dapat === diharap,
      `diharap ${diharap}, dapat ${dapat}`
    );
  }

  console.log("\nSifat yang harus dipenuhi\n");

  periksa(
    "beda satu huruf pada sandi menghasilkan sidik berbeda",
    sidikSandiSipp("KODEAKTIF123", "rahasia") !== sidikSandiSipp("KODEAKTIF123", "rahasib")
  );

  // Inilah sebabnya code_activation wajib ikut dibaca dari sys_users. Memakai
  // md5 sandi saja akan cocok untuk SEMUA orang yang sandinya kebetulan sama.
  periksa(
    "kode aktivasi ikut menentukan - sandi sama, kode beda, sidik beda",
    sidikSandiSipp("AAA", "rahasia") !== sidikSandiSipp("BBB", "rahasia")
  );

  // Baris sys_users lama kadang berkode aktivasi NULL. Yang penting jangan
  // melempar galat - jawabannya cukup "tidak cocok".
  let terlempar = false;
  let panjang = 0;
  try {
    panjang = sidikSandiSipp(null, undefined).length;
  } catch {
    terlempar = true;
  }
  periksa("nilai kosong dan tak disebut tidak melempar galat", terlempar === false);
  periksa("sidiknya tetap 32 huruf", panjang === 32);

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
}

utama();
