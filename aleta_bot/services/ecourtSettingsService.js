"use strict";

/**
 * Pengaturan e-Court yang dapat disunting dari portal.
 *
 * ============================================================================
 * KENAPA HARUS BISA DISUNTING TANPA MENGUBAH APLIKASI
 * ============================================================================
 *
 * Pengklasifikasi menebak jenis dokumen dari JUDULNYA, dan kamusnya dibangun
 * dari contoh yang baru sedikit. Judul yang dipakai tiap jenis perkara
 * berbeda-beda, dan yang tahu bentuk judul yang lazim di pengadilan ini adalah
 * panitera - bukan yang menulis kodenya.
 *
 * Tanpa penyuntingan dari portal, satu judul tidak dikenali berarti menunggu
 * pembaruan aplikasi. Padahal akibatnya nyata: dokumen itu tidak diberitahukan
 * ke pihak lawan sama sekali.
 *
 * ============================================================================
 * YANG SENGAJA TIDAK DAPAT DIUBAH DARI SINI
 * ============================================================================
 *
 * Kelas bawaan tidak dapat DIHAPUS, hanya ditimpa. Menghapus kelas "jawaban"
 * akan membuat seluruh Jawaban berhenti diberitahukan tanpa ada yang menyadari,
 * dan kesalahan seperti itu tidak menghasilkan pesan galat apa pun - hanya
 * kesunyian yang terlihat normal.
 *
 * Kelas yang menolak (notify: false) juga tidak dapat dinyalakan dari portal.
 * Kelas seperti "pendaftaran" sengaja tidak diberitahukan karena berkasnya
 * milik pihak itu sendiri; menyalakannya berarti mengirimi orang dokumennya
 * sendiri, dan itu keputusan yang perlu pertimbangan lebih dari satu klik.
 */

const { readRuntimeConfig, writeRuntimeConfig } = require("../config/runtime-config");
const logService = require("./logService");
const ecourtClassifier = require("./ecourtEventClassifierService");
const sidangAgendaService = require("./sidangAgendaService");
const { cleanText } = require("./ecourtTextService");

/** Nilai bawaan bila belum pernah diatur. Sama dengan bawaan di kodenya. */
const BAWAAN = {
  ambangMendesakHari: 3,
  tanyaUlangHari: 3,
};

const AUDIENCE_SAH = new Set(["lawan", "sendiri", "pegawai"]);

/** Membersihkan satu baris pola menjadi daftar kata kunci. */
function bersihkanPola(nilai) {
  const daftar = Array.isArray(nilai) ? nilai : String(nilai || "").split(/[\n,]/);
  const hasil = [];
  const terlihat = new Set();
  for (const item of daftar) {
    const teks = cleanText(item).toLowerCase();
    if (!teks || terlihat.has(teks)) continue;
    terlihat.add(teks);
    hasil.push(teks);
  }
  return hasil;
}

/** Seluruh pengaturan e-Court yang berlaku sekarang. */
function getSettings(runtimeConfig = readRuntimeConfig()) {
  const angka = (nilai, bawaan) => {
    const n = Number(nilai);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : bawaan;
  };

  return {
    aktif: runtimeConfig.ecourtNotifikasiAktif !== false,
    ambangMendesakHari: angka(runtimeConfig.ecourtAmbangMendesakHari, BAWAAN.ambangMendesakHari),
    tanyaUlangHari: angka(runtimeConfig.ecourtTanyaUlangHari, BAWAAN.tanyaUlangHari),
    // Kelas yang sedang berlaku, sudah termasuk timpaan dari portal.
    aturan: ecourtClassifier.listClasses(runtimeConfig).map((item) => ({
      key: item.key,
      label: item.label,
      patterns: item.patterns,
      notify: item.notify !== false,
      audience: item.audience || "",
      tenggatBerlaku: item.tenggatBerlaku !== false,
      ringkasan: item.ringkasan || "",
      tindakan: item.tindakan || "",
      // Kelas bawaan tidak dapat dihapus; hanya tambahan yang bisa.
      bawaan: ecourtClassifier.DEFAULT_DOCUMENT_CLASSES.some((d) => d.key === item.key),
    })),
  };
}

/**
 * Menyimpan satu aturan.
 *
 * Hanya pola judul, ringkasan, dan tindakan yang dapat diubah. Siapa yang
 * diberitahu (audience) dan apakah kelasnya mengirim (notify) tidak dapat
 * diubah untuk kelas bawaan - lihat catatan di kepala berkas.
 */
function saveRule({ key, patterns, ringkasan, tindakan, audience, notify, olehSiapa = "" } = {}) {
  const kunci = cleanText(key).toLowerCase();
  if (!kunci) return { ok: false, alasan: "kunci_kosong" };

  const pola = bersihkanPola(patterns);
  if (pola.length === 0) return { ok: false, alasan: "pola_kosong" };

  const sekarang = readRuntimeConfig();
  const bawaanKelas = ecourtClassifier.DEFAULT_DOCUMENT_CLASSES.find((d) => d.key === kunci);
  const daftar = Array.isArray(sekarang.ecourtDocumentGuide) ? [...sekarang.ecourtDocumentGuide] : [];

  const entri = {
    key: kunci,
    patterns: pola,
    ringkasan: cleanText(ringkasan).slice(0, 500),
    tindakan: cleanText(tindakan).slice(0, 500),
  };

  if (bawaanKelas) {
    // Kelas bawaan: audience dan notify SELALU mengikuti bawaannya, apa pun
    // yang dikirim portal. Mengubahnya lewat satu klik terlalu mudah untuk
    // kesalahan yang akibatnya tidak terlihat.
    entri.label = bawaanKelas.label;
  } else {
    // Kelas tambahan buatan panitera: audience wajib dan harus dikenali,
    // karena tanpa itu pekerja tidak tahu harus mengirim ke siapa.
    const tujuan = cleanText(audience).toLowerCase();
    if (!AUDIENCE_SAH.has(tujuan)) return { ok: false, alasan: "audience_tidak_dikenali" };
    entri.label = cleanText(key).slice(0, 100) || kunci;
    entri.audience = tujuan;
    entri.notify = notify !== false;
  }

  const index = daftar.findIndex((item) => cleanText(item && item.key).toLowerCase() === kunci);
  if (index >= 0) daftar[index] = { ...daftar[index], ...entri };
  else daftar.push(entri);

  writeRuntimeConfig({ ...sekarang, ecourtDocumentGuide: daftar });

  void logService.logSecurityEvent({
    eventType: "ecourt_aturan_disunting",
    severity: "warning",
    message: `Aturan pemberitahuan e-Court "${kunci}" disunting dari portal.`,
    metadata: { key: kunci, jumlahPola: pola.length, olehSiapa: cleanText(olehSiapa) },
  });

  return { ok: true, alasan: "" };
}

/**
 * Menghapus aturan tambahan.
 *
 * Kelas bawaan tidak dapat dihapus - yang terhapus hanya TIMPAANNYA, sehingga
 * kelasnya kembali ke bentuk bawaan, bukan hilang.
 */
function deleteRule({ key, olehSiapa = "" } = {}) {
  const kunci = cleanText(key).toLowerCase();
  if (!kunci) return { ok: false, alasan: "kunci_kosong" };

  const sekarang = readRuntimeConfig();
  const daftar = Array.isArray(sekarang.ecourtDocumentGuide) ? sekarang.ecourtDocumentGuide : [];
  const sisa = daftar.filter((item) => cleanText(item && item.key).toLowerCase() !== kunci);
  if (sisa.length === daftar.length) return { ok: false, alasan: "aturan_tidak_ditemukan" };

  writeRuntimeConfig({ ...sekarang, ecourtDocumentGuide: sisa });

  const bawaanKelas = ecourtClassifier.DEFAULT_DOCUMENT_CLASSES.some((d) => d.key === kunci);
  void logService.logSecurityEvent({
    eventType: "ecourt_aturan_dihapus",
    severity: "warning",
    message: bawaanKelas
      ? `Timpaan aturan "${kunci}" dihapus; kelasnya kembali ke bawaan.`
      : `Aturan tambahan "${kunci}" dihapus.`,
    metadata: { key: kunci, bawaan: bawaanKelas, olehSiapa: cleanText(olehSiapa) },
  });

  return { ok: true, alasan: "", kembaliKeBawaan: bawaanKelas };
}

/** Menyimpan ambang hari. Nilai di luar akal ditolak, bukan dipaksa masuk. */
function saveThresholds({ ambangMendesakHari, tanyaUlangHari, olehSiapa = "" } = {}) {
  const ambang = Number(ambangMendesakHari);
  const tanyaUlang = Number(tanyaUlangHari);

  if (!Number.isFinite(ambang) || ambang < 1 || ambang > 30) {
    return { ok: false, alasan: "ambang_mendesak_di_luar_1_sampai_30" };
  }
  // Tanya ulang terlalu cepat berarti pihak yang belum sempat membaca akan
  // ditanya berkali-kali - persis perilaku yang membuat nomor diblokir.
  if (!Number.isFinite(tanyaUlang) || tanyaUlang < 1 || tanyaUlang > 60) {
    return { ok: false, alasan: "tanya_ulang_di_luar_1_sampai_60" };
  }

  const sekarang = readRuntimeConfig();
  writeRuntimeConfig({
    ...sekarang,
    ecourtAmbangMendesakHari: Math.floor(ambang),
    ecourtTanyaUlangHari: Math.floor(tanyaUlang),
  });

  void logService.logSystemEvent({
    eventType: "ecourt_ambang_disunting",
    severity: "info",
    message: "Ambang hari e-Court disunting dari portal.",
    metadata: { ambangMendesakHari: Math.floor(ambang), tanyaUlangHari: Math.floor(tanyaUlang), olehSiapa: cleanText(olehSiapa) },
  });

  return { ok: true, alasan: "" };
}

/**
 * Padanan agenda sidang yang berlaku sekarang.
 *
 * Kalimat persiapan seperti "bawa dua orang saksi dewasa beserta KTP mereka"
 * adalah pernyataan pengadilan tentang HUKUM ACARA, bukan pernyataan teknis.
 * Yang berhak menyusunnya adalah panitera - dan sejak v1.13.0 catatan rilis
 * sudah menjanjikan itu dapat disunting, tetapi tempat menyuntingnya belum
 * pernah ada sampai sekarang.
 */
function getAgendaSettings(runtimeConfig = readRuntimeConfig()) {
  return {
    agenda: sidangAgendaService.listClasses(runtimeConfig).map((item) => ({
      key: item.key,
      label: item.label,
      patterns: item.patterns || [],
      persiapan: item.persiapan || [],
      h3: item.h3 !== false,
      h1: item.h1 !== false,
      bawaan: sidangAgendaService.DEFAULT_AGENDA_CLASSES.some((d) => d.key === item.key),
    })),
  };
}

/**
 * Menyimpan satu padanan agenda.
 *
 * Kapan diingatkan (h3/h1) TIDAK dapat diubah untuk agenda bawaan. Mematikan
 * pengingat H-3 pada agenda yang menuntut persiapan berhari-hari - Pemeriksaan
 * Saksi misalnya - membuat pihak datang tanpa saksi, dan tidak ada satu pun
 * pesan galat yang menandakannya.
 */
function saveAgendaRule({ key, patterns, persiapan, h3, h1, olehSiapa = "" } = {}) {
  const kunci = cleanText(key).toLowerCase();
  if (!kunci) return { ok: false, alasan: "kunci_kosong" };

  const pola = bersihkanPola(patterns);
  if (pola.length === 0) return { ok: false, alasan: "pola_kosong" };

  // Kalimat persiapan dibersihkan per baris. Baris kosong dibuang, tetapi
  // daftar yang seluruhnya kosong DITOLAK - agenda tanpa persiapan lebih buruk
  // daripada agenda yang belum dikenali, karena yang belum dikenali masih
  // menerima nasihat dasar.
  const daftarPersiapan = (Array.isArray(persiapan) ? persiapan : String(persiapan || "").split("\n"))
    .map((baris) => cleanText(baris))
    .filter(Boolean)
    .slice(0, 12);
  if (daftarPersiapan.length === 0) return { ok: false, alasan: "persiapan_kosong" };

  const sekarang = readRuntimeConfig();
  const bawaanKelas = sidangAgendaService.DEFAULT_AGENDA_CLASSES.find((d) => d.key === kunci);
  const daftar = Array.isArray(sekarang.sidangAgendaGuide) ? [...sekarang.sidangAgendaGuide] : [];

  const entri = { key: kunci, patterns: pola, persiapan: daftarPersiapan };
  if (bawaanKelas) {
    entri.label = bawaanKelas.label;
  } else {
    entri.label = cleanText(key).slice(0, 100) || kunci;
    entri.h3 = h3 !== false;
    entri.h1 = h1 !== false;
  }

  const index = daftar.findIndex((item) => cleanText(item && item.key).toLowerCase() === kunci);
  if (index >= 0) daftar[index] = { ...daftar[index], ...entri };
  else daftar.push(entri);

  writeRuntimeConfig({ ...sekarang, sidangAgendaGuide: daftar });

  void logService.logSecurityEvent({
    eventType: "agenda_padanan_disunting",
    severity: "warning",
    message: `Padanan agenda sidang "${kunci}" disunting dari portal.`,
    metadata: { key: kunci, jumlahPersiapan: daftarPersiapan.length, olehSiapa: cleanText(olehSiapa) },
  });

  return { ok: true, alasan: "" };
}

/** Menghapus padanan tambahan, atau mengembalikan agenda bawaan ke asalnya. */
function deleteAgendaRule({ key, olehSiapa = "" } = {}) {
  const kunci = cleanText(key).toLowerCase();
  if (!kunci) return { ok: false, alasan: "kunci_kosong" };

  const sekarang = readRuntimeConfig();
  const daftar = Array.isArray(sekarang.sidangAgendaGuide) ? sekarang.sidangAgendaGuide : [];
  const sisa = daftar.filter((item) => cleanText(item && item.key).toLowerCase() !== kunci);
  if (sisa.length === daftar.length) return { ok: false, alasan: "aturan_tidak_ditemukan" };

  writeRuntimeConfig({ ...sekarang, sidangAgendaGuide: sisa });

  const bawaanKelas = sidangAgendaService.DEFAULT_AGENDA_CLASSES.some((d) => d.key === kunci);
  void logService.logSecurityEvent({
    eventType: "agenda_padanan_dihapus",
    severity: "warning",
    message: bawaanKelas
      ? `Timpaan agenda "${kunci}" dihapus; padanannya kembali ke bawaan.`
      : `Padanan agenda tambahan "${kunci}" dihapus.`,
    metadata: { key: kunci, bawaan: bawaanKelas, olehSiapa: cleanText(olehSiapa) },
  });

  return { ok: true, alasan: "", kembaliKeBawaan: bawaanKelas };
}

module.exports = {
  AUDIENCE_SAH,
  BAWAAN,
  bersihkanPola,
  deleteAgendaRule,
  deleteRule,
  getAgendaSettings,
  getSettings,
  saveAgendaRule,
  saveRule,
  saveThresholds,
};
