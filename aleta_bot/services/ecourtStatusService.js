"use strict";

/**
 * Ringkasan keadaan e-Court untuk tab pengelolaan di portal.
 *
 * Menjawab pertanyaan yang selama ini hanya bisa dijawab dengan membuka
 * terminal di server: jembatannya terakhir jalan kapan, ada berapa dokumen
 * tersimpan, berapa yang menunggu majelis, berapa nomor yang belum menjawab
 * konfirmasi, dan apakah catatan ALETA masih cocok dengan e-Court.
 *
 * HANYA MEMBACA. Menjalankan jembatan tetap lewat terminal, karena login
 * e-Court menuntut captcha yang harus diisi manusia - dan itu memang sengaja
 * tidak diotomatiskan.
 */

const botDb = require("./botDbService");
const { readRuntimeConfig } = require("../config/runtime-config");
const ecourtStoreService = require("./ecourtStoreService");
const ecourtClassifier = require("./ecourtEventClassifierService");
const ecourtVerificationService = require("./ecourtVerificationService");
const ecourtReconciliationService = require("./ecourtReconciliationService");
const nomorVerificationService = require("./nomorVerificationService");

async function hitung(sql, params = []) {
  const rows = await botDb.query(sql, params);
  const baris = Array.isArray(rows) ? rows[0] : null;
  return Number(baris && (baris.jumlah ?? baris.count ?? 0)) || 0;
}

/** Kapan jembatan terakhir dijalankan, dan hasilnya apa. */
async function sinkronisasiTerakhir() {
  const rows = await botDb.query(
    `SELECT * FROM aleta_bot_ecourt_sync_runs ORDER BY dimulai_pada DESC LIMIT 1`
  );
  const baris = Array.isArray(rows) ? rows[0] : null;
  if (!baris) return null;
  return {
    dimulaiPada: baris.dimulai_pada || null,
    selesaiPada: baris.selesai_pada || null,
    status: baris.status || "",
    perkaraDiperiksa: Number(baris.perkara_diperiksa || 0),
    dokumenTerlihat: Number(baris.dokumen_terlihat || 0),
    dokumenBaru: Number(baris.dokumen_baru || 0),
    berkasTerunduh: Number(baris.berkas_terunduh || 0),
    jumlahGalat: Number(baris.jumlah_galat || 0),
    galatTerakhir: baris.galat_terakhir || "",
    catatan: baris.catatan || "",
  };
}

/**
 * Seluruh keadaan e-Court dalam satu panggilan.
 *
 * Tiap bagian dibungkus catch sendiri: satu tabel yang belum terbentuk tidak
 * boleh membuat seluruh tab gagal tampil. Petugas lebih terbantu melihat
 * sebagian angka daripada halaman yang kosong tanpa penjelasan.
 */
async function getStatus({ limit = 100 } = {}) {
  const runtimeConfig = readRuntimeConfig();

  const aman = async (fn, bawaan) => {
    try {
      return await fn();
    } catch {
      return bawaan;
    }
  };

  await aman(() => ecourtStoreService.ensureSchema(), false);
  await aman(() => ecourtVerificationService.ensureSchema(), false);
  await aman(() => nomorVerificationService.ensureSchema(), false);

  const [
    totalDokumen,
    belumVerifikasi,
    sudahValid,
    belumDiberitahukan,
    sudahDiberitahukan,
    keputusanTersimpan,
    belumDiteruskan,
    nomorTerverifikasi,
    nomorMenunggu,
    nomorDitolak,
    sinkron,
    rekonsiliasi,
  ] = await Promise.all([
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_ecourt_documents`), 0),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_ecourt_documents WHERE status_verifikasi = 'belum'`), 0),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_ecourt_documents WHERE status_verifikasi = 'valid'`), 0),
    aman(
      () =>
        hitung(
          `SELECT COUNT(*) AS jumlah FROM aleta_bot_ecourt_documents
            WHERE status_verifikasi = 'valid' AND diberitahukan_pada IS NULL
              AND alasan_tidak_diberitahukan = ''`
        ),
      0
    ),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_ecourt_documents WHERE diberitahukan_pada IS NOT NULL`), 0),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_ecourt_verifications`), 0),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_ecourt_verifications WHERE diteruskan_pada IS NULL`), 0),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_nomor_terverifikasi WHERE status = 'terverifikasi'`), 0),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_nomor_terverifikasi WHERE status = 'menunggu'`), 0),
    aman(() => hitung(`SELECT COUNT(*) AS jumlah FROM aleta_bot_nomor_terverifikasi WHERE status = 'ditolak'`), 0),
    aman(() => sinkronisasiTerakhir(), null),
    aman(() => ecourtReconciliationService.periksa({ limit }), null),
  ]);

  return {
    diperiksaPada: new Date().toISOString(),
    aktif: runtimeConfig.ecourtNotifikasiAktif !== false,
    sinkronisasiTerakhir: sinkron,
    dokumen: {
      total: totalDokumen,
      belumVerifikasi,
      sudahValid,
      belumDiberitahukan,
      sudahDiberitahukan,
    },
    verifikasi: {
      keputusanTersimpan,
      belumDiteruskan,
    },
    nomor: {
      terverifikasi: nomorTerverifikasi,
      menunggu: nomorMenunggu,
      ditolak: nomorDitolak,
    },
    rekonsiliasi: rekonsiliasi
      ? { ringkasan: rekonsiliasi.ringkasan, selisih: rekonsiliasi.selisih.slice(0, 50) }
      : null,
    // Aturan pengklasifikasi ditampilkan supaya petugas tahu judul dokumen apa
    // yang memicu pemberitahuan ke siapa - tanpa perlu membuka kode.
    aturan: ecourtClassifier.listClasses(runtimeConfig).map((item) => ({
      key: item.key,
      label: item.label,
      patterns: item.patterns,
      notify: item.notify !== false,
      audience: item.audience || "",
      tenggatBerlaku: item.tenggatBerlaku !== false,
      ringkasan: item.ringkasan || "",
      tindakan: item.tindakan || "",
    })),
  };
}

/** Dokumen terbaru, untuk melihat apa yang sedang masuk. */
async function getDokumenTerbaru({ limit = 25 } = {}) {
  const batas = Math.max(1, Math.min(200, Number(limit) || 25));
  try {
    const rows = await botDb.query(
      `SELECT document_key, nomor_perkara, judul_dokumen, peran_pengunggah,
              status_verifikasi, diunggah_pada, batas_unggah_teks,
              diberitahukan_pada, alasan_tidak_diberitahukan
         FROM aleta_bot_ecourt_documents
        ORDER BY terakhir_terlihat DESC
        LIMIT ${batas}`
    );
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      documentKey: row.document_key,
      nomorPerkara: row.nomor_perkara,
      judulDokumen: row.judul_dokumen,
      peranPengunggah: row.peran_pengunggah,
      statusVerifikasi: row.status_verifikasi,
      diunggahPada: row.diunggah_pada,
      batasUnggahTeks: row.batas_unggah_teks,
      sudahDiberitahukan: Boolean(row.diberitahukan_pada),
      alasanTidakDiberitahukan: row.alasan_tidak_diberitahukan || "",
    }));
  } catch {
    return [];
  }
}

module.exports = { getDokumenTerbaru, getStatus, sinkronisasiTerakhir };
