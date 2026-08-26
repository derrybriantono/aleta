import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { attachEKepegawaianFile, getEKepegawaianDashboard } from "@/server/modules/e-kepegawaian/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { storeHrUploadedFile } from "@/server/shared/hr-file-storage";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isHrUploadEntity(value: unknown): value is "leave_request" | "submission" | "attendance_permission" | "employee_document" | "meeting_result" | "employee_signature" | "leave_form_template" {
  return (
    value === "leave_request" ||
    value === "submission" ||
    value === "attendance_permission" ||
    value === "employee_document" ||
    value === "meeting_result" ||
    value === "employee_signature" ||
    value === "leave_form_template"
  );
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const dashboard = await getEKepegawaianDashboard(db, actor);

    const formData = await request.formData();
    const file = formData.get("file");
    const entityType = formData.get("entityType");
    const entityId = String(formData.get("entityId") ?? "").trim();
    const signatureRole = String(formData.get("signatureRole") ?? "").trim();

    if (!(file instanceof File)) {
      throw new ApiError(400, "File dokumen wajib dikirim pada field 'file'.");
    }
    if (!isHrUploadEntity(entityType)) {
      throw new ApiError(400, "Jenis lampiran E-Kepegawaian tidak valid.");
    }
    if (!entityId) {
      throw new ApiError(400, "ID data tujuan lampiran wajib diisi.");
    }

    const storedFile = await storeHrUploadedFile(file, {
      allowedExtensions: entityType === "employee_signature" ? ["jpg", "jpeg", "png"] : entityType === "leave_form_template" ? ["pdf"] : dashboard.settings.allowedFileTypes,
      maxSizeMb: entityType === "employee_signature" ? Math.min(dashboard.settings.maxUploadSizeMb, 5) : dashboard.settings.maxUploadSizeMb,
    });
    const attachment = await attachEKepegawaianFile(db, actor, {
      entityType,
      entityId,
      fileName: storedFile.fileName,
      originalFileName: storedFile.originalFileName,
      filePath: storedFile.publicUrl,
      fileType: storedFile.fileType,
      fileSize: storedFile.fileSize,
      signatureRole,
    });

    return ok({
      ...attachment,
      fileName: storedFile.fileName,
      originalFileName: storedFile.originalFileName,
      filePath: storedFile.publicUrl,
      fileSize: storedFile.fileSize,
      uploadedAt: new Date().toISOString(),
    }, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
