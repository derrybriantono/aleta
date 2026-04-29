const axios = require("axios").default;
const crypto = require("crypto");

const aiRuntimeConfigService = require("./aiRuntimeConfigService");
const botDb = require("./botDbService");
const logService = require("./logService");

function createId(prefix) {
  const random = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(12).toString("hex");
  return `${prefix}_${random}`;
}

function normalizeModel(provider, model) {
  const value = String(model || "").trim().toLowerCase().replace(/\s+/g, "-");
  if (!value) return provider === "openai" ? "gpt-4o-mini" : "gemini-1.5-flash";
  if (provider === "openai" && value.includes("gpt-3.5")) return "gpt-4o-mini";
  if (provider === "gemini" && value === "gemini-pro") return "gemini-1.5-flash";
  return value;
}

function defaultEndpoint(provider) {
  if (provider === "openai") return "https://api.openai.com/v1/chat/completions";
  if (provider === "gemini") return "https://generativelanguage.googleapis.com/v1beta/models";
  if (provider === "claude") return "https://api.anthropic.com/v1/messages";
  return "http://127.0.0.1:11434/api/chat";
}

function maskSensitiveData(text) {
  return String(text || "")
    .replace(/sk-[a-zA-Z0-9_-]+/g, "sk-***")
    .replace(/AIza[0-9A-Za-z_-]+/g, "AIza***")
    .replace(/\b62\d{7,14}\b/g, (match) => `${match.slice(0, 4)}******${match.slice(-2)}`)
    .replace(/\b0\d{8,13}\b/g, (match) => `${match.slice(0, 3)}******${match.slice(-2)}`)
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*['"]?[^'"\s]+/gi, "$1=[redacted]");
}

function sanitizeAiError(error) {
  return aiRuntimeConfigService.sanitizeAiError(error);
}

function extractContentText(parts) {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      return String(part.text || "");
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeMessages({ messages, systemPrompt, userPrompt }) {
  if (Array.isArray(messages) && messages.length > 0) return messages;
  return [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: userPrompt || "" },
  ];
}

function extractJsonBlock(text) {
  const value = String(text || "").trim();
  if (value.startsWith("{") && value.endsWith("}")) return value;
  const match = value.match(/\{[\s\S]*\}/);
  return match?.[0] || "";
}

async function logAiUsage(data = {}) {
  try {
    const ready = await botDb.ensureSchema();
    if (!ready) {
      logService.logSystemEvent({
        eventType: "ai_usage_log_skipped",
        severity: "warning",
        message: "Log AI usage dilewati karena DB ALETA Bot belum siap.",
        metadata: { intentKey: data.intentKey || data.intent_key || "" },
      });
      return null;
    }
    const now = new Date();
    await botDb.query(
      `INSERT INTO aleta_bot_public_qa_ai_logs (
        id, qa_log_id, intent_key, ai_provider, ai_model, prompt_preview,
        input_tokens, output_tokens, confidence, safety_status,
        ai_response_preview, fallback_used, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id || createId("qaal"),
        data.qaLogId || data.qa_log_id || "",
        data.intentKey || data.intent_key || "",
        data.aiProvider || data.ai_provider || "",
        data.aiModel || data.ai_model || "",
        maskSensitiveData(data.promptPreview || data.prompt_preview || "").slice(0, 1000),
        Number(data.inputTokens || data.input_tokens || 0),
        Number(data.outputTokens || data.output_tokens || 0),
        Number(data.confidence || 0),
        data.safetyStatus || data.safety_status || "success",
        maskSensitiveData(data.aiResponsePreview || data.ai_response_preview || "").slice(0, 500),
        data.fallbackUsed ? 1 : 0,
        maskSensitiveData(data.errorMessage || data.error_message || "").slice(0, 500),
        botDb.toMysqlDate(now),
      ]
    );
  } catch (error) {
    logService.logSystemEvent({
      eventType: "ai_usage_log_failed",
      severity: "warning",
      message: "Log AI Public Q&A gagal disimpan.",
      metadata: { errorMessage: sanitizeAiError(error), intentKey: data.intentKey || "" },
    });
  }
  return null;
}

async function requestOpenAi({ config, messages, temperature, maxTokens, responseFormat }) {
  const endpoint = config.endpointUrl || defaultEndpoint("openai");
  const response = await axios.post(
    endpoint,
    {
      model: normalizeModel("openai", config.model),
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(responseFormat ? { response_format: responseFormat } : {}),
    },
    {
      timeout: config.timeoutMs,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
    }
  );
  return {
    text: response.data?.choices?.[0]?.message?.content || "",
    model: response.data?.model || normalizeModel("openai", config.model),
    usage: response.data?.usage || {},
  };
}

async function requestGemini({ config, messages, temperature, maxTokens }) {
  const model = normalizeModel("gemini", config.model);
  const endpoint = (config.endpointUrl || defaultEndpoint("gemini")).replace(/\/+$/, "");
  const system = messages.find((item) => item.role === "system")?.content || "";
  const user = messages
    .filter((item) => item.role !== "system")
    .map((item) => item.content)
    .join("\n\n")
    .trim();
  const response = await axios.post(
    `${endpoint}/${model}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
    {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    },
    {
      timeout: config.timeoutMs,
      headers: { "content-type": "application/json" },
    }
  );
  return {
    text: extractContentText(response.data?.candidates?.[0]?.content?.parts || []),
    model,
    usage: {
      prompt_tokens: response.data?.usageMetadata?.promptTokenCount || 0,
      completion_tokens: response.data?.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}

async function requestClaude({ config, messages, temperature, maxTokens }) {
  const model = normalizeModel("claude", config.model);
  const endpoint = config.endpointUrl || defaultEndpoint("claude");
  const system = messages.find((item) => item.role === "system")?.content || "";
  const userMessages = messages
    .filter((item) => item.role !== "system")
    .map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: item.content }));
  const response = await axios.post(
    endpoint,
    {
      model,
      system,
      messages: userMessages.length ? userMessages : [{ role: "user", content: "OK" }],
      temperature,
      max_tokens: maxTokens,
    },
    {
      timeout: config.timeoutMs,
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
    }
  );
  return {
    text: extractContentText(response.data?.content || []),
    model,
    usage: {
      prompt_tokens: response.data?.usage?.input_tokens || 0,
      completion_tokens: response.data?.usage?.output_tokens || 0,
    },
  };
}

async function requestLlama({ config, messages, temperature }) {
  const model = normalizeModel("llama", config.model);
  const response = await axios.post(
    config.endpointUrl || defaultEndpoint("llama"),
    {
      model,
      messages,
      stream: false,
      options: { temperature },
    },
    {
      timeout: config.timeoutMs,
      headers: {
        "content-type": "application/json",
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
    }
  );
  return {
    text: response.data?.message?.content || "",
    model,
    usage: {},
  };
}

async function completeChat({
  messages,
  systemPrompt,
  userPrompt,
  provider,
  model,
  temperature,
  maxTokens,
  metadata = {},
  responseFormat,
} = {}) {
  const config = await aiRuntimeConfigService.getProviderClientConfig(provider);
  const resolvedProvider = aiRuntimeConfigService.normalizeProvider(provider || config.provider);
  const resolvedConfig = {
    ...config,
    provider: resolvedProvider,
    model: model || config.model,
    temperature: Number(temperature ?? config.temperature ?? 0.2),
    maxTokens: Number(maxTokens ?? config.maxTokens ?? 400),
    timeoutMs: Number(config.timeoutMs || 8000),
  };

  if (!resolvedConfig.enabled || !resolvedConfig.publicQaEnabled) {
    throw new Error("AI runtime ALETA Bot sedang nonaktif.");
  }
  if (!resolvedConfig.apiKeyConfigured && resolvedProvider !== "llama") {
    throw new Error("API key AI runtime ALETA Bot belum tersedia.");
  }

  const normalizedMessages = normalizeMessages({ messages, systemPrompt, userPrompt });
  const startedAt = Date.now();
  let result;
  try {
    if (resolvedProvider === "openai") {
      result = await requestOpenAi({
        config: resolvedConfig,
        messages: normalizedMessages,
        temperature: resolvedConfig.temperature,
        maxTokens: resolvedConfig.maxTokens,
        responseFormat,
      });
    } else if (resolvedProvider === "gemini") {
      result = await requestGemini({
        config: resolvedConfig,
        messages: normalizedMessages,
        temperature: resolvedConfig.temperature,
        maxTokens: resolvedConfig.maxTokens,
      });
    } else if (resolvedProvider === "claude") {
      result = await requestClaude({
        config: resolvedConfig,
        messages: normalizedMessages,
        temperature: resolvedConfig.temperature,
        maxTokens: resolvedConfig.maxTokens,
      });
    } else if (resolvedProvider === "llama") {
      result = await requestLlama({
        config: resolvedConfig,
        messages: normalizedMessages,
        temperature: resolvedConfig.temperature,
      });
    } else {
      throw new Error(`Provider AI '${resolvedProvider}' belum didukung.`);
    }

    await logAiUsage({
      intentKey: metadata.intentKey || "",
      aiProvider: resolvedProvider,
      aiModel: result.model || resolvedConfig.model,
      promptPreview: normalizedMessages.map((item) => `${item.role}: ${item.content}`).join("\n"),
      inputTokens: result.usage?.prompt_tokens || result.usage?.input_tokens || 0,
      outputTokens: result.usage?.completion_tokens || result.usage?.output_tokens || 0,
      confidence: metadata.confidence || 0,
      safetyStatus: metadata.mode || "success",
      aiResponsePreview: result.text,
      fallbackUsed: false,
      errorMessage: "",
    });

    return {
      ok: true,
      text: result.text,
      provider: resolvedProvider,
      model: result.model || resolvedConfig.model,
      usage: result.usage || {},
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = sanitizeAiError(error);
    await logAiUsage({
      intentKey: metadata.intentKey || "",
      aiProvider: resolvedProvider,
      aiModel: resolvedConfig.model,
      promptPreview: normalizedMessages.map((item) => `${item.role}: ${item.content}`).join("\n"),
      confidence: metadata.confidence || 0,
      safetyStatus: "error",
      aiResponsePreview: "",
      fallbackUsed: true,
      errorMessage: message,
    });
    throw new Error(message);
  }
}

async function completeJson({ messages, schemaHint, metadata = {}, ...rest } = {}) {
  const promptMessages = Array.isArray(messages) ? [...messages] : [];
  if (schemaHint) {
    promptMessages.push({
      role: "user",
      content: `Kembalikan hanya JSON valid. Skema/ketentuan: ${schemaHint}`,
    });
  }
  const result = await completeChat({
    ...rest,
    messages: promptMessages,
    metadata,
    responseFormat: { type: "json_object" },
  });
  const jsonBlock = extractJsonBlock(result.text);
  if (!jsonBlock) {
    throw new Error("Respons AI tidak berisi JSON valid.");
  }
  return {
    ...result,
    json: JSON.parse(jsonBlock),
  };
}

async function testProviderConnection(configOverride = {}) {
  const config = configOverride.provider
    ? {
        ...(await aiRuntimeConfigService.getProviderClientConfig(configOverride.provider)),
        ...configOverride,
      }
    : await aiRuntimeConfigService.getProviderClientConfig();
  const provider = aiRuntimeConfigService.normalizeProvider(config.provider);

  try {
    const result = await completeChat({
      provider,
      model: config.model,
      temperature: 0,
      maxTokens: 20,
      messages: [
        { role: "system", content: "Jawab singkat tanpa markdown." },
        { role: "user", content: "Balas dengan kata OK saja." },
      ],
      metadata: { mode: "connection_test", intentKey: "runtime_test" },
    });
    const testResult = {
      ok: Boolean(result.text),
      status: result.text ? "success" : "failed",
      provider,
      model: result.model,
      message: result.text || "Provider merespons tanpa isi jawaban.",
      durationMs: result.durationMs,
    };
    await aiRuntimeConfigService.updateAiRuntimeTestResult(testResult);
    return testResult;
  } catch (error) {
    const testResult = {
      ok: false,
      status: "failed",
      provider,
      model: config.model,
      errorMessage: sanitizeAiError(error),
    };
    await aiRuntimeConfigService.updateAiRuntimeTestResult(testResult).catch(() => null);
    return testResult;
  }
}

module.exports = {
  completeChat,
  completeJson,
  testProviderConnection,
  sanitizeAiError,
  logAiUsage,
  maskSensitiveData,
};
