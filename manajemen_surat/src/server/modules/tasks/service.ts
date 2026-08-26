import {
  getAccessibleLetters,
  getEffectivePositionId,
  getEffectiveRoleId,
  getPendingInbox,
  isPrivilegedAdmin,
} from "@/lib/permissions";
import { getDispositionDeadlineState } from "@/lib/disposition-status";
import {
  E_STATUS_PERMISSION,
  hasEStatusPermission,
  resolveEStatusAccess,
} from "@/lib/e-status-types";
import { DEFAULT_PANEL_SETTINGS, normalizePanelSettings } from "@/lib/panel-settings";
import {
  finalizeTaskSource,
  sortTaskItems,
  summarizeTaskSources,
  type TaskItem,
  type TaskSource,
  type TaskSourcesPayload,
} from "@/lib/task-sources";
import { type AletaDatabase } from "@/server/db/client";
import { listDispositionsFromDb } from "@/server/modules/dispositions/service";
import { ensureEKepegawaianDefaults } from "@/server/modules/e-kepegawaian/service";
import { searchLettersInDb } from "@/server/modules/letters/service";
import { listNotificationReadsFromDb } from "@/server/modules/notifications/service";
import { getPositionsFromDb, requireActorUser } from "@/server/modules/organization/service";

export type TaskQuery = {
  source?: string | null;
  filter?: string | null;
  limit?: string | null;
};

type FeedbackTaskRow = {
  id: string;
  type: string;
  title: string;
  priority: string;
  status: string;
  reporter_name: string;
  created_at: string;
};

type ApprovalTaskRow = {
  id: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  requested_at: string;
  status: string;
};

type PanelSettingsTaskRow = {
  public_access_json: string;
  external_apps_json: string;
  updated_at: string;
};

type WhatsAppSettingsTaskRow = {
  phone_number: string;
  status: string;
  updated_at: string;
};

type HrEmployeeTaskRow = {
  id: string;
  full_name: string;
  unit_kerja: string | null;
};

type HrLeaveTaskRow = {
  id: string;
  request_number: string | null;
  status: string;
  start_date: string;
  end_date: string;
  total_days: string | number;
  reason: string;
  submitted_at: string | null;
  created_at: string;
  employee_name: string;
  unit_kerja: string | null;
  leave_type_name: string;
};

type HrSubmissionTaskRow = {
  id: string;
  submission_type: string;
  title: string;
  status: string;
  period_year: number;
  period_month: number | null;
  created_at: string;
  employee_name: string;
  unit_kerja: string | null;
};

type HrAttendanceTaskRow = {
  id: string;
  permission_type: string;
  request_date: string;
  requested_time: string;
  status: string;
  created_at: string;
  employee_name: string;
  unit_kerja: string | null;
};

type EStatusRecordTaskRow = {
  id: string;
  nomor_perkara: string;
  jenis_perkara: string;
  kategori_perubahan: string;
  validation_status: string;
  workflow_status: string;
  readiness_score: number;
  duplicate_status: string;
  duplicate_reason: string;
  created_at: string;
  updated_at: string;
};

type EStatusBatchTaskRow = {
  id: string;
  batch_number: string;
  batch_type: string;
  status: string;
  total_records: number;
  destination_agency_name: string | null;
  created_at: string;
  updated_at: string;
};

type EStatusTransmissionTaskRow = {
  id: string;
  batch_id: string;
  batch_number: string;
  agency_name: string | null;
  method: string;
  status: string;
  rejection_reason: string;
  error_message: string | null;
  sent_at: string | null;
  last_status_at: string | null;
  created_at: string;
};

type EStatusIncidentTaskRow = {
  id: string;
  incident_type: string;
  severity: string;
  status: string;
  title: string;
  batch_number: string | null;
  created_at: string;
  updated_at: string;
};

const HR_ADMIN_POSITION_IDS = new Set([
  "pos-kasubag-kepegawaian",
  "pos-staf-kepegawaian",
  "pos-analis-kepegawaian",
  "pos-penata-layanan-kepegawaian",
]);

const HR_APPROVER_ROLES = new Set([
  "super-admin",
  "admin",
  "ketua",
  "wakil-ketua",
  "sekretaris",
  "panitera",
  "kasubag",
  "pejabat-struktural",
]);

function buildReadSet(items: Awaited<ReturnType<typeof listNotificationReadsFromDb>>) {
  return new Set(items.map((item) => `${item.entityType}:${item.entityId}`));
}

function isSeen(readSet: Set<string>, entityType: TaskItem["entityType"], entityId: string) {
  return readSet.has(`${entityType}:${entityId}`);
}

function normalizeLimit(value: string | null | undefined) {
  const parsed = Number(value ?? 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(100, parsed));
}

function normalizeSource(value: string | null | undefined) {
  if (!value || value === "all") return "all";
  if (
    [
      "manajemen_surat",
      "manajemen-surat",
      "aleta_bot",
      "aleta-bot",
      "e_kepegawaian",
      "e-kepegawaian",
      "e_status",
      "e-status",
      "feedback",
      "admin",
    ].includes(value)
  ) {
    return value;
  }
  return "all";
}

function normalizeFilter(value: string | null | undefined) {
  if (!value || value === "all") return "all";
  if (["urgent", "unread"].includes(value)) return value;
  return "all";
}

function applyQueryFilters(sources: TaskSource[], query: TaskQuery): TaskSource[] {
  const source = normalizeSource(query.source);
  const filter = normalizeFilter(query.filter);
  const limit = normalizeLimit(query.limit);
  let remaining = limit;

  return sources
    .filter((item) => {
      if (source === "all") return true;
      if (source === "manajemen_surat" || source === "manajemen-surat") return item.appId === "manajemen-surat";
      if (source === "aleta_bot" || source === "aleta-bot") return item.appId === "aleta-bot";
      if (source === "e_kepegawaian" || source === "e-kepegawaian") return item.appId === "e-kepegawaian";
      if (source === "e_status" || source === "e-status") return item.appId === "e-status";
      return item.appId === source;
    })
    .map((item) => {
      const filteredTasks = item.tasks.filter((task) => {
        if (filter === "urgent") return task.priority === "urgent";
        if (filter === "unread") return !task.seen;
        return true;
      });
      const tasks = sortTaskItems(filteredTasks, "priority").slice(0, remaining);
      remaining = Math.max(0, remaining - tasks.length);
      return finalizeTaskSource({ ...item, tasks });
    })
    .filter((item) => item.tasks.length > 0);
}

function buildMailTaskSource(
  readSet: Set<string>,
  accessibleLetters: Awaited<ReturnType<typeof searchLettersInDb>>,
  pendingInbox: Awaited<ReturnType<typeof listDispositionsFromDb>>
) {
  const tasks: TaskItem[] = [
    ...pendingInbox.map((item) => {
      const letter = accessibleLetters.find((candidate) => candidate.id === item.suratId);
      const deadlineState = getDispositionDeadlineState(item);
      const priority =
        item.urgent || deadlineState === "overdue"
          ? "urgent"
          : deadlineState === "due_today"
            ? "high"
            : "normal";
      return {
        id: `disposition:${item.id}`,
        entityType: "disposition" as const,
        entityId: item.id,
        sourceApp: "manajemen_surat",
        sourceLabel: "Manajemen Surat",
        title: letter?.perihal ?? "Disposisi belum ditindaklanjuti",
        description: `Instruksi: ${item.instruksi}`,
        href: `/disposisi/${item.id}`,
        status: "Disposisi",
        priority: priority as TaskItem["priority"],
        sourceType: "disposition" as const,
        createdAt: item.createdAt,
        dueAt: item.deadlineAt ?? undefined,
        footer: letter?.pengirim,
        seen: isSeen(readSet, "disposition", item.id),
      };
    }),
    ...accessibleLetters
      .filter((letter) => letter.type === "masuk" && letter.status === "Baru")
      .map((letter) => ({
        id: `letter:${letter.id}`,
        entityType: "letter" as const,
        entityId: letter.id,
        sourceApp: "manajemen_surat",
        sourceLabel: "Manajemen Surat",
        title: letter.perihal,
        description: `No: ${letter.nomorSurat}`,
        href: `/surat/${letter.id}`,
        status: "Surat Baru",
        priority: "normal" as const,
        sourceType: "letter" as const,
        createdAt: letter.tanggal,
        footer: letter.pengirim,
        seen: isSeen(readSet, "letter", letter.id),
      })),
  ];

  return finalizeTaskSource({
    appId: "manajemen-surat",
    appName: "Manajemen Surat",
    appHref: "/manajemen-surat",
    tasks,
  });
}

function buildAletaBotTaskSource(
  readSet: Set<string>,
  accessibleLetters: Awaited<ReturnType<typeof searchLettersInDb>>,
  dispositions: Awaited<ReturnType<typeof listDispositionsFromDb>>,
  pendingInbox: Awaited<ReturnType<typeof listDispositionsFromDb>>,
  currentUserId: string
) {
  const pendingDispositionIds = new Set(pendingInbox.map((item) => item.id));
  const failedCount =
    accessibleLetters.reduce(
      (count, letter) => count + letter.whatsappDeliveries.filter((delivery) => delivery.status === "Gagal").length,
      0
    ) +
    dispositions.reduce((count, disposition) => {
      const relevant = pendingDispositionIds.has(disposition.id) || disposition.pengirimId === currentUserId;
      return relevant
        ? count + (disposition.whatsappDeliveries ?? []).filter((delivery) => delivery.status === "Gagal").length
        : count;
    }, 0);
  const tasks: TaskItem[] =
    failedCount > 0
      ? [
          {
            id: "wa_failed:summary",
            entityType: "wa_failed",
            entityId: "summary",
            sourceApp: "aleta_bot",
            sourceLabel: "ALETA Bot",
            title: `${failedCount} pengiriman WhatsApp gagal`,
            description: "Perlu ditinjau di ALETA Bot.",
            href: "/aleta-bot",
            status: "Gagal",
            priority: "high",
            sourceType: "wa_failed",
            createdAt: new Date().toISOString(),
            footer: "ALETA Bot WhatsApp Gateway",
            seen: isSeen(readSet, "wa_failed", "summary"),
            metadata: { failedCount },
          },
        ]
      : [];

  return finalizeTaskSource({
    appId: "aleta-bot",
    appName: "ALETA Bot / Notifikasi Sistem",
    appHref: "/aleta-bot",
    tasks,
  });
}

async function buildFeedbackTaskSource(db: AletaDatabase, readSet: Set<string>, actor: Awaited<ReturnType<typeof requireActorUser>>) {
  const admin = isPrivilegedAdmin(actor);
  let rows: FeedbackTaskRow[] = [];

  try {
    rows = admin
      ? await db.queryAll<FeedbackTaskRow>(
          `SELECT id, type, title, priority, status, reporter_name, created_at
           FROM feedback_requests
           WHERE status IN ('new', 'needs_info') OR priority IN ('high', 'urgent')
           ORDER BY created_at DESC
           LIMIT 30`
        )
      : await db.queryAll<FeedbackTaskRow>(
          `SELECT id, type, title, priority, status, reporter_name, created_at
           FROM feedback_requests
           WHERE reporter_user_id = ? AND status = 'needs_info'
           ORDER BY created_at DESC
           LIMIT 10`,
          [actor.id]
        );
  } catch {
    rows = [];
  }

  const tasks: TaskItem[] = rows.map((row) => ({
    id: `feedback:${row.id}`,
    entityType: "feedback",
    entityId: row.id,
    sourceApp: "feedback",
    sourceLabel: "Pusat Masukan",
    title: admin ? "Masukan pengguna perlu ditinjau" : "Masukan Anda membutuhkan informasi tambahan",
    description: row.title,
    href: admin ? "/admin/feedback" : "/masukan",
    status: row.status === "new" ? "Baru" : "Butuh Info",
    priority: row.priority === "urgent" ? "urgent" : row.priority === "high" ? "high" : "normal",
    sourceType: "feedback",
    createdAt: row.created_at,
    footer: admin ? row.reporter_name : "Pusat Masukan ALETA",
    seen: isSeen(readSet, "feedback", row.id),
  }));

  return finalizeTaskSource({
    appId: "feedback",
    appName: "Pusat Masukan",
    appHref: admin ? "/admin/feedback" : "/masukan",
    tasks,
  });
}

async function buildApprovalTaskSource(db: AletaDatabase, readSet: Set<string>, actor: Awaited<ReturnType<typeof requireActorUser>>) {
  if (!isPrivilegedAdmin(actor)) {
    return finalizeTaskSource({
      appId: "admin",
      appName: "Persetujuan",
      appHref: "/admin/aleta-bot",
      tasks: [],
    });
  }

  try {
    const rows = await db.queryAll<ApprovalTaskRow>(
      `SELECT id, entity_type, entity_id, entity_name, requested_at, status
       FROM aleta_bot_approval_requests
       WHERE status = 'pending'
       ORDER BY requested_at DESC
       LIMIT 20`
    );
    const tasks: TaskItem[] = rows.map((row) => ({
      id: `approval:${row.id}`,
      entityType: "approval",
      entityId: row.id,
      sourceApp: "admin",
      sourceLabel: "Persetujuan",
      title: "Persetujuan menunggu review",
      description: row.entity_name,
      href: "/admin/aleta-bot",
      status: "Pending",
      priority: "high",
      sourceType: "approval",
      createdAt: row.requested_at,
      footer: row.entity_type,
      seen: isSeen(readSet, "approval", row.id),
    }));

    return finalizeTaskSource({
      appId: "admin",
      appName: "Persetujuan",
      appHref: "/admin/aleta-bot",
      tasks,
    });
  } catch {
    return finalizeTaskSource({
      appId: "admin",
      appName: "Persetujuan",
      appHref: "/admin/aleta-bot",
      tasks: [],
    });
  }
}

function parseJsonObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function isPlaceholderExternalUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return true;
  }
}

async function buildAdminSettingsTasks(
  db: AletaDatabase,
  readSet: Set<string>,
  actor: Awaited<ReturnType<typeof requireActorUser>>
) {
  if (!isPrivilegedAdmin(actor)) return [];

  const tasks: TaskItem[] = [];
  const now = new Date().toISOString();

  try {
    const row = await db.queryOne<PanelSettingsTaskRow>(
      `SELECT public_access_json, external_apps_json, updated_at
       FROM panel_settings
       WHERE id = 1`
    );
    const settings = normalizePanelSettings({
      publicAccess: parseJsonObject(row?.public_access_json, DEFAULT_PANEL_SETTINGS.publicAccess),
      externalApps: parseJsonObject(row?.external_apps_json, DEFAULT_PANEL_SETTINGS.externalApps),
      updatedAt: row?.updated_at,
    });
    const createdAt = row?.updated_at ?? now;

    if (!settings.publicAccess.publicUrl) {
      tasks.push({
        id: "system_task:public_access",
        entityType: "system_task",
        entityId: "public_access",
        sourceApp: "admin",
        sourceLabel: "Pengaturan Admin",
        title: "Akses publik belum dikonfigurasi",
        description: "Lengkapi URL publik agar layanan tanpa login dan tautan WhatsApp memakai alamat resmi.",
        href: "/admin/akses-publik",
        status: "Belum diatur",
        priority: "high",
        sourceType: "system_task",
        createdAt,
        footer: "Akses Publik",
        seen: isSeen(readSet, "system_task", "public_access"),
      });
    }

    for (const [appId, config] of Object.entries(settings.externalApps)) {
      const label = appId === "sipp" ? "SIPP" : "APS Badilag";
      const entityId = `external_app_${appId}`;
      const needsVerification = !config.enabled || !config.baseUrl || !config.loginPath || isPlaceholderExternalUrl(config.baseUrl);

      if (!needsVerification) continue;

      tasks.push({
        id: `system_task:${entityId}`,
        entityType: "system_task",
        entityId,
        sourceApp: "admin",
        sourceLabel: "Pengaturan Admin",
        title: `Direct link ${label} perlu diverifikasi`,
        description: "Pastikan URL, path login, dan status aktif sudah sesuai server aplikasi di satker.",
        href: "/admin/pengaturan-panel",
        status: config.enabled ? "Perlu verifikasi" : "Nonaktif",
        priority: "normal",
        sourceType: "system_task",
        createdAt,
        footer: label,
        seen: isSeen(readSet, "system_task", entityId),
      });
    }
  } catch {
    tasks.push({
      id: "system_task:panel_settings_unavailable",
      entityType: "system_task",
      entityId: "panel_settings_unavailable",
      sourceApp: "admin",
      sourceLabel: "Pengaturan Admin",
      title: "Pengaturan panel belum dapat dibaca",
      description: "Cek tabel pengaturan panel dan migrasi database ALETA.",
      href: "/admin/pengaturan-panel",
      status: "Perlu cek",
      priority: "high",
      sourceType: "system_task",
      createdAt: now,
      footer: "Panel Settings",
      seen: isSeen(readSet, "system_task", "panel_settings_unavailable"),
    });
  }

  try {
    const row = await db.queryOne<WhatsAppSettingsTaskRow>(
      `SELECT phone_number, status, updated_at
       FROM whatsapp_web_settings
       WHERE id = 1`
    );

    if (!row || row.status !== "active") {
      tasks.push({
        id: "system_task:whatsapp_gateway",
        entityType: "system_task",
        entityId: "whatsapp_gateway",
        sourceApp: "admin",
        sourceLabel: "Pengaturan Admin",
        title: "WhatsApp Gateway belum aktif",
        description: "Aktifkan gateway agar notifikasi internal dan layanan via WhatsApp berjalan.",
        href: "/admin/status-whatsapp",
        status: row?.status === "failed" ? "Gagal" : "Nonaktif",
        priority: "high",
        sourceType: "system_task",
        createdAt: row?.updated_at ?? now,
        footer: row?.phone_number || "ALETA Bot",
        seen: isSeen(readSet, "system_task", "whatsapp_gateway"),
      });
    }
  } catch {
    tasks.push({
      id: "system_task:whatsapp_settings_unavailable",
      entityType: "system_task",
      entityId: "whatsapp_settings_unavailable",
      sourceApp: "admin",
      sourceLabel: "Pengaturan Admin",
      title: "Status WhatsApp belum dapat dibaca",
      description: "Cek konfigurasi WhatsApp Web ALETA dan migrasi database.",
      href: "/admin/status-whatsapp",
      status: "Perlu cek",
      priority: "high",
      sourceType: "system_task",
      createdAt: now,
      footer: "WhatsApp Gateway",
      seen: isSeen(readSet, "system_task", "whatsapp_settings_unavailable"),
    });
  }

  return tasks;
}

function isHrManager(actor: Awaited<ReturnType<typeof requireActorUser>>) {
  const positionId = getEffectivePositionId(actor);
  return isPrivilegedAdmin(actor) || Boolean(positionId && HR_ADMIN_POSITION_IDS.has(positionId));
}

function isHrApprover(actor: Awaited<ReturnType<typeof requireActorUser>>) {
  const roleId = getEffectiveRoleId(actor);
  const positionId = getEffectivePositionId(actor);
  return Boolean(roleId && HR_APPROVER_ROLES.has(roleId)) || Boolean(positionId && HR_ADMIN_POSITION_IDS.has(positionId));
}

function taskPriorityFromCreatedAt(createdAt: string, fallback: TaskItem["priority"] = "high"): TaskItem["priority"] {
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return fallback;
  const ageDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
  if (ageDays >= 2) return "urgent";
  return fallback;
}

function hrStatusLabel(status: string) {
  const labels: Record<string, string> = {
    submitted: "Diajukan",
    waiting_supervisor_approval: "Menunggu Atasan",
    waiting_authorized_officer_approval: "Menunggu Pejabat",
    revision_required: "Perlu Revisi",
    rejected: "Ditolak",
    verified: "Terverifikasi",
    approved: "Disetujui",
    cancelled: "Dibatalkan",
  };
  return labels[status] ?? status;
}

function hrSubmissionLabel(type: string) {
  const labels: Record<string, string> = {
    pck: "PCK",
    skp: "SKP",
    wfa: "WFA",
  };
  return labels[type] ?? type.toUpperCase();
}

function hrAttendanceLabel(type: string) {
  return type === "early_leave" ? "Cepat Pulang" : "Lambat Datang";
}

async function getCurrentHrEmployee(db: AletaDatabase, actorUserId: string) {
  return await db.queryOne<HrEmployeeTaskRow>(
    `SELECT id, full_name, unit_kerja
     FROM employee_profiles
     WHERE user_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [actorUserId]
  );
}

async function queryHrLeaveTasks(
  db: AletaDatabase,
  currentEmployee: HrEmployeeTaskRow | undefined,
  canManage: boolean,
  canApprove: boolean
) {
  const rows: HrLeaveTaskRow[] = [];

  if (canManage) {
    rows.push(
      ...(await db.queryAll<HrLeaveTaskRow>(
        `SELECT lr.id, lr.request_number, lr.status, lr.start_date, lr.end_date, lr.total_days, lr.reason,
          lr.submitted_at, lr.created_at, ep.full_name AS employee_name, ep.unit_kerja, lt.name AS leave_type_name
         FROM hr_leave_requests lr
         JOIN employee_profiles ep ON ep.id = lr.employee_id
         JOIN hr_leave_types lt ON lt.id = lr.leave_type_id
         WHERE lr.deleted_at IS NULL
           AND lr.status IN ('submitted', 'waiting_supervisor_approval', 'waiting_authorized_officer_approval')
         ORDER BY COALESCE(lr.submitted_at, lr.created_at) ASC
         LIMIT 25`
      ))
    );
  } else if (canApprove && currentEmployee) {
    rows.push(
      ...(await db.queryAll<HrLeaveTaskRow>(
        `SELECT lr.id, lr.request_number, lr.status, lr.start_date, lr.end_date, lr.total_days, lr.reason,
          lr.submitted_at, lr.created_at, ep.full_name AS employee_name, ep.unit_kerja, lt.name AS leave_type_name
         FROM hr_leave_requests lr
         JOIN employee_profiles ep ON ep.id = lr.employee_id
         JOIN hr_leave_types lt ON lt.id = lr.leave_type_id
         WHERE lr.deleted_at IS NULL
           AND lr.status IN ('submitted', 'waiting_supervisor_approval', 'waiting_authorized_officer_approval')
           AND (ep.supervisor_employee_id = ? OR ep.approval_officer_employee_id = ?)
         ORDER BY COALESCE(lr.submitted_at, lr.created_at) ASC
         LIMIT 25`,
        [currentEmployee.id, currentEmployee.id]
      ))
    );
  }

  if (currentEmployee) {
    rows.push(
      ...(await db.queryAll<HrLeaveTaskRow>(
        `SELECT lr.id, lr.request_number, lr.status, lr.start_date, lr.end_date, lr.total_days, lr.reason,
          lr.submitted_at, lr.created_at, ep.full_name AS employee_name, ep.unit_kerja, lt.name AS leave_type_name
         FROM hr_leave_requests lr
         JOIN employee_profiles ep ON ep.id = lr.employee_id
         JOIN hr_leave_types lt ON lt.id = lr.leave_type_id
         WHERE lr.deleted_at IS NULL
           AND lr.employee_id = ?
           AND lr.status IN ('revision_required', 'rejected')
         ORDER BY lr.updated_at DESC
         LIMIT 10`,
        [currentEmployee.id]
      ))
    );
  }

  return rows;
}

async function queryHrSubmissionTasks(db: AletaDatabase, currentEmployee: HrEmployeeTaskRow | undefined, canManage: boolean) {
  const rows: HrSubmissionTaskRow[] = [];

  if (canManage) {
    rows.push(
      ...(await db.queryAll<HrSubmissionTaskRow>(
        `SELECT hs.id, hs.submission_type, hs.title, hs.status, hs.period_year, hs.period_month,
          hs.created_at, ep.full_name AS employee_name, ep.unit_kerja
         FROM hr_submissions hs
         JOIN employee_profiles ep ON ep.id = hs.employee_id
         WHERE hs.status = 'submitted'
         ORDER BY hs.created_at ASC
         LIMIT 25`
      ))
    );
  }

  if (currentEmployee) {
    rows.push(
      ...(await db.queryAll<HrSubmissionTaskRow>(
        `SELECT hs.id, hs.submission_type, hs.title, hs.status, hs.period_year, hs.period_month,
          hs.created_at, ep.full_name AS employee_name, ep.unit_kerja
         FROM hr_submissions hs
         JOIN employee_profiles ep ON ep.id = hs.employee_id
         WHERE hs.employee_id = ?
           AND hs.status IN ('revision_required', 'rejected')
         ORDER BY hs.updated_at DESC
         LIMIT 10`,
        [currentEmployee.id]
      ))
    );
  }

  return rows;
}

async function queryHrAttendanceTasks(
  db: AletaDatabase,
  currentEmployee: HrEmployeeTaskRow | undefined,
  canManage: boolean,
  canApprove: boolean
) {
  const rows: HrAttendanceTaskRow[] = [];

  if (canManage || canApprove) {
    rows.push(
      ...(await db.queryAll<HrAttendanceTaskRow>(
        `SELECT hp.id, hp.permission_type, hp.request_date, hp.requested_time, hp.status,
          hp.created_at, ep.full_name AS employee_name, ep.unit_kerja
         FROM hr_attendance_permissions hp
         JOIN employee_profiles ep ON ep.id = hp.employee_id
         WHERE hp.status = 'submitted'
         ORDER BY hp.created_at ASC
         LIMIT 20`
      ))
    );
  }

  if (currentEmployee) {
    rows.push(
      ...(await db.queryAll<HrAttendanceTaskRow>(
        `SELECT hp.id, hp.permission_type, hp.request_date, hp.requested_time, hp.status,
          hp.created_at, ep.full_name AS employee_name, ep.unit_kerja
         FROM hr_attendance_permissions hp
         JOIN employee_profiles ep ON ep.id = hp.employee_id
         WHERE hp.employee_id = ?
           AND hp.status = 'rejected'
         ORDER BY hp.updated_at DESC
         LIMIT 10`,
        [currentEmployee.id]
      ))
    );
  }

  return rows;
}

async function buildEKepegawaianTaskSource(
  db: AletaDatabase,
  readSet: Set<string>,
  actor: Awaited<ReturnType<typeof requireActorUser>>
) {
  try {
    await ensureEKepegawaianDefaults(db, actor.id);

    const currentEmployee = await getCurrentHrEmployee(db, actor.id);
    const canManage = isHrManager(actor);
    const canApprove = isHrApprover(actor);
    const [leaveRows, submissionRows, attendanceRows] = await Promise.all([
      queryHrLeaveTasks(db, currentEmployee, canManage, canApprove),
      queryHrSubmissionTasks(db, currentEmployee, canManage),
      queryHrAttendanceTasks(db, currentEmployee, canManage, canApprove),
    ]);
    const seenTaskIds = new Set<string>();
    const tasks: TaskItem[] = [];

    for (const row of leaveRows) {
      const itemKey = `hr_leave:${row.id}`;
      if (seenTaskIds.has(itemKey)) continue;
      seenTaskIds.add(itemKey);

      const needsAction = ["submitted", "waiting_supervisor_approval", "waiting_authorized_officer_approval"].includes(row.status);
      tasks.push({
        id: itemKey,
        entityType: "hr_leave",
        entityId: row.id,
        sourceApp: "e_kepegawaian",
        sourceLabel: "E-Kepegawaian",
        title: needsAction ? `Approval cuti ${row.employee_name}` : `Cuti ${hrStatusLabel(row.status)}`,
        description: `${row.leave_type_name} ${row.start_date} s.d. ${row.end_date} (${row.total_days} hari). ${row.reason}`,
        href: needsAction ? "/e-kepegawaian?section=approval" : "/e-kepegawaian?section=cuti",
        status: hrStatusLabel(row.status),
        priority: needsAction ? taskPriorityFromCreatedAt(row.submitted_at ?? row.created_at, "high") : "normal",
        sourceType: "hr_leave",
        createdAt: row.submitted_at ?? row.created_at,
        footer: row.unit_kerja ?? row.request_number ?? "Cuti Pegawai",
        seen: isSeen(readSet, "hr_leave", row.id),
        metadata: { requestNumber: row.request_number, employeeName: row.employee_name },
      });
    }

    for (const row of submissionRows) {
      const itemKey = `hr_submission:${row.id}`;
      if (seenTaskIds.has(itemKey)) continue;
      seenTaskIds.add(itemKey);

      const needsAction = row.status === "submitted";
      tasks.push({
        id: itemKey,
        entityType: "hr_submission",
        entityId: row.id,
        sourceApp: "e_kepegawaian",
        sourceLabel: "E-Kepegawaian",
        title: needsAction
          ? `Verifikasi ${hrSubmissionLabel(row.submission_type)} ${row.employee_name}`
          : `${hrSubmissionLabel(row.submission_type)} ${hrStatusLabel(row.status)}`,
        description: row.title,
        href: `/e-kepegawaian?section=${row.submission_type}`,
        status: hrStatusLabel(row.status),
        priority: needsAction ? taskPriorityFromCreatedAt(row.created_at, "high") : "normal",
        sourceType: "hr_submission",
        createdAt: row.created_at,
        footer: `${row.unit_kerja ?? "Pegawai"} - ${row.period_month ? `${row.period_month}/` : ""}${row.period_year}`,
        seen: isSeen(readSet, "hr_submission", row.id),
        metadata: { submissionType: row.submission_type, employeeName: row.employee_name },
      });
    }

    for (const row of attendanceRows) {
      const itemKey = `hr_attendance:${row.id}`;
      if (seenTaskIds.has(itemKey)) continue;
      seenTaskIds.add(itemKey);

      const needsAction = row.status === "submitted";
      tasks.push({
        id: itemKey,
        entityType: "hr_attendance",
        entityId: row.id,
        sourceApp: "e_kepegawaian",
        sourceLabel: "E-Kepegawaian",
        title: needsAction
          ? `Approval izin ${hrAttendanceLabel(row.permission_type)}`
          : `Izin ${hrAttendanceLabel(row.permission_type)} ${hrStatusLabel(row.status)}`,
        description: `${row.employee_name} - ${row.request_date} pukul ${row.requested_time}`,
        href: "/e-kepegawaian?section=izin",
        status: hrStatusLabel(row.status),
        priority: needsAction ? taskPriorityFromCreatedAt(row.created_at, "high") : "normal",
        sourceType: "hr_attendance",
        createdAt: row.created_at,
        footer: row.unit_kerja ?? "Izin Kehadiran",
        seen: isSeen(readSet, "hr_attendance", row.id),
        metadata: { permissionType: row.permission_type, employeeName: row.employee_name },
      });
    }

    return finalizeTaskSource({
      appId: "e-kepegawaian",
      appName: "E-Kepegawaian",
      appHref: "/e-kepegawaian",
      tasks: sortTaskItems(tasks, "priority").slice(0, 50),
    });
  } catch {
    return finalizeTaskSource({
      appId: "e-kepegawaian",
      appName: "E-Kepegawaian",
      appHref: "/e-kepegawaian",
      tasks: [],
    });
  }
}

function estatusValidationLabel(status: string) {
  const labels: Record<string, string> = {
    VALID: "Valid",
    NEEDS_REVIEW: "Perlu Review",
    NEEDS_MANUAL_COMPLETION: "Perlu Pelengkapan",
    DATA_ISSUE: "Data Bermasalah",
    DUPLICATE: "Duplikat",
    INVALID: "Tidak Valid",
  };
  return labels[status] ?? status;
}

function estatusBatchStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Draft",
    WAITING_APPROVAL: "Menunggu Approval",
    APPROVED: "Disetujui",
    LOCKED: "Terkunci",
    SENT: "Dikirim",
    RECEIVED: "Diterima",
    IN_PROCESS: "Diproses",
    COMPLETED: "Selesai",
    REJECTED: "Ditolak",
    REVISION_REQUIRED: "Perlu Revisi",
    CANCELLED: "Dibatalkan",
    FAILED: "Gagal",
  };
  return labels[status] ?? status;
}

function estatusIncidentPriority(severity: string): TaskItem["priority"] {
  if (severity === "critical" || severity === "high") return "urgent";
  if (severity === "medium") return "high";
  return "normal";
}

async function buildEStatusTaskSource(
  db: AletaDatabase,
  readSet: Set<string>,
  actor: Awaited<ReturnType<typeof requireActorUser>>
) {
  const access = resolveEStatusAccess(actor, { effectiveRoleId: getEffectiveRoleId(actor) });

  if (!access.canView) {
    return finalizeTaskSource({
      appId: "e-status",
      appName: "E-Status",
      appHref: "/e-status",
      tasks: [],
    });
  }

  try {
    const tasks: TaskItem[] = [];
    const canValidate =
      hasEStatusPermission(access, E_STATUS_PERMISSION.RECORDS_VALIDATE) ||
      hasEStatusPermission(access, E_STATUS_PERMISSION.RECORDS_MANUAL_OVERRIDE);
    const canApprove = hasEStatusPermission(access, E_STATUS_PERMISSION.BATCH_APPROVE);
    const canLock = hasEStatusPermission(access, E_STATUS_PERMISSION.BATCH_LOCK);
    const canRevise = hasEStatusPermission(access, E_STATUS_PERMISSION.BATCH_REVISION);
    const canFollowup = hasEStatusPermission(access, E_STATUS_PERMISSION.TRANSMISSION_FOLLOWUP);
    const canManageIncident = hasEStatusPermission(access, E_STATUS_PERMISSION.INCIDENT_MANAGE);

    if (canValidate) {
      const recordRows = await db.queryAll<EStatusRecordTaskRow>(
        `SELECT id, nomor_perkara, jenis_perkara, kategori_perubahan, validation_status,
          workflow_status, readiness_score, duplicate_status, duplicate_reason, created_at, updated_at
         FROM estatus_records
         WHERE deleted_at IS NULL
           AND (
            validation_status IN ('NEEDS_REVIEW', 'NEEDS_MANUAL_COMPLETION', 'DATA_ISSUE', 'DUPLICATE')
            OR workflow_status IN ('READY_REVIEW', 'DATA_ISSUE', 'REVISION_DRAFT')
           )
         ORDER BY updated_at DESC
         LIMIT 20`
      );

      for (const row of recordRows) {
        const isDuplicate = row.validation_status === "DUPLICATE" || row.duplicate_status !== "none";
        tasks.push({
          id: `estatus_record:${row.id}`,
          entityType: "estatus_record",
          entityId: row.id,
          sourceApp: "e_status",
          sourceLabel: "E-Status",
          title: isDuplicate ? `Duplikasi kandidat ${row.nomor_perkara}` : `Review kandidat ${row.nomor_perkara}`,
          description: `${row.jenis_perkara} - readiness ${row.readiness_score}%. ${row.duplicate_reason || row.kategori_perubahan}`,
          href: "/e-status?section=kandidat",
          status: estatusValidationLabel(row.validation_status),
          priority: isDuplicate || row.validation_status === "DATA_ISSUE" ? "high" : "normal",
          sourceType: "estatus_record",
          createdAt: row.updated_at || row.created_at,
          footer: row.workflow_status,
          seen: isSeen(readSet, "estatus_record", row.id),
          metadata: { caseNumber: row.nomor_perkara, changeType: row.kategori_perubahan },
        });
      }
    }

    if (canApprove || canLock || canRevise) {
      const batchRows = await db.queryAll<EStatusBatchTaskRow>(
        `SELECT b.id, b.batch_number, b.batch_type, b.status, b.total_records,
          a.agency_name AS destination_agency_name, b.created_at, b.updated_at
         FROM estatus_batches b
         LEFT JOIN estatus_agencies a ON a.id = b.destination_agency_id
         WHERE b.status IN ('WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED')
         ORDER BY b.updated_at DESC
         LIMIT 20`
      );

      for (const row of batchRows) {
        if (row.status === "WAITING_APPROVAL" && !canApprove) continue;
        if (row.status === "APPROVED" && !canLock) continue;
        if (["REJECTED", "REVISION_REQUIRED"].includes(row.status) && !canRevise) continue;

        const needsAction = row.status === "WAITING_APPROVAL"
          ? "Approval batch"
          : row.status === "APPROVED"
            ? "Kunci batch"
            : "Revisi batch";

        tasks.push({
          id: `estatus_batch:${row.id}`,
          entityType: "estatus_batch",
          entityId: row.id,
          sourceApp: "e_status",
          sourceLabel: "E-Status",
          title: `${needsAction} ${row.batch_number}`,
          description: `${row.batch_type} - ${row.total_records} data perubahan status perkawinan.`,
          href: "/e-status?section=batch",
          status: estatusBatchStatusLabel(row.status),
          priority: taskPriorityFromCreatedAt(row.updated_at, "high"),
          sourceType: "estatus_batch",
          createdAt: row.updated_at || row.created_at,
          footer: row.destination_agency_name ?? "Instansi belum dipilih",
          seen: isSeen(readSet, "estatus_batch", row.id),
          metadata: { batchNumber: row.batch_number, totalRecords: row.total_records },
        });
      }
    }

    if (canFollowup) {
      const transmissionRows = await db.queryAll<EStatusTransmissionTaskRow>(
        `SELECT t.id, t.batch_id, b.batch_number, a.agency_name, t.method, t.status,
          t.rejection_reason, t.error_message, t.sent_at, t.last_status_at, t.created_at
         FROM estatus_transmission_logs t
         JOIN estatus_batches b ON b.id = t.batch_id
         LEFT JOIN estatus_agencies a ON a.id = t.agency_id
         WHERE t.status IN ('SENT', 'RECEIVED', 'IN_PROCESS', 'REJECTED', 'FAILED')
         ORDER BY COALESCE(t.last_status_at, t.sent_at, t.created_at) DESC
         LIMIT 20`
      );

      for (const row of transmissionRows) {
        const createdAt = row.last_status_at ?? row.sent_at ?? row.created_at;
        const priority = ["REJECTED", "FAILED"].includes(row.status)
          ? "urgent"
          : taskPriorityFromCreatedAt(createdAt, "normal");

        tasks.push({
          id: `estatus_transmission:${row.id}`,
          entityType: "estatus_transmission",
          entityId: row.id,
          sourceApp: "e_status",
          sourceLabel: "E-Status",
          title: ["REJECTED", "FAILED"].includes(row.status)
            ? `Tindak lanjut pengiriman ${row.batch_number}`
            : `Pantau tracking ${row.batch_number}`,
          description: row.rejection_reason || row.error_message || `${row.method} - ${estatusBatchStatusLabel(row.status)}`,
          href: "/e-status?section=tracking",
          status: estatusBatchStatusLabel(row.status),
          priority,
          sourceType: "estatus_transmission",
          createdAt,
          footer: row.agency_name ?? "Instansi mitra",
          seen: isSeen(readSet, "estatus_transmission", row.id),
          metadata: { batchId: row.batch_id, batchNumber: row.batch_number },
        });
      }
    }

    if (canManageIncident) {
      const incidentRows = await db.queryAll<EStatusIncidentTaskRow>(
        `SELECT i.id, i.incident_type, i.severity, i.status, i.title,
          b.batch_number, i.created_at, i.updated_at
         FROM estatus_incident_logs i
         LEFT JOIN estatus_batches b ON b.id = i.batch_id
         WHERE i.status IN ('open', 'investigating', 'contained')
         ORDER BY i.updated_at DESC
         LIMIT 15`
      );

      for (const row of incidentRows) {
        tasks.push({
          id: `estatus_incident:${row.id}`,
          entityType: "estatus_incident",
          entityId: row.id,
          sourceApp: "e_status",
          sourceLabel: "E-Status",
          title: row.title,
          description: `${row.incident_type} - ${row.status}`,
          href: "/e-status?section=advanced",
          status: row.severity,
          priority: estatusIncidentPriority(row.severity),
          sourceType: "estatus_incident",
          createdAt: row.updated_at || row.created_at,
          footer: row.batch_number ?? "Incident Log",
          seen: isSeen(readSet, "estatus_incident", row.id),
        });
      }
    }

    return finalizeTaskSource({
      appId: "e-status",
      appName: "E-Status",
      appHref: "/e-status",
      tasks: sortTaskItems(tasks, "priority").slice(0, 50),
    });
  } catch {
    return finalizeTaskSource({
      appId: "e-status",
      appName: "E-Status",
      appHref: "/e-status",
      tasks: [],
    });
  }
}

export async function getTaskSourcesForUser(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  query: TaskQuery = {}
): Promise<TaskSourcesPayload> {
  const actor = await requireActorUser(db, actorUserId);
  const [letters, dispositions, reads, positions] = await Promise.all([
    searchLettersInDb(db, { limit: 1000 }),
    listDispositionsFromDb(db),
    listNotificationReadsFromDb(db, actor.id, undefined),
    getPositionsFromDb(db),
  ]);
  const accessibleLetters = getAccessibleLetters(actor, letters, dispositions, positions);
  const pendingInbox = getPendingInbox(actor, dispositions, letters);
  const readSet = buildReadSet(reads);
  const approvalSource = await buildApprovalTaskSource(db, readSet, actor);
  const adminSettingsTasks = await buildAdminSettingsTasks(db, readSet, actor);
  const adminSource = finalizeTaskSource({
    appId: "admin",
    appName: "Admin Panel",
    appHref: "/admin",
    tasks: sortTaskItems([...approvalSource.tasks, ...adminSettingsTasks], "priority").slice(0, 50),
  });
  const sources = [
    buildMailTaskSource(readSet, accessibleLetters, pendingInbox),
    buildAletaBotTaskSource(readSet, accessibleLetters, dispositions, pendingInbox, actor.id),
    await buildFeedbackTaskSource(db, readSet, actor),
    adminSource,
    await buildEKepegawaianTaskSource(db, readSet, actor),
    await buildEStatusTaskSource(db, readSet, actor),
  ].filter((source) => source.tasks.length > 0);
  const filteredSources = applyQueryFilters(sources, query);

  return {
    summary: summarizeTaskSources(filteredSources),
    sources: filteredSources,
  };
}
