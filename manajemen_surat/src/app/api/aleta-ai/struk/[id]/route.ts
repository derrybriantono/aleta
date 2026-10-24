import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAiBerhak } from "@/server/modules/aleta-ai/akses";
import { strukGiliran, strukMutasi } from "@/server/modules/aleta-ai/dompet";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - GET /api/aleta-ai/struk/[id]: struk HTML siap cetak (PDF lewat dialog cetak). Hanya milik sendiri.
 * id = pesan giliran (aip-...) atau mutasi saldo (aim-...: isi, kuota, kuota hangus, koreksi admin).
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAiBerhak(db, await resolveActorUserId(request), "aleta-ai.dompet");
    const { id } = await params;
    const html = id.startsWith("aim-") ? await strukMutasi(db, pelaku, id) : await strukGiliran(db, pelaku, id);
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
