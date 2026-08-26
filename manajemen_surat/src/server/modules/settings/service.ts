import { type QueryResultRow } from "pg";

import {
  ASSISTANT_JUDGE_KNOWN_ROLE_IDS,
  DEFAULT_ASSISTANT_JUDGE_CONFIG,
  filterAssistantJudgeConfigForUser,
  getAssistantJudgeOrderedLinks,
  normalizeAssistantJudgeConfig,
  validateAssistantJudgeUrl,
} from "@/lib/assistant-judge";
import { moduleVisibility as defaultModuleVisibility } from "@/lib/mock-data";
import { DEFAULT_PANEL_SETTINGS, normalizePanelSettings } from "@/lib/panel-settings";
import { isPrivilegedAdmin } from "@/lib/permissions";
import {
  isSupportedInstitutionLogoUrl,
  normalizeInstitutionLogoUrl,
} from "@/lib/institution-logo";
import {
  type AssistantJudgeConfig,
  type InstitutionIdentity,
  type ModuleId,
  type ModuleVisibility,
  type PanelSettings,
  type WhatsAppWebConfig,
} from "@/lib/types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import { getUsersFromDb, requireActorUser } from "@/server/modules/organization/service";

type InstitutionIdentityRow = QueryResultRow & {
  court_name: string;
  court_short_name: string;
  address: string;
  phone_number: string;
  mobile_phone: string;
  cs_whatsapp_number: string;
  bot_whatsapp_number: string;
  email: string;
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
  website: string | null;
  map_url: string | null;
  logo_url: string | null;
  updated_at: string;
};

type WhatsAppSettingsRow = QueryResultRow & {
  phone_number: string;
  session_name: string;
  status: string;
  last_connected_at: string | null;
  updated_at: string;
};

type AssistantJudgeSettingsRow = QueryResultRow & {
  enabled: number;
  visible_roles_json: string;
  links_json: string;
  updated_at: string;
};

type ModuleVisibilityRow = QueryResultRow & {
  role_id: ModuleVisibility["roleId"];
  module_id: ModuleId;
  enabled: number;
};

type PanelSettingsRow = QueryResultRow & {
  footer_mode: string;
  portal_cards_json: string;
  public_access_json: string;
  external_apps_json: string;
  updated_at: string;
};

function mapInstitutionRow(row: InstitutionIdentityRow): InstitutionIdentity {
  return {
    courtName: row.court_name,
    courtShortName: row.court_short_name,
    address: row.address,
    phoneNumber: row.phone_number,
    mobilePhone: row.mobile_phone,
    csWhatsappNumber: row.cs_whatsapp_number ?? "",
    botWhatsappNumber: row.bot_whatsapp_number ?? "",
    email: row.email,
    instagram: row.instagram ?? undefined,
    facebook: row.facebook ?? undefined,
    youtube: row.youtube ?? undefined,
    website: row.website ?? undefined,
    mapUrl: row.map_url ?? undefined,
    logoUrl: row.logo_url ?? undefined,
  };
}

function mapWhatsAppSettingsRow(row: WhatsAppSettingsRow): WhatsAppWebConfig {
  return {
    phoneNumber: row.phone_number,
    sessionName: row.session_name,
    status: row.status as WhatsAppWebConfig["status"],
    lastConnectedAt: row.last_connected_at ?? undefined,
  };
}

function parseJsonObject<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function mapAssistantJudgeSettingsRow(row: AssistantJudgeSettingsRow): AssistantJudgeConfig {
  return normalizeAssistantJudgeConfig({
    enabled: Boolean(row.enabled),
    visibleRoles: parseJsonObject(row.visible_roles_json, DEFAULT_ASSISTANT_JUDGE_CONFIG.visibleRoles),
    links: parseJsonObject(row.links_json, DEFAULT_ASSISTANT_JUDGE_CONFIG.links),
    updatedAt: row.updated_at,
  });
}

async function ensureAssistantJudgeSettingsSeeded(db: AletaDatabase) {
  const existing = await db.prepare(
    `SELECT COUNT(*)::int AS count
     FROM assistant_judge_settings`
  ).get<{ count: number }>();

  if ((existing?.count ?? 0) > 0) {
    return;
  }

  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO assistant_judge_settings (
      id, enabled, visible_roles_json, links_json, updated_by, updated_at
    ) VALUES (1, ?, ?, ?, NULL, ?)`
  ).run(
    DEFAULT_ASSISTANT_JUDGE_CONFIG.enabled ? 1 : 0,
    JSON.stringify(DEFAULT_ASSISTANT_JUDGE_CONFIG.visibleRoles),
    JSON.stringify(DEFAULT_ASSISTANT_JUDGE_CONFIG.links),
    now
  );
}

async function ensureModuleVisibilitySeeded(db: AletaDatabase) {
  const roleRows = await db.prepare("SELECT id FROM roles").all<{ id: string }>();
  const existingRoleIds = new Set(roleRows.map((row) => row.id));

  const now = new Date().toISOString();
  for (const visibility of defaultModuleVisibility) {
    if (!existingRoleIds.has(visibility.roleId)) continue;

    for (const [moduleId, enabled] of Object.entries(visibility.modules)) {
      await db.prepare(
        `INSERT INTO module_visibility_settings (role_id, module_id, enabled, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(role_id, module_id) DO NOTHING`
      ).run(visibility.roleId, moduleId, enabled ? 1 : 0, now);
    }
  }
}

function mapModuleVisibilityRows(rows: ModuleVisibilityRow[]) {
  const visibilityMap = new Map<ModuleVisibility["roleId"], ModuleVisibility>();

  for (const row of rows) {
    if (!visibilityMap.has(row.role_id)) {
      visibilityMap.set(row.role_id, {
        roleId: row.role_id,
        modules: {} as ModuleVisibility["modules"],
      });
    }

    const current = visibilityMap.get(row.role_id);
    if (!current) continue;
    current.modules[row.module_id] = Boolean(row.enabled);
  }

  return Array.from(visibilityMap.values());
}

function mapPanelSettingsRow(row: PanelSettingsRow): PanelSettings {
  return normalizePanelSettings({
    footerMode: row.footer_mode,
    portalCards: parseJsonObject(row.portal_cards_json, DEFAULT_PANEL_SETTINGS.portalCards),
    publicAccess: parseJsonObject(row.public_access_json, DEFAULT_PANEL_SETTINGS.publicAccess),
    externalApps: parseJsonObject(row.external_apps_json, DEFAULT_PANEL_SETTINGS.externalApps),
    updatedAt: row.updated_at,
  });
}

async function ensurePanelSettingsColumns(db: AletaDatabase) {
  await db.exec(`ALTER TABLE panel_settings ADD COLUMN IF NOT EXISTS public_access_json TEXT NOT NULL DEFAULT '{}'`);
  await db.exec(`ALTER TABLE panel_settings ADD COLUMN IF NOT EXISTS external_apps_json TEXT NOT NULL DEFAULT '{}'`);
}

async function ensurePanelSettingsSeeded(db: AletaDatabase) {
  await ensurePanelSettingsColumns(db);
  const existing = await db.prepare(
    `SELECT COUNT(*)::int AS count
     FROM panel_settings`
  ).get<{ count: number }>();

  if ((existing?.count ?? 0) > 0) {
    return;
  }

  await db.prepare(
    `INSERT INTO panel_settings (id, footer_mode, portal_cards_json, public_access_json, external_apps_json, updated_by, updated_at)
     VALUES (1, ?, ?, ?, ?, NULL, ?)`
  ).run(
    DEFAULT_PANEL_SETTINGS.footerMode,
    JSON.stringify(DEFAULT_PANEL_SETTINGS.portalCards),
    JSON.stringify(DEFAULT_PANEL_SETTINGS.publicAccess),
    JSON.stringify(DEFAULT_PANEL_SETTINGS.externalApps),
    new Date().toISOString()
  );
}

export async function getInstitutionIdentityFromDb(db: AletaDatabase) {
  const row = await db.prepare(
    `SELECT court_name, court_short_name, address, phone_number, mobile_phone,
      cs_whatsapp_number, bot_whatsapp_number, email,
      instagram, facebook, youtube, website, map_url, logo_url, updated_at
     FROM institution_identity
     WHERE id = 1`
  ).get<InstitutionIdentityRow>();

  if (!row) {
    throw new ApiError(500, "Identitas instansi belum ditemukan di database.");
  }

  return mapInstitutionRow(row);
}

export async function getModuleVisibilityFromDb(db: AletaDatabase) {
  await ensureModuleVisibilitySeeded(db);

  const rows = await db.prepare(
    `SELECT role_id, module_id, enabled
     FROM module_visibility_settings
     ORDER BY role_id ASC, module_id ASC`
  ).all<ModuleVisibilityRow>();

  return mapModuleVisibilityRows(rows);
}

export async function getPanelSettingsFromDb(db: AletaDatabase) {
  await ensurePanelSettingsSeeded(db);

  const row = await db.prepare(
    `SELECT footer_mode, portal_cards_json, public_access_json, external_apps_json, updated_at
     FROM panel_settings
     WHERE id = 1`
  ).get<PanelSettingsRow>();

  if (!row) {
    return DEFAULT_PANEL_SETTINGS;
  }

  return mapPanelSettingsRow(row);
}

export async function updateInstitutionIdentityInDb(
  db: AletaDatabase,
  {
    actorUserId,
    payload,
  }: {
    actorUserId: string;
    payload: Partial<InstitutionIdentity>;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat mengubah identitas instansi.");
  }

  return withTransaction(db, async (tx) => {
    const current = await getInstitutionIdentityFromDb(tx);
    const nextValue: InstitutionIdentity = {
      ...current,
      ...payload,
      courtName: (payload.courtName ?? current.courtName).trim(),
      courtShortName: (payload.courtShortName ?? current.courtShortName).trim(),
      address: (payload.address ?? current.address).trim(),
      phoneNumber: (payload.phoneNumber ?? current.phoneNumber).trim(),
      mobilePhone: (payload.mobilePhone ?? current.mobilePhone).trim(),
      csWhatsappNumber:
        payload.csWhatsappNumber === undefined ? current.csWhatsappNumber : payload.csWhatsappNumber?.trim() || undefined,
      botWhatsappNumber:
        payload.botWhatsappNumber === undefined ? current.botWhatsappNumber : payload.botWhatsappNumber?.trim() || undefined,
      email: (payload.email ?? current.email).trim(),
      instagram: payload.instagram === undefined ? current.instagram : payload.instagram?.trim() || undefined,
      facebook: payload.facebook === undefined ? current.facebook : payload.facebook?.trim() || undefined,
      youtube: payload.youtube === undefined ? current.youtube : payload.youtube?.trim() || undefined,
      website: payload.website === undefined ? current.website : payload.website?.trim() || undefined,
      mapUrl: payload.mapUrl === undefined ? current.mapUrl : payload.mapUrl?.trim() || undefined,
      logoUrl: payload.logoUrl === undefined ? current.logoUrl : normalizeInstitutionLogoUrl(payload.logoUrl) || undefined,
    };

    if (!nextValue.courtName || !nextValue.courtShortName || !nextValue.address || !nextValue.email) {
      throw new ApiError(400, "Nama instansi, nama singkat, alamat, dan email wajib diisi.");
    }

    if (nextValue.logoUrl && !isSupportedInstitutionLogoUrl(nextValue.logoUrl)) {
      throw new ApiError(400, "Logo harus berupa URL gambar yang valid atau file PNG/JPG/WebP/GIF maksimal 512 KB.");
    }

    const now = new Date().toISOString();
    await tx.prepare(
      `UPDATE institution_identity
       SET court_name = ?, court_short_name = ?, address = ?, phone_number = ?, mobile_phone = ?,
         cs_whatsapp_number = ?, bot_whatsapp_number = ?, email = ?, instagram = ?, facebook = ?,
         youtube = ?, website = ?, map_url = ?, logo_url = ?, updated_at = ?
       WHERE id = 1`
    ).run(
      nextValue.courtName,
      nextValue.courtShortName,
      nextValue.address,
      nextValue.phoneNumber,
      nextValue.mobilePhone,
      nextValue.csWhatsappNumber ?? "",
      nextValue.botWhatsappNumber ?? "",
      nextValue.email,
      nextValue.instagram ?? null,
      nextValue.facebook ?? null,
      nextValue.youtube ?? null,
      nextValue.website ?? null,
      nextValue.mapUrl ?? null,
      nextValue.logoUrl ?? null,
      now
    );

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_INSTITUTION_IDENTITY",
      entityType: "institution_identity",
      entityId: "1",
      payload: nextValue,
    });

    return getInstitutionIdentityFromDb(tx);
  });
}

export async function getWhatsAppSettingsFromDb(db: AletaDatabase) {
  const row = await db.prepare(
    `SELECT phone_number, session_name, status, last_connected_at, updated_at
     FROM whatsapp_web_settings
     WHERE id = 1`
  ).get<WhatsAppSettingsRow>();

  if (!row) {
    throw new ApiError(500, "Konfigurasi WhatsApp Web belum ditemukan di database.");
  }

  return mapWhatsAppSettingsRow(row);
}

export async function getAssistantJudgeSettingsFromDb(db: AletaDatabase) {
  await ensureAssistantJudgeSettingsSeeded(db);

  const row = await db.prepare(
    `SELECT enabled, visible_roles_json, links_json, updated_at
     FROM assistant_judge_settings
     WHERE id = 1`
  ).get<AssistantJudgeSettingsRow>();

  if (!row) {
    return DEFAULT_ASSISTANT_JUDGE_CONFIG;
  }

  return mapAssistantJudgeSettingsRow(row);
}

export async function getAssistantJudgeSettingsForActorFromDb(db: AletaDatabase, actorUserId: string | null | undefined) {
  const actor = await requireActorUser(db, actorUserId);
  const config = await getAssistantJudgeSettingsFromDb(db);

  if (actor.roleId === "super-admin") {
    return config;
  }

  return filterAssistantJudgeConfigForUser(config, actor);
}

export async function updateAssistantJudgeSettingsInDb(
  db: AletaDatabase,
  {
    actorUserId,
    payload,
  }: {
    actorUserId: string;
    payload: AssistantJudgeConfig;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (actor.roleId !== "super-admin") {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengubah pengaturan Asisten Hakim.");
  }

  const nextValue = normalizeAssistantJudgeConfig(payload);
  const activeUserIds = new Set((await getUsersFromDb(db)).filter((user) => user.isActive).map((user) => user.id));
  const validRoles = new Set(ASSISTANT_JUDGE_KNOWN_ROLE_IDS);

  for (const link of getAssistantJudgeOrderedLinks(nextValue)) {
    const invalidRole = (link.allowedRoles ?? []).find((roleId) => !validRoles.has(roleId));
    if (invalidRole) {
      throw new ApiError(400, `Role ${invalidRole} tidak dikenali untuk akses Asisten Hakim.`);
    }

    const invalidUserId = (link.allowedUserIds ?? []).find((userId) => !activeUserIds.has(userId));
    if (invalidUserId) {
      throw new ApiError(400, `User ${invalidUserId} tidak aktif atau tidak ditemukan.`);
    }

    if (!link.enabled) continue;

    const validation = validateAssistantJudgeUrl(link.url);
    if (!validation.ok) {
      throw new ApiError(400, validation.message ?? "URL Asisten Hakim tidak valid.");
    }
    if (!link.label.trim() || !link.description.trim()) {
      throw new ApiError(400, "Label dan deskripsi menu Asisten Hakim wajib diisi.");
    }
  }

  return withTransaction(db, async (tx) => {
    await ensureAssistantJudgeSettingsSeeded(tx);

    const now = new Date().toISOString();
    await tx.prepare(
      `UPDATE assistant_judge_settings
       SET enabled = ?, visible_roles_json = ?, links_json = ?, updated_by = ?, updated_at = ?
       WHERE id = 1`
    ).run(
      nextValue.enabled ? 1 : 0,
      JSON.stringify(nextValue.visibleRoles),
      JSON.stringify(nextValue.links),
      actor.id,
      now
    );

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_ASSISTANT_JUDGE_SETTINGS",
      entityType: "assistant_judge_settings",
      entityId: "1",
      payload: {
        enabled: nextValue.enabled,
        visibleRoles: nextValue.visibleRoles,
        linkProviders: getAssistantJudgeOrderedLinks(nextValue).map((link) => {
          let urlHost = "";
          try {
            urlHost = new URL(link.url).hostname;
          } catch {
            urlHost = "invalid-url";
          }

          return {
            providerId: link.provider ?? link.id,
            enabled: link.enabled,
            label: link.label,
            embeddedEnabled: link.embeddedEnabled !== false,
            urlHost,
            allowedRoles: link.allowedRoles,
            allowedUserCount: link.allowedUserIds?.length ?? 0,
            sortOrder: link.sortOrder,
          };
        }),
      },
    });

    return getAssistantJudgeSettingsFromDb(tx);
  });
}

export async function updateWhatsAppSettingsInDb(
  db: AletaDatabase,
  {
    actorUserId,
    payload,
  }: {
    actorUserId: string;
    payload: Partial<WhatsAppWebConfig>;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat mengubah konfigurasi WhatsApp.");
  }

  return withTransaction(db, async (tx) => {
    const current = await getWhatsAppSettingsFromDb(tx);
    const nextStatus = payload.status ?? current.status;

    if (!["active", "inactive", "failed"].includes(nextStatus)) {
      throw new ApiError(400, "Status WhatsApp tidak valid.");
    }

    const nextValue: WhatsAppWebConfig = {
      phoneNumber: payload.phoneNumber === undefined ? current.phoneNumber : payload.phoneNumber.trim(),
      sessionName:
        payload.sessionName === undefined
          ? current.sessionName
          : payload.sessionName.trim() || current.sessionName || "aleta-session",
      status: nextStatus as WhatsAppWebConfig["status"],
      lastConnectedAt:
        payload.lastConnectedAt === undefined ? current.lastConnectedAt : payload.lastConnectedAt || undefined,
    };

    const now = new Date().toISOString();
    await tx.prepare(
      `UPDATE whatsapp_web_settings
       SET phone_number = ?, session_name = ?, status = ?, last_connected_at = ?, updated_at = ?
       WHERE id = 1`
    ).run(
      nextValue.phoneNumber,
      nextValue.sessionName,
      nextValue.status,
      nextValue.lastConnectedAt ?? null,
      now
    );

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_WHATSAPP_SETTINGS",
      entityType: "whatsapp_web_settings",
      entityId: "1",
      payload: nextValue,
    });

    return getWhatsAppSettingsFromDb(tx);
  });
}

export async function updatePanelSettingsInDb(
  db: AletaDatabase,
  {
    actorUserId,
    payload,
  }: {
    actorUserId: string;
    payload: {
      footerMode?: unknown;
      portalCards?: unknown;
      publicAccess?: unknown;
      externalApps?: unknown;
      updatedAt?: unknown;
    };
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat mengubah pengaturan panel.");
  }

  return withTransaction(db, async (tx) => {
    await ensurePanelSettingsSeeded(tx);
    const current = await getPanelSettingsFromDb(tx);
    const nextValue = normalizePanelSettings({
      ...current,
      ...payload,
    });

    const now = new Date().toISOString();
    await tx.prepare(
      `UPDATE panel_settings
       SET footer_mode = ?, portal_cards_json = ?, public_access_json = ?, external_apps_json = ?, updated_by = ?, updated_at = ?
       WHERE id = 1`
    ).run(
      nextValue.footerMode,
      JSON.stringify(nextValue.portalCards),
      JSON.stringify(nextValue.publicAccess),
      JSON.stringify(nextValue.externalApps),
      actor.id,
      now
    );

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_PANEL_SETTINGS",
      entityType: "panel_settings",
      entityId: "1",
      payload: {
        footerMode: nextValue.footerMode,
        portalCards: nextValue.portalCards,
        publicAccess: nextValue.publicAccess,
        externalApps: Object.fromEntries(
          Object.entries(nextValue.externalApps).map(([appId, config]) => [
            appId,
            {
              enabled: config.enabled,
              baseUrl: config.baseUrl,
              loginPath: config.loginPath,
              usernameField: config.usernameField,
              passwordField: config.passwordField,
              passwordMode: config.passwordMode,
            },
          ])
        ),
      },
    });

    return getPanelSettingsFromDb(tx);
  });
}

export async function updateModuleVisibilityInDb(
  db: AletaDatabase,
  {
    actorUserId,
    roleId,
    moduleId,
    enabled,
  }: {
    actorUserId: string;
    roleId: ModuleVisibility["roleId"];
    moduleId: ModuleId;
    enabled: boolean;
  }
) {
  const actor = await requireActorUser(db, actorUserId);

  if (actor.roleId !== "super-admin") {
    throw new ApiError(403, "Hanya Super Admin yang dapat mengubah visibilitas modul.");
  }

  return withTransaction(db, async (tx) => {
    await ensureModuleVisibilitySeeded(tx);
    const now = new Date().toISOString();

    await tx.prepare(
      `INSERT INTO module_visibility_settings (role_id, module_id, enabled, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(role_id, module_id) DO UPDATE SET
         enabled = excluded.enabled,
         updated_at = excluded.updated_at`
    ).run(roleId, moduleId, enabled ? 1 : 0, now);

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_MODULE_VISIBILITY",
      entityType: "module_visibility_settings",
      entityId: `${roleId}:${moduleId}`,
      payload: {
        roleId,
        moduleId,
        enabled,
      },
    });

    return getModuleVisibilityFromDb(tx);
  });
}
