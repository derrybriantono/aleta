import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { CATATAN_EKSTENSI } from "@/lib/catatan-ekstensi";
import { APP_VERSION } from "@/lib/patch-notes";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bawaan dan atap jumlah catatan - panel hanya menampilkan beberapa baris. */
const BATAS_BAWAAN = 3;
const BATAS_ATAP = 10;

/**
 * Pratinjau catatan pembaruan ekstensi, untuk panel ekstensi di portal
 * (Tahap 4 rencana "ekstensi dulu", ide portal-1 dan portal-9).
 *
 *   GET ?batas=<1..10, bawaan 3>
 *
 * ============================================================================
 * KENAPA RUTE TERSENDIRI, BUKAN DIBACA DARI HALAMAN CATATAN PEMBARUAN
 * ============================================================================
 *
 * Halaman Patch Notes digambar React; panel ekstensi tidak dapat membacanya
 * tanpa membuka halaman itu. Daftar CATATAN_EKSTENSI sudah menjadi satu
 * sumber untuk tiga layar - rute ini hanya pintu keempat ke daftar yang SAMA,
 * bukan salinan.
 *
 * Yang dikirim hanya versi, waktu rilis, dan judul: butir panjangnya tetap di
 * halaman Catatan pembaruan, dan tautan ke sana tetap ada di panel.
 * versiPortal ikut, supaya lencana server di panel dapat menyebut versinya
 * tanpa permintaan kedua.
 *
 * Tanpa sesi: 401 (requireActorUser), sama dengan /ekstensi/siapa. Hanya
 * membaca - tidak ada yang ditulis ke mana pun.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);

    const diminta = Number(request.nextUrl.searchParams.get("batas"));
    const batas = Number.isInteger(diminta) && diminta > 0 ? Math.min(diminta, BATAS_ATAP) : BATAS_BAWAAN;

    return ok({
      versiPortal: APP_VERSION,
      versiEkstensi: CATATAN_EKSTENSI[0]?.versi ?? "",
      catatan: CATATAN_EKSTENSI.slice(0, batas).map((c) => ({
        versi: c.versi,
        dirilis: c.dirilis,
        judul: c.judul,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
