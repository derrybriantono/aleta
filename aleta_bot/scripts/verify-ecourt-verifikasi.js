#!/usr/bin/env node
"use strict";

/**
 * Memeriksa verifikasi dokumen oleh hakim — Tahap 4-6.
 *
 *   node scripts/verify-ecourt-verifikasi.js
 *
 * ============================================================================
 * SIKAP YANG DIUJI DI SINI KEBALIKAN DARI SELURUH SKRIP LAIN
 * ============================================================================
 *
 * Di seluruh bagian ALETA lain, pengaman dibuat GAGAL-TERBUKA: bila ada yang
 * bermasalah, pesan tetap dikirim, karena mendiamkan pemberitahuan pengadilan
 * lebih merugikan daripada risiko yang dihindarinya.
 *
 * Di sini terbalik. Verifikasi adalah keputusan hukum yang menentukan apakah
 * dokumen resmi masuk berkas perkara. Setiap penjagaan harus GAGAL-TERTUTUP:
 * apa pun yang tidak dapat dipastikan berakhir dengan MENOLAK.
 *
 * Tiga hal yang diuji paling keras:
 *   1. Bukan hakim, atau hakim di luar majelis -> DITOLAK.
 *   2. Balasan yang tidak persis -> keputusan TIDAK tersimpan.
 *   3. Dialog e-Court yang tidak cocok -> TIDAK disentuh sama sekali.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");

const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), "aleta-verif-"));
process.env.ALETA_BOT_ECOURT_DOCUMENT_ROOT = SANDBOX;

// --- Tiruan database ---
const botDbPath = require.resolve("../services/botDbService");
const botDbAsli = require("../services/botDbService");
const botState = { dokumen: [], verifikasi: [], gagal: false };
require.cache[botDbPath].exports = {
  ensureSchema: async () => true,
  addColumnIfMissing: async () => true,
  addIndexIfMissing: async () => true,
  toMysqlDate: (value) => new Date(value).toISOString().slice(0, 19).replace("T", " "),
  fromMysqlDate: botDbAsli.fromMysqlDate,
  query: async (sql, params = []) => {
    if (botState.gagal) throw new Error("database ALETA tidak dapat dijangkau");
    if (/^\s*CREATE TABLE/i.test(sql)) return [];
    if (/FROM aleta_bot_ecourt_documents/i.test(sql) && /document_key = \?/.test(sql)) {
      return botState.dokumen.filter((d) => d.document_key === params[0]);
    }
    if (/FROM aleta_bot_ecourt_documents/i.test(sql)) {
      return botState.dokumen.filter((d) => d.status_verifikasi === "belum");
    }
    if (/FROM aleta_bot_ecourt_verifications/i.test(sql) && /document_key = \?/.test(sql)) {
      return botState.verifikasi.filter((v) => v.document_key === params[0]);
    }
    if (/INSERT INTO aleta_bot_ecourt_verifications/i.test(sql)) {
      // Menirukan kunci unik per dokumen: yang sudah ada ditimpa, bukan
      // ditambah - persis perilaku ON DUPLICATE KEY UPDATE di MySQL.
      const adaIndeks = botState.verifikasi.findIndex((v) => v.document_key === params[1]);
      const baris = {
        document_key: params[1],
        keputusan: params[6],
        nama_hakim: params[5],
        diteruskan_pada: adaIndeks >= 0 ? botState.verifikasi[adaIndeks].diteruskan_pada : null,
      };
      if (adaIndeks >= 0) botState.verifikasi[adaIndeks] = baris;
      else botState.verifikasi.push(baris);
      return { affectedRows: 1 };
    }
    return [];
  },
  getDbStatus: () => ({ ok: true }),
};

const dbPath = require.resolve("../db_config");
require("../db_config");
const sippState = { majelis: [], gagal: false };
require.cache[dbPath].exports = {
  query(sql, params, callback) {
    const selesai = typeof params === "function" ? params : callback;
    if (typeof selesai !== "function") return;
    if (sippState.gagal) selesai(new Error("SIPP tidak dapat dijangkau"));
    else selesai(null, sippState.majelis.map((nama) => ({ nama_gelar: nama })));
  },
};

const verifikasi = require("../services/ecourtVerificationService");
const penerus = require("../tools/ecourt-bridge/kirim-verifikasi");

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

const HAKIM = {
  name: "DERRY BRIANTONO, S.H.",
  roleId: "hakim",
  positionName: "Hakim",
  whatsappNumber: "6285242120977",
};
const CONFIG = { employeeRecipients: [HAKIM] };
const NOMOR_HAKIM = "6285242120977@c.us";
const NOMOR_ORANG_LAIN = "6281245004420@c.us";

const DOKUMEN = {
  document_key: "kunci-dokumen-1",
  nomor_perkara: "620/Pdt.G/2025/PA.Dgl",
  judul_dokumen: "Jawaban Tergugat Sri Astuti Ningsih",
  peran_pengunggah: "Tergugat",
  status_verifikasi: "belum",
  berkas_pdf: null,
  berkas_word: null,
  diunggah_pada: new Date(2025, 11, 9, 11, 30),
};

async function bukaSampaiPutuskan() {
  verifikasi.clearAllSessions();
  botState.dokumen = [{ ...DOKUMEN }];
  botState.verifikasi = [];
  sippState.majelis = ["Derry Briantono, S.H.", "Ahmad Fauzi, S.H."];
  await verifikasi.handleMessage({ senderNumber: NOMOR_HAKIM, text: "verifikasi", runtimeConfig: CONFIG });
  await verifikasi.handleMessage({ senderNumber: NOMOR_HAKIM, text: "1", runtimeConfig: CONFIG });
}

async function utama() {
  console.log("\n== Pengenalan hakim dari nomor WhatsApp ==");
  {
    const hakim = verifikasi.identifyJudge(NOMOR_HAKIM, CONFIG);
    periksa("hakim terdaftar dikenali", hakim !== null && hakim.nama === "DERRY BRIANTONO, S.H.");
    periksa("gelar dibuang untuk pencocokan", hakim.namaPencarian === "DERRY BRIANTONO");
    periksa("nomor tak terdaftar ditolak", verifikasi.identifyJudge(NOMOR_ORANG_LAIN, CONFIG) === null);
    periksa("nomor kosong ditolak", verifikasi.identifyJudge("", CONFIG) === null);

    const pegawaiBukanHakim = { ...HAKIM, roleId: "panitera", positionName: "Panitera Pengganti" };
    periksa(
      "pegawai bukan hakim ditolak",
      verifikasi.identifyJudge(NOMOR_HAKIM, { employeeRecipients: [pegawaiBukanHakim] }) === null
    );

    const ketua = { ...HAKIM, roleId: "ketua", positionName: "Ketua Pengadilan" };
    periksa(
      "Ketua Pengadilan diterima (ikut bersidang)",
      verifikasi.identifyJudge(NOMOR_HAKIM, { employeeRecipients: [ketua] }) !== null
    );
  }

  console.log("\n== ATURAN POKOK: hanya majelis perkara itu ==");
  {
    sippState.gagal = false;
    sippState.majelis = ["Derry Briantono, S.H.", "Ahmad Fauzi, S.H."];
    const anggota = await verifikasi.isOnPanel("620/Pdt.G/2025/PA.Dgl", "DERRY BRIANTONO");
    periksa("hakim majelis dikenali", anggota.anggota === true);

    const bukan = await verifikasi.isOnPanel("620/Pdt.G/2025/PA.Dgl", "RUSDI SALAM");
    periksa("hakim di luar majelis DITOLAK", bukan.anggota === false && bukan.alasan === "bukan_anggota_majelis");

    sippState.majelis = [];
    const kosong = await verifikasi.isOnPanel("620/Pdt.G/2025/PA.Dgl", "DERRY BRIANTONO");
    periksa("majelis belum ditetapkan -> ditolak", kosong.anggota === false);

    // GAGAL-TERTUTUP: kebalikan dari seluruh layanan ALETA lain.
    sippState.gagal = true;
    const sippMati = await verifikasi.isOnPanel("620/Pdt.G/2025/PA.Dgl", "DERRY BRIANTONO");
    sippState.gagal = false;
    periksa("SIPP bermasalah -> DITOLAK, bukan diizinkan", sippMati.anggota === false);
    periksa("alasannya dicatat", /sipp_tidak_terbaca/.test(sippMati.alasan));

    periksa("nama kosong ditolak", (await verifikasi.isOnPanel("620/Pdt.G/2025/PA.Dgl", "")).anggota === false);
  }

  console.log("\n== Pencocokan nama utuh, bukan potongan ==");
  {
    sippState.majelis = ["Derry Briantono Wijaya, S.H."];
    const beda = await verifikasi.isOnPanel("620/Pdt.G/2025/PA.Dgl", "DERRY BRIANTONO");
    periksa("nama beririsan TIDAK diloloskan", beda.anggota === false);

    sippState.majelis = ["Dr. H. Derry Briantono, S.H., M.H."];
    const bergelar = await verifikasi.isOnPanel("620/Pdt.G/2025/PA.Dgl", "DERRY BRIANTONO");
    periksa("gelar depan dan belakang tidak menghalangi", bergelar.anggota === true);
  }

  console.log("\n== Bukan hakim tidak dapat membuka menu ==");
  {
    verifikasi.clearAllSessions();
    const hasil = await verifikasi.handleMessage({
      senderNumber: NOMOR_ORANG_LAIN,
      text: "verifikasi",
      runtimeConfig: CONFIG,
    });
    periksa("ditolak dengan penjelasan", hasil !== null && /hanya dapat dipakai hakim/i.test(hasil.reply));
    periksa("tidak membocorkan daftar dokumen", !/Jawaban Tergugat/.test(hasil.reply));
  }

  console.log("\n== Pesan biasa tidak tertangkap menu verifikasi ==");
  {
    verifikasi.clearAllSessions();
    for (const teks of ["halo", "1", "menu", "jadwal#123.G.2026", "berhenti"]) {
      const hasil = await verifikasi.handleMessage({ senderNumber: NOMOR_HAKIM, text: teks, runtimeConfig: CONFIG });
      periksa(`"${teks}" diteruskan ke alur lain`, hasil === null);
    }
  }

  console.log("\n== Alur lengkap: buka, pilih, putuskan ==");
  {
    await bukaSampaiPutuskan();
    const putusan = await verifikasi.handleMessage({
      senderNumber: NOMOR_HAKIM,
      text: verifikasi.CONFIRM_VALID,
      runtimeConfig: CONFIG,
    });
    periksa("keputusan tersimpan", botState.verifikasi.length === 1 && botState.verifikasi[0].keputusan === "valid");
    periksa("balasan menyebut keputusannya", /VALID/.test(putusan.reply));
    periksa(
      "balasan jujur bahwa e-Court belum berubah",
      /belum berubah|menunggu diteruskan/i.test(putusan.reply)
    );
    periksa("nama hakim tercatat", botState.verifikasi[0].nama_hakim === "DERRY BRIANTONO, S.H.");
  }

  console.log("\n== Keputusan yang SUDAH diteruskan tidak dapat diubah ==");
  {
    // Barisnya berkunci unik per dokumen dan penyimpanannya menimpa. Selama
    // masih mengantre itu benar - hakim boleh berubah pikiran. Sesudah
    // diteruskan tidak: e-Court sudah memegang keputusan yang lama, penerusan
    // hanya mengambil baris yang belum diteruskan, dan menimpa tidak
    // mengembalikannya ke antrean. Yang tertinggal adalah ALETA menyebut satu
    // keputusan sementara sistem resmi memuat yang lain.
    // Pembuka sendiri, TANPA mengosongkan tabel verifikasi - yang diuji di
    // sini justru keputusan yang sudah tersimpan sebelumnya.
    const bukaSaja = async () => {
      verifikasi.clearAllSessions();
      botState.dokumen = [{ ...DOKUMEN }];
      sippState.majelis = ["Derry Briantono, S.H.", "Ahmad Fauzi, S.H."];
      await verifikasi.handleMessage({ senderNumber: NOMOR_HAKIM, text: "verifikasi", runtimeConfig: CONFIG });
      await verifikasi.handleMessage({ senderNumber: NOMOR_HAKIM, text: "1", runtimeConfig: CONFIG });
    };

    botState.verifikasi = [];
    await bukaSaja();
    await verifikasi.handleMessage({
      senderNumber: NOMOR_HAKIM,
      text: verifikasi.CONFIRM_VALID,
      runtimeConfig: CONFIG,
    });
    periksa("keputusan pertama tersimpan", botState.verifikasi[0].keputusan === "valid");

    // Masih mengantre: berubah pikiran diperbolehkan.
    await bukaSaja();
    await verifikasi.handleMessage({
      senderNumber: NOMOR_HAKIM,
      text: verifikasi.CONFIRM_INVALID,
      runtimeConfig: CONFIG,
    });
    periksa("belum diteruskan: keputusan boleh diubah", botState.verifikasi[0].keputusan === "tidak_valid");
    periksa("dan tidak beranak menjadi dua baris", botState.verifikasi.length === 1);

    // Sesudah diteruskan: ditolak.
    botState.verifikasi[0].diteruskan_pada = "2026-09-04 10:00:00";
    await bukaSaja();
    const ditolak = await verifikasi.handleMessage({
      senderNumber: NOMOR_HAKIM,
      text: verifikasi.CONFIRM_VALID,
      runtimeConfig: CONFIG,
    });
    periksa("sudah diteruskan: keputusan TIDAK berubah", botState.verifikasi[0].keputusan === "tidak_valid");
    periksa("dan sebabnya disebutkan, bukan galat", /sudah diteruskan ke e-Court/i.test(ditolak.reply));
    periksa(
      "petugas disuruh membetulkannya di e-Court",
      /dikerjakan langsung di e-Court/i.test(ditolak.reply)
    );

    botState.verifikasi = [];
  }

  console.log("\n== ATURAN POKOK: balasan harus PERSIS ==");
  {
    for (const jawaban of ["ya", "1", "valid", "VALID", "setuju", "ok", "SAYA SETUJU"]) {
      await bukaSampaiPutuskan();
      const hasil = await verifikasi.handleMessage({ senderNumber: NOMOR_HAKIM, text: jawaban, runtimeConfig: CONFIG });
      periksa(`"${jawaban}" TIDAK menyimpan keputusan`, botState.verifikasi.length === 0);
      periksa(`"${jawaban}" diberi petunjuk kalimat yang benar`, /SAYA SETUJU VALID/.test(hasil.reply));
    }
  }

  console.log("\n== Kalimat tidak valid juga harus persis ==");
  {
    await bukaSampaiPutuskan();
    await verifikasi.handleMessage({ senderNumber: NOMOR_HAKIM, text: verifikasi.CONFIRM_INVALID, runtimeConfig: CONFIG });
    periksa("tidak valid tersimpan", botState.verifikasi.length === 1 && botState.verifikasi[0].keputusan === "tidak_valid");
  }

  console.log("\n== BATAL tidak menyimpan apa pun ==");
  {
    await bukaSampaiPutuskan();
    const hasil = await verifikasi.handleMessage({ senderNumber: NOMOR_HAKIM, text: "BATAL", runtimeConfig: CONFIG });
    periksa("tidak ada keputusan tersimpan", botState.verifikasi.length === 0);
    periksa("dinyatakan tidak tersimpan", /tidak ada keputusan/i.test(hasil.reply));
  }

  console.log("\n== Majelis berubah di tengah alur -> ditolak ==");
  {
    await bukaSampaiPutuskan();
    // Hakim dimutasi setelah daftar ditampilkan, sebelum keputusan disimpan.
    sippState.majelis = ["Ahmad Fauzi, S.H."];
    const hasil = await verifikasi.handleMessage({
      senderNumber: NOMOR_HAKIM,
      text: verifikasi.CONFIRM_VALID,
      runtimeConfig: CONFIG,
    });
    periksa("keputusan TIDAK tersimpan", botState.verifikasi.length === 0);
    periksa("dijelaskan alasannya", /bukan.*majelis|tidak tercatat sebagai majelis/i.test(hasil.reply));
    sippState.majelis = ["Derry Briantono, S.H."];
  }

  console.log("\n== Daftar hanya memuat perkara yang ditangani hakim itu ==");
  {
    verifikasi.clearAllSessions();
    botState.dokumen = [
      { ...DOKUMEN, document_key: "a", nomor_perkara: "620/Pdt.G/2025/PA.Dgl" },
      { ...DOKUMEN, document_key: "b", nomor_perkara: "999/Pdt.G/2025/PA.Dgl" },
    ];
    // Hanya perkara 620 yang majelisnya memuat hakim ini.
    let dipanggil = 0;
    const aslinya = require.cache[dbPath].exports.query;
    require.cache[dbPath].exports.query = (sql, params, callback) => {
      dipanggil += 1;
      const selesai = typeof params === "function" ? params : callback;
      const nomor = Array.isArray(params) ? params[0] : "";
      const majelis = nomor === "620/Pdt.G/2025/PA.Dgl" ? [{ nama_gelar: "Derry Briantono, S.H." }] : [];
      selesai(null, majelis);
    };

    const hakim = verifikasi.identifyJudge(NOMOR_HAKIM, CONFIG);
    const daftar = await verifikasi.listPendingForJudge(hakim);
    require.cache[dbPath].exports.query = aslinya;

    periksa(`hanya satu perkara masuk daftar (${daftar.length})`, daftar.length === 1);
    periksa("perkara yang benar", daftar[0].nomor_perkara === "620/Pdt.G/2025/PA.Dgl");
    periksa("majelis diperiksa per perkara", dipanggil >= 2);
  }

  console.log("\n== TAHAP 6: dialog e-Court harus cocok sebelum disentuh ==");
  {
    const keputusan = { judul_dokumen: "Jawaban Tergugat Sri Astuti Ningsih", keputusan: "valid" };

    const cocok = penerus.dialogMatchesDocument(
      { namaDokumen: "Jawaban Tergugat Sri Astuti Ningsih", adaRadioValid: true, adaTombolSimpan: true },
      keputusan
    );
    periksa("dialog cocok diterima", cocok.cocok === true);

    const salah = penerus.dialogMatchesDocument(
      { namaDokumen: "Replik Penggugat", adaRadioValid: true, adaTombolSimpan: true },
      keputusan
    );
    periksa("DOKUMEN BERBEDA ditolak", salah.cocok === false && /judul_berbeda/.test(salah.alasan));

    periksa("dialog tidak ada -> ditolak", penerus.dialogMatchesDocument(null, keputusan).cocok === false);
    periksa(
      "nama dokumen tidak terbaca -> ditolak",
      penerus.dialogMatchesDocument({ namaDokumen: "", adaRadioValid: true, adaTombolSimpan: true }, keputusan).cocok === false
    );
    periksa(
      "pilihan valid tidak ada -> ditolak",
      penerus.dialogMatchesDocument({ namaDokumen: keputusan.judul_dokumen, adaRadioValid: false, adaTombolSimpan: true }, keputusan).cocok === false
    );
    periksa(
      "tombol simpan tidak ada -> ditolak",
      penerus.dialogMatchesDocument({ namaDokumen: keputusan.judul_dokumen, adaRadioValid: true, adaTombolSimpan: false }, keputusan).cocok === false
    );
    periksa(
      "judul yang dimaksud tidak diketahui -> ditolak",
      penerus.dialogMatchesDocument({ namaDokumen: "apa saja", adaRadioValid: true, adaTombolSimpan: true }, { judul_dokumen: "" }).cocok === false
    );
  }

  console.log("\n== TAHAP 6: uji kering adalah perilaku bawaan ==");
  {
    periksa("tanpa tanda -> tidak mengirim", penerus.parseArgs([]).kirim === false);
    periksa("--kirim diperlukan untuk mengirim", penerus.parseArgs(["--kirim"]).kirim === true);

    const sumber = fs.readFileSync(path.resolve(__dirname, "..", "tools", "ecourt-bridge", "kirim-verifikasi.js"), "utf8");
    periksa("meminta konfirmasi petugas", /await tanya\(/.test(sumber));
    periksa("login manual, bukan otomatis", /waitForManualLogin/.test(sumber));
    periksa("peramban terlihat", /headless:\s*false/.test(sumber));
    periksa("tidak berjalan saat sekadar di-require", /require\.main === module/.test(sumber));
    periksa("tidak menyentuh captcha", !/captcha[^\n]*(type|solve|ocr|screenshot)/i.test(sumber));
  }

  console.log("\n== Jejak keamanan tercatat ==");
  {
    const sumber = fs.readFileSync(path.resolve(__dirname, "..", "services", "ecourtVerificationService.js"), "utf8");
    periksa("keputusan dicatat sebagai peristiwa keamanan", /ecourt_verification_recorded/.test(sumber));
    periksa("penolakan ikut dicatat", /ecourt_verification_denied/.test(sumber));
    periksa("nama hakim dan keputusan tersimpan", /namaHakim[\s\S]{0,80}keputusan/.test(sumber));
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
