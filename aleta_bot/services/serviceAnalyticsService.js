"use strict";

/**
 * Corong layanan dan laporan pelayanan publik.
 *
 * Menu pilihan yang dibangun pada v1.8.0 belum pernah diuji ke masyarakat.
 * Rancangannya masuk akal di atas kertas, tetapi apakah warga benar-benar
 * sampai ke jawabannya — atau berhenti di tengah karena bingung — sama sekali
 * tidak terpantau. Modul ini mencatat perjalanan itu tahap demi tahap, dan
 * titik terbanyak orang menyerah adalah petunjuk paling jujur tentang bagian
 * mana yang membingungkan.
 *
 * PRIVASI ADALAH KEPUTUSAN RANCANGANNYA, BUKAN TAMBAHAN.
 *
 * Statistik tentang warga yang berperkara tidak boleh berubah menjadi salinan
 * kedua dari "siapa menanyakan apa". Karena itu yang disimpan HANYA:
 *   - sidik sesi yang berganti setiap hari, cukup untuk menghitung berapa
 *     ORANG BERBEDA dalam sehari, tetapi tidak dapat dirangkai antar hari
 *     menjadi riwayat seseorang;
 *   - tahap yang dicapai dan jenis informasi yang diminta;
 *   - lama waktu menjawab.
 *
 * Yang TIDAK PERNAH disimpan: nomor WhatsApp, nomor perkara, nama, dan isi
 * pertanyaan. Corong ini menjawab "berapa banyak dan sampai tahap mana",
 * bukan "siapa menanyakan perkara apa".
 */

const crypto = require("crypto");
const botDb = require("./botDbService");
const logService = require("./logService");

/**
 * Tahapan corong, berurutan. Urutan inilah yang dipakai menghitung di mana
 * orang berhenti.
 */
const FUNNEL_STAGES = [
  { key: "menu_dibuka", label: "Membuka menu" },
  { key: "perkara_dipilih", label: "Memilih perkara" },
  { key: "informasi_diminta", label: "Memilih informasi" },
  { key: "terjawab", label: "Menerima jawaban" },
];

/** Hasil akhir di luar alur utama corong. */
const OUTCOMES = new Set(["kosong", "gagal", "tak_berhak", "berhenti", "pilihan_salah"]);

/**
 * Garam sidik sesi. Diacak sekali per proses bila tidak diset dari lingkungan,
 * sehingga sidik tidak dapat dihitung ulang dari luar meskipun nomornya
 * diketahui.
 */
const SESSION_SALT =
  process.env.ALETA_BOT_ANALYTICS_SALT || crypto.randomBytes(32).toString("hex");

let schemaReady = false;

/**
 * Sidik sesi harian.
 *
 * Tanggal ikut masuk ke dalam sidik dengan sengaja: satu orang yang bertanya
 * pada dua hari berbeda menghasilkan dua sidik yang tidak berhubungan, jadi
 * tidak ada riwayat perorangan yang terbentuk di dalam statistik.
 */
function sessionHash(senderNumber, at = new Date()) {
  const nomor = String(senderNumber || "").replace(/\D/g, "");
  if (!nomor) return "";
  const tanggal = at.toISOString().slice(0, 10);
  return crypto.createHash("sha256").update(`${SESSION_SALT}|${tanggal}|${nomor}`).digest("hex").slice(0, 32);
}

async function ensureTable() {
  if (schemaReady) return true;
  const ready = await botDb.ensureSchema();
  if (!ready) return false;
  await botDb.query(`
    CREATE TABLE IF NOT EXISTS aleta_bot_service_events (
      id VARCHAR(64) PRIMARY KEY,
      session_hash VARCHAR(64) NOT NULL DEFAULT '',
      stage VARCHAR(32) NOT NULL DEFAULT '',
      outcome VARCHAR(32) NOT NULL DEFAULT '',
      option_key VARCHAR(64) NOT NULL DEFAULT '',
      data_source VARCHAR(16) NOT NULL DEFAULT '',
      duration_ms INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      INDEX idx_abse_created_stage (created_at, stage),
      INDEX idx_abse_session (session_hash, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  schemaReady = true;
  return true;
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString("hex");
}

/**
 * Menerjemahkan hasil penanganan menu menjadi tahap corong.
 * Dipisah dari pencatatannya supaya pemetaan ini dapat diuji sendiri.
 */
function mapActionToEvent(action) {
  switch (String(action || "")) {
    case "case_menu":
      return { stage: "menu_dibuka", outcome: "" };
    case "info_menu":
      // Layar informasi berarti perkaranya sudah terpilih. Pada perkara
      // tunggal layar pemilihan perkara dilewati, sehingga tahap ini juga
      // menandai menu terbuka.
      return { stage: "perkara_dipilih", outcome: "" };
    case "answered":
      return { stage: "terjawab", outcome: "" };
    case "empty_answer":
      return { stage: "informasi_diminta", outcome: "kosong" };
    case "answer_failed":
      return { stage: "informasi_diminta", outcome: "gagal" };
    case "invalid_selection":
      return { stage: "", outcome: "pilihan_salah" };
    case "no_case":
      return { stage: "", outcome: "tak_berhak" };
    case "opt_out":
      return { stage: "", outcome: "berhenti" };
    default:
      return { stage: "", outcome: "" };
  }
}

/**
 * Mencatat satu langkah layanan.
 *
 * Tidak pernah melempar galat dan tidak pernah ditunggu pemanggilnya:
 * kegagalan mencatat statistik tidak boleh membuat warga gagal dijawab.
 */
async function record({ senderNumber, action, optionKey = "", dataSource = "", durationMs = 0, at = new Date() } = {}) {
  try {
    const { stage, outcome } = mapActionToEvent(action);
    if (!stage && !outcome) return false;

    const ready = await ensureTable();
    if (!ready) return false;

    await botDb.query(
      `INSERT INTO aleta_bot_service_events
         (id, session_hash, stage, outcome, option_key, data_source, duration_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        createId(),
        sessionHash(senderNumber, at),
        stage,
        outcome,
        String(optionKey || "").slice(0, 64),
        String(dataSource || "").slice(0, 16),
        Math.max(0, Math.round(Number(durationMs) || 0)),
        botDb.toMysqlDate(at),
      ]
    );
    // Menerima jawaban berarti seluruh tahap sebelumnya juga terlewati.
    if (stage === "terjawab") {
      await recordImplied(senderNumber, at);
    }
    return true;
  } catch (error) {
    void logService
      .logSystemEvent({
        eventType: "service_analytics_record_failed",
        severity: "info",
        message: "Pencatatan corong layanan gagal; pelayanan tidak terpengaruh.",
        metadata: { errorMessage: String(error.message || error).slice(0, 200) },
      })
      .catch(() => {});
    return false;
  }
}

/**
 * Tahap "informasi_diminta" tidak punya pesan tersendiri: memilih informasi
 * dan menerima jawabannya terjadi pada satu balasan yang sama. Karena itu
 * tahap tersebut dicatat menyertai jawabannya, agar corong tidak tampak
 * bocor pada langkah yang sebenarnya tidak pernah terpisah.
 */
async function recordImplied(senderNumber, at) {
  await botDb.query(
    `INSERT INTO aleta_bot_service_events
       (id, session_hash, stage, outcome, option_key, data_source, duration_ms, created_at)
     VALUES (?, ?, 'informasi_diminta', '', '', '', 0, ?)`,
    [createId(), sessionHash(senderNumber, at), botDb.toMysqlDate(at)]
  );
}

function rangeToDays(range) {
  const map = { today: 1, "7d": 7, "30d": 30, "90d": 90 };
  return map[String(range || "30d")] || 30;
}

/**
 * Corong layanan: berapa sesi mencapai tiap tahap, dan berapa yang berhenti.
 *
 * Dihitung dari sesi UNIK, bukan jumlah pesan — satu orang yang menekan
 * beberapa pilihan tidak boleh terhitung sebagai beberapa pengguna.
 */
async function getFunnel({ range = "30d" } = {}) {
  const ready = await ensureTable();
  if (!ready) return { available: false, stages: [] };

  const days = rangeToDays(range);
  const rows = await botDb.query(
    `SELECT stage, COUNT(DISTINCT session_hash) AS sesi
       FROM aleta_bot_service_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND stage <> ''
      GROUP BY stage`,
    [days]
  );

  const bySt = new Map((Array.isArray(rows) ? rows : []).map((row) => [row.stage, Number(row.sesi) || 0]));
  const puncak = bySt.get(FUNNEL_STAGES[0].key) || 0;

  let sebelumnya = 0;
  const stages = FUNNEL_STAGES.map((stage, index) => {
    const sesi = bySt.get(stage.key) || 0;
    const berhenti = index === 0 ? 0 : Math.max(0, sebelumnya - sesi);
    const hasil = {
      key: stage.key,
      label: stage.label,
      sessions: sesi,
      // Persentase terhadap orang yang membuka menu sama sekali.
      shareOfEntry: puncak > 0 ? Number(((sesi / puncak) * 100).toFixed(1)) : 0,
      droppedFromPrevious: berhenti,
    };
    sebelumnya = sesi;
    return hasil;
  });

  const titikBocorTerbesar = stages
    .slice(1)
    .reduce((worst, stage) => (!worst || stage.droppedFromPrevious > worst.droppedFromPrevious ? stage : worst), null);

  return {
    available: true,
    range,
    days,
    stages,
    completionRate: puncak > 0 ? Number((((bySt.get("terjawab") || 0) / puncak) * 100).toFixed(1)) : 0,
    biggestDropOff: titikBocorTerbesar ? titikBocorTerbesar.label : null,
  };
}

/**
 * Laporan pelayanan publik.
 *
 * Angka-angka ini sudah terkumpul sebagai efek samping pelayanan. Menyusunnya
 * menjadi laporan mengubah ALETA dari sekadar alat bantu menjadi bukti kinerja
 * pelayanan yang dapat dipakai untuk pelaporan PTSP.
 */
async function getServiceReport({ range = "30d" } = {}) {
  const ready = await ensureTable();
  if (!ready) return { available: false };

  const days = rangeToDays(range);

  const [ringkas] = await botDb.query(
    `SELECT
        COUNT(*) AS terjawab,
        COUNT(DISTINCT session_hash) AS pemohon,
        AVG(NULLIF(duration_ms, 0)) AS rata_ms,
        MAX(duration_ms) AS maks_ms
       FROM aleta_bot_service_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND stage = 'terjawab'`,
    [days]
  );

  const perInformasi = await botDb.query(
    `SELECT option_key, COUNT(*) AS jumlah
       FROM aleta_bot_service_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND stage = 'terjawab' AND option_key <> ''
      GROUP BY option_key
      ORDER BY jumlah DESC`,
    [days]
  );

  const perHasil = await botDb.query(
    `SELECT outcome, COUNT(*) AS jumlah
       FROM aleta_bot_service_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND outcome <> ''
      GROUP BY outcome
      ORDER BY jumlah DESC`,
    [days]
  );

  const perJam = await botDb.query(
    `SELECT HOUR(created_at) AS jam, COUNT(*) AS jumlah
       FROM aleta_bot_service_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND stage = 'terjawab'
      GROUP BY HOUR(created_at)
      ORDER BY jam ASC`,
    [days]
  );

  const dariPotret = await botDb.query(
    `SELECT data_source, COUNT(*) AS jumlah
       FROM aleta_bot_service_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND stage = 'terjawab' AND data_source <> ''
      GROUP BY data_source`,
    [days]
  );

  const jamTersibuk = (Array.isArray(perJam) ? perJam : []).reduce(
    (top, row) => (!top || Number(row.jumlah) > Number(top.jumlah) ? row : top),
    null
  );

  return {
    available: true,
    range,
    days,
    pertanyaanDilayani: Number((ringkas && ringkas.terjawab) || 0),
    pemohonUnik: Number((ringkas && ringkas.pemohon) || 0),
    waktuTanggapRataMs: Math.round(Number((ringkas && ringkas.rata_ms) || 0)),
    waktuTanggapTerlamaMs: Number((ringkas && ringkas.maks_ms) || 0),
    perInformasi: (Array.isArray(perInformasi) ? perInformasi : []).map((row) => ({
      optionKey: row.option_key,
      jumlah: Number(row.jumlah) || 0,
    })),
    perHasil: (Array.isArray(perHasil) ? perHasil : []).map((row) => ({
      outcome: row.outcome,
      jumlah: Number(row.jumlah) || 0,
    })),
    perJam: (Array.isArray(perJam) ? perJam : []).map((row) => ({
      jam: Number(row.jam),
      jumlah: Number(row.jumlah) || 0,
    })),
    jamTersibuk: jamTersibuk ? Number(jamTersibuk.jam) : null,
    sumberData: (Array.isArray(dariPotret) ? dariPotret : []).map((row) => ({
      source: row.data_source,
      jumlah: Number(row.jumlah) || 0,
    })),
  };
}

/** Membuang catatan lama. Statistik agregat tidak perlu disimpan selamanya. */
async function pruneOlderThan(days = 400) {
  const ready = await ensureTable();
  if (!ready) return 0;
  const result = await botDb.query(
    `DELETE FROM aleta_bot_service_events WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [Math.max(30, Math.min(2000, Number(days) || 400))]
  );
  return (result && result.affectedRows) || 0;
}

module.exports = {
  FUNNEL_STAGES,
  OUTCOMES,
  getFunnel,
  getServiceReport,
  mapActionToEvent,
  pruneOlderThan,
  record,
  sessionHash,
};
