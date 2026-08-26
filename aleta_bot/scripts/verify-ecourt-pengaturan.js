#!/usr/bin/env node
"use strict";

/**
 * Memeriksa pengaturan e-Court dan pelepasan nomor salah alamat.
 *
 *   node scripts/verify-ecourt-pengaturan.js
 *
 * ============================================================================
 * YANG DIUJI PALING KERAS
 * ============================================================================
 *
 *   1. Melepas nomor TIDAK langsung mengizinkan pengiriman. Pemiliknya ditanya
 *      sekali lagi, dan tetap dialah yang menentukan. Petugas hanya membuka
 *      kesempatan bertanya, bukan memutuskan atas nama orang lain.
 *
 *   2. Kelas bawaan tidak dapat dimatikan atau dialihkan tujuannya dari portal.
 *      Mematikan kelas "jawaban" akan membuat seluruh Jawaban berhenti
 *      diberitahukan tanpa satu pun pesan galat - hanya kesunyian yang
 *      terlihat normal.
 *
 *   3. Ambang di luar akal ditolak, bukan dipaksa masuk.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

// Runtime config diarahkan ke berkas sementara SEBELUM modul dimuat.
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), "aleta-set-"));
process.env.ALETA_BOT_RUNTIME_CONFIG_PATH = path.join(SANDBOX, "runtime-config.json");

// --- Tiruan database ---
const botDbPath = require.resolve("../services/botDbService");
require("../services/botDbService");
const baris = [];
require.cache[botDbPath].exports = {
  ensureSchema: async () => true,
  addColumnIfMissing: async () => true,
  toMysqlDate: (v) => new Date(v).toISOString().slice(0, 19).replace("T", " "),
  query: async (sql, params = []) => {
    if (/^\s*CREATE TABLE/i.test(sql)) return [];
    if (/INSERT INTO aleta_bot_nomor_terverifikasi/i.test(sql)) {
      baris.push({
        id: params[0], nomor: params[1], nama_pihak: params[2], nama_kunci: params[3],
        status: params[4], ditanya_pada: params[5], dijawab_pada: null,
        jawaban_mentah: "", jumlah_ditanya: 1,
      });
      return { affectedRows: 1 };
    }
    if (/UPDATE aleta_bot_nomor_terverifikasi/i.test(sql)) {
      // Pelepasan: status kembali menunggu, ditanya_pada dikosongkan.
      if (/dilepas_oleh/.test(sql)) {
        const r = baris.find((x) => x.id === params[4]);
        if (r) { r.status = params[0]; r.ditanya_pada = null; r.dijawab_pada = null; r.dilepas_oleh = params[1]; }
        return { affectedRows: 1 };
      }
      const r = baris.find((x) => x.id === params[4]);
      if (r) { r.status = params[0]; r.dijawab_pada = params[1]; r.jawaban_mentah = params[2]; }
      return { affectedRows: 1 };
    }
    if (/FROM aleta_bot_nomor_terverifikasi/i.test(sql)) {
      if (/nama_kunci = \?/.test(sql)) {
        return baris.filter((r) => r.nomor === params[0] && r.nama_kunci === params[1]);
      }
      if (/nomor = \?[\s\S]*status = \?/.test(sql)) {
        return baris.filter((r) => r.nomor === params[0] && r.status === params[1]);
      }
      if (/status = \?/.test(sql)) return baris.filter((r) => r.status === params[0]);
      return baris.slice();
    }
    return [];
  },
};

const verifikasiNomor = require("../services/nomorVerificationService");
const pengaturan = require("../services/ecourtSettingsService");
const klasifikasi = require("../services/ecourtEventClassifierService");

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

const NOMOR = "6285242120977";
const NAMA = "Sulastri binti Djanggola";

async function tolakNomor() {
  baris.length = 0;
  await verifikasiNomor.ensureVerified(NOMOR, NAMA);
  await verifikasiNomor.handleReply({ senderNumber: NOMOR, text: "bukan" });
}

async function utama() {
  console.log("\n== ATURAN POKOK: melepas nomor tidak langsung mengizinkan kirim ==");
  {
    await tolakNomor();
    periksa("nomor terkunci sebelum dilepas", (await verifikasiNomor.ensureVerified(NOMOR, NAMA)).boleh === false);

    const lepas = await verifikasiNomor.resetNumber(NOMOR, NAMA, { olehSiapa: "Panitera A" });
    periksa("pelepasan berhasil", lepas.ok === true);

    const sesudah = await verifikasiNomor.ensureVerified(NOMOR, NAMA);
    // Yang benar: BUKAN langsung boleh, melainkan bertanya lagi.
    periksa("TIDAK langsung boleh kirim", sesudah.boleh === false);
    periksa("statusnya menunggu jawaban", sesudah.status === verifikasiNomor.STATUS.MENUNGGU);
    periksa("pertanyaan diajukan ulang", typeof sesudah.pertanyaan === "string" && sesudah.pertanyaan.length > 0);
  }

  console.log("\n== Setelah dilepas, pemiliknya tetap yang menentukan ==");
  {
    await tolakNomor();
    await verifikasiNomor.resetNumber(NOMOR, NAMA, { olehSiapa: "Panitera A" });
    await verifikasiNomor.ensureVerified(NOMOR, NAMA);

    // Dijawab BUKAN lagi: terkunci kembali.
    await verifikasiNomor.handleReply({ senderNumber: NOMOR, text: "bukan" });
    periksa("dijawab BUKAN lagi -> terkunci lagi", (await verifikasiNomor.ensureVerified(NOMOR, NAMA)).boleh === false);

    // Dijawab YA: barulah boleh.
    await verifikasiNomor.resetNumber(NOMOR, NAMA, { olehSiapa: "Panitera A" });
    await verifikasiNomor.ensureVerified(NOMOR, NAMA);
    await verifikasiNomor.handleReply({ senderNumber: NOMOR, text: "YA" });
    periksa("dijawab YA -> baru boleh kirim", (await verifikasiNomor.ensureVerified(NOMOR, NAMA)).boleh === true);
  }

  console.log("\n== Hanya nomor ditolak yang dapat dilepas ==");
  {
    baris.length = 0;
    await verifikasiNomor.ensureVerified(NOMOR, NAMA);
    await verifikasiNomor.handleReply({ senderNumber: NOMOR, text: "YA" });

    const lepas = await verifikasiNomor.resetNumber(NOMOR, NAMA, { olehSiapa: "Panitera A" });
    periksa("nomor terverifikasi tidak dilepas", lepas.ok === false);
    periksa("alasannya jelas", lepas.alasan === "hanya_nomor_ditolak_yang_dapat_dilepas");
    periksa("kepercayaannya tidak hilang", (await verifikasiNomor.ensureVerified(NOMOR, NAMA)).boleh === true);

    const tidakAda = await verifikasiNomor.resetNumber("6281200000000", "Orang Lain", {});
    periksa("catatan tidak ada -> ditolak", tidakAda.ok === false);
    periksa("nomor tidak sah -> ditolak", (await verifikasiNomor.resetNumber("abc", NAMA, {})).ok === false);
  }

  console.log("\n== ATURAN POKOK: kelas bawaan tidak dapat dimatikan dari portal ==");
  {
    // Mencoba mematikan kelas "jawaban" - yang paling penting dari semuanya.
    const hasil = pengaturan.saveRule({
      key: "jawaban",
      patterns: ["jawaban"],
      notify: false,
      audience: "sendiri",
      olehSiapa: "penguji",
    });
    periksa("penyimpanan diterima", hasil.ok === true);

    const sesudah = pengaturan.getSettings();
    const jawaban = sesudah.aturan.find((x) => x.key === "jawaban");
    periksa("kelas jawaban TETAP memberitahukan", jawaban.notify === true);
    periksa("tujuannya TETAP pihak lawan", jawaban.audience === "lawan");
    periksa("ditandai sebagai bawaan", jawaban.bawaan === true);
  }

  console.log("\n== Pola judul memang tersimpan dan dipakai ==");
  {
    pengaturan.saveRule({
      key: "jawaban",
      patterns: ["jawaban", "tanggapan tergugat"],
      olehSiapa: "penguji",
    });

    const sesudah = pengaturan.getSettings();
    const jawaban = sesudah.aturan.find((x) => x.key === "jawaban");
    periksa("pola baru tersimpan", jawaban.patterns.includes("tanggapan tergugat"));

    // Yang sesungguhnya diuji: pengklasifikasi benar-benar memakainya.
    const { readRuntimeConfig } = require("../config/runtime-config");
    const keputusan = klasifikasi.decide(
      {
        judul_dokumen: "Tanggapan Tergugat",
        status_verifikasi: "valid",
        peran_pengunggah: "Tergugat",
      },
      readRuntimeConfig()
    );
    periksa("judul baru kini dikenali pengklasifikasi", keputusan.notify === true);
    periksa("dikenali sebagai jawaban", keputusan.classes.includes("jawaban"));

    // Pola tambahan TIDAK boleh menembus kelas yang melarang. Judul yang juga
    // memuat "gugatan" cocok dengan kelas pendaftaran - berkas milik pengunggah
    // sendiri - dan itu harus tetap menang. Tanpa penjagaan ini, panitera yang
    // menambah pola bisa tanpa sadar membuat ALETA mengirimi orang dokumennya
    // sendiri.
    const bentrok = klasifikasi.decide(
      {
        judul_dokumen: "Tanggapan Tergugat atas Gugatan",
        status_verifikasi: "valid",
        peran_pengunggah: "Tergugat",
      },
      readRuntimeConfig()
    );
    periksa("pola tambahan tidak menembus kelas yang melarang", bentrok.notify === false);
    periksa("alasannya tercatat", bentrok.reason === "berkas_pendaftaran_milik_pengunggah");
  }

  console.log("\n== Pola kosong ditolak ==");
  {
    for (const nilai of ["", "  ", ",,,", []]) {
      const hasil = pengaturan.saveRule({ key: "jawaban", patterns: nilai, olehSiapa: "penguji" });
      periksa(`pola ${JSON.stringify(nilai)} ditolak`, hasil.ok === false && hasil.alasan === "pola_kosong");
    }
    periksa("kunci kosong ditolak", pengaturan.saveRule({ key: "", patterns: ["x"] }).alasan === "kunci_kosong");
  }

  console.log("\n== Kelas tambahan menuntut tujuan yang dikenali ==");
  {
    const tanpaTujuan = pengaturan.saveRule({ key: "kontra-memori", patterns: ["kontra memori"], olehSiapa: "penguji" });
    periksa("tanpa tujuan ditolak", tanpaTujuan.ok === false && tanpaTujuan.alasan === "audience_tidak_dikenali");

    const tujuanNgawur = pengaturan.saveRule({
      key: "kontra-memori",
      patterns: ["kontra memori"],
      audience: "semua orang",
      olehSiapa: "penguji",
    });
    periksa("tujuan tidak dikenali ditolak", tujuanNgawur.ok === false);

    const sah = pengaturan.saveRule({
      key: "kontra-memori",
      patterns: ["kontra memori"],
      audience: "lawan",
      olehSiapa: "penguji",
    });
    periksa("tujuan sah diterima", sah.ok === true);

    const daftar = pengaturan.getSettings().aturan.find((x) => x.key === "kontra-memori");
    periksa("kelas tambahan ditandai bukan bawaan", daftar.bawaan === false);
  }

  console.log("\n== Menghapus: bawaan kembali, tambahan hilang ==");
  {
    const hapusTambahan = pengaturan.deleteRule({ key: "kontra-memori", olehSiapa: "penguji" });
    periksa("aturan tambahan terhapus", hapusTambahan.ok === true);
    periksa(
      "hilang dari daftar",
      pengaturan.getSettings().aturan.every((x) => x.key !== "kontra-memori")
    );

    const hapusBawaan = pengaturan.deleteRule({ key: "jawaban", olehSiapa: "penguji" });
    periksa("timpaan bawaan terhapus", hapusBawaan.ok === true);
    periksa("dinyatakan kembali ke bawaan", hapusBawaan.kembaliKeBawaan === true);

    const jawaban = pengaturan.getSettings().aturan.find((x) => x.key === "jawaban");
    periksa("kelas jawaban TIDAK hilang", Boolean(jawaban));
    periksa("polanya kembali ke bawaan", !jawaban.patterns.includes("tanggapan tergugat"));
  }

  console.log("\n== Ambang di luar akal ditolak ==");
  {
    const kasus = [
      ["nol", 0, 3],
      ["minus", -5, 3],
      ["terlalu besar", 400, 3],
      ["bukan angka", "banyak", 3],
      ["tanya ulang nol", 3, 0],
      ["tanya ulang setahun", 3, 400],
    ];
    for (const [nama, ambang, tanyaUlang] of kasus) {
      const hasil = pengaturan.saveThresholds({ ambangMendesakHari: ambang, tanyaUlangHari: tanyaUlang });
      periksa(`${nama} ditolak`, hasil.ok === false);
    }

    const sah = pengaturan.saveThresholds({ ambangMendesakHari: 7, tanyaUlangHari: 14, olehSiapa: "penguji" });
    periksa("nilai wajar diterima", sah.ok === true);

    const sesudah = pengaturan.getSettings();
    periksa("ambang tersimpan", sesudah.ambangMendesakHari === 7);
    periksa("tanya ulang tersimpan", sesudah.tanyaUlangHari === 14);
  }

  console.log("\n== Ambang tersimpan benar-benar dipakai layanannya ==");
  {
    const panitera = require("../services/paniteraDashboardService");
    const { readRuntimeConfig } = require("../config/runtime-config");
    periksa("panitera memakai ambang tersimpan", panitera.ambangMendesakHari(readRuntimeConfig()) === 7);
    periksa(
      "tenggang tanya ulang memakai nilai tersimpan",
      verifikasiNomor.ulangiSetelahMs(readRuntimeConfig()) === 14 * 24 * 60 * 60 * 1000
    );
  }

  console.log("\n== PADANAN AGENDA dapat disunting panitera ==");
  {
    const awal = pengaturan.getAgendaSettings();
    periksa("daftar agenda terbaca", awal.agenda.length > 0);
    periksa("agenda bawaan ditandai", awal.agenda.some((x) => x.bawaan === true));

    const simpan = pengaturan.saveAgendaRule({
      key: "saksi",
      patterns: ["saksi", "pemeriksaan saksi", "keterangan saksi"],
      persiapan: ["Bawa dua orang saksi dewasa.", "Bawa KTP asli saksi."],
      olehSiapa: "penguji",
    });
    periksa("padanan tersimpan", simpan.ok === true);

    const sesudah = pengaturan.getAgendaSettings().agenda.find((x) => x.key === "saksi");
    periksa("pola baru tersimpan", sesudah.patterns.includes("keterangan saksi"));
    periksa("persiapan tersimpan", sesudah.persiapan.length === 2);

    // Yang sesungguhnya diuji: layanan agenda benar-benar memakainya.
    const agendaService = require("../services/sidangAgendaService");
    const { readRuntimeConfig } = require("../config/runtime-config");
    const kelas = agendaService.classifyAgenda("Keterangan Saksi Penggugat", readRuntimeConfig());
    periksa(
      "agenda baru kini dikenali",
      Array.isArray(kelas) && kelas.some((x) => x.key === "saksi")
    );
  }

  console.log("\n== Persiapan kosong ditolak ==");
  {
    for (const nilai of [[], ["", "  "], ""]) {
      const hasil = pengaturan.saveAgendaRule({ key: "saksi", patterns: ["saksi"], persiapan: nilai });
      periksa(`persiapan ${JSON.stringify(nilai)} ditolak`, hasil.ok === false && hasil.alasan === "persiapan_kosong");
    }
    periksa(
      "pola agenda kosong ditolak",
      pengaturan.saveAgendaRule({ key: "saksi", patterns: [], persiapan: ["x"] }).alasan === "pola_kosong"
    );
  }

  console.log("\n== Kapan diingatkan tidak dapat diubah untuk agenda bawaan ==");
  {
    pengaturan.saveAgendaRule({
      key: "saksi",
      patterns: ["saksi"],
      persiapan: ["Bawa saksi."],
      h3: false,
      h1: false,
      olehSiapa: "penguji",
    });
    const sesudah = pengaturan.getAgendaSettings().agenda.find((x) => x.key === "saksi");
    periksa("H-3 TETAP menyala", sesudah.h3 === true);
    periksa("H-1 TETAP menyala", sesudah.h1 === true);
  }

  console.log("\n== Menghapus padanan mengembalikan ke bawaan ==");
  {
    const hapus = pengaturan.deleteAgendaRule({ key: "saksi", olehSiapa: "penguji" });
    periksa("timpaan terhapus", hapus.ok === true && hapus.kembaliKeBawaan === true);
    const sesudah = pengaturan.getAgendaSettings().agenda.find((x) => x.key === "saksi");
    periksa("agenda saksi TIDAK hilang", Boolean(sesudah));
    periksa("polanya kembali ke bawaan", !sesudah.patterns.includes("keterangan saksi"));
  }

  console.log("\n== SESI e-Court: bertahan tanpa menyimpan sandi ==");
  {
    const fsx = require("fs");
    const pathx = require("path");
    const sumber = fsx.readFileSync(pathx.resolve(__dirname, "..", "tools", "ecourt-bridge", "sesi.js"), "utf8");

    periksa("memakai userDataDir", /userDataDir/.test(sumber));
    // Yang disimpan adalah HASIL login petugas, bukan sandinya.
    periksa("tidak menyimpan sandi", !/password|sandi\s*=|kataSandi/i.test(sumber));
    // Kata "isi" sengaja TIDAK dipakai di sini: kalimat penjelas seperti
    // "captcha tetap diisi manusia" akan ikut tertangkap, dan pemeriksa yang
    // berteriak pada kalimat yang benar akan diabaikan orang.
    periksa(
      "tidak ada pemecah captcha",
      !/2captcha|anticaptcha|captcha[^\\n]{0,40}(solve|ocr|recognize|bypass)/i.test(sumber)
    );
    periksa("folder dibuat dengan izin terbatas", /0o700/.test(sumber));
    periksa("folder di luar folder aplikasi", /homedir\(\)/.test(sumber));
    periksa("ada cara menghapus sesi", /function clearSession/.test(sumber));

    const run = fsx.readFileSync(pathx.resolve(__dirname, "..", "tools", "ecourt-bridge", "run.js"), "utf8");
    periksa("jembatan memakai sesi bertahan", /sesiEcourt\.launchOptions/.test(run));
    periksa("ada tanda --lupakan-sesi", /lupakan-sesi/.test(run));
    periksa("gagal menyiapkan sesi tidak menghentikan jembatan", /Peramban dibuka bersih/.test(run));
  }

  console.log(`\nLulus: ${lulus}, Gagal: ${gagal}`);
  try {
    fs.rmSync(SANDBOX, { recursive: true, force: true });
  } catch {
    /* dibersihkan sistem bila gagal */
  }

  if (gagal > 0) {
    console.log("ADA PERIKSAAN YANG GAGAL.");
    process.exit(1);
  }
  console.log("SEMUA PERIKSAAN LULUS.");
  process.exit(0);
}

utama().catch((error) => {
  console.error("Gagal menjalankan pengujian:", error);
  process.exit(1);
});
