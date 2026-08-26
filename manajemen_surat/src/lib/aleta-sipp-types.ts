import type { RoleId, UserPersona } from "@/lib/types";

export const ALETA_SIPP_MODULE_ID = "aleta-sipp";
export const ALETA_SIPP_SETTINGS_MODULE_ID = "aleta-sipp-settings";
export const ALETA_SIPP_ROUTE = "/aleta-sipp";
export const ALETA_SIPP_ADMIN_ROUTE = "/admin/aleta-sipp";

export const ALETA_SIPP_PERMISSIONS = [
  "aleta_sipp.view_dashboard",
  "aleta_sipp.view_dictionary",
  "aleta_sipp.view_query_registry",
  "aleta_sipp.view_variable_registry",
  "aleta_sipp.view_sql_preview",
  "aleta_sipp.run_registered_query",
  "aleta_sipp.manage_query_registry",
  "aleta_sipp.manage_variables",
  "aleta_sipp.import_abt",
  "aleta_sipp.import_word_query",
  "aleta_sipp.import_sql_structure",
  "aleta_sipp.view_monitoring",
  "aleta_sipp.run_monitoring",
  "aleta_sipp.view_assessment",
  "aleta_sipp.run_assessment",
  "aleta_sipp.manage_assessment",
  "aleta_sipp.import_monitoring",
  "aleta_sipp.view_finance_monitoring",
  "aleta_sipp.view_case_monitoring",
  "aleta_sipp.view_control_monitoring",
  "aleta_sipp.view_performance_monitoring",
  "aleta_sipp.view_ac_monitoring",
  "aleta_sipp.view_reports",
  "aleta_sipp.manage_monitoring_features",
  "aleta_sipp.review_monitoring_query",
  "aleta_sipp.manage_manual_input",
  "aleta_sipp.view_sensitive_case_data",
  "aleta_sipp.view_financial_data",
  "aleta_sipp.view_sk_assessment",
  "aleta_sipp.run_sk_assessment",
  "aleta_sipp.manage_sk_assessment",
  "aleta_sipp.export_sk_assessment",
  "aleta_sipp.view_pendukung2018_features",
  "aleta_sipp.manage_pendukung2018_import",
  "aleta_sipp.run_pendukung2018_monitoring",
  "aleta_sipp.view_pendukung2018_reports",
  "aleta_sipp.export_pendukung2018_reports",
  "aleta_sipp.review_pendukung2018_queries",
  "aleta_sipp.input_pendukung2018_manual",
  "aleta_sipp.import_sk_assessment",
  "aleta_sipp.manage_indicator_mapping",
  "aleta_sipp.view_monitoring_detail",
  "aleta_sipp.export_monitoring",
  "aleta_sipp.manage_followup",
  "aleta_sipp.print_schedule_pdf",
  "aleta_sipp.manage_settings",
  "aleta_sipp.view_audit",
] as const;

export type AletaSippPermission = (typeof ALETA_SIPP_PERMISSIONS)[number];

export const ALETA_SIPP_PERMISSION = {
  VIEW_DASHBOARD: "aleta_sipp.view_dashboard",
  VIEW_DICTIONARY: "aleta_sipp.view_dictionary",
  VIEW_QUERY_REGISTRY: "aleta_sipp.view_query_registry",
  VIEW_VARIABLE_REGISTRY: "aleta_sipp.view_variable_registry",
  VIEW_SQL_PREVIEW: "aleta_sipp.view_sql_preview",
  RUN_REGISTERED_QUERY: "aleta_sipp.run_registered_query",
  MANAGE_QUERY_REGISTRY: "aleta_sipp.manage_query_registry",
  MANAGE_VARIABLES: "aleta_sipp.manage_variables",
  IMPORT_ABT: "aleta_sipp.import_abt",
  IMPORT_WORD_QUERY: "aleta_sipp.import_word_query",
  IMPORT_SQL_STRUCTURE: "aleta_sipp.import_sql_structure",
  VIEW_MONITORING: "aleta_sipp.view_monitoring",
  RUN_MONITORING: "aleta_sipp.run_monitoring",
  VIEW_ASSESSMENT: "aleta_sipp.view_assessment",
  RUN_ASSESSMENT: "aleta_sipp.run_assessment",
  MANAGE_ASSESSMENT: "aleta_sipp.manage_assessment",
  IMPORT_MONITORING: "aleta_sipp.import_monitoring",
  VIEW_FINANCE_MONITORING: "aleta_sipp.view_finance_monitoring",
  VIEW_CASE_MONITORING: "aleta_sipp.view_case_monitoring",
  VIEW_CONTROL_MONITORING: "aleta_sipp.view_control_monitoring",
  VIEW_PERFORMANCE_MONITORING: "aleta_sipp.view_performance_monitoring",
  VIEW_AC_MONITORING: "aleta_sipp.view_ac_monitoring",
  VIEW_REPORTS: "aleta_sipp.view_reports",
  MANAGE_MONITORING_FEATURES: "aleta_sipp.manage_monitoring_features",
  REVIEW_MONITORING_QUERY: "aleta_sipp.review_monitoring_query",
  MANAGE_MANUAL_INPUT: "aleta_sipp.manage_manual_input",
  VIEW_SENSITIVE_CASE_DATA: "aleta_sipp.view_sensitive_case_data",
  VIEW_FINANCIAL_DATA: "aleta_sipp.view_financial_data",
  VIEW_SK_ASSESSMENT: "aleta_sipp.view_sk_assessment",
  RUN_SK_ASSESSMENT: "aleta_sipp.run_sk_assessment",
  MANAGE_SK_ASSESSMENT: "aleta_sipp.manage_sk_assessment",
  EXPORT_SK_ASSESSMENT: "aleta_sipp.export_sk_assessment",
  VIEW_PENDUKUNG2018_FEATURES: "aleta_sipp.view_pendukung2018_features",
  MANAGE_PENDUKUNG2018_IMPORT: "aleta_sipp.manage_pendukung2018_import",
  RUN_PENDUKUNG2018_MONITORING: "aleta_sipp.run_pendukung2018_monitoring",
  VIEW_PENDUKUNG2018_REPORTS: "aleta_sipp.view_pendukung2018_reports",
  EXPORT_PENDUKUNG2018_REPORTS: "aleta_sipp.export_pendukung2018_reports",
  REVIEW_PENDUKUNG2018_QUERIES: "aleta_sipp.review_pendukung2018_queries",
  INPUT_PENDUKUNG2018_MANUAL: "aleta_sipp.input_pendukung2018_manual",
  IMPORT_SK_ASSESSMENT: "aleta_sipp.import_sk_assessment",
  MANAGE_INDICATOR_MAPPING: "aleta_sipp.manage_indicator_mapping",
  VIEW_MONITORING_DETAIL: "aleta_sipp.view_monitoring_detail",
  EXPORT_MONITORING: "aleta_sipp.export_monitoring",
  MANAGE_FOLLOWUP: "aleta_sipp.manage_followup",
  PRINT_SCHEDULE_PDF: "aleta_sipp.print_schedule_pdf",
  MANAGE_SETTINGS: "aleta_sipp.manage_settings",
  VIEW_AUDIT: "aleta_sipp.view_audit",
} as const;

export type AletaSippRoleView = "superadmin" | "admin" | "operator" | "viewer";

export type AletaSippAccess = {
  roleView: AletaSippRoleView;
  permissions: AletaSippPermission[];
  canView: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  workstreamLabels: string[];
};

const BASE_PERMISSIONS: AletaSippPermission[] = [
  ALETA_SIPP_PERMISSION.VIEW_DASHBOARD,
  ALETA_SIPP_PERMISSION.VIEW_DICTIONARY,
  ALETA_SIPP_PERMISSION.VIEW_QUERY_REGISTRY,
  ALETA_SIPP_PERMISSION.VIEW_VARIABLE_REGISTRY,
];

const MONITORING_PERMISSIONS: AletaSippPermission[] = [
  ALETA_SIPP_PERMISSION.VIEW_MONITORING,
  ALETA_SIPP_PERMISSION.VIEW_FINANCE_MONITORING,
  ALETA_SIPP_PERMISSION.VIEW_CASE_MONITORING,
  ALETA_SIPP_PERMISSION.VIEW_CONTROL_MONITORING,
  ALETA_SIPP_PERMISSION.VIEW_PERFORMANCE_MONITORING,
  ALETA_SIPP_PERMISSION.VIEW_AC_MONITORING,
  ALETA_SIPP_PERMISSION.VIEW_REPORTS,
  ALETA_SIPP_PERMISSION.VIEW_SK_ASSESSMENT,
  ALETA_SIPP_PERMISSION.VIEW_PENDUKUNG2018_FEATURES,
  ALETA_SIPP_PERMISSION.VIEW_PENDUKUNG2018_REPORTS,
  ALETA_SIPP_PERMISSION.VIEW_ASSESSMENT,
  ALETA_SIPP_PERMISSION.VIEW_MONITORING_DETAIL,
  ALETA_SIPP_PERMISSION.PRINT_SCHEDULE_PDF,
  ALETA_SIPP_PERMISSION.RUN_REGISTERED_QUERY,
];

const ADMIN_PERMISSIONS: AletaSippPermission[] = [
  ...BASE_PERMISSIONS,
  ...MONITORING_PERMISSIONS,
  ALETA_SIPP_PERMISSION.VIEW_SQL_PREVIEW,
  ALETA_SIPP_PERMISSION.MANAGE_QUERY_REGISTRY,
  ALETA_SIPP_PERMISSION.MANAGE_VARIABLES,
  ALETA_SIPP_PERMISSION.IMPORT_ABT,
  ALETA_SIPP_PERMISSION.IMPORT_WORD_QUERY,
  ALETA_SIPP_PERMISSION.IMPORT_SQL_STRUCTURE,
  ALETA_SIPP_PERMISSION.RUN_MONITORING,
  ALETA_SIPP_PERMISSION.RUN_ASSESSMENT,
  ALETA_SIPP_PERMISSION.MANAGE_ASSESSMENT,
  ALETA_SIPP_PERMISSION.IMPORT_MONITORING,
  ALETA_SIPP_PERMISSION.MANAGE_MONITORING_FEATURES,
  ALETA_SIPP_PERMISSION.REVIEW_MONITORING_QUERY,
  ALETA_SIPP_PERMISSION.MANAGE_MANUAL_INPUT,
  ALETA_SIPP_PERMISSION.VIEW_SENSITIVE_CASE_DATA,
  ALETA_SIPP_PERMISSION.VIEW_FINANCIAL_DATA,
  ALETA_SIPP_PERMISSION.RUN_SK_ASSESSMENT,
  ALETA_SIPP_PERMISSION.MANAGE_SK_ASSESSMENT,
  ALETA_SIPP_PERMISSION.EXPORT_SK_ASSESSMENT,
  ALETA_SIPP_PERMISSION.MANAGE_PENDUKUNG2018_IMPORT,
  ALETA_SIPP_PERMISSION.RUN_PENDUKUNG2018_MONITORING,
  ALETA_SIPP_PERMISSION.EXPORT_PENDUKUNG2018_REPORTS,
  ALETA_SIPP_PERMISSION.REVIEW_PENDUKUNG2018_QUERIES,
  ALETA_SIPP_PERMISSION.INPUT_PENDUKUNG2018_MANUAL,
  ALETA_SIPP_PERMISSION.IMPORT_SK_ASSESSMENT,
  ALETA_SIPP_PERMISSION.MANAGE_INDICATOR_MAPPING,
  ALETA_SIPP_PERMISSION.EXPORT_MONITORING,
  ALETA_SIPP_PERMISSION.MANAGE_FOLLOWUP,
  ALETA_SIPP_PERMISSION.MANAGE_SETTINGS,
  ALETA_SIPP_PERMISSION.VIEW_AUDIT,
];

const MONITORING_ROLE_IDS = new Set<RoleId>([
  "ketua",
  "wakil-ketua",
  "panitera",
  "panitera-muda",
  "hakim",
  "panitera-pengganti",
  "jurusita",
  "analis-perkara",
  "pejabat-struktural",
  "staf",
]);

function addPermissions(target: Set<AletaSippPermission>, permissions: readonly AletaSippPermission[]) {
  for (const permission of permissions) target.add(permission);
}

function includesAny(value: string, terms: readonly string[]) {
  return terms.some((term) => value.includes(term));
}

export function resolveAletaSippAccess(
  user: UserPersona | null | undefined,
  options?: {
    effectiveRoleId?: RoleId | null;
    positionLabel?: string | null;
  }
): AletaSippAccess {
  const roleId = options?.effectiveRoleId ?? user?.roleId ?? null;
  const positionLabel = (options?.positionLabel ?? "").toLocaleLowerCase("id-ID");
  const permissions = new Set<AletaSippPermission>();
  const workstreamLabels: string[] = [];
  const isSuperAdmin = roleId === "super-admin";
  const isAdmin = roleId === "admin";

  if (!user || !roleId) {
    return {
      roleView: "viewer",
      permissions: [],
      canView: false,
      isSuperAdmin: false,
      isAdmin: false,
      workstreamLabels: [],
    };
  }

  if (isSuperAdmin) {
    addPermissions(permissions, ALETA_SIPP_PERMISSIONS);
    workstreamLabels.push("Import referensi", "Query registry", "Variable registry", "Audit query", "Pengaturan AI SIPP");
  } else if (isAdmin) {
    addPermissions(permissions, ADMIN_PERMISSIONS);
    workstreamLabels.push("Kelola registry", "Import dry-run", "Monitoring penilaian", "Cetak jadwal sidang");
  } else {
    addPermissions(permissions, BASE_PERMISSIONS);

    if (MONITORING_ROLE_IDS.has(roleId) || includesAny(positionLabel, ["ptsp", "monitoring", "sipp", "perkara"])) {
      addPermissions(permissions, MONITORING_PERMISSIONS);
      workstreamLabels.push("Kamus SIPP", "Monitoring SIPP", "Cetak jadwal sidang");
    } else {
      workstreamLabels.push("Kamus SIPP", "Query aman terbatas");
    }
  }

  const normalizedPermissions = Array.from(permissions);

  return {
    roleView: isSuperAdmin ? "superadmin" : isAdmin ? "admin" : normalizedPermissions.includes(ALETA_SIPP_PERMISSION.VIEW_ASSESSMENT) ? "operator" : "viewer",
    permissions: normalizedPermissions,
    canView: normalizedPermissions.includes(ALETA_SIPP_PERMISSION.VIEW_DASHBOARD),
    isSuperAdmin,
    isAdmin,
    workstreamLabels: Array.from(new Set(workstreamLabels)),
  };
}

export function hasAletaSippPermission(access: AletaSippAccess, permission: AletaSippPermission) {
  return access.permissions.includes(permission);
}

export function requireAletaSippPermission(user: UserPersona, permission: AletaSippPermission) {
  const access = resolveAletaSippAccess(user);
  if (!hasAletaSippPermission(access, permission)) {
    throw new Error("Anda tidak memiliki izin ALETA x SIPP untuk aksi ini.");
  }
  return access;
}

export type AletaSippSidebarItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  iconKey: string;
  permission: AletaSippPermission;
  adminOnly?: boolean;
};

export const ALETA_SIPP_SIDEBAR_ITEMS: AletaSippSidebarItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Ringkasan kamus, query, variabel, penilaian, dan audit",
    href: ALETA_SIPP_ROUTE,
    iconKey: "layout-dashboard",
    permission: ALETA_SIPP_PERMISSION.VIEW_DASHBOARD,
  },
  {
    id: "dictionary",
    label: "Kamus Database",
    description: "Tabel, kolom, kategori, dan relasi SIPP",
    href: `${ALETA_SIPP_ROUTE}?section=kamus`,
    iconKey: "database",
    permission: ALETA_SIPP_PERMISSION.VIEW_DICTIONARY,
  },
  {
    id: "query-registry",
    label: "Query Registry",
    description: "Daftar query aman, parameter, output, dan risiko",
    href: `${ALETA_SIPP_ROUTE}?section=query`,
    iconKey: "search",
    permission: ALETA_SIPP_PERMISSION.VIEW_QUERY_REGISTRY,
  },
  {
    id: "variables",
    label: "Variable Registry",
    description: "Mapping placeholder ABT dan key modern",
    href: `${ALETA_SIPP_ROUTE}?section=variabel`,
    iconKey: "book-open-text",
    permission: ALETA_SIPP_PERMISSION.VIEW_VARIABLE_REGISTRY,
  },
  {
    id: "assessment",
    label: "Penilaian SIPP",
    description: "Indikator Dirjen Badilag dan status data",
    href: `${ALETA_SIPP_ROUTE}?section=penilaian`,
    iconKey: "shield-check",
    permission: ALETA_SIPP_PERMISSION.VIEW_ASSESSMENT,
  },
  {
    id: "monitoring",
    label: "Monitoring SIPP",
    description: "Run/cache monitoring dan evaluasi SIPP",
    href: `${ALETA_SIPP_ROUTE}?section=monitoring`,
    iconKey: "activity",
    permission: ALETA_SIPP_PERMISSION.VIEW_MONITORING,
  },
  {
    id: "pendukung2018",
    label: "Katalog Monitoring",
    description: "Katalog 65 fitur monitoring, status query, dan migrasi read-only",
    href: `${ALETA_SIPP_ROUTE}?section=pendukung2018`,
    iconKey: "list-checks",
    permission: ALETA_SIPP_PERMISSION.VIEW_PENDUKUNG2018_FEATURES,
  },
  {
    id: "triwulan",
    label: "Penilaian Triwulan SK",
    description: "Penilaian SK SIPP per tahun dan triwulan",
    href: `${ALETA_SIPP_ROUTE}?section=triwulan`,
    iconKey: "bar-chart-3",
    permission: ALETA_SIPP_PERMISSION.VIEW_ASSESSMENT,
  },
  {
    id: "schedule-pdf",
    label: "PDF Jadwal Sidang",
    description: "Preview dan cetak jadwal persidangan read-only",
    href: `${ALETA_SIPP_ROUTE}?section=jadwal`,
    iconKey: "calendar-days",
    permission: ALETA_SIPP_PERMISSION.PRINT_SCHEDULE_PDF,
  },
  {
    id: "settings",
    label: "Pengaturan",
    description: "Import dry-run, registry, audit, dan permission",
    href: ALETA_SIPP_ADMIN_ROUTE,
    iconKey: "settings",
    permission: ALETA_SIPP_PERMISSION.MANAGE_SETTINGS,
    adminOnly: true,
  },
];

export function getAletaSippSidebarItems(access: AletaSippAccess) {
  return ALETA_SIPP_SIDEBAR_ITEMS.filter((item) => {
    if (item.adminOnly && !access.isAdmin && !access.isSuperAdmin) return false;
    return hasAletaSippPermission(access, item.permission);
  });
}
