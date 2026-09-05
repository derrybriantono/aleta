import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { rakitBerkasPerkara } from "@/server/modules/aleta-ecourt/berkas-perkara";
import { bandingkanRiwayat, catatRiwayat, riwayatPerkara } from "@/server/modules/aleta-ecourt/berkas-riwayat";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { getSearchParam } from "@/server/shared/request";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Riwayat keadaan berkas perkara.
 *
 *   GET ?perkaraId=10102          riwayat perubahan, terbaru lebih dulu
 *   POST {perkaraId}              rakit ulang dan catat bila berubah
 *
 * ============================================================================
 * TIAP BARIS MEMBAWA APA YANG BERUBAH
 * ============================================================================
 *
 * Daftar tanggal yang harus dibandingkan sendiri oleh pembacanya sama saja
 * dengan tidak ada riwayat. Tiap baris disertai perbandingan terhadap baris
 * sesudahnya - "saksi tercatat 0 menjadi 2" - sehingga yang membacanya melihat
 * perubahannya, bukan keadaannya.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const perkaraId = String(getSearchParam(request, "perkaraId") ?? "").trim();
    if (!perkaraId) return ok({ ada: false, sebab: "Perkara tidak dikenali.", riwayat: [] });

    const baris = await riwayatPerkara(db, perkaraId);

    // Dibandingkan dengan baris SESUDAHNYA - daftarnya terbaru lebih dulu, jadi
    // yang sesudahnya adalah yang lebih lama.
    const riwayat = baris.map((item, urutan) => ({
      ...item,
      perubahan: urutan + 1 < baris.length ? bandingkanRiwayat(baris[urutan + 1].ringkasan, item.ringkasan) : [],
      awal: urutan + 1 >= baris.length,
    }));

    return ok({ ada: riwayat.length > 0, jumlah: riwayat.length, riwayat });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BERKAS_RIWAYAT_BACA_FAILED",
      feature: "aleta_ecourt",
      entityId: "berkas-riwayat",
    });
  }
}

/**
 * Menyegarkan satu perkara dan mencatat keadaannya bila berubah.
 *
 * Inilah yang dipanggil penjadwal untuk penyegaran berkala. Ia sengaja
 * menerima SATU perkara: penyegaran seluruh perkara sekaligus akan menahan
 * jembatan bot selama menit-menit dan membuat panitera yang sedang membuka
 * perkara menunggu tanpa tahu sebabnya.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const masukan = (await request.json()) as { perkaraId?: string };
    const perkaraId = String(masukan?.perkaraId ?? "").trim();
    if (!perkaraId) return ok({ ok: false, sebab: "Perkara tidak dikenali." });

    const berkas = await rakitBerkasPerkara(perkaraId);
    const baris = await catatRiwayat(db, berkas, String(actorUserId ?? ""));

    return ok({
      ok: true,
      berubah: Boolean(baris),
      dirakitPada: berkas.dirakitPada,
      halangan: berkas.halangan,
      baris,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "BERKAS_RIWAYAT_SEGARKAN_FAILED",
      feature: "aleta_ecourt",
      entityId: "berkas-riwayat",
    });
  }
}
