#!/usr/bin/env node
"use strict";

/**
 * Memeriksa penerjemahan agenda sidang.
 *
 *   node scripts/verify-sidang-agenda.js
 *
 * Dua hal yang diuji paling keras:
 *
 *   1. Agenda GABUNGAN. "Pembuktian Surat dan Pemeriksaan Saksi" benar-benar
 *      ada di SIPP. Memilih salah satu kelas saja akan menghilangkan setengah
 *      persiapan yang dibutuhkan pihak - kesalahan yang tidak terlihat sampai
 *      ada pihak datang tanpa saksi.
 *
 *   2. Agenda TIDAK DIKENALI. Agenda baru pasti muncul suatu hari. Perilakunya
 *      harus mempertahankan keadaan sekarang: pengingat H-3 tetap jalan, dan
 *      H-1 tidak diam-diam menambah lalu lintas pesan.
 */

const fs = require("fs");
const path = require("path");

const agenda = require("../services/sidangAgendaService");
const { findCodeArtifacts } = require("../services/humanTextService");

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

function kelas(teks) {
  return agenda.reminderPlan(teks, {}).classes;
}

function utama() {
  console.log("\n== Pengenalan agenda ==");
  {
    periksa("pemeriksaan saksi dikenali", kelas("Pemeriksaan Saksi Penggugat").includes("saksi"));
    periksa("pembuktian dikenali", kelas("Pembuktian Surat").includes("bukti"));
    periksa("mediasi dikenali", kelas("Mediasi").includes("mediasi"));
    periksa("jawaban dikenali", kelas("Jawaban Tergugat").includes("jawab_menjawab"));
    periksa("replik dikenali", kelas("Replik").includes("jawab_menjawab"));
    periksa("duplik dikenali", kelas("Duplik").includes("jawab_menjawab"));
    periksa("kesimpulan dikenali", kelas("Kesimpulan Para Pihak").includes("jawab_menjawab"));
    periksa("pembacaan putusan dikenali", kelas("Pembacaan Putusan").includes("putusan"));
    periksa("ikrar talak dikenali", kelas("Sidang Ikrar Talak").includes("ikrar_talak"));
    periksa("sidang pertama dikenali", kelas("Sidang Pertama / Upaya Damai").includes("sidang_pertama"));
    periksa("pemeriksaan setempat dikenali", kelas("Pemeriksaan Setempat").includes("pemeriksaan_setempat"));
    periksa("huruf besar-kecil tidak berpengaruh", kelas("PEMERIKSAAN SAKSI").includes("saksi"));
    periksa("spasi berlebih tidak berpengaruh", kelas("  Pemeriksaan   Saksi  ").includes("saksi"));
  }

  console.log("\n== 'Pemeriksaan Setempat' tidak tertukar dengan saksi ==");
  {
    const hasil = kelas("Pemeriksaan Setempat");
    periksa("tidak ikut masuk kelas saksi", !hasil.includes("saksi"));
    periksa("masuk kelas pemeriksaan setempat", hasil.includes("pemeriksaan_setempat"));
  }

  console.log("\n== Agenda gabungan ==");
  {
    const hasil = kelas("Pembuktian Surat dan Pemeriksaan Saksi");
    periksa("dua kelas dikenali sekaligus", hasil.includes("bukti") && hasil.includes("saksi"));

    const { lines } = agenda.describePreparation("Pembuktian Surat dan Pemeriksaan Saksi", {});
    const teks = lines.join(" | ").toLowerCase();
    periksa("persiapan saksi ikut disebut", teks.includes("saksi"));
    periksa("persiapan bukti ikut disebut", teks.includes("legalisir"));

    // "Bawa KTP asli" muncul di beberapa kelas sekaligus.
    const ktp = lines.filter((line) => /bawa ktp asli\.?$/i.test(line.trim()));
    periksa(`nasihat kembar tidak diulang (${ktp.length}x)`, ktp.length <= 1);

    const universal = lines.filter((line) => line === agenda.UNIVERSAL_ADVICE);
    periksa(`nasihat umum hanya sekali (${universal.length}x)`, universal.length === 1);
  }

  console.log("\n== ATURAN POKOK: jawab-menjawab cukup H-1 ==");
  {
    for (const teks of ["Jawaban Tergugat", "Replik", "Duplik", "Kesimpulan"]) {
      const plan = agenda.reminderPlan(teks, {});
      periksa(`${teks}: tidak diingatkan H-3`, plan.h3 === false);
      periksa(`${teks}: diingatkan H-1`, plan.h1 === true);
    }
  }

  console.log("\n== Agenda yang menuntut persiapan tetap diingatkan dua kali ==");
  {
    for (const teks of ["Pemeriksaan Saksi", "Pembuktian Surat", "Mediasi", "Sidang Ikrar Talak"]) {
      const plan = agenda.reminderPlan(teks, {});
      periksa(`${teks}: H-3 dan H-1`, plan.h3 === true && plan.h1 === true);
    }
  }

  console.log("\n== Agenda gabungan memakai aturan 'salah satu cukup' ==");
  {
    // Pembuktian butuh H-3, jawaban tidak. Gabungannya harus tetap H-3,
    // karena pembuktiannya memang perlu disiapkan berhari-hari sebelumnya.
    const plan = agenda.reminderPlan("Jawaban dan Pembuktian Surat", {});
    periksa("H-3 tetap dikirim", plan.h3 === true);
    periksa("H-1 juga dikirim", plan.h1 === true);
  }

  console.log("\n== Agenda tidak dikenali mempertahankan keadaan sekarang ==");
  {
    for (const teks of ["Agenda Baru Yang Belum Ada", "", null, undefined, "   "]) {
      const plan = agenda.reminderPlan(teks, {});
      periksa(`${JSON.stringify(teks)}: H-3 tetap jalan`, plan.h3 === true);
      periksa(`${JSON.stringify(teks)}: H-1 tidak menambah pesan`, plan.h1 === false);
      periksa(`${JSON.stringify(teks)}: kelas cadangan`, plan.classes.includes("lainnya"));
    }
  }

  console.log("\n== Persiapan tidak pernah kosong ==");
  {
    for (const teks of ["Pemeriksaan Saksi", "Agenda Antah Berantah", "", null]) {
      const blok = agenda.formatPreparation(teks, {});
      periksa(`${JSON.stringify(teks)}: ada isinya`, blok.trim().length > 0);
      periksa(`${JSON.stringify(teks)}: memakai judul baku`, blok.startsWith(agenda.PREPARATION_HEADING));
    }
  }

  console.log("\n== Penempelan ke pesan ==");
  {
    const pesan = "Sidang Anda Rabu, 09-09-2026.";
    const sekali = agenda.appendPreparation(pesan, "Pemeriksaan Saksi", {});
    periksa("pesan asli dipertahankan", sekali.startsWith(pesan));
    periksa("persiapan tertempel", sekali.includes(agenda.PREPARATION_HEADING));

    const duakali = agenda.appendPreparation(sekali, "Pemeriksaan Saksi", {});
    periksa("tidak menempel dua kali", duakali === sekali);

    periksa("pesan kosong dibiarkan", agenda.appendPreparation("", "Pemeriksaan Saksi", {}) === "");
    periksa("pesan null tidak melempar galat", agenda.appendPreparation(null, "Saksi", {}) === "");
  }

  console.log("\n== GAGAL-TERBUKA: tahap salah tetap mengirim ==");
  {
    periksa("tahap kosong -> tetap kirim", agenda.shouldRemind("Jawaban", "", {}) === true);
    periksa("tahap ngawur -> tetap kirim", agenda.shouldRemind("Jawaban", "h9", {}) === true);
    periksa("tahap null -> tetap kirim", agenda.shouldRemind("Jawaban", null, {}) === true);
    periksa("tahap h3 tetap menyaring", agenda.shouldRemind("Jawaban", "h3", {}) === false);
    periksa("tahap h1 meloloskan jawaban", agenda.shouldRemind("Jawaban", "h1", {}) === true);
    periksa("tahap H3 huruf besar tetap dikenali", agenda.shouldRemind("Jawaban", "H3", {}) === false);
  }

  console.log("\n== Penyuntingan dari portal ==");
  {
    const config = {
      sidangAgendaGuide: [
        { key: "saksi", persiapan: ["Bawa 2 orang saksi beserta kartu keluarga."] },
      ],
    };
    const { lines } = agenda.describePreparation("Pemeriksaan Saksi", config);
    const teks = lines.join(" | ");
    periksa("kalimat panitera dipakai", teks.includes("kartu keluarga"));
    periksa("kalimat bawaan diganti, bukan ditambah", !teks.includes("anak kandung"));
    periksa("nasihat umum tetap ada", lines.includes(agenda.UNIVERSAL_ADVICE));
  }

  console.log("\n== Penyuntingan portal dapat menambah kelas baru ==");
  {
    const config = {
      sidangAgendaGuide: [
        { key: "sumpah", label: "Sumpah", patterns: ["sumpah"], h3: true, h1: true, persiapan: ["Bawa KTP asli."] },
      ],
    };
    const plan = agenda.reminderPlan("Sidang Sumpah Decisoir", config);
    periksa("kelas baru dikenali", plan.classes.includes("sumpah"));
    periksa("kelas baru punya jadwal sendiri", plan.h3 === true && plan.h1 === true);
  }

  console.log("\n== Salah ketik di portal tidak mematikan pengingat ==");
  {
    const config = {
      sidangAgendaGuide: [
        // h3 ditulis sebagai teks, bukan boolean - harus diabaikan.
        { key: "saksi", h3: "tidak", h1: "ya" },
        { key: "", persiapan: ["diabaikan"] },
        null,
        "bukan objek",
      ],
    };
    const plan = agenda.reminderPlan("Pemeriksaan Saksi", config);
    periksa("h3 bawaan dipertahankan", plan.h3 === true);
    periksa("h1 bawaan dipertahankan", plan.h1 === true);
    periksa("entri tanpa key diabaikan", plan.classes.includes("saksi"));
  }

  console.log("\n== Tidak ada jejak kode di kalimat persiapan ==");
  {
    let bermasalah = [];
    for (const item of agenda.listClasses({})) {
      for (const line of item.persiapan) {
        if (findCodeArtifacts(line).length > 0) bermasalah.push(`${item.key}: ${line}`);
      }
    }
    periksa(`kalimat bersih dari nama kolom (${bermasalah.length} bermasalah)`, bermasalah.length === 0);
  }

  console.log("\n== LARANGAN: tidak menyebut nama pegawai ==");
  {
    // Nama hakim, panitera, dan jurusita dilarang disampaikan ke pihak demi
    // keamanan mereka. Penjagaan ini membaca berkas sumbernya langsung, supaya
    // penambahan kolom nama pegawai di kemudian hari langsung ketahuan.
    const sumber = fs.readFileSync(
      path.resolve(__dirname, "..", "services", "sidangAgendaService.js"),
      "utf8"
    );
    const terlarang = ["hakim_nama", "panitera_nama", "jurusita_nama", "majelis_hakim", "hakim_pn", "perkara_hakim_pn"];
    const ditemukan = terlarang.filter((kolom) => sumber.includes(kolom));
    periksa(`tidak membaca kolom nama pegawai (${ditemukan.join(", ") || "bersih"})`, ditemukan.length === 0);

    const semuaKalimat = agenda
      .listClasses({})
      .flatMap((item) => item.persiapan)
      .concat(agenda.FALLBACK_CLASS.persiapan)
      .join(" ");
    periksa("kalimat tidak menyuruh menghubungi hakim", !/hubungi\s+(majelis\s+)?hakim/i.test(semuaKalimat));
  }

  console.log("\n== Kelas bawaan lengkap dan tidak kembar ==");
  {
    const kunci = agenda.DEFAULT_AGENDA_CLASSES.map((item) => item.key);
    periksa("tidak ada kunci kembar", new Set(kunci).size === kunci.length);
    periksa("setiap kelas punya persiapan", agenda.DEFAULT_AGENDA_CLASSES.every((item) => item.persiapan.length > 0));
    periksa("setiap kelas punya pola cocok", agenda.DEFAULT_AGENDA_CLASSES.every((item) => item.patterns.length > 0));
    periksa(
      "setiap kelas diingatkan minimal sekali",
      agenda.DEFAULT_AGENDA_CLASSES.every((item) => item.h3 === true || item.h1 === true)
    );
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
}

utama();
