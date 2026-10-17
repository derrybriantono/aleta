"use strict";

/**
 * Pemulihan sesi e-Court saat server menyala, dan login lewat WhatsApp.
 *
 * ============================================================================
 * MASALAH YANG DISELESAIKAN
 * ============================================================================
 *
 * Server ALETA sering dimatikan. Sesi e-Court ikut terputus, dan penarikan
 * berhenti sampai ada petugas yang membuka portal dan login. Selama itu
 * dokumen baru tidak terbaca.
 *
 * Layanan ini menutup dua celah:
 *
 *   1. SAAT BOT MENYALA - periksa sesi. Hidup: tarik segera, termasuk
 *      SUSULAN untuk rentang selama server mati (dari cap waktu penarikan
 *      terakhir yang berhasil). Mati: minta login lewat WhatsApp.
 *
 *   2. LOGIN LEWAT WHATSAPP - bot membuka halaman login e-Court, memotong
 *      gambar captcha, dan mengirimnya ke nomor super admin. Super admin
 *      membalas dengan kode pada gambar; bot mengisi surel dan sandi TERSIMPAN
 *      beserta kode itu, lalu masuk dan menarik.
 *
 * ============================================================================
 * CAPTCHA TETAP DIJAWAB MANUSIA
 * ============================================================================
 *
 * Tidak ada OCR, tidak ada layanan pemecah. Gambar hanya DITERUSKAN ke
 * manusia dan jawabannya diteruskan kembali - sama seperti login dari portal
 * (ecourtLoginService). Jawaban hanya berlaku untuk captcha yang sedang
 * menunggu, hanya beberapa menit, dan hanya bila datang dari nomor super
 * admin yang tersimpan.
 *
 * ============================================================================
 * SANDI TIDAK PERNAH LEWAT WHATSAPP
 * ============================================================================
 *
 * Surel dan sandi diisi bot dari simpanan tersandi (ecourtKredensialService),
 * di dalam proses bot. Yang lewat WhatsApp hanya gambar captcha (ke admin) dan
 * kode captcha (dari admin). Bila akun belum punya simpanan sandi, login lewat
 * WhatsApp ditolak dan admin diarahkan ke portal - sandi tidak diminta lewat
 * chat.
 *
 * ============================================================================
 * BATAS PERCOBAAN
 * ============================================================================
 *
 * Captcha salah atau kedaluwarsa memicu captcha baru otomatis, tetapi paling
 * banyak maksCaptcha kali dalam jendelaMenit. Sesudah itu bot berhenti dan
 * memberi tahu satu kali. Mengulang tanpa batas ke sistem Mahkamah Agung
 * adalah perilaku yang membuat akun ditandai. Admin yang mengetik
 * "ecourt masuk" sendiri memulai hitungan baru - itu keputusan manusia.
 *
 * ============================================================================
 * SATU ANTREAN KIRIM
 * ============================================================================
 *
 * Semua pesan keluar (captcha, pemberitahuan, ringkasan penarikan) lewat
 * messageQueueService, bukan client.sendMessage langsung. Balasan atas
 * perintah chat tetap lewat balasChat di app.js, seperti menu lain.
 *
 * Waktu pada pesan memakai zona pengadilan (WITA), bukan zona proses.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { readRuntimeConfig } = require("../config/runtime-config");
const { normalizeIndonesianPhoneNumber } = require("../utils/phoneFormatter");
const logService = require("./logService");

/** Bawaan; dapat ditimpa lewat runtime config `ecourtWa`. */
const BAWAAN = {
  aktif: true,
  // Captcha dikirim sendiri (saat menyala / sesi mati terdeteksi). Perintah
  // "ecourt masuk" tetap jalan walau ini mati.
  otomatis: true,
  maksCaptcha: 3,
  jendelaMenit: 30,
  // Berapa lama jawaban captcha berlaku. Dibatasi LOGIN_TTL_MS peramban.
  jawabMenit: 4,
  // Rentang susulan terjauh ke belakang (hari kalender).
  susulanMaksHari: 7,
  // Jarak minimal antar captcha yang dikirim OTOMATIS (bukan atas permintaan
  // atau balasan admin). Admin yang tidak menjawab tidak dihujani captcha.
  jedaOtomatisMenit: 180,
};

const JEDA_TUNDA_MS = 2 * 60 * 1000;
const TUNGGU_WA_MAKS_MS = 15 * 60 * 1000;
const TUNGGU_WA_JEDA_MS = 15 * 1000;
const ZONA_WAKTU = String(process.env.ALETA_ZONA_WAKTU || "Asia/Makassar").trim() || "Asia/Makassar";

/** Kata yang bukan kode captcha bila diketik tanpa mengutip pesan captcha. */
const KATA_BUKAN_KODE = new Set([
  "menu", "ya", "bukan", "batal", "status", "help", "bantuan", "halo", "hai", "hallo", "tes", "test",
  "info", "ok", "oke", "okay", "siap", "terima", "kasih", "makasih", "ping", "start", "mulai", "stop",
  "selesai", "lanjut", "cek", "tidak", "iya", "benar", "salah", "assalamualaikum", "pagi", "siang",
  "sore", "malam",
]);

const keadaan = {
  sibuk: false,
  memproses: false,
  memulihkan: false,
  // { id, slot, berkas, dikirimMs, kedaluwarsaMs, timer }
  menunggu: null,
  tertunda: null,
  timerTunda: null,
  timerMulai: null,
  pulih: null,
  terakhirPeriksa: null,
};

// ---------------------------------------------------------------------------
// Ketergantungan yang dapat ditukar uji.
// ---------------------------------------------------------------------------
const alat = {
  sekarang: () => Date.now(),
  nomorAdmin: () => String((readRuntimeConfig() || {}).adminWhatsappNumber || "").trim(),
  pengaturanLain: () => (readRuntimeConfig() || {}).ecourtWa || {},
  jadwal: () => require("./ecourtSchedulerService"),
  login: () => require("./ecourtLoginService"),
  akun: () => require("./ecourtAkunService"),
  kredensial: () => require("./ecourtKredensialService"),
  sesiEcourt: () => require("../tools/ecourt-bridge/sesi"),
  antrean: () => require("./messageQueueService"),
  sidangHari: (tanggal) => require("./ecourtVerifikasiHarianService").sidangHari(tanggal, { semuaJenis: true }),
  whatsappSiap: () => {
    try {
      return require("./whatsappStatusService").getStatus().status === "connected";
    } catch {
      return false;
    }
  },
  jamAman: () => {
    try {
      return require("./messageQueueService").getSendingWindowState().allowed !== false;
    } catch {
      return true;
    }
  },
  tidur: (ms) => new Promise((selesai) => setTimeout(selesai, ms)),
};

function aturAlat(baru = {}) {
  Object.assign(alat, baru);
}

function angka(nilai, bawaan, min, maks) {
  const n = Number(nilai);
  if (!Number.isFinite(n)) return bawaan;
  return Math.min(Math.max(Math.floor(n), min), maks);
}

function getSettings() {
  const t = alat.pengaturanLain() || {};
  return {
    aktif: t.aktif !== false,
    otomatis: t.otomatis !== false,
    maksCaptcha: angka(t.maksCaptcha, BAWAAN.maksCaptcha, 1, 10),
    jendelaMenit: angka(t.jendelaMenit, BAWAAN.jendelaMenit, 5, 240),
    jawabMenit: angka(t.jawabMenit, BAWAAN.jawabMenit, 1, 4),
    susulanMaksHari: angka(t.susulanMaksHari, BAWAAN.susulanMaksHari, 1, 31),
    jedaOtomatisMenit: angka(t.jedaOtomatisMenit, BAWAAN.jedaOtomatisMenit, 5, 1440),
  };
}

// ---------------------------------------------------------------------------
// Waktu (zona pengadilan).
// ---------------------------------------------------------------------------

function bagianWaktu(ms) {
  return alat.jadwal().bagianWaktu(new Date(ms));
}

/** "17-10-2026 14.05 WITA" */
function teksWaktu(ms) {
  if (!Number.isFinite(Number(ms)) || !ms) return "-";
  const b = bagianWaktu(ms);
  const [y, m, d] = b.tanggal.split("-");
  const label = ZONA_WAKTU === "Asia/Makassar" ? "WITA" : ZONA_WAKTU;
  return `${d}-${m}-${y} ${String(b.jam).padStart(2, "0")}.${String(b.menit).padStart(2, "0")} ${label}`;
}

/** Tanggal (YYYY-MM-DD, zona pengadilan) dari <dari> sampai <sampai>, paling banyak maksHari. */
function rentangTanggal(dariMs, sampaiMs, maksHari) {
  const hasil = [];
  const hariMs = 24 * 60 * 60 * 1000;
  const awal = Math.max(dariMs, sampaiMs - (maksHari - 1) * hariMs);
  for (let t = awal; t <= sampaiMs + 1; t += hariMs) {
    const tgl = bagianWaktu(t).tanggal;
    if (!hasil.includes(tgl)) hasil.push(tgl);
  }
  const akhir = bagianWaktu(sampaiMs).tanggal;
  if (!hasil.includes(akhir)) hasil.push(akhir);
  return hasil;
}

// ---------------------------------------------------------------------------
// Catatan bertahan (cap waktu penarikan terakhir, riwayat captcha).
// ---------------------------------------------------------------------------

function folderData() {
  return process.env.ALETA_BOT_DATA_DIR
    ? path.resolve(process.env.ALETA_BOT_DATA_DIR)
    : path.resolve(__dirname, "..", "data");
}

function berkasCatatan() {
  return path.join(folderData(), "ecourt-pulih.json");
}

function folderCaptcha() {
  return path.join(folderData(), "ecourt-captcha");
}

function bacaCatatan() {
  try {
    const isi = JSON.parse(fs.readFileSync(berkasCatatan(), "utf8"));
    return isi && typeof isi === "object" ? isi : {};
  } catch {
    return {};
  }
}

function tulisCatatan(isi) {
  try {
    const jalur = berkasCatatan();
    fs.mkdirSync(path.dirname(jalur), { recursive: true });
    const sementara = `${jalur}.${process.pid}.tmp`;
    fs.writeFileSync(sementara, JSON.stringify(isi));
    fs.renameSync(sementara, jalur);
  } catch {
    // Gagal menyimpan: paling buruk susulan menjangkau rentang lebih lebar.
  }
}

function ubahCatatan(fn) {
  const isi = bacaCatatan();
  fn(isi);
  tulisCatatan(isi);
  return isi;
}

/** Dipanggil penjadwal bila satu putaran penarikan (dengan unduhan) berakhir kode 0. */
function catatBerhasil({ sumber = "" } = {}) {
  ubahCatatan((c) => {
    c.terakhirBerhasilMs = alat.sekarang();
    c.terakhirSumber = String(sumber || "").slice(0, 40);
  });
}

// ---------------------------------------------------------------------------
// Nomor admin.
// ---------------------------------------------------------------------------

function nomorAdminNormal() {
  return normalizeIndonesianPhoneNumber(alat.nomorAdmin());
}

/** Kecocokan KETAT: nomor yang sama persis setelah normalisasi (bukan akhiran). */
function dariAdmin(pengirim) {
  const admin = nomorAdminNormal();
  if (!admin) return false;
  const teks = String(pengirim || "");
  // Pengenal @lid bukan nomor telepon: hanya diterima bila pemanggil sudah
  // menerjemahkannya menjadi nomor.
  if (/@lid$/i.test(teks)) return false;
  const nomor = normalizeIndonesianPhoneNumber(teks);
  return Boolean(nomor) && nomor === admin;
}

// ---------------------------------------------------------------------------
// Pengiriman lewat antrean tunggal.
// ---------------------------------------------------------------------------

async function kirimKeAdmin({ pesan, kunci, kunciNotifikasi = "ecourt_wa_sesi", lampiran = null }) {
  const nomor = nomorAdminNormal();
  if (!nomor) return { terkirim: false, alasan: "nomor_admin_kosong" };
  try {
    await alat.antrean().enqueueMessage({
      idempotencyKey: kunci,
      recipientNumber: nomor,
      recipientName: "Admin ALETA",
      message: pesan,
      // "system": pesan kendali yang diminta/langsung menyangkut admin; tidak
      // ditahan jam aman dan tidak diberi jeda berjarak. Jam aman untuk yang
      // dimulai OTOMATIS dijaga di sini (lihat jamAman), bukan oleh antrean.
      category: "system",
      notificationKey: kunciNotifikasi,
      priority: 1,
      scheduledAt: new Date(alat.sekarang()),
      sourceApp: "aleta_bot",
      sourceFeature: "ecourt_wa_sesi",
      attachment: lampiran || undefined,
      metadata: lampiran ? { sendOptions: { sendMediaAsDocument: false } } : {},
    });
    return { terkirim: true, alasan: "" };
  } catch (galat) {
    void logService.logSystemEvent({
      eventType: "ecourt_wa_kirim_gagal",
      severity: "warning",
      message: "Pesan e-Court ke admin gagal diantrekan.",
      metadata: { errorMessage: String((galat && galat.message) || galat).slice(0, 200) },
    });
    return { terkirim: false, alasan: "antrean_gagal" };
  }
}

function jejak(eventType, message, metadata = {}, severity = "warning") {
  try {
    void logService.logSecurityEvent({ eventType, severity, message, metadata });
  } catch {
    /* jejak gagal tidak menggagalkan alur */
  }
}

// ---------------------------------------------------------------------------
// Berkas captcha.
// ---------------------------------------------------------------------------

function simpanCaptcha(dataUrl, id) {
  const cocok = String(dataUrl || "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!cocok) return null;
  const folder = folderCaptcha();
  fs.mkdirSync(folder, { recursive: true });
  const berkas = path.join(folder, `captcha-${id}.png`);
  fs.writeFileSync(berkas, Buffer.from(cocok[1], "base64"), { mode: 0o600 });
  return berkas;
}

function hapusBerkas(berkas) {
  if (!berkas) return;
  try {
    fs.rmSync(berkas, { force: true });
  } catch {
    /* sudah hilang */
  }
}

/** Membuang gambar captcha yang lebih tua dari 30 menit. */
function sapuCaptchaLama() {
  try {
    const folder = folderCaptcha();
    for (const nama of fs.readdirSync(folder)) {
      if (!/^captcha-[a-z0-9]+\.png$/.test(nama)) continue;
      const jalur = path.join(folder, nama);
      if (alat.sekarang() - fs.statSync(jalur).mtimeMs > 30 * 60 * 1000) hapusBerkas(jalur);
    }
  } catch {
    /* folder belum ada */
  }
}

/**
 * Memeriksa jalur lampiran captcha sebelum dibaca pengirim antrean.
 * Hanya berkas captcha-<id>.png di folder captcha yang diterima.
 */
function deskripsikanBerkasCaptcha(jalur) {
  try {
    const mutlak = path.resolve(String(jalur || ""));
    const folder = path.resolve(folderCaptcha());
    if (path.dirname(mutlak) !== folder) return { ok: false, reason: "di_luar_folder_captcha" };
    if (!/^captcha-[a-z0-9]+\.png$/.test(path.basename(mutlak))) return { ok: false, reason: "nama_tidak_sah" };
    if (!fs.existsSync(mutlak)) return { ok: false, reason: "berkas_tidak_ada" };
    return { ok: true, absolutePath: mutlak, fileName: "captcha-ecourt.png" };
  } catch {
    return { ok: false, reason: "tidak_terbaca" };
  }
}

// ---------------------------------------------------------------------------
// Batas captcha.
// ---------------------------------------------------------------------------

function riwayatDalamJendela() {
  const p = getSettings();
  const batas = alat.sekarang() - p.jendelaMenit * 60 * 1000;
  const daftar = (Array.isArray(bacaCatatan().riwayatCaptchaMs) ? bacaCatatan().riwayatCaptchaMs : []).filter(
    (t) => Number(t) > batas
  );
  return daftar.map(Number);
}

function catatPercobaanCaptcha() {
  const daftar = riwayatDalamJendela();
  daftar.push(alat.sekarang());
  ubahCatatan((c) => {
    c.riwayatCaptchaMs = daftar;
  });
}

function resetBatas() {
  ubahCatatan((c) => {
    c.riwayatCaptchaMs = [];
    c.pemberitahuanBatasMs = 0;
  });
}

function batasTercapai() {
  return riwayatDalamJendela().length >= getSettings().maksCaptcha;
}

/** Memberi tahu admin SEKALI per jendela bahwa bot berhenti mengirim captcha. */
async function beritahuBatas() {
  const p = getSettings();
  const catatan = bacaCatatan();
  const jendelaMs = p.jendelaMenit * 60 * 1000;
  if (alat.sekarang() - Number(catatan.pemberitahuanBatasMs || 0) < jendelaMs) {
    return { terkirim: false, alasan: "sudah_diberitahu" };
  }
  ubahCatatan((c) => {
    c.pemberitahuanBatasMs = alat.sekarang();
  });
  const hasil = await kirimKeAdmin({
    kunci: `ecourt-wa-batas:${Math.floor(alat.sekarang() / jendelaMs)}`,
    pesan: [
      "*ALETA - Login e-Court lewat WhatsApp dihentikan sementara*",
      "",
      `Captcha sudah dikirim ${p.maksCaptcha} kali dalam ${p.jendelaMenit} menit tanpa berhasil masuk. ` +
        "Bot berhenti supaya akun e-Court tidak ditandai karena percobaan beruntun.",
      "",
      "Pilihan:",
      "- Balas *ecourt masuk* untuk mencoba lagi sekarang, atau",
      "- Login dari ALETA - menu Integrasi e-Court.",
    ].join("\n"),
  });
  jejak("ecourt_wa_batas_tercapai", "Captcha e-Court lewat WhatsApp dihentikan: batas percobaan tercapai.", {
    maksCaptcha: p.maksCaptcha,
    jendelaMenit: p.jendelaMenit,
  });
  return hasil;
}

// ---------------------------------------------------------------------------
// Pemeriksaan sesi.
// ---------------------------------------------------------------------------

/** Slot akun yang punya sesi tersimpan dan aktif. */
function slotBersesi() {
  try {
    return alat
      .akun()
      .daftarAkun()
      .filter((a) => a.adaSesi && a.aktif)
      .map((a) => a.slot);
  } catch {
    return [];
  }
}

/**
 * Memeriksa sesi semua akun aktif. Berhenti di akun pertama yang hidup.
 * @returns {Promise<{ keadaan: "hidup"|"mati"|"tidak_pasti", slotHidup: string, rincian: object[] }>}
 */
async function periksaSemuaSesi() {
  const rincian = [];
  const slots = slotBersesi();
  if (slots.length === 0) return { keadaan: "mati", slotHidup: "", rincian: [{ slot: "", alasan: "belum_pernah_login" }] };

  let adaTidakPasti = false;
  for (const slot of slots) {
    let hasil;
    try {
      hasil = await alat.login().periksaSesi({ cepat: false, slot });
    } catch (galat) {
      hasil = { berlaku: null, alasan: `gagal_memeriksa: ${galat && galat.message}` };
    }
    rincian.push({ slot, berlaku: hasil.berlaku, alasan: hasil.alasan || "" });
    if (hasil.berlaku === true) {
      keadaan.terakhirPeriksa = { ms: alat.sekarang(), keadaan: "hidup" };
      return { keadaan: "hidup", slotHidup: slot, rincian };
    }
    if (hasil.berlaku === null) adaTidakPasti = true;
  }
  const hasilKeadaan = adaTidakPasti ? "tidak_pasti" : "mati";
  keadaan.terakhirPeriksa = { ms: alat.sekarang(), keadaan: hasilKeadaan };
  return { keadaan: hasilKeadaan, slotHidup: "", rincian };
}

/**
 * Profil peramban sedang dipakai layanan ini: pemeriksaan sesi saat menyala,
 * pembukaan login, atau formulir login yang menunggu jawaban captcha.
 * Penjadwal tidak memulai penarikan selama ini benar.
 */
function sedangMemulihkan() {
  return keadaan.memulihkan === true || keadaan.sibuk === true || keadaan.memproses === true || adaMenunggu();
}

function penarikanBerjalan() {
  try {
    const st = alat.jadwal().getStatus();
    return Boolean(st.sedangJalan || st.adaPenarikanLain);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Penarikan susulan.
// ---------------------------------------------------------------------------

/**
 * Menarik sekarang, ditambah SUSULAN untuk rentang selama bot/server mati.
 *
 * Rentang: dari tanggal penarikan berhasil terakhir (tersimpan) sampai hari
 * ini, paling jauh susulanMaksHari. Sidang tiap hari dalam rentang itu
 * diutamakan (cara yang sama dengan tarikan pagi). Tanpa cap waktu tersimpan,
 * hanya hari ini.
 *
 * Tidak menunggu penarikannya selesai: `selesai` adalah janji yang dapat
 * ditunggu pemanggil bila perlu.
 */
async function tarikSusulan({ alasan = "", manual = false } = {}) {
  if (penarikanBerjalan()) return { dimulai: false, alasan: "penarikan_sedang_berjalan" };

  const p = getSettings();
  const sekarangMs = alat.sekarang();
  const terakhir = Number(bacaCatatan().terakhirBerhasilMs || 0);
  const tanggal = terakhir
    ? rentangTanggal(terakhir, sekarangMs, p.susulanMaksHari)
    : [bagianWaktu(sekarangMs).tanggal];

  const daftar = [];
  let terbaca = 0;
  for (const tgl of tanggal) {
    try {
      const sidang = (await Promise.resolve(alat.sidangHari(tgl))) || [];
      terbaca += 1;
      for (const nomor of sidang) if (nomor && !daftar.includes(nomor)) daftar.push(nomor);
    } catch {
      /* satu hari tak terbaca tidak membatalkan susulan */
    }
  }

  const opsi = daftar.length
    ? { sumber: "susulan", utamakan: daftar, hanyaUtamakan: true, maksPerkara: 0 }
    : { sumber: "susulan" };

  keadaan.pulih = {
    mulaiMs: sekarangMs,
    alasan,
    tanggal,
    hariTerbaca: terbaca,
    jumlahPerkara: daftar.length,
    selesaiMs: 0,
    kode: null,
  };

  jejak(
    "ecourt_wa_susulan_dimulai",
    "Penarikan susulan e-Court dimulai.",
    { alasan, hari: tanggal.length, jumlahPerkara: daftar.length, manual },
    "info"
  );

  const selesai = Promise.resolve(alat.jadwal().jalankanSatuPutaran(opsi))
    .then(async (hasil) => {
      const h = hasil || {};
      keadaan.pulih = { ...keadaan.pulih, selesaiMs: alat.sekarang(), kode: h.dilewati ? "dilewati" : h.kode };
      if (!h.dilewati && h.kode === 0) {
        // Dicatat penjadwal juga; ini jaring pengaman bila hook tidak terpasang.
        catatBerhasil({ sumber: "susulan" });
      }
      if (!h.dilewati) await ringkasSelesai(h, { manual, tanggal, jumlahPerkara: daftar.length }).catch(() => {});
      return h;
    })
    .catch((galat) => {
      keadaan.pulih = { ...keadaan.pulih, selesaiMs: alat.sekarang(), kode: "galat" };
      return { dilewati: false, kode: -1, catatan: String((galat && galat.message) || galat) };
    });

  return { dimulai: true, alasan: "", tanggal, jumlahPerkara: daftar.length, selesai };
}

async function ringkasSelesai(hasil, { manual, tanggal, jumlahPerkara }) {
  // Penarikan sukses yang otomatis tidak perlu mengabari admin (itu kerja
  // rutin). Yang dikabari: hasil perintah manual, dan kegagalan apa pun.
  if (!manual && hasil.kode === 0) return;
  const mulai = keadaan.pulih ? keadaan.pulih.mulaiMs : alat.sekarang();
  const baris = [
    hasil.kode === 0 ? "*ALETA - Penarikan e-Court selesai*" : "*ALETA - Penarikan e-Court berhenti*",
    "",
    `Rentang: ${tanggal[0]} s.d. ${tanggal[tanggal.length - 1]}${jumlahPerkara ? ` (${jumlahPerkara} perkara bersidang diutamakan)` : ""}`,
    `Hasil: ${hasil.catatan || (hasil.kode === 0 ? "Selesai." : `kode ${hasil.kode}`)}`,
  ];
  if (hasil.kode === 0) baris.push("", "Ketik *ecourt ringkas* untuk ringkasan hari ini.");
  await kirimKeAdmin({
    kunci: `ecourt-wa-selesai:${mulai}`,
    pesan: baris.join("\n"),
    kunciNotifikasi: "ecourt_wa_penarikan_selesai",
  });
}

// ---------------------------------------------------------------------------
// Login lewat WhatsApp.
// ---------------------------------------------------------------------------

/** Slot yang akan dilogin-kan: akun utama dahulu, lalu akun aktif lain; harus punya simpanan sandi. */
function pilihSlotLogin() {
  let utama = "";
  try {
    utama = alat.akun().slotAkunUtama() || "";
  } catch {
    utama = "";
  }
  const kandidat = [];
  if (utama) kandidat.push(utama);
  try {
    for (const a of alat.akun().daftarAkun()) if (a.aktif && !kandidat.includes(a.slot)) kandidat.push(a.slot);
  } catch {
    /* daftar tak terbaca */
  }
  if (kandidat.length === 0) kandidat.push(alat.sesiEcourt().SLOT_BAWAAN);
  return kandidat.find((slot) => alat.kredensial().siapOtomatis(slot)) || "";
}

function bersihkanMenunggu() {
  if (!keadaan.menunggu) return;
  if (keadaan.menunggu.timer) clearTimeout(keadaan.menunggu.timer);
  hapusBerkas(keadaan.menunggu.berkas);
  keadaan.menunggu = null;
}

function adaMenunggu() {
  const m = keadaan.menunggu;
  return Boolean(m) && alat.sekarang() < m.kedaluwarsaMs;
}

async function padaKedaluwarsa(id) {
  const m = keadaan.menunggu;
  if (!m || m.id !== id) return;
  bersihkanMenunggu();
  try {
    alat.login().bersihkanSesiAktif();
  } catch {
    /* peramban sudah tertutup */
  }
  jejak("ecourt_wa_captcha_kedaluwarsa", "Captcha e-Court lewat WhatsApp kedaluwarsa tanpa jawaban.", {});
  await kirimKeAdmin({
    kunci: `ecourt-wa-kedaluwarsa:${id}`,
    pesan: "Captcha e-Court kedaluwarsa tanpa jawaban. Balas *ecourt masuk* untuk meminta captcha baru.",
  });
}

/**
 * Membuka login e-Court, memotong captcha, dan mengirimnya ke admin.
 * Tidak memeriksa jam aman - pemanggil yang memutuskan.
 */
async function kirimCaptcha({ sumber = "", manual = false } = {}) {
  if (keadaan.sibuk) return { dilewati: true, diurus: true, alasan: "sedang_diproses" };
  if (adaMenunggu()) return { dilewati: true, diurus: true, alasan: "captcha_sudah_dikirim" };
  keadaan.sibuk = true;
  try {
    const login = alat.login();
    if (login.sedangMenunggu()) {
      // Peramban login itu milik petugas di portal: jangan ditutup.
      return { dilewati: true, diurus: true, alasan: "petugas_sedang_login_portal" };
    }
    if (penarikanBerjalan()) return { dilewati: true, diurus: false, alasan: "penarikan_sedang_berjalan" };

    const slot = pilihSlotLogin();
    if (!slot) {
      return { dilewati: true, diurus: false, alasan: "kredensial_belum_tersimpan" };
    }

    if (batasTercapai()) {
      await beritahuBatas();
      return { dilewati: true, diurus: true, alasan: "batas_captcha" };
    }
    // Dihitung SEBELUM mencoba: percobaan yang gagal membuka halaman pun
    // terhitung, supaya kegagalan beruntun tidak berputar tanpa batas.
    catatPercobaanCaptcha();
    sapuCaptchaLama();

    const hasil = await login.mulaiLogin({ slot });
    if (!hasil || !hasil.ok) {
      jejak("ecourt_wa_login_tak_terbuka", "Halaman login e-Court tidak dapat dibuka untuk captcha WhatsApp.", {
        alasan: String((hasil && hasil.alasan) || "").slice(0, 120),
      });
      return { dilewati: true, diurus: false, alasan: `login_tak_terbuka: ${(hasil && hasil.alasan) || ""}` };
    }
    if (hasil.alasan === "sudah_masuk") {
      // e-Court langsung mengalihkan: sesinya ternyata hidup.
      return { dilewati: false, diurus: true, alasan: "sudah_masuk", sudahMasuk: true, slot };
    }
    if (!hasil.captcha || !hasil.terisiOtomatis) {
      try {
        login.bersihkanSesiAktif();
      } catch {
        /* sudah tertutup */
      }
      return {
        dilewati: true,
        diurus: false,
        alasan: !hasil.captcha ? "captcha_tidak_terbaca" : "kredensial_tidak_terisi",
      };
    }

    const id = crypto.randomBytes(5).toString("hex");
    const berkas = simpanCaptcha(hasil.captcha, id);
    if (!berkas) {
      try {
        login.bersihkanSesiAktif();
      } catch {
        /* sudah tertutup */
      }
      return { dilewati: true, diurus: false, alasan: "gambar_captcha_tidak_sah" };
    }

    const p = getSettings();
    const ttlMs = Math.min(p.jawabMenit * 60 * 1000, Math.max(30 * 1000, (login.LOGIN_TTL_MS || 5 * 60 * 1000) - 20 * 1000));
    const dikirimMs = alat.sekarang();
    const entri = { id, slot, berkas, dikirimMs, kedaluwarsaMs: dikirimMs + ttlMs, timer: null };
    entri.timer = setTimeout(() => void padaKedaluwarsa(id).catch(() => {}), ttlMs);
    if (typeof entri.timer.unref === "function") entri.timer.unref();
    keadaan.menunggu = entri;

    const menit = Math.max(1, Math.round(ttlMs / 60000));
    const pesan = [
      "*ALETA - Sesi e-Court terputus*",
      "",
      "Penarikan berkas e-Court berhenti karena sesinya tidak berlaku.",
      `Balas pesan ini dengan *kode pada gambar* (berlaku ${menit} menit). Surel dan sandi diisi bot dari simpanan, jangan kirim sandi lewat WhatsApp.`,
      "Ketik *ecourt batal* bila tidak jadi.",
    ].join("\n");

    const kirim = await kirimKeAdmin({
      kunci: `ecourt-wa-captcha:${id}`,
      pesan,
      kunciNotifikasi: "ecourt_wa_captcha",
      lampiran: { source: berkas, name: "captcha-ecourt.png", mimeType: "image/png", kind: "ecourt_captcha", required: true },
    });
    if (!kirim.terkirim) {
      bersihkanMenunggu();
      try {
        login.bersihkanSesiAktif();
      } catch {
        /* sudah tertutup */
      }
      return { dilewati: true, diurus: false, alasan: `kirim_gagal: ${kirim.alasan}` };
    }

    jejak(
      "ecourt_wa_captcha_dikirim",
      "Captcha login e-Court dikirim ke super admin lewat WhatsApp.",
      { sumber, manual, slot, kedaluwarsaMenit: menit },
      "info"
    );
    return { dilewati: false, diurus: true, alasan: "", captchaId: id, slot };
  } catch (galat) {
    return { dilewati: true, diurus: false, alasan: `galat: ${String((galat && galat.message) || galat).slice(0, 120)}` };
  } finally {
    keadaan.sibuk = false;
  }
}

/**
 * Sesi e-Court mati: minta login lewat WhatsApp.
 *
 * Mengembalikan `diurus: true` bila admin SUDAH/AKAN diberi tahu lewat jalur
 * ini (captcha terkirim, sedang menunggu, ditunda ke jam aman, atau pesan
 * batas terkirim) - pemanggil tidak perlu mengirim peringatan teks lagi.
 * `diurus: false` berarti pemanggil sebaiknya memakai peringatan teks lama.
 */
async function sesiMati({ sumber = "", manual = false, dariTunda = false } = {}) {
  const p = getSettings();
  if (!manual && (!p.aktif || !p.otomatis)) return { dilewati: true, diurus: false, alasan: "otomatis_mati" };
  if (!nomorAdminNormal()) return { dilewati: true, diurus: false, alasan: "nomor_admin_kosong" };

  if (adaMenunggu()) return { dilewati: true, diurus: true, alasan: "captcha_sudah_dikirim" };

  // Captcha OTOMATIS terakhir belum lama: admin sudah diberi tahu, jangan
  // diulang tiap detak. Perintah "ecourt masuk" melewati jeda ini.
  if (!manual) {
    const terakhir = Number(bacaCatatan().terakhirOtomatisMs || 0);
    if (terakhir && alat.sekarang() - terakhir < p.jedaOtomatisMenit * 60 * 1000) {
      return { dilewati: true, diurus: true, alasan: "jeda_otomatis" };
    }
  }

  if (!manual && (!alat.jamAman() || !alat.whatsappSiap())) {
    tundakan(sumber);
    return { dilewati: true, diurus: true, ditunda: true, alasan: alat.jamAman() ? "whatsapp_belum_siap" : "di_luar_jam_aman" };
  }

  if (manual) resetBatas();

  if (dariTunda) {
    // Selama menunggu jam aman, seseorang mungkin sudah login lewat portal.
    const pemeriksaan = await periksaSemuaSesi();
    if (pemeriksaan.keadaan === "hidup") {
      void tarikSusulan({ alasan: "sesi_ternyata_hidup", manual }).catch(() => {});
      return { dilewati: false, diurus: true, alasan: "sesi_sudah_hidup", sudahMasuk: true };
    }
  }

  const hasil = await kirimCaptcha({ sumber, manual });
  if (!manual && hasil && !hasil.dilewati && hasil.captchaId) {
    ubahCatatan((c) => {
      c.terakhirOtomatisMs = alat.sekarang();
    });
  }
  if (hasil.sudahMasuk) {
    void tarikSusulan({ alasan: "sesi_ternyata_hidup", manual }).catch(() => {});
  }
  return hasil;
}

function tundakan(sumber) {
  if (!keadaan.tertunda) keadaan.tertunda = { sumber, sejakMs: alat.sekarang() };
  if (keadaan.timerTunda) return;
  keadaan.timerTunda = setInterval(() => void periksaTunda().catch(() => {}), JEDA_TUNDA_MS);
  if (typeof keadaan.timerTunda.unref === "function") keadaan.timerTunda.unref();
}

async function periksaTunda() {
  const t = keadaan.tertunda;
  if (!t) {
    batalkanTunda();
    return { dilewati: true, alasan: "tidak_ada_tunda" };
  }
  // Terlalu lama (>24 jam): menyerah, peringatan teks lama / pantau yang melanjutkan.
  if (alat.sekarang() - t.sejakMs > 24 * 60 * 60 * 1000) {
    batalkanTunda();
    return { dilewati: true, alasan: "tunda_kedaluwarsa" };
  }
  if (!alat.jamAman() || !alat.whatsappSiap()) return { dilewati: true, alasan: "belum_waktunya" };
  if (penarikanBerjalan() || keadaan.sibuk) return { dilewati: true, alasan: "sibuk" };
  const sumber = t.sumber;
  batalkanTunda();
  return sesiMati({ sumber: `${sumber}-tunda`, dariTunda: true });
}

function batalkanTunda() {
  keadaan.tertunda = null;
  if (keadaan.timerTunda) {
    clearInterval(keadaan.timerTunda);
    keadaan.timerTunda = null;
  }
}

/** Pintu bagi pemantau sesi / penjadwal: sesi terdeteksi mati. */
async function padaSesiHabis({ sumber = "" } = {}) {
  try {
    return await sesiMati({ sumber });
  } catch {
    return { dilewati: true, diurus: false, alasan: "galat" };
  }
}

// ---------------------------------------------------------------------------
// Jawaban captcha dari admin.
// ---------------------------------------------------------------------------

/**
 * Mengambil kode captcha dari teks balasan, atau "" bila itu bukan jawaban.
 *
 * Bentuk yang diterima: "kode ABC12" / "captcha ABC12" / "ecourt ABC12" (selalu),
 * atau kode saja bila (a) pesan ini mengutip pesan captcha, atau (b) bentuknya
 * 4-8 huruf/angka dan bukan kata sapaan/perintah umum. Aturan (b) menjaga
 * admin yang mengetik "menu" atau "ya" saat captcha menunggu tidak salah baca.
 */
function ekstrakKode(teks, { terkutip = false } = {}) {
  const t = String(teks || "").trim();
  if (!t || t.length > 40) return "";
  const eksplisit = t.match(/^(?:kode|captcha|ecourt|e-court)\s*[:=]?\s*([A-Za-z0-9]{3,10})$/i);
  if (eksplisit) {
    const k = eksplisit[1];
    // "ecourt status" dkk. adalah perintah, bukan kode.
    if (/^(status|tarik|masuk|ringkas|batal|bantuan|help)$/i.test(k)) return "";
    return k;
  }
  const kosong = t.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9]{3,10}$/.test(kosong)) return "";
  if (terkutip) return kosong;
  if (kosong.length < 4 || kosong.length > 8) return "";
  if (KATA_BUKAN_KODE.has(kosong.toLowerCase())) return "";
  return kosong;
}

/**
 * Menangani pesan WhatsApp yang mungkin berisi jawaban captcha.
 * Mengembalikan null bila BUKAN urusan layanan ini (pesan diteruskan ke
 * penanganan biasa), atau { reply } bila ditangani.
 */
async function tanganiJawaban({ pengirim, teks, terkutip = false } = {}) {
  if (!adaMenungguAtauKadaluwarsa()) {
    // Tanpa captcha menunggu, hanya bentuk eksplisit "kode xxx" yang dijawab -
    // pesan lain milik penanganan biasa.
    if (!dariAdmin(pengirim)) return null;
    if (!/^(?:kode|captcha)\s*[:=]?\s*[A-Za-z0-9]{3,10}$/i.test(String(teks || "").trim())) return null;
    return { reply: "Tidak ada captcha e-Court yang sedang menunggu. Balas *ecourt masuk* untuk meminta captcha." };
  }
  if (!dariAdmin(pengirim)) return null;

  const kode = ekstrakKode(teks, { terkutip });
  if (!kode) return null;

  if (keadaan.memproses) return { reply: "Jawaban sebelumnya masih diproses, mohon tunggu." };

  const m = keadaan.menunggu;
  if (!m || alat.sekarang() >= m.kedaluwarsaMs || !alat.login().sedangMenunggu()) {
    bersihkanMenunggu();
    try {
      alat.login().bersihkanSesiAktif();
    } catch {
      /* sudah tertutup */
    }
    jejak("ecourt_wa_jawaban_terlambat", "Jawaban captcha e-Court terlambat.", {});
    void kirimCaptcha({ sumber: "jawaban-terlambat" }).then(async (h) => {
      if (h && h.alasan === "batas_captcha") return;
      if (h && h.dilewati && !h.diurus) {
        await kirimKeAdmin({
          kunci: `ecourt-wa-gagal-baru:${alat.sekarang()}`,
          pesan: `Captcha baru tidak dapat dibuat (${h.alasan}). Login dari ALETA - menu Integrasi e-Court.`,
        });
      }
    });
    return { reply: "Kode itu untuk captcha yang sudah kedaluwarsa. Bot mengirim captcha baru - mohon tunggu sebentar." };
  }

  keadaan.memproses = true;
  try {
    const hasil = await alat.login().kirimLogin({ captcha: kode, jalur: "whatsapp" });
    if (hasil && hasil.ok) {
      bersihkanMenunggu();
      resetBatas();
      ubahCatatan((c) => {
        c.terakhirOtomatisMs = 0;
      });
      const akun = hasil.namaPengguna ? ` (${hasil.namaPengguna})` : "";
      void tarikSusulan({ alasan: "login_whatsapp", manual: true }).catch(() => {});
      return { reply: `Berhasil masuk e-Court${akun}. Penarikan (termasuk susulan) dimulai; hasilnya saya kabari.` };
    }

    bersihkanMenunggu();
    // Dihitung SEBELUM captcha baru dimulai (yang menambah hitungan) supaya
    // balasan jujur: "batas tercapai" hanya bila captcha baru TIDAK akan dikirim.
    const batas = batasTercapai();
    // Login gagal: captcha lama sudah hangus. Captcha baru otomatis, dibatasi.
    void kirimCaptcha({ sumber: "kode-salah" }).then(async (h) => {
      if (h && h.alasan === "batas_captcha") return;
      if (h && h.dilewati && !h.diurus) {
        await kirimKeAdmin({
          kunci: `ecourt-wa-gagal-baru:${alat.sekarang()}`,
          pesan: `Captcha baru tidak dapat dibuat (${h.alasan}). Login dari ALETA - menu Integrasi e-Court.`,
        });
      }
    });
    return {
      reply: batas
        ? "Login ditolak e-Court (kode salah atau kedaluwarsa). Batas percobaan tercapai - bot berhenti mengirim captcha."
        : "Login ditolak e-Court (kode salah atau kedaluwarsa). Captcha baru sedang dikirim.",
    };
  } finally {
    keadaan.memproses = false;
  }
}

function adaMenungguAtauKadaluwarsa() {
  return Boolean(keadaan.menunggu);
}

/** Membatalkan captcha yang menunggu (perintah "ecourt batal"). */
function batalkanCaptcha() {
  if (!keadaan.menunggu) return false;
  bersihkanMenunggu();
  try {
    alat.login().bersihkanSesiAktif();
  } catch {
    /* sudah tertutup */
  }
  jejak("ecourt_wa_captcha_dibatalkan", "Captcha e-Court dibatalkan oleh super admin.", {}, "info");
  return true;
}

// ---------------------------------------------------------------------------
// Pemulihan saat bot menyala.
// ---------------------------------------------------------------------------

async function tungguWhatsapp(maksMs = TUNGGU_WA_MAKS_MS) {
  const batas = alat.sekarang() + maksMs;
  while (alat.sekarang() < batas) {
    if (alat.whatsappSiap()) return true;
    await alat.tidur(TUNGGU_WA_JEDA_MS);
  }
  return alat.whatsappSiap();
}

/**
 * Pemeriksaan satu kali saat bot menyala.
 *
 * Hanya berjalan bila penjadwal penarikan e-Court dinyalakan admin: menarik
 * dari sistem Mahkamah Agung tanpa diminta bukan perilaku yang pantas
 * dinyalakan sendiri oleh pemasangan.
 */
async function pulihSaatMenyala() {
  const p = getSettings();
  if (!p.aktif) return { dilewati: true, alasan: "pulih_dimatikan" };

  let jadwalAktif = false;
  try {
    jadwalAktif = alat.jadwal().getSettings().aktif === true;
  } catch {
    jadwalAktif = false;
  }
  if (!jadwalAktif) return { dilewati: true, alasan: "penjadwal_mati" };

  if (penarikanBerjalan()) return { dilewati: true, alasan: "penarikan_sedang_berjalan" };

  keadaan.memulihkan = true;
  let pemeriksaan;
  try {
    pemeriksaan = await periksaSemuaSesi();
  } finally {
    keadaan.memulihkan = false;
  }

  jejak(
    "ecourt_pulih_diperiksa",
    "Sesi e-Court diperiksa saat bot menyala.",
    { keadaan: pemeriksaan.keadaan, jumlahAkun: pemeriksaan.rincian.length },
    "info"
  );

  if (pemeriksaan.keadaan === "mati") {
    if (!p.otomatis) return { dilewati: false, keadaan: "mati", alasan: "otomatis_mati" };
    // Captcha butuh WhatsApp; tunggu tersambung (peramban tidak sedang dipakai).
    await tungguWhatsapp();
    const hasil = await sesiMati({ sumber: "menyala" });
    return { dilewati: false, keadaan: "mati", hasil };
  }

  // Hidup, atau tidak pasti (mis. menunggu penegasan gerbang): tarik. Bila
  // ternyata habis, kode keluar 2 memicu jalur sesi-mati lewat penjadwal.
  const hasil = await tarikSusulan({ alasan: "menyala" });
  return { dilewati: false, keadaan: pemeriksaan.keadaan, hasil };
}

/**
 * Pemeriksaan profil peramban saat menyala: apakah foldernya berada di jalur
 * yang dipasang keluar container, dan apakah isinya masih ada.
 *
 * Tanpa ALETA_ECOURT_SESSION_DIR profil jatuh ke folder rumah di dalam
 * container dan musnah tiap build. Yang dicatat hanya KEADAAN, tidak ada isi.
 */
function periksaProfil() {
  try {
    const sesiEcourt = alat.sesiEcourt();
    const dariEnv = Boolean(String(process.env.ALETA_ECOURT_SESSION_DIR || "").trim());
    const slots = slotBersesi();
    const ada = sesiEcourt.sessionExists(sesiEcourt.SLOT_BAWAAN) || slots.length > 0;
    const produksi = String(process.env.NODE_ENV || "") === "production";
    void logService.logSystemEvent({
      eventType: dariEnv || !produksi ? "ecourt_profil_diperiksa" : "ecourt_profil_tidak_di_volume",
      severity: dariEnv || !produksi ? "info" : "warning",
      message:
        dariEnv || !produksi
          ? ada
            ? "Profil peramban e-Court ditemukan saat menyala."
            : "Profil peramban e-Court belum ada (login diperlukan)."
          : "ALETA_ECOURT_SESSION_DIR kosong: profil e-Court berada di dalam container dan hilang tiap build.",
      metadata: { dariEnv, profilAda: ada, jumlahAkunBersesi: slots.length },
    });
  } catch {
    /* pemeriksaan profil bukan syarat */
  }
}

function mulai() {
  if (require("./kembaranMode").aktif()) return; // mode kembaran (laptop): e-Court mati
  if (keadaan.timerMulai) clearTimeout(keadaan.timerMulai);
  if (String(process.env.ALETA_ECOURT_PULIH_AKTIF || "").trim() === "0") return;
  periksaProfil();
  const tunda = Number(process.env.ALETA_ECOURT_PULIH_TUNDA_MS || 45 * 1000);
  // Lebih awal dari detak pertama penjadwal (60 detik) supaya peramban tidak
  // dibuka dua pihak sekaligus; sesudah itu penjadwal diblokir selama
  // sedangMemulihkan().
  keadaan.timerMulai = setTimeout(() => {
    void pulihSaatMenyala().catch((galat) => {
      void logService.logSystemEvent({
        eventType: "ecourt_pulih_gagal",
        severity: "warning",
        message: "Pemulihan sesi e-Court saat menyala gagal.",
        metadata: { errorMessage: String((galat && galat.message) || galat).slice(0, 200) },
      });
    });
  }, Math.max(0, tunda));
  if (typeof keadaan.timerMulai.unref === "function") keadaan.timerMulai.unref();
}

function getStatus() {
  const catatan = bacaCatatan();
  return {
    pengaturan: getSettings(),
    menungguCaptcha: adaMenunggu(),
    captchaKedaluwarsaMs: keadaan.menunggu ? keadaan.menunggu.kedaluwarsaMs : 0,
    ditunda: Boolean(keadaan.tertunda),
    terakhirBerhasilMs: Number(catatan.terakhirBerhasilMs || 0),
    terakhirSumber: String(catatan.terakhirSumber || ""),
    percobaanCaptchaDalamJendela: riwayatDalamJendela().length,
    terakhirPeriksa: keadaan.terakhirPeriksa,
    pulih: keadaan.pulih,
    nomorAdminTerisi: Boolean(nomorAdminNormal()),
  };
}

/** Hanya untuk uji. */
function setel() {
  bersihkanMenunggu();
  batalkanTunda();
  if (keadaan.timerMulai) clearTimeout(keadaan.timerMulai);
  keadaan.timerMulai = null;
  keadaan.sibuk = false;
  keadaan.memproses = false;
  keadaan.memulihkan = false;
  keadaan.pulih = null;
  keadaan.terakhirPeriksa = null;
}

module.exports = {
  BAWAAN,
  JEDA_TUNDA_MS,
  aturAlat,
  batalkanCaptcha,
  bacaCatatan,
  catatBerhasil,
  dariAdmin,
  deskripsikanBerkasCaptcha,
  ekstrakKode,
  folderCaptcha,
  getSettings,
  getStatus,
  kirimCaptcha,
  kirimKeAdmin,
  mulai,
  padaSesiHabis,
  periksaSemuaSesi,
  periksaTunda,
  pulihSaatMenyala,
  rentangTanggal,
  resetBatas,
  sedangMemulihkan,
  sesiMati,
  setel,
  tanganiJawaban,
  tarikSusulan,
  teksWaktu,
};
