import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanKapabilitas } from "@/server/modules/aleta-ecourt/akses";
import { pastikanAksi } from "@/server/modules/akses/hak-peran";
import {
  getGatewayBlangkoLaporanPerkara,
  getGatewayDaftarLaporanPerkara,
  postGatewayCatatLaporanPerkara,
} from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { getPositionByIdFromDb, requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Blangko nilai laporan perkara, dan pencatatan pengirimannya.
 *
 * ============================================================================
 * TANGGAL KIRIM TIDAK ADA DI SIPP
 * ============================================================================
 *
 * Kapan sebuah laporan diunggah ke sistem pelaporan Badilag adalah peristiwa di
 * luar SIPP. Menebaknya dari tanggal input terakhir menghasilkan angka yang
 * tampak berdasar padahal karangan.
 *
 * Rute inilah satu-satunya jalan yang pantas bagi petugas untuk memasukkannya.
 * Sebelum ada rute ini, satu-satunya cara adalah menulis langsung ke basis
 * data - dan itu bukan cara yang boleh diminta dari siapa pun.
 */
export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");

    const lipaMentah = request.nextUrl.searchParams.get("lipa");
    if (lipaMentah === null) {
      const daftar = await getGatewayDaftarLaporanPerkara();
      if (!daftar.ok) {
        return ok({ available: false, ok: false, alasan: daftar.error || "ALETA Bot belum dapat dihubungi." });
      }
      return ok({ available: true, ...(daftar.data as Record<string, unknown>) });
    }

    const lipa = Number(lipaMentah);
    if (!Number.isInteger(lipa) || lipa < 1 || lipa > 22) {
      return ok({ available: true, ok: false, alasan: "Nomor LIPA harus antara 1 dan 22." });
    }
    const bulan = Number(request.nextUrl.searchParams.get("bulan") || 12);

    const hasil = await getGatewayBlangkoLaporanPerkara(lipa, bulan);
    if (!hasil.ok) {
      return ok({ available: false, ok: false, alasan: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }
    return ok({ available: true, ...(hasil.data as Record<string, unknown>) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      feature: "aleta-penilaian",
      action: "laporan-baca",
    });
  }
}

/**
 * Mencatat tanggal kirim dan angka laporan.
 *
 * Pencatatnya diambil dari sesi yang sedang berjalan, BUKAN dari isian layar.
 * Ruas "dicatat oleh" yang dapat diketik sendiri membuat catatan itu tidak
 * dapat ditelusuri - dan catatan yang tidak dapat ditelusuri tidak berguna
 * sebagai bukti ketepatan waktu.
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await pastikanKapabilitas(db, actorUserId, "panel");
    // Keputusan pengguna 23 Okt 2026: hanya Panitera, Panitera Muda, Admin, Super Admin (matriks penilaian.catat-laporan).
    await pastikanAksi(db, actorUserId, "penilaian.catat-laporan");

    const isi = (await request.json()) as Record<string, unknown>;
    const lipaNomor = Number(isi.lipaNomor);
    const bulanLaporan = String(isi.bulanLaporan || "").trim();

    if (!Number.isInteger(lipaNomor) || lipaNomor < 1 || lipaNomor > 22) {
      return ok({ ok: false, alasan: "Nomor LIPA harus antara 1 dan 22." });
    }
    if (!/^\d{4}-\d{2}$/.test(bulanLaporan)) {
      return ok({ ok: false, alasan: "Bulan laporan harus berbentuk YYYY-MM." });
    }
    const tanggalKirim = isi.tanggalKirim ? String(isi.tanggalKirim).trim() : null;
    if (tanggalKirim && !/^\d{4}-\d{2}-\d{2}$/.test(tanggalKirim)) {
      return ok({ ok: false, alasan: "Tanggal kirim harus berbentuk YYYY-MM-DD." });
    }

    const pencatat = await namaPencatat(db, actorUserId);
    const hasil = await postGatewayCatatLaporanPerkara({
      lipaNomor,
      bulanLaporan,
      tanggalKirim,
      angkaLaporan:
        isi.angkaLaporan === "" || isi.angkaLaporan === undefined || isi.angkaLaporan === null
          ? null
          : Number(isi.angkaLaporan),
      dicatatOleh: pencatat.nama,
      jabatan: pencatat.jabatan,
      keterangan: isi.keterangan === undefined ? null : String(isi.keterangan),
    });

    if (!hasil.ok) {
      return ok({ ok: false, alasan: hasil.error || "ALETA Bot belum dapat dihubungi." });
    }
    return ok({ ok: true, dicatatOleh: pencatat.nama });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      feature: "aleta-penilaian",
      action: "laporan-catat",
    });
  }
}

/**
 * Nama dan jabatan pencatat, diambil dari sesi.
 *
 * Bukan dari isian layar. Ruas "dicatat oleh" yang dapat diketik sendiri
 * membuat catatannya tidak dapat ditelusuri - dan catatan yang tidak dapat
 * ditelusuri tidak berguna sebagai bukti ketepatan waktu.
 *
 * Pengguna yang sudah dinonaktifkan ditolak di sini, bukan dicatat dengan nama
 * kosong: catatan tanpa penulis sama saja dengan tidak ada.
 */
async function namaPencatat(
  db: Awaited<ReturnType<typeof getDatabase>>,
  actorUserId: string | null
): Promise<{ nama: string; jabatan: string }> {
  const aktor = await requireActorUser(db, actorUserId);
  const jabatan = aktor.positionId ? await getPositionByIdFromDb(db, aktor.positionId) : null;
  return {
    nama: String(aktor.name || aktor.id).slice(0, 191),
    jabatan: String(jabatan?.name || "").slice(0, 191),
  };
}
