export type HrLeaveStatus =
  | "draft"
  | "submitted"
  | "waiting_supervisor_approval"
  | "waiting_authorized_officer_approval"
  | "approved"
  | "rejected"
  | "revision_required"
  | "cancelled";

export type HrSubmissionType = "pck" | "skp" | "wfa";
export type HrSubmissionStatus = "draft" | "submitted" | "verified" | "rejected" | "revision_required";
export type HrSubmissionAttachmentStatus = "pending" | "verified" | "rejected" | "revision_required";
export type HrAttendancePermissionType = "late_arrival" | "early_leave";
export type HrAttendancePermissionStatus = "submitted" | "approved" | "rejected" | "cancelled";
export type HrCalendarItemType = "leave" | "holiday";
export type HrNotificationAudience = "employee" | "approver" | "admin";
export type HrPublicFormType = "cuti" | "upload-pck" | "upload-skp" | "wfa" | "lambat-datang" | "cepat-pulang";
export type HrEmploymentStatus = "pns" | "pppk" | "cpns" | "pejabat_negara" | "honorer" | "lainnya";

export type HrPublicFormSettingsDto = {
  cuti: boolean;
  uploadPck: boolean;
  uploadSkp: boolean;
  wfa: boolean;
  lambatDatang: boolean;
  cepatPulang: boolean;
  hasilRapat: boolean;
};

export type HrPermissionFlags = {
  canManageAll: boolean;
  canManageSettings: boolean;
  canManageSignatures: boolean;
  canApprove: boolean;
  roleView: "admin" | "approver" | "employee";
};

export type EmployeeProfileDto = {
  id: string;
  userId: string;
  nip: string;
  employeeNumber: string;
  fullName: string;
  positionId: string;
  positionName: string;
  unitKerja: string;
  rankGrade: string;
  employmentStatus: HrEmploymentStatus;
  employmentStatusLabel: string;
  employmentRuleLabel: string;
  isStateOfficial: boolean;
  isActive: boolean;
  supervisorEmployeeId: string | null;
  supervisorName: string | null;
  approvalOfficerEmployeeId: string | null;
  approvalOfficerName: string | null;
  phone: string;
  email: string;
};

export type LeaveTypeDto = {
  id: string;
  name: string;
  code: string;
  description: string;
  approvalWorkflow: string[];
  deductsAnnualBalance: boolean;
  requiresAttachment: boolean;
  maxDays: number | null;
  minDaysBeforeRequest: number | null;
  isActive: boolean;
  sortOrder: number;
};

export type LeaveBalanceDto = {
  id: string;
  employeeId: string;
  year: number;
  balanceN: number;
  balanceN1: number;
  balanceN2: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  availableDays: number;
};

export type LeaveBalanceTransactionDto = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveRequestId: string | null;
  year: number;
  sourceYearType: string;
  transactionType: string;
  days: number;
  description: string;
  createdBy: string | null;
  createdAt: string;
};

export type LeaveRequestDto = {
  id: string;
  employeeId: string;
  employeeName: string;
  unitKerja: string;
  leaveTypeId: string;
  leaveTypeName: string;
  requestNumber: string | null;
  startDate: string;
  endDate: string;
  totalDays: number;
  calculationType: string;
  reason: string;
  addressDuringLeave: string;
  contactDuringLeave: string;
  status: HrLeaveStatus;
  currentApprovalLevel: number;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HrCalendarItemDto = {
  id: string;
  type: HrCalendarItemType;
  employeeId: string | null;
  employeeName: string;
  unitKerja: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
};

export type HrSlaItemDto = {
  id: string;
  entityType: "leave_request" | "submission" | "attendance_permission";
  title: string;
  employeeId: string | null;
  employeeName: string;
  unitKerja: string;
  status: string;
  submittedAt: string;
  daysWaiting: number;
  slaDays: number;
  overdue: boolean;
};

export type LeaveApprovalLogDto = {
  id: string;
  leaveRequestId: string;
  approverUserId: string | null;
  approverEmployeeId: string | null;
  approverName: string;
  approvalLevel: number;
  action: string;
  statusBefore: string;
  statusAfter: string;
  note: string;
  actedAt: string;
};

export type HrSubmissionDto = {
  id: string;
  employeeId: string;
  employeeName: string;
  submissionType: HrSubmissionType;
  title: string;
  periodYear: number;
  periodMonth: number | null;
  submissionDate: string;
  description: string;
  status: HrSubmissionStatus;
  verificationNote: string;
  verifiedAt: string | null;
  createdAt: string;
};

export type AttendancePermissionDto = {
  id: string;
  employeeId: string;
  employeeName: string;
  permissionType: HrAttendancePermissionType;
  requestDate: string;
  requestedTime: string;
  reason: string;
  status: HrAttendancePermissionStatus;
  note: string;
  createdAt: string;
};

export type MeetingResultDto = {
  id: string;
  title: string;
  meetingDate: string;
  location: string;
  participants: string;
  summary: string;
  category: string;
  visibility: string;
  status: string;
  documentPublic: boolean;
  createdAt: string;
};

export type EmployeeDocumentDto = {
  id: string;
  employeeId: string;
  employeeName: string;
  category: string;
  documentNumber: string;
  documentDate: string;
  title: string;
  description: string;
  visibility: string;
  createdAt: string;
};

export type HrEmployeeSignatureDto = {
  id: string;
  employeeId: string;
  employeeName: string;
  signatureRole: string;
  fileName: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  isActive: boolean;
  createdAt: string;
};

export type HrAnnualDocumentRequirementDto = {
  id: string;
  submissionType: HrSubmissionType;
  name: string;
  periodYear: number;
  dueDate: string;
  targetRoleIds: string[];
  targetPositionIds: string[];
  isActive: boolean;
  missingCount: number;
  submittedCount: number;
};

export type HrNotificationTemplateDto = {
  id: string;
  templateKey: string;
  name: string;
  audience: HrNotificationAudience;
  eventType: string;
  channel: "whatsapp";
  body: string;
  isActive: boolean;
  updatedAt: string;
};

export type HrGeneratedDocumentDto = {
  id: string;
  leaveRequestId: string;
  documentType: string;
  fileName: string;
  verificationCode: string;
  generatedAt: string;
};

export type HrAttachmentDto = {
  id: string;
  entityType: "leave_request" | "submission" | "attendance_permission" | "employee_document" | "meeting_result" | "employee_signature";
  entityId: string;
  employeeId: string | null;
  ownerName: string;
  title: string;
  fileName: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
  verificationStatus: HrSubmissionAttachmentStatus | null;
  verificationNote: string;
  verifiedAt: string | null;
  verifiedByName: string | null;
};

export type HrSettingsDto = {
  moduleEnabled: boolean;
  annualLeaveDefaultDays: number;
  defaultBalanceN: number;
  defaultBalanceN1: number;
  defaultBalanceN2: number;
  balanceUsageOrder: string[];
  calculationType: "working_days" | "calendar_days";
  maxUploadSizeMb: number;
  allowedFileTypes: string[];
  requestNumberFormat: string;
  approvalSlaDays: number;
  annualReminderDaysBefore: number;
  annualReminderSchedulerEnabled: boolean;
  annualReminderSchedulerTime: string;
  annualReminderSchedulerLastRunAt: string | null;
  annualReminderSchedulerLastMessage: string;
  leaveFormTemplateFileName: string;
  leaveFormTemplateOriginalName: string;
  publicForms: HrPublicFormSettingsDto;
  publicMaxUploadSizeMb: number;
  publicAllowedFileTypes: string[];
  publicRequiresCaptcha: boolean;
  publicMode: "unrestricted" | "token";
  publicInstructions: string;
  publicSuccessMessage: string;
};

export type HrPublicSubmissionResultDto = {
  ticketCode: string;
  formType: HrPublicFormType;
  formLabel: string;
  entityType: "leave_request" | "submission" | "attendance_permission";
  entityId: string;
  status: string;
  submittedAt: string;
  message: string;
};

export type HrPublicStatusDto = {
  ticketCode: string;
  formLabel: string;
  submittedAt: string;
  status: string;
  statusLabel: string;
  note: string;
  nextInstruction: string;
};

export type HrPublicLeaveBalanceBucketDto = {
  source: "N" | "N-1" | "N-2";
  label: string;
  initialDays: number;
  availableDays: number;
  afterRequestDays: number;
};

export type HrPublicLeaveCalendarDayDto = {
  date: string;
  dayName: string;
  label: string;
  type: string;
  isWeekend: boolean;
  isHoliday: boolean;
  isWorkingDay: boolean;
  counted: boolean;
};

export type HrLeaveDailyImpactDto = {
  date: string;
  totalEmployees: number;
  approvedLeaveEmployees: number;
  pendingLeaveEmployees: number;
  simulatedAdditionalEmployees: number;
  totalOnLeaveWithSimulation: number;
  leavePercentage: number;
  simulatedLeavePercentage: number;
  approvedLeaveRequestIds: string[];
  pendingLeaveRequestIds: string[];
};

export type HrLeaveStatisticsDto = {
  today: HrLeaveDailyImpactDto;
  nextWorkdays: HrLeaveDailyImpactDto[];
  monthlyPeak: HrLeaveDailyImpactDto | null;
  byStatus: Array<{
    status: HrLeaveStatus;
    label: string;
    count: number;
  }>;
  byLeaveType: Array<{
    leaveTypeId: string;
    leaveTypeName: string;
    count: number;
    approvedCount: number;
    pendingCount: number;
  }>;
};

export type HrPublicLeavePreviewDto = {
  startDate: string;
  endDate: string;
  calculationType: HrSettingsDto["calculationType"];
  totalDays: number;
  leaveTypeId: string;
  leaveTypeName: string;
  deductsAnnualBalance: boolean;
  requiresAttachment: boolean;
  enoughBalance: boolean;
  availableDays: number;
  requestedDays: number;
  buckets: HrPublicLeaveBalanceBucketDto[];
  calendarDays: HrPublicLeaveCalendarDayDto[];
  dailyImpacts: HrLeaveDailyImpactDto[];
  maxSimulatedLeavePercentage: number;
  warnings: string[];
};

export type HrPublicEmployeeLookupSuggestionDto = {
  selectionToken: string;
  name: string;
  positionName: string;
  unitKerja: string;
  identifierMasked: string;
  contactMasked: string;
};

export type HrPublicEmployeeLookupDto = {
  matched: boolean;
  ambiguous: boolean;
  message: string;
  suggestions: HrPublicEmployeeLookupSuggestionDto[];
  employee: {
    name: string;
    identifier: string;
    contact: string;
    positionName: string;
    unitKerja: string;
    employmentStatusLabel: string;
    identifierMasked: string;
    contactMasked: string;
  } | null;
  balance: {
    year: number;
    balanceN: number;
    balanceN1: number;
    balanceN2: number;
    usedDays: number;
    pendingDays: number;
    availableDays: number;
    buckets: HrPublicLeaveBalanceBucketDto[];
  } | null;
  leavePreview: HrPublicLeavePreviewDto | null;
};

export type HrPublicMeetingResultDto = {
  id: string;
  title: string;
  meetingDate: string;
  location: string;
  participants: string;
  summary: string;
  category: string;
  hasPublicAttachment: boolean;
  createdAt: string;
};

export type HrPublicOptionsDto = {
  settings: Pick<HrSettingsDto, "publicForms" | "publicMaxUploadSizeMb" | "publicAllowedFileTypes" | "publicRequiresCaptcha" | "publicMode" | "publicInstructions" | "publicSuccessMessage">;
  leaveTypes: Array<Pick<LeaveTypeDto, "id" | "name" | "code" | "requiresAttachment">>;
};

export type HrDashboardMetricsDto = {
  totalEmployees: number;
  totalLeaveRequests: number;
  waitingApproval: number;
  approved: number;
  rejected: number;
  employeesOnLeave: number;
  submissionsWaitingVerification: number;
  attendanceWaitingApproval: number;
  holidayCount: number;
  slaOverdue: number;
  missingAnnualDocuments: number;
  signatureCount: number;
};

export type HrDashboardDto = {
  currentEmployee: EmployeeProfileDto | null;
  permissions: HrPermissionFlags;
  settings: HrSettingsDto;
  metrics: HrDashboardMetricsDto;
  leaveStatistics: HrLeaveStatisticsDto;
  employees: EmployeeProfileDto[];
  leaveTypes: LeaveTypeDto[];
  leaveBalances: LeaveBalanceDto[];
  leaveRequests: LeaveRequestDto[];
  approvalLogs: LeaveApprovalLogDto[];
  submissions: HrSubmissionDto[];
  attendancePermissions: AttendancePermissionDto[];
  meetingResults: MeetingResultDto[];
  employeeDocuments: EmployeeDocumentDto[];
  attachments: HrAttachmentDto[];
  calendarItems: HrCalendarItemDto[];
  slaItems: HrSlaItemDto[];
  balanceTransactions: LeaveBalanceTransactionDto[];
  employeeSignatures: HrEmployeeSignatureDto[];
  documentRequirements: HrAnnualDocumentRequirementDto[];
  notificationTemplates: HrNotificationTemplateDto[];
  generatedDocuments: HrGeneratedDocumentDto[];
};
