"use strict";
/**
 * ============================================================================
 * STATUS AKUN e-COURT - SATU SUMBER UNTUK SEMUA PENANDA (30 Okt 2026)
 * ============================================================================
 *
 * Keluhan yang diselesaikan: "kadang sudah tidak konek tapi tertulis konek,
 * sudah konek tapi masih merah". Sebabnya, sebelum berkas ini ada TUJUH
 * penanda yang masing-masing menghitung sendiri dari bahan yang berbeda:
 *
 *   - kartu Login e-Court      : keberadaan folder profil (berlaku null =
 *                                "belum diperiksa"), hanya slot "utama"
 *   - lampu panel ekstensi     : berlaku null dianggap HIDUP (hijau palsu)
 *   - status penarikan         : bukti terbaru dari pemeriksaan/pemantau/log,
 *                                dibandingkan sebagai TEKS waktu, log akun lain
 *                                ikut dipakai untuk akun utama
 *   - pemantau sesi            : hanya slot "utama", tidak tahu ada login baru
 *   - jadwal & popup tarik     : kode putaran terakhir (2 = sesi habis) yang
 *                                tinggal di memori sampai putaran berikutnya -
 *                                tetap "sesi habis" walau sudah login
 *   - tabel akun               : "diistirahatkan" 30 menit walau sudah login
 *   - kesehatan server         : tidak membaca sesi sama sekali
 *
 * Kini keadaan tiap akun dihitung DI SINI SAJA dari bukti nyata yang dicatat
 * oleh tiap peristiwa (masuk, pemeriksaan, penarikan, keluar), lalu dibaca
 * semua penanda lewat rute gateway yang sama.
 *
 * ============================================================================
 * LIMA KEADAAN
 * ============================================================================
 *
 *   aktif             hijau   terbukti tersambung (pemeriksaan, masuk, atau
 *                             penarikan berhasil) dalam SEGAR_MS terakhir
 *   perlu_masuk       kuning  e-Court mengalihkan ke halaman login / sesi
 *                             habis saat menarik / akun dipakai di perangkat
 *                             lain - sampai ada bukti baru
 *   tidak_tersambung  merah   e-Court tidak terjangkau (jaringan, habis
 *                             waktu, server e-Court gangguan) dalam SEGAR_MS
 *   memeriksa         kelabu  belum ada bukti, atau bukti terakhir sudah basi
 *                             (sedang/akan dipastikan ulang di latar)
 *   belum_diatur      kelabu  belum pernah masuk dari server ini, akun tidak
 *                             terdaftar, atau mode kembaran
 *
 * Peralihan: bukti TERBARU (dibandingkan dalam milidetik, bukan teks) yang
 * menentukan. Masuk berhasil langsung menjadi aktif dan melepas istirahat
 * akun. Keluar menghapus bukti (folder sesinya pun hilang -> belum_diatur).
 *
 * ============================================================================
 * TIDAK MEMBEBANI e-COURT
 * ============================================================================
 *
 * Pemeriksaan ulang di latar memakai jalan RINGAN lebih dulu (satu permintaan
 * bercookie, ecourtSesiRinganService). Chrome hanya bila ringan ragu, bukti
 * sudah melewati SEGAR_MS, tidak ada penarikan/login yang memakai profil, dan
 * paling sering sekali per JEDA_PERAMBAN_MS per akun. Detak latar hanya
 * berjalan bila penarikan berkala menyala (persetujuan admin menghubungi
 * e-Court) dan dapat dimatikan dengan ALETA_ECOURT_STATUS_LATAR=0.
 *
 * Tidak ada sandi, cookie, atau surel di berkas simpanan ini.
 */

const fs = require("fs");
const path = require("path");

const sesiEcourt = require("../tools/ecourt-bridge/sesi");

const KEADAAN = Object.freeze({
  AKTIF: "aktif",
  PERLU_MASUK: "perlu_masuk",
  TIDAK_TERSAMBUNG: "tidak_tersambung",
  MEMERIKSA: "memeriksa",
  BELUM_DIATUR: "belum_diatur",
});
const DAFTAR_KEADAAN = Object.values(KEADAAN);

/** Warna tetap per keadaan - dipakai portal & ekstensi apa adanya. */
const NADA = Object.freeze({
  aktif: "hijau",
  perlu_masuk: "kuning",
  tidak_tersambung: "merah",
  memeriksa: "kelabu",
  belum_diatur: "kelabu",
});

/** Bukti tersambung / tidak tersambung dipercaya selama ini. */
const SEGAR_MS = 30 * 60 * 1000;
/** Bukti lebih tua dari ini dipastikan ulang di latar (keadaan belum berubah). */
const PERIKSA_ULANG_MS = 15 * 60 * 1000;
/** Satu akun paling sering diperiksa ulang di latar. */
const JEDA_COBA_MS = 5 * 60 * 1000;
/** Chrome di latar paling sering sekali per jeda ini per akun. */
const JEDA_PERAMBAN_MS = 30 * 60 * 1000;
/** Detak latar. */
const DETAK_MS = 10 * 60 * 1000;
/** Riwayat log penarikan dibaca ulang paling cepat tiap ini. */
const SIMPAN_LOG_MS = 30 * 1000;

const JENIS_BUKTI = new Set([KEADAAN.AKTIF, KEADAAN.PERLU_MASUK, KEADAAN.TIDAK_TERSAMBUNG]);

/**
 * Menggolongkan kode alasan mentah dari pemeriksaan/login.
 *   "jaringan" - e-Court tidak terjangkau atau sedang gangguan
 *   "gerbang"  - e-Court meminta penegasan (akun dipakai di perangkat lain)
 *   ""         - lainnya (tidak menjadi bukti)
 */
function golongkanAlasan(alasan) {
  const teks = String(alasan || "");
  if (!teks) return "";
  if (/gerbang/i.test(teks)) return "gerbang";
  if (
    /galat_jaringan|ecourt_gangguan|status_5\d\d|habis_waktu|net::ERR_|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION|ERR_INTERNET|ERR_TIMED_OUT|ERR_ADDRESS|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|Navigation timeout|timeout of \d+|socket hang up/i.test(
      teks
    )
  ) {
    return "jaringan";
  }
  return "";
}

// ---------------------------------------------------------------------------
// Alat yang dapat ditukar uji. Semua dimuat malas: berkas ini dipanggil dari
// layanan login, penjadwal, dan pemeriksaan - require di kepala berkas akan
// membuat lingkaran.
// ---------------------------------------------------------------------------
const alat = {
  sekarang: () => Date.now(),
  kembaran: () => {
    try {
      return require("./kembaranMode").aktif();
    } catch {
      return false;
    }
  },
  daftarAkun: () => require("./ecourtAkunService").daftarAkun(),
  slotUtama: () => require("./ecourtAkunService").slotAkunUtama(),
  adaSesi: (slot) => sesiEcourt.sessionExists(slot),
  kredensial: (slot) => {
    try {
      const baris = require("./ecourtKredensialService")
        .daftar()
        .find((x) => x.slot === slot);
      return baris ? { adaSandi: Boolean(baris.adaSandi), email: String(baris.email || "") } : { adaSandi: false, email: "" };
    } catch {
      return { adaSandi: false, email: "" };
    }
  },
  menungguCaptcha: (slot) => {
    try {
      const login = require("./ecourtLoginService");
      return typeof login.slotMenunggu === "function" && login.slotMenunggu() === slot;
    } catch {
      return false;
    }
  },
  /** Ada yang sedang memakai profil Chrome (penarikan, login, pemulihan)? */
  sibuk: () => {
    try {
      const j = require("./ecourtSchedulerService").getStatus();
      if (j.sedangJalan || j.adaPenarikanLain) return true;
    } catch {
      /* penjadwal tidak termuat - lanjut */
    }
    try {
      if (require("./ecourtLoginService").sedangMenunggu()) return true;
    } catch {
      /* - */
    }
    try {
      if (require("./ecourtPulihService").sedangMemulihkan() === true) return true;
    } catch {
      /* - */
    }
    return false;
  },
  penjadwalMenyala: () => {
    try {
      const j = require("./ecourtSchedulerService").getStatus();
      return Boolean(j && j.pengaturan && j.pengaturan.aktif);
    } catch {
      return false;
    }
  },
  riwayatLog: () => {
    const folder = path.resolve(__dirname, "..", "reports");
    return require("./ecourtPenarikanStatusService").bacaRiwayat({ folder, batas: 15 });
  },
  periksaRingan: (slot) => require("./ecourtSesiRinganService").periksaRingan(slot),
  periksaPenuh: (slot) => require("./ecourtLoginService").periksaSesi({ cepat: false, slot }),
  lepasIstirahat: (slot) => {
    try {
      const akun = require("./ecourtAkunService");
      if (typeof akun.lepasIstirahat === "function") akun.lepasIstirahat(slot);
    } catch {
      /* - */
    }
  },
};

function aturAlat(baru = {}) {
  Object.assign(alat, baru);
}

function bersihkan(slot) {
  return sesiEcourt.bersihkanSlot(slot);
}

// ---------------------------------------------------------------------------
// Simpanan bukti: <sessionRoot>/status-akun.json - folder sesi yang sudah
// di-mount sebagai volume, sehingga bukti bertahan melewati penyalaan ulang.
// ---------------------------------------------------------------------------
let tembolok = { jalur: "", isi: null };

function jalurSimpanan() {
  return path.join(sesiEcourt.sessionRoot(), "status-akun.json");
}

function bacaSimpanan() {
  const jalur = jalurSimpanan();
  if (tembolok.jalur === jalur && tembolok.isi) return tembolok.isi;
  let isi = {};
  try {
    const mentah = JSON.parse(fs.readFileSync(jalur, "utf8"));
    if (mentah && typeof mentah === "object" && mentah.akun && typeof mentah.akun === "object") isi = mentah.akun;
  } catch {
    isi = {};
  }
  tembolok = { jalur, isi };
  return isi;
}

function tulisSimpanan(isi) {
  const jalur = jalurSimpanan();
  tembolok = { jalur, isi };
  try {
    fs.mkdirSync(path.dirname(jalur), { recursive: true, mode: 0o700 });
    const sementara = `${jalur}.${process.pid}.tmp`;
    fs.writeFileSync(sementara, JSON.stringify({ versi: 1, akun: isi }, null, 2), { mode: 0o600 });
    fs.renameSync(sementara, jalur);
  } catch {
    // Gagal menulis tidak menggagalkan apa pun: tembolok memori tetap benar
    // sampai bot dinyalakan ulang.
  }
}

function entri(isi, slot) {
  if (!isi[slot] || typeof isi[slot] !== "object") isi[slot] = {};
  return isi[slot];
}

/** Untuk uji: lupakan tembolok berkas. */
function setelUlang() {
  tembolok = { jalur: "", isi: null };
  sedang.clear();
  logTembolok = { padaMs: 0, isi: [] };
}

// ---------------------------------------------------------------------------
// Mencatat bukti
// ---------------------------------------------------------------------------

/**
 * Mencatat satu bukti keadaan akun.
 *
 * @param {string} slot
 * @param {{ jenis: "aktif"|"perlu_masuk"|"tidak_tersambung", sumber?: string, alasan?: string, padaMs?: number }} bukti
 *   sumber: "masuk" | "pemeriksaan" | "penarikan" | "pemantau" | "pemulihan"
 */
function catat(slot, { jenis, sumber = "", alasan = "", padaMs } = {}) {
  if (!JENIS_BUKTI.has(jenis)) return null;
  const kunci = bersihkan(slot);
  const pada = Number.isFinite(Number(padaMs)) && Number(padaMs) > 0 ? Number(padaMs) : alat.sekarang();
  const isi = bacaSimpanan();
  const e = entri(isi, kunci);
  const lama = e.bukti && Number(e.bukti.padaMs) ? Number(e.bukti.padaMs) : 0;
  if (pada >= lama) {
    e.bukti = {
      jenis,
      padaMs: pada,
      sumber: String(sumber || "").slice(0, 40),
      // Hanya kode singkat - tidak pernah isi halaman, apalagi sandi.
      alasan: String(alasan || "").replace(/\s+/g, " ").slice(0, 120),
    };
  }
  if (jenis === KEADAAN.AKTIF) {
    e.sandiDitolakPadaMs = 0;
    alat.lepasIstirahat(kunci);
  }
  tulisSimpanan(isi);
  return e.bukti;
}

/** Hasil mentah periksaSesi (Chrome) -> bukti. Tanpa bukti bila ragu. */
function catatPemeriksaan(slot, hasil, { sumber = "pemeriksaan" } = {}) {
  if (!hasil || hasil.tersimpan === false) return null;
  if (hasil.berlaku === true) return catat(slot, { jenis: KEADAAN.AKTIF, sumber });
  if (hasil.berlaku === false) return catat(slot, { jenis: KEADAAN.PERLU_MASUK, sumber, alasan: hasil.alasan || "sesi_kedaluwarsa" });
  const golongan = golongkanAlasan(hasil.alasan);
  if (golongan === "gerbang") return catat(slot, { jenis: KEADAAN.PERLU_MASUK, sumber, alasan: "gerbang" });
  if (golongan === "jaringan") return catat(slot, { jenis: KEADAAN.TIDAK_TERSAMBUNG, sumber, alasan: hasil.alasan });
  return null;
}

/** Hasil pemeriksaan ringan -> bukti (hanya yang pasti). */
function catatRingan(slot, hasil) {
  if (!hasil) return null;
  if (hasil.pasti && hasil.berlaku === true) return catat(slot, { jenis: KEADAAN.AKTIF, sumber: "pemeriksaan" });
  // e-Court mengalihkan ke halaman penegasan - pasti, tanpa perlu Chrome.
  if (golongkanAlasan(hasil.alasan) === "gerbang") {
    return catat(slot, { jenis: KEADAAN.PERLU_MASUK, sumber: "pemeriksaan", alasan: "gerbang" });
  }
  if (golongkanAlasan(hasil.alasan) === "jaringan") {
    return catat(slot, { jenis: KEADAAN.TIDAK_TERSAMBUNG, sumber: "pemeriksaan", alasan: hasil.alasan });
  }
  return null;
}

/** Akhir satu putaran penarikan (kode keluar jembatan). */
function catatPenarikan(slot, { kode, catatan = "" } = {}) {
  if (!slot) return null;
  if (kode === 0) return catat(slot, { jenis: KEADAAN.AKTIF, sumber: "penarikan" });
  if (kode === 2) return catat(slot, { jenis: KEADAAN.PERLU_MASUK, sumber: "penarikan", alasan: "sesi_habis" });
  // Gagal karena sebab lain bukan bukti keadaan sesi - dicatat sebagai galat
  // terakhir supaya penanda dapat menyebutnya tanpa mengubah warna.
  const isi = bacaSimpanan();
  const e = entri(isi, bersihkan(slot));
  e.galat = { padaMs: alat.sekarang(), teks: String(catatan || `kode ${kode}`).replace(/\s+/g, " ").slice(0, 160) };
  if (golongkanAlasan(catatan) === "jaringan") {
    e.bukti = { jenis: KEADAAN.TIDAK_TERSAMBUNG, padaMs: alat.sekarang(), sumber: "penarikan", alasan: "jaringan" };
  }
  tulisSimpanan(isi);
  return e.bukti || null;
}

/** Login dengan sandi TERSIMPAN ditolak e-Court (bukan captcha). */
function catatSandiDitolak(slot) {
  const isi = bacaSimpanan();
  entri(isi, bersihkan(slot)).sandiDitolakPadaMs = alat.sekarang();
  tulisSimpanan(isi);
}

/** Sandi baru disimpan - tanda "sandi ditolak" dilepas. */
function lepasSandiDitolak(slot) {
  const isi = bacaSimpanan();
  const e = isi[bersihkan(slot)];
  if (e && e.sandiDitolakPadaMs) {
    e.sandiDitolakPadaMs = 0;
    tulisSimpanan(isi);
  }
}

/**
 * Sesi dihapus (keluar) / akun dihapus: bukti lama dibuang dan waktu keluar
 * dicatat. Selama tidak ada bukti yang LEBIH BARU dari waktu keluar, akun
 * dianggap belum diatur - walau folder profilnya belum sempat terhapus
 * (Chrome yang baru ditutup dapat masih mengunci berkasnya sesaat).
 */
function lupakan(slot) {
  const isi = bacaSimpanan();
  const kunci = bersihkan(slot);
  isi[kunci] = { keluarPadaMs: alat.sekarang() };
  tulisSimpanan(isi);
}

// ---------------------------------------------------------------------------
// Bukti dari log penarikan (termasuk skrip host yang berjalan di luar bot)
// ---------------------------------------------------------------------------
let logTembolok = { padaMs: 0, isi: [] };

function buktiLog(slot) {
  const kini = alat.sekarang();
  if (kini - logTembolok.padaMs > SIMPAN_LOG_MS) {
    let isi = [];
    try {
      isi = alat.riwayatLog() || [];
    } catch {
      isi = [];
    }
    logTembolok = { padaMs: kini, isi };
  }
  for (const r of logTembolok.isi) {
    if (typeof r.sesiBerlaku !== "boolean") continue;
    if (bersihkan(r.akun || sesiEcourt.SLOT_BAWAAN) !== slot) continue;
    const pada = Date.parse(r.sesiBerlaku ? r.mulai || r.selesai : r.selesai || r.mulai);
    if (!Number.isFinite(pada)) continue;
    return {
      jenis: r.sesiBerlaku ? KEADAAN.AKTIF : KEADAAN.PERLU_MASUK,
      padaMs: pada,
      sumber: "penarikan",
      alasan: r.sesiBerlaku ? "" : "sesi_habis",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Menyusun status - FUNGSI MURNI
// ---------------------------------------------------------------------------

const sedang = new Map();

/**
 * @param {object} m
 * @param {string} m.slot
 * @param {boolean} m.terdaftar
 * @param {boolean} m.adaSesi       folder profil ada
 * @param {boolean} m.kembaran
 * @param {{jenis:string,padaMs:number,sumber:string,alasan:string}|null} m.bukti
 * @param {boolean} m.sedangMemeriksa
 * @param {number} m.sekarangMs
 */
function susunStatus(m) {
  const sekarangMs = Number(m.sekarangMs) || Date.now();
  const bukti = m.bukti && JENIS_BUKTI.has(m.bukti.jenis) ? m.bukti : null;
  const umurMs = bukti ? Math.max(0, sekarangMs - Number(bukti.padaMs || 0)) : null;
  const dasar = {
    slot: m.slot || "",
    label: m.label || m.slot || "",
    utama: Boolean(m.utama),
    aktifAkun: m.aktifAkun !== false,
    diperiksaPada: bukti ? new Date(Number(bukti.padaMs)).toISOString() : "",
    umurDetik: umurMs === null ? null : Math.round(umurMs / 1000),
    sumber: bukti ? bukti.sumber || "" : "",
    sedangMemeriksa: Boolean(m.sedangMemeriksa),
    menungguCaptcha: Boolean(m.menungguCaptcha),
    adaSandi: Boolean(m.adaSandi),
    sandiDitolak: Boolean(m.sandiDitolakPadaMs) && (!bukti || Number(m.sandiDitolakPadaMs) >= Number(bukti.padaMs || 0)),
    galatTerakhir:
      m.galat && m.galat.padaMs
        ? { pada: new Date(Number(m.galat.padaMs)).toISOString(), teks: String(m.galat.teks || "") }
        : null,
  };
  const jadi = (keadaan, kodeSebab, tindakan = "") => ({
    ...dasar,
    keadaan,
    nada: NADA[keadaan],
    kodeSebab,
    // "masuk"      - belum pernah masuk: buka captcha (dan sandi bila belum tersimpan)
    // "masuk_lagi" - sesi habis: buka kotak captcha saja bila sandi tersimpan
    // "periksa"    - minta pemeriksaan sekarang
    tindakan,
  });

  if (m.kembaran) return jadi(KEADAAN.BELUM_DIATUR, "kembaran");
  if (m.terdaftar === false) return jadi(KEADAAN.BELUM_DIATUR, "tidak_terdaftar");
  if (!m.adaSesi) return jadi(KEADAAN.BELUM_DIATUR, m.sudahKeluar ? "sesi_dihapus" : "belum_pernah_masuk", "masuk");

  if (!bukti) {
    // Kotak captcha terbuka untuk akun yang belum pernah terbukti masuk.
    if (m.menungguCaptcha) return jadi(KEADAAN.BELUM_DIATUR, "belum_pernah_masuk", "masuk");
    return jadi(KEADAAN.MEMERIKSA, m.sedangMemeriksa ? "sedang_diperiksa" : "belum_diperiksa", "periksa");
  }
  if (bukti.jenis === KEADAAN.PERLU_MASUK) {
    const g = golongkanAlasan(bukti.alasan);
    const kode = g === "gerbang" ? "gerbang" : bukti.alasan === "halaman_masuk" ? "perlu_masuk" : "sesi_habis";
    return jadi(KEADAAN.PERLU_MASUK, kode, "masuk_lagi");
  }
  if (umurMs > SEGAR_MS) {
    // Bukti lama tidak dipakai sebagai jawaban - itulah "tertulis konek
    // padahal sudah tidak". Keadaannya ditunjukkan apa adanya: belum pasti.
    return jadi(KEADAAN.MEMERIKSA, bukti.jenis === KEADAAN.AKTIF ? "bukti_basi_aktif" : "bukti_basi_putus", "periksa");
  }
  if (bukti.jenis === KEADAAN.TIDAK_TERSAMBUNG) return jadi(KEADAAN.TIDAK_TERSAMBUNG, "jaringan", "periksa");
  return jadi(KEADAAN.AKTIF, "terbukti");
}

/** Status satu slot dari seluruh bahan yang ada. */
function statusSlot(slot, { daftar } = {}) {
  const kunci = bersihkan(slot);
  const akunSemua = Array.isArray(daftar) ? daftar : safe(() => alat.daftarAkun(), []);
  const akun = akunSemua.find((a) => a.slot === kunci) || null;
  const isi = bacaSimpanan();
  const e = isi[kunci] || {};
  const keluarPadaMs = Number(e.keluarPadaMs || 0);
  let dariLog = buktiLog(kunci);
  if (dariLog && dariLog.padaMs <= keluarPadaMs) dariLog = null;
  let bukti = e.bukti && JENIS_BUKTI.has(e.bukti.jenis) ? e.bukti : null;
  if (dariLog && (!bukti || dariLog.padaMs > Number(bukti.padaMs || 0))) bukti = dariLog;
  const sudahKeluar = keluarPadaMs > 0 && !bukti;
  const kred = safe(() => alat.kredensial(kunci), { adaSandi: false, email: "" });
  return susunStatus({
    slot: kunci,
    label: akun ? akun.label : kunci,
    utama: akun ? Boolean(akun.utama) : false,
    aktifAkun: akun ? akun.aktif !== false : true,
    terdaftar: Boolean(akun),
    adaSesi: !sudahKeluar && safe(() => alat.adaSesi(kunci), false),
    sudahKeluar,
    kembaran: safe(() => alat.kembaran(), false),
    bukti,
    galat: e.galat || null,
    sandiDitolakPadaMs: Number(e.sandiDitolakPadaMs || 0),
    sedangMemeriksa: sedang.has(kunci),
    menungguCaptcha: safe(() => alat.menungguCaptcha(kunci), false),
    adaSandi: kred.adaSandi,
    sekarangMs: alat.sekarang(),
  });
}

function safe(fn, cadangan) {
  try {
    const hasil = fn();
    return hasil === undefined ? cadangan : hasil;
  } catch {
    return cadangan;
  }
}

/** Urutan pilihan ringkasan bila akun utama tidak ditetapkan. */
const PERINGKAT_RINGKAS = { aktif: 0, memeriksa: 1, perlu_masuk: 2, tidak_tersambung: 3, belum_diatur: 4 };

/**
 * Status SELURUH akun + ringkasan (akun utama; bila tidak ada, akun aktif
 * dengan keadaan terbaik).
 */
function statusSemua({ segarkan = false } = {}) {
  const daftar = safe(() => alat.daftarAkun(), []);
  const akun = daftar.map((a) => statusSlot(a.slot, { daftar }));
  const utama = safe(() => alat.slotUtama(), "");
  let ringkas = akun.find((a) => a.slot === utama) || null;
  if (!ringkas) {
    const calon = akun.filter((a) => a.aktifAkun);
    ringkas =
      (calon.length ? calon : akun).slice().sort((a, b) => PERINGKAT_RINGKAS[a.keadaan] - PERINGKAT_RINGKAS[b.keadaan])[0] ||
      susunStatus({ slot: "", terdaftar: false, kembaran: safe(() => alat.kembaran(), false), sekarangMs: alat.sekarang() });
  }
  if (segarkan) void segarkanYangBasi(akun);
  return {
    ok: true,
    dibaca: new Date(alat.sekarang()).toISOString(),
    utama,
    segarMenit: Math.round(SEGAR_MS / 60000),
    akun,
    ringkas,
  };
}

// ---------------------------------------------------------------------------
// Pemeriksaan ulang
// ---------------------------------------------------------------------------

/** Tanda sedang memeriksa - dipakai periksaSesi (Chrome) juga. */
function mulaiPeriksa(slot) {
  const kunci = bersihkan(slot);
  if (!sedang.has(kunci)) sedang.set(kunci, null);
}
function selesaiPeriksa(slot) {
  const kunci = bersihkan(slot);
  if (sedang.get(kunci) === null) sedang.delete(kunci);
}

/**
 * Memastikan keadaan satu slot sekarang: ringan lebih dulu, Chrome bila ragu.
 *
 * @param {string} slot
 * @param {{ paksa?: boolean, bolehPeramban?: boolean }} o
 *   paksa         - abaikan jeda (tombol "Periksa sekarang")
 *   bolehPeramban - Chrome boleh dipakai bila ringan ragu
 */
function segarkan(slot, { paksa = false, bolehPeramban = false } = {}) {
  const kunci = bersihkan(slot);
  if (safe(() => alat.kembaran(), false)) return Promise.resolve(statusSlot(kunci));
  const berjalan = sedang.get(kunci);
  if (berjalan) return berjalan;

  const isi = bacaSimpanan();
  const e = entri(isi, kunci);
  const kini = alat.sekarang();
  if (!paksa && kini - Number(e.cobaMs || 0) < JEDA_COBA_MS) return Promise.resolve(statusSlot(kunci));
  if (!safe(() => alat.adaSesi(kunci), false)) return Promise.resolve(statusSlot(kunci));
  e.cobaMs = kini;
  tulisSimpanan(isi);

  const kerja = (async () => {
    try {
      let ringan = null;
      try {
        ringan = await alat.periksaRingan(kunci);
      } catch {
        ringan = null;
      }
      const bukti = catatRingan(kunci, ringan);
      if (bukti) return statusSlot(kunci);
      if (!bolehPeramban && !paksa) return statusSlot(kunci);
      if (safe(() => alat.sibuk(), true)) return statusSlot(kunci);
      const isi2 = bacaSimpanan();
      const e2 = entri(isi2, kunci);
      if (!paksa && alat.sekarang() - Number(e2.perambanMs || 0) < JEDA_PERAMBAN_MS) return statusSlot(kunci);
      e2.perambanMs = alat.sekarang();
      tulisSimpanan(isi2);
      try {
        // periksaSesi mencatat buktinya sendiri (catatPemeriksaan).
        await alat.periksaPenuh(kunci);
      } catch {
        /* galat pemeriksaan bukan bukti */
      }
      return statusSlot(kunci);
    } finally {
      sedang.delete(kunci);
    }
  })();
  sedang.set(kunci, kerja);
  return kerja;
}

/** Slot berbukti basi diperiksa ulang di latar, satu per satu. */
async function segarkanYangBasi(daftarStatus) {
  const kini = alat.sekarang();
  for (const s of daftarStatus || []) {
    if (!s || s.keadaan === KEADAAN.BELUM_DIATUR) continue;
    if (!s.utama && !s.aktifAkun) continue;
    const umurMs = s.umurDetik === null ? Infinity : s.umurDetik * 1000;
    if (umurMs < PERIKSA_ULANG_MS) continue;
    // Chrome hanya bila bukti sudah melewati masa percaya dan akunnya bukan
    // yang jelas perlu masuk (Chrome tidak dapat menghidupkan sesi mati).
    const bolehPeramban = umurMs >= SEGAR_MS && s.keadaan !== KEADAAN.PERLU_MASUK;
    try {
      await segarkan(s.slot, { bolehPeramban });
    } catch {
      /* lanjut ke akun berikutnya */
    }
    if (alat.sekarang() - kini > 5 * 60 * 1000) break;
  }
}

// ---------------------------------------------------------------------------
// Detak latar
// ---------------------------------------------------------------------------
let pewaktu = null;

function berhenti() {
  if (pewaktu) {
    clearInterval(pewaktu);
    pewaktu = null;
  }
}

function mulai() {
  berhenti();
  if (safe(() => alat.kembaran(), false)) return;
  if (String(process.env.ALETA_ECOURT_STATUS_LATAR || "1").trim() === "0") return;
  pewaktu = setInterval(() => {
    if (!safe(() => alat.penjadwalMenyala(), false)) return;
    try {
      void segarkanYangBasi(statusSemua().akun).catch(() => {});
    } catch {
      /* detak berikutnya */
    }
  }, DETAK_MS);
  if (pewaktu && typeof pewaktu.unref === "function") pewaktu.unref();
}

module.exports = {
  DAFTAR_KEADAAN,
  DETAK_MS,
  JEDA_COBA_MS,
  JEDA_PERAMBAN_MS,
  KEADAAN,
  NADA,
  PERIKSA_ULANG_MS,
  SEGAR_MS,
  aturAlat,
  berhenti,
  catat,
  catatPemeriksaan,
  catatPenarikan,
  catatRingan,
  catatSandiDitolak,
  golongkanAlasan,
  jalurSimpanan,
  lepasSandiDitolak,
  lupakan,
  mulai,
  mulaiPeriksa,
  segarkan,
  segarkanYangBasi,
  selesaiPeriksa,
  setelUlang,
  statusSemua,
  statusSlot,
  susunStatus,
};
