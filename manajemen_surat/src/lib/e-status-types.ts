import type { RoleId, UserPersona } from "@/lib/types";

export const E_STATUS_MODULE_ID = "e-status";
export const E_STATUS_SETTINGS_MODULE_ID = "e-status-settings";
export const E_STATUS_ROUTE = "/e-status";

export const E_STATUS_PERMISSIONS = [
  "estatus.access",
  "estatus.dashboard.view",
  "estatus.settings.manage",
  "estatus.sipp.connection.manage",
  "estatus.sipp.sync.run",
  "estatus.sipp.mapping.manage",
  "estatus.templates.manage",
  "estatus.records.view.masked",
  "estatus.records.view.full_nik",
  "estatus.records.manual_override",
  "estatus.records.validate",
  "estatus.records.exclude",
  "estatus.batch.create",
  "estatus.batch.review",
  "estatus.batch.approve",
  "estatus.batch.lock",
  "estatus.batch.revision",
  "estatus.batch.export",
  "estatus.transmission.send",
  "estatus.transmission.followup",
  "estatus.exchange.manage",
  "estatus.integration.manage",
  "estatus.ai_assist.use",
  "estatus.incident.manage",
  "estatus.minimization.check",
  "estatus.reports.view",
  "estatus.audit.view",
] as const;

export type EStatusPermission = (typeof E_STATUS_PERMISSIONS)[number];
export type EStatusRoleView = "admin" | "operator" | "validator" | "approver" | "leader" | "auditor";

export const E_STATUS_PERMISSION = {
  ACCESS: "estatus.access",
  DASHBOARD_VIEW: "estatus.dashboard.view",
  SETTINGS_MANAGE: "estatus.settings.manage",
  SIPP_CONNECTION_MANAGE: "estatus.sipp.connection.manage",
  SIPP_SYNC_RUN: "estatus.sipp.sync.run",
  SIPP_MAPPING_MANAGE: "estatus.sipp.mapping.manage",
  TEMPLATES_MANAGE: "estatus.templates.manage",
  RECORDS_VIEW_MASKED: "estatus.records.view.masked",
  RECORDS_VIEW_FULL_NIK: "estatus.records.view.full_nik",
  RECORDS_MANUAL_OVERRIDE: "estatus.records.manual_override",
  RECORDS_VALIDATE: "estatus.records.validate",
  RECORDS_EXCLUDE: "estatus.records.exclude",
  BATCH_CREATE: "estatus.batch.create",
  BATCH_REVIEW: "estatus.batch.review",
  BATCH_APPROVE: "estatus.batch.approve",
  BATCH_LOCK: "estatus.batch.lock",
  BATCH_REVISION: "estatus.batch.revision",
  BATCH_EXPORT: "estatus.batch.export",
  TRANSMISSION_SEND: "estatus.transmission.send",
  TRANSMISSION_FOLLOWUP: "estatus.transmission.followup",
  EXCHANGE_MANAGE: "estatus.exchange.manage",
  INTEGRATION_MANAGE: "estatus.integration.manage",
  AI_ASSIST_USE: "estatus.ai_assist.use",
  INCIDENT_MANAGE: "estatus.incident.manage",
  MINIMIZATION_CHECK: "estatus.minimization.check",
  REPORTS_VIEW: "estatus.reports.view",
  AUDIT_VIEW: "estatus.audit.view",
} as const satisfies Record<string, EStatusPermission>;

const BASE_PERMISSIONS: EStatusPermission[] = [
  E_STATUS_PERMISSION.ACCESS,
  E_STATUS_PERMISSION.DASHBOARD_VIEW,
  E_STATUS_PERMISSION.RECORDS_VIEW_MASKED,
  E_STATUS_PERMISSION.REPORTS_VIEW,
];

const ADMIN_PERMISSIONS: EStatusPermission[] = [
  ...BASE_PERMISSIONS,
  E_STATUS_PERMISSION.SETTINGS_MANAGE,
  E_STATUS_PERMISSION.SIPP_CONNECTION_MANAGE,
  E_STATUS_PERMISSION.SIPP_SYNC_RUN,
  E_STATUS_PERMISSION.SIPP_MAPPING_MANAGE,
  E_STATUS_PERMISSION.TEMPLATES_MANAGE,
  E_STATUS_PERMISSION.RECORDS_VIEW_FULL_NIK,
  E_STATUS_PERMISSION.RECORDS_MANUAL_OVERRIDE,
  E_STATUS_PERMISSION.RECORDS_VALIDATE,
  E_STATUS_PERMISSION.RECORDS_EXCLUDE,
  E_STATUS_PERMISSION.BATCH_CREATE,
  E_STATUS_PERMISSION.BATCH_REVIEW,
  E_STATUS_PERMISSION.BATCH_APPROVE,
  E_STATUS_PERMISSION.BATCH_LOCK,
  E_STATUS_PERMISSION.BATCH_REVISION,
  E_STATUS_PERMISSION.BATCH_EXPORT,
  E_STATUS_PERMISSION.TRANSMISSION_SEND,
  E_STATUS_PERMISSION.TRANSMISSION_FOLLOWUP,
  E_STATUS_PERMISSION.EXCHANGE_MANAGE,
  E_STATUS_PERMISSION.INTEGRATION_MANAGE,
  E_STATUS_PERMISSION.AI_ASSIST_USE,
  E_STATUS_PERMISSION.INCIDENT_MANAGE,
  E_STATUS_PERMISSION.MINIMIZATION_CHECK,
  E_STATUS_PERMISSION.AUDIT_VIEW,
];

const OPERATOR_PERMISSIONS: EStatusPermission[] = [
  ...BASE_PERMISSIONS,
  E_STATUS_PERMISSION.SIPP_SYNC_RUN,
  E_STATUS_PERMISSION.RECORDS_MANUAL_OVERRIDE,
  E_STATUS_PERMISSION.RECORDS_VALIDATE,
  E_STATUS_PERMISSION.RECORDS_EXCLUDE,
  E_STATUS_PERMISSION.BATCH_CREATE,
  E_STATUS_PERMISSION.BATCH_EXPORT,
  E_STATUS_PERMISSION.TRANSMISSION_SEND,
  E_STATUS_PERMISSION.TRANSMISSION_FOLLOWUP,
  E_STATUS_PERMISSION.AI_ASSIST_USE,
  E_STATUS_PERMISSION.MINIMIZATION_CHECK,
];

const VALIDATOR_PERMISSIONS: EStatusPermission[] = [
  ...BASE_PERMISSIONS,
  E_STATUS_PERMISSION.RECORDS_VIEW_FULL_NIK,
  E_STATUS_PERMISSION.RECORDS_VALIDATE,
  E_STATUS_PERMISSION.RECORDS_EXCLUDE,
  E_STATUS_PERMISSION.BATCH_REVIEW,
  E_STATUS_PERMISSION.BATCH_EXPORT,
  E_STATUS_PERMISSION.TRANSMISSION_FOLLOWUP,
  E_STATUS_PERMISSION.AI_ASSIST_USE,
  E_STATUS_PERMISSION.MINIMIZATION_CHECK,
];

const APPROVER_PERMISSIONS: EStatusPermission[] = [
  ...BASE_PERMISSIONS,
  E_STATUS_PERMISSION.RECORDS_VIEW_FULL_NIK,
  E_STATUS_PERMISSION.BATCH_REVIEW,
  E_STATUS_PERMISSION.BATCH_APPROVE,
  E_STATUS_PERMISSION.BATCH_LOCK,
  E_STATUS_PERMISSION.BATCH_REVISION,
  E_STATUS_PERMISSION.BATCH_EXPORT,
  E_STATUS_PERMISSION.EXCHANGE_MANAGE,
  E_STATUS_PERMISSION.INCIDENT_MANAGE,
  E_STATUS_PERMISSION.MINIMIZATION_CHECK,
  E_STATUS_PERMISSION.REPORTS_VIEW,
];

const LEADER_PERMISSIONS: EStatusPermission[] = [
  ...BASE_PERMISSIONS,
  E_STATUS_PERMISSION.BATCH_REVIEW,
  E_STATUS_PERMISSION.REPORTS_VIEW,
];

const AUDITOR_PERMISSIONS: EStatusPermission[] = [
  ...BASE_PERMISSIONS,
  E_STATUS_PERMISSION.RECORDS_VIEW_FULL_NIK,
  E_STATUS_PERMISSION.INCIDENT_MANAGE,
  E_STATUS_PERMISSION.AUDIT_VIEW,
];

const ADMIN_ROLE_IDS = new Set<RoleId>(["super-admin", "admin"]);
const LEADER_ROLE_IDS = new Set<RoleId>(["ketua", "wakil-ketua"]);
const APPROVER_ROLE_IDS = new Set<RoleId>(["panitera", "panitera-muda"]);
const VALIDATOR_ROLE_IDS = new Set<RoleId>(["panitera", "panitera-muda", "panitera-pengganti", "pejabat-struktural"]);
const OPERATOR_ROLE_IDS = new Set<RoleId>(["analis-perkara", "pelaksana", "staf", "panitera-pengganti"]);

const AUDITOR_ADDITIONAL_ROLE_IDS = new Set(["estatus-auditor", "auditor", "petugas-ti-helpdesk"]);
const OPERATOR_ADDITIONAL_ROLE_IDS = new Set(["estatus-operator", "operator-sipp", "petugas-minutasi"]);
const VALIDATOR_ADDITIONAL_ROLE_IDS = new Set(["estatus-validator", "petugas-validasi-ecourt"]);
const APPROVER_ADDITIONAL_ROLE_IDS = new Set(["estatus-approver"]);

function hasAnyAdditionalRole(user: UserPersona | null | undefined, roleIds: Set<string>) {
  return Boolean(user?.additionalRoleIds?.some((roleId) => roleIds.has(roleId)));
}

function addPermissions(target: Set<EStatusPermission>, permissions: readonly EStatusPermission[]) {
  for (const permission of permissions) {
    target.add(permission);
  }
}

export type EStatusAccess = {
  roleView: EStatusRoleView;
  permissions: EStatusPermission[];
  canView: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  isValidator: boolean;
  isApprover: boolean;
  isLeader: boolean;
  isAuditor: boolean;
};

export function resolveEStatusAccess(
  user: UserPersona | null | undefined,
  options?: {
    effectiveRoleId?: RoleId | null;
  }
): EStatusAccess {
  const roleId = options?.effectiveRoleId ?? user?.roleId ?? null;
  const permissions = new Set<EStatusPermission>();
  const isAdmin = Boolean(roleId && ADMIN_ROLE_IDS.has(roleId));
  const isLeader = Boolean(roleId && LEADER_ROLE_IDS.has(roleId));
  const isApprover = Boolean(roleId && APPROVER_ROLE_IDS.has(roleId)) || hasAnyAdditionalRole(user, APPROVER_ADDITIONAL_ROLE_IDS);
  const isValidator = Boolean(roleId && VALIDATOR_ROLE_IDS.has(roleId)) || hasAnyAdditionalRole(user, VALIDATOR_ADDITIONAL_ROLE_IDS);
  const isOperator = Boolean(roleId && OPERATOR_ROLE_IDS.has(roleId)) || hasAnyAdditionalRole(user, OPERATOR_ADDITIONAL_ROLE_IDS);
  const isAuditor = hasAnyAdditionalRole(user, AUDITOR_ADDITIONAL_ROLE_IDS);

  if (isAdmin) addPermissions(permissions, ADMIN_PERMISSIONS);
  if (isLeader) addPermissions(permissions, LEADER_PERMISSIONS);
  if (isApprover) addPermissions(permissions, APPROVER_PERMISSIONS);
  if (isValidator) addPermissions(permissions, VALIDATOR_PERMISSIONS);
  if (isOperator) addPermissions(permissions, OPERATOR_PERMISSIONS);
  if (isAuditor) addPermissions(permissions, AUDITOR_PERMISSIONS);

  const roleView: EStatusRoleView = isAdmin
    ? "admin"
    : isApprover
      ? "approver"
      : isValidator
        ? "validator"
        : isOperator
          ? "operator"
          : isAuditor
            ? "auditor"
            : "leader";

  return {
    roleView,
    permissions: [...permissions],
    canView: permissions.has(E_STATUS_PERMISSION.ACCESS),
    isAdmin,
    isOperator,
    isValidator,
    isApprover,
    isLeader,
    isAuditor,
  };
}

export function hasEStatusPermission(access: EStatusAccess, permission: EStatusPermission) {
  return access.permissions.includes(permission);
}
