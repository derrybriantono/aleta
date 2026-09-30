import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { BATAS_KONVERSI, konversiNaskah } from "@/server/modules/aleta-ecourt/konversi-naskah";
import { requireActorUser } from "@/server/modules/organization/service";
import { handleAdminRouteError } from "@/server/shared/admin-access-audit";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Konversi naskah - kontrak K1 (butir 8 dan 11 perbaikan 30 September 2026).
 *
 *   POST multipart: berkas (RTF/DOC/DOCX/PDF, <= 20 MB), ke = rtf|docx|doc|pdf
 *   -> { berkasBase64, namaBerkas, mime, bentukAsal, peringatan: string[] }
 *
 * Hanya menghitung: tidak ada yang disimpan, tidak ada tulisan ke SIPP/ABT.
 * Karena itu cukup pegawai yang MASUK (tanpa sesi 401) - tidak menuntut
 * kapabilitas menulis. Aturannya di modules/aleta-ecourt/konversi-naskah.ts.
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
      throw new ApiError(400, "Kirim multipart/form-data dengan ruas berkas dan ke.");
    }
    const berkas = formulir.get("berkas");
    if (!(berkas instanceof File)) throw new ApiError(400, "Berkasnya belum dipilih.");
    // Ukuran diperiksa SEBELUM dibaca ke memori.
    if (berkas.size > BATAS_KONVERSI) {
      throw new ApiError(413, `Ukuran berkas melampaui ${BATAS_KONVERSI / 1024 / 1024} MB.`);
    }

    return ok(
      await konversiNaskah({
        bita: new Uint8Array(await berkas.arrayBuffer()),
        namaBerkas: berkas.name,
        ke: formulir.get("ke"),
      })
    );
  } catch (error) {
    return handleAdminRouteError(error, request, {
      db,
      actorUserId,
      action: "PUTUSAN_KONVERSI_NASKAH_GAGAL",
      feature: "aleta_ecourt",
      entityId: "putusan-konversi-naskah",
    });
  }
}
