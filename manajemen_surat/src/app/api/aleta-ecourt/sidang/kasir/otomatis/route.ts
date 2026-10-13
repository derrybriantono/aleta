import { type NextRequest } from "next/server";

import { bolehMengerjakanKasir, pengawasKasir } from "@/lib/kasir-jurnal";
import { getDatabase } from "@/server/db/client";
import { akunSippPengguna } from "@/server/modules/aleta-ecourt/court-calendar-akun";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { pastikanHakKasir, pastikanHakKasirTulis, tanggalAtauHariIni } from "@/server/modules/aleta-ecourt/kasir-otomatis";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kasir otomatis - saklar hari putus (13 Okt 2026, butir 10).
 *
 *   GET  ?tanggal=YYYY-MM-DD   saklar + butir + perkara PUTUS hari itu beserta
 *                              keadaan tiap butir (sudah tercatat / akan diisi
 *                              / dilewati + alasan). Hanya membaca - panitera
 *                              dan panitera muda boleh melihat.
 *   POST { aksi: "setelan", nyala, butir }
 *                              ubah saklar/butir - kasir & keuangan (dan admin)
 *   POST { aksi: "jalankan", perkaraId, kering }
 *                              tulis butir hari putus SATU perkara atas akun
 *                              SIPP petugas yang masuk. Saklar dan butir dibaca
 *                              bot dari setelan (bukan dari peramban): saklar
 *                              mati = tidak ada tulisan.
 *
 * Panitera/panitera muda: 403 untuk kedua POST (pastikanHakKasirTulis) - rute
 * yang menolak, bukan hanya tombol yang disembunyikan.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanHakKasir(db, actorUserId);
    const tanggal = tanggalAtauHariIni(request.nextUrl.searchParams.get("tanggal"));
    const bolehUbah = bolehMengerjakanKasir(aktor);
    const [hasil, akun] = await Promise.all([
      panggilBotJadwalSidang(`/kasir/otomatis?${new URLSearchParams({ tanggal }).toString()}`, { timeoutMs: 60_000 }),
      bolehUbah ? akunSippPengguna(db, aktor.id) : Promise.resolve(null),
    ]);
    const peran = { bolehUbah, pengawas: pengawasKasir(aktor) };
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error, tanggal, ...peran });
    return ok({ available: true, ...hasil.data, ...peran, akun });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_KASIR_OTOMATIS_READ_FAILED",
      feature: "aleta_ecourt",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanHakKasirTulis(db, actorUserId);
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const operator = String(aktor.name || aktor.email || aktor.id);

    if (badan.aksi === "setelan") {
      const hasil = await panggilBotJadwalSidang("/kasir/otomatis/setelan", {
        method: "POST",
        body: {
          nyala: typeof badan.nyala === "boolean" ? badan.nyala : undefined,
          butir: Array.isArray(badan.butir) ? badan.butir.map((x) => String(x)).slice(0, 20) : undefined,
          operator,
        },
      });
      if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error });
      return ok({ available: true, ...hasil.data });
    }

    if (badan.aksi !== "jalankan") throw new ApiError(400, "Aksi Kasir otomatis tidak dikenali.");
    const perkaraId = String(badan.perkaraId ?? "").trim();
    if (!/^\d{1,20}$/.test(perkaraId)) return ok({ available: true, ok: false, alasan: "Nomor perkara SIPP tidak dikenali." });
    const akun = await akunSippPengguna(db, aktor.id, badan.akunSipp);
    if (!akun.ok) return ok({ available: true, ok: false, alasan: akun.alasan, pesan: akun.pesan, milik: akun.milik });
    const kering = badan.kering !== false;
    const hasil = await panggilBotJadwalSidang("/kasir/otomatis", {
      method: "POST",
      body: { perkaraId, akunSipp: akun.username, operator, ip: alamatIpPeramban(request), kering },
      // Tiap baris didahului jeda manusia di bot; hari putus paling banyak ~7 baris.
      timeoutMs: kering ? 25_000 : 60_000,
    });
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_KASIR_OTOMATIS_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
