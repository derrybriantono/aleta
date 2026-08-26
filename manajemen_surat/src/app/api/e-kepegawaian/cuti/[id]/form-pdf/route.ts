import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { buildLeaveFormPdf, buildLeaveFormPdfFileName } from "@/server/modules/e-kepegawaian/leave-form-pdf";
import { getLeaveRequestFormData, recordGeneratedLeaveDocument } from "@/server/modules/e-kepegawaian/service";
import { requireActorUser } from "@/server/modules/organization/service";
import { getInstitutionIdentityFromDb } from "@/server/modules/settings/service";
import { buildAttachmentContentDisposition, getAttachmentSecurityHeaders, getInlineFileSecurityHeaders } from "@/server/shared/download-headers";
import { handleRouteError } from "@/server/shared/http";
import { resolveActorUserId } from "@/server/shared/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildVerificationUrl(request: NextRequest, code: string) {
  const url = new URL(request.url);
  url.searchParams.set("verify", code);
  url.searchParams.set("disposition", "inline");
  return url.toString();
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const [formData, identity] = await Promise.all([
      getLeaveRequestFormData(db, actor, id),
      getInstitutionIdentityFromDb(db),
    ]);
    const initialCode = `CUTI-${formData.request.id.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    const { buffer, verificationCode } = await buildLeaveFormPdf(formData, identity, {
      templateFileName: formData.settings?.leaveFormTemplateFileName,
      verificationCode: initialCode,
      verificationUrl: buildVerificationUrl(request, initialCode),
    });
    const fileName = buildLeaveFormPdfFileName(formData.request);
    const disposition = new URL(request.url).searchParams.get("disposition") === "inline" ? "inline" : "attachment";

    await recordGeneratedLeaveDocument(db, actor, id, {
      fileName,
      fileSize: buffer.byteLength,
      verificationCode,
    });

    return new Response(buffer, {
      headers: {
        ...(disposition === "inline" ? getInlineFileSecurityHeaders() : getAttachmentSecurityHeaders()),
        "content-type": "application/pdf",
        "content-length": String(buffer.byteLength),
        "content-disposition": disposition === "inline" ? `inline; filename="${fileName}"` : buildAttachmentContentDisposition(fileName),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
