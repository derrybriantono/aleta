"use strict";

/**
 * Mengubah dokumen e-Court yang sudah diverifikasi menjadi pesan WhatsApp.
 *
 * --- Cara kerjanya ---
 *
 * Membaca dokumen berstatus valid yang belum pernah diberitahukan, menanyakan
 * ke pengklasifikasi apakah perlu dikirim dan kepada siapa, mencari nomor
 * WhatsApp pihak yang dituju dari SIPP, lalu menyerahkan pesannya ke
 * messageQueueService.
 *
 * --- Kenapa lewat antrean, bukan kirim langsung ---
 *
 * Antrean yang sudah ada membawa SELURUH pengaman anti-blokir yang dibangun
 * berminggu-minggu: irama kirim campuran, jendela jam kerja, jeda per
 * penerima, pemeriksaan nomor terdaftar, penghentian saat akun ditandai, dan
 * kata BERHENTI. Mengirim langsung dari sini berarti membangun jalur kedua
 * yang melewati semuanya - dan jalur kedua itu yang akan membuat nomor
 * pengadilan diblokir.
 *
 * Karena masuk antrean, pesan e-Court otomatis ikut seluruh aturan itu tanpa
 * satu baris tambahan pun.
 */

const crypto = require("crypto");

const { readRuntimeConfig } = require("../config/runtime-config");
const db = require("../db_config");
const logService = require("./logService");
const messageQueueService = require("./messageQueueService");
const ecourtStoreService = require("./ecourtStoreService");
const ecourtDocumentService = require("./ecourtDocumentService");
const nomorVerificationService = require("./nomorVerificationService");
const ecourtClassifier = require("./ecourtEventClassifierService");
const { cleanText, normalizeCaseNumber } = require("./ecourtTextService");
const { validateWhatsappNumber } = require("../utils/phoneFormatter");

/** Berapa dokumen diproses sekali jalan. */
const DEFAULT_BATCH_SIZE = 25;

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/**
 * Mencari pihak pada sebuah perkara beserta nomor teleponnya.
 *
 * Memakai pola yang sama dengan publicQaVerificationService.fetchCaseRecipients:
 * v_pihak_perkara untuk pihak, perkara_pengacara untuk kuasa hukum. SIPP
 * hanya DIBACA - tidak ada tulisan apa pun ke sana.
 */
async function fetchCaseParties(nomorPerkara) {
  const sql = `
    SELECT
      a.nama,
      a.pihak_ke,
      'pihak' AS jenis,
      b.telepon
    FROM v_pihak_perkara a
    JOIN perkara c ON c.perkara_id = a.perkara_id
    LEFT JOIN pihak b ON b.id = a.pihak_id
    WHERE c.nomor_perkara = ?
    UNION ALL
    SELECT
      a.nama,
      a.pihak_ke,
      'kuasa' AS jenis,
      b.telepon
    FROM perkara_pengacara a
    JOIN perkara c ON c.perkara_id = a.perkara_id
    LEFT JOIN pihak b ON b.id = a.pengacara_id
    WHERE c.nomor_perkara = ?
  `;
  return runQuery(sql, [nomorPerkara, nomorPerkara]);
}

/**
 * Menyaring pihak menurut peran yang dituju pengklasifikasi.
 *
 * pihak_ke pada SIPP: 1 = penggugat/pemohon, 2 = tergugat/termohon.
 * Peran yang tidak dikenali menghasilkan daftar KOSONG, bukan seluruh pihak -
 * mengirim ke semua orang saat kita tidak yakin siapa yang dituju adalah
 * kesalahan yang tidak bisa ditarik kembali.
 */
function filterByRole(rows, targetRole) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  if (targetRole === "penggugat") return rows.filter((row) => Number(row.pihak_ke) === 1);
  if (targetRole === "tergugat") return rows.filter((row) => Number(row.pihak_ke) === 2);
  return [];
}

/** Nomor telepon yang benar-benar bisa dikirimi, tanpa kembar. */
function collectValidNumbers(rows) {
  const terlihat = new Set();
  const hasil = [];
  for (const row of rows) {
    const validasi = validateWhatsappNumber(row.telepon);
    if (!validasi.valid) continue;
    if (terlihat.has(validasi.normalized)) continue;
    terlihat.add(validasi.normalized);
    hasil.push({ nomor: validasi.chatId || validasi.normalized, nama: cleanText(row.nama) });
  }
  return hasil;
}

/**
 * Memproses satu dokumen.
 *
 * @returns {Promise<{ status: string, alasan?: string, terkirim?: number }>}
 */
async function processDocument(dokumen, { runtimeConfig, dryRun }) {
  const documentKey = String(dokumen.document_key || "");
  const nomorPerkara = normalizeCaseNumber(dokumen.nomor_perkara);

  const keputusan = ecourtClassifier.decide(dokumen, runtimeConfig);
  if (!keputusan.notify) {
    // Ditandai supaya tidak diperiksa berulang kali setiap kali pekerja jalan.
    await ecourtStoreService.markSkipped(documentKey, keputusan.reason);
    return { status: "dilewati", alasan: keputusan.reason };
  }

  let pihak;
  try {
    pihak = await fetchCaseParties(nomorPerkara);
  } catch (error) {
    // Kegagalan membaca SIPP TIDAK ditandai sebagai dilewati: perkaranya masih
    // sah, hanya databasenya sedang bermasalah. Dibiarkan agar dicoba lagi
    // pada putaran berikutnya.
    return { status: "gagal", alasan: `sipp_tidak_terbaca: ${error.message}` };
  }

  const penerima = collectValidNumbers(filterByRole(pihak, keputusan.targetRole));
  if (penerima.length === 0) {
    await ecourtStoreService.markSkipped(documentKey, "tidak_ada_nomor_pihak_tujuan");
    return { status: "dilewati", alasan: "tidak_ada_nomor_pihak_tujuan" };
  }

  const lampiran = ecourtDocumentService.pickBestAttachment({
    berkasPdf: dokumen.berkas_pdf,
    berkasWord: dokumen.berkas_word,
  });

  let terkirim = 0;
  let menungguVerifikasi = 0;
  for (const orang of penerima) {
    // PENJAGAAN NOMOR SALAH ALAMAT.
    //
    // Nomor pihak diketik petugas dari formulir tulisan tangan. Satu digit
    // salah berarti dokumen perceraian seseorang terkirim ke orang asing -
    // kesalahan yang tidak bisa ditarik kembali setelah terbaca.
    //
    // Sebelum berkas apa pun dikirim ke nomor yang belum pernah dikonfirmasi,
    // ALETA bertanya lebih dulu tanpa lampiran dan tanpa menyebut perkaranya.
    // Dokumennya TIDAK ditandai dilewati, sehingga akan dikirim sendiri pada
    // putaran berikutnya begitu pemiliknya menjawab.
    const izin = await nomorVerificationService.ensureVerified(orang.nomor, orang.nama);
    if (!izin.boleh) {
      menungguVerifikasi += 1;
      if (izin.pertanyaan) {
        await messageQueueService.enqueueMessage({
          idempotencyKey: `verifikasi-nomor:${orang.nomor}:${nomorVerificationService.namaKunci(orang.nama)}`,
          category: "party",
          notificationKey: "verifikasi-nomor",
          recipientNumber: orang.nomor,
          recipientName: orang.nama,
          message: izin.pertanyaan,
          attachment: null,
          sourceApp: "aleta_bot",
          sourceFeature: "verifikasi_nomor",
          entityType: "perkara",
          entityId: nomorPerkara,
          metadata: { alasan: izin.alasan, dryRun: Boolean(dryRun) },
        }).catch(async (error) => {
          // Pertanyaan gagal masuk antrean: batalkan catatan "sudah ditanya"
          // supaya dicoba lagi pada putaran berikutnya, bukan menggantung
          // selama tenggang pengulangan.
          await nomorVerificationService.markQuestionFailed(orang.nomor, orang.nama).catch(() => {});
          void logService.logSystemEvent({
            eventType: "verifikasi_nomor_gagal_kirim",
            severity: "warning",
            message: "Pertanyaan verifikasi nomor gagal diantrekan; akan dicoba lagi.",
            metadata: { errorMessage: String(error.message || error).slice(0, 200) },
          });
        });
      }
      continue;
    }

    const pesan = ecourtClassifier.buildMessage(
      { nomorPerkara, ...dokumen },
      keputusan,
      { namaPihak: orang.nama }
    );

    // Kunci anti-kembar mengunci pada dokumen DAN penerima, bukan pada waktu.
    // Satu dokumen hanya boleh menghasilkan satu pesan untuk satu orang,
    // selamanya - berbeda dengan berkas putusan yang boleh diminta ulang
    // setiap hari oleh pihaknya sendiri.
    const idempotencyKey = `ecourt-dokumen:${documentKey}:${orang.nomor}`;

    try {
      await messageQueueService.enqueueMessage({
        idempotencyKey,
        category: "party",
        notificationKey: "ecourt-dokumen-baru",
        recipientNumber: orang.nomor,
        recipientName: orang.nama,
        message: pesan,
        // Lampiran tidak diwajibkan: pemberitahuannya sendiri sudah berguna
        // walau berkasnya belum sempat terunduh. Pesan tanpa lampiran jauh
        // lebih baik daripada tidak ada pesan sama sekali.
        attachment: lampiran.ok
          ? {
              source: lampiran.absolutePath,
              name: lampiran.fileName,
              kind: "ecourt_document",
              required: false,
              size: lampiran.size,
            }
          : null,
        sourceApp: "aleta_bot",
        sourceFeature: "ecourt_bridge",
        entityType: "perkara",
        entityId: nomorPerkara,
        metadata: {
          documentKey,
          jenisDokumen: keputusan.classes.join(","),
          targetRole: keputusan.targetRole,
          dryRun: Boolean(dryRun),
          lampiranTersedia: lampiran.ok,
          alasanLampiran: lampiran.ok ? "" : lampiran.reason,
        },
      });
      terkirim += 1;
    } catch (error) {
      return { status: "gagal", alasan: `antrean_gagal: ${error.message}` };
    }
  }

  // Dokumen HANYA ditandai selesai bila tidak ada lagi penerima yang sedang
  // ditunggu jawabannya. Menandainya selesai selagi masih ada yang menunggu
  // berarti dokumen itu tidak akan pernah dikirim lagi - pertanyaan verifikasi
  // dijawab, tetapi berkasnya tidak pernah menyusul.
  if (menungguVerifikasi > 0) {
    return {
      status: terkirim > 0 ? "sebagian" : "menunggu",
      terkirim,
      menungguVerifikasi,
      alasan: "menunggu_verifikasi_nomor",
    };
  }

  await ecourtStoreService.markNotified(documentKey);
  return { status: "diantrekan", terkirim };
}

/**
 * Satu putaran kerja.
 *
 * Seluruh galat ditangkap per dokumen: satu dokumen bermasalah tidak boleh
 * menghentikan sisa antrean.
 */
async function runOnce({ limit = DEFAULT_BATCH_SIZE, dryRun = false } = {}) {
  const runtimeConfig = readRuntimeConfig();
  const ringkasan = { diperiksa: 0, diantrekan: 0, dilewati: 0, gagal: 0, pesan: 0, menungguVerifikasi: 0 };

  // SAKLAR UTAMA dari portal.
  //
  // Dimatikan berarti berhenti TANPA menandai apa pun sebagai dilewati:
  // dokumennya tetap menunggu dan akan dikirim begitu dinyalakan lagi.
  // Menandainya dilewati akan membuat seluruh antrean hangus hanya karena
  // saklar sempat dimatikan sebentar.
  if (runtimeConfig.ecourtNotifikasiAktif === false) {
    return { ...ringkasan, dimatikan: true, alasan: "ecourt_notifikasi_dimatikan" };
  }

  let antrean;
  try {
    antrean = await ecourtStoreService.listPendingNotification({ limit });
  } catch (error) {
    void logService.logSystemEvent({
      eventType: "ecourt_worker_error",
      severity: "error",
      message: "Gagal membaca antrean dokumen e-Court.",
      metadata: { errorMessage: error.message },
    });
    return { ...ringkasan, error: error.message };
  }

  for (const dokumen of antrean) {
    ringkasan.diperiksa += 1;
    try {
      const hasil = await processDocument(dokumen, { runtimeConfig, dryRun });
      if (hasil.status === "diantrekan") {
        ringkasan.diantrekan += 1;
        ringkasan.pesan += Number(hasil.terkirim || 0);
      } else if (hasil.status === "dilewati") {
        ringkasan.dilewati += 1;
      } else if (hasil.status === "menunggu" || hasil.status === "sebagian") {
        // Menunggu jawaban verifikasi nomor BUKAN kegagalan: justru tanda
        // penjagaannya bekerja. Dokumennya sengaja dibiarkan agar dikirim
        // sendiri pada putaran berikutnya begitu pemiliknya menjawab.
        ringkasan.menungguVerifikasi += Number(hasil.menungguVerifikasi || 0);
        ringkasan.pesan += Number(hasil.terkirim || 0);
        if (hasil.status === "sebagian") ringkasan.diantrekan += 1;
      } else {
        ringkasan.gagal += 1;
      }
    } catch (error) {
      ringkasan.gagal += 1;
      void logService.logSystemEvent({
        eventType: "ecourt_worker_document_failed",
        severity: "warning",
        message: "Satu dokumen e-Court gagal diproses.",
        metadata: { documentKey: dokumen.document_key, errorMessage: error.message },
      });
    }
  }

  if (ringkasan.diantrekan > 0 || ringkasan.gagal > 0) {
    void logService.logSystemEvent({
      eventType: "ecourt_worker_run",
      severity: "info",
      message: `Pekerja e-Court: ${ringkasan.diantrekan} dokumen diantrekan (${ringkasan.pesan} pesan), ${ringkasan.dilewati} dilewati, ${ringkasan.menungguVerifikasi} menunggu verifikasi nomor, ${ringkasan.gagal} gagal.`,
      metadata: ringkasan,
    });
  }

  return ringkasan;
}

module.exports = {
  DEFAULT_BATCH_SIZE,
  collectValidNumbers,
  fetchCaseParties,
  filterByRole,
  processDocument,
  runOnce,
};
