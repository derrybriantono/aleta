import { type AIFeatureFlags, type AIFeatureModuleKey } from "@/lib/types";

export type PartialAIFeatureFlags = {
  [ModuleKey in keyof AIFeatureFlags]?: Partial<AIFeatureFlags[ModuleKey]>;
};

export const defaultAIFeatureFlags: AIFeatureFlags = {
  oneStopDisposition: {
    enabled: true,
    recommendation: true,
    priorityDetection: true,
    targetSuggestion: true,
    instructionSuggestion: true,
    autofill: true,
    rationale: true,
    diagnostics: true,
  },
  mailIntelligence: {
    enabled: true,
    summary: true,
    findings: true,
    recommendedActions: true,
    relatedRegulations: true,
    riskNotes: true,
    diagnostics: true,
  },
  draftMetadata: {
    enabled: true,
    nomorSurat: true,
    tanggalSurat: true,
    tanggalTerima: true,
    asalSurat: true,
    perihal: true,
    kodeKlasifikasi: true,
    klasifikasiSurat: true,
    tagSurat: true,
    tagAsalSurat: true,
    ocrCheck: true,
    aiReviewNote: true,
  },
  institutionIdentity: {
    enabled: true,
    courtNameSuggestion: true,
    identityEnrichment: true,
    googleDiscovery: true,
    officialWebsiteExtraction: true,
    aiNormalization: true,
    diagnostics: true,
  },
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function coerceBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function mergeModuleFlags<ModuleKey extends keyof AIFeatureFlags>(
  moduleKey: ModuleKey,
  override: unknown
): AIFeatureFlags[ModuleKey] {
  const defaults = defaultAIFeatureFlags[moduleKey];
  if (!isPlainRecord(override)) {
    return { ...defaults };
  }

  return Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => [
      key,
      coerceBoolean(override[key], defaultValue),
    ])
  ) as unknown as AIFeatureFlags[ModuleKey];
}

export function normalizeAIFeatureFlags(source?: unknown): AIFeatureFlags {
  const record = isPlainRecord(source) ? source : {};
  return {
    oneStopDisposition: mergeModuleFlags("oneStopDisposition", record.oneStopDisposition),
    mailIntelligence: mergeModuleFlags("mailIntelligence", record.mailIntelligence),
    draftMetadata: mergeModuleFlags("draftMetadata", record.draftMetadata),
    institutionIdentity: mergeModuleFlags("institutionIdentity", record.institutionIdentity),
  };
}

export function mergeAIFeatureFlags(
  base: unknown,
  override?: unknown
): AIFeatureFlags {
  const current = normalizeAIFeatureFlags(base);
  const patch = isPlainRecord(override) ? override : {};

  return {
    oneStopDisposition: mergeModuleFlags("oneStopDisposition", {
      ...current.oneStopDisposition,
      ...(isPlainRecord(patch.oneStopDisposition) ? patch.oneStopDisposition : {}),
    }),
    mailIntelligence: mergeModuleFlags("mailIntelligence", {
      ...current.mailIntelligence,
      ...(isPlainRecord(patch.mailIntelligence) ? patch.mailIntelligence : {}),
    }),
    draftMetadata: mergeModuleFlags("draftMetadata", {
      ...current.draftMetadata,
      ...(isPlainRecord(patch.draftMetadata) ? patch.draftMetadata : {}),
    }),
    institutionIdentity: mergeModuleFlags("institutionIdentity", {
      ...current.institutionIdentity,
      ...(isPlainRecord(patch.institutionIdentity) ? patch.institutionIdentity : {}),
    }),
  };
}

export function applyLegacyAIFeatureToggles(
  flags: AIFeatureFlags,
  legacy: Partial<{
    featureDispositionAi: boolean;
    featureMailIntelligence: boolean;
    featureDraftMetadata: boolean;
    featureManajemenSuratAi: boolean;
    featureDisposisiAi: boolean;
  }>
): AIFeatureFlags {
  const next = normalizeAIFeatureFlags(flags);
  const manajemenSuratEnabled = legacy.featureManajemenSuratAi ?? true;
  const disposisiEnabled = legacy.featureDisposisiAi ?? true;

  return {
    ...next,
    oneStopDisposition: {
      ...next.oneStopDisposition,
      enabled: (legacy.featureDispositionAi ?? next.oneStopDisposition.enabled) && disposisiEnabled,
    },
    mailIntelligence: {
      ...next.mailIntelligence,
      enabled: (legacy.featureMailIntelligence ?? next.mailIntelligence.enabled) && manajemenSuratEnabled,
    },
    draftMetadata: {
      ...next.draftMetadata,
      enabled: (legacy.featureDraftMetadata ?? next.draftMetadata.enabled) && manajemenSuratEnabled,
    },
  };
}

export function isAIFeatureModuleEnabled(
  flags: AIFeatureFlags | undefined,
  moduleKey: AIFeatureModuleKey
) {
  return normalizeAIFeatureFlags(flags)[moduleKey].enabled;
}
