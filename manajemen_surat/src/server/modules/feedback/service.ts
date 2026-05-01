import {
  FEEDBACK_APP_AREA_LABELS,
  FEEDBACK_APP_AREAS,
  FEEDBACK_CATEGORIES,
  FEEDBACK_PRIORITIES,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  type FeedbackAppArea,
  type FeedbackPriority,
  type FeedbackRequest,
  type FeedbackStatus,
  type FeedbackType,
} from "@/lib/feedback";
import { isPrivilegedAdmin } from "@/lib/permissions";
import type { UserPersona } from "@/lib/types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { getPositionByIdFromDb, getUserByIdFromDb, requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

type FeedbackRow = {
  id: string;
  type: string;
  title: string;
  app_area: string;
  category: string;
  priority: string;
  description: string;
  reproduction_steps: string;
  expected_result: string;
  attachment_url: string;
  status: string;
  reporter_user_id: string;
  reporter_name: string;
  reporter_role: string;
  reporter_unit: string;
  assigned_to_user_id: string | null;
  assigned_to_name?: string | null;
  admin_note: string;
  resolution_note: string;
  duplicate_of_id: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  completed_at: string | null;
};

export type CreateFeedbackPayload = {
  type?: string;
  title?: string;
  appArea?: string;
  category?: string;
  priority?: string;
  description?: string;
  reproductionSteps?: string;
  expectedResult?: string;
  attachmentUrl?: string;
};

export type FeedbackAdminFilters = {
  type?: string;
  appArea?: string;
  status?: string;
  priority?: string;
  reporter?: string;
  search?: string;
};

export type UpdateFeedbackPayload = {
  status?: string;
  adminNote?: string;
  resolutionNote?: string;
  assignedToUserId?: string | null;
  duplicateOfId?: string | null;
};

const feedbackTypeIds = new Set(FEEDBACK_TYPES.map((item) => item.id));
const feedbackAppAreaIds = new Set(FEEDBACK_APP_AREAS.map((item) => item.id));
const feedbackPriorityIds = new Set(FEEDBACK_PRIORITIES.map((item) => item.id));
const feedbackStatusIds = new Set(FEEDBACK_STATUSES.map((item) => item.id));

function sanitizePlainText(value: string | undefined, maxLength: number) {
  const normalized = (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.slice(0, maxLength);
}

function sanitizeLongText(value: string | undefined, maxLength: number) {
  const normalized = (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .trim();

  return normalized.slice(0, maxLength);
}

function normalizeEnum<T extends string>(value: string | undefined, allowed: Set<string>, fallback: T): T {
  const normalized = value?.trim() as T | undefined;
  return normalized && allowed.has(normalized) ? normalized : fallback;
}

function normalizeRequiredText(value: string | undefined, label: string, maxLength: number) {
  const normalized = sanitizeLongText(value, maxLength);
  if (!normalized) {
    throw new ApiError(400, `${label} wajib diisi.`);
  }
  return normalized;
}

function normalizeAttachmentUrl(value: string | undefined) {
  const normalized = sanitizePlainText(value, 500);
  if (!normalized) return "";

  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("invalid protocol");
    }
    return url.toString();
  } catch {
    throw new ApiError(400, "Link lampiran harus berupa URL http/https yang valid.");
  }
}

function assertValidCategory(type: FeedbackType, category: string) {
  if (!FEEDBACK_CATEGORIES[type].includes(category)) {
    throw new ApiError(400, "Kategori tidak sesuai dengan jenis masukan.");
  }
}

function mapFeedbackRow(row: FeedbackRow): FeedbackRequest {
  return {
    id: row.id,
    type: row.type as FeedbackType,
    title: row.title,
    appArea: row.app_area as FeedbackAppArea,
    category: row.category,
    priority: row.priority as FeedbackPriority,
    description: row.description,
    reproductionSteps: row.reproduction_steps,
    expectedResult: row.expected_result,
    attachmentUrl: row.attachment_url,
    status: row.status as FeedbackStatus,
    reporterUserId: row.reporter_user_id,
    reporterName: row.reporter_name,
    reporterRole: row.reporter_role,
    reporterUnit: row.reporter_unit,
    assignedToUserId: row.assigned_to_user_id,
    assignedToName: row.assigned_to_name ?? null,
    adminNote: row.admin_note,
    resolutionNote: row.resolution_note,
    duplicateOfId: row.duplicate_of_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
    completedAt: row.completed_at,
  };
}

async function resolveReporterUnit(db: AletaDatabase, actor: UserPersona) {
  const position = await getPositionByIdFromDb(db, actor.actingAssignment?.positionId ?? actor.positionId);
  return position?.unitKerja || position?.name || "";
}

async function ensureFeedbackAdmin(db: AletaDatabase, actorUserId: string | null | undefined) {
  const actor = await requireActorUser(db, actorUserId);
  if (!isPrivilegedAdmin(actor)) {
    throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat meninjau masukan pengguna.");
  }
  return actor;
}

export async function createFeedbackRequestInDb(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  payload: CreateFeedbackPayload
) {
  const actor = await requireActorUser(db, actorUserId);
  const type = normalizeEnum<FeedbackType>(payload.type, feedbackTypeIds, "bug");
  const title = normalizeRequiredText(payload.title, "Judul singkat", 150);
  const appArea = normalizeEnum<FeedbackAppArea>(payload.appArea, feedbackAppAreaIds, "portal");
  const category = sanitizePlainText(payload.category, 120) || FEEDBACK_CATEGORIES[type][0]!;
  const priority = normalizeEnum<FeedbackPriority>(payload.priority, feedbackPriorityIds, "medium");
  const description = normalizeRequiredText(payload.description, "Deskripsi", 5000);
  const reproductionSteps = sanitizeLongText(payload.reproductionSteps, 3000);
  const expectedResult = sanitizeLongText(payload.expectedResult, 3000);
  const attachmentUrl = normalizeAttachmentUrl(payload.attachmentUrl);

  assertValidCategory(type, category);

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();
    const id = await nextPrefixedId(tx, "feedback_requests", "fbk");
    const reporterUnit = await resolveReporterUnit(tx, actor);

    await tx.prepare(
      `INSERT INTO feedback_requests (
        id, type, title, app_area, category, priority, description, reproduction_steps,
        expected_result, attachment_url, status, reporter_user_id, reporter_name,
        reporter_role, reporter_unit, assigned_to_user_id, admin_note, resolution_note,
        duplicate_of_id, created_at, updated_at, reviewed_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, NULL, '', '', NULL, ?, ?, NULL, NULL)`
    ).run(
      id,
      type,
      title,
      appArea,
      category,
      priority,
      description,
      reproductionSteps,
      expectedResult,
      attachmentUrl,
      actor.id,
      actor.name,
      actor.roleId,
      reporterUnit,
      now,
      now
    );

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "CREATE_FEEDBACK",
      entityType: "feedback_request",
      entityId: id,
      payload: {
        type,
        appArea: FEEDBACK_APP_AREA_LABELS[appArea],
        category,
        priority,
      },
    });

    const created = await tx.prepare(
      `SELECT feedback_requests.*, assigned.name AS assigned_to_name
       FROM feedback_requests
       LEFT JOIN users assigned ON assigned.id = feedback_requests.assigned_to_user_id
       WHERE feedback_requests.id = ?`
    ).get<FeedbackRow>(id);

    return mapFeedbackRow(created!);
  });
}

export async function listOwnFeedbackRequestsFromDb(
  db: AletaDatabase,
  actorUserId: string | null | undefined
) {
  const actor = await requireActorUser(db, actorUserId);
  const rows = await db.prepare(
    `SELECT feedback_requests.*, assigned.name AS assigned_to_name
     FROM feedback_requests
     LEFT JOIN users assigned ON assigned.id = feedback_requests.assigned_to_user_id
     WHERE feedback_requests.reporter_user_id = ?
     ORDER BY feedback_requests.created_at DESC`
  ).all<FeedbackRow>(actor.id);

  return rows.map(mapFeedbackRow);
}

export async function listAdminFeedbackRequestsFromDb(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  filters: FeedbackAdminFilters = {}
) {
  await ensureFeedbackAdmin(db, actorUserId);

  const clauses: string[] = ["1 = 1"];
  const params: Array<string> = [];

  if (filters.type && feedbackTypeIds.has(filters.type as FeedbackType)) {
    clauses.push("feedback_requests.type = ?");
    params.push(filters.type);
  }
  if (filters.appArea && feedbackAppAreaIds.has(filters.appArea as FeedbackAppArea)) {
    clauses.push("feedback_requests.app_area = ?");
    params.push(filters.appArea);
  }
  if (filters.status && feedbackStatusIds.has(filters.status as FeedbackStatus)) {
    clauses.push("feedback_requests.status = ?");
    params.push(filters.status);
  }
  if (filters.priority && feedbackPriorityIds.has(filters.priority as FeedbackPriority)) {
    clauses.push("feedback_requests.priority = ?");
    params.push(filters.priority);
  }
  if (filters.reporter?.trim()) {
    clauses.push("LOWER(feedback_requests.reporter_name) LIKE LOWER(?)");
    params.push(`%${sanitizePlainText(filters.reporter, 120)}%`);
  }
  if (filters.search?.trim()) {
    clauses.push(
      "(LOWER(feedback_requests.title) LIKE LOWER(?) OR LOWER(feedback_requests.description) LIKE LOWER(?))"
    );
    const query = `%${sanitizePlainText(filters.search, 120)}%`;
    params.push(query, query);
  }

  const where = clauses.join(" AND ");
  const rows = await db.queryAll<FeedbackRow>(
    `SELECT feedback_requests.*, assigned.name AS assigned_to_name
     FROM feedback_requests
     LEFT JOIN users assigned ON assigned.id = feedback_requests.assigned_to_user_id
     WHERE ${where}
     ORDER BY feedback_requests.created_at DESC
     LIMIT 300`,
    params
  );

  const summaryRows = await db.prepare(
    `SELECT status, type, COUNT(*) AS total
     FROM feedback_requests
     GROUP BY status, type`
  ).all<{ status: string; type: string; total: string | number }>();

  const summary = {
    total: summaryRows.reduce((count, row) => count + Number(row.total), 0),
    new: summaryRows.filter((row) => row.status === "new").reduce((count, row) => count + Number(row.total), 0),
    openBugs: summaryRows
      .filter((row) => row.type === "bug" && !["done", "rejected", "duplicate"].includes(row.status))
      .reduce((count, row) => count + Number(row.total), 0),
    plannedFeatures: summaryRows
      .filter((row) => row.type === "feature" && row.status === "planned")
      .reduce((count, row) => count + Number(row.total), 0),
    appIdeas: summaryRows
      .filter((row) => row.type === "app_idea")
      .reduce((count, row) => count + Number(row.total), 0),
  };

  return {
    items: rows.map(mapFeedbackRow),
    summary,
  };
}

export async function updateFeedbackRequestInDb(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  feedbackId: string,
  payload: UpdateFeedbackPayload
) {
  const actor = await ensureFeedbackAdmin(db, actorUserId);
  const existing = await db.prepare(
    `SELECT id, status
     FROM feedback_requests
     WHERE id = ?
     LIMIT 1`
  ).get<{ id: string; status: string }>(feedbackId);

  if (!existing) {
    throw new ApiError(404, "Masukan tidak ditemukan.");
  }

  const nextStatus = payload.status
    ? normalizeEnum<FeedbackStatus>(payload.status, feedbackStatusIds, existing.status as FeedbackStatus)
    : (existing.status as FeedbackStatus);
  const adminNote = payload.adminNote === undefined ? undefined : sanitizeLongText(payload.adminNote, 3000);
  const resolutionNote =
    payload.resolutionNote === undefined ? undefined : sanitizeLongText(payload.resolutionNote, 3000);
  const assignedToUserId =
    payload.assignedToUserId === undefined ? undefined : payload.assignedToUserId?.trim() || null;
  const duplicateOfId =
    payload.duplicateOfId === undefined ? undefined : payload.duplicateOfId?.trim() || null;

  if (assignedToUserId) {
    const assignee = await getUserByIdFromDb(db, assignedToUserId);
    if (!assignee?.isActive) {
      throw new ApiError(400, "Petugas yang dipilih tidak ditemukan atau tidak aktif.");
    }
  }

  return withTransaction(db, async (tx) => {
    const now = new Date().toISOString();
    const reviewedAt = existing.status === "new" && nextStatus !== "new" ? now : null;
    const completedAt = ["done", "rejected", "duplicate"].includes(nextStatus) ? now : null;

    await tx.prepare(
      `UPDATE feedback_requests
       SET status = ?,
           admin_note = COALESCE(?, admin_note),
           resolution_note = COALESCE(?, resolution_note),
           assigned_to_user_id = COALESCE(?, assigned_to_user_id),
           duplicate_of_id = COALESCE(?, duplicate_of_id),
           reviewed_at = COALESCE(?, reviewed_at),
           completed_at = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(
      nextStatus,
      adminNote ?? null,
      resolutionNote ?? null,
      assignedToUserId ?? null,
      duplicateOfId ?? null,
      reviewedAt,
      completedAt,
      now,
      feedbackId
    );

    await appendAuditLog(tx, {
      id: await nextPrefixedId(tx, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "UPDATE_FEEDBACK",
      entityType: "feedback_request",
      entityId: feedbackId,
      payload: {
        previousStatus: existing.status,
        nextStatus,
        assignedToUserId,
        duplicateOfId,
      },
    });

    const updated = await tx.prepare(
      `SELECT feedback_requests.*, assigned.name AS assigned_to_name
       FROM feedback_requests
       LEFT JOIN users assigned ON assigned.id = feedback_requests.assigned_to_user_id
       WHERE feedback_requests.id = ?`
    ).get<FeedbackRow>(feedbackId);

    return mapFeedbackRow(updated!);
  });
}
