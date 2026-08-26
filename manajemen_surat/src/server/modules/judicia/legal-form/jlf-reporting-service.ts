import type { QueryResultRow } from "pg";

import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { getSafeAiSettingsSummary } from "@/server/modules/judicia/legal-form/jlf-global-ai-settings-reader";
import { getJlfAccessForActor, requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { listSettingsByPrefix } from "@/server/modules/judicia/legal-form/jlf-settings-service";
import { JlfSippProviderRegistry } from "@/server/modules/judicia/legal-form/jlf-sipp-readonly-provider";
import {
  getAletaBotSettingsSummary,
  getWhatsappGatewayStatus,
} from "@/server/modules/judicia/legal-form/jlf-aleta-bot-status-reader";
import { getAuditLogs } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";

type CountRow = QueryResultRow & { count: number | string };
type GroupCountRow = QueryResultRow & { id?: string; label?: string; name?: string; status?: string; event_type?: string; feature?: string; count: number | string };
type ActivityRow = QueryResultRow & {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  nomor_perkara: string;
  created_at: string;
};

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0;
}

async function count(db: AletaDatabase, sqlText: string, ...params: Array<string | number>) {
  const row = await db.prepare(sqlText).get<CountRow>(...params);
  return toNumber(row?.count);
}

function todayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function valuesByKey(settings: Awaited<ReturnType<typeof listSettingsByPrefix>>) {
  return Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
}

async function getTopTemplates(db: AletaDatabase, actor: UserPersona, isManager: boolean) {
  const params: string[] = [];
  const where = ["1 = 1"];
  if (!isManager) {
    where.push("d.generated_by = ?");
    params.push(actor.id);
  }

  const rows = await db.prepare(
    `SELECT t.id, t.name AS label, COUNT(*) AS count
     FROM jlf_generated_documents d
     JOIN jlf_templates t ON t.id = d.template_id
     WHERE ${where.join(" AND ")}
     GROUP BY t.id, t.name
     ORDER BY COUNT(*) DESC, t.name ASC
     LIMIT 5`
  ).all<GroupCountRow>(...params);

  return rows.map((row) => ({
    id: row.id ?? "",
    label: row.label ?? row.name ?? "",
    count: toNumber(row.count),
  }));
}

async function getActivity(db: AletaDatabase, actor: UserPersona, isManager: boolean) {
  if (isManager) {
    return getAuditLogs(db, { limit: 8 });
  }

  const rows = await db.prepare(
    `SELECT id, action, entity_type, entity_id, nomor_perkara, created_at
     FROM jlf_audit_logs
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 8`
  ).all<ActivityRow>(actor.id);

  return rows.map((row) => ({
    id: row.id,
    userId: actor.id,
    userName: actor.name,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    nomorPerkara: row.nomor_perkara,
    metadata: {},
    createdAt: row.created_at,
  }));
}

async function getDocumentCountsByTemplate(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT t.id, t.name AS label, COUNT(d.id) AS count
     FROM jlf_templates t
     LEFT JOIN jlf_generated_documents d ON d.template_id = t.id
     WHERE t.deleted_at IS NULL
     GROUP BY t.id, t.name
     ORDER BY COUNT(d.id) DESC, t.name ASC
     LIMIT 20`
  ).all<GroupCountRow>();

  return rows.map((row) => ({ id: row.id ?? "", label: row.label ?? "", count: toNumber(row.count) }));
}

async function getGenerateCountsByUser(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT u.id, u.name AS label, COUNT(d.id) AS count
     FROM jlf_generated_documents d
     LEFT JOIN users u ON u.id = d.generated_by
     GROUP BY u.id, u.name
     ORDER BY COUNT(d.id) DESC
     LIMIT 20`
  ).all<GroupCountRow>();

  return rows.map((row) => ({ id: row.id ?? "", label: row.label || "User tidak diketahui", count: toNumber(row.count) }));
}

async function getGroupedCount(db: AletaDatabase, sqlText: string) {
  const rows = await db.prepare(sqlText).all<GroupCountRow>();
  return rows.map((row) => ({
    id: row.id ?? row.status ?? row.event_type ?? row.feature ?? row.label ?? "",
    label: row.label ?? row.status ?? row.event_type ?? row.feature ?? row.id ?? "",
    count: toNumber(row.count),
  }));
}

export async function getJlfReportingSummary(db: AletaDatabase, actor: UserPersona) {
  requireJlfPermission(actor, JLF_PERMISSION.DASHBOARD_VIEW);
  const access = getJlfAccessForActor(actor);
  const isManager = access.isSuperAdmin || access.isAdmin;
  const canViewAudit = access.permissions.includes(JLF_PERMISSION.AUDIT_VIEW);

  const [
    documentsPerTemplate,
    generatePerUser,
    aiUsageByFeature,
    accountLinksByStatus,
    whatsappByStatus,
    whatsappByEvent,
    templatesNeedingRegulationReview,
  ] = await Promise.all([
    isManager ? getDocumentCountsByTemplate(db) : getTopTemplates(db, actor, false),
    isManager || canViewAudit ? getGenerateCountsByUser(db) : Promise.resolve([]),
    getGroupedCount(db, "SELECT feature, feature AS label, COUNT(*) AS count FROM jlf_ai_logs GROUP BY feature ORDER BY COUNT(*) DESC LIMIT 20"),
    getGroupedCount(db, "SELECT link_status AS status, link_status AS label, COUNT(*) AS count FROM jlf_sipp_account_links GROUP BY link_status ORDER BY COUNT(*) DESC"),
    getGroupedCount(db, "SELECT status, status AS label, COUNT(*) AS count FROM jlf_whatsapp_notification_logs GROUP BY status ORDER BY COUNT(*) DESC"),
    getGroupedCount(db, "SELECT event_type, event_type AS label, COUNT(*) AS count FROM jlf_whatsapp_notification_logs GROUP BY event_type ORDER BY COUNT(*) DESC"),
    count(
      db,
      `SELECT COUNT(*) AS count
       FROM jlf_template_regulations tr
       JOIN jlf_regulations r ON r.id = tr.regulation_id
       WHERE r.verification_status IN ('needs_review', 'rejected') OR r.status IN ('revoked', 'superseded', 'partially_revoked')`
    ),
  ]);

  return {
    documentsPerTemplate,
    generatePerUser,
    validation: {
      pending: await count(db, "SELECT COUNT(*) AS count FROM jlf_generated_documents WHERE status = 'waiting_validation'"),
    },
    aiUsageByFeature,
    regulation: {
      verified: await count(db, "SELECT COUNT(*) AS count FROM jlf_regulations WHERE verification_status = 'verified' AND deleted_at IS NULL"),
      needsReview: await count(db, "SELECT COUNT(*) AS count FROM jlf_regulations WHERE verification_status = 'needs_review' AND deleted_at IS NULL"),
    },
    accountLinksByStatus,
    whatsappByStatus,
    whatsappByEvent,
    templatesNeedingRegulationReview,
  };
}

export async function getJlfDashboardSummary(db: AletaDatabase, actor: UserPersona) {
  requireJlfPermission(actor, JLF_PERMISSION.DASHBOARD_VIEW);
  const access = getJlfAccessForActor(actor);
  const isManager = access.isSuperAdmin || access.isAdmin;
  const { start, end } = todayRange();
  const provider = JlfSippProviderRegistry.getProvider();
  const settings = valuesByKey(await listSettingsByPrefix(db, "jlf."));

  const [
    templateActive,
    variableActive,
    documentsToday,
    pendingValidation,
    verifiedRegulations,
    needsReviewRegulations,
    accountSyncLinked,
    accountSyncPending,
    topTemplates,
    activity,
    sippStatus,
    aiSummary,
    whatsappStatus,
    aletaBotSummary,
  ] = await Promise.all([
    count(db, "SELECT COUNT(*) AS count FROM jlf_templates WHERE status = 'active' AND deleted_at IS NULL"),
    count(db, "SELECT COUNT(*) AS count FROM jlf_variables WHERE is_active = 1"),
    isManager
      ? count(db, "SELECT COUNT(*) AS count FROM jlf_generated_documents WHERE created_at BETWEEN ? AND ?", start, end)
      : count(db, "SELECT COUNT(*) AS count FROM jlf_generated_documents WHERE generated_by = ? AND created_at BETWEEN ? AND ?", actor.id, start, end),
    isManager || access.isValidator
      ? count(db, "SELECT COUNT(*) AS count FROM jlf_generated_documents WHERE status = 'waiting_validation'")
      : count(db, "SELECT COUNT(*) AS count FROM jlf_generated_documents WHERE generated_by = ? AND status = 'waiting_validation'", actor.id),
    count(db, "SELECT COUNT(*) AS count FROM jlf_regulations WHERE verification_status = 'verified' AND deleted_at IS NULL"),
    count(db, "SELECT COUNT(*) AS count FROM jlf_regulations WHERE verification_status = 'needs_review' AND deleted_at IS NULL"),
    count(db, "SELECT COUNT(*) AS count FROM jlf_sipp_account_links WHERE link_status = 'linked'"),
    count(db, "SELECT COUNT(*) AS count FROM jlf_sipp_account_links WHERE link_status IN ('suggested', 'pending_approval', 'conflict')"),
    getTopTemplates(db, actor, isManager),
    getActivity(db, actor, isManager || access.permissions.includes(JLF_PERMISSION.AUDIT_VIEW)),
    provider.checkConnection(),
    getSafeAiSettingsSummary(db),
    getWhatsappGatewayStatus(db),
    getAletaBotSettingsSummary(db),
  ]);

  return {
    roleView: access.roleView,
    visibility: {
      isSuperAdmin: access.isSuperAdmin,
      isAdmin: access.isAdmin,
      isValidator: access.isValidator,
      canManageSettings: access.permissions.includes(JLF_PERMISSION.SETTINGS_MANAGE),
      canViewAudit: access.permissions.includes(JLF_PERMISSION.AUDIT_VIEW),
      canUseAi: access.permissions.includes(JLF_PERMISSION.AI_USE),
      canManageAccountSync: access.permissions.includes(JLF_PERMISSION.ACCOUNT_SYNC_MANAGE),
      canManageWhatsapp: access.permissions.includes(JLF_PERMISSION.WHATSAPP_MANAGE),
    },
    metrics: {
      templateActive,
      variableActive,
      documentsToday,
      pendingValidation,
      verifiedRegulations,
      needsReviewRegulations,
      accountSyncLinked,
      accountSyncPending,
    },
    statuses: {
      sipp: {
        enabled: settings["jlf.sipp.enabled"] ?? false,
        ...sippStatus,
        provider: provider.key,
        readOnly: true,
        rawSqlEndpoint: false,
      },
      aiGlobal: {
        enabled: aiSummary.status.enabled,
        providerId: aiSummary.status.providerId,
        modelId: aiSummary.status.modelId,
        activeConnectionStatus: aiSummary.status.activeConnectionStatus,
      },
      aiJlf: {
        enabled: settings["jlf.ai.enabled"] ?? true,
        legalAnalysisEnabled: settings["jlf.ai.legal_analysis.enabled"] ?? false,
        requireVerifiedRegulations: settings["jlf.ai.require_verified_regulations"] ?? true,
      },
      whatsappGlobal: {
        runtimeMode: whatsappStatus.runtimeMode,
        connected: whatsappStatus.connected,
        status: whatsappStatus.status,
        botEnabled: aletaBotSummary.botEnabled,
      },
      whatsappJlf: {
        enabled: settings["jlf.whatsapp.enabled"] ?? false,
        validationNotifications: settings["jlf.whatsapp.send_validation_notifications"] ?? false,
        documentReadyNotifications: settings["jlf.whatsapp.send_document_ready_notifications"] ?? false,
      },
      accountSync: {
        enabled: settings["jlf.account_sync.enabled"] ?? false,
      },
    },
    topTemplates,
    activity,
    reports: await getJlfReportingSummary(db, actor),
    secretsExposed: false,
  };
}

export const JlfReportingService = {
  getDashboardSummary: getJlfDashboardSummary,
  getReportingSummary: getJlfReportingSummary,
};
