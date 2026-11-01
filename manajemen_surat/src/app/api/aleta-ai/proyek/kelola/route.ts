import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuSuperAi } from "@/server/modules/aleta-ai/akses";
import { BATAS_ZIP_IMPOR, buatProyekKelola, daftarProyekKelola, imporZipProyek } from "@/server/modules/aleta-ai/proyek-kelola";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - proyek kelolaan (SUPER ADMIN SAJA; selain Super Admin dijawab 403).
 *   GET  -> [{id, nama, deskripsi, sertakanBawaan, akses, aksesPeran, aksesPengguna, memoriAktif, aktif, versi, jumlahBerkas, jumlahMemori, jumlahUsulan, diubah}]
 *   POST JSON {nama, deskripsi?, instruksi?, sertakanBawaan?, akses?, aksesPeran?, aksesPengguna?} -> proyek baru
 *   POST multipart (field "berkas" = ZIP berformat proyek V4.5, "nama"?) -> {proyek, jumlahBerkas, dilewati, peringatan}
 */
export async function GET(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuSuperAi(db, await resolveActorUserId(request));
    return ok(await daftarProyekKelola(db, pelaku));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuSuperAi(db, await resolveActorUserId(request));
    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      let formulir: FormData;
      try {
        formulir = await request.formData();
      } catch {
        throw new ApiError(400, "Kiriman tidak terbaca sebagai multipart/form-data.");
      }
      const berkas = formulir.get("berkas");
      if (!(berkas instanceof File)) throw new ApiError(400, "Berkas ZIP belum dipilih.");
      if (berkas.size > BATAS_ZIP_IMPOR) throw new ApiError(413, `Ukuran ZIP melampaui ${BATAS_ZIP_IMPOR / 1024 / 1024} MB.`);
      const hasil = await imporZipProyek(db, pelaku, { bita: Buffer.from(await berkas.arrayBuffer()), namaBerkas: berkas.name, nama: String(formulir.get("nama") ?? "") });
      return ok(hasil, { status: 201 });
    }
    const badan = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return ok(await buatProyekKelola(db, pelaku, badan), { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
