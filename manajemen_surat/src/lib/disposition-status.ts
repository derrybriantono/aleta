import { formatDate, formatDateTime } from "@/lib/format";
import { type DispositionNode } from "@/lib/types";

export type DispositionDeadlineState = "completed" | "overdue" | "due_today" | "upcoming" | "none";

export function getDispositionDeadlineState(disposition: Pick<DispositionNode, "deadlineAt" | "status">) {
  if (disposition.status === "Selesai") return "completed";
  if (!disposition.deadlineAt) return "none";

  const deadline = new Date(disposition.deadlineAt);
  if (Number.isNaN(deadline.getTime())) return "none";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  if (deadline.getTime() < startOfToday.getTime()) return "overdue";
  if (deadline.getTime() < startOfTomorrow.getTime()) return "due_today";
  return "upcoming";
}

export function getDispositionDeadlineLabel(disposition: Pick<DispositionNode, "deadlineAt" | "status">) {
  const state = getDispositionDeadlineState(disposition);

  if (state === "completed") return "Selesai";
  if (state === "overdue") return "Terlambat";
  if (state === "due_today") return "Jatuh Tempo Hari Ini";
  if (state === "upcoming" && disposition.deadlineAt) return `Deadline ${formatDate(disposition.deadlineAt)}`;
  return "Belum Ada Deadline";
}

export function getDispositionReadLabel(disposition: Pick<DispositionNode, "readAt">) {
  return disposition.readAt ? `Dibaca pada ${formatDateTime(disposition.readAt)}` : "Belum dibaca";
}
