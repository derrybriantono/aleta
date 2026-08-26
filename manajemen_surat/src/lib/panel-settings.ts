import {
  type ExternalAppId,
  type ExternalAppLaunchSettings,
  type FooterMode,
  type PanelSettings,
  type PortalCardVisibility,
  type PublicAccessSettings,
} from "@/lib/types";

export const DEFAULT_PORTAL_CARD_VISIBILITY: PortalCardVisibility = {
  workSummary: true,
  mainMenu: true,
  importantTasks: true,
};

export const DEFAULT_PUBLIC_ACCESS_SETTINGS: PublicAccessSettings = {
  publicUrl: "",
  method: "domain",
  notes: "",
};

export const DEFAULT_EXTERNAL_APP_SETTINGS: Record<ExternalAppId, ExternalAppLaunchSettings> = {
  sipp: {
    appId: "sipp",
    enabled: true,
    baseUrl: "http://localhost/sipp",
    loginPath: "index.php/login",
    usernameField: "username",
    passwordField: "password",
    passwordMode: "plain",
    notes: "Sesuaikan dengan URL SIPP aktif di satker.",
  },
  "aps-badilag": {
    appId: "aps-badilag",
    enabled: true,
    baseUrl: "http://localhost/aps_badilag",
    loginPath: "index.php/login",
    usernameField: "username",
    passwordField: "password",
    passwordMode: "plain",
    notes: "APS Badilag biasanya memakai akun yang tersinkron dengan database SIPP.",
  },
};

export const DEFAULT_PANEL_SETTINGS: PanelSettings = {
  footerMode: "auto",
  portalCards: DEFAULT_PORTAL_CARD_VISIBILITY,
  publicAccess: DEFAULT_PUBLIC_ACCESS_SETTINGS,
  externalApps: DEFAULT_EXTERNAL_APP_SETTINGS,
};

export function isFooterMode(value: unknown): value is FooterMode {
  return value === "auto" || value === "compact" || value === "full";
}

export function normalizePanelSettings(
  value:
    | {
        footerMode?: unknown;
        portalCards?: unknown;
        publicAccess?: unknown;
        externalApps?: unknown;
        updatedAt?: unknown;
      }
    | null
    | undefined
): PanelSettings {
  return {
    footerMode: isFooterMode(value?.footerMode) ? value.footerMode : DEFAULT_PANEL_SETTINGS.footerMode,
    portalCards: normalizePortalCardVisibility(value?.portalCards),
    publicAccess: normalizePublicAccessSettings(value?.publicAccess),
    externalApps: normalizeExternalAppSettings(value?.externalApps),
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : undefined,
  };
}

export function normalizePortalCardVisibility(value: unknown): PortalCardVisibility {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<Record<keyof PortalCardVisibility, unknown>>)
    : {};

  return {
    workSummary: typeof source.workSummary === "boolean" ? source.workSummary : DEFAULT_PORTAL_CARD_VISIBILITY.workSummary,
    mainMenu: typeof source.mainMenu === "boolean" ? source.mainMenu : DEFAULT_PORTAL_CARD_VISIBILITY.mainMenu,
    importantTasks: typeof source.importantTasks === "boolean" ? source.importantTasks : DEFAULT_PORTAL_CARD_VISIBILITY.importantTasks,
  };
}

export function normalizePublicAccessSettings(value: unknown): PublicAccessSettings {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<Record<keyof PublicAccessSettings, unknown>>)
    : {};
  const method =
    source.method === "domain" || source.method === "cloudflare-tunnel" || source.method === "vpn"
      ? source.method
      : DEFAULT_PUBLIC_ACCESS_SETTINGS.method;

  return {
    publicUrl: typeof source.publicUrl === "string" ? normalizePublicUrl(source.publicUrl) : "",
    method,
    notes: typeof source.notes === "string" ? source.notes.trim().slice(0, 800) : "",
  };
}

export function normalizePublicUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return trimmed;
  }
}

export function normalizeExternalAppSettings(value: unknown): Record<ExternalAppId, ExternalAppLaunchSettings> {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Partial<Record<ExternalAppId, Partial<ExternalAppLaunchSettings>>>)
    : {};

  return {
    sipp: normalizeExternalAppSetting("sipp", source.sipp),
    "aps-badilag": normalizeExternalAppSetting("aps-badilag", source["aps-badilag"]),
  };
}

function normalizeExternalAppSetting(
  appId: ExternalAppId,
  value: Partial<ExternalAppLaunchSettings> | null | undefined
): ExternalAppLaunchSettings {
  const fallback = DEFAULT_EXTERNAL_APP_SETTINGS[appId];
  const passwordMode = value?.passwordMode === "md5" ? "md5" : "plain";
  const baseUrl = typeof value?.baseUrl === "string" ? normalizePublicUrl(value.baseUrl) : fallback.baseUrl;
  const loginPath = typeof value?.loginPath === "string"
    ? normalizePathLike(value.loginPath) || fallback.loginPath
    : fallback.loginPath;
  const usernameField = typeof value?.usernameField === "string"
    ? normalizeFieldName(value.usernameField) || fallback.usernameField
    : fallback.usernameField;
  const passwordField = typeof value?.passwordField === "string"
    ? normalizeFieldName(value.passwordField) || fallback.passwordField
    : fallback.passwordField;

  return {
    appId,
    enabled: typeof value?.enabled === "boolean" ? value.enabled : fallback.enabled,
    baseUrl: baseUrl || fallback.baseUrl,
    loginPath,
    usernameField,
    passwordField,
    passwordMode,
    notes: typeof value?.notes === "string" ? value.notes.trim().slice(0, 800) : fallback.notes,
  };
}

function normalizePathLike(value: string) {
  return value.trim().replace(/^\/+/, "").slice(0, 200);
}

function normalizeFieldName(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_\-[\].]/g, "").slice(0, 80);
}
