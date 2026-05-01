import {
  getWhatsappRuntimeMode,
  enqueueGatewayMessage,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";

export type PortalWhatsappSendInput = {
  sourceFeature: string;
  entityType: string;
  entityId: string;
  eventType?: string;
  recipientNumber: string;
  recipientName?: string;
  message: string;
  category?: string;
  priority?: number;
  dryRun?: boolean;
  metadata?: Record<string, unknown>;
};

export type PortalWhatsappSendResult = {
  ok: boolean;
  status: "enqueued" | "sent" | "skipped" | "error";
  queueId?: number | string;
  duplicate?: boolean;
  idempotencyKey?: string;
  message: string;
};

export type MessageEntityMetadataInput = {
  sourceApp?: string;
  sourceFeature: string;
  entityType: string;
  entityId: string;
  letterId?: string | null;
  dispositionId?: string | null;
  nomorSurat?: string | null;
  nomorPerkara?: string | null;
  recipientType?: "employee" | "party" | "system";
  recipientRole?: string | null;
  recipientPosition?: string | null;
  [key: string]: unknown;
};

function normalizeNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

function compactMetadata(input: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

export function buildMessageEntityMetadata(input: MessageEntityMetadataInput): Record<string, unknown> {
  const base = {
    ...input,
    sourceApp: input.sourceApp ?? "manajemen_surat",
    sourceFeature: input.sourceFeature,
    entityType: input.entityType,
    entityId: input.entityId,
    letterId: input.letterId ?? (input.entityType === "letter" ? input.entityId : undefined),
    dispositionId: input.dispositionId ?? (input.entityType === "disposition" ? input.entityId : undefined),
    nomorSurat: input.nomorSurat ?? undefined,
    nomorPerkara: input.nomorPerkara ?? undefined,
    recipientType: input.recipientType ?? "employee",
    recipientRole: input.recipientRole ?? undefined,
    recipientPosition: input.recipientPosition ?? undefined,
  };

  return compactMetadata(base);
}

function slugify(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9@._-]/g, "");
}

// Format: manajemen_surat:{sourceFeature}:{entityType}:{entityId}:{recipientNumber}:{eventType}
// Stabil untuk event yang sama — tidak berubah karena timestamp.
function buildPortalIdempotencyKey(
  sourceFeature: string,
  entityType: string,
  entityId: string,
  recipientNumber: string,
  eventType?: string
): string {
  return [
    "manajemen_surat",
    slugify(sourceFeature),
    slugify(entityType),
    slugify(entityId),
    slugify(recipientNumber),
    slugify(eventType || "send"),
  ].join(":");
}

export async function sendPortalWhatsappMessage(
  input: PortalWhatsappSendInput
): Promise<PortalWhatsappSendResult> {
  const {
    sourceFeature,
    entityType,
    entityId,
    eventType,
    message,
    category = "employee",
    priority = 5,
    dryRun,
    metadata,
  } = input;

  const runtimeMode = getWhatsappRuntimeMode();
  const normalized = normalizeNumber(input.recipientNumber);
  const recipientName = input.recipientName ?? "";
  const entityMetadata = buildMessageEntityMetadata({
    ...(metadata ?? {}),
    sourceApp: "manajemen_surat",
    sourceFeature,
    entityType,
    entityId,
    recipientType: category === "party" ? "party" : category === "system" ? "system" : "employee",
  });

  if (!normalized) {
    return {
      ok: false,
      status: "error",
      message: "Nomor WhatsApp tujuan tidak valid.",
    };
  }

  if (runtimeMode === "disabled") {
    return {
      ok: true,
      status: "skipped",
      message: "Pengiriman WhatsApp dinonaktifkan (WHATSAPP_RUNTIME_MODE=disabled).",
    };
  }

  const idempotencyKey = buildPortalIdempotencyKey(
    sourceFeature,
    entityType,
    entityId,
    normalized,
    eventType
  );

  if (runtimeMode === "aleta_bot") {
    const result = await enqueueGatewayMessage({
      sourceApp: "manajemen_surat",
      sourceFeature,
      entityType,
      entityId,
      recipientNumber: normalized,
      recipientName,
      message,
      category,
      priority,
      dryRun,
      idempotencyKey,
      metadata: entityMetadata,
    });

    if (!result.ok) {
      return {
        ok: false,
        status: "error",
        message: `ALETA Bot Gateway tidak dapat dihubungi: ${result.error}`,
      };
    }

    const queueId = result.data.queueId ?? result.data.existingQueueId;
    if (!queueId && !result.data.duplicate) {
      return {
        ok: false,
        status: "error",
        idempotencyKey,
        message: "ALETA Bot Gateway merespons, tetapi antrean pesan tidak terkonfirmasi.",
      };
    }

    return {
      ok: true,
      status: "enqueued",
      queueId,
      duplicate: result.data.duplicate,
      idempotencyKey,
      message: result.data.duplicate
        ? "Pesan sudah ada dalam antrean (idempotent)."
        : "Pesan berhasil dimasukkan ke antrean pengiriman ALETA Bot.",
    };
  }

  // legacy_portal
  try {
    const { whatsappService } = await import("@/server/modules/whatsapp/service");
    await whatsappService.sendMessage(normalized, message);
    return {
      ok: true,
      status: "sent",
      idempotencyKey,
      message: "Pesan berhasil dikirim melalui WhatsApp.",
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      message: error instanceof Error ? error.message : "Pengiriman WhatsApp gagal diproses.",
    };
  }
}
