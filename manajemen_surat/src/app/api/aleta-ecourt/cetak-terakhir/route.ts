import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaCetakTerakhir, simpanCetakTerakhir } from "@/server/modules/aleta-ecourt/cetak-terakhir";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

/** Pemicu berdampingan dimuat saat dibutuhkan supaya jalur cetak biasa tidak memuat modul naskah. Galat apa pun ditelan. */
function picuBerdampinganDiLatar(db: Awaited<ReturnType<typeof getDatabase>>, badan: Record<string, unknown>) {
  void (async () => {
    try {
      const [{ picuBerdampingan }, { bersihkanBagian }] = await Promise.all([
        import("@/server/modules/aleta-abt-berdampingan/service"),
        import("@/server/modules/aleta-ecourt/cetak-terakhir"),
      ]);
      const bagian = bersihkanBagian(badan.bagian);
      if (!bagian || !bagian.length) return;
      await picuBerdampingan(db, {
        perkaraId: String(badan.perkaraId ?? "").trim(),
        nomorPerkara: String(badan.nomorPerkara ?? "").slice(0, 80),
        berkas: String(badan.berkas ?? ""),
        bagian,
        sidangKe: Number(badan.sidangKe) || 0,
      });
    } catch {
      /* pembandingan hanya tambahan: cetak tidak terpengaruh */
    }
  })();
}

/**
 * ============================================================================
 * CETAKAN TERAKHIR PER PERKARA (30 Okt 2026, migrasi 0120)
 * ============================================================================
 *
 *   GET ?perkaraId=&berkas=      ringkasan cetakan terakhir blangko itu pada perkara itu: { ada, dicetakPada, dicetakOleh, bagian:[{h,t}] }
 *   POST {perkaraId, nomorPerkara, berkas, bagian:[{h,t}]}   menimpa ringkasan (dipanggil ekstensi sesudah cetak berhasil)
 *
 * Yang disimpan hanya potongan paragraf (sidik + 160 huruf pertama) untuk membandingkan "N bagian berubah"; bukan dokumen. Kewenangan
 * "blangko-abt". Tidak menulis ke SIPP/ABT.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    return ok(await bacaCetakTerakhir(db, String(getSearchParam(request, "perkaraId") ?? ""), String(getSearchParam(request, "berkas") ?? "")));
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "CETAK_TERAKHIR_BACA_FAILED", feature: "aleta_ecourt", entityId: "cetak-terakhir" });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const actor = await pastikanKapabilitas(db, actorUserId, "blangko-abt");
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const hasil = await simpanCetakTerakhir(db, actor, badan);
    // 5 Nov 2026 (Tahap 7): cetak ABT terdeteksi. Pembandingan berdampingan dengan ALETA ABT TIDAK DITUNGGU (void): bawaan mati,
    // antrean pendek, dan tidak mengubah apa pun pada jawaban cetak ini. Tidak pernah melempar ke petugas.
    picuBerdampinganDiLatar(db, badan);
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "CETAK_TERAKHIR_SIMPAN_FAILED", feature: "aleta_ecourt", entityId: "cetak-terakhir" });
  }
}
