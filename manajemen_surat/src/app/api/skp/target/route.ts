import { type NextRequest } from "next/server";

import { bolehUbahTargetSkp } from "@/server/modules/skp/hak";
import { SKP_JABATAN_2026 } from "@/lib/skp-jabatan-katalog";
import { bacaIsiJson, jalankanRuteSkp } from "@/server/modules/skp/rute-umum";
import { bacaTarget, simpanTarget, type MasukanTargetSkp } from "@/server/modules/skp/target";
import { jabatanSkpSah } from "@/server/modules/skp/umum";
import { ApiError } from "@/server/shared/errors";
import { ok } from "@/server/shared/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Target SKP per jabatan dan tahun.
 *
 *   GET ?tahun=2026[&jabatan=pp]  baris tersimpan (usulan/disahkan) + bolehUbah.
 *       Tanpa baris = target usulan dari kode (SKP_JABATAN_2026) berlabel "usulan".
 *   PUT {butir: [{jabatan, tahun, kunciRhk, kunciIndikator, targetNilai, targetTeks?, satuan?, status?: "usulan"|"disahkan"}]}
 *       Panitera, Ketua, Super Admin, Admin saja (Wakil Ketua lihat saja).
 */
export async function GET(request: NextRequest) {
  return jalankanRuteSkp(request, "SKP_TARGET_FAILED", async ({ db, aktor }) => {
    const tahun = Number(request.nextUrl.searchParams.get("tahun"));
    if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) throw new ApiError(400, "Tahun harus empat angka antara 2000 dan 2100.");
    const jabatan = String(request.nextUrl.searchParams.get("jabatan") ?? "").trim();
    if (jabatan && !jabatanSkpSah(jabatan)) throw new ApiError(400, "Jabatan tidak dikenal.");
    const target = await bacaTarget(db, { tahun, jabatan: jabatan && jabatanSkpSah(jabatan) ? jabatan : null });
    return ok({
      tahun,
      bolehUbah: bolehUbahTargetSkp(aktor.peran),
      target,
      jabatanDikenal: Object.keys(SKP_JABATAN_2026),
    });
  });
}

export async function PUT(request: NextRequest) {
  return jalankanRuteSkp(request, "SKP_TARGET_SIMPAN_FAILED", async ({ db, aktor }) => {
    const isi = await bacaIsiJson(request);
    if (!Array.isArray(isi.butir)) throw new ApiError(400, "butir harus berupa daftar target.");
    return ok({ target: await simpanTarget(db, aktor, isi.butir as MasukanTargetSkp[]) });
  });
}
