"use strict";

/**
 * Ringkasan kerja untuk panitera pengganti.
 *
 * ============================================================================
 * KENAPA PANITERA, BUKAN HAKIM
 * ============================================================================
 *
 * Hakim yang memutuskan verifikasi, tetapi yang mengurus berkas perkara setiap
 * hari adalah panitera pengganti. Merekalah yang tahu perkara mana yang
 * tenggatnya mepet, pihak mana yang belum menanggapi, dan nomor siapa yang
 * ternyata salah.
 *
 * Sebelum ini mereka tidak punya apa-apa: tidak ada daftar dokumen menunggu,
 * tidak ada tanda tenggat yang hampir lewat. Semua harus dibuka satu per satu
 * di e-Court.
 *
 * Halaman ini menjawab tiga pertanyaan yang mereka tanyakan tiap pagi:
 *
 *   1. Dokumen apa yang menunggu diverifikasi majelis?
 *   2. Perkara mana yang tenggatnya sudah dekat atau sudah lewat?
 *   3. Nomor siapa yang salah dan perlu diperbaiki datanya?
 *
 * Seluruhnya HANYA MEMBACA. Tidak ada tombol yang mengubah apa pun di sini -
 * keputusan tetap di tangan hakim lewat jalurnya sendiri.
 */

const botDb = require("./botDbService");
const ecourtStoreService = require("./ecourtStoreService");
const nomorVerificationService = require("./nomorVerificationService");
const ecourtReconciliationService = require("./ecourtReconciliationService");
const { readRuntimeConfig } = require("../config/runtime-config");

/** Bawaan bila portal maupun env belum mengaturnya. */
const AMBANG_MENDESAK_HARI = Number(process.env.ALETA_BOT_PANITERA_AMBANG_HARI || 3);

/**
 * Ambang "hampir lewat" dalam hari.
 *
 * Dibaca dari portal setiap kali dipakai, supaya perubahan langsung berlaku
 * tanpa perlu restart bot.
 */
function ambangMendesakHari(runtimeConfig = readRuntimeConfig()) {
  const hari = Number(runtimeConfig.ecourtAmbangMendesakHari);
  if (Number.isFinite(hari) && hari >= 1 && hari <= 30) return Math.floor(hari);
  return AMBANG_MENDESAK_HARI;
}

function sisaHari(nilai) {
  if (!nilai) return null;
  const tanggal = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return null;
  return Math.ceil((tanggal.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * Dokumen yang sudah masuk tetapi belum diverifikasi majelis.
 *
 * Inilah yang menahan perkara: selama belum diverifikasi, pihak lawan belum
 * diberitahu dan belum bisa menanggapi.
 */
async function dokumenMenungguVerifikasi({ limit = 100 } = {}) {
  const batas = Math.max(1, Math.min(500, Number(limit) || 100));
  const rows = await botDb.query(
    `SELECT document_key, nomor_perkara, judul_dokumen, peran_pengunggah,
            diunggah_pada, batas_unggah, batas_unggah_teks, agenda
       FROM aleta_bot_ecourt_documents
      WHERE status_verifikasi = 'belum'
      ORDER BY diunggah_pada ASC
      LIMIT ${batas}`
  );

  return (Array.isArray(rows) ? rows : []).map((row) => ({
    documentKey: row.document_key,
    nomorPerkara: row.nomor_perkara,
    judulDokumen: row.judul_dokumen,
    peranPengunggah: row.peran_pengunggah,
    diunggahPada: row.diunggah_pada,
    agenda: row.agenda,
    batasUnggah: row.batas_unggah,
    batasUnggahTeks: row.batas_unggah_teks,
    sisaHari: sisaHari(row.batas_unggah),
    // Dihitung di sini, bukan di tampilan, supaya ambangnya satu sumber saja.
    mendesak: (() => {
      const sisa = sisaHari(row.batas_unggah);
      return sisa !== null && sisa <= ambangMendesakHari();
    })(),
  }));
}

/**
 * Perkara yang tenggat unggahnya sudah dekat atau sudah lewat.
 *
 * Tenggat yang LEWAT sengaja tetap ditampilkan, tidak disembunyikan: pihak
 * yang melewatkannya kehilangan kesempatan menanggapi, dan panitera perlu tahu
 * itu terjadi supaya dapat melaporkannya ke majelis.
 */
async function tenggatMendesak({ limit = 100, ambangHari = null } = {}) {
  const batas = Math.max(1, Math.min(500, Number(limit) || 100));
  const rows = await botDb.query(
    `SELECT nomor_perkara, judul_dokumen, agenda, batas_unggah, batas_unggah_teks,
            status_verifikasi, diberitahukan_pada
       FROM aleta_bot_ecourt_documents
      WHERE batas_unggah IS NOT NULL
      ORDER BY batas_unggah ASC
      LIMIT ${batas}`
  );

  const ambang = Number(ambangHari) || ambangMendesakHari();
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      nomorPerkara: row.nomor_perkara,
      judulDokumen: row.judul_dokumen,
      agenda: row.agenda,
      batasUnggah: row.batas_unggah,
      batasUnggahTeks: row.batas_unggah_teks,
      statusVerifikasi: row.status_verifikasi,
      sudahDiberitahukan: Boolean(row.diberitahukan_pada),
      sisaHari: sisaHari(row.batas_unggah),
    }))
    .filter((item) => item.sisaHari !== null && item.sisaHari <= ambang);
}

/**
 * Nomor yang pemiliknya menyatakan bukan pihak yang dimaksud.
 *
 * Tiap baris di sini adalah data SIPP yang salah dan perlu diperbaiki petugas.
 * Selama tidak diperbaiki, pihak yang bersangkutan TIDAK menerima pemberitahuan
 * apa pun - dan itu jauh lebih baik daripada berkasnya sampai ke orang asing.
 */
async function nomorSalahAlamat({ limit = 100 } = {}) {
  const rows = await nomorVerificationService.listSalahAlamat({ limit });
  return rows.map((row) => ({
    nomor: row.nomor,
    namaPihak: row.nama_pihak,
    dijawabPada: row.dijawab_pada,
  }));
}

/** Nomor yang sudah ditanya tetapi belum dijawab. */
async function nomorMenungguJawaban({ limit = 100 } = {}) {
  await nomorVerificationService.ensureSchema();
  const batas = Math.max(1, Math.min(500, Number(limit) || 100));
  const rows = await botDb.query(
    `SELECT nomor, nama_pihak, ditanya_pada, jumlah_ditanya
       FROM aleta_bot_nomor_terverifikasi
      WHERE status = ?
      ORDER BY ditanya_pada ASC
      LIMIT ${batas}`,
    [nomorVerificationService.STATUS.MENUNGGU]
  );
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    nomor: row.nomor,
    namaPihak: row.nama_pihak,
    ditanyaPada: row.ditanya_pada,
    jumlahDitanya: Number(row.jumlah_ditanya || 0),
  }));
}

/** Seluruh isi dashboard dalam satu panggilan. */
async function getDashboard({ limit = 100 } = {}) {
  await ecourtStoreService.ensureSchema();
  await nomorVerificationService.ensureSchema();

  const [menunggu, tenggat, salahAlamat, belumJawab, rekonsiliasi] = await Promise.all([
    dokumenMenungguVerifikasi({ limit }),
    tenggatMendesak({ limit }),
    nomorSalahAlamat({ limit }),
    nomorMenungguJawaban({ limit }),
    // Selisih dengan e-Court ikut ditampilkan di sini, bukan di halaman
    // terpisah: panitera yang memeriksa pekerjaan pagi perlu melihat sekaligus
    // bahwa ada catatan yang tidak cocok dengan sistem resminya.
    ecourtReconciliationService.periksa({ limit }).catch(() => null),
  ]);

  return {
    ambangMendesakHari: ambangMendesakHari(),
    dibuatPada: new Date().toISOString(),
    ringkasan: {
      menungguVerifikasi: menunggu.length,
      tenggatMendesak: tenggat.filter((item) => item.sisaHari >= 0).length,
      tenggatLewat: tenggat.filter((item) => item.sisaHari < 0).length,
      nomorSalahAlamat: salahAlamat.length,
      nomorBelumMenjawab: belumJawab.length,
      selisihGenting: rekonsiliasi
        ? rekonsiliasi.selisih.filter((item) => item.kegentingan === "tinggi").length
        : 0,
    },
    menungguVerifikasi: menunggu,
    tenggat,
    nomorSalahAlamat: salahAlamat,
    nomorBelumMenjawab: belumJawab,
    rekonsiliasi,
  };
}

module.exports = {
  AMBANG_MENDESAK_HARI,
  ambangMendesakHari,
  dokumenMenungguVerifikasi,
  getDashboard,
  nomorMenungguJawaban,
  nomorSalahAlamat,
  sisaHari,
  tenggatMendesak,
};
