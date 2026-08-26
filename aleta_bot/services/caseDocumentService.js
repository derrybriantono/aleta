"use strict";

/**
 * Mengirimkan berkas putusan langsung ke WhatsApp pihak.
 *
 * Selama ini bot hanya dapat MENYEBUTKAN bahwa putusan sudah ada. Pihak yang
 * ingin salinannya tetap harus datang ke PTSP, padahal berkasnya sudah
 * terunggah di SIPP dan pengiriman lampiran sudah lama didukung — hanya belum
 * pernah ada jalan bagi pihak untuk memintanya sendiri.
 *
 * TIGA HAL YANG DIJAGA DI SINI:
 *
 *   1. Berkas dikirim lewat ANTREAN, bukan balasan langsung. Pesan bermedia
 *      lebih berat dan lebih menarik perhatian penyaring WhatsApp; melewatkan-
 *      nya lewat antrean berarti ikut aturan jarak kirim yang sudah ada.
 *
 *   2. Dikirim sebagai kategori manual. Berkas ini DIMINTA sendiri oleh
 *      pihaknya, jadi permintaan berhenti berlangganan tidak boleh
 *      menghalanginya — yang mereka hentikan adalah pemberitahuan otomatis,
 *      bukan jawaban atas permintaan sendiri.
 *
 *   3. Selalu disertai keterangan bahwa ini BUKAN salinan resmi. Salinan resmi
 *      yang berkekuatan hukum hanya diterbitkan pengadilan melalui PTSP dengan
 *      biaya PNBP, dan pihak yang memakai berkas ini untuk keperluan hukum
 *      tanpa mengetahui bedanya akan dirugikan.
 */

const db = require("../db_config");
const caseSnapshotService = require("./caseSnapshotService");
const messageQueueService = require("./messageQueueService");
const { describeSippDocument, sanitizeSippDocumentInput } = require("./sippDocumentService");
const { guardCaseCommandAccess, normalizeCaseNumberInput } = require("./publicQaVerificationService");
const { validateWhatsappNumber } = require("../utils/phoneFormatter");

/** Keterangan wajib yang menyertai setiap berkas putusan. */
const DISCLAIMER = [
  "Berkas ini adalah salinan TIDAK RESMI yang dipublikasikan untuk keterbukaan informasi",
  "(SK KMA Nomor 1-144/KMA/SK/I/2011). Sebagian identitas sengaja disamarkan.",
  "",
  "Untuk keperluan hukum, salinan RESMI harus diminta di PTSP pengadilan.",
].join("\n");

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

/** Mengambil letak berkas putusan sebuah perkara. */
async function fetchDecisionDocument(nomorPerkara) {
  const [row] = await runQuery(
    `SELECT b.amar_putusan_dok, b.tanggal_putusan
       FROM perkara AS a
       JOIN perkara_putusan AS b ON b.perkara_id = a.perkara_id
      WHERE a.nomor_perkara = ?
      LIMIT 1`,
    [nomorPerkara]
  );
  return {
    ada: Boolean(row),
    documentPath: String((row && row.amar_putusan_dok) || "").trim(),
    tanggalPutusan: row && row.tanggal_putusan ? new Date(row.tanggal_putusan).toISOString().slice(0, 10) : "",
  };
}

/**
 * Memeriksa ketersediaan berkas putusan.
 * Hasilnya disimpan dalam potret perkara karena pemeriksaan ini menyentuh
 * berkas dan bisa berulang bila pihak menekan pilihannya lebih dari sekali.
 */
async function checkDecisionDocument(nomorPerkara) {
  return caseSnapshotService.remember({
    kind: "dokumen",
    caseNumber: nomorPerkara,
    loader: async () => {
      const info = await fetchDecisionDocument(nomorPerkara);
      if (!info.ada) return { status: "perkara_tidak_ditemukan" };
      if (!info.tanggalPutusan) return { status: "belum_putus" };
      if (!info.documentPath) return { status: "belum_diunggah" };

      const berkas = await describeSippDocument(info.documentPath);
      if (!berkas.ok) return { status: "berkas_tidak_terbaca", reason: berkas.reason || "" };

      return {
        status: "tersedia",
        documentPath: info.documentPath,
        fileName: berkas.fileName || "",
        tanggalPutusan: info.tanggalPutusan,
      };
    },
  }).then((potret) => potret.value);
}

/** Penjelasan mengapa berkas belum dapat dikirim. */
function explainUnavailable(status) {
  switch (status) {
    case "belum_putus":
      return "Perkara ini belum diputus, sehingga berkas putusannya belum ada.";
    case "belum_diunggah":
      return "Putusan sudah dibacakan, tetapi berkasnya belum diunggah ke sistem. Berkas biasanya tersedia setelah putusan selesai diminutasi.";
    case "berkas_tidak_terbaca":
      return "Berkas putusan tercatat ada tetapi sedang tidak dapat dibaca sistem. Silakan minta salinannya langsung di PTSP pengadilan.";
    case "perkara_tidak_ditemukan":
      return "Data perkara belum dapat ditemukan. Silakan hubungi PTSP pengadilan.";
    default:
      return "Berkas putusan belum dapat dikirim saat ini. Silakan hubungi PTSP pengadilan.";
  }
}

/**
 * Meminta pengiriman berkas putusan ke nomor pengirim.
 *
 * @returns {Promise<string>} balasan yang dikirim ke pihak
 */
async function requestDecisionDocument(nomorPerkara, { senderNumber = "" } = {}) {
  const normalized = normalizeCaseNumberInput(nomorPerkara);
  if (!normalized) {
    return "Nomor perkara belum terbaca. Silakan ketik *MENU* untuk memilih perkara Anda.";
  }

  const akses = await guardCaseCommandAccess({
    senderNumber,
    command: "berkas putusan",
    nomorPerkara: normalized,
  });
  if (!akses.allowed) {
    return akses.fallbackMessage || "Untuk keamanan data perkara, nomor WhatsApp ini belum dapat diverifikasi.";
  }

  const berkas = await checkDecisionDocument(normalized);
  if (berkas.status !== "tersedia") {
    return `${explainUnavailable(berkas.status)}\n\nKetik *MENU* untuk pilihan lain.`;
  }

  const nomor = validateWhatsappNumber(senderNumber);
  if (!nomor.valid) {
    return "Nomor WhatsApp Anda belum dapat dibaca sistem. Silakan hubungi PTSP pengadilan.";
  }

  const keterangan = [
    `*Salinan Putusan Perkara ${normalized}*`,
    "",
    DISCLAIMER,
  ].join("\n");

  const dokumen = sanitizeSippDocumentInput(berkas.documentPath);
  // Kunci idempotensi memuat TANGGAL dengan sengaja. Tanpa tanggal, berkas
  // hanya bisa dikirim sekali selamanya: permintaan berikutnya akan dijawab
  // "sedang dikirim" padahal tidak ada yang dikirim, dan pihak menunggu berkas
  // yang tidak pernah datang. Dengan tanggal, permintaan berulang pada hari
  // yang sama tetap dicegah, tetapi besok berkasnya bisa diminta lagi.
  const hariIni = new Date().toISOString().slice(0, 10);
  const antrean = await messageQueueService.enqueueMessage({
    idempotencyKey: `berkas-putusan:${nomor.normalized}:${normalized}:${hariIni}`,
    recipientNumber: nomor.chatId,
    message: keterangan,
    // Kategori manual: berkas ini diminta sendiri oleh pihaknya, jadi tidak
    // ditahan oleh permintaan berhenti berlangganan.
    category: "manual",
    notificationKey: "pihak-berkas-putusan",
    sourceApp: "aleta_bot",
    sourceFeature: "chat_menu_document",
    entityType: "perkara",
    entityId: normalized,
    attachment: {
      source: berkas.documentPath,
      name: dokumen.ok ? dokumen.fileName : berkas.fileName,
      kind: "sipp_document",
      required: true,
    },
    metadata: {
      sourceApp: "aleta_bot",
      sourceFeature: "chat_menu_document",
      processImmediately: true,
      sendOptions: { caption: keterangan, sendMediaAsDocument: true },
      nomorPerkara: normalized,
    },
  });

  // Permintaan kedua pada hari yang sama tidak menghasilkan kiriman baru, jadi
  // jangan menjanjikan pengiriman yang tidak akan terjadi.
  const sudahDikirim = ["sent", "delivered", "read"].includes(String(antrean && antrean.status));
  const pembuka = sudahDikirim
    ? "Berkas salinan putusan sudah dikirim ke nomor ini hari ini. Silakan periksa kembali percakapan Anda."
    : "Berkas salinan putusan sedang dikirim ke nomor ini. Mohon tunggu sebentar.";

  return [pembuka, "", DISCLAIMER, "", "Ketik *MENU* untuk pilihan lain."].join("\n");
}

module.exports = {
  DISCLAIMER,
  checkDecisionDocument,
  explainUnavailable,
  fetchDecisionDocument,
  requestDecisionDocument,
};
