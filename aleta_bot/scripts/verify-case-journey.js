#!/usr/bin/env node
"use strict";

/**
 * Membuktikan perjalanan perkara, baris tindakan, dan kamus istilah bekerja.
 *
 *   node scripts/verify-case-journey.js
 *
 * Yang paling penting diuji: tahap "sedang berjalan" ditandai dengan benar,
 * dan baris tindakannya sesuai keadaan perkara. Salah menandai tahap berarti
 * pihak diberi tahu posisi perkaranya secara keliru — lebih buruk daripada
 * tidak diberi tahu sama sekali.
 */

const journey = require("../services/caseJourneyService");
const glossary = require("../services/legalGlossaryService");
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

const HARI_INI = new Date("2026-09-15T00:00:00Z");

function fakta(overrides = {}) {
  return {
    ditemukan: true,
    nomorPerkara: "531/Pdt.G/2026/PA.Dgl",
    tanggalPendaftaran: "2026-03-12",
    tanggalPutusan: "",
    tanggalBht: "",
    amarPutusan: "",
    sidang: [],
    ...overrides,
  };
}

function tahap(stages, key) {
  return stages.filter((s) => s.key === key);
}

console.log("\n== Perkara baru: belum ada sidang ==");
{
  const f = fakta();
  const stages = journey.buildStages(f, HARI_INI);
  const aksi = journey.buildNextAction(f, stages);

  periksa("pendaftaran ditandai selesai", tahap(stages, "pendaftaran")[0].status === "selesai");
  periksa("ada tepat satu tahap berjalan", stages.filter((s) => s.status === "berjalan").length === 1);
  periksa("tahap berjalan adalah sidang", stages.find((s) => s.status === "berjalan").key === "sidang");
  periksa("tindakan: menunggu jadwal", aksi.key === "menunggu_jadwal");
  periksa("mengatakan belum ada yang perlu dilakukan", aksi.text.includes("Belum ada yang perlu Anda lakukan"));
  periksa("menjelaskan panggilan lewat Jurusita", aksi.text.includes("Jurusita"));
}

console.log("\n== Ada sidang lalu dan sidang mendatang ==");
{
  const f = fakta({
    sidang: [
      { tanggal: "2026-08-10", agenda: "Sidang Pertama" },
      { tanggal: "2026-09-01", agenda: "Mediasi" },
      { tanggal: "2026-09-22", agenda: "Pembuktian" },
      { tanggal: "2026-10-06", agenda: "Pembacaan Putusan" },
    ],
  });
  const stages = journey.buildStages(f, HARI_INI);
  const aksi = journey.buildNextAction(f, stages);

  periksa("dua sidang lampau ditandai selesai", tahap(stages, "sidang").filter((s) => s.status === "selesai").length === 2);
  periksa("sidang berikutnya ditandai berjalan", stages.find((s) => s.key === "sidang_berikutnya").status === "berjalan");
  periksa("sidang berikutnya adalah 22 September", stages.find((s) => s.key === "sidang_berikutnya").date === "2026-09-22");
  periksa("sidang setelahnya ditandai akan datang", tahap(stages, "sidang").some((s) => s.status === "akan_datang"));
  periksa("hanya satu tahap berjalan", stages.filter((s) => s.status === "berjalan").length === 1);

  periksa("tindakan: hadir sidang", aksi.key === "hadir_sidang");
  periksa("menyebut tanggal dalam bahasa manusia", aksi.text.includes("22 September 2026"));
  periksa("menyebut agendanya", aksi.text.includes("pembuktian"));
  periksa("memberi persiapan sesuai agenda", aksi.text.includes("bukti surat asli"));
}

console.log("\n== Sudah putus, belum berkekuatan hukum tetap ==");
{
  const f = fakta({
    tanggalPutusan: "2026-09-08",
    amarPutusan: "Mengabulkan gugatan Penggugat dengan verstek",
    sidang: [{ tanggal: "2026-09-08", agenda: "Pembacaan Putusan" }],
  });
  const stages = journey.buildStages(f, HARI_INI);
  const aksi = journey.buildNextAction(f, stages);

  periksa("putusan ditandai selesai", tahap(stages, "putusan")[0].status === "selesai");
  periksa("BHT ditandai berjalan", tahap(stages, "bht")[0].status === "berjalan");
  // Sejak v1.12.0 tenggang banding menggantikan pesan umum "menunggu BHT",
  // karena tenggang itulah yang haknya bisa hangus bila terlambat.
  periksa("tindakan: tenggang banding", aksi.key === "tenggang_banding");
  periksa("menjelaskan tenggang 14 hari", aksi.text.includes("14 hari"));
  periksa("menyebut tanggal batasnya", /\d+ [A-Z][a-z]+ \d{4}/.test(aksi.text));
  periksa("menyatakan angkanya perkiraan", aksi.text.includes("perkiraan"));
}

console.log("\n== Sudah berkekuatan hukum tetap ==");
{
  const f = fakta({
    tanggalPutusan: "2026-08-08",
    tanggalBht: "2026-08-25",
    sidang: [{ tanggal: "2026-08-08", agenda: "Pembacaan Putusan" }],
  });
  const stages = journey.buildStages(f, HARI_INI);
  const aksi = journey.buildNextAction(f, stages);

  periksa("BHT ditandai selesai", tahap(stages, "bht")[0].status === "selesai");
  periksa("tahap akta ditawarkan", tahap(stages, "akta").length === 1);
  periksa("akta ditandai berjalan", tahap(stages, "akta")[0].status === "berjalan");
  periksa("tindakan: ambil akta", aksi.key === "ambil_akta");
  periksa("menyebut jalur daring resmi", aksi.text.includes("eac.mahkamahagung.go.id"));
}

console.log("\n== Perkara bukan cerai tidak menawarkan akta ==");
{
  const f = fakta({ nomorPerkara: "12/Pid.B/2026/PN.Dgl", tanggalBht: "2026-08-25", tanggalPutusan: "2026-08-08" });
  const stages = journey.buildStages(f, HARI_INI);
  periksa("tahap akta tidak muncul", tahap(stages, "akta").length === 0);
  periksa("jenis perkara cerai dikenali", journey.menghasilkanAktaCerai("531/Pdt.G/2026/PA.Dgl") === true);
  periksa("perkara pidana bukan penghasil akta", journey.menghasilkanAktaCerai("12/Pid.B/2026/PN.Dgl") === false);
}

console.log("\n== Persiapan sesuai agenda ==");
{
  periksa("mediasi: hadir sendiri", journey.preparationFor("Mediasi").includes("tidak dapat diwakilkan"));
  periksa("pembuktian: bawa bukti asli", journey.preparationFor("Pembuktian").includes("asli"));
  periksa("saksi: bawa saksi", journey.preparationFor("Pemeriksaan Saksi").includes("saksi"));
  periksa("ikrar talak: kehadiran suami mutlak", journey.preparationFor("Sidang Ikrar Talak").includes("suami"));
  periksa("agenda tak dikenal: tanpa saran khusus", journey.preparationFor("Agenda Aneh") === "");
}

console.log("\n== Tampilan perjalanan perkara ==");
{
  const f = fakta({
    sidang: [
      { tanggal: "2026-08-10", agenda: "Sidang Pertama" },
      { tanggal: "2026-09-22", agenda: "Pembuktian" },
    ],
  });
  const stages = journey.buildStages(f, HARI_INI);
  const teks = journey.renderJourney(f, stages, journey.buildNextAction(f, stages));

  periksa("memuat nomor perkara", teks.includes("531/Pdt.G/2026/PA.Dgl"));
  periksa("menandai tahap selesai", teks.includes(journey.MARK_DONE));
  periksa("menandai tahap berjalan", teks.includes(journey.MARK_CURRENT));
  periksa("menandai tahap belum", teks.includes(journey.MARK_UPCOMING));
  periksa("tanggal ditulis wajar", teks.includes("10 Agustus 2026"));
  periksa("ada bagian tindakan", teks.includes("Yang perlu Anda lakukan"));
  periksa("tidak ada tanggal format mesin", !/\d{4}-\d{2}-\d{2}/.test(teks));
}

console.log("\n== Perkara tidak ditemukan dijawab jelas ==");
{
  const f = fakta({ ditemukan: false });
  const teks = journey.renderJourney(f, journey.buildStages(f, HARI_INI), { text: "-" });
  periksa("mengatakan belum ditemukan", teks.includes("belum dapat ditemukan"));
  periksa("mengarahkan ke PTSP", teks.includes("PTSP"));
}

console.log("\n== Kamus istilah ==");
{
  const pesan = "Amar putusan: Mengabulkan gugatan Penggugat dengan verstek.";
  const hasil = glossary.explainTerms(pesan);
  periksa("istilah asli tetap utuh", hasil.includes("verstek"));
  periksa("penjelasan ditempel", hasil.includes("tidak pernah hadir"));
  periksa("diberi judul yang jelas", hasil.includes("Arti istilah di atas"));

  const tanpaIstilah = glossary.explainTerms("Jadwal sidang Anda 8 September 2026.");
  periksa("pesan tanpa istilah tidak diubah", tanpaIstilah === "Jadwal sidang Anda 8 September 2026.");

  const bht = glossary.explainTerms("Perkara sudah berkekuatan hukum tetap.");
  periksa("BHT dikenali", bht.includes("final dan tidak dapat diajukan banding"));

  const banyak = glossary.explainTerms("verstek, gugur, mediasi, eksepsi, replik, duplik, banding, kasasi");
  const jumlahBaris = (banyak.match(/^• /gm) || []).length;
  periksa(`istilah dibatasi agar pesan tidak membengkak (${jumlahBaris})`, jumlahBaris <= glossary.MAX_TERMS_PER_MESSAGE);
}

console.log("\n== Kamus tidak salah cocok di tengah kata ==");
{
  const pk = glossary.findTerms("Nomor perkara 12/Pkt/2026 sedang diproses");
  periksa('"pk" tidak cocok di dalam "Pkt"', !pk.some((t) => t.label === "peninjauan kembali|pk"));

  const ditolak = glossary.findTerms("Permohonan Anda ditolak");
  periksa('"ditolak" dikenali sebagai istilah', ditolak.some((t) => t.explanation.includes("tidak dikabulkan")));
}

console.log("\n== Istilah tambahan dari portal ==");
{
  const konfigPortal = {
    legalGlossary: [
      { term: "sita jaminan", explanation: "penyitaan harta agar tidak dipindahtangankan selama perkara berjalan" },
      { term: "verstek", explanation: "penjelasan versi pengadilan sendiri" },
    ],
  };
  const daftar = glossary.listTerms(konfigPortal);
  periksa("istilah portal ikut terdaftar", daftar.some((t) => t.term === "sita jaminan"));

  const hasil = glossary.explainTerms("Diletakkan sita jaminan atas objek sengketa.", konfigPortal);
  periksa("istilah portal ikut dijelaskan", hasil.includes("dipindahtangankan"));

  const timpa = glossary.explainTerms("Putusan verstek dijatuhkan.", konfigPortal);
  periksa("istilah portal menimpa bawaan bernama sama", timpa.includes("versi pengadilan sendiri"));
}

console.log("\n== Jawaban kosong menjelaskan sebabnya ==");
{
  periksa("akta: menjelaskan syarat BHT", chatMenu.explainEmptyAnswer("akta").includes("berkekuatan hukum tetap"));
  periksa("jadwal: menjelaskan penetapan hari sidang", chatMenu.explainEmptyAnswer("jadwal").includes("belum ditetapkan"));
  periksa("biaya: menjelaskan panjar", chatMenu.explainEmptyAnswer("biaya").includes("panjar"));
  periksa("kunci tak dikenal tetap dijawab", chatMenu.explainEmptyAnswer("entah").length > 20);
}

console.log("\n== Perjalanan perkara masuk sebagai pilihan pertama ==");
{
  const opsi = chatMenu.infoOptionsFor({ jenisPerkara: "Gugatan" });
  periksa("menjadi pilihan nomor 1", opsi[0].key === "perjalanan");
  periksa("labelnya menjawab pertanyaan pihak", opsi[0].label.includes("sudah sampai mana"));
  periksa("memakai penangan tersendiri", opsi[0].handler === "journey");
  periksa("tersedia untuk semua jenis perkara", chatMenu.infoOptionsFor({ jenisPerkara: "Pidana Biasa" })[0].key === "perjalanan");
}

console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
if (gagal > 0) {
  console.log("ADA PERIKSAAN YANG GAGAL.");
  process.exit(1);
}
console.log("SEMUA PERIKSAAN LULUS.");
process.exit(0);
