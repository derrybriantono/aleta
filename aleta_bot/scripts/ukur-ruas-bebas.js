#!/usr/bin/env node
"use strict";

/**
 * ============================================================================
 * MENJALANKAN PENGUKUR RUAS TEKS BEBAS
 * ============================================================================
 *
 * Naskah tipis: seluruh kuerinya ada di services/ukurRuasBebasService.js supaya
 * ikut dipindai kedua penjaga baca-saja. Naskah di dalam scripts/ TIDAK
 * dipindai - itu disengaja, sebab naskah penjaga memang menuliskan contoh kueri
 * yang salah untuk menguji penolakannya. Maka kueri sungguhan tidak boleh
 * tinggal di sini.
 *
 * MENUNTUT SAMBUNGAN SIPP. Di mesin pengembang ia akan gagal, dan itu bukan
 * tanda ada yang salah. Jalankan di server:
 *
 *   docker compose exec aleta_bot node scripts/ukur-ruas-bebas.js
 *
 * Hasilnya ditulis ke reports/ukuran-ruas-bebas.json dan diringkas ke layar.
 * Berkas itulah yang dibaca manusia untuk menyusun tabel pemetaan - bukan
 * ditebak dari ingatan.
 */

const fs = require("fs");
const path = require("path");

const layanan = require("../services/ukurRuasBebasService");

function angka(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function persen(atas, bawah) {
  if (!bawah) return "—";
  return ((atas / bawah) * 100).toFixed(1) + "%";
}

function baris(x) {
  return Array.isArray(x) ? x : [];
}

function ringkasSatu(r) {
  console.log("");
  console.log(`== ${r.label} (${r.tabel}) ==`);
  console.log(`   dipakai: ${r.dipakaiOleh}`);
  if (r.galat) {
    console.log(`   GAGAL DIUKUR: ${r.galat}`);
    return;
  }
  const u = r.ukuran || {};
  const j = baris(u.jumlah)[0] || {};
  const semua = angka(j.semua);
  const terisi = angka(j.terisi);
  const berbeda = angka(j.berbeda);

  console.log(`   baris        : ${semua.toLocaleString("id-ID")}`);
  console.log(`   terisi       : ${terisi.toLocaleString("id-ID")} (${persen(terisi, semua)})`);
  console.log(`   tulisan beda : ${berbeda.toLocaleString("id-ID")}`);

  if (r.kunci === "kecamatan") {
    const cocok = angka((baris(u.cocok)[0] || {}).cocok);
    const acuan = angka((baris(u.acuan)[0] || {}).jumlah);
    console.log(`   acuan SIPP   : ref_kecamatan_new berisi ${acuan} baris`);
    console.log(`   cocok acuan  : ${cocok.toLocaleString("id-ID")} dari ${terisi.toLocaleString("id-ID")} (${persen(cocok, terisi)})`);
    const tidak = baris(u.tidakCocok);
    console.log(`   TIDAK cocok  : ${tidak.length} tulisan teratas`);
    tidak.slice(0, 15).forEach((x) => console.log(`      ${String(x.nilai).padEnd(28)} ${angka(x.jumlah).toLocaleString("id-ID")}`));
    if (!tidak.length) {
      console.log("      (tidak ada - seluruh isian cocok dengan acuan SIPP)");
    }
    return;
  }

  const sering = baris(u.sering);
  console.log(`   tiga puluh tulisan tersering:`);
  sering.forEach((x) => {
    const jenis = x.jenis !== undefined ? ` [jenis ${x.jenis}]` : "";
    console.log(`      ${String(x.nilai).slice(0, 46).padEnd(48)} ${angka(x.jumlah).toLocaleString("id-ID")}${jenis}`);
  });

  // Ekornya yang menentukan berat-ringannya perapian, bukan puncaknya.
  const teratas = sering.reduce((s, x) => s + angka(x.jumlah), 0);
  if (terisi) {
    console.log(`   tiga puluh teratas menutupi ${persen(teratas, terisi)} dari isian`);
    console.log(`   sisanya ${(berbeda - sering.length).toLocaleString("id-ID")} tulisan lain menutupi ${persen(terisi - teratas, terisi)}`);
  }
}

async function utama() {
  console.log("");
  console.log("Mengukur enam ruas teks bebas pada SIPP. Membaca saja.");

  let hasil;
  try {
    hasil = await layanan.ukurSemua();
  } catch (galat) {
    console.error("");
    console.error("Tidak dapat mengukur:", String(galat.message || galat));
    console.error("Naskah ini menuntut sambungan SIPP. Jalankan di server:");
    console.error("  docker compose exec aleta_bot node scripts/ukur-ruas-bebas.js");
    process.exit(2);
  }

  hasil.ruas.forEach(ringkasSatu);

  const gagal = hasil.ruas.filter((r) => r.galat);
  const folder = path.resolve(__dirname, "..", "reports");
  fs.mkdirSync(folder, { recursive: true });
  const jalur = path.join(folder, "ukuran-ruas-bebas.json");
  fs.writeFileSync(jalur, JSON.stringify(hasil, null, 2) + "\n", "utf8");

  console.log("");
  console.log(`Laporan lengkap: ${path.relative(path.resolve(__dirname, ".."), jalur)}`);
  console.log("");
  console.log("Langkah berikutnya BUKAN menulis kode, melainkan membaca daftar itu");
  console.log("bersama petugas kepaniteraan lalu menyusun tabel pemetaannya. Pemetaan");
  console.log("yang disusun tanpa membaca daftarnya akan memetakan yang tidak ada dan");
  console.log("meninggalkan yang ada.");

  if (gagal.length) {
    console.log("");
    console.log(`${gagal.length} ruas gagal diukur:`);
    gagal.forEach((r) => console.log(`  ${r.kunci}: ${r.galat}`));
    process.exit(1);
  }
  process.exit(0);
}

utama().catch((galat) => {
  console.error(galat);
  process.exit(1);
});
