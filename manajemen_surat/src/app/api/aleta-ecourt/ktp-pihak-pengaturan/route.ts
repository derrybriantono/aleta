import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  bacaHalamanKtp,
  bacaUlangKtpPerkara,
  cariRiwayatKtp,
  rincianRiwayatKtp,
  simpanPengaturanKtp,
} from "@/server/modules/aleta-ecourt/ktp-pihak-pengaturan";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * PENGATURAN & HISTORI PENARIKAN TANGGAL KTP PIHAK (12 Okt 2026, butir 11)
 * ============================================================================
 *
 * Hanya Super Admin dan Admin (pastikanAdminIstimewa di tiap jalur).
 *
 *   GET                         -> halaman: pengaturan tersimpan/berlaku/bawaan server,
 *                                  keadaan penyapu, angka besar
 *   GET ?bagian=riwayat&cari=&mulai=
 *                               -> perkara yang berkas KTP-nya sudah diproses
 *   GET ?bagian=perkara&nomor=  -> rincian satu perkara: berkas, hasil per pihak,
 *                                  percobaan terdahulu
 *   PUT {aktif, batas, jedaDetik}  -> simpan (menang atas env, tanpa restart)
 *   PUT {bawaan: true}             -> kembali ke bawaan server
 *   POST {aksi: "baca-ulang", nomor} -> baca ulang berkas KTP satu perkara sekarang
 *
 * NIK tidak pernah dikirim. Tidak ada yang ditulis ke SIPP/ABT/e-Court.
 */
async function bacaBadan(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const isi = (await request.json()) as unknown;
    return isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
  } catch {
    throw new ApiError(400, "Badan permintaan harus JSON.");
  }
}

export async function GET(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const q = request.nextUrl.searchParams;
    const bagian = String(q.get("bagian") || "");
    if (bagian === "riwayat") {
      return ok(await cariRiwayatKtp(db, actorUserId, String(q.get("cari") || ""), Number(q.get("mulai")) || 0));
    }
    if (bagian === "perkara") {
      return ok(await rincianRiwayatKtp(db, actorUserId, String(q.get("nomor") || "")));
    }
    return ok(await bacaHalamanKtp(db, actorUserId));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KTP_PIHAK_PENGATURAN_READ_FAILED",
      feature: "aleta_ecourt",
      entityId: "ktp-pihak-pengaturan",
    });
  }
}

export async function PUT(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const badan = await bacaBadan(request);
    await simpanPengaturanKtp(db, actorUserId, badan.bawaan === true ? null : badan);
    return ok(await bacaHalamanKtp(db, actorUserId));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KTP_PIHAK_PENGATURAN_UPDATE_FAILED",
      feature: "aleta_ecourt",
      entityId: "ktp-pihak-pengaturan",
    });
  }
}

export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    const badan = await bacaBadan(request);
    if (badan.aksi !== "baca-ulang") throw new ApiError(400, 'Aksi tidak dikenal (yang tersedia: "baca-ulang").');
    return ok(await bacaUlangKtpPerkara(db, actorUserId, String(badan.nomor || "")));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "KTP_PIHAK_BACA_ULANG_FAILED",
      feature: "aleta_ecourt",
      entityId: "ktp-pihak-pengaturan",
    });
  }
}
