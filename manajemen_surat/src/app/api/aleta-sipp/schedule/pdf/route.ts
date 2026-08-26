import { NextRequest, NextResponse } from "next/server";

import { getDatabase } from "@/server/db/client";
import { AletaSippService } from "@/server/modules/aleta-sipp/aleta-sipp-service";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const tanggalSidang = request.nextUrl.searchParams.get("tanggal_sidang") ?? undefined;
    const ruangan = request.nextUrl.searchParams.get("ruangan") ?? undefined;
    const pdf = await AletaSippService.createAletaSippSchedulePdf(actor, { tanggalSidang, ruangan });

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="aleta-x-sipp-jadwal-${tanggalSidang ?? "preview"}.pdf"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
