import { type NextRequest } from "next/server";

import { PERAN_ALUR, peranAlurDari } from "@/lib/aleta-abt-siap";
import { aktorSuperAdminAlur, bacaBadanJson, catatAlur, type Db } from "@/server/modules/aleta-abt-alur/penjaga";
import { bacaDaftarSiap, periksaNaskahSiap } from "@/server/modules/aleta-abt-siap/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { getSearchParam } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Siap diperiksa" ALETA ABT (5 Nov 2026, Tahap 6). HANYA Super Admin, diputuskan di server; peran lain (termasuk Admin) 403.
 *
 *   GET  ?peran=hakim|pp|panitera|jurusita[&tanggal=YYYY-MM-DD]   daftar pekerjaan peran itu dari jadwal sidang, dengan blangko yang disarankan   [audit]
 *   POST {tindakan:"periksa", berkasId, perkaraId, sidangKe?}      memeriksa satu naskah (isian pasti, perlu diperiksa, kosong); tidak mencetak  [audit]
 *
 * "Lihat sebagai peran" hanya memilih peran yang diperiksa; ia tidak memberi hak kepada akun mana pun. Hanya membaca (jadwal, pustaka,
 * hak folder); tidak ada tulisan ke SIPP/ABT/e-Court. Audit tidak memuat isi naskah atau nama pihak.
 */
const PESAN = "Siap diperiksa ALETA ABT hanya untuk Super Admin.";

export async function GET(request: NextRequest) {
  let db: Db | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorSuperAdminAlur(request, PESAN);
    db = a.db;
    actorUserId = a.actorUserId;
    const peran = peranAlurDari(getSearchParam(request, "peran"));
    if (!peran) throw new ApiError(400, `Pilih peran: ${PERAN_ALUR.join(", ")}.`);
    const hasil = await bacaDaftarSiap(a.db, { peran, tanggal: getSearchParam(request, "tanggal") ?? undefined });
    await catatAlur(a.db, a.actorUserId, "ALETA_ABT_SIAP_BUKA", peran, { peran, tanggal: hasil.tanggal, butir: hasil.butir.length, tersedia: hasil.tersedia });
    return ok(hasil, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "ALETA_ABT_SIAP_READ_FAILED", feature: "aleta_abt", entityId: "aleta-abt-siap" });
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
    if (String(badan.tindakan ?? "") !== "periksa") throw new ApiError(400, "Tindakan tidak dikenal.");
    const berkasId = String(badan.berkasId ?? "").trim();
    const perkaraId = String(badan.perkaraId ?? "").trim();
    const hasil = await periksaNaskahSiap(a.db, { berkasId, perkaraId, sidangKe: Number(badan.sidangKe) || 0 });
    await catatAlur(a.db, a.actorUserId, "ALETA_ABT_SIAP_PERIKSA", berkasId, {
      perkaraId,
      terisi: hasil.jumlahTerisi,
      kosong: hasil.jumlahKosong,
      periksaKembali: hasil.periksaKembali,
      dapatDicetak: hasil.dapatDicetak,
    });
    return ok(hasil, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "ALETA_ABT_SIAP_WRITE_FAILED", feature: "aleta_abt", entityId: "aleta-abt-siap" });
  }
}
