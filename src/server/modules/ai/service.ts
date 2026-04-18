import { and, desc, eq, isNull } from "drizzle-orm";
import { type QueryResultRow } from "pg";

import { runAletaIntelligence } from "@/core/intelligence/aleta-intelligence-service";
import { getAIProviderById, popularAIProviderCatalog } from "@/lib/ai-catalog";
import { buildDerivedCourtIdentity, getCourtDirectoryEntryByName, searchCourtDirectory } from "@/lib/court-catalog";
import { normalizeLetterClassificationDraft } from "@/lib/letter-taxonomy";
import { canManageGlobalAI } from "@/lib/permissions";
import { type AIGlobalConfig, type AIProviderConfig, type LetterType } from "@/lib/types";
import {
  generateDispositionAssist,
  generateLetterDraftFromPdf,
} from "@/modules/manajemen-surat/services/letter-draft-ai";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { aiGlobalSettings, aiProviders } from "@/server/db/drizzle-schema";
import {
  requestStructuredDataFromProvider,
  testProviderConnection,
} from "@/server/modules/ai/provider-client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import { parseJsonArray, stringifyJson, toBooleanInt } from "@/server/shared/json";
import { isLikelyConnectedApiKey } from "@/server/shared/security";
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
  primary_language: "id" | "en";
};

type AIProviderRow = QueryResultRow & {
  id: string;
  name: string;
  endpoint_url: string | null;
  api_key: string;
  models_json: string;
  builtin: number;
  connection_status: string;
  is_active: number;
};

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

function mapProviderRow(row: AIProviderRow): AIProviderConfig {
  return {
    id: row.id,
    name: row.name,
    apiKey: row.api_key,
    endpointUrl: row.endpoint_url ?? undefined,
    models: parseJsonArray<string>(row.models_json),
    builtin: Boolean(row.builtin),
    connectionStatus: row.connection_status as AIProviderConfig["connectionStatus"],
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

export async function getAISettingsFromDb(db: AletaDatabase): Promise<AIGlobalConfig> {
  if (!db.supportsFullTextSearch()) {
    const settings = await db.prepare(
      `SELECT enabled, active_provider_id, active_model_id, primary_language
       FROM ai_global_settings
       WHERE id = 1`
    ).get<AISettingsRow>();
    const providers = await db.prepare(
      `SELECT id, name, endpoint_url, api_key, models_json, builtin, connection_status, is_active
       FROM ai_providers
       WHERE deleted_at IS NULL
       ORDER BY builtin DESC, name ASC`
    ).all<AIProviderRow>();

    if (!settings) {
      throw new ApiError(500, "Konfigurasi global AI belum ditemukan di database.");
    }

    return {
      enabled: Boolean(settings.enabled),
      providerId: settings.active_provider_id,
      modelId: settings.active_model_id,
      primaryLanguage: settings.primary_language as "id" | "en",
      providers: providers.map((row) => mapProviderRow(row)),
    };
  }

  const settings = await db.getOrm().select({
    enabled: aiGlobalSettings.enabled,
    active_provider_id: aiGlobalSettings.activeProviderId,
    active_model_id: aiGlobalSettings.activeModelId,
    primary_language: aiGlobalSettings.primaryLanguage,
  }).from(aiGlobalSettings)
    .where(eq(aiGlobalSettings.id, 1))
    .then((rows) => rows[0]);
  const providers = await db.getOrm().select({
    id: aiProviders.id,
    name: aiProviders.name,
    endpoint_url: aiProviders.endpointUrl,
    api_key: aiProviders.apiKey,
    models_json: aiProviders.modelsJson,
    builtin: aiProviders.builtin,
    connection_status: aiProviders.connectionStatus,
    is_active: aiProviders.isActive,
  }).from(aiProviders)
    .where(isNull(aiProviders.deletedAt))
    .orderBy(desc(aiProviders.builtin), aiProviders.name);

  if (!settings) {
    throw new ApiError(500, "Konfigurasi global AI belum ditemukan di database.");
  }

  return {
    enabled: Boolean(settings.enabled),
    providerId: settings.active_provider_id,
    modelId: settings.active_model_id,
    primaryLanguage: settings.primary_language as "id" | "en",
    providers: providers.map((row) => mapProviderRow(row as AIProviderRow)),
  };
}

export async function upsertAISettingsInDb(
  db: AletaDatabase,
  {
    actorUserId,
    enabled,
    providerId,
    modelId,
    primaryLanguage,
    provider,
  }: {
    actorUserId: string;
    enabled?: boolean;
    providerId?: string;
    modelId?: string;
    primaryLanguage?: "id" | "en";
    provider?: {
      id: string;
      name?: string;
      apiKey?: string;
      endpointUrl?: string;
      models?: string[];
      builtin?: boolean;
    };
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (!canManageGlobalAI(actor)) {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengubah konfigurasi AI global.");
  }

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();

    if (provider) {
      const catalogProvider = getAIProviderById(provider.id);
      const providerName = provider.name ?? catalogProvider?.name ?? provider.id;
      const providerModels = Array.from(
        new Set(
          (provider.models && provider.models.length > 0
            ? provider.models
            : catalogProvider?.models ?? ["General Model"]
          ).filter(Boolean)
        )
      );
      const connectionStatus = isLikelyConnectedApiKey(provider.apiKey ?? "") ? "connected" : "idle";

      if (!tx.supportsFullTextSearch()) {
        await tx.prepare(
          `INSERT INTO ai_providers (
            id, name, endpoint_url, api_key, models_json, builtin, connection_status,
            is_active, deleted_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            endpoint_url = excluded.endpoint_url,
            api_key = excluded.api_key,
            models_json = excluded.models_json,
            builtin = excluded.builtin,
            connection_status = excluded.connection_status,
            updated_at = excluded.updated_at,
            deleted_at = NULL`
        ).run(
          provider.id,
          providerName,
          provider.endpointUrl ?? getProviderEndpoint(provider.id),
          provider.apiKey ?? "",
          stringifyJson(providerModels),
          toBooleanInt(provider.builtin ?? Boolean(catalogProvider?.builtin)),
          connectionStatus,
          providerId === provider.id ? 1 : 0,
          null,
          now,
          now
        );
      } else {
        await tx.getOrm().insert(aiProviders).values({
          id: provider.id,
          name: providerName,
          endpointUrl: provider.endpointUrl ?? getProviderEndpoint(provider.id),
          apiKey: provider.apiKey ?? "",
          modelsJson: stringifyJson(providerModels),
          builtin: toBooleanInt(provider.builtin ?? Boolean(catalogProvider?.builtin)),
          connectionStatus,
          isActive: providerId === provider.id ? 1 : 0,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: aiProviders.id,
          set: {
            name: providerName,
            endpointUrl: provider.endpointUrl ?? getProviderEndpoint(provider.id),
            apiKey: provider.apiKey ?? "",
            modelsJson: stringifyJson(providerModels),
            builtin: toBooleanInt(provider.builtin ?? Boolean(catalogProvider?.builtin)),
            connectionStatus,
            updatedAt: now,
            deletedAt: null,
          },
        });
      }
    }

    const current = await getAISettingsFromDb(tx);
    const nextProviderId = providerId ?? provider?.id ?? current.providerId;
    const nextModelId = modelId ?? provider?.models?.[0] ?? current.modelId;
    const nextLanguage = primaryLanguage ?? current.primaryLanguage;
    const nextEnabled = enabled ?? current.enabled;

    if (!tx.supportsFullTextSearch()) {
      await tx.prepare(
        `UPDATE ai_global_settings
         SET enabled = ?, active_provider_id = ?, active_model_id = ?, primary_language = ?, updated_at = ?
         WHERE id = 1`
      ).run(toBooleanInt(nextEnabled), nextProviderId, nextModelId, nextLanguage, now);

      await tx.prepare(
        `UPDATE ai_providers
         SET is_active = 0, updated_at = ?
         WHERE deleted_at IS NULL`
      ).run(now);

      await tx.prepare(
        `UPDATE ai_providers
         SET is_active = 1, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`
      ).run(now, nextProviderId);
    } else {
      await tx.getOrm().update(aiGlobalSettings).set({
        enabled: toBooleanInt(nextEnabled),
        activeProviderId: nextProviderId,
        activeModelId: nextModelId,
        primaryLanguage: nextLanguage,
        updatedAt: now,
      }).where(eq(aiGlobalSettings.id, 1));

      await tx.getOrm().update(aiProviders).set({
        isActive: 0,
        updatedAt: now,
      }).where(isNull(aiProviders.deletedAt));

      await tx.getOrm().update(aiProviders).set({
        isActive: 1,
        updatedAt: now,
      }).where(and(eq(aiProviders.id, nextProviderId), isNull(aiProviders.deletedAt)));
    }

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_AI_SETTINGS",
      entityType: "ai_settings",
      entityId: "global",
      payload: {
        enabled: nextEnabled,
        providerId: nextProviderId,
        modelId: nextModelId,
        primaryLanguage: nextLanguage,
        addedProviderId: provider?.id ?? null,
      },
    });

    return getAISettingsFromDb(tx);
  });
}

export async function testAIProviderConnectionInDb(
  db: AletaDatabase,
  {
    actorUserId,
    providerId,
    apiKey,
  }: {
    actorUserId: string;
    providerId: string;
    apiKey: string;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (!canManageGlobalAI(actor)) {
    throw new ApiError(403, "Hanya Super Admin yang dapat menguji koneksi provider AI.");
  }

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();
    const provider = getAIProviderById(providerId) ?? popularAIProviderCatalog[0];
    const connection = await testProviderConnection({
      providerId,
      endpointUrl: getProviderEndpoint(providerId),
      apiKey,
      modelId: provider.models[0] ?? "general-model",
    });
    const status = connection.ok ? "connected" : "failed";

    if (!tx.supportsFullTextSearch()) {
      await tx.prepare(
        `INSERT INTO ai_providers (
          id, name, endpoint_url, api_key, models_json, builtin, connection_status,
          is_active, deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          api_key = excluded.api_key,
          connection_status = excluded.connection_status,
          endpoint_url = excluded.endpoint_url,
          models_json = excluded.models_json,
          updated_at = excluded.updated_at,
          deleted_at = NULL`
      ).run(
        providerId,
        provider.name,
        getProviderEndpoint(providerId),
        apiKey.trim(),
        stringifyJson(provider.models),
        toBooleanInt(Boolean(provider.builtin)),
        status,
        0,
        null,
        now,
        now
      );
    } else {
      await tx.getOrm().insert(aiProviders).values({
        id: providerId,
        name: provider.name,
        endpointUrl: getProviderEndpoint(providerId),
        apiKey: apiKey.trim(),
        modelsJson: stringifyJson(provider.models),
        builtin: toBooleanInt(Boolean(provider.builtin)),
        connectionStatus: status,
        isActive: 0,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: aiProviders.id,
        set: {
          apiKey: apiKey.trim(),
          connectionStatus: status,
          endpointUrl: getProviderEndpoint(providerId),
          modelsJson: stringifyJson(provider.models),
          updatedAt: now,
          deletedAt: null,
        },
      });
    }

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "TEST_AI_PROVIDER_CONNECTION",
      entityType: "ai_provider",
      entityId: providerId,
      payload: {
        status,
        providerModelId: connection.providerModelId,
        message: connection.message,
      },
    });

    return {
      providerId,
      providerName: provider.name,
      status,
      message:
        status === "connected"
          ? `Provider merespons dengan model ${connection.providerModelId}.`
          : connection.message,
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
  const aiConfig = await getAISettingsFromDb(db);

  if (!aiConfig.enabled) {
    throw new ApiError(409, "ALETA Intelligence Service sedang nonaktif.");
  }

  const suggestedUsers =
    type === "masuk"
      ? await getLeadershipRecipientsFromDb(db)
      : (await getUsersFromDb(db)).filter((user) => user.isActive && user.id !== actor.id);
  const relatedRegulations = await searchRegulationsInDb(db, {
    moduleId: "manajemen-surat",
    entityType: "surat-draft",
    title: extractedText.slice(0, 120),
    content: extractedText,
    tags: ["surat", type, aiConfig.providerId, aiConfig.modelId],
  });
  const heuristicDraft = await generateLetterDraftFromPdf({
    type,
    extractedText,
    aiConfig,
    suggestedUsers,
  });
  const activeProvider = aiConfig.providers.find((provider) => provider.id === aiConfig.providerId) ?? null;
  const liveDraftResult =
    activeProvider?.apiKey?.trim()
      ? await requestStructuredDataFromProvider({
          providerId: aiConfig.providerId,
          endpointUrl: activeProvider.endpointUrl ?? getProviderEndpoint(aiConfig.providerId),
          apiKey: activeProvider.apiKey,
          modelId: aiConfig.modelId,
          fallback: heuristicDraft,
          systemPrompt:
            "Anda membantu aplikasi ALETA memetakan metadata surat dari teks PDF. Balas HANYA JSON tanpa markdown.",
          userPrompt: [
            `Tipe surat: ${type}`,
            "Kembalikan objek JSON dengan properti:",
            "nomorSurat, nomorUrut, pengirim, perihal, assignedUnit, confidentiality, asalSurat, tujuanSurat, kodeKlasifikasi, klasifikasi, klasifikasiTags, ringkasan, tags, lampiran, suggestedTargetUserId, suggestedTargetPositionId, aiReviewNote.",
            "Gunakan string untuk seluruh field tunggal dan array string untuk klasifikasiTags/tags/lampiran.",
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
          providerModelId: aiConfig.modelId,
          rawText: "",
          message: "API key provider AI belum diisi. Sistem memakai fallback heuristik internal.",
        };
  const liveDraft = liveDraftResult.data;
  const normalizedClassification = normalizeLetterClassificationDraft({
    kodeKlasifikasi: liveDraft.kodeKlasifikasi || heuristicDraft.kodeKlasifikasi,
    klasifikasi: liveDraft.klasifikasi || heuristicDraft.klasifikasi,
    klasifikasiTags: mergeStringList(
      heuristicDraft.klasifikasiTags,
      liveDraft.klasifikasiTags,
      relatedRegulations.map((item) => item.title)
    ),
  });
  const draft = {
    ...heuristicDraft,
    ...liveDraft,
    kodeKlasifikasi: normalizedClassification.kodeKlasifikasi,
    klasifikasi: normalizedClassification.klasifikasi,
    klasifikasiTags: normalizedClassification.klasifikasiTags,
    tags: mergeStringList(heuristicDraft.tags, liveDraft.tags).slice(0, 6),
    lampiran: mergeStringList(heuristicDraft.lampiran, liveDraft.lampiran),
    aiReviewNote:
      liveDraftResult.ok
        ? liveDraft.aiReviewNote ||
          "Draft berhasil dibentuk dari provider AI aktif. Tetap verifikasi nomor, klasifikasi, tujuan, dan ringkasan sebelum menyimpan."
        : `${heuristicDraft.aiReviewNote} ${liveDraftResult.message ?? ""}`.trim(),
  };

  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "AI_EXTRACT_SURAT",
    entityType: "ai_draft",
    entityId: `surat-${type}`,
    payload: {
      providerId: aiConfig.providerId,
      modelId: aiConfig.modelId,
    },
  });

  return {
    verifyBeforeSave: true,
    provider: {
      id: activeProvider?.id ?? aiConfig.providerId,
      name: activeProvider?.name ?? aiConfig.providerId,
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

export async function suggestDispositionInDb(
  db: AletaDatabase,
  {
    actorUserId,
    letterSubject,
    letterSummary,
    currentInstruction,
    targetOptions,
  }: {
    actorUserId: string;
    letterSubject: string;
    letterSummary: string;
    currentInstruction: string;
    targetOptions: { id: string; label: string }[];
  }
) {
  const actor = await requireActorUser(db, actorUserId);
  const aiConfig = await getAISettingsFromDb(db);

  if (!aiConfig.enabled) {
    throw new ApiError(409, "ALETA Intelligence Service sedang nonaktif.");
  }

  const quickSuggestion = await generateDispositionAssist({
    letterSubject,
    letterSummary,
    currentInstruction,
    targetOptions,
  });
  const relatedRegulations = await searchRegulationsInDb(db, {
    moduleId: "manajemen-surat",
    entityType: "disposisi",
    title: letterSubject,
    content: `${letterSummary} ${currentInstruction}`.trim(),
    tags: ["disposisi", aiConfig.providerId, aiConfig.modelId],
    metadata: {
      targetLabels: targetOptions.map((item) => item.label),
    },
  });
  const insight = await runAletaIntelligence(
    {
      moduleId: "manajemen-surat",
      entityType: "disposisi",
      title: letterSubject,
      content: letterSummary,
      tags: ["disposisi", aiConfig.providerId, aiConfig.modelId],
      metadata: {
        targetLabels: targetOptions.map((item) => item.label),
      },
    },
    aiConfig
  );
  const activeProvider = aiConfig.providers.find((provider) => provider.id === aiConfig.providerId) ?? null;
  const liveSuggestionResult =
    activeProvider?.apiKey?.trim()
      ? await requestStructuredDataFromProvider({
          providerId: aiConfig.providerId,
          endpointUrl: activeProvider.endpointUrl ?? getProviderEndpoint(aiConfig.providerId),
          apiKey: activeProvider.apiKey,
          modelId: aiConfig.modelId,
          fallback: quickSuggestion,
          systemPrompt:
            "Anda membantu ALETA menyiapkan saran disposisi. Balas HANYA JSON tanpa markdown.",
          userPrompt: [
            "Kembalikan objek JSON dengan properti summary, suggestedInstruction, suggestedTargetLabel.",
            `Perihal surat: ${letterSubject}`,
            `Ringkasan surat: ${letterSummary}`,
            `Instruksi saat ini: ${currentInstruction || "-"}`,
            `Pilihan target: ${stringifyJson(targetOptions)}`,
          ].join("\n"),
        })
      : {
          ok: false,
          data: quickSuggestion,
          providerModelId: aiConfig.modelId,
          rawText: "",
          message: "API key provider AI belum diisi. Sistem memakai fallback heuristik internal.",
        };
  const liveSuggestion = liveSuggestionResult.data;
  const suggestion = {
    summary: liveSuggestion.summary || quickSuggestion.summary,
    suggestedInstruction:
      liveSuggestion.suggestedInstruction || quickSuggestion.suggestedInstruction,
    suggestedTargetLabel:
      liveSuggestion.suggestedTargetLabel || quickSuggestion.suggestedTargetLabel,
  };

  await appendAuditLog(db, {
    id: await nextPrefixedId(db, "audit_logs", "adt"),
    actorUserId: actor.id,
    action: "AI_SUGGEST_DISPOSITION",
    entityType: "ai_disposition",
    entityId: actor.id,
    payload: {
      providerId: aiConfig.providerId,
      modelId: aiConfig.modelId,
    },
  });

  return {
    verifyBeforeSave: true,
    providerId: aiConfig.providerId,
    modelId: liveSuggestionResult.providerModelId,
    suggestion: {
      summary: suggestion.summary,
      suggestedInstruction: suggestion.suggestedInstruction,
      suggestedTargetLabel: suggestion.suggestedTargetLabel,
      relatedRegulations: (relatedRegulations.length > 0 ? relatedRegulations : insight.regulations).map((item) => ({
        id: item.id,
        title: item.title,
        citation: item.citation,
      })),
      rationale:
        relatedRegulations.length > 0
          ? `Saran dibentuk dari ringkasan surat dan knowledge base regulasi ${relatedRegulations
              .map((item) => item.citation)
              .join(", ")}.`
          : liveSuggestionResult.ok
            ? `${insight.rationale} Provider AI aktif membantu menyusun ringkasan dan instruksi awal.`
            : `${insight.rationale} ${liveSuggestionResult.message ?? ""}`.trim(),
    },
  };
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
  const actor = await requireActorUser(db, actorUserId);
  const aiConfig = await getAISettingsFromDb(db);

  if (!aiConfig.enabled) {
    throw new ApiError(409, "ALETA Intelligence Service sedang nonaktif.");
  }

  const suggestions = searchCourtDirectory(query)
    .slice(0, 8)
    .map((entry) => ({
      id: entry.id,
      courtName: entry.courtName,
      satkerLabel: entry.satkerLabel,
      identity: entry.identity,
    }));
  const exactMatch = getCourtDirectoryEntryByName(query);

  return {
    query,
    suggestions,
    resolvedIdentity: exactMatch?.identity ?? (query.trim() ? buildDerivedCourtIdentity(query.trim()) : null),
    providerId: aiConfig.providerId,
    modelId: aiConfig.modelId,
    timestamp: new Date().toISOString(),
  };
}
