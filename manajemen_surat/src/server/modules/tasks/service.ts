import { getAccessibleLetters, getPendingInbox, isPrivilegedAdmin } from "@/lib/permissions";
import { getDispositionDeadlineState } from "@/lib/disposition-status";
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
import { searchLettersInDb } from "@/server/modules/letters/service";
import { listNotificationReadsFromDb } from "@/server/modules/notifications/service";
import { requireActorUser } from "@/server/modules/organization/service";

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
  if (["manajemen_surat", "manajemen-surat", "aleta_bot", "aleta-bot", "feedback", "admin"].includes(value)) {
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

export async function getTaskSourcesForUser(
  db: AletaDatabase,
  actorUserId: string | null | undefined,
  query: TaskQuery = {}
): Promise<TaskSourcesPayload> {
  const actor = await requireActorUser(db, actorUserId);
  const [letters, dispositions, reads] = await Promise.all([
    searchLettersInDb(db, { limit: 1000 }),
    listDispositionsFromDb(db),
    listNotificationReadsFromDb(db, actor.id, undefined),
  ]);
  const accessibleLetters = getAccessibleLetters(actor, letters, dispositions);
  const pendingInbox = getPendingInbox(actor, dispositions, letters);
  const readSet = buildReadSet(reads);
  const sources = [
    buildMailTaskSource(readSet, accessibleLetters, pendingInbox),
    buildAletaBotTaskSource(readSet, accessibleLetters, dispositions, pendingInbox, actor.id),
    await buildFeedbackTaskSource(db, readSet, actor),
    await buildApprovalTaskSource(db, readSet, actor),
  ].filter((source) => source.tasks.length > 0);
  const filteredSources = applyQueryFilters(sources, query);

  return {
    summary: summarizeTaskSources(filteredSources),
    sources: filteredSources,
  };
}
