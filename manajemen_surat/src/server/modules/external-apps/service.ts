import { DEFAULT_PANEL_SETTINGS, normalizePanelSettings } from "@/lib/panel-settings";
import {
  type ExternalAppCredentialInput,
  type ExternalAppCredentialSummary,
  type ExternalAppId,
  type ExternalAppLaunchSettings,
  type UserPersona,
} from "@/lib/types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import {
  decryptCredentialSecret,
  encryptCredentialSecret,
  hashMd5,
  maskCredentialUsername,
} from "@/server/shared/security";

type ExternalCredentialRow = {
  id: string;
  user_id: string;
  app_id: string;
  external_username: string;
  encrypted_password: string;
  password_md5_hash: string;
  is_enabled: number;
  last_verified_at: string | null;
  last_verified_status: string;
  last_launch_at: string | null;
  password_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

type ExternalAppConfig = {
  id: ExternalAppId;
  label: string;
  defaultBaseUrl: string;
  baseUrlEnvKeys: string[];
  loginPathEnvKey: string;
  defaultLoginPath: string;
  usernameFieldEnvKey: string;
  passwordFieldEnvKey: string;
  passwordModeEnvKey: string;
  defaultUsernameField: string;
  defaultPasswordField: string;
};

const EXTERNAL_APP_CONFIGS: Record<ExternalAppId, ExternalAppConfig> = {
  sipp: {
    id: "sipp",
    label: "SIPP",
    defaultBaseUrl: "http://localhost/sipp",
    baseUrlEnvKeys: ["ALETA_SIPP_BASE_URL", "ALETA_SIPP_URL", "SIPP_BASE_URL", "SIPP_URL"],
    loginPathEnvKey: "ALETA_SIPP_LOGIN_PATH",
    defaultLoginPath: "index.php/login",
    usernameFieldEnvKey: "ALETA_SIPP_USERNAME_FIELD",
    passwordFieldEnvKey: "ALETA_SIPP_PASSWORD_FIELD",
    passwordModeEnvKey: "ALETA_SIPP_PASSWORD_MODE",
    defaultUsernameField: "username",
    defaultPasswordField: "password",
  },
  "aps-badilag": {
    id: "aps-badilag",
    label: "APS Badilag",
    defaultBaseUrl: "http://localhost/aps_badilag",
    baseUrlEnvKeys: ["ALETA_APS_BADILAG_BASE_URL", "ALETA_APS_BADILAG_URL", "APS_BADILAG_BASE_URL", "APS_BADILAG_URL"],
    loginPathEnvKey: "ALETA_APS_BADILAG_LOGIN_PATH",
    defaultLoginPath: "index.php/login",
    usernameFieldEnvKey: "ALETA_APS_BADILAG_USERNAME_FIELD",
    passwordFieldEnvKey: "ALETA_APS_BADILAG_PASSWORD_FIELD",
    passwordModeEnvKey: "ALETA_APS_BADILAG_PASSWORD_MODE",
    defaultUsernameField: "username",
    defaultPasswordField: "password",
  },
};

function normalizeAppId(value: string): ExternalAppId {
  if (value === "sipp" || value === "aps-badilag") return value;
  if (value === "aps_badilag" || value === "aps") return "aps-badilag";
  throw new ApiError(404, "Aplikasi eksternal tidak dikenal.");
}

function getCredentialSourceAppId(appId: ExternalAppId): ExternalAppId {
  return appId === "aps-badilag" ? "sipp" : appId;
}

function nowIso() {
  return new Date().toISOString();
}

function readEnv(keys: string[]) {
  for (const key of keys) {
    const value = String(process.env[key] ?? "").trim();
    if (value) return value;
  }
  return "";
}

function parseJsonObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

function joinUrl(baseUrl: string, path: string) {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const suffix = path.trim().replace(/^\/+/, "");
  if (!suffix) return base;
  return `${base}/${suffix}`;
}

async function getLaunchSettingsFromDb(db: AletaDatabase, appId: ExternalAppId): Promise<ExternalAppLaunchSettings> {
  const row = await db.prepare(
    `SELECT external_apps_json
     FROM panel_settings
     WHERE id = 1`
  ).get<{ external_apps_json: string }>();

  if (row) {
    const panelSettings = normalizePanelSettings({
      externalApps: parseJsonObject(row.external_apps_json, DEFAULT_PANEL_SETTINGS.externalApps),
    });
    return panelSettings.externalApps[appId];
  }

  const config = EXTERNAL_APP_CONFIGS[appId];
  return {
    ...DEFAULT_PANEL_SETTINGS.externalApps[appId],
    baseUrl: readEnv(config.baseUrlEnvKeys) || DEFAULT_PANEL_SETTINGS.externalApps[appId].baseUrl,
    loginPath: String(process.env[config.loginPathEnvKey] ?? DEFAULT_PANEL_SETTINGS.externalApps[appId].loginPath).trim(),
    usernameField: String(process.env[config.usernameFieldEnvKey] ?? DEFAULT_PANEL_SETTINGS.externalApps[appId].usernameField).trim(),
    passwordField: String(process.env[config.passwordFieldEnvKey] ?? DEFAULT_PANEL_SETTINGS.externalApps[appId].passwordField).trim(),
    passwordMode: String(process.env[config.passwordModeEnvKey] ?? DEFAULT_PANEL_SETTINGS.externalApps[appId].passwordMode).trim().toLowerCase() === "md5"
      ? "md5"
      : "plain",
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mapCredential(row: ExternalCredentialRow): ExternalAppCredentialSummary {
  return {
    appId: normalizeAppId(row.app_id),
    username: row.external_username,
    usernameMasked: maskCredentialUsername(row.external_username),
    isEnabled: Boolean(row.is_enabled),
    hasPassword: Boolean(row.encrypted_password),
    passwordUpdatedAt: row.password_updated_at,
    lastVerifiedAt: row.last_verified_at,
    lastVerifiedStatus: row.last_verified_status,
    lastLaunchAt: row.last_launch_at,
  };
}

function normalizeCredentialInput(input: ExternalAppCredentialInput) {
  const appId = getCredentialSourceAppId(normalizeAppId(input.appId));
  const username = String(input.username ?? "").trim();
  const password = typeof input.password === "string" ? input.password : undefined;
  return {
    appId,
    username,
    password,
    isEnabled: Boolean(input.isEnabled),
    clearPassword: Boolean(input.clearPassword),
  };
}

export function getExternalAppLabel(appId: ExternalAppId) {
  return EXTERNAL_APP_CONFIGS[appId].label;
}

/**
 * Mencari pemilik akun berdasarkan username aplikasi eksternal (SIPP/APS).
 *
 * Dipakai agar pegawai bisa login ke ALETA memakai username SIPP yang sudah
 * mereka hafal, tanpa perlu mengingat username ALETA yang berbeda.
 *
 * Ini HANYA untuk menemukan akun. Password tetap diverifikasi memakai password
 * ALETA lewat jalur autentikasi biasa, jadi tidak ada pelemahan autentikasi:
 * yang bertambah cuma cara menyebut "akun yang mana".
 */
export async function findUserIdsByExternalUsername(db: AletaDatabase, username: string) {
  const target = String(username ?? "").trim().toLowerCase();
  if (!target) return [];

  const rows = await db.prepare(
    `SELECT user_id, external_username
     FROM external_app_credentials
     WHERE external_username <> ''`
  ).all<Pick<ExternalCredentialRow, "user_id" | "external_username">>();

  const userIds = new Set<string>();
  for (const row of rows) {
    if (String(row.external_username ?? "").trim().toLowerCase() === target) {
      userIds.add(row.user_id);
    }
  }
  return Array.from(userIds);
}

export async function getExternalCredentialSummariesByUserIds(db: AletaDatabase, userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) return new Map<string, ExternalAppCredentialSummary[]>();

  const placeholders = uniqueUserIds.map(() => "?").join(", ");
  const rows = await db.prepare(
    `SELECT id, user_id, app_id, external_username, encrypted_password, password_md5_hash,
      is_enabled, last_verified_at, last_verified_status, last_launch_at, password_updated_at,
      created_at, updated_at
     FROM external_app_credentials
     WHERE user_id IN (${placeholders})
     ORDER BY app_id ASC`
  ).all<ExternalCredentialRow>(...uniqueUserIds);

  const grouped = new Map<string, ExternalAppCredentialSummary[]>();
  for (const row of rows) {
    grouped.set(row.user_id, [...(grouped.get(row.user_id) ?? []), mapCredential(row)]);
  }
  return grouped;
}

export async function getExternalCredentialSummariesForUser(db: AletaDatabase, userId: string) {
  const grouped = await getExternalCredentialSummariesByUserIds(db, [userId]);
  return grouped.get(userId) ?? [];
}

export async function upsertExternalCredentialsForUser(
  db: AletaDatabase,
  {
    actor,
    userId,
    credentials,
  }: {
    actor: Pick<UserPersona, "id">;
    userId: string;
    credentials?: ExternalAppCredentialInput[];
  }
) {
  if (!credentials || credentials.length === 0) return;

  await withTransaction(db, async (tx) => {
    const timestamp = nowIso();

    for (const input of credentials) {
      const normalized = normalizeCredentialInput(input);
      const existing = await tx.prepare(
        `SELECT id, encrypted_password, password_md5_hash
         FROM external_app_credentials
         WHERE user_id = ? AND app_id = ?
         LIMIT 1`
      ).get<Pick<ExternalCredentialRow, "id" | "encrypted_password" | "password_md5_hash">>(userId, normalized.appId);

      const passwordChanged = typeof normalized.password === "string" && normalized.password.length > 0;
      if (!existing && !normalized.username && !passwordChanged && !normalized.isEnabled) {
        continue;
      }
      const encryptedPassword = normalized.clearPassword
        ? ""
        : passwordChanged
          ? encryptCredentialSecret(normalized.password ?? "")
          : existing?.encrypted_password ?? "";
      const passwordMd5Hash = normalized.clearPassword
        ? ""
        : passwordChanged
          ? hashMd5(normalized.password ?? "")
          : existing?.password_md5_hash ?? "";
      const passwordUpdatedAt = passwordChanged || normalized.clearPassword ? timestamp : null;
      const enabled = normalized.isEnabled && Boolean(normalized.username && encryptedPassword);

      if (existing) {
        await tx.prepare(
          `UPDATE external_app_credentials
           SET external_username = ?, encrypted_password = ?, password_md5_hash = ?,
             is_enabled = ?, password_updated_at = COALESCE(?, password_updated_at),
             updated_by = ?, updated_at = ?
           WHERE id = ?`
        ).run(
          normalized.username,
          encryptedPassword,
          passwordMd5Hash,
          enabled ? 1 : 0,
          passwordUpdatedAt,
          actor.id,
          timestamp,
          existing.id
        );
      } else {
        await tx.prepare(
          `INSERT INTO external_app_credentials (
            id, user_id, app_id, external_username, encrypted_password, password_md5_hash,
            is_enabled, last_verified_status, password_updated_at, created_by, updated_by,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'not_tested', ?, ?, ?, ?, ?)`
        ).run(
          await nextPrefixedId(tx, "external_app_credentials", "eac"),
          userId,
          normalized.appId,
          normalized.username,
          encryptedPassword,
          passwordMd5Hash,
          enabled ? 1 : 0,
          passwordUpdatedAt,
          actor.id,
          actor.id,
          timestamp,
          timestamp
        );
      }
    }

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_EXTERNAL_APP_CREDENTIALS",
      entityType: "user",
      entityId: userId,
      payload: {
        apps: credentials.map((item) => ({
          appId: item.appId,
          username: item.username,
          passwordChanged: typeof item.password === "string" && item.password.length > 0,
          isEnabled: item.isEnabled,
          clearPassword: item.clearPassword,
        })),
      },
    });
  });
}

export async function buildExternalAppLaunchHtml(
  db: AletaDatabase,
  {
    actor,
    appId,
  }: {
    actor: Pick<UserPersona, "id" | "name" | "isActive">;
    appId: string;
  }
) {
  const normalizedAppId = normalizeAppId(appId);
  const credentialSourceAppId = getCredentialSourceAppId(normalizedAppId);
  const config = EXTERNAL_APP_CONFIGS[normalizedAppId];
  const launchSettings = await getLaunchSettingsFromDb(db, normalizedAppId);
  if (!actor.isActive) {
    throw new ApiError(403, "Akun ALETA tidak aktif.");
  }

  if (!launchSettings.enabled) {
    return buildExternalAppMessageHtml(
      config.label,
      "Direct link belum aktif",
      `Admin perlu mengaktifkan direct link ${config.label} di Pengaturan Panel ALETA terlebih dahulu.`
    );
  }

  const credential = await db.prepare(
    `SELECT id, user_id, app_id, external_username, encrypted_password, password_md5_hash,
      is_enabled, last_verified_at, last_verified_status, last_launch_at, password_updated_at,
      created_at, updated_at
     FROM external_app_credentials
     WHERE user_id = ? AND app_id = ?
     LIMIT 1`
  ).get<ExternalCredentialRow>(actor.id, credentialSourceAppId);

  if (!credential || !credential.is_enabled || !credential.external_username || !credential.encrypted_password) {
    const credentialLabel = credentialSourceAppId === "sipp" && normalizedAppId !== "sipp" ? "SIPP" : config.label;
    return buildExternalAppMessageHtml(
      config.label,
      "Kredensial belum aktif",
      `Admin perlu mengisi username dan password ${credentialLabel} pada Manajemen Akun ALETA terlebih dahulu.`
    );
  }

  const password = decryptCredentialSecret(credential.encrypted_password);
  if (!password) {
    return buildExternalAppMessageHtml(
      config.label,
      "Password tidak dapat dibaca",
      "Kunci enkripsi kredensial berubah atau password perlu diisi ulang oleh admin."
    );
  }

  const postedPassword = launchSettings.passwordMode === "md5" ? credential.password_md5_hash || hashMd5(password) : password;
  const actionUrl = joinUrl(launchSettings.baseUrl, launchSettings.loginPath);
  const timestamp = nowIso();

  await withTransaction(db, async (tx) => {
    await tx.prepare(
      `UPDATE external_app_credentials
       SET last_launch_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(timestamp, timestamp, credential.id);

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "EXTERNAL_APP_AUTO_LOGIN_LAUNCH",
      entityType: "external_app_credentials",
      entityId: credential.id,
      payload: {
        appId: normalizedAppId,
        label: config.label,
        credentialSourceAppId,
        username: credential.external_username,
        actionUrl,
        passwordMode: launchSettings.passwordMode,
      },
    });
  });

  // Kredensial dan target dikirim ke skrip jembatan sebagai JSON. "<" disamarkan
  // supaya isi nilai tidak mungkin menutup tag <script> lebih awal.
  const bridgeConfig = JSON.stringify({
    actionUrl,
    label: config.label,
    username: credential.external_username,
    password: postedPassword,
    usernameField: launchSettings.usernameField,
    passwordField: launchSettings.passwordField,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Masuk ${escapeHtml(config.label)}</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07111f;color:#e5f0ff;font-family:Inter,system-ui,sans-serif}
    main{width:min(92vw,420px);border:1px solid rgba(125,211,252,.35);border-radius:20px;padding:28px;background:rgba(15,23,42,.86);box-shadow:0 24px 80px rgba(14,165,233,.16)}
    p{color:#a9b8cf;line-height:1.6}.badge{color:#67e8f9;font-weight:700;letter-spacing:.08em;font-size:12px;text-transform:uppercase}
    .status{font-size:13px;color:#7dd3fc}
    button{height:44px;border:0;border-radius:999px;background:#67d7ff;color:#082032;font-weight:700;padding:0 18px;cursor:pointer}
  </style>
</head>
<body>
  <main>
    <div class="badge">ALETA SSO Bridge</div>
    <h1>Masuk ke ${escapeHtml(config.label)}</h1>
    <p>Sesi ALETA valid. ALETA sedang mengirim kredensial ${escapeHtml(config.label)} milik ${escapeHtml(actor.name)} melalui form login aplikasi tujuan.</p>
    <p class="status" id="status">Membaca form login ${escapeHtml(config.label)}...</p>
    <form id="cadangan" method="post" action="${escapeHtml(actionUrl)}" autocomplete="off">
      <input type="hidden" name="${escapeHtml(launchSettings.usernameField)}" value="${escapeHtml(credential.external_username)}" />
      <input type="hidden" name="${escapeHtml(launchSettings.passwordField)}" value="${escapeHtml(postedPassword)}" />
      <button type="submit">Masuk ${escapeHtml(config.label)} manual</button>
    </form>
  </main>
  <script>
(function () {
  var cfg = ${bridgeConfig};
  var status = document.getElementById("status");
  function tulis(teks) { if (status) { status.textContent = teks; } }

  // form.submit bisa tertutup oleh input bernama "submit" milik aplikasi
  // tujuan, jadi pengiriman selalu lewat prototype.
  function kirim(url, metode, kolom) {
    var form = document.createElement("form");
    form.method = String(metode || "post").toLowerCase() === "get" ? "get" : "post";
    form.action = url;
    Object.keys(kolom).forEach(function (nama) {
      var input = document.createElement("input");
      input.type = "hidden";
      input.name = nama;
      input.value = kolom[nama];
      form.appendChild(input);
    });
    document.body.appendChild(form);
    HTMLFormElement.prototype.submit.call(form);
  }

  // Jalur cadangan: kirim persis seperti pengaturan panel. Dipakai bila form
  // login tidak bisa dibaca, misalnya aplikasi tujuan berbeda origin.
  function cadangan(alasan) {
    tulis("Form login tidak terbaca (" + alasan + "). Mengirim memakai pengaturan panel.");
    var kolom = {};
    kolom[cfg.usernameField] = cfg.username;
    kolom[cfg.passwordField] = cfg.password;
    kirim(cfg.actionUrl, "post", kolom);
  }

  if (!window.fetch || !window.DOMParser) { cadangan("browser tidak mendukung"); return; }

  fetch(cfg.actionUrl, { credentials: "include", cache: "no-store" })
    .then(function (respons) {
      if (!respons.ok) { throw new Error("HTTP " + respons.status); }
      return respons.text();
    })
    .then(function (html) {
      var dokumen = new DOMParser().parseFromString(html, "text/html");
      var isianPassword = dokumen.querySelector("form input[type=password]");
      var form = isianPassword ? isianPassword.form : null;
      if (!form) { cadangan("form login tidak ditemukan"); return; }

      if (form.querySelector("[name*=captcha i], [id*=captcha i], img[src*=captcha i]")) {
        tulis("Login " + cfg.label + " memakai captcha sehingga tidak bisa diisi otomatis. Silakan masuk manual.");
        return;
      }

      var kolom = {};
      // Semua input tersembunyi milik form asli ikut dibawa - di sinilah token
      // CSRF berada. Tanpa itu CodeIgniter menolak login lalu memantulkan
      // pengguna kembali ke halaman login tanpa keterangan apa pun.
      var tersembunyi = form.querySelectorAll("input[type=hidden]");
      for (var i = 0; i < tersembunyi.length; i += 1) {
        if (tersembunyi[i].name) { kolom[tersembunyi[i].name] = tersembunyi[i].value; }
      }

      var isianUser = form.querySelector('input[name="' + cfg.usernameField + '"]')
        || form.querySelector("input[type=text], input[type=email], input:not([type])");
      kolom[(isianUser && isianUser.name) || cfg.usernameField] = cfg.username;
      kolom[isianPassword.name || cfg.passwordField] = cfg.password;

      // Sebagian aplikasi memeriksa keberadaan nama tombol submit.
      var tombol = form.querySelector("button[name], input[type=submit][name]");
      if (tombol && tombol.name) { kolom[tombol.name] = tombol.value || "login"; }

      var aksi = form.getAttribute("action");
      var tujuan = cfg.actionUrl;
      if (aksi) {
        try { tujuan = new URL(aksi, cfg.actionUrl).href; } catch (galat) { tujuan = cfg.actionUrl; }
      }

      tulis("Mengirim kredensial ke " + cfg.label + "...");
      kirim(tujuan, form.getAttribute("method") || "post", kolom);
    })
    .catch(function (galat) {
      cadangan(galat && galat.message ? galat.message : "tidak dapat diakses");
    });
})();
  </script>
</body>
</html>`;
}

function buildExternalAppMessageHtml(label: string, title: string, message: string) {
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${escapeHtml(label)} - ${escapeHtml(title)}</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07111f;color:#e5f0ff;font-family:Inter,system-ui,sans-serif}
    main{width:min(92vw,460px);border:1px solid rgba(251,191,36,.35);border-radius:20px;padding:28px;background:rgba(15,23,42,.86);box-shadow:0 24px 80px rgba(251,191,36,.14)}
    p{color:#a9b8cf;line-height:1.6}.badge{color:#fbbf24;font-weight:700;letter-spacing:.08em;font-size:12px;text-transform:uppercase}
  </style>
</head>
<body>
  <main>
    <div class="badge">ALETA SSO Bridge</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
  </main>
</body>
</html>`;
}
