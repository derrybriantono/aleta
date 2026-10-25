import { type NextRequest } from "next/server";

import { SEMUA_ATURAN, type Butir } from "@/lib/penjaga-tenggat";
import { pemilikButir, raporDariButir } from "@/lib/tenggat-terjadwal";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";
import { getDatabase } from "@/server/db/client";
import { bolehMenyuntingAkses, pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import {
  bacaCatatanTenggat,
  bacaSetelanTenggat,
  jalankanTenggat,
  lihatSemuaTenggat,
  nilaiLangsung,
  simpanSetelanTenggat,
} from "@/server/modules/penjaga-tenggat/layanan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * ============================================================================
 * LAYAR TENGGAT (G1, 25 Okt 2026)
 * ============================================================================
 *
 *   GET  ?langsung=1
 *        Hasil harian hari ini (bila jadwal pernah jalan) atau penilaian LANGSUNG dari SIPP (hanya membaca,
 *        tidak disimpan). Orang yang bukan admin/pimpinan/panitera/panmud HANYA menerima perkara yang namanya
 *        tercantum - disaring di sini, bukan hanya di layar.
 *   POST { aksi: "setelan", jadwal?, pengingatWa?, jam?, aturanPengingat? }   hanya Super Admin
 *   POST { aksi: "jalankan", ulangiGagal? }                                    hanya Super Admin
 *
 * Rute lama /api/aleta-ecourt/penjaga-tenggat tidak berubah.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    const langsung = request.nextUrl.searchParams.get("langsung") === "1";
    const tanggal = waktuPengadilan().tanggal;
    const semua = lihatSemuaTenggat(aktor);
    const kelola = bolehMenyuntingAkses(aktor);
    const setelan = await bacaSetelanTenggat(db);
    const catatan = await bacaCatatanTenggat(db, tanggal);

    let rapor = catatan.rapor;
    let sumber: "harian" | "langsung" = "harian";
    let gagal: Record<string, string> = catatan.jalan?.gagal ?? {};
    let dibuatPada = catatan.jalan?.pada ?? "";
    if (!rapor || langsung) {
      const nilai = await nilaiLangsung(tanggal);
      if (!nilai.ok) {
        // Gagal terbaca BUKAN "tidak ada tenggat".
        return ok({ tersedia: false, tanggal, alasan: nilai.galat, lihatSemua: semua, bolehKelola: kelola, setelan: kelola ? setelan : null });
      }
      rapor = nilai.rapor;
      gagal = nilai.gagal;
      sumber = "langsung";
      dibuatPada = new Date().toISOString();
    }

    const butir: Butir[] = semua ? rapor.butir : rapor.butir.filter((b) => pemilikButir(b, String(aktor.name || "")));
    const ringkas = raporDariButir(rapor, butir);
    return ok({
      tersedia: true,
      sumber,
      tanggal: rapor.acuan,
      dibuatPada,
      lihatSemua: semua,
      bolehKelola: kelola,
      hitung: ringkas.hitung,
      berjalan: butir.filter((b) => b.tingkat === "berjalan").length,
      butir,
      tumpukanLama: semua ? rapor.tumpukanLama : {},
      // Aturan yang tidak terbaca dari SIPP disebut apa adanya supaya "tidak ada temuan" tidak tertukar dengan "tidak diperiksa".
      gagal,
      aturan: SEMUA_ATURAN.map((a) => ({ kode: a.kode, judul: a.judul, dasar: a.dasar, perluVerifikasi: Boolean(a.perluVerifikasi) })),
      setelan: kelola ? setelan : null,
      jalan: kelola ? catatan.jalan : null,
      wa: kelola ? catatan.wa : null,
    });
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "TENGGAT_BACA_FAILED", feature: "aleta_ecourt", entityId: "tenggat" });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const aktor = await pastikanKapabilitas(db, actorUserId, "panel");
    if (!bolehMenyuntingAkses(aktor)) throw new ApiError(403, "Pengaturan penjaga tenggat hanya dapat diubah Super Admin.");
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const aksi = String(badan.aksi || "");
    const nama = String(aktor.name || aktor.email || aktor.id);

    if (aksi === "setelan") {
      const setelan = await simpanSetelanTenggat(db, { id: aktor.id, name: nama }, badan);
      return ok({ ok: true, setelan });
    }
    if (aksi === "jalankan") {
      const c = await jalankanTenggat(db, { pemicu: "tangan", oleh: nama, ulangiGagal: badan.ulangiGagal === true });
      return ok({ ok: true, jalan: c.jalan, wa: c.wa, jumlah: c.rapor?.butir.length ?? 0 });
    }
    throw new ApiError(400, "Aksi tidak dikenal.");
  } catch (error) {
    return handleAdminRouteError(error, request, { db, actorUserId, action: "TENGGAT_UBAH_FAILED", feature: "aleta_ecourt", entityId: "tenggat" });
  }
}
