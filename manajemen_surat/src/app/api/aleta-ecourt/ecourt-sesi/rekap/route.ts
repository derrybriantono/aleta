import { type NextRequest } from "next/server";

import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { kalimatAlasan, panggilBot } from "@/server/modules/aleta-ecourt/ecourt-aksi";
import {
  type AkunBot,
  type SesiBot,
  penggunaUntukRekap,
  susunRekap,
} from "@/server/modules/aleta-ecourt/ecourt-akun-pengguna";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rekap akun e-Court per pengguna (butir 20, 5 Okt 2026) - HANYA Super Admin
 * dan Admin, dan HANYA MEMBACA.
 *
 * Siapa saja hakim, panitera, panitera pengganti, dan juru sita yang sudah
 * menyimpan akun e-Court miliknya, hasil uji masuk terakhirnya, dan keadaan
 * sesinya. Sandi tidak ada di sini - bot tidak pernah mengirimnya - dan admin
 * TIDAK dapat mengubah atau menghapus akun orang lain dari rute mana pun:
 * akun e-Court seseorang hanya diurus pemiliknya sendiri (rute ecourt-sesi).
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await requireActorUser(db, actorUserId);
    if (!isPrivilegedAdmin(actor)) {
      throw new ApiError(403, "Hanya Super Admin dan Admin yang dapat melihat rekap akun e-Court pengguna.");
    }
    const [hasil, pengguna] = await Promise.all([
      panggilBot<{ akun?: AkunBot[]; sesi?: SesiBot[] }>("/ecourt-pengguna/rekap"),
      penggunaUntukRekap(db),
    ]);
    if (!hasil.ok) {
      return ok({ tersedia: false, pesan: kalimatAlasan(hasil.alasan), baris: [] });
    }
    const baris = susunRekap(pengguna, hasil.data.akun ?? [], hasil.data.sesi ?? []);
    return ok({
      tersedia: true,
      pesan: "",
      baris,
      ringkas: {
        sudah: baris.filter((b) => b.keadaan === "sudah").length,
        sebagian: baris.filter((b) => b.keadaan === "sebagian").length,
        belum: baris.filter((b) => b.keadaan === "belum").length,
      },
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "ECOURT_AKUN_PRIBADI_REKAP_FAILED",
      feature: "ecourt_sesi_pribadi",
      entityId: "rekap",
    });
  }
}
