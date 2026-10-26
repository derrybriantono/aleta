import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { daftarAlias, hapusAlias, tambahAlias } from "@/server/modules/aleta-ecourt/alias-nama";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kamus alias nama pihak (U18, rantai B). HANYA Admin dan Super Admin (isinya nama orang).
 *
 *   GET                                  -> { aktif, jumlah, kamus: [{ baku, varian: [{ id, varian, sumber, dibuatPada }] }] }
 *   POST {aksi:"tambah", baku, varian}   -> { ditambah, sudahAda }       varian: larik atau teks satu per baris
 *   POST {aksi:"hapus", id | baku}       -> { dihapus }
 *
 * Tiap perubahan masuk jejak audit (tanpa nama orang). Pemeriksa untuk pemakai biasa: /alias-nama/periksa.
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    return ok(await daftarAlias(db, await resolveActorUserId(request)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const aktorId = await resolveActorUserId(request);
    let b: Record<string, unknown>;
    try {
      b = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON.");
    }
    if (!b || typeof b !== "object") throw new ApiError(400, "Badan permintaan harus obyek.");
    if (b.aksi === "tambah") return ok(await tambahAlias(db, aktorId, { baku: b.baku, varian: b.varian }));
    if (b.aksi === "hapus") return ok(await hapusAlias(db, aktorId, { id: b.id, baku: b.baku }));
    throw new ApiError(400, 'Aksi harus "tambah" atau "hapus".');
  } catch (error) {
    return handleRouteError(error);
  }
}
