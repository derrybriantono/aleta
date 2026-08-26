import type { QueryResultRow } from "pg";

import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import type { AIProviderConfig, UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { getAISettingsFromDb, resolveAIConfigForModule } from "@/server/modules/ai/service";
import { requestStructuredDataFromProvider } from "@/server/modules/ai/provider-client";
import { logAiEvent } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { canActorUseJlfPermission, requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { jlfBadRequest, jlfForbidden } from "@/server/modules/judicia/legal-form/jlf-service-errors";
import { getBooleanSetting, getJsonSetting } from "@/server/modules/judicia/legal-form/jlf-settings-service";
import { nextPrefixedId } from "@/server/shared/ids";

type AuditMeta = { ipAddress?: string; userAgent?: string; metadata?: Record<string, unknown> };

type PromptRow = QueryResultRow & {
  id: string;
  key: string;
  name: string;
  description: string;
  prompt_template: string;
  input_schema: unknown;
  output_schema: unknown;
  is_active: boolean | number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type AiLogRow = QueryResultRow & {
  id: string;
  feature: string;
  user_id: string | null;
  nomor_perkara: string;
  input_redacted: unknown;
  output_text: string;
  provider: string;
  model: string;
  token_usage: unknown;
  status: string;
  error_message: string | null;
  created_at: string;
};

type RegulationSourceRow = QueryResultRow & {
  regulation_id: string;
  regulation_title: string;
  verification_status: string;
  status: string;
  regulation_section_id: string | null;
  section_type: string | null;
  section_number: string | null;
  section_title: string | null;
  section_content: string | null;
  summary: string;
  subject: string;
};

const DEFAULT_PROMPTS = [
  {
    key: "jlf.ai.template_assistant",
    name: "AI Template Assistant",
    promptTemplate: "Susun draft template administratif JLF. Gunakan placeholder {{semantic_key}}. Output JSON {\"draft\":\"...\",\"placeholders\":[\"...\"],\"notes\":[\"...\"]}.",
  },
  {
    key: "jlf.ai.variable_mapping",
    name: "AI Variable Mapping Assistant",
    promptTemplate: "Baca placeholder dan sarankan mapping ke registry variabel JLF. Output JSON {\"suggestions\":[{\"placeholder\":\"\",\"variable_key\":\"\",\"confidence\":0,\"reason\":\"\"}],\"notes\":[\"...\"]}.",
  },
  {
    key: "jlf.ai.draft_assistant",
    name: "AI Draft Assistant",
    promptTemplate: "Bantu merapikan narasi administratif. Awali hasil dengan DRAFT. Output JSON {\"draft\":\"DRAFT ...\",\"notes\":[\"...\"]}.",
  },
  {
    key: "jlf.ai.bas_assistant",
    name: "AI BAS Assistant",
    promptTemplate: "Rapikan catatan sidang menjadi struktur BAS administratif. Output JSON {\"draft\":\"DRAFT ...\",\"checklist\":[\"...\"],\"warnings\":[\"...\"]}.",
  },
  {
    key: "jlf.ai.consistency_checker",
    name: "AI Consistency Checker",
    promptTemplate: "Cek konsistensi nomor perkara, tanggal, pihak, majelis, panitera, jurusita, placeholder kosong, dan teks null/undefined. Output JSON {\"issues\":[{\"severity\":\"\",\"field\":\"\",\"message\":\"\"}],\"summary\":\"\"}.",
  },
  {
    key: "jlf.ai.anonymization",
    name: "AI Anonymization Assistant",
    promptTemplate: "Deteksi calon data pribadi seperti nama, alamat, NIK, telepon, email. Jangan mengubah otomatis. Output JSON {\"findings\":[{\"type\":\"\",\"text\":\"\",\"suggestion\":\"\"}],\"notes\":[\"...\"]}.",
  },
  {
    key: "jlf.ai.legal_analysis",
    name: "AI Legal Analysis",
    promptTemplate: "Jawab hanya memakai konteks peraturan JLF yang diberikan. Jika dasar hukum tidak ada, katakan belum tersedia. Bedakan kutipan, ringkasan, dan interpretasi. Output JSON {\"answer\":\"\",\"citations\":[{\"regulation_id\":\"\",\"regulation_section_id\":\"\",\"quote\":\"\",\"reason\":\"\"}],\"limitations\":[\"...\"]}.",
  },
];

function bool(value: boolean | number | null | undefined) {
  return value === true || value === 1;
}

function clean(value: string | undefined | null, max = 12000) {
  return (value ?? "").trim().slice(0, max);
}

function normalizeObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function tokenize(value: string) {
  return value
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function activeProvider(providers: AIProviderConfig[], activeConnectionId?: string | null) {
  return providers.find((provider) => provider.id === activeConnectionId)
    ?? providers.find((provider) => provider.isActive)
    ?? providers[0]
    ?? null;
}

export function redactSensitiveText(value: string) {
  return value
    .replace(/\b\d{16}\b/g, "[REDACTED_NIK]")
    .replace(/\b(?:\+?62|0)8[0-9\s-]{7,16}\b/g, "[REDACTED_PHONE]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .replace(/\b(token|api key|password|secret)\s*[:=]\s*\S+/gi, "$1=[REDACTED_SECRET]");
}

export function detectPromptInjection(value: string) {
  const patterns = [
    /abaikan\s+(instruksi|perintah|aturan)/i,
    /ignore\s+(previous|all|system|developer)\s+instructions/i,
    /system\s+prompt/i,
    /developer\s+message/i,
    /jailbreak/i,
    /bypass\s+(policy|guardrail|safety)/i,
    /ungkapkan\s+(api key|token|secret|password)/i,
  ];
  const matched = patterns.find((pattern) => pattern.test(value));
  return {
    blocked: Boolean(matched),
    reason: matched ? "Input mengandung indikasi prompt injection atau permintaan membuka instruksi/secret." : "",
  };
}

export async function getJlfAiRuntimeSettings(db: AletaDatabase) {
  return {
    enabled: await getBooleanSetting(db, "jlf.ai.enabled", true),
    useGlobalAletaAiSettings: await getBooleanSetting(db, "jlf.ai.use_global_aleta_ai_settings", true),
    redactionEnabled: await getBooleanSetting(db, "jlf.ai.redaction.enabled", true),
    logInputs: await getBooleanSetting(db, "jlf.ai.log_inputs", false),
    logOutputs: await getBooleanSetting(db, "jlf.ai.log_outputs", true),
    maxInputChars: await getJsonSetting<number>(db, "jlf.ai.max_input_chars", 12000),
    legalAnalysisEnabled: await getBooleanSetting(db, "jlf.ai.legal_analysis.enabled", false),
    requireVerifiedRegulations: await getBooleanSetting(db, "jlf.ai.require_verified_regulations", true),
  };
}

export async function ensureDefaultAiPrompts(db: AletaDatabase) {
  const now = new Date().toISOString();
  for (const prompt of DEFAULT_PROMPTS) {
    const id = `jlf-ai-prompt-${prompt.key.replace(/^jlf\.ai\./, "").replace(/[^a-z0-9]+/gi, "-")}`;
    await db.prepare(
      `INSERT INTO jlf_ai_prompts (
        id, key, name, description, prompt_template, input_schema, output_schema,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, '', ?, '{}'::jsonb, '{}'::jsonb, 1, ?, ?)
      ON CONFLICT (key) DO NOTHING`
    ).run(id, prompt.key, prompt.name, prompt.promptTemplate, now, now);
  }
}

function mapPrompt(row: PromptRow) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    promptTemplate: row.prompt_template,
    inputSchema: normalizeObject(row.input_schema),
    outputSchema: normalizeObject(row.output_schema),
    isActive: bool(row.is_active),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAiPrompts(db: AletaDatabase, actor: UserPersona) {
  requireJlfPermission(actor, JLF_PERMISSION.AI_ADMIN);
  await ensureDefaultAiPrompts(db);
  const rows = await db.prepare(
    `SELECT id, key, name, description, prompt_template, input_schema, output_schema,
       is_active, created_by, updated_by, created_at, updated_at
     FROM jlf_ai_prompts
     ORDER BY key ASC`
  ).all<PromptRow>();
  return rows.map(mapPrompt);
}

export async function getPromptByKey(db: AletaDatabase, key: string) {
  await ensureDefaultAiPrompts(db);
  const row = await db.prepare(
    `SELECT id, key, name, description, prompt_template, input_schema, output_schema,
       is_active, created_by, updated_by, created_at, updated_at
     FROM jlf_ai_prompts
     WHERE key = ? AND is_active = 1`
  ).get<PromptRow>(key);
  return row ? mapPrompt(row) : null;
}

export async function updateAiPrompt(
  db: AletaDatabase,
  actor: UserPersona,
  input: { key: string; promptTemplate: string; name?: string; description?: string; isActive?: boolean },
  meta?: AuditMeta
) {
  requireJlfPermission(actor, JLF_PERMISSION.AI_ADMIN);
  await ensureDefaultAiPrompts(db);
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE jlf_ai_prompts
     SET name = COALESCE(?, name),
         description = COALESCE(?, description),
         prompt_template = COALESCE(?, prompt_template),
         is_active = COALESCE(?, is_active),
         updated_by = ?,
         updated_at = ?
     WHERE key = ?`
  ).run(
    input.name ? clean(input.name, 180) : null,
    input.description !== undefined ? clean(input.description, 1000) : null,
    input.promptTemplate ? clean(input.promptTemplate, 12000) : null,
    input.isActive === undefined ? null : input.isActive ? 1 : 0,
    actor.id,
    now,
    input.key
  );
  await logAiEvent(db, {
    userId: actor.id,
    action: "ai.prompt.update",
    entityId: input.key,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
  return getPromptByKey(db, input.key);
}

export async function createAiLog(
  db: AletaDatabase,
  input: {
    feature: string;
    userId?: string | null;
    nomorPerkara?: string;
    inputRedacted?: unknown;
    outputText?: string;
    provider?: string;
    model?: string;
    tokenUsage?: unknown;
    status: string;
    errorMessage?: string | null;
  }
) {
  const id = await nextPrefixedId(db, "jlf_ai_logs", "jlf-ai-log");
  await db.prepare(
    `INSERT INTO jlf_ai_logs (
      id, feature, user_id, nomor_perkara, input_redacted, output_text,
      provider, model, token_usage, status, error_message, created_at
    ) VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?::jsonb, ?, ?, ?)`
  ).run(
    id,
    input.feature,
    input.userId ?? null,
    input.nomorPerkara ?? "",
    JSON.stringify(input.inputRedacted ?? {}),
    clean(input.outputText, 12000),
    clean(input.provider, 120),
    clean(input.model, 120),
    JSON.stringify(input.tokenUsage ?? {}),
    input.status,
    input.errorMessage ?? null,
    new Date().toISOString()
  );
  return { id };
}

export async function listAiLogs(db: AletaDatabase, actor: UserPersona, filters: { feature?: string; limit?: number } = {}) {
  requireJlfPermission(actor, JLF_PERMISSION.AI_AUDIT_VIEW);
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (filters.feature) {
    where.push("feature = ?");
    params.push(filters.feature);
  }
  params.push(Math.max(1, Math.min(200, filters.limit ?? 50)));
  const rows = await db.prepare(
    `SELECT id, feature, user_id, nomor_perkara, input_redacted, output_text, provider,
       model, token_usage, status, error_message, created_at
     FROM jlf_ai_logs
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY created_at DESC
     LIMIT ?`
  ).all<AiLogRow>(...params);
  return rows.map((row) => ({
    id: row.id,
    feature: row.feature,
    userId: row.user_id,
    nomorPerkara: row.nomor_perkara,
    inputRedacted: row.input_redacted ?? {},
    outputText: row.output_text,
    provider: row.provider,
    model: row.model,
    tokenUsage: row.token_usage ?? {},
    status: row.status,
    errorMessage: row.error_message,
    createdAt: row.created_at,
  }));
}

export async function requestJlfAiJson<T>(
  db: AletaDatabase,
  input: {
    feature: string;
    systemPrompt: string;
    userPrompt: string;
    fallback: T;
  }
) {
  const runtimeSettings = await getJlfAiRuntimeSettings(db);
  if (!runtimeSettings.enabled) jlfBadRequest("AI JLF sedang nonaktif.");
  if (!runtimeSettings.useGlobalAletaAiSettings) jlfBadRequest("JLF harus memakai konfigurasi AI ALETA.");

  const settings = resolveAIConfigForModule(
    await getAISettingsFromDb(db, { includeSecrets: true }),
    "jlf"
  );
  if (!settings.enabled) jlfBadRequest("AI ALETA untuk JLF sedang nonaktif.");
  const provider = activeProvider(settings.providers, settings.activeConnectionId);
  if (!provider) jlfBadRequest("Provider AI global ALETA belum tersedia.");
  if (!provider.apiKey?.trim() && provider.providerId !== "llama") jlfBadRequest("Provider AI global belum siap digunakan.");

  const result = await requestStructuredDataFromProvider<T>({
    providerId: provider.providerId ?? provider.id,
    endpointUrl: provider.endpointUrl,
    apiKey: provider.apiKey ?? "",
    modelId: provider.modelId ?? settings.modelId,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    fallback: input.fallback,
  });

  return {
    ...result,
    provider: provider.providerId ?? provider.id,
    model: result.providerModelId || provider.modelId || settings.modelId,
  };
}

async function guardAiInput(db: AletaDatabase, actor: UserPersona, feature: string, text: string, requireLegal = false) {
  requireJlfPermission(actor, requireLegal ? JLF_PERMISSION.AI_LEGAL_ANALYSIS : JLF_PERMISSION.AI_USE);
  const settings = await getJlfAiRuntimeSettings(db);
  const inputText = clean(text, Math.max(1000, settings.maxInputChars));
  if (text.length > settings.maxInputChars) jlfBadRequest(`Input AI maksimal ${settings.maxInputChars} karakter.`);
  const injection = detectPromptInjection(inputText);
  if (injection.blocked) {
    await createAiLog(db, {
      feature,
      userId: actor.id,
      inputRedacted: { blocked: true, reason: injection.reason },
      status: "blocked",
      errorMessage: injection.reason,
    });
    jlfBadRequest(injection.reason);
  }
  return {
    settings,
    inputText,
    redactedInput: settings.redactionEnabled ? redactSensitiveText(inputText) : inputText,
  };
}

async function runAdministrativeAssistant(
  db: AletaDatabase,
  actor: UserPersona,
  input: { feature: string; promptKey: string; inputText: string; extraContext?: Record<string, unknown>; fallback: Record<string, unknown> },
  meta?: AuditMeta
) {
  const guarded = await guardAiInput(db, actor, input.feature, input.inputText);
  const prompt = await getPromptByKey(db, input.promptKey);
  const systemPrompt = [
    "Anda adalah asisten administratif JLF. Output adalah draft/bahan bantu, bukan keputusan hukum.",
    "Jangan mengambil keputusan hukum, jangan menggantikan hakim/panitera/pejabat berwenang.",
    "Jangan tampilkan secret, API key, token, atau data pribadi berlebihan.",
    prompt?.promptTemplate ?? "",
  ].join("\n");
  const aiResult = await requestJlfAiJson<Record<string, unknown>>(db, {
    feature: input.feature,
    systemPrompt,
    userPrompt: JSON.stringify({ input: guarded.redactedInput, context: input.extraContext ?? {} }),
    fallback: input.fallback,
  });
  const outputText = JSON.stringify(aiResult.data);
  await createAiLog(db, {
    feature: input.feature,
    userId: actor.id,
    inputRedacted: guarded.settings.logInputs ? { input: guarded.redactedInput, context: input.extraContext ?? {} } : { redacted: true },
    outputText: guarded.settings.logOutputs ? outputText : "",
    provider: aiResult.provider,
    model: aiResult.model,
    status: aiResult.ok ? "success" : "error",
    errorMessage: aiResult.message ?? null,
  });
  await logAiEvent(db, {
    userId: actor.id,
    action: "ai.use",
    entityId: input.feature,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    metadata: { ok: aiResult.ok, model: aiResult.model },
  });
  return {
    feature: input.feature,
    ok: aiResult.ok,
    provider: aiResult.provider,
    model: aiResult.model,
    result: aiResult.data,
    message: aiResult.message ?? "",
    disclaimer: "Output AI adalah DRAFT/bahan bantu dan wajib divalidasi manusia.",
  };
}

export function runTemplateAssistant(db: AletaDatabase, actor: UserPersona, input: { inputText: string; context?: Record<string, unknown> }, meta?: AuditMeta) {
  return runAdministrativeAssistant(db, actor, {
    feature: "template_assistant",
    promptKey: "jlf.ai.template_assistant",
    inputText: input.inputText,
    extraContext: input.context,
    fallback: { draft: "", placeholders: [], notes: ["AI tidak menghasilkan draft."] },
  }, meta);
}

export function runVariableMappingAssistant(db: AletaDatabase, actor: UserPersona, input: { inputText: string; context?: Record<string, unknown> }, meta?: AuditMeta) {
  return runAdministrativeAssistant(db, actor, {
    feature: "variable_mapping",
    promptKey: "jlf.ai.variable_mapping",
    inputText: input.inputText,
    extraContext: input.context,
    fallback: { suggestions: [], notes: ["Mapping perlu review manual."] },
  }, meta);
}

export function runDraftAssistant(db: AletaDatabase, actor: UserPersona, input: { inputText: string; context?: Record<string, unknown> }, meta?: AuditMeta) {
  return runAdministrativeAssistant(db, actor, {
    feature: "draft_assistant",
    promptKey: "jlf.ai.draft_assistant",
    inputText: input.inputText,
    extraContext: input.context,
    fallback: { draft: "DRAFT belum tersedia.", notes: ["Periksa manual."] },
  }, meta);
}

export function runBasAssistant(db: AletaDatabase, actor: UserPersona, input: { inputText: string; context?: Record<string, unknown> }, meta?: AuditMeta) {
  return runAdministrativeAssistant(db, actor, {
    feature: "bas_assistant",
    promptKey: "jlf.ai.bas_assistant",
    inputText: input.inputText,
    extraContext: input.context,
    fallback: { draft: "DRAFT BAS belum tersedia.", checklist: [], warnings: ["Periksa manual."] },
  }, meta);
}

export function runConsistencyChecker(db: AletaDatabase, actor: UserPersona, input: { inputText: string; context?: Record<string, unknown> }, meta?: AuditMeta) {
  return runAdministrativeAssistant(db, actor, {
    feature: "consistency_checker",
    promptKey: "jlf.ai.consistency_checker",
    inputText: input.inputText,
    extraContext: input.context,
    fallback: { issues: [], summary: "Pemeriksaan AI belum tersedia." },
  }, meta);
}

export function runAnonymizationAssistant(db: AletaDatabase, actor: UserPersona, input: { inputText: string; context?: Record<string, unknown> }, meta?: AuditMeta) {
  return runAdministrativeAssistant(db, actor, {
    feature: "anonymization_assistant",
    promptKey: "jlf.ai.anonymization",
    inputText: input.inputText,
    extraContext: input.context,
    fallback: { findings: [], notes: ["User tetap memilih data yang dianonimkan."] },
  }, meta);
}

function mapSource(row: RegulationSourceRow, score: number) {
  const sectionLabel = [row.section_type, row.section_number, row.section_title].filter(Boolean).join(" ");
  return {
    regulationId: row.regulation_id,
    regulationTitle: row.regulation_title,
    verificationStatus: row.verification_status,
    status: row.status,
    regulationSectionId: row.regulation_section_id,
    sectionLabel,
    quotedText: clean(row.section_content || row.summary, 1800),
    relevanceScore: score,
  };
}

export async function searchRelevantRegulationSources(
  db: AletaDatabase,
  input: { query: string; verifiedOnly?: boolean; regulationId?: string; topicId?: string; limit?: number }
) {
  const where = ["r.deleted_at IS NULL"];
  const params: string[] = [];
  if (input.verifiedOnly) where.push("r.verification_status = 'verified'");
  if (input.regulationId) {
    where.push("r.id = ?");
    params.push(input.regulationId);
  }
  if (input.topicId) {
    where.push("EXISTS (SELECT 1 FROM jlf_regulation_topic_links tl WHERE tl.regulation_id = r.id AND tl.topic_id = ?)");
    params.push(input.topicId);
  }
  const rows = await db.prepare(
    `SELECT r.id AS regulation_id, r.title AS regulation_title, r.verification_status, r.status,
       s.id AS regulation_section_id, s.section_type, s.section_number, s.title AS section_title,
       s.content AS section_content, r.summary, r.subject
     FROM jlf_regulations r
     LEFT JOIN jlf_regulation_sections s ON s.regulation_id = r.id
     WHERE ${where.join(" AND ")}
     ORDER BY r.updated_at DESC, s.sort_order ASC
     LIMIT 300`
  ).all<RegulationSourceRow>(...params);
  const tokens = tokenize(input.query);
  return rows
    .map((row) => {
      const haystack = [row.regulation_title, row.summary, row.subject, row.section_title ?? "", row.section_content ?? ""].join(" ").toLocaleLowerCase("id-ID");
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return { row, score };
    })
    .filter((item) => item.score > 0 || input.regulationId)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.max(1, Math.min(12, input.limit ?? 6)))
    .map((item) => mapSource(item.row, item.score));
}

async function createAnalysisSession(
  db: AletaDatabase,
  input: {
    userId: string;
    nomorPerkara?: string | null;
    generatedDocumentId?: string | null;
    analysisType: string;
    inputSummary: string;
    outputSummary: string;
    status: string;
    aiUsed: boolean;
    model?: string;
  }
) {
  const id = await nextPrefixedId(db, "jlf_legal_analysis_sessions", "jlf-analysis");
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO jlf_legal_analysis_sessions (
      id, user_id, nomor_perkara, generated_document_id, analysis_type, input_summary,
      output_summary, status, ai_used, model, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.userId,
    input.nomorPerkara ?? null,
    input.generatedDocumentId ?? null,
    input.analysisType,
    input.inputSummary,
    input.outputSummary,
    input.status,
    input.aiUsed ? 1 : 0,
    input.model ?? "",
    now,
    now
  );
  return id;
}

async function storeAnalysisSources(
  db: AletaDatabase,
  analysisSessionId: string,
  sources: Array<{ regulationId: string; regulationSectionId: string | null; quotedText: string; relevanceScore: number; aiReason?: string }>
) {
  for (const source of sources) {
    const id = await nextPrefixedId(db, "jlf_legal_analysis_sources", "jlf-analysis-src");
    await db.prepare(
      `INSERT INTO jlf_legal_analysis_sources (
        id, analysis_session_id, regulation_id, regulation_section_id, quoted_text,
        relevance_score, ai_reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      analysisSessionId,
      source.regulationId,
      source.regulationSectionId,
      clean(source.quotedText, 1800),
      source.relevanceScore,
      clean(source.aiReason, 600),
      new Date().toISOString()
    );
  }
}

export async function runLegalAnalysis(
  db: AletaDatabase,
  actor: UserPersona,
  input: {
    analysisType: string;
    query: string;
    nomorPerkara?: string | null;
    generatedDocumentId?: string | null;
    regulationId?: string;
    topicId?: string;
  },
  meta?: AuditMeta
) {
  const guarded = await guardAiInput(db, actor, "legal_analysis", input.query, true);
  if (!guarded.settings.legalAnalysisEnabled) jlfBadRequest("AI legal analysis JLF sedang nonaktif.");
  const sources = await searchRelevantRegulationSources(db, {
    query: guarded.redactedInput,
    verifiedOnly: guarded.settings.requireVerifiedRegulations,
    regulationId: input.regulationId,
    topicId: input.topicId,
    limit: 8,
  });

  if (sources.length === 0) {
    const outputSummary = guarded.settings.requireVerifiedRegulations
      ? "Dasar hukum belum tersedia dalam database peraturan JLF yang sudah terverifikasi."
      : "Dasar hukum belum tersedia dalam database peraturan JLF.";
    const sessionId = await createAnalysisSession(db, {
      userId: actor.id,
      nomorPerkara: input.nomorPerkara,
      generatedDocumentId: input.generatedDocumentId,
      analysisType: clean(input.analysisType, 80) || "regulation_lookup",
      inputSummary: guarded.redactedInput.slice(0, 1000),
      outputSummary,
      status: "no_source",
      aiUsed: false,
    });
    await createAiLog(db, {
      feature: "legal_analysis",
      userId: actor.id,
      nomorPerkara: input.nomorPerkara ?? "",
      inputRedacted: { query: guarded.redactedInput, verifiedOnly: guarded.settings.requireVerifiedRegulations },
      outputText: outputSummary,
      status: "no_source",
    });
    return { sessionId, status: "no_source", output: outputSummary, sources: [], aiUsed: false };
  }

  const prompt = await getPromptByKey(db, "jlf.ai.legal_analysis");
  const sourceContext = sources.map((source, index) => ({
    index: index + 1,
    regulation_id: source.regulationId,
    regulation_section_id: source.regulationSectionId,
    title: source.regulationTitle,
    quote: source.quotedText,
  }));
  const aiResult = await requestJlfAiJson<{ answer: string; citations: Array<{ regulation_id: string; regulation_section_id?: string | null; quote?: string; reason?: string }>; limitations: string[] }>(db, {
    feature: "legal_analysis",
    systemPrompt: [
      "Anda adalah asisten legal JLF. Jawaban adalah bahan bantu dan wajib divalidasi manusia.",
      "Gunakan hanya sumber peraturan JLF yang diberikan. Jangan mengarang dasar hukum atau pasal.",
      "Jika sumber tidak cukup, nyatakan keterbatasannya. Jangan memutus perkara.",
      prompt?.promptTemplate ?? "",
    ].join("\n"),
    userPrompt: JSON.stringify({
      question: guarded.redactedInput,
      verified_only: guarded.settings.requireVerifiedRegulations,
      sources: sourceContext,
    }),
    fallback: {
      answer: "AI belum dapat menyusun analisa. Gunakan daftar sumber terlampir untuk review manual.",
      citations: [],
      limitations: ["Respons AI tidak tersedia."],
    },
  });
  const outputSummary = aiResult.data.answer || "Analisa AI tidak tersedia.";
  const sessionId = await createAnalysisSession(db, {
    userId: actor.id,
    nomorPerkara: input.nomorPerkara,
    generatedDocumentId: input.generatedDocumentId,
    analysisType: clean(input.analysisType, 80) || "regulation_lookup",
    inputSummary: guarded.redactedInput.slice(0, 1000),
    outputSummary,
    status: aiResult.ok ? "completed" : "ai_failed",
    aiUsed: true,
    model: aiResult.model,
  });
  await storeAnalysisSources(db, sessionId, sources.map((source) => ({
    regulationId: source.regulationId,
    regulationSectionId: source.regulationSectionId,
    quotedText: source.quotedText,
    relevanceScore: source.relevanceScore,
  })));
  await createAiLog(db, {
    feature: "legal_analysis",
    userId: actor.id,
    nomorPerkara: input.nomorPerkara ?? "",
    inputRedacted: guarded.settings.logInputs ? { query: guarded.redactedInput, sources: sourceContext } : { redacted: true, sourceCount: sources.length },
    outputText: guarded.settings.logOutputs ? JSON.stringify(aiResult.data) : "",
    provider: aiResult.provider,
    model: aiResult.model,
    status: aiResult.ok ? "success" : "error",
    errorMessage: aiResult.message ?? null,
  });
  await logAiEvent(db, {
    userId: actor.id,
    action: "ai.legal_analysis",
    entityId: sessionId,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    metadata: { sourceCount: sources.length, verifiedOnly: guarded.settings.requireVerifiedRegulations },
  });
  return {
    sessionId,
    status: aiResult.ok ? "completed" : "ai_failed",
    output: outputSummary,
    result: aiResult.data,
    sources,
    aiUsed: true,
    model: aiResult.model,
    disclaimer: "Output AI adalah bahan bantu analisa dan tidak menggantikan pejabat berwenang.",
  };
}

export function assertCanViewAi(actor: UserPersona) {
  if (!canActorUseJlfPermission(actor, JLF_PERMISSION.AI_USE) && !canActorUseJlfPermission(actor, JLF_PERMISSION.AI_ADMIN)) {
    jlfForbidden();
  }
}

export const JlfAiRedactionService = { redactSensitiveText };
export const JlfPromptInjectionGuard = { detectPromptInjection };
export const JlfAiGuardrailService = { getJlfAiRuntimeSettings, detectPromptInjection, redactSensitiveText };
export const JlfAiProviderAdapter = { requestJlfAiJson };
export const JlfAiPromptService = { ensureDefaultAiPrompts, listAiPrompts, getPromptByKey, updateAiPrompt };
export const JlfAiLogService = { createAiLog, listAiLogs };
export const JlfAiTemplateAssistantService = { runTemplateAssistant };
export const JlfAiVariableMappingAssistantService = { runVariableMappingAssistant };
export const JlfAiDraftAssistantService = { runDraftAssistant };
export const JlfAiBasAssistantService = { runBasAssistant };
export const JlfAiConsistencyCheckerService = { runConsistencyChecker };
export const JlfAiAnonymizationAssistantService = { runAnonymizationAssistant };
export const JlfRegulationRetrievalService = { searchRelevantRegulationSources };
export const JlfLegalAnalysisService = { runLegalAnalysis };
export const JlfLegalSourceCitationService = { storeAnalysisSources };
export const JlfTemplateComplianceService = { runLegalAnalysis };
export const JlfRegulationImpactService = { runLegalAnalysis };
