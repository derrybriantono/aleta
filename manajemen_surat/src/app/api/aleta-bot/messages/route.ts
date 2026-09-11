import { type NextRequest, NextResponse } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  bacaParameterRiwayat,
  bacaRiwayatPesan,
  LABEL_URUT,
} from "@/server/modules/aleta-bot/riwayat-pesan";
import { getUserByIdFromDb } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { buildAttachmentContentDisposition, getAttachmentSecurityHeaders } from "@/server/shared/download-headers";
import { assertExportRowLimit, exportOverflowLimit, EXPORT_ROW_LIMITS } from "@/server/shared/export-limits";
import { handleRouteError, ok, unauthorized } from "@/server/shared/http";
import { createXlsxWorkbook, type XlsxSheet } from "@/server/shared/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Riwayat pengiriman pesan ALETA Bot.
 *
 * Satu rute, tiga bentuk: JSON untuk layar (berhalaman), Excel/CSV untuk
 * unduhan, dan mode "laporan" - JSON yang lebih lapang batasnya untuk lembar
 * cetak. Ketiganya lewat penyaring dan pengurut yang sama di
 * modules/aleta-bot/riwayat-pesan.ts, sehingga yang dicetak selalu sama
 * dengan yang tampil.
 */

/** Batas baris lembar cetak. Laporan bulanan satu satker jauh di bawah ini. */
const BATAS_LAPORAN = 2000;

function csvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

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
    const exportXlsx = searchParams.get("format") === "xlsx";
    const modeLaporan = searchParams.get("mode") === "laporan";
    const isExport = exportCsv || exportXlsx;
    const exportLimit = EXPORT_ROW_LIMITS.aletaBotMessagesCsv;
    const limit = isExport
      ? exportOverflowLimit(exportLimit)
      : Math.max(1, Math.min(modeLaporan ? BATAS_LAPORAN : 100, Number(searchParams.get("limit") ?? 50)));
    const offset = Math.max(0, Number(searchParams.get("offset") ?? 0));

    const parameter = bacaParameterRiwayat(searchParams);
    const hasil = await bacaRiwayatPesan(db, parameter, { isPrivileged, limit, offset });
    const { items, total, ringkasan, keterangan } = hasil;

    if (isExport) {
      assertExportRowLimit(items.length, exportLimit, "Export riwayat pesan ALETA Bot");
    }

    if (exportXlsx) {
      const statusCounts = new Map<string, number>();
      for (const item of items) {
        statusCounts.set(item.statusLabel, (statusCounts.get(item.statusLabel) ?? 0) + 1);
      }
      const summarySheet: XlsxSheet = {
        name: "Ringkasan",
        freezeHeader: true,
        autoFilter: false,
        columns: [
          { key: "metric", header: "Data", width: 30 },
          { key: "value", header: "Nilai", width: 60 },
        ],
        rows: [
          { metric: "Dibuat pada", value: new Date().toISOString() },
          ...keterangan.map((baris) => ({ metric: "Penyaring", value: baris })),
          { metric: "Urutan", value: `${LABEL_URUT[parameter.urut]} (${parameter.arah === "asc" ? "naik" : "turun"})` },
          { metric: "Total baris", value: items.length },
          { metric: "Total sesuai saringan", value: total },
          ...[...statusCounts.entries()].map(([label, count]) => ({ metric: `Status: ${label}`, value: count })),
          ...(isPrivileged
            ? []
            : [{ metric: "Catatan", value: "Nomor WhatsApp disamarkan sesuai hak akses akun Anda." }]),
        ],
      };
      const rowsSheet: XlsxSheet = {
        name: "Riwayat Pengiriman",
        freezeHeader: true,
        autoFilter: true,
        columns: [
          { key: "createdAt", header: "Waktu Diproses", width: 22 },
          { key: "sentAt", header: "Waktu Terkirim", width: 22 },
          { key: "recipientName", header: "Nama Penerima", width: 28 },
          { key: "recipientNumber", header: "Nomor WhatsApp", width: 18 },
          { key: "penerima", header: "Penerima", width: 12 },
          { key: "caseOrPosition", header: "Nomor Perkara/Jabatan", width: 26 },
          { key: "statusLabel", header: "Status", width: 16 },
          { key: "sourceFeatureLabel", header: "Sumber/Fitur", width: 22 },
          { key: "notificationKey", header: "Kunci Pesan", width: 26 },
          { key: "sourceApp", header: "Aplikasi", width: 18 },
          { key: "messagePreview", header: "Isi Pesan", width: 70 },
          { key: "errorMessage", header: "Keterangan", width: 40 },
        ],
        rows: items.map((item) => ({
          createdAt: item.createdAt,
          sentAt: item.sentAt ?? "",
          recipientName: item.recipientName,
          recipientNumber: item.recipientNumber,
          penerima: item.penerima === "pegawai" ? "Pegawai" : item.penerima === "pihak" ? "Pihak" : "",
          caseOrPosition: item.caseOrPosition,
          statusLabel: item.statusLabel,
          sourceFeatureLabel: item.sourceFeatureLabel,
          notificationKey: item.notificationKey ?? "",
          sourceApp: item.sourceApp,
          messagePreview: item.messageBody ?? item.messagePreview,
          errorMessage: item.errorMessage ?? "",
        })),
      };
      const buffer = createXlsxWorkbook([summarySheet, rowsSheet], {
        creator: "ALETA Bot",
        createdAt: new Date(),
      });
      const filename = `riwayat-pengiriman-aleta-bot-${new Date().toISOString().slice(0, 10)}.xlsx`;
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          ...getAttachmentSecurityHeaders(),
          "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": buildAttachmentContentDisposition(filename),
          "x-aleta-export-row-count": String(items.length),
        },
      });
    }

    if (exportCsv) {
      const headers = [
        "Waktu",
        "Waktu terkirim",
        "Nama penerima",
        "Nomor",
        "Penerima",
        "Nomor perkara/jabatan",
        "Status",
        "Sumber fitur",
        "Kunci pesan",
        "Isi pesan",
        "Keterangan",
      ];
      const lines = [
        headers.map(csvEscape).join(","),
        ...items.map((item) =>
          [
            item.createdAt,
            item.sentAt ?? "",
            item.recipientName,
            item.recipientNumber,
            item.penerima === "pegawai" ? "Pegawai" : item.penerima === "pihak" ? "Pihak" : "",
            item.caseOrPosition,
            item.statusLabel,
            item.sourceFeatureLabel,
            item.notificationKey ?? "",
            item.messageBody ?? item.messagePreview,
            item.errorMessage ?? "",
          ]
            .map(csvEscape)
            .join(",")
        ),
      ];
      return new NextResponse(lines.join("\r\n"), {
        headers: {
          ...getAttachmentSecurityHeaders(),
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": buildAttachmentContentDisposition("riwayat-pesan-aleta-bot.csv"),
        },
      });
    }

    return ok({
      items,
      total,
      limit,
      offset,
      ringkasan,
      keterangan,
      urutan: { kolom: parameter.urut, arah: parameter.arah, label: LABEL_URUT[parameter.urut] },
      filters: {
        sourceFeature: parameter.sourceFeature || null,
        sourceApp: parameter.sourceApp || null,
        entityType: parameter.entityType || null,
        entityId: parameter.entityId || null,
        entityFilterApplied: Boolean(parameter.entityId),
        entityFilterFallback: Boolean(parameter.entityId && total === 0 && parameter.sourceFeature),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
