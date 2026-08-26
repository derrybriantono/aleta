import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { performEKepegawaianAction } from "@/server/modules/e-kepegawaian/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";
import { readXlsxRows, rowsToDelimitedText } from "@/server/shared/xlsx-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extensionOf(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "File Excel/CSV pegawai wajib dikirim.");
    }

    const extension = extensionOf(file.name);
    if (!["xlsx", "csv", "txt"].includes(extension)) {
      throw new ApiError(400, "Format import pegawai harus .xlsx, .csv, atau .txt. File .xls lama belum didukung.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = extension === "xlsx"
      ? rowsToDelimitedText(readXlsxRows(buffer, { maxRows: 5000, maxColumns: 40 }))
      : buffer.toString("utf8").replace(/^\uFEFF/, "");

    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const result = await performEKepegawaianAction(db, actor, "import-employee-profiles", {
      text,
      source: extension,
      fileName: file.name,
    });

    return ok(result, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
