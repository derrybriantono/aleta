import { type QueryResultRow } from "pg";

import { moduleVisibility as defaultModuleVisibility } from "@/lib/mock-data";
import { isPrivilegedAdmin } from "@/lib/permissions";
import { type InstitutionIdentity, type ModuleId, type ModuleVisibility, type WhatsAppWebConfig } from "@/lib/types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import { requireActorUser } from "@/server/modules/organization/service";

type InstitutionIdentityRow = QueryResultRow & {
  court_name: string;
  court_short_name: string;
  address: string;
  phone_number: string;
  mobile_phone: string;
  email: string;
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
  website: string | null;
  map_url: string | null;
  updated_at: string;
};

type WhatsAppSettingsRow = QueryResultRow & {
  phone_number: string;
  session_name: string;
  status: string;
  last_connected_at: string | null;
  updated_at: string;
};

type ModuleVisibilityRow = QueryResultRow & {
  role_id: ModuleVisibility["roleId"];
  module_id: ModuleId;
  enabled: number;
};

function mapInstitutionRow(row: InstitutionIdentityRow): InstitutionIdentity {
  return {
    courtName: row.court_name,
    courtShortName: row.court_short_name,
    address: row.address,
    phoneNumber: row.phone_number,
    mobilePhone: row.mobile_phone,
    email: row.email,
    instagram: row.instagram ?? undefined,
    facebook: row.facebook ?? undefined,
    youtube: row.youtube ?? undefined,
    website: row.website ?? undefined,
    mapUrl: row.map_url ?? undefined,
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

async function ensureModuleVisibilitySeeded(db: AletaDatabase) {
  const existing = await db.prepare(
    `SELECT COUNT(*)::int AS count
     FROM module_visibility_settings`
  ).get<{ count: number }>();

  if ((existing?.count ?? 0) > 0) {
    return;
  }

  const now = new Date().toISOString();
  for (const visibility of defaultModuleVisibility) {
    for (const [moduleId, enabled] of Object.entries(visibility.modules)) {
      await db.prepare(
        `INSERT INTO module_visibility_settings (role_id, module_id, enabled, updated_at)
         VALUES (?, ?, ?, ?)`
      ).run(visibility.roleId, moduleId, enabled ? 1 : 0, now);
    }
  }
}

function buildDefaultModuleVisibilityMap() {
  return new Map(
    defaultModuleVisibility.map((item) => [
      item.roleId,
      { ...item, modules: { ...item.modules } },
    ])
  );
}

function mapModuleVisibilityRows(rows: ModuleVisibilityRow[]) {
  const visibilityMap = buildDefaultModuleVisibilityMap();

  for (const row of rows) {
    const current = visibilityMap.get(row.role_id);
    if (!current) continue;

    current.modules[row.module_id] = Boolean(row.enabled);
  }

  return Array.from(visibilityMap.values());
}

export async function getInstitutionIdentityFromDb(db: AletaDatabase) {
  const row = await db.prepare(
    `SELECT court_name, court_short_name, address, phone_number, mobile_phone, email,
      instagram, facebook, youtube, website, map_url, updated_at
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
      email: (payload.email ?? current.email).trim(),
      instagram: payload.instagram === undefined ? current.instagram : payload.instagram?.trim() || undefined,
      facebook: payload.facebook === undefined ? current.facebook : payload.facebook?.trim() || undefined,
      youtube: payload.youtube === undefined ? current.youtube : payload.youtube?.trim() || undefined,
      website: payload.website === undefined ? current.website : payload.website?.trim() || undefined,
      mapUrl: payload.mapUrl === undefined ? current.mapUrl : payload.mapUrl?.trim() || undefined,
    };

    if (!nextValue.courtName || !nextValue.courtShortName || !nextValue.address || !nextValue.email) {
      throw new ApiError(400, "Nama instansi, nama singkat, alamat, dan email wajib diisi.");
    }

    const now = new Date().toISOString();
    await tx.prepare(
      `UPDATE institution_identity
       SET court_name = ?, court_short_name = ?, address = ?, phone_number = ?, mobile_phone = ?,
         email = ?, instagram = ?, facebook = ?, youtube = ?, website = ?, map_url = ?, updated_at = ?
       WHERE id = 1`
    ).run(
      nextValue.courtName,
      nextValue.courtShortName,
      nextValue.address,
      nextValue.phoneNumber,
      nextValue.mobilePhone,
      nextValue.email,
      nextValue.instagram ?? null,
      nextValue.facebook ?? null,
      nextValue.youtube ?? null,
      nextValue.website ?? null,
      nextValue.mapUrl ?? null,
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
