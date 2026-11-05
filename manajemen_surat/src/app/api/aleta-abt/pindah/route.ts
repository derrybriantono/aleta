import { type NextRequest } from "next/server";

import { aktorSuperAdminAlur, bacaBadanJson, catatAlur, type Db } from "@/server/modules/aleta-abt-alur/penjaga";
import { bacaKeadaanPindah, simpanLaporanUkur, ubahSaklarPindah } from "@/server/modules/aleta-abt-pindah/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pindah ke ALETA ABT per jenis perkara (5 Nov 2026, Tahap 8). HANYA Super Admin, diputuskan di server pada setiap permintaan.
 *
 *   GET                                         kesiapan tiap jenis perkara: hasil pembanding, jumlah cetak berdampingan, syarat, dan saklar   [audit]
 *   POST {tindakan:"saklar", keluarga, aktif}   menyalakan atau mematikan satu jenis (BAWAAN MATI; menyala hanya bila syarat terpenuhi)           [audit]
 *   POST {tindakan:"laporan", laporan:{...}}    memuat hasil pengukuran pada salinan uji (angka saja)                                            [audit]
 *
 * Tidak menulis ke ABT, SIPP, atau e-Court. Panel Blangko ABT by Derry Briantono tidak membaca rute ini dan tetap memakai ABT.
 * Audit hanya memuat penanda jenis dan angka: tidak ada isi naskah dan tidak ada nama pihak.
 */
const PESAN = "Pindah ke ALETA ABT hanya untuk Super Admin.";

export async function GET(request: NextRequest) {
  let db: Db | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorSuperAdminAlur(request, PESAN);
    db = a.db;
    actorUserId = a.actorUserId;
    const keadaan = await bacaKeadaanPindah(a.db);
    await catatAlur(a.db, a.actorUserId, "ALETA_ABT_PINDAH_BACA", "kesiapan", { menyala: keadaan.menyala, siap: keadaan.siap, terukur: keadaan.terukur });
    return ok(keadaan, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "ALETA_ABT_PINDAH_READ_FAILED", feature: "aleta_abt", entityId: "aleta-abt-pindah" });
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
    const tak = { "Cache-Control": "no-store" };
    switch (String(badan.tindakan ?? "")) {
      case "saklar": {
        if (typeof badan.aktif !== "boolean") throw new ApiError(400, "Pilih menyalakan atau mematikan.");
        const kunci = String(badan.keluarga ?? "");
        try {
          const hasil = await ubahSaklarPindah(a.db, a.aktor, kunci, badan.aktif);
          await catatAlur(a.db, a.actorUserId, "ALETA_ABT_PINDAH_SAKLAR", kunci, { aktif: hasil.aktif });
          return ok(hasil, { headers: tak });
        } catch (e) {
          // Penolakan menyalakan (syarat belum terpenuhi) juga dicatat: pemilik dapat melihat siapa mencoba apa.
          if (e instanceof ApiError && e.status === 409) await catatAlur(a.db, a.actorUserId, "ALETA_ABT_PINDAH_SAKLAR_DITOLAK", kunci, { aktif: badan.aktif });
          throw e;
        }
      }
      case "laporan": {
        const hasil = await simpanLaporanUkur(a.db, a.aktor, badan.laporan);
        await catatAlur(a.db, a.actorUserId, "ALETA_ABT_PINDAH_LAPORAN", "laporan", { keluarga: hasil.keluarga, terukur: hasil.terukur, dibuat: hasil.dibuat });
        return ok(hasil, { headers: tak });
      }
      default:
        throw new ApiError(400, "Tindakan tidak dikenal.");
    }
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "ALETA_ABT_PINDAH_WRITE_FAILED", feature: "aleta_abt", entityId: "aleta-abt-pindah" });
  }
}
