import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuAi, wajibSuperAdmin } from "@/server/modules/aleta-ai/akses";
import { BATAS_ZIP_PROYEK, rincianProyekAdmin, unggahProyek } from "@/server/modules/aleta-ai/proyek";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - proyek V4.5 (Super Admin).
 *   GET  -> {versi (angka), diperbarui, modul:[{nama,versi,kode,judul,ukuran,pemicu}], riwayat:[...], aktif, pemicu, lampiran}
 *   POST multipart (field "berkas" = ZIP) -> {tidakBerubah, proyek, peringatan:[...]}
 * Core prompt = *_Core_Prompt.md; modul = ALETA_NN_*.md; pemicu dari ALETA_05.
 * Berkas non-teks hanya dicatat sebagai lampiran (tahap 3).
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    wajibSuperAdmin(await pelakuAi(db, await resolveActorUserId(request)));
    return ok(await rincianProyekAdmin(db));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuAi(db, await resolveActorUserId(request));
    wajibSuperAdmin(pelaku);
    if (!(request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      throw new ApiError(400, "Kirim ZIP sebagai multipart/form-data dengan field \"berkas\".");
    }
    let formulir: FormData;
    try {
      formulir = await request.formData();
    } catch {
      throw new ApiError(400, "Kiriman tidak terbaca sebagai multipart/form-data.");
    }
    const berkas = formulir.get("berkas");
    if (!(berkas instanceof File)) throw new ApiError(400, "Berkas ZIP belum dipilih.");
    if (berkas.size > BATAS_ZIP_PROYEK) throw new ApiError(413, `Ukuran ZIP melampaui ${BATAS_ZIP_PROYEK / 1024 / 1024} MB.`);
    const hasil = await unggahProyek(db, pelaku.id, { bita: Buffer.from(await berkas.arrayBuffer()), namaBerkas: berkas.name });
    return ok(hasil, { status: hasil.tidakBerubah ? 200 : 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
