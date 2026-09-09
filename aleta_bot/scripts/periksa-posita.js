"use strict";

/**
 * ============================================================================
 * MEMINDAI SELURUH POSITA DI SIPP - MEMBACA SAJA, TIDAK MENULIS
 * ============================================================================
 *
 * Kita baru memeriksa SATU perkara. Dua hal yang belum diketahui:
 *
 *   1. Versi perapian yang cacat sempat MENULIS ke SIPP sebelum diperbaiki.
 *      Perkara 510/Pdt.G/2026/PA.Dgl terbukti rusak - "6 bula\n n. Sejak" dan
 *      "Usia 5 tahu\n n. Saat ini". Tidak ada yang tahu perkara lain ditekan
 *      Terapkan atau tidak.
 *
 *   2. Posita yang tidak punya pemisah sama sekali akan tercetak menempel di
 *      Word, dan itu BUKAN buatan siapa pun - itu cara positanya diketik
 *      sejak awal. Diukur: 6.269 dari 8.097 posita memakai </p> dan tercetak
 *      rapi; sisanya belum tentu.
 *
 * Skrip ini menjawab keduanya sekaligus, dan hanya dengan SELECT. Tidak ada
 * satu pun UPDATE di berkas ini - yang memperbaiki tetap petugas, satu per
 * satu, lewat panel, dengan pratinjau di depan matanya.
 *
 * ============================================================================
 * CARA MENJALANKAN
 * ============================================================================
 *
 *   docker exec aleta-bot node scripts/periksa-posita.js
 *
 * Batas bawaan seluruh perkara yang positanya terisi. Untuk mencoba lebih
 * dulu pada sebagian:
 *
 *   docker exec aleta-bot node scripts/periksa-posita.js --batas=200
 *
 * Keluarannya tiga golongan, dan ketiganya berbeda cara memperbaikinya -
 * lihat catatan di periksaPosita().
 */

const db = require("../db_config");
const { periksaPosita } = require("../services/sippPositaService");

function runQuery(sql, params) {
  return new Promise((resolve, reject) => {
    db.query(sql, params || [], (error, hasil) => {
      if (error) reject(error);
      else resolve(hasil);
    });
  });
}

function angkaArgumen(nama, bawaan) {
  const cocok = process.argv.find((x) => x.startsWith(`--${nama}=`));
  if (!cocok) return bawaan;
  const nilai = Number(cocok.split("=")[1]);
  return Number.isFinite(nilai) && nilai > 0 ? nilai : bawaan;
}

async function utama() {
  const batas = angkaArgumen("batas", 0);

  // Hanya yang positanya terisi. Yang kosong bukan keadaan yang dirapikan -
  // ia keadaan yang diisi, dan mengisinya bukan pekerjaan perapian.
  const baris = await runQuery(
    `SELECT p.perkara_id AS perkaraId, p.nomor_perkara AS nomorPerkara, p.posita AS posita
       FROM perkara p
      WHERE p.posita IS NOT NULL AND TRIM(p.posita) <> ''
      ORDER BY p.perkara_id DESC
      ${batas ? "LIMIT " + batas : ""}`
  );

  const pasti = [];
  const ragu = [];
  const menempel = [];

  for (const satu of baris) {
    const hasil = periksaPosita(satu.posita);
    const kepala = { nomor: satu.nomorPerkara, id: satu.perkaraId };

    if (hasil.pecahanPasti.length > 0) {
      pasti.push({ ...kepala, temuan: hasil.pecahanPasti });
    }
    if (hasil.pecahanRagu.length > 0) {
      ragu.push({ ...kepala, temuan: hasil.pecahanRagu });
    }
    if (hasil.tanpaPemisah) {
      menempel.push(kepala);
    }
  }

  console.log("");
  console.log(`Diperiksa ${baris.length} posita yang terisi.`);
  console.log("");

  // ── 1. Kata terpecah, hampir pasti ────────────────────────────────────────
  console.log(`1. KATA TERPECAH (huruf g-z) — ${pasti.length} perkara`);
  console.log("   Disambung sendiri oleh perapian. Tekan Rapikan lalu Terapkan.");
  if (pasti.length === 0) console.log("   (tidak ada)");
  for (const satu of pasti) {
    console.log(`   ${satu.nomor}`);
    for (const t of satu.temuan) console.log(`     "${t.sambungan}"  ->  huruf ${t.huruf}`);
  }
  console.log("");

  // ── 2. Ragu: bentuknya sama, hurufnya a-f ─────────────────────────────────
  console.log(`2. PERLU DIPERIKSA MANUSIA (huruf a-f) — ${ragu.length} perkara`);
  console.log("   Tidak dapat dibedakan dari penanda butir tanpa kamus. Yang");
  console.log('   menentukan: apakah "sambungan" di bawah kata yang utuh.');
  console.log('   "tahun" utuh -> pecahan. "karenaa" tidak -> penanda butir.');
  if (ragu.length === 0) console.log("   (tidak ada)");
  for (const satu of ragu) {
    console.log(`   ${satu.nomor}`);
    for (const t of satu.temuan) {
      console.log(`     "${t.sambungan}"  ->  huruf ${t.huruf}`);
      console.log(`       ${t.konteks}`);
    }
  }
  console.log("");

  // ── 3. Tidak punya pemisah sama sekali ────────────────────────────────────
  console.log(`3. AKAN TERCETAK MENEMPEL — ${menempel.length} perkara`);
  console.log("   Tidak ada </p>, <br>, maupun <div>. Bukan kerusakan buatan");
  console.log("   siapa pun - begitulah positanya diketik. Perapian memberinya");
  console.log("   pemisah tanpa mengubah satu huruf pun.");
  if (menempel.length === 0) console.log("   (tidak ada)");
  for (const satu of menempel) console.log(`   ${satu.nomor}`);
  console.log("");

  console.log("Tidak ada yang diubah oleh skrip ini.");
}

utama()
  .then(() => process.exit(0))
  .catch((galat) => {
    console.error("GAGAL:", galat.message || galat);
    process.exit(1);
  });
