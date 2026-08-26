import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { verifyEStatusDocumentToken } from "@/server/modules/e-status/estatus-service";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const db = await getDatabase();
    return ok(await verifyEStatusDocumentToken(db, token));
  } catch (error) {
    return handleRouteError(error);
  }
}
