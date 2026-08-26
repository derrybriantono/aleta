import QRCode from "qrcode";
import { NextRequest } from "next/server";

import { JLF_PERMISSION } from "@/lib/judicia-legal-form-types";
import { withBasePath } from "@/lib/base-path";
import { getDatabase } from "@/server/db/client";
import { logAction } from "@/server/modules/judicia/legal-form/jlf-audit-log-service";
import { requireJlfPermission } from "@/server/modules/judicia/legal-form/jlf-permission-service";
import { normalizeSafeSearchQuery } from "@/server/modules/judicia/legal-form/jlf-validation";
import { maskNomorPerkara } from "@/server/modules/judicia/legal-form/verification/jlf-qr-code-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";
import { getRequestAuditMetadata, getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const nomorPerkara = normalizeSafeSearchQuery(getSearchParam(request, "nomorPerkara") ?? "", "Nomor perkara", 3);
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    requireJlfPermission(actor, JLF_PERMISSION.CASE_VIEW);

    const url = new URL(request.url);
    const caseUrl = `${url.origin}${withBasePath(`/judicia/legal-form/cases/${encodeURIComponent(nomorPerkara)}`)}`;
    const payload = {
      type: "jlf_case_link",
      nomor_perkara_masked: maskNomorPerkara(nomorPerkara),
      url: caseUrl,
      requires_login: true,
    };
    const dataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
      margin: 1,
      width: 240,
      errorCorrectionLevel: "M",
    });

    const audit = getRequestAuditMetadata(request);
    await logAction(db, {
      userId: actor.id,
      action: "case.qr.generate",
      entityType: "jlf_sipp_case",
      nomorPerkara,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
      metadata: { masked: payload.nomor_perkara_masked, requiresLogin: true },
    });

    return ok({
      dataUrl,
      payload,
      maskedNomorPerkara: payload.nomor_perkara_masked,
      publicData: "minimal",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
