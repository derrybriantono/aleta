const crypto = require("crypto");
const botDb = require("./botDbService");
const logService = require("./logService");
const aiProviderAdapter = require("./aiProviderAdapter");
const aiRuntimeConfigService = require("./aiRuntimeConfigService");
const { readRuntimeConfig } = require("../config/runtime-config");
const { verifyCaseAccess } = require("./publicQaVerificationService");

const DEFAULT_FALLBACK =
  "Maaf, informasi tersebut belum dapat saya jawab dengan aman melalui bot. Silakan hubungi PTSP Pengadilan Agama Donggala untuk bantuan lebih lanjut.";

const BLOCKED_PATTERNS = [
  /menang|kalah|pasti\s+dikabulkan|pasti\s+ditolak/i,
  /strategi\s+(perkara|sidang)|cara\s+memenangkan/i,
  /suap|bayar\s+hakim|hubungi\s+hakim/i,
  /\{\{[^}]+\}\}/,
  /\b(select|insert|update|delete|drop|alter|truncate)\b.+\b(from|table|database)\b/i,
  /api[_-]?key|token|password|secret/i,
  /at\s+.+\(.+:\d+:\d+\)/i,
];

function createId(prefix) {
  const random = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString("hex");
  return `${prefix}_${random}`;
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

function safeJson(value) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return "{}";
  }
}

function getAnswerMode(intent = {}) {
  if (!intent.aiAnswerEnabled) return "off";
  return String(intent.aiAnswerMode || "off");
}

function maskSensitiveData(text) {
  return String(text || "")
    .replace(/\b62\d{7,14}\b/g, (match) => `${match.slice(0, 4)}******${match.slice(-2)}`)
    .replace(/\b0\d{8,13}\b/g, (match) => `${match.slice(0, 3)}******${match.slice(-2)}`)
    .replace(/\b\d{16}\b/g, (match) => `${match.slice(0, 4)}********${match.slice(-4)}`)
    .replace(/(password|token|secret|api[_-]?key)\s*[:=]\s*['"]?[^'"\s]+/gi, "$1=[redacted]");
}

function sanitizeDataForAI(intent = {}, queryResult = {}) {
  const rows = Array.isArray(queryResult) ? queryResult : Array.isArray(queryResult.rows) ? queryResult.rows : [queryResult].filter(Boolean);
  const allowed = parseJsonArray(intent.allowedDataFields || intent.allowed_data_fields_json);
  const blocked = new Set(parseJsonArray(intent.blockedDataFields || intent.blocked_data_fields_json));
  const safeRows = rows.slice(0, 5).map((row) => {
    if (!row || typeof row !== "object") return row;
    const entries = Object.entries(row).filter(([key]) => {
      const normalized = key.toLowerCase();
      if (blocked.has(key) || blocked.has(normalized)) return false;
      if (/nik|ktp|alamat|telepon|hp|password|token|secret|dokumen|internal|catatan/i.test(key)) return false;
      return allowed.length === 0 || allowed.includes(key) || allowed.includes(normalized);
    });
    return Object.fromEntries(entries);
  });
  return safeRows;
}

function sanitizePublicQaAnswer(answer) {
  return maskSensitiveData(answer).replace(/\n{4,}/g, "\n\n\n").trim();
}

function applySafetyPolicy(answer, intent = {}) {
  const text = sanitizePublicQaAnswer(answer);
  const blocked = BLOCKED_PATTERNS.find((pattern) => pattern.test(text));
  if (blocked) {
    return {
      safe: false,
      answer: intent.fallbackMessage || DEFAULT_FALLBACK,
      reason: `blocked_pattern:${blocked}`,
    };
  }
  if (!text) {
    return {
      safe: false,
      answer: intent.fallbackMessage || DEFAULT_FALLBACK,
      reason: "empty_answer",
    };
  }
  return { safe: true, answer: text, reason: "ok" };
}

function renderTemplateAnswer(intent = {}, data = {}) {
  const template = String(intent.answerTemplate || intent.fallbackMessage || DEFAULT_FALLBACK);
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = data[key];
    return value == null ? "" : String(value);
  });
}

function buildFollowUpQuestion({ missingParams = [], intent = {} }) {
  if (missingParams.includes("nomor_perkara") || intent.requiresCaseNumber) {
    return "Baik, silakan ketik nomor perkara Bapak/Ibu. Contoh: 123/Pdt.G/2026/PA.Dgl atau 123.G.2026.";
  }
  return intent.fallbackMessage || "Mohon kirim data tambahan yang diperlukan agar saya bisa membantu dengan tepat.";
}

function buildAnswerPrompt({ intent, template, userQuestion, sanitizedQueryResult }) {
  const systemPrompt =
    intent.aiSystemPrompt ||
    [
      "Anda adalah penyusun jawaban WhatsApp Bot Pengadilan.",
      "Jawab hanya berdasarkan template resmi dan data terfilter yang diberikan.",
      "Jangan memberi nasihat hukum, prediksi putusan, strategi perkara, atau data rahasia.",
      "Jika data tidak cukup, arahkan ke PTSP/petugas.",
      "Gunakan bahasa Indonesia yang sopan, singkat, dan profesional.",
    ].join("\n");

  const userPrompt =
    intent.aiUserPromptTemplate ||
    [
      `Intent: ${intent.key}`,
      `Mode: ${intent.aiAnswerMode}`,
      `Pertanyaan pengguna: ${userQuestion}`,
      `Template resmi: ${template}`,
      `Data terfilter: ${JSON.stringify(sanitizedQueryResult || [])}`,
      "Susun jawaban final tanpa menambah fakta baru.",
    ].join("\n");

  return { systemPrompt, userPrompt };
}

async function callAnswerAi({ intent, template, userQuestion, sanitizedQueryResult }) {
  const runtime = readRuntimeConfig();
  const bridgeConfig = await aiRuntimeConfigService.getProviderClientConfig().catch(() => null);
  const enabled =
    Boolean(bridgeConfig?.enabled && bridgeConfig?.publicQaAiAnswerEnabled && bridgeConfig?.apiKeyConfigured) ||
    String(process.env.ALETA_BOT_PUBLIC_QA_AI_ANSWER_ENABLED || runtime.publicQaAiAnswerEnabled || "false") === "true";
  if (!enabled) return { used: false, answer: template, tokens: {}, provider: "", model: "" };

  const { systemPrompt, userPrompt } = buildAnswerPrompt({ intent, template, userQuestion, sanitizedQueryResult });
  const response = await aiProviderAdapter.completeChat({
    temperature: Number(intent.temperature ?? runtime.publicQaTemperature ?? bridgeConfig?.temperature ?? 0.2),
    maxTokens: Number(intent.maxAiTokens ?? runtime.publicQaMaxTokens ?? bridgeConfig?.maxTokens ?? 400),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    metadata: {
      mode: intent.aiAnswerMode || "template_rewrite",
      intentKey: intent.key,
      confidence: 0,
    },
  });
  return {
    used: true,
    answer: response.text || template,
    tokens: response.usage || {},
    promptPreview: maskSensitiveData(`${systemPrompt}\n${userPrompt}`).slice(0, 1000),
    provider: response.provider,
    model: response.model,
  };
}

async function logAiAnswer(data = {}) {
  try {
    const ready = await botDb.ensureSchema();
    if (!ready) return null;
    const now = new Date();
    await botDb.query(
      `INSERT INTO aleta_bot_public_qa_ai_logs (
        id, qa_log_id, intent_key, ai_provider, ai_model, prompt_preview,
        input_tokens, output_tokens, confidence, safety_status,
        ai_response_preview, fallback_used, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id || createId("qaal"),
        data.qaLogId || "",
        data.intentKey || "",
        data.aiProvider || "openai",
        data.aiModel || "",
        maskSensitiveData(data.promptPreview || "").slice(0, 1000),
        Number(data.inputTokens || 0),
        Number(data.outputTokens || 0),
        Number(data.confidence || 0),
        data.safetyStatus || "not_used",
        maskSensitiveData(data.aiResponsePreview || "").slice(0, 500),
        data.fallbackUsed ? 1 : 0,
        maskSensitiveData(data.errorMessage || "").slice(0, 500),
        botDb.toMysqlDate(now),
      ]
    );
  } catch (error) {
    logService.logSystemEvent({
      eventType: "public_qa_ai_log_failed",
      severity: "warning",
      message: "Log AI answer Pertanyaan Para Pihak gagal disimpan.",
      metadata: { errorMessage: error.message, intentKey: data.intentKey },
    });
  }
  return null;
}

async function rewriteTemplateWithAI({ intent, template, userQuestion, confidence }) {
  try {
    const ai = await callAnswerAi({ intent, template, userQuestion, sanitizedQueryResult: [] });
    const safety = applySafetyPolicy(ai.answer, intent);
    await logAiAnswer({
      intentKey: intent.key,
      aiProvider: ai.provider || "",
      aiModel: ai.model || "",
      promptPreview: ai.promptPreview || "",
      inputTokens: ai.tokens?.prompt_tokens || 0,
      outputTokens: ai.tokens?.completion_tokens || 0,
      confidence,
      safetyStatus: safety.safe ? "safe" : safety.reason,
      aiResponsePreview: ai.answer,
      fallbackUsed: !safety.safe,
    });
    return safety.answer;
  } catch (error) {
    await logAiAnswer({
      intentKey: intent.key,
      confidence,
      safetyStatus: "ai_error",
      fallbackUsed: true,
      errorMessage: aiProviderAdapter.sanitizeAiError(error),
    });
    return template;
  }
}

async function summarizeQueryResultWithAI({ intent, sanitizedQueryResult, userQuestion, template, confidence }) {
  try {
    const ai = await callAnswerAi({ intent, template, userQuestion, sanitizedQueryResult });
    const safety = applySafetyPolicy(ai.answer, intent);
    await logAiAnswer({
      intentKey: intent.key,
      aiProvider: ai.provider || "",
      aiModel: ai.model || "",
      promptPreview: ai.promptPreview || "",
      inputTokens: ai.tokens?.prompt_tokens || 0,
      outputTokens: ai.tokens?.completion_tokens || 0,
      confidence,
      safetyStatus: safety.safe ? "safe" : safety.reason,
      aiResponsePreview: ai.answer,
      fallbackUsed: !safety.safe,
    });
    return safety.answer;
  } catch (error) {
    await logAiAnswer({
      intentKey: intent.key,
      confidence,
      safetyStatus: "ai_error",
      fallbackUsed: true,
      errorMessage: aiProviderAdapter.sanitizeAiError(error),
    });
    return template;
  }
}

async function composePublicQaAnswer({
  intent,
  message,
  senderNumber = "",
  params = {},
  queryResult = null,
  baseAnswer = "",
  confidence = 0,
}) {
  const mode = getAnswerMode(intent);
  const required = Array.isArray(intent.requiredParameters) ? intent.requiredParameters : [];
  const missing = required.filter((param) => !params[param]);
  if (missing.length > 0) {
    return {
      status: "needs_more_info",
      answer: buildFollowUpQuestion({ missingParams: missing, intent }),
      safetyStatus: "needs_more_info",
    };
  }

  const verification = await verifyCaseAccess({
    senderNumber,
    nomorPerkara: params.nomor_perkara,
    intent,
  });
  if (!verification.allowed) {
    return {
      status: verification.reason === "missing_case_number" ? "needs_more_info" : "blocked",
      answer: verification.fallbackMessage || buildFollowUpQuestion({ missingParams: ["nomor_perkara"], intent }),
      safetyStatus: verification.reason,
    };
  }

  const template = baseAnswer || renderTemplateAnswer(intent, params);
  let answer = template;

  if (mode === "template_rewrite") {
    answer = await rewriteTemplateWithAI({ intent, template, userQuestion: message, confidence });
  } else if (mode === "query_summarize") {
    answer = await summarizeQueryResultWithAI({
      intent,
      template,
      sanitizedQueryResult: sanitizeDataForAI(intent, queryResult || params),
      userQuestion: message,
      confidence,
    });
  } else if (mode === "guided_answer" && !baseAnswer) {
    answer = buildFollowUpQuestion({ missingParams: required, intent });
  }

  const safety = applySafetyPolicy(answer, intent);
  if (!safety.safe) {
    await logAiAnswer({
      intentKey: intent.key,
      confidence,
      safetyStatus: safety.reason,
      aiResponsePreview: answer,
      fallbackUsed: true,
    });
  }

  return {
    status: safety.safe ? "answered" : "blocked",
    answer: safety.answer,
    safetyStatus: safety.reason,
  };
}

module.exports = {
  composePublicQaAnswer,
  renderTemplateAnswer,
  rewriteTemplateWithAI,
  summarizeQueryResultWithAI,
  buildFollowUpQuestion,
  applySafetyPolicy,
  sanitizeDataForAI,
  sanitizePublicQaAnswer,
  maskSensitiveData,
  logAiAnswer,
};
