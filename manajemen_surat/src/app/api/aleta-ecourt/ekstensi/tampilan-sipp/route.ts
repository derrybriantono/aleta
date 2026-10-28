import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  halamanTampilanSippSaya,
  hapusPilihanTampilanSipp,
  simpanPilihanTampilanSipp,
  tampilanSippEkstensi,
} from "@/server/modules/aleta-ecourt/tampilan-sipp";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tampilan ALETA di halaman SIPP MILIK PEMANGGILNYA SENDIRI (28 Okt 2026, lib/tampilan-sipp.ts).
 *
 *   GET ?untuk=ekstensi -> { versi, sembunyi: [{kunci, pilih, bayang?, gaya?}] } - dibaca ekstensi saat memuat
 *   GET                 -> katalog + keadaan tiap elemen (halaman Pengaturan tampilan SIPP)
 *   PUT {pilihan}       -> simpan pilihan sendiri; elemen yang dikunci admin dibuang dan disebut di `ditolak`
 *   DELETE              -> kembali ke bawaan peran (pilihan sendiri dihapus)
 *
 * Pengguna selalu dari sesi, tidak pernah dari badan permintaan. Tanpa sesi: 401.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    if (request.nextUrl.searchParams.get("untuk") === "ekstensi") return ok(await tampilanSippEkstensi(db, actor));
    return ok(await halamanTampilanSippSaya(db, actor));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    let badan: { pilihan?: unknown };
    try {
      badan = (await request.json()) as typeof badan;
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON {pilihan}.");
    }
    return ok(await simpanPilihanTampilanSipp(db, actor, badan ? badan.pilihan : null));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok(await hapusPilihanTampilanSipp(db, actor));
  } catch (error) {
    return handleRouteError(error);
  }
}
