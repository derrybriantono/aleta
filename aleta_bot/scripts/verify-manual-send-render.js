#!/usr/bin/env node
// =============================================================================
// Verifikasi rendering Kirim Manual TANPA mengirim pesan dan tanpa database.
//
//   node scripts/verify-manual-send-render.js
//
// Menguji dua sifat yang wajib dijaga:
//   1. Alias kolom SIPP (nama -> nama_pihak) supaya template tidak dilaporkan
//      "placeholder belum terisi" padahal datanya ada.
//   2. Isolasi antar penerima: tiap penerima menerima nama/perkara MILIKNYA,
//      bukan milik baris yang kebetulan terpilih di pratinjau.
// =============================================================================
const ms = require("../services/manualSendService");

let gagal = 0;
function periksa(nama, aktual, harapan) {
  const ok = aktual === harapan;
  if (!ok) gagal += 1;
  console.log(`  ${ok ? "OK  " : "GAGAL"}  ${nama}`);
  if (!ok) {
    console.log(`         harap : ${harapan}`);
    console.log(`         aktual: ${aktual}`);
  }
}

const rows = [
  { nama: "Rahmi binti Kasim", telepon: "085754214831", nomor_perkara: "296/Pdt.G/2026/PA.Dgl", tanggal_sidang: "22-07-2026" },
  { nama: "Hidayati binti Ayub", telepon: "081345844080", nomor_perkara: "397/Pdt.G/2026/PA.Dgl", tanggal_sidang: "22-07-2026" },
  { nama: "Megawati binti Laupe", telepon: "082246423966", nomor_perkara: "332/Pdt.G/2026/PA.Dgl", tanggal_sidang: "22-07-2026" },
];
const template = {
  id: "jadwal-sidang",
  title: "Jadwal Sidang",
  body: "Yth. {{nama_pihak}}, perkara {{nomor_perkara}} disidangkan {{tanggal_sidang}}.",
};

console.log("1. Alias kolom: 'nama' harus mengisi {{nama_pihak}}");
const values0 = ms.buildTemplateValues({ rows, selectedRowIndex: 0 });
const render0 = ms.renderTemplatePreview(template, values0);
periksa("placeholder lengkap", render0.ok, true);
periksa("tidak ada placeholder kurang", render0.missingPlaceholders.length, 0);
periksa("nama_pihak terisi dari kolom nama", values0.nama_pihak, "Rahmi binti Kasim");

console.log("\n2. Isolasi antar penerima: tiap orang dapat datanya sendiri");
const recipients = ms.extractRecipientsFromRows({ recipientColumn: "telepon", category: "party" }, rows);
periksa("jumlah penerima", recipients.length, 3);

const pesan = recipients.map((recipient) => {
  const values = ms.buildTemplateValues({ rows, selectedRowIndex: recipient.rowIndex });
  return ms.renderTemplatePreview(template, values).message;
});
periksa("penerima 1", pesan[0], "Yth. Rahmi binti Kasim, perkara 296/Pdt.G/2026/PA.Dgl disidangkan 22-07-2026.");
periksa("penerima 2", pesan[1], "Yth. Hidayati binti Ayub, perkara 397/Pdt.G/2026/PA.Dgl disidangkan 22-07-2026.");
periksa("penerima 3", pesan[2], "Yth. Megawati binti Laupe, perkara 332/Pdt.G/2026/PA.Dgl disidangkan 22-07-2026.");
periksa("semua pesan unik (tidak tertukar)", new Set(pesan).size, 3);

console.log("\n3. Placeholder yang benar-benar tidak ada tetap ditandai");
const templateKurang = { id: "x", title: "x", body: "Halo {{nama_pihak}}, sisa panjar {{sisa_panjar}}." };
const renderKurang = ms.renderTemplatePreview(templateKurang, values0);
periksa("dilaporkan tidak lengkap", renderKurang.ok, false);
periksa("placeholder kurang terdeteksi", renderKurang.missingPlaceholders.join(","), "sisa_panjar");

console.log(gagal === 0 ? "\nSEMUA PERIKSAAN LULUS" : `\n${gagal} PERIKSAAN GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
