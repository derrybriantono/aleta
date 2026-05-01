import { NextRequest, NextResponse } from "next/server";

import { getAccessibleLetters } from "@/lib/permissions";
import { type DispositionNode, type LetterDetail } from "@/lib/types";
import { getDatabase } from "@/server/db/client";
import { listDispositionsFromDb } from "@/server/modules/dispositions/service";
import { readLetterSearchFiltersFromRequest } from "@/server/modules/letters/http";
import { searchLettersInDb } from "@/server/modules/letters/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError } from "@/server/shared/http";

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
    const filters = {
      ...baseFilters,
      limit: Math.min(baseFilters.limit ?? 1000, 1000),
    };

    const [letters, dispositions] = await Promise.all([
      searchLettersInDb(db, filters),
      listDispositionsFromDb(db),
    ]);
    const accessibleLetters = getAccessibleLetters(actor, letters, dispositions);
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

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="laporan-surat-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
