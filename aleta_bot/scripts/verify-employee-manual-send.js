#!/usr/bin/env node
// =============================================================================
// Verifikasi Kirim Manual untuk SUMBER DATA PEGAWAI, tanpa database.
//
//   node scripts/verify-employee-manual-send.js
//
// Query pegawai (mis. getDataJadwalSidangPerdataHakim) difilter per NAMA
// pegawai. Dulu Kirim Manual mengoper recipient=null sehingga filternya jadi
// "Pegawai", hasilnya 0 baris, dan placeholder nama_pegawai/judul_notifikasi/
// ringkasan dilaporkan kosong sehingga pengiriman terkunci.
//
// Skrip ini memakai scheduler tiruan agar tidak menyentuh SIPP.
// =============================================================================
const Module = require("module");
// Palsukan scheduler agar tidak menyentuh database: query legacy dikembalikan
// sesuai nama pegawai yang dioper, meniru getDataJadwalSidangPerdataHakim(nama).
const path = require("path");
const schedPath = require.resolve(path.resolve(__dirname, "..", "services", "dynamicNotificationSchedulerService.js"));
const dataPerHakim = {
  "DERRY BRIANTONO, S.H.": "1. 296/Pdt.G/2026/PA.Dgl - 09:00 - Ruang Sidang 1",
  "SITI AMINAH, S.H.": "1. 397/Pdt.G/2026/PA.Dgl - 10:00 - Ruang Sidang 2",
  "HAKIM TANPA SIDANG": "",
};
require.cache[schedPath] = {
  id: schedPath, filename: schedPath, loaded: true, exports: {
    runSourceQuery: async (query, recipient) => {
      const nama = (recipient && recipient.name) || "Pegawai";
      return { rows: [], text: dataPerHakim[nama] ?? "" };
    },
  },
};
const ms = require(path.resolve(__dirname, "..", "services", "manualSendService.js"));

const query = { id: "legacy-hakim-sidang-hari-ini", name: "Hakim - Daftar Sidang Hari Ini",
  category: "employee", sqlText: "legacy:notifikasi.getDataJadwalSidangPerdataHakim" };
const template = { id: "hakim", title: "Hakim - Jadwal dan Tugas Sidang",
  body: "*Hai {{nama_pegawai}}*\n\n*{{judul_notifikasi}}*\n\n{{ringkasan}}" };
const employees = [
  { name: "DERRY BRIANTONO, S.H.", whatsappNumber: "6285241987654" },
  { name: "SITI AMINAH, S.H.", whatsappNumber: "6281345844080" },
  { name: "HAKIM TANPA SIDANG", whatsappNumber: "6282246423966" },
];

(async () => {
  const hasil = await ms.previewManualSend({
    query, template, employeeRecipients: employees, notificationName: "Hakim - Sidang Hari Ini",
  });
  console.log("template lengkap        :", hasil.template.complete);
  console.log("placeholder kurang      :", JSON.stringify(hasil.template.missingPlaceholders));
  console.log("penerima (punya data)   :", hasil.query.recipients.length, "dari", employees.length, "pegawai");
  console.log("query dilaporkan kosong :", hasil.query.empty);
  console.log("\n--- pesan per hakim ---");
  for (const m of hasil.recipientMessages) {
    console.log(`\n[${m.normalized}] lengkap=${m.complete}`);
    console.log(m.message);
  }

  let gagal = 0;
  const periksa = (nama, aktual, harapan) => {
    const ok = aktual === harapan;
    if (ok) {
      console.log(`  OK    ${nama}`);
    } else {
      gagal += 1;
      console.log(`  GAGAL ${nama} -> harap: ${harapan}, aktual: ${aktual}`);
    }
  };

  // Query legacy menyaring dengan LIKE '%nama%' terhadap kolom SIPP. Nama
  // bergelar dari Manajemen Akun harus dipangkas dulu, kalau tidak hasilnya 0.
  console.log("\n--- normalisasi nama untuk filter LIKE SIPP ---");
  const { normalizeLegacyEmployeeName: normalisasiNama } = require(path.resolve(
    __dirname,
    "..",
    "services",
    "employeeNameUtil.js"
  ));
  // Ketiga peran memakai pola filter yang sama di notifikasi.js:
  //   hakim    -> f.hakim_nama    LIKE '%${namaHakim}%'
  //   panitera -> c.panitera_nama LIKE '%${namaPanitera}%'
  //   jurusita -> m.jurusita_nama LIKE '%${namaJurusita}%'
  // Karena normalisasi dipasang di titik pembuatan parameter, satu perbaikan
  // berlaku untuk ketiganya.
  const kasusNama = [
    ["Hakim: DERRY BRIANTONO, S.H.", "DERRY BRIANTONO"],
    ["Hakim: Dr. H. Abdul Salam, S.H., M.H.", "Abdul Salam"],
    ["Panitera: Hj. Sri Susilowati, S.Ag.", "Sri Susilowati"],
    ["Panitera: Mannaria, S.H., M.H.", "Mannaria"],
    ["Jurusita: FAHRI SAIFUDDIN, S.H.I., M.H.", "FAHRI SAIFUDDIN"],
    ["Jurusita: Dian Saputra", "Dian Saputra"],
  ].map(([label, harap]) => [label, harap]);

  console.log("\n--- periksaan ---");
  for (const [label, harap] of kasusNama) {
    const masuk = label.split(": ")[1];
    periksa(`${label} -> ${harap}`, normalisasiNama(masuk), harap);
  }
  periksa("tidak ada placeholder kosong", hasil.template.missingPlaceholders.length, 0);
  periksa("template dinyatakan lengkap", hasil.template.complete, true);
  periksa("query tidak dilaporkan kosong", hasil.query.empty, false);
  periksa("hanya pegawai berdata jadi penerima", hasil.query.recipients.length, 2);
  periksa("semua pesan lengkap", hasil.recipientMessages.every((m) => m.complete), true);
  periksa("pesan antar hakim berbeda", new Set(hasil.recipientMessages.map((m) => m.message)).size, 2);
  periksa("hakim 1 menerima namanya sendiri", hasil.recipientMessages[0].message.includes("DERRY BRIANTONO"), true);
  periksa("hakim 1 tidak menerima nama hakim lain", hasil.recipientMessages[0].message.includes("SITI AMINAH"), false);
  periksa("hakim 2 menerima namanya sendiri", hasil.recipientMessages[1].message.includes("SITI AMINAH"), true);

  // ---------------------------------------------------------------------------
  // Query per-pegawai dijalankan PARALEL. Dulu berurutan, sehingga puluhan
  // pegawai membuat pratinjau melewati batas waktu portal ("operation aborted").
  // Yang dijaga: cepat, TAPI urutan pegawai dan pasangan nomornya tidak tertukar.
  // ---------------------------------------------------------------------------
  console.log("\n--- paralelisasi query per-pegawai ---");
  const JEDA = 200;
  const JUMLAH = 12;
  require.cache[schedPath].exports.runSourceQuery = async (_q, recipient) => {
    await new Promise((r) => setTimeout(r, JEDA));
    const n = (recipient && recipient.name) || "Pegawai";
    return { rows: [], text: "jadwal milik " + n };
  };
  const banyakPegawai = Array.from({ length: JUMLAH }, (_, i) => ({
    name: `HAKIM ${String(i + 1).padStart(2, "0")}, S.H.`,
    whatsappNumber: `62812345${String(1000 + i)}`,
  }));
  const mulai = Date.now();
  const hasilParalel = await ms.previewManualSend({
    query: { id: "q", name: "Hakim", category: "employee", sqlText: "legacy:notifikasi.getDataJadwalSidangPerdataHakim" },
    template: { id: "t", title: "T", body: "{{nama_pegawai}} | {{ringkasan}}" },
    employeeRecipients: banyakPegawai,
    notificationName: "Hakim - Sidang Hari Ini",
  });
  const durasi = Date.now() - mulai;
  const berurutan = JUMLAH * JEDA;
  console.log(`  ${JUMLAH} pegawai: berurutan ~${berurutan} ms, paralel ${durasi} ms`);
  periksa("lebih cepat dari separuh waktu berurutan", durasi < berurutan / 2, true);
  periksa("semua pegawai terproses", hasilParalel.query.recipients.length, JUMLAH);
  periksa(
    "urutan nama tidak tertukar",
    hasilParalel.recipientMessages.every((m, i) => m.message.split(" | ")[0] === banyakPegawai[i].name),
    true
  );
  periksa(
    "nomor WhatsApp tetap berpasangan benar",
    hasilParalel.query.recipients.every((r, i) => r.normalized === banyakPegawai[i].whatsappNumber),
    true
  );

  console.log(gagal === 0 ? "\nSEMUA PERIKSAAN LULUS" : `\n${gagal} PERIKSAAN GAGAL`);
  process.exit(gagal === 0 ? 0 : 1);
})();
