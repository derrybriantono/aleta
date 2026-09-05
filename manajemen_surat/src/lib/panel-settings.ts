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

/**
 * loginPath menunjuk HALAMAN MASUK, bukan pemeriksa sandinya.
 *
 * ============================================================================
 * JANGAN DIGANTI MENJADI "login/validation_credential"
 * ============================================================================
 *
 * Menggoda, sebab alur itulah yang benar-benar memeriksa sandi - lihat
 * form_open() pada application/views/Login/login.php milik SIPP. Tetapi nilai
 * ini bukan sasaran pengiriman: jembatan SSO MENGAMBIL alamat ini lalu
 * MEMBACA formulir di dalamnya, dan sasaran pengiriman yang sesungguhnya
 * diambil dari atribut action formulir itu. Lihat buildExternalAppLaunchHtml -
 * cfg.actionUrl dipakai pada fetch(), bukan pada form.action.
 *
 * Mengarahkannya ke pemeriksa sandi berarti mengambil alamat yang tanpa POST
 * hanya memantul ke login/index/ERR. Formulirnya mungkin masih terbaca, tetapi
 * lewat jalan memutar dan dalam keadaan galat - persis kerapuhan yang sedang
 * dihindari.
 *
 * Awalan "index.php/" pun tidak apa-apa DI SINI. Ia memang kena
 * "RewriteRule ^index.php/(.*)$ /SIPP/$1 [R=302,L]" pada .htaccess SIPP, tetapi
 * pengalihan 302 atas sebuah GET diikuti peramban dengan wajar. Yang berbahaya
 * adalah 302 atas POST - itu membuang isian formulirnya - dan POST di sini
 * tidak pernah menuju alamat ini.
 */
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

/** Alamat yang boleh dipasang sebagai pintu: hanya http dan https. */
function alamatAman(nilai: unknown): string {
  const teks = String(nilai ?? "").trim();
  if (!teks) return "";
  try {
    const alamat = new URL(teks);
    return alamat.protocol === "http:" || alamat.protocol === "https:" ? alamat.toString() : "";
  } catch {
    return "";
  }
}

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
        pintuAiBebas?: unknown;
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
    // Hanya alamat http/https yang diterima. Alamat berskema lain -
    // javascript:, data: - akan dijalankan peramban sebagai kode saat pintunya
    // ditekan, dan yang menekannya mengira sedang membuka tab biasa.
    pintuAiBebas: alamatAman(value?.pintuAiBebas),
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

  // SIPP TIDAK PERNAH menerima md5, dan pilihan itu ditolak di sini alih-alih
  // dibiarkan menjadi kegagalan diam-diam.
  //
  // validate() pada application/models/Login/validation_user.php mengacak
  // sendiri di sisi server: arr2md5(kode_aktivasi, sandi) atas sandi POLOS
  // yang dikirim, lalu dibandingkan dengan sys_users.password. Mengirim md5
  // berarti teracak dua kali - hasilnya tidak akan pernah cocok, betapa pun
  // benar sandinya.
  //
  // Yang terjadi kemudian: SIPP memantulkan ke login/index/ERR, dan
  // pemakainya hanya melihat halaman masuk terbuka kosong. Tidak ada pesan
  // kesalahan sama sekali. Pemasangan yang berjalan sekarang tersimpan dengan
  // nilai "md5" - inilah sebabnya masuk otomatis tidak pernah bekerja.
  //
  // APS Badilag dibiarkan memilih sendiri; alamat masuknya belum pernah
  // diperiksa langsung, jadi tidak ada yang boleh disimpulkan tentangnya.
  const passwordMode = appId === "sipp"
    ? "plain"
    : value?.passwordMode === "md5" ? "md5" : "plain";
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
