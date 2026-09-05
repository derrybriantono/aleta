import { DEFAULT_PANEL_SETTINGS, normalizePanelSettings } from "@/lib/panel-settings";
import {
  type ExternalAppCredentialInput,
  type ExternalAppCredentialSummary,
  type ExternalAppId,
  type ExternalAppLaunchSettings,
  type UserPersona,
} from "@/lib/types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { callAletaBotSippBridge } from "@/server/modules/aleta-sipp/aleta-sipp-datasource";
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
        `SELECT id, external_username, encrypted_password, password_md5_hash
         FROM external_app_credentials
         WHERE user_id = ? AND app_id = ?
         LIMIT 1`
      ).get<
        Pick<
          ExternalCredentialRow,
          "id" | "external_username" | "encrypted_password" | "password_md5_hash"
        >
      >(userId, normalized.appId);

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
        // Vonis pemeriksaan yang lama DIBATALKAN begitu sandi atau usernamenya
        // berubah. Tanpa ini, kredensial yang baru diganti masih memamerkan
        // tanda hijau dari pemeriksaan atas sandi yang sudah tidak dipakai -
        // yang justru lebih menyesatkan daripada tidak ada tanda sama sekali.
        const perluDiujiUlang = passwordChanged || normalized.clearPassword
          || normalized.username !== existing.external_username;

        await tx.prepare(
          `UPDATE external_app_credentials
           SET external_username = ?, encrypted_password = ?, password_md5_hash = ?,
             is_enabled = ?, password_updated_at = COALESCE(?, password_updated_at),
             last_verified_status = CASE WHEN ? = 1 THEN 'not_tested' ELSE last_verified_status END,
             last_verified_at = CASE WHEN ? = 1 THEN NULL ELSE last_verified_at END,
             updated_by = ?, updated_at = ?
           WHERE id = ?`
        ).run(
          normalized.username,
          encryptedPassword,
          passwordMd5Hash,
          enabled ? 1 : 0,
          passwordUpdatedAt,
          perluDiujiUlang ? 1 : 0,
          perluDiujiUlang ? 1 : 0,
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

  // Diuji SESUDAH tersimpan, dan di luar transaksi.
  //
  // Urutannya sengaja begini: menyimpan harus tetap berhasil walaupun bot
  // sedang mati. Kalau pemeriksaannya didahulukan atau ditaruh di dalam
  // transaksi, bot yang tidak menjawab akan menggagalkan penyimpanan sandi
  // yang sebenarnya benar.
  //
  // Galat pemeriksaan pun ditelan di sini: keadaannya sudah tercatat sebagai
  // "belum dapat diuji" pada barisnya, dan itu keterangan yang jujur. Membuat
  // penyimpanan gagal hanya karena pemeriksaannya gagal akan menyesatkan.
  const adaSipp = credentials.some((item) => normalizeAppId(item.appId) === "sipp");
  if (adaSipp) {
    try {
      return await periksaKredensialSipp(db, userId);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/**
 * Keadaan sebuah kredensial SIPP sesudah diperiksa.
 *
 * Tiap sebab kegagalan punya namanya sendiri, dan itu disengaja. Satu nama
 * untuk banyak sebab adalah cara paling ampuh membuat orang mengetik ulang
 * sandi yang sebenarnya sudah benar - berkali-kali, tanpa pernah berhasil.
 */
export const KEADAAN_KREDENSIAL = {
  BELUM_DIUJI: "not_tested",
  SAH: "verified",
  SANDI_SALAH: "wrong_password",
  TIDAK_TERDAFTAR: "not_found",
  DIBLOKIR: "blocked",
  TIDAK_TERJANGKAU: "unreachable",
} as const;

export type HasilPeriksaKredensial = {
  keadaan: string;
  keterangan: string;
  diperiksaPada: string | null;
};

/**
 * Menguji sandi SIPP tersimpan, TANPA memasukinya.
 *
 * ============================================================================
 * MENGAPA TIDAK MENCOBA MASUK
 * ============================================================================
 *
 * Mencoba masuk akan MENULIS ke SIPP: insertSession() menghapus lalu mengisi
 * ulang sys_user_online, dan sys_users.last_login ikut berubah. Pemeriksaan
 * kesehatan tidak boleh menyamar menjadi kehadiran orang - apalagi ia berjalan
 * atas akun hakim dan panitera, dan bisa dijalankan admin kapan saja.
 *
 * Karena itu yang dilakukan hanya membaca: bot menghitung sidik sandinya lalu
 * membandingkannya dengan sys_users.password. Yang kembali ke sini cuma
 * jawaban cocok atau tidak - sidik tersimpan dan kode aktivasinya tidak pernah
 * meninggalkan sisi SIPP.
 *
 * ============================================================================
 * MENGAPA DI LUAR TRANSAKSI
 * ============================================================================
 *
 * Ia memanggil jaringan. Memanggil jaringan di dalam transaksi menahan kunci
 * basis data selama sambungan menggantung - dan bot yang mati membuat
 * penyimpanan kredensial ikut mati. Menyimpan harus tetap berhasil walau
 * pemeriksaannya tidak dapat dilakukan.
 */
export async function periksaKredensialSipp(
  db: AletaDatabase,
  userId: string
): Promise<HasilPeriksaKredensial> {
  const baris = await db.prepare(
    `SELECT id, external_username, encrypted_password
     FROM external_app_credentials
     WHERE user_id = ? AND app_id = 'sipp'
     LIMIT 1`
  ).get<Pick<ExternalCredentialRow, "id" | "external_username" | "encrypted_password">>(userId);

  if (!baris || !baris.external_username || !baris.encrypted_password) {
    return { keadaan: KEADAAN_KREDENSIAL.BELUM_DIUJI, keterangan: "Kredensial SIPP belum lengkap.", diperiksaPada: null };
  }

  const sandi = decryptCredentialSecret(baris.encrypted_password);
  if (!sandi) {
    return {
      keadaan: KEADAAN_KREDENSIAL.BELUM_DIUJI,
      keterangan: "Password tidak dapat dibaca. Kunci enkripsi berubah, atau password perlu diisi ulang.",
      diperiksaPada: null,
    };
  }

  const jawaban = await callAletaBotSippBridge<{
    ditemukan?: boolean;
    cocok?: boolean;
    diblokir?: boolean;
    alasan?: string;
  }>("user.verifikasiSandi", { username: baris.external_username, sandi });

  let keadaan: string;
  let keterangan: string;

  if (!jawaban.ok) {
    // Bot tidak menjawab BUKAN berarti sandinya salah. Menyebutnya salah akan
    // membuat admin mengganti sandi yang sebenarnya masih berlaku.
    keadaan = KEADAAN_KREDENSIAL.TIDAK_TERJANGKAU;
    keterangan = `Belum dapat diuji: ${jawaban.error ?? "ALETA Bot tidak merespons."}`;
  } else if (!jawaban.data?.ditemukan) {
    keadaan = KEADAAN_KREDENSIAL.TIDAK_TERDAFTAR;
    keterangan = `Username "${baris.external_username}" tidak terdaftar di SIPP.`;
  } else if (!jawaban.data?.cocok) {
    keadaan = KEADAAN_KREDENSIAL.SANDI_SALAH;
    keterangan = "Password sudah tidak cocok. Kemungkinan sudah diganti pemiliknya.";
  } else if (jawaban.data?.diblokir) {
    // Sandinya benar, tetapi SIPP tetap menolak. Dibedakan supaya tidak
    // diperlakukan sebagai salah sandi.
    keadaan = KEADAAN_KREDENSIAL.DIBLOKIR;
    keterangan = "Password benar, tetapi akun SIPP sedang diblokir.";
  } else {
    keadaan = KEADAAN_KREDENSIAL.SAH;
    keterangan = "Password cocok dengan SIPP.";
  }

  // Waktu pemeriksaan hanya dicatat bila pemeriksaannya benar-benar terjadi.
  // Bot yang tidak terjangkau tidak boleh meninggalkan jejak seolah sudah
  // diperiksa.
  const benarDiperiksa = keadaan !== KEADAAN_KREDENSIAL.TIDAK_TERJANGKAU;
  const waktu = new Date().toISOString();

  await db.prepare(
    `UPDATE external_app_credentials
     SET last_verified_status = ?,
       last_verified_at = CASE WHEN ? = 1 THEN ? ELSE last_verified_at END,
       updated_at = ?
     WHERE id = ?`
  ).run(keadaan, benarDiperiksa ? 1 : 0, waktu, waktu, baris.id);

  return { keadaan, keterangan, diperiksaPada: benarDiperiksa ? waktu : null };
}

/**
 * Tambahan yang membuat jembatan berhati-hati.
 *
 * Diisi HANYA ketika masuk atas nama pejabat lain. Ketiganya mengubah tiga
 * hal sekaligus: sesi lama ditutup lebih dulu, pengiriman dilakukan lewat
 * fetch supaya jawabannya masih dapat dibaca, dan perjalanan DIHENTIKAN bila
 * sesi yang terbentuk bukan milik nama yang diharapkan.
 */
export type JembatanBertanggungJawab = {
  /** Alamat keluar sesi, dipanggil sebelum apa pun. */
  alamatKeluar: string;
  /** Nama yang harus muncul di halaman sesudah masuk, apa adanya dari SIPP. */
  namaDiharap: string;
  /** Halaman yang dibuka setelah terbukti benar. */
  tujuanAkhir: string;
};

export async function buildExternalAppLaunchHtml(
  db: AletaDatabase,
  {
    actor,
    appId,
    bertanggungJawab,
  }: {
    actor: Pick<UserPersona, "id" | "name" | "isActive">;
    appId: string;
    /** Kosong berarti "buka SIPP sebagai diri sendiri" - perilaku lama. */
    bertanggungJawab?: JembatanBertanggungJawab & { userIdKredensial?: string };
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

  // Kredensial milik SIAPA.
  //
  // Bawaannya milik yang sedang memakai ALETA - itulah "buka SIPP sebagai diri
  // sendiri". Hanya jalur masuk-sebagai-pejabat-lain yang menyebut pemilik
  // lain, dan jalur itu punya gerbang izinnya sendiri; lihat
  // masukSebagaiPejabat pada modul aleta-ecourt/masuk-pejabat.
  const pemilikKredensial = bertanggungJawab?.userIdKredensial || actor.id;

  const credential = await db.prepare(
    `SELECT id, user_id, app_id, external_username, encrypted_password, password_md5_hash,
      is_enabled, last_verified_at, last_verified_status, last_launch_at, password_updated_at,
      created_at, updated_at
     FROM external_app_credentials
     WHERE user_id = ? AND app_id = ?
     LIMIT 1`
  ).get<ExternalCredentialRow>(pemilikKredensial, credentialSourceAppId);

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
    // Ketiganya kosong pada jalur "buka SIPP sebagai diri sendiri", sehingga
    // perilakunya persis seperti sebelumnya. Yang mengisinya adalah jalur
    // masuk-sebagai-pejabat-lain.
    alamatKeluar: bertanggungJawab?.alamatKeluar ?? "",
    namaDiharap: bertanggungJawab?.namaDiharap ?? "",
    tujuanAkhir: bertanggungJawab?.tujuanAkhir ?? "",
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
    <p>${bertanggungJawab?.namaDiharap
      ? `Masuk atas nama <b>${escapeHtml(bertanggungJawab.namaDiharap)}</b> (akun SIPP <b>${escapeHtml(credential.external_username)}</b>), dikerjakan oleh ${escapeHtml(actor.name)}. Sesi yang sedang terbuka akan ditutup lebih dulu.`
      : `Sesi ALETA valid. ALETA sedang mengirim kredensial ${escapeHtml(config.label)} milik ${escapeHtml(actor.name)} melalui form login aplikasi tujuan.`}</p>
    <p class="status" id="status">Membaca form login ${escapeHtml(config.label)}...</p>
    ${bertanggungJawab?.namaDiharap ? "" : `<form id="cadangan" method="post" action="${escapeHtml(actionUrl)}" autocomplete="off">
      <input type="hidden" name="${escapeHtml(launchSettings.usernameField)}" value="${escapeHtml(credential.external_username)}" />
      <input type="hidden" name="${escapeHtml(launchSettings.passwordField)}" value="${escapeHtml(postedPassword)}" />
      <button type="submit">Masuk ${escapeHtml(config.label)} manual</button>
    </form>`}
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
    // Saat masuk sebagai pejabat lain, jalur cadangan DILUMPUHKAN.
    //
    // Cadangan mengirim membabi buta ke alamat pada pengaturan panel, tanpa
    // pernah tahu apakah sesinya terbentuk dan milik siapa. Untuk "buka SIPP
    // sebagai diri sendiri" itu tidak apa-apa - paling buruk petugas melihat
    // halaman masuk lalu mengetik sendiri. Untuk penetapan atas nama pejabat
    // lain, taruhannya bukan itu: sesi yang salah berarti penetapan tercatat
    // atas nama yang keliru. Lebih baik berhenti.
    if (cfg.namaDiharap) {
      tulis("DIHENTIKAN. Form login tidak terbaca (" + alasan + "). Tidak ada yang dikerjakan.");
      return;
    }
    tulis("Form login tidak terbaca (" + alasan + "). Mengirim memakai pengaturan panel.");
    var kolom = {};
    kolom[cfg.usernameField] = cfg.username;
    kolom[cfg.passwordField] = cfg.password;
    kirim(cfg.actionUrl, "post", kolom);
  }

  if (!window.fetch || !window.DOMParser) { cadangan("browser tidak mendukung"); return; }

  function mulai() {
  fetch(cfg.actionUrl, { credentials: "include", cache: "no-store" })
    .then(function (respons) {
      if (!respons.ok) { throw new Error("HTTP " + respons.status); }
      return respons.text();
    })
    .then(function (html) {
      var dokumen = new DOMParser().parseFromString(html, "text/html");

      // Kotak sandi dicari di SELURUH dokumen, bukan sebagai keturunan <form>.
      //
      // SIPP membuka <form> langsung di dalam <tbody>, dengan <tr> di dalamnya:
      //
      //     <table><tbody>
      //       <tr>...</tr>
      //       <form action="...login/validation_credential" method="post">
      //         <tr><td><input type="password" name="password">
      //
      // Aturan penataan HTML MEMINDAHKAN tag <form> itu keluar dari tabel
      // (foster parenting), sementara kotak isiannya tetap tinggal di dalam
      // sel. Formulirnya jelas ada, tetapi kotak sandinya bukan lagi
      // keturunannya - sehingga "form input[type=password]" tidak menemukan
      // apa pun dan isianPassword.form bernilai kosong.
      //
      // Dulu keadaan itu disimpulkan sebagai "form login tidak ditemukan", lalu
      // jatuh ke jalur cadangan yang mengirim ke alamat halaman login. Alamat
      // itu kena "RewriteRule ^index.php/(.*)$ ... [R=302,L]", dan pengalihan
      // 302 atas sebuah POST membuang isian formulirnya. Dua kegagalan
      // berantai, keduanya tanpa pesan apa pun.
      var isianPassword = dokumen.querySelector("input[type=password]");
      if (!isianPassword) { cadangan("kolom sandi tidak ditemukan"); return; }

      var form = isianPassword.form || dokumen.querySelector("form");
      if (!form) { cadangan("form login tidak ditemukan"); return; }

      // Kolom dikumpulkan dari lingkup yang benar-benar memuat kotak sandinya.
      // Bila formulirnya utuh, lingkupnya formulir itu - sehingga halaman
      // dengan banyak formulir tidak tercampur. Bila terpisah karena tabel,
      // barulah seluruh dokumen dipakai.
      var lingkup = form.contains(isianPassword) ? form : dokumen;

      if (lingkup.querySelector("[name*=captcha i], [id*=captcha i], img[src*=captcha i]")) {
        tulis("Login " + cfg.label + " memakai captcha sehingga tidak bisa diisi otomatis. Silakan masuk manual.");
        return;
      }

      var kolom = {};
      // Semua input tersembunyi milik form asli ikut dibawa - di sinilah token
      // CSRF berada. Tanpa itu CodeIgniter menolak login lalu memantulkan
      // pengguna kembali ke halaman login tanpa keterangan apa pun.
      var tersembunyi = lingkup.querySelectorAll("input[type=hidden]");
      for (var i = 0; i < tersembunyi.length; i += 1) {
        if (tersembunyi[i].name) { kolom[tersembunyi[i].name] = tersembunyi[i].value; }
      }

      var isianUser = lingkup.querySelector('input[name="' + cfg.usernameField + '"]')
        || lingkup.querySelector("input[type=text], input[type=email], input:not([type])");
      kolom[(isianUser && isianUser.name) || cfg.usernameField] = cfg.username;
      kolom[isianPassword.name || cfg.passwordField] = cfg.password;

      // Sebagian aplikasi memeriksa keberadaan nama tombol submit.
      var tombol = lingkup.querySelector("button[name], input[type=submit][name]");
      if (tombol && tombol.name) { kolom[tombol.name] = tombol.value || "login"; }

      var aksi = form.getAttribute("action");
      var tujuan = cfg.actionUrl;
      if (aksi) {
        try { tujuan = new URL(aksi, cfg.actionUrl).href; } catch (galat) { tujuan = cfg.actionUrl; }
      }

      // Jalur BERTANGGUNG JAWAB: dipakai ketika sesi yang dibentuk harus
      // terbukti milik akun yang dimaksud - yaitu saat masuk sebagai pejabat
      // lain untuk mengerjakan penetapan.
      //
      // Bedanya dengan jalur biasa: sandi dikirim lewat fetch, bukan dengan
      // memindahkan halaman. Dengan begitu jawabannya masih dapat DIBACA
      // sebelum petugas dilepas ke SIPP. Kalau yang mendarat ternyata akun
      // lain - misalnya sesi lama yang belum benar-benar mati - perjalanannya
      // dihentikan di sini, bukan diteruskan dan baru ketahuan setelah
      // penetapan tercatat atas nama yang keliru.
      if (cfg.namaDiharap) {
        tulis("Mengirim kredensial " + cfg.label + "...");
        var badan = new URLSearchParams();
        Object.keys(kolom).forEach(function (nama) { badan.append(nama, kolom[nama]); });

        fetch(tujuan, {
          method: "post",
          credentials: "include",
          cache: "no-store",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: badan.toString(),
        })
          .then(function (jawab) { return jawab.text(); })
          .then(function (isi) {
            if (isi.indexOf(cfg.namaDiharap) >= 0) {
              tulis("Masuk sebagai " + cfg.namaDiharap + ". Membuka " + cfg.label + "...");
              window.location.replace(cfg.tujuanAkhir || cfg.actionUrl);
              return;
            }
            // Gagal-tertutup. Diam lebih baik daripada menyerahkan sesi yang
            // belum tentu milik siapa.
            tulis(
              "DIHENTIKAN. Sesi yang terbentuk bukan milik " + cfg.namaDiharap +
              ". Password mungkin sudah diganti, atau sesi lama belum tertutup. Tidak ada yang dikerjakan."
            );
          })
          .catch(function (galat) {
            tulis("DIHENTIKAN. Pengiriman gagal: " + (galat && galat.message ? galat.message : "tidak diketahui"));
          });
        return;
      }

      tulis("Mengirim kredensial ke " + cfg.label + "...");
      kirim(tujuan, form.getAttribute("method") || "post", kolom);
    })
    .catch(function (galat) {
      cadangan(galat && galat.message ? galat.message : "tidak dapat diakses");
    });
  }

  // Sesi lama WAJIB ditutup lebih dulu saat masuk sebagai pejabat lain.
  //
  // Halaman masuk SIPP TIDAK menampilkan formulir bila sesi masih hidup - ia
  // langsung mengalihkan ke dashboard. Tanpa langkah ini, "berganti akun"
  // menghasilkan sesi LAMA yang bertahan, dan penetapan akan tercatat atas
  // nama akun yang kebetulan sedang terbuka. Terbukti pada percobaan
  // 2 September 2026 pukul 12:11: GET /SIPP/login menjawab 302, bukan 200.
  if (cfg.alamatKeluar) {
    tulis("Menutup sesi " + cfg.label + " yang sedang terbuka...");
    fetch(cfg.alamatKeluar, { credentials: "include", cache: "no-store" })
      .then(mulai)
      .catch(mulai);
  } else {
    mulai();
  }
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
