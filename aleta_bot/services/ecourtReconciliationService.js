"use strict";

/**
 * Rekonsiliasi ALETA dengan e-Court.
 *
 * ============================================================================
 * DUA SUMBER KEBENARAN YANG BISA BERSELISIH
 * ============================================================================
 *
 * ALETA menyimpan keputusan verifikasi hakim. e-Court menyimpan status
 * sesungguhnya. Keduanya seharusnya sama, tetapi bisa berbeda karena:
 *
 *   - Hakim memverifikasi LANGSUNG di e-Court tanpa lewat ALETA
 *   - Penerusan dari ALETA gagal, tetapi tercatat sudah diteruskan
 *   - Keputusan diubah di e-Court setelah diteruskan
 *
 * ============================================================================
 * MELAPORKAN, TIDAK MENIMPA
 * ============================================================================
 *
 * Layanan ini TIDAK PERNAH memperbaiki selisih dengan sendirinya. Menimpa
 * salah satu sisi secara otomatis berarti menebak mana yang benar - dan tebakan
 * yang salah pada keputusan hukum jauh lebih merugikan daripada selisih yang
 * dilaporkan dan ditangani manusia.
 *
 * Yang benar selalu e-Court, karena di sanalah status resminya. Tugas layanan
 * ini hanya membuat selisihnya TERLIHAT, supaya panitera tahu ada yang perlu
 * diperiksa - bukan menyelesaikannya sendiri.
 */

const botDb = require("./botDbService");
const logService = require("./logService");
const ecourtStoreService = require("./ecourtStoreService");
const ecourtVerificationService = require("./ecourtVerificationService");

/** Jenis selisih, diurutkan dari yang paling perlu ditangani. */
const JENIS = {
  BERTENTANGAN: "bertentangan",
  PENERUSAN_GAGAL: "penerusan_gagal",
  DIVERIFIKASI_DI_LUAR: "diverifikasi_di_luar_aleta",
  BELUM_DITERUSKAN: "belum_diteruskan",
};

/** Seberapa mendesak tiap jenis selisih. */
const KEGENTINGAN = {
  [JENIS.BERTENTANGAN]: "tinggi",
  [JENIS.PENERUSAN_GAGAL]: "tinggi",
  [JENIS.DIVERIFIKASI_DI_LUAR]: "rendah",
  [JENIS.BELUM_DITERUSKAN]: "sedang",
};

const PENJELASAN = {
  [JENIS.BERTENTANGAN]:
    "Keputusan di ALETA berbeda dengan status di e-Court. Status resmi adalah yang tercatat di e-Court. " +
    "Periksa mana yang benar sebelum melanjutkan perkara.",
  [JENIS.PENERUSAN_GAGAL]:
    "ALETA mencatat keputusan sudah diteruskan, tetapi e-Court masih menampilkan status belum diverifikasi. " +
    "Penerusannya kemungkinan tidak benar-benar tersimpan.",
  [JENIS.DIVERIFIKASI_DI_LUAR]:
    "Dokumen sudah diverifikasi langsung di e-Court tanpa melalui ALETA. Tidak ada yang salah, " +
    "hanya catatan ALETA tidak memuat siapa yang memutuskan.",
  [JENIS.BELUM_DITERUSKAN]:
    "Hakim sudah memutuskan di ALETA, tetapi keputusannya belum diteruskan ke e-Court. " +
    "Status di e-Court belum berubah sampai penerusan dijalankan.",
};

/** Menyamakan bentuk status dari kedua sisi supaya dapat dibandingkan. */
function samakanStatus(nilai) {
  const teks = String(nilai || "").toLowerCase().trim();
  if (!teks) return "belum";
  if (teks === "valid" || teks === "sudah" || teks === "terverifikasi") return "valid";
  if (teks === "tidak_valid" || teks === "tidak valid" || teks === "invalid") return "tidak_valid";
  return "belum";
}

/**
 * Membandingkan satu dokumen dengan keputusan ALETA atasnya.
 *
 * Dipisahkan sebagai fungsi murni supaya seluruh kemungkinan selisih dapat
 * diuji tanpa database.
 *
 * @returns {{ jenis: string, kegentingan: string, penjelasan: string }|null}
 */
function bandingkan(dokumen = {}, keputusan = null) {
  const statusEcourt = samakanStatus(dokumen.status_verifikasi);

  // Tidak ada keputusan ALETA sama sekali.
  if (!keputusan) {
    if (statusEcourt === "belum") return null; // Sama-sama belum: tidak ada selisih.
    return {
      jenis: JENIS.DIVERIFIKASI_DI_LUAR,
      kegentingan: KEGENTINGAN[JENIS.DIVERIFIKASI_DI_LUAR],
      penjelasan: PENJELASAN[JENIS.DIVERIFIKASI_DI_LUAR],
    };
  }

  const statusAleta = samakanStatus(keputusan.keputusan);
  const sudahDiteruskan = Boolean(keputusan.diteruskan_pada);

  if (!sudahDiteruskan) {
    // Belum diteruskan tetapi e-Court sudah berubah: ada yang memverifikasi
    // langsung di sana. Bila nilainya berbeda pula, itu pertentangan.
    if (statusEcourt !== "belum" && statusEcourt !== statusAleta) {
      return {
        jenis: JENIS.BERTENTANGAN,
        kegentingan: KEGENTINGAN[JENIS.BERTENTANGAN],
        penjelasan: PENJELASAN[JENIS.BERTENTANGAN],
      };
    }
    if (statusEcourt !== "belum") return null; // Sudah sama, penerusan tak perlu.
    return {
      jenis: JENIS.BELUM_DITERUSKAN,
      kegentingan: KEGENTINGAN[JENIS.BELUM_DITERUSKAN],
      penjelasan: PENJELASAN[JENIS.BELUM_DITERUSKAN],
    };
  }

  // Sudah diteruskan.
  if (statusEcourt === "belum") {
    return {
      jenis: JENIS.PENERUSAN_GAGAL,
      kegentingan: KEGENTINGAN[JENIS.PENERUSAN_GAGAL],
      penjelasan: PENJELASAN[JENIS.PENERUSAN_GAGAL],
    };
  }

  if (statusEcourt !== statusAleta) {
    return {
      jenis: JENIS.BERTENTANGAN,
      kegentingan: KEGENTINGAN[JENIS.BERTENTANGAN],
      penjelasan: PENJELASAN[JENIS.BERTENTANGAN],
    };
  }

  return null; // Cocok.
}

/**
 * Memeriksa seluruh dokumen dan mengumpulkan selisihnya.
 *
 * HANYA MEMBACA. Tidak ada satu pun tulisan ke database dari sini, selain
 * catatan peristiwa bila ada selisih genting.
 */
async function periksa({ limit = 500 } = {}) {
  await ecourtStoreService.ensureSchema();
  await ecourtVerificationService.ensureSchema();

  const batas = Math.max(1, Math.min(2000, Number(limit) || 500));
  const rows = await botDb.query(
    `SELECT d.document_key, d.nomor_perkara, d.judul_dokumen, d.status_verifikasi,
            d.terakhir_terlihat,
            v.keputusan, v.nama_hakim, v.diputuskan_pada, v.diteruskan_pada
       FROM aleta_bot_ecourt_documents d
       LEFT JOIN aleta_bot_ecourt_verifications v ON v.document_key = d.document_key
      ORDER BY d.terakhir_terlihat DESC
      LIMIT ${batas}`
  );

  const selisih = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const keputusan = row.keputusan ? row : null;
    const hasil = bandingkan(row, keputusan);
    if (!hasil) continue;

    selisih.push({
      documentKey: row.document_key,
      nomorPerkara: row.nomor_perkara,
      judulDokumen: row.judul_dokumen,
      statusEcourt: samakanStatus(row.status_verifikasi),
      statusAleta: keputusan ? samakanStatus(row.keputusan) : null,
      namaHakim: row.nama_hakim || "",
      diputuskanPada: row.diputuskan_pada || null,
      diteruskanPada: row.diteruskan_pada || null,
      terakhirDiperiksa: row.terakhir_terlihat || null,
      ...hasil,
    });
  }

  // Yang paling genting di atas, supaya panitera melihatnya lebih dulu.
  const urutan = { tinggi: 0, sedang: 1, rendah: 2 };
  selisih.sort((a, b) => (urutan[a.kegentingan] ?? 9) - (urutan[b.kegentingan] ?? 9));

  const genting = selisih.filter((item) => item.kegentingan === "tinggi");
  if (genting.length > 0) {
    void logService.logSecurityEvent({
      eventType: "ecourt_rekonsiliasi_selisih",
      severity: "warning",
      message: `Rekonsiliasi e-Court menemukan ${genting.length} selisih genting.`,
      metadata: {
        jumlahGenting: genting.length,
        jumlahSeluruh: selisih.length,
        contoh: genting.slice(0, 5).map((item) => ({
          nomorPerkara: item.nomorPerkara,
          jenis: item.jenis,
        })),
      },
    });
  }

  return {
    diperiksaPada: new Date().toISOString(),
    jumlahDokumen: Array.isArray(rows) ? rows.length : 0,
    ringkasan: {
      bertentangan: selisih.filter((item) => item.jenis === JENIS.BERTENTANGAN).length,
      penerusanGagal: selisih.filter((item) => item.jenis === JENIS.PENERUSAN_GAGAL).length,
      diverifikasiDiLuar: selisih.filter((item) => item.jenis === JENIS.DIVERIFIKASI_DI_LUAR).length,
      belumDiteruskan: selisih.filter((item) => item.jenis === JENIS.BELUM_DITERUSKAN).length,
    },
    selisih,
  };
}

module.exports = {
  JENIS,
  KEGENTINGAN,
  PENJELASAN,
  bandingkan,
  periksa,
  samakanStatus,
};
