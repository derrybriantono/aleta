import { type NextRequest } from "next/server";

import { susunPaketEvidenSkp } from "@/lib/eviden-skp-katalog";
import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { ambilDataEvidenSkp, bacaPermintaanEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-data";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { bukanJenisHakim, tanganiDaftarSkp } from "@/server/modules/skp/rute";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daftar dokumen eviden SKP satu petugas untuk satu periode (2.40.0).
 *
 *   ?peran=hakim&id=31&tahun=2026&periode=tw2
 *
 * Dipakai menu unduhan di halaman Rekap Hakim: periode, orang, Ketua, tiap
 * dokumen beserta ketersediaan dan jumlah barisnya, bagian SIPP yang tidak
 * terbaca (galat - dokumen juga menyebutnya), dan catatan untuk PETUGAS
 * (catatanOperator - hanya di menu, tidak tercetak). Isi dokumennya sendiri
 * diunduh lewat /eviden-skp/unduh.
 *
 * Kewenangannya kemampuan PANEL, sama dengan rute rekap-petugas - diperiksa
 * LEBIH DAHULU dari alamatnya. Alamat yang salah ditolak 400 tanpa memanggil
 * bot. Kegagalan bot diteruskan dengan kode dan kalimatnya
 * (ambilDataEvidenSkp), bukan dibungkus 200.
 */
export async function GET(request: NextRequest) {
  // SKP Pimpinan (Ketua/Wakil) dan SKP jabatan perkara: penangan SKP bersama.
  // Tanpa ?jenis= (atau jenis=hakim) kode di bawah berjalan persis seperti dulu.
  if (bukanJenisHakim(request)) return tanganiDaftarSkp(request);
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const permintaan = bacaPermintaanEvidenSkp(request.nextUrl.searchParams);
    if (!permintaan.ok) throw new ApiError(400, permintaan.pesan);
    const { peran, id, tahun, periode } = permintaan.nilai;

    const hasil = await ambilDataEvidenSkp({ peran, id: String(id), tahun, periode });
    if (!hasil.ok) throw new ApiError(hasil.status, hasil.alasan);

    const paket = susunPaketEvidenSkp(hasil.data);
    return ok({
      periode: paket.periode,
      orang: paket.orang,
      ketua: paket.ketua,
      dokumen: paket.dokumen.map((d) => ({
        kunci: d.kunci,
        judul: d.judul,
        judulLengkap: d.judulLengkap,
        tersedia: d.tersedia,
        sebabTidakTersedia: d.sebabTidakTersedia ?? null,
        jumlahBaris: d.tabel.baris.length,
      })),
      galat: paket.galat,
      // Untuk PETUGAS di menu - tidak tercetak di dokumen yang ditandatangani.
      catatanOperator: hasil.data.catatanOperator ?? [],
    });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "EVIDEN_SKP_DAFTAR_FAILED",
      feature: "aleta_ecourt",
    });
  }
}
