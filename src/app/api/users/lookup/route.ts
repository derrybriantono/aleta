import { NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { lookupUserForLoginInDb } from "@/server/modules/users/service";
import { handleRouteError, notFound, ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const identifier = getSearchParam(request, "identifier");
    const username = getSearchParam(request, "username");
    const nip = getSearchParam(request, "nip");
    const db = await getDatabase();
    const user = await lookupUserForLoginInDb(db, {
      identifier,
      username,
      nip,
    });

    if (!user) {
      notFound("Akun backend tidak ditemukan atau sudah nonaktif.");
    }

    return ok({
      user,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
