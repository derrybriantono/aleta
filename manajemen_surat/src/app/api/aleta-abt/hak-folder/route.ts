import { type NextRequest } from "next/server";

import { bacaKeadaanHakFolder, bacaSinkronTerakhir, simpanPersetujuan } from "@/server/modules/aleta-abt-alur/hak-folder";
import { aktorSuperAdminAlur, bacaBadanJson, catatAlur, type Db } from "@/server/modules/aleta-abt-alur/penjaga";
import { mulaiSinkron } from "@/server/modules/aleta-abt-pustaka/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Matriks hak per folder blangko ALETA ABT (5 Nov 2026, Tahap 6). HANYA Super Admin, diputuskan di server.
 *
 *   GET                                      matriks (per folder, per golongan peran), folder yang ragu, keadaan persetujuan        [audit]
 *   POST {tindakan:"cocokkan"}               mencocokkan ulang acuan dengan ABT (sinkron pustaka yang sudah ada, di latar)       [audit]
 *   POST {tindakan:"setuju", setuju, sidik}  menyetujui matriks yang dilihat (sidik harus sama) atau mencabut persetujuan           [audit]
 *
 * Matriks BELUM BERLAKU sebelum disetujui (bawaan: belum). Persetujuan terikat pada sidik isi matriks; bila pustaka berubah, persetujuan
 * lama gugur. Yang dibaca hanya pustaka ALETA (aleta_abt_menu, aleta_abt_berkas). Tidak ada tulisan ke ABT/SIPP. Blangko ABT by Derry
 * Briantono yang dipakai petugas tidak berubah.
 */
const PESAN = "Hak folder ALETA ABT hanya untuk Super Admin.";

export async function GET(request: NextRequest) {
  let db: Db | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorSuperAdminAlur(request, PESAN);
    db = a.db;
    actorUserId = a.actorUserId;
    const { matriks, persetujuan, berlaku, saklar } = await bacaKeadaanHakFolder(a.db);
    await catatAlur(a.db, a.actorUserId, "ALETA_ABT_HAK_FOLDER_BUKA", "matriks", { folder: matriks.jumlahFolder, ragu: matriks.jumlahRagu, sidik: matriks.sidik, berlaku });
    return ok({ matriks, persetujuan, berlaku, saklar, sinkron: await bacaSinkronTerakhir(a.db) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "ALETA_ABT_HAK_FOLDER_READ_FAILED", feature: "aleta_abt", entityId: "aleta-abt-hak-folder" });
  }
}

export async function POST(request: NextRequest) {
  let db: Db | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorSuperAdminAlur(request, PESAN);
    db = a.db;
    actorUserId = a.actorUserId;
    const badan = await bacaBadanJson(request);
    if (String(badan.tindakan ?? "") === "cocokkan") {
      // Mencocokkan ulang acuan dengan ABT di server: memakai sinkron pustaka yang sudah ada (ABT hanya dibaca, jalan di latar).
      const h = await mulaiSinkron(a.db, a.aktor.name || a.aktor.id);
      await catatAlur(a.db, a.actorUserId, "ALETA_ABT_HAK_FOLDER_COCOKKAN", "matriks", { mulai: h.mulai });
      return ok({ mulai: h.mulai }, { headers: { "Cache-Control": "no-store" } });
    }
    if (String(badan.tindakan ?? "") !== "setuju") throw new ApiError(400, "Tindakan tidak dikenal.");
    if (typeof badan.setuju !== "boolean") throw new ApiError(400, "Pilih menyetujui atau mencabut persetujuan.");
    const sidik = String(badan.sidik ?? "");
    const hasil = await simpanPersetujuan(a.db, a.aktor, { setuju: badan.setuju, sidik });
    await catatAlur(a.db, a.actorUserId, badan.setuju ? "ALETA_ABT_HAK_FOLDER_SETUJU" : "ALETA_ABT_HAK_FOLDER_CABUT", "matriks", { sidik: hasil.sidik || sidik, disetujui: hasil.disetujui });
    return ok(hasil, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "ALETA_ABT_HAK_FOLDER_WRITE_FAILED", feature: "aleta_abt", entityId: "aleta-abt-hak-folder" });
  }
}
