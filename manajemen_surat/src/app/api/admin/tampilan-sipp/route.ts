import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { halamanAdminTampilanSipp, simpanAturanTampilanSipp } from "@/server/modules/aleta-ecourt/tampilan-sipp";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aturan tampilan ALETA di halaman SIPP per peran dan per pengguna (28 Okt 2026) - aksi "tampilan-sipp.atur"
 * (Super Admin & Admin; aturan untuk Super Admin hanya oleh Super Admin).
 *   GET ?pratinjau=<idPengguna> -> katalog, golongan, aturan tersimpan, pegawai, usulan per peran, pratinjau
 *   PUT {lingkup: peran|pengguna, sasaran, aturan, catatan?, tingkat?} -> menimpa aturan sasaran itu pada satu lapis
 *       (aturan kosong = hapus). Super Admin menulis lapis "super" (mengunci di atas Admin); Admin hanya lapis "admin".
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pratinjau = String(request.nextUrl.searchParams.get("pratinjau") || "").trim();
    return ok(await halamanAdminTampilanSipp(db, await resolveActorUserId(request), { pratinjau: pratinjau || undefined }));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = await getDatabase();
    let badan: { lingkup?: unknown; sasaran?: unknown; aturan?: unknown; catatan?: unknown; tingkat?: unknown };
    try {
      badan = (await request.json()) as typeof badan;
    } catch {
      throw new ApiError(400, "Badan permintaan harus JSON {lingkup, sasaran, aturan}.");
    }
    return ok(await simpanAturanTampilanSipp(db, await resolveActorUserId(request), badan || {}));
  } catch (error) {
    return handleRouteError(error);
  }
}
