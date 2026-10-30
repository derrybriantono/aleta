import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { BATAS_KONVERSI } from "@/server/modules/aleta-ecourt/konversi-naskah";
import { bacaPdfEdoc } from "@/server/modules/aleta-ecourt/edoc-baca-pdf";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Teks sebuah PDF sebagai paragraf, untuk pemeriksa isi e-Doc sebelum seret-lepas menyimpan ke SIPP (30 Okt 2026).
 *
 *   POST multipart: berkas (PDF, <= 20 MB)
 *   -> { ada, sebab, jumlahHalaman, halamanKosong[], paragraf: [{ teks, merah: [], halaman, nomor }] }
 *
 * Hanya membaca: tidak ada yang disimpan dan tidak ada tulisan ke SIPP/ABT. Cukup akun yang MASUK (sama dengan konversi-naskah).
 */
export async function POST(request: NextRequest) {
  let db: Awaited<ReturnType<typeof getDatabase>> | null = null;
  let actorUserId: string | null = null;
  try {
    db = await getDatabase();
    actorUserId = await resolveActorUserId(request);
    await requireActorUser(db, actorUserId);
    let formulir: FormData;
    try {
      formulir = await request.formData();
    } catch {
      throw new ApiError(400, "Kirim multipart/form-data dengan ruas berkas.");
    }
    const berkas = formulir.get("berkas");
    if (!(berkas instanceof File)) throw new ApiError(400, "Berkasnya belum dipilih.");
    if (berkas.size > BATAS_KONVERSI) throw new ApiError(413, `Ukuran berkas melampaui ${BATAS_KONVERSI / 1024 / 1024} MB.`);
    return ok(await bacaPdfEdoc(new Uint8Array(await berkas.arrayBuffer()), berkas.name));
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "EDOC_BACA_PDF_GAGAL",
      feature: "aleta_ecourt",
      entityId: "edoc-baca-pdf",
    });
  }
}
