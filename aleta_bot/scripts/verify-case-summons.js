#!/usr/bin/env node
"use strict";

/**
 * Membuktikan status panggilan sidang menjawab dengan benar DAN tidak
 * membocorkan data pribadi pihak lawan.
 *
 *   node scripts/verify-case-summons.js
 *
 * Tampilan ini menyebut nama pihak lawan beserta keadaan panggilannya. Itu
 * memang yang dibutuhkan penanya, tetapi batasnya harus tegas: yang boleh
 * diketahui hanya APAKAH panggilan sudah disampaikan dan KAPAN — bukan nomor
 * telepon, alamat, atau data pribadi lain milik lawan.
 */

const fs = require("fs");
const path = require("path");

const summons = require("../services/caseSummonsService");
const chatMenu = require("../services/chatMenuService");

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

function status(overrides = {}) {
  return {
    ditemukan: true,
    nomorPerkara: "531/Pdt.G/2026/PA.Dgl",
    pihak: [],
    sidangBerikutnya: null,
    ...overrides,
  };
}

function pihak(nama, ke, relaas = "", kirim = "") {
  return { nama, pihakKe: ke, tanggalRelaas: relaas, tanggalKirim: kirim };
}

console.log("\n== Semua pihak sudah dipanggil ==");
{
  const s = status({
    pihak: [pihak("Risna", "1", "2026-09-10"), pihak("Ahmad", "2", "2026-09-11")],
    sidangBerikutnya: { tanggal: "2026-09-22", agenda: "Pembuktian" },
  });
  const teks = summons.renderSummons(s);
  const ringkas = summons.summarize(s);

  periksa("kesimpulan: lengkap", ringkas.key === "lengkap");
  periksa("menyatakan sidang dapat berlanjut", ringkas.text.includes("dapat berlanjut"));
  periksa("kedua pihak ditandai sudah", (teks.match(new RegExp(summons.MARK_DONE, "g")) || []).length === 2);
  periksa("tanggal ditulis wajar", teks.includes("10 September 2026"));
  periksa("menyebut sidang yang dituju", teks.includes("22 September 2026"));
}

console.log("\n== Sebagian belum dipanggil ==");
{
  const s = status({
    pihak: [pihak("Risna", "1", "2026-09-10"), pihak("Ahmad", "2", "", "2026-09-12")],
  });
  const ringkas = summons.summarize(s);
  const teks = summons.renderSummons(s);

  periksa("kesimpulan: sebagian", ringkas.key === "sebagian");
  periksa("menyebut jumlah yang belum", ringkas.text.includes("1 pihak"));
  periksa("memperingatkan kemungkinan tunda", ringkas.text.includes("ditunda"));
  periksa("yang sudah dikirim tapi belum tercatat dijelaskan", teks.includes("menunggu bukti penyampaian"));
}

console.log("\n== Belum ada yang dipanggil ==");
{
  const s = status({ pihak: [pihak("Risna", "1"), pihak("Ahmad", "2")] });
  const ringkas = summons.summarize(s);
  periksa("kesimpulan: belum ada", ringkas.key === "belum_ada");
  periksa("menjelaskan masih diproses Jurusita", ringkas.text.includes("Jurusita"));
  periksa("tidak menakut-nakuti", !ringkas.text.includes("gagal"));
}

console.log("\n== KEAMANAN: data pribadi lawan tidak ikut ==");
{
  const s = status({
    pihak: [
      { nama: "Risna", pihakKe: "1", tanggalRelaas: "2026-09-10", tanggalKirim: "" },
      { nama: "Ahmad", pihakKe: "2", tanggalRelaas: "", tanggalKirim: "" },
    ],
  });
  const teks = summons.renderSummons(s);
  periksa("tidak memuat nomor telepon", !/\b0\d{9,}|\b62\d{9,}/.test(teks));
  periksa("hanya nama dan keadaan panggilan", teks.includes("Ahmad") && teks.includes("Belum tercatat dipanggil"));

  // Pengaman sebenarnya bukan pada teks yang tampil, melainkan pada apa yang
  // DIBACA dari database. Kolom yang tidak pernah diambil tidak akan pernah
  // bocor lewat log, potret perkara, maupun perubahan tampilan di kemudian hari.
  const sumber = fs.readFileSync(path.resolve(__dirname, "..", "services", "caseSummonsService.js"), "utf8");
  const bagianSql = sumber.slice(sumber.indexOf("SELECT"), sumber.indexOf("ORDER BY vp.pihak_ke"));
  for (const kolomTerlarang of ["telepon", "alamat", "ket_temu", "email", "nik", "no_hp", "doc_relaas", "no_resi_pos"]) {
    periksa(`kolom ${kolomTerlarang} tidak ikut dibaca`, !new RegExp(kolomTerlarang, "i").test(bagianSql));
  }

  // Bentuk data yang dikembalikan pun dibatasi pada yang memang ditampilkan.
  const kunci = Object.keys(s.pihak[0]).sort().join(",");
  periksa(`bentuk data pihak terbatas (${kunci})`, kunci === "nama,pihakKe,tanggalKirim,tanggalRelaas");
}

console.log("\n== Peran pihak disebut benar ==");
{
  periksa("gugatan pihak 1 = Penggugat", summons.describePartyRole("1", false) === "Penggugat");
  periksa("gugatan pihak 2 = Tergugat", summons.describePartyRole("2", false) === "Tergugat");
  periksa("permohonan pihak 1 = Pemohon", summons.describePartyRole("1", true) === "Pemohon");
  periksa("permohonan pihak 2 = Termohon", summons.describePartyRole("2", true) === "Termohon");
  periksa("posisi tak dikenal = Pihak", summons.describePartyRole("", false) === "Pihak");

  const permohonan = summons.renderSummons(
    status({ nomorPerkara: "219/Pdt.P/2026/PA.Dgl", pihak: [pihak("Budi", "1", "2026-09-10")] })
  );
  periksa("perkara permohonan memakai sebutan Pemohon", permohonan.includes("Pemohon:"));
}

console.log("\n== Perkara tidak ditemukan dijawab jelas ==");
{
  const teks = summons.renderSummons(status({ ditemukan: false }));
  periksa("mengatakan belum ditemukan", teks.includes("belum dapat ditemukan"));
  periksa("mengarahkan ke PTSP", teks.includes("PTSP"));
  periksa("tanpa pihak: kesimpulan aman", summons.summarize(status({ pihak: [] })).key === "tidak_ada_pihak");
}

console.log("\n== Tanpa jadwal sidang berikutnya ==");
{
  const teks = summons.renderSummons(status({ pihak: [pihak("Risna", "1", "2026-09-10")] }));
  periksa("tetap menampilkan status panggilan", teks.includes("Sudah dipanggil"));
  periksa("tidak menyebut sidang yang tidak ada", !teks.includes("Untuk sidang"));
}

console.log("\n== Selalu menjelaskan sumber keterangannya ==");
{
  const teks = summons.renderSummons(status({ pihak: [pihak("Risna", "1", "2026-09-10")] }));
  periksa("menyebut panggilan resmi lewat Jurusita", teks.includes("Jurusita"));
  periksa("menyatakan mengikuti catatan pengadilan", teks.includes("catatan pengadilan"));
}

console.log("\n== Masuk sebagai pilihan menu ==");
{
  const opsi = chatMenu.infoOptionsFor({ jenisPerkara: "Gugatan" });
  const index = opsi.findIndex((o) => o.key === "panggilan");
  periksa("tersedia di menu", index >= 0);
  periksa("berada tepat setelah perjalanan perkara", index === 1);
  periksa("memakai penangan tersendiri", opsi[index].handler === "summons");
  periksa("tersedia untuk semua jenis perkara", chatMenu.infoOptionsFor({ jenisPerkara: "Pidana Biasa" }).some((o) => o.key === "panggilan"));
  periksa("jawaban kosong dijelaskan sebabnya", chatMenu.explainEmptyAnswer("panggilan").includes("Jurusita"));
}

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exit(1);
}
console.log("SEMUA PERIKSAAN LULUS.");
process.exit(0);
