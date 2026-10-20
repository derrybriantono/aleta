import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanBolehUnggahPutusan } from "@/server/modules/aleta-ecourt/hak-putusan";
import { pratinjauJadwal, type MasukanJamKerja } from "@/server/modules/putusan-terjadwal/layanan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pratinjau urutan dan perkiraan jam tiap perkara.
 *
 *   POST { jumlah, mulai, batasAkhir?, jedaMin?, jedaMaks?, jamDari?, jamSampai?, malamBoleh?, lintasHari?, benih? }
 *   -> { ok, butir: [{ urut, iso, wita }], tidakMuat, peringatan[], sebab?, benih }
 *
 * Hanya MENGHITUNG (jam kerja satker, istirahat, hari libur, jeda acak); tidak
 * menulis apa pun. `benih` yang dikembalikan dikirim lagi saat menjadwalkan
 * supaya jam sesungguhnya SAMA dengan yang dilihat di pratinjau.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanBolehUnggahPutusan(db, actorUserId);
    const badan = await readJsonBody<Partial<MasukanJamKerja> & { jumlah?: number; benih?: number }>(request);
    const hasil = await pratinjauJadwal(db, {
      jumlah: Number(badan.jumlah) || 0,
      mulai: String(badan.mulai ?? ""),
      batasAkhir: badan.batasAkhir ? String(badan.batasAkhir) : undefined,
      jedaMin: badan.jedaMin,
      jedaMaks: badan.jedaMaks,
      jamDari: badan.jamDari,
      jamSampai: badan.jamSampai,
      malamBoleh: badan.malamBoleh === true,
      lintasHari: badan.lintasHari === true,
      benih: badan.benih,
    });
    return ok({
      ok: hasil.ok,
      sebab: hasil.sebab ?? "",
      benih: hasil.benih,
      tidakMuat: hasil.tidakMuat,
      jedaMin: hasil.jedaMinDetik,
      jedaMaks: hasil.jedaMaksDetik,
      peringatan: hasil.peringatan,
      butir: hasil.butir.map((b) => ({ urut: b.urut, iso: b.iso, wita: b.wita.slice(0, 16) })),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_TERJADWAL_PRATINJAU_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-terjadwal-pratinjau",
    });
  }
}
