import type { AletaDatabase } from "@/server/db/client";
import { getAISettingsFromDb, resolveAIConfigForModule } from "@/server/modules/ai/service";

export async function getGlobalAiStatus(db: AletaDatabase) {
  const globalSettings = await getAISettingsFromDb(db, { includeSecrets: false });
  const settings = resolveAIConfigForModule(globalSettings, "jlf");
  const moduleConfig = globalSettings.moduleConfigs.find((item) => item.moduleKey === "jlf") ?? null;
  const activeProvider = settings.providers.find((provider) => provider.id === settings.activeConnectionId)
    ?? settings.providers.find((provider) => provider.isActive)
    ?? null;

  return {
    enabled: settings.enabled,
    providerId: settings.providerId,
    modelId: settings.modelId,
    activeConnectionId: settings.activeConnectionId ?? null,
    activeConnectionLabel: activeProvider?.name ?? null,
    activeConnectionStatus: activeProvider?.connectionStatus ?? "idle",
    providersCount: settings.providers.length,
    liveProvidersCount: settings.providers.filter((provider) => provider.connectionStatus === "connected").length,
    primaryLanguage: settings.primaryLanguage,
    moduleConfig,
    featureFlags: settings.featureFlags,
  };
}

export async function getAvailableProvidersSummary(db: AletaDatabase) {
  const settings = await getAISettingsFromDb(db, { includeSecrets: false });

  return settings.providers.map((provider) => ({
    id: provider.id,
    providerId: provider.providerId ?? provider.id,
    providerName: provider.providerName ?? provider.name,
    label: provider.name,
    modelId: provider.modelId ?? "",
    models: provider.models,
    connectionStatus: provider.connectionStatus ?? "idle",
    isActive: Boolean(provider.isActive),
    builtin: Boolean(provider.builtin),
    hasMaskedApiKey: Boolean(provider.maskedApiKey),
    lastTestedAt: provider.lastTestedAt ?? null,
    lastConnectionMessage: provider.lastConnectionMessage ?? null,
  }));
}

export async function isGlobalAiEnabled(db: AletaDatabase) {
  return (await getGlobalAiStatus(db)).enabled;
}

export async function getSafeAiSettingsSummary(db: AletaDatabase) {
  return {
    status: await getGlobalAiStatus(db),
    providers: await getAvailableProvidersSummary(db),
    policy: {
      usesGlobalAletaAiSettings: true,
      createsSeparateProvider: false,
      exposesApiKey: false,
      callsProviderInThisStage: false,
    },
  };
}

export const JlfGlobalAiSettingsReader = {
  getGlobalAiStatus,
  getAvailableProvidersSummary,
  isGlobalAiEnabled,
  getSafeAiSettingsSummary,
};
