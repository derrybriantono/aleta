import { type NextRequest } from "next/server";

import { getDatabase } from "@/server/db/client";
import { pelakuSuperAi } from "@/server/modules/aleta-ai/akses";
import { BATAS_BERKAS_UNGGAH } from "@/server/modules/aleta-ai/ekstrak-teks";
import { imporZipProyek, tambahBerkasPengetahuan } from "@/server/modules/aleta-ai/proyek-kelola";
import { resolveActorUserId } from "@/server/shared/auth";
import { ApiError } from "@/server/shared/errors";
import { handleRouteError, ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ALETA Ai - unggah berkas pengetahuan ke proyek (SUPER ADMIN SAJA).
 *   POST multipart: field "berkas" (boleh beberapa; PDF, .docx, .rtf, .md, .txt - satu per satu tanpa ZIP),
 *        "selalu" = "1" (selalu ikut ke prompt). Berkas .zip berformat proyek V4.5 ditambahkan seluruh isinya.
 *   -> {hasil:[{nama, berkas?, diganti?, peringatan, galat?}]}
 * Nama berkas yang sama menggantikan isi berkas lama.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = await getDatabase();
    const pelaku = await pelakuSuperAi(db, await resolveActorUserId(request));
    const { id } = await params;
    if (!(request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      throw new ApiError(400, 'Kirim berkas sebagai multipart/form-data dengan field "berkas".');
    }
    let formulir: FormData;
    try {
      formulir = await request.formData();
    } catch {
      throw new ApiError(400, "Kiriman tidak terbaca sebagai multipart/form-data.");
    }
    const daftar = formulir.getAll("berkas").filter((b): b is File => b instanceof File);
    if (!daftar.length) throw new ApiError(400, "Belum ada berkas yang dipilih.");
    const selalu = String(formulir.get("selalu") ?? "") === "1";
    const hasil: Array<Record<string, unknown>> = [];
    for (const f of daftar) {
      if (f.size > BATAS_BERKAS_UNGGAH * 3) {
        hasil.push({ nama: f.name, galat: "Berkas melampaui batas ukuran.", peringatan: [] });
        continue;
      }
      try {
        const bita = Buffer.from(await f.arrayBuffer());
        if (/\.zip$/i.test(f.name)) {
          const impor = await imporZipProyek(db, pelaku, { bita, namaBerkas: f.name, proyekId: id });
          hasil.push({ nama: f.name, zip: true, jumlahBerkas: impor.jumlahBerkas, dilewati: impor.dilewati, peringatan: impor.peringatan });
        } else {
          const b = await tambahBerkasPengetahuan(db, pelaku, id, { nama: f.name, bita, selalu });
          hasil.push({ nama: f.name, berkas: b.berkas, diganti: b.diganti, peringatan: b.peringatan });
        }
      } catch (e) {
        if (e instanceof ApiError && (e.status === 403 || e.status === 404)) throw e;
        hasil.push({ nama: f.name, galat: e instanceof ApiError ? e.message : "Berkas tidak dapat diproses.", peringatan: [] });
      }
    }
    return ok({ hasil }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
