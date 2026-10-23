import { type NextRequest } from "next/server";

import { kalimatSetelanPutus } from "@/lib/putus-otomatis";
import { getDatabase } from "@/server/db/client";
import { bolehMenyuntingAkses, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bolehAksi } from "@/lib/matriks-peran";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { bacaDaftarPutus, jalankanPutusOtomatis, simpanSetelanPutus, tandaiBatalPutus } from "@/server/modules/putus-otomatis/layanan";
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
 * PUTUS OTOMATIS GUGUR / TIDAK DAPAT DITERIMA (22 Okt 2026)
 * ============================================================================
 *
 *   GET  ?tanggal=YYYY-MM-DD   setelan + daftar calon (pratinjau / sesudah jalan)
 *   POST { aksi: "setelan", nyala?, kering?, hasilAturan8?, unggahEdoc? }  hanya Super Admin
 *   POST { aksi: "batal" | "pulihkan", tanggal, jadwalId }   hak tunda/putus sidang
 *   POST { aksi: "jalankan", tanggal? }                      hanya Super Admin
 */
const TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    const tanggal = String(request.nextUrl.searchParams.get("tanggal") || "");
    const daftar = await bacaDaftarPutus(db, { tanggal: TANGGAL.test(tanggal) ? tanggal : undefined });
    const { ip: _ip, diubahOlehId: _id, ...setelan } = daftar.setelan;
    void _ip;
    void _id;
    return ok({ ada: true, ...daftar, setelan, kalimatSetelan: kalimatSetelanPutus(daftar.setelan), bolehUbahSetelan: bolehMenyuntingAkses(aktor),
      // Audit hak 23 Okt 2026: "Jangan putus otomatis" / "Ikutkan lagi" = aksi sidang.tunda-putus (POST batal/pulihkan).
      bolehBatal: bolehAksi(aktor, "sidang.tunda-putus"),
    });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "PUTUS_OTOMATIS_BACA_FAILED", feature: "aleta_ecourt", entityId: "putus-otomatis" });
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
      if (!bolehMenyuntingAkses(aktor)) throw new ApiError(403, "Saklar putus otomatis hanya dapat diubah Super Admin.");
      if (aksi === "setelan") {
        const s = await simpanSetelanPutus(db, { id: aktor.id, name: nama }, badan, alamatIpPeramban(request));
        return ok({ ok: true, kalimatSetelan: kalimatSetelanPutus(s) });
      }
      const tanggal = String(badan.tanggal || "");
      const c = await jalankanPutusOtomatis(db, { pemicu: "tangan", oleh: nama, tanggal: TANGGAL.test(tanggal) ? tanggal : undefined });
      return ok({ ok: true, jalan: c.jalan, jumlah: c.butir.length });
    }
    if (aksi === "batal" || aksi === "pulihkan") {
      await pastikanAksi(db, actorUserId, "sidang.tunda-putus");
      const tanggal = String(badan.tanggal || "");
      if (!TANGGAL.test(tanggal)) throw new ApiError(400, "Tanggal sidang tidak sah.");
      return ok(await tandaiBatalPutus(db, { tanggal, jadwalId: String(badan.jadwalId || ""), oleh: aktor.id, nama, batal: aksi === "batal" }));
    }
    throw new ApiError(400, "Aksi tidak dikenal.");
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "PUTUS_OTOMATIS_UBAH_FAILED", feature: "aleta_ecourt", entityId: "putus-otomatis" });
  }
}
