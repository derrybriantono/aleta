import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanBolehUnggahPutusan } from "@/server/modules/aleta-ecourt/hak-putusan";
import { bacaPengaturan } from "@/server/modules/putusan-terjadwal/dasar";
import { buatJadwal, daftarJadwal, kelola, type AksiKelola, type MasukanJadwalBaru } from "@/server/modules/putusan-terjadwal/layanan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";
import { alamatIpPeramban, readJsonBody } from "@/server/shared/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * UNGGAH PUTUSAN TERJADWAL (21 Okt 2026, agen B3)
 * ============================================================================
 *
 *   GET   ?semua=1&aktif=1   daftar jadwal + ringkasan (milik sendiri; pengawas dapat semua)
 *   POST  { mulai, butir[], ... }  menjadwalkan (semua diperiksa dulu; ditolak seluruhnya bila ada yang tidak sah)
 *   PATCH { aksi, id, menit?, wita? }  batal | batal-jadwal | tunda | jadwal-ulang | ulang | lihat
 *
 * Menjadwalkan TIDAK menulis ke SIPP. Penulisan dikerjakan pada waktunya:
 * e-Doc oleh pelaksana di server, isi & simpan Putusan Akhir oleh ekstensi di
 * peramban penjadwal yang terbuka. Hak: Super Admin, Admin, Hakim (keputusan 9 Okt);
 * hakim hanya perkara majelisnya (keputusan 16 Okt); tercatat atas akun SIPP
 * penjadwal, dengan jejak jujur.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAksi(db, actorUserId, "putusan.unggah");
    const pelaku = await pastikanBolehUnggahPutusan(db, actorUserId);
    const q = request.nextUrl.searchParams;
    const daftar = await daftarJadwal(db, pelaku, { semua: q.get("semua") === "1", hanyaAktif: q.get("aktif") === "1", batas: Number(q.get("batas")) || undefined });
    const pengaturan = await bacaPengaturan(db);
    return ok({ ok: true, ...daftar, pengaturan: { hapusHari: pengaturan.hapusHari, pelaksanaNyala: pengaturan.pelaksanaNyala } });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_TERJADWAL_DAFTAR_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-terjadwal",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAksi(db, actorUserId, "putusan.unggah");
    const pelaku = await pastikanBolehUnggahPutusan(db, actorUserId);
    const badan = await readJsonBody<MasukanJadwalBaru>(request);
    const hasil = await buatJadwal(db, pelaku, alamatIpPeramban(request), badan);
    return ok({ ok: true, ...hasil });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_TERJADWAL_BUAT_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-terjadwal",
    });
  }
}

export async function PATCH(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanAksi(db, actorUserId, "putusan.unggah");
    const pelaku = await pastikanBolehUnggahPutusan(db, actorUserId);
    const badan = await readJsonBody<{ aksi?: string; id?: string; menit?: number; wita?: string }>(request);
    const hasil = await kelola(db, pelaku, {
      aksi: String(badan.aksi ?? "") as AksiKelola,
      id: String(badan.id ?? ""),
      menit: badan.menit,
      wita: badan.wita,
    });
    return ok(hasil);
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_TERJADWAL_KELOLA_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-terjadwal",
    });
  }
}
