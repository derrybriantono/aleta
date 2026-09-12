"use strict";

/**
 * ============================================================================
 * MEMASUKKAN TANDA TANGAN DARI BERKAS .doc KE BASIS DATA ALETA
 * ============================================================================
 *
 *     node scripts/impor-tanda-tangan.js "D:/.../TTD ALL TERBARU.doc" [nama-operator]
 *
 * Seluruhnya masuk dalam keadaan BELUM DISAHKAN dan tidak dapat dipakai
 * membubuhkan apa pun sampai seseorang membuka gambarnya, menuliskan nama
 * pemiliknya, lalu mengesahkannya.
 *
 * Itu bukan kehati-hatian yang berlebihan: pengukiran gambarnya kasar - ia
 * menyapu bita mencari tanda berkas PNG dan JPEG - dan urutan gambar di dalam
 * wadah .doc tidak harus sama dengan urutan nama di dalam teksnya. Tanda tangan
 * yang terpasang pada nama yang keliru adalah tanda tangan palsu pada penetapan
 * pengadilan, dan tidak ada satu galat pun yang akan berbunyi.
 *
 * Nama bergelar yang terbaca di dalam .doc yang sama ikut dicetak - sebagai
 * DAFTAR PILIHAN bagi yang menamai, bukan sebagai pasangan gambarnya.
 */

const fs = require("node:fs");
const path = require("node:path");

const tandaTanganService = require("../services/tandaTanganService");

async function utama() {
  const berkas = process.argv[2];
  const oleh = process.argv[3] || "";

  if (!berkas) {
    console.error("Sebutkan berkas .doc-nya.");
    console.error('  node scripts/impor-tanda-tangan.js "D:/.../TTD ALL.doc" "SUPER ADMIN DERRY"');
    process.exit(1);
  }
  if (!fs.existsSync(berkas)) {
    console.error(`Berkas tidak ketemu: ${berkas}`);
    process.exit(1);
  }

  const isi = fs.readFileSync(berkas);
  console.log(`membaca ${path.basename(berkas)} (${Math.round(isi.length / 1024 / 1024)} MB)`);

  const hasil = await tandaTanganService.impor(isi, { asal: path.basename(berkas), oleh });

  console.log("");
  console.log(`gambar ditemukan : ${hasil.ditemukan}`);
  console.log(`baru dimasukkan  : ${hasil.masuk}`);
  console.log(`sudah pernah ada : ${hasil.dilewati}`);

  console.log("");
  console.log(`nama bergelar yang terbaca di berkas ini (${hasil.namaTerbaca.length}):`);
  for (const n of hasil.namaTerbaca) console.log(`  ${n}`);

  console.log("");
  console.log("SELURUHNYA BELUM DISAHKAN dan belum dapat dipakai.");
  console.log("Buka portal - ALETA e-Court - Tanda Tangan untuk menamai dan mengesahkan.");
  process.exit(0);
}

utama().catch((galat) => {
  console.error("GALAT:", String(galat.stack || galat.message || galat).slice(0, 600));
  process.exit(1);
});
