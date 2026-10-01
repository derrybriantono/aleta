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
 * Ringkasan e-Court satu perkara untuk EcourtAksiPerkara (kontrak K5):
 * dokumen e-litigasi + keadaan putusan e-Court + sesi pribadi pengguna ini.
 * HANYA MEMBACA - tidak menyentuh e-Court sama sekali.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    const nomor = bersihkanNomor(request.nextUrl.searchParams.get("nomor"));
    if (!nomor) return ok({ tersedia: false, pesan: "Nomor perkara kosong.", ringkasan: null });
    const tanggal = String(request.nextUrl.searchParams.get("tanggalSidang") || "").slice(0, 10);
    const q = new URLSearchParams({ nomor, penggunaId: actor.id, nama: actor.name, tanggalSidang: tanggal });
    const hasil = await panggilBot<Record<string, unknown>>(`/ecourt-aksi/perkara?${q.toString()}`, { batasMs: 20_000 });
    if (!hasil.ok) return ok({ tersedia: false, pesan: kalimatAlasan(hasil.alasan), alasan: hasil.alasan, ringkasan: null });
    return ok({ tersedia: true, pesan: "", ringkasan: hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_AKSI_PERKARA_READ_FAILED",
      feature: "ecourt_aksi",
      entityId: "perkara",
    });
  }
}
