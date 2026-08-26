import type { QueryResultRow } from "pg";

import type { AletaDatabase } from "@/server/db/client";
import type { RoleId, UserPersona } from "@/lib/types";
import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import { nextPrefixedId } from "@/server/shared/ids";
import { getRoleLabel } from "@/lib/permissions";
import { getUserByIdFromDb, requireActorUser } from "@/server/modules/organization/service";
import { logSippAccountEvent } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { jlfBadRequest, jlfConflict, jlfNotFound } from "@/server/modules/judicia/legal-form/jlf-service-errors";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import {
  JlfSippProviderRegistry,
  type SippUserSummary,
} from "@/server/modules/judicia/legal-form/jlf-sipp-readonly-provider";

export type AccountLinkFilters = {
  status?: string;
  aletaUserId?: string;
  query?: string;
  limit?: number;
};

type AccountLinkRow = QueryResultRow & {
  id: string;
  aleta_user_id: string;
  aleta_user_name: string | null;
  sipp_user_id: string;
  sipp_username: string;
  sipp_fullname: string;
  sipp_nip: string;
  sipp_email: string;
  sipp_group_id: string;
  sipp_group_name: string;
  sipp_satker_code: string;
  sipp_satker_name: string;
  link_status: string;
  link_method: string;
  confidence_score: number;
  matched_fields: unknown;
  linked_by: string | null;
  linked_at: string | null;
  unlinked_by: string | null;
  unlinked_at: string | null;
  last_synced_at: string | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
};

type RoleMappingRow = QueryResultRow & {
  id: string;
  sipp_group_id: string;
  sipp_group_name: string;
  suggested_aleta_role_id: RoleId | null;
  suggested_permissions: unknown;
  is_auto_apply: boolean;
  requires_admin_approval: boolean;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function mapAccountLink(row: AccountLinkRow) {
  return {
    id: row.id,
    aletaUserId: row.aleta_user_id,
    aletaUserName: row.aleta_user_name ?? row.aleta_user_id,
    sippUser: {
      id: row.sipp_user_id,
      username: row.sipp_username,
      fullname: row.sipp_fullname,
      nip: row.sipp_nip,
      email: row.sipp_email,
      groupId: row.sipp_group_id,
      groupName: row.sipp_group_name,
      satkerCode: row.sipp_satker_code,
      satkerName: row.sipp_satker_name,
    },
    linkStatus: row.link_status,
    linkMethod: row.link_method,
    confidenceScore: Number(row.confidence_score) || 0,
    matchedFields: row.matched_fields ?? [],
    linkedBy: row.linked_by,
    linkedAt: row.linked_at,
    unlinkedBy: row.unlinked_by,
    unlinkedAt: row.unlinked_at,
    lastSyncedAt: row.last_synced_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRoleMapping(row: RoleMappingRow) {
  return {
    id: row.id,
    sippGroupId: row.sipp_group_id,
    sippGroupName: row.sipp_group_name,
    suggestedAletaRoleId: row.suggested_aleta_role_id,
    suggestedAletaRoleLabel: row.suggested_aleta_role_id ? getRoleLabel(row.suggested_aleta_role_id) : "-",
    suggestedPermissions: row.suggested_permissions ?? [],
    isAutoApply: Boolean(row.is_auto_apply),
    requiresAdminApproval: Boolean(row.requires_admin_approval),
    description: row.description,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function fullnameSimilarity(left: string, right: string) {
  const leftTokens = new Set(normalizeText(left).split(/\s+/).filter(Boolean));
  const rightTokens = new Set(normalizeText(right).split(/\s+/).filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let matches = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) matches += 1;
  }

  return matches / Math.max(leftTokens.size, rightTokens.size);
}

export function calculateLinkConfidence(aletaUser: UserPersona, sippUser: SippUserSummary) {
  const matchedFields: string[] = [];
  let score = 0;

  if (aletaUser.nip && sippUser.nip && normalizeText(aletaUser.nip) === normalizeText(sippUser.nip)) {
    matchedFields.push("nip");
    score += 45;
  }

  if (normalizeText(aletaUser.username) && normalizeText(aletaUser.username) === normalizeText(sippUser.username)) {
    matchedFields.push("username");
    score += 20;
  }

  if (normalizeText(aletaUser.email) && normalizeText(aletaUser.email) === normalizeText(sippUser.email)) {
    matchedFields.push("email");
    score += 20;
  }

  const nameScore = fullnameSimilarity(aletaUser.name, sippUser.fullname);
  if (nameScore >= 0.6) {
    matchedFields.push("fullname");
    score += Math.round(nameScore * 20);
  }

  const roleLabel = getRoleLabel(aletaUser.roleId).toLowerCase();
  const sippGroup = normalizeText(sippUser.groupName);
  if (roleLabel && sippGroup && (sippGroup.includes(roleLabel) || roleLabel.includes(sippGroup))) {
    matchedFields.push("group_role_relevance");
    score += 5;
  }

  return {
    score: Math.min(100, score),
    matchedFields,
  };
}

async function readLinkById(db: AletaDatabase, linkId: string) {
  const row = await db.prepare(
    `SELECT l.*, u.name AS aleta_user_name
     FROM jlf_sipp_account_links l
     LEFT JOIN users u ON u.id = l.aleta_user_id
     WHERE l.id = ?`
  ).get<AccountLinkRow>(linkId);

  return row ? mapAccountLink(row) : null;
}

async function insertAccountLink(
  db: AletaDatabase,
  input: {
    aletaUserId: string;
    sippUser: SippUserSummary;
    status: string;
    method: string;
    confidenceScore: number;
    matchedFields: string[];
    actorId?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  const existing = await db.prepare(
    `SELECT id
     FROM jlf_sipp_account_links
     WHERE aleta_user_id = ? AND sipp_user_id = ?
       AND link_status <> 'rejected'
       AND link_status <> 'unlinked'
       AND link_status <> 'disabled'
     ORDER BY created_at DESC
     LIMIT 1`
  ).get<{ id: string }>(input.aletaUserId, input.sippUser.id);

  if (existing) {
    return readLinkById(db, existing.id);
  }

  const id = await nextPrefixedId(db, "jlf_sipp_account_links", "jlf-link");
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO jlf_sipp_account_links (
      id, aleta_user_id, sipp_user_id, sipp_username, sipp_fullname, sipp_nip,
      sipp_email, sipp_group_id, sipp_group_name, sipp_satker_code, sipp_satker_name,
      link_status, link_method, confidence_score, matched_fields, linked_by, linked_at,
      metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?::jsonb, ?, ?)`
  ).run(
    id,
    input.aletaUserId,
    input.sippUser.id,
    input.sippUser.username,
    input.sippUser.fullname,
    input.sippUser.nip ?? "",
    input.sippUser.email ?? "",
    input.sippUser.groupId ?? "",
    input.sippUser.groupName ?? "",
    input.sippUser.satkerCode ?? "",
    input.sippUser.satkerName ?? "",
    input.status,
    input.method,
    input.confidenceScore,
    JSON.stringify(input.matchedFields),
    input.status === "linked" ? input.actorId ?? null : null,
    input.status === "linked" ? now : null,
    JSON.stringify(input.metadata ?? {}),
    now,
    now
  );

  return readLinkById(db, id);
}

export async function listAccountLinks(db: AletaDatabase, actor: UserPersona, filters: AccountLinkFilters = {}) {
  requireJlfPermission(actor, JLF_PERMISSION.ACCOUNT_SYNC_VIEW);

  const where: string[] = [];
  const params: Array<string | number> = [];
  if (filters.status) {
    where.push("l.link_status = ?");
    params.push(filters.status);
  }
  if (filters.aletaUserId) {
    where.push("l.aleta_user_id = ?");
    params.push(filters.aletaUserId);
  }
  if (filters.query) {
    where.push("(LOWER(l.sipp_username) LIKE ? OR LOWER(l.sipp_fullname) LIKE ? OR LOWER(l.sipp_nip) LIKE ? OR LOWER(u.name) LIKE ?)");
    const like = `%${filters.query.toLowerCase()}%`;
    params.push(like, like, like, like);
  }

  const limit = Math.max(1, Math.min(200, filters.limit ?? 50));
  params.push(limit);

  const rows = await db.prepare(
    `SELECT l.*, u.name AS aleta_user_name
     FROM jlf_sipp_account_links l
     LEFT JOIN users u ON u.id = l.aleta_user_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY l.updated_at DESC
     LIMIT ?`
  ).all<AccountLinkRow>(...params);

  return rows.map(mapAccountLink);
}

export async function getLinkedSippAccount(db: AletaDatabase, actor: UserPersona, aletaUserId: string) {
  if (actor.id !== aletaUserId) {
    requireJlfPermission(actor, JLF_PERMISSION.ACCOUNT_SYNC_VIEW);
  }

  const row = await db.prepare(
    `SELECT l.*, u.name AS aleta_user_name
     FROM jlf_sipp_account_links l
     LEFT JOIN users u ON u.id = l.aleta_user_id
     WHERE l.aleta_user_id = ? AND l.link_status = 'linked'
     ORDER BY l.linked_at DESC
     LIMIT 1`
  ).get<AccountLinkRow>(aletaUserId);

  return row ? mapAccountLink(row) : null;
}

export async function suggestAccountLinks(db: AletaDatabase, actor: UserPersona, aletaUserId: string) {
  requireJlfPermission(actor, JLF_PERMISSION.ACCOUNT_SYNC_MANAGE);

  const aletaUser = await getUserByIdFromDb(db, aletaUserId);
  if (!aletaUser) jlfNotFound("Akun ALETA tidak ditemukan.");

  const provider = JlfSippProviderRegistry.getProvider();
  const candidates = new Map<string, SippUserSummary>();
  const searches = [
    aletaUser.nip ? provider.findSippUserByNip(aletaUser.nip) : Promise.resolve(null),
    aletaUser.email ? provider.findSippUserByEmail(aletaUser.email) : Promise.resolve(null),
    aletaUser.username ? provider.findSippUserByUsername(aletaUser.username) : Promise.resolve(null),
    provider.searchSippUsers(aletaUser.name, 10).then((items) => items[0] ?? null),
  ];
  const results = await Promise.all(searches);

  for (const candidate of results) {
    if (candidate?.id) candidates.set(candidate.id, candidate);
  }

  const ranked = Array.from(candidates.values())
    .map((candidate) => ({
      sippUser: candidate,
      ...calculateLinkConfidence(aletaUser, candidate),
    }))
    .sort((left, right) => right.score - left.score);

  const strong = ranked.filter((item) => item.score >= 70);
  const statusForStrong = strong.length > 1 ? "conflict" : "suggested";
  const created = [];

  for (const item of ranked.filter((candidate) => candidate.score >= 45)) {
    const link = await insertAccountLink(db, {
      aletaUserId,
      sippUser: item.sippUser,
      status: item.score >= 70 ? statusForStrong : "suggested",
      method: "auto_suggestion",
      confidenceScore: item.score,
      matchedFields: item.matchedFields,
      actorId: actor.id,
      metadata: { generatedBy: "jlf_account_sync_service" },
    });
    if (link) created.push(link);
  }

  await logSippAccountEvent(db, {
    userId: actor.id,
    action: "account_link.suggest",
    entityId: aletaUserId,
    metadata: { candidates: ranked.length, created: created.length },
  });

  return { items: created, candidates: ranked, provider: provider.key };
}

export async function createManualLink(
  db: AletaDatabase,
  actor: UserPersona,
  input: { aletaUserId: string; sippUserId: string }
) {
  requireJlfPermission(actor, JLF_PERMISSION.ACCOUNT_SYNC_MANAGE);

  const aletaUser = await getUserByIdFromDb(db, input.aletaUserId);
  if (!aletaUser) jlfNotFound("Akun ALETA tidak ditemukan.");

  const existingLinked = await getLinkedSippAccount(db, actor, input.aletaUserId);
  if (existingLinked) {
    jlfConflict("Akun ALETA ini sudah terhubung. Putuskan link lama sebelum membuat link baru.");
  }

  const provider = JlfSippProviderRegistry.getProvider();
  const sippUser = await provider.getSippUserById(input.sippUserId);
  if (!sippUser) {
    jlfNotFound("User SIPP tidak ditemukan dari adapter aman yang tersedia.");
  }

  const confidence = calculateLinkConfidence(aletaUser, sippUser);
  const link = await insertAccountLink(db, {
    aletaUserId: input.aletaUserId,
    sippUser,
    status: "linked",
    method: "manual_admin",
    confidenceScore: confidence.score,
    matchedFields: confidence.matchedFields,
    actorId: actor.id,
  });

  if (link?.linkStatus && link.linkStatus !== "linked") {
    return updateLinkStatus(db, actor, link.id, "linked", "account_link.manual_link", "Manual link dipilih admin.");
  }

  await logSippAccountEvent(db, {
    userId: actor.id,
    action: "account_link.manual_link",
    entityId: link?.id ?? input.aletaUserId,
    metadata: { aletaUserId: input.aletaUserId, sippUserId: input.sippUserId },
  });

  return link;
}

async function updateLinkStatus(
  db: AletaDatabase,
  actor: UserPersona,
  linkId: string,
  status: string,
  action: string,
  reason?: string
) {
  requireJlfPermission(actor, JLF_PERMISSION.ACCOUNT_SYNC_MANAGE);

  const existing = await readLinkById(db, linkId);
  if (!existing) jlfNotFound("Link akun SIPP tidak ditemukan.");

  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE jlf_sipp_account_links
     SET link_status = ?,
         linked_by = CASE WHEN ? = 'linked' THEN ? ELSE linked_by END,
         linked_at = CASE WHEN ? = 'linked' THEN ? ELSE linked_at END,
         unlinked_by = CASE WHEN ? IN ('unlinked', 'disabled') THEN ? ELSE unlinked_by END,
         unlinked_at = CASE WHEN ? IN ('unlinked', 'disabled') THEN ? ELSE unlinked_at END,
         metadata = ?::jsonb,
         updated_at = ?
     WHERE id = ?`
  ).run(
    status,
    status,
    actor.id,
    status,
    now,
    status,
    actor.id,
    status,
    now,
    JSON.stringify({ reason: reason ?? "", action }),
    now,
    linkId
  );

  await logSippAccountEvent(db, {
    userId: actor.id,
    action,
    entityId: linkId,
    metadata: { status, reason: reason ?? "" },
  });

  return readLinkById(db, linkId);
}

export function approveSuggestedLink(db: AletaDatabase, actor: UserPersona, linkId: string) {
  return updateLinkStatus(db, actor, linkId, "linked", "account_link.approve");
}

export function rejectSuggestedLink(db: AletaDatabase, actor: UserPersona, linkId: string, reason?: string) {
  return updateLinkStatus(db, actor, linkId, "rejected", "account_link.reject", reason);
}

export function unlinkAccount(db: AletaDatabase, actor: UserPersona, linkId: string, reason?: string) {
  return updateLinkStatus(db, actor, linkId, "unlinked", "account_link.unlink", reason);
}

export async function relinkAccount(
  db: AletaDatabase,
  actor: UserPersona,
  oldLinkId: string,
  newSippUserId: string
) {
  const oldLink = await updateLinkStatus(db, actor, oldLinkId, "unlinked", "account_link.relink_old");
  if (!oldLink) jlfNotFound("Link lama tidak ditemukan.");
  return createManualLink(db, actor, { aletaUserId: oldLink.aletaUserId, sippUserId: newSippUserId });
}

export async function listMappings(db: AletaDatabase, actor: UserPersona) {
  requireJlfPermission(actor, JLF_PERMISSION.SIPP_ROLE_MAPPING_MANAGE);

  const rows = await db.prepare(
    `SELECT id, sipp_group_id, sipp_group_name, suggested_aleta_role_id, suggested_permissions,
       is_auto_apply, requires_admin_approval, description, is_active, created_at, updated_at
     FROM jlf_sipp_role_mappings
     ORDER BY is_active DESC, sipp_group_name ASC`
  ).all<RoleMappingRow>();

  return rows.map(mapRoleMapping);
}

export function suggestAletaRoleFromSippGroup(groupName: string): RoleId {
  const normalized = normalizeText(groupName);
  if (normalized.includes("hakim")) return "hakim";
  if (normalized.includes("panitera pengganti")) return "panitera-pengganti";
  if (normalized.includes("panitera muda")) return "panitera-muda";
  if (normalized.includes("panitera")) return "panitera";
  if (normalized.includes("jurusita")) return "jurusita";
  if (normalized.includes("ketua") && normalized.includes("wakil")) return "wakil-ketua";
  if (normalized.includes("ketua")) return "ketua";
  if (normalized.includes("admin")) return "admin";
  return "staf";
}

export async function createMapping(
  db: AletaDatabase,
  actor: UserPersona,
  input: {
    sippGroupId: string;
    sippGroupName: string;
    suggestedAletaRoleId?: RoleId;
    suggestedPermissions?: string[];
    isAutoApply?: boolean;
    requiresAdminApproval?: boolean;
    description?: string;
  }
) {
  requireJlfPermission(actor, JLF_PERMISSION.SIPP_ROLE_MAPPING_MANAGE);
  if (!input.sippGroupId.trim() || !input.sippGroupName.trim()) {
    jlfBadRequest("Group SIPP wajib diisi.");
  }

  const id = await nextPrefixedId(db, "jlf_sipp_role_mappings", "jlf-map");
  const now = new Date().toISOString();
  const roleId = input.suggestedAletaRoleId ?? suggestAletaRoleFromSippGroup(input.sippGroupName);

  await db.prepare(
    `INSERT INTO jlf_sipp_role_mappings (
      id, sipp_group_id, sipp_group_name, suggested_aleta_role_id, suggested_permissions,
      is_auto_apply, requires_admin_approval, description, is_active, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.sippGroupId.trim(),
    input.sippGroupName.trim(),
    roleId,
    JSON.stringify(input.suggestedPermissions ?? []),
    input.isAutoApply ? 1 : 0,
    input.requiresAdminApproval === false ? 0 : 1,
    input.description ?? "",
    1,
    actor.id,
    actor.id,
    now,
    now
  );

  await logSippAccountEvent(db, {
    userId: actor.id,
    action: "CREATE_SIPP_ROLE_MAPPING",
    entityId: id,
    metadata: { sippGroupId: input.sippGroupId, suggestedAletaRoleId: roleId },
  });

  return (await listMappings(db, actor)).find((item) => item.id === id) ?? null;
}

export async function updateMapping(
  db: AletaDatabase,
  actor: UserPersona,
  input: {
    id: string;
    sippGroupName?: string;
    suggestedAletaRoleId?: RoleId;
    suggestedPermissions?: string[];
    isAutoApply?: boolean;
    requiresAdminApproval?: boolean;
    description?: string;
    isActive?: boolean;
  }
) {
  requireJlfPermission(actor, JLF_PERMISSION.SIPP_ROLE_MAPPING_MANAGE);
  const existing = await db.prepare("SELECT id FROM jlf_sipp_role_mappings WHERE id = ?").get<{ id: string }>(input.id);
  if (!existing) jlfNotFound("Mapping role SIPP tidak ditemukan.");

  await db.prepare(
    `UPDATE jlf_sipp_role_mappings
     SET sipp_group_name = COALESCE(?, sipp_group_name),
         suggested_aleta_role_id = COALESCE(?, suggested_aleta_role_id),
         suggested_permissions = COALESCE(?::jsonb, suggested_permissions),
         is_auto_apply = COALESCE(?, is_auto_apply),
         requires_admin_approval = COALESCE(?, requires_admin_approval),
         description = COALESCE(?, description),
         is_active = COALESCE(?, is_active),
         updated_by = ?,
         updated_at = ?
     WHERE id = ?`
  ).run(
    input.sippGroupName ?? null,
    input.suggestedAletaRoleId ?? null,
    input.suggestedPermissions ? JSON.stringify(input.suggestedPermissions) : null,
    input.isAutoApply === undefined ? null : input.isAutoApply ? 1 : 0,
    input.requiresAdminApproval === undefined ? null : input.requiresAdminApproval ? 1 : 0,
    input.description ?? null,
    input.isActive === undefined ? null : input.isActive ? 1 : 0,
    actor.id,
    new Date().toISOString(),
    input.id
  );

  await logSippAccountEvent(db, {
    userId: actor.id,
    action: "UPDATE_SIPP_ROLE_MAPPING",
    entityId: input.id,
    metadata: { isActive: input.isActive },
  });

  return (await listMappings(db, actor)).find((item) => item.id === input.id) ?? null;
}

export function disableMapping(db: AletaDatabase, actor: UserPersona, id: string) {
  return updateMapping(db, actor, { id, isActive: false });
}

export async function applyMappingWithApproval(db: AletaDatabase, actorUserId: string, mappingId: string) {
  const actor = await requireActorUser(db, actorUserId);
  requireJlfPermission(actor, JLF_PERMISSION.SIPP_ROLE_MAPPING_MANAGE);
  return {
    mappingId,
    applied: false,
    requiresAdminApproval: true,
    message: "Role mapping JLF disiapkan sebagai rekomendasi. Auto-apply belum diaktifkan.",
  };
}

export const JlfAccountLinkingService = {
  suggestAccountLinks,
  calculateLinkConfidence,
  createManualLink,
  approveSuggestedLink,
  rejectSuggestedLink,
  unlinkAccount,
  relinkAccount,
  getLinkedSippAccount,
  listAccountLinks,
};

export const JlfSippRoleMappingService = {
  listMappings,
  createMapping,
  updateMapping,
  disableMapping,
  suggestAletaRoleFromSippGroup,
  applyMappingWithApproval,
};

export const JlfAccountSyncService = {
  suggestAccountLinks,
  createManualLink,
  listAccountLinks,
  listMappings,
  createMapping,
  updateMapping,
};
