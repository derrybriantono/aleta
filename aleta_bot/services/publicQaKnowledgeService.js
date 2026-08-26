const botDb = require("./botDbService");
const logService = require("./logService");
const { readRuntimeConfig } = require("../config/runtime-config");
const { normalizeIndonesianPhoneNumber } = require("../utils/phoneFormatter");

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const DB_TIMEOUT_MS = 1500;
let lastSyncAt = 0;
let syncInFlight = null;

const STOP_WORDS = new Set([
  "saya",
  "aku",
  "mau",
  "ingin",
  "tolong",
  "mohon",
  "yang",
  "dan",
  "atau",
  "apa",
  "cara",
  "bagaimana",
  "gimana",
  "berapa",
  "kapan",
  "dimana",
  "di",
  "ke",
  "untuk",
  "bisa",
  "boleh",
  "dengan",
  "dari",
  "ini",
  "itu",
]);

const DISALLOWED_INTENT_KEYS = new Set([
  "cek_perkara",
  "cek_jadwal_sidang",
  "cek_akta_cerai",
  "sisa_panjar",
  "antrian_online",
]);

const BLOCKED_QUESTION_PATTERNS = [
  /\b\d{1,6}\s*\/\s*(pdt|pdt\.g|pdt\.p|pid|pid\.b|g|p)\b/i,
  /\b\d{1,6}\.(g|p)\.\d{4}\b/i,
  /nik|ktp|kk|nomor\s+rekening|password|token|api\s*key|secret/i,
  /menang|kalah|pasti\s+dikabulkan|pasti\s+ditolak|strategi\s+(perkara|sidang)|cara\s+memenangkan/i,
  /suap|bayar\s+hakim|hubungi\s+hakim|kontak\s+hakim|pungli/i,
];

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\be[\s-]?court\b/g, "ecourt")
    .replace(/\be[\s-]?berpadu\b/g, "eberpadu")
    .replace(/\bpa\b/g, "pengadilan agama")
    .replace(/[^\w\s/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function deriveCourtType(courtName) {
  const normalized = String(courtName || "").toLowerCase();
  if (normalized.includes("pengadilan agama")) return "Pengadilan Agama";
  if (normalized.includes("pengadilan tinggi agama")) return "Pengadilan Tinggi Agama";
  if (normalized.includes("pengadilan negeri")) return "Pengadilan Negeri";
  if (normalized.includes("pengadilan tinggi")) return "Pengadilan Tinggi";
  if (normalized.includes("mahkamah agung")) return "Mahkamah Agung";
  return "Pengadilan";
}

function deriveJurisdiction(courtName) {
  return String(courtName || "")
    .replace(/kelas\s+[a-z0-9 ]+$/i, "")
    .replace(/^mahkamah agung( republik indonesia)?$/i, "Republik Indonesia")
    .replace(/^pengadilan tinggi agama\s+/i, "")
    .replace(/^pengadilan agama\s+/i, "")
    .replace(/^pengadilan tinggi\s+/i, "")
    .replace(/^pengadilan negeri\s+/i, "")
    .trim();
}

function normalizePublicPhone(value) {
  return normalizeIndonesianPhoneNumber(value || "");
}

function buildWhatsappChatUrl(value) {
  const normalized = normalizePublicPhone(value);
  return normalized ? `https://wa.me/${normalized}` : "Belum diisi di Identitas Instansi.";
}

function getIdentityValues(runtime = readRuntimeConfig()) {
  const identity = runtime.institutionIdentity || {};
  const courtName = String(identity.courtName || "pengadilan");
  const website = String(identity.website || "Belum diisi di Identitas Instansi.");
  const csWhatsappNumber = identity.csWhatsappNumber || identity.mobilePhone || "";
  const botWhatsappNumber = identity.botWhatsappNumber || runtime.whatsapp?.phoneNumber || "";
  return {
    court_name: courtName,
    court_short_name: String(identity.courtShortName || identity.courtName || "pengadilan"),
    court_type: deriveCourtType(courtName),
    jurisdiction: deriveJurisdiction(courtName) || "wilayah hukum sesuai identitas instansi",
    address: String(identity.address || "Silakan cek alamat pada website resmi pengadilan."),
    phone: String(identity.phoneNumber || "Silakan cek kontak pada website resmi pengadilan."),
    mobile_phone: String(identity.mobilePhone || identity.phoneNumber || "Silakan cek kontak pada website resmi pengadilan."),
    cs_whatsapp_number: normalizePublicPhone(csWhatsappNumber) || "Belum diisi di Identitas Instansi.",
    cs_whatsapp_chat_url: buildWhatsappChatUrl(csWhatsappNumber),
    bot_whatsapp_number: normalizePublicPhone(botWhatsappNumber) || "Belum diisi di Identitas Instansi.",
    bot_whatsapp_chat_url: buildWhatsappChatUrl(botWhatsappNumber),
    email: String(identity.email || "Silakan cek email pada website resmi pengadilan."),
    instagram: String(identity.instagram || "Belum diisi di Identitas Instansi."),
    facebook: String(identity.facebook || "Belum diisi di Identitas Instansi."),
    youtube: String(identity.youtube || "Belum diisi di Identitas Instansi."),
    website,
    map_url: String(identity.mapUrl || "Belum diisi di Identitas Instansi."),
  };
}

function renderPlaceholders(text, values) {
  return String(text || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = values[key];
    return value == null ? "" : String(value);
  });
}

function toKnowledgeEntry(item = {}) {
  const keywords = parseJsonArray(item.keywords ?? item.keywords_json);
  return {
    id: String(item.id || item.key || ""),
    key: String(item.key || ""),
    title: String(item.title || item.name || item.key || ""),
    category: String(item.category || "informasi_umum"),
    audience: String(item.audience || "public"),
    keywords: keywords.map((keyword) => String(keyword || "").trim()).filter(Boolean),
    answer: String(item.answer || ""),
    sourceLabel: String(item.sourceLabel ?? item.source_label ?? ""),
    sourceUrl: String(item.sourceUrl ?? item.source_url ?? ""),
    priority: Number(item.priority || 50),
    isActive: Boolean(item.isActive ?? item.is_active ?? true),
    updatedAt: item.updatedAt ?? item.updated_at ?? null,
  };
}

function getRuntimeKnowledgeEntries(runtime = readRuntimeConfig()) {
  return (Array.isArray(runtime.publicQaKnowledge) ? runtime.publicQaKnowledge : [])
    .map(toKnowledgeEntry)
    .filter((entry) => entry.key && entry.answer && entry.isActive);
}

async function syncRuntimeKnowledgeToDb(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return false;
  const ready = await botDb.ensureSchema();
  if (!ready) return false;
  const now = botDb.toMysqlDate(new Date());
  for (const entry of entries) {
    await botDb.query(
      `INSERT INTO aleta_bot_public_qa_knowledge (
        id, \`key\`, title, category, audience, keywords_json, answer,
        source_label, source_url, priority, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = IF(source_label LIKE 'ALETA Public Knowledge%', VALUES(title), title),
        category = IF(source_label LIKE 'ALETA Public Knowledge%', VALUES(category), category),
        audience = IF(source_label LIKE 'ALETA Public Knowledge%', VALUES(audience), audience),
        keywords_json = IF(source_label LIKE 'ALETA Public Knowledge%', VALUES(keywords_json), keywords_json),
        answer = IF(source_label LIKE 'ALETA Public Knowledge%', VALUES(answer), answer),
        source_label = IF(source_label LIKE 'ALETA Public Knowledge%', VALUES(source_label), source_label),
        source_url = IF(source_label LIKE 'ALETA Public Knowledge%', VALUES(source_url), source_url),
        priority = IF(source_label LIKE 'ALETA Public Knowledge%', VALUES(priority), priority),
        is_active = IF(source_label LIKE 'ALETA Public Knowledge%', VALUES(is_active), is_active),
        updated_at = IF(source_label LIKE 'ALETA Public Knowledge%', VALUES(updated_at), updated_at)`,
      [
        entry.id,
        entry.key,
        entry.title.slice(0, 190),
        entry.category.slice(0, 64),
        entry.audience.slice(0, 32),
        JSON.stringify(entry.keywords),
        entry.answer,
        entry.sourceLabel.slice(0, 190),
        entry.sourceUrl,
        Number(entry.priority || 50),
        entry.isActive ? 1 : 0,
        now,
      ]
    );
  }
  return true;
}

async function maybeSyncRuntimeKnowledge(entries) {
  if (Date.now() - lastSyncAt < SYNC_INTERVAL_MS) return false;
  if (!syncInFlight) {
    syncInFlight = syncRuntimeKnowledgeToDb(entries)
      .then((ok) => {
        if (ok) lastSyncAt = Date.now();
        return ok;
      })
      .catch((error) => {
        logService.logSystemEvent({
          eventType: "public_qa_knowledge_sync_failed",
          severity: "warning",
          message: "Sinkronisasi knowledge Public Q&A ke DB runtime gagal.",
          metadata: { errorMessage: error.message },
        });
        return false;
      })
      .finally(() => {
        syncInFlight = null;
      });
  }
  return withTimeout(syncInFlight, DB_TIMEOUT_MS, false);
}

async function getDbKnowledgeEntries() {
  const ready = await botDb.ensureSchema();
  if (!ready) return [];
  const rows = await botDb.query(
    `SELECT id, \`key\`, title, category, audience, keywords_json, answer,
      source_label, source_url, priority, is_active, updated_at
     FROM aleta_bot_public_qa_knowledge
     WHERE is_active = 1
     ORDER BY priority DESC, category ASC, title ASC
     LIMIT 500`
  );
  return Array.isArray(rows) ? rows.map(toKnowledgeEntry).filter((entry) => entry.key && entry.answer) : [];
}

async function listKnowledgeEntries() {
  const runtimeEntries = getRuntimeKnowledgeEntries();
  if (runtimeEntries.length > 0) {
    await maybeSyncRuntimeKnowledge(runtimeEntries);
  }
  const dbEntries = await withTimeout(getDbKnowledgeEntries(), DB_TIMEOUT_MS, []);
  const merged = new Map();
  for (const entry of runtimeEntries) {
    merged.set(entry.key, entry);
  }
  for (const entry of dbEntries) {
    merged.set(entry.key, entry);
  }
  return Array.from(merged.values()).sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
}

function questionIsSafeForKnowledge(question) {
  const raw = String(question || "");
  return !BLOCKED_QUESTION_PATTERNS.some((pattern) => pattern.test(raw));
}

function canUseKnowledgeForIntent(intent = {}) {
  const key = String(intent.key || "");
  if (DISALLOWED_INTENT_KEYS.has(key)) return false;
  if (intent.requiresVerification || intent.requiresCaseNumber) return false;
  const answerPolicy = String(intent.answerPolicy || intent.answer_policy || "public_info_only");
  if (key !== "fallback_unknown" && !["public_info_only", ""].includes(answerPolicy)) return false;
  return true;
}

function categoryMatchesIntent(entry, intent = {}) {
  const intentCategory = normalizeText(intent.category || "");
  const entryCategory = normalizeText(entry.category || "");
  if (!intentCategory || !entryCategory) return false;
  if (intentCategory === entryCategory) return true;
  const aliases = {
    layanan: ["pendaftaran", "bantuan_hukum", "akta_cerai", "biaya_panjar", "informasi_publik"],
    informasi_umum: ["layanan", "informasi_publik", "fallback"],
    pengaduan: ["informasi_umum"],
    ecourt: ["pendaftaran"],
    jadwal_sidang: ["persidangan"],
    status_perkara: ["persidangan"],
  };
  return (aliases[intentCategory] || []).includes(entryCategory);
}

function scoreKnowledge(question, entry, intent = {}) {
  const normalizedQuestion = normalizeText(question);
  const questionTokens = new Set(tokenize(question));
  const titleTokens = tokenize(entry.title);
  let score = 0;

  for (const keyword of entry.keywords) {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) continue;
    if (normalizedQuestion.includes(normalizedKeyword)) {
      score += normalizedKeyword.includes(" ") ? 5 : 3;
      continue;
    }
    const keywordTokens = tokenize(normalizedKeyword);
    const hits = keywordTokens.filter((token) => questionTokens.has(token)).length;
    if (hits > 0) score += hits / Math.max(1, keywordTokens.length);
  }

  const titleHits = titleTokens.filter((token) => questionTokens.has(token)).length;
  if (titleHits > 0) score += titleHits * 0.5;
  if (categoryMatchesIntent(entry, intent)) score += 2;
  if (String(intent.key || "") && entry.key.includes(String(intent.key || ""))) score += 1.5;
  if (entry.category === "fallback") score -= 1;
  return score + Math.min(2, Number(entry.priority || 50) / 100);
}

function buildKnowledgeAnswer(entry, runtime = readRuntimeConfig()) {
  const values = getIdentityValues(runtime);
  const answer = renderPlaceholders(entry.answer, values).replace(/\n{4,}/g, "\n\n\n").trim();
  const sourceLabel = renderPlaceholders(entry.sourceLabel, values).trim();
  const sourceUrl = renderPlaceholders(entry.sourceUrl, values).trim();
  if (!sourceLabel) return answer;
  if (/^https?:\/\//i.test(sourceUrl)) {
    return `${answer}\n\nSumber acuan: ${sourceLabel} (${sourceUrl}).`;
  }
  return `${answer}\n\nSumber acuan: ${sourceLabel}.`;
}

async function findKnowledgeAnswer({ question, intent = {}, params = {} } = {}) {
  if (!questionIsSafeForKnowledge(question)) return null;
  if (!canUseKnowledgeForIntent(intent)) return null;
  const entries = await listKnowledgeEntries();
  const allowedEntries = entries.filter((entry) => ["public", "party"].includes(entry.audience) && entry.isActive);
  let best = null;
  for (const entry of allowedEntries) {
    const score = scoreKnowledge(question, entry, intent);
    if (!best || score > best.score) {
      best = { entry, score };
    }
  }
  const isFallback = String(intent.key || "") === "fallback_unknown";
  const threshold = isFallback ? 4 : 2.5;
  if (!best || best.score < threshold) return null;
  const runtime = readRuntimeConfig();
  return {
    ...best.entry,
    score: best.score,
    params,
    answer: buildKnowledgeAnswer(best.entry, runtime),
  };
}

module.exports = {
  listKnowledgeEntries,
  findKnowledgeAnswer,
  normalizeText,
  scoreKnowledge,
  canUseKnowledgeForIntent,
};
