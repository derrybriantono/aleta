import {
  getEffectivePositionId,
  getEffectiveRoleId,
} from "@/lib/permissions";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  type AttendancePermissionDto,
  type EmployeeDocumentDto,
  type EmployeeProfileDto,
  type HrAnnualDocumentRequirementDto,
  type HrAttachmentDto,
  type HrAttendancePermissionStatus,
  type HrAttendancePermissionType,
  type HrCalendarItemDto,
  type HrDashboardDto,
  type HrEmployeeSignatureDto,
  type HrEmploymentStatus,
  type HrGeneratedDocumentDto,
  type HrLeaveStatus,
  type HrLeaveDailyImpactDto,
  type HrLeaveStatisticsDto,
  type HrNotificationTemplateDto,
  type HrPermissionFlags,
  type HrPublicEmployeeLookupDto,
  type HrPublicEmployeeLookupSuggestionDto,
  type HrPublicFormType,
  type HrPublicLeaveBalanceBucketDto,
  type HrPublicLeaveCalendarDayDto,
  type HrPublicLeavePreviewDto,
  type HrPublicMeetingResultDto,
  type HrPublicOptionsDto,
  type HrPublicStatusDto,
  type HrPublicSubmissionResultDto,
  type HrSettingsDto,
  type HrSlaItemDto,
  type HrSubmissionAttachmentStatus,
  type HrSubmissionStatus,
  type HrSubmissionType,
  type HrSubmissionDto,
  type LeaveApprovalLogDto,
  type LeaveBalanceDto,
  type LeaveBalanceTransactionDto,
  type LeaveRequestDto,
  type LeaveTypeDto,
  type MeetingResultDto,
} from "@/lib/e-kepegawaian-types";
import { type RoleId, type UserPersona } from "@/lib/types";
import { type AletaDatabase, withTransaction } from "@/server/db/client";
import { sendPortalWhatsappMessage } from "@/server/modules/whatsapp/portal-whatsapp-sender";
import { getInstitutionIdentityFromDb } from "@/server/modules/settings/service";
import { buildLeaveFormPdf, buildLeaveFormPdfFileName } from "@/server/modules/e-kepegawaian/leave-form-pdf";
import { ensureAletaSchema } from "@/server/db/schema";
import { appendAuditLog } from "@/server/shared/audit";
import { ApiError } from "@/server/shared/errors";
import { storeHrGeneratedFile } from "@/server/shared/hr-file-storage";
import { nextPrefixedId } from "@/server/shared/ids";

const HR_ADMIN_POSITION_IDS = new Set([
  "pos-kasubag-kepegawaian",
  "pos-staf-kepegawaian",
  "pos-analis-kepegawaian",
  "pos-penata-layanan-kepegawaian",
]);

const HR_MONITORING_ROLES = new Set([
  "ketua",
  "wakil-ketua",
  "panitera",
  "sekretaris",
  "kasubag",
  "pejabat-struktural",
]);

const STRUCTURAL_APPROVER_ROLES = new Set<RoleId>([
  "super-admin",
  "admin",
  "ketua",
  "wakil-ketua",
  "sekretaris",
  "panitera",
  "kasubag",
  "pejabat-struktural",
]);

const STATE_OFFICIAL_POSITION_IDS = new Set(["pos-ketua", "pos-wakil", "pos-hakim"]);

const EMPLOYMENT_STATUS_LABELS: Record<HrEmploymentStatus, string> = {
  pns: "PNS",
  pppk: "PPPK",
  cpns: "CPNS",
  pejabat_negara: "Pejabat Negara",
  honorer: "Honorer/PPNPN",
  lainnya: "Lainnya",
};

const EMPLOYMENT_RULE_LABELS: Record<HrEmploymentStatus, string> = {
  pns: "ASN PNS",
  pppk: "ASN PPPK berdasarkan perjanjian kerja",
  cpns: "CPNS",
  pejabat_negara: "Hakim/pimpinan pengadilan sebagai Pejabat Negara",
  honorer: "Non-ASN/PPNPN sesuai kebijakan satuan kerja",
  lainnya: "Status lainnya sesuai data kepegawaian",
};

const DEFAULT_LEAVE_TYPES = [
  {
    id: "hlt-cuti-tahunan",
    name: "Cuti Tahunan",
    code: "CT",
    description: "Hak cuti tahunan pegawai. Mengurangi saldo N, N-1, dan N-2.",
    approvalWorkflow: ["supervisor", "authorized_officer"],
    deductsAnnualBalance: true,
    requiresAttachment: false,
    maxDays: null,
    minDaysBeforeRequest: 1,
    sortOrder: 10,
  },
  {
    id: "hlt-cuti-sakit",
    name: "Cuti Sakit",
    code: "CS",
    description: "Cuti karena kondisi kesehatan. Lampiran dapat diwajibkan sesuai kebutuhan.",
    approvalWorkflow: ["supervisor", "authorized_officer"],
    deductsAnnualBalance: false,
    requiresAttachment: true,
    maxDays: null,
    minDaysBeforeRequest: 0,
    sortOrder: 20,
  },
  {
    id: "hlt-cuti-melahirkan",
    name: "Cuti Melahirkan",
    code: "CM",
    description: "Cuti melahirkan sesuai ketentuan kepegawaian.",
    approvalWorkflow: ["supervisor", "authorized_officer"],
    deductsAnnualBalance: false,
    requiresAttachment: true,
    maxDays: null,
    minDaysBeforeRequest: 7,
    sortOrder: 30,
  },
  {
    id: "hlt-cuti-alasan-penting",
    name: "Cuti Alasan Penting",
    code: "CAP",
    description: "Cuti karena alasan keluarga atau kepentingan mendesak.",
    approvalWorkflow: ["supervisor", "authorized_officer"],
    deductsAnnualBalance: false,
    requiresAttachment: true,
    maxDays: null,
    minDaysBeforeRequest: 1,
    sortOrder: 40,
  },
  {
    id: "hlt-cuti-besar",
    name: "Cuti Besar",
    code: "CB",
    description: "Cuti besar sesuai masa kerja dan aturan internal.",
    approvalWorkflow: ["supervisor", "authorized_officer"],
    deductsAnnualBalance: false,
    requiresAttachment: true,
    maxDays: null,
    minDaysBeforeRequest: 14,
    sortOrder: 50,
  },
  {
    id: "hlt-cuti-diluar-tanggungan-negara",
    name: "Cuti di Luar Tanggungan Negara",
    code: "CLTN",
    description: "Cuti di luar tanggungan negara sesuai persetujuan pejabat berwenang.",
    approvalWorkflow: ["supervisor", "authorized_officer"],
    deductsAnnualBalance: false,
    requiresAttachment: true,
    maxDays: null,
    minDaysBeforeRequest: 30,
    sortOrder: 60,
  },
  {
    id: "hlt-cuti-sakit-khusus-hakim",
    name: "Cuti Sakit Khusus Hakim",
    code: "CSKH",
    description: "Khusus Ketua, Wakil Ketua, dan Hakim sebagai Pejabat Negara. Mengacu PERMA Nomor 7 Tahun 2016; wajib lampiran kesehatan dan batas awal paling lama 6 bulan.",
    approvalWorkflow: ["hr_officer", "authorized_officer"],
    deductsAnnualBalance: false,
    requiresAttachment: true,
    maxDays: 180,
    minDaysBeforeRequest: 0,
    sortOrder: 70,
  },
];

const DEFAULT_SETTINGS: HrSettingsDto = {
  moduleEnabled: true,
  annualLeaveDefaultDays: 12,
  defaultBalanceN: 12,
  defaultBalanceN1: 0,
  defaultBalanceN2: 0,
  balanceUsageOrder: ["N-2", "N-1", "N"],
  calculationType: "working_days",
  maxUploadSizeMb: 10,
  allowedFileTypes: ["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"],
  requestNumberFormat: "CUTI/{TAHUN}/{BULAN}/{NOMOR}",
  approvalSlaDays: 2,
  annualReminderDaysBefore: 14,
  annualReminderSchedulerEnabled: false,
  annualReminderSchedulerTime: "08:00",
  annualReminderSchedulerLastRunAt: null,
  annualReminderSchedulerLastMessage: "",
  leaveFormTemplateFileName: "",
  leaveFormTemplateOriginalName: "",
  publicForms: {
    cuti: true,
    uploadPck: true,
    uploadSkp: true,
    wfa: true,
    lambatDatang: true,
    cepatPulang: true,
    hasilRapat: true,
  },
  publicMaxUploadSizeMb: 5,
  publicAllowedFileTypes: ["pdf", "doc", "docx", "jpg", "jpeg", "png"],
  publicRequiresCaptcha: false,
  publicMode: "unrestricted",
  publicInstructions: "Form publik resmi E-Kepegawaian ALETA. Isi data dengan benar dan simpan kode tiket setelah submit.",
  publicSuccessMessage: "Pengajuan berhasil diterima. Simpan kode tiket untuk cek status.",
};

const PUBLIC_FORM_LABELS: Record<HrPublicFormType, string> = {
  cuti: "Permohonan Cuti",
  "upload-pck": "Upload PCK",
  "upload-skp": "Upload SKP",
  wfa: "Laporan WFA",
  "lambat-datang": "Permohonan Lambat Datang",
  "cepat-pulang": "Permohonan Cepat Pulang",
};

const PUBLIC_FORM_SETTING_KEYS: Record<HrPublicFormType, keyof HrSettingsDto["publicForms"]> = {
  cuti: "cuti",
  "upload-pck": "uploadPck",
  "upload-skp": "uploadSkp",
  wfa: "wfa",
  "lambat-datang": "lambatDatang",
  "cepat-pulang": "cepatPulang",
};

const PUBLIC_FORM_TYPES = new Set<HrPublicFormType>([
  "cuti",
  "upload-pck",
  "upload-skp",
  "wfa",
  "lambat-datang",
  "cepat-pulang",
]);

const DEFAULT_NOTIFICATION_TEMPLATES = [
  {
    id: "hnt-leave-submitted",
    templateKey: "leave_submitted",
    name: "Cuti - Pengajuan Baru",
    audience: "approver",
    eventType: "leave_submitted",
    body:
      "Assalamu'alaikum {{nama_penerima}}.\n\nAda pengajuan cuti yang perlu ditinjau:\n\n1. Pegawai: {{nama_pegawai}}\n2. Jenis cuti: {{jenis_cuti}}\n3. Tanggal: {{tanggal_mulai}} s.d. {{tanggal_selesai}}\n4. Lama cuti: {{jumlah_hari}} hari\n5. Nomor: {{nomor_permohonan}}\n\nMohon ditindaklanjuti melalui E-Kepegawaian ALETA.",
  },
  {
    id: "hnt-leave-approved",
    templateKey: "leave_approved",
    name: "Cuti - Disetujui",
    audience: "employee",
    eventType: "leave_approved",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nPermohonan cuti {{jenis_cuti}} Nomor {{nomor_permohonan}} telah disetujui.\n\nTanggal cuti: {{tanggal_mulai}} s.d. {{tanggal_selesai}}\nLama cuti: {{jumlah_hari}} hari\n\nSurat izin cuti dapat dicek melalui E-Kepegawaian ALETA.",
  },
  {
    id: "hnt-leave-rejected",
    templateKey: "leave_rejected",
    name: "Cuti - Ditolak",
    audience: "employee",
    eventType: "leave_rejected",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nPermohonan cuti {{jenis_cuti}} Nomor {{nomor_permohonan}} belum dapat disetujui.\n\nCatatan: {{catatan}}\n\nSilakan cek detailnya di E-Kepegawaian ALETA.",
  },
  {
    id: "hnt-leave-revision",
    templateKey: "leave_revision_required",
    name: "Cuti - Perlu Revisi",
    audience: "employee",
    eventType: "leave_revision_required",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nPermohonan cuti {{jenis_cuti}} Nomor {{nomor_permohonan}} perlu diperbaiki.\n\nCatatan revisi: {{catatan}}\n\nSilakan lengkapi melalui E-Kepegawaian ALETA.",
  },
  {
    id: "hnt-submission-created",
    templateKey: "submission_created",
    name: "Dokumen HR - Setoran Baru",
    audience: "admin",
    eventType: "submission_created",
    body:
      "Assalamu'alaikum {{nama_penerima}}.\n\nAda setoran dokumen {{jenis_setoran}} dari {{nama_pegawai}} yang perlu diverifikasi.\n\nJudul: {{judul}}\nPeriode: {{periode}}\n\nSilakan cek menu verifikasi E-Kepegawaian.",
  },
  {
    id: "hnt-submission-verified",
    templateKey: "submission_verified",
    name: "Dokumen HR - Terverifikasi",
    audience: "employee",
    eventType: "submission_verified",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nDokumen {{jenis_setoran}} dengan judul \"{{judul}}\" sudah diverifikasi.\n\nCatatan: {{catatan}}\n\nTerima kasih.",
  },
  {
    id: "hnt-submission-revision",
    templateKey: "submission_revision_required",
    name: "Dokumen HR - Perlu Revisi",
    audience: "employee",
    eventType: "submission_revision_required",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nDokumen {{jenis_setoran}} dengan judul \"{{judul}}\" perlu direvisi.\n\nCatatan: {{catatan}}\n\nSilakan unggah perbaikan melalui E-Kepegawaian ALETA.",
  },
  {
    id: "hnt-submission-rejected",
    templateKey: "submission_rejected",
    name: "Dokumen HR - Ditolak",
    audience: "employee",
    eventType: "submission_rejected",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nDokumen {{jenis_setoran}} dengan judul \"{{judul}}\" belum dapat diterima.\n\nCatatan: {{catatan}}\n\nSilakan hubungi admin kepegawaian jika membutuhkan penjelasan lebih lanjut.",
  },
  {
    id: "hnt-annual-document-reminder",
    templateKey: "annual_document_reminder",
    name: "Reminder Dokumen Tahunan",
    audience: "employee",
    eventType: "annual_document_reminder",
    body:
      "Assalamu'alaikum {{nama_pegawai}}.\n\nPengingat dokumen tahunan: {{nama_dokumen}} tahun {{tahun}} belum tercatat di E-Kepegawaian.\n\nBatas waktu: {{batas_waktu}}\n\nMohon unggah dokumen melalui menu {{jenis_setoran}}.",
  },
  {
    id: "hnt-approval-sla-overdue",
    templateKey: "approval_sla_overdue",
    name: "Approval Terlambat",
    audience: "approver",
    eventType: "approval_sla_overdue",
    body:
      "Assalamu'alaikum {{nama_penerima}}.\n\nAda proses E-Kepegawaian yang melewati SLA {{sla_hari}} hari:\n\n{{ringkasan}}\n\nMohon segera ditindaklanjuti agar pengajuan tidak menggantung.",
  },
] satisfies Array<{
  id: string;
  templateKey: string;
  name: string;
  audience: "employee" | "approver" | "admin";
  eventType: string;
  body: string;
}>;

let hrSchemaEnsuredInProcess = false;

const REQUIRED_HR_SCHEMA_TABLES = [
  "employee_profiles",
  "hr_leave_types",
  "hr_settings",
  "hr_leave_balances",
  "hr_leave_balance_transactions",
  "hr_leave_requests",
  "hr_leave_approval_logs",
  "hr_leave_attachments",
  "hr_submissions",
  "hr_submission_attachments",
  "hr_attendance_permissions",
  "hr_attendance_permission_attachments",
  "hr_meeting_results",
  "hr_employee_documents",
  "hr_holidays",
  "hr_employee_signatures",
  "hr_annual_document_requirements",
  "hr_notification_templates",
  "hr_generated_documents",
  "hr_public_submissions",
] as const;

type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
  path?: string;
  method?: string;
};

type EmployeeProfileRow = {
  id: string;
  user_id: string;
  user_role_id?: RoleId | null;
  nip: string | null;
  employee_number: string;
  full_name: string;
  position_id: string | null;
  position_name: string | null;
  unit_kerja: string;
  rank_grade: string;
  employment_status: string;
  is_active: number | boolean;
  supervisor_employee_id: string | null;
  supervisor_name: string | null;
  approval_officer_employee_id: string | null;
  approval_officer_name: string | null;
  phone: string;
  email: string;
};

type LeaveTypeRow = {
  id: string;
  name: string;
  code: string;
  description: string;
  approval_workflow_json: string;
  deducts_annual_balance: number | boolean;
  requires_attachment: number | boolean;
  max_days: number | null;
  min_days_before_request: number | null;
  is_active: number | boolean;
  sort_order: number;
};

type LeaveBalanceRow = {
  id: string;
  employee_id: string;
  year: number;
  balance_n: number | string;
  balance_n1: number | string;
  balance_n2: number | string;
  used_days: number | string;
  pending_days: number | string;
  remaining_days: number | string;
};

type LeaveBalanceTransactionRow = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  leave_request_id: string | null;
  year: number;
  source_year_type: string;
  transaction_type: string;
  days: number | string;
  description: string;
  created_by: string | null;
  created_at: string;
};

type LeaveRequestRow = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  unit_kerja: string | null;
  leave_type_id: string;
  leave_type_name: string | null;
  request_number: string | null;
  start_date: string;
  end_date: string;
  total_days: number | string;
  calculation_type: string;
  reason: string;
  address_during_leave: string;
  contact_during_leave: string;
  status: HrLeaveStatus;
  current_approval_level: number;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

type LeaveApprovalLogRow = {
  id: string;
  leave_request_id: string;
  approver_user_id: string | null;
  approver_employee_id: string | null;
  approver_name: string | null;
  approval_level: number;
  action: string;
  status_before: string;
  status_after: string;
  note: string;
  acted_at: string;
};

type HrSubmissionRow = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  submission_type: HrSubmissionType;
  title: string;
  period_year: number;
  period_month: number | null;
  submission_date: string;
  description: string;
  status: HrSubmissionStatus;
  verification_note: string;
  verified_at: string | null;
  created_at: string;
};

type HrEmployeeSignatureRow = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  signature_role: string;
  file_name: string;
  original_file_name: string;
  file_path: string;
  file_type: string;
  file_size: number | string;
  is_active: number | boolean;
  created_at: string;
};

type HrDocumentRequirementRow = {
  id: string;
  submission_type: HrSubmissionType;
  name: string;
  period_year: number;
  due_date: string;
  target_role_ids_json: string;
  target_position_ids_json: string;
  is_active: number | boolean;
  submitted_count: number | string;
};

type HrNotificationTemplateRow = {
  id: string;
  template_key: string;
  name: string;
  audience: HrNotificationTemplateDto["audience"];
  event_type: string;
  channel: "whatsapp";
  body: string;
  is_active: number | boolean;
  updated_at: string;
};

type HrGeneratedDocumentRow = {
  id: string;
  leave_request_id: string;
  document_type: string;
  file_name: string;
  verification_code: string;
  generated_at: string;
};

type AttendancePermissionRow = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  permission_type: HrAttendancePermissionType;
  request_date: string;
  requested_time: string;
  reason: string;
  status: HrAttendancePermissionStatus;
  note: string;
  created_at: string;
};

type MeetingResultRow = {
  id: string;
  title: string;
  meeting_date: string;
  location: string;
  participants: string;
  summary: string;
  category: string;
  visibility: string;
  status: string;
  document_public: number | boolean;
  created_at: string;
};

type HrPublicSubmissionRow = {
  id: string;
  ticket_code: string;
  form_type: HrPublicFormType;
  entity_type: "leave_request" | "submission" | "attendance_permission";
  entity_id: string;
  employee_id: string | null;
  applicant_name: string;
  applicant_identifier_masked: string;
  contact_masked: string;
  validation_hashes_json: string;
  status: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
};

type EmployeeDocumentRow = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  category: string;
  document_number: string;
  document_date: string;
  title: string;
  description: string;
  visibility: string;
  created_at: string;
};

type HrAttachmentRow = {
  id: string;
  entity_type: HrAttachmentDto["entityType"];
  entity_id: string;
  employee_id: string | null;
  owner_name: string | null;
  title: string | null;
  file_name: string | null;
  original_file_name: string | null;
  file_path: string | null;
  file_type: string | null;
  file_size: number | string | null;
  created_at: string;
  verification_status: HrSubmissionAttachmentStatus | null;
  verification_note: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
};

type UserSyncRow = {
  id: string;
  name: string;
  nip: string | null;
  email: string;
  whatsapp_number: string;
  role_id: RoleId;
  position_id: string;
  position_name: string;
  unit_kerja: string;
  reports_to_position_id: string | null;
};

type PositionSyncRow = {
  id: string;
  reports_to_position_id: string | null;
};

function booleanFromDb(value: number | boolean | null | undefined) {
  return value === true || value === 1;
}

function numberFromDb(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeJsonArray(value: string | null | undefined, fallback: string[]) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeEmploymentStatus(value: string | null | undefined): HrEmploymentStatus {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "pejabat_negara" || normalized === "pejabat negara") return "pejabat_negara";
  if (normalized === "pppk" || normalized === "p3k") return "pppk";
  if (normalized === "cpns") return "cpns";
  if (normalized === "honorer" || normalized === "ppnpn" || normalized === "non_asn") return "honorer";
  if (normalized === "lainnya" || normalized === "lain") return "lainnya";
  return "pns";
}

function isStateOfficialPosition(positionId: string | null | undefined, positionName?: string | null) {
  if (positionId && STATE_OFFICIAL_POSITION_IDS.has(positionId)) return true;
  const normalizedName = String(positionName ?? "").trim().toLowerCase();
  return normalizedName === "hakim" || normalizedName.includes("ketua pengadilan") || normalizedName === "wakil ketua";
}

function deriveEmploymentStatus({
  employmentStatus,
  positionId,
  positionName,
  roleId,
}: {
  employmentStatus?: string | null;
  positionId?: string | null;
  positionName?: string | null;
  roleId?: RoleId | null;
}): HrEmploymentStatus {
  if (isStateOfficialPosition(positionId, positionName)) return "pejabat_negara";
  if (positionId === "pos-pppk" || roleId === "pppk") return "pppk";
  return normalizeEmploymentStatus(employmentStatus);
}

function isJudicialStateOfficialEmployee(employee: Pick<EmployeeProfileDto, "employmentStatus" | "positionId" | "positionName">) {
  return employee.employmentStatus === "pejabat_negara" || isStateOfficialPosition(employee.positionId, employee.positionName);
}

function assertLeaveTypeAllowedForEmployee(leaveType: LeaveTypeDto, employee: EmployeeProfileDto) {
  if (leaveType.code === "CSKH" && !isJudicialStateOfficialEmployee(employee)) {
    throw new ApiError(400, "Cuti Sakit Khusus Hakim hanya dapat diajukan oleh Ketua, Wakil Ketua, atau Hakim sebagai Pejabat Negara.");
  }
}

function safePublicFormSettings(value: string | null | undefined) {
  if (!value) return DEFAULT_SETTINGS.publicForms;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return DEFAULT_SETTINGS.publicForms;
    const source = parsed as Partial<Record<keyof HrSettingsDto["publicForms"], unknown>>;
    return {
      cuti: source.cuti !== undefined ? Boolean(source.cuti) : DEFAULT_SETTINGS.publicForms.cuti,
      uploadPck: source.uploadPck !== undefined ? Boolean(source.uploadPck) : DEFAULT_SETTINGS.publicForms.uploadPck,
      uploadSkp: source.uploadSkp !== undefined ? Boolean(source.uploadSkp) : DEFAULT_SETTINGS.publicForms.uploadSkp,
      wfa: source.wfa !== undefined ? Boolean(source.wfa) : DEFAULT_SETTINGS.publicForms.wfa,
      lambatDatang: source.lambatDatang !== undefined ? Boolean(source.lambatDatang) : DEFAULT_SETTINGS.publicForms.lambatDatang,
      cepatPulang: source.cepatPulang !== undefined ? Boolean(source.cepatPulang) : DEFAULT_SETTINGS.publicForms.cepatPulang,
      hasilRapat: source.hasilRapat !== undefined ? Boolean(source.hasilRapat) : DEFAULT_SETTINGS.publicForms.hasilRapat,
    };
  } catch {
    return DEFAULT_SETTINGS.publicForms;
  }
}

function asRecord(payload: unknown) {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
}

function stringValue(payload: Record<string, unknown>, key: string, options?: { required?: boolean; label?: string }) {
  const value = payload[key];
  const normalized = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
  if (options?.required && !normalized) {
    throw new ApiError(400, `${options.label ?? key} wajib diisi.`);
  }
  return normalized;
}

function detectDelimiter(headerLine: string) {
  const candidates = [",", ";", "\t"];
  return candidates
    .map((delimiter) => ({ delimiter, count: headerLine.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ",";
}

function splitDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeImportHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseImportTable(raw: string) {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) throw new ApiError(400, "Data impor pegawai minimal berisi header dan satu baris data.");
  const delimiter = detectDelimiter(lines[0] ?? "");
  const headers = splitDelimitedLine(lines[0] ?? "", delimiter).map(normalizeImportHeader);
  const rows = lines.slice(1).map((line) => splitDelimitedLine(line, delimiter));
  return { headers, rows };
}

function headerIndex(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeImportHeader);
  return headers.findIndex((header) => normalizedAliases.includes(header));
}

function numberValue(payload: Record<string, unknown>, key: string, fallback = 0) {
  const value = payload[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentYear() {
  return Number(new Date().toISOString().slice(0, 4));
}

function currentTimeValue() {
  return new Date().toTimeString().slice(0, 8);
}

function sameIsoDate(left: string | null | undefined, right: string) {
  return Boolean(left && left.slice(0, 10) === right);
}

function dayDiffToNow(date: string) {
  const target = new Date(`${date}T00:00:00Z`).getTime();
  const today = new Date(`${todayIsoDate()}T00:00:00Z`).getTime();
  return Math.floor((target - today) / 86_400_000);
}

function mapEmployee(row: EmployeeProfileRow): EmployeeProfileDto {
  const employmentStatus = deriveEmploymentStatus({
    employmentStatus: row.employment_status,
    positionId: row.position_id,
    positionName: row.position_name,
    roleId: row.user_role_id ?? null,
  });

  return {
    id: row.id,
    userId: row.user_id,
    nip: row.nip ?? "",
    employeeNumber: row.employee_number,
    fullName: row.full_name,
    positionId: row.position_id ?? "",
    positionName: row.position_name ?? "-",
    unitKerja: row.unit_kerja,
    rankGrade: row.rank_grade,
    employmentStatus,
    employmentStatusLabel: EMPLOYMENT_STATUS_LABELS[employmentStatus],
    employmentRuleLabel: EMPLOYMENT_RULE_LABELS[employmentStatus],
    isStateOfficial: employmentStatus === "pejabat_negara",
    isActive: booleanFromDb(row.is_active),
    supervisorEmployeeId: row.supervisor_employee_id,
    supervisorName: row.supervisor_name,
    approvalOfficerEmployeeId: row.approval_officer_employee_id,
    approvalOfficerName: row.approval_officer_name,
    phone: row.phone,
    email: row.email,
  };
}

function mapLeaveType(row: LeaveTypeRow): LeaveTypeDto {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    approvalWorkflow: safeJsonArray(row.approval_workflow_json, ["supervisor", "authorized_officer"]),
    deductsAnnualBalance: booleanFromDb(row.deducts_annual_balance),
    requiresAttachment: booleanFromDb(row.requires_attachment),
    maxDays: row.max_days,
    minDaysBeforeRequest: row.min_days_before_request,
    isActive: booleanFromDb(row.is_active),
    sortOrder: row.sort_order,
  };
}

function mapBalance(row: LeaveBalanceRow): LeaveBalanceDto {
  const balanceN = numberFromDb(row.balance_n);
  const balanceN1 = numberFromDb(row.balance_n1);
  const balanceN2 = numberFromDb(row.balance_n2);
  const usedDays = numberFromDb(row.used_days);
  const pendingDays = numberFromDb(row.pending_days);
  const availableDays = Math.max(0, balanceN + balanceN1 + balanceN2 - usedDays - pendingDays);

  return {
    id: row.id,
    employeeId: row.employee_id,
    year: row.year,
    balanceN,
    balanceN1,
    balanceN2,
    usedDays,
    pendingDays,
    remainingDays: availableDays,
    availableDays,
  };
}

function mapBalanceTransaction(row: LeaveBalanceTransactionRow): LeaveBalanceTransactionDto {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name ?? "-",
    leaveRequestId: row.leave_request_id,
    year: row.year,
    sourceYearType: row.source_year_type,
    transactionType: row.transaction_type,
    days: numberFromDb(row.days),
    description: row.description,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapLeaveRequest(row: LeaveRequestRow): LeaveRequestDto {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name ?? "-",
    unitKerja: row.unit_kerja ?? "-",
    leaveTypeId: row.leave_type_id,
    leaveTypeName: row.leave_type_name ?? "-",
    requestNumber: row.request_number,
    startDate: row.start_date,
    endDate: row.end_date,
    totalDays: numberFromDb(row.total_days),
    calculationType: row.calculation_type,
    reason: row.reason,
    addressDuringLeave: row.address_during_leave,
    contactDuringLeave: row.contact_during_leave,
    status: row.status,
    currentApprovalLevel: row.current_approval_level,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSignature(row: HrEmployeeSignatureRow): HrEmployeeSignatureDto {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name ?? "-",
    signatureRole: row.signature_role,
    fileName: fileNameFromStoredPath(row.file_name, row.file_path),
    originalFileName: row.original_file_name,
    fileType: row.file_type,
    fileSize: numberFromDb(row.file_size),
    isActive: booleanFromDb(row.is_active),
    createdAt: row.created_at,
  };
}

function mapNotificationTemplate(row: HrNotificationTemplateRow): HrNotificationTemplateDto {
  return {
    id: row.id,
    templateKey: row.template_key,
    name: row.name,
    audience: row.audience,
    eventType: row.event_type,
    channel: row.channel,
    body: row.body,
    isActive: booleanFromDb(row.is_active),
    updatedAt: row.updated_at,
  };
}

function mapGeneratedDocument(row: HrGeneratedDocumentRow): HrGeneratedDocumentDto {
  return {
    id: row.id,
    leaveRequestId: row.leave_request_id,
    documentType: row.document_type,
    fileName: row.file_name,
    verificationCode: row.verification_code,
    generatedAt: row.generated_at,
  };
}

const HR_LEAVE_STATUS_LABELS: Record<HrLeaveStatus, string> = {
  draft: "Draft",
  submitted: "Diajukan",
  waiting_supervisor_approval: "Menunggu Atasan",
  waiting_authorized_officer_approval: "Menunggu Pejabat",
  approved: "Disetujui",
  rejected: "Ditolak",
  revision_required: "Perlu Revisi",
  cancelled: "Dibatalkan",
};

const HR_PENDING_LEAVE_STATUSES = new Set<HrLeaveStatus>([
  "submitted",
  "waiting_supervisor_approval",
  "waiting_authorized_officer_approval",
]);

function isPendingLeaveStatus(status: HrLeaveStatus) {
  return HR_PENDING_LEAVE_STATUSES.has(status);
}

function requestCoversDate(request: Pick<LeaveRequestDto, "startDate" | "endDate">, date: string) {
  return request.startDate <= date && request.endDate >= date;
}

function roundPercentage(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function addIsoDays(date: string, days: number) {
  const cursor = new Date(`${date}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
}

function monthBounds(date: string) {
  const cursor = new Date(`${date}T00:00:00Z`);
  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  return { first, last };
}

function nextWeekdayDates(startDate: string, total = 7) {
  const dates: string[] = [];
  let cursor = startDate;
  while (dates.length < total) {
    const day = new Date(`${cursor}T00:00:00Z`).getUTCDay();
    if (day !== 0 && day !== 6) dates.push(cursor);
    cursor = addIsoDays(cursor, 1);
  }
  return dates;
}

function buildLeaveDailyImpact(
  employees: EmployeeProfileDto[],
  leaveRequests: LeaveRequestDto[],
  date: string,
  simulatedEmployeeId: string | null = null
): HrLeaveDailyImpactDto {
  const activeEmployeeIds = new Set(employees.filter((employee) => employee.isActive).map((employee) => employee.id));
  const approvedRequests = leaveRequests.filter((request) => request.status === "approved" && requestCoversDate(request, date));
  const pendingRequests = leaveRequests.filter((request) => isPendingLeaveStatus(request.status) && requestCoversDate(request, date));
  const approvedEmployeeIds = new Set(approvedRequests.map((request) => request.employeeId).filter((id) => activeEmployeeIds.has(id)));
  const pendingEmployeeIds = new Set(pendingRequests.map((request) => request.employeeId).filter((id) => activeEmployeeIds.has(id)));
  const totalEmployees = activeEmployeeIds.size;
  const simulatedAdditionalEmployees = simulatedEmployeeId && activeEmployeeIds.has(simulatedEmployeeId) && !approvedEmployeeIds.has(simulatedEmployeeId)
    ? 1
    : 0;
  const totalOnLeaveWithSimulation = approvedEmployeeIds.size + simulatedAdditionalEmployees;

  return {
    date,
    totalEmployees,
    approvedLeaveEmployees: approvedEmployeeIds.size,
    pendingLeaveEmployees: pendingEmployeeIds.size,
    simulatedAdditionalEmployees,
    totalOnLeaveWithSimulation,
    leavePercentage: roundPercentage(totalEmployees ? (approvedEmployeeIds.size / totalEmployees) * 100 : 0),
    simulatedLeavePercentage: roundPercentage(totalEmployees ? (totalOnLeaveWithSimulation / totalEmployees) * 100 : 0),
    approvedLeaveRequestIds: approvedRequests.map((request) => request.id),
    pendingLeaveRequestIds: pendingRequests.map((request) => request.id),
  };
}

function buildLeaveStatistics(
  employees: EmployeeProfileDto[],
  leaveRequests: LeaveRequestDto[],
  leaveTypes: LeaveTypeDto[]
): HrLeaveStatisticsDto {
  const today = todayIsoDate();
  const nextWorkdays = nextWeekdayDates(today).map((date) => buildLeaveDailyImpact(employees, leaveRequests, date));
  const bounds = monthBounds(today);
  const monthImpacts: HrLeaveDailyImpactDto[] = [];
  for (let cursor = bounds.first; cursor <= bounds.last; cursor = addIsoDays(cursor, 1)) {
    monthImpacts.push(buildLeaveDailyImpact(employees, leaveRequests, cursor));
  }
  const monthlyPeak = monthImpacts.reduce<HrLeaveDailyImpactDto | null>((peak, item) => {
    if (!peak) return item;
    if (item.approvedLeaveEmployees > peak.approvedLeaveEmployees) return item;
    if (item.approvedLeaveEmployees === peak.approvedLeaveEmployees && item.leavePercentage > peak.leavePercentage) return item;
    return peak;
  }, null);

  return {
    today: buildLeaveDailyImpact(employees, leaveRequests, today),
    nextWorkdays,
    monthlyPeak,
    byStatus: (Object.keys(HR_LEAVE_STATUS_LABELS) as HrLeaveStatus[]).map((status) => ({
      status,
      label: HR_LEAVE_STATUS_LABELS[status],
      count: leaveRequests.filter((request) => request.status === status).length,
    })),
    byLeaveType: leaveTypes.map((leaveType) => {
      const items = leaveRequests.filter((request) => request.leaveTypeId === leaveType.id);
      return {
        leaveTypeId: leaveType.id,
        leaveTypeName: leaveType.name,
        count: items.length,
        approvedCount: items.filter((request) => request.status === "approved").length,
        pendingCount: items.filter((request) => isPendingLeaveStatus(request.status)).length,
      };
    }).filter((item) => item.count > 0),
  };
}

function mapApprovalLog(row: LeaveApprovalLogRow): LeaveApprovalLogDto {
  return {
    id: row.id,
    leaveRequestId: row.leave_request_id,
    approverUserId: row.approver_user_id,
    approverEmployeeId: row.approver_employee_id,
    approverName: row.approver_name ?? "-",
    approvalLevel: row.approval_level,
    action: row.action,
    statusBefore: row.status_before,
    statusAfter: row.status_after,
    note: row.note,
    actedAt: row.acted_at,
  };
}

function mapSubmission(row: HrSubmissionRow): HrSubmissionDto {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name ?? "-",
    submissionType: row.submission_type,
    title: row.title,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    submissionDate: row.submission_date,
    description: row.description,
    status: row.status,
    verificationNote: row.verification_note,
    verifiedAt: row.verified_at,
    createdAt: row.created_at,
  };
}

function mapAttendance(row: AttendancePermissionRow): AttendancePermissionDto {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name ?? "-",
    permissionType: row.permission_type,
    requestDate: row.request_date,
    requestedTime: row.requested_time,
    reason: row.reason,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
  };
}

function mapMeeting(row: MeetingResultRow): MeetingResultDto {
  return {
    id: row.id,
    title: row.title,
    meetingDate: row.meeting_date,
    location: row.location,
    participants: row.participants,
    summary: row.summary,
    category: row.category,
    visibility: row.visibility,
    status: row.status,
    documentPublic: booleanFromDb(row.document_public),
    createdAt: row.created_at,
  };
}

function mapDocument(row: EmployeeDocumentRow): EmployeeDocumentDto {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name ?? "-",
    category: row.category,
    documentNumber: row.document_number,
    documentDate: row.document_date,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    createdAt: row.created_at,
  };
}

function fileNameFromStoredPath(fileName: string | null | undefined, filePath: string | null | undefined) {
  if (fileName) return fileName;
  if (!filePath) return "";
  const parts = filePath.split("/");
  return parts[parts.length - 1] ?? "";
}

function mapAttachment(row: HrAttachmentRow): HrAttachmentDto {
  return {
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    employeeId: row.employee_id,
    ownerName: row.owner_name ?? "Internal",
    title: row.title ?? "Lampiran E-Kepegawaian",
    fileName: fileNameFromStoredPath(row.file_name, row.file_path),
    originalFileName: row.original_file_name ?? fileNameFromStoredPath(row.file_name, row.file_path),
    fileType: row.file_type ?? "",
    fileSize: numberFromDb(row.file_size),
    createdAt: row.created_at,
    verificationStatus: row.entity_type === "submission" ? row.verification_status ?? "pending" : null,
    verificationNote: row.verification_note ?? "",
    verifiedAt: row.verified_at ?? null,
    verifiedByName: row.verified_by_name ?? null,
  };
}

function isHrManager(actor: UserPersona) {
  const roleId = getEffectiveRoleId(actor);
  const positionId = getEffectivePositionId(actor);

  return roleId === "super-admin" || roleId === "admin" || Boolean(positionId && HR_ADMIN_POSITION_IDS.has(positionId));
}

function isHrConfigAdmin(actor: UserPersona) {
  const roleId = getEffectiveRoleId(actor);
  return roleId === "super-admin" || roleId === "admin";
}

function canMonitorAllEmployees(actor: UserPersona) {
  const roleId = getEffectiveRoleId(actor);
  const positionId = getEffectivePositionId(actor);

  return (
    isHrConfigAdmin(actor) ||
    Boolean(positionId && HR_ADMIN_POSITION_IDS.has(positionId)) ||
    Boolean(roleId && HR_MONITORING_ROLES.has(roleId))
  );
}

function isPotentialApprover(actor: UserPersona) {
  const roleId = getEffectiveRoleId(actor);
  const positionId = getEffectivePositionId(actor);
  return Boolean(roleId && STRUCTURAL_APPROVER_ROLES.has(roleId)) || Boolean(positionId && HR_ADMIN_POSITION_IDS.has(positionId));
}

async function appendHrAudit(
  db: AletaDatabase,
  actor: UserPersona | null,
  action: string,
  entityType: string,
  entityId: string,
  payload?: unknown
) {
  try {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor?.id ?? null,
      action,
      entityType,
      entityId,
      payload,
    });
  } catch (error) {
    console.warn("[ALETA HR AUDIT] Gagal mencatat audit E-Kepegawaian:", error);
  }
}

async function ensureHrSettings(db: AletaDatabase, actorUserId?: string | null) {
  const now = new Date().toISOString();
  const defaults: Array<{ key: string; value: string; description: string }> = [
    {
      key: "module_enabled",
      value: String(DEFAULT_SETTINGS.moduleEnabled),
      description: "Aktif/nonaktif modul E-Kepegawaian.",
    },
    {
      key: "annual_leave_default_days",
      value: String(DEFAULT_SETTINGS.annualLeaveDefaultDays),
      description: "Hak cuti tahunan default pegawai.",
    },
    {
      key: "default_balance_n",
      value: String(DEFAULT_SETTINGS.defaultBalanceN),
      description: "Saldo awal tahun berjalan/N untuk profil pegawai baru.",
    },
    {
      key: "default_balance_n1",
      value: String(DEFAULT_SETTINGS.defaultBalanceN1),
      description: "Saldo awal N-1 untuk penyesuaian awal data nyata.",
    },
    {
      key: "default_balance_n2",
      value: String(DEFAULT_SETTINGS.defaultBalanceN2),
      description: "Saldo awal N-2 untuk penyesuaian awal data nyata.",
    },
    {
      key: "balance_usage_order",
      value: JSON.stringify(DEFAULT_SETTINGS.balanceUsageOrder),
      description: "Urutan pemakaian saldo cuti tahunan.",
    },
    {
      key: "calculation_type",
      value: DEFAULT_SETTINGS.calculationType,
      description: "Cara hitung lama cuti: working_days atau calendar_days.",
    },
    {
      key: "max_upload_size_mb",
      value: String(DEFAULT_SETTINGS.maxUploadSizeMb),
      description: "Batas ukuran upload dokumen kepegawaian.",
    },
    {
      key: "allowed_file_types",
      value: JSON.stringify(DEFAULT_SETTINGS.allowedFileTypes),
      description: "Ekstensi file yang boleh diunggah.",
    },
    {
      key: "request_number_format",
      value: DEFAULT_SETTINGS.requestNumberFormat,
      description: "Format nomor permohonan cuti.",
    },
    {
      key: "approval_sla_days",
      value: String(DEFAULT_SETTINGS.approvalSlaDays),
      description: "Batas hari SLA approval sebelum masuk peringatan.",
    },
    {
      key: "annual_reminder_days_before",
      value: String(DEFAULT_SETTINGS.annualReminderDaysBefore),
      description: "Jumlah hari sebelum jatuh tempo untuk reminder dokumen tahunan.",
    },
    {
      key: "annual_reminder_scheduler_enabled",
      value: String(DEFAULT_SETTINGS.annualReminderSchedulerEnabled),
      description: "Aktif/nonaktif scheduler otomatis reminder dokumen tahunan.",
    },
    {
      key: "annual_reminder_scheduler_time",
      value: DEFAULT_SETTINGS.annualReminderSchedulerTime,
      description: "Jam rutin scheduler reminder dokumen tahunan.",
    },
    {
      key: "annual_reminder_scheduler_last_run_at",
      value: "",
      description: "Waktu terakhir scheduler reminder dokumen tahunan berjalan.",
    },
    {
      key: "annual_reminder_scheduler_last_message",
      value: "",
      description: "Ringkasan hasil terakhir scheduler reminder dokumen tahunan.",
    },
    {
      key: "leave_form_template_file_name",
      value: DEFAULT_SETTINGS.leaveFormTemplateFileName,
      description: "Nama file template PDF formulir cuti resmi.",
    },
    {
      key: "leave_form_template_original_name",
      value: DEFAULT_SETTINGS.leaveFormTemplateOriginalName,
      description: "Nama asli file template PDF formulir cuti resmi.",
    },
    {
      key: "public_forms_json",
      value: JSON.stringify(DEFAULT_SETTINGS.publicForms),
      description: "Status aktif/nonaktif form publik E-Kepegawaian.",
    },
    {
      key: "public_max_upload_size_mb",
      value: String(DEFAULT_SETTINGS.publicMaxUploadSizeMb),
      description: "Batas ukuran unggah untuk form publik.",
    },
    {
      key: "public_allowed_file_types",
      value: JSON.stringify(DEFAULT_SETTINGS.publicAllowedFileTypes),
      description: "Ekstensi file yang diizinkan untuk form publik.",
    },
    {
      key: "public_requires_captcha",
      value: String(DEFAULT_SETTINGS.publicRequiresCaptcha),
      description: "Aktif/nonaktif captcha/anti-spam form publik jika tersedia.",
    },
    {
      key: "public_mode",
      value: DEFAULT_SETTINGS.publicMode,
      description: "Mode akses form publik.",
    },
    {
      key: "public_instructions",
      value: DEFAULT_SETTINGS.publicInstructions,
      description: "Teks instruksi pada halaman form publik.",
    },
    {
      key: "public_success_message",
      value: DEFAULT_SETTINGS.publicSuccessMessage,
      description: "Teks sukses setelah public submission diterima.",
    },
  ];

  for (const setting of defaults) {
    await db.prepare(
      `INSERT INTO hr_settings (id, key, value, description, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (key) DO NOTHING`
    ).run(
      `hrs-${setting.key}`,
      setting.key,
      setting.value,
      setting.description,
      actorUserId ?? null,
      now,
      now
    );
  }
}

async function getHrSettings(db: AletaDatabase): Promise<HrSettingsDto> {
  const rows = await db.prepare(
    `SELECT key, value FROM hr_settings`
  ).all<{ key: string; value: string }>();
  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    moduleEnabled: (map.get("module_enabled") ?? "true") === "true",
    annualLeaveDefaultDays: Number(map.get("annual_leave_default_days") ?? DEFAULT_SETTINGS.annualLeaveDefaultDays),
    defaultBalanceN: Number(map.get("default_balance_n") ?? map.get("annual_leave_default_days") ?? DEFAULT_SETTINGS.defaultBalanceN),
    defaultBalanceN1: Number(map.get("default_balance_n1") ?? DEFAULT_SETTINGS.defaultBalanceN1),
    defaultBalanceN2: Number(map.get("default_balance_n2") ?? DEFAULT_SETTINGS.defaultBalanceN2),
    balanceUsageOrder: safeJsonArray(map.get("balance_usage_order"), DEFAULT_SETTINGS.balanceUsageOrder),
    calculationType: map.get("calculation_type") === "calendar_days" ? "calendar_days" : "working_days",
    maxUploadSizeMb: Number(map.get("max_upload_size_mb") ?? DEFAULT_SETTINGS.maxUploadSizeMb),
    allowedFileTypes: safeJsonArray(map.get("allowed_file_types"), DEFAULT_SETTINGS.allowedFileTypes),
    requestNumberFormat: map.get("request_number_format") ?? DEFAULT_SETTINGS.requestNumberFormat,
    approvalSlaDays: Math.max(1, Number(map.get("approval_sla_days") ?? DEFAULT_SETTINGS.approvalSlaDays)),
    annualReminderDaysBefore: Math.max(1, Number(map.get("annual_reminder_days_before") ?? DEFAULT_SETTINGS.annualReminderDaysBefore)),
    annualReminderSchedulerEnabled: (map.get("annual_reminder_scheduler_enabled") ?? "false") === "true",
    annualReminderSchedulerTime: map.get("annual_reminder_scheduler_time") ?? DEFAULT_SETTINGS.annualReminderSchedulerTime,
    annualReminderSchedulerLastRunAt: map.get("annual_reminder_scheduler_last_run_at") || null,
    annualReminderSchedulerLastMessage: map.get("annual_reminder_scheduler_last_message") ?? "",
    leaveFormTemplateFileName: map.get("leave_form_template_file_name") ?? "",
    leaveFormTemplateOriginalName: map.get("leave_form_template_original_name") ?? "",
    publicForms: safePublicFormSettings(map.get("public_forms_json")),
    publicMaxUploadSizeMb: Math.max(1, Number(map.get("public_max_upload_size_mb") ?? DEFAULT_SETTINGS.publicMaxUploadSizeMb)),
    publicAllowedFileTypes: safeJsonArray(map.get("public_allowed_file_types"), DEFAULT_SETTINGS.publicAllowedFileTypes),
    publicRequiresCaptcha: (map.get("public_requires_captcha") ?? "false") === "true",
    publicMode: map.get("public_mode") === "token" ? "token" : "unrestricted",
    publicInstructions: map.get("public_instructions") ?? DEFAULT_SETTINGS.publicInstructions,
    publicSuccessMessage: map.get("public_success_message") ?? DEFAULT_SETTINGS.publicSuccessMessage,
  };
}

async function ensureDefaultLeaveTypes(db: AletaDatabase, actorUserId?: string | null) {
  const now = new Date().toISOString();

  for (const leaveType of DEFAULT_LEAVE_TYPES) {
    await db.prepare(
      `INSERT INTO hr_leave_types (
        id, name, code, description, approval_workflow_json, deducts_annual_balance, requires_attachment,
        max_days, min_days_before_request, is_active, sort_order, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      ON CONFLICT (code) DO NOTHING`
    ).run(
      leaveType.id,
      leaveType.name,
      leaveType.code,
      leaveType.description,
      JSON.stringify(leaveType.approvalWorkflow),
      leaveType.deductsAnnualBalance ? 1 : 0,
      leaveType.requiresAttachment ? 1 : 0,
      leaveType.maxDays,
      leaveType.minDaysBeforeRequest,
      leaveType.sortOrder,
      actorUserId ?? null,
      actorUserId ?? null,
      now,
      now
    );
  }
}

async function ensureDefaultNotificationTemplates(db: AletaDatabase, actorUserId?: string | null) {
  const now = new Date().toISOString();

  for (const template of DEFAULT_NOTIFICATION_TEMPLATES) {
    await db.prepare(
      `INSERT INTO hr_notification_templates (
        id, template_key, name, audience, event_type, channel, body, is_active,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'whatsapp', ?, 1, ?, ?, ?, ?)
      ON CONFLICT (template_key) DO NOTHING`
    ).run(
      template.id,
      template.templateKey,
      template.name,
      template.audience,
      template.eventType,
      template.body,
      actorUserId ?? null,
      actorUserId ?? null,
      now,
      now
    );
  }
}

async function ensureDefaultDocumentRequirements(db: AletaDatabase, actorUserId?: string | null) {
  const now = new Date().toISOString();
  const year = currentYear();
  const defaults: Array<{ id: string; submissionType: HrSubmissionType; name: string; dueDate: string }> = [
    { id: `hdr-pck-${year}`, submissionType: "pck", name: `PCK Tahun ${year}`, dueDate: `${year}-12-31` },
    { id: `hdr-skp-${year}`, submissionType: "skp", name: `SKP Tahun ${year}`, dueDate: `${year}-12-31` },
    { id: `hdr-wfa-${year}`, submissionType: "wfa", name: `Laporan WFA Tahun ${year}`, dueDate: `${year}-12-31` },
  ];

  for (const requirement of defaults) {
    await db.prepare(
      `INSERT INTO hr_annual_document_requirements (
        id, submission_type, name, period_year, due_date,
        target_role_ids_json, target_position_ids_json, is_active,
        created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, '[]', '[]', 1, ?, ?, ?, ?)
      ON CONFLICT (id) DO NOTHING`
    ).run(
      requirement.id,
      requirement.submissionType,
      requirement.name,
      year,
      requirement.dueDate,
      actorUserId ?? null,
      actorUserId ?? null,
      now,
      now
    );
  }
}

async function syncEmployeeProfilesFromUsers(db: AletaDatabase, actorUserId?: string | null) {
  const now = new Date().toISOString();
  const rows = await db.prepare(
    `SELECT u.id, u.name, u.nip, u.email, u.whatsapp_number, u.role_id, u.position_id,
      p.name AS position_name, p.unit_kerja, p.reports_to_position_id
     FROM users u
     LEFT JOIN positions p ON p.id = u.position_id
     WHERE u.deleted_at IS NULL AND u.is_active = 1`
  ).all<UserSyncRow>();

  for (const user of rows) {
    const employmentStatus = deriveEmploymentStatus({
      employmentStatus: "pns",
      positionId: user.position_id,
      positionName: user.position_name,
      roleId: user.role_id,
    });

    await db.prepare(
      `INSERT INTO employee_profiles (
        id, user_id, nip, employee_number, full_name, position_id, unit_kerja,
        phone, email, employment_status, is_active, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET
        nip = EXCLUDED.nip,
        employee_number = EXCLUDED.employee_number,
        full_name = EXCLUDED.full_name,
        position_id = EXCLUDED.position_id,
        unit_kerja = CASE WHEN employee_profiles.unit_kerja = '' THEN EXCLUDED.unit_kerja ELSE employee_profiles.unit_kerja END,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        employment_status = CASE
          WHEN EXCLUDED.employment_status IN ('pejabat_negara', 'pppk') THEN EXCLUDED.employment_status
          WHEN employee_profiles.employment_status = '' THEN EXCLUDED.employment_status
          ELSE employee_profiles.employment_status
        END,
        is_active = 1,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at`
    ).run(
      await nextPrefixedId(db, "employee_profiles", "emp"),
      user.id,
      user.nip?.trim() ? user.nip.trim() : null,
      user.nip?.trim() ? user.nip.trim() : user.id,
      user.name,
      user.position_id,
      user.unit_kerja ?? "",
      user.whatsapp_number ?? "",
      user.email ?? "",
      employmentStatus,
      actorUserId ?? user.id,
      actorUserId ?? user.id,
      now,
      now
    );
  }

  const positions = await db.prepare(
    `SELECT id, reports_to_position_id FROM positions WHERE deleted_at IS NULL`
  ).all<PositionSyncRow>();
  const positionMap = new Map(positions.map((position) => [position.id, position.reports_to_position_id]));
  const profiles = await db.prepare(
    `SELECT id, user_id, nip, employee_number, full_name, position_id, unit_kerja, rank_grade,
      employment_status, is_active, supervisor_employee_id, approval_officer_employee_id, phone, email,
      NULL AS position_name, NULL AS supervisor_name, NULL AS approval_officer_name
     FROM employee_profiles
     WHERE deleted_at IS NULL`
  ).all<EmployeeProfileRow>();
  const profileByPosition = new Map<string, EmployeeProfileRow>();

  for (const profile of profiles) {
    if (profile.position_id && !profileByPosition.has(profile.position_id)) {
      profileByPosition.set(profile.position_id, profile);
    }
  }

  const fallbackApprovalOfficer =
    profileByPosition.get("pos-ketua") ??
    profileByPosition.get("pos-sekretaris") ??
    profileByPosition.get("pos-wakil") ??
    null;

  for (const profile of profiles) {
    const supervisorPositionId = profile.position_id ? positionMap.get(profile.position_id) : null;
    const supervisor = supervisorPositionId ? profileByPosition.get(supervisorPositionId) ?? null : null;
    const approvalOfficer = fallbackApprovalOfficer ?? supervisor;

    await db.prepare(
      `UPDATE employee_profiles
       SET supervisor_employee_id = ?, approval_officer_employee_id = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      supervisor?.id ?? null,
      approvalOfficer?.id ?? null,
      now,
      profile.id
    );
  }
}

export async function ensureEKepegawaianDefaults(db: AletaDatabase, actorUserId?: string | null) {
  if (!hrSchemaEnsuredInProcess) {
    await ensureAletaSchema(db);
    for (const tableName of REQUIRED_HR_SCHEMA_TABLES) {
      await db.prepare(`SELECT 1 FROM ${tableName} LIMIT 1`).get();
    }
    hrSchemaEnsuredInProcess = true;
  }
  await ensureHrSettings(db, actorUserId);
  await ensureDefaultLeaveTypes(db, actorUserId);
  await ensureDefaultNotificationTemplates(db, actorUserId);
  await ensureDefaultDocumentRequirements(db, actorUserId);
  await syncEmployeeProfilesFromUsers(db, actorUserId);
}

async function listEmployees(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT ep.id, ep.user_id, u.role_id AS user_role_id, ep.nip, ep.employee_number, ep.full_name, ep.position_id,
      COALESCE(p.name, '') AS position_name, ep.unit_kerja, ep.rank_grade, ep.employment_status,
      ep.is_active, ep.supervisor_employee_id, sp.full_name AS supervisor_name,
      ep.approval_officer_employee_id, ap.full_name AS approval_officer_name, ep.phone, ep.email
     FROM employee_profiles ep
     LEFT JOIN users u ON u.id = ep.user_id
     LEFT JOIN positions p ON p.id = ep.position_id
     LEFT JOIN employee_profiles sp ON sp.id = ep.supervisor_employee_id
     LEFT JOIN employee_profiles ap ON ap.id = ep.approval_officer_employee_id
     WHERE ep.deleted_at IS NULL
     ORDER BY ep.unit_kerja ASC, p.level_hierarchy ASC, ep.full_name ASC`
  ).all<EmployeeProfileRow>();

  return rows.map(mapEmployee);
}

async function listLeaveTypes(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT id, name, code, description, approval_workflow_json, deducts_annual_balance, requires_attachment,
      max_days, min_days_before_request, is_active, sort_order
     FROM hr_leave_types
     ORDER BY sort_order ASC, name ASC`
  ).all<LeaveTypeRow>();

  return rows.map(mapLeaveType);
}

async function ensureBalance(db: AletaDatabase, employeeId: string, year: number, actorUserId?: string | null) {
  const existing = await db.prepare(
    `SELECT id, employee_id, year, balance_n, balance_n1, balance_n2, used_days, pending_days, remaining_days
     FROM hr_leave_balances
     WHERE employee_id = ? AND year = ?`
  ).get<LeaveBalanceRow>(employeeId, year);

  if (existing) return mapBalance(existing);

  const settings = await getHrSettings(db);
  const now = new Date().toISOString();
  const id = await nextPrefixedId(db, "hr_leave_balances", "hlb");
  const balanceN = settings.defaultBalanceN;
  const balanceN1 = settings.defaultBalanceN1;
  const balanceN2 = settings.defaultBalanceN2;
  const remaining = Math.max(0, balanceN + balanceN1 + balanceN2);

  await db.prepare(
    `INSERT INTO hr_leave_balances (
      id, employee_id, year, balance_n, balance_n1, balance_n2,
      used_days, pending_days, remaining_days, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)`
  ).run(id, employeeId, year, balanceN, balanceN1, balanceN2, remaining, actorUserId ?? null, actorUserId ?? null, now, now);

  return {
    id,
    employeeId,
    year,
    balanceN,
    balanceN1,
    balanceN2,
    usedDays: 0,
    pendingDays: 0,
    remainingDays: remaining,
    availableDays: remaining,
  };
}

async function listBalances(db: AletaDatabase, employees: EmployeeProfileDto[], actorUserId?: string | null) {
  const year = currentYear();
  const balances: LeaveBalanceDto[] = [];

  for (const employee of employees) {
    balances.push(await ensureBalance(db, employee.id, year, actorUserId));
  }

  return balances;
}

async function listLeaveRequests(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT lr.id, lr.employee_id, ep.full_name AS employee_name, ep.unit_kerja,
      lr.leave_type_id, lt.name AS leave_type_name, lr.request_number, lr.start_date, lr.end_date,
      lr.total_days, lr.calculation_type, lr.reason, lr.address_during_leave,
      lr.contact_during_leave, lr.status, lr.current_approval_level,
      lr.submitted_at, lr.approved_at, lr.rejected_at, lr.cancelled_at, lr.created_at, lr.updated_at
     FROM hr_leave_requests lr
     LEFT JOIN employee_profiles ep ON ep.id = lr.employee_id
     LEFT JOIN hr_leave_types lt ON lt.id = lr.leave_type_id
     WHERE lr.deleted_at IS NULL
     ORDER BY lr.created_at DESC
     LIMIT 300`
  ).all<LeaveRequestRow>();

  return rows.map(mapLeaveRequest);
}

async function listApprovalLogs(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT al.id, al.leave_request_id, al.approver_user_id, al.approver_employee_id,
      COALESCE(ep.full_name, u.name, '-') AS approver_name, al.approval_level, al.action,
      al.status_before, al.status_after, al.note, al.acted_at
     FROM hr_leave_approval_logs al
     LEFT JOIN employee_profiles ep ON ep.id = al.approver_employee_id
     LEFT JOIN users u ON u.id = al.approver_user_id
     ORDER BY al.acted_at DESC
     LIMIT 500`
  ).all<LeaveApprovalLogRow>();

  return rows.map(mapApprovalLog);
}

async function listSubmissions(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT hs.id, hs.employee_id, ep.full_name AS employee_name, hs.submission_type,
      hs.title, hs.period_year, hs.period_month, hs.submission_date, hs.description,
      hs.status, hs.verification_note, hs.verified_at, hs.created_at
     FROM hr_submissions hs
     LEFT JOIN employee_profiles ep ON ep.id = hs.employee_id
     ORDER BY hs.created_at DESC
     LIMIT 300`
  ).all<HrSubmissionRow>();

  return rows.map(mapSubmission);
}

async function listAttendancePermissions(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT hp.id, hp.employee_id, ep.full_name AS employee_name, hp.permission_type,
      hp.request_date, hp.requested_time, hp.reason, hp.status, hp.note, hp.created_at
     FROM hr_attendance_permissions hp
     LEFT JOIN employee_profiles ep ON ep.id = hp.employee_id
     ORDER BY hp.created_at DESC
     LIMIT 300`
  ).all<AttendancePermissionRow>();

  return rows.map(mapAttendance);
}

async function listMeetings(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT id, title, meeting_date, location, participants, summary, category, visibility, status, document_public, created_at
     FROM hr_meeting_results
     ORDER BY meeting_date DESC, created_at DESC
     LIMIT 200`
  ).all<MeetingResultRow>();

  return rows.map(mapMeeting);
}

async function listDocuments(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT ed.id, ed.employee_id, ep.full_name AS employee_name, ed.category, ed.document_number,
      ed.document_date, ed.title, ed.description, ed.visibility, ed.created_at
     FROM hr_employee_documents ed
     LEFT JOIN employee_profiles ep ON ep.id = ed.employee_id
     ORDER BY ed.created_at DESC
     LIMIT 300`
  ).all<EmployeeDocumentRow>();

  return rows.map(mapDocument);
}

async function listAttachments(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT hla.id, 'leave_request' AS entity_type, hla.leave_request_id AS entity_id,
        lr.employee_id, ep.full_name AS owner_name, COALESCE(lr.request_number, 'Lampiran cuti') AS title,
        hla.file_name, hla.original_file_name, hla.file_path, hla.file_type, hla.file_size, hla.created_at,
        NULL AS verification_status, '' AS verification_note, NULL AS verified_at, NULL AS verified_by_name
       FROM hr_leave_attachments hla
       JOIN hr_leave_requests lr ON lr.id = hla.leave_request_id
       LEFT JOIN employee_profiles ep ON ep.id = lr.employee_id
      UNION ALL
      SELECT hsa.id, 'submission' AS entity_type, hsa.submission_id AS entity_id,
        hs.employee_id, ep.full_name AS owner_name, hs.title,
        hsa.file_name, hsa.original_file_name, hsa.file_path, hsa.file_type, hsa.file_size, hsa.created_at,
        hsa.verification_status, hsa.verification_note, hsa.verified_at, COALESCE(u.name, '') AS verified_by_name
       FROM hr_submission_attachments hsa
       JOIN hr_submissions hs ON hs.id = hsa.submission_id
       LEFT JOIN employee_profiles ep ON ep.id = hs.employee_id
       LEFT JOIN users u ON u.id = hsa.verified_by
      UNION ALL
      SELECT haa.id, 'attendance_permission' AS entity_type, haa.attendance_permission_id AS entity_id,
        hp.employee_id, ep.full_name AS owner_name, hp.reason AS title,
        haa.file_name, haa.original_file_name, haa.file_path, haa.file_type, haa.file_size, haa.created_at,
        NULL AS verification_status, '' AS verification_note, NULL AS verified_at, NULL AS verified_by_name
       FROM hr_attendance_permission_attachments haa
       JOIN hr_attendance_permissions hp ON hp.id = haa.attendance_permission_id
       LEFT JOIN employee_profiles ep ON ep.id = hp.employee_id
      UNION ALL
      SELECT ed.id, 'employee_document' AS entity_type, ed.id AS entity_id,
        ed.employee_id, ep.full_name AS owner_name, ed.title,
        ed.file_name, ed.title AS original_file_name, ed.file_path, ed.file_type, ed.file_size, ed.updated_at AS created_at,
        NULL AS verification_status, '' AS verification_note, NULL AS verified_at, NULL AS verified_by_name
       FROM hr_employee_documents ed
       LEFT JOIN employee_profiles ep ON ep.id = ed.employee_id
       WHERE ed.file_name <> '' OR ed.file_path IS NOT NULL
      UNION ALL
      SELECT mr.id, 'meeting_result' AS entity_type, mr.id AS entity_id,
        NULL AS employee_id, 'Internal' AS owner_name, mr.title,
        '' AS file_name, mr.title AS original_file_name, mr.document_path AS file_path, '' AS file_type, 0 AS file_size, mr.updated_at AS created_at,
        NULL AS verification_status, '' AS verification_note, NULL AS verified_at, NULL AS verified_by_name
       FROM hr_meeting_results mr
       WHERE mr.document_path IS NOT NULL
      UNION ALL
      SELECT sig.id, 'employee_signature' AS entity_type, sig.employee_id AS entity_id,
        sig.employee_id, ep.full_name AS owner_name, 'Foto tanda tangan pegawai' AS title,
        sig.file_name, sig.original_file_name, sig.file_path, sig.file_type, sig.file_size, sig.updated_at AS created_at,
        NULL AS verification_status, '' AS verification_note, NULL AS verified_at, NULL AS verified_by_name
       FROM hr_employee_signatures sig
       LEFT JOIN employee_profiles ep ON ep.id = sig.employee_id
       WHERE sig.is_active = 1
      ORDER BY created_at DESC
      LIMIT 400`
  ).all<HrAttachmentRow>();

  return rows.map(mapAttachment).filter((item) => item.fileName);
}

async function listBalanceTransactions(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT hbt.id, hbt.employee_id, ep.full_name AS employee_name, hbt.leave_request_id,
      hbt.year, hbt.source_year_type, hbt.transaction_type, hbt.days,
      hbt.description, hbt.created_by, hbt.created_at
     FROM hr_leave_balance_transactions hbt
     LEFT JOIN employee_profiles ep ON ep.id = hbt.employee_id
     ORDER BY hbt.created_at DESC
     LIMIT 400`
  ).all<LeaveBalanceTransactionRow>();

  return rows.map(mapBalanceTransaction);
}

async function listEmployeeSignatures(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT sig.id, sig.employee_id, ep.full_name AS employee_name, sig.signature_role,
      sig.file_name, sig.original_file_name, sig.file_path, sig.file_type, sig.file_size,
      sig.is_active, sig.created_at
     FROM hr_employee_signatures sig
     LEFT JOIN employee_profiles ep ON ep.id = sig.employee_id
     ORDER BY sig.updated_at DESC`
  ).all<HrEmployeeSignatureRow>();

  return rows.map(mapSignature);
}

async function listNotificationTemplates(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT id, template_key, name, audience, event_type, channel, body, is_active, updated_at
     FROM hr_notification_templates
     ORDER BY audience ASC, name ASC`
  ).all<HrNotificationTemplateRow>();

  return rows.map(mapNotificationTemplate);
}

async function listGeneratedDocuments(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT id, leave_request_id, document_type, file_name, verification_code, generated_at
     FROM hr_generated_documents
     ORDER BY generated_at DESC
     LIMIT 200`
  ).all<HrGeneratedDocumentRow>();

  return rows.map(mapGeneratedDocument);
}

async function listDocumentRequirements(db: AletaDatabase, employees: EmployeeProfileDto[]) {
  const rows = await db.prepare(
    `SELECT hdr.id, hdr.submission_type, hdr.name, hdr.period_year, hdr.due_date,
      hdr.target_role_ids_json, hdr.target_position_ids_json, hdr.is_active,
      COALESCE(submitted.submitted_count, 0) AS submitted_count
     FROM hr_annual_document_requirements hdr
     LEFT JOIN (
       SELECT submission_type, period_year, COUNT(DISTINCT employee_id) AS submitted_count
       FROM hr_submissions
       WHERE status IN ('submitted', 'verified')
       GROUP BY submission_type, period_year
     ) submitted ON submitted.submission_type = hdr.submission_type
      AND submitted.period_year = hdr.period_year
     ORDER BY hdr.period_year DESC, hdr.due_date ASC`
  ).all<HrDocumentRequirementRow>();

  return rows.map((row): HrAnnualDocumentRequirementDto => {
    const targetRoleIds = safeJsonArray(row.target_role_ids_json, []);
    const targetPositionIds = safeJsonArray(row.target_position_ids_json, []);
    const scopedEmployees = employees.filter((employee) => {
      if (targetPositionIds.length && !targetPositionIds.includes(employee.positionId)) return false;
      return true;
    });
    const submittedCount = numberFromDb(row.submitted_count);
    return {
      id: row.id,
      submissionType: row.submission_type,
      name: row.name,
      periodYear: row.period_year,
      dueDate: row.due_date,
      targetRoleIds,
      targetPositionIds,
      isActive: booleanFromDb(row.is_active),
      submittedCount,
      missingCount: Math.max(0, scopedEmployees.length - submittedCount),
    };
  });
}

async function listHolidays(db: AletaDatabase) {
  return db.prepare(
    `SELECT id, date, name, type, is_working_day
     FROM hr_holidays
     ORDER BY date ASC
     LIMIT 500`
  ).all<{ id: string; date: string; name: string; type: string; is_working_day: number | boolean }>();
}

function filterEmployeeScope(
  employees: EmployeeProfileDto[],
  itemsEmployeeId: string,
  actorEmployee: EmployeeProfileDto | null,
  canManageAll: boolean
) {
  if (canManageAll) return true;
  if (!actorEmployee) return false;
  if (itemsEmployeeId === actorEmployee.id) return true;

  const target = employees.find((employee) => employee.id === itemsEmployeeId);
  return (
    target?.supervisorEmployeeId === actorEmployee.id ||
    target?.approvalOfficerEmployeeId === actorEmployee.id
  );
}

function dayDiffFromNow(dateValue: string | null | undefined) {
  if (!dateValue) return 0;
  const start = new Date(dateValue.length === 10 ? `${dateValue}T00:00:00Z` : dateValue);
  if (Number.isNaN(start.getTime())) return 0;
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000));
}

function buildCalendarItems(
  leaveRequests: LeaveRequestDto[],
  holidays: Array<{ id: string; date: string; name: string; type: string; is_working_day: number | boolean }>
): HrCalendarItemDto[] {
  const leaveItems: HrCalendarItemDto[] = leaveRequests
    .filter((request) => request.status === "approved")
    .map((request) => ({
      id: request.id,
      type: "leave",
      employeeId: request.employeeId,
      employeeName: request.employeeName,
      unitKerja: request.unitKerja,
      title: request.leaveTypeName,
      startDate: request.startDate,
      endDate: request.endDate,
      status: request.status,
    }));

  const holidayItems: HrCalendarItemDto[] = holidays.map((holiday) => ({
    id: holiday.id,
    type: "holiday",
    employeeId: null,
    employeeName: "Kalender kerja",
    unitKerja: booleanFromDb(holiday.is_working_day) ? "Hari kerja khusus" : "Libur",
    title: holiday.name,
    startDate: holiday.date,
    endDate: holiday.date,
    status: holiday.type,
  }));

  return [...leaveItems, ...holidayItems]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 500);
}

function buildSlaItems(
  leaveRequests: LeaveRequestDto[],
  submissions: HrSubmissionDto[],
  attendancePermissions: AttendancePermissionDto[],
  slaDays: number
): HrSlaItemDto[] {
  const leaveItems = leaveRequests
    .filter((request) => request.status === "waiting_supervisor_approval" || request.status === "waiting_authorized_officer_approval")
    .map((request) => {
      const daysWaiting = dayDiffFromNow(request.submittedAt ?? request.createdAt);
      return {
        id: request.id,
        entityType: "leave_request" as const,
        title: `${request.leaveTypeName} - ${request.requestNumber ?? request.id}`,
        employeeId: request.employeeId,
        employeeName: request.employeeName,
        unitKerja: request.unitKerja,
        status: request.status,
        submittedAt: request.submittedAt ?? request.createdAt,
        daysWaiting,
        slaDays,
        overdue: daysWaiting > slaDays,
      };
    });
  const submissionItems = submissions
    .filter((submission) => submission.status === "submitted" || submission.status === "revision_required")
    .map((submission) => {
      const daysWaiting = dayDiffFromNow(submission.createdAt);
      return {
        id: submission.id,
        entityType: "submission" as const,
        title: `${submission.submissionType.toUpperCase()} - ${submission.title}`,
        employeeId: submission.employeeId,
        employeeName: submission.employeeName,
        unitKerja: "",
        status: submission.status,
        submittedAt: submission.createdAt,
        daysWaiting,
        slaDays,
        overdue: daysWaiting > slaDays,
      };
    });
  const attendanceItems = attendancePermissions
    .filter((item) => item.status === "submitted")
    .map((item) => {
      const daysWaiting = dayDiffFromNow(item.createdAt);
      return {
        id: item.id,
        entityType: "attendance_permission" as const,
        title: item.permissionType === "late_arrival" ? "Izin Lambat Datang" : "Izin Cepat Pulang",
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        unitKerja: "",
        status: item.status,
        submittedAt: item.createdAt,
        daysWaiting,
        slaDays,
        overdue: daysWaiting > slaDays,
      };
    });

  return [...leaveItems, ...submissionItems, ...attendanceItems]
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.daysWaiting - a.daysWaiting)
    .slice(0, 200);
}

function normalizeWhatsappNumber(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

function renderTemplateBody(template: string, values: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = values[key];
    return value === undefined || value === null || value === "" ? "-" : String(value);
  });
}

async function getNotificationTemplateByKey(db: AletaDatabase, templateKey: string) {
  const row = await db.prepare(
    `SELECT id, template_key, name, audience, event_type, channel, body, is_active, updated_at
     FROM hr_notification_templates
     WHERE template_key = ?
     LIMIT 1`
  ).get<HrNotificationTemplateRow>(templateKey);
  return row && booleanFromDb(row.is_active) ? mapNotificationTemplate(row) : null;
}

async function queueHrWhatsappNotification(
  db: AletaDatabase,
  {
    templateKey,
    sourceFeature,
    entityType,
    entityId,
    recipient,
    values,
    eventType,
    priority = 4,
  }: {
    templateKey: string;
    sourceFeature: string;
    entityType: string;
    entityId: string;
    recipient: EmployeeProfileDto | null | undefined;
    values: Record<string, unknown>;
    eventType?: string;
    priority?: number;
  }
) {
  if (!recipient) return;
  const recipientNumber = normalizeWhatsappNumber(recipient.phone);
  if (!recipientNumber) return;
  const template = await getNotificationTemplateByKey(db, templateKey);
  if (!template) return;

  const message = renderTemplateBody(template.body, {
    ...values,
    nama_penerima: recipient.fullName,
  });

  try {
    await sendPortalWhatsappMessage({
      sourceApp: "e_kepegawaian",
      sourceFeature,
      entityType,
      entityId,
      eventType: eventType ?? template.eventType,
      recipientNumber,
      recipientName: recipient.fullName,
      message,
      category: "employee",
      priority,
      metadata: {
        sourceApp: "e_kepegawaian",
        sourceFeature,
        entityType,
        entityId,
        recipientType: "employee",
        recipientPosition: recipient.positionName,
        recipientRole: recipient.positionId,
        templateKey,
      },
    });
  } catch (error) {
    console.warn("[ALETA HR WA] Gagal mengantrekan notifikasi E-Kepegawaian:", error);
  }
}

function buildLeaveTemplateValues(request: LeaveRequestDto, employee: EmployeeProfileDto, leaveType: LeaveTypeDto, note = "") {
  return {
    nama_pegawai: employee.fullName,
    jenis_cuti: leaveType.name,
    tanggal_mulai: request.startDate,
    tanggal_selesai: request.endDate,
    jumlah_hari: request.totalDays,
    nomor_permohonan: request.requestNumber ?? request.id,
    catatan: note || "-",
  };
}

function selectHrAdminRecipients(employees: EmployeeProfileDto[]) {
  const preferred = employees.filter((employee) => employee.positionId && HR_ADMIN_POSITION_IDS.has(employee.positionId));
  return preferred.length ? preferred : employees.filter((employee) =>
    ["ketua", "wakil", "sekretaris", "panitera", "kasubag"].some((keyword) =>
      employee.positionName.toLowerCase().includes(keyword)
    )
  );
}

const SIGNATURE_ROLE_LABELS: Record<string, string> = {
  employee: "Pegawai / Pemohon",
  supervisor: "Atasan Langsung",
  authorized_officer: "Pejabat Berwenang",
  chairperson: "Ketua",
  vice_chairperson: "Wakil Ketua",
  secretary: "Sekretaris",
  registrar: "Panitera",
  hr_officer: "Kasubag Kepegawaian dan Ortala",
};

const APPROVAL_WORKFLOW_STEP_LABELS: Record<string, string> = {
  supervisor: "Atasan Langsung",
  hr_officer: "Kasubag Kepegawaian dan Ortala",
  secretary: "Sekretaris",
  registrar: "Panitera",
  chairperson: "Ketua",
  vice_chairperson: "Wakil Ketua",
  authorized_officer: "Pejabat Berwenang",
};

const WORKFLOW_ROLE_KEYWORDS: Record<string, string[]> = {
  hr_officer: ["kepegawaian", "ortala", "analis kepegawaian", "penata layanan kepegawaian"],
  secretary: ["sekretaris"],
  registrar: ["panitera"],
  chairperson: ["ketua"],
  vice_chairperson: ["wakil ketua"],
  authorized_officer: ["ketua", "wakil ketua", "sekretaris", "panitera"],
};

function normalizeSignatureRole(value: unknown) {
  const raw = String(value ?? "employee").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return SIGNATURE_ROLE_LABELS[raw] ? raw : "employee";
}

function normalizeApprovalWorkflow(value: unknown) {
  const raw = Array.isArray(value)
    ? value.map(String)
    : String(value ?? "").split(",");
  const steps = raw
    .map((item) => item.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_"))
    .filter((item) => APPROVAL_WORKFLOW_STEP_LABELS[item]);
  return Array.from(new Set(steps)).length ? Array.from(new Set(steps)) : ["supervisor", "authorized_officer"];
}

function statusForWorkflowStep(step: string): HrLeaveStatus {
  return step === "supervisor" ? "waiting_supervisor_approval" : "waiting_authorized_officer_approval";
}

function currentWorkflowStep(leaveType: LeaveTypeDto, request: LeaveRequestDto) {
  const workflow = normalizeApprovalWorkflow(leaveType.approvalWorkflow);
  const index = Math.max(0, Math.min(workflow.length - 1, (request.currentApprovalLevel || 1) - 1));
  return workflow[index] ?? "authorized_officer";
}

function employeeMatchesWorkflowStep(actorEmployee: EmployeeProfileDto, step: string) {
  if (step === "hr_officer" && actorEmployee.positionId && HR_ADMIN_POSITION_IDS.has(actorEmployee.positionId)) return true;
  const haystack = `${actorEmployee.positionName} ${actorEmployee.unitKerja}`.toLowerCase();
  return (WORKFLOW_ROLE_KEYWORDS[step] ?? []).some((keyword) => haystack.includes(keyword));
}

function resolveWorkflowApprover(employees: EmployeeProfileDto[], employee: EmployeeProfileDto, step: string) {
  if (step === "supervisor") {
    return employees.find((item) => item.id === employee.supervisorEmployeeId) ?? null;
  }
  if (step === "authorized_officer") {
    return employees.find((item) => item.id === employee.approvalOfficerEmployeeId) ??
      employees.find((item) => employeeMatchesWorkflowStep(item, step)) ?? null;
  }
  return employees.find((item) => employeeMatchesWorkflowStep(item, step)) ??
    employees.find((item) => item.id === employee.approvalOfficerEmployeeId) ?? null;
}

export async function getEKepegawaianDashboard(
  db: AletaDatabase,
  actor: UserPersona,
  requestMeta?: RequestMeta
): Promise<HrDashboardDto> {
  await ensureEKepegawaianDefaults(db, actor.id);

  let settings = await getHrSettings(db);
  await maybeRunAnnualDocumentReminderScheduler(db, actor, settings);
  settings = await getHrSettings(db);
  const allEmployees = await listEmployees(db);
  const currentEmployee = allEmployees.find((employee) => employee.userId === actor.id) ?? null;
  const canConfigure = isHrConfigAdmin(actor);
  const canManageAll = canMonitorAllEmployees(actor);
  const canManageSignatures = canConfigure || isHrManager(actor);
  const canApprove = isPotentialApprover(actor) || allEmployees.some((employee) => employee.supervisorEmployeeId === currentEmployee?.id);
  const roleView: HrPermissionFlags["roleView"] = canConfigure ? "admin" : canApprove ? "approver" : "employee";

  const employees = canManageAll
    ? allEmployees
    : allEmployees.filter((employee) => filterEmployeeScope(allEmployees, employee.id, currentEmployee, false));

  const leaveTypes = await listLeaveTypes(db);
  const leaveBalances = await listBalances(db, employees, actor.id);
  const allLeaveRequests = await listLeaveRequests(db);
  const leaveRequests = allLeaveRequests.filter((item) => filterEmployeeScope(allEmployees, item.employeeId, currentEmployee, canManageAll));
  const approvalLogs = (await listApprovalLogs(db)).filter((log) => leaveRequests.some((request) => request.id === log.leaveRequestId));
  const allSubmissions = await listSubmissions(db);
  const submissions = allSubmissions.filter((item) => filterEmployeeScope(allEmployees, item.employeeId, currentEmployee, canManageAll));
  const allAttendance = await listAttendancePermissions(db);
  const attendancePermissions = allAttendance.filter((item) => filterEmployeeScope(allEmployees, item.employeeId, currentEmployee, canManageAll));
  const allDocuments = await listDocuments(db);
  const employeeDocuments = allDocuments.filter((item) => filterEmployeeScope(allEmployees, item.employeeId, currentEmployee, canManageAll));
  const allAttachments = await listAttachments(db);
  const attachments = allAttachments.filter((item) => !item.employeeId || filterEmployeeScope(allEmployees, item.employeeId, currentEmployee, canManageAll));
  const meetingResults = await listMeetings(db);
  const allBalanceTransactions = await listBalanceTransactions(db);
  const balanceTransactions = allBalanceTransactions.filter((item) => filterEmployeeScope(allEmployees, item.employeeId, currentEmployee, canManageAll));
  const allSignatures = await listEmployeeSignatures(db);
  const employeeSignatures = allSignatures.filter((item) => filterEmployeeScope(allEmployees, item.employeeId, currentEmployee, canManageAll));
  const documentRequirements = await listDocumentRequirements(db, employees);
  const notificationTemplates = canConfigure ? await listNotificationTemplates(db) : [];
  const generatedDocuments = (await listGeneratedDocuments(db))
    .filter((item) => leaveRequests.some((request) => request.id === item.leaveRequestId));
  const calendarItems = buildCalendarItems(leaveRequests, await listHolidays(db));
  const slaItems = buildSlaItems(leaveRequests, submissions, attendancePermissions, settings.approvalSlaDays);
  const holidayCount = Number((await db.prepare(`SELECT COUNT(*) AS count FROM hr_holidays`).get<{ count: number | string }>())
    ?.count ?? 0);

  const leaveStatistics = buildLeaveStatistics(employees, leaveRequests, leaveTypes);
  const metrics = {
    totalEmployees: employees.length,
    totalLeaveRequests: leaveRequests.length,
    waitingApproval: leaveRequests.filter((request) => isPendingLeaveStatus(request.status)).length,
    approved: leaveRequests.filter((request) => request.status === "approved").length,
    rejected: leaveRequests.filter((request) => request.status === "rejected").length,
    employeesOnLeave: leaveStatistics.today.approvedLeaveEmployees,
    submissionsWaitingVerification: submissions.filter((submission) => submission.status === "submitted").length,
    attendanceWaitingApproval: attendancePermissions.filter((item) => item.status === "submitted").length,
    holidayCount,
    slaOverdue: slaItems.filter((item) => item.overdue).length,
    missingAnnualDocuments: documentRequirements.reduce((total, item) => total + item.missingCount, 0),
    signatureCount: employeeSignatures.length,
  };

  await appendHrAudit(db, actor, "OPEN_E_KEPEGAWAIAN", "e_kepegawaian", actor.id, { request: requestMeta });

  return {
    currentEmployee,
    permissions: {
      canManageAll,
      canManageSettings: canConfigure,
      canManageSignatures,
      canApprove,
      roleView,
    },
    settings,
    metrics,
    leaveStatistics,
    employees,
    leaveTypes,
    leaveBalances,
    leaveRequests,
    approvalLogs,
    submissions,
    attendancePermissions,
    meetingResults,
    employeeDocuments,
    attachments,
    calendarItems,
    slaItems,
    balanceTransactions,
    employeeSignatures,
    documentRequirements,
    notificationTemplates,
    generatedDocuments,
  };
}

export async function calculateLeaveDays(
  db: AletaDatabase,
  startDate: string,
  endDate: string,
  calculationType: HrSettingsDto["calculationType"]
) {
  if (!startDate || !endDate) {
    throw new ApiError(400, "Tanggal mulai dan tanggal selesai wajib diisi.");
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ApiError(400, "Format tanggal cuti tidak valid.");
  }

  if (end < start) {
    throw new ApiError(400, "Tanggal selesai tidak boleh sebelum tanggal mulai.");
  }

  const holidays = await db.prepare(
    `SELECT date, is_working_day FROM hr_holidays WHERE date >= ? AND date <= ?`
  ).all<{ date: string; is_working_day: number | boolean }>(startDate, endDate);
  const holidayMap = new Map(holidays.map((holiday) => [holiday.date, booleanFromDb(holiday.is_working_day)]));
  let total = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    const isoDate = cursor.toISOString().slice(0, 10);
    const day = cursor.getUTCDay();
    const weekend = day === 0 || day === 6;
    const configuredWorkingDay = holidayMap.get(isoDate);
    const isWorkday = configuredWorkingDay ?? !weekend;

    if (calculationType === "calendar_days" || isWorkday) {
      total += 1;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (total <= 0) {
    throw new ApiError(400, "Lama cuti bernilai 0 hari. Periksa tanggal atau kalender kerja.");
  }

  return total;
}

async function getLeaveType(db: AletaDatabase, leaveTypeId: string) {
  const row = await db.prepare(
    `SELECT id, name, code, description, approval_workflow_json, deducts_annual_balance, requires_attachment,
      max_days, min_days_before_request, is_active, sort_order
     FROM hr_leave_types WHERE id = ?`
  ).get<LeaveTypeRow>(leaveTypeId);

  if (!row) {
    throw new ApiError(404, "Jenis cuti tidak ditemukan.");
  }

  return mapLeaveType(row);
}

async function getEmployeeById(db: AletaDatabase, employeeId: string) {
  const rows = await listEmployees(db);
  const employee = rows.find((item) => item.id === employeeId) ?? null;
  if (!employee) throw new ApiError(404, "Profil pegawai tidak ditemukan.");
  return employee;
}

async function getActorEmployee(db: AletaDatabase, actor: UserPersona) {
  const rows = await listEmployees(db);
  return rows.find((item) => item.userId === actor.id) ?? null;
}

type PublicStoredFile = {
  fileName: string;
  originalFileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
};

function normalizePublicFormType(value: string): HrPublicFormType {
  const normalized = value.trim().toLowerCase();
  if (PUBLIC_FORM_TYPES.has(normalized as HrPublicFormType)) return normalized as HrPublicFormType;
  throw new ApiError(404, "Form publik E-Kepegawaian tidak ditemukan.");
}

function normalizePublicVerifier(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9@.+_-]/g, "");
}

function hashPublicValue(value: string) {
  return createHash("sha256").update(normalizePublicVerifier(value)).digest("hex");
}

function maskPublicValue(value: string) {
  const normalized = value.trim();
  if (!normalized) return "";
  if (normalized.length <= 4) return "*".repeat(normalized.length);
  return `${"*".repeat(Math.max(4, normalized.length - 4))}${normalized.slice(-4)}`;
}

function buildPublicValidationHashes(values: string[]) {
  return Array.from(new Set(values.map(normalizePublicVerifier).filter(Boolean).map(hashPublicValue)));
}

async function generatePublicTicketCode(db: AletaDatabase) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `EKP-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const existing = await db.prepare(`SELECT id FROM hr_public_submissions WHERE ticket_code = ?`).get<{ id: string }>(code);
    if (!existing) return code;
  }
  throw new ApiError(500, "Kode tiket belum dapat dibuat. Coba ulangi beberapa saat lagi.");
}

async function findEmployeeByPublicIdentifier(db: AletaDatabase, identifier: string) {
  const normalized = normalizePublicVerifier(identifier);
  if (!normalized) throw new ApiError(400, "NIP/NIK atau nomor pegawai wajib diisi.");
  const digits = normalized.replace(/\D/g, "");
  const rows = await listEmployees(db);
  const employee = rows.find((item) => {
    const nip = normalizePublicVerifier(item.nip);
    const employeeNumber = normalizePublicVerifier(item.employeeNumber);
    const phone = normalizePublicVerifier(item.phone).replace(/\D/g, "");
    return nip === normalized || employeeNumber === normalized || (digits.length >= 6 && phone === digits);
  });

  if (!employee || !employee.isActive) {
    throw new ApiError(400, "Data pegawai belum dapat dicocokkan. Pastikan NIP/NIK terdaftar atau gunakan mode login.");
  }

  return employee;
}

function normalizePublicPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

function normalizePublicName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function publicEmployeeIdentifier(employee: EmployeeProfileDto) {
  return employee.employeeNumber || employee.nip;
}

type PublicEmployeeMatchResult = {
  matches: EmployeeProfileDto[];
  suggestions: EmployeeProfileDto[];
  message: string;
};

const PUBLIC_LOOKUP_SUGGESTION_LIMIT = 8;
const PUBLIC_LOOKUP_TOKEN_TTL_MS = 10 * 60 * 1000;

function publicLookupSecret() {
  return process.env.BETTER_AUTH_SECRET || "aleta-public-employee-lookup-local-secret";
}

function signPublicEmployeeToken(employeeId: string, expiresAt: number) {
  return createHmac("sha256", publicLookupSecret()).update(`${employeeId}.${expiresAt}`).digest("base64url");
}

function createPublicEmployeeSelectionToken(employee: EmployeeProfileDto) {
  const expiresAt = Date.now() + PUBLIC_LOOKUP_TOKEN_TTL_MS;
  return `${employee.id}.${expiresAt}.${signPublicEmployeeToken(employee.id, expiresAt)}`;
}

function verifyPublicEmployeeSelectionToken(token: string) {
  const [employeeId, expiresRaw, signature] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!employeeId || !expiresAt || !signature || expiresAt < Date.now()) {
    throw new ApiError(400, "Pilihan pegawai sudah kedaluwarsa. Ketik ulang data pegawai.");
  }

  const expected = signPublicEmployeeToken(employeeId, expiresAt);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    throw new ApiError(400, "Pilihan pegawai tidak valid. Ketik ulang data pegawai.");
  }

  return employeeId;
}

function uniquePublicEmployeeSuggestions(employees: EmployeeProfileDto[]) {
  const seen = new Set<string>();
  const suggestions: EmployeeProfileDto[] = [];
  for (const employee of employees) {
    if (seen.has(employee.id)) continue;
    seen.add(employee.id);
    suggestions.push(employee);
    if (suggestions.length >= PUBLIC_LOOKUP_SUGGESTION_LIMIT) break;
  }
  return suggestions;
}

function publicEmployeeSuggestion(employee: EmployeeProfileDto): HrPublicEmployeeLookupSuggestionDto {
  const identifier = publicEmployeeIdentifier(employee);
  return {
    selectionToken: createPublicEmployeeSelectionToken(employee),
    name: employee.fullName,
    positionName: employee.positionName,
    unitKerja: employee.unitKerja,
    identifierMasked: maskPublicValue(identifier),
    contactMasked: maskPublicValue(employee.phone),
  };
}

function buildPublicEmployeeMatches(employees: EmployeeProfileDto[], payload: Record<string, unknown>): PublicEmployeeMatchResult {
  const field = stringValue(payload, "field") as "identifier" | "name" | "contact" | "";
  const explicitValue = stringValue(payload, "value");
  const identifier = stringValue(payload, "identifier");
  const name = stringValue(payload, "name");
  const contact = stringValue(payload, "contact");
  const activeEmployees = employees.filter((employee) => employee.isActive);

  if (field === "contact" || (!field && contact)) {
    const phone = normalizePublicPhone(explicitValue || contact);
    if (phone.length < 6) return { matches: [], suggestions: [], message: "Nomor HP minimal 6 digit untuk pencocokan." };
    const exact = activeEmployees.filter((employee) => normalizePublicPhone(employee.phone) === phone);
    if (exact.length > 0) return { matches: exact, suggestions: uniquePublicEmployeeSuggestions(exact), message: "" };
    return {
      matches: [],
      suggestions: uniquePublicEmployeeSuggestions(
        activeEmployees.filter((employee) => {
          const employeePhone = normalizePublicPhone(employee.phone);
          return employeePhone.includes(phone) || employeePhone.endsWith(phone);
        })
      ),
      message: "",
    };
  }

  if (field === "name" || (!field && name)) {
    const normalizedName = normalizePublicName(explicitValue || name);
    if (normalizedName.length < 4) return { matches: [], suggestions: [], message: "Nama minimal 4 karakter untuk pencocokan." };
    const exact = activeEmployees.filter((employee) => normalizePublicName(employee.fullName) === normalizedName);
    if (exact.length > 0) return { matches: exact, suggestions: uniquePublicEmployeeSuggestions(exact), message: "" };
    const partial = activeEmployees.filter((employee) => normalizePublicName(employee.fullName).includes(normalizedName));
    return {
      matches: [],
      suggestions: uniquePublicEmployeeSuggestions(partial),
      message: "",
    };
  }

  const normalizedIdentifier = normalizePublicVerifier(explicitValue || identifier);
  if (!normalizedIdentifier || normalizedIdentifier.length < 4) {
    return { matches: [], suggestions: [], message: "Isi NIP/NIK/nomor pegawai, nama, atau nomor HP untuk mencocokkan data." };
  }

  const exact = activeEmployees.filter((employee) => {
    const nip = normalizePublicVerifier(employee.nip);
    const employeeNumber = normalizePublicVerifier(employee.employeeNumber);
    return nip === normalizedIdentifier || employeeNumber === normalizedIdentifier;
  });
  if (exact.length > 0) return { matches: exact, suggestions: uniquePublicEmployeeSuggestions(exact), message: "" };

  return {
    matches: [],
    suggestions: uniquePublicEmployeeSuggestions(
      activeEmployees.filter((employee) => {
        const nip = normalizePublicVerifier(employee.nip);
        const employeeNumber = normalizePublicVerifier(employee.employeeNumber);
        return nip.includes(normalizedIdentifier) || employeeNumber.includes(normalizedIdentifier);
      })
    ),
    message: "",
  };
}

function orderedBalanceSources(settings: HrSettingsDto) {
  const fallback: Array<"N" | "N-1" | "N-2"> = ["N-2", "N-1", "N"];
  const configured = settings.balanceUsageOrder
    .filter((source): source is "N" | "N-1" | "N-2" => source === "N" || source === "N-1" || source === "N-2");
  return Array.from(new Set([...configured, ...fallback]));
}

function buildPublicBalanceBuckets(
  balance: LeaveBalanceDto,
  settings: HrSettingsDto,
  requestedDays = 0
): HrPublicLeaveBalanceBucketDto[] {
  const sources: Array<"N" | "N-1" | "N-2"> = ["N", "N-1", "N-2"];
  const labels: Record<"N" | "N-1" | "N-2", string> = {
    N: "Tahun berjalan (N)",
    "N-1": "Sisa tahun lalu (N-1)",
    "N-2": "Sisa dua tahun lalu (N-2)",
  };
  const initial: Record<"N" | "N-1" | "N-2", number> = {
    N: balance.balanceN,
    "N-1": balance.balanceN1,
    "N-2": balance.balanceN2,
  };
  const available = { ...initial };
  let consumed = Math.max(0, balance.usedDays + balance.pendingDays);

  for (const source of orderedBalanceSources(settings)) {
    if (consumed <= 0) break;
    const used = Math.min(available[source], consumed);
    available[source] = Math.max(0, available[source] - used);
    consumed -= used;
  }

  const after = { ...available };
  let requested = Math.max(0, requestedDays);
  for (const source of orderedBalanceSources(settings)) {
    if (requested <= 0) break;
    const used = Math.min(after[source], requested);
    after[source] = Math.max(0, after[source] - used);
    requested -= used;
  }

  return sources.map((source) => ({
    source,
    label: labels[source],
    initialDays: initial[source],
    availableDays: available[source],
    afterRequestDays: after[source],
  }));
}

async function buildPublicLeaveCalendarDays(
  db: AletaDatabase,
  startDate: string,
  endDate: string,
  calculationType: HrSettingsDto["calculationType"]
): Promise<HrPublicLeaveCalendarDayDto[]> {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ApiError(400, "Format tanggal cuti tidak valid.");
  }

  if (end < start) {
    throw new ApiError(400, "Tanggal selesai tidak boleh sebelum tanggal mulai.");
  }

  const holidays = await db.prepare(
    `SELECT date, name, type, is_working_day FROM hr_holidays WHERE date >= ? AND date <= ?`
  ).all<{ date: string; name: string; type: string; is_working_day: number | boolean }>(startDate, endDate);
  const holidayMap = new Map(holidays.map((holiday) => [holiday.date, holiday]));
  const days: HrPublicLeaveCalendarDayDto[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const isoDate = cursor.toISOString().slice(0, 10);
    const day = cursor.getUTCDay();
    const weekend = day === 0 || day === 6;
    const holiday = holidayMap.get(isoDate);
    const isWorkingDay = holiday ? booleanFromDb(holiday.is_working_day) : !weekend;
    const counted = calculationType === "calendar_days" || isWorkingDay;

    days.push({
      date: isoDate,
      dayName: new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" }).format(cursor),
      label: holiday?.name || (weekend ? "Akhir pekan" : "Hari kerja"),
      type: holiday?.type || (weekend ? "weekend" : "working_day"),
      isWeekend: weekend,
      isHoliday: Boolean(holiday && !isWorkingDay),
      isWorkingDay,
      counted,
    });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

async function buildPublicLeavePreview(
  db: AletaDatabase,
  payload: Record<string, unknown>,
  balance: LeaveBalanceDto,
  settings: HrSettingsDto,
  employee: EmployeeProfileDto
): Promise<HrPublicLeavePreviewDto | null> {
  const leaveTypeId = stringValue(payload, "leaveTypeId");
  const startDate = stringValue(payload, "startDate");
  const endDate = stringValue(payload, "endDate");
  if (!leaveTypeId || !startDate || !endDate) return null;

  const leaveType = await getLeaveType(db, leaveTypeId);
  const calendarDays = await buildPublicLeaveCalendarDays(db, startDate, endDate, settings.calculationType);
  const totalDays = calendarDays.filter((day) => day.counted).length;
  const requestedDays = leaveType.deductsAnnualBalance ? totalDays : 0;
  const [allEmployees, allLeaveRequests] = await Promise.all([listEmployees(db), listLeaveRequests(db)]);
  const dailyImpacts = calendarDays.map((day) => (
    buildLeaveDailyImpact(allEmployees, allLeaveRequests, day.date, day.counted ? employee.id : null)
  ));
  const warnings: string[] = [];

  if (totalDays <= 0) warnings.push("Rentang tanggal tidak memiliki hari yang dihitung sebagai cuti.");
  if (leaveType.maxDays && totalDays > leaveType.maxDays) warnings.push(`Maksimal ${leaveType.name} adalah ${leaveType.maxDays} hari.`);
  if (leaveType.minDaysBeforeRequest && dayDiffToNow(startDate) < leaveType.minDaysBeforeRequest) {
    warnings.push(`Pengajuan ${leaveType.name} sebaiknya minimal ${leaveType.minDaysBeforeRequest} hari sebelum tanggal mulai.`);
  }
  if (leaveType.requiresAttachment) warnings.push("Jenis cuti ini membutuhkan lampiran pendukung.");
  if (leaveType.code === "CSKH" && !isJudicialStateOfficialEmployee(employee)) {
    warnings.push("Cuti Sakit Khusus Hakim hanya untuk Ketua, Wakil Ketua, atau Hakim sebagai Pejabat Negara.");
  }
  if (leaveType.deductsAnnualBalance && balance.availableDays < totalDays) {
    warnings.push(`Saldo cuti tidak cukup. Tersedia ${balance.availableDays} hari, dimohon ${totalDays} hari.`);
  }

  return {
    startDate,
    endDate,
    calculationType: settings.calculationType,
    totalDays,
    leaveTypeId: leaveType.id,
    leaveTypeName: leaveType.name,
    deductsAnnualBalance: leaveType.deductsAnnualBalance,
    requiresAttachment: leaveType.requiresAttachment,
    enoughBalance: !leaveType.deductsAnnualBalance || balance.availableDays >= totalDays,
    availableDays: balance.availableDays,
    requestedDays,
    buckets: buildPublicBalanceBuckets(balance, settings, requestedDays),
    calendarDays,
    dailyImpacts,
    maxSimulatedLeavePercentage: Math.max(0, ...dailyImpacts.map((item) => item.simulatedLeavePercentage)),
    warnings,
  };
}

export async function lookupPublicEKepegawaianEmployee(
  db: AletaDatabase,
  rawPayload: unknown
): Promise<HrPublicEmployeeLookupDto> {
  await ensureEKepegawaianDefaults(db, null);
  const settings = await getHrSettings(db);
  const payload = asRecord(rawPayload);
  const selectionToken = stringValue(payload, "selectionToken");
  const allEmployees = await listEmployees(db);
  const selectedEmployee = selectionToken
    ? allEmployees.find((employee) => employee.id === verifyPublicEmployeeSelectionToken(selectionToken)) ?? null
    : null;
  const { matches, suggestions, message } = selectedEmployee
    ? { matches: [selectedEmployee], suggestions: [selectedEmployee], message: "" }
    : buildPublicEmployeeMatches(allEmployees, payload);
  const suggestionDtos = suggestions.map(publicEmployeeSuggestion);

  if (matches.length === 0) {
    return {
      matched: false,
      ambiguous: false,
      message: message || (suggestions.length > 0 ? "Pilih pegawai yang sesuai dari daftar." : "Data pegawai belum ditemukan. Periksa NIP/NIK, nama, atau nomor HP."),
      suggestions: suggestionDtos,
      employee: null,
      balance: null,
      leavePreview: null,
    };
  }

  if (matches.length > 1) {
    return {
      matched: false,
      ambiguous: true,
      message: "Ditemukan lebih dari satu pegawai. Lengkapi NIP/NIK atau nomor HP agar data tidak tertukar.",
      suggestions: suggestionDtos,
      employee: null,
      balance: null,
      leavePreview: null,
    };
  }

  const employee = matches[0] as EmployeeProfileDto;
  if (!employee.isActive) {
    throw new ApiError(400, "Profil pegawai ini sedang nonaktif.");
  }
  const balance = await ensureBalance(db, employee.id, currentYear(), null);
  const baseBuckets = buildPublicBalanceBuckets(balance, settings, 0);
  const leavePreview = await buildPublicLeavePreview(db, payload, balance, settings, employee);
  const identifier = publicEmployeeIdentifier(employee);

  return {
    matched: true,
    ambiguous: false,
    message: "Data pegawai cocok. Form dan saldo cuti diperbarui otomatis.",
    suggestions: [],
    employee: {
      name: employee.fullName,
      identifier,
      contact: employee.phone,
      positionName: employee.positionName,
      unitKerja: employee.unitKerja,
      employmentStatusLabel: employee.employmentStatusLabel,
      identifierMasked: maskPublicValue(identifier),
      contactMasked: maskPublicValue(employee.phone),
    },
    balance: {
      year: balance.year,
      balanceN: balance.balanceN,
      balanceN1: balance.balanceN1,
      balanceN2: balance.balanceN2,
      usedDays: balance.usedDays,
      pendingDays: balance.pendingDays,
      availableDays: balance.availableDays,
      buckets: baseBuckets,
    },
    leavePreview,
  };
}

function assertPublicFormEnabled(settings: HrSettingsDto, formType: HrPublicFormType) {
  const settingKey = PUBLIC_FORM_SETTING_KEYS[formType];
  if (!settings.publicForms[settingKey]) {
    throw new ApiError(403, "Form publik ini sedang dinonaktifkan oleh admin.");
  }
}

async function insertPublicSubmissionRecord(
  db: AletaDatabase,
  {
    formType,
    entityType,
    entityId,
    employee,
    payload,
    requestMeta,
    metadata,
    status,
  }: {
    formType: HrPublicFormType;
    entityType: "leave_request" | "submission" | "attendance_permission";
    entityId: string;
    employee: EmployeeProfileDto;
    payload: Record<string, unknown>;
    requestMeta?: RequestMeta;
    metadata: Record<string, unknown>;
    status: string;
  }
) {
  const now = new Date().toISOString();
  const ticketCode = await generatePublicTicketCode(db);
  const identifier = stringValue(payload, "identifier", { required: true, label: "NIP/NIK" });
  const contact = stringValue(payload, "contact", { required: true, label: "Nomor HP" });
  const validationHashes = buildPublicValidationHashes([identifier, contact, employee.nip, employee.employeeNumber, employee.phone]);
  await db.prepare(
    `INSERT INTO hr_public_submissions (
      id, ticket_code, form_type, entity_type, entity_id, employee_id,
      applicant_name, applicant_identifier_masked, contact_masked, submitted_ip_hash,
      validation_hashes_json, status, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    await nextPrefixedId(db, "hr_public_submissions", "hps"),
    ticketCode,
    formType,
    entityType,
    entityId,
    employee.id,
    stringValue(payload, "name") || employee.fullName,
    maskPublicValue(identifier),
    maskPublicValue(contact),
    requestMeta?.ipAddress ? hashPublicValue(requestMeta.ipAddress) : "",
    JSON.stringify(validationHashes),
    status,
    JSON.stringify(metadata),
    now,
    now
  );
  return ticketCode;
}

async function attachPublicEKepegawaianFile(
  db: AletaDatabase,
  entityType: "leave_request" | "submission" | "attendance_permission",
  entityId: string,
  file: PublicStoredFile
) {
  const now = new Date().toISOString();
  if (entityType === "leave_request") {
    await db.prepare(
      `INSERT INTO hr_leave_attachments (
        id, leave_request_id, file_name, original_file_name, file_path,
        file_type, file_size, uploaded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`
    ).run(await nextPrefixedId(db, "hr_leave_attachments", "hla"), entityId, file.fileName, file.originalFileName, file.filePath, file.fileType, file.fileSize, now);
    return;
  }

  if (entityType === "submission") {
    await db.prepare(
      `INSERT INTO hr_submission_attachments (
        id, submission_id, file_name, original_file_name, file_path,
        file_type, file_size, uploaded_by, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`
    ).run(await nextPrefixedId(db, "hr_submission_attachments", "hsa"), entityId, file.fileName, file.originalFileName, file.filePath, file.fileType, file.fileSize, now);
    return;
  }

  await db.prepare(
    `INSERT INTO hr_attendance_permission_attachments (
      id, attendance_permission_id, file_name, original_file_name, file_path,
      file_type, file_size, uploaded_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`
  ).run(await nextPrefixedId(db, "hr_attendance_permission_attachments", "haa"), entityId, file.fileName, file.originalFileName, file.filePath, file.fileType, file.fileSize, now);
}

async function submitPublicLeaveRequest(
  db: AletaDatabase,
  employee: EmployeeProfileDto,
  payload: Record<string, unknown>,
  requestMeta?: RequestMeta,
  file?: PublicStoredFile | null
): Promise<HrPublicSubmissionResultDto> {
  const settings = await getHrSettings(db);
  const leaveTypeId = stringValue(payload, "leaveTypeId", { required: true, label: "Jenis cuti" });
  const leaveType = await getLeaveType(db, leaveTypeId);
  assertLeaveTypeAllowedForEmployee(leaveType, employee);
  const startDate = stringValue(payload, "startDate", { required: true, label: "Tanggal mulai" });
  const endDate = stringValue(payload, "endDate", { required: true, label: "Tanggal selesai" });
  const reason = stringValue(payload, "reason", { required: true, label: "Alasan cuti" });
  const addressDuringLeave = stringValue(payload, "addressDuringLeave", { required: true, label: "Alamat selama cuti" });
  const contactDuringLeave = stringValue(payload, "contact", { required: true, label: "Nomor HP" });
  const totalDays = await calculateLeaveDays(db, startDate, endDate, settings.calculationType);

  if (leaveType.maxDays && totalDays > leaveType.maxDays) {
    throw new ApiError(400, `Maksimal ${leaveType.name} adalah ${leaveType.maxDays} hari.`);
  }
  await assertNoLeaveOverlap(db, employee.id, startDate, endDate);

  const workflow = normalizeApprovalWorkflow(leaveType.approvalWorkflow);
  const firstWorkflowStep = workflow[0] === "supervisor" && !employee.supervisorEmployeeId
    ? (workflow[1] ?? "authorized_officer")
    : workflow[0];
  const statusAfter = statusForWorkflowStep(firstWorkflowStep);
  const level = Math.max(1, workflow.indexOf(firstWorkflowStep) + 1);
  const requestNumber = await generateLeaveRequestNumber(db, startDate, settings);
  const now = new Date().toISOString();
  const id = await nextPrefixedId(db, "hr_leave_requests", "hlr");

  await db.prepare(
    `INSERT INTO hr_leave_requests (
      id, employee_id, leave_type_id, request_number, start_date, end_date, total_days,
      calculation_type, reason, address_during_leave, contact_during_leave,
      status, current_approval_level, submitted_at, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`
  ).run(id, employee.id, leaveType.id, requestNumber, startDate, endDate, totalDays, settings.calculationType, reason, addressDuringLeave, contactDuringLeave, statusAfter, level, now, now, now);

  if (leaveType.deductsAnnualBalance) {
    await reserveAnnualBalance(db, employee.id, id, totalDays, null);
  }
  await writeApprovalLog(db, id, null, null, 0, "submit_public", "draft", statusAfter, "Permohonan cuti diterima melalui form publik.");
  if (file) await attachPublicEKepegawaianFile(db, "leave_request", id, file);

  const ticketCode = await insertPublicSubmissionRecord(db, {
    formType: "cuti",
    entityType: "leave_request",
    entityId: id,
    employee,
    payload,
    requestMeta,
    status: statusAfter,
    metadata: { leaveType: leaveType.code, totalDays, requestNumber },
  });
  await appendHrAudit(db, null, "PUBLIC_LEAVE_SUBMISSION", "hr_leave_request", id, { ticketCode, request: requestMeta });

  const approver = resolveWorkflowApprover(await listEmployees(db), employee, firstWorkflowStep);
  await queueHrWhatsappNotification(db, {
    templateKey: "leave_submitted",
    sourceFeature: "hr_public_leave_submitted",
    entityType: "hr_leave_request",
    entityId: id,
    eventType: `${requestNumber}:${statusAfter}`,
    recipient: approver,
    values: buildLeaveTemplateValues({ ...(await getLeaveRequestById(db, id)), requestNumber }, employee, leaveType),
  });

  return {
    ticketCode,
    formType: "cuti",
    formLabel: PUBLIC_FORM_LABELS.cuti,
    entityType: "leave_request",
    entityId: id,
    status: statusAfter,
    submittedAt: now,
    message: settings.publicSuccessMessage,
  };
}

async function submitPublicSubmission(
  db: AletaDatabase,
  formType: Extract<HrPublicFormType, "upload-pck" | "upload-skp" | "wfa">,
  employee: EmployeeProfileDto,
  payload: Record<string, unknown>,
  requestMeta?: RequestMeta,
  file?: PublicStoredFile | null
): Promise<HrPublicSubmissionResultDto> {
  const settings = await getHrSettings(db);
  const submissionType: HrSubmissionType = formType === "upload-pck" ? "pck" : formType === "upload-skp" ? "skp" : "wfa";
  if ((submissionType === "pck" || submissionType === "skp") && !file) {
    throw new ApiError(400, `Lampiran ${submissionType.toUpperCase()} wajib diunggah.`);
  }

  const now = new Date().toISOString();
  const id = await nextPrefixedId(db, "hr_submissions", "hrs");
  const title = stringValue(payload, "title") || `${submissionType.toUpperCase()} ${numberValue(payload, "periodYear", currentYear())}`;
  await db.prepare(
    `INSERT INTO hr_submissions (
      id, employee_id, submission_type, title, period_year, period_month,
      submission_date, description, status, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', NULL, NULL, ?, ?)`
  ).run(
    id,
    employee.id,
    submissionType,
    title,
    numberValue(payload, "periodYear", currentYear()),
    numberValue(payload, "periodMonth", 0) || null,
    stringValue(payload, "submissionDate") || todayIsoDate(),
    stringValue(payload, "description"),
    now,
    now
  );
  if (file) await attachPublicEKepegawaianFile(db, "submission", id, file);

  const ticketCode = await insertPublicSubmissionRecord(db, {
    formType,
    entityType: "submission",
    entityId: id,
    employee,
    payload,
    requestMeta,
    status: "submitted",
    metadata: { submissionType, title },
  });
  await appendHrAudit(db, null, "PUBLIC_HR_SUBMISSION", "hr_submission", id, { ticketCode, submissionType, request: requestMeta });

  const recipients = selectHrAdminRecipients(await listEmployees(db));
  for (const recipient of recipients.slice(0, 8)) {
    await queueHrWhatsappNotification(db, {
      templateKey: "submission_created",
      sourceFeature: "hr_public_submission_created",
      entityType: "hr_submission",
      entityId: id,
      eventType: `${submissionType}:${id}`,
      recipient,
      values: {
        nama_pegawai: employee.fullName,
        jenis_setoran: submissionType.toUpperCase(),
        judul: title,
        periode: `${numberValue(payload, "periodMonth", 0) || "-"} / ${numberValue(payload, "periodYear", currentYear())}`,
      },
    });
  }

  return {
    ticketCode,
    formType,
    formLabel: PUBLIC_FORM_LABELS[formType],
    entityType: "submission",
    entityId: id,
    status: "submitted",
    submittedAt: now,
    message: settings.publicSuccessMessage,
  };
}

async function submitPublicAttendancePermission(
  db: AletaDatabase,
  formType: Extract<HrPublicFormType, "lambat-datang" | "cepat-pulang">,
  employee: EmployeeProfileDto,
  payload: Record<string, unknown>,
  requestMeta?: RequestMeta,
  file?: PublicStoredFile | null
): Promise<HrPublicSubmissionResultDto> {
  const settings = await getHrSettings(db);
  const permissionType: HrAttendancePermissionType = formType === "lambat-datang" ? "late_arrival" : "early_leave";
  const requestDate = stringValue(payload, "requestDate", { required: true, label: "Tanggal" });
  const scheduledTime = stringValue(payload, "scheduledTime", { required: true, label: formType === "lambat-datang" ? "Jam seharusnya datang" : "Jam seharusnya pulang" });
  const actualTime = stringValue(payload, "actualTime", { required: true, label: formType === "lambat-datang" ? "Jam datang" : "Jam pulang" });
  const reason = stringValue(payload, "reason", { required: true, label: "Alasan" });
  const now = new Date().toISOString();
  const id = await nextPrefixedId(db, "hr_attendance_permissions", "hap");
  const reasonWithContext = `Jam seharusnya ${scheduledTime}; realisasi ${actualTime}. ${reason}`;

  await db.prepare(
    `INSERT INTO hr_attendance_permissions (
      id, employee_id, permission_type, request_date, requested_time, reason,
      status, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'submitted', NULL, NULL, ?, ?)`
  ).run(id, employee.id, permissionType, requestDate, actualTime, reasonWithContext, now, now);
  if (file) await attachPublicEKepegawaianFile(db, "attendance_permission", id, file);

  const ticketCode = await insertPublicSubmissionRecord(db, {
    formType,
    entityType: "attendance_permission",
    entityId: id,
    employee,
    payload,
    requestMeta,
    status: "submitted",
    metadata: { permissionType, scheduledTime, actualTime },
  });
  await appendHrAudit(db, null, "PUBLIC_ATTENDANCE_PERMISSION", "hr_attendance_permission", id, { ticketCode, permissionType, request: requestMeta });

  return {
    ticketCode,
    formType,
    formLabel: PUBLIC_FORM_LABELS[formType],
    entityType: "attendance_permission",
    entityId: id,
    status: "submitted",
    submittedAt: now,
    message: settings.publicSuccessMessage,
  };
}

export async function getPublicEKepegawaianOptions(db: AletaDatabase): Promise<HrPublicOptionsDto> {
  await ensureEKepegawaianDefaults(db, null);
  const settings = await getHrSettings(db);
  const leaveTypes = (await listLeaveTypes(db))
    .filter((item) => item.isActive)
    .map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      requiresAttachment: item.requiresAttachment,
    }));

  return {
    settings: {
      publicForms: settings.publicForms,
      publicMaxUploadSizeMb: settings.publicMaxUploadSizeMb,
      publicAllowedFileTypes: settings.publicAllowedFileTypes,
      publicRequiresCaptcha: settings.publicRequiresCaptcha,
      publicMode: settings.publicMode,
      publicInstructions: settings.publicInstructions,
      publicSuccessMessage: settings.publicSuccessMessage,
    },
    leaveTypes,
  };
}

export async function submitPublicEKepegawaianForm(
  db: AletaDatabase,
  formTypeValue: string,
  rawPayload: unknown,
  requestMeta?: RequestMeta,
  file?: PublicStoredFile | null
): Promise<HrPublicSubmissionResultDto> {
  await ensureEKepegawaianDefaults(db, null);
  const formType = normalizePublicFormType(formTypeValue);
  const settings = await getHrSettings(db);
  assertPublicFormEnabled(settings, formType);
  const payload = asRecord(rawPayload);
  const employee = await findEmployeeByPublicIdentifier(db, stringValue(payload, "identifier", { required: true, label: "NIP/NIK" }));

  return withTransaction(db, async (tx) => {
    if (formType === "cuti") return submitPublicLeaveRequest(tx, employee, payload, requestMeta, file);
    if (formType === "upload-pck" || formType === "upload-skp" || formType === "wfa") {
      return submitPublicSubmission(tx, formType, employee, payload, requestMeta, file);
    }
    return submitPublicAttendancePermission(tx, formType, employee, payload, requestMeta, file);
  });
}

function publicStatusLabel(status: string) {
  const labels: Record<string, string> = {
    submitted: "Diterima",
    waiting_supervisor_approval: "Menunggu Atasan",
    waiting_authorized_officer_approval: "Menunggu Pejabat",
    approved: "Disetujui",
    verified: "Terverifikasi",
    rejected: "Ditolak",
    revision_required: "Perlu Revisi",
    cancelled: "Dibatalkan",
  };
  return labels[status] ?? status;
}

export async function checkPublicEKepegawaianStatus(
  db: AletaDatabase,
  rawPayload: unknown,
  requestMeta?: RequestMeta
): Promise<HrPublicStatusDto> {
  await ensureEKepegawaianDefaults(db, null);
  const payload = asRecord(rawPayload);
  const ticketCode = stringValue(payload, "ticketCode", { required: true, label: "Kode tiket" }).toUpperCase();
  const verifier = stringValue(payload, "verifier", { required: true, label: "NIP/NIK atau nomor HP" });
  const row = await db.prepare(
    `SELECT id, ticket_code, form_type, entity_type, entity_id, employee_id, applicant_name,
      applicant_identifier_masked, contact_masked, validation_hashes_json, status, metadata_json, created_at, updated_at
     FROM hr_public_submissions
     WHERE ticket_code = ?
     LIMIT 1`
  ).get<HrPublicSubmissionRow>(ticketCode);

  const verifierHash = hashPublicValue(verifier);
  const hashes = safeJsonArray(row?.validation_hashes_json, []);
  if (!row || !hashes.includes(verifierHash)) {
    await appendHrAudit(db, null, "PUBLIC_HR_STATUS_DENIED", "hr_public_submission", ticketCode, { request: requestMeta });
    throw new ApiError(404, "Kode tiket atau data validasi tidak cocok.");
  }

  let status = row.status;
  let note = "";
  if (row.entity_type === "leave_request") {
    const request = (await listLeaveRequests(db)).find((item) => item.id === row.entity_id);
    status = request?.status ?? status;
  } else if (row.entity_type === "submission") {
    const submission = (await listSubmissions(db)).find((item) => item.id === row.entity_id);
    status = submission?.status ?? status;
    note = submission?.verificationNote ?? "";
  } else {
    const attendance = (await listAttendancePermissions(db)).find((item) => item.id === row.entity_id);
    status = attendance?.status ?? status;
    note = attendance?.note ?? "";
  }

  await appendHrAudit(db, null, "PUBLIC_HR_STATUS_CHECK", "hr_public_submission", row.id, { ticketCode, request: requestMeta });
  return {
    ticketCode: row.ticket_code,
    formLabel: PUBLIC_FORM_LABELS[row.form_type] ?? "Pengajuan Publik",
    submittedAt: row.created_at,
    status,
    statusLabel: publicStatusLabel(status),
    note: note || "-",
    nextInstruction: status === "revision_required"
      ? "Silakan login ke ALETA atau hubungi admin kepegawaian untuk melengkapi revisi."
      : "Pantau status berkala atau hubungi admin kepegawaian bila ada kebutuhan mendesak.",
  };
}

export async function listPublicMeetingResults(db: AletaDatabase): Promise<HrPublicMeetingResultDto[]> {
  await ensureEKepegawaianDefaults(db, null);
  const settings = await getHrSettings(db);
  if (!settings.publicForms.hasilRapat) throw new ApiError(403, "Hasil rapat publik sedang dinonaktifkan oleh admin.");
  const rows = await db.prepare(
    `SELECT id, title, meeting_date, location, participants, summary, category, visibility, status, document_public, created_at
     FROM hr_meeting_results
     WHERE visibility = 'public' AND status = 'published'
     ORDER BY meeting_date DESC, created_at DESC
     LIMIT 100`
  ).all<MeetingResultRow>();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    meetingDate: row.meeting_date,
    location: row.location,
    participants: row.participants,
    summary: row.summary,
    category: row.category,
    hasPublicAttachment: booleanFromDb(row.document_public),
    createdAt: row.created_at,
  }));
}

export async function getPublicMeetingResult(db: AletaDatabase, id: string): Promise<HrPublicMeetingResultDto> {
  const meeting = (await listPublicMeetingResults(db)).find((item) => item.id === id);
  if (!meeting) throw new ApiError(404, "Hasil rapat publik tidak ditemukan.");
  return meeting;
}

async function resolveTargetEmployee(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>) {
  const actorEmployee = await getActorEmployee(db, actor);
  const requestedEmployeeId = stringValue(payload, "employeeId");

  if (requestedEmployeeId && isHrManager(actor)) {
    return getEmployeeById(db, requestedEmployeeId);
  }

  if (!actorEmployee) {
    throw new ApiError(403, "Akun Anda belum terhubung dengan profil pegawai. Hubungi admin kepegawaian.");
  }

  return actorEmployee;
}

async function assertCanAccessEmployee(db: AletaDatabase, actor: UserPersona, employeeId: string) {
  if (isHrManager(actor)) return;

  const employees = await listEmployees(db);
  const actorEmployee = employees.find((item) => item.userId === actor.id) ?? null;
  if (!filterEmployeeScope(employees, employeeId, actorEmployee, false)) {
    throw new ApiError(403, "Anda tidak memiliki akses ke data pegawai tersebut.");
  }
}

async function assertNoLeaveOverlap(
  db: AletaDatabase,
  employeeId: string,
  startDate: string,
  endDate: string,
  ignoreId?: string | null
) {
  const params = [employeeId, startDate, endDate];
  const ignoreClause = ignoreId ? "AND id <> ?" : "";
  if (ignoreId) params.push(ignoreId);

  const overlap = await db.prepare(
    `SELECT id FROM hr_leave_requests
     WHERE employee_id = ?
       AND deleted_at IS NULL
       AND status IN ('submitted', 'waiting_supervisor_approval', 'waiting_authorized_officer_approval', 'approved')
       AND NOT (end_date < ? OR start_date > ?)
       ${ignoreClause}
     LIMIT 1`
  ).get<{ id: string }>(...params);

  if (overlap) {
    throw new ApiError(400, "Tanggal cuti bentrok dengan pengajuan lain yang masih aktif.");
  }
}

async function generateLeaveRequestNumber(db: AletaDatabase, startDate: string, settings: HrSettingsDto) {
  const [year, month] = startDate.split("-");
  const uniqueNumber = `${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;

  return settings.requestNumberFormat
    .replace("{TAHUN}", year ?? String(currentYear()))
    .replace("{BULAN}", month ?? String(new Date().getMonth() + 1).padStart(2, "0"))
    .replace("{NOMOR}", uniqueNumber);
}

async function reserveAnnualBalance(
  db: AletaDatabase,
  employeeId: string,
  leaveRequestId: string,
  days: number,
  actor: UserPersona | null
) {
  const year = currentYear();
  const settings = await getHrSettings(db);
  const actorUserId = actor?.id ?? null;
  const balance = await ensureBalance(db, employeeId, year, actorUserId);

  if (balance.availableDays < days) {
    throw new ApiError(400, `Saldo cuti tahunan tidak cukup. Tersedia ${balance.availableDays} hari, dimohon ${days} hari.`);
  }

  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE hr_leave_balances
     SET pending_days = pending_days + ?, remaining_days = GREATEST(0, remaining_days - ?), updated_by = ?, updated_at = ?
     WHERE employee_id = ? AND year = ?`
  ).run(days, days, actorUserId, now, employeeId, year);

  let remaining = days;
  const bucketDays: Record<string, number> = {
    "N": balance.balanceN,
    "N-1": balance.balanceN1,
    "N-2": balance.balanceN2,
  };

  for (const source of settings.balanceUsageOrder) {
    if (remaining <= 0) break;
    const available = Math.max(0, bucketDays[source] ?? 0);
    const used = Math.min(available, remaining);
    if (used <= 0) continue;
    remaining -= used;
    await db.prepare(
      `INSERT INTO hr_leave_balance_transactions (
        id, employee_id, leave_request_id, year, source_year_type, transaction_type,
        days, description, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?, 'reserve', ?, ?, ?, ?)`
    ).run(
      await nextPrefixedId(db, "hr_leave_balance_transactions", "hbt"),
      employeeId,
      leaveRequestId,
      year,
      source,
      used,
      `Reserve saldo cuti untuk ${leaveRequestId}`,
      actorUserId,
      now
    );
  }
}

async function releaseReservedBalance(db: AletaDatabase, request: LeaveRequestDto, actor: UserPersona, reason: string) {
  const leaveType = await getLeaveType(db, request.leaveTypeId);
  if (!leaveType.deductsAnnualBalance || request.totalDays <= 0) return;

  const year = currentYear();
  const now = new Date().toISOString();
  await ensureBalance(db, request.employeeId, year, actor.id);
  await db.prepare(
    `UPDATE hr_leave_balances
     SET pending_days = GREATEST(0, pending_days - ?), remaining_days = remaining_days + ?, updated_by = ?, updated_at = ?
     WHERE employee_id = ? AND year = ?`
  ).run(request.totalDays, request.totalDays, actor.id, now, request.employeeId, year);

  await db.prepare(
    `INSERT INTO hr_leave_balance_transactions (
      id, employee_id, leave_request_id, year, source_year_type, transaction_type,
      days, description, created_by, created_at
    ) VALUES (?, ?, ?, ?, 'mixed', 'release', ?, ?, ?, ?)`
  ).run(
    await nextPrefixedId(db, "hr_leave_balance_transactions", "hbt"),
    request.employeeId,
    request.id,
    year,
    request.totalDays,
    reason,
    actor.id,
    now
  );
}

async function commitReservedBalance(db: AletaDatabase, request: LeaveRequestDto, actor: UserPersona) {
  const leaveType = await getLeaveType(db, request.leaveTypeId);
  if (!leaveType.deductsAnnualBalance || request.totalDays <= 0) return;

  const year = currentYear();
  const now = new Date().toISOString();
  await ensureBalance(db, request.employeeId, year, actor.id);
  await db.prepare(
    `UPDATE hr_leave_balances
     SET pending_days = GREATEST(0, pending_days - ?), used_days = used_days + ?, updated_by = ?, updated_at = ?
     WHERE employee_id = ? AND year = ?`
  ).run(request.totalDays, request.totalDays, actor.id, now, request.employeeId, year);

  await db.prepare(
    `INSERT INTO hr_leave_balance_transactions (
      id, employee_id, leave_request_id, year, source_year_type, transaction_type,
      days, description, created_by, created_at
    ) VALUES (?, ?, ?, ?, 'mixed', 'commit_used', ?, ?, ?, ?)`
  ).run(
    await nextPrefixedId(db, "hr_leave_balance_transactions", "hbt"),
    request.employeeId,
    request.id,
    year,
    request.totalDays,
    `Saldo cuti disetujui final untuk ${request.requestNumber ?? request.id}`,
    actor.id,
    now
  );
}

async function getLeaveRequestById(db: AletaDatabase, id: string) {
  const request = (await listLeaveRequests(db)).find((item) => item.id === id);
  if (!request) throw new ApiError(404, "Permohonan cuti tidak ditemukan.");
  return request;
}

async function writeApprovalLog(
  db: AletaDatabase,
  requestId: string,
  actor: UserPersona | null,
  actorEmployee: EmployeeProfileDto | null,
  approvalLevel: number,
  action: string,
  statusBefore: string,
  statusAfter: string,
  note: string
) {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO hr_leave_approval_logs (
      id, leave_request_id, approver_user_id, approver_employee_id, approval_level,
      action, status_before, status_after, note, acted_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    await nextPrefixedId(db, "hr_leave_approval_logs", "hal"),
    requestId,
    actor?.id ?? null,
    actorEmployee?.id ?? null,
    approvalLevel,
    action,
    statusBefore,
    statusAfter,
    note,
    now,
    now
  );
}

async function saveLeaveDraft(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>,
  submitNow = false
): Promise<LeaveRequestDto> {
  const settings = await getHrSettings(db);
  const employee = await resolveTargetEmployee(db, actor, payload);
  const leaveTypeId = stringValue(payload, "leaveTypeId", { required: true, label: "Jenis cuti" });
  const leaveType = await getLeaveType(db, leaveTypeId);
  assertLeaveTypeAllowedForEmployee(leaveType, employee);
  const startDate = stringValue(payload, "startDate", { required: true, label: "Tanggal mulai" });
  const endDate = stringValue(payload, "endDate", { required: true, label: "Tanggal selesai" });
  const reason = stringValue(payload, "reason", { required: submitNow, label: "Alasan cuti" });
  const addressDuringLeave = stringValue(payload, "addressDuringLeave", { required: submitNow, label: "Alamat selama cuti" });
  const contactDuringLeave = stringValue(payload, "contactDuringLeave", { required: submitNow, label: "Kontak selama cuti" });
  const totalDays = await calculateLeaveDays(db, startDate, endDate, settings.calculationType);

  if (leaveType.maxDays && totalDays > leaveType.maxDays) {
    throw new ApiError(400, `Maksimal ${leaveType.name} adalah ${leaveType.maxDays} hari.`);
  }

  await assertNoLeaveOverlap(db, employee.id, startDate, endDate);

  const id = await nextPrefixedId(db, "hr_leave_requests", "hlr");
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO hr_leave_requests (
      id, employee_id, leave_type_id, start_date, end_date, total_days,
      calculation_type, reason, address_during_leave, contact_during_leave,
      status, current_approval_level, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, ?, ?, ?)`
  ).run(
    id,
    employee.id,
    leaveType.id,
    startDate,
    endDate,
    totalDays,
    settings.calculationType,
    reason,
    addressDuringLeave,
    contactDuringLeave,
    actor.id,
    actor.id,
    now,
    now
  );

  await appendHrAudit(db, actor, "CREATE_LEAVE_DRAFT", "hr_leave_request", id, {
    employeeId: employee.id,
    leaveType: leaveType.code,
    totalDays,
  });

  if (!submitNow) {
    return getLeaveRequestById(db, id);
  }

  return submitLeaveRequest(db, actor, { id });
}

async function submitLeaveRequest(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>
): Promise<LeaveRequestDto> {
  const id = stringValue(payload, "id");
  if (!id) {
    return saveLeaveDraft(db, actor, payload, true);
  }

  const request = await getLeaveRequestById(db, id);
  await assertCanAccessEmployee(db, actor, request.employeeId);

  if (request.status !== "draft" && request.status !== "revision_required") {
    throw new ApiError(400, "Hanya draft atau permohonan revisi yang dapat diajukan.");
  }

  if (!request.reason || !request.addressDuringLeave || !request.contactDuringLeave) {
    throw new ApiError(400, "Alasan, alamat selama cuti, dan kontak selama cuti wajib lengkap sebelum diajukan.");
  }

  await assertNoLeaveOverlap(db, request.employeeId, request.startDate, request.endDate, request.id);

  const settings = await getHrSettings(db);
  const leaveType = await getLeaveType(db, request.leaveTypeId);
  const employee = await getEmployeeById(db, request.employeeId);
  const workflow = normalizeApprovalWorkflow(leaveType.approvalWorkflow);
  const firstWorkflowStep = workflow[0] === "supervisor" && !employee.supervisorEmployeeId
    ? (workflow[1] ?? "authorized_officer")
    : workflow[0];
  const statusAfter = statusForWorkflowStep(firstWorkflowStep);
  const level = Math.max(1, workflow.indexOf(firstWorkflowStep) + 1);
  const requestNumber = request.requestNumber ?? await generateLeaveRequestNumber(db, request.startDate, settings);
  const now = new Date().toISOString();

  if (leaveType.deductsAnnualBalance) {
    await reserveAnnualBalance(db, request.employeeId, request.id, request.totalDays, actor);
  }

  await db.prepare(
    `UPDATE hr_leave_requests
     SET request_number = ?, status = ?, current_approval_level = ?, submitted_at = ?,
       updated_by = ?, updated_at = ?
     WHERE id = ?`
  ).run(requestNumber, statusAfter, level, now, actor.id, now, request.id);

  const actorEmployee = await getActorEmployee(db, actor);
  await writeApprovalLog(db, request.id, actor, actorEmployee, 0, "submit", request.status, statusAfter, "Permohonan cuti diajukan.");
  await appendHrAudit(db, actor, "SUBMIT_LEAVE_REQUEST", "hr_leave_request", request.id, {
    requestNumber,
    statusBefore: request.status,
    statusAfter,
  });

  const approver = resolveWorkflowApprover(await listEmployees(db), employee, firstWorkflowStep);
  await queueHrWhatsappNotification(db, {
    templateKey: "leave_submitted",
    sourceFeature: "hr_leave_submitted",
    entityType: "hr_leave_request",
    entityId: request.id,
    eventType: `${requestNumber}:${statusAfter}`,
    recipient: approver,
    values: buildLeaveTemplateValues({ ...request, requestNumber }, employee, leaveType),
  });

  return getLeaveRequestById(db, request.id);
}

function canActorApproveRequest(
  actor: UserPersona,
  actorEmployee: EmployeeProfileDto | null,
  employee: EmployeeProfileDto,
  request: LeaveRequestDto,
  leaveType: LeaveTypeDto
) {
  if (isHrManager(actor)) return true;
  if (!actorEmployee) return false;
  if (actorEmployee.id === request.employeeId) return false;

  const step = currentWorkflowStep(leaveType, request);
  if (step === "supervisor") {
    return employee.supervisorEmployeeId === actorEmployee.id;
  }

  if (step === "authorized_officer") {
    return employee.approvalOfficerEmployeeId === actorEmployee.id || employeeMatchesWorkflowStep(actorEmployee, step);
  }

  return employeeMatchesWorkflowStep(actorEmployee, step);
}

async function actOnLeaveRequest(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>,
  action: "approve" | "reject" | "request_revision" | "cancel"
) {
  const id = stringValue(payload, "id", { required: true, label: "Permohonan cuti" });
  const note = stringValue(payload, "note");
  const request = await getLeaveRequestById(db, id);
  const actorEmployee = await getActorEmployee(db, actor);
  const employee = await getEmployeeById(db, request.employeeId);
  const leaveType = await getLeaveType(db, request.leaveTypeId);

  if (action === "cancel") {
    if (!isHrManager(actor) && actorEmployee?.id !== request.employeeId) {
      throw new ApiError(403, "Hanya pemohon atau admin yang dapat membatalkan permohonan.");
    }
    if (request.status === "approved" || request.status === "rejected" || request.status === "cancelled") {
      throw new ApiError(400, "Permohonan final tidak dapat dibatalkan dari alur ini.");
    }
  } else if (!canActorApproveRequest(actor, actorEmployee, employee, request, leaveType)) {
    throw new ApiError(403, "Anda bukan approver yang berwenang untuk permohonan ini.");
  }

  let statusAfter: HrLeaveStatus = request.status;
  let levelAfter = request.currentApprovalLevel;
  const now = new Date().toISOString();
  const workflow = normalizeApprovalWorkflow(leaveType.approvalWorkflow);

  if (action === "approve") {
    if (request.status !== "waiting_supervisor_approval" && request.status !== "waiting_authorized_officer_approval") {
      throw new ApiError(400, "Status permohonan belum siap untuk disetujui.");
    }

    const currentIndex = Math.max(0, workflow.indexOf(currentWorkflowStep(leaveType, request)));
    const nextStep = workflow[currentIndex + 1];
    if (nextStep) {
      statusAfter = statusForWorkflowStep(nextStep);
      levelAfter = currentIndex + 2;
    } else {
      statusAfter = "approved";
      levelAfter = 99;
      await commitReservedBalance(db, request, actor);
    }
  }

  if (action === "reject") {
    if (!note) throw new ApiError(400, "Catatan penolakan wajib diisi.");
    statusAfter = "rejected";
    await releaseReservedBalance(db, request, actor, `Saldo dilepas karena ditolak: ${note}`);
  }

  if (action === "request_revision") {
    if (!note) throw new ApiError(400, "Catatan revisi wajib diisi.");
    statusAfter = "revision_required";
    await releaseReservedBalance(db, request, actor, `Saldo dilepas karena perlu revisi: ${note}`);
  }

  if (action === "cancel") {
    statusAfter = "cancelled";
    await releaseReservedBalance(db, request, actor, `Saldo dilepas karena dibatalkan: ${note || "tanpa catatan"}`);
  }

  await db.prepare(
    `UPDATE hr_leave_requests
     SET status = ?, current_approval_level = ?, approved_at = CASE WHEN ? = 'approved' THEN ? ELSE approved_at END,
       rejected_at = CASE WHEN ? = 'rejected' THEN ? ELSE rejected_at END,
       cancelled_at = CASE WHEN ? = 'cancelled' THEN ? ELSE cancelled_at END,
       updated_by = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    statusAfter,
    levelAfter,
    statusAfter,
    now,
    statusAfter,
    now,
    statusAfter,
    now,
    actor.id,
    now,
    request.id
  );

  await writeApprovalLog(db, request.id, actor, actorEmployee, request.currentApprovalLevel, action, request.status, statusAfter, note);
  await appendHrAudit(db, actor, `LEAVE_${action.toUpperCase()}`, "hr_leave_request", request.id, {
    statusBefore: request.status,
    statusAfter,
    note,
  });

  const templateValues = buildLeaveTemplateValues(request, employee, leaveType, note);
  if (statusAfter === "approved") {
    await generateApprovedLeaveDocument(db, actor, request.id);
    await queueHrWhatsappNotification(db, {
      templateKey: "leave_approved",
      sourceFeature: "hr_leave_approved",
      entityType: "hr_leave_request",
      entityId: request.id,
      eventType: `${request.requestNumber ?? request.id}:approved`,
      recipient: employee,
      values: templateValues,
    });
  } else if (statusAfter === "rejected") {
    await queueHrWhatsappNotification(db, {
      templateKey: "leave_rejected",
      sourceFeature: "hr_leave_rejected",
      entityType: "hr_leave_request",
      entityId: request.id,
      eventType: `${request.requestNumber ?? request.id}:rejected`,
      recipient: employee,
      values: templateValues,
    });
  } else if (statusAfter === "revision_required") {
    await queueHrWhatsappNotification(db, {
      templateKey: "leave_revision_required",
      sourceFeature: "hr_leave_revision",
      entityType: "hr_leave_request",
      entityId: request.id,
      eventType: `${request.requestNumber ?? request.id}:revision`,
      recipient: employee,
      values: templateValues,
    });
  } else if (statusAfter === "waiting_authorized_officer_approval" || statusAfter === "waiting_supervisor_approval") {
    const nextStep = workflow[Math.max(0, levelAfter - 1)] ?? "authorized_officer";
    const nextApprover = resolveWorkflowApprover(await listEmployees(db), employee, nextStep);
    await queueHrWhatsappNotification(db, {
      templateKey: "leave_submitted",
      sourceFeature: "hr_leave_forwarded",
      entityType: "hr_leave_request",
      entityId: request.id,
      eventType: `${request.requestNumber ?? request.id}:${nextStep}`,
      recipient: nextApprover,
      values: templateValues,
    });
  }

  return getLeaveRequestById(db, request.id);
}

async function upsertLeaveType(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>) {
  if (!isHrConfigAdmin(actor)) throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat mengatur jenis cuti.");

  const id = stringValue(payload, "id") || await nextPrefixedId(db, "hr_leave_types", "hlt");
  const name = stringValue(payload, "name", { required: true, label: "Nama jenis cuti" });
  const code = stringValue(payload, "code", { required: true, label: "Kode jenis cuti" }).toUpperCase();
  const description = stringValue(payload, "description");
  const deductsAnnualBalance = Boolean(payload.deductsAnnualBalance);
  const requiresAttachment = Boolean(payload.requiresAttachment);
  const maxDays = numberValue(payload, "maxDays", 0) || null;
  const minDaysBeforeRequest = numberValue(payload, "minDaysBeforeRequest", 0) || null;
  const isActive = payload.isActive === undefined ? true : Boolean(payload.isActive);
  const approvalWorkflow = normalizeApprovalWorkflow(payload.approvalWorkflow ?? stringValue(payload, "approvalWorkflow"));
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT INTO hr_leave_types (
      id, name, code, description, approval_workflow_json, deducts_annual_balance, requires_attachment,
      max_days, min_days_before_request, is_active, sort_order, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (code) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      approval_workflow_json = EXCLUDED.approval_workflow_json,
      deducts_annual_balance = EXCLUDED.deducts_annual_balance,
      requires_attachment = EXCLUDED.requires_attachment,
      max_days = EXCLUDED.max_days,
      min_days_before_request = EXCLUDED.min_days_before_request,
      is_active = EXCLUDED.is_active,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at`
  ).run(
    id,
    name,
    code,
    description,
    JSON.stringify(approvalWorkflow),
    deductsAnnualBalance ? 1 : 0,
    requiresAttachment ? 1 : 0,
    maxDays,
    minDaysBeforeRequest,
    isActive ? 1 : 0,
    numberValue(payload, "sortOrder", 100),
    actor.id,
    actor.id,
    now,
    now
  );

  await appendHrAudit(db, actor, "UPSERT_LEAVE_TYPE", "hr_leave_type", id, { code, name });
  return listLeaveTypes(db);
}

async function updateEmployeeProfile(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>) {
  if (!isHrConfigAdmin(actor)) throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat mengubah profil pegawai.");

  const id = stringValue(payload, "id", { required: true, label: "Profil pegawai" });
  const before = await getEmployeeById(db, id);
  const supervisorEmployeeId = stringValue(payload, "supervisorEmployeeId") || null;
  const approvalOfficerEmployeeId = stringValue(payload, "approvalOfficerEmployeeId") || null;
  const requestedEmploymentStatus = normalizeEmploymentStatus(stringValue(payload, "employmentStatus") || before.employmentStatus);
  const nextEmploymentStatus = isJudicialStateOfficialEmployee(before) ? "pejabat_negara" : requestedEmploymentStatus;
  const isActive = payload.isActive === undefined ? before.isActive : Boolean(payload.isActive);
  const now = new Date().toISOString();

  if (supervisorEmployeeId === id || approvalOfficerEmployeeId === id) {
    throw new ApiError(400, "Pegawai tidak dapat menjadi atasan atau pejabat approval untuk dirinya sendiri.");
  }

  await db.prepare(
    `UPDATE employee_profiles
     SET employee_number = ?, unit_kerja = ?, rank_grade = ?, employment_status = ?,
       is_active = ?, supervisor_employee_id = ?, approval_officer_employee_id = ?,
       phone = ?, email = ?, updated_by = ?, updated_at = ?
     WHERE id = ? AND deleted_at IS NULL`
  ).run(
    stringValue(payload, "employeeNumber") || before.employeeNumber,
    stringValue(payload, "unitKerja") || before.unitKerja,
    stringValue(payload, "rankGrade"),
    nextEmploymentStatus,
    isActive ? 1 : 0,
    supervisorEmployeeId,
    approvalOfficerEmployeeId,
    stringValue(payload, "phone") || before.phone,
    stringValue(payload, "email") || before.email,
    actor.id,
    now,
    id
  );

  await appendHrAudit(db, actor, "UPDATE_EMPLOYEE_PROFILE", "employee_profile", id, {
    before,
    after: payload,
  });
  return getEmployeeById(db, id);
}

async function createSubmission(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>) {
  const employee = await resolveTargetEmployee(db, actor, payload);
  const submissionType = stringValue(payload, "submissionType", { required: true, label: "Jenis setoran" }) as HrSubmissionType;
  if (!["pck", "skp", "wfa"].includes(submissionType)) throw new ApiError(400, "Jenis setoran tidak valid.");

  const now = new Date().toISOString();
  const id = await nextPrefixedId(db, "hr_submissions", "hrs");
  await db.prepare(
    `INSERT INTO hr_submissions (
      id, employee_id, submission_type, title, period_year, period_month,
      submission_date, description, status, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?)`
  ).run(
    id,
    employee.id,
    submissionType,
    stringValue(payload, "title", { required: true, label: "Judul setoran" }),
    numberValue(payload, "periodYear", currentYear()),
    numberValue(payload, "periodMonth", 0) || null,
    stringValue(payload, "submissionDate") || todayIsoDate(),
    stringValue(payload, "description"),
    actor.id,
    actor.id,
    now,
    now
  );

  await appendHrAudit(db, actor, "CREATE_HR_SUBMISSION", "hr_submission", id, { submissionType });
  const recipients = selectHrAdminRecipients(await listEmployees(db));
  for (const recipient of recipients.slice(0, 8)) {
    await queueHrWhatsappNotification(db, {
      templateKey: "submission_created",
      sourceFeature: "hr_submission_created",
      entityType: "hr_submission",
      entityId: id,
      eventType: `${submissionType}:${id}`,
      recipient,
      values: {
        nama_pegawai: employee.fullName,
        jenis_setoran: submissionType.toUpperCase(),
        judul: stringValue(payload, "title"),
        periode: `${numberValue(payload, "periodMonth", 0) || "-"} / ${numberValue(payload, "periodYear", currentYear())}`,
      },
    });
  }
  return (await listSubmissions(db)).find((item) => item.id === id) ?? { id };
}

async function verifySubmission(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>,
  status: HrSubmissionStatus
) {
  if (!isHrManager(actor) && !isPotentialApprover(actor)) {
    throw new ApiError(403, "Hanya pejabat berwenang atau admin yang dapat memverifikasi setoran.");
  }

  const id = stringValue(payload, "id", { required: true, label: "Setoran" });
  const note = stringValue(payload, "note");
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE hr_submissions
     SET status = ?, verified_by = ?, verified_at = ?, verification_note = ?, updated_by = ?, updated_at = ?
     WHERE id = ?`
  ).run(status, actor.id, now, note, actor.id, now, id);

  await appendHrAudit(db, actor, "VERIFY_HR_SUBMISSION", "hr_submission", id, { status, note });
  const submission = (await listSubmissions(db)).find((item) => item.id === id);
  const employee = submission ? await getEmployeeById(db, submission.employeeId).catch(() => null) : null;
  if (submission && employee) {
    const templateKey =
      status === "verified"
        ? "submission_verified"
        : status === "rejected"
        ? "submission_rejected"
        : "submission_revision_required";
    await queueHrWhatsappNotification(db, {
      templateKey,
      sourceFeature: status === "verified" ? "hr_submission_verified" : status === "rejected" ? "hr_submission_rejected" : "hr_submission_revision",
      entityType: "hr_submission",
      entityId: id,
      eventType: `${submission.submissionType}:${status}:${id}`,
      recipient: employee,
      values: {
        nama_pegawai: employee.fullName,
        jenis_setoran: submission.submissionType.toUpperCase(),
        judul: submission.title,
        periode: `${submission.periodMonth ?? "-"} / ${submission.periodYear}`,
        catatan: note || "-",
      },
    });
  }
  return listSubmissions(db);
}

const SUBMISSION_ATTACHMENT_STATUSES = new Set<HrSubmissionAttachmentStatus>([
  "pending",
  "verified",
  "rejected",
  "revision_required",
]);

function attachmentStatusLabel(status: HrSubmissionAttachmentStatus) {
  if (status === "verified") return "terverifikasi";
  if (status === "rejected") return "ditolak";
  if (status === "revision_required") return "perlu revisi";
  return "menunggu verifikasi";
}

async function updateParentSubmissionStatusFromAttachments(
  db: AletaDatabase,
  actor: UserPersona,
  submissionId: string,
  note: string
) {
  const rows = await db.prepare(
    `SELECT verification_status
     FROM hr_submission_attachments
     WHERE submission_id = ?`
  ).all<{ verification_status: HrSubmissionAttachmentStatus }>(submissionId);

  if (!rows.length) return;

  const statuses = rows.map((row) => row.verification_status);
  const nextStatus: HrSubmissionStatus =
    statuses.includes("rejected")
      ? "rejected"
      : statuses.includes("revision_required")
      ? "revision_required"
      : statuses.every((status) => status === "verified")
      ? "verified"
      : "submitted";
  const now = new Date().toISOString();
  const summary = note || `Status lampiran: ${statuses.map(attachmentStatusLabel).join(", ")}.`;

  await db.prepare(
    `UPDATE hr_submissions
     SET status = ?,
       verified_by = CASE WHEN ? IN ('verified', 'rejected', 'revision_required') THEN ? ELSE verified_by END,
       verified_at = CASE WHEN ? IN ('verified', 'rejected', 'revision_required') THEN ? ELSE verified_at END,
       verification_note = ?,
       updated_by = ?,
       updated_at = ?
     WHERE id = ?`
  ).run(nextStatus, nextStatus, actor.id, nextStatus, now, summary, actor.id, now, submissionId);
}

async function verifySubmissionAttachment(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>
) {
  if (!isHrManager(actor) && !isPotentialApprover(actor)) {
    throw new ApiError(403, "Hanya pejabat berwenang atau admin yang dapat memverifikasi lampiran setoran.");
  }

  const attachmentId = stringValue(payload, "attachmentId", { required: true, label: "Lampiran" });
  const status = stringValue(payload, "status", { required: true, label: "Status lampiran" }) as HrSubmissionAttachmentStatus;
  if (!SUBMISSION_ATTACHMENT_STATUSES.has(status)) throw new ApiError(400, "Status lampiran tidak valid.");

  const note = stringValue(payload, "note");
  if ((status === "rejected" || status === "revision_required") && !note) {
    throw new ApiError(400, "Catatan wajib diisi untuk lampiran yang ditolak atau perlu revisi.");
  }

  const row = await db.prepare(
    `SELECT hsa.id, hsa.submission_id, hsa.original_file_name, hs.employee_id, hs.submission_type,
       hs.title, hs.period_year, hs.period_month
     FROM hr_submission_attachments hsa
     JOIN hr_submissions hs ON hs.id = hsa.submission_id
     WHERE hsa.id = ?
     LIMIT 1`
  ).get<{
    id: string;
    submission_id: string;
    original_file_name: string;
    employee_id: string;
    submission_type: HrSubmissionType;
    title: string;
    period_year: number;
    period_month: number | null;
  }>(attachmentId);

  if (!row) throw new ApiError(404, "Lampiran setoran tidak ditemukan.");

  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE hr_submission_attachments
     SET verification_status = ?, verification_note = ?, verified_by = ?, verified_at = ?
     WHERE id = ?`
  ).run(status, note, actor.id, now, attachmentId);

  const attachmentNote = note || `Lampiran ${row.original_file_name} ${attachmentStatusLabel(status)}.`;
  await updateParentSubmissionStatusFromAttachments(db, actor, row.submission_id, attachmentNote);
  await appendHrAudit(db, actor, "VERIFY_HR_SUBMISSION_ATTACHMENT", "hr_submission_attachment", attachmentId, {
    status,
    note,
    submissionId: row.submission_id,
    originalFileName: row.original_file_name,
  });

  const employee = await getEmployeeById(db, row.employee_id).catch(() => null);
  if (employee && status !== "pending") {
    const templateKey =
      status === "verified"
        ? "submission_verified"
        : status === "rejected"
        ? "submission_rejected"
        : "submission_revision_required";
    await queueHrWhatsappNotification(db, {
      templateKey,
      sourceFeature: status === "verified" ? "hr_submission_attachment_verified" : status === "rejected" ? "hr_submission_attachment_rejected" : "hr_submission_attachment_revision",
      entityType: "hr_submission_attachment",
      entityId: attachmentId,
      eventType: `${row.submission_type}:${status}:${attachmentId}`,
      recipient: employee,
      values: {
        nama_pegawai: employee.fullName,
        jenis_setoran: row.submission_type.toUpperCase(),
        judul: `${row.title} - ${row.original_file_name}`,
        periode: `${row.period_month ?? "-"} / ${row.period_year}`,
        catatan: attachmentNote,
      },
    });
  }

  return listAttachments(db);
}

async function createAttendancePermission(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>) {
  const employee = await resolveTargetEmployee(db, actor, payload);
  const permissionType = stringValue(payload, "permissionType", { required: true, label: "Jenis izin" }) as HrAttendancePermissionType;
  if (!["late_arrival", "early_leave"].includes(permissionType)) throw new ApiError(400, "Jenis izin tidak valid.");

  const now = new Date().toISOString();
  const id = await nextPrefixedId(db, "hr_attendance_permissions", "hap");
  await db.prepare(
    `INSERT INTO hr_attendance_permissions (
      id, employee_id, permission_type, request_date, requested_time, reason,
      status, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?)`
  ).run(
    id,
    employee.id,
    permissionType,
    stringValue(payload, "requestDate", { required: true, label: "Tanggal izin" }),
    stringValue(payload, "requestedTime", { required: true, label: "Jam izin" }),
    stringValue(payload, "reason", { required: true, label: "Alasan izin" }),
    actor.id,
    actor.id,
    now,
    now
  );

  await appendHrAudit(db, actor, "CREATE_ATTENDANCE_PERMISSION", "hr_attendance_permission", id, { permissionType });
  return (await listAttendancePermissions(db)).find((item) => item.id === id) ?? { id };
}

async function actAttendancePermission(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>,
  status: "approved" | "rejected" | "cancelled"
) {
  const id = stringValue(payload, "id", { required: true, label: "Izin kehadiran" });
  const rows = await listAttendancePermissions(db);
  const request = rows.find((item) => item.id === id);
  if (!request) throw new ApiError(404, "Izin kehadiran tidak ditemukan.");

  if (status === "cancelled") {
    await assertCanAccessEmployee(db, actor, request.employeeId);
  } else if (!isHrManager(actor) && !isPotentialApprover(actor)) {
    throw new ApiError(403, "Anda tidak berwenang memproses izin kehadiran.");
  }

  const note = stringValue(payload, "note");
  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE hr_attendance_permissions
     SET status = ?, approved_by = CASE WHEN ? = 'approved' THEN ? ELSE approved_by END,
       approved_at = CASE WHEN ? = 'approved' THEN ? ELSE approved_at END,
       rejected_by = CASE WHEN ? = 'rejected' THEN ? ELSE rejected_by END,
       rejected_at = CASE WHEN ? = 'rejected' THEN ? ELSE rejected_at END,
       note = ?, updated_by = ?, updated_at = ?
     WHERE id = ?`
  ).run(status, status, actor.id, status, now, status, actor.id, status, now, note, actor.id, now, id);

  await appendHrAudit(db, actor, "ACT_ATTENDANCE_PERMISSION", "hr_attendance_permission", id, { status, note });
  return listAttendancePermissions(db);
}

async function createMeetingResult(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>) {
  if (!isHrManager(actor) && !isPotentialApprover(actor)) {
    throw new ApiError(403, "Anda tidak berwenang membuat hasil rapat.");
  }

  const now = new Date().toISOString();
  const id = await nextPrefixedId(db, "hr_meeting_results", "hmr");
  await db.prepare(
    `INSERT INTO hr_meeting_results (
      id, title, meeting_date, location, participants, summary, category,
      visibility, status, document_public, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    stringValue(payload, "title", { required: true, label: "Judul rapat" }),
    stringValue(payload, "meetingDate", { required: true, label: "Tanggal rapat" }),
    stringValue(payload, "location"),
    stringValue(payload, "participants"),
    stringValue(payload, "summary", { required: true, label: "Ringkasan rapat" }),
    stringValue(payload, "category") || "umum",
    stringValue(payload, "visibility") || "internal",
    stringValue(payload, "status") === "draft" || stringValue(payload, "status") === "archived" ? stringValue(payload, "status") : "published",
    Boolean(payload.documentPublic) ? 1 : 0,
    actor.id,
    actor.id,
    now,
    now
  );

  await appendHrAudit(db, actor, "CREATE_MEETING_RESULT", "hr_meeting_result", id, { title: stringValue(payload, "title") });
  return (await listMeetings(db)).find((item) => item.id === id) ?? { id };
}

async function createEmployeeDocument(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>) {
  const employee = await resolveTargetEmployee(db, actor, payload);
  const now = new Date().toISOString();
  const id = await nextPrefixedId(db, "hr_employee_documents", "hed");
  await db.prepare(
    `INSERT INTO hr_employee_documents (
      id, employee_id, category, document_number, document_date, title,
      description, visibility, uploaded_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    employee.id,
    stringValue(payload, "category", { required: true, label: "Kategori dokumen" }),
    stringValue(payload, "documentNumber"),
    stringValue(payload, "documentDate") || todayIsoDate(),
    stringValue(payload, "title", { required: true, label: "Judul dokumen" }),
    stringValue(payload, "description"),
    stringValue(payload, "visibility") || "owner_admin",
    actor.id,
    now,
    now
  );

  await appendHrAudit(db, actor, "CREATE_EMPLOYEE_DOCUMENT", "hr_employee_document", id, { employeeId: employee.id });
  return (await listDocuments(db)).find((item) => item.id === id) ?? { id };
}

async function adjustLeaveBalance(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>) {
  if (!isHrConfigAdmin(actor)) throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat mengoreksi saldo cuti.");

  const employeeId = stringValue(payload, "employeeId", { required: true, label: "Pegawai" });
  const employee = await getEmployeeById(db, employeeId);
  const year = numberValue(payload, "year", currentYear());
  const reason = stringValue(payload, "reason", { required: true, label: "Alasan koreksi saldo" });
  const balanceN = Math.max(0, numberValue(payload, "balanceN", 0));
  const balanceN1 = Math.max(0, numberValue(payload, "balanceN1", 0));
  const balanceN2 = Math.max(0, numberValue(payload, "balanceN2", 0));
  const before = await ensureBalance(db, employee.id, year, actor.id);
  const now = new Date().toISOString();
  const remaining = Math.max(0, balanceN + balanceN1 + balanceN2 - before.usedDays - before.pendingDays);

  await db.prepare(
    `UPDATE hr_leave_balances
     SET balance_n = ?, balance_n1 = ?, balance_n2 = ?, remaining_days = ?,
       updated_by = ?, updated_at = ?
     WHERE employee_id = ? AND year = ?`
  ).run(balanceN, balanceN1, balanceN2, remaining, actor.id, now, employee.id, year);

  const totalBefore = before.balanceN + before.balanceN1 + before.balanceN2;
  const totalAfter = balanceN + balanceN1 + balanceN2;
  await db.prepare(
    `INSERT INTO hr_leave_balance_transactions (
      id, employee_id, leave_request_id, year, source_year_type, transaction_type,
      days, description, created_by, created_at
    ) VALUES (?, ?, NULL, ?, 'manual', 'manual_adjustment', ?, ?, ?, ?)`
  ).run(
    await nextPrefixedId(db, "hr_leave_balance_transactions", "hbt"),
    employee.id,
    year,
    totalAfter - totalBefore,
    `Koreksi saldo manual: ${reason}`,
    actor.id,
    now
  );

  await appendHrAudit(db, actor, "ADJUST_LEAVE_BALANCE", "hr_leave_balance", employee.id, {
    employeeName: employee.fullName,
    year,
    before,
    after: { balanceN, balanceN1, balanceN2, remaining },
    reason,
  });
  return ensureBalance(db, employee.id, year, actor.id);
}

async function upsertNotificationTemplate(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>) {
  if (!isHrConfigAdmin(actor)) throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat mengatur template notifikasi.");

  const id = stringValue(payload, "id") || await nextPrefixedId(db, "hr_notification_templates", "hnt");
  const templateKey = stringValue(payload, "templateKey", { required: true, label: "Kode template" });
  const name = stringValue(payload, "name", { required: true, label: "Nama template" });
  const audience = stringValue(payload, "audience") || "employee";
  const eventType = stringValue(payload, "eventType") || templateKey;
  const body = stringValue(payload, "body", { required: true, label: "Isi notifikasi" });
  const isActive = payload.isActive === undefined ? true : Boolean(payload.isActive);
  if (!["employee", "approver", "admin"].includes(audience)) {
    throw new ApiError(400, "Audience template notifikasi tidak valid.");
  }
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO hr_notification_templates (
      id, template_key, name, audience, event_type, channel, body, is_active,
      created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'whatsapp', ?, ?, ?, ?, ?, ?)
    ON CONFLICT (template_key) DO UPDATE SET
      name = EXCLUDED.name,
      audience = EXCLUDED.audience,
      event_type = EXCLUDED.event_type,
      body = EXCLUDED.body,
      is_active = EXCLUDED.is_active,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at`
  ).run(id, templateKey, name, audience, eventType, body, isActive ? 1 : 0, actor.id, actor.id, now, now);

  await appendHrAudit(db, actor, "UPSERT_HR_NOTIFICATION_TEMPLATE", "hr_notification_template", templateKey, { name, audience });
  return listNotificationTemplates(db);
}

async function upsertDocumentRequirement(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>) {
  if (!isHrConfigAdmin(actor)) throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat mengatur reminder dokumen.");

  const id = stringValue(payload, "id") || await nextPrefixedId(db, "hr_annual_document_requirements", "hdr");
  const submissionType = stringValue(payload, "submissionType", { required: true, label: "Jenis dokumen" }) as HrSubmissionType;
  if (!["pck", "skp", "wfa"].includes(submissionType)) throw new ApiError(400, "Jenis dokumen reminder tidak valid.");
  const name = stringValue(payload, "name", { required: true, label: "Nama dokumen" });
  const periodYear = numberValue(payload, "periodYear", currentYear());
  const dueDate = stringValue(payload, "dueDate", { required: true, label: "Batas waktu" });
  const targetRoleIds = Array.isArray(payload.targetRoleIds)
    ? payload.targetRoleIds.map(String).filter(Boolean)
    : stringValue(payload, "targetRoleIds").split(",").map((item) => item.trim()).filter(Boolean);
  const targetPositionIds = Array.isArray(payload.targetPositionIds)
    ? payload.targetPositionIds.map(String).filter(Boolean)
    : stringValue(payload, "targetPositionIds").split(",").map((item) => item.trim()).filter(Boolean);
  const isActive = payload.isActive === undefined ? true : Boolean(payload.isActive);
  const now = new Date().toISOString();

  await db.prepare(
    `INSERT INTO hr_annual_document_requirements (
      id, submission_type, name, period_year, due_date, target_role_ids_json,
      target_position_ids_json, is_active, created_by, updated_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      submission_type = EXCLUDED.submission_type,
      name = EXCLUDED.name,
      period_year = EXCLUDED.period_year,
      due_date = EXCLUDED.due_date,
      target_role_ids_json = EXCLUDED.target_role_ids_json,
      target_position_ids_json = EXCLUDED.target_position_ids_json,
      is_active = EXCLUDED.is_active,
      updated_by = EXCLUDED.updated_by,
      updated_at = EXCLUDED.updated_at`
  ).run(
    id,
    submissionType,
    name,
    periodYear,
    dueDate,
    JSON.stringify(targetRoleIds),
    JSON.stringify(targetPositionIds),
    isActive ? 1 : 0,
    actor.id,
    actor.id,
    now,
    now
  );

  await appendHrAudit(db, actor, "UPSERT_HR_DOCUMENT_REQUIREMENT", "hr_annual_document_requirement", id, { submissionType, periodYear });
  return listDocumentRequirements(db, await listEmployees(db));
}

async function importEmployeeProfiles(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>) {
  if (!isHrConfigAdmin(actor)) throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat impor data pegawai.");

  const raw = stringValue(payload, "text", { required: true, label: "Data impor pegawai" });
  const { headers, rows } = parseImportTable(raw);
  const indexOf = (aliases: string[]) => headerIndex(headers, aliases);
  const nipIndex = indexOf(["nip", "nip_nik", "nomor_pegawai", "employee_number"]);
  if (nipIndex < 0) throw new ApiError(400, "Header CSV wajib memiliki kolom nip.");

  const now = new Date().toISOString();
  const profileRows = await listEmployees(db);
  const profileByNip = new Map(profileRows.map((item) => [item.nip, item]));
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const nip = row[nipIndex] ?? "";
    const profile = profileByNip.get(nip);
    if (!profile) {
      skipped += 1;
      continue;
    }
    const get = (aliases: string[]) => {
      const index = indexOf(aliases);
      return index >= 0 ? row[index] ?? "" : "";
    };
    const supervisor = profileByNip.get(get(["atasan_nip", "nip_atasan", "supervisor_nip"]));
    const approvalOfficer = profileByNip.get(get(["approval_nip", "pejabat_approval_nip", "approval_officer_nip"]));
    const rawEmploymentStatus = get(["status", "status_pegawai", "employment_status"]);
    const importedEmploymentStatus = rawEmploymentStatus ? normalizeEmploymentStatus(rawEmploymentStatus) : "";
    const nextEmploymentStatus = isJudicialStateOfficialEmployee(profile) ? "pejabat_negara" : importedEmploymentStatus;
    await db.prepare(
      `UPDATE employee_profiles
       SET unit_kerja = COALESCE(NULLIF(?, ''), unit_kerja),
         rank_grade = COALESCE(NULLIF(?, ''), rank_grade),
         employment_status = COALESCE(NULLIF(?, ''), employment_status),
         supervisor_employee_id = COALESCE(?, supervisor_employee_id),
         approval_officer_employee_id = COALESCE(?, approval_officer_employee_id),
         phone = COALESCE(NULLIF(?, ''), phone),
         email = COALESCE(NULLIF(?, ''), email),
         updated_by = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      get(["unit", "unit_kerja", "satuan_kerja"]),
      get(["pangkat", "pangkat_golongan", "golongan", "rank_grade"]),
      nextEmploymentStatus,
      supervisor?.id ?? null,
      approvalOfficer?.id ?? null,
      get(["wa", "whatsapp", "nomor_whatsapp", "no_wa", "phone"]),
      get(["email", "surel"]),
      actor.id,
      now,
      profile.id
    );
    updated += 1;
  }

  await appendHrAudit(db, actor, "IMPORT_EMPLOYEE_PROFILES", "employee_profiles", String(payload.source ?? "text"), {
    updated,
    skipped,
    fileName: stringValue(payload, "fileName"),
  });
  return { updated, skipped };
}

async function runAnnualDocumentReminders(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>) {
  if (!isHrConfigAdmin(actor) && !isPotentialApprover(actor)) {
    throw new ApiError(403, "Hanya admin atau pejabat berwenang yang dapat menjalankan reminder dokumen.");
  }

  const requirementId = stringValue(payload, "requirementId");
  const onlyDue = Boolean(payload.onlyDue);
  const settings = await getHrSettings(db);
  const requirements = (await listDocumentRequirements(db, await listEmployees(db)))
    .filter((item) => {
      if (!item.isActive) return false;
      if (requirementId && item.id !== requirementId) return false;
      if (!onlyDue) return true;
      return dayDiffToNow(item.dueDate) <= settings.annualReminderDaysBefore;
    });
  const employees = await listEmployees(db);
  const submissions = await listSubmissions(db);
  let queued = 0;
  const runDate = todayIsoDate();

  for (const requirement of requirements) {
    const missingEmployees = employees.filter((employee) => {
      if (!employee.isActive) return false;
      if (requirement.targetPositionIds.length && !requirement.targetPositionIds.includes(employee.positionId)) return false;
      return !submissions.some((submission) =>
        submission.employeeId === employee.id &&
        submission.submissionType === requirement.submissionType &&
        submission.periodYear === requirement.periodYear &&
        (submission.status === "submitted" || submission.status === "verified")
      );
    });
    for (const employee of missingEmployees) {
      await queueHrWhatsappNotification(db, {
        templateKey: "annual_document_reminder",
        sourceFeature: "hr_annual_document_reminder",
        entityType: "hr_annual_document_requirement",
        entityId: requirement.id,
        recipient: employee,
        eventType: `${requirement.submissionType}_${requirement.periodYear}_${requirement.id}_${runDate}`,
        values: {
          nama_pegawai: employee.fullName,
          nama_dokumen: requirement.name,
          tahun: requirement.periodYear,
          batas_waktu: requirement.dueDate,
          jenis_setoran: requirement.submissionType.toUpperCase(),
        },
      });
      queued += 1;
    }
  }

  await appendHrAudit(db, actor, "RUN_HR_ANNUAL_DOCUMENT_REMINDERS", "hr_annual_document_requirement", requirementId || "all", { queued });
  return { queued };
}

async function updateHrSettingValue(db: AletaDatabase, actor: UserPersona | null, key: string, value: string) {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO hr_settings (id, key, value, description, updated_by, created_at, updated_at)
     VALUES (?, ?, ?, '', ?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = EXCLUDED.updated_at`
  ).run(`hrs-${key}`, key, value, actor?.id ?? null, now, now);
}

async function runAnnualDocumentReminderScheduler(
  db: AletaDatabase,
  actor: UserPersona,
  payload: Record<string, unknown>
) {
  if (!isHrConfigAdmin(actor) && !isPotentialApprover(actor)) {
    throw new ApiError(403, "Hanya admin atau pejabat berwenang yang dapat menjalankan scheduler reminder dokumen.");
  }

  const settings = await getHrSettings(db);
  const force = Boolean(payload.force);
  const today = todayIsoDate();
  const scheduledTime = settings.annualReminderSchedulerTime.length === 5
    ? `${settings.annualReminderSchedulerTime}:00`
    : settings.annualReminderSchedulerTime;

  if (!force && !settings.annualReminderSchedulerEnabled) {
    return { skipped: true, queued: 0, message: "Scheduler reminder dokumen tahunan belum aktif." };
  }
  if (!force && sameIsoDate(settings.annualReminderSchedulerLastRunAt, today)) {
    return { skipped: true, queued: 0, message: "Scheduler reminder dokumen tahunan sudah berjalan hari ini." };
  }
  if (!force && currentTimeValue() < scheduledTime) {
    return { skipped: true, queued: 0, message: `Belum masuk jam scheduler (${scheduledTime}).` };
  }

  const result = await runAnnualDocumentReminders(db, actor, { onlyDue: true });
  const message = `Scheduler selesai. ${result.queued} pesan reminder masuk antrean.`;
  const now = new Date().toISOString();
  await updateHrSettingValue(db, actor, "annual_reminder_scheduler_last_run_at", now);
  await updateHrSettingValue(db, actor, "annual_reminder_scheduler_last_message", message);
  await appendHrAudit(db, actor, "RUN_HR_ANNUAL_DOCUMENT_REMINDER_SCHEDULER", "hr_settings", "annual_reminder_scheduler", {
    queued: result.queued,
    force,
  });

  return { skipped: false, queued: result.queued, message, runAt: now };
}

async function maybeRunAnnualDocumentReminderScheduler(db: AletaDatabase, actor: UserPersona, settings: HrSettingsDto) {
  if (!settings.annualReminderSchedulerEnabled) return;
  if (!isHrConfigAdmin(actor) && !isPotentialApprover(actor)) return;
  if (sameIsoDate(settings.annualReminderSchedulerLastRunAt, todayIsoDate())) return;
  const scheduledTime = settings.annualReminderSchedulerTime.length === 5
    ? `${settings.annualReminderSchedulerTime}:00`
    : settings.annualReminderSchedulerTime;
  if (currentTimeValue() < scheduledTime) return;

  try {
    await runAnnualDocumentReminderScheduler(db, actor, {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduler reminder dokumen gagal berjalan.";
    await updateHrSettingValue(db, actor, "annual_reminder_scheduler_last_message", message);
    console.warn("[ALETA HR] Scheduler reminder dokumen gagal:", error);
  }
}

async function runSlaApprovalReminders(db: AletaDatabase, actor: UserPersona) {
  if (!isHrConfigAdmin(actor) && !isPotentialApprover(actor)) {
    throw new ApiError(403, "Hanya admin atau pejabat berwenang yang dapat mengirim reminder SLA.");
  }

  const settings = await getHrSettings(db);
  const employees = await listEmployees(db);
  const slaItems = buildSlaItems(
    await listLeaveRequests(db),
    await listSubmissions(db),
    await listAttendancePermissions(db),
    settings.approvalSlaDays
  ).filter((item) => item.overdue);

  if (!slaItems.length) {
    await appendHrAudit(db, actor, "RUN_HR_SLA_REMINDERS", "e_kepegawaian_sla", "none", { queued: 0 });
    return { queued: 0, message: "Tidak ada proses yang melewati SLA." };
  }

  const recipients = selectHrAdminRecipients(employees);
  const ringkasan = slaItems.slice(0, 12).map((item, index) =>
    `${index + 1}. ${item.title} - ${item.employeeName} (${item.daysWaiting} hari)`
  ).join("\n");
  let queued = 0;

  for (const recipient of recipients.slice(0, 8)) {
    await queueHrWhatsappNotification(db, {
      templateKey: "approval_sla_overdue",
      sourceFeature: "hr_approval_sla_overdue",
      entityType: "e_kepegawaian_sla",
      entityId: "approval",
      recipient,
      eventType: `sla_${todayIsoDate()}`,
      priority: 3,
      values: {
        nama_penerima: recipient.fullName,
        sla_hari: settings.approvalSlaDays,
        ringkasan,
      },
    });
    queued += 1;
  }

  await appendHrAudit(db, actor, "RUN_HR_SLA_REMINDERS", "e_kepegawaian_sla", "approval", { queued, overdue: slaItems.length });
  return { queued, overdue: slaItems.length };
}

async function updateSettings(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>) {
  if (!isHrConfigAdmin(actor)) throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat mengubah pengaturan E-Kepegawaian.");

  const settings: Record<string, string> = {};
  if (payload.moduleEnabled !== undefined) settings.module_enabled = String(Boolean(payload.moduleEnabled));
  if (payload.annualLeaveDefaultDays !== undefined) settings.annual_leave_default_days = String(numberValue(payload, "annualLeaveDefaultDays", DEFAULT_SETTINGS.annualLeaveDefaultDays));
  if (payload.defaultBalanceN !== undefined) settings.default_balance_n = String(numberValue(payload, "defaultBalanceN", DEFAULT_SETTINGS.defaultBalanceN));
  if (payload.defaultBalanceN1 !== undefined) settings.default_balance_n1 = String(numberValue(payload, "defaultBalanceN1", DEFAULT_SETTINGS.defaultBalanceN1));
  if (payload.defaultBalanceN2 !== undefined) settings.default_balance_n2 = String(numberValue(payload, "defaultBalanceN2", DEFAULT_SETTINGS.defaultBalanceN2));
  if (payload.calculationType !== undefined) {
    const calculationType = stringValue(payload, "calculationType");
    settings.calculation_type = calculationType === "calendar_days" ? "calendar_days" : "working_days";
  }
  if (payload.balanceUsageOrder !== undefined) {
    const value = Array.isArray(payload.balanceUsageOrder) ? payload.balanceUsageOrder.map(String) : DEFAULT_SETTINGS.balanceUsageOrder;
    settings.balance_usage_order = JSON.stringify(value);
  }
  if (payload.maxUploadSizeMb !== undefined) settings.max_upload_size_mb = String(numberValue(payload, "maxUploadSizeMb", DEFAULT_SETTINGS.maxUploadSizeMb));
  if (payload.allowedFileTypes !== undefined) {
    const value = Array.isArray(payload.allowedFileTypes)
      ? payload.allowedFileTypes.map(String)
      : String(payload.allowedFileTypes).split(",").map((item) => item.trim()).filter(Boolean);
    settings.allowed_file_types = JSON.stringify(value);
  }
  if (payload.requestNumberFormat !== undefined) settings.request_number_format = stringValue(payload, "requestNumberFormat") || DEFAULT_SETTINGS.requestNumberFormat;
  if (payload.approvalSlaDays !== undefined) settings.approval_sla_days = String(Math.max(1, numberValue(payload, "approvalSlaDays", DEFAULT_SETTINGS.approvalSlaDays)));
  if (payload.annualReminderDaysBefore !== undefined) settings.annual_reminder_days_before = String(Math.max(1, numberValue(payload, "annualReminderDaysBefore", DEFAULT_SETTINGS.annualReminderDaysBefore)));
  if (payload.annualReminderSchedulerEnabled !== undefined) settings.annual_reminder_scheduler_enabled = String(Boolean(payload.annualReminderSchedulerEnabled));
  if (payload.annualReminderSchedulerTime !== undefined) {
    const time = stringValue(payload, "annualReminderSchedulerTime") || DEFAULT_SETTINGS.annualReminderSchedulerTime;
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) throw new ApiError(400, "Format jam scheduler reminder harus HH:mm atau HH:mm:ss.");
    settings.annual_reminder_scheduler_time = time.length === 5 ? `${time}:00` : time;
  }
  if (payload.publicForms !== undefined) {
    const incoming = asRecord(payload.publicForms);
    settings.public_forms_json = JSON.stringify({
      ...DEFAULT_SETTINGS.publicForms,
      cuti: incoming.cuti !== undefined ? Boolean(incoming.cuti) : DEFAULT_SETTINGS.publicForms.cuti,
      uploadPck: incoming.uploadPck !== undefined ? Boolean(incoming.uploadPck) : DEFAULT_SETTINGS.publicForms.uploadPck,
      uploadSkp: incoming.uploadSkp !== undefined ? Boolean(incoming.uploadSkp) : DEFAULT_SETTINGS.publicForms.uploadSkp,
      wfa: incoming.wfa !== undefined ? Boolean(incoming.wfa) : DEFAULT_SETTINGS.publicForms.wfa,
      lambatDatang: incoming.lambatDatang !== undefined ? Boolean(incoming.lambatDatang) : DEFAULT_SETTINGS.publicForms.lambatDatang,
      cepatPulang: incoming.cepatPulang !== undefined ? Boolean(incoming.cepatPulang) : DEFAULT_SETTINGS.publicForms.cepatPulang,
      hasilRapat: incoming.hasilRapat !== undefined ? Boolean(incoming.hasilRapat) : DEFAULT_SETTINGS.publicForms.hasilRapat,
    });
  }
  if (payload.publicMaxUploadSizeMb !== undefined) {
    settings.public_max_upload_size_mb = String(Math.max(1, numberValue(payload, "publicMaxUploadSizeMb", DEFAULT_SETTINGS.publicMaxUploadSizeMb)));
  }
  if (payload.publicAllowedFileTypes !== undefined) {
    const value = Array.isArray(payload.publicAllowedFileTypes)
      ? payload.publicAllowedFileTypes.map(String)
      : String(payload.publicAllowedFileTypes).split(",").map((item) => item.trim()).filter(Boolean);
    settings.public_allowed_file_types = JSON.stringify(value.length ? value : DEFAULT_SETTINGS.publicAllowedFileTypes);
  }
  if (payload.publicRequiresCaptcha !== undefined) settings.public_requires_captcha = String(Boolean(payload.publicRequiresCaptcha));
  if (payload.publicMode !== undefined) settings.public_mode = stringValue(payload, "publicMode") === "token" ? "token" : "unrestricted";
  if (payload.publicInstructions !== undefined) settings.public_instructions = stringValue(payload, "publicInstructions") || DEFAULT_SETTINGS.publicInstructions;
  if (payload.publicSuccessMessage !== undefined) settings.public_success_message = stringValue(payload, "publicSuccessMessage") || DEFAULT_SETTINGS.publicSuccessMessage;

  const now = new Date().toISOString();
  for (const [key, value] of Object.entries(settings)) {
    await db.prepare(
      `UPDATE hr_settings SET value = ?, updated_by = ?, updated_at = ? WHERE key = ?`
    ).run(value, actor.id, now, key);
  }

  await appendHrAudit(db, actor, "UPDATE_HR_SETTINGS", "hr_settings", "global", { changedKeys: Object.keys(settings) });
  return getHrSettings(db);
}

async function importHolidays(db: AletaDatabase, actor: UserPersona, payload: Record<string, unknown>) {
  if (!isHrConfigAdmin(actor)) throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat impor kalender libur.");

  const raw = stringValue(payload, "text", { required: true, label: "Data kalender libur" });
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.toLowerCase().startsWith("tanggal,") && !line.toLowerCase().startsWith("date,"));

  if (rows.length === 0) {
    throw new ApiError(400, "Tidak ada data kalender yang dapat diimpor.");
  }

  const now = new Date().toISOString();
  let imported = 0;

  for (const row of rows) {
    const [date, name, type, isWorkingDay] = row.split(",").map((item) => item.trim());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
      throw new ApiError(400, `Format tanggal kalender tidak valid: ${date || row}. Gunakan YYYY-MM-DD.`);
    }

    await db.prepare(
      `INSERT INTO hr_holidays (
        id, date, name, type, is_working_day, created_by, updated_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (date) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        is_working_day = EXCLUDED.is_working_day,
        updated_by = EXCLUDED.updated_by,
        updated_at = EXCLUDED.updated_at`
    ).run(
      await nextPrefixedId(db, "hr_holidays", "hhd"),
      date,
      name || "Hari libur",
      type || "holiday",
      isWorkingDay === "1" || isWorkingDay?.toLowerCase() === "true" ? 1 : 0,
      actor.id,
      actor.id,
      now,
      now
    );
    imported += 1;
  }

  await appendHrAudit(db, actor, "IMPORT_HR_HOLIDAYS", "hr_holidays", "calendar", { imported });
  return { imported };
}

export async function getLeaveRequestFormData(
  db: AletaDatabase,
  actor: UserPersona,
  leaveRequestId: string
) {
  await ensureEKepegawaianDefaults(db, actor.id);
  const request = await getLeaveRequestById(db, leaveRequestId);
  await assertCanAccessEmployee(db, actor, request.employeeId);
  const employee = await getEmployeeById(db, request.employeeId);
  const leaveType = await getLeaveType(db, request.leaveTypeId);
  const balance = await ensureBalance(db, employee.id, currentYear(), actor.id);
  const settings = await getHrSettings(db);
  const approvalLogs = (await listApprovalLogs(db)).filter((log) => log.leaveRequestId === request.id);
  const signatures = (await listEmployeeSignatures(db)).filter((signature) =>
    signature.employeeId === employee.id ||
    signature.employeeId === employee.supervisorEmployeeId ||
    signature.employeeId === employee.approvalOfficerEmployeeId
  );
  const generatedDocuments = (await listGeneratedDocuments(db)).filter((document) => document.leaveRequestId === request.id);

  await appendHrAudit(db, actor, "DOWNLOAD_LEAVE_FORM_PDF", "hr_leave_request", request.id, {
    requestNumber: request.requestNumber,
  });

  return {
    request,
    employee,
    leaveType,
    balance,
    settings,
    approvalLogs,
    signatures,
    generatedDocuments,
  };
}

export async function recordGeneratedLeaveDocument(
  db: AletaDatabase,
  actor: UserPersona,
  leaveRequestId: string,
  {
    fileName,
    filePath = "",
    fileSize,
    verificationCode,
  }: {
    fileName: string;
    filePath?: string;
    fileSize: number;
    verificationCode: string;
  }
) {
  const now = new Date().toISOString();
  if (!filePath) {
    const stored = await db.prepare(
      `SELECT id FROM hr_generated_documents
       WHERE leave_request_id = ? AND document_type = 'leave_permission' AND COALESCE(file_path, '') <> ''
       LIMIT 1`
    ).get<{ id: string }>(leaveRequestId);
    if (stored) return;
    return;
  }
  await db.prepare(
    `DELETE FROM hr_generated_documents
     WHERE leave_request_id = ? AND document_type = 'leave_permission'
      AND (? <> '' OR COALESCE(file_path, '') = '')`
  ).run(leaveRequestId, filePath);
  await db.prepare(
    `INSERT INTO hr_generated_documents (
      id, leave_request_id, document_type, file_name, file_path, file_type,
      file_size, verification_code, generated_by, generated_at, created_at
    ) VALUES (?, ?, 'leave_permission', ?, ?, 'application/pdf', ?, ?, ?, ?, ?)`
  ).run(
    await nextPrefixedId(db, "hr_generated_documents", "hgd"),
    leaveRequestId,
    fileName,
    filePath,
    fileSize,
    verificationCode,
    actor.id,
    now,
    now
  );
}

async function generateApprovedLeaveDocument(db: AletaDatabase, actor: UserPersona, leaveRequestId: string) {
  const formData = await getLeaveRequestFormData(db, actor, leaveRequestId);
  if (formData.request.status !== "approved") return null;

  const identity = await getInstitutionIdentityFromDb(db);
  const verificationCode = `CUTI-${formData.request.id.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
  const fileName = buildLeaveFormPdfFileName(formData.request);
  const { buffer } = await buildLeaveFormPdf(formData, identity, {
    templateFileName: formData.settings.leaveFormTemplateFileName,
    verificationCode,
    verificationUrl: `ALETA-E-KEPEGAWAIAN:${verificationCode}`,
  });
  const storedFile = await storeHrGeneratedFile(buffer, fileName, "application/pdf");

  await recordGeneratedLeaveDocument(db, actor, leaveRequestId, {
    fileName: storedFile.fileName,
    filePath: storedFile.publicUrl,
    fileSize: storedFile.fileSize,
    verificationCode,
  });
  await appendHrAudit(db, actor, "GENERATE_APPROVED_LEAVE_DOCUMENT", "hr_leave_request", leaveRequestId, {
    fileName: storedFile.fileName,
    verificationCode,
  });

  return storedFile;
}

export async function performEKepegawaianAction(
  db: AletaDatabase,
  actor: UserPersona,
  action: string,
  rawPayload: unknown
) {
  await ensureEKepegawaianDefaults(db, actor.id);
  const payload = asRecord(rawPayload);

  return withTransaction(db, async (tx) => {
    switch (action) {
      case "save-leave-draft":
        return saveLeaveDraft(tx, actor, payload, false);
      case "submit-leave":
        return submitLeaveRequest(tx, actor, payload);
      case "approve-leave":
        return actOnLeaveRequest(tx, actor, payload, "approve");
      case "reject-leave":
        return actOnLeaveRequest(tx, actor, payload, "reject");
      case "request-leave-revision":
        return actOnLeaveRequest(tx, actor, payload, "request_revision");
      case "cancel-leave":
        return actOnLeaveRequest(tx, actor, payload, "cancel");
      case "upsert-leave-type":
        return upsertLeaveType(tx, actor, payload);
      case "update-employee-profile":
        return updateEmployeeProfile(tx, actor, payload);
      case "create-submission":
        return createSubmission(tx, actor, payload);
      case "verify-submission":
        return verifySubmission(tx, actor, payload, "verified");
      case "reject-submission":
        return verifySubmission(tx, actor, payload, "rejected");
      case "request-submission-revision":
        return verifySubmission(tx, actor, payload, "revision_required");
      case "verify-submission-attachment":
        return verifySubmissionAttachment(tx, actor, payload);
      case "create-attendance-permission":
        return createAttendancePermission(tx, actor, payload);
      case "approve-attendance-permission":
        return actAttendancePermission(tx, actor, payload, "approved");
      case "reject-attendance-permission":
        return actAttendancePermission(tx, actor, payload, "rejected");
      case "cancel-attendance-permission":
        return actAttendancePermission(tx, actor, payload, "cancelled");
      case "create-meeting-result":
        return createMeetingResult(tx, actor, payload);
      case "create-employee-document":
        return createEmployeeDocument(tx, actor, payload);
      case "adjust-leave-balance":
        return adjustLeaveBalance(tx, actor, payload);
      case "upsert-notification-template":
        return upsertNotificationTemplate(tx, actor, payload);
      case "upsert-document-requirement":
        return upsertDocumentRequirement(tx, actor, payload);
      case "import-employee-profiles":
        return importEmployeeProfiles(tx, actor, payload);
      case "run-document-reminders":
        return runAnnualDocumentReminders(tx, actor, payload);
      case "run-document-reminder-scheduler":
        return runAnnualDocumentReminderScheduler(tx, actor, payload);
      case "run-sla-reminders":
        return runSlaApprovalReminders(tx, actor);
      case "update-settings":
        return updateSettings(tx, actor, payload);
      case "import-holidays":
        return importHolidays(tx, actor, payload);
      default:
        throw new ApiError(400, "Aksi E-Kepegawaian tidak dikenal.");
    }
  });
}

export async function attachEKepegawaianFile(
  db: AletaDatabase,
  actor: UserPersona,
  {
    entityType,
    entityId,
    fileName,
    originalFileName,
    filePath,
    fileType,
    fileSize,
    signatureRole,
  }: {
    entityType: "leave_request" | "submission" | "attendance_permission" | "employee_document" | "meeting_result" | "employee_signature" | "leave_form_template";
    entityId: string;
    fileName: string;
    originalFileName: string;
    filePath: string;
    fileType: string;
    fileSize: number;
    signatureRole?: string;
  }
) {
  await ensureEKepegawaianDefaults(db, actor.id);
  const now = new Date().toISOString();

  return withTransaction(db, async (tx) => {
    if (entityType === "leave_form_template") {
      if (!isHrConfigAdmin(actor)) {
        throw new ApiError(403, "Hanya Admin atau Super Admin yang dapat mengunggah template formulir cuti.");
      }
      const nowTemplate = new Date().toISOString();
      await tx.prepare(
        `UPDATE hr_settings SET value = ?, updated_by = ?, updated_at = ?
         WHERE key = 'leave_form_template_file_name'`
      ).run(fileName, actor.id, nowTemplate);
      await tx.prepare(
        `UPDATE hr_settings SET value = ?, updated_by = ?, updated_at = ?
         WHERE key = 'leave_form_template_original_name'`
      ).run(originalFileName, actor.id, nowTemplate);
      await appendHrAudit(tx, actor, "UPLOAD_LEAVE_FORM_TEMPLATE", "hr_settings", "leave_form_template", {
        fileName,
        originalFileName,
        fileSize,
      });
      return { attachmentId: "leave_form_template", filePath };
    }

    if (entityType === "employee_signature") {
      if (!isHrConfigAdmin(actor) && !isHrManager(actor)) {
        throw new ApiError(403, "Hanya admin atau pengelola kepegawaian yang dapat mengunggah foto tanda tangan.");
      }
      const employee = await getEmployeeById(tx, entityId);
      const normalizedSignatureRole = normalizeSignatureRole(signatureRole);
      await tx.prepare(
        `UPDATE hr_employee_signatures
         SET is_active = 0, updated_at = ?
         WHERE employee_id = ? AND signature_role = ?`
      ).run(now, employee.id, normalizedSignatureRole);
      const signatureId = await nextPrefixedId(tx, "hr_employee_signatures", "hes");
      await tx.prepare(
        `INSERT INTO hr_employee_signatures (
          id, employee_id, signature_role, file_name, original_file_name, file_path,
          file_type, file_size, is_active, uploaded_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
      ).run(signatureId, employee.id, normalizedSignatureRole, fileName, originalFileName, filePath, fileType, fileSize, actor.id, now, now);
      await appendHrAudit(tx, actor, "UPLOAD_EMPLOYEE_SIGNATURE", "employee_profile", employee.id, {
        fileName,
        fileSize,
        signatureRole: normalizedSignatureRole,
        signatureRoleLabel: SIGNATURE_ROLE_LABELS[normalizedSignatureRole],
      });
      return { attachmentId: signatureId, filePath };
    }

    if (entityType === "leave_request") {
      const request = await getLeaveRequestById(tx, entityId);
      await assertCanAccessEmployee(tx, actor, request.employeeId);
      const attachmentId = await nextPrefixedId(tx, "hr_leave_attachments", "hla");
      await tx.prepare(
        `INSERT INTO hr_leave_attachments (
          id, leave_request_id, file_name, original_file_name, file_path,
          file_type, file_size, uploaded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(attachmentId, entityId, fileName, originalFileName, filePath, fileType, fileSize, actor.id, now);
      await appendHrAudit(tx, actor, "UPLOAD_LEAVE_ATTACHMENT", "hr_leave_request", entityId, { fileName, fileSize });
      return { attachmentId, filePath };
    }

    if (entityType === "submission") {
      const submission = (await listSubmissions(tx)).find((item) => item.id === entityId);
      if (!submission) throw new ApiError(404, "Setoran kepegawaian tidak ditemukan.");
      await assertCanAccessEmployee(tx, actor, submission.employeeId);
      const attachmentId = await nextPrefixedId(tx, "hr_submission_attachments", "hsa");
      await tx.prepare(
        `INSERT INTO hr_submission_attachments (
          id, submission_id, file_name, original_file_name, file_path,
          file_type, file_size, uploaded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(attachmentId, entityId, fileName, originalFileName, filePath, fileType, fileSize, actor.id, now);
      await appendHrAudit(tx, actor, "UPLOAD_HR_SUBMISSION_ATTACHMENT", "hr_submission", entityId, { fileName, fileSize });
      return { attachmentId, filePath };
    }

    if (entityType === "attendance_permission") {
      const permission = (await listAttendancePermissions(tx)).find((item) => item.id === entityId);
      if (!permission) throw new ApiError(404, "Izin kehadiran tidak ditemukan.");
      await assertCanAccessEmployee(tx, actor, permission.employeeId);
      const attachmentId = await nextPrefixedId(tx, "hr_attendance_permission_attachments", "haa");
      await tx.prepare(
        `INSERT INTO hr_attendance_permission_attachments (
          id, attendance_permission_id, file_name, original_file_name, file_path,
          file_type, file_size, uploaded_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(attachmentId, entityId, fileName, originalFileName, filePath, fileType, fileSize, actor.id, now);
      await appendHrAudit(tx, actor, "UPLOAD_ATTENDANCE_PERMISSION_ATTACHMENT", "hr_attendance_permission", entityId, { fileName, fileSize });
      return { attachmentId, filePath };
    }

    if (entityType === "employee_document") {
      const document = (await listDocuments(tx)).find((item) => item.id === entityId);
      if (!document) throw new ApiError(404, "Dokumen kepegawaian tidak ditemukan.");
      await assertCanAccessEmployee(tx, actor, document.employeeId);
      await tx.prepare(
        `UPDATE hr_employee_documents
         SET file_path = ?, file_name = ?, file_type = ?, file_size = ?, uploaded_by = ?, updated_at = ?
         WHERE id = ?`
      ).run(filePath, fileName, fileType, fileSize, actor.id, now, entityId);
      await appendHrAudit(tx, actor, "UPLOAD_EMPLOYEE_DOCUMENT_FILE", "hr_employee_document", entityId, { fileName, fileSize });
      return { attachmentId: entityId, filePath };
    }

    const meeting = (await listMeetings(tx)).find((item) => item.id === entityId);
    if (!meeting) throw new ApiError(404, "Hasil rapat tidak ditemukan.");
    if (!isHrManager(actor) && !isPotentialApprover(actor)) {
      throw new ApiError(403, "Anda tidak berwenang mengunggah dokumen hasil rapat.");
    }
    await tx.prepare(
      `UPDATE hr_meeting_results
       SET document_path = ?, updated_by = ?, updated_at = ?
       WHERE id = ?`
    ).run(filePath, actor.id, now, entityId);
    await appendHrAudit(tx, actor, "UPLOAD_MEETING_RESULT_FILE", "hr_meeting_result", entityId, { fileName, fileSize });
    return { attachmentId: entityId, filePath };
  });
}
