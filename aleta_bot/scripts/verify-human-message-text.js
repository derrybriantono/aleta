#!/usr/bin/env node
"use strict";

/**
 * Membuktikan pesan yang sampai ke penerima TIDAK memuat nama variabel/kode.
 *
 *   node scripts/verify-human-message-text.js
 *
 * Kasus nyata yang diperbaiki: pesan notifikasi perkara pernah memuat baris
 * "nomor_perkara: 531/Pdt.G/2026/PA.Dgl" dan "tanggal_sidang: 08-09-2026" —
 * terbaca seperti kebocoran kode program oleh pihak berperkara.
 */
const {
  findCodeArtifacts,
  humanizeFieldLabel,
  rowToHumanText,
  sanitizeOutgoingMessage,
  toTitleCaseName,
} = require("../services/humanTextService");
const { renderTemplate } = require("../services/templateService");

let lulus = 0;
let gagal = 0;

function periksa(label, kondisi) {
  if (kondisi) {
    lulus += 1;
    console.log(`  OK    ${label}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${label}`);
  }
}

/** Baris data persis seperti kasus yang dilaporkan dari layar WhatsApp. */
const barisNyata = {
  perkara_id: "9912",
  nomor_perkara: "531/Pdt.G/2026/PA.Dgl",
  nama: "MISBAHUDIN, SH.,MH",
  tanggal_sidang: "08-09-2026",
  agenda: "Sidang Pertama",
  ruangan: "Ruang Sidang 1 Dalam Gedung",
  telepon: "6285242120977",
};

console.log("\n== Ringkasan otomatis memakai label manusia ==");
{
  const teks = rowToHumanText(barisNyata, { omitIdentity: true });
  periksa("tidak ada sisa nama kolom mentah", findCodeArtifacts(teks).length === 0);
  periksa("memakai label 'Tanggal Sidang'", teks.includes("Tanggal Sidang:"));
  periksa("memakai label 'Ruang Sidang'", teks.includes("Ruang Sidang:"));
  periksa("tanggal ditulis wajar (8 September 2026)", teks.includes("8 September 2026"));
  periksa("tidak menulis 'tanggal_sidang'", !teks.includes("tanggal_sidang"));
  periksa("tidak menulis 'nomor_perkara'", !teks.includes("nomor_perkara"));
  periksa("nomor telepon tidak ikut bocor", !teks.includes("6285242120977"));
  periksa("id internal tidak ikut bocor", !teks.includes("9912"));
  periksa("identitas tidak diulang karena sudah ada di atas pesan", !teks.includes("MISBAHUDIN"));
}

console.log("\n== Ringkasan lengkap (untuk pegawai) tetap memuat identitas ==");
{
  const teks = rowToHumanText(barisNyata);
  periksa("nomor perkara ikut ditampilkan", teks.includes("531/Pdt.G/2026/PA.Dgl"));
  periksa("nama ikut ditampilkan", teks.includes("MISBAHUDIN"));
  periksa("tetap tanpa jejak kode", findCodeArtifacts(teks).length === 0);
}

console.log("\n== Pesan utuh hasil render isi pesan ==");
{
  const template = {
    body:
      "Assalamu'alaikum Warahmatullahi Wabarakatuh,\n\n" +
      "Detail Perkara Baru:\n- Nama: Sdr/Sdri *{{nama_pihak}}*\n- Nomor Perkara: *{{nomor_perkara}}*\n\n{{ringkasan}}\n\n" +
      "Ini adalah notifikasi, anda tidak perlu membalasnya.",
  };
  const pesan = renderTemplate(template, {
    nama_pihak: "MISBAHUDIN, SH.,MH",
    nomor_perkara: "531/Pdt.G/2026/PA.Dgl",
    ringkasan: rowToHumanText(barisNyata, { omitIdentity: true }),
  });

  const jejak = findCodeArtifacts(pesan);
  periksa(`pesan bersih dari jejak kode (${jejak.join(", ") || "tidak ada"})`, jejak.length === 0);
  periksa("identitas hanya muncul sekali di bagian atas", (pesan.match(/531\/Pdt\.G\/2026\/PA\.Dgl/g) || []).length === 1);
  periksa("rincian sidang tetap tersampaikan", pesan.includes("Sidang Pertama"));
}

console.log("\n== Pengaman terakhir membersihkan isi pesan lama ==");
{
  // Isi pesan lama yang terlanjur tersimpan dengan format kolom mentah.
  const kotor = "Halo,\n\nnomor_perkara: 1/Pdt.G/2026/PA.Dgl\nnama_pihak: Budi\n- tanggal_sidang: 2026-09-08\n";
  const bersih = sanitizeOutgoingMessage(kotor);
  periksa("format kolom mentah dinaikkan jadi label", bersih.includes("Nomor Perkara:") && bersih.includes("Tanggal Sidang:"));
  periksa("tidak menyisakan garis bawah kolom", findCodeArtifacts(bersih).length === 0);
  periksa("nilai datanya tidak hilang", bersih.includes("1/Pdt.G/2026/PA.Dgl") && bersih.includes("Budi"));
  periksa("penanda daftar tetap dipertahankan", bersih.includes("- Tanggal Sidang:"));
}

console.log("\n== Placeholder yang tidak sempat terisi tidak pernah terkirim ==");
{
  const bersih = sanitizeOutgoingMessage("Halo {{nama_pihak}}, perkara {{nomor_perkara}} Anda sudah terdaftar.");
  periksa("kurung kurawal dibuang", !bersih.includes("{{"));
  periksa("kalimat sisanya tetap terbaca", bersih.includes("Anda sudah terdaftar"));
}

console.log("\n== Label dan jabatan ditulis rapi ==");
{
  periksa("nomor_perkara -> Nomor Perkara", humanizeFieldLabel("nomor_perkara") === "Nomor Perkara");
  periksa("sisa_panjar -> Sisa Panjar", humanizeFieldLabel("sisa_panjar") === "Sisa Panjar");
  periksa("kolom tak dikenal tetap dirapikan", humanizeFieldLabel("jumlah_saksi_hadir") === "Jumlah Saksi Hadir");
  periksa("jabatan huruf kecil dirapikan", toTitleCaseName("wakil ketua pengadilan") === "Wakil Ketua Pengadilan");
  periksa("kata sambung tetap huruf kecil", toTitleCaseName("panitera muda dan gugatan") === "Panitera Muda dan Gugatan");
  periksa("singkatan kapital dipertahankan", toTitleCaseName("kepala PTSP") === "Kepala PTSP");
  periksa("jabatan kosong -> teks kosong", toTitleCaseName("") === "");
}

console.log("\n== Isi pesan pegawai: nama + jabatan, tanpa perkenalan bot ==");
{
  const { employeePositionLabel, renderTemplatePreview } = require("../services/manualSendService");

  periksa("jabatan pegawai dirapikan dari data runtime", employeePositionLabel({ positionName: "panitera muda gugatan" }) === "Panitera Muda Gugatan");
  periksa("jatuh ke peran bila jabatan kosong", employeePositionLabel({ roleId: "hakim" }) === "Hakim");
  periksa("pegawai tanpa jabatan tetap dapat sebutan netral", employeePositionLabel({}) === "Pegawai");
  periksa("data pegawai tidak ada pun tidak kosong", employeePositionLabel(null) === "Pegawai");

  // Isi pesan pegawai versi baru harus lengkap terender pada Kirim Manual.
  const templatePegawai = {
    body: "{{nama_pegawai}} — {{jabatan}}\n\n{{judul_notifikasi}}:\n\n{{ringkasan}}",
  };
  const nilai = {
    nama_pegawai: "Ahmad Fauzi, S.H.",
    jabatan: employeePositionLabel({ positionName: "hakim" }),
    judul_notifikasi: "Jadwal Sidang Hari Ini",
    ringkasan: "Tanggal Sidang: 8 September 2026\nAgenda: Sidang Pertama",
  };
  const render = renderTemplatePreview(templatePegawai, nilai);

  periksa("pratinjau pegawai lengkap (tidak ada placeholder kosong)", render.ok === true);
  periksa(`tidak ada placeholder kosong (${render.missingPlaceholders.join(", ") || "tidak ada"})`, render.missingPlaceholders.length === 0);
  periksa("nama pegawai ada di baris pertama", render.message.split("\n")[0].includes("Ahmad Fauzi"));
  periksa("jabatan ada di baris pertama", render.message.split("\n")[0].includes("Hakim"));
  periksa("tidak memperkenalkan diri sebagai bot", !/saya Aleta|Bot Pengadilan/i.test(render.message));
  periksa("nama pegawai ditulis polos tanpa penanda tebal", !render.message.split("\n")[0].includes("*"));
  periksa("nama pegawai utuh apa adanya", render.message.split("\n")[0].startsWith("Ahmad Fauzi, S.H. — Hakim"));
  periksa("pesan pegawai bersih dari jejak kode", findCodeArtifacts(render.message).length === 0);
}

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exit(1);
}
console.log("SEMUA PERIKSAAN LULUS.");
process.exit(0);
