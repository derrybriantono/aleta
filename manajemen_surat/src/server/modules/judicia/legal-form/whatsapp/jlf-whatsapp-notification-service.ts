import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import type { UserPersona } from "@/lib/types";
import type { AletaDatabase } from "@/server/db/client";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { getBooleanSetting } from "@/server/modules/judicia/legal-form/jlf-settings-service";
import { jlfBadRequest } from "@/server/modules/judicia/legal-form/jlf-service-errors";
import { sendPortalWhatsappMessage } from "@/server/modules/whatsapp/portal-whatsapp-sender";
import { createWhatsappNotificationLog, listWhatsappNotificationLogs } from "@/server/modules/judicia/legal-form/whatsapp/jlf-whatsapp-log-service";
import {
  getWhatsappTemplateForEvent,
  renderWhatsappTemplate,
  type JlfWhatsappEventType,
} from "@/server/modules/judicia/legal-form/whatsapp/jlf-whatsapp-template-service";
import { maskNomorPerkara } from "@/server/modules/judicia/legal-form/verification/jlf-qr-code-service";
import { getAletaBotSettingsSummary, getWhatsappGatewayStatus } from "@/server/modules/judicia/legal-form/jlf-aleta-bot-status-reader";

type RecipientRow = {
  id: string;
  name: string;
  whatsapp_number: string;
};

const EVENT_SETTING_KEYS: Partial<Record<JlfWhatsappEventType, string>> = {
  document_waiting_validation: "jlf.whatsapp.send_validation_notifications",
  document_approved: "jlf.whatsapp.send_document_ready_notifications",
  document_rejected: "jlf.whatsapp.send_document_ready_notifications",
  document_change_requested: "jlf.whatsapp.send_validation_notifications",
  document_finalized: "jlf.whatsapp.send_document_ready_notifications",
  document_ready: "jlf.whatsapp.send_document_ready_notifications",
  regulation_needs_review: "jlf.whatsapp.send_regulation_review_notifications",
};

function safeEntityLink(input: { relatedEntityType: string; relatedEntityId: string; eventType: JlfWhatsappEventType }) {
  if (input.relatedEntityType === "jlf_generated_document") {
    return `/judicia/legal-form/documents/${encodeURIComponent(input.relatedEntityId)}`;
  }
  if (input.eventType === "account_link_pending") {
    return "/judicia/legal-form/account-sync";
  }
  return "/judicia/legal-form";
}

async function readRecipient(db: AletaDatabase, recipientUserId: string) {
  return db.prepare(
    `SELECT id, name, whatsapp_number
     FROM users
     WHERE id = ? AND deleted_at IS NULL AND is_active = 1`
  ).get<RecipientRow>(recipientUserId);
}

export async function isJlfWhatsappEventEnabled(db: AletaDatabase, eventType: JlfWhatsappEventType) {
  const globalEnabled = await getBooleanSetting(db, "jlf.whatsapp.enabled", false);
  if (!globalEnabled) return false;
  const eventSettingKey = EVENT_SETTING_KEYS[eventType];
  if (!eventSettingKey) return true;
  return getBooleanSetting(db, eventSettingKey, false);
}

export async function sendJlfWhatsappNotification(
  db: AletaDatabase,
  input: {
    eventType: JlfWhatsappEventType;
    recipientUserId?: string | null;
    recipientPhone?: string | null;
    recipientName?: string | null;
    relatedEntityType: string;
    relatedEntityId: string;
    nomorPerkara?: string;
    createdBy?: string | null;
    variables?: Record<string, string>;
    dryRun?: boolean;
  }
) {
  const enabled = await isJlfWhatsappEventEnabled(db, input.eventType);
  const template = await getWhatsappTemplateForEvent(db, input.eventType);
  const recipient = input.recipientUserId ? await readRecipient(db, input.recipientUserId) : null;
  const recipientPhone = input.recipientPhone ?? recipient?.whatsapp_number ?? "";
  const recipientName = input.recipientName ?? recipient?.name ?? "";
  const safeLink = safeEntityLink(input);
  const message = template
    ? renderWhatsappTemplate(template.messageTemplate, {
        link: safeLink,
        nomor_perkara_masked: input.nomorPerkara ? maskNomorPerkara(input.nomorPerkara) : "",
        ...(input.variables ?? {}),
      })
    : "Ada pembaruan di ALETA Judicia (Legal Form). Silakan login ke ALETA untuk melihat detail.";

  if (!enabled) {
    await createWhatsappNotificationLog(db, {
      eventType: input.eventType,
      recipientUserId: input.recipientUserId,
      recipientPhone,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      nomorPerkara: input.nomorPerkara,
      messagePreview: message,
      status: "skipped",
      errorMessage: "Notifikasi WhatsApp JLF dinonaktifkan.",
      createdBy: input.createdBy,
    });
    return { ok: true, status: "skipped" as const, message: "Notifikasi WhatsApp JLF dinonaktifkan." };
  }

  if (!recipientPhone) {
    await createWhatsappNotificationLog(db, {
      eventType: input.eventType,
      recipientUserId: input.recipientUserId,
      recipientPhone,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      nomorPerkara: input.nomorPerkara,
      messagePreview: message,
      status: "skipped",
      errorMessage: "Nomor WhatsApp penerima belum tersedia.",
      createdBy: input.createdBy,
    });
    return { ok: true, status: "skipped" as const, message: "Nomor WhatsApp penerima belum tersedia." };
  }

  const result = await sendPortalWhatsappMessage({
    sourceFeature: "judicia-legal-form",
    entityType: input.relatedEntityType,
    entityId: input.relatedEntityId,
    eventType: input.eventType,
    recipientNumber: recipientPhone,
    recipientName,
    message,
    category: "employee",
    priority: input.eventType === "document_waiting_validation" ? 4 : 6,
    dryRun: input.dryRun,
    metadata: {
      nomorPerkara: input.nomorPerkara ? maskNomorPerkara(input.nomorPerkara) : undefined,
      safeLink,
    },
  });

  await createWhatsappNotificationLog(db, {
    eventType: input.eventType,
    recipientUserId: input.recipientUserId,
    recipientPhone,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    nomorPerkara: input.nomorPerkara ? maskNomorPerkara(input.nomorPerkara) : "",
    messagePreview: message,
    status: result.status,
    gatewayMessageId: result.queueId ? String(result.queueId) : result.idempotencyKey ?? "",
    errorMessage: result.ok ? null : result.message,
    createdBy: input.createdBy,
  });

  return result;
}

export async function testSafeJlfWhatsappNotification(
  db: AletaDatabase,
  actor: UserPersona,
  input: { recipientPhone: string; eventType?: JlfWhatsappEventType }
) {
  requireJlfPermission(actor, JLF_PERMISSION.WHATSAPP_SEND);
  if (!input.recipientPhone.trim()) jlfBadRequest("Nomor WhatsApp tujuan wajib diisi.");

  return sendJlfWhatsappNotification(db, {
    eventType: input.eventType ?? "document_ready",
    recipientPhone: input.recipientPhone,
    recipientName: "Test JLF",
    relatedEntityType: "jlf_test",
    relatedEntityId: "test-safe",
    createdBy: actor.id,
    dryRun: true,
  });
}

export async function getJlfWhatsappAdminSummary(db: AletaDatabase) {
  const [settings, gateway] = await Promise.all([
    getAletaBotSettingsSummary(db),
    getWhatsappGatewayStatus(db),
  ]);

  return {
    gateway,
    aletaBot: settings,
    jlfEnabled: await getBooleanSetting(db, "jlf.whatsapp.enabled", false),
    validationEnabled: await getBooleanSetting(db, "jlf.whatsapp.send_validation_notifications", false),
    documentReadyEnabled: await getBooleanSetting(db, "jlf.whatsapp.send_document_ready_notifications", false),
    regulationReviewEnabled: await getBooleanSetting(db, "jlf.whatsapp.send_regulation_review_notifications", false),
  };
}

export const JlfAletaBotGatewayAdapter = {
  sendSafeMessage: sendJlfWhatsappNotification,
};

export const JlfWhatsappNotificationService = {
  sendJlfWhatsappNotification,
  testSafeJlfWhatsappNotification,
  getJlfWhatsappAdminSummary,
  listWhatsappNotificationLogs,
};
