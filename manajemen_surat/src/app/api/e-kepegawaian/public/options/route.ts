import { getDatabase } from "@/server/db/client";
import { getPublicEKepegawaianOptions } from "@/server/modules/e-kepegawaian/service";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDatabase();
    const options = await getPublicEKepegawaianOptions(db);
    return ok(options, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
