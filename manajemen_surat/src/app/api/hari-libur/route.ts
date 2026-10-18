import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pastikanAdminIstimewa } from "@/server/modules/aleta-ecourt/akses";
import { bacaHariLibur, simpanHariLibur } from "@/server/modules/hari-libur/sumber";
import { requireActorUser } from "@/server/modules/organization/service";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hari libur (18 Okt 2026) - satu sumber untuk layar portal dan ekstensi.
 *
 *   GET                         semua pengguna yang masuk: SKB + tambahan Pengaturan
 *   POST {tambahan:[...]}       Super Admin dan Admin: simpan libur tambahan
 *                               (tanggal, nama, jenis, aksi tambah|hapus)
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    await requireActorUser(db, await resolveActorUserId(request));
    return ok(await bacaHariLibur(db));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const actor = await pastikanAdminIstimewa(db, await resolveActorUserId(request), "mengubah daftar hari libur");
    let badan: Record<string, unknown>;
    try {
      const isi = (await request.json()) as unknown;
      badan = isi && typeof isi === "object" && !Array.isArray(isi) ? (isi as Record<string, unknown>) : {};
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    return ok(await simpanHariLibur(db, { id: actor.id, name: actor.name }, badan));
  } catch (error) {
    return handleRouteError(error);
  }
}
