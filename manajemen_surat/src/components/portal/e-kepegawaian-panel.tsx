"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileText,
  GripVertical,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  XCircle,
} from "lucide-react";

import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent as BaseCardContent, CardDescription, CardHeader as BaseCardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";
import {
  type AttendancePermissionDto,
  type EmployeeProfileDto,
  type HrAttachmentDto,
  type HrAttendancePermissionType,
  type HrDashboardDto,
  type HrLeaveDailyImpactDto,
  type HrLeaveStatus,
  type HrSubmissionType,
  type HrSubmissionDto,
  type HrNotificationTemplateDto,
  type LeaveRequestDto,
  type LeaveTypeDto,
  type MeetingResultDto,
  type EmployeeDocumentDto,
} from "@/lib/e-kepegawaian-types";
import { cn } from "@/lib/utils";

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: {
    message?: string;
  };
};

type NoticeState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

type HrSection =
  | "dashboard"
  | "cuti"
  | "approval"
  | "pegawai"
  | "pck"
  | "skp"
  | "wfa"
  | "izin"
  | "rapat"
  | "dokumen"
  | "rekap"
  | "saldo"
  | "kalender"
  | "tandatangan"
  | "reminder"
  | "notifikasi"
  | "import"
  | "settings";

type HrExportType = "cuti" | "pegawai" | "setoran" | "izin" | "saldo" | "dokumen" | "sla";

const hrSections = new Set<HrSection>([
  "dashboard",
  "cuti",
  "approval",
  "pegawai",
  "pck",
  "skp",
  "wfa",
  "izin",
  "rapat",
  "dokumen",
  "rekap",
  "saldo",
  "kalender",
  "tandatangan",
  "reminder",
  "notifikasi",
  "import",
  "settings",
]);

function CardHeader({ className, ...props }: ComponentProps<typeof BaseCardHeader>) {
  return <BaseCardHeader className={cn("px-5 pb-4 pt-6 sm:px-6 sm:pb-4 sm:pt-7", className)} {...props} />;
}

function CardContent({ className, ...props }: ComponentProps<typeof BaseCardContent>) {
  return <BaseCardContent className={cn("px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5", className)} {...props} />;
}

function normalizeSection(value: string | null | undefined): HrSection | null {
  return value && hrSections.has(value as HrSection) ? value as HrSection : null;
}

const leaveStatusLabel: Record<HrLeaveStatus, string> = {
  draft: "Draft",
  submitted: "Diajukan",
  waiting_supervisor_approval: "Menunggu Atasan",
  waiting_authorized_officer_approval: "Menunggu Pejabat",
  approved: "Disetujui",
  rejected: "Ditolak",
  revision_required: "Perlu Revisi",
  cancelled: "Dibatalkan",
};

const leaveStatusVariant: Record<HrLeaveStatus, "default" | "outline" | "success" | "warning" | "danger" | "muted"> = {
  draft: "muted",
  submitted: "default",
  waiting_supervisor_approval: "warning",
  waiting_authorized_officer_approval: "warning",
  approved: "success",
  rejected: "danger",
  revision_required: "warning",
  cancelled: "muted",
};

const submissionTypeLabels: Record<HrSubmissionType, string> = {
  pck: "PCK",
  skp: "SKP",
  wfa: "WFA",
};

const attendanceLabels: Record<HrAttendancePermissionType, string> = {
  late_arrival: "Lambat Datang",
  early_leave: "Cepat Pulang",
};

const employmentStatusLabels: Record<string, string> = {
  pns: "PNS",
  pppk: "PPPK",
  cpns: "CPNS",
  pejabat_negara: "Pejabat Negara",
  honorer: "Honorer/PPNPN",
  lainnya: "Lainnya",
};

function formatEmploymentStatus(employee: EmployeeProfileDto) {
  return employee.employmentStatusLabel || employmentStatusLabels[employee.employmentStatus] || employee.employmentStatus || "-";
}

function isStateOfficialEmployee(employee: EmployeeProfileDto | null | undefined) {
  if (!employee) return false;
  return employee.isStateOfficial || employee.employmentStatus === "pejabat_negara";
}

const signatureRoleOptions = [
  ["employee", "Pegawai / Pemohon"],
  ["supervisor", "Atasan Langsung"],
  ["authorized_officer", "Pejabat Berwenang"],
  ["chairperson", "Ketua"],
  ["vice_chairperson", "Wakil Ketua"],
  ["secretary", "Sekretaris"],
  ["registrar", "Panitera"],
  ["hr_officer", "Kasubag Kepegawaian dan Ortala"],
] as const;

const signatureRoleLabel: Record<string, string> = Object.fromEntries(signatureRoleOptions);

const workflowStepOptions = [
  ["supervisor", "Atasan langsung", "Pemeriksaan awal oleh atasan langsung pegawai."],
  ["hr_officer", "Kasubag Kepegawaian", "Validasi administrasi cuti dan dokumen pendukung."],
  ["secretary", "Sekretaris", "Pemeriksaan administratif tingkat sekretaris."],
  ["registrar", "Panitera", "Pemeriksaan untuk kebutuhan kepaniteraan."],
  ["vice_chairperson", "Wakil Ketua", "Pemeriksaan pimpinan sebelum final bila diperlukan."],
  ["chairperson", "Ketua", "Persetujuan pimpinan pengadilan."],
  ["authorized_officer", "Pejabat berwenang", "Persetujuan final sesuai pejabat yang ditentukan di profil pegawai."],
] as const;

const workflowStepLabels: Record<string, string> = Object.fromEntries(workflowStepOptions.map(([value, label]) => [value, label]));

function findWorkflowApprover(step: string, employees: EmployeeProfileDto[]) {
  const normalized = (value: string) => value.toLowerCase();
  if (step === "chairperson") {
    return employees.find((employee) => {
      const haystack = normalized(`${employee.positionName} ${employee.unitKerja}`);
      return haystack.includes("ketua") && !haystack.includes("wakil");
    }) ?? null;
  }

  const matchers: Record<string, string[]> = {
    hr_officer: ["kasubag kepegawaian", "kepegawaian", "ortala"],
    secretary: ["sekretaris"],
    registrar: ["panitera"],
    vice_chairperson: ["wakil ketua"],
  };
  const patterns = matchers[step] ?? [];
  if (!patterns.length) return null;

  return employees.find((employee) => {
    const haystack = normalized(`${employee.positionName} ${employee.unitKerja}`);
    return patterns.some((pattern) => haystack.includes(pattern));
  }) ?? null;
}

function resolveWorkflowApproverLabel(step: string, employee: EmployeeProfileDto | null, employees: EmployeeProfileDto[]) {
  if (step === "supervisor") {
    return employee?.supervisorName ?? "Belum diatur di profil pegawai";
  }
  if (step === "authorized_officer") {
    return employee?.approvalOfficerName ?? "Belum diatur di profil pegawai";
  }

  return findWorkflowApprover(step, employees)?.fullName ?? "Mengikuti pejabat/peran pada konfigurasi";
}

function formatEmployeeApprovalLine(employee: EmployeeProfileDto | null | undefined) {
  if (!employee) return "-";
  return `Atasan: ${employee.supervisorName ?? "belum diatur"} | Pejabat: ${employee.approvalOfficerName ?? "belum diatur"}`;
}

const exportTypeLabels: Record<HrExportType, string> = {
  cuti: "Rekap Cuti",
  pegawai: "Data Pegawai",
  setoran: "PCK/SKP/WFA",
  izin: "Izin Kehadiran",
  saldo: "Saldo Cuti",
  dokumen: "Dokumen Kepegawaian",
  sla: "Batas Waktu Persetujuan",
};

function parseWorkflowSteps(value: string) {
  const allowed = new Set(workflowStepOptions.map(([key]) => key));
  const steps = value.split(",").map((item) => item.trim()).filter((item) => allowed.has(item as typeof workflowStepOptions[number][0]));
  return steps.length ? Array.from(new Set(steps)) : ["supervisor", "authorized_officer"];
}

function serializeWorkflowSteps(steps: string[]) {
  return Array.from(new Set(steps)).join(",");
}

const initialLeaveForm = {
  employeeId: "",
  leaveTypeId: "",
  startDate: "",
  endDate: "",
  reason: "",
  addressDuringLeave: "",
  contactDuringLeave: "",
};

const initialSubmissionForm = {
  submissionType: "pck" as HrSubmissionType,
  title: "",
  periodYear: String(new Date().getFullYear()),
  periodMonth: "",
  submissionDate: new Date().toISOString().slice(0, 10),
  description: "",
};

const initialAttendanceForm = {
  permissionType: "late_arrival" as HrAttendancePermissionType,
  requestDate: new Date().toISOString().slice(0, 10),
  requestedTime: "",
  reason: "",
};

const initialMeetingForm = {
  title: "",
  meetingDate: new Date().toISOString().slice(0, 10),
  location: "",
  participants: "",
  summary: "",
  category: "umum",
  visibility: "internal",
};

const initialDocumentForm = {
  employeeId: "",
  category: "SK",
  documentNumber: "",
  documentDate: new Date().toISOString().slice(0, 10),
  title: "",
  description: "",
  visibility: "owner_admin",
};

const initialEmployeeForm = {
  id: "",
  employeeNumber: "",
  unitKerja: "",
  rankGrade: "",
  employmentStatus: "pns",
  supervisorEmployeeId: "",
  approvalOfficerEmployeeId: "",
  phone: "",
  email: "",
  isActive: true,
};

const initialLeaveTypeForm = {
  id: "",
  name: "",
  code: "",
  description: "",
  approvalWorkflow: "supervisor,authorized_officer",
  deductsAnnualBalance: true,
  requiresAttachment: false,
  maxDays: "",
  minDaysBeforeRequest: "",
  isActive: true,
  sortOrder: "100",
};

const initialBalanceForm = {
  employeeId: "",
  year: String(new Date().getFullYear()),
  balanceN: "12",
  balanceN1: "0",
  balanceN2: "0",
  reason: "",
};

const initialRequirementForm = {
  id: "",
  submissionType: "skp" as HrSubmissionType,
  name: "",
  periodYear: String(new Date().getFullYear()),
  dueDate: `${new Date().getFullYear()}-12-31`,
  targetRoleIds: "",
  targetPositionIds: "",
  isActive: true,
};

const initialNotificationTemplateForm = {
  id: "",
  templateKey: "",
  name: "",
  audience: "employee",
  eventType: "",
  body: "",
  isActive: true,
};

function employeeToForm(employee: EmployeeProfileDto) {
  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    unitKerja: employee.unitKerja,
    rankGrade: employee.rankGrade,
    employmentStatus: employee.employmentStatus,
    supervisorEmployeeId: employee.supervisorEmployeeId ?? "",
    approvalOfficerEmployeeId: employee.approvalOfficerEmployeeId ?? "",
    phone: employee.phone,
    email: employee.email,
    isActive: employee.isActive,
  };
}

function leaveTypeToForm(leaveType: LeaveTypeDto) {
  return {
    id: leaveType.id,
    name: leaveType.name,
    code: leaveType.code,
    description: leaveType.description,
    approvalWorkflow: leaveType.approvalWorkflow.join(","),
    deductsAnnualBalance: leaveType.deductsAnnualBalance,
    requiresAttachment: leaveType.requiresAttachment,
    maxDays: leaveType.maxDays ? String(leaveType.maxDays) : "",
    minDaysBeforeRequest: leaveType.minDaysBeforeRequest ? String(leaveType.minDaysBeforeRequest) : "",
    isActive: leaveType.isActive,
    sortOrder: String(leaveType.sortOrder),
  };
}

function notificationTemplateToForm(template: HrNotificationTemplateDto) {
  return {
    id: template.id,
    templateKey: template.templateKey,
    name: template.name,
    audience: template.audience,
    eventType: template.eventType,
    body: template.body,
    isActive: template.isActive,
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID").format(value);
}

function formatPercent(value: number | null | undefined) {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value ?? 0)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatFileSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 KB";
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(value / 1024))} KB`;
}

const pendingLeaveStatuses = new Set<HrLeaveStatus>([
  "submitted",
  "waiting_supervisor_approval",
  "waiting_authorized_officer_approval",
]);

function addClientIsoDays(date: string, days: number) {
  const cursor = new Date(`${date}T00:00:00Z`);
  cursor.setUTCDate(cursor.getUTCDate() + days);
  return cursor.toISOString().slice(0, 10);
}

function leaveRequestCoversDate(request: LeaveRequestDto, date: string) {
  return request.startDate <= date && request.endDate >= date;
}

function buildLeaveFormSimulation(
  data: HrDashboardDto | null,
  employeeId: string | null | undefined,
  startDate: string,
  endDate: string
): HrLeaveDailyImpactDto[] {
  if (!data || !employeeId || !startDate || !endDate || endDate < startDate) return [];

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const activeEmployeeIds = new Set(data.employees.filter((employee) => employee.isActive).map((employee) => employee.id));
  const totalEmployees = activeEmployeeIds.size;
  const rows: HrLeaveDailyImpactDto[] = [];

  for (let cursor = startDate; cursor <= endDate; cursor = addClientIsoDays(cursor, 1)) {
    const approvedRequests = data.leaveRequests.filter((request) => request.status === "approved" && leaveRequestCoversDate(request, cursor));
    const pendingRequests = data.leaveRequests.filter((request) => pendingLeaveStatuses.has(request.status) && leaveRequestCoversDate(request, cursor));
    const approvedEmployeeIds = new Set(approvedRequests.map((request) => request.employeeId).filter((id) => activeEmployeeIds.has(id)));
    const pendingEmployeeIds = new Set(pendingRequests.map((request) => request.employeeId).filter((id) => activeEmployeeIds.has(id)));
    const simulatedAdditionalEmployees = activeEmployeeIds.has(employeeId) && !approvedEmployeeIds.has(employeeId) ? 1 : 0;
    const totalOnLeaveWithSimulation = approvedEmployeeIds.size + simulatedAdditionalEmployees;

    rows.push({
      date: cursor,
      totalEmployees,
      approvedLeaveEmployees: approvedEmployeeIds.size,
      pendingLeaveEmployees: pendingEmployeeIds.size,
      simulatedAdditionalEmployees,
      totalOnLeaveWithSimulation,
      leavePercentage: totalEmployees ? Math.round((approvedEmployeeIds.size / totalEmployees) * 10000) / 100 : 0,
      simulatedLeavePercentage: totalEmployees ? Math.round((totalOnLeaveWithSimulation / totalEmployees) * 10000) / 100 : 0,
      approvedLeaveRequestIds: approvedRequests.map((request) => request.id),
      pendingLeaveRequestIds: pendingRequests.map((request) => request.id),
    });
  }

  return rows;
}

function MetricBox({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: typeof UsersRound;
}) {
  return (
    <Card className="border-border/80">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold text-foreground">{value}</p>
          <p className="text-sm leading-5 text-muted-foreground">{hint}</p>
        </div>
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-semibold text-foreground">{children}</label>;
}

function EmptyMini({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/35 px-4 py-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function LeaveImpactPreview({ rows, title = "Simulasi pegawai cuti" }: { rows: HrLeaveDailyImpactDto[]; title?: string }) {
  if (!rows.length) return null;

  const peak = rows.reduce((highest, item) => (
    item.simulatedLeavePercentage > highest.simulatedLeavePercentage ? item : highest
  ), rows[0] as HrLeaveDailyImpactDto);
  const visibleRows = rows.slice(0, 7);

  return (
    <section data-testid="leave-impact-preview" className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Puncak {formatDate(peak.date)}: {formatNumber(peak.totalOnLeaveWithSimulation)} dari {formatNumber(peak.totalEmployees)} pegawai ({formatPercent(peak.simulatedLeavePercentage)}).
          </p>
        </div>
        <Badge variant={peak.simulatedLeavePercentage >= 30 ? "warning" : "success"}>
          {formatPercent(peak.simulatedLeavePercentage)}
        </Badge>
      </div>
      <div className="grid gap-2">
        {visibleRows.map((row) => (
          <div key={row.date} className="grid gap-2 rounded-xl border border-border/80 bg-card/75 px-3 py-2 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="font-semibold text-foreground">{formatDate(row.date)}</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Aktual {formatNumber(row.approvedLeaveEmployees)} pegawai, proses {formatNumber(row.pendingLeaveEmployees)}, simulasi {formatNumber(row.totalOnLeaveWithSimulation)}.
              </p>
            </div>
            <span className="text-sm font-semibold text-primary">{formatPercent(row.simulatedLeavePercentage)}</span>
          </div>
        ))}
      </div>
      {rows.length > visibleRows.length ? (
        <p className="text-xs text-muted-foreground">Menampilkan {visibleRows.length} hari pertama dari {rows.length} tanggal.</p>
      ) : null}
    </section>
  );
}

function DashboardSection({
  data,
  setActiveSection,
  openAdminSettings,
}: {
  data: HrDashboardDto | null;
  setActiveSection: (section: HrSection) => void;
  openAdminSettings: () => void;
}) {
  if (!data) return <EmptyMini text="Data E-Kepegawaian belum tersedia." />;

  const balance = data?.currentEmployee
    ? data.leaveBalances.find((item) => item.employeeId === data.currentEmployee?.id)
    : null;

  if (data.permissions.roleView !== "employee") {
    const adminMode = data.permissions.roleView === "admin";
    const todayImpact = data.leaveStatistics.today;
    const monthlyPeak = data.leaveStatistics.monthlyPeak;
    const cards = adminMode
      ? [
          { label: "Permintaan cuti", value: data.metrics.totalLeaveRequests, section: "approval" as HrSection },
          { label: "Menunggu persetujuan", value: data.metrics.waitingApproval, section: "approval" as HrSection },
          { label: "Dokumen perlu verifikasi", value: data.metrics.submissionsWaitingVerification, section: "pck" as HrSection },
          { label: "Pegawai terpantau", value: data.metrics.totalEmployees, section: "pegawai" as HrSection },
        ]
      : [
          { label: "Perlu tindakan", value: data.metrics.waitingApproval, section: "approval" as HrSection },
          { label: "Dokumen masuk", value: data.metrics.submissionsWaitingVerification, section: "pck" as HrSection },
          { label: "Izin menunggu", value: data.metrics.attendanceWaitingApproval, section: "izin" as HrSection },
          { label: "Sedang cuti", value: data.metrics.employeesOnLeave, section: "pegawai" as HrSection },
        ];

    return (
      <div className="space-y-4">
        {adminMode ? (
          <Card className="border-primary/25 bg-primary/5">
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-semibold text-foreground">Konfigurasi E-Kepegawaian ada di Admin Dashboard ALETA</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Aturan N/N-1/N-2, jenis cuti, alur persetujuan, kalender libur, dan unggah dokumen dikelola dari menu admin.
                </p>
              </div>
              <Button onClick={openAdminSettings}>Buka Pengaturan Admin</Button>
            </CardContent>
          </Card>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <button key={card.label} type="button" onClick={() => setActiveSection(card.section)} className="rounded-[1.4rem] border border-border/80 bg-card/80 p-5 text-left shadow-sm transition hover:border-primary/35 hover:bg-primary/5">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{card.label}</p>
              <p className="mt-3 text-3xl font-semibold text-foreground">{card.value}</p>
              <p className="mt-2 text-sm text-muted-foreground">{adminMode ? "Buka monitoring" : "Buka tindak lanjut"}</p>
            </button>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border/80 bg-card/80 p-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cuti hari ini</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{formatPercent(todayImpact.leavePercentage)}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {formatNumber(todayImpact.approvedLeaveEmployees)} dari {formatNumber(todayImpact.totalEmployees)} pegawai aktif sedang cuti.
            </p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-card/80 p-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Permintaan proses</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{formatNumber(todayImpact.pendingLeaveEmployees)}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Permintaan cuti yang beririsan dengan hari ini dan belum final.</p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-card/80 p-5">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Puncak bulan ini</p>
            <p className="mt-3 text-3xl font-semibold text-foreground">{monthlyPeak ? formatPercent(monthlyPeak.leavePercentage) : "0%"}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {monthlyPeak ? `${formatDate(monthlyPeak.date)} dengan ${formatNumber(monthlyPeak.approvedLeaveEmployees)} pegawai cuti.` : "Belum ada cuti disetujui bulan ini."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Ringkasan Cuti Saya</CardTitle>
          <CardDescription>Saldo tahunan ditampilkan per sumber tahun agar pemakaian N, N-1, dan N-2 mudah dipantau.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">N</p>
            <p className="mt-2 text-3xl font-semibold">{balance?.balanceN ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">N-1</p>
            <p className="mt-2 text-3xl font-semibold">{balance?.balanceN1 ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">N-2</p>
            <p className="mt-2 text-3xl font-semibold">{balance?.balanceN2 ?? 0}</p>
          </div>
          <div className="sm:col-span-3 rounded-2xl border border-primary/25 bg-primary/10 p-4">
            <p className="text-sm text-muted-foreground">Sisa tersedia</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{balance?.availableDays ?? 0} hari</p>
            <p className="mt-1 text-sm text-muted-foreground">Terpakai {balance?.usedDays ?? 0} hari, proses {balance?.pendingDays ?? 0} hari.</p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-border/80">
        <CardHeader>
          <CardTitle>Aksi Cepat</CardTitle>
          <CardDescription>Gunakan menu ini untuk mengirim permintaan tanpa keluar dari ALETA.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {[
            ["Ajukan Cuti", "cuti"],
            ["Setor PCK", "pck"],
            ["Setor SKP", "skp"],
            ["Setor WFA", "wfa"],
            ["Izin Kehadiran", "izin"],
            ["Dokumen Saya", "dokumen"],
          ].map(([label, section]) => (
            <Button key={section} variant="outline" onClick={() => setActiveSection(section as HrSection)}>
              {label}
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function getScopedEmployeeName(data: HrDashboardDto | null, employeeId: string) {
  return data?.employees.find((employee) => employee.id === employeeId)?.fullName ?? "-";
}

export function EKepegawaianPanel({
  initialSection,
  settingsOnly = false,
}: {
  initialSection?: HrSection;
  settingsOnly?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSection = normalizeSection(searchParams.get("section"));
  const [data, setData] = useState<HrDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [activeSection, setActiveSection] = useState<HrSection>(initialSection ?? requestedSection ?? "dashboard");
  const [leaveForm, setLeaveForm] = useState(initialLeaveForm);
  const [submissionForm, setSubmissionForm] = useState(initialSubmissionForm);
  const [attendanceForm, setAttendanceForm] = useState(initialAttendanceForm);
  const [meetingForm, setMeetingForm] = useState(initialMeetingForm);
  const [documentForm, setDocumentForm] = useState(initialDocumentForm);
  const [employeeForm, setEmployeeForm] = useState(initialEmployeeForm);
  const [leaveFile, setLeaveFile] = useState<File | null>(null);
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [attendanceFile, setAttendanceFile] = useState<File | null>(null);
  const [meetingFile, setMeetingFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [leaveTemplateFile, setLeaveTemplateFile] = useState<File | null>(null);
  const [employeeImportFile, setEmployeeImportFile] = useState<File | null>(null);
  const [signatureEmployeeId, setSignatureEmployeeId] = useState("");
  const [signatureRole, setSignatureRole] = useState("employee");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [calendarUnitFilter, setCalendarUnitFilter] = useState("all");
  const [draggedWorkflowIndex, setDraggedWorkflowIndex] = useState<number | null>(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [leavePreviewId, setLeavePreviewId] = useState("");
  const [submissionVerificationNotes, setSubmissionVerificationNotes] = useState<Record<string, string>>({});
  const [attachmentVerificationNotes, setAttachmentVerificationNotes] = useState<Record<string, string>>({});
  const [slaFilter, setSlaFilter] = useState<"all" | "overdue" | "normal">("all");
  const [settingsForm, setSettingsForm] = useState({
    moduleEnabled: true,
    annualLeaveDefaultDays: "12",
    defaultBalanceN: "12",
    defaultBalanceN1: "0",
    defaultBalanceN2: "0",
    calculationType: "working_days",
    balanceUsageOrder: "N-2,N-1,N",
    maxUploadSizeMb: "10",
    allowedFileTypes: "pdf,doc,docx,xls,xlsx,jpg,jpeg,png",
    requestNumberFormat: "CUTI/{TAHUN}/{BULAN}/{NOMOR}",
    approvalSlaDays: "2",
    annualReminderDaysBefore: "14",
    annualReminderSchedulerEnabled: false,
    annualReminderSchedulerTime: "08:00",
    annualReminderSchedulerLastRunAt: null as string | null,
    annualReminderSchedulerLastMessage: "",
    leaveFormTemplateFileName: "",
    leaveFormTemplateOriginalName: "",
  });
  const [leaveTypeForm, setLeaveTypeForm] = useState(initialLeaveTypeForm);
  const [balanceForm, setBalanceForm] = useState(initialBalanceForm);
  const [requirementForm, setRequirementForm] = useState(initialRequirementForm);
  const [notificationTemplateForm, setNotificationTemplateForm] = useState(initialNotificationTemplateForm);
  const [employeeImportText, setEmployeeImportText] = useState("nip,unit,pangkat,status,atasan_nip,approval_nip,wa,email");
  const [holidayImportText, setHolidayImportText] = useState("2026-01-01,Tahun Baru,holiday,0");
  const [reportFilters, setReportFilters] = useState({
    type: "cuti" as HrExportType,
    employeeId: "all",
    unit: "all",
    status: "all",
    year: "all",
    month: "all",
    leaveTypeId: "all",
    submissionType: "all",
    documentCategory: "all",
    slaStatus: "all",
    keyword: "",
  });
  const selectedEmployeeForForm = useMemo(
    () => data?.employees.find((employee) => employee.id === employeeForm.id) ?? null,
    [data?.employees, employeeForm.id]
  );
  const selectedEmployeeIsStateOfficial = isStateOfficialEmployee(selectedEmployeeForForm);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(apiPath("/api/e-kepegawaian/dashboard"), {
        cache: "no-store",
        credentials: "include",
      });
      const result = await response.json() as ApiResponse<HrDashboardDto>;
      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.error?.message ?? "Gagal memuat E-Kepegawaian.");
      }

      setData(result.data);
      setLeaveForm((current) => ({
        ...current,
        employeeId: current.employeeId || result.data?.currentEmployee?.id || "",
        leaveTypeId: current.leaveTypeId || result.data?.leaveTypes.find((item) => item.isActive)?.id || "",
        contactDuringLeave: current.contactDuringLeave || result.data?.currentEmployee?.phone || "",
      }));
      setDocumentForm((current) => ({
        ...current,
        employeeId: current.employeeId || result.data?.currentEmployee?.id || "",
      }));
      setSettingsForm({
        moduleEnabled: result.data.settings.moduleEnabled,
        annualLeaveDefaultDays: String(result.data.settings.annualLeaveDefaultDays),
        defaultBalanceN: String(result.data.settings.defaultBalanceN),
        defaultBalanceN1: String(result.data.settings.defaultBalanceN1),
        defaultBalanceN2: String(result.data.settings.defaultBalanceN2),
        calculationType: result.data.settings.calculationType,
        balanceUsageOrder: result.data.settings.balanceUsageOrder.join(","),
        maxUploadSizeMb: String(result.data.settings.maxUploadSizeMb),
        allowedFileTypes: result.data.settings.allowedFileTypes.join(","),
        requestNumberFormat: result.data.settings.requestNumberFormat,
        approvalSlaDays: String(result.data.settings.approvalSlaDays),
        annualReminderDaysBefore: String(result.data.settings.annualReminderDaysBefore),
        annualReminderSchedulerEnabled: result.data.settings.annualReminderSchedulerEnabled,
        annualReminderSchedulerTime: result.data.settings.annualReminderSchedulerTime.slice(0, 5),
        annualReminderSchedulerLastRunAt: result.data.settings.annualReminderSchedulerLastRunAt,
        annualReminderSchedulerLastMessage: result.data.settings.annualReminderSchedulerLastMessage,
        leaveFormTemplateFileName: result.data.settings.leaveFormTemplateFileName,
        leaveFormTemplateOriginalName: result.data.settings.leaveFormTemplateOriginalName,
      });
      setEmployeeForm((current) => current.id ? current : result.data?.employees[0] ? employeeToForm(result.data.employees[0]) : current);
      setLeaveTypeForm((current) => current.id ? current : result.data?.leaveTypes[0] ? leaveTypeToForm(result.data.leaveTypes[0]) : current);
      setBalanceForm((current) => current.employeeId ? current : {
        ...initialBalanceForm,
        employeeId: result.data?.employees[0]?.id ?? "",
        balanceN: String(result.data?.settings.defaultBalanceN ?? 12),
        balanceN1: String(result.data?.settings.defaultBalanceN1 ?? 0),
        balanceN2: String(result.data?.settings.defaultBalanceN2 ?? 0),
      });
      setSignatureEmployeeId((current) => current || result.data?.employees[0]?.id || "");
      setRequirementForm((current) => current.id ? current : result.data?.documentRequirements[0] ? {
        id: result.data.documentRequirements[0].id,
        submissionType: result.data.documentRequirements[0].submissionType,
        name: result.data.documentRequirements[0].name,
        periodYear: String(result.data.documentRequirements[0].periodYear),
        dueDate: result.data.documentRequirements[0].dueDate,
        targetRoleIds: result.data.documentRequirements[0].targetRoleIds.join(","),
        targetPositionIds: result.data.documentRequirements[0].targetPositionIds.join(","),
        isActive: result.data.documentRequirements[0].isActive,
      } : current);
      setNotificationTemplateForm((current) => current.id ? current : result.data?.notificationTemplates[0] ? notificationTemplateToForm(result.data.notificationTemplates[0]) : current);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Gagal memuat data E-Kepegawaian.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const signatureFilePreviewUrl = useMemo(() => signatureFile ? URL.createObjectURL(signatureFile) : "", [signatureFile]);

  useEffect(() => {
    return () => {
      if (signatureFilePreviewUrl) URL.revokeObjectURL(signatureFilePreviewUrl);
    };
  }, [signatureFilePreviewUrl]);

  async function runAction<T>(action: string, payload: unknown, successMessage: string) {
    setBusyAction(action);
    setNotice({ type: "info", message: "Memproses perubahan E-Kepegawaian..." });
    try {
      const response = await fetch(apiPath("/api/e-kepegawaian/actions"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, payload }),
      });
      const result = await response.json() as ApiResponse<T>;
      if (!response.ok || !result.ok) {
        throw new Error(result.error?.message ?? "Proses gagal.");
      }
      setNotice({ type: "success", message: successMessage });
      await loadDashboard();
      return result.data ?? null;
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Proses gagal.",
      });
      return null;
    } finally {
      setBusyAction(null);
    }
  }

  async function uploadAttachment(entityType: string, entityId: string, file: File | null, extraFields?: Record<string, string>) {
    if (!file) return true;

    setBusyAction(`upload-${entityType}`);
    setNotice({ type: "info", message: "Mengunggah lampiran E-Kepegawaian..." });
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);
      Object.entries(extraFields ?? {}).forEach(([key, value]) => formData.append(key, value));
      const response = await fetch(apiPath("/api/e-kepegawaian/upload"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await response.json() as ApiResponse<{ filePath: string }>;
      if (!response.ok || !result.ok) {
        throw new Error(result.error?.message ?? "Unggah lampiran gagal.");
      }
      setNotice({ type: "success", message: "Lampiran berhasil diunggah." });
      return true;
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unggah lampiran gagal.",
      });
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  const selectedLeaveType = useMemo(
    () => data?.leaveTypes.find((item) => item.id === leaveForm.leaveTypeId) ?? null,
    [data?.leaveTypes, leaveForm.leaveTypeId]
  );
  const selectedLeaveEmployee = useMemo(
    () => data?.employees.find((item) => item.id === (leaveForm.employeeId || data.currentEmployee?.id)) ?? data?.currentEmployee ?? null,
    [data, leaveForm.employeeId]
  );
  const selectedLeaveWorkflow = useMemo(() => {
    const steps = selectedLeaveType?.approvalWorkflow?.length ? selectedLeaveType.approvalWorkflow : ["supervisor", "authorized_officer"];
    return steps.map((step, index) => ({
      step,
      index,
      label: workflowStepLabels[step] ?? step,
      approverName: resolveWorkflowApproverLabel(step, selectedLeaveEmployee, data?.employees ?? []),
    }));
  }, [data?.employees, selectedLeaveEmployee, selectedLeaveType]);
  const selectedBalance = useMemo(
    () => data?.leaveBalances.find((item) => item.employeeId === (leaveForm.employeeId || data.currentEmployee?.id)) ?? null,
    [data, leaveForm.employeeId]
  );
  const leaveSimulationRows = useMemo(
    () => buildLeaveFormSimulation(data, selectedLeaveEmployee?.id, leaveForm.startDate, leaveForm.endDate),
    [data, leaveForm.endDate, leaveForm.startDate, selectedLeaveEmployee?.id]
  );
  const leavePreviewRequest = useMemo(
    () => data?.leaveRequests.find((request) => request.id === leavePreviewId) ?? null,
    [data?.leaveRequests, leavePreviewId]
  );
  const leavePdfPreviewUrl = leavePreviewRequest
    ? apiPath(`/api/e-kepegawaian/cuti/${encodeURIComponent(leavePreviewRequest.id)}/form-pdf?disposition=inline`)
    : "";
  const pendingApprovals = useMemo(
    () => data?.leaveRequests.filter((request) => request.status === "waiting_supervisor_approval" || request.status === "waiting_authorized_officer_approval") ?? [],
    [data?.leaveRequests]
  );
  const calendarUnits = useMemo(
    () => Array.from(new Set((data?.calendarItems ?? []).map((item) => item.unitKerja).filter(Boolean))).sort((a, b) => a.localeCompare(b, "id-ID")),
    [data?.calendarItems]
  );
  const calendarMonthCells = useMemo(() => {
    const [yearValue, monthValue] = calendarMonth.split("-").map(Number);
    const year = Number.isFinite(yearValue) ? yearValue : new Date().getFullYear();
    const monthIndex = Number.isFinite(monthValue) ? monthValue - 1 : new Date().getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const offset = (firstDay.getDay() + 6) % 7;
    const start = new Date(year, monthIndex, 1 - offset);
    const events = (data?.calendarItems ?? []).filter((item) => calendarUnitFilter === "all" || item.unitKerja === calendarUnitFilter);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const iso = date.toISOString().slice(0, 10);
      return {
        iso,
        day: date.getDate(),
        currentMonth: date.getMonth() === monthIndex,
        today: iso === new Date().toISOString().slice(0, 10),
        events: events.filter((item) => item.startDate <= iso && item.endDate >= iso),
      };
    });
  }, [calendarMonth, calendarUnitFilter, data?.calendarItems]);
  const workflowSteps = useMemo(() => parseWorkflowSteps(leaveTypeForm.approvalWorkflow), [leaveTypeForm.approvalWorkflow]);
  const roleView = data?.permissions.roleView ?? "employee";
  const sidebarItems = useMemo<Array<{ id: HrSection; label: string; description: string; adminOnly?: boolean }>>(() => {
    if (settingsOnly) {
      return [
        { id: "settings", label: "Konfigurasi Umum", description: "Aturan cuti, unggah dokumen, kalender, dan alur persetujuan." },
        { id: "saldo", label: "Saldo Cuti", description: "Koreksi manual N, N-1, dan N-2." },
        { id: "kalender", label: "Kalender Cuti", description: "Cuti disetujui, libur, dan batas waktu persetujuan." },
        { id: "tandatangan", label: "Tanda Tangan", description: "Foto tanda tangan pegawai dan pejabat." },
        { id: "reminder", label: "Pengingat Dokumen", description: "SKP, PCK, WFA, dan dokumen tahunan." },
        { id: "notifikasi", label: "Pesan WhatsApp", description: "Isi pesan ALETA Bot per kejadian kepegawaian." },
        { id: "import", label: "Impor Pegawai", description: "Sinkron awal data dari Excel/CSV." },
        { id: "pegawai", label: "Data Pegawai", description: "Profil dan relasi persetujuan pegawai." },
        { id: "rekap", label: "Ekspor & Rekap", description: "Laporan Excel/PDF E-Kepegawaian." },
      ];
    }

    if (roleView === "admin") {
      return [
        { id: "dashboard", label: "Dashboard Admin", description: "Monitoring global kepegawaian." },
        { id: "approval", label: "Persetujuan & Validasi", description: "Permintaan cuti, izin, dan dokumen." },
        { id: "pck", label: "Verifikasi PCK", description: "Periksa setoran PCK pegawai." },
        { id: "skp", label: "Verifikasi SKP", description: "Periksa setoran SKP pegawai." },
        { id: "wfa", label: "Verifikasi WFA", description: "Periksa laporan WFA pegawai." },
        { id: "izin", label: "Izin Kehadiran", description: "Monitoring lambat datang dan cepat pulang." },
        { id: "pegawai", label: "Monitoring Pegawai", description: "Profil, atasan, dan pejabat persetujuan." },
        { id: "dokumen", label: "Dokumen Kepegawaian", description: "Lampiran dan arsip kepegawaian." },
        { id: "rapat", label: "Hasil Rapat", description: "Catatan dan dokumen rapat." },
        { id: "rekap", label: "Rekap & Ekspor", description: "Excel/PDF dan saldo cuti." },
      ];
    }

    if (roleView === "approver") {
      const approverItems: Array<{ id: HrSection; label: string; description: string; adminOnly?: boolean }> = [
        { id: "dashboard", label: "Dashboard Persetujuan", description: "Permintaan yang perlu ditindaklanjuti." },
        { id: "approval", label: "Permintaan Cuti", description: "Setujui, tolak, atau minta revisi." },
        { id: "pck", label: "Verifikasi PCK", description: "Periksa setoran PCK pegawai." },
        { id: "skp", label: "Verifikasi SKP", description: "Periksa setoran SKP pegawai." },
        { id: "wfa", label: "Verifikasi WFA", description: "Periksa laporan WFA pegawai." },
        { id: "pegawai", label: "Monitoring Pegawai", description: "Pegawai dan proses kepegawaian." },
        { id: "rekap", label: "Riwayat Persetujuan", description: "Jejak persetujuan dan catatan." },
      ];
      if (data?.permissions.canManageSignatures) {
        approverItems.push({ id: "tandatangan", label: "Tanda Tangan", description: "Kelola foto tanda tangan pegawai/pejabat." });
      }
      return approverItems;
    }

    return [
      { id: "dashboard", label: "Ringkasan Saya", description: "Saldo, cuti, dan status pribadi." },
      { id: "cuti", label: "Ajukan Cuti", description: "Form cuti dan riwayat saya." },
      { id: "pck", label: "PCK", description: "Setor PCK pribadi." },
      { id: "skp", label: "SKP", description: "Setor SKP pribadi." },
      { id: "wfa", label: "WFA", description: "Setor laporan WFA." },
      { id: "izin", label: "Izin Kehadiran", description: "Lambat datang atau cepat pulang." },
      { id: "dokumen", label: "Dokumen Saya", description: "Dokumen kepegawaian pribadi." },
    ];
  }, [data?.permissions.canManageSignatures, roleView, settingsOnly]);
  const routeActiveSection = !settingsOnly && requestedSection ? requestedSection : activeSection;
  const visibleActiveSection = sidebarItems.some((item) => item.id === routeActiveSection)
    ? routeActiveSection
    : sidebarItems[0]?.id ?? "dashboard";
  const currentSubmissionType: HrSubmissionType =
    visibleActiveSection === "pck" || visibleActiveSection === "skp" || visibleActiveSection === "wfa"
      ? visibleActiveSection
      : submissionForm.submissionType;
  const employeeUnits = useMemo(
    () => Array.from(new Set((data?.employees ?? []).map((employee) => employee.unitKerja).filter(Boolean))).sort((a, b) => a.localeCompare(b, "id-ID")),
    [data?.employees]
  );
  const reportYears = useMemo(() => {
    const values = new Set<string>([String(new Date().getFullYear())]);
    (data?.leaveRequests ?? []).forEach((item) => values.add(item.startDate.slice(0, 4)));
    (data?.submissions ?? []).forEach((item) => values.add(String(item.periodYear)));
    (data?.attendancePermissions ?? []).forEach((item) => values.add(item.requestDate.slice(0, 4)));
    (data?.leaveBalances ?? []).forEach((item) => values.add(String(item.year)));
    return Array.from(values).filter(Boolean).sort((a, b) => Number(b) - Number(a));
  }, [data?.attendancePermissions, data?.leaveBalances, data?.leaveRequests, data?.submissions]);
  const documentCategories = useMemo(
    () => Array.from(new Set((data?.employeeDocuments ?? []).map((item) => item.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "id-ID")),
    [data?.employeeDocuments]
  );
  const attachmentsBySubmission = useMemo(() => {
    const map = new Map<string, HrAttachmentDto[]>();
    for (const attachment of data?.attachments ?? []) {
      if (attachment.entityType !== "submission") continue;
      const current = map.get(attachment.entityId) ?? [];
      current.push(attachment);
      map.set(attachment.entityId, current);
    }
    return map;
  }, [data?.attachments]);
  const visibleSlaItems = useMemo(() => {
    const items = data?.slaItems ?? [];
    if (slaFilter === "overdue") return items.filter((item) => item.overdue);
    if (slaFilter === "normal") return items.filter((item) => !item.overdue);
    return items;
  }, [data?.slaItems, slaFilter]);
  const slaSummary = useMemo(() => {
    const items = data?.slaItems ?? [];
    const overdue = items.filter((item) => item.overdue);
    const longest = items.reduce((max, item) => Math.max(max, item.daysWaiting), 0);
    const average = items.length ? Math.round(items.reduce((total, item) => total + item.daysWaiting, 0) / items.length) : 0;
    return { total: items.length, overdue: overdue.length, normal: items.length - overdue.length, longest, average };
  }, [data?.slaItems]);

  const selectSection = useCallback((section: HrSection) => {
    setActiveSection(section);
    if (section === "pck" || section === "skp" || section === "wfa") {
      setSubmissionForm((current) => ({ ...current, submissionType: section }));
    }
    if (!settingsOnly) {
      router.replace(`/e-kepegawaian?section=${section}`, { scroll: false });
    }
  }, [router, settingsOnly]);

  const isBusy = Boolean(busyAction);

  async function saveLeave(mode: "draft" | "submit") {
    const action = mode === "draft" ? "save-leave-draft" : "submit-leave";
    const result = await runAction<LeaveRequestDto>(action, leaveForm, mode === "draft" ? "Draft cuti tersimpan." : "Permohonan cuti diajukan.");
    if (result?.id) {
      setLeavePreviewId(result.id);
      await uploadAttachment("leave_request", result.id, leaveFile);
      setLeaveFile(null);
      await loadDashboard();
    }
  }

  async function saveSubmission() {
    const result = await runAction<HrSubmissionDto>("create-submission", {
      ...submissionForm,
      submissionType: currentSubmissionType,
    }, "Setoran kepegawaian tersimpan.");
    if (result?.id) {
      await uploadAttachment("submission", result.id, submissionFile);
      setSubmissionFile(null);
      await loadDashboard();
    }
  }

  async function verifySubmissionAttachment(attachment: HrAttachmentDto, status: NonNullable<HrAttachmentDto["verificationStatus"]>) {
    const note = attachmentVerificationNotes[attachment.id] ?? "";
    const label = status === "verified" ? "Lampiran diverifikasi." : status === "rejected" ? "Lampiran ditolak." : status === "revision_required" ? "Lampiran diminta revisi." : "Status lampiran diperbarui.";
    await runAction("verify-submission-attachment", {
      attachmentId: attachment.id,
      status,
      note,
    }, label);
  }

  async function saveAttendance() {
    const result = await runAction<AttendancePermissionDto>("create-attendance-permission", attendanceForm, "Izin kehadiran diajukan.");
    if (result?.id) {
      await uploadAttachment("attendance_permission", result.id, attendanceFile);
      setAttendanceFile(null);
      await loadDashboard();
    }
  }

  async function saveMeeting() {
    const result = await runAction<MeetingResultDto>("create-meeting-result", meetingForm, "Hasil rapat tersimpan.");
    if (result?.id) {
      await uploadAttachment("meeting_result", result.id, meetingFile);
      setMeetingFile(null);
      await loadDashboard();
    }
  }

  async function saveDocument() {
    const result = await runAction<EmployeeDocumentDto>("create-employee-document", documentForm, "Dokumen kepegawaian tersimpan.");
    if (result?.id) {
      await uploadAttachment("employee_document", result.id, documentFile);
      setDocumentFile(null);
      await loadDashboard();
    }
  }

  async function saveEmployeeProfile() {
    const result = await runAction<EmployeeProfileDto>("update-employee-profile", employeeForm, "Profil pegawai diperbarui.");
    if (result?.id) {
      setEmployeeForm(employeeToForm(result));
    }
  }

  async function saveLeaveType() {
    const saved = await runAction<LeaveTypeDto[]>("upsert-leave-type", {
      ...leaveTypeForm,
      maxDays: leaveTypeForm.maxDays ? Number(leaveTypeForm.maxDays) : null,
      minDaysBeforeRequest: leaveTypeForm.minDaysBeforeRequest ? Number(leaveTypeForm.minDaysBeforeRequest) : null,
      sortOrder: Number(leaveTypeForm.sortOrder || 100),
      approvalWorkflow: parseWorkflowSteps(leaveTypeForm.approvalWorkflow),
    }, "Jenis cuti dan alur persetujuan disimpan.");

    if (saved?.length) {
      const selected = saved.find((item) => item.code === leaveTypeForm.code.toUpperCase()) ?? saved[0];
      setLeaveTypeForm(leaveTypeToForm(selected));
    }
  }

  async function saveBalanceAdjustment() {
    const result = await runAction("adjust-leave-balance", {
      ...balanceForm,
      year: Number(balanceForm.year),
      balanceN: Number(balanceForm.balanceN),
      balanceN1: Number(balanceForm.balanceN1),
      balanceN2: Number(balanceForm.balanceN2),
    }, "Saldo cuti pegawai berhasil dikoreksi.");
    if (result) {
      setBalanceForm((current) => ({ ...current, reason: "" }));
    }
  }

  async function saveSignature() {
    if (!signatureEmployeeId || !signatureFile) {
      setNotice({ type: "error", message: "Pilih pegawai dan file foto tanda tangan terlebih dahulu." });
      return;
    }
    await uploadAttachment("employee_signature", signatureEmployeeId, signatureFile, { signatureRole });
    setSignatureFile(null);
    await loadDashboard();
  }

  async function saveLeaveTemplate() {
    if (!leaveTemplateFile) {
      setNotice({ type: "error", message: "Pilih file PDF template formulir cuti terlebih dahulu." });
      return;
    }
    await uploadAttachment("leave_form_template", "global", leaveTemplateFile);
    setLeaveTemplateFile(null);
    await loadDashboard();
  }

  async function saveDocumentRequirement() {
    const result = await runAction("upsert-document-requirement", {
      ...requirementForm,
      periodYear: Number(requirementForm.periodYear),
      targetRoleIds: requirementForm.targetRoleIds.split(",").map((item) => item.trim()).filter(Boolean),
      targetPositionIds: requirementForm.targetPositionIds.split(",").map((item) => item.trim()).filter(Boolean),
    }, "Pengingat dokumen tahunan disimpan.");
    if (result) {
      await loadDashboard();
    }
  }

  async function saveNotificationTemplate() {
    const saved = await runAction<HrNotificationTemplateDto[]>("upsert-notification-template", notificationTemplateForm, "Template notifikasi WhatsApp disimpan.");
    if (saved?.length) {
      const selected = saved.find((item) => item.templateKey === notificationTemplateForm.templateKey) ?? saved[0];
      setNotificationTemplateForm(notificationTemplateToForm(selected));
    }
  }

  async function importEmployees() {
    await runAction("import-employee-profiles", { text: employeeImportText }, "Impor data pegawai selesai diproses.");
  }

  async function importEmployeesFromFile() {
    if (!employeeImportFile) {
      setNotice({ type: "error", message: "Pilih file .xlsx atau .csv terlebih dahulu." });
      return;
    }

    setBusyAction("import-employee-file");
    setNotice({ type: "info", message: "Membaca file impor pegawai..." });
    try {
      const formData = new FormData();
      formData.append("file", employeeImportFile);
      const response = await fetch(apiPath("/api/e-kepegawaian/import-pegawai"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const result = await response.json() as ApiResponse<{ updated: number; skipped: number }>;
      if (!response.ok || !result.ok) {
        throw new Error(result.error?.message ?? "Impor file pegawai gagal.");
      }
      setNotice({ type: "success", message: `Impor file selesai. Diperbarui ${result.data?.updated ?? 0}, dilewati ${result.data?.skipped ?? 0}.` });
      setEmployeeImportFile(null);
      await loadDashboard();
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Impor file pegawai gagal.",
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function runDocumentReminders(requirementId?: string) {
    await runAction("run-document-reminders", { requirementId }, "Pengingat dokumen diproses ke antrean ALETA Bot.");
  }

  async function runDocumentReminderScheduler() {
    await runAction("run-document-reminder-scheduler", { force: true }, "Penjadwal pengingat dokumen dijalankan.");
  }

  async function runSlaReminders() {
    await runAction("run-sla-reminders", {}, "Pengingat batas waktu persetujuan diproses ke antrean ALETA Bot.");
  }

  function openExport(type: HrExportType, format: "xlsx" | "pdf" | "csv") {
    const params = new URLSearchParams({ type, format });
    Object.entries(reportFilters).forEach(([key, value]) => {
      if (key === "type") return;
      const normalized = String(value ?? "").trim();
      if (normalized && normalized !== "all") params.set(key, normalized);
    });
    window.open(apiPath(`/api/e-kepegawaian/export?${params.toString()}`), "_blank", "noopener,noreferrer");
  }

  function openHrFile(fileName: string, disposition: "inline" | "attachment") {
    window.open(apiPath(`/api/e-kepegawaian/files/${encodeURIComponent(fileName)}?disposition=${disposition}`), "_blank", "noopener,noreferrer");
  }

  function leavePdfUrl(requestId: string, disposition: "inline" | "attachment") {
    return apiPath(`/api/e-kepegawaian/cuti/${encodeURIComponent(requestId)}/form-pdf?disposition=${disposition}`);
  }

  function openLeavePdf(requestId: string, disposition: "inline" | "attachment") {
    window.open(leavePdfUrl(requestId, disposition), "_blank", "noopener,noreferrer");
  }

  function updateWorkflowSteps(updater: (steps: string[]) => string[]) {
    setLeaveTypeForm((current) => ({
      ...current,
      approvalWorkflow: serializeWorkflowSteps(updater(parseWorkflowSteps(current.approvalWorkflow))),
    }));
  }

  function moveWorkflowStep(index: number, direction: -1 | 1) {
    updateWorkflowSteps((steps) => {
      const next = [...steps];
      const target = index + direction;
      if (target < 0 || target >= next.length) return next;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addWorkflowStep(step: string) {
    updateWorkflowSteps((steps) => steps.includes(step) ? steps : [...steps, step]);
  }

  function removeWorkflowStep(index: number) {
    updateWorkflowSteps((steps) => steps.filter((_, stepIndex) => stepIndex !== index));
  }

  function dropWorkflowStep(targetIndex: number) {
    if (draggedWorkflowIndex === null || draggedWorkflowIndex === targetIndex) return;
    updateWorkflowSteps((steps) => {
      const next = [...steps];
      const [picked] = next.splice(draggedWorkflowIndex, 1);
      next.splice(targetIndex, 0, picked);
      return next;
    });
    setDraggedWorkflowIndex(null);
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/80 px-5 py-4 text-sm text-muted-foreground shadow-panel">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Memuat modul E-Kepegawaian...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={settingsOnly ? "Pengaturan Admin" : roleView === "approver" ? "Persetujuan Kepegawaian" : "Portal Kepegawaian"}
        title={settingsOnly ? "Pengaturan E-Kepegawaian" : "E-Kepegawaian"}
        description={
          settingsOnly
            ? "Konfigurasi cuti N/N-1/N-2, jenis cuti, alur persetujuan, kalender libur, unggah dokumen, dan ekspor E-Kepegawaian."
            : roleView === "admin"
            ? "Monitoring operasional E-Kepegawaian. Konfigurasi teknis tetap dikelola dari admin dashboard ALETA."
            : roleView === "approver"
            ? "Tinjau permintaan cuti, verifikasi dokumen, dan pantau proses kepegawaian sesuai kewenangan."
            : "Ajukan cuti, lihat saldo N/N-1/N-2, unggah dokumen PCK/SKP/WFA, dan pantau status pengajuan Anda."
        }
        actions={(
          <div className="flex flex-wrap gap-2">
            {!settingsOnly && roleView === "admin" ? (
              <Button onClick={() => router.push("/admin/e-kepegawaian")}>Pengaturan Admin</Button>
            ) : null}
            <Button variant="outline" onClick={loadDashboard} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Sinkronkan
            </Button>
          </div>
        )}
      />

      {notice ? (
        <div
          className={cn(
            "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
            notice.type === "success" && "border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
            notice.type === "error" && "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-200",
            notice.type === "info" && "border-primary/30 bg-primary/10 text-primary"
          )}
        >
          {notice.type === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : notice.type === "error" ? <XCircle className="mt-0.5 h-4 w-4" /> : <Loader2 className="mt-0.5 h-4 w-4 animate-spin" />}
          <span>{notice.message}</span>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricBox label="Pegawai" value={formatNumber(data?.metrics.totalEmployees ?? 0)} hint="Profil tersambung dari user ALETA." icon={UsersRound} />
        <MetricBox label="Cuti" value={formatNumber(data?.metrics.totalLeaveRequests ?? 0)} hint={`${data?.metrics.waitingApproval ?? 0} menunggu persetujuan.`} icon={ClipboardCheck} />
        <MetricBox label="Sedang Cuti" value={formatNumber(data?.metrics.employeesOnLeave ?? 0)} hint={`${formatPercent(data?.leaveStatistics.today.leavePercentage)} dari pegawai aktif hari ini.`} icon={UserRound} />
        <MetricBox label="Verifikasi" value={formatNumber((data?.metrics.submissionsWaitingVerification ?? 0) + (data?.metrics.attendanceWaitingApproval ?? 0))} hint="PCK/SKP/WFA dan izin kehadiran." icon={ShieldCheck} />
      </div>

      {!data?.settings.moduleEnabled ? (
        <Card className="border-amber-400/50 bg-amber-500/10">
          <CardContent className="p-5 text-sm text-amber-700 dark:text-amber-200">
            Modul E-Kepegawaian sedang nonaktif di pengaturan. Admin masih dapat membuka halaman ini untuk konfigurasi.
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {settingsOnly ? (
          <Card className="border-border/80">
            <CardContent className="space-y-3 p-3">
              <div className="aleta-blue-scrollbar overflow-x-auto pb-2">
                <div className="flex min-w-max gap-2">
                  {sidebarItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        selectSection(item.id);
                        if (item.id === "pck" || item.id === "skp" || item.id === "wfa") {
                          setSubmissionForm((current) => ({ ...current, submissionType: item.id as HrSubmissionType }));
                        }
                      }}
                      className={cn(
                        "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition",
                        visibleActiveSection === item.id
                          ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]"
                          : "border-border/80 bg-muted/20 text-muted-foreground hover:border-primary/45 hover:bg-primary/10 hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="px-2 text-sm leading-6 text-muted-foreground">
                {sidebarItems.find((item) => item.id === visibleActiveSection)?.description ?? "Atur konfigurasi aplikasi E-Kepegawaian dari area admin ALETA."}
              </p>
            </CardContent>
          </Card>
        ) : null}

        <div className="min-w-0 space-y-4">
        {visibleActiveSection === "dashboard" ? (
          <DashboardSection data={data} setActiveSection={selectSection} openAdminSettings={() => router.push("/admin/e-kepegawaian")} />
        ) : null}

        {visibleActiveSection === "cuti" ? (
          <div className="space-y-4">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Statistik Permintaan Cuti</CardTitle>
              <CardDescription>Ringkasan status, jenis cuti, dan dampak pegawai cuti hari ini.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border bg-muted/25 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Hari ini</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{formatPercent(data?.leaveStatistics.today.leavePercentage)}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {formatNumber(data?.leaveStatistics.today.approvedLeaveEmployees ?? 0)} pegawai cuti.
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/25 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Proses</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(data?.metrics.waitingApproval ?? 0)}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Menunggu pemeriksaan atau persetujuan.</p>
                </div>
                <div className="rounded-2xl border border-border bg-muted/25 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Disetujui</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(data?.metrics.approved ?? 0)}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Permintaan cuti final disetujui.</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card/70 p-4">
                  <p className="text-sm font-semibold text-foreground">Status permintaan</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(data?.leaveStatistics.byStatus ?? []).filter((item) => item.count > 0).map((item) => (
                      <Badge key={item.status} variant={leaveStatusVariant[item.status]}>
                        {item.label}: {formatNumber(item.count)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-card/70 p-4">
                  <p className="text-sm font-semibold text-foreground">Jenis cuti terbanyak</p>
                  <div className="mt-3 space-y-2">
                    {(data?.leaveStatistics.byLeaveType ?? []).slice(0, 4).map((item) => (
                      <div key={item.leaveTypeId} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-muted-foreground">{item.leaveTypeName}</span>
                        <span className="font-semibold text-foreground">{formatNumber(item.count)}</span>
                      </div>
                    ))}
                    {data?.leaveStatistics.byLeaveType.length ? null : (
                      <p className="text-sm text-muted-foreground">Belum ada permintaan cuti.</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-4 xl:grid-cols-[minmax(420px,0.8fr)_minmax(0,1.2fr)]">
            <Card className="min-w-0 border-border/80">
              <CardHeader>
                <CardTitle>Ajukan Cuti</CardTitle>
                <CardDescription>Form internal pengganti Google Form. Draf dan pengajuan langsung tercatat di ALETA.</CardDescription>
              </CardHeader>
              <CardContent className="aleta-blue-scrollbar overflow-x-auto">
                <div className="min-w-[390px] space-y-4">
                {data?.permissions.canManageAll ? (
                  <div className="space-y-2">
                    <FieldLabel>Pegawai</FieldLabel>
                    <NativeSelect value={leaveForm.employeeId} onChange={(event) => setLeaveForm((current) => ({ ...current, employeeId: event.target.value }))}>
                      {data.employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>{employee.fullName} - {employee.positionName}</option>
                      ))}
                    </NativeSelect>
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel>Jenis cuti</FieldLabel>
                    <NativeSelect value={leaveForm.leaveTypeId} onChange={(event) => setLeaveForm((current) => ({ ...current, leaveTypeId: event.target.value }))}>
                      {data?.leaveTypes.filter((item) => item.isActive).map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
                    Saldo tersedia: <strong className="text-foreground">{selectedBalance?.availableDays ?? 0} hari</strong>
                    <br />
                    {selectedLeaveType?.deductsAnnualBalance ? "Mengurangi saldo tahunan N, N-1, N-2." : "Tidak mengurangi saldo cuti tahunan."}
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-card/65 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">Alur persetujuan cuti</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Nama pejabat diambil dari profil pegawai dan konfigurasi alur persetujuan jenis cuti.
                      </p>
                    </div>
                    <Badge variant={selectedLeaveWorkflow.some((item) => item.approverName.includes("Belum")) ? "warning" : "success"}>
                      {selectedLeaveWorkflow.length} tahap
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {selectedLeaveWorkflow.map((item) => (
                      <div key={`${item.step}-${item.index}`} className="flex flex-col gap-1 rounded-xl border border-border bg-muted/25 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-sm font-semibold text-foreground">{item.index + 1}. {item.label}</span>
                        <span className="text-sm text-muted-foreground">{item.approverName}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    Pegawai: <strong className="text-foreground">{selectedLeaveEmployee?.fullName ?? "-"}</strong> | Unit: {selectedLeaveEmployee?.unitKerja || "-"}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel>Tanggal mulai</FieldLabel>
                    <Input type="date" value={leaveForm.startDate} onChange={(event) => setLeaveForm((current) => ({ ...current, startDate: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Tanggal selesai</FieldLabel>
                    <Input type="date" value={leaveForm.endDate} onChange={(event) => setLeaveForm((current) => ({ ...current, endDate: event.target.value }))} />
                  </div>
                </div>
                <LeaveImpactPreview rows={leaveSimulationRows} />
                <div className="space-y-2">
                  <FieldLabel>Alasan cuti</FieldLabel>
                  <Textarea rows={3} value={leaveForm.reason} onChange={(event) => setLeaveForm((current) => ({ ...current, reason: event.target.value }))} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel>Alamat selama cuti</FieldLabel>
                    <Textarea rows={3} value={leaveForm.addressDuringLeave} onChange={(event) => setLeaveForm((current) => ({ ...current, addressDuringLeave: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Kontak selama cuti</FieldLabel>
                    <Input value={leaveForm.contactDuringLeave} onChange={(event) => setLeaveForm((current) => ({ ...current, contactDuringLeave: event.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Lampiran pendukung</FieldLabel>
                  <Input type="file" onChange={(event) => setLeaveFile(event.target.files?.[0] ?? null)} />
                  <p className="text-xs text-muted-foreground">Format mengikuti pengaturan E-Kepegawaian. PDF divalidasi sampai isi file, bukan hanya ekstensi.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={isBusy} onClick={() => void saveLeave("draft")}>
                    {busyAction === "save-leave-draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Simpan Draf
                  </Button>
                  <Button disabled={isBusy} onClick={() => void saveLeave("submit")}>
                    {busyAction === "submit-leave" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Ajukan Cuti
                  </Button>
                </div>
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-0 border-border/80">
              <CardHeader>
                <CardTitle>Riwayat Cuti</CardTitle>
                <CardDescription>Riwayat menyesuaikan akses: milik sendiri, bawahan, atau seluruh pegawai untuk admin.</CardDescription>
              </CardHeader>
              <CardContent>
                {data?.leaveRequests.length ? (
                  <div className="aleta-blue-scrollbar overflow-x-auto rounded-2xl border border-border/75 bg-card/55">
                    <table className="w-full min-w-[1180px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-5 py-3">Pegawai</th>
                          <th className="px-4 py-3">Jenis</th>
                          <th className="px-4 py-3">Tanggal</th>
                          <th className="px-4 py-3">Hari</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Nomor</th>
                          <th className="px-4 py-3">Persetujuan</th>
                          <th className="px-5 py-3">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.leaveRequests.map((request) => (
                          <tr key={request.id} className="border-b border-border/70 align-top">
                            <td className="px-5 py-3 font-medium text-foreground">{request.employeeName}</td>
                            <td className="px-4 py-3">{request.leaveTypeName}</td>
                            <td className="px-4 py-3">{formatDate(request.startDate)} - {formatDate(request.endDate)}</td>
                            <td className="px-4 py-3">{request.totalDays}</td>
                            <td className="px-4 py-3"><Badge variant={leaveStatusVariant[request.status]}>{leaveStatusLabel[request.status]}</Badge></td>
                            <td className="px-4 py-3">{request.requestNumber ?? "-"}</td>
                            <td className="px-4 py-3 text-xs leading-5 text-muted-foreground">{formatEmployeeApprovalLine(data?.employees.find((employee) => employee.id === request.employeeId))}</td>
                            <td className="px-5 py-3">
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" asChild>
                                  <a
                                    href={leavePdfUrl(request.id, "inline")}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => setLeavePreviewId(request.id)}
                                  >
                                    <Eye className="h-4 w-4" />
                                    Pratinjau
                                  </a>
                                </Button>
                                <Button size="sm" variant="outline" asChild>
                                  <a href={leavePdfUrl(request.id, "attachment")} target="_blank" rel="noopener noreferrer">
                                    <Download className="h-4 w-4" />
                                    Unduh
                                  </a>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyMini text="Belum ada riwayat cuti." />
                )}
              </CardContent>
            </Card>
          </div>
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Pratinjau Formulir Cuti PDF</CardTitle>
              <CardDescription>
                Simpan draf atau ajukan cuti untuk membuat pratinjau formulir. Pratinjau mengikuti format PDF resmi yang diatur di admin E-Kepegawaian.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leavePreviewRequest ? (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{leavePreviewRequest.employeeName} - {leavePreviewRequest.leaveTypeName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(leavePreviewRequest.startDate)} sampai {formatDate(leavePreviewRequest.endDate)} | {leaveStatusLabel[leavePreviewRequest.status]}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <a href={leavePdfUrl(leavePreviewRequest.id, "inline")} target="_blank" rel="noopener noreferrer">
                          <Eye className="h-4 w-4" />
                          Buka
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={leavePdfUrl(leavePreviewRequest.id, "attachment")} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                          Unduh
                        </a>
                      </Button>
                    </div>
                  </div>
                  <iframe
                    key={leavePreviewRequest.id}
                    title="Pratinjau formulir cuti"
                    src={leavePdfPreviewUrl}
                    className="h-[680px] w-full rounded-2xl border border-border bg-white"
                  />
                </div>
              ) : (
                <EmptyMini text="Belum ada formulir cuti untuk dipratinjau. Simpan draf atau ajukan cuti terlebih dahulu." />
              )}
            </CardContent>
          </Card>
          </div>
        ) : null}

        {visibleActiveSection === "approval" ? (
          <div className="space-y-4">
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Persetujuan Cuti</CardTitle>
              <CardDescription>Atasan dan pejabat berwenang hanya memproses permohonan yang menjadi tanggung jawabnya. Admin kepegawaian dapat memantau seluruhnya.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <FieldLabel>Catatan tindakan</FieldLabel>
                <Textarea rows={3} value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} placeholder="Wajib untuk tolak atau minta revisi." />
              </div>
              {pendingApprovals.length ? (
                <div className="grid gap-3">
                  {pendingApprovals.map((request) => (
                    <div key={request.id} className="rounded-2xl border border-border bg-card/70 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">{request.employeeName} - {request.leaveTypeName}</p>
                          <p className="text-sm text-muted-foreground">{formatDate(request.startDate)} sampai {formatDate(request.endDate)} ({request.totalDays} hari)</p>
                          <p className="text-sm text-muted-foreground">{request.reason}</p>
                          <Badge variant={leaveStatusVariant[request.status]}>{leaveStatusLabel[request.status]}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" disabled={isBusy} asChild>
                            <a href={leavePdfUrl(request.id, "inline")} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-4 w-4" />
                              Pratinjau
                            </a>
                          </Button>
                          <Button size="sm" variant="outline" disabled={isBusy} asChild>
                            <a href={leavePdfUrl(request.id, "attachment")} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                              Unduh
                            </a>
                          </Button>
                          <Button size="sm" disabled={isBusy} onClick={() => void runAction("approve-leave", { id: request.id, note: approvalNote }, "Permohonan cuti diproses.")}>
                            Setujui
                          </Button>
                          <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void runAction("request-leave-revision", { id: request.id, note: approvalNote }, "Permohonan dikembalikan untuk revisi.")}>
                            Minta Revisi
                          </Button>
                          <Button size="sm" variant="destructive" disabled={isBusy} onClick={() => void runAction("reject-leave", { id: request.id, note: approvalNote }, "Permohonan ditolak.")}>
                            Tolak
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyMini text="Tidak ada permohonan yang sedang menunggu persetujuan." />
              )}
            </CardContent>
          </Card>
          </div>
        ) : null}

        {visibleActiveSection === "pegawai" ? (
          <div>
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            {data?.permissions.canManageAll ? (
              <Card className="border-border/80">
                <CardHeader>
                  <CardTitle>Edit Profil Pegawai</CardTitle>
                  <CardDescription>Profil tetap tersambung ke user ALETA, admin hanya mengatur atribut kepegawaian.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <NativeSelect
                    value={employeeForm.id}
                    onChange={(event) => {
                      const employee = data.employees.find((item) => item.id === event.target.value);
                      if (employee) setEmployeeForm(employeeToForm(employee));
                    }}
                  >
                    {data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
                  </NativeSelect>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input placeholder="Nomor pegawai/NIP" value={employeeForm.employeeNumber} onChange={(event) => setEmployeeForm((current) => ({ ...current, employeeNumber: event.target.value }))} />
                    <Input placeholder="Unit kerja" value={employeeForm.unitKerja} onChange={(event) => setEmployeeForm((current) => ({ ...current, unitKerja: event.target.value }))} />
                    <Input placeholder="Pangkat/Golongan" value={employeeForm.rankGrade} onChange={(event) => setEmployeeForm((current) => ({ ...current, rankGrade: event.target.value }))} />
                    <NativeSelect
                      value={selectedEmployeeIsStateOfficial ? "pejabat_negara" : employeeForm.employmentStatus}
                      onChange={(event) => setEmployeeForm((current) => ({ ...current, employmentStatus: event.target.value }))}
                      disabled={selectedEmployeeIsStateOfficial}
                    >
                      <option value="pns">PNS</option>
                      <option value="pppk">PPPK</option>
                      <option value="cpns">CPNS</option>
                      <option value="pejabat_negara">Pejabat Negara</option>
                      <option value="honorer">Honorer/PPNPN</option>
                      <option value="lainnya">Lainnya</option>
                    </NativeSelect>
                    <NativeSelect value={employeeForm.supervisorEmployeeId} onChange={(event) => setEmployeeForm((current) => ({ ...current, supervisorEmployeeId: event.target.value }))}>
                      <option value="">Tanpa atasan langsung</option>
                      {data.employees.filter((employee) => employee.id !== employeeForm.id).map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
                    </NativeSelect>
                    <NativeSelect value={employeeForm.approvalOfficerEmployeeId} onChange={(event) => setEmployeeForm((current) => ({ ...current, approvalOfficerEmployeeId: event.target.value }))}>
                      <option value="">Tanpa pejabat pemberi persetujuan</option>
                      {data.employees.filter((employee) => employee.id !== employeeForm.id).map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
                    </NativeSelect>
                    <Input placeholder="Nomor WhatsApp" value={employeeForm.phone} onChange={(event) => setEmployeeForm((current) => ({ ...current, phone: event.target.value }))} />
                    <Input placeholder="Email" value={employeeForm.email} onChange={(event) => setEmployeeForm((current) => ({ ...current, email: event.target.value }))} />
                  </div>
                  {selectedEmployeeIsStateOfficial ? (
                    <div className="rounded-xl border border-amber-300/60 bg-amber-500/10 p-3 text-sm leading-6 text-amber-800 dark:text-amber-200">
                      Ketua, Wakil Ketua, dan Hakim otomatis dicatat sebagai Pejabat Negara di E-Kepegawaian, bukan PNS. Status ini dikunci agar tidak tertimpa impor data.
                    </div>
                  ) : null}
                  <NativeSelect value={String(employeeForm.isActive)} onChange={(event) => setEmployeeForm((current) => ({ ...current, isActive: event.target.value === "true" }))}>
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </NativeSelect>
                  <Button disabled={isBusy || !employeeForm.id} onClick={() => void saveEmployeeProfile()}>
                    Simpan Profil Pegawai
                  </Button>
                </CardContent>
              </Card>
            ) : null}
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Data Pegawai</CardTitle>
                <CardDescription>Profil pegawai dibuat dari user ALETA aktif dan tetap terhubung dengan akun login.</CardDescription>
              </CardHeader>
              <CardContent>
                <EmployeeTable employees={data?.employees ?? []} />
              </CardContent>
            </Card>
          </div>
          </div>
        ) : null}

        {(visibleActiveSection === "pck" || visibleActiveSection === "skp" || visibleActiveSection === "wfa") ? (
          <div className="space-y-4">
          <div className={cn("grid gap-4", roleView === "employee" && "xl:grid-cols-[0.9fr_1.1fr]")}>
            {roleView === "employee" ? (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Setor {submissionTypeLabels[currentSubmissionType]}</CardTitle>
                <CardDescription>Form internal untuk menggantikan Google Form. Lampiran tersimpan di ALETA dan akses unduhnya mengikuti permission E-Kepegawaian.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel>Jenis setoran</FieldLabel>
                    <NativeSelect value={currentSubmissionType} onChange={(event) => setSubmissionForm((current) => ({ ...current, submissionType: event.target.value as HrSubmissionType }))}>
                      <option value="pck">PCK</option>
                      <option value="skp">SKP</option>
                      <option value="wfa">WFA</option>
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Tahun</FieldLabel>
                    <Input value={submissionForm.periodYear} onChange={(event) => setSubmissionForm((current) => ({ ...current, periodYear: event.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Judul</FieldLabel>
                  <Input value={submissionForm.title} onChange={(event) => setSubmissionForm((current) => ({ ...current, title: event.target.value }))} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel>Bulan/periode</FieldLabel>
                    <Input placeholder="Opsional, 1-12" value={submissionForm.periodMonth} onChange={(event) => setSubmissionForm((current) => ({ ...current, periodMonth: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Tanggal setoran</FieldLabel>
                    <Input type="date" value={submissionForm.submissionDate} onChange={(event) => setSubmissionForm((current) => ({ ...current, submissionDate: event.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Keterangan</FieldLabel>
                  <Textarea rows={4} value={submissionForm.description} onChange={(event) => setSubmissionForm((current) => ({ ...current, description: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Lampiran setoran</FieldLabel>
                  <Input type="file" onChange={(event) => setSubmissionFile(event.target.files?.[0] ?? null)} />
                </div>
                <Button disabled={isBusy} onClick={() => void saveSubmission()}>
                  {busyAction === "create-submission" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Simpan Setoran
                </Button>
              </CardContent>
            </Card>
            ) : null}

            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>{roleView === "employee" ? "Riwayat" : "Verifikasi"} {submissionTypeLabels[currentSubmissionType]}</CardTitle>
                <CardDescription>{roleView === "employee" ? "Pantau status setoran yang sudah dikirim." : "Pejabat berwenang dapat memverifikasi setoran, meminta revisi, dan melihat status terakhir."}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data?.submissions.filter((item) => item.submissionType === currentSubmissionType).length ? data.submissions.filter((item) => item.submissionType === currentSubmissionType).map((item) => {
                  const submissionAttachments = attachmentsBySubmission.get(item.id) ?? [];
                  return (
                  <div key={item.id} className="rounded-2xl border border-border bg-card/70 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{submissionTypeLabels[item.submissionType]} - {item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.employeeName} | {item.periodYear}{item.periodMonth ? `/${item.periodMonth}` : ""} | {item.status}</p>
                        {item.description ? <p className="mt-2 text-sm text-muted-foreground">{item.description}</p> : null}
                        {item.verificationNote ? <p className="mt-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">Catatan umum: {item.verificationNote}</p> : null}
                      </div>
                      {data.permissions.canManageAll ? (
                        <div className="w-full max-w-xl space-y-2 lg:w-[24rem]">
                          <Textarea
                            rows={2}
                            value={submissionVerificationNotes[item.id] ?? ""}
                            onChange={(event) => setSubmissionVerificationNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                            placeholder="Catatan verifikasi/revisi untuk pegawai"
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => void runAction("verify-submission", { id: item.id, note: submissionVerificationNotes[item.id] || "Diverifikasi admin." }, "Setoran diverifikasi.")}
                            >
                              Verifikasi
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => void runAction("request-submission-revision", { id: item.id, note: submissionVerificationNotes[item.id] || "Mohon dilengkapi." }, "Setoran diminta revisi.")}
                            >
                              Revisi
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={isBusy}
                              onClick={() => void runAction("reject-submission", { id: item.id, note: submissionVerificationNotes[item.id] || "Setoran ditolak." }, "Setoran ditolak.")}
                            >
                              Tolak
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {submissionAttachments.length ? (
                      <div className="mt-4 space-y-3 rounded-2xl border border-border bg-muted/20 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">Lampiran setoran</p>
                          <Badge variant="muted">{submissionAttachments.length} file</Badge>
                        </div>
                        <div className="grid gap-3">
                          {submissionAttachments.map((attachment) => (
                            <div key={attachment.id} className="rounded-xl border border-border bg-background/50 p-3">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="break-all text-sm font-semibold text-foreground">{attachment.originalFileName}</p>
                                    <Badge variant={attachment.verificationStatus === "verified" ? "success" : attachment.verificationStatus === "rejected" ? "danger" : attachment.verificationStatus === "revision_required" ? "warning" : "outline"}>
                                      {attachment.verificationStatus === "verified" ? "Terverifikasi" : attachment.verificationStatus === "rejected" ? "Ditolak" : attachment.verificationStatus === "revision_required" ? "Perlu revisi" : "Menunggu"}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)} | unggah {formatDate(attachment.createdAt)}</p>
                                  {attachment.verificationNote ? <p className="mt-2 text-sm text-muted-foreground">Catatan file: {attachment.verificationNote}</p> : null}
                                  {attachment.verifiedByName ? <p className="mt-1 text-xs text-muted-foreground">Diperiksa oleh {attachment.verifiedByName}{attachment.verifiedAt ? ` pada ${formatDate(attachment.verifiedAt)}` : ""}</p> : null}
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  <Button size="sm" variant="outline" onClick={() => openHrFile(attachment.fileName, "inline")}>
                                    <Eye className="h-4 w-4" />
                                    Lihat
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => openHrFile(attachment.fileName, "attachment")}>
                                    <Download className="h-4 w-4" />
                                    Unduh
                                  </Button>
                                </div>
                              </div>
                              {data.permissions.canManageAll ? (
                                <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto]">
                                  <Textarea
                                    rows={2}
                                    value={attachmentVerificationNotes[attachment.id] ?? ""}
                                    onChange={(event) => setAttachmentVerificationNotes((current) => ({ ...current, [attachment.id]: event.target.value }))}
                                    placeholder="Catatan khusus untuk file ini"
                                  />
                                  <div className="flex flex-wrap gap-2 lg:flex-col">
                                    <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void verifySubmissionAttachment(attachment, "verified")}>File Valid</Button>
                                    <Button size="sm" variant="outline" disabled={isBusy} onClick={() => void verifySubmissionAttachment(attachment, "revision_required")}>Revisi File</Button>
                                    <Button size="sm" variant="destructive" disabled={isBusy} onClick={() => void verifySubmissionAttachment(attachment, "rejected")}>Tolak File</Button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-dashed border-border bg-muted/15 p-4 text-sm text-muted-foreground">
                        Belum ada lampiran file untuk setoran ini.
                      </div>
                    )}
                  </div>
                );
                }) : <EmptyMini text="Belum ada setoran PCK/SKP/WFA." />}
              </CardContent>
            </Card>
          </div>
          </div>
        ) : null}

        {visibleActiveSection === "izin" ? (
          <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Izin Kehadiran</CardTitle>
                <CardDescription>Ajukan lambat datang atau cepat pulang tanpa Google Form.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <FieldLabel>Jenis izin</FieldLabel>
                  <NativeSelect value={attendanceForm.permissionType} onChange={(event) => setAttendanceForm((current) => ({ ...current, permissionType: event.target.value as HrAttendancePermissionType }))}>
                    <option value="late_arrival">Lambat Datang</option>
                    <option value="early_leave">Cepat Pulang</option>
                  </NativeSelect>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel>Tanggal</FieldLabel>
                    <Input type="date" value={attendanceForm.requestDate} onChange={(event) => setAttendanceForm((current) => ({ ...current, requestDate: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Jam</FieldLabel>
                    <Input type="time" value={attendanceForm.requestedTime} onChange={(event) => setAttendanceForm((current) => ({ ...current, requestedTime: event.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Alasan</FieldLabel>
                  <Textarea rows={4} value={attendanceForm.reason} onChange={(event) => setAttendanceForm((current) => ({ ...current, reason: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldLabel>Bukti pendukung</FieldLabel>
                  <Input type="file" onChange={(event) => setAttendanceFile(event.target.files?.[0] ?? null)} />
                </div>
                <Button disabled={isBusy} onClick={() => void saveAttendance()}>
                  {busyAction === "create-attendance-permission" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Ajukan Izin
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Riwayat Izin</CardTitle>
                <CardDescription>Atasan/admin dapat memproses izin yang diajukan.</CardDescription>
              </CardHeader>
              <CardContent>
                <AttendanceList items={data?.attendancePermissions ?? []} canManage={Boolean(data?.permissions.canApprove || data?.permissions.canManageAll)} runAction={runAction} busy={isBusy} />
              </CardContent>
            </Card>
          </div>
          </div>
        ) : null}

        {visibleActiveSection === "rapat" ? (
          <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Hasil Rapat</CardTitle>
                <CardDescription>Catat hasil rapat internal agar tidak bergantung pada folder Drive.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Judul rapat" value={meetingForm.title} onChange={(event) => setMeetingForm((current) => ({ ...current, title: event.target.value }))} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input type="date" value={meetingForm.meetingDate} onChange={(event) => setMeetingForm((current) => ({ ...current, meetingDate: event.target.value }))} />
                  <Input placeholder="Lokasi" value={meetingForm.location} onChange={(event) => setMeetingForm((current) => ({ ...current, location: event.target.value }))} />
                </div>
                <Textarea rows={2} placeholder="Peserta" value={meetingForm.participants} onChange={(event) => setMeetingForm((current) => ({ ...current, participants: event.target.value }))} />
                <Textarea rows={4} placeholder="Ringkasan hasil rapat" value={meetingForm.summary} onChange={(event) => setMeetingForm((current) => ({ ...current, summary: event.target.value }))} />
                <Input type="file" onChange={(event) => setMeetingFile(event.target.files?.[0] ?? null)} />
                <Button disabled={isBusy} onClick={() => void saveMeeting()}>Simpan Hasil Rapat</Button>
              </CardContent>
            </Card>
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Daftar Hasil Rapat</CardTitle>
                <CardDescription>Dokumen rapat dapat dilihat atau diunduh sesuai permission internal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data?.meetingResults.length ? data.meetingResults.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border bg-card/70 p-4">
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(item.meetingDate)} | {item.category}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                  </div>
                )) : <EmptyMini text="Belum ada hasil rapat." />}
              </CardContent>
            </Card>
          </div>
          </div>
        ) : null}

        {visibleActiveSection === "dokumen" ? (
          <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Dokumen Kepegawaian</CardTitle>
                <CardDescription>Metadata dokumen pegawai tersimpan di ALETA; tabel lampiran sudah disiapkan untuk unggah file.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data?.permissions.canManageAll ? (
                  <NativeSelect value={documentForm.employeeId} onChange={(event) => setDocumentForm((current) => ({ ...current, employeeId: event.target.value }))}>
                    {data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
                  </NativeSelect>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input placeholder="Kategori, contoh SK" value={documentForm.category} onChange={(event) => setDocumentForm((current) => ({ ...current, category: event.target.value }))} />
                  <Input placeholder="Nomor dokumen" value={documentForm.documentNumber} onChange={(event) => setDocumentForm((current) => ({ ...current, documentNumber: event.target.value }))} />
                </div>
                <Input type="date" value={documentForm.documentDate} onChange={(event) => setDocumentForm((current) => ({ ...current, documentDate: event.target.value }))} />
                <Input placeholder="Judul dokumen" value={documentForm.title} onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))} />
                <Textarea rows={3} placeholder="Deskripsi" value={documentForm.description} onChange={(event) => setDocumentForm((current) => ({ ...current, description: event.target.value }))} />
                <Input type="file" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} />
                <Button disabled={isBusy} onClick={() => void saveDocument()}>Simpan Dokumen</Button>
              </CardContent>
            </Card>
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Lampiran Kepegawaian</CardTitle>
                <CardDescription>Daftar lampiran cuti, PCK/SKP/WFA, izin, dokumen pegawai, dan rapat yang sudah tercatat.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data?.attachments.length ? data.attachments.map((item) => (
                  <div key={`${item.entityType}-${item.id}`} className="rounded-2xl border border-border bg-card/70 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.ownerName} | {item.entityType.replaceAll("_", " ")} | {formatDate(item.createdAt)}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{item.originalFileName}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openHrFile(item.fileName, "inline")}>Lihat</Button>
                        <Button size="sm" variant="outline" onClick={() => openHrFile(item.fileName, "attachment")}>Unduh</Button>
                      </div>
                    </div>
                  </div>
                )) : <EmptyMini text="Belum ada lampiran kepegawaian yang tercatat." />}
              </CardContent>
            </Card>
          </div>
          </div>
        ) : null}

        {visibleActiveSection === "rekap" ? (
          <div>
          <Card className="border-border/80">
            <CardHeader>
              <CardTitle>Rekap Kepegawaian</CardTitle>
              <CardDescription>Ringkasan cuti, saldo, setoran, izin, serta ekspor Excel/PDF khusus E-Kepegawaian.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[1.4rem] border border-border/80 bg-card/65 p-5">
                <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Filter Laporan Detail</h3>
                    <p className="text-sm leading-6 text-muted-foreground">Filter ini dipakai saat ekspor Excel, PDF, atau CSV agar laporan sesuai pegawai, unit, status, bulan, dan tahun yang dipilih.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => openExport(reportFilters.type, "xlsx")}>
                      <Download className="h-4 w-4" />
                      Excel
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openExport(reportFilters.type, "pdf")}>PDF</Button>
                    <Button size="sm" variant="outline" onClick={() => openExport(reportFilters.type, "csv")}>CSV</Button>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <FieldLabel>Jenis laporan</FieldLabel>
                    <NativeSelect value={reportFilters.type} onChange={(event) => setReportFilters((current) => ({ ...current, type: event.target.value as HrExportType }))}>
                      {(Object.entries(exportTypeLabels) as Array<[HrExportType, string]>).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Pegawai</FieldLabel>
                    <NativeSelect value={reportFilters.employeeId} onChange={(event) => setReportFilters((current) => ({ ...current, employeeId: event.target.value }))}>
                      <option value="all">Semua pegawai</option>
                      {data?.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Unit kerja</FieldLabel>
                    <NativeSelect value={reportFilters.unit} onChange={(event) => setReportFilters((current) => ({ ...current, unit: event.target.value }))}>
                      <option value="all">Semua unit</option>
                      {employeeUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Status</FieldLabel>
                    <NativeSelect value={reportFilters.status} onChange={(event) => setReportFilters((current) => ({ ...current, status: event.target.value }))}>
                      <option value="all">Semua status</option>
                      <option value="draft">Draft</option>
                      <option value="submitted">Diajukan/Masuk</option>
                      <option value="waiting_supervisor_approval">Menunggu Atasan</option>
                      <option value="waiting_authorized_officer_approval">Menunggu Pejabat</option>
                      <option value="approved">Disetujui</option>
                      <option value="verified">Terverifikasi</option>
                      <option value="revision_required">Perlu Revisi</option>
                      <option value="rejected">Ditolak</option>
                      <option value="cancelled">Dibatalkan</option>
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Tahun</FieldLabel>
                    <NativeSelect value={reportFilters.year} onChange={(event) => setReportFilters((current) => ({ ...current, year: event.target.value }))}>
                      <option value="all">Semua tahun</option>
                      {reportYears.map((year) => <option key={year} value={year}>{year}</option>)}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Bulan</FieldLabel>
                    <NativeSelect value={reportFilters.month} onChange={(event) => setReportFilters((current) => ({ ...current, month: event.target.value }))}>
                      <option value="all">Semua bulan</option>
                      {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0")).map((month) => (
                        <option key={month} value={month}>{new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date(2026, Number(month) - 1, 1))}</option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Jenis cuti</FieldLabel>
                    <NativeSelect value={reportFilters.leaveTypeId} onChange={(event) => setReportFilters((current) => ({ ...current, leaveTypeId: event.target.value }))}>
                      <option value="all">Semua jenis cuti</option>
                      {data?.leaveTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Jenis setoran</FieldLabel>
                    <NativeSelect value={reportFilters.submissionType} onChange={(event) => setReportFilters((current) => ({ ...current, submissionType: event.target.value }))}>
                      <option value="all">Semua setoran</option>
                      <option value="pck">PCK</option>
                      <option value="skp">SKP</option>
                      <option value="wfa">WFA</option>
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Kategori dokumen</FieldLabel>
                    <NativeSelect value={reportFilters.documentCategory} onChange={(event) => setReportFilters((current) => ({ ...current, documentCategory: event.target.value }))}>
                      <option value="all">Semua kategori</option>
                      {documentCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Status batas waktu</FieldLabel>
                    <NativeSelect value={reportFilters.slaStatus} onChange={(event) => setReportFilters((current) => ({ ...current, slaStatus: event.target.value }))}>
                      <option value="all">Semua batas waktu</option>
                      <option value="overdue">Terlambat</option>
                      <option value="normal">Normal</option>
                    </NativeSelect>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <FieldLabel>Kata kunci</FieldLabel>
                    <Input placeholder="Cari nama, NIP, judul, alasan, nomor dokumen..." value={reportFilters.keyword} onChange={(event) => setReportFilters((current) => ({ ...current, keyword: event.target.value }))} />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setReportFilters((current) => ({
                        ...current,
                        employeeId: "all",
                        unit: "all",
                        status: "all",
                        year: "all",
                        month: "all",
                        leaveTypeId: "all",
                        submissionType: "all",
                        documentCategory: "all",
                        slaStatus: "all",
                        keyword: "",
                      }))}
                    >
                      Reset Filter
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {(Object.entries(exportTypeLabels) as Array<[HrExportType, string]>).map(([type, label]) => (
                  <div key={type} className="rounded-2xl border border-border bg-card/70 p-4">
                    <p className="font-semibold text-foreground">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Unduh laporan memakai filter detail di atas.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => openExport(type, "xlsx")}>Excel</Button>
                      <Button size="sm" variant="outline" onClick={() => openExport(type, "pdf")}>PDF</Button>
                      <Button size="sm" variant="outline" onClick={() => openExport(type, "csv")}>CSV</Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(data?.leaveBalances ?? []).map((balance) => (
                  <div key={balance.id} className="rounded-2xl border border-border bg-card/70 p-4">
                    <p className="font-semibold text-foreground">{getScopedEmployeeName(data, balance.employeeId)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Tahun {balance.year}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                      <span>N: {balance.balanceN}</span>
                      <span>N-1: {balance.balanceN1}</span>
                      <span>N-2: {balance.balanceN2}</span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">Terpakai {balance.usedDays} hari, proses {balance.pendingDays} hari, sisa {balance.availableDays} hari.</p>
                  </div>
                ))}
              </div>
              <div className="rounded-[1.4rem] border border-border/80 bg-card/65 p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Dokumen Cuti Otomatis</h3>
                    <p className="text-sm leading-6 text-muted-foreground">Jejak formulir/surat cuti PDF yang pernah dibuat dari E-Kepegawaian.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openExport("cuti", "pdf")}>Ekspor Rekap Cuti</Button>
                </div>
                {data?.generatedDocuments.length ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {data.generatedDocuments.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-border bg-card/70 p-4">
                        <p className="font-semibold text-foreground">{item.fileName}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{item.documentType} | {formatDate(item.generatedAt)}</p>
                        <p className="mt-2 text-xs text-muted-foreground">Kode verifikasi: {item.verificationCode}</p>
                        {item.fileName ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => openHrFile(item.fileName, "inline")}>
                              <Eye className="h-4 w-4" />
                              Pratinjau
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openHrFile(item.fileName, "attachment")}>
                              <Download className="h-4 w-4" />
                              Unduh
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyMini text="Belum ada dokumen cuti otomatis yang dibuat." />
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        ) : null}

        {visibleActiveSection === "saldo" ? (
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Manajemen Saldo Cuti Manual</CardTitle>
                <CardDescription>Koreksi saldo awal N/N-1/N-2 per pegawai dengan alasan. Perubahan dicatat sebagai transaksi saldo dan audit trail.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <FieldLabel>Pegawai</FieldLabel>
                  <NativeSelect
                    value={balanceForm.employeeId}
                    onChange={(event) => {
                      const employeeId = event.target.value;
                      const existing = data?.leaveBalances.find((item) => item.employeeId === employeeId);
                      setBalanceForm((current) => ({
                        ...current,
                        employeeId,
                        balanceN: existing ? String(existing.balanceN) : current.balanceN,
                        balanceN1: existing ? String(existing.balanceN1) : current.balanceN1,
                        balanceN2: existing ? String(existing.balanceN2) : current.balanceN2,
                      }));
                    }}
                  >
                    {data?.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} - {employee.unitKerja}</option>)}
                  </NativeSelect>
                </div>
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="space-y-2">
                    <FieldLabel>Tahun</FieldLabel>
                    <Input value={balanceForm.year} onChange={(event) => setBalanceForm((current) => ({ ...current, year: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>N</FieldLabel>
                    <Input value={balanceForm.balanceN} onChange={(event) => setBalanceForm((current) => ({ ...current, balanceN: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>N-1</FieldLabel>
                    <Input value={balanceForm.balanceN1} onChange={(event) => setBalanceForm((current) => ({ ...current, balanceN1: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>N-2</FieldLabel>
                    <Input value={balanceForm.balanceN2} onChange={(event) => setBalanceForm((current) => ({ ...current, balanceN2: event.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Alasan koreksi</FieldLabel>
                  <Textarea rows={4} value={balanceForm.reason} onChange={(event) => setBalanceForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Contoh: penyesuaian saldo awal migrasi data tahun 2026." />
                </div>
                <Button disabled={isBusy || !data?.permissions.canManageSettings} onClick={() => void saveBalanceAdjustment()}>
                  Simpan Koreksi Saldo
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Riwayat Koreksi dan Pemakaian Saldo</CardTitle>
                <CardDescription>Transaksi saldo dari koreksi manual, reserve saat pengajuan, release saat batal/tolak, dan pemakaian final saat cuti disetujui.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data?.balanceTransactions.length ? data.balanceTransactions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border bg-card/70 p-4">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{item.employeeName}</p>
                        <p className="text-sm text-muted-foreground">{item.transactionType} {item.days} hari dari {item.sourceYearType} tahun {item.year}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                    </div>
                  </div>
                )) : <EmptyMini text="Belum ada transaksi saldo." />}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {visibleActiveSection === "kalender" ? (
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Kalender Cuti Visual</CardTitle>
                <CardDescription>Tampilan grid bulanan per unit kerja untuk melihat pegawai cuti, hari libur, dan cuti bersama.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      const [year, month] = calendarMonth.split("-").map(Number);
                      setCalendarMonth(new Date(year, month - 2, 1).toISOString().slice(0, 7));
                    }}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Input className="w-40" type="month" value={calendarMonth} onChange={(event) => setCalendarMonth(event.target.value)} />
                    <Button size="sm" variant="outline" onClick={() => {
                      const [year, month] = calendarMonth.split("-").map(Number);
                      setCalendarMonth(new Date(year, month, 1).toISOString().slice(0, 7));
                    }}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <NativeSelect className="lg:max-w-xs" value={calendarUnitFilter} onChange={(event) => setCalendarUnitFilter(event.target.value)}>
                    <option value="all">Semua unit kerja</option>
                    {calendarUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </NativeSelect>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-border bg-card/55">
                  <div className="grid min-w-[860px] grid-cols-7 border-b border-border bg-muted/25 text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
                      <div key={day} className="border-r border-border px-2 py-3 last:border-r-0">{day}</div>
                    ))}
                  </div>
                  <div className="grid min-w-[860px] grid-cols-7">
                    {calendarMonthCells.map((cell) => (
                      <div
                        key={cell.iso}
                        className={cn(
                          "min-h-32 border-r border-t border-border p-2 last:border-r-0",
                          !cell.currentMonth && "bg-muted/20 text-muted-foreground/60",
                          cell.today && "bg-primary/5"
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", cell.today && "bg-primary text-primary-foreground")}>{cell.day}</span>
                          {cell.events.length ? <Badge variant="muted">{cell.events.length}</Badge> : null}
                        </div>
                        <div className="space-y-1.5">
                          {cell.events.slice(0, 3).map((item) => (
                            <div
                              key={`${cell.iso}-${item.type}-${item.id}`}
                              className={cn(
                                "rounded-lg border px-2 py-1 text-xs leading-4",
                                item.type === "holiday"
                                  ? "border-amber-400/35 bg-amber-400/10 text-amber-700 dark:text-amber-200"
                                  : "border-sky-400/35 bg-sky-400/10 text-sky-700 dark:text-sky-200"
                              )}
                              title={`${item.title} - ${item.employeeName}`}
                            >
                              <p className="truncate font-semibold">{item.title}</p>
                              <p className="truncate opacity-80">{item.type === "holiday" ? "Kalender kerja" : item.employeeName}</p>
                            </div>
                          ))}
                          {cell.events.length > 3 ? <p className="text-xs text-muted-foreground">+{cell.events.length - 3} lainnya</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {data?.calendarItems.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {data.calendarItems
                      .filter((item) => calendarUnitFilter === "all" || item.unitKerja === calendarUnitFilter)
                      .slice(0, 8)
                      .map((item) => (
                        <div key={`${item.type}-${item.id}`} className="rounded-2xl border border-border bg-card/70 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-foreground">{item.title}</p>
                              <p className="text-sm text-muted-foreground">{item.employeeName}{item.unitKerja ? ` | ${item.unitKerja}` : ""}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{formatDate(item.startDate)} - {formatDate(item.endDate)}</p>
                            </div>
                            <Badge variant={item.type === "holiday" ? "warning" : "default"}>{item.type === "holiday" ? "Libur" : "Cuti"}</Badge>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : <EmptyMini text="Belum ada cuti disetujui atau kalender libur yang tercatat." />}
              </CardContent>
            </Card>
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Dashboard Batas Waktu Persetujuan</CardTitle>
                <CardDescription>Permohonan yang belum diproses lebih dari batas waktu akan ditandai agar tidak menggantung.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-muted/25 p-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Menunggu</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{slaSummary.total}</p>
                  </div>
                  <div className="rounded-xl border border-rose-400/45 bg-rose-500/10 p-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Terlambat</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{slaSummary.overdue}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/25 p-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Terpanjang</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{slaSummary.longest} hari</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <NativeSelect className="sm:max-w-[14rem]" value={slaFilter} onChange={(event) => setSlaFilter(event.target.value as typeof slaFilter)}>
                    <option value="all">Semua batas waktu</option>
                    <option value="overdue">Hanya terlambat</option>
                    <option value="normal">Masih normal</option>
                  </NativeSelect>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openExport("sla", "xlsx")}>Ekspor Excel</Button>
                    <Button size="sm" variant="outline" onClick={() => openExport("sla", "pdf")}>Ekspor PDF</Button>
                    <Button size="sm" disabled={isBusy || !slaSummary.overdue} onClick={() => void runSlaReminders()}>
                      {busyAction === "run-sla-reminders" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Kirim Pengingat
                    </Button>
                  </div>
                </div>
                {visibleSlaItems.length ? visibleSlaItems.map((item) => (
                  <div key={`${item.entityType}-${item.id}`} className={cn("rounded-2xl border p-4", item.overdue ? "border-rose-400/60 bg-rose-500/10" : "border-border bg-card/70")}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.employeeName} | {item.status}</p>
                        <p className="mt-1 text-sm text-muted-foreground">Masuk {formatDate(item.submittedAt)}, menunggu {item.daysWaiting} hari dari batas {item.slaDays} hari.</p>
                      </div>
                      <Badge variant={item.overdue ? "danger" : "outline"}>{item.overdue ? "Terlambat" : "Normal"}</Badge>
                    </div>
                  </div>
                )) : <EmptyMini text="Tidak ada item sesuai filter batas waktu." />}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {visibleActiveSection === "tandatangan" ? (
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Foto Tanda Tangan Pegawai</CardTitle>
                <CardDescription>Admin atau Kasubag Kepegawaian dapat mengunggah tanda tangan pegawai/pejabat. Formulir cuti otomatis mengambil tanda tangan dari data ini.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <FieldLabel>Pegawai/pejabat</FieldLabel>
                  <NativeSelect value={signatureEmployeeId} onChange={(event) => setSignatureEmployeeId(event.target.value)}>
                    {data?.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName} - {employee.positionName}</option>)}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Kategori tanda tangan</FieldLabel>
                  <NativeSelect value={signatureRole} onChange={(event) => setSignatureRole(event.target.value)}>
                    {signatureRoleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </NativeSelect>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Kategori ini menentukan posisi tanda tangan di formulir cuti: pemohon, atasan langsung, atau pejabat yang memberi cuti.
                  </p>
                </div>
                <div className="space-y-2">
                  <FieldLabel>File tanda tangan</FieldLabel>
                  <Input type="file" accept="image/png,image/jpeg" onChange={(event) => setSignatureFile(event.target.files?.[0] ?? null)} />
                  <p className="text-xs leading-5 text-muted-foreground">Gunakan PNG/JPG berlatar bersih agar hasil PDF cuti rapi.</p>
                </div>
                {signatureFilePreviewUrl ? (
                  <div className="rounded-2xl border border-border bg-muted/25 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pratinjau sebelum disimpan</p>
                    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border bg-background/60 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={signatureFilePreviewUrl} alt="Pratinjau tanda tangan" className="max-h-full max-w-full object-contain" />
                    </div>
                  </div>
                ) : null}
                <Button disabled={isBusy || !data?.permissions.canManageSignatures} onClick={() => void saveSignature()}>
                  Simpan Tanda Tangan
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Daftar Tanda Tangan Aktif</CardTitle>
                <CardDescription>Tanda tangan aktif terbaru per pegawai dan kategori dipakai untuk dokumen otomatis.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data?.employeeSignatures.length ? data.employeeSignatures.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border bg-card/70 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-background/60 p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={apiPath(`/api/e-kepegawaian/files/${encodeURIComponent(item.fileName)}?disposition=inline`)}
                            alt={`Tanda tangan ${item.employeeName}`}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-foreground">{item.employeeName}</p>
                            <Badge variant={item.isActive ? "success" : "muted"}>{item.isActive ? "Aktif" : "Nonaktif"}</Badge>
                          </div>
                          <p className="mt-1 text-sm font-medium text-muted-foreground">{signatureRoleLabel[item.signatureRole] ?? item.signatureRole}</p>
                          <p className="mt-1 break-all text-sm text-muted-foreground">{item.originalFileName} | {formatDate(item.createdAt)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openHrFile(item.fileName, "inline")}>
                          <Eye className="h-4 w-4" />
                          Lihat
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openHrFile(item.fileName, "attachment")}>
                          <Download className="h-4 w-4" />
                          Unduh
                        </Button>
                      </div>
                    </div>
                  </div>
                )) : <EmptyMini text="Belum ada tanda tangan pegawai." />}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {visibleActiveSection === "reminder" ? (
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Pengingat Dokumen Tahunan</CardTitle>
                <CardDescription>Atur kewajiban unggah SKP, PCK, WFA, atau dokumen tahunan lain, lalu kirim pengingat WhatsApp via ALETA Bot.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <NativeSelect
                  value={requirementForm.id}
                  onChange={(event) => {
                    const selected = data?.documentRequirements.find((item) => item.id === event.target.value);
                    if (selected) {
                      setRequirementForm({
                        id: selected.id,
                        submissionType: selected.submissionType,
                        name: selected.name,
                        periodYear: String(selected.periodYear),
                        dueDate: selected.dueDate,
                        targetRoleIds: selected.targetRoleIds.join(","),
                        targetPositionIds: selected.targetPositionIds.join(","),
                        isActive: selected.isActive,
                      });
                    }
                  }}
                >
                  <option value="">Requirement baru</option>
                  {data?.documentRequirements.map((item) => <option key={item.id} value={item.id}>{item.name} - {item.periodYear}</option>)}
                </NativeSelect>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <FieldLabel>Jenis dokumen</FieldLabel>
                    <NativeSelect value={requirementForm.submissionType} onChange={(event) => setRequirementForm((current) => ({ ...current, submissionType: event.target.value as HrSubmissionType }))}>
                      <option value="pck">PCK</option>
                      <option value="skp">SKP</option>
                      <option value="wfa">WFA</option>
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <FieldLabel>Tahun</FieldLabel>
                    <Input value={requirementForm.periodYear} onChange={(event) => setRequirementForm((current) => ({ ...current, periodYear: event.target.value }))} />
                  </div>
                </div>
                <Input placeholder="Nama reminder, contoh SKP Tahun 2026" value={requirementForm.name} onChange={(event) => setRequirementForm((current) => ({ ...current, name: event.target.value }))} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input type="date" value={requirementForm.dueDate} onChange={(event) => setRequirementForm((current) => ({ ...current, dueDate: event.target.value }))} />
                  <NativeSelect value={String(requirementForm.isActive)} onChange={(event) => setRequirementForm((current) => ({ ...current, isActive: event.target.value === "true" }))}>
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </NativeSelect>
                </div>
                <Textarea rows={2} placeholder="Role target dipisah koma, opsional" value={requirementForm.targetRoleIds} onChange={(event) => setRequirementForm((current) => ({ ...current, targetRoleIds: event.target.value }))} />
                <Textarea rows={2} placeholder="Jabatan/posisi target dipisah koma, opsional" value={requirementForm.targetPositionIds} onChange={(event) => setRequirementForm((current) => ({ ...current, targetPositionIds: event.target.value }))} />
                <div className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">Scheduler otomatis</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Jika aktif, ALETA mengecek reminder yang sudah masuk rentang jatuh tempo saat dashboard E-Kepegawaian dibuka setelah jam rutin.
                      </p>
                    </div>
                    <Badge variant={settingsForm.annualReminderSchedulerEnabled ? "success" : "muted"}>
                      {settingsForm.annualReminderSchedulerEnabled ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <FieldLabel>Status scheduler</FieldLabel>
                      <NativeSelect value={String(settingsForm.annualReminderSchedulerEnabled)} onChange={(event) => setSettingsForm((current) => ({ ...current, annualReminderSchedulerEnabled: event.target.value === "true" }))}>
                        <option value="false">Nonaktif</option>
                        <option value="true">Aktif</option>
                      </NativeSelect>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Jam kirim rutin</FieldLabel>
                      <Input type="time" value={settingsForm.annualReminderSchedulerTime} onChange={(event) => setSettingsForm((current) => ({ ...current, annualReminderSchedulerTime: event.target.value }))} />
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl border border-border bg-card/55 px-3 py-2 text-sm leading-6 text-muted-foreground">
                    Terakhir berjalan: <strong className="text-foreground">{formatDateTime(settingsForm.annualReminderSchedulerLastRunAt)}</strong>
                    <br />
                    Hasil terakhir: {settingsForm.annualReminderSchedulerLastMessage || "-"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={isBusy || !data?.permissions.canManageSettings}
                      onClick={() => void runAction("update-settings", {
                        annualReminderSchedulerEnabled: settingsForm.annualReminderSchedulerEnabled,
                        annualReminderSchedulerTime: settingsForm.annualReminderSchedulerTime,
                      }, "Scheduler reminder disimpan.")}
                    >
                      Simpan Scheduler
                    </Button>
                    <Button variant="outline" disabled={isBusy || !data?.permissions.canManageSettings} onClick={() => void runDocumentReminderScheduler()}>
                      {busyAction === "run-document-reminder-scheduler" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      Cek/Kirim Sekarang
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={isBusy || !data?.permissions.canManageSettings} onClick={() => void saveDocumentRequirement()}>Simpan Pengingat</Button>
                  <Button variant="outline" disabled={isBusy || !data?.permissions.canManageSettings} onClick={() => void runDocumentReminders(requirementForm.id || undefined)}>Kirim Pengingat</Button>
                  <Button variant="outline" disabled={isBusy} onClick={() => setRequirementForm(initialRequirementForm)}>Pengingat Baru</Button>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Status Dokumen Tahunan</CardTitle>
                <CardDescription>Menampilkan jumlah dokumen yang sudah disetor dan yang belum lengkap.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data?.documentRequirements.length ? data.documentRequirements.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border bg-card/70 p-4">
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{submissionTypeLabels[item.submissionType]} tahun {item.periodYear} | jatuh tempo {formatDate(item.dueDate)}</p>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <span className="rounded-xl border border-border bg-muted/35 px-3 py-2">Sudah setor: {item.submittedCount}</span>
                      <span className="rounded-xl border border-border bg-muted/35 px-3 py-2">Belum lengkap: {item.missingCount}</span>
                    </div>
                  </div>
                )) : <EmptyMini text="Belum ada reminder dokumen tahunan." />}
              </CardContent>
            </Card>
          </div>
        ) : null}

        {visibleActiveSection === "notifikasi" ? (
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Template Notifikasi WhatsApp</CardTitle>
                <CardDescription>Template ini dipakai ALETA Bot untuk cuti, verifikasi dokumen, pengingat tahunan, dan batas waktu persetujuan.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <NativeSelect
                  value={notificationTemplateForm.id}
                  onChange={(event) => {
                    const selected = data?.notificationTemplates.find((item) => item.id === event.target.value);
                    if (selected) setNotificationTemplateForm(notificationTemplateToForm(selected));
                  }}
                >
                  {data?.notificationTemplates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </NativeSelect>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input placeholder="Nama template" value={notificationTemplateForm.name} onChange={(event) => setNotificationTemplateForm((current) => ({ ...current, name: event.target.value }))} />
                  <Input placeholder="Kode template" value={notificationTemplateForm.templateKey} onChange={(event) => setNotificationTemplateForm((current) => ({ ...current, templateKey: event.target.value }))} />
                  <Input placeholder="Jenis kejadian" value={notificationTemplateForm.eventType} onChange={(event) => setNotificationTemplateForm((current) => ({ ...current, eventType: event.target.value }))} />
                  <NativeSelect value={notificationTemplateForm.audience} onChange={(event) => setNotificationTemplateForm((current) => ({ ...current, audience: event.target.value }))}>
                    <option value="employee">Pegawai</option>
                    <option value="approver">Pejabat/Atasan</option>
                    <option value="admin">Admin Kepegawaian</option>
                  </NativeSelect>
                </div>
                <Textarea rows={10} value={notificationTemplateForm.body} onChange={(event) => setNotificationTemplateForm((current) => ({ ...current, body: event.target.value }))} />
                <NativeSelect value={String(notificationTemplateForm.isActive)} onChange={(event) => setNotificationTemplateForm((current) => ({ ...current, isActive: event.target.value === "true" }))}>
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </NativeSelect>
                <Button disabled={isBusy || !data?.permissions.canManageSettings} onClick={() => void saveNotificationTemplate()}>
                  Simpan Template
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle>Placeholder yang Bisa Dipakai</CardTitle>
                <CardDescription>Gunakan tanda kurung kurawal ganda agar sistem mengganti nilai saat notifikasi dikirim.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p><code>{"{{nama_pegawai}}"}</code>, <code>{"{{jenis_cuti}}"}</code>, <code>{"{{nomor_permohonan}}"}</code>, <code>{"{{tanggal_mulai}}"}</code>, <code>{"{{tanggal_selesai}}"}</code>, <code>{"{{jumlah_hari}}"}</code>, <code>{"{{status}}"}</code>, <code>{"{{catatan}}"}</code>.</p>
                <p>Untuk dokumen tahunan: <code>{"{{jenis_setoran}}"}</code>, <code>{"{{judul}}"}</code>, <code>{"{{tahun}}"}</code>, <code>{"{{tanggal_jatuh_tempo}}"}</code>, <code>{"{{jumlah_belum}}"}</code>.</p>
                <div className="rounded-2xl border border-border bg-muted/35 p-4">
                  <p className="font-semibold text-foreground">Pratinjau sederhana</p>
                  <p className="mt-2 whitespace-pre-wrap">{notificationTemplateForm.body.replaceAll("{{nama_pegawai}}", "Derry Briantono").replaceAll("{{jenis_cuti}}", "Cuti Tahunan").replaceAll("{{status}}", "Disetujui").replaceAll("{{catatan}}", "Silakan unduh formulir cuti dari ALETA.")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {visibleActiveSection === "import" ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card className="min-w-0 border-border/80">
              <CardHeader>
                <CardTitle>Impor Data Pegawai</CardTitle>
                <CardDescription>Gunakan untuk sinkron awal unit kerja, pangkat/golongan, atasan langsung, pejabat pemberi persetujuan, kontak, dan email dari Excel/CSV.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[1.4rem] border border-border/80 bg-card/65 p-4">
                  <div className="mb-3 space-y-1">
                    <p className="font-semibold text-foreground">Impor file Excel langsung</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      File .xlsx dibaca dari sheet pertama. Header yang dikenali: nip, unit/unit_kerja, pangkat/golongan, status, atasan_nip, approval_nip, wa/whatsapp, email.
                    </p>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                    <Input accept=".xlsx,.csv,.txt" type="file" onChange={(event) => setEmployeeImportFile(event.target.files?.[0] ?? null)} />
                    <Button disabled={isBusy || !data?.permissions.canManageSettings || !employeeImportFile} onClick={() => void importEmployeesFromFile()}>
                      {busyAction === "import-employee-file" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Impor File
                    </Button>
                  </div>
                  {employeeImportFile ? <p className="mt-2 break-all text-xs text-muted-foreground">Dipilih: {employeeImportFile.name}</p> : null}
                </div>
                <Textarea rows={12} value={employeeImportText} onChange={(event) => setEmployeeImportText(event.target.value)} />
                <div className="rounded-xl border border-border bg-muted/35 p-4 text-sm leading-6 text-muted-foreground">
                  Impor manual tetap tersedia. Format baris: <code>nip,unit,pangkat,status,atasan_nip,approval_nip,wa,email</code>. Nilai status dapat berupa <code>pns</code>, <code>pppk</code>, <code>cpns</code>, <code>honorer</code>, atau <code>pejabat_negara</code>; Ketua, Wakil Ketua, dan Hakim tetap dikunci sebagai Pejabat Negara.
                </div>
                <Button disabled={isBusy || !data?.permissions.canManageSettings} onClick={() => void importEmployees()}>
                  Impor Pegawai
                </Button>
              </CardContent>
            </Card>
            <Card className="min-w-0 border-border/80">
              <CardHeader>
                <CardTitle>Hasil Impor dan Data Terhubung</CardTitle>
                <CardDescription>Setelah impor, cek kembali atasan langsung, pejabat pemberi persetujuan, unit kerja, dan nomor WhatsApp.</CardDescription>
              </CardHeader>
              <CardContent>
                <EmployeeTable employees={data?.employees ?? []} />
              </CardContent>
            </Card>
          </div>
        ) : null}

        {visibleActiveSection === "settings" ? (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1.35rem] border border-border/80 bg-card/75 p-5 shadow-sm">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Status Modul</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-xl font-semibold text-foreground">{settingsForm.moduleEnabled ? "Aktif" : "Nonaktif"}</p>
                  <Badge variant={settingsForm.moduleEnabled ? "success" : "muted"}>{settingsForm.moduleEnabled ? "Siap" : "Mati"}</Badge>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Mengatur akses fitur E-Kepegawaian di portal ALETA. Status pegawai mendukung PNS, PPPK, CPNS, Honorer/PPNPN, dan Pejabat Negara untuk Ketua/Wakil Ketua/Hakim.</p>
              </div>
              <div className="rounded-[1.35rem] border border-border/80 bg-card/75 p-5 shadow-sm">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Saldo Default</p>
                <p className="mt-3 text-xl font-semibold text-foreground">{settingsForm.defaultBalanceN}/{settingsForm.defaultBalanceN1}/{settingsForm.defaultBalanceN2} hari</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Urutan N, N-1, dan N-2 untuk saldo awal pegawai.</p>
              </div>
              <div className="rounded-[1.35rem] border border-border/80 bg-card/75 p-5 shadow-sm">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Batas Persetujuan</p>
                <p className="mt-3 text-xl font-semibold text-foreground">{settingsForm.approvalSlaDays} hari</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Batas pantau permohonan yang belum diproses pejabat.</p>
              </div>
              <div className="rounded-[1.35rem] border border-border/80 bg-card/75 p-5 shadow-sm">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Unggah</p>
                <p className="mt-3 text-xl font-semibold text-foreground">{settingsForm.maxUploadSizeMb} MB</p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{settingsForm.allowedFileTypes}</p>
              </div>
            </div>

            <Card className="border-border/80">
              <CardHeader className="pb-4">
                <CardTitle>Pengaturan E-Kepegawaian</CardTitle>
                <CardDescription>Pengaturan awal cuti dan unggah dokumen. Hanya admin kepegawaian, admin, atau super admin yang dapat menyimpan.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <section className="rounded-[1.35rem] border border-border/80 bg-card/55 p-5">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-base font-semibold text-foreground">Aturan Cuti dan Saldo</h3>
                    <p className="text-sm leading-6 text-muted-foreground">Standar saldo awal, metode hitung, dan urutan pemakaian cuti tahunan.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <FieldLabel>Status modul</FieldLabel>
                      <NativeSelect value={String(settingsForm.moduleEnabled)} onChange={(event) => setSettingsForm((current) => ({ ...current, moduleEnabled: event.target.value === "true" }))}>
                        <option value="true">Aktif</option>
                        <option value="false">Nonaktif</option>
                      </NativeSelect>
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Hak cuti tahunan default</FieldLabel>
                      <Input value={settingsForm.annualLeaveDefaultDays} onChange={(event) => setSettingsForm((current) => ({ ...current, annualLeaveDefaultDays: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Saldo awal N</FieldLabel>
                      <Input value={settingsForm.defaultBalanceN} onChange={(event) => setSettingsForm((current) => ({ ...current, defaultBalanceN: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Saldo awal N-1</FieldLabel>
                      <Input value={settingsForm.defaultBalanceN1} onChange={(event) => setSettingsForm((current) => ({ ...current, defaultBalanceN1: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Saldo awal N-2</FieldLabel>
                      <Input value={settingsForm.defaultBalanceN2} onChange={(event) => setSettingsForm((current) => ({ ...current, defaultBalanceN2: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Cara hitung cuti</FieldLabel>
                      <NativeSelect value={settingsForm.calculationType} onChange={(event) => setSettingsForm((current) => ({ ...current, calculationType: event.target.value }))}>
                        <option value="working_days">Hari kerja</option>
                        <option value="calendar_days">Hari kalender</option>
                      </NativeSelect>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <FieldLabel>Urutan saldo</FieldLabel>
                      <Input value={settingsForm.balanceUsageOrder} onChange={(event) => setSettingsForm((current) => ({ ...current, balanceUsageOrder: event.target.value }))} />
                    </div>
                  </div>
                </section>

                <section className="rounded-[1.35rem] border border-border/80 bg-card/55 p-5">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-base font-semibold text-foreground">Unggah Dokumen, Batas Waktu, dan Pengingat</h3>
                    <p className="text-sm leading-6 text-muted-foreground">Batas dokumen, tenggat persetujuan, dan pengingat dokumen tahunan.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <FieldLabel>Ukuran unggah maksimal (MB)</FieldLabel>
                      <Input value={settingsForm.maxUploadSizeMb} onChange={(event) => setSettingsForm((current) => ({ ...current, maxUploadSizeMb: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Batas waktu persetujuan (hari)</FieldLabel>
                      <Input value={settingsForm.approvalSlaDays} onChange={(event) => setSettingsForm((current) => ({ ...current, approvalSlaDays: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Pengingat dokumen sebelum jatuh tempo (hari)</FieldLabel>
                      <Input value={settingsForm.annualReminderDaysBefore} onChange={(event) => setSettingsForm((current) => ({ ...current, annualReminderDaysBefore: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Ekstensi file diizinkan</FieldLabel>
                      <Input value={settingsForm.allowedFileTypes} onChange={(event) => setSettingsForm((current) => ({ ...current, allowedFileTypes: event.target.value }))} />
                    </div>
                  </div>
                </section>

                <section className="rounded-[1.35rem] border border-border/80 bg-card/55 p-5">
                  <div className="mb-4 space-y-1">
                    <h3 className="text-base font-semibold text-foreground">Nomor Permohonan dan Template PDF</h3>
                    <p className="text-sm leading-6 text-muted-foreground">Format nomor cuti serta PDF resmi yang dipakai untuk preview dan download formulir.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <FieldLabel>Format nomor permohonan</FieldLabel>
                      <Input value={settingsForm.requestNumberFormat} onChange={(event) => setSettingsForm((current) => ({ ...current, requestNumberFormat: event.target.value }))} />
                    </div>
                    <div className="rounded-2xl border border-border bg-muted/20 p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">Template PDF Formulir Cuti Resmi</p>
                          <p className="text-sm leading-6 text-muted-foreground">
                            Unggah PDF formulir resmi agar hasil preview/download memakai layout asli. Jika belum diunggah, sistem memakai template gambar ulang internal.
                          </p>
                          <p className="text-xs leading-5 text-muted-foreground">
                            Template aktif: {settingsForm.leaveFormTemplateOriginalName || settingsForm.leaveFormTemplateFileName || "Belum ada template PDF resmi"}.
                          </p>
                        </div>
                        {settingsForm.leaveFormTemplateFileName ? (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => openHrFile(settingsForm.leaveFormTemplateFileName, "inline")}>
                              <Eye className="h-4 w-4" />
                              Pratinjau Template
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openHrFile(settingsForm.leaveFormTemplateFileName, "attachment")}>
                              <Download className="h-4 w-4" />
                              Unduh Template
                            </Button>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                        <Input type="file" accept="application/pdf" onChange={(event) => setLeaveTemplateFile(event.target.files?.[0] ?? null)} />
                        <Button type="button" disabled={isBusy || !data?.permissions.canManageSettings || !leaveTemplateFile} onClick={() => void saveLeaveTemplate()}>
                          <CalendarDays className="h-4 w-4" />
                          Simpan Template PDF
                        </Button>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="flex justify-end border-t border-border/70 pt-4">
                  <Button disabled={isBusy || !data?.permissions.canManageSettings} onClick={() => void runAction("update-settings", {
                    ...settingsForm,
                    annualLeaveDefaultDays: Number(settingsForm.annualLeaveDefaultDays),
                    defaultBalanceN: Number(settingsForm.defaultBalanceN),
                    defaultBalanceN1: Number(settingsForm.defaultBalanceN1),
                    defaultBalanceN2: Number(settingsForm.defaultBalanceN2),
                    maxUploadSizeMb: Number(settingsForm.maxUploadSizeMb),
                    approvalSlaDays: Number(settingsForm.approvalSlaDays),
                    annualReminderDaysBefore: Number(settingsForm.annualReminderDaysBefore),
                    annualReminderSchedulerEnabled: settingsForm.annualReminderSchedulerEnabled,
                    annualReminderSchedulerTime: settingsForm.annualReminderSchedulerTime,
                    balanceUsageOrder: settingsForm.balanceUsageOrder.split(",").map((item) => item.trim()).filter(Boolean),
                    allowedFileTypes: settingsForm.allowedFileTypes.split(",").map((item) => item.trim()).filter(Boolean),
                  }, "Pengaturan E-Kepegawaian disimpan.")}>
                    Simpan Pengaturan
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="border-border/80">
                <CardHeader className="pb-3">
                <CardTitle>Alur Persetujuan per Jenis Cuti</CardTitle>
                  <CardDescription>Susun bebas dari UI. Contoh urutan: atasan langsung, lalu pejabat berwenang.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <NativeSelect
                      value={leaveTypeForm.id}
                      onChange={(event) => {
                        const selected = data?.leaveTypes.find((item) => item.id === event.target.value);
                        if (selected) setLeaveTypeForm(leaveTypeToForm(selected));
                      }}
                    >
                      {data?.leaveTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </NativeSelect>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input placeholder="Nama jenis cuti" value={leaveTypeForm.name} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, name: event.target.value }))} />
                      <Input placeholder="Kode, contoh CT" value={leaveTypeForm.code} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, code: event.target.value }))} />
                    </div>
                    <Textarea rows={2} placeholder="Deskripsi aturan cuti" value={leaveTypeForm.description} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, description: event.target.value }))} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <FieldLabel>Mengurangi saldo tahunan</FieldLabel>
                        <NativeSelect value={String(leaveTypeForm.deductsAnnualBalance)} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, deductsAnnualBalance: event.target.value === "true" }))}>
                          <option value="true">Ya</option>
                          <option value="false">Tidak</option>
                        </NativeSelect>
                      </div>
                      <div className="space-y-2">
                        <FieldLabel>Wajib lampiran</FieldLabel>
                        <NativeSelect value={String(leaveTypeForm.requiresAttachment)} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, requiresAttachment: event.target.value === "true" }))}>
                          <option value="true">Ya</option>
                          <option value="false">Tidak</option>
                        </NativeSelect>
                      </div>
                      <Input placeholder="Maksimal hari, opsional" value={leaveTypeForm.maxDays} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, maxDays: event.target.value }))} />
                      <Input placeholder="Minimal hari sebelum pengajuan" value={leaveTypeForm.minDaysBeforeRequest} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, minDaysBeforeRequest: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel>Urutan persetujuan</FieldLabel>
                      <div className="rounded-2xl border border-border bg-muted/20 p-3">
                        <div className="space-y-2">
                          {workflowSteps.map((step, index) => (
                            <div
                              key={`${step}-${index}`}
                              draggable
                              onDragStart={() => setDraggedWorkflowIndex(index)}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={() => dropWorkflowStep(index)}
                              onDragEnd={() => setDraggedWorkflowIndex(null)}
                              className={cn(
                                "flex items-center gap-3 rounded-xl border border-border bg-card/85 p-3 shadow-sm",
                                draggedWorkflowIndex === index && "border-primary/50 bg-primary/5"
                              )}
                            >
                              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <Badge variant="muted">{index + 1}</Badge>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-foreground">{workflowStepLabels[step] ?? step}</p>
                                <p className="text-xs leading-5 text-muted-foreground">{workflowStepOptions.find(([value]) => value === step)?.[2] ?? "Tahap persetujuan."}</p>
                              </div>
                              <div className="flex shrink-0 gap-1">
                                <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => moveWorkflowStep(index, -1)} aria-label="Naikkan tahap persetujuan">
                                  <ArrowUp className="h-4 w-4" />
                                </Button>
                                <Button type="button" size="icon" variant="ghost" disabled={index === workflowSteps.length - 1} onClick={() => moveWorkflowStep(index, 1)} aria-label="Turunkan tahap persetujuan">
                                  <ArrowDown className="h-4 w-4" />
                                </Button>
                                <Button type="button" size="icon" variant="ghost" disabled={workflowSteps.length <= 1} onClick={() => removeWorkflowStep(index)} aria-label="Hapus tahap persetujuan">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {workflowStepOptions
                            .filter(([value]) => !workflowSteps.includes(value))
                            .map(([value, label]) => (
                              <Button key={value} type="button" size="sm" variant="outline" onClick={() => addWorkflowStep(value)}>
                                <Plus className="h-4 w-4" />
                                {label}
                              </Button>
                            ))}
                        </div>
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">
                        Tahap bisa digeser drag-and-drop atau tombol naik/turun. Sistem persetujuan membaca urutan ini saat permohonan diajukan dan saat pejabat menyetujui.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <NativeSelect value={String(leaveTypeForm.isActive)} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, isActive: event.target.value === "true" }))}>
                        <option value="true">Aktif</option>
                        <option value="false">Nonaktif</option>
                      </NativeSelect>
                      <Input placeholder="Urutan tampil" value={leaveTypeForm.sortOrder} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, sortOrder: event.target.value }))} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={isBusy || !data?.permissions.canManageSettings} onClick={() => void saveLeaveType()}>
                        Simpan Jenis Cuti
                      </Button>
                      <Button variant="outline" disabled={isBusy} onClick={() => setLeaveTypeForm({ ...initialLeaveTypeForm, sortOrder: String((data?.leaveTypes.length ?? 0) + 100) })}>
                        Jenis Baru
                      </Button>
                    </div>
                </CardContent>
              </Card>

              <Card className="border-border/80">
                <CardHeader className="pb-3">
                  <CardTitle>Impor Kalender Libur</CardTitle>
                  <CardDescription>Impor hari libur nasional atau cuti bersama untuk perhitungan hari kerja cuti.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Textarea
                      rows={9}
                      value={holidayImportText}
                      onChange={(event) => setHolidayImportText(event.target.value)}
                      placeholder="YYYY-MM-DD,Nama,type,is_working_day"
                    />
                    <div className="rounded-xl border border-border bg-muted/35 p-4 text-sm leading-6 text-muted-foreground">
                      Format per baris: <code>2026-05-01,Hari Buruh,holiday,0</code>. Kolom terakhir isi <code>0</code> untuk libur dan <code>1</code> bila tanggal tersebut tetap hari kerja.
                    </div>
                    <Button
                      variant="outline"
                      disabled={isBusy || !data?.permissions.canManageSettings}
                      onClick={() => void runAction("import-holidays", { text: holidayImportText }, "Kalender libur berhasil diimpor.")}
                    >
                      Impor Kalender
                    </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}

function EmployeeTable({ employees }: { employees: EmployeeProfileDto[] }) {
  if (!employees.length) return <EmptyMini text="Belum ada profil pegawai yang dapat ditampilkan." />;

  return (
    <div className="aleta-blue-scrollbar overflow-x-auto rounded-2xl border border-border/75 bg-card/55">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-5 py-3">Nama</th>
            <th className="px-4 py-3">NIP</th>
            <th className="px-4 py-3">Jabatan</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Unit</th>
            <th className="px-4 py-3">Atasan</th>
            <th className="px-5 py-3">Kontak</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id} className="border-b border-border/70 align-top">
              <td className="px-5 py-3 font-medium text-foreground">{employee.fullName}</td>
              <td className="px-4 py-3">{employee.nip || "-"}</td>
              <td className="px-4 py-3">{employee.positionName}</td>
              <td className="px-4 py-3">
                <Badge variant={employee.isStateOfficial ? "warning" : employee.employmentStatus === "pppk" ? "default" : "outline"}>
                  {formatEmploymentStatus(employee)}
                </Badge>
              </td>
              <td className="px-4 py-3">{employee.unitKerja}</td>
              <td className="px-4 py-3">{employee.supervisorName ?? "-"}</td>
              <td className="px-5 py-3">{employee.phone || employee.email || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AttendanceList({
  items,
  canManage,
  runAction,
  busy,
}: {
  items: AttendancePermissionDto[];
  canManage: boolean;
  runAction: <T>(action: string, payload: unknown, successMessage: string) => Promise<T | null>;
  busy: boolean;
}) {
  if (!items.length) return <EmptyMini text="Belum ada izin kehadiran." />;

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-2xl border border-border bg-card/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="font-semibold text-foreground">{attendanceLabels[item.permissionType]} - {item.employeeName}</p>
              <p className="text-sm text-muted-foreground">{formatDate(item.requestDate)} pukul {item.requestedTime} | {item.status}</p>
              <p className="mt-2 text-sm text-muted-foreground">{item.reason}</p>
            </div>
            {canManage && item.status === "submitted" ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => runAction("approve-attendance-permission", { id: item.id, note: "Disetujui." }, "Izin disetujui.")}>Setujui</Button>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => runAction("reject-attendance-permission", { id: item.id, note: "Ditolak." }, "Izin ditolak.")}>Tolak</Button>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
