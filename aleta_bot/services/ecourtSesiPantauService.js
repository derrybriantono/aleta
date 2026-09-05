"use strict";

/**
 * Menjaga sesi e-Court tetap hidup, dan memberi tahu saat ia mati.
 *
 * ============================================================================
 * DUA PEKERJAAN SEKALIGUS DARI SATU KUNJUNGAN
 * ============================================================================
 *
 * Sesi e-Court mati karena dua sebab: menganggur terlalu lama, dan masa berlaku
 * yang memang habis. Sebab yang pertama dapat dicegah - satu kunjungan ringan
 * secara berkala menyegarkan sesinya di sisi server.
 *
 * Kunjungan yang sama sekaligus menjawab pertanyaan kedua: masih hidup atau
 * tidak. Karena itu detak ini memakai periksaSesi yang sudah ada, bukan alur
 * tersendiri - satu jalur, satu perilaku.
 *
 * ============================================================================
 * TIDAK PERNAH BERSAMAAN DENGAN PENARIKAN
 * ============================================================================
 *
 * Profil peramban hanya dapat dipakai SATU proses. Membuka peramban kedua di
 * atas profil yang sedang dipakai jembatan akan gagal, dan pada keadaan
 * tertentu merusak profilnya - artinya sesi hilang justru oleh mekanisme yang
 * dimaksudkan menjaganya.
 *
 * Karena itu detak dilewati ketika penarikan sedang berjalan, ketika ada
 * penarikan lain di luar bot, dan ketika ada formulir login yang menunggu
 * jawaban petugas. Detak yang terlewat tidak merugikan: yang berikutnya datang
 * beberapa menit lagi.
 *
 * ============================================================================
 * PERINGATAN DIKIRIM SEKALI, BUKAN TIAP DETAK
 * ============================================================================
 *
 * Sesi yang mati akan tetap mati sampai ada manusia yang login. Mengirim
 * WhatsApp tiap detak berarti puluhan pesan semalam untuk satu keadaan yang
 * sama - dan pesan yang terlalu sering justru berhenti dibaca. Peringatan
 * dikirim saat keadaannya BERUBAH menjadi mati, lalu diulang paling cepat
 * beberapa jam kemudian.
 */

const { readRuntimeConfig, writeRuntimeConfig } = require("../config/runtime-config");
const logService = require("./logService");
const messageQueueService = require("./messageQueueService");
const ecourtLoginService = require("./ecourtLoginService");
const ecourtSchedulerService = require("./ecourtSchedulerService");

const BAWAAN = {
  aktif: false,
  jedaMenit: 10,
  jedaPeringatanJam: 4,
};

const keadaan = {
  timer: null,
  sedangDetak: false,
  terakhirDetak: null,
  terakhirHasil: "",
  // true hidup, false mati, null belum diketahui atau tidak dapat dipastikan.
  berlaku: null,
  terakhirPeringatan: null,
  jumlahDetak: 0,
  jumlahDilewati: 0,
};

function angka(nilai, bawaan, min, maks) {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return bawaan;
  return Math.min(Math.max(Math.floor(n), min), maks);
}

function getSettings() {
  const tersimpan = (readRuntimeConfig() || {}).ecourtPantauSesi || {};
  return {
    aktif: tersimpan.aktif === true,
    jedaMenit: angka(tersimpan.jedaMenit, BAWAAN.jedaMenit, 5, 60),
    jedaPeringatanJam: angka(tersimpan.jedaPeringatanJam, BAWAAN.jedaPeringatanJam, 1, 24),
  };
}

function saveSettings({ aktif, jedaMenit, jedaPeringatanJam, olehSiapa = "" }) {
  const jeda = angka(jedaMenit, BAWAAN.jedaMenit, 5, 60);
  const peringatan = angka(jedaPeringatanJam, BAWAAN.jedaPeringatanJam, 1, 24);

  const sekarang = readRuntimeConfig();
  writeRuntimeConfig({
    ...sekarang,
    ecourtPantauSesi: { aktif: aktif === true, jedaMenit: jeda, jedaPeringatanJam: peringatan },
  });

  void logService.logSecurityEvent({
    eventType: "ecourt_pantau_sesi_disunting",
    severity: "warning",
    message: aktif === true ? "Pemantau sesi e-Court dinyalakan." : "Pemantau sesi e-Court dimatikan.",
    metadata: { aktif: aktif === true, jedaMenit: jeda, olehSiapa: String(olehSiapa || "") },
  });

  mulaiUlang();
  return { ok: true, alasan: "" };
}

/** Nomor admin yang menerima peringatan. */
function nomorAdmin() {
  const config = readRuntimeConfig() || {};
  return String(config.adminWhatsappNumber || "").trim();
}

/**
 * Mengirim peringatan sesi mati ke admin.
 *
 * Isinya menyebutkan apa yang harus dikerjakan, bukan hanya bahwa ada yang
 * salah. Pesan yang hanya berbunyi "sesi habis" menuntut penerimanya menebak
 * langkah berikutnya - dan pada pukul tujuh pagi tebakan itu memakan waktu.
 */
async function kirimPeringatan(alasan) {
  const nomor = nomorAdmin();
  if (!nomor) {
    void logService.logSystemEvent({
      eventType: "ecourt_sesi_mati_tanpa_nomor_admin",
      severity: "warning",
      message: "Sesi e-Court mati, tetapi nomor WhatsApp admin belum diatur.",
      metadata: { alasan },
    });
    return { terkirim: false, alasan: "nomor_admin_kosong" };
  }

  const pesan = [
    "*ALETA - Sesi e-Court habis*",
    "",
    "Penarikan berkas e-Court berhenti karena sesinya sudah tidak berlaku.",
    "",
    "Yang perlu dikerjakan:",
    "1. Buka ALETA - menu Integrasi e-Court",
    "2. Login e-Court dari sana (captcha diisi di layar itu)",
    "3. Penarikan berjalan lagi dengan sendirinya",
    "",
    "Berkas yang sudah tersimpan tidak diunduh ulang.",
  ].join("\n");

  // Kunci idempotensi memuat tanggal DAN jam, sehingga peringatan berulang
  // pada hari yang sama tetap terkirim - tetapi dua detak dalam satu jam yang
  // sama tidak menghasilkan dua pesan.
  const sekarang = new Date();
  const kunciJam = `${sekarang.toISOString().slice(0, 13)}`;

  await messageQueueService.enqueueMessage({
    idempotencyKey: `ecourt-sesi-mati:${kunciJam}`,
    recipientNumber: nomor,
    recipientName: "Admin ALETA",
    message: pesan,
    category: "employee",
    notificationKey: "ecourt_sesi_habis",
    priority: 8,
    sourceApp: "aleta_bot",
    sourceFeature: "ecourt_pantau_sesi",
  });

  keadaan.terakhirPeringatan = sekarang.toISOString();

  void logService.logSystemEvent({
    eventType: "ecourt_sesi_peringatan_dikirim",
    severity: "warning",
    message: "Peringatan sesi e-Court habis dikirim ke admin.",
    metadata: { alasan },
  });

  return { terkirim: true, alasan: "" };
}

/** Apakah peringatan boleh dikirim lagi sekarang? */
function bolehMemperingatkanLagi() {
  if (!keadaan.terakhirPeringatan) return true;
  const jeda = getSettings().jedaPeringatanJam * 60 * 60 * 1000;
  return Date.now() - Date.parse(keadaan.terakhirPeringatan) >= jeda;
}

/**
 * Satu detak.
 *
 * @param {{ paksa?: boolean }} opsi paksa melewati pemeriksaan penarikan -
 *   dipakai tombol "periksa sekarang", yang tetap menghormati penarikan
 *   berjalan tetapi tidak menghormati jeda peringatan.
 */
async function detak({ paksa = false } = {}) {
  if (keadaan.sedangDetak) {
    return { dilewati: true, alasan: "detak_sebelumnya_belum_selesai" };
  }

  const statusJadwal = ecourtSchedulerService.getStatus();
  if (statusJadwal.sedangJalan || statusJadwal.adaPenarikanLain) {
    keadaan.jumlahDilewati += 1;
    // Bukan kegagalan: penarikan yang berjalan justru bukti sesinya hidup.
    return { dilewati: true, alasan: "penarikan_sedang_berjalan" };
  }

  if (ecourtLoginService.sedangMenunggu()) {
    keadaan.jumlahDilewati += 1;
    return { dilewati: true, alasan: "menunggu_petugas_login" };
  }

  keadaan.sedangDetak = true;
  try {
    const hasil = await ecourtLoginService.periksaSesi({ cepat: false });

    keadaan.terakhirDetak = new Date().toISOString();
    keadaan.jumlahDetak += 1;
    keadaan.terakhirHasil = hasil.alasan || (hasil.berlaku ? "sesi_hidup" : "");

    const sebelumnya = keadaan.berlaku;
    keadaan.berlaku = hasil.berlaku;

    // Peringatan hanya untuk sesi yang benar-benar MATI. berlaku === null
    // berarti tidak dapat dipastikan - gerbang penegasan, atau pemeriksaan
    // yang gagal karena jaringan. Mengirim peringatan untuk keadaan yang
    // tidak pasti membuat peringatannya berhenti dipercaya.
    if (hasil.berlaku === false && (sebelumnya !== false || bolehMemperingatkanLagi() || paksa)) {
      await kirimPeringatan(hasil.alasan || "sesi_kedaluwarsa").catch(() => {});
    }

    // Sesi hidup kembali: penanda peringatan dilepas supaya kematian
    // berikutnya diberitahukan seketika, bukan menunggu jeda.
    if (hasil.berlaku === true) keadaan.terakhirPeringatan = null;

    return { dilewati: false, berlaku: hasil.berlaku, alasan: hasil.alasan || "" };
  } catch (galat) {
    keadaan.terakhirDetak = new Date().toISOString();
    keadaan.terakhirHasil = `gagal: ${galat.message}`;
    return { dilewati: false, berlaku: null, alasan: keadaan.terakhirHasil };
  } finally {
    keadaan.sedangDetak = false;
  }
}

function berhenti() {
  if (keadaan.timer) {
    clearInterval(keadaan.timer);
    keadaan.timer = null;
  }
}

function mulai() {
  berhenti();
  const pengaturan = getSettings();
  if (!pengaturan.aktif) return;

  keadaan.timer = setInterval(() => {
    void detak().catch(() => {});
  }, pengaturan.jedaMenit * 60 * 1000);

  // Node tidak perlu tetap hidup hanya karena pewaktu ini.
  if (keadaan.timer && typeof keadaan.timer.unref === "function") keadaan.timer.unref();
}

function mulaiUlang() {
  mulai();
}

function getStatus() {
  return {
    pengaturan: getSettings(),
    berjalan: keadaan.timer !== null,
    sedangDetak: keadaan.sedangDetak,
    berlaku: keadaan.berlaku,
    terakhirDetak: keadaan.terakhirDetak,
    terakhirHasil: keadaan.terakhirHasil,
    terakhirPeringatan: keadaan.terakhirPeringatan,
    jumlahDetak: keadaan.jumlahDetak,
    jumlahDilewati: keadaan.jumlahDilewati,
    nomorAdminTerisi: Boolean(nomorAdmin()),
  };
}

module.exports = {
  BAWAAN,
  berhenti,
  detak,
  getSettings,
  getStatus,
  mulai,
  mulaiUlang,
  saveSettings,
};
