"use strict";

/**
 * ============================================================================
 * KENAPA BERKAS e-COURT TIDAK PERNAH TURUN - DIBACA, BUKAN DITEBAK
 * ============================================================================
 *
 * Keluhannya "berkas terdeteksi tetapi tidak sampai terunduh". Dokumennya
 * memang terdaftar - judulnya ada, perkaranya ada - tetapi berkasnya tidak.
 *
 * Sebabnya SUDAH tercatat setiap kali: jembatan menuliskan gagal_sebab pada
 * tiap dokumen yang gagal diambil. Yang belum ada hanyalah cara membacanya
 * tanpa harus membuka basis data sendiri.
 *
 * Alat ini membacanya. SELURUHNYA BACA SAJA - tidak satu pun baris diubah,
 * tidak satu pun berkas ditulis, dan e-Court tidak disentuh sama sekali.
 *
 * ============================================================================
 * KENAPA INI PENTING, DAN BUKAN SEKADAR KERAPIAN
 * ============================================================================
 *
 * Empat sebab yang berbeda menghasilkan gejala yang PERSIS SAMA di layar -
 * dokumen tanpa berkas - dan tiga di antaranya dulu tercatat dengan kalimat
 * yang sama pula, "alamat_berkas_tidak_ditemukan":
 *
 *   garis miring tersandi di jawaban JSON  -> kode yang harus diperbaiki
 *   alamat relatif tanpa nama host          -> kode yang harus diperbaiki
 *   jawaban terpotong 4.000 huruf           -> kode yang harus diperbaiki
 *   sesi e-Court habis                      -> petugas yang harus login
 *
 * Selama keempatnya tidak dapat dibedakan, tidak ada cara mengetahui apakah
 * satu perbaikan berhasil - dan tidak ada cara membantah dugaan siapa pun.
 *
 * Jalankan:
 *   docker exec aleta-bot node scripts/periksa-unduhan-ecourt.js
 *   docker exec aleta-bot node scripts/periksa-unduhan-ecourt.js --contoh=5
 */

const path = require("path");

const botDb = require("../services/botDbService");
const ecourtDocumentService = require("../services/ecourtDocumentService");

function argInt(nama, bawaan) {
  const cocok = process.argv.find((x) => x.startsWith(`--${nama}=`));
  if (!cocok) return bawaan;
  const angka = Number(cocok.split("=")[1]);
  return Number.isFinite(angka) && angka > 0 ? angka : bawaan;
}

const CONTOH = argInt("contoh", 3);

function query(sql, params = []) {
  return botDb.query(sql, params);
}

function judul(teks) {
  console.log("");
  console.log("=".repeat(74));
  console.log(teks);
  console.log("=".repeat(74));
}

async function kolomAda(tabel, kolom) {
  const baris = await query(
    "SELECT COUNT(*) AS ada FROM information_schema.columns " +
      "WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    [tabel, kolom]
  );
  return Number((baris && baris[0] && baris[0].ada) || 0) > 0;
}

async function main() {
  const siap = await botDb.ensureSchema();
  if (!siap) {
    console.log("Basis data bot tidak dapat dihubungi. Tidak ada yang dapat dibaca.");
    process.exit(2);
  }

  judul("1. BERAPA BANYAK DOKUMEN, DAN BERAPA YANG PUNYA BERKAS");

  const ringkas = await query(
    `SELECT COUNT(*) AS semua,
            SUM(CASE WHEN berkas_pdf IS NOT NULL OR berkas_word IS NOT NULL THEN 1 ELSE 0 END) AS berberkas
       FROM aleta_bot_ecourt_documents`
  );
  const semua = Number((ringkas[0] && ringkas[0].semua) || 0);
  const berberkas = Number((ringkas[0] && ringkas[0].berberkas) || 0);

  console.log(`dokumen tercatat        : ${semua}`);
  console.log(`punya jalur berkas      : ${berberkas}`);
  console.log(`TANPA berkas sama sekali: ${semua - berberkas}`);
  if (semua > 0) {
    console.log(`                          (${Math.round(((semua - berberkas) / semua) * 100)}% dari seluruhnya)`);
  }

  judul("2. SEBAB KEGAGALAN, DIKELOMPOKKAN");

  // Kolom kegagalan ditambahkan menyusul; pemasangan lama belum tentu punya.
  if (!(await kolomAda("aleta_bot_ecourt_documents", "gagal_sebab"))) {
    console.log("Kolom gagal_sebab belum ada di pemasangan ini - jembatan versi lama.");
    console.log("Jalankan satu penarikan dengan versi sekarang, lalu ulangi perintah ini.");
  } else {
    const sebab = await query(
      `SELECT gagal_sebab AS sebab, COUNT(*) AS jumlah, MAX(gagal_terakhir) AS terakhir
         FROM aleta_bot_ecourt_documents
        WHERE gagal_beruntun > 0 AND gagal_sebab IS NOT NULL AND gagal_sebab <> ''
        GROUP BY gagal_sebab
        ORDER BY jumlah DESC`
    );

    if (!sebab.length) {
      console.log("Tidak ada dokumen yang sedang tercatat gagal. ");
      console.log("Bila tetap ada dokumen tanpa berkas, sebabnya BUKAN unduhan yang gagal -");
      console.log("lihat bagian 4: kemungkinan berkasnya hilang dari cakram sesudah tersimpan.");
    } else {
      for (const baris of sebab) {
        console.log(`${String(baris.jumlah).padStart(5)}x  ${String(baris.sebab).slice(0, 100)}`);
        console.log(`        terakhir: ${baris.terakhir || "-"}`);
      }

      console.log("");
      console.log("Arti sebab yang sudah dikenali:");
      console.log("  sesi_habis                      -> petugas login ulang di panel e-Court");
      console.log("  alamat_berkas_tidak_ditemukan   -> bentuk jawaban ViewDoc berubah; kode");
      console.log("                                     yang harus diperbaiki, bukan dicoba ulang");
      console.log("  alamat_berkas_di_luar_ecourt    -> jawaban menunjuk host lain; JANGAN diikuti");
      console.log("  berkas_kosong / HTTP 4xx, 5xx   -> sisi e-Court; dicoba lagi otomatis");
      console.log("  berkas_terlalu_besar            -> naikkan ALETA_BOT_ECOURT_MAX_UNDUH_BYTE");
    }
  }

  judul("3. CONTOH DOKUMEN YANG GAGAL, UNTUK DIPERIKSA SENDIRI");

  const contoh = await query(
    `SELECT nomor_perkara, judul_dokumen, document_key, gagal_beruntun, gagal_sebab
       FROM aleta_bot_ecourt_documents
      WHERE berkas_pdf IS NULL AND berkas_word IS NULL
      ORDER BY terakhir_terlihat DESC
      LIMIT ?`,
    [CONTOH]
  ).catch(() => []);

  if (!contoh.length) {
    console.log("Tidak ada dokumen tanpa berkas.");
  } else {
    for (const baris of contoh) {
      console.log(`- ${baris.nomor_perkara} | ${String(baris.judul_dokumen).slice(0, 60)}`);
      console.log(`  kunci  : ${baris.document_key}`);
      console.log(`  gagal  : ${baris.gagal_beruntun || 0}x  ${baris.gagal_sebab || "(tidak tercatat)"}`);
    }
  }

  judul("4. BERKAS YANG TERCATAT ADA - APAKAH SUNGGUH ADA DI CAKRAM");

  // Inilah pemeriksaan yang membedakan "gagal diunduh" dari "terunduh lalu
  // hilang". Keduanya tampak sama di layar; yang kedua berarti folder
  // simpanannya tidak terpasang keluar container, dan seluruh isinya musnah
  // pada tiap pembaruan.
  const berkas = await query(
    `SELECT jalur_berkas FROM aleta_bot_ecourt_files
      WHERE dihapus_retensi IS NULL AND jalur_berkas IS NOT NULL AND jalur_berkas <> ''
      ORDER BY diunduh_pada DESC
      LIMIT 500`
  ).catch(() => []);

  const fs = require("fs");
  let ada = 0;
  let hilang = 0;
  const contohHilang = [];
  for (const baris of berkas) {
    if (fs.existsSync(String(baris.jalur_berkas))) ada += 1;
    else {
      hilang += 1;
      if (contohHilang.length < CONTOH) contohHilang.push(String(baris.jalur_berkas));
    }
  }

  console.log(`diperiksa (500 terbaru) : ${berkas.length}`);
  console.log(`benar ada di cakram     : ${ada}`);
  console.log(`TERCATAT tetapi hilang  : ${hilang}`);
  for (const satu of contohHilang) console.log(`   - ${satu}`);

  if (hilang > 0) {
    console.log("");
    console.log("Berkas yang tercatat tetapi tidak ada di cakram berarti simpanannya TIDAK");
    console.log("terpasang keluar container - isinya musnah pada tiap pembaruan. Periksa");
    console.log("mount /usr/src/app/data/ecourt di docker-compose.override.server.yml.");
  }

  judul("5. FOLDER SIMPANAN YANG SEDANG DIPAKAI");

  const akar = path.resolve(
    process.env.ALETA_BOT_ECOURT_DOCUMENT_ROOT ||
      path.resolve(__dirname, "..", "data", "ecourt")
  );
  console.log(`akar simpanan  : ${akar}`);
  console.log(`dari peubah    : ${process.env.ALETA_BOT_ECOURT_DOCUMENT_ROOT ? "ALETA_BOT_ECOURT_DOCUMENT_ROOT" : "(bawaan, peubahnya tidak diatur)"}`);
  console.log(`foldernya ada  : ${require("fs").existsSync(akar) ? "ya" : "TIDAK"}`);
  console.log(`ekstensi boleh : ${[...ecourtDocumentService.ALLOWED_EXTENSIONS].join(" ")}`);

  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((galat) => {
    console.error("Gagal memeriksa:", (galat && galat.message) || galat);
    process.exit(1);
  });
