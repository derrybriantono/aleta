import { type NextRequest, NextResponse } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getUserByIdFromDb } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok, unauthorized } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  success: "Terkirim",
  failed: "Gagal",
  simulated: "Simulasi",
  pending: "Menunggu Antrean",
  processing: "Sedang Diproses",
  dead_letter: "Gagal Permanen",
  cancelled: "Dibatalkan",
  dry_run: "Simulasi",
  skipped: "Dilewati",
  sent: "Terkirim",
};

const CATEGORY_LABELS: Record<string, string> = {
  jadwal_sidang: "Jadwal Sidang",
  notifikasi_perkara: "Notifikasi Perkara",
  employee: "Notifikasi Pegawai",
  public_qa: "Pertanyaan Publik",
  system: "Sistem",
  manajemen_surat: "Manajemen Surat",
  letter: "Surat",
  disposition: "Disposisi",
};

function maskNumber(number: string): string {
  if (!number || number.length < 7) return number;
  const visible = 4;
  return number.slice(0, 3) + "****" + number.slice(-visible);
}

function sanitizeError(msg: string | null | undefined): string | null {
  if (!msg) return null;
  const lower = msg.toLowerCase();
  if (lower.includes("could not find chrome") || lower.includes("puppeteer")) {
    return "Chrome/Puppeteer belum tersedia di server. Admin teknis perlu memasang browser atau mengatur executable path.";
  }
  if (lower.includes("target closed")) {
    return "Browser WhatsApp tertutup. Coba hubungkan ulang WhatsApp Gateway dengan aman.";
  }
  if (lower.includes("session expired")) {
    return "Sesi WhatsApp berakhir. Silakan hubungkan ulang WhatsApp Gateway.";
  }
  if (lower.includes("protocol error")) {
    return "Terjadi gangguan komunikasi dengan browser WhatsApp.";
  }
  if (lower.includes("econnrefused") || lower.includes("enotfound")) {
    return "WhatsApp Bot belum dapat dihubungi.";
  }
  if (lower.includes("invalid phone") || lower.includes("invalid number") || lower.includes("not a wa")) {
    return "Nomor tidak valid.";
  }
  return msg.slice(0, 200);
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function parseMetadata(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

type MessageRow = {
  id: string;
  notification_id: string | null;
  recipient_number: string;
  recipient_name: string;
  category: string;
  message_preview: string;
  status: string;
  error_message: string | null;
  source_app: string;
  source_feature: string;
  entity_type: string;
  entity_id: string;
  metadata_json: string;
  sent_at: string | null;
  created_at: string;
  position_name: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const actorUserId = await resolveActorUserId(request);
    if (!actorUserId) return unauthorized();

    const db = await getDatabase();
    const actor = await getUserByIdFromDb(db, actorUserId);
    if (!actor) return unauthorized();

    const roleId = actor.roleId as string;
    const isPrivileged = roleId === "super-admin" || roleId === "admin";

    const { searchParams } = request.nextUrl;
    const exportCsv = searchParams.get("format") === "csv";
    const statusFilter = searchParams.get("status") ?? "";
    const sourceFeatureFilter = searchParams.get("sourceFeature") ?? "";
    const sourceAppFilter = searchParams.get("sourceApp") ?? "";
    const entityTypeFilter = searchParams.get("entityType") ?? "";
    const entityIdFilter = searchParams.get("entityId") ?? "";
    const searchQuery = (searchParams.get("search") ?? "").trim();
    const dateRange = searchParams.get("dateRange") ?? "7d";
    const limit = Math.max(1, Math.min(exportCsv ? 1000 : 100, Number(searchParams.get("limit") ?? (exportCsv ? 1000 : 50))));
    const offset = Math.max(0, Number(searchParams.get("offset") ?? 0));

    // Build date filter
    let dateClause = "";
    const dateParams: string[] = [];
    if (dateRange === "today") {
      const today = new Date().toISOString().slice(0, 10);
      dateClause = "AND n.created_at >= ?";
      dateParams.push(today);
    } else if (dateRange === "7d") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      dateClause = "AND n.created_at >= ?";
      dateParams.push(d.toISOString().slice(0, 10));
    } else if (dateRange === "30d") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      dateClause = "AND n.created_at >= ?";
      dateParams.push(d.toISOString().slice(0, 10));
    }

    // Build status filter
    const statusClause = statusFilter ? "AND n.status = ?" : "";
    const statusParams = statusFilter ? [statusFilter] : [];

    const sourceFeatureAliases = sourceFeatureFilter === "disposition"
      ? ["disposition", "disposition_notification", "disposition_deadline_reminder"]
      : sourceFeatureFilter === "letter"
        ? ["letter", "letter_notification"]
        : sourceFeatureFilter
          ? [sourceFeatureFilter]
          : [];
    const sourceFeaturePlaceholders = sourceFeatureAliases.map(() => "?").join(", ");
    const sourceFeatureClause = sourceFeatureFilter
      ? `AND (n.category IN (${sourceFeaturePlaceholders}) OR n.source_feature IN (${sourceFeaturePlaceholders}))`
      : "";
    const sourceFeatureParams = sourceFeatureFilter
      ? [...sourceFeatureAliases, ...sourceFeatureAliases]
      : [];
    const sourceAppClause = sourceAppFilter ? "AND n.source_app = ?" : "";
    const sourceAppParams = sourceAppFilter ? [sourceAppFilter] : [];
    const entityTypeClause = entityTypeFilter ? "AND n.entity_type = ?" : "";
    const entityTypeParams = entityTypeFilter ? [entityTypeFilter] : [];
    const entityIdClause = entityIdFilter
      ? "AND (n.entity_id = ? OR n.metadata_json LIKE ? OR n.metadata_json LIKE ? OR n.metadata_json LIKE ? OR n.metadata_json LIKE ? OR n.metadata_json LIKE ? OR n.metadata_json LIKE ? OR n.metadata_json LIKE ?)"
      : "";
    const metadataEntityPattern = (key: string) => `%"${key}"%"${entityIdFilter}"%`;
    const entityIdParams = entityIdFilter
      ? [
          entityIdFilter,
          metadataEntityPattern("entityId"),
          metadataEntityPattern("entity_id"),
          metadataEntityPattern("suratId"),
          metadataEntityPattern("surat_id"),
          metadataEntityPattern("letterId"),
          metadataEntityPattern("dispositionId"),
          metadataEntityPattern("disposition_id"),
        ]
      : [];

    // Build search filter
    let searchClause = "";
    const searchParams2: string[] = [];
    if (searchQuery) {
      searchClause = "AND (n.recipient_name LIKE ? OR n.recipient_number LIKE ?)";
      searchParams2.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }

    const allParams: unknown[] = [
      ...dateParams,
      ...statusParams,
      ...sourceFeatureParams,
      ...sourceAppParams,
      ...entityTypeParams,
      ...entityIdParams,
      ...searchParams2,
    ];

    const sql = `
      SELECT
        n.id,
        n.notification_id,
        n.recipient_number,
        n.recipient_name,
        n.category,
        n.message_preview,
        n.status,
        n.error_message,
        n.source_app,
        n.source_feature,
        n.entity_type,
        n.entity_id,
        n.metadata_json,
        n.sent_at,
        n.created_at,
        p.name AS position_name
      FROM aleta_bot_notification_logs n
      LEFT JOIN users u ON u.whatsapp_number = n.recipient_number AND u.is_active = 1
      LEFT JOIN positions p ON p.id = u.position_id
      WHERE 1=1
        ${dateClause}
        ${statusClause}
        ${sourceFeatureClause}
        ${sourceAppClause}
        ${entityTypeClause}
        ${entityIdClause}
        ${searchClause}
      ORDER BY n.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const rows = await db.queryAll<MessageRow>(sql, allParams as import("@/server/db/client").SqlInputValue[]);

    const items = rows.map((row) => {
      const numberMasked = !isPrivileged;
      const displayNumber = numberMasked ? maskNumber(row.recipient_number) : row.recipient_number;

      const metadata = parseMetadata(row.metadata_json);
      const sourceKey = row.source_feature || String(metadata.sourceFeature || metadata.source_feature || row.category);
      const entityType = row.entity_type || String(metadata.entityType || metadata.entity_type || "") || null;
      const entityId = row.entity_id || String(metadata.entityId || metadata.entity_id || "") || null;
      const caseOrPosition =
        String(metadata.nomorPerkara || metadata.nomor_perkara || metadata.recipientPosition || metadata.recipient_position || "").trim() ||
        row.position_name ||
        "—";
      return {
        id: row.id,
        recipientName: row.recipient_name || "—",
        recipientNumber: displayNumber,
        recipientNumberMasked: numberMasked,
        caseOrPosition,
        messagePreview: row.message_preview
          ? row.message_preview.slice(0, 160) + (row.message_preview.length > 160 ? "…" : "")
          : "—",
        messageBody: isPrivileged ? (row.message_preview ?? null) : null,
        status: row.status,
        statusLabel: STATUS_LABELS[row.status] ?? row.status,
        sourceFeature: sourceKey,
        sourceFeatureLabel: CATEGORY_LABELS[sourceKey] ?? CATEGORY_LABELS[row.category] ?? sourceKey,
        sourceApp: row.source_app || "aleta_bot",
        entityType,
        entityId,
        createdAt: row.created_at,
        sentAt: row.sent_at ?? null,
        errorMessage: sanitizeError(row.error_message),
      };
    });

    if (exportCsv) {
      const headers = [
        "Waktu",
        "Nama penerima",
        "Nomor",
        "Nomor perkara/jabatan",
        "Status",
        "Sumber fitur",
        "Isi preview",
        "Error ringkas",
      ];
      const lines = [
        headers.map(csvEscape).join(","),
        ...items.map((item) =>
          [
            item.createdAt,
            item.recipientName,
            item.recipientNumber,
            item.caseOrPosition,
            item.statusLabel,
            item.sourceFeatureLabel,
            item.messageBody ?? item.messagePreview,
            item.errorMessage ?? "",
          ].map(csvEscape).join(",")
        ),
      ];
      return new NextResponse(lines.join("\r\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="riwayat-pesan-aleta-bot.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // Total count for pagination
    const countSql = `
      SELECT COUNT(*) AS total
      FROM aleta_bot_notification_logs n
      WHERE 1=1
        ${dateClause}
        ${statusClause}
        ${sourceFeatureClause}
        ${sourceAppClause}
        ${entityTypeClause}
        ${entityIdClause}
        ${searchClause}
    `;
    type CountRow = { total: string | number };
    const countRow = await db.queryOne<CountRow>(
      countSql,
      allParams as import("@/server/db/client").SqlInputValue[]
    );
    const total = Number(countRow?.total ?? 0);

    return ok({
      items,
      total,
      limit,
      offset,
      filters: {
        sourceFeature: sourceFeatureFilter || null,
        sourceApp: sourceAppFilter || null,
        entityType: entityTypeFilter || null,
        entityId: entityIdFilter || null,
        entityFilterApplied: Boolean(entityIdFilter),
        entityFilterFallback: Boolean(entityIdFilter && total === 0 && sourceFeatureFilter),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
