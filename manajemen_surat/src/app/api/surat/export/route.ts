import { NextRequest, NextResponse } from "next/server";

import { getAccessibleLetters } from "@/lib/permissions";
import { type DispositionNode, type LetterDetail } from "@/lib/types";
import { getDatabase } from "@/server/db/client";
import { listDispositionsFromDb } from "@/server/modules/dispositions/service";
import { readLetterSearchFiltersFromRequest } from "@/server/modules/letters/http";
import { searchLettersInDb } from "@/server/modules/letters/service";
import { getPositionsFromDb, requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { buildAttachmentContentDisposition, getAttachmentSecurityHeaders } from "@/server/shared/download-headers";
import { assertExportRowLimit, exportOverflowLimit, EXPORT_ROW_LIMITS } from "@/server/shared/export-limits";
import { handleRouteError } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { getRequestAuditMetadata } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CSV_COLUMNS = [
  "Nomor Surat",
  "Nomor Agenda",
  "Tanggal Surat",
  "Tanggal Administratif",
  "Jenis Surat",
  "Pengirim/Tujuan",
  "Perihal",
  "Status",
  "Klasifikasi",
  "Disposisi Terakhir",
  "Deadline Disposisi",
  "Status Disposisi",
];

function csvCell(value: unknown) {
  const normalized = String(value ?? "").replace(/\r?\n/g, " ").trim();
  return `"${normalized.replace(/"/g, '""')}"`;
}

function getLatestDisposition(letter: LetterDetail, dispositions: DispositionNode[]) {
  return dispositions
    .filter((item) => item.suratId === letter.id)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0];
}

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const baseFilters = readLetterSearchFiltersFromRequest(request);
    const exportLimit = EXPORT_ROW_LIMITS.lettersCsv;
    const filters = {
      ...baseFilters,
      limit: Math.min(baseFilters.limit ?? exportOverflowLimit(exportLimit), exportOverflowLimit(exportLimit)),
    };

    const [letters, dispositions, positions] = await Promise.all([
      searchLettersInDb(db, filters),
      listDispositionsFromDb(db),
      getPositionsFromDb(db),
    ]);
    const accessibleLetters = getAccessibleLetters(actor, letters, dispositions, positions);
    assertExportRowLimit(accessibleLetters.length, exportLimit, "Export laporan surat");
    const rows = accessibleLetters.map((letter) => {
      const latestDisposition = getLatestDisposition(letter, dispositions);

      return [
        letter.nomorSurat,
        letter.nomorUrut ?? "",
        letter.tanggal,
        letter.tanggalAdministratif ?? "",
        letter.type === "masuk" ? "Surat Masuk" : "Surat Keluar",
        letter.type === "masuk" ? letter.pengirim : letter.tujuanSurat,
        letter.perihal,
        letter.status,
        letter.klasifikasi,
        latestDisposition?.instruksi ?? "",
        latestDisposition?.deadlineAt ?? "",
        latestDisposition?.status ?? "",
      ];
    });
    const csv = [CSV_COLUMNS, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId: actor.id,
      action: "EXPORT_LETTERS_CSV",
      entityType: "letters",
      entityId: "bulk",
      payload: {
        rowCount: rows.length,
        filters,
        ...getRequestAuditMetadata(request),
      },
    });

    return new NextResponse(csv, {
      headers: {
        ...getAttachmentSecurityHeaders(),
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": buildAttachmentContentDisposition(`laporan-surat-${new Date().toISOString().slice(0, 10)}.csv`),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
