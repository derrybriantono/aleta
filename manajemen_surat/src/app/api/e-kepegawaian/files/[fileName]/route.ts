import { readFile } from "node:fs/promises";
import path from "node:path";
import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { getEKepegawaianDashboard } from "@/server/modules/e-kepegawaian/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { appendAuditLog } from "@/server/shared/audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { buildAttachmentContentDisposition, getAttachmentSecurityHeaders, getInlineFileSecurityHeaders } from "@/server/shared/download-headers";
import { ApiError } from "@/server/shared/errors";
import { findStoredHrFile, sanitizeHrDownloadFileName } from "@/server/shared/hr-file-storage";
import { handleRouteError } from "@/server/shared/http";
import { nextPrefixedId } from "@/server/shared/ids";
import { getRequestAuditMetadata } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FileAccessRow = {
  entity_type: string;
  entity_id: string;
  employee_id: string | null;
  original_file_name: string | null;
  file_type: string | null;
};

function contentTypeFor(fileName: string, storedType?: string | null) {
  if (storedType?.includes("/")) return storedType;
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".doc") return "application/msword";
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".xls") return "application/vnd.ms-excel";
  if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  return "application/octet-stream";
}

async function auditFileAccess(
  db: Awaited<ReturnType<typeof getDatabase>>,
  actorUserId: string,
  payload: Record<string, unknown>
) {
  try {
    await appendAuditLog(db, {
      id: await nextPrefixedId(db, "audit_logs", "adt"),
      actorUserId,
      action: "DOWNLOAD_E_KEPEGAWAIAN_FILE",
      entityType: String(payload.entityType ?? "hr_file"),
      entityId: String(payload.entityId ?? "unknown"),
      payload,
    });
  } catch (error) {
    console.warn("[ALETA HR AUDIT] Gagal mencatat akses lampiran E-Kepegawaian:", error);
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fileName: string }> }
) {
  try {
    const { fileName } = await context.params;
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const dashboard = await getEKepegawaianDashboard(db, actor);
    const publicPath = `/uploads/hr/${fileName}`;

    const rows = await db.prepare(
      `SELECT 'leave_request' AS entity_type, hla.leave_request_id AS entity_id, lr.employee_id,
        hla.original_file_name, hla.file_type
       FROM hr_leave_attachments hla
       JOIN hr_leave_requests lr ON lr.id = hla.leave_request_id
       WHERE hla.file_name = ? OR hla.file_path = ?
       UNION ALL
       SELECT 'submission' AS entity_type, hsa.submission_id AS entity_id, hs.employee_id,
        hsa.original_file_name, hsa.file_type
       FROM hr_submission_attachments hsa
       JOIN hr_submissions hs ON hs.id = hsa.submission_id
       WHERE hsa.file_name = ? OR hsa.file_path = ?
       UNION ALL
       SELECT 'attendance_permission' AS entity_type, haa.attendance_permission_id AS entity_id, hp.employee_id,
        haa.original_file_name, haa.file_type
       FROM hr_attendance_permission_attachments haa
       JOIN hr_attendance_permissions hp ON hp.id = haa.attendance_permission_id
       WHERE haa.file_name = ? OR haa.file_path = ?
       UNION ALL
       SELECT 'employee_document' AS entity_type, ed.id AS entity_id, ed.employee_id,
        ed.file_name AS original_file_name, ed.file_type
       FROM hr_employee_documents ed
       WHERE ed.file_name = ? OR ed.file_path = ?
       UNION ALL
       SELECT 'meeting_result' AS entity_type, mr.id AS entity_id, NULL AS employee_id,
        mr.title AS original_file_name, 'application/octet-stream' AS file_type
       FROM hr_meeting_results mr
       WHERE mr.document_path = ?
       UNION ALL
       SELECT 'employee_signature' AS entity_type, sig.employee_id AS entity_id, sig.employee_id,
        sig.original_file_name, sig.file_type
       FROM hr_employee_signatures sig
       WHERE sig.file_name = ? OR sig.file_path = ?
       UNION ALL
       SELECT 'generated_leave_document' AS entity_type, doc.leave_request_id AS entity_id, lr.employee_id,
        doc.file_name AS original_file_name, doc.file_type
       FROM hr_generated_documents doc
       JOIN hr_leave_requests lr ON lr.id = doc.leave_request_id
       WHERE doc.file_name = ? OR doc.file_path = ?
       UNION ALL
       SELECT 'leave_form_template' AS entity_type, 'global' AS entity_id, NULL AS employee_id,
        COALESCE(original.value, template.value) AS original_file_name, 'application/pdf' AS file_type
       FROM hr_settings template
       LEFT JOIN hr_settings original ON original.key = 'leave_form_template_original_name'
       WHERE template.key = 'leave_form_template_file_name'
        AND (template.value = ? OR ('/uploads/hr/' || template.value) = ?)`,
    ).all<FileAccessRow>(
      fileName, publicPath,
      fileName, publicPath,
      fileName, publicPath,
      fileName, publicPath,
      publicPath,
      fileName, publicPath,
      fileName, publicPath,
      fileName, publicPath
    );

    const match = rows[0];
    if (!match) {
      throw new ApiError(404, "Lampiran E-Kepegawaian tidak ditemukan atau belum tercatat.");
    }

    if (match.entity_type === "leave_form_template" && !dashboard.permissions.canManageSettings) {
      throw new ApiError(403, "Hanya Admin/Super Admin yang dapat membuka template formulir cuti.");
    }

    if (match.employee_id && !dashboard.employees.some((employee) => employee.id === match.employee_id)) {
      throw new ApiError(403, "Anda tidak memiliki akses ke lampiran pegawai tersebut.");
    }

    if (!match.employee_id && !dashboard.permissions.canManageAll && !dashboard.permissions.canApprove) {
      throw new ApiError(403, "Anda tidak memiliki akses ke lampiran hasil rapat tersebut.");
    }

    const storedFile = await findStoredHrFile(fileName);
    const buffer = await readFile(storedFile.absolutePath);
    const disposition = new URL(request.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment";
    const downloadName = sanitizeHrDownloadFileName(match.original_file_name || fileName);
    await auditFileAccess(db, actor.id, {
      entityType: `hr_${match.entity_type}`,
      entityId: match.entity_id,
      employeeId: match.employee_id,
      fileName,
      downloadName,
      disposition,
      request: getRequestAuditMetadata(request),
    });

    return new Response(buffer, {
      headers: {
        ...(disposition === "inline" ? getInlineFileSecurityHeaders() : getAttachmentSecurityHeaders()),
        "content-length": String(buffer.byteLength),
        "content-type": contentTypeFor(fileName, match.file_type),
        "content-disposition": disposition === "inline" ? `inline; filename="${downloadName}"` : buildAttachmentContentDisposition(downloadName),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
