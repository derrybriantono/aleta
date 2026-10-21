import { type NextRequest } from "next/server";

import { kalimatSetelan } from "@/lib/tunda-otomatis";
import { getDatabase } from "@/server/db/client";
import { bolehMenyuntingAkses, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import {
  bacaDaftarHari,
  jalankanTundaOtomatis,
  simpanSetelan,
  tandaiBatal,
} from "@/server/modules/tunda-otomatis/layanan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/**
 * ============================================================================
 * TUNDA OTOMATIS 16.30 (22 Okt 2026)
 * ============================================================================
 *
 *   GET  ?tanggal=YYYY-MM-DD[&segarkan=1]
 *        setelan + daftar hari itu: sebelum jam pemicu PRATINJAU (apa yang
 *        akan ditunda), sesudahnya daftar yang dibekukan beserta hasil tulis.
 *        Semua akun ber-"panel" (sama dengan Jadwal Sidang).
 *   POST { aksi: "setelan", nyala?, kering?, jam? }       hanya Super Admin
 *   POST { aksi: "batal" | "pulihkan", tanggal, jadwalId } hak tunda/putus sidang
 *   POST { aksi: "jalankan", tanggal? }                   hanya Super Admin -
 *        menjalankan sekarang (mengikuti mode saklar; satu kali per tanggal).
 *
 * Yang ditulis rute ini hanya basis data ALETA. Tulisan ke SIPP hanya lewat
 * penulis tunda yang sudah ada (bot), dan hanya bila saklar menyala dan mode
 * kering dimatikan Super Admin.
 */
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    const q = request.nextUrl.searchParams;
    const tanggal = String(q.get("tanggal") || "");
    const daftar = await bacaDaftarHari(db, { tanggal: TANGGAL.test(tanggal) ? tanggal : undefined, segarkan: q.get("segarkan") === "1" });
    const { ip: _ip, ...setelan } = daftar.setelan;
    void _ip;
    return ok({
      ada: true,
      ...daftar,
      setelan,
      kalimatSetelan: kalimatSetelan(daftar.setelan),
      bolehUbahSetelan: bolehMenyuntingAkses(aktor),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "TUNDA_OTOMATIS_BACA_FAILED", feature: "aleta_ecourt", entityId: "tunda-otomatis" });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const aksi = String(badan.aksi || "");
    const nama = String(aktor.name || aktor.email || aktor.id);

    if (aksi === "setelan" || aksi === "jalankan") {
      if (!bolehMenyuntingAkses(aktor)) throw new ApiError(403, "Saklar tunda otomatis hanya dapat diubah Super Admin.");
      if (aksi === "setelan") {
        const setelan = await simpanSetelan(db, { id: aktor.id, name: nama }, badan, alamatIpPeramban(request));
        const { ip: _ip, ...tampil } = setelan;
        void _ip;
        return ok({ ok: true, setelan: tampil, kalimatSetelan: kalimatSetelan(setelan) });
      }
      const tanggal = String(badan.tanggal || "");
      const c = await jalankanTundaOtomatis(db, { pemicu: "tangan", oleh: nama, tanggal: TANGGAL.test(tanggal) ? tanggal : undefined });
      return ok({ ok: true, jalan: c.jalan, jumlah: c.butir.length });
    }

    if (aksi === "batal" || aksi === "pulihkan") {
      await pastikanAksi(db, actorUserId, "sidang.tunda-putus");
      const tanggal = String(badan.tanggal || "");
      if (!TANGGAL.test(tanggal)) throw new ApiError(400, "Tanggal sidang tidak sah.");
      const hasil = await tandaiBatal(db, { tanggal, jadwalId: String(badan.jadwalId || ""), oleh: aktor.id, nama, batal: aksi === "batal" });
      return ok(hasil);
    }

    throw new ApiError(400, "Aksi tidak dikenal.");
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "TUNDA_OTOMATIS_UBAH_FAILED", feature: "aleta_ecourt", entityId: "tunda-otomatis" });
  }
}
