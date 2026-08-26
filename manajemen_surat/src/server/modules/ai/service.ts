import { and, desc, eq, isNull } from "drizzle-orm";
import { type QueryResultRow } from "pg";

import { generateMailIntelligenceInsight } from "@/server/modules/ai/mail-intelligence";
import { generateDispositionSuggestionInsight } from "@/server/modules/ai/disposition-intelligence";
import { getAIProviderById, popularAIProviderCatalog } from "@/lib/ai-catalog";
import {
  applyLegacyAIFeatureToggles,
  defaultAIFeatureFlags,
  mergeAIFeatureFlags,
  normalizeAIFeatureFlags,
  type PartialAIFeatureFlags,
} from "@/lib/ai-feature-flags";
import { buildDerivedCourtIdentity, getCourtDirectoryEntryByName, searchCourtDirectory } from "@/lib/court-catalog";
import { letterClassificationCatalog, normalizeLetterClassificationDraft } from "@/lib/letter-taxonomy";
import { canManageGlobalAI } from "@/lib/permissions";
import {
  type AIGlobalConfig,
  type AIModuleConfig,
  type AIModuleKey,
  type AIProviderConfig,
  type LetterType,
} from "@/lib/types";
import {
  generateLetterDraftFromPdf,
  normalizeLetterDraftCoreSummary,
  type GeneratedLetterDraft,
} from "@/modules/manajemen-surat/services/letter-draft-ai";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { aiGlobalSettings, aiModuleSettings, aiProviders } from "@/server/db/drizzle-schema";
import {
  isProviderLiveSupported,
  requestStructuredDataFromProvider,
  testProviderConnection,
} from "@/server/modules/ai/provider-client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { getLetterByIdFromDb } from "@/server/modules/letters/service";
import { getDispositionsByLetterIdFromDb } from "@/server/modules/dispositions/service";
import { nextPrefixedId } from "@/server/shared/ids";
import { parseJsonArray, stringifyJson, toBooleanInt } from "@/server/shared/json";
import { isLikelyConnectedApiKey, maskApiKey } from "@/server/shared/security";
import { searchRegulationsInDb } from "@/server/modules/ai/knowledge-base";
import {
  getLeadershipRecipientsFromDb,
  getUsersFromDb,
  requireActorUser,
} from "@/server/modules/organization/service";

type AISettingsRow = QueryResultRow & {
  enabled: number;
  active_provider_id: string;
  active_model_id: string;
  active_connection_id: string | null;
  primary_language: "id" | "en";
  feature_disposition_ai: number;
  feature_mail_intelligence: number;
  feature_draft_metadata: number;
  feature_manajemen_surat_ai: number;
  feature_disposisi_ai: number;
  feature_flags_json: string | null;
};

type AIProviderRow = QueryResultRow & {
  id: string;
  name: string;
  provider_id: string | null;
  endpoint_url: string | null;
  api_key: string;
  masked_api_key: string | null;
  models_json: string;
  model_id: string | null;
  builtin: number;
  connection_status: string;
  is_active: number;
  last_tested_at: string | null;
  last_connection_message: string | null;
};

type AIModuleSettingsRow = QueryResultRow & {
  module_key: string;
  enabled: number;
  inherit_global: number;
  active_provider_id: string | null;
  active_model_id: string | null;
  active_connection_id: string | null;
  fallback_provider_id: string | null;
  fallback_model_id: string | null;
  fallback_connection_id: string | null;
  updated_at: string | null;
};

type AISettingsQueryOptions = {
  includeSecrets?: boolean;
};

type AIModuleConfigInput = {
  moduleKey: string;
  enabled?: boolean;
  inheritGlobal?: boolean;
  activeConnectionId?: string | null;
};

type AISavedConnectionInput = {
  id?: string;
  providerId: string;
  label?: string;
  modelId: string;
  apiKey?: string;
  endpointUrl?: string;
  builtin?: boolean;
  connectionStatus?: AIProviderConfig["connectionStatus"];
  lastTestedAt?: string;
  lastConnectionMessage?: string;
};

const AI_MODULE_CATALOG: Array<{
  key: AIModuleKey;
  label: string;
  description: string;
}> = [
  {
    key: "manajemen_surat",
    label: "Manajemen Surat",
    description: "AI untuk surat, disposisi, metadata PDF, dan intelligence surat.",
  },
  {
    key: "jlf",
    label: "JLF",
    description: "AI untuk Judicia Legal Form, template, mapping, dan analisis legal terbatas.",
  },
  {
    key: "aleta_bot",
    label: "ALETA Bot / WhatsApp AI",
    description: "AI untuk classifier, jawaban WhatsApp, dan notifikasi cerdas ALETA Bot.",
  },
];

function normalizeAIModuleKey(value: string | null | undefined): AIModuleKey | null {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "manajemen_surat" || normalized === "surat" || normalized === "mail") return "manajemen_surat";
  if (normalized === "jlf" || normalized === "judicia" || normalized === "legal_form") return "jlf";
  if (normalized === "aleta_bot" || normalized === "bot" || normalized === "whatsapp" || normalized === "public_qa") {
    return "aleta_bot";
  }
  return null;
}

function getProviderEndpoint(providerId: string) {
  return (
    (getAIProviderById(providerId)?.id === "llama"
      ? "http://127.0.0.1:11434/api/chat"
      : {
          chatgpt: "https://api.openai.com/v1/chat/completions",
          gemini: "https://generativelanguage.googleapis.com/v1beta/models",
          claude: "https://api.anthropic.com/v1/messages",
        }[providerId]) ?? ""
  );
}

function normalizeConnectionStatus(status: string | undefined): AIProviderConfig["connectionStatus"] {
  if (status === "connected" || status === "failed") {
    return status;
  }

  return "idle";
}

function buildProviderModelList(providerId: string, row: AIProviderRow, modelId: string) {
  return mergeStringList(
    modelId ? [modelId] : [],
    parseJsonArray<string>(row.models_json),
    getAIProviderById(providerId)?.models ?? []
  );
}

function resolveConnectionLabel(label: string | undefined, providerName: string, modelId: string) {
  const normalizedLabel = label?.trim() ?? "";
  if (normalizedLabel) return normalizedLabel;
  if (!modelId) return providerName;
  return `${providerName} - ${modelId}`;
}

function mapProviderRow(
  row: AIProviderRow,
  settings: AISettingsRow,
  includeSecrets = false
): AIProviderConfig {
  const providerId = row.provider_id?.trim() || row.id;
  const providerName = getAIProviderById(providerId)?.name ?? providerId;
  const modelId =
    row.model_id?.trim() ||
    (Boolean(row.is_active) ? settings.active_model_id : "") ||
    parseJsonArray<string>(row.models_json)[0] ||
    getAIProviderById(providerId)?.models[0] ||
    "General Model";
  const models = buildProviderModelList(providerId, row, modelId);

  return {
    id: row.id,
    name: resolveConnectionLabel(row.name, providerName, modelId),
    providerId,
    providerName,
    modelId,
    apiKey: includeSecrets ? row.api_key : "",
    maskedApiKey: row.masked_api_key?.trim() || maskApiKey(row.api_key),
    endpointUrl: (row.endpoint_url ?? getProviderEndpoint(providerId)) || undefined,
    models,
    builtin: Boolean(row.builtin),
    connectionStatus: normalizeConnectionStatus(row.connection_status),
    lastTestedAt: row.last_tested_at ?? undefined,
    lastConnectionMessage: row.last_connection_message ?? undefined,
    isActive: Boolean(row.is_active),
  };
}

function mergeStringList(...lists: Array<string[] | undefined>) {
  return Array.from(
    new Set(
      lists
        .flatMap((items) => items ?? [])
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function parseAIFeatureFlagsJson(value: string | null | undefined) {
  if (!value?.trim()) return defaultAIFeatureFlags;
  try {
    return normalizeAIFeatureFlags(JSON.parse(value));
  } catch {
    return defaultAIFeatureFlags;
  }
}

async function ensureAISettingsFeatureFlagColumns(db: AletaDatabase) {
  const statements = [
    `ALTER TABLE ai_global_settings ADD COLUMN IF NOT EXISTS feature_disposition_ai SMALLINT NOT NULL DEFAULT 1`,
    `ALTER TABLE ai_global_settings ADD COLUMN IF NOT EXISTS feature_mail_intelligence SMALLINT NOT NULL DEFAULT 1`,
    `ALTER TABLE ai_global_settings ADD COLUMN IF NOT EXISTS feature_draft_metadata SMALLINT NOT NULL DEFAULT 1`,
    `ALTER TABLE ai_global_settings ADD COLUMN IF NOT EXISTS feature_manajemen_surat_ai SMALLINT NOT NULL DEFAULT 1`,
    `ALTER TABLE ai_global_settings ADD COLUMN IF NOT EXISTS feature_disposisi_ai SMALLINT NOT NULL DEFAULT 1`,
    `ALTER TABLE ai_global_settings ADD COLUMN IF NOT EXISTS feature_flags_json TEXT NOT NULL DEFAULT '{}'`,
  ];

  for (const statement of statements) {
    await db.exec(statement);
  }
}

async function ensureAIModuleSettingsTable(db: AletaDatabase) {
  let tableExists = false;
  try {
    await db.prepare(`SELECT module_key FROM ai_module_settings LIMIT 1`).all();
    tableExists = true;
  } catch {
    // The table may not exist yet on upgraded installations.
  }

  if (!tableExists) {
    await db.exec(
      `CREATE TABLE IF NOT EXISTS ai_module_settings (
        module_key TEXT,
        enabled INTEGER,
        inherit_global INTEGER,
        active_provider_id TEXT,
        active_model_id TEXT,
        active_connection_id TEXT,
        fallback_provider_id TEXT,
        fallback_model_id TEXT,
        fallback_connection_id TEXT,
        updated_by TEXT,
        created_at TEXT,
        updated_at TEXT
      )`
    );
  }
  await db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_module_settings_key ON ai_module_settings(module_key)`);
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_module_settings_connection ON ai_module_settings(active_connection_id)`);
}

function normalizeDraftDate(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : "";
}

function preferFilledString(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim() ?? "").find(Boolean) ?? "";
}

function normalizeReadableEntity(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return "";
  if (/[a-z]/.test(normalized)) return normalized;

  return normalized
    .toLowerCase()
    .split(" ")
    .map((segment) => (segment ? `${segment.charAt(0).toUpperCase()}${segment.slice(1)}` : segment))
    .join(" ");
}

function canUseLiveAdministrativeDate(text: string, type: LetterType, candidateDate: string, suratDate: string) {
  const normalizedCandidate = normalizeDraftDate(candidateDate);
  if (!normalizedCandidate) return false;
  if (normalizedCandidate === suratDate) return false;

  const contextPattern =
    type === "masuk"
      ? /(tanggal terima|diterima|penerimaan|registrasi|agenda)/i
      : /(tanggal kirim|dikirim|pengiriman|tanggal keluar)/i;

  return contextPattern.test(text);
}

function resolveActiveConnection(
  settings: AISettingsRow,
  providers: AIProviderConfig[]
) {
  return (
    providers.find((provider) => provider.id === settings.active_connection_id) ??
    providers.find((provider) => provider.isActive) ??
    providers.find(
      (provider) =>
        provider.providerId === settings.active_provider_id &&
        provider.modelId === settings.active_model_id
    ) ??
    providers.find((provider) => provider.providerId === settings.active_provider_id) ??
    null
  );
}

function resolveConnectionByFields(
  providers: AIProviderConfig[],
  {
    activeConnectionId,
    providerId,
    modelId,
  }: {
    activeConnectionId?: string | null;
    providerId?: string | null;
    modelId?: string | null;
  }
) {
  return (
    providers.find((provider) => provider.id === activeConnectionId) ??
    providers.find(
      (provider) =>
        Boolean(providerId) &&
        provider.providerId === providerId &&
        (!modelId || provider.modelId === modelId)
    ) ??
    providers.find((provider) => Boolean(providerId) && provider.providerId === providerId) ??
    null
  );
}

function buildModuleConfigResponse(
  settings: AISettingsRow,
  providers: AIProviderConfig[],
  moduleRows: AIModuleSettingsRow[]
): AIModuleConfig[] {
  const rowsByKey = new Map(
    moduleRows
      .map((row) => {
        const key = normalizeAIModuleKey(row.module_key);
        return key ? [key, row] as const : null;
      })
      .filter((item): item is readonly [AIModuleKey, AIModuleSettingsRow] => item !== null)
  );
  const globalConnection = resolveActiveConnection(settings, providers);
  const globalProviderId = globalConnection?.providerId ?? settings.active_provider_id;
  const globalModelId = globalConnection?.modelId ?? settings.active_model_id;
  const globalConnectionId = globalConnection?.id ?? settings.active_connection_id ?? null;

  return AI_MODULE_CATALOG.map((module) => {
    const row = rowsByKey.get(module.key) ?? null;
    const inheritGlobal = !row || row.inherit_global !== 0;
    const configuredConnection = row
      ? resolveConnectionByFields(providers, {
          activeConnectionId: row.active_connection_id,
          providerId: row.active_provider_id,
          modelId: row.active_model_id,
        })
      : null;
    const effectiveConnection = inheritGlobal ? globalConnection : configuredConnection ?? globalConnection;
    const status = inheritGlobal ? "global" : configuredConnection ? "custom" : "fallback";
    const fallbackReason =
      status === "fallback"
        ? "Koneksi AI modul tidak ditemukan atau sudah dihapus. Modul memakai konfigurasi global."
        : undefined;
    const providerId = effectiveConnection?.providerId ?? (inheritGlobal ? globalProviderId : row?.active_provider_id) ?? globalProviderId;
    const modelId = effectiveConnection?.modelId ?? (inheritGlobal ? globalModelId : row?.active_model_id) ?? globalModelId;

    return {
      moduleKey: module.key,
      label: module.label,
      description: module.description,
      enabled: Boolean(settings.enabled) && (row ? row.enabled !== 0 : true),
      inheritGlobal,
      providerId,
      modelId,
      activeConnectionId: effectiveConnection?.id ?? globalConnectionId,
      activeConnectionLabel: effectiveConnection?.name ?? null,
      activeConnectionStatus: effectiveConnection?.connectionStatus ?? "idle",
      configuredProviderId: row?.active_provider_id ?? null,
      configuredModelId: row?.active_model_id ?? null,
      configuredConnectionId: row?.active_connection_id ?? null,
      fallbackProviderId: globalProviderId,
      fallbackModelId: globalModelId,
      fallbackConnectionId: globalConnectionId,
      status,
      fallbackReason,
      updatedAt: row?.updated_at ?? null,
    };
  });
}

function buildAISettingsResponse(
  settings: AISettingsRow,
  providerRows: AIProviderRow[],
  moduleRows: AIModuleSettingsRow[] = [],
  includeSecrets = false
): AIGlobalConfig {
  const providers = providerRows
    .map((row) => mapProviderRow(row, settings, includeSecrets))
    .sort((left, right) => {
      if (Boolean(left.isActive) !== Boolean(right.isActive)) {
        return left.isActive ? -1 : 1;
      }
      return left.name.localeCompare(right.name, "id-ID");
    });
  const activeConnection = resolveActiveConnection(settings, providers);
  const featureFlags = applyLegacyAIFeatureToggles(
    parseAIFeatureFlagsJson(settings.feature_flags_json),
    {
      featureDispositionAi: settings.feature_disposition_ai !== 0,
      featureMailIntelligence: settings.feature_mail_intelligence !== 0,
      featureDraftMetadata: settings.feature_draft_metadata !== 0,
      featureManajemenSuratAi: settings.feature_manajemen_surat_ai !== 0,
      featureDisposisiAi: settings.feature_disposisi_ai !== 0,
    }
  );

  return {
    enabled: Boolean(settings.enabled),
    providerId: activeConnection?.providerId ?? settings.active_provider_id,
    modelId: activeConnection?.modelId ?? settings.active_model_id,
    activeConnectionId: activeConnection?.id ?? settings.active_connection_id ?? null,
    primaryLanguage: settings.primary_language as "id" | "en",
    providers: providers.map((provider) => ({
      ...provider,
      isActive: provider.id === activeConnection?.id,
    })),
    moduleConfigs: buildModuleConfigResponse(settings, providers, moduleRows),
    featureFlags,
    featureDispositionAi: featureFlags.oneStopDisposition.enabled,
    featureMailIntelligence: featureFlags.mailIntelligence.enabled,
    featureDraftMetadata: featureFlags.draftMetadata.enabled,
    featureManajemenSuratAi: settings.feature_manajemen_surat_ai !== 0,
    featureDisposisiAi: settings.feature_disposisi_ai !== 0,
  };
}

function resolveLiveAIConnection(aiConfig: AIGlobalConfig) {
  return (
    aiConfig.providers.find((provider) => provider.id === aiConfig.activeConnectionId) ??
    aiConfig.providers.find((provider) => provider.isActive) ??
    aiConfig.providers.find(
      (provider) =>
        provider.providerId === aiConfig.providerId &&
        provider.modelId === aiConfig.modelId
    ) ??
    null
  );
}

export function resolveAIConfigForModule(
  aiConfig: AIGlobalConfig,
  moduleKey: AIModuleKey | string
): AIGlobalConfig {
  const normalizedKey = normalizeAIModuleKey(moduleKey) ?? moduleKey;
  const moduleConfig = aiConfig.moduleConfigs.find((item) => item.moduleKey === normalizedKey);

  if (!moduleConfig) {
    return aiConfig;
  }

  const activeConnection =
    aiConfig.providers.find((provider) => provider.id === moduleConfig.activeConnectionId) ??
    aiConfig.providers.find(
      (provider) =>
        provider.providerId === moduleConfig.providerId &&
        provider.modelId === moduleConfig.modelId
    ) ??
    aiConfig.providers.find((provider) => provider.providerId === moduleConfig.providerId) ??
    resolveLiveAIConnection(aiConfig);

  return {
    ...aiConfig,
    enabled: aiConfig.enabled && moduleConfig.enabled,
    providerId: activeConnection?.providerId ?? moduleConfig.providerId ?? aiConfig.providerId,
    modelId: activeConnection?.modelId ?? moduleConfig.modelId ?? aiConfig.modelId,
    activeConnectionId: activeConnection?.id ?? moduleConfig.activeConnectionId ?? aiConfig.activeConnectionId ?? null,
    providers: aiConfig.providers.map((provider) => ({
      ...provider,
      isActive: Boolean(activeConnection && provider.id === activeConnection.id),
    })),
  };
}

export function resolveLiveAIConnectionForModule(
  aiConfig: AIGlobalConfig,
  moduleKey: AIModuleKey | string
) {
  return resolveLiveAIConnection(resolveAIConfigForModule(aiConfig, moduleKey));
}

function assertGlobalAIEnabled(aiConfig: AIGlobalConfig) {
  if (!aiConfig.enabled) {
    throw new ApiError(409, "AI sedang dinonaktifkan oleh administrator.");
  }
}

function getResolvedFeatureFlags(aiConfig: AIGlobalConfig) {
  return normalizeAIFeatureFlags(aiConfig.featureFlags);
}

function hasAnyEnabledFlag(flags: Record<string, boolean>, keys: string[]) {
  return keys.some((key) => flags[key]);
}

function maskDraftByFeatureFlags(draft: GeneratedLetterDraft, aiConfig: AIGlobalConfig): GeneratedLetterDraft {
  const flags = getResolvedFeatureFlags(aiConfig).draftMetadata;
  return {
    ...draft,
    nomorSurat: flags.nomorSurat ? draft.nomorSurat : "",
    nomorUrut: flags.nomorSurat ? draft.nomorUrut : "",
    tanggalSurat: flags.tanggalSurat ? draft.tanggalSurat : "",
    tanggalAdministratif: flags.tanggalTerima ? draft.tanggalAdministratif : "",
    pengirim: flags.asalSurat ? draft.pengirim : "",
    asalSurat: flags.asalSurat ? draft.asalSurat : "",
    perihal: flags.perihal ? draft.perihal : "",
    kodeKlasifikasi: flags.kodeKlasifikasi ? draft.kodeKlasifikasi : "",
    klasifikasi: flags.klasifikasiSurat ? draft.klasifikasi : "",
    klasifikasiTags: flags.klasifikasiSurat ? draft.klasifikasiTags : [],
    tags: flags.tagSurat || flags.tagAsalSurat ? draft.tags : [],
    aiReviewNote: flags.aiReviewNote ? draft.aiReviewNote : "",
  };
}

export async function getAISettingsFromDb(
  db: AletaDatabase,
  options: AISettingsQueryOptions = {}
): Promise<AIGlobalConfig> {
  const includeSecrets = Boolean(options.includeSecrets);
  await ensureAISettingsFeatureFlagColumns(db);
  await ensureAIModuleSettingsTable(db);

  if (!db.supportsFullTextSearch()) {
    const settings = await db.prepare(
      `SELECT enabled, active_provider_id, active_model_id, active_connection_id, primary_language,
              COALESCE(feature_disposition_ai, 1) AS feature_disposition_ai,
              COALESCE(feature_mail_intelligence, 1) AS feature_mail_intelligence,
              COALESCE(feature_draft_metadata, 1) AS feature_draft_metadata,
              COALESCE(feature_manajemen_surat_ai, 1) AS feature_manajemen_surat_ai,
              COALESCE(feature_disposisi_ai, 1) AS feature_disposisi_ai,
              COALESCE(feature_flags_json, '{}') AS feature_flags_json
       FROM ai_global_settings
       WHERE id = 1`
    ).get<AISettingsRow>();
    const providers = await db.prepare(
      `SELECT id, name, provider_id, endpoint_url, api_key, masked_api_key, models_json, model_id,
              builtin, connection_status, is_active, last_tested_at, last_connection_message
       FROM ai_providers
       WHERE deleted_at IS NULL
       ORDER BY is_active DESC, name ASC, updated_at DESC`
    ).all<AIProviderRow>();
    const moduleRows = await db.prepare(
      `SELECT module_key, enabled, inherit_global, active_provider_id, active_model_id, active_connection_id,
              fallback_provider_id, fallback_model_id, fallback_connection_id, updated_at
       FROM ai_module_settings`
    ).all<AIModuleSettingsRow>();

    if (!settings) {
      throw new ApiError(500, "Konfigurasi global AI belum ditemukan di database.");
    }

    return buildAISettingsResponse(settings, providers, moduleRows, includeSecrets);
  }

  const settings = await db.getOrm().select({
    enabled: aiGlobalSettings.enabled,
    active_provider_id: aiGlobalSettings.activeProviderId,
    active_model_id: aiGlobalSettings.activeModelId,
    active_connection_id: aiGlobalSettings.activeConnectionId,
    primary_language: aiGlobalSettings.primaryLanguage,
    feature_disposition_ai: aiGlobalSettings.featureDispositionAi,
    feature_mail_intelligence: aiGlobalSettings.featureMailIntelligence,
    feature_draft_metadata: aiGlobalSettings.featureDraftMetadata,
    feature_manajemen_surat_ai: aiGlobalSettings.featureManajemenSuratAi,
    feature_disposisi_ai: aiGlobalSettings.featureDisposisiAi,
    feature_flags_json: aiGlobalSettings.featureFlagsJson,
  }).from(aiGlobalSettings)
    .where(eq(aiGlobalSettings.id, 1))
    .then((rows) => rows[0]);
  const providers = await db.getOrm().select({
    id: aiProviders.id,
    name: aiProviders.name,
    provider_id: aiProviders.providerId,
    endpoint_url: aiProviders.endpointUrl,
    api_key: aiProviders.apiKey,
    masked_api_key: aiProviders.maskedApiKey,
    models_json: aiProviders.modelsJson,
    model_id: aiProviders.modelId,
    builtin: aiProviders.builtin,
    connection_status: aiProviders.connectionStatus,
    is_active: aiProviders.isActive,
    last_tested_at: aiProviders.lastTestedAt,
    last_connection_message: aiProviders.lastConnectionMessage,
  }).from(aiProviders)
    .where(isNull(aiProviders.deletedAt))
    .orderBy(desc(aiProviders.isActive), aiProviders.name, desc(aiProviders.updatedAt));
  const moduleRows = await db.getOrm().select({
    module_key: aiModuleSettings.moduleKey,
    enabled: aiModuleSettings.enabled,
    inherit_global: aiModuleSettings.inheritGlobal,
    active_provider_id: aiModuleSettings.activeProviderId,
    active_model_id: aiModuleSettings.activeModelId,
    active_connection_id: aiModuleSettings.activeConnectionId,
    fallback_provider_id: aiModuleSettings.fallbackProviderId,
    fallback_model_id: aiModuleSettings.fallbackModelId,
    fallback_connection_id: aiModuleSettings.fallbackConnectionId,
    updated_at: aiModuleSettings.updatedAt,
  }).from(aiModuleSettings);

  if (!settings) {
    throw new ApiError(500, "Konfigurasi global AI belum ditemukan di database.");
  }

  return buildAISettingsResponse(settings as AISettingsRow, providers as AIProviderRow[], moduleRows as AIModuleSettingsRow[], includeSecrets);
}

export async function upsertAISettingsInDb(
  db: AletaDatabase,
  {
    actorUserId,
    enabled,
    primaryLanguage,
    activeConnectionId,
    connection,
    deleteConnectionId,
    featureDispositionAi,
    featureMailIntelligence,
    featureDraftMetadata,
    featureManajemenSuratAi,
    featureDisposisiAi,
    featureFlags,
    moduleConfigs,
  }: {
    actorUserId: string;
    enabled?: boolean;
    primaryLanguage?: "id" | "en";
    activeConnectionId?: string | null;
    connection?: AISavedConnectionInput;
    deleteConnectionId?: string;
    featureDispositionAi?: boolean;
    featureMailIntelligence?: boolean;
    featureDraftMetadata?: boolean;
    featureManajemenSuratAi?: boolean;
    featureDisposisiAi?: boolean;
    featureFlags?: PartialAIFeatureFlags;
    moduleConfigs?: AIModuleConfigInput[];
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (!canManageGlobalAI(actor)) {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengubah konfigurasi AI global.");
  }

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();
    const current = await getAISettingsFromDb(tx, { includeSecrets: true });
    let nextActiveConnectionId = activeConnectionId ?? current.activeConnectionId ?? null;
    const nextLanguage = primaryLanguage ?? current.primaryLanguage;
    const nextEnabled = enabled ?? current.enabled;
    const nextFeatureDispositionAi = featureDispositionAi ?? current.featureDispositionAi;
    const nextFeatureMailIntelligence = featureMailIntelligence ?? current.featureMailIntelligence;
    const nextFeatureDraftMetadata = featureDraftMetadata ?? current.featureDraftMetadata;
    const nextFeatureManajemenSuratAi = featureManajemenSuratAi ?? current.featureManajemenSuratAi;
    const nextFeatureDisposisiAi = featureDisposisiAi ?? current.featureDisposisiAi;
    const nextFeatureFlags = mergeAIFeatureFlags(
      current.featureFlags,
      featureFlags
    );
    const syncedFeatureFlags = applyLegacyAIFeatureToggles(nextFeatureFlags, {
      featureDispositionAi: nextFeatureDispositionAi,
      featureMailIntelligence: nextFeatureMailIntelligence,
      featureDraftMetadata: nextFeatureDraftMetadata,
      featureManajemenSuratAi: nextFeatureManajemenSuratAi,
      featureDisposisiAi: nextFeatureDisposisiAi,
    });
    const persistedFeatureDispositionAi = syncedFeatureFlags.oneStopDisposition.enabled;
    const persistedFeatureMailIntelligence = syncedFeatureFlags.mailIntelligence.enabled;
    const persistedFeatureDraftMetadata = syncedFeatureFlags.draftMetadata.enabled;
    let auditAction = "UPDATE_AI_SETTINGS";
    const auditPayload: Record<string, unknown> = {
      enabled: nextEnabled,
      primaryLanguage: nextLanguage,
      featureDispositionAi: persistedFeatureDispositionAi,
      featureMailIntelligence: persistedFeatureMailIntelligence,
      featureDraftMetadata: persistedFeatureDraftMetadata,
      featureManajemenSuratAi: nextFeatureManajemenSuratAi,
      featureDisposisiAi: nextFeatureDisposisiAi,
      featureFlags: syncedFeatureFlags,
    };
    const normalizedModuleInputs = (moduleConfigs ?? [])
      .map((item) => {
        const moduleKey = normalizeAIModuleKey(item.moduleKey);
        return moduleKey ? { ...item, moduleKey } : null;
      })
      .filter((item): item is AIModuleConfigInput & { moduleKey: AIModuleKey } => item !== null);

    if (connection) {
      if (!isProviderLiveSupported(connection.providerId)) {
        throw new ApiError(
          400,
          `Provider ${connection.providerId} belum didukung untuk koneksi live ALETA. Pilih Gemini, ChatGPT, Claude, atau Llama.`
        );
      }

      const existingConnection = connection.id
        ? current.providers.find((item) => item.id === connection.id)
        : null;
      const providerMeta = getAIProviderById(connection.providerId);
      const providerName = providerMeta?.name ?? connection.providerId;
      const connectionId =
        connection.id ??
        (await nextPrefixedId(tx, "ai_providers", "aic"));
      const modelId =
        connection.modelId?.trim() ||
        existingConnection?.modelId ||
        providerMeta?.models[0] ||
        "General Model";
      const apiKey = connection.apiKey?.trim() || existingConnection?.apiKey || "";

      if (!apiKey) {
        throw new ApiError(400, "API key wajib diisi saat menambahkan koneksi AI baru.");
      }

      const models = mergeStringList(
        [modelId],
        connection.modelId ? [connection.modelId] : [],
        existingConnection?.models,
        providerMeta?.models
      );
      const label = resolveConnectionLabel(
        connection.label ?? existingConnection?.name,
        providerName,
        modelId
      );
      const connectionStatus =
        connection.connectionStatus ??
        existingConnection?.connectionStatus ??
        (isLikelyConnectedApiKey(apiKey) ? "idle" : "failed");
      const lastTestedAt = connection.lastTestedAt ?? existingConnection?.lastTestedAt ?? null;
      const lastConnectionMessage =
        connection.lastConnectionMessage ?? existingConnection?.lastConnectionMessage ?? null;
      const endpointUrl =
        connection.endpointUrl?.trim() ||
        existingConnection?.endpointUrl ||
        getProviderEndpoint(connection.providerId);
      const builtin = toBooleanInt(connection.builtin ?? existingConnection?.builtin ?? Boolean(providerMeta?.builtin));

      if (!tx.supportsFullTextSearch()) {
        await tx.prepare(
          `INSERT INTO ai_providers (
            id, name, provider_id, endpoint_url, api_key, masked_api_key, models_json, model_id,
            builtin, connection_status, is_active, last_tested_at, last_connection_message,
            deleted_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            provider_id = excluded.provider_id,
            endpoint_url = excluded.endpoint_url,
            api_key = excluded.api_key,
            masked_api_key = excluded.masked_api_key,
            models_json = excluded.models_json,
            model_id = excluded.model_id,
            builtin = excluded.builtin,
            connection_status = excluded.connection_status,
            last_tested_at = excluded.last_tested_at,
            last_connection_message = excluded.last_connection_message,
            updated_at = excluded.updated_at,
            deleted_at = NULL`
        ).run(
          connectionId,
          label,
          connection.providerId,
          endpointUrl,
          apiKey,
          maskApiKey(apiKey),
          stringifyJson(models),
          modelId,
          builtin,
          connectionStatus,
          0,
          lastTestedAt,
          lastConnectionMessage,
          null,
          existingConnection?.lastTestedAt ? existingConnection.lastTestedAt : now,
          now
        );
      } else {
        await tx.getOrm().insert(aiProviders).values({
          id: connectionId,
          name: label,
          providerId: connection.providerId,
          endpointUrl,
          apiKey,
          maskedApiKey: maskApiKey(apiKey),
          modelsJson: stringifyJson(models),
          modelId,
          builtin,
          connectionStatus,
          isActive: 0,
          lastTestedAt,
          lastConnectionMessage,
          deletedAt: null,
          createdAt: existingConnection?.lastTestedAt ? existingConnection.lastTestedAt : now,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: aiProviders.id,
          set: {
            name: label,
            providerId: connection.providerId,
            endpointUrl,
            apiKey,
            maskedApiKey: maskApiKey(apiKey),
            modelsJson: stringifyJson(models),
            modelId,
            builtin,
            connectionStatus,
            lastTestedAt,
            lastConnectionMessage,
            updatedAt: now,
            deletedAt: null,
          },
        });
      }

      if (!nextActiveConnectionId) {
        nextActiveConnectionId = connectionId;
      }

      auditAction = existingConnection ? "UPDATE_AI_CONNECTION" : "CREATE_AI_CONNECTION";
      auditPayload.connectionId = connectionId;
      auditPayload.providerId = connection.providerId;
      auditPayload.modelId = modelId;
      auditPayload.label = label;
    }

    if (deleteConnectionId) {
      if (!tx.supportsFullTextSearch()) {
        await tx.prepare(
          `UPDATE ai_providers
           SET deleted_at = ?, is_active = 0, updated_at = ?
           WHERE id = ?`
        ).run(now, now, deleteConnectionId);
      } else {
        await tx.getOrm().update(aiProviders).set({
          deletedAt: now,
          isActive: 0,
          updatedAt: now,
        }).where(eq(aiProviders.id, deleteConnectionId));
      }

      if (nextActiveConnectionId === deleteConnectionId) {
        nextActiveConnectionId = null;
      }

      auditAction = "DELETE_AI_CONNECTION";
      auditPayload.deletedConnectionId = deleteConnectionId;
    }

    const refreshed = await getAISettingsFromDb(tx, { includeSecrets: true });
    const availableConnections = refreshed.providers.filter((provider) => provider.id !== deleteConnectionId);
    const activeConnection =
      availableConnections.find((provider) => provider.id === nextActiveConnectionId) ??
      availableConnections.find((provider) => provider.isActive) ??
      availableConnections[0] ??
      null;
    const nextProviderId = activeConnection?.providerId ?? refreshed.providerId;
    const nextModelId = activeConnection?.modelId ?? refreshed.modelId;
    const persistedActiveConnectionId = activeConnection?.id ?? null;

    if (!tx.supportsFullTextSearch()) {
      await tx.prepare(
        `UPDATE ai_global_settings
         SET enabled = ?, active_provider_id = ?, active_model_id = ?, active_connection_id = ?,
             primary_language = ?, feature_disposition_ai = ?, feature_mail_intelligence = ?,
             feature_draft_metadata = ?, feature_manajemen_surat_ai = ?, feature_disposisi_ai = ?,
             feature_flags_json = ?, updated_at = ?
         WHERE id = 1`
      ).run(
        toBooleanInt(nextEnabled),
        nextProviderId,
        nextModelId,
        persistedActiveConnectionId,
        nextLanguage,
        toBooleanInt(persistedFeatureDispositionAi),
        toBooleanInt(persistedFeatureMailIntelligence),
        toBooleanInt(persistedFeatureDraftMetadata),
        toBooleanInt(nextFeatureManajemenSuratAi),
        toBooleanInt(nextFeatureDisposisiAi),
        stringifyJson(syncedFeatureFlags),
        now
      );

      await tx.prepare(
        `UPDATE ai_providers
         SET is_active = 0, updated_at = ?
         WHERE deleted_at IS NULL`
      ).run(now);

      if (persistedActiveConnectionId) {
        await tx.prepare(
          `UPDATE ai_providers
           SET is_active = 1, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`
        ).run(now, persistedActiveConnectionId);
      }
    } else {
      await tx.getOrm().update(aiGlobalSettings).set({
        enabled: toBooleanInt(nextEnabled),
        activeProviderId: nextProviderId,
        activeModelId: nextModelId,
        activeConnectionId: persistedActiveConnectionId,
        primaryLanguage: nextLanguage,
        featureDispositionAi: toBooleanInt(persistedFeatureDispositionAi),
        featureMailIntelligence: toBooleanInt(persistedFeatureMailIntelligence),
        featureDraftMetadata: toBooleanInt(persistedFeatureDraftMetadata),
        featureManajemenSuratAi: toBooleanInt(nextFeatureManajemenSuratAi),
        featureDisposisiAi: toBooleanInt(nextFeatureDisposisiAi),
        featureFlagsJson: stringifyJson(syncedFeatureFlags),
        updatedAt: now,
      }).where(eq(aiGlobalSettings.id, 1));

      await tx.getOrm().update(aiProviders).set({
        isActive: 0,
        updatedAt: now,
      }).where(isNull(aiProviders.deletedAt));

      if (persistedActiveConnectionId) {
        await tx.getOrm().update(aiProviders).set({
          isActive: 1,
          updatedAt: now,
        }).where(and(eq(aiProviders.id, persistedActiveConnectionId), isNull(aiProviders.deletedAt)));
      }
    }

    auditPayload.activeConnectionId = persistedActiveConnectionId;
    auditPayload.activeProviderId = nextProviderId;
    auditPayload.activeModelId = nextModelId;

    if (normalizedModuleInputs.length > 0) {
      const currentModulesByKey = new Map(refreshed.moduleConfigs.map((item) => [item.moduleKey, item]));
      const moduleAuditPayload: Array<Record<string, unknown>> = [];

      for (const moduleInput of normalizedModuleInputs) {
        const currentModule = currentModulesByKey.get(moduleInput.moduleKey);
        const inheritGlobal = moduleInput.inheritGlobal ?? (!moduleInput.activeConnectionId && (currentModule?.inheritGlobal ?? true));
        const moduleEnabled = moduleInput.enabled ?? currentModule?.enabled ?? true;
        const selectedConnection = inheritGlobal
          ? null
          : availableConnections.find((provider) => provider.id === moduleInput.activeConnectionId);

        if (!inheritGlobal && !selectedConnection) {
          throw new ApiError(400, `Koneksi AI untuk modul ${moduleInput.moduleKey} tidak ditemukan atau sudah dihapus.`);
        }

        const moduleProviderId = inheritGlobal ? null : selectedConnection?.providerId ?? null;
        const moduleModelId = inheritGlobal ? null : selectedConnection?.modelId ?? null;
        const moduleConnectionId = inheritGlobal ? null : selectedConnection?.id ?? null;

        if (!tx.supportsFullTextSearch()) {
          await tx.prepare(
            `INSERT INTO ai_module_settings (
              module_key, enabled, inherit_global, active_provider_id, active_model_id, active_connection_id,
              fallback_provider_id, fallback_model_id, fallback_connection_id, updated_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(module_key) DO UPDATE SET
              enabled = excluded.enabled,
              inherit_global = excluded.inherit_global,
              active_provider_id = excluded.active_provider_id,
              active_model_id = excluded.active_model_id,
              active_connection_id = excluded.active_connection_id,
              fallback_provider_id = excluded.fallback_provider_id,
              fallback_model_id = excluded.fallback_model_id,
              fallback_connection_id = excluded.fallback_connection_id,
              updated_by = excluded.updated_by,
              updated_at = excluded.updated_at`
          ).run(
            moduleInput.moduleKey,
            toBooleanInt(moduleEnabled),
            toBooleanInt(inheritGlobal),
            moduleProviderId,
            moduleModelId,
            moduleConnectionId,
            nextProviderId,
            nextModelId,
            persistedActiveConnectionId,
            actor.id,
            now,
            now
          );
        } else {
          await tx.getOrm().insert(aiModuleSettings).values({
            moduleKey: moduleInput.moduleKey,
            enabled: toBooleanInt(moduleEnabled),
            inheritGlobal: toBooleanInt(inheritGlobal),
            activeProviderId: moduleProviderId,
            activeModelId: moduleModelId,
            activeConnectionId: moduleConnectionId,
            fallbackProviderId: nextProviderId,
            fallbackModelId: nextModelId,
            fallbackConnectionId: persistedActiveConnectionId,
            updatedBy: actor.id,
            createdAt: now,
            updatedAt: now,
          }).onConflictDoUpdate({
            target: aiModuleSettings.moduleKey,
            set: {
              enabled: toBooleanInt(moduleEnabled),
              inheritGlobal: toBooleanInt(inheritGlobal),
              activeProviderId: moduleProviderId,
              activeModelId: moduleModelId,
              activeConnectionId: moduleConnectionId,
              fallbackProviderId: nextProviderId,
              fallbackModelId: nextModelId,
              fallbackConnectionId: persistedActiveConnectionId,
              updatedBy: actor.id,
              updatedAt: now,
            },
          });
        }

        moduleAuditPayload.push({
          moduleKey: moduleInput.moduleKey,
          inheritGlobal,
          enabled: moduleEnabled,
          activeConnectionId: moduleConnectionId,
          providerId: moduleProviderId,
          modelId: moduleModelId,
          fallbackConnectionId: persistedActiveConnectionId,
        });
      }

      auditPayload.moduleConfigs = moduleAuditPayload;
      if (auditAction === "UPDATE_AI_SETTINGS") {
        auditAction = "UPDATE_AI_MODULE_SETTINGS";
      }
    }

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: auditAction,
      entityType: "ai_settings",
      entityId: "global",
      payload: auditPayload,
    });

    return getAISettingsFromDb(tx);
  });
}

export async function testAIProviderConnectionInDb(
  db: AletaDatabase,
  {
    actorUserId,
    connectionId,
    providerId,
    modelId,
    apiKey,
  }: {
    actorUserId: string;
    connectionId?: string;
    providerId?: string;
    modelId?: string;
    apiKey?: string;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (!canManageGlobalAI(actor)) {
    throw new ApiError(403, "Hanya Super Admin yang dapat menguji koneksi provider AI.");
  }

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();
    const current = await getAISettingsFromDb(tx, { includeSecrets: true });
    const savedConnection = connectionId
      ? current.providers.find((provider) => provider.id === connectionId)
      : null;

    if (connectionId && !savedConnection) {
      throw new ApiError(404, "Koneksi AI tersimpan tidak ditemukan atau sudah dihapus.");
    }

    const resolvedProviderId = savedConnection?.providerId ?? providerId ?? "";
    const resolvedModelId =
      savedConnection?.modelId ??
      modelId?.trim() ??
      getAIProviderById(resolvedProviderId)?.models[0] ??
      popularAIProviderCatalog[0]?.models[0] ??
      "general-model";
    const resolvedApiKey = savedConnection?.apiKey ?? apiKey?.trim() ?? "";
    const provider = getAIProviderById(resolvedProviderId) ?? popularAIProviderCatalog[0];

    if (!resolvedProviderId) {
      throw new ApiError(400, "Provider AI wajib dipilih sebelum uji koneksi.");
    }

    if (!isProviderLiveSupported(resolvedProviderId)) {
      throw new ApiError(
        400,
        `Provider ${resolvedProviderId} belum didukung untuk koneksi live ALETA.`
      );
    }

    const connection = await testProviderConnection({
      providerId: resolvedProviderId,
      endpointUrl: savedConnection?.endpointUrl ?? getProviderEndpoint(resolvedProviderId),
      apiKey: resolvedApiKey,
      modelId: resolvedModelId,
    });
    const status = connection.ok ? "connected" : "failed";

    if (savedConnection) {
      if (!tx.supportsFullTextSearch()) {
        await tx.prepare(
          `UPDATE ai_providers
           SET connection_status = ?, last_tested_at = ?, last_connection_message = ?, masked_api_key = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`
        ).run(
          status,
          now,
          connection.message ?? null,
          savedConnection.maskedApiKey ?? maskApiKey(savedConnection.apiKey),
          now,
          savedConnection.id
        );
      } else {
        await tx.getOrm().update(aiProviders).set({
          connectionStatus: status,
          lastTestedAt: now,
          lastConnectionMessage: connection.message ?? null,
          maskedApiKey: savedConnection.maskedApiKey ?? maskApiKey(savedConnection.apiKey),
          updatedAt: now,
        }).where(and(eq(aiProviders.id, savedConnection.id), isNull(aiProviders.deletedAt)));
      }
    }

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "TEST_AI_PROVIDER_CONNECTION",
      entityType: "ai_provider",
      entityId: savedConnection?.id ?? resolvedProviderId,
      payload: {
        status,
        connectionId: savedConnection?.id ?? null,
        providerId: resolvedProviderId,
        modelId: resolvedModelId,
        providerModelId: connection.providerModelId,
        message: connection.message,
      },
    });

    return {
      connectionId: savedConnection?.id ?? null,
      providerId: resolvedProviderId,
      providerName: provider.name,
      modelId: resolvedModelId,
      status,
      testedAt: now,
      message:
        status === "connected"
          ? `Provider merespons dengan model ${connection.providerModelId}.`
          : connection.message,
      providerModelId: connection.providerModelId,
    };
  });
}

export async function extractSuratDraftInDb(
  db: AletaDatabase,
  {
    actorUserId,
    type,
    extractedText,
  }: {
    actorUserId: string;
    type: LetterType;
    extractedText: string;
  }
) {
  const actor = await requireActorUser(db, actorUserId);
  const aiConfig = resolveAIConfigForModule(
    await getAISettingsFromDb(db, { includeSecrets: true }),
    "manajemen_surat"
  );
  const featureFlags = getResolvedFeatureFlags(aiConfig);

  assertGlobalAIEnabled(aiConfig);

  if (!aiConfig.featureManajemenSuratAi || !featureFlags.draftMetadata.enabled) {
    throw new ApiError(409, "Fitur Deteksi Metadata Draft Surat sedang dinonaktifkan oleh administrator.");
  }

  if (!hasAnyEnabledFlag(featureFlags.draftMetadata as unknown as Record<string, boolean>, [
    "nomorSurat",
    "tanggalSurat",
    "tanggalTerima",
    "asalSurat",
    "perihal",
    "kodeKlasifikasi",
    "klasifikasiSurat",
    "tagSurat",
    "tagAsalSurat",
    "aiReviewNote",
  ])) {
    throw new ApiError(409, "Semua subfitur Deteksi Metadata Draft Surat sedang dinonaktifkan oleh administrator.");
  }

  const nonWhitespaceChars = extractedText.replace(/\s/g, "").length;
  if (nonWhitespaceChars < 30) {
    throw new ApiError(
      422,
      "PDF ini terdeteksi sebagai scan gambar (image-based) dan tidak mengandung teks yang dapat dibaca langsung. Lakukan OCR pada dokumen ini terlebih dahulu agar metadata dapat dideteksi secara otomatis."
    );
  }

  const activeProvider = resolveLiveAIConnection(aiConfig);
  const activeProviderId = activeProvider?.providerId ?? aiConfig.providerId;
  const activeModelId = activeProvider?.modelId ?? aiConfig.modelId;

  const suggestedUsers =
    type === "masuk"
      ? await getLeadershipRecipientsFromDb(db)
      : (await getUsersFromDb(db)).filter((user) => user.isActive && user.id !== actor.id);
  const relatedRegulations = await searchRegulationsInDb(db, {
    moduleId: "manajemen-surat",
    entityType: "surat-draft",
    title: extractedText.slice(0, 120),
    content: extractedText,
    tags: ["surat", type, activeProviderId, activeModelId],
  });
  const heuristicDraft = maskDraftByFeatureFlags(await generateLetterDraftFromPdf({
    type,
    extractedText,
    aiConfig,
    suggestedUsers,
  }), aiConfig);
  const liveDraftResult =
    activeProvider?.apiKey?.trim()
      ? await requestStructuredDataFromProvider<GeneratedLetterDraft>({
          providerId: activeProviderId,
          endpointUrl: activeProvider.endpointUrl ?? getProviderEndpoint(activeProviderId),
          apiKey: activeProvider.apiKey,
          modelId: activeModelId,
          fallback: heuristicDraft,
          systemPrompt:
            "Anda membantu aplikasi ALETA memetakan metadata surat dari teks PDF. Balas HANYA JSON tanpa markdown. Jangan mengarang. Untuk tanggal gunakan format YYYY-MM-DD. Jika kode klasifikasi atau klasifikasi tidak yakin, kembalikan string kosong. tanggalSurat adalah tanggal pada naskah surat. tanggalAdministratif adalah tanggal terima jika surat masuk atau tanggal kirim jika surat keluar. Jangan menyalin satu tanggal ke field lain bila tidak ada bukti kuat. Khusus ringkasan, tulis maksud dan tujuan surat, bukan salinan kop, nomor, tanggal, alamat tujuan, daftar lampiran, nama pejabat, NIP, atau tanda tangan.",
          userPrompt: [
            `Tipe surat: ${type}`,
            "Kembalikan objek JSON dengan properti:",
            "Isi hanya field yang subfiturnya aktif. Untuk field nonaktif, kembalikan string kosong atau array kosong.",
            `Subfitur aktif: ${stringifyJson(featureFlags.draftMetadata)}`,
            "nomorSurat, nomorUrut, tanggalSurat, tanggalAdministratif, pengirim, perihal, assignedUnit, confidentiality, asalSurat, tujuanSurat, kodeKlasifikasi, klasifikasi, klasifikasiTags, ringkasan, tags, lampiran, suggestedTargetUserId, suggestedTargetPositionId, aiReviewNote.",
            "Gunakan string untuk seluruh field tunggal dan array string untuk klasifikasiTags/tags/lampiran.",
            "Aturan ringkasan: isi 1-3 kalimat tentang apa yang diminta, disampaikan, atau perlu ditindaklanjuti dari isi surat. Abaikan kop surat, nomor surat, tanggal, alamat/kepada, perihal sebagai label, dan blok tanda tangan.",
            `Draft heuristik awal: ${stringifyJson(heuristicDraft)}`,
            `Referensi klasifikasi yang valid: ${stringifyJson(
              mergeStringList(
                letterClassificationCatalog.map((item) => `${item.value} - ${item.label}`),
                relatedRegulations.map((item) => item.title)
              )
            )}`,
            `Daftar user tujuan yang boleh dipilih: ${stringifyJson(
              suggestedUsers.map((user) => ({
                id: user.id,
                name: user.name,
                positionId: user.actingAssignment?.positionId ?? user.positionId,
              }))
            )}`,
            `Teks dokumen: ${extractedText}`,
          ].join("\n"),
        })
      : {
          ok: false,
          data: heuristicDraft,
          providerModelId: activeModelId,
          rawText: "",
          message: "API key provider AI belum diisi. Sistem memakai fallback heuristik internal.",
        };
  const liveDraft = liveDraftResult.data;
  const normalizedClassification = normalizeLetterClassificationDraft({
    kodeKlasifikasi: liveDraft.kodeKlasifikasi || heuristicDraft.kodeKlasifikasi,
    klasifikasi: liveDraft.klasifikasi || heuristicDraft.klasifikasi,
    klasifikasiTags: mergeStringList(
      heuristicDraft.klasifikasiTags,
      liveDraft.klasifikasiTags
    ),
  });
  const mergedTanggalSurat = normalizeDraftDate(liveDraft.tanggalSurat) || heuristicDraft.tanggalSurat;
  const mergedTanggalAdministratif =
    heuristicDraft.tanggalAdministratif ||
    (canUseLiveAdministrativeDate(
      extractedText,
      type,
      liveDraft.tanggalAdministratif,
      mergedTanggalSurat
    )
      ? normalizeDraftDate(liveDraft.tanggalAdministratif)
      : "");
  const draft = maskDraftByFeatureFlags({
    ...heuristicDraft,
    ...liveDraft,
    tanggalSurat: mergedTanggalSurat,
    tanggalAdministratif: mergedTanggalAdministratif,
    nomorSurat: preferFilledString(liveDraft.nomorSurat, heuristicDraft.nomorSurat),
    nomorUrut: preferFilledString(liveDraft.nomorUrut, heuristicDraft.nomorUrut),
    pengirim: normalizeReadableEntity(
      preferFilledString(liveDraft.pengirim, liveDraft.asalSurat, heuristicDraft.pengirim)
    ),
    asalSurat: normalizeReadableEntity(
      preferFilledString(liveDraft.asalSurat, liveDraft.pengirim, heuristicDraft.asalSurat)
    ),
    perihal: preferFilledString(liveDraft.perihal, heuristicDraft.perihal),
    assignedUnit: preferFilledString(liveDraft.assignedUnit, heuristicDraft.assignedUnit),
    confidentiality: liveDraft.confidentiality || heuristicDraft.confidentiality,
    tujuanSurat: preferFilledString(liveDraft.tujuanSurat, heuristicDraft.tujuanSurat),
    kodeKlasifikasi: normalizedClassification.kodeKlasifikasi,
    klasifikasi: normalizedClassification.klasifikasi,
    klasifikasiTags: normalizedClassification.klasifikasiTags,
    ringkasan: normalizeLetterDraftCoreSummary({
      summary: preferFilledString(liveDraft.ringkasan, heuristicDraft.ringkasan),
      extractedText,
      subject: preferFilledString(liveDraft.perihal, heuristicDraft.perihal),
    }),
    tags: mergeStringList(heuristicDraft.tags, liveDraft.tags).slice(0, 6),
    lampiran: mergeStringList(heuristicDraft.lampiran, liveDraft.lampiran),
    suggestedTargetUserId: preferFilledString(
      liveDraft.suggestedTargetUserId,
      heuristicDraft.suggestedTargetUserId
    ),
    suggestedTargetPositionId: preferFilledString(
      liveDraft.suggestedTargetPositionId,
      heuristicDraft.suggestedTargetPositionId
    ),
    aiReviewNote:
      liveDraftResult.ok
        ? liveDraft.aiReviewNote ||
          "Draft berhasil dibentuk dari provider AI aktif. Tetap verifikasi nomor, tanggal surat, tanggal terima/kirim, klasifikasi, tujuan, dan ringkasan sebelum menyimpan."
        : `${heuristicDraft.aiReviewNote} ${liveDraftResult.message ?? ""}`.trim(),
  }, aiConfig);

  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "AI_EXTRACT_SURAT",
    entityType: "ai_draft",
    entityId: `surat-${type}`,
    payload: {
      providerId: activeProviderId,
      modelId: activeModelId,
      activeConnectionId: aiConfig.activeConnectionId ?? null,
    },
  });

  return {
    verifyBeforeSave: true,
    provider: {
      id: activeProvider?.id ?? aiConfig.activeConnectionId ?? activeProviderId,
      name: activeProvider?.providerName ?? activeProvider?.name ?? activeProviderId,
      connectionLabel: activeProvider?.name ?? null,
      modelId: liveDraftResult.providerModelId,
      language: aiConfig.primaryLanguage,
      connectionStatus: activeProvider?.connectionStatus ?? "idle",
    },
    relatedRegulations: relatedRegulations.map((item) => ({
      id: item.id,
      title: item.title,
      citation: item.citation,
      summary: item.summary,
    })),
    draft,
  };
}

export async function generateDispositionSuggestionInDb(
  db: AletaDatabase,
  {
    actorUserId,
    letterId,
    currentInstruction,
    targetOptions,
  }: {
    actorUserId: string;
    letterId: string;
    currentInstruction: string;
    targetOptions: { id: string; label: string }[];
  }
) {
  const actor = await requireActorUser(db, actorUserId);
  const letter = await getLetterByIdFromDb(db, letterId);

  if (!letter) {
    throw new ApiError(404, "Surat yang diminta tidak ditemukan atau sudah dihapus.");
  }

  const aiConfig = resolveAIConfigForModule(
    await getAISettingsFromDb(db, { includeSecrets: true }),
    "manajemen_surat"
  );
  const featureFlags = getResolvedFeatureFlags(aiConfig);

  // Global AI disabled → delegate to insight layer which returns source:"disabled" fallback.
  // Feature-level disabled → still throw so callers know the specific feature is off.
  if (aiConfig.enabled) {
    if (!aiConfig.featureDisposisiAi || !featureFlags.oneStopDisposition.enabled) {
      throw new ApiError(409, "Fitur One Stop Disposition AI sedang dinonaktifkan oleh administrator.");
    }
    if (!featureFlags.oneStopDisposition.recommendation) {
      throw new ApiError(409, "Analisis rekomendasi disposisi AI sedang dinonaktifkan oleh administrator.");
    }
  }

  const timeline = await getDispositionsByLetterIdFromDb(db, letterId);
  const sanitizedTargets = Array.isArray(targetOptions)
    ? targetOptions
        .filter(
          (option): option is { id: string; label: string } =>
            Boolean(option) && typeof option.id === "string" && typeof option.label === "string"
        )
        .slice(0, 12)
    : [];
  const normalizedInstruction = typeof currentInstruction === "string" ? currentInstruction : "";

  const insight = await generateDispositionSuggestionInsight(db, {
    letter,
    timeline,
    currentInstruction: normalizedInstruction,
    targetOptions: sanitizedTargets,
    aiConfig,
  });

  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "AI_DISPOSITION_SUGGESTION",
    entityType: "letter",
    entityId: letter.id,
    payload: {
      source: insight.source,
      providerId: insight.provider.providerId,
      modelId: insight.provider.modelId,
      providerModelId: insight.provider.providerModelId,
      connectionId: insight.provider.connectionId,
      isLive: insight.provider.isLive,
      confidenceLevel: insight.confidence.level,
      priorityLevel: insight.priority.level,
      suggestedTargetPositionId: insight.suggestedTargetPositionId,
    },
  });

  return insight;
}

export async function generateMailIntelligenceInDb(
  db: AletaDatabase,
  {
    actorUserId,
    letterId,
  }: {
    actorUserId: string;
    letterId: string;
  }
) {
  const actor = await requireActorUser(db, actorUserId);
  const letter = await getLetterByIdFromDb(db, letterId);

  if (!letter) {
    throw new ApiError(404, "Surat yang diminta tidak ditemukan atau sudah dihapus.");
  }

  const aiConfig = resolveAIConfigForModule(
    await getAISettingsFromDb(db, { includeSecrets: true }),
    "manajemen_surat"
  );
  const featureFlags = getResolvedFeatureFlags(aiConfig);

  // Global AI disabled → delegate to insight layer which returns source:"disabled" fallback.
  if (aiConfig.enabled) {
    if (!aiConfig.featureManajemenSuratAi || !featureFlags.mailIntelligence.enabled) {
      throw new ApiError(409, "Fitur ALETA Intelligence Service sedang dinonaktifkan oleh administrator.");
    }
    if (!featureFlags.mailIntelligence.summary && !featureFlags.mailIntelligence.findings) {
      throw new ApiError(409, "Subfitur utama ALETA Intelligence Service sedang dinonaktifkan oleh administrator.");
    }
  }

  const timeline = await getDispositionsByLetterIdFromDb(db, letterId);
  const insight = await generateMailIntelligenceInsight(db, {
    letter,
    timeline,
    aiConfig,
  });

  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "AI_MAIL_INTELLIGENCE",
    entityType: "letter",
    entityId: letter.id,
    payload: {
      source: insight.source,
      providerId: insight.provider.providerId,
      modelId: insight.provider.modelId,
      providerModelId: insight.provider.providerModelId,
      connectionId: insight.provider.connectionId,
      isLive: insight.provider.isLive,
      confidenceLevel: insight.confidence.level,
      priorityLevel: insight.priority.level,
    },
  });

  return insight;
}

export async function suggestCourtNameInDb(
  db: AletaDatabase,
  {
    actorUserId,
    query,
  }: {
    actorUserId: string;
    query: string;
  }
) {
  await requireActorUser(db, actorUserId);
  const aiConfig = await getAISettingsFromDb(db, { includeSecrets: true })
    .then((config) => resolveAIConfigForModule(config, "manajemen_surat"))
    .catch(() => null);

  const catalogResults = searchCourtDirectory(query).slice(0, 8);
  const catalogSuggestions = catalogResults.map((entry) => ({
    id: entry.id,
    courtName: entry.courtName,
    satkerLabel: entry.satkerLabel,
    identity: entry.identity,
    source: "catalog" as const,
  }));

  type CourtSuggestion = { id: string; courtName: string; satkerLabel: string; identity: typeof catalogSuggestions[number]["identity"]; source: "catalog" | "ai" };
  let usedAIFallback = false;
  let aiSuggestions: CourtSuggestion[] = [];
  const identityFeatureFlags = aiConfig ? getResolvedFeatureFlags(aiConfig).institutionIdentity : null;

  if (
    catalogResults.length < 3 &&
    aiConfig?.enabled &&
    identityFeatureFlags?.enabled &&
    identityFeatureFlags.courtNameSuggestion &&
    query.trim().length >= 3
  ) {
    const activeProvider = resolveLiveAIConnection(aiConfig);
    if (activeProvider?.apiKey?.trim()) {
      const resolvedProviderId = activeProvider.providerId ?? aiConfig.providerId;
      const resolvedModelId = activeProvider.modelId ?? aiConfig.modelId;
      const aiResult = await requestStructuredDataFromProvider<string[]>({
        providerId: resolvedProviderId,
        endpointUrl: activeProvider.endpointUrl ?? getProviderEndpoint(resolvedProviderId),
        apiKey: activeProvider.apiKey,
        modelId: resolvedModelId,
        fallback: [],
        systemPrompt:
          "Anda adalah direktori pengadilan Indonesia. Berikan daftar nama lengkap pengadilan resmi Indonesia yang paling relevan dengan query. Balas HANYA JSON array string berisi nama-nama pengadilan formal (mis: \"Pengadilan Agama Palu Kelas IA\", \"Pengadilan Negeri Donggala\"). Tanpa penjelasan, tanpa markdown.",
        userPrompt: `Query pencarian: "${query.trim()}"\nKembalikan hingga 5 nama pengadilan Indonesia yang paling cocok sebagai JSON array string. Contoh format: ["Nama Pengadilan 1", "Nama Pengadilan 2"]`,
      });

      if (aiResult.ok && Array.isArray(aiResult.data)) {
        const seen = new Set(catalogSuggestions.map((s) => s.courtName.toLowerCase()));
        aiSuggestions = aiResult.data
          .filter((name): name is string => typeof name === "string" && name.trim().length > 3)
          .slice(0, 5)
          .map((courtName) => courtName.trim())
          .filter((courtName) => !seen.has(courtName.toLowerCase()))
          .map((courtName) => {
            const existing = getCourtDirectoryEntryByName(courtName);
            const satker = courtName.startsWith("Pengadilan Tinggi Agama ")
              ? "Peradilan Agama Tingkat Banding"
              : courtName.startsWith("Pengadilan Agama ")
                ? "Peradilan Agama Tingkat Pertama"
                : courtName.startsWith("Pengadilan Tinggi ")
                  ? "Peradilan Umum Tingkat Banding"
                  : courtName.startsWith("Pengadilan Negeri ")
                    ? "Peradilan Umum Tingkat Pertama"
                    : "Satuan Kerja Peradilan";
            return {
              id: `ai-${courtName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
              courtName,
              satkerLabel: existing?.satkerLabel ?? satker,
              identity: existing?.identity ?? buildDerivedCourtIdentity(courtName),
              source: "ai" as const,
            };
          });
        usedAIFallback = aiSuggestions.length > 0;
      }
    }
  }

  const mergedSuggestions = [...catalogSuggestions, ...aiSuggestions].slice(0, 8);
  const exactMatch = getCourtDirectoryEntryByName(query);

  return {
    query,
    suggestions: mergedSuggestions,
    resolvedIdentity: exactMatch?.identity ?? (query.trim() ? buildDerivedCourtIdentity(query.trim()) : null),
    providerId: aiConfig?.enabled ? aiConfig.providerId : null,
    modelId: aiConfig?.enabled ? aiConfig.modelId : null,
    usesCatalogAsPrimarySource: true,
    usedAIFallback,
    enrichmentAvailable: Boolean(aiConfig?.enabled),
    timestamp: new Date().toISOString(),
  };
}
