"use strict";

/**
 * Beberapa akun e-Court yang dipakai bergiliran.
 *
 * ============================================================================
 * YANG DISIMPAN ADALAH PROFIL SESI, BUKAN SANDI
 * ============================================================================
 *
 * "Akun" di sini berarti satu folder profil peramban yang SUDAH pernah
 * dilogin-kan oleh manusia dari portal. ALETA tidak pernah menyimpan nama
 * pengguna maupun sandi e-Court, dan tidak pernah mengisi captcha.
 *
 * Karena itu menambah akun berarti dua langkah: mendaftarkan slotnya di sini,
 * lalu petugas login sekali ke slot itu. Tidak ada jalan pintas, dan itu
 * memang disengaja.
 *
 * ============================================================================
 * KENAPA BERGILIRAN MENOLONG
 * ============================================================================
 *
 * Sesi e-Court habis sendiri, dan menghidupkannya kembali menuntut manusia
 * mengisi captcha. Dengan satu akun, penarikan berhenti total sampai ada yang
 * sempat login - kerap berarti semalaman atau sepanjang akhir pekan.
 *
 * Dengan beberapa akun, sesi yang mati hanya menggeser pekerjaan ke akun
 * berikutnya. Penarikan terus berjalan, dan login menyusul saat ada waktu.
 *
 * ============================================================================
 * SATU AKUN PADA SATU WAKTU
 * ============================================================================
 *
 * Bergiliran BUKAN berarti bersamaan. Menarik dengan dua akun sekaligus
 * menggandakan beban ke server Mahkamah Agung tanpa mempercepat apa pun yang
 * berarti, dan justru menyerupai perilaku yang membuat akun ditandai. Penjaga
 * putaran tunggal di penjadwal tetap berlaku apa adanya.
 */

const { readRuntimeConfig, writeRuntimeConfig } = require("../config/runtime-config");
const logService = require("./logService");
const sesiEcourt = require("../tools/ecourt-bridge/sesi");

/**
 * Berapa lama satu akun diistirahatkan setelah sesinya kedapatan mati.
 *
 * Bukan selamanya: petugas dapat login ke akun itu kapan saja, dan akun yang
 * diistirahatkan selamanya tidak akan pernah dicoba lagi walau sudah hidup.
 */
const ISTIRAHAT_MS = 30 * 60 * 1000;

const BAWAAN = [{ slot: "utama", label: "Akun utama", aktif: true }];

/** Keadaan dalam memori - tidak perlu bertahan antar penyalaan ulang. */
const keadaan = {
  /** slot -> { gagalPada, alasan } */
  gagal: new Map(),
  terakhirDipakai: "",
};

/**
 * ============================================================================
 * AKUN UTAMA - PENARIKANNYA SELALU JALAN (13 Okt 2026, butir 11)
 * ============================================================================
 *
 * Terukur di server 13 Okt: runtime config TIDAK punya ecourtJadwal, jadi
 * penjadwal berkala memakai bawaannya (aktif: false) dan penarik verifikasi
 * harian - yang ikut syarat penjadwal - tidak pernah jalan. 12 Okt satu-satunya
 * penarikan adalah tombol "belum upload" yang ditekan orang.
 *
 * Satu akun ditandai AKUN UTAMA. Selama akun itu sah (terdaftar dan pernah
 * login - folder sesinya ada), penarikan berkala dan penarik verifikasi harian
 * SELALU menyala, apa pun saklar penjadwalnya; akunnya sendiri tidak dapat
 * dimatikan atau dihapus. Menghentikannya harus disengaja: melepas tanda akun
 * utama dengan kata penegas.
 *
 * Bawaan: slot "utama" (labelnya memang "Akun utama") bila terdaftar, sampai
 * admin memilih akun lain atau melepasnya. Yang disimpan hanya NAMA SLOT -
 * bukan surel, bukan sandi.
 */
const SLOT_UTAMA_BAWAAN = "utama";
const KATA_PENEGAS_LEPAS = "LEPAS";

function bacaDaftar(runtimeConfig) {
  const tersimpan = (runtimeConfig || readRuntimeConfig() || {}).ecourtAkun;
  if (!Array.isArray(tersimpan) || tersimpan.length === 0) return BAWAAN.map((a) => ({ ...a }));

  const hasil = [];
  const terlihat = new Set();
  for (const item of tersimpan) {
    const slot = sesiEcourt.bersihkanSlot(item && item.slot);
    if (terlihat.has(slot)) continue;
    terlihat.add(slot);
    hasil.push({
      slot,
      label: String((item && item.label) || slot).slice(0, 60),
      aktif: item ? item.aktif !== false : true,
    });
  }
  return hasil.length > 0 ? hasil : BAWAAN.map((a) => ({ ...a }));
}

/** Slot akun utama yang berlaku ("" = belum dipilih atau sengaja dilepas). */
function slotAkunUtama(runtimeConfig) {
  const config = runtimeConfig || readRuntimeConfig() || {};
  const t = config.ecourtAkunUtama;
  if (t && typeof t === "object" && t.dilepas === true) return "";
  const pilihan = t && typeof t === "object" ? String(t.slot || "") : typeof t === "string" ? t : "";
  if (pilihan.trim()) return sesiEcourt.bersihkanSlot(pilihan);
  return bacaDaftar(config).some((a) => a.slot === SLOT_UTAMA_BAWAAN) ? SLOT_UTAMA_BAWAAN : "";
}

/**
 * Keadaan akun utama - untuk penjadwal (sah = selalu menyala) dan peringatan
 * di layar admin.
 *
 * @returns {{ slot: string, label: string, dipilih: boolean, sah: boolean, alasan: string, pesan: string, bawaan: boolean }}
 */
function keadaanAkunUtama(runtimeConfig) {
  const config = runtimeConfig || readRuntimeConfig() || {};
  const t = config.ecourtAkunUtama;
  const slot = slotAkunUtama(config);
  const bawaan = !(t && typeof t === "object" && (t.slot || t.dilepas)) && typeof t !== "string";
  if (!slot) {
    const dilepas = Boolean(t && typeof t === "object" && t.dilepas === true);
    return {
      slot: "",
      label: "",
      dipilih: false,
      sah: false,
      bawaan,
      alasan: dilepas ? "dilepas" : "belum_dipilih",
      pesan: dilepas
        ? "Akun utama sengaja dilepas - penarikan otomatis hanya mengikuti saklar Penarikan Berkala."
        : "Akun utama belum dipilih - penarikan otomatis tidak dijamin jalan. Pilih satu akun sebagai akun utama.",
    };
  }
  const akun = bacaDaftar(config).find((a) => a.slot === slot);
  if (!akun) {
    return {
      slot,
      label: "",
      dipilih: true,
      sah: false,
      bawaan,
      alasan: "akun_tidak_terdaftar",
      pesan: `Akun utama "${slot}" tidak ada di daftar akun - pilih ulang akun utama.`,
    };
  }
  if (!sesiEcourt.sessionExists(slot)) {
    return {
      slot,
      label: akun.label,
      dipilih: true,
      sah: false,
      bawaan,
      alasan: "belum_login",
      pesan: `Akun utama "${akun.label}" belum pernah login e-Court - login sekali dari kartu Login e-Court.`,
    };
  }
  return { slot, label: akun.label, dipilih: true, sah: true, bawaan, alasan: "", pesan: "" };
}

/** Penjadwal dimuat malas - ia sendiri memuat berkas ini. */
function mulaiUlangPenjadwal() {
  try {
    require("./ecourtSchedulerService").mulaiUlang();
  } catch {
    // Penjadwal tidak termuat (uji) - perubahan berlaku saat bot menyala.
  }
}

/** Menandai satu akun terdaftar sebagai akun utama (dan menyalakannya). */
function pilihAkunUtama(slot, { olehSiapa = "" } = {}) {
  const nama = sesiEcourt.bersihkanSlot(slot);
  const config = readRuntimeConfig() || {};
  const daftar = bacaDaftar(config);
  const i = daftar.findIndex((a) => a.slot === nama);
  if (!slot || i < 0) return { ok: false, alasan: "akun_tidak_ditemukan" };
  daftar[i] = { ...daftar[i], aktif: true };
  writeRuntimeConfig({
    ...config,
    ecourtAkun: daftar,
    ecourtAkunUtama: { slot: nama, dipilihPada: new Date().toISOString(), olehSiapa: String(olehSiapa || "") },
  });
  void logService.logSecurityEvent({
    eventType: "ecourt_akun_utama_dipilih",
    severity: "warning",
    message: `Akun e-Court "${nama}" ditandai akun utama - penarikannya selalu jalan.`,
    metadata: { slot: nama, olehSiapa: String(olehSiapa || "") },
  });
  mulaiUlangPenjadwal();
  return { ok: true, alasan: "", akunUtama: keadaanAkunUtama(), akun: daftarAkun() };
}

/**
 * Melepas tanda akun utama. HARUS disengaja: kata penegas "LEPAS" wajib ikut,
 * supaya satu klik yang keliru tidak menghentikan penarikan otomatis.
 */
function lepasAkunUtama({ konfirmasi = "", olehSiapa = "" } = {}) {
  if (String(konfirmasi || "").trim().toUpperCase() !== KATA_PENEGAS_LEPAS) {
    return { ok: false, alasan: "perlu_kata_penegas" };
  }
  const config = readRuntimeConfig() || {};
  const sebelumnya = slotAkunUtama(config);
  writeRuntimeConfig({
    ...config,
    ecourtAkunUtama: { dilepas: true, dilepasPada: new Date().toISOString(), olehSiapa: String(olehSiapa || "") },
  });
  void logService.logSecurityEvent({
    eventType: "ecourt_akun_utama_dilepas",
    severity: "critical",
    message: `Tanda akun utama e-Court "${sebelumnya || "-"}" dilepas - penarikan otomatis kembali mengikuti saklar penjadwal.`,
    metadata: { slot: sebelumnya, olehSiapa: String(olehSiapa || "") },
  });
  mulaiUlangPenjadwal();
  return { ok: true, alasan: "", akunUtama: keadaanAkunUtama(), akun: daftarAkun() };
}

function tulisDaftar(daftar) {
  const sekarang = readRuntimeConfig();
  writeRuntimeConfig({ ...sekarang, ecourtAkun: daftar });
}

/** Apakah akun ini sedang diistirahatkan karena sesinya mati? */
function sedangIstirahat(slot) {
  const catatan = keadaan.gagal.get(slot);
  if (!catatan) return false;
  return Date.now() - catatan.gagalPada < ISTIRAHAT_MS;
}

/** Daftar akun beserta keadaan sesinya. */
function daftarAkun() {
  const config = readRuntimeConfig() || {};
  const utama = slotAkunUtama(config);
  return bacaDaftar(config).map((akun) => {
    const catatan = keadaan.gagal.get(akun.slot);
    return {
      ...akun,
      // Akun utama selalu aktif, apa pun yang tersimpan.
      aktif: akun.slot === utama ? true : akun.aktif,
      utama: akun.slot === utama,
      adaSesi: sesiEcourt.sessionExists(akun.slot),
      istirahat: sedangIstirahat(akun.slot),
      gagalTerakhir: catatan ? new Date(catatan.gagalPada).toISOString() : null,
      alasanGagal: catatan ? catatan.alasan : "",
      terakhirDipakai: keadaan.terakhirDipakai === akun.slot,
    };
  });
}

/**
 * Memilih akun yang siap dipakai penarikan berikutnya.
 *
 * Berputar: dimulai dari SESUDAH yang terakhir dipakai. Tanpa itu, akun
 * pertama selalu terpilih dan akun kedua tidak pernah tersentuh sampai yang
 * pertama mati - yang berarti sesi akun kedua justru menganggur sampai basi.
 *
 * @returns {{ ok: boolean, slot: string, alasan: string }}
 */
function pilihAkunSiap() {
  const config = readRuntimeConfig() || {};
  const utama = slotAkunUtama(config);
  const daftar = bacaDaftar(config).filter((akun) => akun.aktif || akun.slot === utama);
  if (daftar.length === 0) return { ok: false, slot: "", alasan: "tidak_ada_akun_aktif" };

  // Akun utama didahulukan selama sesinya ada dan tidak sedang diistirahatkan
  // (butir 11, 13 Okt 2026); akun lain menjadi cadangan bergiliran.
  if (utama && sesiEcourt.sessionExists(utama) && !sedangIstirahat(utama)) {
    return { ok: true, slot: utama, alasan: "" };
  }

  const mulaiDari = Math.max(
    0,
    daftar.findIndex((akun) => akun.slot === keadaan.terakhirDipakai) + 1
  );

  const berurut = [...daftar.slice(mulaiDari), ...daftar.slice(0, mulaiDari)];

  const bersesi = berurut.filter((akun) => sesiEcourt.sessionExists(akun.slot));
  if (bersesi.length === 0) {
    return { ok: false, slot: "", alasan: "tidak_ada_akun_bersesi" };
  }

  const siap = bersesi.find((akun) => !sedangIstirahat(akun.slot));
  if (siap) return { ok: true, slot: siap.slot, alasan: "" };

  // Seluruhnya sedang diistirahatkan. Yang paling lama beristirahat tetap
  // dicoba - menolak menarik sama sekali karena semuanya pernah gagal berarti
  // penarikan berhenti permanen setelah satu malam yang buruk.
  const terlama = bersesi
    .slice()
    .sort(
      (a, b) =>
        (keadaan.gagal.get(a.slot)?.gagalPada || 0) - (keadaan.gagal.get(b.slot)?.gagalPada || 0)
    )[0];

  return { ok: true, slot: terlama.slot, alasan: "seluruh_akun_istirahat_dicoba_yang_terlama" };
}

/** Menandai akun berhasil dipakai. */
function tandaiBerhasil(slot) {
  const nama = sesiEcourt.bersihkanSlot(slot);
  keadaan.gagal.delete(nama);
  keadaan.terakhirDipakai = nama;
}

/** Menandai sesi akun mati, supaya penarikan berikutnya beralih. */
function tandaiGagal(slot, alasan = "") {
  const nama = sesiEcourt.bersihkanSlot(slot);
  keadaan.gagal.set(nama, { gagalPada: Date.now(), alasan: String(alasan || "").slice(0, 200) });
  keadaan.terakhirDipakai = nama;

  void logService.logSystemEvent({
    eventType: "ecourt_akun_diistirahatkan",
    severity: "warning",
    message: `Sesi akun e-Court "${nama}" tidak berlaku; penarikan beralih ke akun lain.`,
    metadata: { slot: nama, alasan: String(alasan || "") },
  });
}

/** Menambah atau menyunting satu akun. */
function simpanAkun({ slot, label, aktif, olehSiapa = "" }) {
  const nama = sesiEcourt.bersihkanSlot(slot);
  const daftar = bacaDaftar();

  if (aktif === false && nama === slotAkunUtama()) {
    return { ok: false, alasan: "akun_utama_selalu_aktif" };
  }

  const adaIndeks = daftar.findIndex((akun) => akun.slot === nama);
  const isi = {
    slot: nama,
    label: String(label || nama).trim().slice(0, 60) || nama,
    aktif: aktif !== false,
  };

  if (adaIndeks >= 0) daftar[adaIndeks] = isi;
  else daftar.push(isi);

  if (daftar.length > 10) {
    return { ok: false, alasan: "terlalu_banyak_akun" };
  }

  tulisDaftar(daftar);

  void logService.logSecurityEvent({
    eventType: "ecourt_akun_disunting",
    severity: "warning",
    message: `Akun e-Court "${nama}" disimpan.`,
    metadata: { slot: nama, aktif: isi.aktif, olehSiapa: String(olehSiapa || "") },
  });

  return { ok: true, alasan: "", akun: daftarAkun() };
}

/**
 * Menghapus satu akun beserta sesinya.
 *
 * Sesinya IKUT dihapus. Membiarkan folder profil tertinggal berarti kredensial
 * sesi tetap ada di disk untuk akun yang sudah tidak dipakai - dan tidak ada
 * lagi layar yang menunjukkan keberadaannya.
 */
function hapusAkun(slot, { olehSiapa = "" } = {}) {
  const nama = sesiEcourt.bersihkanSlot(slot);
  const daftar = bacaDaftar();

  if (daftar.length <= 1) {
    return { ok: false, alasan: "akun_terakhir_tidak_dapat_dihapus" };
  }
  if (nama === slotAkunUtama()) {
    return { ok: false, alasan: "akun_utama_tidak_dapat_dihapus" };
  }

  const sisa = daftar.filter((akun) => akun.slot !== nama);
  if (sisa.length === daftar.length) return { ok: false, alasan: "akun_tidak_ditemukan" };

  tulisDaftar(sisa);
  const hasilHapus = sesiEcourt.clearSession(nama);
  require("./ecourtSesiRinganService").hapusKuki(nama);
  keadaan.gagal.delete(nama);

  void logService.logSecurityEvent({
    eventType: "ecourt_akun_dihapus",
    severity: "warning",
    message: `Akun e-Court "${nama}" dihapus beserta sesinya.`,
    metadata: { slot: nama, sesiTerhapus: hasilHapus.ok, olehSiapa: String(olehSiapa || "") },
  });

  return { ok: true, alasan: "", akun: daftarAkun() };
}

module.exports = {
  BAWAAN,
  ISTIRAHAT_MS,
  KATA_PENEGAS_LEPAS,
  daftarAkun,
  hapusAkun,
  keadaanAkunUtama,
  lepasAkunUtama,
  pilihAkunSiap,
  pilihAkunUtama,
  slotAkunUtama,
  simpanAkun,
  tandaiBerhasil,
  tandaiGagal,
};
