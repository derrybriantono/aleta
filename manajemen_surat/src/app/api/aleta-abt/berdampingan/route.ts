import { type NextRequest } from "next/server";

import { aktorSuperAdminAlur, bacaBadanJson, catatAlur, type Db } from "@/server/modules/aleta-abt-alur/penjaga";
import { bacaRingkasanBerdampingan, jawabBeda, simpanSetelanBerdampingan } from "@/server/modules/aleta-abt-berdampingan/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Berdampingan dengan ABT (5 Nov 2026, Tahap 7). HANYA Super Admin, diputuskan di server.
 *
 *   GET                                     ringkasan: kemajuan 30 cetak per jenis, hari tanpa beda merah, ringkasan mingguan, beda terbaru, saklar
 *   POST {tindakan:"setelan", aktif}        menyalakan atau mematikan pembandingan otomatis (BAWAAN MATI)                      [audit]
 *   POST {tindakan:"jawab", id, jawaban}    menjawab satu beda merah: dijelaskan | sudah-dibetulkan | salah-pembanding         [audit]
 *
 * Pembandingan otomatis dipicu rute cetak-terakhir (jalur yang sudah ada); pembandingan manual dari layar cetak (tindakan "banding" dengan
 * catat). Yang tersimpan hanya angka, nama blangko, kelompok jenis perkara, dan jenis beda. Tidak ada tulisan ke ABT/SIPP.
 */
const PESAN = "Berdampingan dengan ABT hanya untuk Super Admin.";

export async function GET(request: NextRequest) {
  let db: Db | null = null;
  let actorUserId: string | null = null;
  try {
    const a = await aktorSuperAdminAlur(request, PESAN);
    db = a.db;
    actorUserId = a.actorUserId;
    return ok(await bacaRingkasanBerdampingan(a.db), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "ALETA_ABT_BERDAMPINGAN_READ_FAILED", feature: "aleta_abt", entityId: "aleta-abt-berdampingan" });
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
      case "setelan": {
        if (typeof badan.aktif !== "boolean") throw new ApiError(400, "Pilih menyalakan atau mematikan.");
        const hasil = await simpanSetelanBerdampingan(a.db, a.aktor, badan.aktif);
        await catatAlur(a.db, a.actorUserId, "ALETA_ABT_BERDAMPINGAN_SETELAN", "setelan", { aktif: hasil.aktif });
        return ok(hasil, { headers: tak });
      }
      case "jawab": {
        const id = String(badan.id ?? "").trim();
        if (!id) throw new ApiError(400, "Pilih hasil banding yang dijawab.");
        const hasil = await jawabBeda(a.db, a.aktor, id, String(badan.jawaban ?? ""));
        await catatAlur(a.db, a.actorUserId, "ALETA_ABT_BERDAMPINGAN_JAWAB", id, { jawaban: hasil.jawaban });
        return ok(hasil, { headers: tak });
      }
      default:
        throw new ApiError(400, "Tindakan tidak dikenal.");
    }
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "ALETA_ABT_BERDAMPINGAN_WRITE_FAILED", feature: "aleta_abt", entityId: "aleta-abt-berdampingan" });
  }
}
