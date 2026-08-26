#!/usr/bin/env node
"use strict";

/**
 * Uji kering pemberitahuan e-Court — Tahap 4.
 *
 *   node tools/ecourt-bridge/uji-kering.js
 *   node tools/ecourt-bridge/uji-kering.js --perkara 620/Pdt.G/2025/PA.Dgl
 *
 * Menampilkan apa yang AKAN dikirim untuk tiap dokumen yang sudah tersimpan,
 * TANPA mengirim apa pun dan tanpa mengubah satu baris pun di database.
 *
 * --- Kenapa langkah ini ada ---
 *
 * Pengklasifikasi menebak dari judul dokumen. Judul yang dipakai tiap jenis
 * perkara berbeda-beda, dan kamusnya dibangun dari contoh yang baru sedikit.
 * Menyalakan pengiriman sungguhan sebelum melihat hasil tebakannya berarti
 * mempertaruhkan pesan pengadilan pada dugaan yang belum pernah diperiksa.
 *
 * Alat ini memperlihatkan tebakan itu lebih dulu: mana yang akan dikirim, ke
 * siapa, dan mana yang dilewati beserta alasannya - sehingga kamusnya dapat
 * diperbaiki sebelum ada satu pesan pun berangkat.
 */

const botDb = require("../../services/botDbService");
const ecourtStoreService = require("../../services/ecourtStoreService");
const ecourtDocumentService = require("../../services/ecourtDocumentService");
const klasifikasi = require("../../services/ecourtEventClassifierService");
const { cleanText, normalizeCaseNumber } = require("../../services/ecourtTextService");

function parseArgs(argv) {
  const args = { perkara: "", batas: 200 };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--perkara") args.perkara = String(argv[++i] || "");
    else if (argv[i] === "--batas") args.batas = Number(argv[++i]) || 200;
  }
  return args;
}

function garis(judul) {
  console.log(`\n${"=".repeat(70)}\n${judul}\n${"=".repeat(70)}`);
}

async function utama() {
  const args = parseArgs(process.argv.slice(2));
  await ecourtStoreService.ensureSchema();

  const batas = Math.max(1, Math.min(1000, args.batas));
  const dokumen = args.perkara
    ? await botDb.query(
        `SELECT * FROM aleta_bot_ecourt_documents WHERE nomor_perkara = ? ORDER BY diunggah_pada ASC LIMIT ${batas}`,
        [normalizeCaseNumber(args.perkara)]
      )
    : await botDb.query(
        `SELECT * FROM aleta_bot_ecourt_documents ORDER BY diunggah_pada ASC LIMIT ${batas}`
      );

  if (!Array.isArray(dokumen) || dokumen.length === 0) {
    console.log("Belum ada dokumen e-Court tersimpan.");
    console.log("Jalankan dulu: node tools/ecourt-bridge/run.js");
    process.exit(0);
  }

  garis(`UJI KERING — ${dokumen.length} dokumen tersimpan`);
  console.log("Tidak ada pesan yang dikirim dan tidak ada data yang diubah.\n");

  const ringkasan = { akanDikirim: 0, dilewati: 0, tanpaLampiran: 0 };
  const alasanDilewati = new Map();

  for (const item of dokumen) {
    const keputusan = klasifikasi.decide(item, {});
    const judul = cleanText(item.judul_dokumen) || "(tanpa judul)";
    const perkara = cleanText(item.nomor_perkara) || "(tanpa nomor)";

    if (!keputusan.notify) {
      ringkasan.dilewati += 1;
      alasanDilewati.set(keputusan.reason, (alasanDilewati.get(keputusan.reason) || 0) + 1);
      console.log(`  [ DILEWATI ] ${perkara} — ${judul}`);
      console.log(`               alasan: ${keputusan.reason}`);
      continue;
    }

    ringkasan.akanDikirim += 1;
    const lampiran = ecourtDocumentService.pickBestAttachment({
      berkasPdf: item.berkas_pdf,
      berkasWord: item.berkas_word,
    });
    if (!lampiran.ok) ringkasan.tanpaLampiran += 1;

    console.log(`\n  [ AKAN DIKIRIM ] ${perkara} — ${judul}`);
    console.log(`                   kepada: pihak ${keputusan.targetRole}`);
    console.log(`                   lampiran: ${lampiran.ok ? lampiran.fileName : `TIDAK ADA (${lampiran.reason})`}`);
    console.log("                   --- isi pesan ---");
    const pesan = klasifikasi.buildMessage(item, keputusan, { namaPihak: "(nama pihak)" });
    for (const baris of pesan.split("\n")) console.log(`                   ${baris}`);
  }

  garis("RINGKASAN");
  console.log(`  Akan dikirim        : ${ringkasan.akanDikirim}`);
  console.log(`  Dilewati            : ${ringkasan.dilewati}`);
  console.log(`  Tanpa lampiran      : ${ringkasan.tanpaLampiran}`);

  if (alasanDilewati.size > 0) {
    console.log("\n  Alasan dilewati:");
    for (const [alasan, jumlah] of [...alasanDilewati].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(jumlah).padStart(4)}  ${alasan}`);
    }
  }

  const belumDikenali = alasanDilewati.get(klasifikasi.SKIP_REASONS.TIDAK_DIKENALI) || 0;
  if (belumDikenali > 0) {
    console.log(
      `\n  PERHATIAN: ${belumDikenali} dokumen judulnya belum dikenali kamus.\n` +
      "  Periksa daftar di atas; bila ada yang seharusnya diberitahukan,\n" +
      "  tambahkan polanya ke ecourtEventClassifierService.js atau lewat\n" +
      "  pengaturan ecourtDocumentGuide di portal."
    );
  }

  console.log("");
  process.exit(0);
}

// Hanya berjalan bila dipanggil dari baris perintah. Modul yang menjalankan
// dirinya sendiri saat di-require akan memanggil process.exit dan mematikan
// proses yang memuatnya - termasuk skrip pemeriksaan.
if (require.main === module) {
  utama().catch((error) => {
    console.error("Uji kering gagal:", error.message);
    process.exit(1);
  });
}

module.exports = { parseArgs, utama };
