import { type NextRequest } from "next/server";

import { bolehKasir, bolehMengerjakanKasir, pengawasKasir } from "@/lib/kasir-jurnal";
import { bolehAksi } from "@/lib/matriks-peran";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { bacaAkunKasir } from "@/server/modules/aleta-ecourt/kasir-akun";
import { panggilBotJadwalSidang } from "@/server/modules/aleta-ecourt/jadwal-sidang-gateway";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kasir - Buku Jurnal Keuangan Perkara dari Jadwal Sidang (6 Okt 2026).
 *
 *   GET  ?perkaraId   jurnal SIPP (tahapan tingkat pertama) + usulan baris yang
 *                     BELUM ada, disusun bot dari keadaan perkara (sidang,
 *                     relaas, putusan, pemberitahuan, ikrar) dan kebiasaan
 *                     kasir satker. Hanya membaca.
 *   GET  ?cari=580    perkara menurut nomornya. Hanya membaca.
 *   POST              tambah baris ke jurnal SIPP - bentuk blangko "Tambah"
 *                     jurnal SIPP + sys_audittrail, lewat bot. Kering kecuali
 *                     `kering: false` disebut tegas.
 *
 * Hak: kemampuan "panel" DAN peran kasir/bendahara/panitera/admin (bolehKasir).
 * Akun SIPP: kredensial SIPP milik pengguna yang login (pemilik tunggal) -
 * tidak pernah diketik bebas, tidak pernah akun orang lain. Operator (nama
 * ALETA) dan IP peramban hanya ke jejak ALETA.
 */
async function pastikanHak(db: Awaited<ReturnType<typeof getDatabase>>, actorUserId: string | null) {
  const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
  if (!bolehKasir(aktor) || !bolehAksi(aktor, "sidang.kasir-baca")) {
    throw new ApiError(403, "Kasir jurnal hanya dapat dibuka kasir, bendahara, panitera, dan admin.");
  }
  return aktor;
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanHak(db, actorUserId);

    const cari = request.nextUrl.searchParams.get("cari");
    if (cari !== null) {
      const teks = cari.trim().slice(0, 60);
      if (!teks) return ok({ available: true, ok: true, perkara: [] });
      const hasil = await panggilBotJadwalSidang(`/kasir/cari?${new URLSearchParams({ nomor: teks }).toString()}`);
      if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error, perkara: [] });
      return ok({ available: true, ...hasil.data });
    }

    const perkaraId = String(request.nextUrl.searchParams.get("perkaraId") || "").trim();
    if (!/^\d{1,20}$/.test(perkaraId)) {
      return ok({ available: true, ok: false, alasan: "Nomor perkara SIPP tidak dikenali." });
    }
    const [hasil, akun] = await Promise.all([
      panggilBotJadwalSidang(`/kasir?${new URLSearchParams({ perkaraId }).toString()}`, { timeoutMs: 20_000 }),
      bacaAkunKasir(aktor),
    ]);
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error });
    return ok({ available: true, ...hasil.data, akun, bolehUbah: bolehMengerjakanKasir(aktor) && bolehAksi(aktor, "sidang.kasir") });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_KASIR_JURNAL_READ_FAILED",
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
    const aktor = await pastikanHak(db, actorUserId);
    if (pengawasKasir(aktor) || !bolehAksi(aktor, "sidang.kasir")) {
      throw new ApiError(403, "Panitera hanya dapat membaca Kasir - mencatat jurnal dikerjakan kasir atau petugas keuangan.");
    }
    const badan = (await request.json()) as Record<string, unknown>;

    // 28 Okt 2026: SEMUA tulisan jurnal Kasir (per perkara dan Kasir Manual) atas AKUN KASIR SIPP yang
    // ditentukan bot - akun petugas yang masuk tidak dipakai dan tidak perlu tertaut.
    const massal = badan.massal === true;

    const baris = Array.isArray(badan.baris) ? badan.baris.slice(0, 30) : [];
    const kering = badan.kering !== false;
    const hasil = await panggilBotJadwalSidang("/kasir", {
      method: "POST",
      body: {
        perkaraId: String(badan.perkaraId ?? ""),
        baris,
        operator: String(aktor.name || aktor.email || aktor.id),
        ip: alamatIpPeramban(request),
        kering,
        // 1.189.x butir 2: simpanan Kasir otomatis massal - jejak ALETA saja.
        massal,
        // Keputusan 104 (18 Okt 2026): di luar jam kerja bot bertanya dulu
        // (tanyaJamKerja) atau mengikuti pilihan petugas (antrekan | sekarang).
        tanyaJamKerja: badan.tanyaJamKerja === true,
        jamKerja: badan.jamKerja === "antrekan" || badan.jamKerja === "sekarang" ? badan.jamKerja : undefined,
      },
      // Tiap baris didahului jeda kasir (sampai 25 detik, pola petugas) di bot.
      timeoutMs: kering ? 25_000 : Math.min(600_000, 30_000 + baris.length * 26_000),
    });
    if (!hasil.ok) return ok({ available: false, ok: false, alasan: hasil.error });
    return ok({ available: true, ...hasil.data });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "SIPP_KASIR_JURNAL_WRITE_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
