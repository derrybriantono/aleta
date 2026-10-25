import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  aksiPemantauCermin,
  halamanPemantauCermin,
  simpanPengaturanPemantauCermin,
  type AksiPemantauCermin,
} from "@/server/modules/cermin/pemantau";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ============================================================================
 * PEMANTAU CERMIN PERKARA (C0, 25 Okt 2026)
 * ============================================================================
 *
 * Admin dan Super Admin MELIHAT; mengubah saklar dan menjalankan tindakan
 * hanya Super Admin (ditegakkan di modul, bukan hanya di tombol).
 *
 *   GET                       -> pengaturan, kemajuan pemindai, hitungan tabel
 *   PUT {pemindaiAktif, layar, ukuranKelompok, jedaDetik, jendelaMulai, jendelaSelesai}
 *   PUT {bawaan: true}        -> kembali ke bawaan (semua mati)
 *   POST {aksi: "putaran-sekarang" | "lanjutkan" | "ulang" | "pembaruan-sekarang" | "pencocokan-sekarang", konfirmasi?}
 *
 * Tidak ada yang ditulis ke SIPP/ABT.
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
    return ok(await halamanPemantauCermin(db, actorUserId));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "CERMIN_PERKARA_READ_FAILED",
      feature: "cermin_perkara",
      entityId: "cermin-perkara",
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
    await simpanPengaturanPemantauCermin(db, actorUserId, badan.bawaan === true ? null : badan);
    return ok(await halamanPemantauCermin(db, actorUserId));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "CERMIN_PERKARA_UPDATE_FAILED",
      feature: "cermin_perkara",
      entityId: "cermin-perkara",
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
    const aksi = String(badan.aksi || "");
    if (!["putaran-sekarang", "lanjutkan", "ulang", "pembaruan-sekarang", "pencocokan-sekarang", "mediasi-sekarang", "tag-sekarang"].includes(aksi)) {
      throw new ApiError(
        400,
        'Aksi tidak dikenal (yang tersedia: "putaran-sekarang", "lanjutkan", "ulang", "pembaruan-sekarang", "pencocokan-sekarang", "mediasi-sekarang", "tag-sekarang").'
      );
    }
    const hasil = await aksiPemantauCermin(db, actorUserId, aksi as AksiPemantauCermin, { konfirmasi: badan.konfirmasi === true });
    return ok({ ...hasil, halaman: await halamanPemantauCermin(db, actorUserId) });
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "CERMIN_PERKARA_AKSI_FAILED",
      feature: "cermin_perkara",
      entityId: "cermin-perkara",
    });
  }
}
