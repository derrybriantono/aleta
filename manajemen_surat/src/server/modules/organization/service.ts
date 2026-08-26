import { and, asc, desc, gte, isNull, lte, or } from "drizzle-orm";

import { getResolvedActingAssignment, validateActingAssignmentRequest } from "@/core/organization/service";
import { canManageActingAssignments, getDefaultRoleForPosition } from "@/lib/permissions";
import {
  type ActingAssignment,
  type Position,
  type Role,
  type UserPersona,
} from "@/lib/types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { actingAssignments, positions, users } from "@/server/db/drizzle-schema";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";
import { parseJsonArray } from "@/server/shared/json";

type PositionRow = {
  id: string;
  name: string;
  unit_kerja: string;
  level_hierarchy: number;
  reports_to_position_id: string | null;
  disposition_target_position_ids_json: string;
  can_forward_to_leadership: number;
};

type RoleRow = {
  id: string;
  name: string;
  description: string;
};

type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  nip: string | null;
  email: string;
  whatsapp_number: string;
  profile_photo_url: string | null;
  role_id: string;
  position_id: string;
  additional_role_ids_json: string;
  is_active: number;
  can_bypass_hierarchy: number;
};

type ActingAssignmentRow = {
  id: string;
  user_id_pengganti: string;
  jabatan_id_target: string;
  tipe: string;
  role_id_target: string;
  assigned_by_user_id: string;
  authorized_by_user_id: string;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
  assigned_at: string;
};

type ActingAssignmentListRow = ActingAssignmentRow & {
  assignee_name: string;
  target_position_name: string;
  assigned_by_name: string;
};

type ActingAssignmentConflictRow = {
  id: string;
  user_id_pengganti: string;
  jabatan_id_target: string;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
};

function mapPositionRow(row: PositionRow): Position {
  return {
    id: row.id,
    name: row.name,
    unitKerja: row.unit_kerja,
    levelHierarchy: row.level_hierarchy,
    reportsToPositionId: row.reports_to_position_id,
    dispositionTargetPositionIds: parseJsonArray<string>(row.disposition_target_position_ids_json),
    canForwardToLeadership: Boolean(row.can_forward_to_leadership),
  };
}

function mapAssignmentRow(row: ActingAssignmentRow): ActingAssignment {
  return {
    type: row.tipe as ActingAssignment["type"],
    roleId: row.role_id_target as UserPersona["roleId"],
    positionId: row.jabatan_id_target,
    assignedByUserId: row.assigned_by_user_id,
    authorizedByUserId: row.authorized_by_user_id,
    startDate: row.tanggal_mulai,
    endDate: row.tanggal_selesai,
    assignedAt: row.assigned_at,
  };
}

function mapUserRow(row: UserRow, assignment?: ActingAssignment | null): UserPersona {
  return {
    id: row.id,
    username: row.username,
    password: row.password_hash,
    name: row.name,
    nip: row.nip ?? "",
    email: row.email,
    whatsappNumber: row.whatsapp_number,
    profilePhotoUrl: row.profile_photo_url ?? undefined,
    roleId: row.role_id as UserPersona["roleId"],
    positionId: row.position_id,
    additionalRoleIds: parseJsonArray<string>(row.additional_role_ids_json),
    isActive: Boolean(row.is_active),
    canBypassHierarchy: Boolean(row.can_bypass_hierarchy),
    actingAssignment: assignment ?? null,
  };
}

export async function getPositionsFromDb(db: AletaDatabase) {
  if (!db.supportsFullTextSearch()) {
    const rows = await db.prepare(
      `SELECT id, name, unit_kerja, level_hierarchy, reports_to_position_id,
        disposition_target_position_ids_json, can_forward_to_leadership
       FROM positions
       WHERE deleted_at IS NULL
       ORDER BY level_hierarchy ASC, unit_kerja ASC, name ASC`
    ).all<PositionRow>();

    return rows.map(mapPositionRow);
  }

  const rows = await db.getOrm().select({
    id: positions.id,
    name: positions.name,
    unit_kerja: positions.unitKerja,
    level_hierarchy: positions.levelHierarchy,
    reports_to_position_id: positions.reportsToPositionId,
    disposition_target_position_ids_json: positions.dispositionTargetPositionIdsJson,
    can_forward_to_leadership: positions.canForwardToLeadership,
  }).from(positions)
    .where(isNull(positions.deletedAt))
    .orderBy(asc(positions.levelHierarchy), asc(positions.unitKerja), asc(positions.name));

  return rows.map(mapPositionRow);
}

export async function getRolesFromDb(db: AletaDatabase): Promise<Role[]> {
  const rows = await db.prepare(
    `SELECT id, name, description
     FROM roles
     ORDER BY id ASC`
  ).all<RoleRow>();

  return rows.map((row) => ({
    id: row.id as Role["id"],
    name: row.name,
    description: row.description,
  }));
}

async function getActiveAssignmentsFromDb(db: AletaDatabase) {
  const now = new Date().toISOString();
  if (!db.supportsFullTextSearch()) {
    const rows = await db.prepare(
      `SELECT id, user_id_pengganti, jabatan_id_target, tipe, role_id_target,
        assigned_by_user_id, authorized_by_user_id, tanggal_mulai, tanggal_selesai, assigned_at
       FROM acting_assignments
       WHERE deleted_at IS NULL
         AND tanggal_mulai <= ?
         AND (tanggal_selesai IS NULL OR tanggal_selesai >= ?)
       ORDER BY assigned_at DESC`
    ).all<ActingAssignmentRow>(now, now);

    return rows.reduce<Map<string, ActingAssignment>>((map, row) => {
      if (!map.has(row.user_id_pengganti)) {
        map.set(row.user_id_pengganti, mapAssignmentRow(row));
      }
      return map;
    }, new Map());
  }

  const rows = await db.getOrm().select({
    id: actingAssignments.id,
    user_id_pengganti: actingAssignments.userIdPengganti,
    jabatan_id_target: actingAssignments.jabatanIdTarget,
    tipe: actingAssignments.tipe,
    role_id_target: actingAssignments.roleIdTarget,
    assigned_by_user_id: actingAssignments.assignedByUserId,
    authorized_by_user_id: actingAssignments.authorizedByUserId,
    tanggal_mulai: actingAssignments.tanggalMulai,
    tanggal_selesai: actingAssignments.tanggalSelesai,
    assigned_at: actingAssignments.assignedAt,
  }).from(actingAssignments)
    .where(
      and(
        isNull(actingAssignments.deletedAt),
        lte(actingAssignments.tanggalMulai, now),
        or(isNull(actingAssignments.tanggalSelesai), gte(actingAssignments.tanggalSelesai, now))
      )
    )
    .orderBy(desc(actingAssignments.assignedAt));

  return rows.reduce<Map<string, ActingAssignment>>((map, row) => {
    if (!map.has(row.user_id_pengganti)) {
      map.set(row.user_id_pengganti, mapAssignmentRow(row));
    }
    return map;
  }, new Map());
}

export async function getUsersFromDb(db: AletaDatabase) {
  if (!db.supportsFullTextSearch()) {
    const rows = await db.prepare(
      `SELECT id, username, password_hash, name, nip, email, whatsapp_number, profile_photo_url,
        role_id, position_id, additional_role_ids_json, is_active, can_bypass_hierarchy
       FROM users
       WHERE deleted_at IS NULL
       ORDER BY name ASC`
    ).all<UserRow>();
    const assignmentMap = await getActiveAssignmentsFromDb(db);

    return rows.map((row) => mapUserRow(row, assignmentMap.get(row.id) ?? null));
  }

  const rows = await db.getOrm().select({
    id: users.id,
    username: users.username,
    password_hash: users.passwordHash,
    name: users.name,
    nip: users.nip,
    email: users.email,
    whatsapp_number: users.whatsappNumber,
    profile_photo_url: users.image,
    role_id: users.roleId,
    position_id: users.positionId,
    additional_role_ids_json: users.additionalRoleIdsJson,
    is_active: users.isActive,
    can_bypass_hierarchy: users.canBypassHierarchy,
  }).from(users)
    .where(isNull(users.deletedAt))
    .orderBy(asc(users.name));
  const assignmentMap = await getActiveAssignmentsFromDb(db);

  return rows.map((row) => mapUserRow(row, assignmentMap.get(row.id) ?? null));
}

export async function getUserByIdFromDb(db: AletaDatabase, userId: string) {
  return (await getUsersFromDb(db)).find((user) => user.id === userId) ?? null;
}

export async function requireActorUser(db: AletaDatabase, actorUserId: string | null | undefined) {
  if (!actorUserId) {
    throw new ApiError(401, "User aktif tidak ditemukan pada request.");
  }

  const actor = await getUserByIdFromDb(db, actorUserId);

  if (!actor || !actor.isActive) {
    throw new ApiError(401, "User aktif tidak valid atau sudah nonaktif.");
  }

  return actor;
}

export async function getPositionByIdFromDb(db: AletaDatabase, positionId: string) {
  return (await getPositionsFromDb(db)).find((position) => position.id === positionId) ?? null;
}

export async function getUsersByEffectivePositionFromDb(db: AletaDatabase, positionId: string) {
  return (await getUsersFromDb(db)).filter(
    (user) => (user.actingAssignment?.positionId ?? user.positionId) === positionId && user.isActive
  );
}

export async function getLeadershipRecipientsFromDb(db: AletaDatabase) {
  return (await getUsersFromDb(db)).filter((user) => {
    const effectivePositionId = user.actingAssignment?.positionId ?? user.positionId;
    return user.isActive && (effectivePositionId === "pos-ketua" || effectivePositionId === "pos-wakil");
  });
}

export async function resolveTargetRecipientFromDb(db: AletaDatabase, {
  targetPositionId,
  targetUserId,
}: {
  targetPositionId: string;
  targetUserId?: string | null;
}) {
  if (targetUserId) {
    const directUser = await getUserByIdFromDb(db, targetUserId);
    if (directUser?.isActive) {
      return directUser;
    }
  }

  const users = await getUsersByEffectivePositionFromDb(db, targetPositionId);
  if (users.length === 0) {
    throw new ApiError(400, "Tidak ada user aktif pada jabatan tujuan yang dipilih.");
  }

  return users[0];
}

async function getOverlappingActingAssignmentsFromDb(
  db: AletaDatabase,
  {
    userIdPengganti,
    jabatanIdTarget,
    tanggalMulai,
    tanggalSelesai,
  }: {
    userIdPengganti: string;
    jabatanIdTarget: string;
    tanggalMulai: string;
    tanggalSelesai: string;
  }
) {
  return db.prepare(
    `SELECT id, user_id_pengganti, jabatan_id_target, tanggal_mulai, tanggal_selesai
     FROM acting_assignments
     WHERE deleted_at IS NULL
       AND (user_id_pengganti = ? OR jabatan_id_target = ?)
       AND tanggal_mulai <= ?
       AND (tanggal_selesai IS NULL OR tanggal_selesai >= ?)`
  ).all<ActingAssignmentConflictRow>(userIdPengganti, jabatanIdTarget, tanggalSelesai, tanggalMulai);
}

export async function createActingAssignmentInDb(db: AletaDatabase, {
  actorUserId,
  supervisorUserId,
  userIdPengganti,
  jabatanIdTarget,
  tipe,
  tanggalMulai,
  tanggalSelesai,
  reason,
}: {
  actorUserId: string;
  supervisorUserId?: string | null;
  userIdPengganti: string;
  jabatanIdTarget: string;
  tipe: ActingAssignment["type"];
  tanggalMulai?: string;
  tanggalSelesai?: string | null;
  reason?: string | null;
}) {
  const actor = await requireActorUser(db, actorUserId);
  const assignee = await getUserByIdFromDb(db, userIdPengganti);
  const authorizedSupervisor = supervisorUserId ? await getUserByIdFromDb(db, supervisorUserId) : actor;

  if (getResolvedActingAssignment(actor) && actor.roleId !== "super-admin" && actor.roleId !== "admin") {
    throw new ApiError(403, "Pejabat yang hanya bertindak sebagai PLH/PLT tidak boleh membuat penugasan jabatan baru.");
  }

  if (!canManageActingAssignments(actor)) {
    throw new ApiError(403, "Role aktif tidak memiliki hak untuk mengelola penugasan PLH/PLT.");
  }

  if (authorizedSupervisor?.id !== actor.id && actor.roleId !== "super-admin" && actor.roleId !== "admin") {
    throw new ApiError(403, "Hanya Super Admin/Admin yang boleh mencatat penugasan atas otorisasi pejabat lain.");
  }

  if (!assignee) {
    throw new ApiError(404, "User pengganti tidak ditemukan.");
  }

  if (!authorizedSupervisor) {
    throw new ApiError(404, "Pejabat pemberi otorisasi tidak ditemukan.");
  }

  const positionSource = await getPositionsFromDb(db);
  const validation = validateActingAssignmentRequest({
    supervisorUser: authorizedSupervisor,
    assigneeUser: assignee,
    actingType: tipe,
    targetPositionId: jabatanIdTarget,
    startDate: tanggalMulai,
    endDate: tanggalSelesai,
    reason,
    positionSource,
  });

  if (!validation.valid) {
    throw new ApiError(
      "statusCodeHint" in validation && typeof validation.statusCodeHint === "number"
        ? validation.statusCodeHint
        : validation.message.includes("jalur jabatan")
          ? 403
          : 400,
      validation.message
    );
  }

  const normalizedStartDate = tanggalMulai ?? new Date().toISOString();
  const normalizedEndDate = tanggalSelesai ?? "";
  const overlaps = await getOverlappingActingAssignmentsFromDb(db, {
    userIdPengganti,
    jabatanIdTarget,
    tanggalMulai: normalizedStartDate,
    tanggalSelesai: normalizedEndDate,
  });

  if (overlaps.length > 0) {
    throw new ApiError(
      409,
      "Terdapat konflik penugasan PLH/PLT aktif pada kandidat atau jabatan target untuk periode yang sama."
    );
  }

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();
    const assignmentId = await nextPrefixedId(tx, "acting_assignments", "asg");
    const roleIdTarget = getDefaultRoleForPosition(jabatanIdTarget);

    await tx.prepare(
      `INSERT INTO acting_assignments (
        id, user_id_pengganti, jabatan_id_target, tipe, role_id_target, assigned_by_user_id,
        authorized_by_user_id, tanggal_mulai, tanggal_selesai, assigned_at, deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      assignmentId,
      userIdPengganti,
      jabatanIdTarget,
      tipe,
      roleIdTarget,
      actor.id,
      authorizedSupervisor.id,
      normalizedStartDate,
      tanggalSelesai ?? null,
      now,
      null,
      now,
      now
    );

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "ASSIGN_ACTING_ROLE",
      entityType: "acting_assignment",
      entityId: assignmentId,
      payload: {
        userIdPengganti,
        jabatanIdTarget,
        tipe,
        tanggalMulai: normalizedStartDate,
        tanggalSelesai: tanggalSelesai ?? null,
        reason,
        authorizedByUserId: authorizedSupervisor.id,
        candidateRole: assignee.roleId,
        ruleApplied: validation.eligibility.ruleApplied,
        eligibilityReasons: validation.eligibility.reasons,
        eligibilityWarnings: validation.eligibility.warnings,
      },
    });

    return {
      id: assignmentId,
      userIdPengganti,
      jabatanIdTarget,
      tipe,
      roleIdTarget,
      tanggalMulai: normalizedStartDate,
      tanggalSelesai: tanggalSelesai ?? null,
      actorName: actor.name,
      authorizedByName: authorizedSupervisor.name,
      assigneeName: assignee.name,
      ruleApplied: validation.eligibility.ruleApplied,
    };
  });
}

export async function deactivateActingAssignmentInDb(
  db: AletaDatabase,
  assignmentId: string,
  actorUserId: string
) {
  const actor = await requireActorUser(db, actorUserId);
  if (!canManageActingAssignments(actor)) {
    throw new ApiError(403, "Role aktif tidak memiliki hak untuk menghapus penugasan PLH/PLT.");
  }

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();
    const result = await tx.prepare(
      `UPDATE acting_assignments
       SET deleted_at = ?, updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`
    ).run(now, now, assignmentId);

    if (Number(result.changes ?? 0) === 0) {
      throw new ApiError(404, "Penugasan jabatan tidak ditemukan.");
    }

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "CLEAR_ACTING_ROLE",
      entityType: "acting_assignment",
      entityId: assignmentId,
    });

    return {
      id: assignmentId,
      deactivatedAt: now,
    };
  });
}

export async function listActingAssignmentsFromDb(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT aa.id, aa.user_id_pengganti, aa.jabatan_id_target, aa.tipe, aa.role_id_target,
      aa.assigned_by_user_id, aa.authorized_by_user_id, aa.tanggal_mulai, aa.tanggal_selesai, aa.assigned_at,
      u.name AS assignee_name, p.name AS target_position_name, actor.name AS assigned_by_name
     FROM acting_assignments aa
     INNER JOIN users u ON u.id = aa.user_id_pengganti
     INNER JOIN positions p ON p.id = aa.jabatan_id_target
     INNER JOIN users actor ON actor.id = aa.assigned_by_user_id
     WHERE aa.deleted_at IS NULL
     ORDER BY aa.assigned_at DESC`
  ).all<ActingAssignmentListRow>();

  return rows.map((row) => ({
    id: row.id,
    userIdPengganti: row.user_id_pengganti,
    jabatanIdTarget: row.jabatan_id_target,
    tipe: row.tipe,
    roleIdTarget: row.role_id_target,
    assignedByUserId: row.assigned_by_user_id,
    authorizedByUserId: row.authorized_by_user_id,
    tanggalMulai: row.tanggal_mulai,
    tanggalSelesai: row.tanggal_selesai,
    assignedAt: row.assigned_at,
    assigneeName: row.assignee_name,
    targetPositionName: row.target_position_name,
    assignedByName: row.assigned_by_name,
  }));
}

export async function mapDatabaseUserForApi(db: AletaDatabase, userId: string) {
  const user = await getUserByIdFromDb(db, userId);
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    nip: user.nip,
    email: user.email,
    whatsappNumber: user.whatsappNumber,
    roleId: user.roleId,
    positionId: user.positionId,
    actingAssignment: user.actingAssignment,
    isActive: user.isActive,
  };
}
