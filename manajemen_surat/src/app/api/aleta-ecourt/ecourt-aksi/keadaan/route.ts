import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { bersihkanNomor, kalimatAlasan, panggilBot } from "@/server/modules/aleta-ecourt/ecourt-aksi";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Keadaan putusan e-Court untuk BANYAK perkara sekaligus (lencana E11):
 * ?nomor=a&nomor=b ... (paling banyak 300). Dibaca dari catatan penarikan
 * terakhir; tidak menyentuh e-Court.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);
    const nomor = [
      ...new Set(
        request.nextUrl.searchParams
          .getAll("nomor")
          .flatMap((x) => x.split("|"))
          .map(bersihkanNomor)
          .filter(Boolean)
      ),
    ].slice(0, 300);
    if (!nomor.length) return ok({ tersedia: true, keadaan: {} });
    const q = new URLSearchParams();
    for (const n of nomor) q.append("nomor", n);
    const hasil = await panggilBot<{ ok: boolean; keadaan?: Record<string, unknown>; alasan?: string }>(
      `/ecourt-aksi/keadaan-putusan?${q.toString()}`,
      { batasMs: 20_000 }
    );
    if (!hasil.ok) return ok({ tersedia: false, pesan: kalimatAlasan(hasil.alasan), keadaan: {} });
    return ok({ tersedia: hasil.data.ok !== false, pesan: kalimatAlasan(hasil.data.alasan), keadaan: hasil.data.keadaan ?? {} });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_AKSI_KEADAAN_READ_FAILED",
      feature: "ecourt_aksi",
      entityId: "keadaan",
    });
  }
}
