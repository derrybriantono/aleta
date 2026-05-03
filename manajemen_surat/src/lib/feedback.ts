import type { BadgeProps } from "@/components/ui/badge";

export type FeedbackType = "bug" | "feature" | "app_idea";
export type FeedbackPriority = "low" | "medium" | "high" | "urgent";
export type FeedbackStatus =
  | "new"
  | "reviewed"
  | "in_progress"
  | "needs_info"
  | "planned"
  | "done"
  | "rejected"
  | "postponed"
  | "duplicate";

export type FeedbackAppArea =
  | "portal"
  | "mail"
  | "aleta_bot"
  | "assistant_judge"
  | "patch_notes"
  | "guide"
  | "admin"
  | "other";

export type FeedbackRequest = {
  id: string;
  type: FeedbackType;
  title: string;
  appArea: FeedbackAppArea;
  category: string;
  priority: FeedbackPriority;
  description: string;
  reproductionSteps: string;
  expectedResult: string;
  attachmentUrl: string;
  status: FeedbackStatus;
  reporterUserId: string;
  reporterName: string;
  reporterRole: string;
  reporterUnit: string;
  assignedToUserId: string | null;
  assignedToName?: string | null;
  adminNote: string;
  resolutionNote: string;
  duplicateOfId: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  completedAt: string | null;
};

export const FEEDBACK_TYPES: Array<{
  id: FeedbackType;
  label: string;
  description: string;
}> = [
  {
    id: "bug",
    label: "Laporan Kendala",
    description:
      "Laporkan kendala seperti tampilan rusak, tombol tidak berfungsi, data tidak muncul, atau masalah teknis lain.",
  },
  {
    id: "feature",
    label: "Saran Fitur",
    description: "Ajukan perbaikan atau fitur tambahan untuk aplikasi yang sudah ada.",
  },
  {
    id: "app_idea",
    label: "Usulan Aplikasi Baru",
    description:
      "Usulkan aplikasi internal baru yang dapat membantu pekerjaan kantor atau layanan pengadilan.",
  },
];

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "Laporan Kendala",
  feature: "Saran Fitur",
  app_idea: "Usulan Aplikasi Baru",
};

export const FEEDBACK_TYPE_DESCRIPTIONS: Record<FeedbackType, string> = {
  bug: "Jelaskan kendala yang terjadi agar admin dapat menelusuri dan menguji ulang.",
  feature: "Jelaskan fitur yang diinginkan dan manfaatnya bagi pekerjaan harian.",
  app_idea: "Jelaskan aplikasi baru yang diusulkan, calon pengguna, dan masalah yang ingin diselesaikan.",
};

export const FEEDBACK_CATEGORIES: Record<FeedbackType, string[]> = {
  bug: [
    "Kendala login",
    "Tampilan/UI rusak",
    "Data tidak muncul",
    "Tombol tidak berfungsi",
    "WhatsApp/ALETA Bot bermasalah",
    "Manajemen Surat bermasalah",
    "Koneksi database",
    "AI/Pertanyaan Publik",
    "Lainnya",
  ],
  feature: [
    "Manajemen Surat",
    "ALETA Bot",
    "Asisten Hakim",
    "Dashboard",
    "Pencarian",
    "Notifikasi",
    "Laporan/Statistik",
    "Pengaturan Admin",
    "Lainnya",
  ],
  app_idea: [
    "Aplikasi untuk hakim",
    "Aplikasi untuk panitera",
    "Aplikasi untuk jurusita",
    "Aplikasi untuk kesekretariatan",
    "Aplikasi untuk PTSP",
    "Aplikasi untuk pimpinan",
    "Aplikasi untuk publik/pihak",
    "Integrasi antarinstansi",
    "Lainnya",
  ],
};

export const FEEDBACK_APP_AREAS: Array<{ id: FeedbackAppArea; label: string }> = [
  { id: "portal", label: "Portal Utama" },
  { id: "mail", label: "Manajemen Surat" },
  { id: "aleta_bot", label: "ALETA Bot" },
  { id: "assistant_judge", label: "Asisten Hakim" },
  { id: "patch_notes", label: "Patch Notes" },
  { id: "guide", label: "Panduan Penggunaan" },
  { id: "admin", label: "Admin/Pengaturan" },
  { id: "other", label: "Lainnya" },
];

export const FEEDBACK_APP_AREA_LABELS: Record<FeedbackAppArea, string> = Object.fromEntries(
  FEEDBACK_APP_AREAS.map((item) => [item.id, item.label])
) as Record<FeedbackAppArea, string>;

export const FEEDBACK_PRIORITIES: Array<{ id: FeedbackPriority; label: string }> = [
  { id: "low", label: "Rendah" },
  { id: "medium", label: "Sedang" },
  { id: "high", label: "Tinggi" },
  { id: "urgent", label: "Mendesak" },
];

export const FEEDBACK_PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  low: "Rendah",
  medium: "Sedang",
  high: "Tinggi",
  urgent: "Mendesak",
};

export const FEEDBACK_STATUSES: Array<{ id: FeedbackStatus; label: string }> = [
  { id: "new", label: "Baru" },
  { id: "reviewed", label: "Ditinjau" },
  { id: "in_progress", label: "Diproses" },
  { id: "needs_info", label: "Butuh Informasi" },
  { id: "planned", label: "Direncanakan" },
  { id: "done", label: "Selesai" },
  { id: "rejected", label: "Ditolak" },
  { id: "postponed", label: "Ditunda" },
  { id: "duplicate", label: "Duplikat" },
];

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "Baru",
  reviewed: "Ditinjau",
  in_progress: "Diproses",
  needs_info: "Butuh Informasi",
  planned: "Direncanakan",
  done: "Selesai",
  rejected: "Ditolak",
  postponed: "Ditunda",
  duplicate: "Duplikat",
};

export function getFeedbackStatusVariant(status: FeedbackStatus): BadgeProps["variant"] {
  if (status === "done") return "success";
  if (status === "rejected" || status === "duplicate") return "danger";
  if (status === "in_progress" || status === "needs_info" || status === "planned") return "warning";
  if (status === "postponed") return "muted";
  return "default";
}

export function getFeedbackPriorityVariant(priority: FeedbackPriority): BadgeProps["variant"] {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "default";
  return "muted";
}

export function getFeedbackDescriptionPlaceholder(type: FeedbackType) {
  if (type === "bug") {
    return "Jelaskan apa yang terjadi, langkah sebelum kendala muncul, dan apa yang seharusnya terjadi.";
  }
  if (type === "feature") {
    return "Jelaskan fitur yang diinginkan dan manfaatnya.";
  }
  return "Jelaskan aplikasi yang diusulkan, siapa penggunanya, dan masalah apa yang diselesaikan.";
}

export function getFeedbackExpectedPlaceholder(type: FeedbackType) {
  if (type === "bug") return "Jelaskan apa yang seharusnya terjadi.";
  if (type === "feature") return "Jelaskan hasil/perubahan yang diharapkan.";
  return "Jelaskan output atau fungsi utama aplikasi yang diusulkan.";
}
