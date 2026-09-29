import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import {
  bacaSetelanPengguna,
  keteranganSetelan,
  simpanSetelanPengguna,
} from "@/server/modules/aleta-ecourt/tampilan-ekstensi";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Setelan pribadi ekstensi MILIK PEMANGGILNYA SENDIRI.
 *
 *   GET -> { setelan: {kunci: {nilai, diubahPada}}, keteranganSetelan }
 *   PUT {kunci, nilai, jikaDiubahPada?} -> {kunci, nilai, diubahPada, dihapus, dibuang}
 *       nilai null = hapus setelan itu.
 *
 * Tidak ada jalan membaca atau menulis setelan orang lain - pengguna selalu
 * diambil dari sesi, tidak pernah dari badan permintaan. Kunci dibatasi
 * daftar putih (KUNCI_SETELAN di src/lib/tampilan-ekstensi.ts); kredensial,
 * token, dan sesi tidak pernah ada di sana.
 *
 * Galat: 400 kunci/bentuk/ukuran, 401 tanpa sesi, 409 diubah dari PC lain.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));
    return ok({
      setelan: await bacaSetelanPengguna(db, actor.id),
      keteranganSetelan: keteranganSetelan(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await requireActorUser(db, await resolveActorUserId(request));

    let badan: { kunci?: unknown; nilai?: unknown; jikaDiubahPada?: unknown };
    try {
      badan = (await request.json()) as typeof badan;
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON {kunci, nilai}.");
    }
    if (!badan || typeof badan !== "object" || !("nilai" in badan)) {
      throw new ApiError(400, "Badan permintaan harus memuat kunci dan nilai (null untuk menghapus).");
    }

    return ok(
      await simpanSetelanPengguna(db, actor.id, {
        kunci: badan.kunci,
        nilai: badan.nilai,
        jikaDiubahPada: badan.jikaDiubahPada,
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
