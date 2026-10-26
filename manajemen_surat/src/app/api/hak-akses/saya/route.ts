import { type NextRequest } from "next/server";

import { FITUR_BLANGKO_SAYA_SEMUA_PERAN, FITUR_LIHAT_SEBAGAI } from "@/lib/fitur-satker";
import { LABEL_GOLONGAN, golonganPengguna } from "@/lib/matriks-peran";
import { getEffectiveRoleId } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import { requireActorUser } from "@/server/modules/organization/service";
import { fiturMenyala } from "@/server/modules/satker/fitur";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hak PEMANGGIL sendiri yang bergantung pada saklar satker, supaya menu portal tidak menampilkan
 * apa yang pasti ditolak server (18 Okt 2026).
 *
 *   GET -> { golongan[], blangkoSayaTerbuka, lihatSebagaiAktif }
 *
 * blangkoSayaTerbuka: Super Admin selalu; peran lain hanya bila saklar Fitur Satker
 * "Blangko Saya untuk semua peran" menyala (tahap awal: mati). Saklar tak terbaca = tertutup,
 * sama dengan server (pastikanBolehBlangkoSendiri).
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    const superAdmin = String(getEffectiveRoleId(actor) ?? actor.roleId ?? "") === "super-admin";
    let saklar = false;
    if (!superAdmin) {
      try {
        saklar = await fiturMenyala(db, FITUR_BLANGKO_SAYA_SEMUA_PERAN);
      } catch {
        saklar = false;
      }
    }
    // Lihat Sebagai (E4): saklar Fitur Satker, mati bawaan; gagal baca = mati (sama dengan server).
    let lihatSebagaiAktif = false;
    try {
      lihatSebagaiAktif = await fiturMenyala(db, FITUR_LIHAT_SEBAGAI);
    } catch {
      lihatSebagaiAktif = false;
    }
    return ok({
      lihatSebagaiAktif,
      golongan: golonganPengguna(actor).map((kode) => ({ kode, label: LABEL_GOLONGAN[kode] })),
      blangkoSayaTerbuka: superAdmin || saklar,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
