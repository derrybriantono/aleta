const crypto = require("crypto");
const botDb = require("./botDbService");
const logService = require("./logService");
const answerService = require("./publicQaAnswerService");
const aiProviderAdapter = require("./aiProviderAdapter");
const aiRuntimeConfigService = require("./aiRuntimeConfigService");
const {
  extractPublicQaParameters,
  normalizeCaseNumber,
} = require("./publicQaParameterService");
const { readRuntimeConfig } = require("../config/runtime-config");

const FALLBACK_MESSAGE =
  "Maaf, saya belum memahami pertanyaan Bapak/Ibu. Silakan ketik *info lengkap* untuk melihat daftar layanan, atau hubungi petugas Pengadilan Agama Donggala di 0822-7111-5021.";

const INTERNAL_TRIGGER_PREFIXES = [
  "monev",
  "sipp",
  "absen",
  "hakim",
  "pp",
  "js",
  "panitera",
  "jurusita",
  "nilai",
  "dirput",
  "pengumuman",
];

const memorySessions = new Map();

const DEFAULT_PUBLIC_QA_INTENTS = [
  {
    id: "qa-greeting",
    key: "greeting",
    name: "Salam dan Bantuan Awal",
    description: "Menyambut pengguna dan menampilkan menu utama ALETA Bot.",
    category: "informasi_umum",
    audience: "public",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["halo", "hallo", "hai", "hei", "assalamualaikum", "aslmkm", "ass"],
    exampleQuestions: ["Halo admin", "Assalamualaikum", "Saya butuh bantuan", "Apa saja layanan bot ini?"],
    requiredParameters: [],
    queryKey: "",
    legacyHandler: "query.getData:greeting",
    legacyCommand: "halo",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.65,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: FALLBACK_MESSAGE,
    riskLevel: "low",
    notes: "Seed dari trigger greeting query.js.",
  },
  {
    id: "qa-info-lengkap",
    key: "info_lengkap",
    name: "Info Lengkap",
    description: "Menampilkan daftar layanan informasi yang tersedia.",
    category: "informasi_umum",
    audience: "public",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["info lengkap", "informasi"],
    exampleQuestions: ["Saya mau lihat semua layanan", "Ada info apa saja?", "Daftar menu bot"],
    requiredParameters: [],
    queryKey: "",
    legacyHandler: "query.getData:info lengkap",
    legacyCommand: "info lengkap",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.65,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: FALLBACK_MESSAGE,
    riskLevel: "low",
    notes: "Seed dari trigger info lengkap query.js.",
  },
  {
    id: "qa-alamat",
    key: "alamat_pengadilan",
    name: "Alamat Pengadilan",
    description: "Informasi alamat, kontak, website, dan kanal resmi pengadilan.",
    category: "informasi_umum",
    audience: "public",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["alamat"],
    exampleQuestions: ["Alamat pengadilan di mana?", "Lokasi kantor PA Donggala", "Nomor WhatsApp pengadilan berapa?"],
    requiredParameters: [],
    queryKey: "",
    legacyHandler: "query.getData:alamat",
    legacyCommand: "alamat",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.7,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: FALLBACK_MESSAGE,
    riskLevel: "low",
    notes: "Seed dari trigger alamat query.js.",
  },
  {
    id: "qa-cek-perkara",
    key: "cek_perkara",
    name: "Cek Perkara",
    description: "Mengarahkan pengguna ke menu status, biaya, jadwal, putusan, dan akta perkara.",
    category: "status_perkara",
    audience: "party",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["perkara", "status"],
    exampleQuestions: ["Saya mau cek perkara", "Bagaimana status perkara saya?", "Saya mau tahu perkembangan perkara"],
    requiredParameters: [],
    queryKey: "public_case_status",
    legacyHandler: "query.getData:perkara/status",
    legacyCommand: "perkara",
    parameterizedLegacyCommand: "status",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.72,
    requiresVerification: true,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: "Untuk mengecek perkara, silakan kirim nomor perkara. Contoh: *status#123.G.2021*.",
    riskLevel: "medium",
    notes: "Jika nomor perkara terdeteksi, intent akan diarahkan ke status#nomor_perkara.",
  },
  {
    id: "qa-jadwal-sidang",
    key: "cek_jadwal_sidang",
    name: "Cek Jadwal Sidang",
    description: "Mengarahkan pertanyaan natural tentang jadwal sidang ke command jadwal.",
    category: "jadwal_sidang",
    audience: "party",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["jadwal"],
    exampleQuestions: ["Saya mau tahu jadwal sidang saya", "Kapan sidang perkara saya?", "Sidang saya tanggal berapa?"],
    requiredParameters: ["nomor_perkara"],
    queryKey: "public_hearing_schedule",
    legacyHandler: "query.getData:jadwal",
    legacyCommand: "jadwal",
    parameterizedLegacyCommand: "jadwal",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.72,
    requiresVerification: true,
    requiresCaseNumber: true,
    maxAttempts: 2,
    fallbackMessage: "Untuk cek jadwal sidang, silakan kirim nomor perkara. Contoh: *jadwal#123.G.2021*.",
    riskLevel: "medium",
    notes: "Data dinamis tetap memakai handler legacy query.js.",
  },
  {
    id: "qa-akta-cerai",
    key: "cek_akta_cerai",
    name: "Akta Cerai",
    description: "Informasi syarat pengambilan dan status akta cerai.",
    category: "akta_cerai",
    audience: "party",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["akta_cerai", "akta", "pesan akta", "validasi"],
    exampleQuestions: ["Bagaimana cara ambil akta cerai?", "Akta cerai saya sudah jadi belum?", "Saya mau validasi akta cerai"],
    requiredParameters: ["nomor_perkara"],
    queryKey: "public_divorce_certificate",
    legacyHandler: "query.getData:akta",
    legacyCommand: "akta_cerai",
    parameterizedLegacyCommand: "akta",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.72,
    requiresVerification: true,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: "Untuk cek status akta cerai, silakan kirim nomor perkara. Contoh: *akta#123.G.2021*. Untuk syarat pengambilan, ketik *akta_cerai*.",
    riskLevel: "medium",
    notes: "Tanpa nomor perkara dijawab dengan informasi syarat pengambilan.",
  },
  {
    id: "qa-sisa-panjar",
    key: "sisa_panjar",
    name: "Sisa Panjar / Biaya Perkara",
    description: "Mengarahkan pertanyaan biaya atau sisa panjar ke command biaya perkara.",
    category: "biaya_panjar",
    audience: "party",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["biaya"],
    exampleQuestions: ["Berapa sisa panjar perkara saya?", "Saya mau cek biaya perkara", "Rincian panjar perkara saya"],
    requiredParameters: ["nomor_perkara"],
    queryKey: "public_case_fee",
    legacyHandler: "query.getData:biaya",
    legacyCommand: "perkara",
    parameterizedLegacyCommand: "biaya",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.72,
    requiresVerification: true,
    requiresCaseNumber: true,
    maxAttempts: 2,
    fallbackMessage: "Untuk cek biaya atau sisa panjar, silakan kirim nomor perkara. Contoh: *biaya#123.G.2021*.",
    riskLevel: "medium",
    notes: "Data dinamis tetap memakai handler legacy query.js.",
  },
  {
    id: "qa-ecourt",
    key: "ecourt",
    name: "E-Court",
    description: "Informasi berperkara secara elektronik.",
    category: "ecourt",
    audience: "public",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["ecourt", "e-court"],
    exampleQuestions: ["Saya mau informasi e-court", "Bagaimana daftar perkara online?", "Cara bayar perkara online"],
    requiredParameters: [],
    queryKey: "",
    legacyHandler: "query.getData:ecourt",
    legacyCommand: "ecourt",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.7,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: FALLBACK_MESSAGE,
    riskLevel: "low",
    notes: "Seed dari trigger ecourt query.js.",
  },
  {
    id: "qa-pengaduan",
    key: "pengaduan",
    name: "Pengaduan",
    description: "Informasi kanal pengaduan resmi.",
    category: "pengaduan",
    audience: "public",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["pengaduan"],
    exampleQuestions: ["Saya mau mengadu", "Bagaimana cara membuat pengaduan?", "Saya ingin melaporkan pelayanan"],
    requiredParameters: [],
    queryKey: "",
    legacyHandler: "query.getData:pengaduan",
    legacyCommand: "pengaduan",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.7,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: FALLBACK_MESSAGE,
    riskLevel: "low",
    notes: "Seed dari trigger pengaduan query.js.",
  },
  {
    id: "qa-syarat-daftar",
    key: "syarat_daftar",
    name: "Syarat Pendaftaran Perkara",
    description: "Informasi syarat pendaftaran perkara dan jenis layanan perdata.",
    category: "layanan",
    audience: "public",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["daftar", "perdata", "gugatan_mandiri", "daftar prodeo", "syarat prodeo"],
    exampleQuestions: ["Bagaimana daftar cerai?", "Apa syarat daftar perkara?", "Saya mau daftar gugatan", "Bagaimana daftar perkara prodeo?"],
    requiredParameters: [],
    queryKey: "",
    legacyHandler: "query.getData:daftar",
    legacyCommand: "daftar",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.7,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: FALLBACK_MESSAGE,
    riskLevel: "low",
    notes: "Seed dari trigger daftar/perdata query.js.",
  },
  {
    id: "qa-salinan-putusan",
    key: "salinan_putusan",
    name: "Salinan Putusan",
    description: "Syarat permohonan salinan putusan atau penetapan.",
    category: "layanan",
    audience: "public",
    isActive: true,
    aiEnabled: true,
    exactTriggers: ["salinan_putusan", "salinan_penetapan", "putusan"],
    exampleQuestions: ["Apa syarat ambil salinan putusan?", "Saya mau salinan penetapan", "Bagaimana cara ambil putusan?"],
    requiredParameters: [],
    queryKey: "public_decision_copy",
    legacyHandler: "query.getData:salinan_putusan",
    legacyCommand: "salinan_putusan",
    parameterizedLegacyCommand: "putusan",
    templateKey: "",
    responseMode: "legacy_handler",
    confidenceThreshold: 0.7,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: "Untuk syarat salinan putusan ketik *salinan_putusan*. Untuk salinan putusan non-resmi berdasarkan nomor perkara, ketik *putusan#123.G.2021*.",
    riskLevel: "medium",
    notes: "Tidak memberi nasihat hukum atau isi putusan di luar handler legacy.",
  },
  {
    id: "qa-fallback",
    key: "fallback_unknown",
    name: "Fallback Tidak Dipahami",
    description: "Jawaban aman saat intent tidak dapat ditentukan.",
    category: "fallback",
    audience: "public",
    isActive: true,
    aiEnabled: false,
    exactTriggers: [],
    exampleQuestions: [],
    requiredParameters: [],
    queryKey: "",
    legacyHandler: "",
    legacyCommand: "",
    templateKey: "",
    responseMode: "fallback",
    confidenceThreshold: 1,
    requiresVerification: false,
    requiresCaseNumber: false,
    maxAttempts: 2,
    fallbackMessage: FALLBACK_MESSAGE,
    riskLevel: "low",
    notes: "Tidak memakai AI bebas.",
  },
];

function createId(prefix) {
  const random = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString("hex");
  return `${prefix}_${random}`;
}

function safeJson(value) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return "{}";
  }
}

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

function getDefaultAnswerSettings(key) {
  const rewriteKeys = new Set(["alamat_pengadilan", "ecourt", "pengaduan", "syarat_daftar"]);
  const guidedKeys = new Set(["cek_jadwal_sidang", "cek_akta_cerai", "sisa_panjar"]);
  if (rewriteKeys.has(key)) {
    return {
      aiAnswerEnabled: true,
      aiAnswerMode: "template_rewrite",
      answerPolicy: "public_info_only",
      verificationPolicy: "none",
      allowedDataFields: [],
      blockedDataFields: [],
      maxAiTokens: 350,
      temperature: 0.2,
      requiresApprovalBeforeActive: true,
      version: 1,
      status: "active",
    };
  }
  if (guidedKeys.has(key)) {
    return {
      aiAnswerEnabled: true,
      aiAnswerMode: "guided_answer",
      answerPolicy: key === "cek_jadwal_sidang" ? "case_status_limited" : "requires_verified_party",
      verificationPolicy: key === "cek_jadwal_sidang" ? "case_number_only" : "case_number_and_phone",
      allowedDataFields: ["nomor_perkara", "tanggal_sidang", "agenda", "ruangan", "status_umum", "keterangan"],
      blockedDataFields: ["nik", "alamat", "telepon", "nomor_hp", "catatan_internal"],
      maxAiTokens: 350,
      temperature: 0.2,
      requiresApprovalBeforeActive: true,
      version: 1,
      status: key === "cek_jadwal_sidang" ? "active" : "draft",
    };
  }
  return {
    aiAnswerEnabled: false,
    aiAnswerMode: "off",
    answerPolicy: "public_info_only",
    verificationPolicy: "none",
    allowedDataFields: [],
    blockedDataFields: ["nik", "alamat", "telepon", "nomor_hp", "catatan_internal"],
    maxAiTokens: 400,
    temperature: 0.2,
    requiresApprovalBeforeActive: true,
    version: 1,
    status: "active",
  };
}

function toCamelIntent(intent = {}) {
  const key = String(intent.key || "");
  const answerDefaults = getDefaultAnswerSettings(key);
  return {
    id: String(intent.id || intent.key || ""),
    key,
    name: String(intent.name || intent.key || ""),
    description: String(intent.description || ""),
    category: String(intent.category || "informasi_umum"),
    audience: String(intent.audience || "party"),
    isActive: Boolean(intent.isActive ?? intent.is_active ?? true),
    aiEnabled: Boolean(intent.aiEnabled ?? intent.ai_enabled ?? false),
    exactTriggers: parseJsonArray(intent.exactTriggers ?? intent.exact_triggers_json),
    exampleQuestions: parseJsonArray(intent.exampleQuestions ?? intent.example_questions_json),
    requiredParameters: parseJsonArray(intent.requiredParameters ?? intent.required_parameters_json),
    queryKey: String(intent.queryKey ?? intent.query_key ?? ""),
    legacyHandler: String(intent.legacyHandler ?? intent.legacy_handler ?? ""),
    legacyCommand: String(intent.legacyCommand ?? intent.legacy_command ?? ""),
    parameterizedLegacyCommand: String(intent.parameterizedLegacyCommand ?? intent.parameterized_legacy_command ?? ""),
    templateKey: String(intent.templateKey ?? intent.template_key ?? ""),
    responseMode: String(intent.responseMode ?? intent.response_mode ?? "legacy_handler"),
    confidenceThreshold: Number(intent.confidenceThreshold ?? intent.confidence_threshold ?? 0.65),
    requiresVerification: Boolean(intent.requiresVerification ?? intent.requires_verification ?? false),
    requiresCaseNumber: Boolean(intent.requiresCaseNumber ?? intent.requires_case_number ?? false),
    maxAttempts: Number(intent.maxAttempts ?? intent.max_attempts ?? 2),
    fallbackMessage: String(intent.fallbackMessage ?? intent.fallback_message ?? FALLBACK_MESSAGE),
    riskLevel: String(intent.riskLevel ?? intent.risk_level ?? "low"),
    notes: String(intent.notes || ""),
    aiAnswerEnabled: Boolean(intent.aiAnswerEnabled ?? intent.ai_answer_enabled ?? answerDefaults.aiAnswerEnabled),
    aiAnswerMode: String(intent.aiAnswerMode ?? intent.ai_answer_mode ?? answerDefaults.aiAnswerMode),
    answerPolicy: String(intent.answerPolicy ?? intent.answer_policy ?? answerDefaults.answerPolicy),
    verificationPolicy: String(intent.verificationPolicy ?? intent.verification_policy ?? answerDefaults.verificationPolicy),
    allowedDataFields: parseJsonArray(intent.allowedDataFields ?? intent.allowed_data_fields_json ?? answerDefaults.allowedDataFields),
    blockedDataFields: parseJsonArray(intent.blockedDataFields ?? intent.blocked_data_fields_json ?? answerDefaults.blockedDataFields),
    aiSystemPrompt: String(intent.aiSystemPrompt ?? intent.ai_system_prompt ?? ""),
    aiUserPromptTemplate: String(intent.aiUserPromptTemplate ?? intent.ai_user_prompt_template ?? ""),
    maxAiTokens: Number(intent.maxAiTokens ?? intent.max_ai_tokens ?? answerDefaults.maxAiTokens),
    temperature: Number(intent.temperature ?? answerDefaults.temperature),
    requiresApprovalBeforeActive: Boolean(intent.requiresApprovalBeforeActive ?? intent.requires_approval_before_active ?? answerDefaults.requiresApprovalBeforeActive),
    version: Number(intent.version ?? answerDefaults.version),
    status: String(intent.status ?? answerDefaults.status),
    approvedBy: String(intent.approvedBy ?? intent.approved_by ?? ""),
    approvedAt: intent.approvedAt ?? intent.approved_at ?? null,
  };
}

function normalizeIncomingQuestion(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s#./-]/g, " ")
    .replace(/\bpa\b/g, "pengadilan agama")
    .replace(/\be court\b/g, "ecourt")
    .replace(/\be-court\b/g, "ecourt")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  const stopWords = new Set(["saya", "mau", "ingin", "tolong", "mohon", "yang", "di", "ke", "dan", "apa", "cara", "bagaimana", "berapa", "kapan", "untuk", "bisa", "boleh"]);
  return normalizeIncomingQuestion(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token && token.length > 1 && !stopWords.has(token));
}

function extractParameters(text) {
  const params = extractPublicQaParameters(text);
  delete params._missing;
  return params;
}

function getRuntimeIntents() {
  const runtime = readRuntimeConfig();
  const configured = Array.isArray(runtime.publicQaIntents) ? runtime.publicQaIntents : [];
  const intents = configured.length > 0 ? configured : DEFAULT_PUBLIC_QA_INTENTS;
  return intents.map(toCamelIntent).filter((intent) => intent.key);
}

function getActivePublicIntents() {
  const runtime = readRuntimeConfig();
  if (runtime.publicQaEnabled === false) return [];
  return getRuntimeIntents().filter((intent) => intent.isActive && intent.status !== "archived" && ["party", "public"].includes(intent.audience));
}

function isLikelyInternalCommand(message) {
  const normalized = normalizeIncomingQuestion(message);
  return INTERNAL_TRIGGER_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix} `) || normalized.startsWith(`${prefix}#`));
}

function isLikelyNaturalQuestion(message) {
  const normalized = normalizeIncomingQuestion(message);
  if (normalized.includes("#")) return false;
  if (normalized.split(/\s+/).length >= 4) return true;
  return /\b(saya|mau|ingin|bagaimana|gimana|berapa|kapan|dimana|di mana|apa|tolong|mohon)\b/.test(normalized);
}

function matchExactTrigger(text, intents = getActivePublicIntents()) {
  const normalized = normalizeIncomingQuestion(text);
  for (const intent of intents) {
    const triggers = intent.exactTriggers.map(normalizeIncomingQuestion);
    const index = triggers.indexOf(normalized);
    if (index >= 0) {
      return { intent, method: "exact", confidence: 1, reason: "exact trigger", legacyCommandOverride: triggers[index] };
    }
  }
  return null;
}

function scoreIntent(text, intent) {
  const messageTokens = new Set(tokenize(text));
  const phrases = [...intent.exactTriggers, ...intent.exampleQuestions];
  let best = 0;
  for (const phrase of phrases) {
    const phraseTokens = tokenize(phrase);
    if (phraseTokens.length === 0) continue;
    const matched = phraseTokens.filter((token) => messageTokens.has(token)).length;
    const score = matched / Math.max(phraseTokens.length, messageTokens.size || 1);
    best = Math.max(best, score);
  }

  const normalized = normalizeIncomingQuestion(text);
  const keywordBoosts = {
    cek_jadwal_sidang: ["sidang", "jadwal", "kapan"],
    cek_akta_cerai: ["akta", "cerai", "jadi", "ambil"],
    sisa_panjar: ["panjar", "biaya", "sisa"],
    cek_perkara: ["perkara", "status", "cek"],
    alamat_pengadilan: ["alamat", "lokasi", "kantor"],
    ecourt: ["ecourt", "online", "elektronik"],
    pengaduan: ["pengaduan", "mengadu", "lapor"],
    syarat_daftar: ["daftar", "syarat", "gugat", "cerai"],
    salinan_putusan: ["salinan", "putusan", "penetapan"],
  };
  const boosts = keywordBoosts[intent.key] || [];
  const boostHits = boosts.filter((word) => normalized.includes(word)).length;
  return Math.min(1, best + boostHits * 0.18);
}

function matchAliasOrExample(text, intents = getActivePublicIntents()) {
  let best = null;
  for (const intent of intents) {
    const confidence = scoreIntent(text, intent);
    if (!best || confidence > best.confidence) {
      best = { intent, method: "alias", confidence, reason: "alias/example score" };
    }
  }
  if (!best) return null;
  const threshold = Math.min(0.92, Math.max(0.45, Number(best.intent.confidenceThreshold || 0.65) - 0.1));
  return best.confidence >= threshold ? best : null;
}

function buildSafeClassifierPrompt(text, intents) {
  const allowed = intents.map((intent) => ({
    key: intent.key,
    name: intent.name,
    category: intent.category,
    examples: intent.exampleQuestions.slice(0, 4),
    required_parameters: intent.requiredParameters,
    risk_level: intent.riskLevel,
  }));

  return [
    "Anda adalah intent classifier untuk WhatsApp Bot Pengadilan.",
    "Tugas Anda hanya memilih intent yang paling sesuai dari daftar intent aktif.",
    "Jangan menjawab pertanyaan pengguna secara bebas.",
    "Jangan membuat informasi hukum baru.",
    "Jangan memberi nasihat hukum.",
    "Jangan mengarang data perkara.",
    "Jika tidak yakin, pilih fallback_unknown.",
    "Kembalikan hanya JSON valid dengan field: intent_key, confidence, extracted_parameters, reason, needs_more_info.",
    "",
    `Daftar intent aktif: ${JSON.stringify(allowed)}`,
    `Pertanyaan pengguna: ${JSON.stringify(String(text || ""))}`,
  ].join("\n");
}

async function matchWithAI(text, intents = getActivePublicIntents()) {
  const runtime = readRuntimeConfig();
  const bridgeEnabled = await aiRuntimeConfigService.isAiEnabledForPublicQa().catch(() => false);
  const legacyEnabled = String(process.env.ALETA_BOT_PUBLIC_QA_AI_ENABLED || runtime.publicQaAiEnabled || "false") === "true";
  if (!bridgeEnabled && !legacyEnabled) return null;

  const allowed = intents.filter((intent) => intent.aiEnabled);
  if (allowed.length === 0) return null;

  try {
    const ai = await aiProviderAdapter.completeJson({
      messages: [{ role: "user", content: buildSafeClassifierPrompt(text, allowed) }],
      schemaHint: "Object: { intent_key: string, confidence: number, extracted_parameters: object, reason: string, needs_more_info: boolean }",
      temperature: 0,
      maxTokens: 300,
      metadata: { mode: "intent_classifier", intentKey: "classifier" },
    });
    const parsed = ai.json || {};
    const intent = allowed.find((item) => item.key === parsed.intent_key);
    if (!intent) return null;
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence || 0)));
    if (confidence < Number(intent.confidenceThreshold || 0.65)) return null;
    return {
      intent,
      method: "ai",
      confidence,
      reason: String(parsed.reason || "ai classifier"),
      extractedParameters: parsed.extracted_parameters || {},
      needsMoreInfo: Boolean(parsed.needs_more_info),
    };
  } catch (error) {
    logService.logSystemEvent({
      eventType: "public_qa_ai_match_failed",
      severity: "warning",
      message: "AI intent matcher Pertanyaan Para Pihak gagal, fallback ke matcher lokal.",
      metadata: { errorMessage: aiProviderAdapter.sanitizeAiError(error) },
    });
    return null;
  }
}

function buildLegacyCommand(intent, params) {
  const nomorPerkara = params.nomor_perkara || "";
  if (nomorPerkara && intent.parameterizedLegacyCommand) {
    return `${intent.parameterizedLegacyCommand}#${nomorPerkara}`;
  }
  return intent.legacyCommand || "";
}

function executeIntent(intent, params = {}, options = {}) {
  if (!intent || intent.responseMode === "fallback") {
    return {
      status: "fallback",
      answer: FALLBACK_MESSAGE,
      legacyCommand: "",
      needsMoreInfo: false,
    };
  }

  const missingCaseNumber = intent.requiresCaseNumber && !params.nomor_perkara;
  if (missingCaseNumber) {
    return {
      status: "needs_more_info",
      answer: intent.fallbackMessage || "Silakan kirim nomor perkara terlebih dahulu.",
      legacyCommand: "",
      needsMoreInfo: true,
    };
  }

  const legacyCommand = options.legacyCommandOverride || buildLegacyCommand(intent, params);
  if (intent.responseMode === "legacy_handler" && legacyCommand) {
    return {
      status: "answered",
      answer: "",
      legacyCommand,
      needsMoreInfo: false,
    };
  }

  return {
    status: intent.responseMode === "static_template" ? "answered" : "fallback",
    answer: intent.fallbackMessage || FALLBACK_MESSAGE,
    legacyCommand: "",
    needsMoreInfo: false,
  };
}

async function logPublicQaInteraction(data = {}) {
  const now = new Date();
  const record = {
    id: data.id || createId("qa"),
    sender_number: data.senderNumber || data.sender_number || "",
    sender_name: data.senderName || data.sender_name || "",
    raw_message: String(data.rawMessage || data.raw_message || "").slice(0, 2000),
    normalized_message: String(data.normalizedMessage || data.normalized_message || "").slice(0, 2000),
    matched_intent_key: data.matchedIntentKey || data.matched_intent_key || "fallback_unknown",
    matched_method: data.matchedMethod || data.matched_method || "fallback",
    confidence: Number(data.confidence || 0),
    parameters_json: safeJson(data.parameters || {}),
    query_key: data.queryKey || data.query_key || "",
    response_preview: String(data.responsePreview || data.response_preview || "").replace(/\s+/g, " ").slice(0, 500),
    status: data.status || "fallback",
    error_message: data.errorMessage || data.error_message || "",
    created_at: data.createdAt || data.created_at || now,
  };

  try {
    const ready = await withTimeout(botDb.ensureSchema(), 1500, false);
    if (ready) {
      await withTimeout(botDb.query(
        `INSERT INTO aleta_bot_public_qa_logs (
          id, sender_number, sender_name, raw_message, normalized_message,
          matched_intent_key, matched_method, confidence, parameters_json, query_key,
          response_preview, status, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.sender_number,
          record.sender_name,
          record.raw_message,
          record.normalized_message,
          record.matched_intent_key,
          record.matched_method,
          record.confidence,
          record.parameters_json,
          record.query_key,
          record.response_preview,
          record.status,
          record.error_message,
          botDb.toMysqlDate(record.created_at),
        ]
      ), 1500, null);
    }
  } catch (error) {
    logService.logSystemEvent({
      eventType: "public_qa_log_failed",
      severity: "warning",
      message: "Log Pertanyaan Para Pihak gagal disimpan ke DB.",
      metadata: { errorMessage: error.message, intentKey: record.matched_intent_key },
    });
  }

  return record;
}

async function getActiveSession(senderNumber) {
  if (!senderNumber) return null;
  const memory = memorySessions.get(senderNumber);
  if (memory) {
    if (new Date(memory.expires_at).getTime() > Date.now()) return memory;
    memorySessions.delete(senderNumber);
  }
  try {
    const ready = await withTimeout(botDb.ensureSchema(), 1500, false);
    if (!ready) return null;
    const rows = await withTimeout(
      botDb.query(
        `SELECT * FROM aleta_bot_public_qa_sessions
         WHERE sender_number = ? AND expires_at > NOW()
         ORDER BY updated_at DESC LIMIT 1`,
        [senderNumber]
      ),
      1500,
      []
    );
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

async function saveSession(senderNumber, intent, params = {}) {
  if (!senderNumber || !intent?.key) return null;
  const runtime = readRuntimeConfig();
  const ttl = Math.max(5, Math.min(60, Number(runtime.publicQaSessionTtlMinutes || process.env.ALETA_BOT_PUBLIC_QA_SESSION_TTL_MINUTES || 20)));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl * 60 * 1000);
  const id = createId("qas");
  memorySessions.set(senderNumber, {
    id,
    sender_number: senderNumber,
    current_intent_key: intent.key,
    state: "collecting",
    collected_params_json: safeJson(params),
    expires_at: expiresAt.toISOString(),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  });
  try {
    const ready = await withTimeout(botDb.ensureSchema(), 1500, false);
    if (!ready) return null;
    await withTimeout(
      botDb.query(`DELETE FROM aleta_bot_public_qa_sessions WHERE sender_number = ?`, [senderNumber]),
      1500,
      null
    );
    await withTimeout(
      botDb.query(
        `INSERT INTO aleta_bot_public_qa_sessions (
          id, sender_number, current_intent_key, state, collected_params_json,
          expires_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          senderNumber,
          intent.key,
          "collecting",
          safeJson(params),
          botDb.toMysqlDate(expiresAt),
          botDb.toMysqlDate(now),
          botDb.toMysqlDate(now),
        ]
      ),
      1500,
      null
    );
    return { id, expiresAt };
  } catch (error) {
    logService.logSystemEvent({
      eventType: "public_qa_session_save_failed",
      severity: "warning",
      message: "Session Pertanyaan Para Pihak gagal disimpan.",
      metadata: { errorMessage: error.message, intentKey: intent.key },
    });
    return null;
  }
}

async function clearSession(senderNumber) {
  if (!senderNumber) return;
  memorySessions.delete(senderNumber);
  try {
    const ready = await withTimeout(botDb.ensureSchema(), 1500, false);
    if (ready) {
      await withTimeout(botDb.query(`DELETE FROM aleta_bot_public_qa_sessions WHERE sender_number = ?`, [senderNumber]), 1500, null);
    }
  } catch {
    // Session cleanup must never break chat handling.
  }
}

function parseSessionParams(session) {
  try {
    return JSON.parse(session?.collected_params_json || "{}") || {};
  } catch {
    return {};
  }
}

function isCancelSessionMessage(message) {
  return ["batal", "cancel", "menu", "ulang"].includes(normalizeIncomingQuestion(message));
}

async function finalizePublicQaAnswer({ publicQa, message, senderNumber = "", legacyResponse = "" }) {
  if (!publicQa?.handled || !publicQa.intent) {
    return { answer: legacyResponse || "", status: "answered" };
  }

  const composed = await answerService.composePublicQaAnswer({
    intent: publicQa.intent,
    message,
    senderNumber,
    params: publicQa.parameters || {},
    baseAnswer: legacyResponse || publicQa.answer || "",
    confidence: publicQa.confidence || 0,
  });

  await logPublicQaInteraction({
    senderNumber,
    rawMessage: message,
    normalizedMessage: normalizeIncomingQuestion(message),
    matchedIntentKey: publicQa.intent.key,
    matchedMethod: publicQa.matchedMethod || "alias",
    confidence: publicQa.confidence || 0,
    parameters: publicQa.parameters || {},
    queryKey: publicQa.intent.queryKey,
    responsePreview: composed.answer,
    status: composed.status || "answered",
  });

  return composed;
}

async function resolvePublicQaAnswer({ message, senderNumber = "", senderName = "" }) {
  const normalized = normalizeIncomingQuestion(message);
  const params = extractParameters(message);
  const intents = getActivePublicIntents();

  if (!normalized || intents.length === 0 || isLikelyInternalCommand(normalized)) {
    return { handled: false, reason: "empty_or_internal" };
  }

  if (isCancelSessionMessage(message)) {
    await clearSession(senderNumber);
    return { handled: false, reason: "session_cancelled" };
  }

  const session = await getActiveSession(senderNumber);
  if (session) {
    const sessionIntent = intents.find((intent) => intent.key === session.current_intent_key);
    if (sessionIntent) {
      const mergedParams = {
        ...parseSessionParams(session),
        ...params,
      };
      const result = executeIntent(sessionIntent, mergedParams);
      if (result.needsMoreInfo) {
        await saveSession(senderNumber, sessionIntent, mergedParams);
      } else {
        await clearSession(senderNumber);
      }
      const composed = result.needsMoreInfo
        ? await answerService.composePublicQaAnswer({
            intent: sessionIntent,
            message,
            senderNumber,
            params: mergedParams,
            confidence: 1,
          })
        : result;
      await logPublicQaInteraction({
        senderNumber,
        senderName,
        rawMessage: message,
        normalizedMessage: normalized,
        matchedIntentKey: sessionIntent.key,
        matchedMethod: "session",
        confidence: 1,
        parameters: mergedParams,
        queryKey: sessionIntent.queryKey,
        responsePreview: composed.answer || result.legacyCommand,
        status: composed.status || result.status,
      });
      return {
        handled: true,
        intent: sessionIntent,
        matchedMethod: "session",
        confidence: 1,
        parameters: mergedParams,
        ...result,
        answer: composed.answer || result.answer,
        status: composed.status || result.status,
      };
    }
    await clearSession(senderNumber);
  }

  const exact = matchExactTrigger(normalized, intents);
  const alias = exact || matchAliasOrExample(normalized, intents);
  const ai = alias ? null : await matchWithAI(normalized, intents);
  const match = exact || alias || ai;

  if (!match) {
    if (!isLikelyNaturalQuestion(normalized)) {
      return { handled: false, reason: "no_public_match" };
    }
    const fallbackIntent = intents.find((intent) => intent.key === "fallback_unknown") || toCamelIntent(DEFAULT_PUBLIC_QA_INTENTS.find((intent) => intent.key === "fallback_unknown"));
    const result = executeIntent(fallbackIntent, params);
    await logPublicQaInteraction({
      senderNumber,
      senderName,
      rawMessage: message,
      normalizedMessage: normalized,
      matchedIntentKey: "fallback_unknown",
      matchedMethod: "fallback",
      confidence: 0,
      parameters: params,
      responsePreview: result.answer,
      status: "fallback",
    });
    return {
      handled: true,
      intent: fallbackIntent,
      matchedMethod: "fallback",
      confidence: 0,
      ...result,
    };
  }

  const mergedParams = {
    ...params,
    ...(match.extractedParameters || {}),
  };
  if (mergedParams.nomor_perkara) {
    mergedParams.nomor_perkara = normalizeCaseNumber(mergedParams.nomor_perkara) || mergedParams.nomor_perkara;
  }
  const result = executeIntent(match.intent, mergedParams, {
    legacyCommandOverride: match.method === "exact" ? match.legacyCommandOverride : "",
  });
  let composedResult = result;
  if (result.needsMoreInfo) {
    await saveSession(senderNumber, match.intent, mergedParams);
    composedResult = await answerService.composePublicQaAnswer({
      intent: match.intent,
      message,
      senderNumber,
      params: mergedParams,
      confidence: match.confidence,
    });
  }
  await logPublicQaInteraction({
    senderNumber,
    senderName,
    rawMessage: message,
    normalizedMessage: normalized,
    matchedIntentKey: match.intent.key,
    matchedMethod: match.method,
    confidence: match.confidence,
    parameters: mergedParams,
    queryKey: match.intent.queryKey,
    responsePreview: composedResult.answer || result.answer || result.legacyCommand,
    status: composedResult.status || result.status,
  });

  return {
    handled: true,
    intent: match.intent,
    matchedMethod: match.method,
    confidence: match.confidence,
    parameters: mergedParams,
    ...result,
    answer: composedResult.answer || result.answer,
    status: composedResult.status || result.status,
  };
}

async function getRecentPublicQaLogs(limit = 50) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
  const ready = await botDb.ensureSchema();
  if (!ready) return [];
  return botDb.query(`SELECT * FROM aleta_bot_public_qa_logs ORDER BY created_at DESC LIMIT ?`, [safeLimit]);
}

async function getPublicQaStats() {
  const ready = await botDb.ensureSchema();
  if (!ready) return { totalToday: 0, fallbackToday: 0, errorToday: 0, aiAnswerToday: 0, blockedToday: 0 };
  const rows = await botDb.query(
    `SELECT status, COUNT(*) AS count
     FROM aleta_bot_public_qa_logs
     WHERE DATE(created_at) = CURDATE()
     GROUP BY status`
  );
  return rows.reduce(
    (stats, row) => {
      const count = Number(row.count || 0);
      stats.totalToday += count;
      if (row.status === "fallback") stats.fallbackToday = count;
      if (row.status === "error") stats.errorToday = count;
      if (row.status === "blocked") stats.blockedToday = count;
      return stats;
    },
    { totalToday: 0, fallbackToday: 0, errorToday: 0, aiAnswerToday: 0, blockedToday: 0 }
  );
}

async function getRecentPublicQaAiLogs(limit = 20) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 20)));
  const ready = await botDb.ensureSchema();
  if (!ready) return [];
  return botDb.query(`SELECT * FROM aleta_bot_public_qa_ai_logs ORDER BY created_at DESC LIMIT ?`, [safeLimit]);
}

async function testIntent(question) {
  return resolvePublicQaAnswer({
    message: question,
    senderNumber: "test",
    senderName: "Super Admin Preview",
  });
}

async function getPublicQaSnapshot() {
  const intents = getRuntimeIntents();
  const [stats, logs] = await Promise.all([
    getPublicQaStats().catch(() => ({ totalToday: 0, fallbackToday: 0, errorToday: 0, aiAnswerToday: 0, blockedToday: 0 })),
    getRecentPublicQaLogs(10).catch(() => []),
  ]);
  const aiLogs = await getRecentPublicQaAiLogs(10).catch(() => []);
  return {
    total: intents.length,
    active: intents.filter((intent) => intent.isActive).length,
    aiEnabled: intents.filter((intent) => intent.aiEnabled).length,
    aiAnswerEnabled: intents.filter((intent) => intent.aiAnswerEnabled).length,
    mediumOrHighRisk: intents.filter((intent) => ["medium", "high"].includes(intent.riskLevel)).length,
    stats,
    recentLogs: logs,
    recentAiLogs: aiLogs,
  };
}

module.exports = {
  DEFAULT_PUBLIC_QA_INTENTS,
  FALLBACK_MESSAGE,
  normalizeIncomingQuestion,
  extractParameters,
  matchExactTrigger,
  matchAliasOrExample,
  matchWithAI,
  buildSafeClassifierPrompt,
  executeIntent,
  resolvePublicQaAnswer,
  finalizePublicQaAnswer,
  logPublicQaInteraction,
  getRuntimeIntents,
  getActivePublicIntents,
  getRecentPublicQaLogs,
  getRecentPublicQaAiLogs,
  getPublicQaStats,
  getPublicQaSnapshot,
  testIntent,
};
