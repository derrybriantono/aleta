/**
 * legacyCommandAdapter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Phase 5 — Legacy Command Adapter
 *
 * Wraps the monolithic getData() function from query.js into a normalized
 * interface. Provides:
 *  - Command catalog (public + admin keywords)
 *  - resolveCommand(message) → classifies and optionally delegates
 *  - testCommand(keyword) → dry-run that returns what getData would return
 *  - detectDuplicates() → finds overlapping intent coverage with publicQaIntentService
 *
 * IMPORTANT: This adapter does NOT replace query.js. It wraps it transparently.
 * The existing message handler in app.js still calls getData() directly.
 * This adapter is used for audit, classification, and gradual migration only.
 */

"use strict";

const publicQaIntentService = require("../publicQaIntentService");
const logService = require("../logService");

/**
 * Classification of all keyword handlers in query.js getData().
 * type: "public" | "admin" | "internal" | "legacy_only"
 * migrationTarget: "public_qa_intent" | "query_catalog" | "portal_admin" | "skip"
 * migrationStatus: "migrated" | "in_progress" | "pending" | "skip"
 */
const COMMAND_CATALOG = [
  // ── PUBLIC GREETINGS ────────────────────────────────────────────────────────
  {
    keywords: ["halo", "hallo", "hai", "hei", "assalamualaikum", "aslmkm", "ass"],
    feature: "Salam/Sapaan",
    type: "public",
    hasParam: false,
    migrationTarget: "public_qa_intent",
    migrationStatus: "in_progress",
    notes: "Intent greeting sudah ada di portal.",
  },
  {
    keywords: ["info lengkap"],
    feature: "Info Menu Lengkap",
    type: "public",
    hasParam: false,
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  // ── PUBLIC PERKARA ──────────────────────────────────────────────────────────
  {
    keywords: ["perkara"],
    feature: "Status/Menu Perkara",
    type: "public",
    hasParam: false,
    migrationTarget: "public_qa_intent",
    migrationStatus: "in_progress",
  },
  {
    keywords: ["jadwal"],
    feature: "Jadwal Sidang (berdasarkan nomor perkara)",
    type: "public",
    hasParam: true,
    paramExample: "jadwal#123.G.2021",
    migrationTarget: "public_qa_intent",
    migrationStatus: "in_progress",
  },
  {
    keywords: ["akta"],
    feature: "Status Akta Cerai",
    type: "public",
    hasParam: true,
    paramExample: "akta#123.G.2021",
    migrationTarget: "public_qa_intent",
    migrationStatus: "in_progress",
  },
  {
    keywords: ["putusan"],
    feature: "Isi Putusan",
    type: "public",
    hasParam: true,
    paramExample: "putusan#123.G.2021",
    migrationTarget: "public_qa_intent",
    migrationStatus: "in_progress",
  },
  {
    keywords: ["biaya"],
    feature: "Biaya Perkara",
    type: "public",
    hasParam: true,
    paramExample: "biaya#123.G.2021",
    migrationTarget: "public_qa_intent",
    migrationStatus: "in_progress",
  },
  {
    keywords: ["status"],
    feature: "Status Perkara Lengkap",
    type: "public",
    hasParam: true,
    paramExample: "status#123.G.2021",
    migrationTarget: "public_qa_intent",
    migrationStatus: "in_progress",
  },
  {
    keywords: ["cek"],
    feature: "Cek Perkara",
    type: "public",
    hasParam: true,
    paramExample: "cek#123.G.2021",
    migrationTarget: "public_qa_intent",
    migrationStatus: "in_progress",
  },
  {
    keywords: ["amar hari ini"],
    feature: "Amar Putusan Hari Ini",
    type: "public",
    hasParam: false,
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  // ── PUBLIC SIDANG ───────────────────────────────────────────────────────────
  {
    keywords: ["sidang hari ini"],
    feature: "Jadwal Sidang Hari Ini",
    type: "public",
    hasParam: false,
    migrationTarget: "public_qa_intent",
    migrationStatus: "in_progress",
  },
  {
    keywords: ["sidang besok"],
    feature: "Jadwal Sidang Besok",
    type: "public",
    hasParam: false,
    migrationTarget: "public_qa_intent",
    migrationStatus: "in_progress",
  },
  {
    keywords: ["sidang tanggal"],
    feature: "Jadwal Sidang Tanggal Tertentu",
    type: "public",
    hasParam: true,
    paramExample: "sidang tanggal#20-12-2021",
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  // ── PUBLIC ANTRIAN ──────────────────────────────────────────────────────────
  {
    keywords: ["daftar antrian"],
    feature: "Daftar Antrian Sidang Online (Penggugat/Kuasa P)",
    type: "public",
    hasParam: true,
    paramExample: "daftar antrian#123.1.2021",
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  {
    keywords: ["antrian online"],
    feature: "Antrian Sidang Online (Tergugat/Kuasa T)",
    type: "public",
    hasParam: true,
    paramExample: "antrian online#123.1.2021",
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  // ── PUBLIC INFO LAYANAN ─────────────────────────────────────────────────────
  {
    keywords: ["alamat"],
    feature: "Alamat & Kontak Pengadilan",
    type: "public",
    hasParam: false,
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  {
    keywords: ["daftar"],
    feature: "Cara & Syarat Pendaftaran Perkara",
    type: "public",
    hasParam: false,
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  {
    keywords: ["ecourt"],
    feature: "Informasi E-Court",
    type: "public",
    hasParam: false,
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  {
    keywords: ["survei"],
    feature: "Survei Elektronik",
    type: "public",
    hasParam: false,
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  {
    keywords: ["validasi"],
    feature: "Validasi Akta Cerai",
    type: "public",
    hasParam: false,
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  {
    keywords: ["layanan"],
    feature: "Informasi Layanan PTSP",
    type: "public",
    hasParam: false,
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  {
    keywords: ["bapanjar"],
    feature: "Layanan BAPANJAR",
    type: "public",
    hasParam: false,
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  {
    keywords: ["pesan akta"],
    feature: "Pesan/Ambil Akta Cerai",
    type: "public",
    hasParam: true,
    paramExample: "pesan akta#123.G.2021 ambil 04-01-2022 Jam 09.00",
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  {
    keywords: ["statistik"],
    feature: "Statistik Perkara",
    type: "public",
    hasParam: true,
    paramExample: "statistik#2021",
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  {
    keywords: ["statistik detail"],
    feature: "Statistik Perkara Detail",
    type: "public",
    hasParam: true,
    paramExample: "statistik detail#2021",
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  {
    keywords: ["alasan cerai"],
    feature: "Statistik Alasan Cerai",
    type: "public",
    hasParam: false,
    migrationTarget: "public_qa_intent",
    migrationStatus: "pending",
  },
  // ── ADMIN/INTERNAL ──────────────────────────────────────────────────────────
  {
    keywords: [
      "monev ketua", "monev wakil ketua", "monev pimpinan",
      "monev panitera", "monev sekretaris", "monev panmud gugatan",
      "monev panmud permohonan", "monev panmud hukum", "monev kasir",
      "monev delegasi", "monev arsip", "monev penjaga sidang",
      "monev ptsp", "monev penerimaan", "monev penerimaan lengkap",
      "monev penerimaan semua",
    ],
    feature: "Monitoring Jabatan (per jabatan)",
    type: "admin",
    hasParam: false,
    migrationTarget: "query_catalog",
    migrationStatus: "in_progress",
  },
  {
    keywords: [
      "monev bas", "monev penahanan", "monev relaas", "monev pbt",
      "monev minutasi", "monev publikasi", "monev arsip", "monev saksi salah",
      "monev court calender", "monev court calender edoc", "monev putusan",
      "monev patut", "monev pos", "monev lupa", "monev putus lebih 30 hari",
      "monev sidang lebih 30 hari", "monev delegasi masuk", "monev delegasi keluar",
      "monev upaya hukum", "monev cerai anak", "monev verstek", "monev bht",
      "monev tunda mediasi", "monev petitum", "monev anom", "monev panjar",
      "monev ecourt", "monev prodeo", "monev ghaib", "monev mediasi",
      "monev sidkel", "monev meterai", "monev alamat", "monev identitas pihak",
      "monev penetapan", "monev alasan cerai", "monev kua cerai", "monev capil cerai",
    ],
    feature: "Monitoring Kasus/Proses SIPP",
    type: "admin",
    hasParam: false,
    migrationTarget: "query_catalog",
    migrationStatus: "in_progress",
  },
  {
    keywords: ["monev sidang", "monev sidang besok", "monev sidang hari ini lengkap", "monev sidang tanggal"],
    feature: "Monitoring Sidang (admin)",
    type: "admin",
    hasParam: false,
    migrationTarget: "query_catalog",
    migrationStatus: "in_progress",
  },
  {
    keywords: ["hakim"],
    feature: "Data Per-Hakim (jadwal, putus, BA, dll.)",
    type: "admin",
    hasParam: true,
    paramExample: "hakim#Nama Hakim",
    migrationTarget: "query_catalog",
    migrationStatus: "in_progress",
  },
  {
    keywords: ["pp"],
    feature: "Data Per-Panitera Pengganti (jadwal, mediasi, dll.)",
    type: "admin",
    hasParam: true,
    paramExample: "pp#Nama Panitera",
    migrationTarget: "query_catalog",
    migrationStatus: "in_progress",
  },
  {
    keywords: ["js", "sidang js"],
    feature: "Data Per-Jurusita (panggilan, delegasi, dll.)",
    type: "admin",
    hasParam: true,
    paramExample: "js#Nama Jurusita",
    migrationTarget: "query_catalog",
    migrationStatus: "in_progress",
  },
  {
    keywords: [
      "sipp putus", "sipp minutasi", "sipp upload putusan", "sipp pendaftaran",
      "sipp pmh", "sipp input pmh", "sipp pp", "sipp input pp",
      "sipp js", "sipp input js", "sipp phs", "sipp input phs",
      "sipp relaas", "sipp mediasi", "sipp saksi", "sipp pbt", "sipp bht",
      "sipp sisa panjar", "sipp arsip", "sipp delegasi", "sipp edoc petitum",
      "sipp edoc relaas", "sipp edoc bas", "sipp edoc ac", "sipp agenda sidang",
      "sipp permohonan delegasi", "sipp verstek",
    ],
    feature: "Monitoring Kompetensi SIPP (per indikator)",
    type: "admin",
    hasParam: false,
    migrationTarget: "query_catalog",
    migrationStatus: "in_progress",
  },
  {
    keywords: ["kode hakim", "kode panitera", "kode"],
    feature: "Kode WhatsApp Pegawai",
    type: "admin",
    hasParam: false,
    migrationTarget: "query_catalog",
    migrationStatus: "pending",
  },
  {
    keywords: ["nilai sipp"],
    feature: "Nilai SIPP Triwulan",
    type: "admin",
    hasParam: false,
    migrationTarget: "query_catalog",
    migrationStatus: "pending",
  },
  {
    keywords: ["nilai triwulan"],
    feature: "Nilai Kinerja Triwulan",
    type: "admin",
    hasParam: false,
    migrationTarget: "query_catalog",
    migrationStatus: "pending",
  },
  {
    keywords: ["absen pagi", "absen sore"],
    feature: "Absensi Pegawai",
    type: "admin",
    hasParam: false,
    migrationTarget: "query_catalog",
    migrationStatus: "pending",
  },
  {
    keywords: ["pengumuman"],
    feature: "Pengumuman Internal",
    type: "admin",
    hasParam: false,
    migrationTarget: "query_catalog",
    migrationStatus: "pending",
  },
  {
    keywords: ["bas hakim"],
    feature: "BA Sidang per Hakim",
    type: "admin",
    hasParam: false,
    migrationTarget: "query_catalog",
    migrationStatus: "pending",
  },
  {
    keywords: ["dirput hukum"],
    feature: "Direktori Putusan Hukum",
    type: "admin",
    hasParam: false,
    migrationTarget: "query_catalog",
    migrationStatus: "pending",
  },
  {
    keywords: ["monev kepegawaian"],
    feature: "Monitoring Kepegawaian",
    type: "admin",
    hasParam: false,
    migrationTarget: "query_catalog",
    migrationStatus: "pending",
  },
  // ── LEGACY/INTERNAL ONLY ───────────────────────────────────────────────────
  {
    keywords: ["jumlah alasan cerai"],
    feature: "Jumlah Alasan Cerai (admin)",
    type: "legacy_only",
    hasParam: false,
    migrationTarget: "query_catalog",
    migrationStatus: "pending",
  },
  {
    keywords: ["saksi"],
    feature: "Data Saksi",
    type: "legacy_only",
    hasParam: true,
    paramExample: "saksi#nomor_perkara",
    migrationTarget: "query_catalog",
    migrationStatus: "pending",
  },
];

/**
 * Build a flat keyword → catalog entry map for fast lookup.
 * @returns {Map<string, object>}
 */
function buildKeywordMap() {
  const map = new Map();
  for (const entry of COMMAND_CATALOG) {
    for (const kw of entry.keywords) {
      map.set(kw.toLowerCase(), entry);
    }
  }
  return map;
}

const _keywordMap = buildKeywordMap();

/**
 * Classify an incoming message against the legacy command catalog.
 *
 * @param {string} rawMessage - incoming WhatsApp message text
 * @returns {{ matched: boolean, keyword: string, entry: object|null, isPublic: boolean, isAdmin: boolean, hasParam: boolean, param: string }}
 */
function classifyCommand(rawMessage) {
  const text = (rawMessage || "").toLowerCase().trim();
  const parts = text.split("#");
  const keyword = (parts[0] || "").trim();
  const param = parts.slice(1).join("#").trim();

  const entry = _keywordMap.get(keyword) ?? null;

  return {
    matched: entry !== null,
    keyword,
    param,
    entry,
    isPublic: entry?.type === "public",
    isAdmin: entry?.type === "admin",
    isLegacyOnly: entry?.type === "legacy_only",
    hasParam: Boolean(param),
    migrationTarget: entry?.migrationTarget ?? null,
    migrationStatus: entry?.migrationStatus ?? null,
  };
}

/**
 * Detect commands that overlap with active publicQaIntentService intents.
 * Returns a list of keywords handled by BOTH the legacy adapter and the new service.
 *
 * @returns {{ keyword: string, legacyEntry: object, intentKey: string }[]}
 */
function detectDuplicateCommandPaths() {
  const runtimeIntents = publicQaIntentService.getRuntimeIntents();
  const duplicates = [];

  for (const entry of COMMAND_CATALOG) {
    if (entry.type !== "public") continue;

    for (const kw of entry.keywords) {
      const matched = runtimeIntents.find((intent) => {
        const triggers = (intent.triggerKeywords || []).map((t) =>
          String(t).toLowerCase().trim()
        );
        return triggers.includes(kw.toLowerCase());
      });

      if (matched) {
        duplicates.push({
          keyword: kw,
          legacyEntry: entry,
          intentKey: matched.key || matched.id,
        });
      }
    }
  }

  return duplicates;
}

/**
 * Get a snapshot of the command catalog for the portal migration dashboard.
 * @returns {{ total: number, public: number, admin: number, legacyOnly: number, byStatus: Record<string, number>, entries: object[] }}
 */
function getCommandCatalogSnapshot() {
  const total = COMMAND_CATALOG.length;
  const publicCount = COMMAND_CATALOG.filter((e) => e.type === "public").length;
  const adminCount = COMMAND_CATALOG.filter((e) => e.type === "admin").length;
  const legacyOnlyCount = COMMAND_CATALOG.filter((e) => e.type === "legacy_only").length;

  const byStatus = {};
  for (const entry of COMMAND_CATALOG) {
    const s = entry.migrationStatus || "unknown";
    byStatus[s] = (byStatus[s] || 0) + 1;
  }

  const totalKeywords = COMMAND_CATALOG.reduce(
    (sum, e) => sum + e.keywords.length, 0
  );

  return {
    total,
    totalKeywords,
    public: publicCount,
    admin: adminCount,
    legacyOnly: legacyOnlyCount,
    byStatus,
    entries: COMMAND_CATALOG,
  };
}

module.exports = {
  COMMAND_CATALOG,
  classifyCommand,
  detectDuplicateCommandPaths,
  getCommandCatalogSnapshot,
};
