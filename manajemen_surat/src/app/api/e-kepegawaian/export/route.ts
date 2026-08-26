import { type NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { getDatabase } from "@/server/db/client";
import { getEKepegawaianDashboard } from "@/server/modules/e-kepegawaian/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { buildAttachmentContentDisposition, getAttachmentSecurityHeaders } from "@/server/shared/download-headers";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { getRequestAuditMetadata } from "@/server/shared/request";
import { createXlsxWorkbook, type XlsxSheet } from "@/server/shared/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

type DashboardData = Awaited<ReturnType<typeof getEKepegawaianDashboard>>;

type ReportFilters = {
  employeeId: string;
  unit: string;
  status: string;
  year: string;
  month: string;
  leaveTypeId: string;
  submissionType: string;
  documentCategory: string;
  slaStatus: string;
  keyword: string;
};

function cleanParam(value: string | null) {
  const normalized = String(value ?? "").trim();
  return normalized === "all" ? "" : normalized;
}

function readFilters(request: NextRequest): ReportFilters {
  const params = request.nextUrl.searchParams;
  return {
    employeeId: cleanParam(params.get("employeeId")),
    unit: cleanParam(params.get("unit")),
    status: cleanParam(params.get("status")),
    year: cleanParam(params.get("year")),
    month: cleanParam(params.get("month")),
    leaveTypeId: cleanParam(params.get("leaveTypeId")),
    submissionType: cleanParam(params.get("submissionType")),
    documentCategory: cleanParam(params.get("documentCategory")),
    slaStatus: cleanParam(params.get("slaStatus")),
    keyword: cleanParam(params.get("keyword")).toLowerCase(),
  };
}

function matchesYearMonth(dateValue: string | null | undefined, filters: ReportFilters) {
  if (!filters.year && !filters.month) return true;
  const value = String(dateValue ?? "");
  if (!value) return false;
  if (filters.year && value.slice(0, 4) !== filters.year) return false;
  if (filters.month && value.slice(5, 7) !== filters.month.padStart(2, "0")) return false;
  return true;
}

function matchesText(value: string, keyword: string) {
  return !keyword || value.toLowerCase().includes(keyword);
}

function filterDashboard(data: DashboardData, filters: ReportFilters): DashboardData {
  const employeeById = new Map(data.employees.map((employee) => [employee.id, employee]));
  const employeeMatches = (employeeId: string | null | undefined) => {
    if (!employeeId) return !filters.employeeId && !filters.unit && !filters.keyword;
    const employee = employeeById.get(employeeId);
    if (!employee) return false;
    if (filters.employeeId && employee.id !== filters.employeeId) return false;
    if (filters.unit && employee.unitKerja !== filters.unit) return false;
    return true;
  };

  const employees = data.employees.filter((employee) =>
    employeeMatches(employee.id) &&
    matchesText(`${employee.fullName} ${employee.nip} ${employee.employeeNumber} ${employee.unitKerja}`, filters.keyword)
  );
  const leaveRequests = data.leaveRequests.filter((item) =>
    employeeMatches(item.employeeId) &&
    (!filters.status || item.status === filters.status) &&
    (!filters.leaveTypeId || item.leaveTypeId === filters.leaveTypeId) &&
    matchesYearMonth(item.startDate, filters) &&
    matchesText(`${item.employeeName} ${item.leaveTypeName} ${item.requestNumber ?? ""} ${item.reason}`, filters.keyword)
  );
  const submissions = data.submissions.filter((item) =>
    employeeMatches(item.employeeId) &&
    (!filters.status || item.status === filters.status) &&
    (!filters.submissionType || item.submissionType === filters.submissionType) &&
    (!filters.year || String(item.periodYear) === filters.year) &&
    (!filters.month || String(item.periodMonth ?? "").padStart(2, "0") === filters.month.padStart(2, "0")) &&
    matchesText(`${item.employeeName} ${item.title} ${item.description}`, filters.keyword)
  );
  const attendancePermissions = data.attendancePermissions.filter((item) =>
    employeeMatches(item.employeeId) &&
    (!filters.status || item.status === filters.status) &&
    matchesYearMonth(item.requestDate, filters) &&
    matchesText(`${item.employeeName} ${item.reason}`, filters.keyword)
  );
  const employeeDocuments = data.employeeDocuments.filter((item) =>
    employeeMatches(item.employeeId) &&
    (!filters.documentCategory || item.category === filters.documentCategory) &&
    matchesYearMonth(item.documentDate, filters) &&
    matchesText(`${item.employeeName} ${item.title} ${item.description} ${item.documentNumber}`, filters.keyword)
  );
  const leaveBalances = data.leaveBalances.filter((item) =>
    employeeMatches(item.employeeId) &&
    (!filters.year || String(item.year) === filters.year)
  );
  const slaItems = data.slaItems.filter((item) =>
    employeeMatches(item.employeeId) &&
    (!filters.status || item.status === filters.status) &&
    (!filters.slaStatus || filters.slaStatus === "all" || (filters.slaStatus === "overdue" ? item.overdue : !item.overdue)) &&
    matchesYearMonth(item.submittedAt, filters) &&
    matchesText(`${item.title} ${item.employeeName} ${item.status}`, filters.keyword)
  );
  const filteredLeaveIds = new Set(leaveRequests.map((item) => item.id));

  return {
    ...data,
    employees,
    leaveRequests,
    submissions,
    attendancePermissions,
    employeeDocuments,
    leaveBalances,
    slaItems,
    generatedDocuments: data.generatedDocuments.filter((item) => filteredLeaveIds.has(item.leaveRequestId)),
  };
}

function filterRows(filters: ReportFilters) {
  return Object.entries(filters)
    .filter(([, value]) => value)
    .map(([key, value]) => [key, value]);
}

function tableFor(type: string, data: DashboardData) {
  if (type === "pegawai") {
    return {
      title: "Data Pegawai",
      headers: ["Nama", "NIP", "Jabatan", "Status", "Unit", "Atasan", "Pejabat Approval", "Kontak"],
      rows: data.employees.map((item) => [
        item.fullName,
        item.nip,
        item.positionName,
        item.employmentStatusLabel,
        item.unitKerja,
        item.supervisorName ?? "-",
        item.approvalOfficerName ?? "-",
        item.phone || item.email,
      ]),
    };
  }

  if (type === "setoran") {
    return {
      title: "Rekap PCK/SKP/WFA",
      headers: ["Pegawai", "Jenis", "Judul", "Tahun", "Bulan", "Tanggal", "Status"],
      rows: data.submissions.map((item) => [
        item.employeeName,
        item.submissionType.toUpperCase(),
        item.title,
        item.periodYear,
        item.periodMonth ?? "-",
        item.submissionDate,
        item.status,
      ]),
    };
  }

  if (type === "izin") {
    return {
      title: "Rekap Izin Kehadiran",
      headers: ["Pegawai", "Jenis", "Tanggal", "Jam", "Alasan", "Status"],
      rows: data.attendancePermissions.map((item) => [
        item.employeeName,
        item.permissionType === "late_arrival" ? "Lambat Datang" : "Cepat Pulang",
        item.requestDate,
        item.requestedTime,
        item.reason,
        item.status,
      ]),
    };
  }

  if (type === "saldo") {
    return {
      title: "Rekap Saldo Cuti",
      headers: ["Pegawai", "Tahun", "N", "N-1", "N-2", "Terpakai", "Proses", "Sisa"],
      rows: data.leaveBalances.map((item) => [
        data.employees.find((employee) => employee.id === item.employeeId)?.fullName ?? "-",
        item.year,
        item.balanceN,
        item.balanceN1,
        item.balanceN2,
        item.usedDays,
        item.pendingDays,
        item.availableDays,
      ]),
    };
  }

  if (type === "dokumen") {
    return {
      title: "Rekap Dokumen Kepegawaian",
      headers: ["Pegawai", "Kategori", "Nomor", "Tanggal", "Judul", "Akses"],
      rows: data.employeeDocuments.map((item) => [
        item.employeeName,
        item.category,
        item.documentNumber,
        item.documentDate,
        item.title,
        item.visibility,
      ]),
    };
  }

  if (type === "sla") {
    return {
      title: "Dashboard SLA Approval",
      headers: ["Jenis", "Judul", "Pegawai", "Status", "Tanggal Masuk", "Hari Menunggu", "SLA", "Terlambat"],
      rows: data.slaItems.map((item) => [
        item.entityType,
        item.title,
        item.employeeName,
        item.status,
        item.submittedAt,
        item.daysWaiting,
        item.slaDays,
        item.overdue ? "Ya" : "Tidak",
      ]),
    };
  }

  return {
    title: "Rekap Cuti",
    headers: ["Pegawai", "Jenis Cuti", "Nomor", "Mulai", "Selesai", "Hari", "Status", "Alasan"],
    rows: data.leaveRequests.map((item) => [
      item.employeeName,
      item.leaveTypeName,
      item.requestNumber ?? "-",
      item.startDate,
      item.endDate,
      item.totalDays,
      item.status,
      item.reason,
    ]),
  };
}

function buildCsv(table: ReturnType<typeof tableFor>) {
  return [
    table.headers.map(csvEscape).join(";"),
    ...table.rows.map((row) => row.map(csvEscape).join(";")),
  ].join("\n");
}

function buildXlsx(table: ReturnType<typeof tableFor>, filters: ReportFilters) {
  const columns = table.headers.map((header, index) => ({
    key: `col_${index}`,
    header,
    width: Math.max(14, Math.min(34, String(header).length + 8)),
  }));
  const rows = table.rows.map((row) => Object.fromEntries(row.map((value, index) => [`col_${index}`, value])));
  const sheets: XlsxSheet[] = [
    {
      name: table.title,
      columns,
      rows,
      freezeHeader: true,
      autoFilter: true,
    },
  ];
  const activeFilters = filterRows(filters);
  if (activeFilters.length) {
    sheets.push({
      name: "Filter",
      columns: [
        { key: "filter", header: "Filter", width: 24 },
        { key: "value", header: "Nilai", width: 40 },
      ],
      rows: activeFilters.map(([filter, value]) => ({ filter, value })),
      freezeHeader: true,
      autoFilter: false,
    });
  }
  return createXlsxWorkbook(sheets, { creator: "ALETA E-Kepegawaian" });
}

async function buildPdf(table: ReturnType<typeof tableFor>) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([842, 595]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 36;
  let y = 550;

  page.drawText(table.title, { x: margin, y, size: 16, font: bold, color: rgb(0.05, 0.16, 0.24) });
  y -= 28;
  page.drawText(`Dicetak: ${new Date().toLocaleString("id-ID")}`, { x: margin, y, size: 9, font, color: rgb(0.35, 0.4, 0.45) });
  y -= 24;
  page.drawText(table.headers.join(" | ").slice(0, 140), { x: margin, y, size: 9, font: bold, color: rgb(0.05, 0.16, 0.24) });
  y -= 16;

  for (const row of table.rows) {
    if (y < 40) {
      page = pdf.addPage([842, 595]);
      y = 550;
    }
    page.drawText(row.map((item) => String(item ?? "")).join(" | ").slice(0, 170), {
      x: margin,
      y,
      size: 8,
      font,
      color: rgb(0.1, 0.14, 0.18),
    });
    y -= 14;
  }

  return Buffer.from(await pdf.save());
}

async function auditExport(
  db: Awaited<ReturnType<typeof getDatabase>>,
  actorUserId: string,
  payload: Record<string, unknown>
) {
  try {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId,
      action: "EXPORT_E_KEPEGAWAIAN_REPORT",
      entityType: "hr_report_export",
      entityId: String(payload.entityId ?? "e-kepegawaian"),
      payload,
    });
  } catch (error) {
    console.warn("[ALETA HR AUDIT] Gagal mencatat export E-Kepegawaian:", error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const data = await getEKepegawaianDashboard(db, actor);

    if (!data.permissions.canManageAll && !data.permissions.canApprove) {
      throw new ApiError(403, "Export E-Kepegawaian hanya tersedia untuk admin, atasan, atau pejabat berwenang.");
    }

    const type = request.nextUrl.searchParams.get("type") ?? "cuti";
    const format = request.nextUrl.searchParams.get("format") ?? "xlsx";
    const filters = readFilters(request);
    const filteredData = filterDashboard(data, filters);
    const table = tableFor(type, filteredData);
    const date = new Date().toISOString().slice(0, 10);
    await auditExport(db, actor.id, {
      entityId: `${type}:${format}:${date}`,
      type,
      format,
      rowCount: table.rows.length,
      filters: Object.fromEntries(filterRows(filters)),
      request: getRequestAuditMetadata(request),
    });

    if (format === "pdf") {
      const buffer = await buildPdf(table);
      return new Response(buffer, {
        headers: {
          ...getAttachmentSecurityHeaders(),
          "content-type": "application/pdf",
          "content-length": String(buffer.byteLength),
          "content-disposition": buildAttachmentContentDisposition(`e-kepegawaian-${type}-${date}.pdf`),
        },
      });
    }

    if (format === "csv") {
      const buffer = Buffer.from(buildCsv(table), "utf8");
      return new Response(buffer, {
        headers: {
          ...getAttachmentSecurityHeaders(),
          "content-type": "text/csv; charset=utf-8",
          "content-length": String(buffer.byteLength),
          "content-disposition": buildAttachmentContentDisposition(`e-kepegawaian-${type}-${date}.csv`),
        },
      });
    }

    const buffer = buildXlsx(table, filters);
    return new Response(buffer, {
      headers: {
        ...getAttachmentSecurityHeaders(),
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-length": String(buffer.byteLength),
        "content-disposition": buildAttachmentContentDisposition(`e-kepegawaian-${type}-${date}.xlsx`),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
