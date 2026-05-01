import { type NextRequest } from "next/server";

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
  if (lower.includes("econnrefused") || lower.includes("enotfound")) {
    return "WhatsApp belum terhubung.";
  }
  if (lower.includes("invalid phone") || lower.includes("invalid number") || lower.includes("not a wa")) {
    return "Nomor tidak valid.";
  }
  return msg.slice(0, 200);
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
    const statusFilter = searchParams.get("status") ?? "";
    const searchQuery = (searchParams.get("search") ?? "").trim();
    const dateRange = searchParams.get("dateRange") ?? "7d";
    const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") ?? 50)));
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

    // Build search filter
    let searchClause = "";
    const searchParams2: string[] = [];
    if (searchQuery) {
      searchClause = "AND (n.recipient_name LIKE ? OR n.recipient_number LIKE ?)";
      searchParams2.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }

    const allParams: unknown[] = [...dateParams, ...statusParams, ...searchParams2];

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
        n.sent_at,
        n.created_at,
        p.name AS position_name
      FROM aleta_bot_notification_logs n
      LEFT JOIN users u ON u.whatsapp_number = n.recipient_number AND u.is_active = 1
      LEFT JOIN positions p ON p.id = u.position_id
      WHERE 1=1
        ${dateClause}
        ${statusClause}
        ${searchClause}
      ORDER BY n.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const rows = await db.queryAll<MessageRow>(sql, allParams as import("@/server/db/client").SqlInputValue[]);

    const items = rows.map((row) => {
      const numberMasked = !isPrivileged;
      const displayNumber = numberMasked ? maskNumber(row.recipient_number) : row.recipient_number;

      return {
        id: row.id,
        recipientName: row.recipient_name || "—",
        recipientNumber: displayNumber,
        recipientNumberMasked: numberMasked,
        caseOrPosition: row.position_name ?? "—",
        messagePreview: row.message_preview
          ? row.message_preview.slice(0, 160) + (row.message_preview.length > 160 ? "…" : "")
          : "—",
        messageBody: isPrivileged ? (row.message_preview ?? null) : null,
        status: row.status,
        statusLabel: STATUS_LABELS[row.status] ?? row.status,
        sourceFeature: row.category,
        sourceFeatureLabel: CATEGORY_LABELS[row.category] ?? row.category,
        createdAt: row.created_at,
        sentAt: row.sent_at ?? null,
        errorMessage: sanitizeError(row.error_message),
      };
    });

    // Total count for pagination
    const countSql = `
      SELECT COUNT(*) AS total
      FROM aleta_bot_notification_logs n
      WHERE 1=1
        ${dateClause}
        ${statusClause}
        ${searchClause}
    `;
    type CountRow = { total: string | number };
    const countRow = await db.queryOne<CountRow>(
      countSql,
      allParams as import("@/server/db/client").SqlInputValue[]
    );
    const total = Number(countRow?.total ?? 0);

    return ok({ items, total, limit, offset });
  } catch (error) {
    return handleRouteError(error);
  }
}
