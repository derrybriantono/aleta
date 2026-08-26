import type { RoleId, UserPersona } from "@/lib/types";

export const JUDICIA_LEGAL_FORM_MODULE_ID = "judicia-legal-form";
export const JUDICIA_LEGAL_FORM_SETTINGS_MODULE_ID = "judicia-legal-form-settings";
export const JUDICIA_LEGAL_FORM_ROUTE = "/judicia/legal-form";
export const JUDICIA_LEGAL_FORM_ADMIN_ROUTE = "/admin/judicia-legal-form";

export const JUDICIA_LEGAL_FORM_PERMISSIONS = [
  "judicia_legal_form.view",
  "judicia_legal_form.dashboard.view",
  "judicia_legal_form.template.view",
  "judicia_legal_form.template.create",
  "judicia_legal_form.template.update",
  "judicia_legal_form.template.delete",
  "judicia_legal_form.template.version.manage",
  "judicia_legal_form.variable.view",
  "judicia_legal_form.variable.create",
  "judicia_legal_form.variable.update",
  "judicia_legal_form.variable.delete",
  "judicia_legal_form.case.search",
  "judicia_legal_form.case.view",
  "judicia_legal_form.document.generate",
  "judicia_legal_form.document.preview",
  "judicia_legal_form.document.download",
  "judicia_legal_form.document.archive",
  "judicia_legal_form.document.validate",
  "judicia_legal_form.document.approve",
  "judicia_legal_form.document.reject",
  "judicia_legal_form.document.finalize",
  "judicia_legal_form.manual_data.view",
  "judicia_legal_form.manual_data.create",
  "judicia_legal_form.manual_data.update",
  "judicia_legal_form.manual_data.delete",
  "judicia_legal_form.ai.use",
  "judicia_legal_form.ai.admin",
  "judicia_legal_form.ai.legal_analysis",
  "judicia_legal_form.ai.audit.view",
  "judicia_legal_form.regulation.view",
  "judicia_legal_form.regulation.create",
  "judicia_legal_form.regulation.update",
  "judicia_legal_form.regulation.delete",
  "judicia_legal_form.regulation.verify",
  "judicia_legal_form.regulation.type.manage",
  "judicia_legal_form.regulation.topic.manage",
  "judicia_legal_form.account_sync.view",
  "judicia_legal_form.account_sync.manage",
  "judicia_legal_form.sipp_role_mapping.manage",
  "judicia_legal_form.whatsapp.view",
  "judicia_legal_form.whatsapp.manage",
  "judicia_legal_form.whatsapp.send",
  "judicia_legal_form.audit.view",
  "judicia_legal_form.settings.manage",
] as const;

export type JudiciaLegalFormPermission = (typeof JUDICIA_LEGAL_FORM_PERMISSIONS)[number];
export type JudiciaLegalFormRoleView = "superadmin" | "admin" | "user";

export const JLF_PERMISSION = {
  VIEW: "judicia_legal_form.view",
  DASHBOARD_VIEW: "judicia_legal_form.dashboard.view",
  TEMPLATE_VIEW: "judicia_legal_form.template.view",
  TEMPLATE_CREATE: "judicia_legal_form.template.create",
  TEMPLATE_UPDATE: "judicia_legal_form.template.update",
  TEMPLATE_DELETE: "judicia_legal_form.template.delete",
  TEMPLATE_VERSION_MANAGE: "judicia_legal_form.template.version.manage",
  VARIABLE_VIEW: "judicia_legal_form.variable.view",
  VARIABLE_CREATE: "judicia_legal_form.variable.create",
  VARIABLE_UPDATE: "judicia_legal_form.variable.update",
  VARIABLE_DELETE: "judicia_legal_form.variable.delete",
  CASE_SEARCH: "judicia_legal_form.case.search",
  CASE_VIEW: "judicia_legal_form.case.view",
  DOCUMENT_GENERATE: "judicia_legal_form.document.generate",
  DOCUMENT_PREVIEW: "judicia_legal_form.document.preview",
  DOCUMENT_DOWNLOAD: "judicia_legal_form.document.download",
  DOCUMENT_ARCHIVE: "judicia_legal_form.document.archive",
  DOCUMENT_VALIDATE: "judicia_legal_form.document.validate",
  DOCUMENT_APPROVE: "judicia_legal_form.document.approve",
  DOCUMENT_REJECT: "judicia_legal_form.document.reject",
  DOCUMENT_FINALIZE: "judicia_legal_form.document.finalize",
  MANUAL_DATA_VIEW: "judicia_legal_form.manual_data.view",
  MANUAL_DATA_CREATE: "judicia_legal_form.manual_data.create",
  MANUAL_DATA_UPDATE: "judicia_legal_form.manual_data.update",
  MANUAL_DATA_DELETE: "judicia_legal_form.manual_data.delete",
  AI_USE: "judicia_legal_form.ai.use",
  AI_ADMIN: "judicia_legal_form.ai.admin",
  AI_LEGAL_ANALYSIS: "judicia_legal_form.ai.legal_analysis",
  AI_AUDIT_VIEW: "judicia_legal_form.ai.audit.view",
  REGULATION_VIEW: "judicia_legal_form.regulation.view",
  REGULATION_CREATE: "judicia_legal_form.regulation.create",
  REGULATION_UPDATE: "judicia_legal_form.regulation.update",
  REGULATION_DELETE: "judicia_legal_form.regulation.delete",
  REGULATION_VERIFY: "judicia_legal_form.regulation.verify",
  REGULATION_TYPE_MANAGE: "judicia_legal_form.regulation.type.manage",
  REGULATION_TOPIC_MANAGE: "judicia_legal_form.regulation.topic.manage",
  ACCOUNT_SYNC_VIEW: "judicia_legal_form.account_sync.view",
  ACCOUNT_SYNC_MANAGE: "judicia_legal_form.account_sync.manage",
  SIPP_ROLE_MAPPING_MANAGE: "judicia_legal_form.sipp_role_mapping.manage",
  WHATSAPP_VIEW: "judicia_legal_form.whatsapp.view",
  WHATSAPP_MANAGE: "judicia_legal_form.whatsapp.manage",
  WHATSAPP_SEND: "judicia_legal_form.whatsapp.send",
  AUDIT_VIEW: "judicia_legal_form.audit.view",
  SETTINGS_MANAGE: "judicia_legal_form.settings.manage",
} as const;

const BASE_PERMISSIONS: JudiciaLegalFormPermission[] = [
  JLF_PERMISSION.VIEW,
  JLF_PERMISSION.DASHBOARD_VIEW,
];

const WORK_PERMISSIONS: JudiciaLegalFormPermission[] = [
  JLF_PERMISSION.TEMPLATE_VIEW,
  JLF_PERMISSION.VARIABLE_VIEW,
  JLF_PERMISSION.CASE_SEARCH,
  JLF_PERMISSION.CASE_VIEW,
  JLF_PERMISSION.DOCUMENT_GENERATE,
  JLF_PERMISSION.DOCUMENT_PREVIEW,
  JLF_PERMISSION.DOCUMENT_DOWNLOAD,
  JLF_PERMISSION.MANUAL_DATA_VIEW,
  JLF_PERMISSION.REGULATION_VIEW,
];

const MANUAL_DATA_EDITOR_PERMISSIONS: JudiciaLegalFormPermission[] = [
  JLF_PERMISSION.MANUAL_DATA_CREATE,
  JLF_PERMISSION.MANUAL_DATA_UPDATE,
  JLF_PERMISSION.MANUAL_DATA_DELETE,
];

const TEMPLATE_ADMIN_PERMISSIONS: JudiciaLegalFormPermission[] = [
  JLF_PERMISSION.TEMPLATE_VIEW,
  JLF_PERMISSION.TEMPLATE_CREATE,
  JLF_PERMISSION.TEMPLATE_UPDATE,
  JLF_PERMISSION.TEMPLATE_DELETE,
  JLF_PERMISSION.TEMPLATE_VERSION_MANAGE,
  JLF_PERMISSION.VARIABLE_VIEW,
  JLF_PERMISSION.VARIABLE_CREATE,
  JLF_PERMISSION.VARIABLE_UPDATE,
  JLF_PERMISSION.VARIABLE_DELETE,
];

const REGULATION_ADMIN_PERMISSIONS: JudiciaLegalFormPermission[] = [
  JLF_PERMISSION.REGULATION_VIEW,
  JLF_PERMISSION.REGULATION_CREATE,
  JLF_PERMISSION.REGULATION_UPDATE,
  JLF_PERMISSION.REGULATION_DELETE,
  JLF_PERMISSION.REGULATION_VERIFY,
  JLF_PERMISSION.REGULATION_TYPE_MANAGE,
  JLF_PERMISSION.REGULATION_TOPIC_MANAGE,
];

const DOCUMENT_VALIDATOR_PERMISSIONS: JudiciaLegalFormPermission[] = [
  JLF_PERMISSION.DOCUMENT_VALIDATE,
  JLF_PERMISSION.DOCUMENT_APPROVE,
  JLF_PERMISSION.DOCUMENT_REJECT,
];

const ADMIN_PERMISSIONS: JudiciaLegalFormPermission[] = [
  ...BASE_PERMISSIONS,
  ...WORK_PERMISSIONS,
  ...MANUAL_DATA_EDITOR_PERMISSIONS,
  ...TEMPLATE_ADMIN_PERMISSIONS,
  ...REGULATION_ADMIN_PERMISSIONS,
  JLF_PERMISSION.ACCOUNT_SYNC_VIEW,
  JLF_PERMISSION.ACCOUNT_SYNC_MANAGE,
  JLF_PERMISSION.WHATSAPP_VIEW,
  JLF_PERMISSION.AUDIT_VIEW,
  // Pengaturan Judicia (Legal Form) khusus Super Admin; admin tetap bisa memakai modulnya.
  JLF_PERMISSION.AI_USE,
];

const JUDICIAL_WORK_ROLE_IDS = new Set<RoleId>([
  "ketua",
  "wakil-ketua",
  "hakim",
  "panitera",
  "panitera-muda",
  "panitera-pengganti",
  "jurusita",
  "analis-perkara",
  "pejabat-struktural",
  "staf",
  "pelaksana",
]);

const VALIDATOR_ROLE_IDS = new Set<RoleId>([
  "ketua",
  "wakil-ketua",
  "hakim",
  "panitera",
  "panitera-muda",
  "panitera-pengganti",
  "pejabat-struktural",
]);

const AI_LEGAL_ANALYSIS_ROLE_IDS = new Set<RoleId>([
  "ketua",
  "wakil-ketua",
  "hakim",
  "panitera",
  "panitera-muda",
  "panitera-pengganti",
]);

const LIMITED_PUBLIC_SERVICE_ROLE_IDS = new Set([
  "kasir",
  "petugas_keuangan_perkara",
  "petugas_ptsp",
  "petugas_meja_informasi",
  "petugas_posbakum",
  "petugas_gugatan_mandiri",
]);

const OPERATOR_ROLE_IDS = new Set([
  "operator_sipp",
  "operator_edoc",
  "petugas_pendaftaran_perkara",
  "petugas_validasi_ecourt",
  "petugas_ecourt",
  "petugas_minutasi",
  "operator_delegasi",
]);

const ARCHIVE_ROLE_IDS = new Set(["arsiparis_perkara"]);
const VALIDATOR_ADDITIONAL_ROLE_IDS = new Set(["operator_edoc", "petugas_validasi_ecourt", "petugas_minutasi"]);
const AUDIT_ADDITIONAL_ROLE_IDS = new Set(["petugas_ti_helpdesk"]);

function addPermissions(
  target: Set<JudiciaLegalFormPermission>,
  permissions: readonly JudiciaLegalFormPermission[]
) {
  for (const permission of permissions) {
    target.add(permission);
  }
}

function hasAnyAdditionalRole(user: UserPersona | null | undefined, roleIds: Set<string>) {
  return Boolean(user?.additionalRoleIds?.some((roleId) => roleIds.has(roleId)));
}

function includesAny(value: string, terms: readonly string[]) {
  return terms.some((term) => value.includes(term));
}

export type JudiciaLegalFormAccess = {
  roleView: JudiciaLegalFormRoleView;
  permissions: JudiciaLegalFormPermission[];
  canView: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isValidator: boolean;
  workstreamLabels: string[];
};

export function resolveJudiciaLegalFormAccess(
  user: UserPersona | null | undefined,
  options?: {
    effectiveRoleId?: RoleId | null;
    positionLabel?: string | null;
  }
): JudiciaLegalFormAccess {
  const roleId = options?.effectiveRoleId ?? user?.roleId ?? null;
  const positionLabel = (options?.positionLabel ?? "").toLocaleLowerCase("id-ID");
  const additionalRoleIds = new Set(user?.additionalRoleIds ?? []);
  const permissions = new Set<JudiciaLegalFormPermission>();
  const workstreamLabels: string[] = [];
  const isSuperAdmin = roleId === "super-admin";
  const isAdmin = roleId === "admin";

  if (!user || !roleId) {
    return {
      roleView: "user",
      permissions: [],
      canView: false,
      isSuperAdmin: false,
      isAdmin: false,
      isValidator: false,
      workstreamLabels: [],
    };
  }

  if (isSuperAdmin) {
    addPermissions(permissions, JUDICIA_LEGAL_FORM_PERMISSIONS);
    workstreamLabels.push(
      "Pengaturan JLF penuh",
      "AI dan ALETA Bot JLF",
      "Koneksi SIPP",
      "Account sync dan role mapping",
      "Audit dan import legacy ABT"
    );
  } else if (isAdmin) {
    addPermissions(permissions, ADMIN_PERMISSIONS);
    workstreamLabels.push(
      "Template dan variabel",
      "Legal Knowledge Base",
      "Sinergi akun SIPP",
      "Pengaturan JLF terbatas",
      "Audit lokal"
    );
  } else {
    const hasJudicialWorkRole = JUDICIAL_WORK_ROLE_IDS.has(roleId);
    const hasPublicServiceRole = hasAnyAdditionalRole(user, LIMITED_PUBLIC_SERVICE_ROLE_IDS);
    const hasOperatorRole = hasAnyAdditionalRole(user, OPERATOR_ROLE_IDS);
    const hasArchiveRole = hasAnyAdditionalRole(user, ARCHIVE_ROLE_IDS);
    const isPtspPosition = includesAny(positionLabel, ["ptsp", "meja informasi", "meja i", "meja ii", "meja iii"]);
    const isMediatorPosition = positionLabel.includes("mediator");
    const isPosbakumPosition = positionLabel.includes("posbakum");
    const isAuditorPosition = includesAny(positionLabel, ["auditor", "monitoring", "pengawasan"]);

    if (hasJudicialWorkRole || hasPublicServiceRole || hasOperatorRole || isPtspPosition || isMediatorPosition || isPosbakumPosition) {
      addPermissions(permissions, BASE_PERMISSIONS);
      addPermissions(permissions, WORK_PERMISSIONS);
      addPermissions(permissions, MANUAL_DATA_EDITOR_PERMISSIONS);
      workstreamLabels.push("Cari perkara", "Buat dokumen", "Dokumen saya");
    }

    if (roleId === "panitera-pengganti" || hasOperatorRole || isPtspPosition || isMediatorPosition) {
      addPermissions(permissions, MANUAL_DATA_EDITOR_PERMISSIONS);
      workstreamLabels.push("Data manual tambahan");
    }

    if (VALIDATOR_ROLE_IDS.has(roleId) || hasAnyAdditionalRole(user, VALIDATOR_ADDITIONAL_ROLE_IDS)) {
      addPermissions(permissions, DOCUMENT_VALIDATOR_PERMISSIONS);
      workstreamLabels.push("Validasi dokumen");
    }

    if (["ketua", "wakil-ketua", "panitera"].includes(roleId)) {
      permissions.add(JLF_PERMISSION.DOCUMENT_FINALIZE);
    }

    if (hasArchiveRole || positionLabel.includes("arsip")) {
      permissions.add(JLF_PERMISSION.DOCUMENT_ARCHIVE);
      permissions.add(JLF_PERMISSION.DOCUMENT_DOWNLOAD);
      workstreamLabels.push("Arsip dokumen final");
    }

    if (AI_LEGAL_ANALYSIS_ROLE_IDS.has(roleId)) {
      permissions.add(JLF_PERMISSION.AI_USE);
      permissions.add(JLF_PERMISSION.AI_LEGAL_ANALYSIS);
      workstreamLabels.push("AI assistant");
    }

    if (hasAnyAdditionalRole(user, AUDIT_ADDITIONAL_ROLE_IDS) || isAuditorPosition) {
      addPermissions(permissions, BASE_PERMISSIONS);
      permissions.add(JLF_PERMISSION.AUDIT_VIEW);
      workstreamLabels.push("Audit dan monitoring");
    }
  }

  if (permissions.size > 0) {
    addPermissions(permissions, BASE_PERMISSIONS);
  }

  const normalizedPermissions = Array.from(permissions);

  return {
    roleView: isSuperAdmin ? "superadmin" : isAdmin ? "admin" : "user",
    permissions: normalizedPermissions,
    canView: normalizedPermissions.includes(JLF_PERMISSION.VIEW),
    isSuperAdmin,
    isAdmin,
    isValidator: normalizedPermissions.includes(JLF_PERMISSION.DOCUMENT_VALIDATE),
    workstreamLabels: Array.from(new Set(workstreamLabels)),
  };
}

export function hasJudiciaLegalFormPermission(
  access: JudiciaLegalFormAccess,
  permission: JudiciaLegalFormPermission
) {
  return access.permissions.includes(permission);
}

export type JudiciaLegalFormSidebarItem = {
  id: string;
  label: string;
  description: string;
  href: string;
  iconKey: string;
  permission: JudiciaLegalFormPermission;
  superAdminOnly?: boolean;
};

export const JUDICIA_LEGAL_FORM_SIDEBAR_ITEMS: JudiciaLegalFormSidebarItem[] = [
  {
    id: "dashboard",
    label: "Buat Blangko Cepat",
    description: "Pilih blangko, cari perkara, review variabel, lalu generate",
    href: JUDICIA_LEGAL_FORM_ROUTE,
    iconKey: "layout-dashboard",
    permission: JLF_PERMISSION.DASHBOARD_VIEW,
  },
  {
    id: "case-search",
    label: "Cari Perkara",
    description: "Pencarian perkara SIPP read-only",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/cases`,
    iconKey: "search",
    permission: JLF_PERMISSION.CASE_SEARCH,
  },
  {
    id: "document-create",
    label: "Buat Dokumen",
    description: "Generate draft dokumen perkara",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}?section=buat-dokumen`,
    iconKey: "send",
    permission: JLF_PERMISSION.DOCUMENT_GENERATE,
  },
  {
    id: "bas-qa",
    label: "Tanya Jawab/BAS",
    description: "Template pertanyaan, jawaban, dan struktur BAS",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/bas-qa`,
    iconKey: "book-open-text",
    permission: JLF_PERMISSION.TEMPLATE_VIEW,
  },
  {
    id: "document-history",
    label: "Dokumen Saya",
    description: "Riwayat dokumen dan arsip kerja",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/documents`,
    iconKey: "archive",
    permission: JLF_PERMISSION.DOCUMENT_PREVIEW,
  },
  {
    id: "document-validation",
    label: "Validasi Saya",
    description: "Validasi BAS dan dokumen",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}?section=validasi`,
    iconKey: "shield-check",
    permission: JLF_PERMISSION.DOCUMENT_VALIDATE,
  },
  {
    id: "templates",
    label: "Template Dokumen",
    description: "Template dan versi dokumen",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/templates`,
    iconKey: "book-open-text",
    permission: JLF_PERMISSION.TEMPLATE_VIEW,
  },
  {
    id: "variables",
    label: "Variabel Dokumen",
    description: "Registry placeholder JLF",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/variables`,
    iconKey: "database",
    permission: JLF_PERMISSION.VARIABLE_VIEW,
  },
  {
    id: "legal-kb",
    label: "Legal Knowledge Base",
    description: "Peraturan dan topik hukum",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/regulations`,
    iconKey: "scale",
    permission: JLF_PERMISSION.REGULATION_VIEW,
  },
  {
    id: "ai-assistant",
    label: "AI Assistant",
    description: "Draft, checker, dan lookup",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/ai`,
    iconKey: "sparkles",
    permission: JLF_PERMISSION.AI_USE,
  },
  {
    id: "anonymization",
    label: "Anonimisasi",
    description: "Bantuan anonimisasi dokumen",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/anonymizer`,
    iconKey: "shield-check",
    permission: JLF_PERMISSION.DOCUMENT_PREVIEW,
  },
  {
    id: "case-qr",
    label: "QR Perkara",
    description: "QR link perkara yang tetap memerlukan login",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/qr`,
    iconKey: "shield-check",
    permission: JLF_PERMISSION.CASE_VIEW,
  },
  {
    id: "account-sync",
    label: "Sinergi Akun SIPP",
    description: "Link akun ALETA dan SIPP",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/account-sync`,
    iconKey: "users-round",
    permission: JLF_PERMISSION.ACCOUNT_SYNC_VIEW,
  },
  {
    id: "audit",
    label: "Audit Trail",
    description: "Jejak aktivitas JLF",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/audit`,
    iconKey: "shield-check",
    permission: JLF_PERMISSION.AUDIT_VIEW,
  },
  {
    id: "help",
    label: "Bantuan JLF",
    description: "Pedoman template, variabel, generate, dan anonimisasi",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/help`,
    iconKey: "book-open-text",
    permission: JLF_PERMISSION.VIEW,
  },
  {
    id: "settings",
    label: "Pengaturan",
    description: "Pengaturan Admin JLF",
    href: JUDICIA_LEGAL_FORM_ADMIN_ROUTE,
    iconKey: "settings",
    permission: JLF_PERMISSION.SETTINGS_MANAGE,
  },
];

export function getJudiciaLegalFormSidebarItems(access: JudiciaLegalFormAccess) {
  const userWorkItemIds = new Set([
    "dashboard",
    "case-search",
    "document-create",
    "document-history",
    "document-validation",
    "bas-qa",
    "anonymization",
    "case-qr",
    "help",
  ]);

  return JUDICIA_LEGAL_FORM_SIDEBAR_ITEMS.filter((item) => {
    if (item.superAdminOnly && !access.isSuperAdmin) return false;
    if (access.roleView === "user" && !userWorkItemIds.has(item.id)) return false;
    return hasJudiciaLegalFormPermission(access, item.permission);
  });
}

export type JudiciaLegalFormFeatureCard = {
  id: string;
  title: string;
  description: string;
  badge: string;
  href: string;
  iconKey: string;
  permission: JudiciaLegalFormPermission;
};

export const JUDICIA_LEGAL_FORM_FEATURE_CARDS: JudiciaLegalFormFeatureCard[] = [
  {
    id: "case-search",
    title: "Cari Perkara SIPP",
    description: "Pencarian perkara dari sumber SIPP read-only melalui adapter terkendali.",
    badge: "Read-only",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/cases`,
    iconKey: "search",
    permission: JLF_PERMISSION.CASE_SEARCH,
  },
  {
    id: "document-create",
    title: "Buat Dokumen",
    description: "Fondasi generate draft dokumen perkara berbasis template dan variabel.",
    badge: "Draft",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/cases`,
    iconKey: "send",
    permission: JLF_PERMISSION.DOCUMENT_GENERATE,
  },
  {
    id: "templates",
    title: "Template Dokumen",
    description: "Kelola pola template dokumen perkara tanpa memakai prefix legacy ABT.",
    badge: "Template",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/templates`,
    iconKey: "book-open-text",
    permission: JLF_PERMISSION.TEMPLATE_VIEW,
  },
  {
    id: "variables",
    title: "Variabel Dokumen",
    description: "Registry placeholder modern untuk resolver data SIPP dan data manual.",
    badge: "Registry",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/variables`,
    iconKey: "database",
    permission: JLF_PERMISSION.VARIABLE_VIEW,
  },
  {
    id: "validation",
    title: "Validasi Dokumen",
    description: "Workflow pemeriksaan BAS, draft dokumen, catatan, dan keputusan manusia.",
    badge: "Human Review",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}?section=validasi`,
    iconKey: "shield-check",
    permission: JLF_PERMISSION.DOCUMENT_VALIDATE,
  },
  {
    id: "bas-qa",
    title: "Template Tanya Jawab/BAS",
    description: "Kelola template pertanyaan, jawaban, dan urutan BAS seperti kebutuhan legacy ABT.",
    badge: "BAS",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/bas-qa`,
    iconKey: "book-open-text",
    permission: JLF_PERMISSION.TEMPLATE_VIEW,
  },
  {
    id: "legal-kb",
    title: "Legal Knowledge Base",
    description: "Fondasi peraturan, pasal, topik hukum, dan status verifikasi.",
    badge: "Verified KB",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/regulations`,
    iconKey: "scale",
    permission: JLF_PERMISSION.REGULATION_VIEW,
  },
  {
    id: "ai-assistant",
    title: "AI Assistant",
    description: "Asisten draft, konsistensi, BAS, anonimisasi, dan lookup hukum berbasis AI global ALETA.",
    badge: "AI Global",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/ai`,
    iconKey: "sparkles",
    permission: JLF_PERMISSION.AI_USE,
  },
  {
    id: "account-sync",
    title: "Sinergi Akun SIPP",
    description: "Account linking ALETA-SIPP tanpa menyimpan password atau hash SIPP.",
    badge: "Linking",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/account-sync`,
    iconKey: "users-round",
    permission: JLF_PERMISSION.ACCOUNT_SYNC_VIEW,
  },
  {
    id: "anonymizer",
    title: "Anonimisasi Dokumen",
    description: "Scan data sensitif, pilih saran yang diterima, dan generate dokumen anonim via storage private.",
    badge: "Privacy",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/anonymizer`,
    iconKey: "shield-check",
    permission: JLF_PERMISSION.DOCUMENT_PREVIEW,
  },
  {
    id: "case-qr",
    title: "QR Perkara",
    description: "Buat QR link perkara yang tetap membuka halaman ALETA dan memerlukan login.",
    badge: "Login Required",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/qr`,
    iconKey: "shield-check",
    permission: JLF_PERMISSION.CASE_VIEW,
  },
  {
    id: "whatsapp",
    title: "ALETA Bot/WhatsApp Notification",
    description: "Notifikasi aman melalui gateway global, berisi link yang tetap butuh login.",
    badge: "Gateway Global",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}?section=whatsapp`,
    iconKey: "bot",
    permission: JLF_PERMISSION.WHATSAPP_VIEW,
  },
  {
    id: "audit",
    title: "Audit Trail",
    description: "Jejak aktivitas penting JLF untuk pemeriksaan sesuai kewenangan.",
    badge: "Audit",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/audit`,
    iconKey: "shield-check",
    permission: JLF_PERMISSION.AUDIT_VIEW,
  },
  {
    id: "help",
    title: "Bantuan JLF",
    description: "Pedoman template, placeholder, import legacy, generate dokumen, dan anonimisasi.",
    badge: "Panduan",
    href: `${JUDICIA_LEGAL_FORM_ROUTE}/help`,
    iconKey: "book-open-text",
    permission: JLF_PERMISSION.VIEW,
  },
];

export function getJudiciaLegalFormFeatureCards(access: JudiciaLegalFormAccess) {
  const userWorkCardIds = new Set([
    "case-search",
    "document-create",
    "validation",
    "bas-qa",
    "anonymizer",
    "case-qr",
    "help",
  ]);

  return JUDICIA_LEGAL_FORM_FEATURE_CARDS.filter((card) => {
    if (access.roleView === "user" && !userWorkCardIds.has(card.id)) return false;
    return hasJudiciaLegalFormPermission(access, card.permission);
  });
}

export type JudiciaLegalFormAdminTab = {
  id: string;
  label: string;
  description: string;
  requiredPermission: JudiciaLegalFormPermission;
  superAdminOnly?: boolean;
};

export const JUDICIA_LEGAL_FORM_ADMIN_TABS: JudiciaLegalFormAdminTab[] = [
  {
    id: "umum",
    label: "Pengaturan Umum",
    description: "Identitas modul, status fondasi, dan guardrail operasional JLF.",
    requiredPermission: JLF_PERMISSION.SETTINGS_MANAGE,
  },
  {
    id: "template-dokumen",
    label: "Template Dokumen",
    description: "Studio pengelolaan kategori, template, versi, dan status blangko.",
    requiredPermission: JLF_PERMISSION.TEMPLATE_UPDATE,
  },
  {
    id: "variabel-placeholder",
    label: "Variabel & Placeholder",
    description: "Registry variabel, mapping placeholder legacy/modern, dan status needs review.",
    requiredPermission: JLF_PERMISSION.VARIABLE_UPDATE,
  },
  {
    id: "bas-qa",
    label: "Tanya Jawab/BAS",
    description: "Template pertanyaan, jawaban, urutan, dan integrasi section BAS.",
    requiredPermission: JLF_PERMISSION.TEMPLATE_UPDATE,
  },
  {
    id: "query-registry",
    label: "Query Registry SIPP",
    description: "Preview query read-only yang terdaftar dan parameterized, bukan raw SQL client.",
    requiredPermission: JLF_PERMISSION.SETTINGS_MANAGE,
    superAdminOnly: true,
  },
  {
    id: "koneksi-sipp",
    label: "Koneksi SIPP",
    description: "Rencana adapter SIPP read-only melalui bridge ALETA Bot atau stub aman.",
    requiredPermission: JLF_PERMISSION.SETTINGS_MANAGE,
    superAdminOnly: true,
  },
  {
    id: "sinergi-akun",
    label: "Sinergi Akun SIPP",
    description: "Shell account linking ALETA-SIPP tanpa password atau hash SIPP.",
    requiredPermission: JLF_PERMISSION.ACCOUNT_SYNC_MANAGE,
  },
  {
    id: "mapping-role",
    label: "Mapping Role SIPP ke ALETA",
    description: "Rekomendasi mapping role/group SIPP ke role, posisi, atau additional role ALETA.",
    requiredPermission: JLF_PERMISSION.SIPP_ROLE_MAPPING_MANAGE,
    superAdminOnly: true,
  },
  {
    id: "ai",
    label: "Pengaturan AI JLF",
    description: "Toggle dan kebijakan JLF di atas konfigurasi AI global ALETA.",
    requiredPermission: JLF_PERMISSION.AI_ADMIN,
    superAdminOnly: true,
  },
  {
    id: "whatsapp",
    label: "Pengaturan ALETA Bot/WhatsApp JLF",
    description: "Template pesan dan event notifikasi JLF melalui gateway global ALETA Bot.",
    requiredPermission: JLF_PERMISSION.WHATSAPP_MANAGE,
    superAdminOnly: true,
  },
  {
    id: "legal-kb",
    label: "Legal Knowledge Base",
    description: "Pengaturan jenis peraturan, topik, verifikasi, dan relasi template-peraturan.",
    requiredPermission: JLF_PERMISSION.REGULATION_UPDATE,
  },
  {
    id: "qr-verifikasi",
    label: "QR & Verifikasi Dokumen",
    description: "Rencana QR dokumen, halaman verifikasi, dan status final dokumen.",
    requiredPermission: JLF_PERMISSION.SETTINGS_MANAGE,
  },
  {
    id: "legacy-abt",
    label: "Import Legacy ABT",
    description: "Shell importer dari ABT SIPP sebagai legacy source, bukan route atau prefix baru.",
    requiredPermission: JLF_PERMISSION.SETTINGS_MANAGE,
    superAdminOnly: true,
  },
  {
    id: "audit-retensi",
    label: "Audit & Retensi Data",
    description: "Kebijakan audit trail, retensi, dan pembatasan data sensitif.",
    requiredPermission: JLF_PERMISSION.AUDIT_VIEW,
  },
];

export function getJudiciaLegalFormAdminTabs(access: JudiciaLegalFormAccess) {
  return JUDICIA_LEGAL_FORM_ADMIN_TABS.filter((tab) => {
    if (tab.superAdminOnly && !access.isSuperAdmin) return false;
    return hasJudiciaLegalFormPermission(access, tab.requiredPermission);
  });
}
