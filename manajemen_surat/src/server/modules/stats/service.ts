import { runAletaIntelligence } from "@/core/intelligence/aleta-intelligence-service";
import { type AletaDatabase } from "@/server/db/client";
import { getAISettingsFromDb } from "@/server/modules/ai/service";
import { getLetterSummaryForStats, type LetterSearchFilters } from "@/server/modules/letters/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { ApiError } from "@/server/shared/errors";

type StatsDimension = "jenis" | "tahun" | "triwulan" | "klasifikasi" | "asal" | "status";
type LetterStatsRow = Awaited<ReturnType<typeof getLetterSummaryForStats>>[number];
const KPI_ALLOWED_ROLES = new Set(["super-admin", "admin", "ketua", "wakil-ketua", "panitera", "sekretaris"]);

function getQuarter(dateValue: string) {
  const month = new Date(dateValue).getMonth();
  return `TW ${Math.floor(month / 3) + 1}`;
}

function getLabel(dimension: StatsDimension, row: LetterStatsRow) {
  if (dimension === "jenis") return row.type === "masuk" ? "Surat Masuk" : "Surat Keluar";
  if (dimension === "tahun") return new Date(row.tanggal_ref).getFullYear().toString();
  if (dimension === "triwulan") return getQuarter(row.tanggal_ref);
  if (dimension === "asal") return row.asal_surat;
  if (dimension === "status") return row.status;
  return row.klasifikasi_utama?.trim() ? row.klasifikasi_utama : "Belum Terklasifikasi";
}

export async function getLetterStatisticsInDb(db: AletaDatabase, {
  dimension = "jenis",
  includeAIInsight = false,
  ...filters
}: LetterSearchFilters & { dimension?: StatsDimension; includeAIInsight?: boolean }) {
  const rows = await getLetterSummaryForStats(db, filters);
  const grouped = rows.reduce<Map<string, number>>((map, row) => {
    const label = getLabel(dimension, row);
    map.set(label, (map.get(label) ?? 0) + 1);
    return map;
  }, new Map());
  const data = Array.from(grouped.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));

  let aiInsight: string | null = null;
  const aiConfig = await getAISettingsFromDb(db);

  if (includeAIInsight && aiConfig.enabled) {
    const insight = await runAletaIntelligence(
      {
        moduleId: "manajemen-surat",
        entityType: "statistik",
        title: `Analisis statistik ${dimension}`,
        content: data.map((item) => `${item.label}: ${item.value}`).join(". "),
        tags: ["statistik", dimension],
      },
      aiConfig
    );
    aiInsight = insight.summary;
  }

  return {
    total: rows.length,
    dimension,
    data,
    aiInsight,
  };
}

function isSameLocalDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export async function getDispositionStatisticsInDb(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT id, status, deadline_at, read_at, target_position_id
     FROM dispositions
     WHERE deleted_at IS NULL`
  ).all<{
    id: string;
    status: string;
    deadline_at: string | null;
    read_at: string | null;
    target_position_id: string;
  }>();
  const now = new Date();
  const activeRows = rows.filter((row) => row.status !== "Selesai");
  const overdue = activeRows.filter((row) => {
    if (!row.deadline_at) return false;
    const deadline = new Date(row.deadline_at);
    return !Number.isNaN(deadline.getTime()) && deadline < now && !isSameLocalDate(deadline, now);
  });
  const dueToday = activeRows.filter((row) => {
    if (!row.deadline_at) return false;
    const deadline = new Date(row.deadline_at);
    return !Number.isNaN(deadline.getTime()) && isSameLocalDate(deadline, now);
  });
  const byTargetPosition = activeRows.reduce<Record<string, number>>((map, row) => {
    map[row.target_position_id] = (map[row.target_position_id] ?? 0) + 1;
    return map;
  }, {});

  return {
    totalActive: activeRows.length,
    overdue: overdue.length,
    dueToday: dueToday.length,
    completed: rows.filter((row) => row.status === "Selesai").length,
    unread: activeRows.filter((row) => !row.read_at).length,
    byTargetPosition,
  };
}

function averageHours(values: number[]) {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

export async function getLetterSlaStatisticsInDb(db: AletaDatabase) {
  const rows = await db.prepare(
    `SELECT dsp.id, dsp.status, dsp.deadline_at, dsp.read_at, dsp.created_at, dsp.updated_at,
      dsp.urgent, dsp.target_position_id, COALESCE(pos.name, dsp.target_position_id, 'Belum ditentukan') AS target_position_name
     FROM dispositions dsp
     LEFT JOIN positions pos ON pos.id = dsp.target_position_id
     WHERE dsp.deleted_at IS NULL`
  ).all<{
    id: string;
    status: string;
    deadline_at: string | null;
    read_at: string | null;
    created_at: string;
    updated_at: string;
    urgent: number | null;
    target_position_id: string | null;
    target_position_name: string;
  }>();

  const now = new Date();
  const activeRows = rows.filter((row) => row.status !== "Selesai");
  const overdueRows = activeRows.filter((row) => {
    if (!row.deadline_at) return false;
    const deadline = new Date(row.deadline_at);
    return !Number.isNaN(deadline.getTime()) && deadline < now && !isSameLocalDate(deadline, now);
  });
  const dueTodayRows = activeRows.filter((row) => {
    if (!row.deadline_at) return false;
    const deadline = new Date(row.deadline_at);
    return !Number.isNaN(deadline.getTime()) && isSameLocalDate(deadline, now);
  });
  const readDurations = rows
    .filter((row) => row.read_at)
    .map((row) => (new Date(row.read_at || "").getTime() - new Date(row.created_at).getTime()) / 36e5)
    .filter((value) => Number.isFinite(value) && value >= 0);
  const completionDurations = rows
    .filter((row) => row.status === "Selesai")
    .map((row) => (new Date(row.updated_at).getTime() - new Date(row.created_at).getTime()) / 36e5)
    .filter((value) => Number.isFinite(value) && value >= 0);
  const byUnit = overdueRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.target_position_name || row.target_position_id || "Belum ditentukan";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalActive: activeRows.length,
    overdue: overdueRows.length,
    dueToday: dueTodayRows.length,
    unread: activeRows.filter((row) => !row.read_at).length,
    averageReadHours: averageHours(readDurations),
    averageCompletionHours: averageHours(completionDurations),
    urgentActive: activeRows.filter((row) => Boolean(row.urgent)).length,
    byOverdueUnit: Object.entries(byUnit)
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
      .slice(0, 8),
  };
}

export async function getLeadershipKpiStatisticsInDb(
  db: AletaDatabase,
  actorUserId: string,
  periodDays = 7
) {
  const actor = await requireActorUser(db, actorUserId);
  if (!KPI_ALLOWED_ROLES.has(actor.roleId)) {
    throw new ApiError(403, "Ringkasan Pimpinan hanya tersedia untuk pimpinan dan admin.");
  }

  const safeDays = Math.max(1, Math.min(30, Number(periodDays || 7)));
  const since = new Date();
  since.setDate(since.getDate() - safeDays + 1);
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);

  const [
    lettersInRow,
    lettersOutRow,
    dispositionRows,
    failedWaRow,
    publicQaRow,
    feedbackRow,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM letters
         WHERE deleted_at IS NULL
           AND type = 'masuk'
           AND COALESCE(tanggal_terima, tanggal_administratif, tanggal_surat, created_at) >= ?`
      )
      .get<{ count: number | string }>(sinceIso),
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM letters
         WHERE deleted_at IS NULL
           AND type = 'keluar'
           AND COALESCE(tanggal_kirim, tanggal_administratif, tanggal_surat, created_at) >= ?`
      )
      .get<{ count: number | string }>(sinceIso),
    db
      .prepare(
        `SELECT id, status, deadline_at, read_at
         FROM dispositions
         WHERE deleted_at IS NULL`
      )
      .all<{ id: string; status: string; deadline_at: string | null; read_at: string | null }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM aleta_bot_notification_logs
         WHERE created_at >= ? AND status IN ('failed', 'dead_letter')`
      )
      .get<{ count: number | string }>(sinceIso),
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM aleta_bot_public_qa_logs
         WHERE needs_human_review = 1 AND review_status = 'pending'`
      )
      .get<{ count: number | string }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS count
         FROM feedback_requests
         WHERE created_at >= ? AND type = 'bug' AND status IN ('new', 'reviewed', 'in_progress', 'needs_info')`
      )
      .get<{ count: number | string }>(sinceIso)
      .catch(() => ({ count: 0 })),
  ]);

  const activeDispositions = dispositionRows.filter((row) => row.status !== "Selesai");
  const overdueDispositions = activeDispositions.filter((row) => {
    if (!row.deadline_at) return false;
    const deadline = new Date(row.deadline_at);
    return !Number.isNaN(deadline.getTime()) && deadline < now && !isSameLocalDate(deadline, now);
  });
  const dueTodayDispositions = activeDispositions.filter((row) => {
    if (!row.deadline_at) return false;
    const deadline = new Date(row.deadline_at);
    return !Number.isNaN(deadline.getTime()) && deadline.toISOString().slice(0, 10) === todayIso;
  });
  const failedWhatsappMessages = Number(failedWaRow?.count || 0);
  const publicQaPendingReview = Number(publicQaRow?.count || 0);
  const newFeedback = Number(feedbackRow?.count || 0);
  const blocked = failedWhatsappMessages >= 10 || overdueDispositions.length >= 10;
  const warning = failedWhatsappMessages > 0 || publicQaPendingReview > 0 || overdueDispositions.length > 0;

  return {
    periodDays: safeDays,
    lettersInThisWeek: Number(lettersInRow?.count || 0),
    lettersOutThisWeek: Number(lettersOutRow?.count || 0),
    activeDispositions: activeDispositions.length,
    overdueDispositions: overdueDispositions.length,
    dueTodayDispositions: dueTodayDispositions.length,
    unreadDispositions: activeDispositions.filter((row) => !row.read_at).length,
    failedWhatsappMessages,
    publicQaPendingReview,
    newFeedback,
    aletaBotStatus: blocked ? "blocked" : warning ? "warning" : "normal",
  };
}
