import { type NextRequest } from "next/server";

import { ringkasKesiapan, saringUntukGolongan } from "@/lib/kelengkapan-sidang";
import { golonganPengguna } from "@/lib/matriks-peran";
import { isPrivilegedAdmin } from "@/lib/permissions";
import { getDatabase } from "@/server/db/client";
import {
  bacaKesiapan,
  bacaKesiapanSaya,
  bacaSetelanKelengkapan,
  jalankanKelengkapan,
  simpanSetelanKelengkapan,
} from "@/server/modules/aleta-ecourt/agen-kelengkapan";
import { bolehMenyuntingAkses, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * ============================================================================
 * AGEN KELENGKAPAN HARI SIDANG (N1, 1 Nov 2026)
 * ============================================================================
 *
 *   GET  ?perkaraId=1,2,3[&ringkas=1]  kesiapan sidang hari ini / hari kerja berikutnya tiap perkara (lencana hijau/kuning/merah
 *                                     + rincian butir). Hanya membaca hasil pagi yang tersimpan - tidak membaca SIPP.
 *   GET  ?saya=1                       penilaian milik akun (PP/jurusita/majelis menurut nama; Kasir butir kasir; admin semua).
 *   GET  ?jalan=1                      (admin) jalan terakhir, waktu tiap tahap, setelan.
 *   POST { aksi: "setelan", jadwal?, pengingatWa?, jam? }   Super Admin
 *   POST { aksi: "jalankan", ulangiGagal? }                 Admin / Super Admin (menilai ulang sekarang; pesan yang sudah terkirim tidak diulang)
 *
 * Butir panjar (angka keuangan) disaring menurut golongan akun di SERVER.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    const q = request.nextUrl.searchParams;
    const admin = isPrivilegedAdmin(aktor);
    const golongan = golonganPengguna(aktor);
    if (q.get("jalan") === "1") {
      if (!admin) return ok({ ada: false, alasan: "Hanya Admin dan Super Admin." });
      const setelan = await bacaSetelanKelengkapan(db);
      const k = await bacaKesiapan(db, []);
      return ok({ ada: true, setelan, jalan: k.jalan, bolehKelola: bolehMenyuntingAkses(aktor) });
    }
    if (q.get("saya") === "1") {
      const s = await bacaKesiapanSaya(db, { nama: String(aktor.name || ""), golongan, lihatSemua: admin });
      const penilaian = s.penilaian.map((p) => saringUntukGolongan(p, golongan)).map((p) => ({ ...p, ringkas: ringkasKesiapan(p) }));
      return ok({ ada: true, hariIni: s.hariIni, penilaian, jalan: s.jalan ? { pada: s.jalan.pada, galat: s.jalan.galat } : null });
    }
    const daftar = String(q.get("perkaraId") || "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => /^\d+$/.test(x))
      .slice(0, 400);
    if (!daftar.length) return ok({ ada: true, peta: {} });
    const k = await bacaKesiapan(db, daftar);
    const peta = Object.fromEntries(
      Object.entries(k.peta).map(([pid, p]) => {
        const lihat = saringUntukGolongan(p, golongan);
        const r = ringkasKesiapan(lihat);
        return [pid, q.get("ringkas") === "1" ? r : { ...r, butir: lihat.butir }];
      })
    );
    return ok({ ada: true, menyala: k.menyala, hariIni: k.hariIni, peta });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "AGEN_KELENGKAPAN_BACA_FAILED", feature: "aleta_ecourt", entityId: "agen-kelengkapan" });
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
    if (aksi === "setelan") {
      if (!bolehMenyuntingAkses(aktor)) throw new ApiError(403, "Pengaturan agen kelengkapan hanya dapat diubah Super Admin.");
      return ok({ ok: true, setelan: await simpanSetelanKelengkapan(db, { id: aktor.id, name: nama }, badan) });
    }
    if (aksi === "jalankan") {
      if (!isPrivilegedAdmin(aktor)) throw new ApiError(403, "Hanya Admin dan Super Admin yang dapat menjalankan pemeriksaan sekarang.");
      const c = await jalankanKelengkapan(db, { pemicu: "tangan", oleh: nama, ulangiGagal: badan.ulangiGagal === true });
      return ok({ ok: true, jalan: c.jalan, wa: c.wa, jumlah: c.penilaian.length });
    }
    throw new ApiError(400, "Aksi tidak dikenal.");
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "AGEN_KELENGKAPAN_UBAH_FAILED", feature: "aleta_ecourt", entityId: "agen-kelengkapan" });
  }
}
