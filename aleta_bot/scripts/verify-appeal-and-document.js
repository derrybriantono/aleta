#!/usr/bin/env node
"use strict";

/**
 * Membuktikan perhitungan tenggang banding benar, dan pengiriman berkas putusan
 * tidak menyesatkan.
 *
 *   node scripts/verify-appeal-and-document.js
 *
 * Tenggang banding adalah satu-satunya keterangan di seluruh layanan ini yang
 * HAKNYA HANGUS bila keliru. Karena itu yang diuji paling keras bukan
 * tampilannya, melainkan kapan modul ini memilih DIAM: bila tanggal acuannya
 * belum jelas, tidak boleh ada angka yang ditampilkan sama sekali.
 */

const appeal = require("../services/appealDeadlineService");
const journey = require("../services/caseJourneyService");
const docs = require("../services/caseDocumentService");
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

const HARI_INI = new Date("2026-09-20T00:00:00Z");

console.log("\n== Siapa yang perlu diberitahu putusan ==");
{
  periksa("kode 4: kedua pihak perlu diberitahu", appeal.partyNeedsNotification(4, "1") && appeal.partyNeedsNotification(4, "2"));
  periksa("kode 3: hanya pihak 1", appeal.partyNeedsNotification(3, "1") && !appeal.partyNeedsNotification(3, "2"));
  periksa("kode 2: hanya pihak 2", !appeal.partyNeedsNotification(2, "1") && appeal.partyNeedsNotification(2, "2"));
  periksa("kode 1: keduanya hadir, tidak perlu", !appeal.partyNeedsNotification(1, "1") && !appeal.partyNeedsNotification(1, "2"));
}

console.log("\n== Pihak yang HADIR: dihitung sejak putusan dibacakan ==");
{
  const hasil = appeal.computeAppealDeadline({
    tanggalPutusan: "2026-09-08",
    dihadiriOleh: 1,
    pihakKe: "1",
    today: HARI_INI,
  });
  periksa("tenggang berjalan", hasil.status === "berjalan");
  periksa("dasar: putusan", hasil.dasar === "putusan");
  periksa("batas 14 hari dari putusan", hasil.tanggalBatas === "2026-09-22");
  periksa(`sisa 2 hari (${hasil.sisaHari})`, hasil.sisaHari === 2);
}

console.log("\n== Pihak yang TIDAK hadir: dihitung sejak diberitahukan ==");
{
  const hasil = appeal.computeAppealDeadline({
    tanggalPutusan: "2026-09-08",
    dihadiriOleh: 3,
    tanggalPemberitahuan: "2026-09-15",
    pihakKe: "1",
    today: HARI_INI,
  });
  periksa("dasar: pemberitahuan", hasil.dasar === "pemberitahuan");
  periksa("batas dihitung dari pemberitahuan", hasil.tanggalBatas === "2026-09-29");
  periksa("bukan dari tanggal putusan", hasil.tanggalBatas !== "2026-09-22");
  periksa(`sisa 9 hari (${hasil.sisaHari})`, hasil.sisaHari === 9);
}

console.log("\n== DIAM bila tanggal acuannya belum jelas ==");
{
  const belumBeritahu = appeal.computeAppealDeadline({
    tanggalPutusan: "2026-09-08",
    dihadiriOleh: 4,
    tanggalPemberitahuan: "",
    pihakKe: "1",
    today: HARI_INI,
  });
  periksa("tidak hadir & belum diberitahu -> menunggu", belumBeritahu.status === "menunggu_beritahu");
  periksa("tidak menyebut angka sisa hari", belumBeritahu.sisaHari === undefined);
  periksa("tidak menyebut tanggal batas", belumBeritahu.tanggalBatas === undefined);

  const belumPutus = appeal.computeAppealDeadline({ tanggalPutusan: "", today: HARI_INI });
  periksa("belum putus -> tidak menghitung", belumPutus.status === "belum_putus");

  const sudahBht = appeal.computeAppealDeadline({
    tanggalPutusan: "2026-08-01",
    tanggalBht: "2026-08-20",
    dihadiriOleh: 1,
    pihakKe: "1",
    today: HARI_INI,
  });
  periksa("sudah BHT -> tenggang tidak berlaku", sudahBht.status === "sudah_bht");
}

console.log("\n== Kehadiran tidak tercatat: memilih tafsir yang lebih aman ==");
{
  // dihadiri_oleh kosong. Dihitung sejak putusan, sehingga tenggangnya lebih
  // PENDEK. Bila ternyata pihaknya tidak hadir, tenggang sebenarnya lebih
  // panjang dan akibatnya hanya datang lebih awal — bukan kehilangan hak.
  const hasil = appeal.computeAppealDeadline({
    tanggalPutusan: "2026-09-08",
    dihadiriOleh: null,
    pihakKe: "1",
    today: HARI_INI,
  });
  periksa("tetap menghitung", hasil.status === "berjalan");
  periksa("memakai dasar putusan (tenggang lebih pendek)", hasil.dasar === "putusan");
  periksa("tidak diam tanpa kepastian", hasil.status !== "menunggu_beritahu");
}

console.log("\n== Tenggang yang sudah lewat ==");
{
  const hasil = appeal.computeAppealDeadline({
    tanggalPutusan: "2026-08-01",
    dihadiriOleh: 1,
    pihakKe: "1",
    today: HARI_INI,
  });
  periksa("ditandai habis", hasil.status === "habis");
  periksa("sisa hari negatif", hasil.sisaHari < 0);
}

console.log("\n== Yang ditampilkan adalah tenggang yang paling cepat berakhir ==");
{
  // Pihak 1 tidak hadir (diberitahu 15 Sep -> batas 29 Sep),
  // pihak 2 hadir (putusan 8 Sep -> batas 22 Sep). Yang dipakai 22 Sep.
  const fakta = {
    tanggalPutusan: "2026-09-08",
    tanggalBht: "",
    dihadiriOleh: 3,
    pemberitahuan: [{ pihak: "1", tanggal: "2026-09-15" }],
  };
  const hasil = journey.describeAppealDeadline(fakta, { today: HARI_INI });
  periksa("memakai batas paling cepat", hasil.text.includes("22 September 2026"));
  periksa("tidak memakai batas yang lebih longgar", !hasil.text.includes("29 September 2026"));
}

console.log("\n== Peringatan mendesak saat tinggal sedikit ==");
{
  const mendesak = journey.describeAppealDeadline(
    { tanggalPutusan: "2026-09-08", tanggalBht: "", dihadiriOleh: 1, pemberitahuan: [] },
    { today: new Date("2026-09-21T00:00:00Z") }
  );
  periksa("mendesak: minta datang hari ini juga", mendesak.text.includes("hari ini juga"));

  const longgar = journey.describeAppealDeadline(
    { tanggalPutusan: "2026-09-08", tanggalBht: "", dihadiriOleh: 1, pemberitahuan: [] },
    { today: new Date("2026-09-10T00:00:00Z") }
  );
  periksa("masih longgar: ajakan biasa", !longgar.text.includes("hari ini juga"));
}

console.log("\n== Selalu menyatakan ini perkiraan, bukan penetapan ==");
{
  const hasil = journey.describeAppealDeadline(
    { tanggalPutusan: "2026-09-08", tanggalBht: "", dihadiriOleh: 1, pemberitahuan: [] },
    { today: HARI_INI }
  );
  periksa("menyebut perkiraan", hasil.text.includes("perkiraan"));
  periksa("menyebut catatan resmi pengadilan yang berlaku", hasil.text.includes("catatan resmi pengadilan"));
  periksa("mengarahkan memastikan ke PTSP", hasil.text.includes("PTSP"));
}

console.log("\n== Berkas putusan: keterangan salinan tidak resmi ==");
{
  periksa("menyebut TIDAK RESMI", docs.DISCLAIMER.includes("TIDAK RESMI"));
  periksa("menyebut dasar hukumnya", docs.DISCLAIMER.includes("1-144/KMA/SK/I/2011"));
  periksa("mengarahkan salinan resmi ke PTSP", docs.DISCLAIMER.includes("PTSP"));
  periksa("menjelaskan identitas disamarkan", docs.DISCLAIMER.includes("disamarkan"));
}

console.log("\n== Berkas belum tersedia dijelaskan sebabnya ==");
{
  periksa("belum putus", docs.explainUnavailable("belum_putus").includes("belum diputus"));
  periksa("belum diunggah menyebut minutasi", docs.explainUnavailable("belum_diunggah").includes("diminutasi"));
  periksa("berkas tak terbaca mengarahkan ke PTSP", docs.explainUnavailable("berkas_tidak_terbaca").includes("PTSP"));
  periksa("status tak dikenal tetap dijawab", docs.explainUnavailable("entah").length > 20);
}

console.log("\n== Keduanya masuk sebagai pilihan menu ==");
{
  const opsi = chatMenu.infoOptionsFor({ jenisPerkara: "Gugatan" });
  const dokumen = opsi.find((o) => o.key === "dokumen");
  periksa("pilihan kirim berkas tersedia", Boolean(dokumen));
  periksa("memakai penangan tersendiri", dokumen && dokumen.handler === "document");
  periksa("labelnya menyebut PDF", dokumen && dokumen.label.includes("PDF"));
  periksa("jawaban kosong dijelaskan", chatMenu.explainEmptyAnswer("dokumen").includes("diunggah"));
  periksa("tenggang banding tampil di perjalanan perkara, bukan pilihan tersendiri", !opsi.some((o) => o.key === "banding"));
}

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exit(1);
}
console.log("SEMUA PERIKSAAN LULUS.");
process.exit(0);
