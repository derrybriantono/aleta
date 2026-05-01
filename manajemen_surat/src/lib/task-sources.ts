import type { DispositionNode, LetterDetail, WhatsAppDelivery } from "@/lib/types";
import { getDispositionDeadlineState } from "@/lib/disposition-status";

export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type TaskItem = {
  id: string;
  entityType: "disposition" | "letter" | "wa_failed" | "feedback" | "approval" | "system_task";
  entityId: string;
  sourceApp: string;
  sourceLabel: string;
  title: string;
  description?: string;
  href: string;
  status?: string;
  priority: TaskPriority;
  sourceType: "disposition" | "letter" | "wa_failed" | "feedback" | "approval" | "system_task";
  createdAt: string;
  dueAt?: string;
  footer?: string;
  seen: boolean;
  metadata?: Record<string, unknown>;
};

export type TaskSource = {
  appId: "manajemen-surat" | "aleta-bot" | "feedback" | "admin";
  appName: string;
  appHref: string;
  count: number;
  unreadCount: number;
  urgentCount: number;
  tasks: TaskItem[];
};

export type TaskSummary = {
  total: number;
  unread: number;
  urgent: number;
};

export type TaskSourcesPayload = {
  summary: TaskSummary;
  sources: TaskSource[];
};

type BuildTaskSourcesInput = {
  accessibleLetters: LetterDetail[];
  dispositions: DispositionNode[];
  pendingInbox: DispositionNode[];
  currentUserId?: string | null;
  seenDispositionIds?: string[];
};

type FailedDeliveryTaskInput = {
  delivery: WhatsAppDelivery;
  parentId: string;
  label: string;
  type: "Surat" | "Disposisi";
  index: number;
};

const priorityRank: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

function createFailedDeliveryTask({ delivery, parentId, label, type, index }: FailedDeliveryTaskInput): TaskItem {
  return {
    id: `wa-${parentId}-${delivery.id}-${index}`,
    entityType: "wa_failed",
    entityId: `${parentId}:${delivery.id}`,
    sourceApp: "aleta_bot",
    sourceLabel: "ALETA Bot",
    title: `Gagal kirim ke ${delivery.recipientName}`,
    description: `Terkait ${type}: ${label}`,
    href: "/aleta-bot",
    status: "Gagal",
    priority: "high",
    sourceType: "wa_failed",
    createdAt: delivery.lastAttemptAt,
    footer: "ALETA Bot WhatsApp Gateway",
    seen: false,
  };
}

export function sortTaskItems(tasks: TaskItem[], mode: "priority" | "newest" | "oldest" | "unread" = "priority") {
  return [...tasks].sort((left, right) => {
    if (mode === "unread") {
      if (left.seen !== right.seen) return left.seen ? 1 : -1;
      const priorityDelta = priorityRank[right.priority] - priorityRank[left.priority];
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }

    if (mode === "newest") {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    }

    if (mode === "oldest") {
      return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    }

    const priorityDelta = priorityRank[right.priority] - priorityRank[left.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export function summarizeTaskSources(sources: TaskSource[]): TaskSummary {
  return sources.reduce<TaskSummary>(
    (summary, source) => ({
      total: summary.total + source.count,
      unread: summary.unread + source.unreadCount,
      urgent: summary.urgent + source.urgentCount,
    }),
    { total: 0, unread: 0, urgent: 0 }
  );
}

export function finalizeTaskSource(source: Omit<TaskSource, "count" | "unreadCount" | "urgentCount">): TaskSource {
  return {
    ...source,
    count: source.tasks.length,
    unreadCount: source.tasks.filter((task) => !task.seen).length,
    urgentCount: source.tasks.filter((task) => task.priority === "urgent").length,
  };
}

export function buildTaskSources({
  accessibleLetters,
  dispositions,
  pendingInbox,
  currentUserId,
  seenDispositionIds = [],
}: BuildTaskSourcesInput): TaskSource[] {
  const seenSet = new Set(seenDispositionIds);
  const pendingDispositionIds = new Set(pendingInbox.map((item) => item.id));
  const mailTasks: TaskItem[] = [
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
        id: item.id,
        entityType: "disposition" as const,
        entityId: item.id,
        sourceApp: "manajemen_surat",
        sourceLabel: "Manajemen Surat",
        title: letter?.perihal ?? "Disposisi Masuk",
        description: `Instruksi: ${item.instruksi}`,
        href: `/disposisi/${item.id}`,
        status: "Disposisi",
        priority: priority as TaskPriority,
        sourceType: "disposition" as const,
        createdAt: item.createdAt,
        dueAt: item.deadlineAt ?? undefined,
        footer: letter?.pengirim,
        seen: seenSet.has(item.id),
      };
    }),
    ...accessibleLetters
      .filter((letter) => letter.type === "masuk" && letter.status === "Baru")
      .map((letter) => ({
        id: letter.id,
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
        seen: false,
      })),
  ];

  const failedWhatsappTasks: TaskItem[] = [
    ...accessibleLetters.flatMap((letter) =>
      letter.whatsappDeliveries
        .filter((delivery) => delivery.status === "Gagal")
        .map((delivery, index) =>
          createFailedDeliveryTask({
            delivery,
            parentId: letter.id,
            label: letter.perihal,
            type: "Surat",
            index,
          })
        )
    ),
    ...dispositions.flatMap((disposition) => {
      const isRelevant = pendingDispositionIds.has(disposition.id) || disposition.pengirimId === currentUserId;
      if (!isRelevant) return [];

      return (disposition.whatsappDeliveries ?? [])
        .filter((delivery) => delivery.status === "Gagal")
        .map((delivery, index) =>
          createFailedDeliveryTask({
            delivery,
            parentId: disposition.id,
            label: disposition.instruksi,
            type: "Disposisi",
            index,
          })
        );
    }),
  ];

  return [
    finalizeTaskSource({
      appId: "manajemen-surat",
      appName: "Manajemen Surat",
      appHref: "/manajemen-surat",
      tasks: mailTasks,
    }),
    finalizeTaskSource({
      appId: "aleta-bot",
      appName: "ALETA Bot / Notifikasi Sistem",
      appHref: "/aleta-bot",
      tasks: failedWhatsappTasks,
    }),
  ];
}
