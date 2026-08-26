import type { AletaDatabase } from "@/server/db/client";
import type { UserPersona } from "@/lib/types";
import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { listSettingsByPrefix } from "@/server/modules/judicia/legal-form/jlf-settings-service";
import { getSafeAiSettingsSummary } from "@/server/modules/judicia/legal-form/jlf-global-ai-settings-reader";
import {
  getAletaBotSettingsSummary,
  getWhatsappGatewayStatus,
} from "@/server/modules/judicia/legal-form/jlf-aleta-bot-status-reader";
import { JlfSippProviderRegistry } from "@/server/modules/judicia/legal-form/jlf-sipp-readonly-provider";

export async function readJlfAdminSettingsSummary(db: AletaDatabase, actor: UserPersona) {
  requireJlfPermission(actor, JLF_PERMISSION.SETTINGS_MANAGE);

  const provider = JlfSippProviderRegistry.getProvider();
  const [settings, sippStatus, aiSummary, whatsappStatus, aletaBotSummary] = await Promise.all([
    listSettingsByPrefix(db, "jlf."),
    provider.checkConnection(),
    getSafeAiSettingsSummary(db),
    getWhatsappGatewayStatus(db),
    getAletaBotSettingsSummary(db),
  ]);

  const settingsByKey = Object.fromEntries(settings.map((setting) => [setting.key, setting]));

  return {
    general: {
      enabled: settingsByKey["jlf.enabled"]?.value ?? true,
      defaultLanding: settingsByKey["jlf.default_landing"]?.value ?? "/judicia/legal-form",
      retentionPolicyDays: settingsByKey["jlf.retention.default_days"]?.value ?? 365,
      storeGeneratedFiles: settingsByKey["jlf.document.store_generated_files"]?.value ?? true,
      qrVerificationEnabled: settingsByKey["jlf.document.qr_verification_enabled"]?.value ?? true,
      uploadMaxFileSizeMb: settingsByKey["jlf.upload.max_file_size_mb"]?.value ?? 25,
    },
    template: {
      allowedTemplateTypes: settingsByKey["jlf.upload.allowed_template_types"]?.value ?? ["docx", "rtf"],
      allowedAnonymizerTypes: settingsByKey["jlf.upload.allowed_anonymizer_types"]?.value ?? ["txt", "rtf", "docx", "pdf"],
      maxUploadSizeMb: settingsByKey["jlf.upload.max_file_size_mb"]?.value ?? 25,
      legacyPlaceholderSupportEnabled: settingsByKey["jlf.template.legacy_placeholder_support_enabled"]?.value ?? true,
      modernPlaceholderSupportEnabled: settingsByKey["jlf.template.modern_placeholder_support_enabled"]?.value ?? true,
      defaultRequiresValidation: settingsByKey["jlf.template.default_requires_validation"]?.value ?? true,
    },
    settings,
    sipp: {
      provider: provider.key,
      health: sippStatus,
      enabled: settingsByKey["jlf.sipp.enabled"]?.value ?? false,
      providerMode: settingsByKey["jlf.sipp.provider_mode"]?.value ?? provider.key,
      searchLimit: settingsByKey["jlf.sipp.search_limit"]?.value ?? 20,
      queryTimeoutMs: settingsByKey["jlf.sipp.query_timeout_ms"]?.value ?? 8000,
      readOnly: true,
      rawSqlEndpoint: false,
      directMysqlDependencyInstalled: false,
    },
    ai: {
      enabled: settingsByKey["jlf.ai.enabled"]?.value ?? true,
      useGlobalAletaAiSettings: settingsByKey["jlf.ai.use_global_aleta_ai_settings"]?.value ?? true,
      redactionEnabled: settingsByKey["jlf.ai.redaction.enabled"]?.value ?? true,
      logInputs: settingsByKey["jlf.ai.log_inputs"]?.value ?? false,
      logOutputs: settingsByKey["jlf.ai.log_outputs"]?.value ?? true,
      maxInputChars: settingsByKey["jlf.ai.max_input_chars"]?.value ?? 12000,
      legalAnalysisEnabled: settingsByKey["jlf.ai.legal_analysis.enabled"]?.value ?? false,
      requireVerifiedRegulations: settingsByKey["jlf.ai.require_verified_regulations"]?.value ?? true,
      global: aiSummary,
    },
    whatsapp: {
      enabled: settingsByKey["jlf.whatsapp.enabled"]?.value ?? false,
      useGlobalAletaBotGateway: settingsByKey["jlf.whatsapp.use_global_aleta_bot_gateway"]?.value ?? true,
      sendValidationNotifications: settingsByKey["jlf.whatsapp.send_validation_notifications"]?.value ?? false,
      sendDocumentReadyNotifications: settingsByKey["jlf.whatsapp.send_document_ready_notifications"]?.value ?? false,
      sendRegulationReviewNotifications: settingsByKey["jlf.whatsapp.send_regulation_review_notifications"]?.value ?? false,
      gateway: whatsappStatus,
      aletaBot: aletaBotSummary,
    },
    accountSync: {
      enabled: settingsByKey["jlf.account_sync.enabled"]?.value ?? false,
      autoSuggestionEnabled: settingsByKey["jlf.account_sync.auto_suggestion_enabled"]?.value ?? true,
      selfClaimEnabled: settingsByKey["jlf.account_sync.self_claim_enabled"]?.value ?? false,
      conflictHandling: settingsByKey["jlf.account_sync.conflict_handling"]?.value ?? "admin_review",
      snapshotPolicy: settingsByKey["jlf.account_sync.snapshot_policy"]?.value ?? "on_search_and_link",
    },
    roleMapping: {
      autoApplyDefault: settingsByKey["jlf.sipp_role_mapping.auto_apply_default"]?.value ?? false,
      approvalRequired: settingsByKey["jlf.sipp_role_mapping.approval_required"]?.value ?? true,
    },
    legalKnowledgeBase: {
      requireVerification: settingsByKey["jlf.legal_kb.require_verification"]?.value ?? true,
      verifiedOnlyAiMode: settingsByKey["jlf.ai.require_verified_regulations"]?.value ?? true,
      ingestionPolicy: settingsByKey["jlf.legal_kb.ingestion_policy"]?.value ?? "manual_review_required",
    },
    qrVerification: {
      enabled: settingsByKey["jlf.document.qr_verification_enabled"]?.value ?? true,
      publicVerificationMode: settingsByKey["jlf.qr.public_verification_mode"]?.value ?? "minimal_masked",
      tokenExpiryDays: settingsByKey["jlf.qr.token_expiry_days"]?.value ?? 0,
      publicVisibleFields: settingsByKey["jlf.qr.public_visible_fields"]?.value ?? ["status", "jenis_dokumen", "tanggal_generate", "nomor_perkara_masked"],
    },
    legacyImport: {
      enabled: settingsByKey["jlf.legacy_import.enabled"]?.value ?? false,
      dryRunOnly: settingsByKey["jlf.legacy_import.dry_run_only"]?.value ?? true,
      lastReportStatus: settingsByKey["jlf.legacy_import.last_report_status"]?.value ?? "belum_ada_report",
      legacyOnly: true,
    },
    retention: {
      auditLogDays: settingsByKey["jlf.retention.audit_log_days"]?.value ?? 365,
      documentDays: settingsByKey["jlf.retention.document_days"]?.value ?? 365,
      aiLogDays: settingsByKey["jlf.retention.ai_log_days"]?.value ?? 180,
      whatsappLogDays: settingsByKey["jlf.retention.whatsapp_log_days"]?.value ?? 180,
    },
    secretsExposed: false,
  };
}

export const JlfAdminSettingsService = {
  readJlfAdminSettingsSummary,
};
